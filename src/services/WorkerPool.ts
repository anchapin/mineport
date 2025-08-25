/**
 * Worker Pool for parallel job processing
 */

import { EventEmitter } from 'events';
import { Job, JobType, WorkerInfo } from '../types/job.js';
import { logger } from '../utils/logger.js';

export interface WorkerPoolConfig {
  maxWorkers: number;
  minWorkers?: number;
  workerCapabilities?: Map<string, JobType[]>;
  heartbeatInterval?: number;
  workerTimeout?: number;
  idleTimeout?: number;
}

export interface Worker {
  id: string;
  status: 'idle' | 'busy' | 'error' | 'terminated';
  currentJob?: Job;
  capabilities: JobType[];
  lastHeartbeat: Date;
  startedAt: Date;
  processedJobs: number;
  failedJobs: number;
}

export interface WorkerTask<TInput, TOutput> {
  id?: string;
  priority?: number;
  execute: (input: TInput) => Promise<TOutput> | TOutput;
  input: TInput;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  busyWorkers: number;
  idleWorkers: number;
  pendingTasks: number;
}

export class WorkerPool extends EventEmitter {
  private workers = new Map<string, Worker>();
  private jobWorkerMap = new Map<string, string>();
  private taskQueue: Array<{
    task: WorkerTask<unknown, unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: WorkerPoolConfig;

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    super();

    this.config = {
      maxWorkers: config.maxWorkers || 4,
      minWorkers: config.minWorkers || 1,
      workerCapabilities:
        config.workerCapabilities ||
        new Map([
          ['conversion-worker', ['conversion']],
          ['validation-worker', ['validation']],
          ['analysis-worker', ['analysis']],
          ['packaging-worker', ['packaging']],
        ]),
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      workerTimeout: config.workerTimeout || 300000, // 5 minutes
      idleTimeout: config.idleTimeout || 60000, // 1 minute
    };

    this.initializeWorkers();
    this.startHeartbeatMonitoring();
  }

  async assignJob(job: Job): Promise<string | null> {
    const availableWorker = this.findAvailableWorker(job.type);

    if (!availableWorker) {
      logger.warn(`No available worker found for job type: ${job.type}`);
      return null;
    }

    availableWorker.status = 'busy';
    availableWorker.currentJob = job;
    availableWorker.lastHeartbeat = new Date();

    this.jobWorkerMap.set(job.id, availableWorker.id);

    logger.info(`Job ${job.id} assigned to worker ${availableWorker.id}`);

    // Start processing the job
    this.processJob(availableWorker, job);

    return availableWorker.id;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const workerId = this.jobWorkerMap.get(jobId);

    if (!workerId) {
      logger.warn(`No worker found for job ${jobId}`);
      return false;
    }

    const worker = this.workers.get(workerId);

    if (!worker || !worker.currentJob) {
      logger.warn(`Worker ${workerId} not found or not processing job ${jobId}`);
      return false;
    }

    // Signal job cancellation
    worker.status = 'idle';
    worker.currentJob = undefined;
    this.jobWorkerMap.delete(jobId);

    logger.info(`Job ${jobId} cancelled on worker ${workerId}`);

    this.emit('jobCancelled', { jobId, workerId });
    return true;
  }

  getAvailableWorkers(): Worker[] {
    return Array.from(this.workers.values()).filter((worker) => worker.status === 'idle');
  }

  getWorkerInfo(): WorkerInfo[] {
    return Array.from(this.workers.values()).map((worker) => ({
      id: worker.id,
      status: worker.status,
      currentJobId: worker.currentJob?.id,
      capabilities: worker.capabilities,
      resourceCapacity: {
        memory: 2048, // 2GB per worker
        cpu: 1, // 1 core per worker
        disk: 1024, // 1GB per worker
      },
      resourceUsage: {
        memory: worker.status === 'busy' ? 1024 : 0,
        cpu: worker.status === 'busy' ? 0.8 : 0,
        disk: worker.status === 'busy' ? 512 : 0,
      },
      lastHeartbeat: worker.lastHeartbeat,
    }));
  }

  getWorkerStats() {
    const workers = Array.from(this.workers.values());

    return {
      totalWorkers: workers.length,
      idleWorkers: workers.filter((w) => w.status === 'idle').length,
      busyWorkers: workers.filter((w) => w.status === 'busy').length,
      errorWorkers: workers.filter((w) => w.status === 'error').length,
      totalProcessedJobs: workers.reduce((sum, w) => sum + w.processedJobs, 0),
      totalFailedJobs: workers.reduce((sum, w) => sum + w.failedJobs, 0),
      averageJobsPerWorker:
        workers.length > 0
          ? workers.reduce((sum, w) => sum + w.processedJobs, 0) / workers.length
          : 0,
    };
  }

  /**
   * Run a task using the worker pool
   */
  async runTask<TInput, TOutput>(task: WorkerTask<TInput, TOutput>): Promise<TOutput> {
    return new Promise((resolve, reject) => {
      const queueItem = { task, resolve, reject };

      // Insert task based on priority (higher priority first)
      const priority = task.priority || 0;
      let insertIndex = this.taskQueue.length;

      for (let i = 0; i < this.taskQueue.length; i++) {
        const existingPriority = this.taskQueue[i].task.priority || 0;
        if (priority > existingPriority) {
          insertIndex = i;
          break;
        }
      }

      this.taskQueue.splice(insertIndex, 0, queueItem);
      this.processTaskQueue();
    });
  }

  /**
   * Get worker pool statistics
   * @returns Current statistics including worker counts and pending tasks
   */
  getStats(): WorkerPoolStats {
    const workers = Array.from(this.workers.values());
    return {
      totalWorkers: workers.length,
      busyWorkers: workers.filter((w) => w.status === 'busy').length,
      idleWorkers: workers.filter((w) => w.status === 'idle').length,
      pendingTasks: this.taskQueue.length,
    };
  }

  /**
   * Cancel a task by ID
   * @param taskId - Unique identifier of the task to cancel
   * @returns True if the task was found and cancelled, false otherwise
   */
  cancelTask(taskId: string): boolean {
    // First check if task is in queue
    const taskIndex = this.taskQueue.findIndex((item) => item.task.id === taskId);
    if (taskIndex >= 0) {
      const { reject } = this.taskQueue[taskIndex];
      this.taskQueue.splice(taskIndex, 1);
      reject(new Error(`Task ${taskId} was cancelled`));
      return true;
    }

    // Check if task is currently running
    for (const worker of this.workers.values()) {
      if (worker.status === 'busy' && worker.currentJob?.id === taskId) {
        // Mark worker as idle and clear current job
        worker.status = 'idle';
        worker.currentJob = undefined;

        // The task promise will be rejected in the executeTask method
        // when it detects the cancellation
        return true;
      }
    }

    return false;
  }

  /**
   * Shutdown the worker pool
   * @returns Promise that resolves when all workers have been shutdown
   */
  async shutdown(): Promise<void> {
    // Cancel all pending tasks
    while (this.taskQueue.length > 0) {
      const { reject } = this.taskQueue.shift()!;
      reject(new Error('Worker pool is shutting down'));
    }

    // Wait for all workers to finish current tasks
    const busyWorkers = Array.from(this.workers.values()).filter((w) => w.status === 'busy');
    if (busyWorkers.length > 0) {
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const stillBusy = Array.from(this.workers.values()).filter((w) => w.status === 'busy');
          if (stillBusy.length === 0) {
            clearInterval(checkInterval);
            resolve(void 0);
          }
        }, 100);
      });
    }

    this.destroy();
  }

  hasAvailableWorker(jobType?: JobType): boolean {
    return this.findAvailableWorker(jobType) !== null;
  }

  private findAvailableWorker(jobType?: JobType): Worker | null {
    const availableWorkers = Array.from(this.workers.values()).filter(
      (worker) => worker.status === 'idle' && (!jobType || worker.capabilities.includes(jobType))
    );

    // Return the worker with the least processed jobs for load balancing
    return availableWorkers.reduce(
      (best, current) => (!best || current.processedJobs < best.processedJobs ? current : best),
      null as Worker | null
    );
  }

  private processTaskQueue(): void {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.findAvailableWorker();
    if (!availableWorker) return;

    const { task, resolve, reject } = this.taskQueue.shift()!;

    availableWorker.status = 'busy';
    availableWorker.currentJob = { id: task.id || 'unknown', type: 'task' as JobType };
    availableWorker.lastHeartbeat = new Date();

    this.executeTask(availableWorker, task, reject)
      .then(resolve)
      .catch(reject)
      .finally(() => {
        availableWorker.status = 'idle';
        availableWorker.currentJob = undefined;
        availableWorker.lastHeartbeat = new Date();
        // Process next task in queue
        this.processTaskQueue();
      });
  }

  private async executeTask<TInput, TOutput>(
    worker: Worker,
    task: WorkerTask<TInput, TOutput>,
    _reject?: (reason?: unknown) => void
  ): Promise<TOutput> {
    try {
      // Check if task was cancelled before execution
      if (worker.status === 'idle' && worker.currentJob?.id === task.id) {
        throw new Error(`Task ${task.id} was cancelled`);
      }

      const result = await task.execute(task.input);

      // Check if task was cancelled during execution
      if (worker.status === 'idle' && worker.currentJob === undefined) {
        throw new Error(`Task ${task.id} was cancelled`);
      }

      worker.processedJobs++;
      return result;
    } catch (error) {
      worker.failedJobs++;
      throw error;
    }
  }

  private initializeWorkers(): void {
    const workerTypes = Array.from(this.config.workerCapabilities!.entries());
    const workersPerType = Math.ceil(this.config.maxWorkers / workerTypes.length);
    const minWorkersToCreate = Math.max(this.config.minWorkers || 1, 1);

    let workerCount = 0;

    // Create at least minWorkers, distributed across types
    for (const [workerType, capabilities] of workerTypes) {
      for (let i = 0; i < workersPerType && workerCount < this.config.maxWorkers; i++) {
        const workerId = `${workerType}-${i}`;

        const worker: Worker = {
          id: workerId,
          status: 'idle',
          capabilities,
          lastHeartbeat: new Date(),
          startedAt: new Date(),
          processedJobs: 0,
          failedJobs: 0,
        };

        this.workers.set(workerId, worker);
        workerCount++;

        logger.info(`Initialized worker ${workerId} with capabilities: ${capabilities.join(', ')}`);

        // Ensure we create at least minWorkers
        if (workerCount >= minWorkersToCreate && workerCount >= this.config.maxWorkers) {
          break;
        }
      }
      if (workerCount >= this.config.maxWorkers) break;
    }

    // If we still don't have enough workers, create generic ones
    while (workerCount < minWorkersToCreate && workerCount < this.config.maxWorkers) {
      const workerId = `generic-worker-${workerCount}`;
      const worker: Worker = {
        id: workerId,
        status: 'idle',
        capabilities: ['conversion', 'validation', 'analysis', 'packaging'],
        lastHeartbeat: new Date(),
        startedAt: new Date(),
        processedJobs: 0,
        failedJobs: 0,
      };

      this.workers.set(workerId, worker);
      workerCount++;

      logger.info(
        `Initialized worker ${workerId} with capabilities: ${worker.capabilities.join(', ')}`
      );
    }

    logger.info(`Worker pool initialized with ${this.workers.size} workers`);
  }

  private async processJob(worker: Worker, job: Job): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`Worker ${worker.id} starting job ${job.id}`);

      // Emit job started event
      this.emit('jobStarted', { jobId: job.id, workerId: worker.id });

      // Simulate job processing based on job type
      const result = await this.executeJob(job);

      // Job completed successfully
      worker.status = 'idle';
      worker.currentJob = undefined;
      worker.processedJobs++;
      worker.lastHeartbeat = new Date();

      this.jobWorkerMap.delete(job.id);

      const processingTime = Date.now() - startTime;
      logger.info(`Worker ${worker.id} completed job ${job.id} in ${processingTime}ms`);

      this.emit('jobCompleted', {
        jobId: job.id,
        workerId: worker.id,
        result,
        processingTime,
      });
    } catch (error) {
      // Job failed
      worker.status = 'idle';
      worker.currentJob = undefined;
      worker.failedJobs++;
      worker.lastHeartbeat = new Date();

      this.jobWorkerMap.delete(job.id);

      const processingTime = Date.now() - startTime;
      logger.error(`Worker ${worker.id} failed job ${job.id} after ${processingTime}ms`, error);

      this.emit('jobFailed', {
        jobId: job.id,
        workerId: worker.id,
        error: error instanceof Error ? error : new Error(String(error)),
        processingTime,
      });
    }
  }

  private async executeJob(job: Job): Promise<unknown> {
    // Simulate different processing times based on job type
    const processingTimes = {
      conversion: 5000 + Math.random() * 10000, // 5-15 seconds
      validation: 2000 + Math.random() * 3000, // 2-5 seconds
      analysis: 3000 + Math.random() * 7000, // 3-10 seconds
      packaging: 1000 + Math.random() * 2000, // 1-3 seconds
    };

    const processingTime = processingTimes[job.type] || 5000;

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      const progress = Math.min(95, Math.random() * 100);
      this.emit('jobProgress', {
        jobId: job.id,
        progress: {
          stage: `Processing ${job.type}`,
          percentage: progress,
          details: {
            currentStep: `Step ${Math.floor(progress / 20) + 1}`,
            totalSteps: 5,
            completedSteps: Math.floor(progress / 20),
            processingRate: Math.random() * 100,
          },
        },
      });
    }, 1000);

    await new Promise((resolve) => setTimeout(resolve, processingTime));

    clearInterval(progressInterval);

    // Simulate occasional failures (5% failure rate)
    if (Math.random() < 0.05) {
      throw new Error(`Simulated failure for job type: ${job.type}`);
    }

    return {
      jobId: job.id,
      type: job.type,
      result: `Processed ${job.type} successfully`,
      processingTime,
      timestamp: new Date(),
    };
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();

      for (const worker of this.workers.values()) {
        const timeSinceHeartbeat = now.getTime() - worker.lastHeartbeat.getTime();

        if (timeSinceHeartbeat > this.config.workerTimeout) {
          logger.warn(`Worker ${worker.id} timeout detected`);

          if (worker.currentJob) {
            // Handle timeout for busy worker
            this.emit('workerTimeout', {
              workerId: worker.id,
              jobId: worker.currentJob.id,
            });

            this.jobWorkerMap.delete(worker.currentJob.id);
          }

          // Reset worker state
          worker.status = 'error';
          worker.currentJob = undefined;

          // Restart worker after a delay
          setTimeout(() => {
            worker.status = 'idle';
            worker.lastHeartbeat = new Date();
            logger.info(`Worker ${worker.id} restarted after timeout`);
          }, 5000);
        }
      }
    }, this.config.heartbeatInterval);
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Cancel all running jobs
    for (const [jobId] of this.jobWorkerMap.entries()) {
      this.cancelJob(jobId);
    }

    this.workers.clear();
    this.jobWorkerMap.clear();
    this.removeAllListeners();

    logger.info('Worker pool destroyed');
  }
}
