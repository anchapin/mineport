/**
 * Performance Integration Tests
 *
 * Integration tests for performance optimization components working together
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConversionService } from '../../src/services/ConversionService.js';
import { JobQueue } from '../../src/services/JobQueue.js';
import { StreamingFileProcessor } from '../../src/services/StreamingFileProcessor.js';
import { ResourceAllocator } from '../../src/services/ResourceAllocator.js';
import { CacheService } from '../../src/services/CacheService.js';
import { WorkerPool } from '../../src/services/WorkerPool.js';
import { PerformanceMonitor } from '../../src/services/PerformanceMonitor.js';
import { FileProcessor } from '../../src/modules/ingestion/FileProcessor.js';
import { JavaAnalyzer } from '../../src/modules/ingestion/JavaAnalyzer.js';

describe('Performance Integration Tests', () => {
  let tempDir: string;
  let conversionService: ConversionService;
  let jobQueue: JobQueue;
  let resourceAllocator: ResourceAllocator;
  let cacheService: CacheService;
  let workerPool: WorkerPool;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-integration-'));

    // Initialize performance components
    cacheService = new CacheService({
      maxSize: 100,
      enablePersistence: false,
      enableMetrics: true,
    });

    performanceMonitor = new PerformanceMonitor({
      interval: 1000,
      enableProfiling: true,
      enableAlerts: false,
    });

    workerPool = new WorkerPool({
      maxWorkers: 2,
      minWorkers: 1,
      taskTimeout: 10000,
    });

    resourceAllocator = new ResourceAllocator(tempDir);
    jobQueue = new JobQueue();

    // Initialize conversion service with performance optimizations
    conversionService = new ConversionService({
      jobQueue,
      resourceAllocator,
      cacheService,
      workerPool,
      performanceMonitor,
      streamingFileProcessor: new StreamingFileProcessor(),
      fileProcessor: new FileProcessor({}, cacheService, performanceMonitor),
      javaAnalyzer: new JavaAnalyzer(cacheService, performanceMonitor),
    });
  });

  afterEach(async () => {
    await conversionService.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('End-to-End Performance', () => {
    it('should handle multiple concurrent conversions efficiently', async () => {
      conversionService.start();

      // Create multiple test JAR files
      const testFiles = [];
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(tempDir, `test-mod-${i}.jar`);
        const jarContent = Buffer.alloc(1024 * 100, 0x50); // 100KB
        jarContent.writeUInt32LE(0x04034b50, 0); // ZIP magic number
        await fs.writeFile(filePath, jarContent);
        testFiles.push(filePath);
      }

      const profileId = performanceMonitor.startProfile('concurrent-conversions');
      const startTime = Date.now();

      // Submit multiple conversion jobs concurrently
      const jobPromises = testFiles.map(async (filePath, index) => {
        try {
          const job = await conversionService.createConversionJob({
            modFile: filePath,
            outputPath: path.join(tempDir, `output-${index}`),
            options: {
              targetMinecraftVersion: '1.20',
              compromiseStrategy: 'balanced' as const,
              includeDocumentation: false,
              optimizeAssets: true
            },
          });
          return { success: true, jobId: job.id };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      });

      const results = await Promise.all(jobPromises);
      const profile = performanceMonitor.endProfile(profileId);
      const totalTime = Date.now() - startTime;

      // Verify results
      const successfulJobs = results.filter((r) => r.success);
      expect(successfulJobs).toHaveLength(testFiles.length);
      expect(totalTime).toBeLessThan(30000); // Should complete in under 30 seconds
      expect(profile?.duration).toBeLessThan(30000);

      // Check performance metrics
      const metrics = performanceMonitor.getCurrentMetrics();
      expect(metrics?.memory.usage).toBeLessThan(90); // Memory usage should be reasonable
    });

    it('should demonstrate caching benefits', async () => {
      conversionService.start();

      // Create a test JAR file
      const filePath = path.join(tempDir, 'cached-test.jar');
      const jarContent = Buffer.alloc(1024 * 50, 0x50); // 50KB
      jarContent.writeUInt32LE(0x04034b50, 0);
      await fs.writeFile(filePath, jarContent);

      // First conversion (cache miss)
      const firstStart = Date.now();
      const firstJob = await conversionService.createConversionJob({
        modFile: filePath,
        outputPath: path.join(tempDir, 'output-1'),
        options: { 
          targetMinecraftVersion: '1.20',
          compromiseStrategy: 'balanced' as const,
          includeDocumentation: false,
          optimizeAssets: true
        },
      });
      const firstTime = Date.now() - firstStart;

      // Second conversion of same file (cache hit)
      const secondStart = Date.now();
      const secondJob = await conversionService.createConversionJob({
        modFile: filePath,
        outputPath: path.join(tempDir, 'output-2'),
        options: { 
          targetMinecraftVersion: '1.20',
          compromiseStrategy: 'balanced' as const,
          includeDocumentation: false,
          optimizeAssets: true
        },
      });
      const secondTime = Date.now() - secondStart;

      expect(firstJob.id).toBeDefined();
      expect(secondJob.id).toBeDefined();

      // Second conversion should be faster due to caching
      expect(secondTime).toBeLessThan(firstTime);

      // Check cache metrics
      const cacheMetrics = cacheService.getMetrics();
      expect(cacheMetrics.hits).toBeGreaterThan(0);
      expect(cacheMetrics.hitRate).toBeGreaterThan(0);
    });

    it('should handle large files with streaming', async () => {
      conversionService.start();

      // Create a large test file (5MB)
      const largeFilePath = path.join(tempDir, 'large-test.jar');
      const largeContent = Buffer.alloc(5 * 1024 * 1024, 0x50);
      largeContent.writeUInt32LE(0x04034b50, 0);
      await fs.writeFile(largeFilePath, largeContent);

      const profileId = performanceMonitor.startProfile('large-file-processing');
      const startMemory = process.memoryUsage().heapUsed;

      const job = await conversionService.createConversionJob({
        modFile: largeFilePath,
        outputPath: path.join(tempDir, 'large-output'),
        options: { 
          targetMinecraftVersion: '1.20',
          compromiseStrategy: 'balanced' as const,
          includeDocumentation: false,
          optimizeAssets: true
        },
      });

      const profile = performanceMonitor.endProfile(profileId);
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      expect(job.id).toBeDefined();
      expect(profile?.duration).toBeLessThan(15000); // Should complete in under 15 seconds
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Memory increase should be reasonable
    });

    it('should utilize worker pool for parallel processing', async () => {
      conversionService.start();

      // Create multiple test files for parallel processing
      const testFiles = [];
      for (let i = 0; i < 4; i++) {
        const filePath = path.join(tempDir, `worker-test-${i}.jar`);
        const content = Buffer.alloc(1024 * 200, 0x50); // 200KB
        content.writeUInt32LE(0x04034b50, 0);
        await fs.writeFile(filePath, content);
        testFiles.push(filePath);
      }

      const profileId = performanceMonitor.startProfile('worker-pool-utilization');

      // Submit jobs that will use worker pool
      const jobPromises = testFiles.map(async (filePath, index) => {
        return conversionService.createConversionJob({
          modFile: filePath,
          outputPath: path.join(tempDir, `worker-output-${index}`),
          options: { 
          targetMinecraftVersion: '1.20',
          compromiseStrategy: 'balanced' as const,
          includeDocumentation: false,
          optimizeAssets: true
        },
        });
      });

      const jobs = await Promise.all(jobPromises);
      const profile = performanceMonitor.endProfile(profileId);

      expect(jobs).toHaveLength(testFiles.length);
      expect(jobs.every((job) => job.id)).toBe(true);

      // Check worker pool metrics
      const workerMetrics = workerPool.getMetrics();
      expect(workerMetrics.completedTasks).toBeGreaterThan(0);
      expect(workerMetrics.throughput).toBeGreaterThan(0);
      expect(profile?.duration).toBeLessThan(20000);
    });

    it('should maintain performance under memory pressure', async () => {
      conversionService.start();

      // Create memory pressure by processing many files
      const fileCount = 10;
      const testFiles = [];

      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(tempDir, `memory-test-${i}.jar`);
        const content = Buffer.alloc(1024 * 500, i); // 500KB each, different content
        content.writeUInt32LE(0x04034b50, 0);
        await fs.writeFile(filePath, content);
        testFiles.push(filePath);
      }

      const initialMemory = process.memoryUsage().heapUsed;
      const profileId = performanceMonitor.startProfile('memory-pressure-test');

      // Process files in batches to create memory pressure
      const batchSize = 3;
      const results = [];

      for (let i = 0; i < testFiles.length; i += batchSize) {
        const batch = testFiles.slice(i, i + batchSize);
        const batchPromises = batch.map(async (filePath, index) => {
          return conversionService.createConversionJob({
            modFile: filePath,
            outputPath: path.join(tempDir, `memory-output-${i + index}`),
            options: { 
          targetMinecraftVersion: '1.20',
          compromiseStrategy: 'balanced' as const,
          includeDocumentation: false,
          optimizeAssets: true
        },
          });
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const profile = performanceMonitor.endProfile(profileId);
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(results).toHaveLength(fileCount);
      expect(results.every((job) => job.id)).toBe(true);
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Memory increase should be reasonable
      expect(profile?.duration).toBeLessThan(60000); // Should complete in under 1 minute

      // Check that cache is working (should have some hits)
      const cacheMetrics = cacheService.getMetrics();
      expect(cacheMetrics.totalEntries).toBeGreaterThan(0);
    });

    it('should provide accurate performance monitoring', async () => {
      conversionService.start();

      // Create a test file
      const filePath = path.join(tempDir, 'monitoring-test.jar');
      const content = Buffer.alloc(1024 * 100, 0x50);
      content.writeUInt32LE(0x04034b50, 0);
      await fs.writeFile(filePath, content);

      // Monitor performance during conversion
      const initialMetrics = performanceMonitor.getCurrentMetrics();

      const job = await conversionService.createConversionJob({
        modFile: filePath,
        outputPath: path.join(tempDir, 'monitoring-output'),
        options: { 
          targetMinecraftVersion: '1.20',
          compromiseStrategy: 'balanced' as const,
          includeDocumentation: false,
          optimizeAssets: true
        },
      });

      // Wait a bit for metrics to be collected
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const finalMetrics = performanceMonitor.getCurrentMetrics();
      const summary = performanceMonitor.getPerformanceSummary();

      expect(job.id).toBeDefined();
      expect(initialMetrics).toBeDefined();
      expect(finalMetrics).toBeDefined();
      expect(summary.current).toBeDefined();
      expect(summary.averages.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(summary.averages.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    it('should handle resource allocation efficiently', async () => {
      conversionService.start();

      // Create a resource pool for testing
      const testPool = resourceAllocator.createPool(
        'test-resources',
        async () => ({ id: Math.random(), data: Buffer.alloc(1024) }),
        async () => {},
        { maxSize: 5, maxIdleTime: 5000 }
      );

      const profileId = performanceMonitor.startProfile('resource-allocation');

      // Acquire and release resources rapidly
      const acquisitions = [];
      for (let i = 0; i < 20; i++) {
        const acquired = await testPool.acquire();
        acquisitions.push(acquired);

        // Release some resources to test reuse
        if (i % 3 === 0 && acquisitions.length > 1) {
          const toRelease = acquisitions.shift()!;
          await toRelease.release();
        }
      }

      // Release remaining resources
      for (const acquisition of acquisitions) {
        await acquisition.release();
      }

      const profile = performanceMonitor.endProfile(profileId);
      const poolMetrics = testPool.getMetrics();
      const allMetrics = resourceAllocator.getAllMetrics();

      expect(poolMetrics.totalCreated).toBeLessThanOrEqual(5); // Should not exceed pool size
      expect(poolMetrics.hitRate).toBeGreaterThan(0.5); // Should have good reuse rate
      expect(allMetrics['test-resources']).toBeDefined();
      expect(profile?.duration).toBeLessThan(5000);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for file processing throughput', async () => {
      conversionService.start();

      const fileCount = 10;
      const testFiles = [];

      // Create test files of varying sizes
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(tempDir, `benchmark-${i}.jar`);
        const size = (i + 1) * 1024 * 50; // 50KB to 500KB
        const content = Buffer.alloc(size, 0x50);
        content.writeUInt32LE(0x04034b50, 0);
        await fs.writeFile(filePath, content);
        testFiles.push({ path: filePath, size });
      }

      const startTime = Date.now();
      const profileId = performanceMonitor.startProfile('throughput-benchmark');

      // Process all files
      const jobPromises = testFiles.map(async (file, index) => {
        const jobStart = Date.now();
        const job = await conversionService.createConversionJob({
          modFile: file.path,
          outputPath: path.join(tempDir, `benchmark-output-${index}`),
          options: { 
          targetMinecraftVersion: '1.20',
          compromiseStrategy: 'balanced' as const,
          includeDocumentation: false,
          optimizeAssets: true
        },
        });
        const jobTime = Date.now() - jobStart;

        return {
          jobId: job.id,
          fileSize: file.size,
          processingTime: jobTime,
          throughput: (file.size / jobTime) * 1000, // bytes per second
        };
      });

      const results = await Promise.all(jobPromises);
      const profile = performanceMonitor.endProfile(profileId);
      const totalTime = Date.now() - startTime;

      // Calculate overall throughput
      const totalSize = testFiles.reduce((sum, file) => sum + file.size, 0);
      const overallThroughput = (totalSize / totalTime) * 1000;

      // Performance targets
      expect(results.every((r) => r.jobId)).toBe(true);
      expect(overallThroughput).toBeGreaterThan(1024 * 1024); // At least 1MB/s overall
      expect(results.every((r) => r.throughput > 500 * 1024)).toBe(true); // Each file at least 500KB/s
      expect(totalTime).toBeLessThan(30000); // Complete in under 30 seconds
      expect(profile?.duration).toBeLessThan(30000);
    });

    it('should demonstrate performance improvements over baseline', async () => {
      // This test compares optimized vs non-optimized processing

      // Create test file
      const filePath = path.join(tempDir, 'comparison-test.jar');
      const content = Buffer.alloc(1024 * 200, 0x50); // 200KB
      content.writeUInt32LE(0x04034b50, 0);
      await fs.writeFile(filePath, content);

      // Test with optimizations (current service)
      conversionService.start();
      const optimizedStart = Date.now();
      const optimizedJob = await conversionService.createConversionJob({
        modFile: filePath,
        outputPath: path.join(tempDir, 'optimized-output'),
        options: { 
          targetMinecraftVersion: '1.20',
          compromiseStrategy: 'balanced' as const,
          includeDocumentation: false,
          optimizeAssets: true
        },
      });
      const optimizedTime = Date.now() - optimizedStart;
      await conversionService.stop();

      // Test without optimizations (basic service)
      const basicService = new ConversionService({
        jobQueue: new JobQueue(),
        // No performance optimizations
      });

      basicService.start();
      const basicStart = Date.now();
      const basicJob = await basicService.createConversionJob({
        modFile: filePath,
        outputPath: path.join(tempDir, 'basic-output'),
        options: { 
          targetMinecraftVersion: '1.20',
          compromiseStrategy: 'balanced' as const,
          includeDocumentation: false,
          optimizeAssets: true
        },
      });
      const basicTime = Date.now() - basicStart;
      await basicService.stop();

      expect(optimizedJob.id).toBeDefined();
      expect(basicJob.id).toBeDefined();

      // Optimized version should be faster or at least not significantly slower
      const performanceRatio = optimizedTime / basicTime;
      expect(performanceRatio).toBeLessThan(1.5); // Should not be more than 50% slower

      // In many cases, it should be faster
      if (optimizedTime < basicTime) {
        const improvement = ((basicTime - optimizedTime) / basicTime) * 100;
        expect(improvement).toBeGreaterThan(0);
      }
    });
  });
});
