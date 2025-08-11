/**
 * JobQueue Service for managing conversion jobs with priority queue and worker pool
 */

import { EventEmitter } from 'events';
import { Job, JobData, JobType, JobPriority, JobStatusUpdate, QueueStats } from '../types/job.js';
import { PriorityQueue } from '../utils/PriorityQueue.js';
import { WorkerPool } from './WorkerPool.js';
import { ResourceManager } from './ResourceManager.js';
import { JobStatusStore } from './JobStatusStore.js';
import { logger } from '../utils/logger.js';

export interface JobQueueConfig {
  maxConcurrentJobs: number;
  defaultJobTimeout: number;
  retryDelayMs: number;
  maxRetries: number;
  enableRealTimeUpdates: boolean;
  queueProcessingInterval: number;
}

export class JobQueueService extends EventEmitter {
  private queue: PriorityQueue<Job>;
  private workerPool: WorkerPool;
  private resourceManager: ResourceManager;
  private statusStore: JobStatusStore;
  private config: JobQueueConfig;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(config: Partial<JobQueueConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentJobs: config.maxConcurrentJobs || 4,
      defaultJobTimeout: config.defaultJobTimeout || 300000, // 5 minutes
      retryDelayMs: config.retryDelayMs || 5000, // 5 seconds
      maxRetries: config.maxRetries || 3,
      enableRealTimeUpdates: config.enableRealTimeUpdates || true,
      queueProcessingInterval: config.queueProcessingInterval || 1000 // 1 second
    };

    this.queue = new PriorityQueue<Job>();
    this.workerPool = new WorkerPool({
      maxWorkers: this.config.maxConcurrentJobs
    });
    this.resourceManager = new ResourceManager();
    this.statusStore = new JobStatusStore();

    this.setupEventHandlers();
    this.startQueueProcessing();
  }

  async enqueueJob(jobData: JobData): Promise<string> {
    // Validate job data before creating job
    if (!jobData || !jobData.type || !jobData.priority) {
      throw new Error('Invalid job data: type and priority are required');
    }
    
    if (!jobData.payload || !jobData.options) {
      throw new Error('Invalid job data: payload and options are required');
    }
    
    const job = this.createJob(jobData);
    
    // Validate created job
    const validationResult = this.validateJob(job);
    if (!validationResult.isValid) {
      throw new Error(`Invalid job data: ${validationResult.errors.join(', ')}`);
    }

    // Add to queue with priority
    const priority = this.getPriorityValue(job.priority);
    this.queue.enqueue(job, priority);
    
    // Save to status store
    await this.statusStore.saveJob(job);
    
    logger.info(`Job ${job.id} enqueued with priority ${job.priority}`, {
      type: job.type,
      queueSize: this.queue.size
    });

    // Emit job enqueued event
    this.emit('jobEnqueued', { jobId: job.id, type: job.type, priority: job.priority });
    
    // Try to process immediately if resources are available
    this.processQueue();
    
    return job.id;
  }

  async getJobStatus(jobId: string): Promise<Job | null> {
    return await this.statusStore.getJob(jobId);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.statusStore.getJob(jobId);
    
    if (!job) {
      logger.warn(`Cannot cancel job ${jobId}: job not found`);
      return false;
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      logger.warn(`Cannot cancel job ${jobId}: job already in final state (${job.status})`);
      return false;
    }

    if (job.status === 'running') {
      // Cancel running job in worker pool
      const cancelled = await this.workerPool.cancelJob(jobId);
      if (!cancelled) {
        logger.error(`Failed to cancel running job ${jobId} in worker pool`);
        return false;
      }
      
      // Release resources
      await this.resourceManager.releaseResources(jobId);
    } else if (job.status === 'pending') {
      // Remove from queue
      const removed = this.queue.remove(queuedJob => queuedJob.id === jobId);
      if (!removed) {
        logger.warn(`Job ${jobId} not found in queue for cancellation`);
      }
    }

    // Update job status
    job.status = 'cancelled';
    job.completedAt = new Date();
    await this.statusStore.updateJob(job);

    logger.info(`Job ${jobId} cancelled successfully`);
    this.emit('jobCancelled', { jobId });
    
    return true;
  }

  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.statusStore.getJob(jobId);
    
    if (!job) {
      logger.warn(`Cannot retry job ${jobId}: job not found`);
      return false;
    }

    if (job.status !== 'failed') {
      logger.warn(`Cannot retry job ${jobId}: job is not in failed state (current: ${job.status})`);
      return false;
    }

    if (job.retryCount >= job.maxRetries) {
      logger.warn(`Cannot retry job ${jobId}: maximum retries (${job.maxRetries}) exceeded`);
      return false;
    }

    // Reset job for retry
    job.status = 'pending';
    job.retryCount++;
    job.error = undefined;
    job.startedAt = undefined;
    job.completedAt = undefined;

    // Add back to queue
    const priority = this.getPriorityValue(job.priority);
    this.queue.enqueue(job, priority);
    
    await this.statusStore.updateJob(job);

    logger.info(`Job ${jobId} queued for retry (attempt ${job.retryCount}/${job.maxRetries})`);
    this.emit('jobRetried', { jobId, retryCount: job.retryCount });
    
    return true;
  }

  async getQueueStats(): Promise<QueueStats> {
    const baseStats = await this.statusStore.getQueueStats();
    const workerStats = this.workerPool.getWorkerStats();
    
    return {
      ...baseStats,
      queueLength: this.queue.size,
      activeWorkers: workerStats.busyWorkers
    };
  }

  async getJobHistory(jobId?: string, limit?: number): Promise<JobStatusUpdate[]> {
    return await this.statusStore.getJobHistory(jobId, limit);
  }

  async pauseQueue(): Promise<void> {
    this.isProcessing = false;
    logger.info('Job queue processing paused');
    this.emit('queuePaused');
  }

  async resumeQueue(): Promise<void> {
    this.isProcessing = true;
    this.processQueue();
    logger.info('Job queue processing resumed');
    this.emit('queueResumed');
  }

  async clearQueue(): Promise<number> {
    const queueSize = this.queue.size;
    this.queue.clear();
    logger.info(`Cleared ${queueSize} jobs from queue`);
    this.emit('queueCleared', { clearedJobs: queueSize });
    return queueSize;
  }

  private createJob(jobData: JobData): Job {
    const now = new Date();
    
    return {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: jobData.type,
      priority: jobData.priority,
      status: 'pending',
      payload: {
        type: jobData.type,
        data: jobData.payload,
        options: {
          timeout: jobData.options?.timeout || this.config.defaultJobTimeout,
          retryCount: 0,
          maxRetries: jobData.options?.maxRetries || this.config.maxRetries,
          notificationEndpoint: jobData.options?.notificationEndpoint,
          priority: jobData.priority,
          resourceRequirements: jobData.options?.resourceRequirements || {
            memory: 1024, // 1GB default
            cpu: 1, // 1 core default
            disk: 512 // 512MB default
          }
        }
      },
      progress: {
        stage: 'Queued',
        percentage: 0,
        details: {
          currentStep: 'Waiting in queue',
          totalSteps: 1,
          completedSteps: 0
        }
      },
      createdAt: now,
      retryCount: 0,
      maxRetries: jobData.options?.maxRetries || this.config.maxRetries
    };
  }

  private validateJob(job: Job): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!job.id) {
      errors.push('Job ID is required');
    }

    if (!job.type || !['conversion', 'validation', 'analysis', 'packaging'].includes(job.type)) {
      errors.push('Valid job type is required');
    }

    if (!job.priority || !['low', 'normal', 'high', 'urgent'].includes(job.priority)) {
      errors.push('Valid job priority is required');
    }

    if (!job.payload || !job.payload.options) {
      errors.push('Job payload and options are required');
    }

    if (job.payload && job.payload.options) {
      const options = job.payload.options;
      if (!options.resourceRequirements) {
        errors.push('Resource requirements are required');
      } else {
        const req = options.resourceRequirements;
        if (typeof req.memory !== 'number' || typeof req.cpu !== 'number' || typeof req.disk !== 'number') {
          errors.push('Resource requirements must be numbers');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private getPriorityValue(priority: JobPriority): number {
    const priorityMap = {
      urgent: 1,
      high: 2,
      normal: 3,
      low: 4
    };
    return priorityMap[priority];
  }

  private setupEventHandlers(): void {
    // Worker pool events
    this.workerPool.on('jobStarted', ({ jobId, workerId }) => {
      this.handleJobStarted(jobId, workerId);
    });

    this.workerPool.on('jobCompleted', ({ jobId, workerId, result, processingTime }) => {
      this.handleJobCompleted(jobId, workerId, result, processingTime);
    });

    this.workerPool.on('jobFailed', ({ jobId, workerId, error, processingTime }) => {
      this.handleJobFailed(jobId, workerId, error, processingTime);
    });

    this.workerPool.on('jobProgress', ({ jobId, progress }) => {
      this.handleJobProgress(jobId, progress);
    });

    this.workerPool.on('workerTimeout', ({ workerId, jobId }) => {
      this.handleWorkerTimeout(workerId, jobId);
    });
  }

  private async handleJobStarted(jobId: string, workerId: string): Promise<void> {
    const job = await this.statusStore.getJob(jobId);
    if (!job) return;

    job.status = 'running';
    job.startedAt = new Date();
    job.progress = {
      stage: 'Processing',
      percentage: 0,
      details: {
        currentStep: 'Starting job',
        totalSteps: 5,
        completedSteps: 0
      }
    };

    await this.statusStore.updateJob(job);
    
    if (this.config.enableRealTimeUpdates) {
      this.emit('jobStatusUpdate', { jobId, status: 'running', workerId });
    }
  }

  private async handleJobCompleted(jobId: string, workerId: string, result: any, processingTime: number): Promise<void> {
    const job = await this.statusStore.getJob(jobId);
    if (!job) return;

    job.status = 'completed';
    job.completedAt = new Date();
    job.result = result;
    job.progress = {
      stage: 'Completed',
      percentage: 100,
      details: {
        currentStep: 'Job completed successfully',
        totalSteps: 5,
        completedSteps: 5,
        processingRate: processingTime
      }
    };

    await this.statusStore.updateJob(job);
    await this.resourceManager.releaseResources(jobId);

    logger.info(`Job ${jobId} completed successfully in ${processingTime}ms`);
    
    if (this.config.enableRealTimeUpdates) {
      this.emit('jobStatusUpdate', { jobId, status: 'completed', result, processingTime });
    }

    // Continue processing queue
    this.processQueue();
  }

  private async handleJobFailed(jobId: string, workerId: string, error: Error, processingTime: number): Promise<void> {
    const job = await this.statusStore.getJob(jobId);
    if (!job) return;

    job.error = {
      code: 'JOB_EXECUTION_FAILED',
      message: error.message,
      stack: error.stack,
      recoverable: job.retryCount < job.maxRetries
    };

    await this.resourceManager.releaseResources(jobId);

    // Check if we should retry
    if (job.retryCount < job.maxRetries) {
      logger.warn(`Job ${jobId} failed, scheduling retry ${job.retryCount + 1}/${job.maxRetries}`, error);
      
      // Schedule retry after delay
      setTimeout(async () => {
        await this.retryJob(jobId);
      }, this.config.retryDelayMs);
      
    } else {
      // Mark as permanently failed
      job.status = 'failed';
      job.completedAt = new Date();
      
      await this.statusStore.updateJob(job);
      
      logger.error(`Job ${jobId} permanently failed after ${job.maxRetries} retries`, error);
      
      if (this.config.enableRealTimeUpdates) {
        this.emit('jobStatusUpdate', { jobId, status: 'failed', error: job.error });
      }
    }

    // Continue processing queue
    this.processQueue();
  }

  private async handleJobProgress(jobId: string, progress: any): Promise<void> {
    const job = await this.statusStore.getJob(jobId);
    if (!job) return;

    job.progress = progress;
    await this.statusStore.updateJob(job);
    
    if (this.config.enableRealTimeUpdates) {
      this.emit('jobProgress', { jobId, progress });
    }
  }

  private async handleWorkerTimeout(workerId: string, jobId: string): Promise<void> {
    logger.error(`Worker ${workerId} timed out while processing job ${jobId}`);
    
    const job = await this.statusStore.getJob(jobId);
    if (!job) return;

    job.error = {
      code: 'WORKER_TIMEOUT',
      message: `Worker ${workerId} timed out`,
      recoverable: job.retryCount < job.maxRetries
    };

    await this.resourceManager.releaseResources(jobId);

    // Retry if possible
    if (job.retryCount < job.maxRetries) {
      setTimeout(async () => {
        await this.retryJob(jobId);
      }, this.config.retryDelayMs);
    } else {
      job.status = 'failed';
      job.completedAt = new Date();
      await this.statusStore.updateJob(job);
    }
  }

  private startQueueProcessing(): void {
    this.isProcessing = true;
    
    this.processingInterval = setInterval(() => {
      if (this.isProcessing) {
        this.processQueue();
      }
    }, this.config.queueProcessingInterval);
  }

  private async processQueue(): Promise<void> {
    if (!this.isProcessing || this.queue.isEmpty) {
      return;
    }

    // Check if we have available workers
    if (!this.workerPool.hasAvailableWorker()) {
      return;
    }

    // Get next job from queue
    const job = this.queue.dequeue();
    if (!job) {
      return;
    }

    // Check if we can allocate resources
    const resourceAllocation = await this.resourceManager.allocateResources(job);
    if (!resourceAllocation) {
      // Put job back in queue if resources not available
      const priority = this.getPriorityValue(job.priority);
      this.queue.enqueue(job, priority);
      return;
    }

    job.resourceAllocation = resourceAllocation;

    // Assign job to worker
    const workerId = await this.workerPool.assignJob(job);
    if (!workerId) {
      // Release resources and put job back in queue
      await this.resourceManager.releaseResources(job.id);
      const priority = this.getPriorityValue(job.priority);
      this.queue.enqueue(job, priority);
      return;
    }

    logger.debug(`Job ${job.id} assigned to worker ${workerId}`);
  }

  destroy(): void {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.workerPool.destroy();
    this.resourceManager.destroy();
    this.statusStore.destroy();
    this.queue.clear();
    this.removeAllListeners();

    logger.info('JobQueueService destroyed');
  }
}