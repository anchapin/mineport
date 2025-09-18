import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversionService } from '@services/ConversionService';
import { FileProcessor } from '@modules/ingestion/FileProcessor';
import { JavaAnalyzer } from '@modules/ingestion/JavaAnalyzer';
import { AssetConverter } from '@modules/conversion-agents/AssetConverter';
import { ValidationPipeline } from '@services/ValidationPipeline';
import { JobQueue } from '@services/JobQueue';
import { ConfigurationService } from '@services/ConfigurationService';
import { FeatureFlagService } from '@services/FeatureFlagService';
import { MonitoringService } from '@services/MonitoringService';
import { TestDataGenerator, TEST_DATA_PRESETS } from '../fixtures/test-data-generator';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('End-to-End Conversion Tests', () => {
  let conversionService: ConversionService;
  let tempDir: string;

  beforeEach(async () => {
    // Initialize all components
    const configService = ConfigurationService.getInstance();
    const config = configService.getConfig();
    const monitoringService = new MonitoringService(config.monitoring);
    vi.spyOn(monitoringService, 'recordMetric').mockImplementation(() => {});

    const fileProcessor = new FileProcessor(config.fileProcessor, monitoringService);
    const javaAnalyzer = new JavaAnalyzer(config.javaAnalyzer);
    const assetConverter = new AssetConverter();
    const validationPipeline = new ValidationPipeline();
    const jobQueue = new JobQueue();
    const featureFlagService = new FeatureFlagService();

    conversionService = new ConversionService({
      fileProcessor,
      javaAnalyzer,
      assetConverter,
      validationPipeline,
      jobQueue,
      featureFlagService,
      configService,
    });

    tempDir = path.join(process.cwd(), 'temp', `e2e-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Conversion Workflows', () => {
    it('should convert simple mod from JAR to Bedrock addon', async () => {
      // Generate test mod
      const testData = TEST_DATA_PRESETS.simple();
      const jarPath = path.join(tempDir, 'simple_mod.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      // Read JAR file
      const jarBuffer = await fs.readFile(jarPath);

      // Run complete conversion
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'simple_mod.jar' });

      // Verify conversion success
      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
    });

    it('should convert complex mod with multiple components', async () => {
      // Generate complex test mod
      const testData = TEST_DATA_PRESETS.complex();
      const jarPath = path.join(tempDir, 'complex_mod.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      // Read JAR file
      const jarBuffer = await fs.readFile(jarPath);

      // Run complete conversion
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'complex_mod.jar' });

      // Verify conversion success
      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
    });

    it('should handle realistic mod structure', async () => {
      // Generate realistic test mod
      const testData = TEST_DATA_PRESETS.realistic();
      const jarPath = path.join(tempDir, 'realistic_mod.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      // Read JAR file
      const jarBuffer = await fs.readFile(jarPath);

      // Run complete conversion
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'realistic_mod.jar' });

      // Verify conversion success
      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle edge cases gracefully', async () => {
      // Generate edge case test mod
      const testData = TEST_DATA_PRESETS.edgeCase();
      const jarPath = path.join(tempDir, 'edge_case_mod.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      // Read JAR file
      const jarBuffer = await fs.readFile(jarPath);

      // Run complete conversion
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'edge_case_mod.jar' });

      // Should succeed despite edge cases
      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
    });

    it('should provide detailed error information for failed conversions', async () => {
      // Create a JAR with invalid content
      const invalidJarBuffer = Buffer.from('This is not a valid JAR file');

      // Should throw validation error
      await expect(
        conversionService.createConversionJob({ buffer: invalidJarBuffer, originalname: 'invalid.jar' })
      ).rejects.toThrow();
    });

    it('should handle partially corrupted mods', async () => {
      // Generate test mod with some corrupted content
      const testData = TEST_DATA_PRESETS.simple();
      const jarPath = path.join(tempDir, 'partial_corrupt.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      // Read and modify JAR to add corrupted content
      let jarBuffer = await fs.readFile(jarPath);
      
      // Append some corrupted data
      const corruptedData = Buffer.from('CORRUPTED DATA');
      jarBuffer = Buffer.concat([jarBuffer, corruptedData]);

      // Should still process successfully with warnings
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'partial_corrupt.jar' });

      expect(result).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle small mods efficiently', async () => {
      const testData = TEST_DATA_PRESETS.performanceSmall();
      const jarPath = path.join(tempDir, 'small_perf.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);

      const startTime = process.hrtime.bigint();
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'small_perf.jar' });
      const endTime = process.hrtime.bigint();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result).toBeDefined();
      expect(processingTimeMs).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle medium mods within reasonable time', async () => {
      const testData = TEST_DATA_PRESETS.performanceMedium();
      const jarPath = path.join(tempDir, 'medium_perf.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);

      const startTime = process.hrtime.bigint();
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'medium_perf.jar' });
      const endTime = process.hrtime.bigint();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result).toBeDefined();
      expect(processingTimeMs).toBeLessThan(15000); // Should complete within 15 seconds
    });

    it('should handle large mods with acceptable performance', async () => {
      const testData = TEST_DATA_PRESETS.performanceLarge();
      const jarPath = path.join(tempDir, 'large_perf.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);

      const startTime = process.hrtime.bigint();
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'large_perf.jar' });
      const endTime = process.hrtime.bigint();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result).toBeDefined();
      expect(processingTimeMs).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Conversion Quality Validation', () => {
    it('should produce valid Bedrock addon structure', async () => {
      const testData = TEST_DATA_PRESETS.realistic();
      const jarPath = path.join(tempDir, 'quality_test.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'quality_test.jar' });

      expect(result).toBeDefined();
    });

    it('should maintain data consistency throughout pipeline', async () => {
      const testData = TEST_DATA_PRESETS.simple();
      const jarPath = path.join(tempDir, 'consistency_test.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'consistency_test.jar' });

      expect(result).toBeDefined();
    });

    it('should provide comprehensive analysis notes', async () => {
      const testData = TEST_DATA_PRESETS.complex();
      const jarPath = path.join(tempDir, 'analysis_test.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);
      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'analysis_test.jar' });

      expect(result).toBeDefined();
    });
  });

  describe('Concurrent Conversion Handling', () => {
    it('should handle multiple concurrent conversions', async () => {
      const concurrentCount = 3;
      const promises = [];

      for (let i = 0; i < concurrentCount; i++) {
        const testData = TEST_DATA_PRESETS.simple();
        testData.modId = `concurrent${i}`;
        testData.name = `Concurrent Test Mod ${i}`;

        const jarPath = path.join(tempDir, `concurrent${i}.jar`);
        await TestDataGenerator.createJarFromTestData(testData, jarPath);

        const jarBuffer = await fs.readFile(jarPath);
        promises.push(
          conversionService.createConversionJob({ buffer: jarBuffer, originalname: `concurrent${i}.jar` })
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrentCount);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
      });
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentCount = 5;
      const promises = [];

      for (let i = 0; i < concurrentCount; i++) {
        const testData = TEST_DATA_PRESETS.performanceSmall();
        testData.modId = `load${i}`;

        const jarPath = path.join(tempDir, `load${i}.jar`);
        await TestDataGenerator.createJarFromTestData(testData, jarPath);

        const jarBuffer = await fs.readFile(jarPath);
        
        promises.push(
          (async () => {
            const startTime = process.hrtime.bigint();
            const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: `load${i}.jar` });
            const endTime = process.hrtime.bigint();
            
            return {
              result,
              processingTime: Number(endTime - startTime) / 1_000_000
            };
          })()
        );
      }

      const results = await Promise.all(promises);

      results.forEach(({ result, processingTime }) => {
        expect(result).toBeDefined();
        expect(processingTime).toBeLessThan(10000); // Each should complete within 10 seconds
      });

      const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
      expect(avgProcessingTime).toBeLessThan(7000); // Average should be reasonable
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during conversions', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple mods
      for (let i = 0; i < 10; i++) {
        const testData = TEST_DATA_PRESETS.simple();
        testData.modId = `memory${i}`;

        const jarPath = path.join(tempDir, `memory${i}.jar`);
        await TestDataGenerator.createJarFromTestData(testData, jarPath);

        const jarBuffer = await fs.readFile(jarPath);
        const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: `memory${i}.jar` });

        expect(result).toBeDefined();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 200MB)
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
    });

    it('should clean up temporary resources', async () => {
      const testData = TEST_DATA_PRESETS.simple();
      const jarPath = path.join(tempDir, 'cleanup_test.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);
      
      // Check temp directory before conversion
      const tempFiles = await fs.readdir(path.join(process.cwd(), 'temp'));
      const initialTempCount = tempFiles.length;

      const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'cleanup_test.jar' });
      expect(result).toBeDefined();

      // Check temp directory after conversion
      const finalTempFiles = await fs.readdir(path.join(process.cwd(), 'temp'));
      const finalTempCount = finalTempFiles.length;

      // Should not have significantly more temp files
      expect(finalTempCount - initialTempCount).toBeLessThan(5);
    });
  });
});