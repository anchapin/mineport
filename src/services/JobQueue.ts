import { EventEmitter } from 'events';

export interface Job {
  id: string;
  type: string;
  data: any;
  priority: number;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: Error;
}

export interface JobQueueOptions {
  maxConcurrent?: number;
  defaultPriority?: number;
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

  constructor(options: JobQueueOptions = {}) {
    super();
    this.maxConcurrent = options.maxConcurrent || 5;
    this.defaultPriority = options.defaultPriority || 1;
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
    return this.queue.find(job => job.id === id);
  }

  /**
   * Get all jobs with optional filtering
   */
  public getJobs(filter?: { status?: Job['status'], type?: string }): Job[] {
    if (!filter) return [...this.queue];
    
    return this.queue.filter(job => {
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
      .filter(job => job.status === 'pending')
      .slice(0, availableSlots);
    
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
  public getStats(): { pending: number; processing: number; completed: number; failed: number } {
    return {
      pending: this.queue.filter(job => job.status === 'pending').length,
      processing: this.processing.size,
      completed: this.queue.filter(job => job.status === 'completed').length,
      failed: this.queue.filter(job => job.status === 'failed').length,
    };
  }
}