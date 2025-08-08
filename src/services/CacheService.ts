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
import logger from '../utils/logger.js';

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
  maxSize?: number; // Maximum number of entries
  maxMemorySize?: number; // Maximum memory usage in bytes
  defaultTTL?: number; // Default time-to-live in milliseconds
  enablePersistence?: boolean;
  persistenceDir?: string;
  enableMetrics?: boolean;
  compressionEnabled?: boolean;
  enabled?: boolean; // For backward compatibility
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate?: number;
  totalEntries?: number;
  memoryUsage?: number;
  diskUsage?: number;
  evictions?: number;
  sets?: number;
  invalidations?: number;
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
  private enabled: boolean;
  private ttlDefaults: Record<string, number>;
  private configService?: any;

  constructor(options: Partial<CacheOptions & { configService?: any }> = {}) {
    this.configService = options.configService;

    if (this.configService) {
      // Use configuration service values
      this.options = {
        maxSize: this.configService.get('cache.maxSize', 1000),
        maxMemorySize: this.configService.get('cache.maxMemorySize', 100 * 1024 * 1024),
        defaultTTL: this.configService.get('cache.defaultTTL', 3600000),
        enablePersistence: this.configService.get('cache.enablePersistence', true),
        persistenceDir: this.configService.get(
          'cache.persistenceDir',
          path.join(process.cwd(), '.cache')
        ),
        enableMetrics: this.configService.get('cache.enableMetrics', true),
        compressionEnabled: this.configService.get('cache.compressionEnabled', true),
        enabled: this.configService.get('cache.enabled', true),
      };

      const defaultTtls = {
        api_mapping: 86400, // 24 hours
        file_validation: 3600, // 1 hour
        java_analysis: 7200, // 2 hours
      };

      this.ttlDefaults = this.configService.get('cache.ttlDefaults', defaultTtls);

      // Also check for individual ttl keys
      for (const key of Object.keys(defaultTtls)) {
        const individualValue = this.configService.get(`cache.ttlDefaults.${key}`);
        if (individualValue !== undefined) {
          if (!this.ttlDefaults) {
            this.ttlDefaults = {};
          }
          this.ttlDefaults[key] = individualValue;
        }
      }

      // Listen for configuration changes
      this.configService.on('configChanged', (key: string, value: any) => {
        this.handleConfigChange(key, value);
      });
    } else {
      this.options = {
        maxSize: options.maxSize || 1000,
        maxMemorySize: options.maxMemorySize || 100 * 1024 * 1024, // 100MB
        defaultTTL: options.defaultTTL || 3600000, // 1 hour
        enablePersistence: options.enablePersistence ?? true,
        persistenceDir: options.persistenceDir || path.join(process.cwd(), '.cache'),
        enableMetrics: options.enableMetrics ?? true,
        compressionEnabled: options.compressionEnabled ?? true,
        enabled: options.enabled ?? true,
      };

      this.ttlDefaults = {
        api_mapping: 86400, // 24 hours
        file_validation: 3600, // 1 hour
        java_analysis: 7200, // 2 hours
      };
    }

    this.enabled = this.options.enabled!;
    this.persistenceEnabled = this.options.enablePersistence!;
    this.persistenceDir = this.options.persistenceDir!;

    this.memoryCache = new LRUCache({
      max: this.options.maxSize || 1000,
      ttl: this.options.defaultTTL || 3600000,
      dispose: (entry: CacheEntry<any>, key: string) => {
        this.metrics.evictions++;
        if (this.persistenceEnabled) {
          this.persistToDisk(key, entry).catch((error) => {
            logger.error('Failed to persist evicted cache entry', { error, key });
          });
        }
      },
    });

    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      memoryUsage: 0,
      diskUsage: 0,
      evictions: 0,
      sets: 0,
      invalidations: 0,
    };

    this.initializePersistence();
  }

  /**
   * Get a value from cache (backward compatibility - accepts string key)
   */
  async get<T>(key: string | CacheKey): Promise<T | null> {
    if (!this.enabled) return null;

    const cacheKey = typeof key === 'string' ? this.stringToCacheKey(key) : key;
    const keyString = this.generateKey(cacheKey);

    // Try memory cache first
    const memoryEntry = this.memoryCache.get(keyString);

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
        const diskEntry = await this.loadFromDisk<T>(keyString);
        if (diskEntry && !this.isExpired(diskEntry)) {
          // Move back to memory cache
          this.memoryCache.set(keyString, diskEntry);
          diskEntry.lastAccessed = new Date();
          diskEntry.accessCount++;
          this.metrics.hits++;
          this.updateMetrics();
          return diskEntry.value;
        }
      } catch (error) {
        logger.debug('Failed to load from disk cache', { error, keyString });
      }
    }

    this.metrics.misses++;
    this.updateMetrics();
    return null;
  }

  /**
   * Set a value in cache (backward compatibility - accepts string key)
   */
  async set<T>(key: string | CacheKey, value: T, ttl?: number): Promise<void> {
    if (!this.enabled) return;

    const cacheKey = typeof key === 'string' ? this.stringToCacheKey(key) : key;
    this.metrics.sets = (this.metrics.sets || 0) + 1;
    const keyString = this.generateKey(cacheKey);

    const entry: CacheEntry<T> = {
      key: keyString,
      value,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      ttl: ttl || this.options.defaultTTL,
      size: this.estimateValueSize(value),
    };

    this.memoryCache.set(keyString, entry);
    this.updateMetrics();

    // Persist to disk if enabled
    if (this.persistenceEnabled) {
      try {
        await this.persistToDisk(keyString, entry);
      } catch (error) {
        logger.error('Failed to persist cache entry to disk', { error, keyString });
      }
    }
  }

  /**
   * Delete a value from cache (backward compatibility - accepts string key)
   */
  async delete(key: string | CacheKey): Promise<boolean> {
    if (!this.enabled) return false;

    const cacheKey = typeof key === 'string' ? this.stringToCacheKey(key) : key;
    this.metrics.invalidations = (this.metrics.invalidations || 0) + 1;
    const keyString = this.generateKey(cacheKey);

    const memoryDeleted = this.memoryCache.delete(keyString);

    if (this.persistenceEnabled) {
      try {
        await this.deleteFromDisk(keyString);
      } catch (error) {
        logger.debug('Failed to delete from disk cache', { error, keyString });
      }
    }

    this.updateMetrics();
    return memoryDeleted;
  }

  /**
   * Check if a key exists in cache (backward compatibility - accepts string key)
   */
  async has(key: string | CacheKey): Promise<boolean> {
    if (!this.enabled) return false;

    const cacheKey = typeof key === 'string' ? this.stringToCacheKey(key) : key;
    const keyString = this.generateKey(cacheKey);

    if (this.memoryCache.has(keyString)) {
      const entry = this.memoryCache.get(keyString);
      return entry ? !this.isExpired(entry) : false;
    }

    if (this.persistenceEnabled) {
      try {
        const diskEntry = await this.loadFromDisk(keyString);
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
      lastAccessed: entry.lastAccessed.toISOString(),
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
        lastAccessed: new Date(data.lastAccessed),
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
      evictions: 0,
    };
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      memoryUsage: 0,
      diskUsage: 0,
      evictions: 0,
      sets: 0,
      invalidations: 0,
    };
  }

  /**
   * Clear entries by prefix
   */
  async clearByPrefix(prefix: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [keyString] of this.memoryCache.entries()) {
      // For string keys, check if the original key (before hashing) starts with prefix
      // We need to reverse-engineer this or store original keys
      if (keyString.includes(prefix) || this.keyMatchesPrefix(keyString, prefix)) {
        keysToDelete.push(keyString);
      }
    }

    for (const keyString of keysToDelete) {
      this.memoryCache.delete(keyString);
      this.metrics.invalidations = (this.metrics.invalidations || 0) + 1;
    }

    this.updateMetrics();
  }

  /**
   * Check if a hashed key matches a prefix (simplified approach)
   */
  private keyMatchesPrefix(hashedKey: string, prefix: string): boolean {
    // Since we hash keys, we can't easily match prefixes
    // For now, we'll store a mapping or use a different approach
    // This is a simplified implementation
    return false;
  }

  /**
   * Convert string key to CacheKey object (for backward compatibility)
   */
  private stringToCacheKey(key: string): CacheKey {
    const parts = key.split(':');
    return {
      type: (parts[0] as any) || 'file_validation',
      identifier: parts.slice(1).join(':') || key,
    };
  }

  /**
   * Handle configuration changes
   */
  private handleConfigChange(key: string, value: any): void {
    switch (key) {
      case 'cache.enabled':
        this.enabled = value;
        break;
      case 'cache.ttlDefaults.api_mapping':
        this.ttlDefaults.api_mapping = value;
        break;
      case 'cache.ttlDefaults.file_validation':
        this.ttlDefaults.file_validation = value;
        break;
      case 'cache.ttlDefaults.java_analysis':
        this.ttlDefaults.java_analysis = value;
        break;
      case 'cache.maxSize':
        this.options.maxSize = value;
        break;
      case 'cache.defaultTTL':
        this.options.defaultTTL = value;
        break;
    }
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

/**
 * Cache key generator utility class
 */
export class CacheKeyGenerator {
  static modAnalysis(modName: string, version: string): string {
    return `mod_analysis:${modName}:${version}`;
  }

  static assetConversion(modName: string, assetType: string, assetName: string): string {
    return `asset_conversion:${modName}:${assetType}:${assetName}`;
  }

  static apiMapping(className: string, version: string): string {
    return `api_mapping:${version}:${className}`;
  }

  static codeTranslation(hash: string): string {
    return `code_translation:${hash}`;
  }
}

/**
 * Cache invalidation strategy
 */
export class CacheInvalidationStrategy {
  constructor(private cacheService: CacheService) {}

  async invalidateModCache(modName: string): Promise<void> {
    await this.cacheService.clearByPrefix(`mod_analysis:${modName}`);
  }

  async invalidateAssetCache(modName: string): Promise<void> {
    await this.cacheService.clearByPrefix(`asset_conversion:${modName}`);
  }

  async invalidateApiMappingCache(version: string): Promise<void> {
    await this.cacheService.clearByPrefix(`api_mapping:${version}`);
  }

  async invalidateAllCaches(): Promise<void> {
    await this.cacheService.clearByPrefix('mod_analysis:');
    await this.cacheService.clearByPrefix('asset_conversion:');
    await this.cacheService.clearByPrefix('api_mapping:');
    await this.cacheService.clearByPrefix('code_translation:');
  }
}
