import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ResourceAllocator,
  ResourceType,
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
    expect(allocation.resources).toEqual({
      memory: 256,
      cpu: 1,
      storage: 1024,
    });
    expect(allocation.timestamp).toBeInstanceOf(Date);
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
    expect(allocation.resources.memory).toBeGreaterThan(256);

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
    expect(aggressiveAllocation.resources.memory).toBe(256);
  });

  it('should handle resource timeouts', () => {
    // Mock Date.now
    const realDateNow = Date.now;
    const mockNow = vi.fn();
    Date.now = mockNow;

    // Initial time
    mockNow.mockReturnValue(1000);

    // Allocate resources with timeout
    const allocation = resourceAllocator.allocate(
      {
        memory: 256,
        cpu: 1,
        storage: 1024,
      },
      60000
    ); // 60 second timeout

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
});
