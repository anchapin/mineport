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

  async getJob(jobId: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

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

  async getAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values()).map((job) => ({ ...job }));
  }

  async getJobsByStatus(status: Job['status']): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === status)
      .map((job) => ({ ...job }));
  }

  async getJobsByType(type: Job['type']): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter((job) => job.type === type)
      .map((job) => ({ ...job }));
  }

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

  async cleanupOldJobs(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const jobsToDelete: string[] = [];

    for (const [jobId, job] of this.jobs.entries()) {
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
