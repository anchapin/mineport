import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { ConfigurationService } from './ConfigurationService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('JobQueue');

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>): void => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Job interface representing a conversion request in the queue
 * Contains all necessary metadata for processing and tracking status
 * @since 1.0.0
 */
export interface Job {
  id: string;
  type: string;
  data: any;
  priority: number;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: Error;
}

/**
 * JobQueueOptions interface for configuring JobQueue behavior
 * Defines optional parameters for queue initialization
 * @since 1.0.0
 */
export interface JobQueueOptions {
  maxConcurrent?: number;
  defaultPriority?: number;
  configService?: ConfigurationService;
  persistence?: {
    enabled: boolean;
    filePath: string;
    cleanupInterval?: number;
  };
}

/**
 * JobQueue service for managing conversion request jobs
 * Implements requirement 7.2: Process multiple conversion requests in parallel
 */
export class JobQueue extends EventEmitter {
  private queue: Job[] = [];
  private processing: Set<string> = new Set();
  private maxConcurrent: number;
  private defaultPriority: number;
  private configService?: ConfigurationService;
  private persistenceOptions?: JobQueueOptions['persistence'];
  private debouncedSaveQueue: () => void;

  /**
   * Creates a new JobQueue instance with the specified options
   * @param options - Configuration options for the job queue
   * @since 1.0.0
   */
  constructor(options: JobQueueOptions = {}) {
    super();
    this.configService = options.configService;

    // Use configuration service if available, otherwise use provided options or defaults
    if (this.configService) {
      this.maxConcurrent =
        this.configService.get('jobQueue.maxConcurrent') || options.maxConcurrent || 5;
      this.defaultPriority =
        this.configService.get('jobQueue.defaultPriority') || options.defaultPriority || 1;
      this.persistenceOptions =
        this.configService.get('jobQueue.persistence') || options.persistence;

      // Listen for configuration changes
      this.configService.on('config:updated', this.handleConfigUpdate.bind(this));

      logger.info('JobQueue initialized with ConfigurationService', {
        maxConcurrent: this.maxConcurrent,
        defaultPriority: this.defaultPriority,
        persistence: this.persistenceOptions,
      });
    } else {
      this.maxConcurrent = options.maxConcurrent || 5;
      this.defaultPriority = options.defaultPriority || 1;
      this.persistenceOptions = options.persistence;

      logger.info('JobQueue initialized with default options', {
        maxConcurrent: this.maxConcurrent,
        defaultPriority: this.defaultPriority,
        persistence: this.persistenceOptions,
      });
    }

    this.debouncedSaveQueue = debounce(this._saveQueue.bind(this), 1000);

    if (this.persistenceOptions?.enabled) {
      this._loadQueue().then(() => this.processNextJobs());
    }
  }

  /**
   * Handle configuration updates
   * @param update - Configuration update containing key and value
   * @returns void
   */
  private handleConfigUpdate(update: { key: string; value: any }): void {
    if (update.key === 'processing.maxConcurrent') {
      this.maxConcurrent = update.value;
      logger.info('Updated maxConcurrent from configuration', {
        maxConcurrent: this.maxConcurrent,
      });
      this.processNextJobs();
    } else if (update.key === 'processing.defaultPriority') {
      this.defaultPriority = update.value;
      logger.info('Updated defaultPriority from configuration', {
        defaultPriority: this.defaultPriority,
      });
    }
  }

  /**
   * Add a new job to the queue
   * @param type - Job type identifier
   * @param data - Job data payload
   * @param priority - Optional job priority (uses default if not specified)
   * @returns The created job object
   */
  public addJob(type: string, data: any, priority?: number): Job {
    const job: Job = {
      id: this.generateJobId(),
      type,
      data,
      priority: priority || this.defaultPriority,
      createdAt: new Date(),
      status: 'pending',
    };

    this.queue.push(job);
    this.sortQueue();

    // Emit event for new job
    this.emit('job:added', job);

    // Try to process next jobs
    this.processNextJobs();

    this.debouncedSaveQueue();

    return job;
  }

  /**
   * Get a job by ID
   * @param id - Unique job identifier
   * @returns The job object if found, undefined otherwise
   */
  public getJob(id: string): Job | undefined {
    return this.queue.find((job) => job.id === id);
  }

  /**
   * Get all jobs with optional filtering
   * @param filter - Optional filter criteria for status and type
   * @returns Array of jobs matching the filter criteria
   */
  public getJobs(filter?: { status?: Job['status']; type?: string }): Job[] {
    if (!filter) return [...this.queue];

    return this.queue.filter((job) => {
      if (filter.status && job.status !== filter.status) return false;
      if (filter.type && job.type !== filter.type) return false;
      return true;
    });
  }

  /**
   * Mark a job as completed with result
   * @param id - Job identifier
   * @param result - Optional result data to store with the job
   * @returns void
   */
  public completeJob(id: string, result?: any): void {
    const job = this.getJob(id);
    if (!job) return;

    job.status = 'completed';
    job.result = result;
    this.processing.delete(id);

    this.emit('job:completed', job);
    this.processNextJobs();
    this.debouncedSaveQueue();
  }

  /**
   * Mark a job as failed with error
   * @param id - Job identifier
   * @param error - Error that caused the job to fail
   * @returns void
   */
  public failJob(id: string, error: Error): void {
    const job = this.getJob(id);
    if (!job) return;

    job.status = 'failed';
    job.error = error;
    this.processing.delete(id);

    this.emit('job:failed', job);
    this.processNextJobs();
    this.debouncedSaveQueue();
  }

  /**
   * Process the next available jobs if capacity allows
   * @returns void
   */
  private processNextJobs(): void {
    if (this.processing.size >= this.maxConcurrent) return;

    const availableSlots = this.maxConcurrent - this.processing.size;
    const pendingJobs = this.queue
      .filter((job) => job.status === 'pending')
      .slice(0, availableSlots);

    for (const job of pendingJobs) {
      job.status = 'processing';
      this.processing.add(job.id);
      this.emit('job:process', job);
    }
  }

  /**
   * Sort the queue based on priority (higher number = higher priority)
   * @returns void
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // First by priority (descending)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Then by creation time (ascending)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Generate a unique job ID
   * @returns Unique job identifier string
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set the maximum number of concurrent jobs
   * @param max - Maximum number of concurrent jobs to process
   * @returns void
   */
  public setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.processNextJobs();
  }

  /**
   * Get current queue statistics
   * @returns Object containing counts for each job status
   */
  public getStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    return {
      pending: this.queue.filter((job) => job.status === 'pending').length,
      processing: this.processing.size,
      completed: this.queue.filter((job) => job.status === 'completed').length,
      failed: this.queue.filter((job) => job.status === 'failed').length,
      cancelled: this.queue.filter((job) => job.status === 'cancelled').length,
    };
  }

  /**
   * Update job priority
   *
   * @param id Job ID
   * @param priority New priority (higher number = higher priority)
   * @returns True if job priority was updated, false otherwise
   */
  public updateJobPriority(id: string, priority: number): boolean {
    const job = this.getJob(id);
    if (!job || job.status !== 'pending') return false;

    job.priority = priority;
    this.sortQueue();

    // Emit event for priority update
    this.emit('job:priority', job);

    this.debouncedSaveQueue();

    return true;
  }

  /**
   * Cancel a job
   *
   * @param id Job ID
   * @returns True if job was cancelled, false otherwise
   */
  public cancelJob(id: string): boolean {
    const job = this.getJob(id);
    if (!job || (job.status !== 'pending' && job.status !== 'processing')) return false;

    // If job is processing, remove from processing set
    if (job.status === 'processing') {
      this.processing.delete(id);
    }

    job.status = 'cancelled';

    // Emit event for job cancellation
    this.emit('job:cancelled', job);

    this.debouncedSaveQueue();

    // Process next jobs if we freed up a processing slot
    this.processNextJobs();

    return true;
  }

  private async _saveQueue(): Promise<void> {
    if (!this.persistenceOptions?.enabled) {
      return;
    }

    const filePath = this.persistenceOptions.filePath;
    const tempFilePath = `${filePath}.${Date.now()}.tmp`;

    try {
      const data = JSON.stringify(this.queue, null, 2);
      await fs.writeFile(tempFilePath, data);
      await fs.rename(tempFilePath, filePath);
      logger.info(`Job queue saved to ${filePath}`);
    } catch (error) {
      logger.error('Failed to save job queue', { error });
      // Attempt to clean up the temporary file if it exists
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }

  private async _loadQueue(): Promise<void> {
    if (!this.persistenceOptions?.enabled) {
      return;
    }

    const filePath = this.persistenceOptions.filePath;

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const jobs = JSON.parse(data) as Job[];
      // Reset processing status for all loaded jobs
      this.queue = jobs.map((job) => ({
        ...job,
        status: job.status === 'processing' ? 'pending' : job.status,
        createdAt: new Date(job.createdAt),
      }));
      this.sortQueue();
      logger.info(`Job queue loaded from ${filePath}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.info('No job queue file found, starting fresh.');
      } else {
        logger.error('Failed to load job queue', { error });
      }
    }
  }
}
