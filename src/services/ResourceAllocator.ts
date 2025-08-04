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

export interface PooledResource<T> {
  id: string;
  resource: T;
  inUse: boolean;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
}

export interface ResourcePoolOptions {
  maxSize: number;
  maxIdleTime: number; // milliseconds
  cleanupInterval: number; // milliseconds
  enableMetrics: boolean;
}

export interface TempFileOptions {
  prefix?: string;
  suffix?: string;
  directory?: string;
  autoCleanup?: boolean;
  maxAge?: number; // milliseconds
}

export interface ResourceMetrics {
  totalCreated: number;
  totalDestroyed: number;
  currentActive: number;
  currentIdle: number;
  hitRate: number;
  averageUsage: number;
}

/**
 * Generic resource pool for managing reusable components
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

    this.startCleanupTimer();
  }

  /**
   * Acquire a resource from the pool
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
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((error) => {
        logger.error('Resource pool cleanup failed', { error });
      });
    }, this.options.cleanupInterval);
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
   * Get current metrics
   */
  getMetrics(): ResourceMetrics {
    return { ...this.metrics };
  }

  /**
   * Destroy the pool and all resources
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
 * Temporary file manager with automatic cleanup
 */
export class TempFileManager {
  private tempFiles: Map<string, { path: string; createdAt: Date; options: TempFileOptions }> =
    new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private tempDir: string;

  constructor(tempDir?: string) {
    this.tempDir = tempDir || os.tmpdir();
    this.startCleanupTimer();
  }

  /**
   * Create a temporary file
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
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldFiles().catch((error) => {
        logger.error('Temp file cleanup failed', { error });
      });
    }, 300000); // Clean up every 5 minutes
  }

  /**
   * Get current temporary files count
   */
  getTempFilesCount(): number {
    return this.tempFiles.size;
  }

  /**
   * Clean up all temporary files and destroy manager
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
 * Main resource allocator service
 */
export class ResourceAllocator {
  private pools: Map<string, ResourcePool<any>> = new Map();
  private tempFileManager: TempFileManager;

  constructor(tempDir?: string) {
    this.tempFileManager = new TempFileManager(tempDir);
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
   */
  getTempFileManager(): TempFileManager {
    return this.tempFileManager;
  }

  /**
   * Get metrics for all pools
   */
  getAllMetrics(): Record<string, ResourceMetrics> {
    const metrics: Record<string, ResourceMetrics> = {};
    for (const [name, pool] of this.pools.entries()) {
      metrics[name] = pool.getMetrics();
    }
    return metrics;
  }

  /**
   * Destroy all pools and cleanup
   */
  async destroy(): Promise<void> {
    const destroyPromises = Array.from(this.pools.values()).map((pool) => pool.destroy());
    await Promise.all(destroyPromises);
    this.pools.clear();
    await this.tempFileManager.destroy();
  }
}
