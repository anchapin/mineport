import { WorkerPool } from './WorkerPool';
import { JobQueue } from './JobQueue';

export interface SystemResources {
  cpu: {
    total: number;
    available: number;
  };
  memory: {
    total: number; // in MB
    available: number; // in MB
  };
}

export interface ResourceAllocationStrategy {
  name: string;
  allocateResources(resources: SystemResources, jobQueue: JobQueue): number;
}

export interface ResourceAllocatorOptions {
  workerPool: WorkerPool;
  jobQueue: JobQueue;
  checkInterval?: number; // milliseconds
  minWorkers?: number;
  maxWorkers?: number;
}

/**
 * ResourceAllocator service for managing system resources
 * Implements requirement 7.2: Process multiple conversion requests in parallel with resource awareness
 */
export class ResourceAllocator {
  private workerPool: WorkerPool;
  private jobQueue: JobQueue;
  private checkInterval: number;
  private minWorkers: number;
  private maxWorkers: number;
  private intervalId?: NodeJS.Timeout;
  private strategy: ResourceAllocationStrategy;

  constructor(options: ResourceAllocatorOptions) {
    this.workerPool = options.workerPool;
    this.jobQueue = options.jobQueue;
    this.checkInterval = options.checkInterval || 30000; // 30 seconds default
    this.minWorkers = options.minWorkers || 1;
    this.maxWorkers = options.maxWorkers || 10;
    
    // Default strategy
    this.strategy = new AdaptiveAllocationStrategy();
  }

  /**
   * Start the resource allocator
   */
  public start(): void {
    if (this.intervalId) return;
    
    // Initial allocation
    this.allocateResources();
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.allocateResources();
    }, this.checkInterval);
  }

  /**
   * Stop the resource allocator
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Set the resource allocation strategy
   */
  public setStrategy(strategy: ResourceAllocationStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Allocate resources based on current system state and job queue
   */
  private allocateResources(): void {
    // Get current system resources
    const resources = this.getCurrentSystemResources();
    
    // Use strategy to determine optimal worker count
    const optimalWorkerCount = this.strategy.allocateResources(resources, this.jobQueue);
    
    // Apply constraints
    const targetWorkerCount = Math.max(
      this.minWorkers,
      Math.min(this.maxWorkers, optimalWorkerCount)
    );
    
    // Scale the worker pool
    this.workerPool.scalePool(targetWorkerCount);
  }

  /**
   * Get current system resources
   * In a real implementation, this would use OS-level metrics
   */
  private getCurrentSystemResources(): SystemResources {
    // This is a simplified implementation
    // In a real system, we would use something like node-os-utils or similar
    
    try {
      // Simulate getting system resources
      // In production, use actual system metrics
      const totalMemory = 16384; // 16GB in MB
      const totalCPU = 8; // 8 cores
      
      // Simulate variable resource usage
      const memoryUsagePercent = Math.random() * 0.5 + 0.2; // 20-70%
      const cpuUsagePercent = Math.random() * 0.6 + 0.1; // 10-70%
      
      return {
        cpu: {
          total: totalCPU,
          available: totalCPU * (1 - cpuUsagePercent),
        },
        memory: {
          total: totalMemory,
          available: totalMemory * (1 - memoryUsagePercent),
        },
      };
    } catch (error) {
      // Fallback to conservative estimates if we can't get actual metrics
      return {
        cpu: {
          total: 4,
          available: 2,
        },
        memory: {
          total: 8192, // 8GB
          available: 4096, // 4GB
        },
      };
    }
  }
}

/**
 * Adaptive allocation strategy that considers both system resources and job queue
 */
export class AdaptiveAllocationStrategy implements ResourceAllocationStrategy {
  name = 'adaptive';
  
  allocateResources(resources: SystemResources, jobQueue: JobQueue): number {
    // Get job queue stats
    const queueStats = jobQueue.getStats();
    
    // Base worker count on available CPU cores
    const basedOnCPU = Math.floor(resources.cpu.available);
    
    // Consider pending jobs in queue
    const queueFactor = Math.min(3, Math.ceil(queueStats.pending / 5));
    
    // Consider memory constraints (each worker might need ~500MB)
    const memoryLimitedWorkers = Math.floor(resources.memory.available / 500);
    
    // Calculate target worker count
    const targetWorkers = Math.min(
      basedOnCPU + queueFactor,
      memoryLimitedWorkers
    );
    
    return targetWorkers;
  }
}

/**
 * Conservative allocation strategy that prioritizes system stability
 */
export class ConservativeAllocationStrategy implements ResourceAllocationStrategy {
  name = 'conservative';
  
  allocateResources(resources: SystemResources, jobQueue: JobQueue): number {
    // Use at most 50% of available CPU
    const maxWorkers = Math.floor(resources.cpu.available * 0.5);
    
    // Ensure we have at least 2GB free memory per worker
    const memoryConstrainedWorkers = Math.floor(resources.memory.available / 2048);
    
    return Math.min(maxWorkers, memoryConstrainedWorkers);
  }
}

/**
 * Aggressive allocation strategy that prioritizes throughput
 */
export class AggressiveAllocationStrategy implements ResourceAllocationStrategy {
  name = 'aggressive';
  
  allocateResources(resources: SystemResources, jobQueue: JobQueue): number {
    // Use up to 90% of available CPU
    const maxWorkers = Math.floor(resources.cpu.available * 0.9);
    
    // Ensure we have at least 1GB free memory per worker
    const memoryConstrainedWorkers = Math.floor(resources.memory.available / 1024);
    
    return Math.min(maxWorkers, memoryConstrainedWorkers);
  }
}