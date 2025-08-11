/**
 * Unit tests for JobStatusStore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobStatusStore } from '../../../src/services/JobStatusStore.js';
import { Job, JobStatusUpdate } from '../../../src/types/job.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('JobStatusStore', () => {
  let store: JobStatusStore;
  let mockJob: Job;

  beforeEach(() => {
    store = new JobStatusStore({
      persistToDisk: false,
      maxJobHistory: 100,
      cleanupInterval: 3600000
    });

    mockJob = {
      id: 'test-job-1',
      type: 'conversion',
      priority: 'normal',
      status: 'pending',
      payload: {
        type: 'conversion',
        data: { test: 'data' },
        options: {
          timeout: 300000,
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal',
          resourceRequirements: {
            memory: 1024,
            cpu: 1,
            disk: 512
          }
        }
      },
      progress: {
        stage: 'Queued',
        percentage: 0,
        details: {
          currentStep: 'Waiting',
          totalSteps: 1,
          completedSteps: 0
        }
      },
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    };
  });

  afterEach(() => {
    store.destroy();
  });

  describe('Job Storage', () => {
    it('should save a job', async () => {
      await store.saveJob(mockJob);
      
      const retrievedJob = await store.getJob(mockJob.id);
      expect(retrievedJob).toEqual(mockJob);
    });

    it('should update an existing job', async () => {
      await store.saveJob(mockJob);
      
      const updatedJob = {
        ...mockJob,
        status: 'running' as const,
        startedAt: new Date()
      };
      
      await store.updateJob(updatedJob);
      
      const retrievedJob = await store.getJob(mockJob.id);
      expect(retrievedJob?.status).toBe('running');
      expect(retrievedJob?.startedAt).toBeDefined();
    });

    it('should handle updating non-existent job', async () => {
      const nonExistentJob = { ...mockJob, id: 'non-existent' };
      
      // Should not throw error
      await expect(store.updateJob(nonExistentJob)).resolves.toBeUndefined();
    });

    it('should delete a job', async () => {
      await store.saveJob(mockJob);
      
      const deleted = await store.deleteJob(mockJob.id);
      expect(deleted).toBe(true);
      
      const retrievedJob = await store.getJob(mockJob.id);
      expect(retrievedJob).toBeNull();
    });

    it('should return false when deleting non-existent job', async () => {
      const deleted = await store.deleteJob('non-existent');
      expect(deleted).toBe(false);
    });

    it('should return null for non-existent job', async () => {
      const job = await store.getJob('non-existent');
      expect(job).toBeNull();
    });
  });

  describe('Job Queries', () => {
    beforeEach(async () => {
      const jobs = [
        { ...mockJob, id: 'job-1', status: 'pending' as const },
        { ...mockJob, id: 'job-2', status: 'running' as const },
        { ...mockJob, id: 'job-3', status: 'completed' as const },
        { ...mockJob, id: 'job-4', status: 'failed' as const, type: 'validation' as const }
      ];

      for (const job of jobs) {
        await store.saveJob(job);
      }
    });

    it('should get all jobs', async () => {
      const jobs = await store.getAllJobs();
      expect(jobs).toHaveLength(4);
      expect(jobs.map(j => j.id)).toEqual(['job-1', 'job-2', 'job-3', 'job-4']);
    });

    it('should get jobs by status', async () => {
      const pendingJobs = await store.getJobsByStatus('pending');
      expect(pendingJobs).toHaveLength(1);
      expect(pendingJobs[0].id).toBe('job-1');

      const runningJobs = await store.getJobsByStatus('running');
      expect(runningJobs).toHaveLength(1);
      expect(runningJobs[0].id).toBe('job-2');

      const completedJobs = await store.getJobsByStatus('completed');
      expect(completedJobs).toHaveLength(1);
      expect(completedJobs[0].id).toBe('job-3');
    });

    it('should get jobs by type', async () => {
      const conversionJobs = await store.getJobsByType('conversion');
      expect(conversionJobs).toHaveLength(3);

      const validationJobs = await store.getJobsByType('validation');
      expect(validationJobs).toHaveLength(1);
      expect(validationJobs[0].id).toBe('job-4');
    });
  });

  describe('Job History', () => {
    it('should track job history on save', async () => {
      await store.saveJob(mockJob);
      
      const history = await store.getJobHistory(mockJob.id);
      expect(history).toHaveLength(1);
      expect(history[0].jobId).toBe(mockJob.id);
      expect(history[0].status).toBe('pending');
    });

    it('should track job history on update', async () => {
      await store.saveJob(mockJob);
      
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updatedJob = { ...mockJob, status: 'running' as const };
      await store.updateJob(updatedJob);
      
      const history = await store.getJobHistory(mockJob.id);
      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('running'); // Most recent first
      expect(history[1].status).toBe('pending');
    });

    it('should get history for all jobs', async () => {
      const job1 = { ...mockJob, id: 'job-1' };
      const job2 = { ...mockJob, id: 'job-2' };
      
      await store.saveJob(job1);
      await store.saveJob(job2);
      
      const allHistory = await store.getJobHistory();
      expect(allHistory).toHaveLength(2);
    });

    it('should limit history results', async () => {
      await store.saveJob(mockJob);
      
      // Create multiple updates
      for (let i = 0; i < 5; i++) {
        const updatedJob = { ...mockJob, status: 'running' as const };
        await store.updateJob(updatedJob);
      }
      
      const limitedHistory = await store.getJobHistory(mockJob.id, 3);
      expect(limitedHistory).toHaveLength(3);
    });

    it('should remove job from history when job is deleted', async () => {
      await store.saveJob(mockJob);
      await store.updateJob({ ...mockJob, status: 'completed' as const });
      
      let history = await store.getJobHistory(mockJob.id);
      expect(history).toHaveLength(2);
      
      await store.deleteJob(mockJob.id);
      
      history = await store.getJobHistory(mockJob.id);
      expect(history).toHaveLength(0);
    });
  });

  describe('Queue Statistics', () => {
    beforeEach(async () => {
      const jobs = [
        { ...mockJob, id: 'job-1', status: 'pending' as const },
        { ...mockJob, id: 'job-2', status: 'running' as const },
        { ...mockJob, id: 'job-3', status: 'completed' as const, startedAt: new Date(Date.now() - 5000), completedAt: new Date() },
        { ...mockJob, id: 'job-4', status: 'failed' as const },
        { ...mockJob, id: 'job-5', status: 'cancelled' as const }
      ];

      for (const job of jobs) {
        await store.saveJob(job);
      }
    });

    it('should calculate queue statistics', async () => {
      const stats = await store.getQueueStats();
      
      expect(stats.totalJobs).toBe(5);
      expect(stats.pendingJobs).toBe(1);
      expect(stats.runningJobs).toBe(1);
      expect(stats.completedJobs).toBe(1);
      expect(stats.failedJobs).toBe(1);
      expect(stats.queueLength).toBe(1); // Only pending jobs
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should handle empty queue statistics', async () => {
      const emptyStore = new JobStatusStore();
      const stats = await emptyStore.getQueueStats();
      
      expect(stats.totalJobs).toBe(0);
      expect(stats.pendingJobs).toBe(0);
      expect(stats.runningJobs).toBe(0);
      expect(stats.completedJobs).toBe(0);
      expect(stats.failedJobs).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      
      emptyStore.destroy();
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      const oldDate = new Date(Date.now() - (25 * 60 * 60 * 1000)); // 25 hours ago
      const recentDate = new Date(Date.now() - (1 * 60 * 60 * 1000)); // 1 hour ago
      
      const jobs = [
        { ...mockJob, id: 'old-completed', status: 'completed' as const, createdAt: oldDate },
        { ...mockJob, id: 'old-failed', status: 'failed' as const, createdAt: oldDate },
        { ...mockJob, id: 'old-running', status: 'running' as const, createdAt: oldDate }, // Should not be cleaned
        { ...mockJob, id: 'recent-completed', status: 'completed' as const, createdAt: recentDate }
      ];

      for (const job of jobs) {
        await store.saveJob(job);
      }
    });

    it('should cleanup old completed and failed jobs', async () => {
      const cleanedCount = await store.cleanupOldJobs(24);
      expect(cleanedCount).toBe(2); // old-completed and old-failed
      
      const remainingJobs = await store.getAllJobs();
      expect(remainingJobs).toHaveLength(2);
      expect(remainingJobs.map(j => j.id)).toEqual(['old-running', 'recent-completed']);
    });

    it('should not cleanup running jobs', async () => {
      await store.cleanupOldJobs(1); // Very aggressive cleanup
      
      const remainingJobs = await store.getAllJobs();
      const runningJob = remainingJobs.find(j => j.id === 'old-running');
      expect(runningJob).toBeDefined();
    });

    it('should cleanup old history entries', async () => {
      // Add some history
      await store.updateJob({ ...mockJob, id: 'old-completed', status: 'running' as const });
      
      const initialHistory = await store.getJobHistory();
      expect(initialHistory.length).toBeGreaterThan(4);
      
      await store.cleanupOldJobs(24);
      
      const finalHistory = await store.getJobHistory();
      expect(finalHistory.length).toBeLessThan(initialHistory.length);
    });
  });

  describe('Configuration', () => {
    it('should respect maxJobHistory configuration', async () => {
      const smallHistoryStore = new JobStatusStore({ maxJobHistory: 3 });
      
      // Add more updates than the limit
      await smallHistoryStore.saveJob(mockJob);
      for (let i = 0; i < 5; i++) {
        await smallHistoryStore.updateJob({ ...mockJob, status: 'running' as const });
      }
      
      const history = await smallHistoryStore.getJobHistory();
      expect(history.length).toBeLessThanOrEqual(3);
      
      smallHistoryStore.destroy();
    });

    it('should handle persistence configuration', () => {
      const persistentStore = new JobStatusStore({ persistToDisk: true });
      expect(() => persistentStore.destroy()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent operations', async () => {
      const promises = [];
      
      // Simulate concurrent saves
      for (let i = 0; i < 10; i++) {
        const job = { ...mockJob, id: `concurrent-job-${i}` };
        promises.push(store.saveJob(job));
      }
      
      await Promise.all(promises);
      
      const jobs = await store.getAllJobs();
      expect(jobs).toHaveLength(10);
    });

    it('should handle malformed job data gracefully', async () => {
      const malformedJob = { ...mockJob, status: undefined as any };
      
      // Should not throw error
      await expect(store.saveJob(malformedJob)).resolves.toBeUndefined();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many operations', async () => {
      // Perform many operations with old timestamps
      const oldDate = new Date(Date.now() - (25 * 60 * 60 * 1000)); // 25 hours ago
      
      for (let i = 0; i < 100; i++) {
        const job = { 
          ...mockJob, 
          id: `memory-test-${i}`,
          status: 'completed' as const,
          createdAt: oldDate
        };
        await store.saveJob(job);
      }
      
      // Cleanup should reduce memory usage
      const cleanedCount = await store.cleanupOldJobs(24);
      expect(cleanedCount).toBe(100);
      
      const remainingJobs = await store.getAllJobs();
      expect(remainingJobs).toHaveLength(0);
    });
  });
});