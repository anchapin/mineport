import { EventEmitter } from 'events';
import { ConfigurationService } from './ConfigurationService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('JobQueue');

/**
 * Job interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
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
 * JobQueueOptions interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface JobQueueOptions {
  maxConcurrent?: number;
  defaultPriority?: number;
  configService?: ConfigurationService;
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

  /**
   * Creates a new instance.
   *
   * TODO: Add detailed description of constructor behavior.
   *
   * @param param - TODO: Document parameters
   * @since 1.0.0
   */
  constructor(options: JobQueueOptions = {}) {
    /**
     * super method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    super();
    this.configService = options.configService;

    // Use configuration service if available, otherwise use provided options or defaults
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
      this.maxConcurrent = this.configService.get(
        'processing.maxConcurrent',
        options.maxConcurrent || 5
      );
      this.defaultPriority = this.configService.get(
        'processing.defaultPriority',
        options.defaultPriority || 1
      );

      // Listen for configuration changes
      this.configService.on('config:updated', this.handleConfigUpdate.bind(this));

      logger.info('JobQueue initialized with ConfigurationService', {
        maxConcurrent: this.maxConcurrent,
        defaultPriority: this.defaultPriority,
      });
    } else {
      this.maxConcurrent = options.maxConcurrent || 5;
      this.defaultPriority = options.defaultPriority || 1;

      logger.info('JobQueue initialized with default options', {
        maxConcurrent: this.maxConcurrent,
        defaultPriority: this.defaultPriority,
      });
    }
  }

  /**
   * Handle configuration updates
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

    return job;
  }

  /**
   * Get a job by ID
   */
  public getJob(id: string): Job | undefined {
    return this.queue.find((job) => job.id === id);
  }

  /**
   * Get all jobs with optional filtering
   */
  public getJobs(filter?: { status?: Job['status']; type?: string }): Job[] {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!filter) return [...this.queue];

    return this.queue.filter((job) => {
      if (filter.status && job.status !== filter.status) return false;
      if (filter.type && job.type !== filter.type) return false;
      return true;
    });
  }

  /**
   * Mark a job as completed with result
   */
  public completeJob(id: string, result?: any): void {
    const job = this.getJob(id);
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!job) return;

    job.status = 'completed';
    job.result = result;
    this.processing.delete(id);

    this.emit('job:completed', job);
    this.processNextJobs();
  }

  /**
   * Mark a job as failed with error
   */
  public failJob(id: string, error: Error): void {
    const job = this.getJob(id);
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!job) return;

    job.status = 'failed';
    job.error = error;
    this.processing.delete(id);

    this.emit('job:failed', job);
    this.processNextJobs();
  }

  /**
   * Process the next available jobs if capacity allows
   */
  private processNextJobs(): void {
    if (this.processing.size >= this.maxConcurrent) return;

    const availableSlots = this.maxConcurrent - this.processing.size;
    const pendingJobs = this.queue
      .filter((job) => job.status === 'pending')
      .slice(0, availableSlots);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const job of pendingJobs) {
      job.status = 'processing';
      this.processing.add(job.id);
      this.emit('job:process', job);
    }
  }

  /**
   * Sort the queue based on priority (higher number = higher priority)
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
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set the maximum number of concurrent jobs
   */
  public setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.processNextJobs();
  }

  /**
   * Get current queue statistics
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

    // Process next jobs if we freed up a processing slot
    this.processNextJobs();

    return true;
  }
}
