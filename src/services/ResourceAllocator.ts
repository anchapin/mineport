/**
 * Resource Allocator - Manages resource pooling and allocation
 *
 * This service provides resource pooling for reusable components,
 * temporary file management, and memory optimization to improve
 * performance and reduce resource waste.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Pooled resource wrapper with metadata
 */
export interface PooledResource<T> {
  id: string;
  resource: T;
  inUse: boolean;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
}

/**
 * Configuration options for resource pool
 */
export interface ResourcePoolOptions {
  maxSize: number;
  maxIdleTime: number; // milliseconds
  cleanupInterval: number; // milliseconds
  enableMetrics: boolean;
}

export enum ResourceType {
  MEMORY = 'memory',
  CPU = 'cpu',
  STORAGE = 'storage',
  NETWORK = 'network',
}

export enum ResourceAllocationStrategy {
  CONSERVATIVE = 'conservative',
  BALANCED = 'balanced',
  AGGRESSIVE = 'aggressive',
}

/**
 * Configuration options for temporary files
 */
export interface TempFileOptions {
  prefix?: string;
  suffix?: string;
  directory?: string;
  autoCleanup?: boolean;
  maxAge?: number; // milliseconds
}

/**
 * Resource pool metrics for monitoring usage and performance
 */
export interface ResourceMetrics {
  totalCreated: number;
  totalDestroyed: number;
  currentActive: number;
  currentIdle: number;
  hitRate: number;
  averageUsage: number;
}

/**
 * Generic resource pool for managing reusable components with automatic cleanup
 */
export class ResourcePool<T> {
  private pool: Map<string, PooledResource<T>> = new Map();
  private options: ResourcePoolOptions;
  private factory: () => Promise<T>;
  private destroyer: (resource: T) => Promise<void>;
  private cleanupTimer?: NodeJS.Timeout;
  private metrics: ResourceMetrics;

  constructor(
    factory: () => Promise<T>,
    destroyer: (resource: T) => Promise<void>,
    options: Partial<ResourcePoolOptions> = {}
  ) {
    this.factory = factory;
    this.destroyer = destroyer;
    this.options = {
      maxSize: options.maxSize || 10,
      maxIdleTime: options.maxIdleTime || 300000, // 5 minutes
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      enableMetrics: options.enableMetrics ?? true,
    };

    this.metrics = {
      totalCreated: 0,
      totalDestroyed: 0,
      currentActive: 0,
      currentIdle: 0,
      hitRate: 0,
      averageUsage: 0,
    };

  }

  /**
   * Acquire a resource from the pool
   * @returns Promise resolving to resource wrapper with release function
   */
  async acquire(): Promise<{ id: string; resource: T; release: () => Promise<void> }> {
    // Try to find an idle resource
    for (const [id, pooledResource] of this.pool.entries()) {
      if (!pooledResource.inUse) {
        pooledResource.inUse = true;
        pooledResource.lastUsed = new Date();
        pooledResource.usageCount++;

        this.updateMetrics();

        return {
          id,
          resource: pooledResource.resource,
          release: () => this.release(id),
        };
      }
    }

    // Create new resource if pool is not at max capacity
    if (this.pool.size < this.options.maxSize) {
      const resource = await this.factory();
      const id = uuidv4();
      const pooledResource: PooledResource<T> = {
        id,
        resource,
        inUse: true,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 1,
      };

      this.pool.set(id, pooledResource);
      this.metrics.totalCreated++;
      this.updateMetrics();

      return {
        id,
        resource,
        release: () => this.release(id),
      };
    }

    // Pool is full, wait for a resource to become available
    return this.waitForResource();
  }

  /**
   * Release a resource back to the pool
   */
  private async release(id: string): Promise<void> {
    const pooledResource = this.pool.get(id);
    if (pooledResource) {
      pooledResource.inUse = false;
      pooledResource.lastUsed = new Date();
      this.updateMetrics();
    }
  }

  /**
   * Wait for a resource to become available
   */
  private async waitForResource(): Promise<{
    id: string;
    resource: T;
    release: () => Promise<void>;
  }> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        try {
          // Try to acquire again
          for (const [id, pooledResource] of this.pool.entries()) {
            if (!pooledResource.inUse) {
              clearInterval(checkInterval);
              pooledResource.inUse = true;
              pooledResource.lastUsed = new Date();
              pooledResource.usageCount++;

              this.updateMetrics();

              resolve({
                id,
                resource: pooledResource.resource,
                release: () => this.release(id),
              });
              return;
            }
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 100); // Check every 100ms

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for resource'));
      }, 30000);
    });
  }

  /**
   * Clean up idle resources
   */
  private async cleanup(): Promise<void> {
    const now = new Date();
    const toRemove: string[] = [];

    for (const [id, pooledResource] of this.pool.entries()) {
      if (!pooledResource.inUse) {
        const idleTime = now.getTime() - pooledResource.lastUsed.getTime();
        if (idleTime > this.options.maxIdleTime) {
          toRemove.push(id);
        }
      }
    }

    for (const id of toRemove) {
      const pooledResource = this.pool.get(id);
      if (pooledResource) {
        try {
          await this.destroyer(pooledResource.resource);
          this.pool.delete(id);
          this.metrics.totalDestroyed++;
        } catch (error) {
          logger.error('Error destroying pooled resource', { error, id });
        }
      }
    }

    this.updateMetrics();
  }

  /**
   * Start cleanup timer
   */
  public startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((error) => {
        logger.error('Resource pool cleanup failed', { error });
      });
    }, this.options.cleanupInterval);
  }

  /**
   * Get current metrics
   * @returns Copy of current resource pool metrics
   */
  getMetrics(): ResourceMetrics {
    return { ...this.metrics };
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    if (!this.options.enableMetrics) return;

    this.metrics.currentActive = Array.from(this.pool.values()).filter((r) => r.inUse).length;
    this.metrics.currentIdle = this.pool.size - this.metrics.currentActive;

    const totalRequests = this.metrics.totalCreated;
    const hits =
      Array.from(this.pool.values()).reduce((sum, r) => sum + r.usageCount, 0) -
      this.metrics.totalCreated;
    this.metrics.hitRate = totalRequests > 0 ? hits / totalRequests : 0;

    const totalUsage = Array.from(this.pool.values()).reduce((sum, r) => sum + r.usageCount, 0);
    this.metrics.averageUsage = this.pool.size > 0 ? totalUsage / this.pool.size : 0;
  }

  /**
   * Destroy the pool and all resources
   * @returns Promise that resolves when all resources are destroyed
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    const destroyPromises = Array.from(this.pool.values()).map(async (pooledResource) => {
      try {
        await this.destroyer(pooledResource.resource);
      } catch (error) {
        logger.error('Error destroying resource during pool destruction', { error });
      }
    });

    await Promise.all(destroyPromises);
    this.pool.clear();
    this.metrics.totalDestroyed += destroyPromises.length;
  }
}

/**
 * Temporary file manager with automatic cleanup and resource management
 */
export class TempFileManager {
  private tempFiles: Map<string, { path: string; createdAt: Date; options: TempFileOptions }> =
    new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private tempDir: string;

  constructor(tempDir?: string) {
    this.tempDir = tempDir || os.tmpdir();
  }

  /**
   * Create a temporary file
   * @param options - Configuration options for the temporary file
   * @returns Promise resolving to file path and cleanup function
   */
  async createTempFile(
    options: TempFileOptions = {}
  ): Promise<{ path: string; cleanup: () => Promise<void> }> {
    const id = uuidv4();
    const filename = `${options.prefix || 'temp'}_${id}${options.suffix || '.tmp'}`;
    const directory = options.directory || this.tempDir;
    const filePath = path.join(directory, filename);

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Create empty file
    await fs.writeFile(filePath, '');

    const tempFileInfo = {
      path: filePath,
      createdAt: new Date(),
      options,
    };

    this.tempFiles.set(id, tempFileInfo);

    return {
      path: filePath,
      cleanup: () => this.cleanupTempFile(id),
    };
  }

  /**
   * Create a temporary directory
   * @param options - Configuration options for the temporary directory
   * @returns Promise resolving to directory path and cleanup function
   * @example
   * ```typescript
   * const { path, cleanup } = await tempManager.createTempDirectory({
   *   prefix: 'mod_extraction',
   *   maxAge: 3600000 // 1 hour
   * });
   * // Use directory...
   * await cleanup();
   * ```
   */
  async createTempDirectory(
    options: TempFileOptions = {}
  ): Promise<{ path: string; cleanup: () => Promise<void> }> {
    const id = uuidv4();
    const dirname = `${options.prefix || 'temp'}_${id}`;
    const directory = options.directory || this.tempDir;
    const dirPath = path.join(directory, dirname);

    await fs.mkdir(dirPath, { recursive: true });

    const tempFileInfo = {
      path: dirPath,
      createdAt: new Date(),
      options,
    };

    this.tempFiles.set(id, tempFileInfo);

    return {
      path: dirPath,
      cleanup: () => this.cleanupTempFile(id),
    };
  }

  /**
   * Clean up a specific temporary file
   */
  private async cleanupTempFile(id: string): Promise<void> {
    const tempFileInfo = this.tempFiles.get(id);
    if (!tempFileInfo) return;

    try {
      const stats = await fs.stat(tempFileInfo.path);
      if (stats.isDirectory()) {
        await fs.rm(tempFileInfo.path, { recursive: true, force: true });
      } else {
        await fs.unlink(tempFileInfo.path);
      }
      this.tempFiles.delete(id);
    } catch (error) {
      logger.error('Failed to cleanup temp file', { error, path: tempFileInfo.path });
    }
  }

  /**
   * Clean up old temporary files
   */
  private async cleanupOldFiles(): Promise<void> {
    const now = new Date();
    const toCleanup: string[] = [];

    for (const [id, tempFileInfo] of this.tempFiles.entries()) {
      const maxAge = tempFileInfo.options.maxAge || 3600000; // 1 hour default
      const age = now.getTime() - tempFileInfo.createdAt.getTime();

      if (age > maxAge) {
        toCleanup.push(id);
      }
    }

    for (const id of toCleanup) {
      await this.cleanupTempFile(id);
    }
  }

  /**
   * Start cleanup timer
   */
  public startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldFiles().catch((error) => {
        logger.error('Temp file cleanup failed', { error });
      });
    }, 300000); // Clean up every 5 minutes
  }

  /**
   * Get current temporary files count
   * @returns Number of active temporary files being managed
   * @example
   * ```typescript
   * console.log(`Managing ${tempManager.getTempFilesCount()} temp files`);
   * ```
   */
  getTempFilesCount(): number {
    return this.tempFiles.size;
  }

  /**
   * Clean up all temporary files and destroy manager
   * @returns Promise that resolves when all temp files are cleaned up
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    const cleanupPromises = Array.from(this.tempFiles.keys()).map((id) => this.cleanupTempFile(id));
    await Promise.all(cleanupPromises);
  }
}

/**
 * Resource allocation with unique identifier and resource requirements
 */
export interface ResourceAllocation {
  id: string;
  memory: number;
  cpu: number;
  storage: number;
  createdAt: Date;
  timeout?: number;
}

/**
 * Resource usage metrics for tracking current resource consumption
 */
export interface ResourceUsage {
  memory: number;
  cpu: number;
  storage: number;
}

/**
 * Resource allocation request with requirements and preferences
 */
export interface ResourceRequest {
  memory: number;
  cpu: number;
  storage: number;
  priority?: number;
  timeout?: number;
}

/**
 * Main resource allocator service for managing resource pools, temporary files, and allocations
 */
export class ResourceAllocator {
  private pools: Map<string, ResourcePool<any>> = new Map();
  private tempFileManager: TempFileManager;
  private allocations: Map<string, ResourceAllocation> = new Map();
  private maxMemory: number;
  private maxCpu: number;
  private maxStorage: number;
  private strategy: ResourceAllocationStrategy;
  private checkInterval: number;
  private minWorkers: number;
  private maxWorkers: number;
  private configService?: any;

  constructor(
    config?:
      | string
      | {
          maxMemory?: number;
          maxCpu?: number;
          maxStorage?: number;
          strategy?: ResourceAllocationStrategy;
          workerPool?: any;
          jobQueue?: any;
          configService?: any;
        }
  ) {
    if (typeof config === 'string') {
      // Legacy constructor for temp directory
      this.tempFileManager = new TempFileManager(config);
      this.maxMemory = 1024; // Default 1GB
      this.maxCpu = 4; // Default 4 cores
      this.maxStorage = 10240; // Default 10GB
      this.strategy = ResourceAllocationStrategy.BALANCED;
      this.checkInterval = 60000;
      this.minWorkers = 2;
      this.maxWorkers = 10;
    } else if (config) {
      this.tempFileManager = new TempFileManager();
      this.configService = config.configService;

      if (this.configService) {
        // Use configuration service values
        this.maxMemory = this.configService.get('resources.maxMemory', 1024);
        this.maxCpu = this.configService.get('resources.maxCpu', 4);
        this.maxStorage = this.configService.get('resources.maxStorage', 10240);
        this.checkInterval = this.configService.get('resources.checkInterval', 60000);
        this.minWorkers = this.configService.get('resources.minWorkers', 2);
        this.maxWorkers = this.configService.get('resources.maxWorkers', 10);

        const strategyName = this.configService.get('resources.strategy', 'balanced');
        this.strategy = this.getStrategyFromName(strategyName);

        // Listen for configuration changes
        this.configService.on('configChanged', (key: string, value: any) => {
          this.handleConfigChange(key, value);
        });
      } else {
        this.maxMemory = config.maxMemory || 1024;
        this.maxCpu = config.maxCpu || 4;
        this.maxStorage = config.maxStorage || 10240;
        this.strategy = config.strategy || ResourceAllocationStrategy.BALANCED;
        this.checkInterval = 60000;
        this.minWorkers = 2;
        this.maxWorkers = 10;
      }
    } else {
      this.tempFileManager = new TempFileManager();
      this.maxMemory = 1024; // Default 1GB
      this.maxCpu = 4; // Default 4 cores
      this.maxStorage = 10240; // Default 10GB
      this.strategy = ResourceAllocationStrategy.BALANCED;
      this.checkInterval = 60000;
      this.minWorkers = 2;
      this.maxWorkers = 10;
    }
  }

  private getStrategyFromName(name: string): ResourceAllocationStrategy {
    switch (name.toLowerCase()) {
      case 'conservative':
        return ResourceAllocationStrategy.CONSERVATIVE;
      case 'aggressive':
        return ResourceAllocationStrategy.AGGRESSIVE;
      case 'balanced':
      default:
        return ResourceAllocationStrategy.BALANCED;
    }
  }

  private handleConfigChange(key: string, value: any): void {
    switch (key) {
      case 'resources.checkInterval':
        this.checkInterval = value;
        break;
      case 'resources.minWorkers':
        this.minWorkers = value;
        break;
      case 'resources.maxWorkers':
        this.maxWorkers = value;
        break;
      case 'resources.strategy':
        this.strategy = this.getStrategyFromName(value);
        break;
      case 'resources.maxMemory':
        this.maxMemory = value;
        break;
      case 'resources.maxCpu':
        this.maxCpu = value;
        break;
      case 'resources.maxStorage':
        this.maxStorage = value;
        break;
    }
  }

  /**
   * Start the resource allocator and its components
   */
  public start(): void {
    this.tempFileManager.startCleanupTimer();
    for (const pool of this.pools.values()) {
      pool.startCleanupTimer();
    }
  }

  /**
   * Stop the resource allocator and destroy its components
   */
  public async stop(): Promise<void> {
    await this.destroy();
  }

  /**
   * Create or get a resource pool
   */
  createPool<T>(
    name: string,
    factory: () => Promise<T>,
    destroyer: (resource: T) => Promise<void>,
    options?: Partial<ResourcePoolOptions>
  ): ResourcePool<T> {
    if (this.pools.has(name)) {
      return this.pools.get(name) as ResourcePool<T>;
    }

    const pool = new ResourcePool(factory, destroyer, options);
    this.pools.set(name, pool);
    return pool;
  }

  /**
   * Get an existing pool
   */
  getPool<T>(name: string): ResourcePool<T> | undefined {
    return this.pools.get(name) as ResourcePool<T>;
  }

  /**
   * Get temp file manager
   * @returns The temporary file manager instance
   * @example
   * ```typescript
   * const tempManager = allocator.getTempFileManager();
   * const { path } = await tempManager.createTempFile({ prefix: 'mod' });
   * ```
   */
  getTempFileManager(): TempFileManager {
    return this.tempFileManager;
  }

  /**
   * Get metrics for all pools
   * @returns Record mapping pool names to their metrics
   */
  getAllMetrics(): Record<string, ResourceMetrics> {
    const metrics: Record<string, ResourceMetrics> = {};
    for (const [name, pool] of this.pools.entries()) {
      metrics[name] = pool.getMetrics();
    }
    return metrics;
  }

  /**
   * Allocate resources
   * @param request - Resource allocation request with memory, CPU, and storage requirements
   * @returns Resource allocation object with unique ID
   */
  allocate(request: ResourceRequest): ResourceAllocation {
    const currentUsage = this.getCurrentUsage();

    // Check if resources are available
    if (
      currentUsage.memory + request.memory > this.maxMemory ||
      currentUsage.cpu + request.cpu > this.maxCpu ||
      currentUsage.storage + request.storage > this.maxStorage
    ) {
      throw new Error('Insufficient resources available');
    }

    const allocation: ResourceAllocation = {
      id: uuidv4(),
      memory: request.memory,
      cpu: request.cpu,
      storage: request.storage,
      createdAt: new Date(),
      timeout: request.timeout,
    };

    this.allocations.set(allocation.id, allocation);
    return allocation;
  }

  /**
   * Release allocated resources
   * @param allocationId - Unique identifier of the allocation to release
   * @returns void
   */
  release(allocationId: string): void {
    this.allocations.delete(allocationId);
  }

  /**
   * Get current resource usage
   * @returns Current resource usage across all allocations
   */
  getCurrentUsage(): ResourceUsage {
    let memory = 0;
    let cpu = 0;
    let storage = 0;

    for (const allocation of this.allocations.values()) {
      memory += allocation.memory;
      cpu += allocation.cpu;
      storage += allocation.storage;
    }

    return { memory, cpu, storage };
  }

  /**
   * Get available resources
   * @returns The available resources including memory, CPU, and storage
   */
  getAvailability(): ResourceUsage {
    const currentUsage = this.getCurrentUsage();
    return {
      memory: this.maxMemory - currentUsage.memory,
      cpu: this.maxCpu - currentUsage.cpu,
      storage: this.maxStorage - currentUsage.storage,
    };
  }

  /**
   * Clean up expired allocations
   * @returns void
   * @example
   * ```typescript
   * // Cleanup expired allocations
   * allocator.cleanupExpiredAllocations();
   * ```
   */
  cleanupExpiredAllocations(): void {
    const now = Date.now();
    for (const [id, allocation] of this.allocations.entries()) {
      if (allocation.timeout && now - allocation.createdAt.getTime() > allocation.timeout) {
        this.allocations.delete(id);
      }
    }
  }

  /**
   * Start the resource allocator
   * @returns void
   */
  start(): void {
    logger.info('ResourceAllocator started');
    // Initialize any background processes if needed
  }

  /**
   * Stop the resource allocator
   * @returns void
   */
  stop(): void {
    logger.info('ResourceAllocator stopped');
    // Stop any background processes if needed
  }

  /**
   * Destroy all pools and cleanup
   * @returns Promise that resolves when all resources are destroyed
   */
  async destroy(): Promise<void> {
    const destroyPromises = Array.from(this.pools.values()).map((pool) => pool.destroy());
    await Promise.all(destroyPromises);
    this.pools.clear();
    this.allocations.clear();
    await this.tempFileManager.destroy();
  }
}
