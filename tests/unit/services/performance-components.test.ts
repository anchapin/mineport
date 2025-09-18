/**
 * Performance Components Unit Tests
 *
 * Basic unit tests for performance optimization components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CacheService } from '../../../src/services/CacheService.js';
import { PerformanceMonitor } from '../../../src/services/PerformanceMonitor.js';
import { ResourceAllocator } from '../../../src/services/ResourceAllocator.js';

describe('Performance Components Unit Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-unit-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('CacheService', () => {
    it('should create and retrieve cached values', async () => {
      const cache = new CacheService({
        maxSize: 10,
        enablePersistence: false,
        enableMetrics: true,
      });

      const key = { type: 'file_validation' as const, identifier: 'test-key' };
      const value = { data: 'test-value' };

      await cache.set(key, value);
      const retrieved = await cache.get(key);

      expect(retrieved).toEqual(value);

      const metrics = cache.getMetrics();
      expect(metrics.totalEntries).toBe(1);
      expect(metrics.hits).toBe(1);

      await cache.destroy();
    });

    it('should handle cache eviction', async () => {
      const cache = new CacheService({
        maxSize: 2,
        enablePersistence: false,
      });

      // Fill cache beyond capacity
      await cache.set({ type: 'file_validation', identifier: 'key1' }, { data: '1' });
      await cache.set({ type: 'file_validation', identifier: 'key2' }, { data: '2' });
      await cache.set({ type: 'file_validation', identifier: 'key3' }, { data: '3' });

      const metrics = cache.getMetrics();
      expect(metrics.totalEntries).toBeLessThanOrEqual(2);

      await cache.destroy();
    });
  });

  describe('PerformanceMonitor', () => {
    it('should collect performance metrics', async () => {
      const monitor = new PerformanceMonitor({
        interval: 100,
        enableProfiling: true,
        enableAlerts: false,
      });

      // Wait for at least one metrics collection
      await new Promise((resolve) => setTimeout(resolve, 200));

      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics?.memory.usage).toBeGreaterThanOrEqual(0);

      monitor.destroy();
    });

    it('should profile operations', async () => {
      const monitor = new PerformanceMonitor({
        enableProfiling: true,
        enableAlerts: false,
      });

      const profileId = monitor.startProfile('test-operation');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 50));

      const profile = monitor.endProfile(profileId);

      expect(profile).toBeDefined();
      expect(profile?.name).toBe('test-operation');
      expect(profile?.duration).toBeGreaterThan(40);

      monitor.destroy();
    });
  });

  describe('ResourceAllocator', () => {
    it('should manage resource pools', async () => {
      const allocator = new ResourceAllocator(tempDir);

      const pool = allocator.createPool(
        'test-pool',
        async () => ({ id: Math.random() }),
        async () => {},
        { maxSize: 3 }
      );

      const resource1 = await pool.acquire();
      const resource2 = await pool.acquire();

      expect(resource1.resource).toBeDefined();
      expect(resource2.resource).toBeDefined();

      await resource1.release();
      await resource2.release();

      const metrics = pool.getMetrics();
      expect(metrics.totalCreated).toBeLessThanOrEqual(3);

      await allocator.destroy();
    });

    it('should manage temporary files', async () => {
      const allocator = new ResourceAllocator(tempDir);
      const tempManager = allocator.getTempFileManager();

      const tempFile = await tempManager.createTempFile({
        prefix: 'test',
        suffix: '.tmp',
      });

      expect(tempFile.path).toBeDefined();

      // Write some data
      await fs.writeFile(tempFile.path, 'test data');

      // Verify file exists
      const stats = await fs.stat(tempFile.path);
      expect(stats.isFile()).toBe(true);

      // Cleanup
      await tempFile.cleanup();

      // Verify file is deleted
      await expect(fs.stat(tempFile.path)).rejects.toThrow();

      await allocator.destroy();
    });
  });
});
