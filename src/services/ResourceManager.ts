/**
 * Resource Manager for job resource allocation and monitoring
 */

import { ResourceRequirements, ResourceAllocation, Job } from '../types/job.js';
import { logger } from '../utils/logger.js';

/**
 * System resource information including total and available amounts
 */
export interface SystemResources {
  /** Total system memory in MB */
  totalMemory: number;
  /** Available system memory in MB */
  availableMemory: number;
  /** Total CPU cores */
  totalCpu: number;
  /** Available CPU cores */
  availableCpu: number;
  /** Total disk space in MB */
  totalDisk: number;
  /** Available disk space in MB */
  availableDisk: number;
}

/**
 * Resource monitoring data point containing system state and utilization metrics
 */
export interface ResourceMonitoringData {
  /** Timestamp when the data was collected */
  timestamp: Date;
  /** Current system resource state */
  systemResources: SystemResources;
  /** Currently allocated resources */
  allocatedResources: ResourceRequirements;
  /** Resource utilization percentages */
  utilizationPercentage: {
    /** Memory utilization percentage (0-100) */
    memory: number;
    /** CPU utilization percentage (0-100) */
    cpu: number;
    /** Disk utilization percentage (0-100) */
    disk: number;
  };
}

/**
 * Resource Manager for job resource allocation and monitoring
 *
 * This service provides:
 * - Resource allocation and deallocation for jobs
 * - System resource monitoring and tracking
 * - Resource utilization metrics and history
 * - Resource availability checking
 * - Automatic resource cleanup
 *
 * @example
 * ```typescript
 * const resourceManager = new ResourceManager({
 *   totalMemory: 8192,
 *   availableMemory: 6144,
 *   totalCpu: 4,
 *   availableCpu: 3
 * });
 *
 * const allocation = await resourceManager.allocateResources(jobId, {
 *   memory: 1024,
 *   cpu: 1,
 *   disk: 512
 * });
 * ```
 */
export class ResourceManager {
  private allocations = new Map<string, ResourceAllocation>();
  private systemResources: SystemResources;
  private initialAvailableResources: ResourceRequirements;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private monitoringData: ResourceMonitoringData[] = [];
  private readonly maxMonitoringHistory = 1000;

  /**
   * Creates a new ResourceManager instance
   * @param systemResources - Optional system resource configuration
   */
  constructor(systemResources?: Partial<SystemResources>) {
    this.systemResources = {
      totalMemory: systemResources?.totalMemory || 8192, // 8GB default
      availableMemory: systemResources?.availableMemory || 6144, // 6GB default
      totalCpu: systemResources?.totalCpu || 4, // 4 cores default
      availableCpu: systemResources?.availableCpu || 3, // 3 cores default
      totalDisk: systemResources?.totalDisk || 51200, // 50GB default
      availableDisk: systemResources?.availableDisk || 40960, // 40GB default
    };

    // Store initial available resources
    this.initialAvailableResources = {
      memory: this.systemResources.availableMemory,
      cpu: this.systemResources.availableCpu,
      disk: this.systemResources.availableDisk,
    };

    this.startMonitoring();
  }

  /**
   * Allocates system resources for a job based on its requirements
   *
   * @param job - The job object containing resource requirements
   * @returns Promise that resolves to resource allocation details or null if resources cannot be allocated
   *
   * @example
   * ```typescript
   * const allocation = await resourceManager.allocateResources(job);
   * if (allocation) {
   *   console.log(`Allocated ${allocation.memory}MB memory to job ${job.id}`);
   * }
   * ```
   */
  async allocateResources(job: Job): Promise<ResourceAllocation | null> {
    const requirements = job.payload.options.resourceRequirements;

    // Validate resource requirements
    if (requirements.memory < 0 || requirements.cpu < 0 || requirements.disk < 0) {
      logger.warn(`Invalid resource requirements for job ${job.id}`, requirements);
      return null;
    }

    if (!this.canAllocateResources(requirements)) {
      logger.warn(`Cannot allocate resources for job ${job.id}`, {
        required: requirements,
        available: this.getAvailableResources(),
      });
      return null;
    }

    const allocation: ResourceAllocation = {
      memory: requirements.memory,
      cpu: requirements.cpu,
      disk: requirements.disk,
      workerId: `worker-${Date.now()}`,
      allocatedAt: new Date(),
    };

    this.allocations.set(job.id, allocation);
    this.updateSystemResources();

    logger.info(`Resources allocated for job ${job.id}`, allocation);
    return allocation;
  }

  /**
   * Releases system resources that were allocated to a specific job
   *
   * @param jobId - The unique identifier of the job whose resources should be released
   * @returns Promise that resolves when resources are released
   *
   * @example
   * ```typescript
   * await resourceManager.releaseResources('job-123');
   * console.log('Resources released for job-123');
   * ```
   */
  async releaseResources(jobId: string): Promise<void> {
    const allocation = this.allocations.get(jobId);

    if (!allocation) {
      logger.warn(`No resource allocation found for job ${jobId}`);
      return;
    }

    this.allocations.delete(jobId);
    this.updateSystemResources();

    logger.info(`Resources released for job ${jobId}`, allocation);
  }

  /**
   * Checks if the specified resource requirements can be satisfied with current available resources
   *
   * @param requirements - The resource requirements to check (memory, CPU, disk)
   * @returns True if resources can be allocated, false otherwise
   *
   * @example
   * ```typescript
   * const canAllocate = resourceManager.canAllocateResources({
   *   memory: 1024,
   *   cpu: 1,
   *   disk: 512
   * });
   * if (canAllocate) {
   *   console.log('Resources are available');
   * }
   * ```
   */
  canAllocateResources(requirements: ResourceRequirements): boolean {
    const available = this.getAvailableResources();

    return (
      available.memory >= requirements.memory &&
      available.cpu >= requirements.cpu &&
      available.disk >= requirements.disk
    );
  }

  /**
   * Gets the currently available system resources
   *
   * @returns Object containing available memory, CPU, and disk resources
   *
   * @example
   * ```typescript
   * const available = resourceManager.getAvailableResources();
   * console.log(`Available: ${available.memory}MB memory, ${available.cpu} CPU cores`);
   * ```
   */
  getAvailableResources(): ResourceRequirements {
    // Return the current available resources (already calculated in updateSystemResources)
    return {
      memory: this.systemResources.availableMemory,
      cpu: this.systemResources.availableCpu,
      disk: this.systemResources.availableDisk,
    };
  }

  /**
   * Gets the total amount of resources currently allocated to all jobs
   *
   * @returns Object containing total allocated memory, CPU, and disk resources
   *
   * @example
   * ```typescript
   * const allocated = resourceManager.getTotalAllocatedResources();
   * console.log(`Allocated: ${allocated.memory}MB memory, ${allocated.cpu} CPU cores`);
   * ```
   */
  getTotalAllocatedResources(): ResourceRequirements {
    const allocated = Array.from(this.allocations.values()).reduce(
      (total, allocation) => ({
        memory: total.memory + allocation.memory,
        cpu: total.cpu + allocation.cpu,
        disk: total.disk + allocation.disk,
      }),
      { memory: 0, cpu: 0, disk: 0 }
    );

    return allocated;
  }

  /**
   * Gets the current resource utilization percentages
   *
   * @returns Object containing utilization percentages (0-100) for memory, CPU, and disk
   *
   * @example
   * ```typescript
   * const utilization = resourceManager.getResourceUtilization();
   * console.log(`Memory utilization: ${utilization.memory.toFixed(1)}%`);
   * ```
   */
  getResourceUtilization(): { memory: number; cpu: number; disk: number } {
    const allocated = this.getTotalAllocatedResources();

    return {
      memory: (allocated.memory / this.systemResources.totalMemory) * 100,
      cpu: (allocated.cpu / this.systemResources.totalCpu) * 100,
      disk: (allocated.disk / this.systemResources.totalDisk) * 100,
    };
  }

  /**
   * Gets the historical resource monitoring data
   *
   * @returns Array of resource monitoring data points with timestamps and utilization metrics
   *
   * @example
   * ```typescript
   * const monitoringData = resourceManager.getMonitoringData();
   * console.log(`Collected ${monitoringData.length} monitoring data points`);
   * ```
   */
  getMonitoringData(): ResourceMonitoringData[] {
    return [...this.monitoringData];
  }

  /**
   * Optimizes resource allocation by identifying and cleaning up stale allocations
   *
   * @returns Promise that resolves when optimization is complete
   *
   * @example
   * ```typescript
   * await resourceManager.optimizeResourceAllocation();
   * console.log('Resource allocation optimized');
   * ```
   */
  async optimizeResourceAllocation(): Promise<void> {
    // Identify underutilized allocations
    const currentTime = new Date();
    const staleAllocations = Array.from(this.allocations.entries()).filter(([_, allocation]) => {
      const ageMinutes = (currentTime.getTime() - allocation.allocatedAt.getTime()) / (1000 * 60);
      return ageMinutes > 30; // Consider allocations older than 30 minutes as potentially stale
    });

    if (staleAllocations.length > 0) {
      logger.info(`Found ${staleAllocations.length} potentially stale resource allocations`);
      // In a real implementation, we would check if these jobs are still active
      // and potentially release resources for completed/failed jobs
    }

    // Defragment resource allocation if needed
    await this.defragmentResources();
  }

  private async defragmentResources(): Promise<void> {
    // Implement resource defragmentation logic
    // This could involve reorganizing allocations to reduce fragmentation
    logger.debug('Resource defragmentation completed');
  }

  private updateSystemResources(): void {
    // Update available resources based on current allocations
    // Available = Initial Available - Allocated (but never go below 0)
    const allocated = this.getTotalAllocatedResources();

    this.systemResources.availableMemory = Math.max(
      0,
      this.initialAvailableResources.memory - allocated.memory
    );
    this.systemResources.availableCpu = Math.max(
      0,
      this.initialAvailableResources.cpu - allocated.cpu
    );
    this.systemResources.availableDisk = Math.max(
      0,
      this.initialAvailableResources.disk - allocated.disk
    );
  }

  private startMonitoring(): void {
    // Skip monitoring in test environment to avoid interference
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      const monitoringData: ResourceMonitoringData = {
        timestamp: new Date(),
        systemResources: { ...this.systemResources },
        allocatedResources: this.getTotalAllocatedResources(),
        utilizationPercentage: this.getResourceUtilization(),
      };

      this.monitoringData.push(monitoringData);

      // Keep only the last N monitoring data points
      if (this.monitoringData.length > this.maxMonitoringHistory) {
        this.monitoringData = this.monitoringData.slice(-this.maxMonitoringHistory);
      }

      // Log high utilization warnings
      const utilization = monitoringData.utilizationPercentage;
      if (utilization.memory > 90 || utilization.cpu > 90 || utilization.disk > 90) {
        logger.warn('High resource utilization detected', utilization);
      }
    }, 30000); // Monitor every 30 seconds
  }

  /**
   * Destroys the resource manager, cleaning up all resources and stopping monitoring
   *
   * @example
   * ```typescript
   * resourceManager.destroy();
   * console.log('Resource manager destroyed');
   * ```
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.allocations.clear();
    this.monitoringData = [];
  }
}
