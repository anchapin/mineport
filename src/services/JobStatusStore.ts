/**
 * Job Status Store for persisting job information and status updates
 */

import { Job, JobStatusUpdate, QueueStats } from '../types/job.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration options for the JobStatusStore
 */
export interface JobStatusStoreConfig {
  /** Whether to persist job data to disk */
  persistToDisk: boolean;
  /** Maximum number of job history entries to keep */
  maxJobHistory: number;
  /** Interval for cleanup operations in milliseconds */
  cleanupInterval: number;
  /** Optional storage location for persisted data */
  storageLocation?: string;
}

/**
 * Job Status Store for persisting job information and status updates
 *
 * This service provides:
 * - In-memory job storage and retrieval
 * - Job status history tracking
 * - Optional disk persistence
 * - Automatic cleanup of old job data
 * - Job statistics and metrics
 *
 * @example
 * ```typescript
 * const statusStore = new JobStatusStore({
 *   persistToDisk: true,
 *   maxJobHistory: 5000,
 *   storageLocation: './jobs'
 * });
 *
 * await statusStore.saveJob(job);
 * const retrievedJob = await statusStore.getJob(jobId);
 * ```
 */
export class JobStatusStore {
  private jobs = new Map<string, Job>();
  private jobHistory: JobStatusUpdate[] = [];
  private config: JobStatusStoreConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a new JobStatusStore instance
   * @param config - Configuration options for the status store
   */
  constructor(config: Partial<JobStatusStoreConfig> = {}) {
    this.config = {
      persistToDisk: config.persistToDisk || false,
      maxJobHistory: config.maxJobHistory || 10000,
      cleanupInterval: config.cleanupInterval || 3600000, // 1 hour
      storageLocation: config.storageLocation || './job-storage',
    };

    this.startCleanupProcess();
  }

  /**
   * Saves a new job to the status store and adds it to the history
   *
   * @param job - The job object to save
   * @returns Promise that resolves when the job is saved
   *
   * @example
   * ```typescript
   * await statusStore.saveJob(newJob);
   * console.log(`Job ${newJob.id} saved successfully`);
   * ```
   */
  async saveJob(job: Job): Promise<void> {
    this.jobs.set(job.id, { ...job });

    const statusUpdate: JobStatusUpdate = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      timestamp: new Date(),
    };

    this.addToHistory(statusUpdate);

    if (this.config.persistToDisk) {
      await this.persistJob(job);
    }

    logger.debug(`Job ${job.id} saved with status: ${job.status}`);
  }

  /**
   * Updates an existing job in the status store and records the status change in history
   *
   * @param job - The updated job object
   * @returns Promise that resolves when the job is updated
   *
   * @example
   * ```typescript
   * job.status = 'completed';
   * await statusStore.updateJob(job);
   * console.log(`Job ${job.id} updated to completed status`);
   * ```
   */
  async updateJob(job: Job): Promise<void> {
    const existingJob = this.jobs.get(job.id);

    if (!existingJob) {
      logger.warn(`Attempted to update non-existent job: ${job.id}`);
      return;
    }

    // Update the job
    this.jobs.set(job.id, { ...job });

    const statusUpdate: JobStatusUpdate = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      result: job.result,
      timestamp: new Date(),
    };

    this.addToHistory(statusUpdate);

    if (this.config.persistToDisk) {
      await this.persistJob(job);
    }

    logger.debug(`Job ${job.id} updated with status: ${job.status}`);
  }

  /**
   * Retrieves a job by its unique identifier
   *
   * @param jobId - The unique identifier of the job to retrieve
   * @returns Promise that resolves to the job object or null if not found
   *
   * @example
   * ```typescript
   * const job = await statusStore.getJob('job-123');
   * if (job) {
   *   console.log(`Found job: ${job.type} - ${job.status}`);
   * }
   * ```
   */
  async getJob(jobId: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  /**
   * Deletes a job from the status store and removes it from history
   *
   * @param jobId - The unique identifier of the job to delete
   * @returns Promise that resolves to true if the job was deleted, false if not found
   *
   * @example
   * ```typescript
   * const deleted = await statusStore.deleteJob('job-123');
   * if (deleted) {
   *   console.log('Job deleted successfully');
   * }
   * ```
   */
  async deleteJob(jobId: string): Promise<boolean> {
    const deleted = this.jobs.delete(jobId);

    if (deleted) {
      // Remove from history as well
      this.jobHistory = this.jobHistory.filter((update) => update.jobId !== jobId);

      if (this.config.persistToDisk) {
        await this.removePersistedJob(jobId);
      }

      logger.debug(`Job ${jobId} deleted`);
    }

    return deleted;
  }

  /**
   * Retrieves all jobs currently stored in the status store
   *
   * @returns Promise that resolves to an array of all job objects
   *
   * @example
   * ```typescript
   * const allJobs = await statusStore.getAllJobs();
   * console.log(`Total jobs in store: ${allJobs.length}`);
   * ```
   */
  async getAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values()).map((job) => ({ ...job }));
  }

  /**
   * Retrieves all jobs with a specific status
   *
   * @param status - The job status to filter by (pending, running, completed, failed, cancelled)
   * @returns Promise that resolves to an array of jobs with the specified status
   *
   * @example
   * ```typescript
   * const runningJobs = await statusStore.getJobsByStatus('running');
   * console.log(`Currently running jobs: ${runningJobs.length}`);
   * ```
   */
  async getJobsByStatus(status: Job['status']): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === status)
      .map((job) => ({ ...job }));
  }

  /**
   * Retrieves all jobs of a specific type
   *
   * @param type - The job type to filter by (conversion, validation, analysis, packaging)
   * @returns Promise that resolves to an array of jobs with the specified type
   *
   * @example
   * ```typescript
   * const conversionJobs = await statusStore.getJobsByType('conversion');
   * console.log(`Conversion jobs: ${conversionJobs.length}`);
   * ```
   */
  async getJobsByType(type: Job['type']): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter((job) => job.type === type)
      .map((job) => ({ ...job }));
  }

  /**
   * Retrieves the status update history for jobs
   *
   * @param jobId - Optional job ID to filter history for a specific job
   * @param limit - Optional maximum number of history entries to return
   * @returns Promise that resolves to an array of job status updates, sorted by timestamp (most recent first)
   *
   * @example
   * ```typescript
   * // Get all job history
   * const allHistory = await statusStore.getJobHistory();
   *
   * // Get history for specific job
   * const jobHistory = await statusStore.getJobHistory('job-123');
   *
   * // Get last 10 entries
   * const recentHistory = await statusStore.getJobHistory(undefined, 10);
   * ```
   */
  async getJobHistory(jobId?: string, limit?: number): Promise<JobStatusUpdate[]> {
    let history = jobId
      ? this.jobHistory.filter((update) => update.jobId === jobId)
      : this.jobHistory;

    // Sort by timestamp descending (most recent first)
    history = history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      history = history.slice(0, limit);
    }

    return history.map((update) => ({ ...update }));
  }

  /**
   * Retrieves comprehensive statistics about jobs in the status store
   *
   * @returns Promise that resolves to queue statistics including job counts and processing metrics
   *
   * @example
   * ```typescript
   * const stats = await statusStore.getQueueStats();
   * console.log(`Total jobs: ${stats.totalJobs}, Completed: ${stats.completedJobs}`);
   * ```
   */
  async getQueueStats(): Promise<QueueStats> {
    const jobs = Array.from(this.jobs.values());

    const stats: QueueStats = {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter((job) => job.status === 'pending').length,
      runningJobs: jobs.filter((job) => job.status === 'running').length,
      completedJobs: jobs.filter((job) => job.status === 'completed').length,
      failedJobs: jobs.filter((job) => job.status === 'failed').length,
      queueLength: jobs.filter((job) => job.status === 'pending').length,
      activeWorkers: 0, // This would be provided by WorkerPool
      averageProcessingTime: this.calculateAverageProcessingTime(jobs),
    };

    return stats;
  }

  /**
   * Removes old completed, failed, or cancelled jobs from the store to free up memory
   *
   * @param olderThanHours - Jobs older than this many hours will be cleaned up (default: 24)
   * @returns Promise that resolves to the number of jobs that were cleaned up
   *
   * @example
   * ```typescript
   * // Clean up jobs older than 24 hours
   * const cleaned = await statusStore.cleanupOldJobs();
   *
   * // Clean up jobs older than 1 hour
   * const cleaned = await statusStore.cleanupOldJobs(1);
   * console.log(`Cleaned up ${cleaned} old jobs`);
   * ```
   */
  async cleanupOldJobs(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const jobsToDelete: string[] = [];

    for (const [jobId, job] of Array.from(this.jobs.entries())) {
      // Only cleanup completed, failed, or cancelled jobs
      if (['completed', 'failed', 'cancelled'].includes(job.status) && job.createdAt < cutoffTime) {
        jobsToDelete.push(jobId);
      }
    }

    for (const jobId of jobsToDelete) {
      await this.deleteJob(jobId);
    }

    // Also cleanup old history entries
    this.jobHistory = this.jobHistory.filter((update) => update.timestamp > cutoffTime);

    logger.info(`Cleaned up ${jobsToDelete.length} old jobs`);
    return jobsToDelete.length;
  }

  private addToHistory(statusUpdate: JobStatusUpdate): void {
    this.jobHistory.push(statusUpdate);

    // Keep history within limits
    if (this.jobHistory.length > this.config.maxJobHistory) {
      this.jobHistory = this.jobHistory.slice(-this.config.maxJobHistory);
    }
  }

  private calculateAverageProcessingTime(jobs: Job[]): number {
    const completedJobs = jobs.filter(
      (job) => job.status === 'completed' && job.startedAt && job.completedAt
    );

    if (completedJobs.length === 0) {
      return 0;
    }

    const totalTime = completedJobs.reduce((sum, job) => {
      const processingTime = job.completedAt!.getTime() - job.startedAt!.getTime();
      return sum + processingTime;
    }, 0);

    return totalTime / completedJobs.length;
  }

  private async persistJob(job: Job): Promise<void> {
    // In a real implementation, this would write to disk/database
    // For now, we'll just log the persistence action
    logger.debug(`Persisting job ${job.id} to storage`);
  }

  private async removePersistedJob(jobId: string): Promise<void> {
    // In a real implementation, this would remove from disk/database
    logger.debug(`Removing persisted job ${jobId} from storage`);
  }

  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldJobs();
      } catch (error) {
        logger.error('Error during job cleanup', error);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Destroys the job status store, cleaning up all resources and stopping background processes
   *
   * @example
   * ```typescript
   * statusStore.destroy();
   * console.log('Job status store destroyed');
   * ```
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.jobs.clear();
    this.jobHistory = [];

    logger.info('Job status store destroyed');
  }
}
