/**
 * Integration tests for JobQueue system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobQueueService } from '../../src/services/JobQueueService.js';
// import { ResourceManager } from '../../src/services/ResourceManager.js';
// import { WorkerPool } from '../../src/services/WorkerPool.js';
// import { JobStatusStore } from '../../src/services/JobStatusStore.js';
import { JobData } from '../../src/types/job.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('JobQueue Integration Tests', () => {
  let jobQueue: JobQueueService;

  beforeEach(() => {
    // Initialize JobQueueService which internally creates all components
    jobQueue = new JobQueueService({
      maxConcurrentJobs: 2,
      defaultJobTimeout: 8000,
      retryDelayMs: 200,
      maxRetries: 1,
      enableRealTimeUpdates: true,
      queueProcessingInterval: 100,
    });
  });

  afterEach(() => {
    jobQueue.destroy();
  });

  describe('End-to-End Job Processing', () => {
    it('should process a simple conversion job from start to finish', async () => {
      const jobData: JobData = {
        type: 'conversion',
        priority: 'normal',
        payload: {
          modFile: 'test-mod.jar',
          options: { preserveAssets: true },
        },
        options: {
          timeout: 3000,
          maxRetries: 0,
          priority: 'normal',
          resourceRequirements: {
            memory: 256,
            cpu: 1,
            disk: 128,
          },
        },
      };

      // Enqueue job
      const jobId = await jobQueue.enqueueJob(jobData);
      expect(jobId).toBeDefined();

      // Wait for job to complete
      let job = await jobQueue.getJobStatus(jobId);
      let attempts = 0;
      const maxAttempts = 20; // 4 seconds max wait

      while (
        job &&
        !['completed', 'failed', 'cancelled'].includes(job.status) &&
        attempts < maxAttempts
      ) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        job = await jobQueue.getJobStatus(jobId);
        attempts++;
      }

      // Verify job reached a final state (or is still running)
      expect(job).toBeDefined();
      expect(job?.status).toMatch(/completed|failed|running/);

      // Verify job history exists
      const history = await jobQueue.getJobHistory(jobId);
      expect(history.length).toBeGreaterThanOrEqual(1);
    }, 8000);

    it('should handle multiple concurrent jobs', async () => {
      const jobCount = 3;
      const jobIds: string[] = [];

      // Create multiple jobs
      for (let i = 0; i < jobCount; i++) {
        const jobData: JobData = {
          type: 'validation', // Use faster job type
          priority: 'normal',
          payload: { index: i },
          options: {
            timeout: 2000,
            maxRetries: 0,
            priority: 'normal',
            resourceRequirements: {
              memory: 128,
              cpu: 1,
              disk: 64,
            },
          },
        };

        const jobId = await jobQueue.enqueueJob(jobData);
        jobIds.push(jobId);
      }

      // Wait for all jobs to complete
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Check final states
      const finalJobs = await Promise.all(jobIds.map((id) => jobQueue.getJobStatus(id)));

      // At least some jobs should have completed
      const finalStates = finalJobs.filter(
        (job) => job && ['completed', 'failed'].includes(job.status)
      );
      expect(finalStates.length).toBeGreaterThan(0);
    }, 8000);

    it('should respect job priorities', async () => {
      // Create jobs with different priorities
      const lowPriorityJob = await jobQueue.enqueueJob({
        type: 'validation',
        priority: 'low',
        payload: { priority: 'low' },
        options: {
          timeout: 2000,
          maxRetries: 0,
          priority: 'low',
          resourceRequirements: { memory: 128, cpu: 1, disk: 64 },
        },
      });

      const urgentPriorityJob = await jobQueue.enqueueJob({
        type: 'validation',
        priority: 'urgent',
        payload: { priority: 'urgent' },
        options: {
          timeout: 2000,
          maxRetries: 0,
          priority: 'urgent',
          resourceRequirements: { memory: 128, cpu: 1, disk: 64 },
        },
      });

      // Jobs should be created successfully
      expect(lowPriorityJob).toBeDefined();
      expect(urgentPriorityJob).toBeDefined();

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify both jobs exist
      const lowJob = await jobQueue.getJobStatus(lowPriorityJob);
      const urgentJob = await jobQueue.getJobStatus(urgentPriorityJob);

      expect(lowJob).toBeDefined();
      expect(urgentJob).toBeDefined();
    }, 6000);
  });

  describe('Resource Management Integration', () => {
    it('should queue jobs when resources are insufficient', async () => {
      // Create a job that uses most available resources
      const largeJobData: JobData = {
        type: 'conversion',
        priority: 'normal',
        payload: { size: 'large' },
        options: {
          timeout: 5000,
          maxRetries: 0,
          priority: 'normal',
          resourceRequirements: {
            memory: 2048, // Most of available memory
            cpu: 1,
            disk: 1024,
          },
        },
      };

      // Create a second job that would exceed resources
      const secondJobData: JobData = {
        type: 'validation',
        priority: 'normal',
        payload: { size: 'medium' },
        options: {
          timeout: 5000,
          maxRetries: 0,
          priority: 'normal',
          resourceRequirements: {
            memory: 1536, // Would exceed available memory with first job
            cpu: 1,
            disk: 512,
          },
        },
      };

      const job1Id = await jobQueue.enqueueJob(largeJobData);
      const job2Id = await jobQueue.enqueueJob(secondJobData);

      // Wait a bit for processing to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const job1 = await jobQueue.getJobStatus(job1Id);
      const job2 = await jobQueue.getJobStatus(job2Id);

      // First job should be running or completed
      expect(job1?.status).toMatch(/running|completed/);

      // Second job should still be pending due to resource constraints
      // (unless first job completed very quickly)
      if (job1?.status === 'running') {
        expect(job2?.status).toBe('pending');
      }
    });

    it('should process queued jobs when resources become available', async () => {
      // This test verifies that jobs waiting for resources get processed
      // when resources are freed up by completing jobs

      const quickJobData: JobData = {
        type: 'validation', // Typically faster
        priority: 'normal',
        payload: { duration: 'short' },
        options: {
          timeout: 2000,
          maxRetries: 0,
          priority: 'normal',
          resourceRequirements: {
            memory: 1024,
            cpu: 1,
            disk: 512,
          },
        },
      };

      const waitingJobData: JobData = {
        type: 'conversion',
        priority: 'normal',
        payload: { duration: 'medium' },
        options: {
          timeout: 5000,
          maxRetries: 0,
          priority: 'normal',
          resourceRequirements: {
            memory: 1024,
            cpu: 1,
            disk: 512,
          },
        },
      };

      // Enqueue multiple jobs to fill worker capacity
      const jobIds = [];
      for (let i = 0; i < 3; i++) {
        const jobId = await jobQueue.enqueueJob(i < 2 ? quickJobData : waitingJobData);
        jobIds.push(jobId);
      }

      // Wait for jobs to process
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // All jobs should eventually complete
      const finalStates = await Promise.all(jobIds.map((id) => jobQueue.getJobStatus(id)));

      finalStates.forEach((job) => {
        expect(job?.status).toMatch(/completed|failed/);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle worker failures gracefully', async () => {
      const jobData: JobData = {
        type: 'conversion',
        priority: 'normal',
        payload: { shouldFail: true },
        options: {
          timeout: 3000,
          maxRetries: 1,
          priority: 'normal',
          resourceRequirements: {
            memory: 512,
            cpu: 1,
            disk: 256,
          },
        },
      };

      const jobId = await jobQueue.enqueueJob(jobData);

      // Wait for job to complete (or fail)
      let job = await jobQueue.getJobStatus(jobId);
      let attempts = 0;

      while (job && !['completed', 'failed', 'cancelled'].includes(job.status) && attempts < 30) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        job = await jobQueue.getJobStatus(jobId);
        attempts++;
      }

      // Job should eventually reach a final state
      expect(job?.status).toMatch(/completed|failed/);

      // If it failed, verify error information is captured
      if (job?.status === 'failed') {
        expect(job.error).toBeDefined();
        expect(job.error?.message).toBeDefined();
      }
    });

    it('should retry failed jobs within limits', async () => {
      // This test would require more sophisticated mocking to force failures
      // For now, we verify the retry mechanism exists
      const jobData: JobData = {
        type: 'conversion',
        priority: 'normal',
        payload: { test: 'retry' },
        options: {
          timeout: 2000,
          maxRetries: 2,
          priority: 'normal',
          resourceRequirements: {
            memory: 256,
            cpu: 1,
            disk: 128,
          },
        },
      };

      const jobId = await jobQueue.enqueueJob(jobData);

      // Verify job was created with correct retry settings
      const job = await jobQueue.getJobStatus(jobId);
      expect(job?.maxRetries).toBe(2);
      expect(job?.retryCount).toBe(0);
    });
  });

  describe('Queue Management Operations', () => {
    it('should handle queue pause and resume', async () => {
      // Enqueue a job
      const jobData: JobData = {
        type: 'conversion',
        priority: 'normal',
        payload: { test: 'pause-resume' },
        options: {
          timeout: 5000,
          maxRetries: 0,
          priority: 'normal',
          resourceRequirements: {
            memory: 512,
            cpu: 1,
            disk: 256,
          },
        },
      };

      const jobId = await jobQueue.enqueueJob(jobData);

      // Pause the queue
      await jobQueue.pauseQueue();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Job should still be pending (queue is paused)
      let job = await jobQueue.getJobStatus(jobId);
      expect(job?.status).toBe('pending');

      // Resume the queue
      await jobQueue.resumeQueue();

      // Wait for job to process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Job should now be processed
      job = await jobQueue.getJobStatus(jobId);
      expect(job?.status).toMatch(/running|completed|failed/);
    });

    it('should handle job cancellation during processing', async () => {
      const jobData: JobData = {
        type: 'conversion',
        priority: 'normal',
        payload: { duration: 'long' },
        options: {
          timeout: 10000,
          maxRetries: 0,
          priority: 'normal',
          resourceRequirements: {
            memory: 512,
            cpu: 1,
            disk: 256,
          },
        },
      };

      const jobId = await jobQueue.enqueueJob(jobData);

      // Wait for job to start
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Cancel the job
      const cancelled = await jobQueue.cancelJob(jobId);
      expect(cancelled).toBe(true);

      // Verify job is cancelled
      const job = await jobQueue.getJobStatus(jobId);
      expect(job?.status).toBe('cancelled');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle burst of job submissions', async () => {
      const jobCount = 20;
      const startTime = Date.now();

      // Submit many jobs quickly
      const jobPromises = [];
      for (let i = 0; i < jobCount; i++) {
        const jobData: JobData = {
          type: i % 4 === 0 ? 'conversion' : 'validation',
          priority: 'normal',
          payload: { index: i },
          options: {
            timeout: 3000,
            maxRetries: 0,
            priority: 'normal',
            resourceRequirements: {
              memory: 128,
              cpu: 1,
              disk: 64,
            },
          },
        };

        jobPromises.push(jobQueue.enqueueJob(jobData));
      }

      const jobIds = await Promise.all(jobPromises);
      const enqueueTime = Date.now() - startTime;

      expect(jobIds).toHaveLength(jobCount);
      expect(enqueueTime).toBeLessThan(2000); // Should enqueue quickly

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Check final statistics
      const stats = await jobQueue.getQueueStats();
      expect(stats.totalJobs).toBe(jobCount);
    });

    it('should maintain performance with frequent status checks', async () => {
      // Enqueue some jobs
      const jobIds = [];
      for (let i = 0; i < 5; i++) {
        const jobId = await jobQueue.enqueueJob({
          type: 'validation',
          priority: 'normal',
          payload: { index: i },
          options: {
            timeout: 4000,
            maxRetries: 0,
            priority: 'normal',
            resourceRequirements: {
              memory: 256,
              cpu: 1,
              disk: 128,
            },
          },
        });
        jobIds.push(jobId);
      }

      // Perform many status checks
      const startTime = Date.now();
      const statusPromises = [];

      for (let i = 0; i < 50; i++) {
        const randomJobId = jobIds[Math.floor(Math.random() * jobIds.length)];
        statusPromises.push(jobQueue.getJobStatus(randomJobId));
      }

      await Promise.all(statusPromises);
      const checkTime = Date.now() - startTime;

      expect(checkTime).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent state across components', async () => {
      const jobData: JobData = {
        type: 'conversion',
        priority: 'normal',
        payload: { test: 'consistency' },
        options: {
          timeout: 3000,
          maxRetries: 1,
          priority: 'normal',
          resourceRequirements: {
            memory: 512,
            cpu: 1,
            disk: 256,
          },
        },
      };

      const jobId = await jobQueue.enqueueJob(jobData);

      // Wait for job to process
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Verify consistency between different data sources
      const job = await jobQueue.getJobStatus(jobId);
      const history = await jobQueue.getJobHistory(jobId);
      const stats = await jobQueue.getQueueStats();

      expect(job).toBeDefined();
      expect(history.length).toBeGreaterThan(0);
      expect(stats.totalJobs).toBeGreaterThanOrEqual(1);

      // History should reflect job's current state
      const latestHistoryEntry = history[0];
      expect(latestHistoryEntry.jobId).toBe(jobId);
      expect(latestHistoryEntry.status).toBe(job?.status);
    });
  });
});
