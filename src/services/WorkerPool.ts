import { EventEmitter } from 'events';
import { Job, JobQueue } from './JobQueue';
import { ConfigurationService } from './ConfigurationService';
import { createLogger } from '../utils/logger';

const logger = createLogger('WorkerPool');

export interface Worker {
  id: string;
  status: 'idle' | 'busy';
  currentJob?: Job;
  capabilities: string[];
  performance: {
    completedJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
  };
}

export interface WorkerPoolOptions {
  maxWorkers?: number;
  jobQueue?: JobQueue;
  configService?: ConfigurationService;
}

/**
 * WorkerPool service for managing parallel processing of jobs
 * Implements requirement 7.2: Process multiple conversion requests in parallel
 */
export class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private maxWorkers: number;
  private jobQueue: JobQueue;
  private configService?: ConfigurationService;

  constructor(options: WorkerPoolOptions = {}) {
    super();
    this.configService = options.configService;
    
    if (this.configService) {
      // Use configuration service if available
      this.maxWorkers = this.configService.get('workers.maxWorkers', options.maxWorkers || 5);
      
      // Listen for configuration changes
      this.configService.on('config:updated', this.handleConfigUpdate.bind(this));
      
      logger.info('WorkerPool initialized with ConfigurationService', { maxWorkers: this.maxWorkers });
    } else {
      // Use provided options or defaults
      this.maxWorkers = options.maxWorkers || 5;
      
      logger.info('WorkerPool initialized with default options', { maxWorkers: this.maxWorkers });
    }
    
    this.jobQueue = options.jobQueue || new JobQueue();
    
    // Initialize the worker pool
    this.initialize();
    
    // Listen for job queue events
    this.setupJobQueueListeners();
  }
  
  /**
   * Handle configuration updates
   */
  private handleConfigUpdate(update: { key: string; value: any }): void {
    if (update.key === 'workers.maxWorkers') {
      const newMaxWorkers = update.value;
      logger.info('Updated maxWorkers from configuration', { 
        oldValue: this.maxWorkers, 
        newValue: newMaxWorkers 
      });
      
      // Scale the worker pool to the new size
      this.scalePool(newMaxWorkers);
    }
  }

  /**
   * Initialize the worker pool with workers
   */
  private initialize(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.addWorker();
    }
  }

  /**
   * Add a new worker to the pool
   */
  private addWorker(capabilities: string[] = ['*']): Worker {
    const worker: Worker = {
      id: `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'idle',
      capabilities,
      performance: {
        completedJobs: 0,
        failedJobs: 0,
        averageProcessingTime: 0,
      },
    };
    
    this.workers.push(worker);
    this.emit('worker:added', worker);
    return worker;
  }

  /**
   * Set up listeners for job queue events
   */
  private setupJobQueueListeners(): void {
    this.jobQueue.on('job:process', (job: Job) => {
      this.assignJobToWorker(job);
    });
  }

  /**
   * Assign a job to an available worker
   */
  private assignJobToWorker(job: Job): void {
    // Find an idle worker
    const availableWorker = this.workers.find(worker => 
      worker.status === 'idle' && 
      (worker.capabilities.includes('*') || worker.capabilities.includes(job.type))
    );
    
    if (!availableWorker) {
      // No available worker, put job back in queue
      job.status = 'pending';
      return;
    }
    
    // Assign job to worker
    availableWorker.status = 'busy';
    availableWorker.currentJob = job;
    
    // Simulate job processing
    this.processJob(availableWorker, job);
  }

  /**
   * Process a job with a worker (in a real system, this would delegate to actual worker processes)
   */
  private processJob(worker: Worker, job: Job): void {
    const startTime = Date.now();
    
    // Emit event that job processing has started
    this.emit('job:started', { worker, job });
    
    // In a real implementation, this would delegate to actual worker processes
    // For now, we'll simulate async processing
    setTimeout(() => {
      const processingTime = Date.now() - startTime;
      
      try {
        // Simulate successful job completion 90% of the time
        if (Math.random() > 0.1) {
          // Update worker stats
          worker.performance.completedJobs++;
          this.updateWorkerPerformanceStats(worker, processingTime);
          
          // Complete the job
          this.jobQueue.completeJob(job.id, { result: 'Simulated job result' });
          
          // Reset worker status
          worker.status = 'idle';
          worker.currentJob = undefined;
          
          this.emit('job:processed', { worker, job, success: true });
        } else {
          // Simulate job failure
          worker.performance.failedJobs++;
          
          // Fail the job
          this.jobQueue.failJob(job.id, new Error('Simulated job failure'));
          
          // Reset worker status
          worker.status = 'idle';
          worker.currentJob = undefined;
          
          this.emit('job:processed', { worker, job, success: false });
        }
      } catch (error) {
        // Handle unexpected errors
        worker.performance.failedJobs++;
        this.jobQueue.failJob(job.id, error instanceof Error ? error : new Error(String(error)));
        
        // Reset worker status
        worker.status = 'idle';
        worker.currentJob = undefined;
        
        this.emit('job:processed', { worker, job, success: false, error });
      }
    }, this.simulateProcessingTime(job));
  }

  /**
   * Simulate variable processing time based on job type and data
   */
  private simulateProcessingTime(job: Job): number {
    // In a real system, different job types would take different amounts of time
    const baseTime = 1000; // 1 second base
    const jobComplexityFactor = job.data?.complexity || 1;
    
    return baseTime * jobComplexityFactor;
  }

  /**
   * Update worker performance statistics
   */
  private updateWorkerPerformanceStats(worker: Worker, processingTime: number): void {
    const { completedJobs, averageProcessingTime } = worker.performance;
    
    // Calculate new average processing time
    const totalProcessingTime = averageProcessingTime * (completedJobs - 1);
    worker.performance.averageProcessingTime = 
      (totalProcessingTime + processingTime) / completedJobs;
  }

  /**
   * Get all workers with optional filtering
   */
  public getWorkers(filter?: { status?: Worker['status'] }): Worker[] {
    if (!filter) return [...this.workers];
    
    return this.workers.filter(worker => {
      if (filter.status && worker.status !== filter.status) return false;
      return true;
    });
  }

  /**
   * Get worker pool statistics
   */
  public getStats(): { total: number; idle: number; busy: number } {
    return {
      total: this.workers.length,
      idle: this.workers.filter(w => w.status === 'idle').length,
      busy: this.workers.filter(w => w.status === 'busy').length,
    };
  }

  /**
   * Scale the worker pool up or down
   */
  public scalePool(targetSize: number): void {
    if (targetSize < 1) targetSize = 1;
    
    const currentSize = this.workers.length;
    
    if (targetSize > currentSize) {
      // Scale up
      for (let i = currentSize; i < targetSize; i++) {
        this.addWorker();
      }
    } else if (targetSize < currentSize) {
      // Scale down - remove idle workers only
      const excessWorkers = currentSize - targetSize;
      const idleWorkers = this.workers.filter(w => w.status === 'idle');
      
      for (let i = 0; i < Math.min(excessWorkers, idleWorkers.length); i++) {
        const workerToRemove = idleWorkers[i];
        this.workers = this.workers.filter(w => w.id !== workerToRemove.id);
        this.emit('worker:removed', workerToRemove);
      }
    }
    
    this.maxWorkers = targetSize;
  }
}