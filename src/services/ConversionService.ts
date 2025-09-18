/**
 * Conversion Service
 *
 * This service connects the JobQueue with the conversion pipeline components,
 * providing job creation, tracking, and management capabilities. It orchestrates
 * the entire conversion process from job creation to completion, managing resources
 * and providing real-time status updates.
 *
 * The service acts as the main entry point for conversion operations, handling
 * job lifecycle management, resource allocation, and status reporting.
 *
 * Implements requirements:
 * - 7.2: Process multiple conversion requests in parallel
 * - 7.4: Provide real-time status updates for conversion jobs
 *
 * @example
 * ```typescript
 * const service = new ConversionService({
 *   jobQueue: new JobQueue(),
 *   resourceAllocator: new ResourceAllocator()
 * });
 *
 * service.start();
 * const job = service.createConversionJob(input);
 * const status = service.getJobStatus(job.id);
 * ```
 *
 * @since 1.0.0
 */

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import {
  ConversionPipeline,
  // ConversionPipelineInput,
  // ConversionPipelineResult,
} from './ConversionPipeline';
import { JobQueue, Job } from './JobQueue';
import { ResourceAllocator } from './ResourceAllocator';
import { ErrorCollector } from './ErrorCollector';
import { ValidationPipeline } from './ValidationPipeline';
import { ConfigurationService } from './ConfigurationService';
import { createLogger } from '../utils/logger';
import {
  ConversionJob,
  ConversionInput,
  // ConversionOptions,
  ConversionStatus,
  ConversionResult,
  JobStatus,
  ConversionService as IConversionService,
} from '../types/services';
// import { ErrorSeverity, createErrorCode, createConversionError } from '../types/errors';
import { FileProcessor } from '../modules/ingestion/FileProcessor';
import { JavaAnalyzer } from '../modules/ingestion/JavaAnalyzer';
import { AssetConverter } from '../modules/conversion-agents/AssetConverter';
import { BedrockArchitect } from '../modules/conversion-agents/BedrockArchitect';
import { BlockItemGenerator } from '../modules/conversion-agents/BlockItemGenerator';
import { FeatureFlagService, MODPORTER_AI_FEATURES } from './FeatureFlagService';
import { StreamingFileProcessor } from './StreamingFileProcessor';
import { CacheService } from './CacheService';
import { WorkerPool } from './WorkerPool';
import { PerformanceMonitor } from './PerformanceMonitor';

const logger = createLogger('ConversionService');
// const MODULE_ID = 'CONVERSION';

/**
 * ConversionServiceOptions interface.
 *
 * Configuration options for the ConversionService, including new ModPorter-AI components.
 *
 * @since 1.0.0
 */
export interface ConversionServiceOptions {
  jobQueue: JobQueue;
  resourceAllocator?: ResourceAllocator;
  errorCollector?: ErrorCollector;
  configService?: ConfigurationService;
  statusUpdateInterval?: number; // milliseconds
  // New ModPorter-AI components
  fileProcessor?: FileProcessor;
  javaAnalyzer?: JavaAnalyzer;
  assetConverter?: AssetConverter;
  bedrockArchitect?: BedrockArchitect;
  blockItemGenerator?: BlockItemGenerator;
  validationPipeline?: ValidationPipeline;
  featureFlagService?: FeatureFlagService;
  // Performance optimization components
  streamingFileProcessor?: StreamingFileProcessor;
  cacheService?: CacheService;
  workerPool?: WorkerPool;
  performanceMonitor?: PerformanceMonitor;
}

/**
 * Service implementation that connects JobQueue with pipeline components.
 *
 * This class implements the ConversionService interface and provides
 * the core functionality for managing conversion jobs, including creation,
 * monitoring, and lifecycle management.
 *
 * @since 1.0.0
 */
export class ConversionService extends EventEmitter implements IConversionService {
  private jobQueue: JobQueue;
  private resourceAllocator?: ResourceAllocator;
  private errorCollector: ErrorCollector;
  private configService?: ConfigurationService;
  private pipeline: ConversionPipeline;
  private statusUpdateInterval: number;
  private activeJobs: Map<
    string,
    {
      job: Job;
      status: ConversionStatus;
      errorCollector: ErrorCollector;
    }
  > = new Map();
  private statusIntervalId?: NodeJS.Timeout;

  // New ModPorter-AI components
  private fileProcessor: FileProcessor;
  private javaAnalyzer: JavaAnalyzer;
  private assetConverter: AssetConverter;
  private bedrockArchitect: BedrockArchitect;
  private blockItemGenerator: BlockItemGenerator;
  private validationPipeline: ValidationPipeline;
  private featureFlagService: FeatureFlagService;
  // Performance optimization components
  private streamingFileProcessor: StreamingFileProcessor;
  private cacheService: CacheService;
  private workerPool: WorkerPool;
  private performanceMonitor: PerformanceMonitor;

  /**
   * Creates a new instance of the ConversionService.
   *
   * Initializes the service with the provided options, sets up the conversion
   * pipeline, and configures event listeners for job queue events.
   *
   * @param options - Configuration options for the conversion service
   * @throws {Error} When required options are missing or invalid
   * @since 1.0.0
   */
  constructor(options: ConversionServiceOptions) {
    super();
    this.jobQueue = options.jobQueue;
    this.resourceAllocator = options.resourceAllocator;
    this.errorCollector = options.errorCollector || new ErrorCollector();
    this.configService = options.configService;

    // Initialize performance optimization components first
    this.cacheService = options.cacheService || new CacheService();
    this.performanceMonitor = options.performanceMonitor || new PerformanceMonitor();
    this.streamingFileProcessor = options.streamingFileProcessor || new StreamingFileProcessor();
    this.workerPool = options.workerPool || new WorkerPool();

    // Initialize ModPorter-AI components with performance optimizations
    const defaultFileValidationConfig = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: ['application/java-archive', 'application/zip'],
      enableMalwareScanning: true,
      tempDirectory: path.join(process.cwd(), 'temp'),
      scanTimeout: 30000,
      maxCompressionRatio: 100,
      maxExtractedSize: 500 * 1024 * 1024, // 500MB
      enableMagicNumberValidation: true,
      cacheValidationResults: true,
      cacheTTL: 3600000, // 1 hour
    };

    const _defaultSecurityScanningConfig = {
      enableRealTimeScanning: true,
      scanTimeout: 30000,
      maxFileSize: 100 * 1024 * 1024,
      quarantineDirectory: path.join(process.cwd(), 'temp', 'quarantine'),
      allowedFileTypes: ['.jar', '.zip'],
      blockedPatterns: ['eval(', 'exec(', 'system('],
      enableZipBombDetection: true,
      maxCompressionRatio: 100,
      maxExtractedSize: 500 * 1024 * 1024,
      enablePathTraversalDetection: true,
      enableMalwarePatternDetection: true,
    };

    this.fileProcessor =
      options.fileProcessor ||
      new FileProcessor(defaultFileValidationConfig, this.cacheService, this.performanceMonitor);
    this.javaAnalyzer = options.javaAnalyzer || new JavaAnalyzer();
    this.assetConverter = options.assetConverter || new AssetConverter();
    this.bedrockArchitect = options.bedrockArchitect || new BedrockArchitect();
    this.blockItemGenerator = options.blockItemGenerator || new BlockItemGenerator();
    this.validationPipeline = options.validationPipeline || new ValidationPipeline();
    this.featureFlagService = options.featureFlagService || new FeatureFlagService();

    // Create pipeline with job queue and resource allocator
    this.pipeline = new ConversionPipeline({
      errorCollector: this.errorCollector,
      jobQueue: this.jobQueue,
      resourceAllocator: this.resourceAllocator,
      configService: this.configService,
    });

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.configService) {
      // Get status update interval from configuration
      this.statusUpdateInterval = this.configService.get(
        'conversion.statusUpdateInterval',
        options.statusUpdateInterval || 2000
      );

      // Listen for configuration changes
      this.configService.on('config:updated', this.handleConfigUpdate.bind(this));

      logger.info('ConversionService initialized with ConfigurationService', {
        statusUpdateInterval: this.statusUpdateInterval,
      });
    } else {
      // Use provided options or defaults
      this.statusUpdateInterval = options.statusUpdateInterval || 2000; // 2 seconds default

      logger.info('ConversionService initialized with default options', {
        statusUpdateInterval: this.statusUpdateInterval,
      });
    }

    // Set up job queue event listeners
    this.setupJobQueueListeners();
  }

  /**
   * Handle configuration updates from the ConfigurationService.
   *
   * Updates service settings when configuration changes are detected,
   * particularly for status update intervals and other runtime settings.
   *
   * @param update - Configuration update object containing key and new value
   * @since 1.0.0
   */
  private handleConfigUpdate(update: { key: string; value: any }): void {
    if (update.key === 'conversion.statusUpdateInterval') {
      this.statusUpdateInterval = update.value;
      logger.info('Updated status update interval from configuration', {
        statusUpdateInterval: this.statusUpdateInterval,
      });

      // Restart status updates if they're running
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (this.statusIntervalId) {
        this.stopStatusUpdates();
        this.startStatusUpdates();
      }
    }
  }

  /**
   * Start the conversion service.
   *
   * Initializes all service components, starts the resource allocator,
   * begins job processing, and starts status update intervals.
   *
   * @throws {Error} When service fails to start
   * @since 1.0.0
   */
  public start(): void {
    logger.info('Starting conversion service with performance optimizations');

    // Start performance monitoring
    this.performanceMonitor.startMonitoring();

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
   * Stop the conversion service.
   *
   * Gracefully shuts down all service components, stops job processing,
   * and cleans up resources.
   *
   * @since 1.0.0
   */
  public async stop(): Promise<void> {
    logger.info('Stopping conversion service');

    // Stop performance monitoring
    this.performanceMonitor.stopMonitoring();

    // Stop worker pool
    await this.workerPool.destroy();

    // Stop cache service
    await this.cacheService.destroy();

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
   * Create a new conversion job with enhanced file processing and validation.
   *
   * Creates a new conversion job from the provided input, performs enhanced file validation
   * and security scanning, then queues it for processing. The job will be processed
   * asynchronously by the conversion pipeline using the new ModPorter-AI components.
   *
   * @param input - Conversion input containing mod file and options
   * @returns Created conversion job with ID and initial status
   * @throws {Error} When job creation fails, file validation fails, or queue is unavailable
   *
   * @example
   * ```typescript
   * const job = service.createConversionJob({
   *   modFile: '/path/to/mod.jar',
   *   outputPath: '/path/to/output',
   *   options: { targetMinecraftVersion: '1.20' }
   * });
   * console.log(`Created job: ${job.id}`);
   * ```
   *
   * @since 1.0.0
   */
  public async createConversionJob(input: ConversionInput): Promise<ConversionJob> {
    logger.info('Creating conversion job with enhanced processing', { modFile: input.modFile });

    try {
      // Check feature flags to determine which components to use
      const useEnhancedFileProcessing = await this.featureFlagService.isEnabled(
        MODPORTER_AI_FEATURES.ENHANCED_FILE_PROCESSING
      );
      const useMultiStrategyAnalysis = await this.featureFlagService.isEnabled(
        MODPORTER_AI_FEATURES.MULTI_STRATEGY_ANALYSIS
      );

      let validationResult: any = { isValid: true };
      let analysisResult: any = { success: true };

      // Step 1: Enhanced file validation and security scanning (if enabled)
      if (useEnhancedFileProcessing) {
        // Ensure modFile is a string path for file operations
        const modFilePath =
          typeof input.modFile === 'string'
            ? input.modFile
            : (() => {
                throw new Error('Buffer input not supported for enhanced file processing');
              })();

        // Check file size to determine processing method
        // Validate modFilePath to prevent path traversal
        if (!modFilePath || modFilePath.includes('..') || modFilePath.includes('\0')) {
          throw new Error('Invalid mod file path detected');
        }
        const stats = await fs.stat(modFilePath);
        const fileSize = stats.size;

        if (fileSize > 10 * 1024 * 1024) {
          // Use streaming for files > 10MB
          logger.info('Using streaming file processor for large file', {
            modFile: modFilePath,
            size: fileSize,
          });
          validationResult = await this.streamingFileProcessor.processLargeFile(modFilePath, {
            maxFileSize: 500 * 1024 * 1024, // 500MB limit
            allowedMimeTypes: ['application/java-archive', 'application/zip'],
            enableMalwareScanning: true,
            tempDirectory: process.env.TEMP_DIR || '/tmp',
          });
        } else {
          // Use regular processing for smaller files
          const fileBuffer = await this.readFileBuffer(modFilePath);
          validationResult = await this.fileProcessor.validateUpload(fileBuffer, modFilePath);
        }

        if (!validationResult.isValid) {
          const errorMessage = `File validation failed: ${validationResult.errors?.map((e: any) => e.message).join(', ')}`;
          logger.error('File validation failed', {
            modFile: modFilePath,
            errors: validationResult.errors,
          });
          throw new Error(errorMessage);
        }

        logger.info('Enhanced file processing completed', {
          modFile: modFilePath,
          streamingUsed: fileSize > 10 * 1024 * 1024,
        });
      }

      // Step 2: Enhanced Java analysis with multi-strategy extraction (if enabled)
      if (useMultiStrategyAnalysis) {
        // Use worker pool for CPU-intensive analysis
        try {
          const jarPath =
            typeof input.modFile === 'string'
              ? input.modFile
              : (() => {
                  throw new Error('Buffer input not supported for worker analysis');
                })();

          analysisResult = await this.workerPool.runTask({
            id: `analysis-${Date.now()}`,
            priority: 1,
            execute: async (input: { jarPath: string }) => {
              return await this.javaAnalyzer.analyzeJarForMVP(input.jarPath);
            },
            input: { jarPath },
          });
        } catch (workerError) {
          // Fallback to direct analysis if worker fails
          logger.warn('Worker pool analysis failed, falling back to direct analysis', {
            error: workerError,
          });
          const jarPath =
            typeof input.modFile === 'string'
              ? input.modFile
              : (() => {
                  throw new Error('Buffer input not supported for direct analysis');
                })();
          analysisResult = await this.javaAnalyzer.analyzeJarForMVP(jarPath);
        }

        if (!analysisResult || analysisResult.modId === 'unknown') {
          logger.warn('Java analysis returned minimal results', { modFile: input.modFile });
        }

        logger.info('Multi-strategy analysis completed', {
          modFile: input.modFile,
          registryNames: analysisResult.registryNames?.length || 0,
          texturePaths: analysisResult.texturePaths?.length || 0,
        });
      }

      // Ensure we have a string path for pipeline input
      const inputPath =
        typeof input.modFile === 'string'
          ? input.modFile
          : (() => {
              throw new Error('Buffer input not supported for pipeline processing');
            })();

      // Prepare enhanced pipeline input with analysis results
      const pipelineInput = {
        inputPath: inputPath,
        outputPath: input.outputPath,
        modId: analysisResult.modId || this.extractModId(inputPath),
        modName: analysisResult.modName || this.extractModName(inputPath),
        modVersion: analysisResult.modVersion || input.options.targetMinecraftVersion,
        modDescription: analysisResult.modDescription || '',
        modAuthor: analysisResult.modAuthor || '',
        generateReport: input.options.includeDocumentation,
        packageAddon: true,
        // Include analysis results for enhanced processing
        analysisResult,
        validationResult,
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
        updatedAt: job.createdAt,
      };

      // Create a dedicated error collector for this job
      const jobErrorCollector = new ErrorCollector();

      // Store active job info with enhanced status
      this.activeJobs.set(job.id, {
        job,
        status: {
          jobId: job.id,
          status: job.status as JobStatus,
          progress: 0,
          currentStage: 'validated',
        },
        errorCollector: jobErrorCollector,
      });

      // Emit job created event
      this.emit('job:created', conversionJob);

      logger.info('Conversion job created successfully with enhanced processing', {
        jobId: job.id,
        modId: analysisResult.modId,
        registryNames: analysisResult.registryNames?.length || 0,
        texturePaths: analysisResult.texturePaths?.length || 0,
      });

      return conversionJob;
    } catch (error) {
      logger.error('Failed to create conversion job', {
        error: error.message,
        modFile: input.modFile,
      });
      throw error;
    }
  }

  /**
   * Get the status of a conversion job
   *
   * @param jobId Job ID
   * @returns Conversion status or undefined if job not found
   */
  public getJobStatus(jobId: string): ConversionStatus | undefined {
    const activeJob = this.activeJobs.get(jobId);
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (activeJob) {
      return activeJob.status;
    }

    // Check if job exists in queue but not in active jobs
    const job = this.jobQueue.getJob(jobId);
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (job) {
      return {
        jobId: job.id,
        status: job.status as JobStatus,
        progress: job.status === 'completed' ? 100 : 0,
        currentStage: job.status,
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
      status: filter?.status,
    });

    return jobs.map((job) => {
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
        completedAt: job.status === 'completed' || job.status === 'failed' ? new Date() : undefined,
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

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
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
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (priority < 1 || priority > 10) {
      logger.warn('Invalid priority value', { jobId, priority });
      return false;
    }

    // Update job priority in the queue
    const updated = this.jobQueue.updateJobPriority(jobId, priority);

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
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
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!this.jobQueue) return;

    // Listen for job completed events
    this.jobQueue.on('job:completed', (job: Job) => {
      if (job.type !== 'conversion') return;

      // Update active job status
      const activeJob = this.activeJobs.get(job.id);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (activeJob) {
        activeJob.status.status = 'completed';
        activeJob.status.progress = 100;
        activeJob.status.currentStage = 'completed';
      }

      // Emit job completed event
      this.emit('job:completed', {
        jobId: job.id,
        result: job.result,
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
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (activeJob) {
        activeJob.status.status = 'failed';
        activeJob.status.currentStage = 'failed';
      }

      // Emit job failed event
      this.emit('job:failed', {
        jobId: job.id,
        error: job.error,
      });

      // Clean up active job after some time
      setTimeout(() => {
        this.activeJobs.delete(job.id);
      }, 3600000); // Keep failed jobs for 1 hour
    });
  }

  /**
   * Start status update interval
   */
  private startStatusUpdates(): void {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.statusIntervalId) return;

    this.statusIntervalId = setInterval(() => {
      this.updateJobStatuses();
    }, this.statusUpdateInterval);
  }

  /**
   * Stop status update interval
   */
  private stopStatusUpdates(): void {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.statusIntervalId) {
      /**
       * clearInterval method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
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

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [_jobId, activeJob] of this.activeJobs.entries()) {
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
    const modId = fileName
      .split('.')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
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
   * Read file as buffer for processing
   *
   * @param filePath Path to the file
   * @returns File buffer
   */
  private async readFileBuffer(filePath: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath);
  }

  public async processModFile(file: Buffer, filename: string): Promise<ConversionResult> {
    const tempDir = this.configService?.get('fileProcessor.tempDirectory') || './temp';
    const tempFile = path.join(tempDir, filename);

    try {
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(tempFile, file);

      const job = await this.createConversionJob({
        modFile: tempFile,
        outputPath: path.join(
          this.configService?.get('assetConverter.outputDirectory') || './output',
          filename
        ),
        options: {
          targetMinecraftVersion: '1.20',
          includeDocumentation: true,
          optimizeAssets: true,
        },
      });

      return new Promise((resolve, reject) => {
        const checkStatus = () => {
          const status = this.getJobStatus(job.id);
          if (status?.status === 'completed') {
            resolve(this.getJobResult(job.id)!);
          } else if (status?.status === 'failed') {
            reject(new Error('Conversion job failed'));
          } else {
            setTimeout(checkStatus, 500);
          }
        };
        checkStatus();
      });
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  /**
   * Utility function to delay execution
   *
   * @param ms Milliseconds to delay
   * @returns Promise that resolves after the delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
