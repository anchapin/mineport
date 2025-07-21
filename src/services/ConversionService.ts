/**
 * Conversion Service
 * 
 * This service connects the JobQueue with the conversion pipeline components,
 * providing job creation, tracking, and management capabilities.
 * 
 * Implements requirements:
 * - 7.2: Process multiple conversion requests in parallel
 * - 7.4: Provide real-time status updates for conversion jobs
 */

import { EventEmitter } from 'events';
import { ConversionPipeline, ConversionPipelineInput, ConversionPipelineResult } from './ConversionPipeline';
import { JobQueue, Job } from './JobQueue';
import { ResourceAllocator } from './ResourceAllocator';
import { ErrorCollector } from './ErrorCollector';
import { createLogger } from '../utils/logger';
import { 
  ConversionJob, 
  ConversionInput, 
  ConversionOptions, 
  ConversionStatus, 
  ConversionResult,
  JobStatus,
  ConversionService as IConversionService
} from '../types/services';
import { ErrorSeverity, createErrorCode, createConversionError } from '../types/errors';

const logger = createLogger('ConversionService');
const MODULE_ID = 'CONVERSION';

export interface ConversionServiceOptions {
  jobQueue: JobQueue;
  resourceAllocator?: ResourceAllocator;
  errorCollector?: ErrorCollector;
  configService?: ConfigurationService;
  statusUpdateInterval?: number; // milliseconds
}

/**
 * Service to connect JobQueue with pipeline components
 * 
 * Implements the ConversionService interface
 */
export class ConversionService extends EventEmitter implements IConversionService {
  private jobQueue: JobQueue;
  private resourceAllocator?: ResourceAllocator;
  private errorCollector: ErrorCollector;
  private configService?: ConfigurationService;
  private pipeline: ConversionPipeline;
  private statusUpdateInterval: number;
  private activeJobs: Map<string, { 
    job: Job, 
    status: ConversionStatus,
    errorCollector: ErrorCollector 
  }> = new Map();
  private statusIntervalId?: NodeJS.Timeout;

  /**
   * Creates a new instance of the ConversionService
   * 
   * @param options Options for the conversion service
   */
  constructor(options: ConversionServiceOptions) {
    super();
    this.jobQueue = options.jobQueue;
    this.resourceAllocator = options.resourceAllocator;
    this.errorCollector = options.errorCollector || new ErrorCollector();
    this.configService = options.configService;
    
    // Create pipeline with job queue and resource allocator
    this.pipeline = new ConversionPipeline({ 
      errorCollector: this.errorCollector,
      jobQueue: this.jobQueue,
      resourceAllocator: this.resourceAllocator,
      configService: this.configService
    });
    
    if (this.configService) {
      // Get status update interval from configuration
      this.statusUpdateInterval = this.configService.get(
        'conversion.statusUpdateInterval', 
        options.statusUpdateInterval || 2000
      );
      
      // Listen for configuration changes
      this.configService.on('config:updated', this.handleConfigUpdate.bind(this));
      
      logger.info('ConversionService initialized with ConfigurationService', { 
        statusUpdateInterval: this.statusUpdateInterval 
      });
    } else {
      // Use provided options or defaults
      this.statusUpdateInterval = options.statusUpdateInterval || 2000; // 2 seconds default
      
      logger.info('ConversionService initialized with default options', { 
        statusUpdateInterval: this.statusUpdateInterval 
      });
    }
    
    // Set up job queue event listeners
    this.setupJobQueueListeners();
  }
  
  /**
   * Handle configuration updates
   */
  private handleConfigUpdate(update: { key: string; value: any }): void {
    if (update.key === 'conversion.statusUpdateInterval') {
      this.statusUpdateInterval = update.value;
      logger.info('Updated status update interval from configuration', { 
        statusUpdateInterval: this.statusUpdateInterval 
      });
      
      // Restart status updates if they're running
      if (this.statusIntervalId) {
        this.stopStatusUpdates();
        this.startStatusUpdates();
      }
    }
  }

  /**
   * Start the conversion service
   */
  public start(): void {
    logger.info('Starting conversion service');
    
    // Start the resource allocator if provided
    if (this.resourceAllocator) {
      this.resourceAllocator.start();
    }
    
    // Start processing jobs from the queue
    this.pipeline.startProcessingJobs();
    
    // Start status update interval
    this.startStatusUpdates();
    
    // Emit started event
    this.emit('started');
  }

  /**
   * Stop the conversion service
   */
  public stop(): void {
    logger.info('Stopping conversion service');
    
    // Stop the resource allocator if provided
    if (this.resourceAllocator) {
      this.resourceAllocator.stop();
    }
    
    // Stop processing jobs from the queue
    this.pipeline.stopProcessingJobs();
    
    // Stop status update interval
    this.stopStatusUpdates();
    
    // Emit stopped event
    this.emit('stopped');
  }

  /**
   * Create a new conversion job
   * 
   * @param input Conversion input
   * @returns Created conversion job
   */
  public createConversionJob(input: ConversionInput): ConversionJob {
    logger.info('Creating conversion job', { modFile: input.modFile });
    
    // Prepare pipeline input
    const pipelineInput = {
      inputPath: input.modFile,
      outputPath: input.outputPath,
      modId: this.extractModId(input.modFile),
      modName: this.extractModName(input.modFile),
      modVersion: input.options.targetMinecraftVersion,
      modDescription: '',
      modAuthor: '',
      generateReport: input.options.includeDocumentation,
      packageAddon: true
    };
    
    // Queue the conversion job using the pipeline
    const jobId = this.pipeline.queueConversion(pipelineInput);
    
    if (!jobId) {
      throw new Error('Failed to queue conversion job');
    }
    
    // Get the job from the queue
    const job = this.jobQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job not found after queueing: ${jobId}`);
    }
    
    // Create conversion job object
    const conversionJob: ConversionJob = {
      id: job.id,
      input,
      status: job.status as JobStatus,
      progress: 0,
      createdAt: job.createdAt,
      updatedAt: job.createdAt
    };
    
    // Create a dedicated error collector for this job
    const jobErrorCollector = new ErrorCollector();
    
    // Store active job info
    this.activeJobs.set(job.id, { 
      job, 
      status: {
        jobId: job.id,
        status: job.status as JobStatus,
        progress: 0,
        currentStage: 'queued'
      },
      errorCollector: jobErrorCollector
    });
    
    // Emit job created event
    this.emit('job:created', conversionJob);
    
    return conversionJob;
  }

  /**
   * Get the status of a conversion job
   * 
   * @param jobId Job ID
   * @returns Conversion status or undefined if job not found
   */
  public getJobStatus(jobId: string): ConversionStatus | undefined {
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return activeJob.status;
    }
    
    // Check if job exists in queue but not in active jobs
    const job = this.jobQueue.getJob(jobId);
    if (job) {
      return {
        jobId: job.id,
        status: job.status as JobStatus,
        progress: job.status === 'completed' ? 100 : 0,
        currentStage: job.status
      };
    }
    
    return undefined;
  }

  /**
   * Get all conversion jobs with optional filtering
   * 
   * @param filter Optional filter criteria
   * @returns Array of conversion jobs
   */
  public getJobs(filter?: { status?: JobStatus }): ConversionJob[] {
    const jobs = this.jobQueue.getJobs({ 
      type: 'conversion', 
      status: filter?.status 
    });
    
    return jobs.map(job => {
      const activeJob = this.activeJobs.get(job.id);
      
      return {
        id: job.id,
        input: job.data,
        status: job.status as JobStatus,
        progress: activeJob?.status.progress || (job.status === 'completed' ? 100 : 0),
        result: job.result,
        error: job.error?.message,
        createdAt: job.createdAt,
        updatedAt: new Date(), // This should ideally be stored with the job
        completedAt: job.status === 'completed' || job.status === 'failed' ? new Date() : undefined
      };
    });
  }

  /**
   * Cancel a conversion job
   * 
   * @param jobId Job ID
   * @returns True if job was cancelled, false otherwise
   */
  public cancelJob(jobId: string): boolean {
    logger.info('Cancelling conversion job', { jobId });
    
    // Use the pipeline to cancel the job
    const cancelled = this.pipeline.cancelJob(jobId);
    
    if (cancelled) {
      // Emit job cancelled event
      this.emit('job:cancelled', { jobId });
    }
    
    return cancelled;
  }
  
  /**
   * Update job priority
   * 
   * @param jobId Job ID
   * @param priority New priority (higher number = higher priority)
   * @returns True if job priority was updated, false otherwise
   */
  public updateJobPriority(jobId: string, priority: number): boolean {
    logger.info('Updating job priority', { jobId, priority });
    
    // Validate priority value
    if (priority < 1 || priority > 10) {
      logger.warn('Invalid priority value', { jobId, priority });
      return false;
    }
    
    // Update job priority in the queue
    const updated = this.jobQueue.updateJobPriority(jobId, priority);
    
    if (updated) {
      // Emit job priority updated event
      this.emit('job:priority', { jobId, priority });
    }
    
    return updated;
  }

  /**
   * Get the result of a completed conversion job
   * 
   * @param jobId Job ID
   * @returns Conversion result or undefined if job not found or not completed
   */
  public getJobResult(jobId: string): ConversionResult | undefined {
    const job = this.jobQueue.getJob(jobId);
    if (!job || job.status !== 'completed') {
      return undefined;
    }
    
    return job.result;
  }

  /**
   * Set up job queue event listeners
   */
  private setupJobQueueListeners(): void {
    if (!this.jobQueue) return;
    
    // Listen for job completed events
    this.jobQueue.on('job:completed', (job: Job) => {
      if (job.type !== 'conversion') return;
      
      // Update active job status
      const activeJob = this.activeJobs.get(job.id);
      if (activeJob) {
        activeJob.status.status = 'completed';
        activeJob.status.progress = 100;
        activeJob.status.currentStage = 'completed';
      }
      
      // Emit job completed event
      this.emit('job:completed', {
        jobId: job.id,
        result: job.result
      });
      
      // Clean up active job after some time
      setTimeout(() => {
        this.activeJobs.delete(job.id);
      }, 3600000); // Keep completed jobs for 1 hour
    });
    
    // Listen for job failed events
    this.jobQueue.on('job:failed', (job: Job) => {
      if (job.type !== 'conversion') return;
      
      // Update active job status
      const activeJob = this.activeJobs.get(job.id);
      if (activeJob) {
        activeJob.status.status = 'failed';
        activeJob.status.currentStage = 'failed';
      }
      
      // Emit job failed event
      this.emit('job:failed', {
        jobId: job.id,
        error: job.error
      });
      
      // Clean up active job after some time
      setTimeout(() => {
        this.activeJobs.delete(job.id);
      }, 3600000); // Keep failed jobs for 1 hour
    });
  }

  /**
   * Update job statuses
   */
  private updateJobStatuses(): void {
    if (!this.jobQueue) return;
    
    // Get all processing jobs
    const processingJobs = this.jobQueue.getJobs({ status: 'processing' });
    
    for (const job of processingJobs) {
      if (job.type !== 'conversion') continue;
      
      const activeJob = this.activeJobs.get(job.id);
      if (!activeJob) continue;
      
      // Get job status from pipeline
      const pipelineStatus = this.pipeline.getJobStatus(job.id);
      
      if (pipelineStatus) {
        // Update active job status with pipeline status
        activeJob.status.status = pipelineStatus.status as JobStatus;
        if (pipelineStatus.progress !== undefined) {
          activeJob.status.progress = pipelineStatus.progress;
        }
        
        // Emit status update event
        this.emit('job:status', activeJob.status);
      }
    }
  }

  /**
   * Start status update interval
   */
  private startStatusUpdates(): void {
    if (this.statusIntervalId) return;
    
    this.statusIntervalId = setInterval(() => {
      this.updateJobStatuses();
    }, this.statusUpdateInterval);
  }

  /**
   * Stop status update interval
   */
  private stopStatusUpdates(): void {
    if (this.statusIntervalId) {
      clearInterval(this.statusIntervalId);
      this.statusIntervalId = undefined;
    }
  }

  /**
   * Update job statuses
   */
  private updateJobStatuses(): void {
    // This is a simplified implementation
    // In a real system, we would query the actual progress of each job
    
    for (const [jobId, activeJob] of this.activeJobs.entries()) {
      if (activeJob.job.status === 'processing') {
        // Emit status update event
        this.emit('job:status', activeJob.status);
      }
    }
  }

  /**
   * Extract mod ID from file path
   * 
   * @param filePath File path
   * @returns Mod ID
   */
  private extractModId(filePath: string): string {
    // This is a simplified implementation
    // In a real system, we would extract the mod ID from the mod file
    const fileName = filePath.split('/').pop() || '';
    const modId = fileName.split('.')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return modId || 'unknown_mod';
  }

  /**
   * Extract mod name from file path
   * 
   * @param filePath File path
   * @returns Mod name
   */
  private extractModName(filePath: string): string {
    // This is a simplified implementation
    // In a real system, we would extract the mod name from the mod file
    const fileName = filePath.split('/').pop() || '';
    const modName = fileName.split('.')[0].replace(/_/g, ' ');
    return modName.charAt(0).toUpperCase() + modName.slice(1) || 'Unknown Mod';
  }

  /**
   * Utility function to delay execution
   * 
   * @param ms Milliseconds to delay
   * @returns Promise that resolves after the delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}