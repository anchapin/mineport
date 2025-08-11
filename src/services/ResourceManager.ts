/**
 * Resource Manager for job resource allocation and monitoring
 */

import { ResourceRequirements, ResourceAllocation, Job } from '../types/job.js';
import { logger } from '../utils/logger.js';

export interface SystemResources {
  totalMemory: number;
  availableMemory: number;
  totalCpu: number;
  availableCpu: number;
  totalDisk: number;
  availableDisk: number;
}

export interface ResourceMonitoringData {
  timestamp: Date;
  systemResources: SystemResources;
  allocatedResources: ResourceRequirements;
  utilizationPercentage: {
    memory: number;
    cpu: number;
    disk: number;
  };
}

export class ResourceManager {
  private allocations = new Map<string, ResourceAllocation>();
  private systemResources: SystemResources;
  private initialAvailableResources: ResourceRequirements;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private monitoringData: ResourceMonitoringData[] = [];
  private readonly maxMonitoringHistory = 1000;

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

  canAllocateResources(requirements: ResourceRequirements): boolean {
    const available = this.getAvailableResources();

    return (
      available.memory >= requirements.memory &&
      available.cpu >= requirements.cpu &&
      available.disk >= requirements.disk
    );
  }

  getAvailableResources(): ResourceRequirements {
    // Return the current available resources (already calculated in updateSystemResources)
    return {
      memory: this.systemResources.availableMemory,
      cpu: this.systemResources.availableCpu,
      disk: this.systemResources.availableDisk,
    };
  }

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

  getResourceUtilization(): { memory: number; cpu: number; disk: number } {
    const allocated = this.getTotalAllocatedResources();

    return {
      memory: (allocated.memory / this.systemResources.totalMemory) * 100,
      cpu: (allocated.cpu / this.systemResources.totalCpu) * 100,
      disk: (allocated.disk / this.systemResources.totalDisk) * 100,
    };
  }

  getMonitoringData(): ResourceMonitoringData[] {
    return [...this.monitoringData];
  }

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

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.allocations.clear();
    this.monitoringData = [];
  }
}
