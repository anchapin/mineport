import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ResourceAllocator,
  ResourceAllocationStrategy,
} from '../../../src/services/ResourceAllocator.js';

describe('ResourceAllocator', () => {
  let resourceAllocator: ResourceAllocator;

  beforeEach(() => {
    resourceAllocator = new ResourceAllocator({
      maxMemory: 1024, // 1GB
      maxCpu: 4, // 4 cores
      maxStorage: 10240, // 10GB
    });
  });

  it('should allocate resources successfully', () => {
    const allocation = resourceAllocator.allocate({
      memory: 256, // 256MB
      cpu: 1, // 1 core
      storage: 1024, // 1GB
    });

    expect(allocation).toBeDefined();
    expect(allocation.id).toBeDefined();
    expect(allocation.memory).toBe(256);
    expect(allocation.cpu).toBe(1);
    expect(allocation.storage).toBe(1024);
    expect(allocation.createdAt).toBeInstanceOf(Date);
  });

  it('should track resource usage correctly', () => {
    // Allocate some resources
    resourceAllocator.allocate({
      memory: 256,
      cpu: 1,
      storage: 1024,
    });

    resourceAllocator.allocate({
      memory: 512,
      cpu: 2,
      storage: 2048,
    });

    // Check current usage
    const usage = resourceAllocator.getCurrentUsage();
    expect(usage.memory).toBe(768); // 256 + 512
    expect(usage.cpu).toBe(3); // 1 + 2
    expect(usage.storage).toBe(3072); // 1024 + 2048
  });

  it('should release resources correctly', () => {
    // Allocate resources
    const allocation = resourceAllocator.allocate({
      memory: 256,
      cpu: 1,
      storage: 1024,
    });

    // Check initial usage
    let usage = resourceAllocator.getCurrentUsage();
    expect(usage.memory).toBe(256);

    // Release resources
    resourceAllocator.release(allocation.id);

    // Check usage after release
    usage = resourceAllocator.getCurrentUsage();
    expect(usage.memory).toBe(0);
    expect(usage.cpu).toBe(0);
    expect(usage.storage).toBe(0);
  });

  it('should reject allocation when resources are insufficient', () => {
    // Try to allocate more than available
    expect(() => {
      resourceAllocator.allocate({
        memory: 2048, // 2GB (more than max 1GB)
        cpu: 1,
        storage: 1024,
      });
    }).toThrow(/Insufficient resources/);
  });

  it('should handle multiple allocations and releases', () => {
    // Allocate resources
    const allocation1 = resourceAllocator.allocate({
      memory: 256,
      cpu: 1,
      storage: 1024,
    });

    const allocation2 = resourceAllocator.allocate({
      memory: 512,
      cpu: 2,
      storage: 2048,
    });

    // Check usage
    let usage = resourceAllocator.getCurrentUsage();
    expect(usage.memory).toBe(768);

    // Release first allocation
    resourceAllocator.release(allocation1.id);

    // Check usage after first release
    usage = resourceAllocator.getCurrentUsage();
    expect(usage.memory).toBe(512);
    expect(usage.cpu).toBe(2);
    expect(usage.storage).toBe(2048);

    // Release second allocation
    resourceAllocator.release(allocation2.id);

    // Check usage after second release
    usage = resourceAllocator.getCurrentUsage();
    expect(usage.memory).toBe(0);
    expect(usage.cpu).toBe(0);
    expect(usage.storage).toBe(0);
  });

  it('should provide resource availability information', () => {
    // Allocate some resources
    resourceAllocator.allocate({
      memory: 256,
      cpu: 1,
      storage: 1024,
    });

    // Check availability
    const availability = resourceAllocator.getAvailability();
    expect(availability.memory).toBe(768); // 1024 - 256
    expect(availability.cpu).toBe(3); // 4 - 1
    expect(availability.storage).toBe(9216); // 10240 - 1024
  });

  it('should apply different allocation strategies', () => {
    // Create a resource allocator with a conservative strategy
    const conservativeAllocator = new ResourceAllocator({
      maxMemory: 1024,
      maxCpu: 4,
      maxStorage: 10240,
      strategy: ResourceAllocationStrategy.CONSERVATIVE,
    });

    // Allocate with conservative strategy
    const allocation = conservativeAllocator.allocate({
      memory: 256,
      cpu: 1,
      storage: 1024,
    });

    // Conservative strategy adds a buffer
    expect(allocation.memory).toBeGreaterThan(256);

    // Create a resource allocator with an aggressive strategy
    const aggressiveAllocator = new ResourceAllocator({
      maxMemory: 1024,
      maxCpu: 4,
      maxStorage: 10240,
      strategy: ResourceAllocationStrategy.AGGRESSIVE,
    });

    // Allocate with aggressive strategy
    const aggressiveAllocation = aggressiveAllocator.allocate({
      memory: 256,
      cpu: 1,
      storage: 1024,
    });

    // Aggressive strategy uses exact requested resources
    expect(aggressiveAllocation.memory).toBe(256);
  });

  it('should handle resource timeouts', () => {
    // Mock Date.now
    const realDateNow = Date.now;
    const mockNow = vi.fn();
    Date.now = mockNow;

    // Initial time
    mockNow.mockReturnValue(1000);

    // Allocate resources with timeout
    resourceAllocator.allocate({
      memory: 256,
      cpu: 1,
      storage: 1024,
      timeout: 60000, // 60 second timeout
    });

    // Check initial usage
    let usage = resourceAllocator.getCurrentUsage();
    expect(usage.memory).toBe(256);

    // Move time forward but not past timeout
    mockNow.mockReturnValue(30000);
    resourceAllocator.cleanupExpiredAllocations();

    // Resources should still be allocated
    usage = resourceAllocator.getCurrentUsage();
    expect(usage.memory).toBe(256);

    // Move time past timeout
    mockNow.mockReturnValue(70000);
    resourceAllocator.cleanupExpiredAllocations();

    // Resources should be released
    usage = resourceAllocator.getCurrentUsage();
    expect(usage.memory).toBe(0);

    // Restore Date.now
    Date.now = realDateNow;
  });

  it('should prioritize allocations based on job priority', () => {
    // Set up a nearly full allocator
    resourceAllocator = new ResourceAllocator({
      maxMemory: 1024,
      maxCpu: 4,
      maxStorage: 10240,
    });

    // Allocate most of the resources
    resourceAllocator.allocate({
      memory: 768,
      cpu: 3,
      storage: 8192,
    });

    // Try to allocate two more jobs with different priorities
    const lowPriorityRequest = {
      memory: 128,
      cpu: 0.5,
      storage: 1024,
      priority: 1,
    };

    const highPriorityRequest = {
      memory: 128,
      cpu: 0.5,
      storage: 1024,
      priority: 10,
    };

    // With limited resources, the high priority job should get resources
    const highPriorityAllocation = resourceAllocator.allocate(highPriorityRequest);
    expect(highPriorityAllocation).toBeDefined();

    // The low priority job should be rejected
    expect(() => {
      resourceAllocator.allocate(lowPriorityRequest);
    }).toThrow(/Insufficient resources/);
  });

  describe('releaseJobResources', () => {
    it('should release all resources associated with a job ID', async () => {
      const jobId = 'test-job-123';

      // Allocate resources for the job
      resourceAllocator.allocate({
        jobId,
        memory: 128,
        cpu: 1,
        storage: 512,
      });

      // Create a temp file for the job
      const tempFileManager = resourceAllocator.getTempFileManager();
      await tempFileManager.createTempFile({ prefix: 'test' }, jobId);

      // Verify resources are allocated
      expect(resourceAllocator.getCurrentUsage().memory).toBe(128);
      expect(tempFileManager.getTempFilesCount()).toBe(1);

      // Release resources for the job
      await resourceAllocator.releaseJobResources(jobId);

      // Verify resources are released
      expect(resourceAllocator.getCurrentUsage().memory).toBe(0);
      expect(tempFileManager.getTempFilesCount()).toBe(0);

      // Verify temp file is deleted (this is a bit tricky to test without fs mocks)
      // For now, we trust the implementation. A more robust test would mock 'fs/promises'.
    });

    it('should not release resources for other jobs', async () => {
      const jobId1 = 'job-1';
      const jobId2 = 'job-2';

      // Allocate resources for both jobs
      resourceAllocator.allocate({ jobId: jobId1, memory: 100, cpu: 1, storage: 100 });
      resourceAllocator.allocate({ jobId: jobId2, memory: 200, cpu: 1, storage: 200 });

      // Create temp files for both jobs
      const tempManager = resourceAllocator.getTempFileManager();
      await tempManager.createTempFile({ prefix: 'job1' }, jobId1);
      await tempManager.createTempFile({ prefix: 'job2' }, jobId2);

      expect(resourceAllocator.getCurrentUsage().memory).toBe(300);
      expect(tempManager.getTempFilesCount()).toBe(2);

      // Release resources for job 1 only
      await resourceAllocator.releaseJobResources(jobId1);

      // Verify job 2 resources are still allocated
      expect(resourceAllocator.getCurrentUsage().memory).toBe(200);
      expect(tempManager.getTempFilesCount()).toBe(1);
    });
  });
});
