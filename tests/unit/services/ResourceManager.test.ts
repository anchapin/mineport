/**
 * Unit tests for ResourceManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResourceManager } from '../../../src/services/ResourceManager.js';
import { Job, ResourceRequirements } from '../../../src/types/job.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ResourceManager', () => {
  let resourceManager: ResourceManager;
  let mockJob: Job;

  beforeEach(() => {
    resourceManager = new ResourceManager({
      totalMemory: 8192,
      availableMemory: 6144,
      totalCpu: 4,
      availableCpu: 3,
      totalDisk: 51200,
      availableDisk: 40960,
    });

    mockJob = {
      id: 'test-job-1',
      type: 'conversion',
      priority: 'normal',
      status: 'pending',
      payload: {
        type: 'conversion',
        data: {},
        options: {
          timeout: 300000,
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal',
          resourceRequirements: {
            memory: 1024,
            cpu: 1,
            disk: 512,
          },
        },
      },
      progress: {
        stage: 'Queued',
        percentage: 0,
        details: {
          currentStep: 'Waiting',
          totalSteps: 1,
          completedSteps: 0,
        },
      },
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };
  });

  afterEach(() => {
    resourceManager.destroy();
  });

  describe('Resource Allocation', () => {
    it('should allocate resources for a job', async () => {
      const allocation = await resourceManager.allocateResources(mockJob);

      expect(allocation).toBeDefined();
      expect(allocation?.memory).toBe(1024);
      expect(allocation?.cpu).toBe(1);
      expect(allocation?.disk).toBe(512);
      expect(allocation?.workerId).toMatch(/^worker-\d+$/);
      expect(allocation?.allocatedAt).toBeInstanceOf(Date);
    });

    it('should update available resources after allocation', async () => {
      const initialAvailable = resourceManager.getAvailableResources();

      await resourceManager.allocateResources(mockJob);

      const afterAllocation = resourceManager.getAvailableResources();
      expect(afterAllocation.memory).toBe(initialAvailable.memory - 1024);
      expect(afterAllocation.cpu).toBe(initialAvailable.cpu - 1);
      expect(afterAllocation.disk).toBe(initialAvailable.disk - 512);
    });

    it('should refuse allocation when insufficient resources', async () => {
      // Create a job that requires more resources than available
      const largeJob = {
        ...mockJob,
        id: 'large-job',
        payload: {
          ...mockJob.payload,
          options: {
            ...mockJob.payload.options,
            resourceRequirements: {
              memory: 10000, // More than available
              cpu: 1,
              disk: 512,
            },
          },
        },
      };

      const allocation = await resourceManager.allocateResources(largeJob);
      expect(allocation).toBeNull();
    });

    it('should handle multiple allocations', async () => {
      const job1 = { ...mockJob, id: 'job-1' };
      const job2 = { ...mockJob, id: 'job-2' };
      const job3 = { ...mockJob, id: 'job-3' };

      const allocation1 = await resourceManager.allocateResources(job1);
      const allocation2 = await resourceManager.allocateResources(job2);
      const allocation3 = await resourceManager.allocateResources(job3);

      expect(allocation1).toBeDefined();
      expect(allocation2).toBeDefined();
      expect(allocation3).toBeDefined();

      const available = resourceManager.getAvailableResources();
      expect(available.memory).toBe(6144 - 3 * 1024);
      expect(available.cpu).toBe(3 - 3);
      expect(available.disk).toBe(40960 - 3 * 512);
    });
  });

  describe('Resource Release', () => {
    it('should release resources for a job', async () => {
      await resourceManager.allocateResources(mockJob);
      const beforeRelease = resourceManager.getAvailableResources();

      await resourceManager.releaseResources(mockJob.id);

      const afterRelease = resourceManager.getAvailableResources();
      expect(afterRelease.memory).toBe(beforeRelease.memory + 1024);
      expect(afterRelease.cpu).toBe(beforeRelease.cpu + 1);
      expect(afterRelease.disk).toBe(beforeRelease.disk + 512);
    });

    it('should handle releasing non-existent allocation', async () => {
      // Should not throw error
      await expect(resourceManager.releaseResources('non-existent-job')).resolves.toBeUndefined();
    });

    it('should handle multiple releases', async () => {
      const job1 = { ...mockJob, id: 'job-1' };
      const job2 = { ...mockJob, id: 'job-2' };

      await resourceManager.allocateResources(job1);
      await resourceManager.allocateResources(job2);

      await resourceManager.releaseResources(job1.id);
      await resourceManager.releaseResources(job2.id);

      const available = resourceManager.getAvailableResources();
      expect(available.memory).toBe(6144);
      expect(available.cpu).toBe(3);
      expect(available.disk).toBe(40960);
    });
  });

  describe('Resource Monitoring', () => {
    it('should calculate resource utilization', async () => {
      await resourceManager.allocateResources(mockJob);

      const utilization = resourceManager.getResourceUtilization();
      expect(utilization.memory).toBeCloseTo((1024 / 8192) * 100, 2);
      expect(utilization.cpu).toBeCloseTo((1 / 4) * 100, 2);
      expect(utilization.disk).toBeCloseTo((512 / 51200) * 100, 2);
    });

    it('should track total allocated resources', async () => {
      const job1 = { ...mockJob, id: 'job-1' };
      const job2 = { ...mockJob, id: 'job-2' };

      await resourceManager.allocateResources(job1);
      await resourceManager.allocateResources(job2);

      const allocated = resourceManager.getTotalAllocatedResources();
      expect(allocated.memory).toBe(2048);
      expect(allocated.cpu).toBe(2);
      expect(allocated.disk).toBe(1024);
    });

    it('should provide monitoring data', async () => {
      // Wait a bit for monitoring to collect data
      await new Promise((resolve) => setTimeout(resolve, 100));

      const monitoringData = resourceManager.getMonitoringData();
      expect(Array.isArray(monitoringData)).toBe(true);

      if (monitoringData.length > 0) {
        const data = monitoringData[0];
        expect(data.timestamp).toBeInstanceOf(Date);
        expect(data.systemResources).toBeDefined();
        expect(data.allocatedResources).toBeDefined();
        expect(data.utilizationPercentage).toBeDefined();
      }
    });
  });

  describe('Resource Validation', () => {
    it('should validate if resources can be allocated', () => {
      const smallRequirements: ResourceRequirements = {
        memory: 512,
        cpu: 1,
        disk: 256,
      };

      const largeRequirements: ResourceRequirements = {
        memory: 10000,
        cpu: 1,
        disk: 256,
      };

      expect(resourceManager.canAllocateResources(smallRequirements)).toBe(true);
      expect(resourceManager.canAllocateResources(largeRequirements)).toBe(false);
    });

    it('should validate after partial allocation', async () => {
      await resourceManager.allocateResources(mockJob);

      const requirements: ResourceRequirements = {
        memory: 5000, // Should still fit
        cpu: 1,
        disk: 1000,
      };

      expect(resourceManager.canAllocateResources(requirements)).toBe(true);

      const tooLargeRequirements: ResourceRequirements = {
        memory: 6000, // Won't fit after first allocation
        cpu: 1,
        disk: 1000,
      };

      expect(resourceManager.canAllocateResources(tooLargeRequirements)).toBe(false);
    });
  });

  describe('Resource Optimization', () => {
    it('should optimize resource allocation', async () => {
      // This is a placeholder test since optimization logic is complex
      await expect(resourceManager.optimizeResourceAllocation()).resolves.toBeUndefined();
    });

    it('should handle edge cases in optimization', async () => {
      // Allocate some resources first
      await resourceManager.allocateResources(mockJob);

      // Run optimization
      await expect(resourceManager.optimizeResourceAllocation()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid resource requirements gracefully', async () => {
      const invalidJob = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          options: {
            ...mockJob.payload.options,
            resourceRequirements: {
              memory: -1, // Invalid
              cpu: 0,
              disk: -100,
            },
          },
        },
      };

      const allocation = await resourceManager.allocateResources(invalidJob);
      expect(allocation).toBeNull();
    });

    it('should handle zero resource requirements', async () => {
      const zeroJob = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          options: {
            ...mockJob.payload.options,
            resourceRequirements: {
              memory: 0,
              cpu: 0,
              disk: 0,
            },
          },
        },
      };

      const allocation = await resourceManager.allocateResources(zeroJob);
      expect(allocation).toBeDefined();
      expect(allocation?.memory).toBe(0);
      expect(allocation?.cpu).toBe(0);
      expect(allocation?.disk).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      expect(() => resourceManager.destroy()).not.toThrow();
    });

    it('should stop monitoring on destroy', async () => {
      const _initialDataLength = resourceManager.getMonitoringData().length;

      resourceManager.destroy();

      // Wait a bit to ensure monitoring has stopped
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Monitoring data should not increase after destroy
      const finalDataLength = resourceManager.getMonitoringData().length;
      expect(finalDataLength).toBe(0); // Should be cleared on destroy
    });
  });
});
