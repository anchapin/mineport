/**
 * Cache Service - Provides caching for analysis results and validation outcomes
 * 
 * This service implements multiple caching strategies including in-memory,
 * file-based, and distributed caching to improve performance by avoiding
 * redundant processing of identical files and analysis results.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import logger from '../utils/logger';

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  ttl?: number;
  size?: number;
}

export interface CacheOptions {
  maxSize: number; // Maximum number of entries
  maxMemorySize: number; // Maximum memory usage in bytes
  defaultTTL: number; // Default time-to-live in milliseconds
  enablePersistence: boolean;
  persistenceDir?: string;
  enableMetrics: boolean;
  compressionEnabled: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  memoryUsage: number;
  diskUsage: number;
  evictions: number;
}

export interface CacheKey {
  type: 'file_validation' | 'java_analysis' | 'asset_conversion' | 'security_scan';
  identifier: string; // Usually file hash or unique identifier
  version?: string; // For cache invalidation
}

/**
 * Multi-level cache service with memory and disk persistence
 */
export class CacheService {
  private memoryCache: LRUCache<string, CacheEntry<any>>;
  private options: CacheOptions;
  private metrics: CacheMetrics;
  private persistenceEnabled: boolean;
  private persistenceDir: string;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      maxSize: options.maxSize || 1000,
      maxMemorySize: options.maxMemorySize || 100 * 1024 * 1024, // 100MB
      defaultTTL: options.defaultTTL || 3600000, // 1 hour
      enablePersistence: options.enablePersistence ?? true,
      persistenceDir: options.persistenceDir || path.join(process.cwd(), '.cache'),
      enableMetrics: options.enableMetrics ?? true,
      compressionEnabled: options.compressionEnabled ?? true
    };

    this.persistenceEnabled = this.options.enablePersistence;
    this.persistenceDir = this.options.persistenceDir!;

    this.memoryCache = new LRUCache({
      max: this.options.maxSize,
      maxSize: this.options.maxMemorySize,
      sizeCalculation: (entry: CacheEntry<any>) => this.calculateEntrySize(entry),
      dispose: (entry: CacheEntry<any>, key: string) => {
        this.metrics.evictions++;
        if (this.persistenceEnabled) {
          this.persistToDisk(key, entry).catch(error => {
            logger.error('Failed to persist evicted cache entry', { error, key });
          });
        }
      }
    });

    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      memoryUsage: 0,
      diskUsage: 0,
      evictions: 0
    };

    this.initializePersistence();
  }

  /**
   * Get a value from cache
   */
  async get<T>(cacheKey: CacheKey): Promise<T | null> {
    const key = this.generateKey(cacheKey);
    
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      memoryEntry.lastAccessed = new Date();
      memoryEntry.accessCount++;
      this.metrics.hits++;
      this.updateMetrics();
      return memoryEntry.value as T;
    }

    // Try disk cache if persistence is enabled
    if (this.persistenceEnabled) {
      try {
        const diskEntry = await this.loadFromDisk<T>(key);
        if (diskEntry && !this.isExpired(diskEntry)) {
          // Move back to memory cache
          this.memoryCache.set(key, diskEntry);
          diskEntry.lastAccessed = new Date();
          diskEntry.accessCount++;
          this.metrics.hits++;
          this.updateMetrics();
          return diskEntry.value;
        }
      } catch (error) {
        logger.debug('Failed to load from disk cache', { error, key });
      }
    }

    this.metrics.misses++;
    this.updateMetrics();
    return null;
  }

  /**
   * Set a value in cache
   */
  async set<T>(cacheKey: CacheKey, value: T, ttl?: number): Promise<void> {
    const key = this.generateKey(cacheKey);
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      ttl: ttl || this.options.defaultTTL,
      size: this.estimateValueSize(value)
    };

    this.memoryCache.set(key, entry);
    this.updateMetrics();

    // Persist to disk if enabled
    if (this.persistenceEnabled) {
      try {
        await this.persistToDisk(key, entry);
      } catch (error) {
        logger.error('Failed to persist cache entry to disk', { error, key });
      }
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(cacheKey: CacheKey): Promise<boolean> {
    const key = this.generateKey(cacheKey);
    
    const memoryDeleted = this.memoryCache.delete(key);
    
    if (this.persistenceEnabled) {
      try {
        await this.deleteFromDisk(key);
      } catch (error) {
        logger.debug('Failed to delete from disk cache', { error, key });
      }
    }

    this.updateMetrics();
    return memoryDeleted;
  }

  /**
   * Check if a key exists in cache
   */
  async has(cacheKey: CacheKey): Promise<boolean> {
    const key = this.generateKey(cacheKey);
    
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key);
      return entry ? !this.isExpired(entry) : false;
    }

    if (this.persistenceEnabled) {
      try {
        const diskEntry = await this.loadFromDisk(key);
        return diskEntry ? !this.isExpired(diskEntry) : false;
      } catch (error) {
        return false;
      }
    }

    return false;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.persistenceEnabled) {
      try {
        await fs.rm(this.persistenceDir, { recursive: true, force: true });
        await fs.mkdir(this.persistenceDir, { recursive: true });
      } catch (error) {
        logger.error('Failed to clear disk cache', { error });
      }
    }

    this.resetMetrics();
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    const expiredKeys: string[] = [];

    // Check memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries from memory
    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
    }

    // Cleanup disk cache if enabled
    if (this.persistenceEnabled) {
      await this.cleanupDiskCache();
    }

    this.updateMetrics();
  }

  /**
   * Generate cache key from CacheKey object
   */
  private generateKey(cacheKey: CacheKey): string {
    const keyString = `${cacheKey.type}:${cacheKey.identifier}${cacheKey.version ? `:${cacheKey.version}` : ''}`;
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    if (!entry.ttl) return false;
    const now = new Date().getTime();
    const expiryTime = entry.createdAt.getTime() + entry.ttl;
    return now > expiryTime;
  }

  /**
   * Calculate size of cache entry
   */
  private calculateEntrySize(entry: CacheEntry<any>): number {
    return entry.size || this.estimateValueSize(entry.value);
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateValueSize(value: any): number {
    if (value === null || value === undefined) return 0;
    
    if (typeof value === 'string') {
      return Buffer.byteLength(value, 'utf8');
    }
    
    if (Buffer.isBuffer(value)) {
      return value.length;
    }
    
    // For objects, use JSON string length as approximation
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 1024; // Default estimate
    }
  }

  /**
   * Initialize persistence directory
   */
  private async initializePersistence(): Promise<void> {
    if (!this.persistenceEnabled) return;

    try {
      await fs.mkdir(this.persistenceDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to initialize cache persistence directory', { error });
      this.persistenceEnabled = false;
    }
  }

  /**
   * Persist cache entry to disk
   */
  private async persistToDisk<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.persistenceEnabled) return;

    const filePath = path.join(this.persistenceDir, `${key}.json`);
    const data = {
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      lastAccessed: entry.lastAccessed.toISOString()
    };

    let content = JSON.stringify(data);
    
    if (this.options.compressionEnabled) {
      const zlib = await import('zlib');
      content = zlib.gzipSync(content).toString('base64');
    }

    await fs.writeFile(filePath, content);
  }

  /**
   * Load cache entry from disk
   */
  private async loadFromDisk<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.persistenceEnabled) return null;

    const filePath = path.join(this.persistenceDir, `${key}.json`);
    
    try {
      let content = await fs.readFile(filePath, 'utf8');
      
      if (this.options.compressionEnabled) {
        const zlib = await import('zlib');
        content = zlib.gunzipSync(Buffer.from(content, 'base64')).toString();
      }

      const data = JSON.parse(content);
      
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        lastAccessed: new Date(data.lastAccessed)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete cache entry from disk
   */
  private async deleteFromDisk(key: string): Promise<void> {
    if (!this.persistenceEnabled) return;

    const filePath = path.join(this.persistenceDir, `${key}.json`);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, which is fine
    }
  }

  /**
   * Cleanup expired entries from disk cache
   */
  private async cleanupDiskCache(): Promise<void> {
    if (!this.persistenceEnabled) return;

    try {
      const files = await fs.readdir(this.persistenceDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const key = file.replace('.json', '');
          const entry = await this.loadFromDisk(key);
          
          if (entry && this.isExpired(entry)) {
            await this.deleteFromDisk(key);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup disk cache', { error });
    }
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    if (!this.options.enableMetrics) return;

    this.metrics.totalEntries = this.memoryCache.size;
    this.metrics.memoryUsage = this.memoryCache.calculatedSize || 0;
    
    const totalRequests = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;
  }

  /**
   * Reset metrics
   */
  private resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      memoryUsage: 0,
      diskUsage: 0,
      evictions: 0
    };
  }

  /**
   * Destroy cache service and cleanup resources
   */
  async destroy(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.persistenceEnabled) {
      // Optionally keep disk cache for next startup
      // await fs.rm(this.persistenceDir, { recursive: true, force: true });
    }
  }
}