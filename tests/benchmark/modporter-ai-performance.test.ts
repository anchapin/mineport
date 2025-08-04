import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileProcessor } from '@modules/ingestion/FileProcessor';
import { JavaAnalyzer } from '@modules/ingestion/JavaAnalyzer';
import { AssetConverter } from '@modules/conversion-agents/AssetConverter';
import { ValidationPipeline } from '@services/ValidationPipeline';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';

describe('ModPorter-AI Performance Tests', () => {
  let fileProcessor: FileProcessor;
  let javaAnalyzer: JavaAnalyzer;
  let assetConverter: AssetConverter;
  let validationPipeline: ValidationPipeline;
  let tempDir: string;

  beforeEach(async () => {
    fileProcessor = new FileProcessor();
    javaAnalyzer = new JavaAnalyzer();
    assetConverter = new AssetConverter();
    validationPipeline = new ValidationPipeline();
    tempDir = path.join(process.cwd(), 'temp', `perf-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Processing Performance', () => {
    it('should process small files quickly', async () => {
      const zip = new AdmZip();
      zip.addFile('test.txt', Buffer.from('small content'));
      const buffer = zip.toBuffer();

      const startTime = process.hrtime.bigint();
      const result = await fileProcessor.validateUpload(buffer, 'small.jar');
      const endTime = process.hrtime.bigint();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.isValid).toBe(true);
      expect(processingTimeMs).toBeLessThan(100); // Should complete within 100ms
    });

    it('should process medium files efficiently', async () => {
      const zip = new AdmZip();

      // Add 100 files with moderate content
      for (let i = 0; i < 100; i++) {
        zip.addFile(`file${i}.txt`, Buffer.from(`Content for file ${i}`.repeat(100)));
      }

      const buffer = zip.toBuffer();

      const startTime = process.hrtime.bigint();
      const result = await fileProcessor.validateUpload(buffer, 'medium.jar');
      const endTime = process.hrtime.bigint();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.isValid).toBe(true);
      expect(processingTimeMs).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle large files within acceptable time', async () => {
      const zip = new AdmZip();

      // Add 1000 files to create a larger archive
      for (let i = 0; i < 1000; i++) {
        zip.addFile(`assets/textures/block${i}.png`, Buffer.alloc(1024)); // 1KB each
      }

      const buffer = zip.toBuffer();

      const startTime = process.hrtime.bigint();
      const result = await fileProcessor.validateUpload(buffer, 'large.jar');
      const endTime = process.hrtime.bigint();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.isValid).toBe(true);
      expect(processingTimeMs).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const zip = new AdmZip();
        zip.addFile(`test${i}.txt`, Buffer.from(`Content ${i}`));
        const buffer = zip.toBuffer();

        promises.push(
          (async () => {
            const startTime = process.hrtime.bigint();
            const result = await fileProcessor.validateUpload(buffer, `test${i}.jar`);
            const endTime = process.hrtime.bigint();

            return {
              result,
              processingTime: Number(endTime - startTime) / 1_000_000,
            };
          })()
        );
      }

      const results = await Promise.all(promises);

      results.forEach(({ result, processingTime }) => {
        expect(result.isValid).toBe(true);
        expect(processingTime).toBeLessThan(1000); // Each should complete within 1 second
      });

      const avgProcessingTime =
        results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
      expect(avgProcessingTime).toBeLessThan(500); // Average should be under 500ms
    });
  });

  describe('Java Analysis Performance', () => {
    it('should analyze simple mods quickly', async () => {
      const zip = new AdmZip();

      const langData = {
        'block.testmod.simple_block': 'Simple Block',
        'item.testmod.simple_item': 'Simple Item',
      };

      zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));
      zip.addFile('assets/testmod/textures/block/simple_block.png', Buffer.alloc(256));

      const jarPath = path.join(tempDir, 'simple.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const startTime = process.hrtime.bigint();
      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);
      const endTime = process.hrtime.bigint();

      const analysisTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.registryNames).toHaveLength(2);
      expect(analysisTimeMs).toBeLessThan(500); // Should complete within 500ms
    });

    it('should analyze complex mods efficiently', async () => {
      const zip = new AdmZip();

      // Add many registry entries
      const langData: Record<string, string> = {};
      for (let i = 0; i < 200; i++) {
        langData[`block.testmod.block${i}`] = `Block ${i}`;
        langData[`item.testmod.item${i}`] = `Item ${i}`;
      }

      zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

      // Add many texture files
      for (let i = 0; i < 100; i++) {
        zip.addFile(`assets/testmod/textures/block/block${i}.png`, Buffer.alloc(512));
        zip.addFile(`assets/testmod/textures/item/item${i}.png`, Buffer.alloc(512));
      }

      // Add model files
      for (let i = 0; i < 50; i++) {
        const model = {
          parent: 'block/cube_all',
          textures: { all: `testmod:block/block${i}` },
        };
        zip.addFile(
          `assets/testmod/models/block/block${i}.json`,
          Buffer.from(JSON.stringify(model))
        );
      }

      const jarPath = path.join(tempDir, 'complex.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const startTime = process.hrtime.bigint();
      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);
      const endTime = process.hrtime.bigint();

      const analysisTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.registryNames.length).toBeGreaterThan(300);
      expect(result.texturePaths.length).toBeGreaterThan(150);
      expect(analysisTimeMs).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent analysis efficiently', async () => {
      const concurrentAnalyses = 5;
      const promises = [];

      for (let i = 0; i < concurrentAnalyses; i++) {
        const zip = new AdmZip();

        const langData = {
          [`block.testmod.concurrent_block${i}`]: `Concurrent Block ${i}`,
          [`item.testmod.concurrent_item${i}`]: `Concurrent Item ${i}`,
        };

        zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

        const jarPath = path.join(tempDir, `concurrent${i}.jar`);
        await fs.writeFile(jarPath, zip.toBuffer());

        promises.push(
          (async () => {
            const startTime = process.hrtime.bigint();
            const result = await javaAnalyzer.analyzeJarForMVP(jarPath);
            const endTime = process.hrtime.bigint();

            return {
              result,
              analysisTime: Number(endTime - startTime) / 1_000_000,
            };
          })()
        );
      }

      const results = await Promise.all(promises);

      results.forEach(({ result, analysisTime }, index) => {
        expect(result.registryNames).toContain(`concurrent_block${index}`);
        expect(analysisTime).toBeLessThan(2000); // Each should complete within 2 seconds
      });
    });
  });

  describe('Asset Conversion Performance', () => {
    it('should convert textures efficiently', async () => {
      const textureInfos = [];

      // Create test texture data
      for (let i = 0; i < 20; i++) {
        const texturePath = path.join(tempDir, `texture${i}.png`);
        // Create a simple 16x16 PNG-like buffer
        await fs.writeFile(texturePath, Buffer.alloc(256));

        textureInfos.push({
          path: texturePath,
          name: `texture${i}`,
          type: 'block' as const,
        });
      }

      const startTime = process.hrtime.bigint();
      const result = await assetConverter.convertTextures(textureInfos);
      const endTime = process.hrtime.bigint();

      const conversionTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.success).toBe(true);
      expect(result.convertedFiles).toHaveLength(20);
      expect(conversionTimeMs).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle large texture batches', async () => {
      const textureInfos = [];

      // Create many test textures
      for (let i = 0; i < 100; i++) {
        const texturePath = path.join(tempDir, `large_texture${i}.png`);
        await fs.writeFile(texturePath, Buffer.alloc(1024)); // Larger textures

        textureInfos.push({
          path: texturePath,
          name: `large_texture${i}`,
          type: i % 2 === 0 ? ('block' as const) : ('item' as const),
        });
      }

      const startTime = process.hrtime.bigint();
      const result = await assetConverter.convertTextures(textureInfos);
      const endTime = process.hrtime.bigint();

      const conversionTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.convertedFiles.length).toBeGreaterThan(80); // Allow for some failures
      expect(conversionTimeMs).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Validation Pipeline Performance', () => {
    it('should validate simple conversions quickly', async () => {
      const mockConversionInput = {
        modId: 'testmod',
        files: ['test.json'],
        assets: ['texture.png'],
      };

      const startTime = process.hrtime.bigint();
      const result = await validationPipeline.runValidation(mockConversionInput);
      const endTime = process.hrtime.bigint();

      const validationTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.passed).toBeDefined();
      expect(validationTimeMs).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle complex validations efficiently', async () => {
      const mockConversionInput = {
        modId: 'complexmod',
        files: Array.from({ length: 100 }, (_, i) => `file${i}.json`),
        assets: Array.from({ length: 50 }, (_, i) => `texture${i}.png`),
      };

      const startTime = process.hrtime.bigint();
      const result = await validationPipeline.runValidation(mockConversionInput);
      const endTime = process.hrtime.bigint();

      const validationTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.passed).toBeDefined();
      expect(validationTimeMs).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during file processing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process many files
      for (let i = 0; i < 100; i++) {
        const zip = new AdmZip();
        zip.addFile(`test${i}.txt`, Buffer.from(`Content ${i}`));
        const buffer = zip.toBuffer();

        await fileProcessor.validateUpload(buffer, `test${i}.jar`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should handle memory efficiently during analysis', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Analyze multiple JARs
      for (let i = 0; i < 20; i++) {
        const zip = new AdmZip();

        const langData: Record<string, string> = {};
        for (let j = 0; j < 50; j++) {
          langData[`block.testmod.block${i}_${j}`] = `Block ${i} ${j}`;
        }

        zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

        const jarPath = path.join(tempDir, `memory_test${i}.jar`);
        await fs.writeFile(jarPath, zip.toBuffer());

        await javaAnalyzer.analyzeJarForMVP(jarPath);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 150MB)
      expect(memoryIncrease).toBeLessThan(150 * 1024 * 1024);
    });
  });

  describe('Throughput Tests', () => {
    it('should maintain high throughput for file validation', async () => {
      const fileCount = 50;
      const files = [];

      // Prepare files
      for (let i = 0; i < fileCount; i++) {
        const zip = new AdmZip();
        zip.addFile(`test${i}.txt`, Buffer.from(`Content ${i}`));
        files.push({
          buffer: zip.toBuffer(),
          filename: `test${i}.jar`,
        });
      }

      const startTime = process.hrtime.bigint();

      // Process all files
      const results = await Promise.all(
        files.map((file) => fileProcessor.validateUpload(file.buffer, file.filename))
      );

      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1_000_000;

      const throughput = fileCount / (totalTimeMs / 1000); // files per second

      expect(results).toHaveLength(fileCount);
      expect(throughput).toBeGreaterThan(10); // Should process at least 10 files per second
    });

    it('should maintain throughput for analysis operations', async () => {
      const jarCount = 20;
      const jarPaths = [];

      // Prepare JAR files
      for (let i = 0; i < jarCount; i++) {
        const zip = new AdmZip();

        const langData = {
          [`block.testmod.throughput_block${i}`]: `Throughput Block ${i}`,
          [`item.testmod.throughput_item${i}`]: `Throughput Item ${i}`,
        };

        zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

        const jarPath = path.join(tempDir, `throughput${i}.jar`);
        await fs.writeFile(jarPath, zip.toBuffer());
        jarPaths.push(jarPath);
      }

      const startTime = process.hrtime.bigint();

      // Analyze all JARs
      const results = await Promise.all(
        jarPaths.map((jarPath) => javaAnalyzer.analyzeJarForMVP(jarPath))
      );

      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1_000_000;

      const throughput = jarCount / (totalTimeMs / 1000); // analyses per second

      expect(results).toHaveLength(jarCount);
      expect(throughput).toBeGreaterThan(2); // Should analyze at least 2 JARs per second
    });
  });
});
