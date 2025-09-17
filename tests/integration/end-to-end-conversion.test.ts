import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversionService } from '@services/ConversionService';
import { FileProcessor } from '@modules/ingestion/FileProcessor';
import { JavaAnalyzer } from '@modules/ingestion/JavaAnalyzer';
import { AssetConverter } from '@modules/conversion-agents/AssetConverter';

import { ValidationPipeline } from '@services/ValidationPipeline';
import { TestDataGenerator, TEST_DATA_PRESETS } from '../fixtures/test-data-generator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('End-to-End Conversion Tests', () => {
  let conversionService: ConversionService;
  let tempDir: string;

  beforeEach(async () => {
    // Initialize all components
    const fileProcessor = new FileProcessor();
    const javaAnalyzer = new JavaAnalyzer();
    const assetConverter = new AssetConverter();
    const validationPipeline = new ValidationPipeline();

    conversionService = new ConversionService({
      fileProcessor,
      javaAnalyzer,
      assetConverter,
      validationPipeline,
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
      const result = await conversionService.processModFile(jarBuffer, 'simple_mod.jar');

      // Verify conversion success
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.validation?.isValid).toBe(true);

      // Verify extracted data
      expect(result.result?.modId).toBe(testData.modId);
      expect(result.result?.manifestInfo?.modName).toBe(testData.name);
      expect(result.result?.registryNames).toContain('test_block');
      expect(result.result?.registryNames).toContain('test_item');
      expect(result.result?.texturePaths?.length).toBeGreaterThan(0);

      // Verify no critical errors
      const criticalErrors =
        result.result?.analysisNotes?.filter((note) => note.type === 'error') || [];
      expect(criticalErrors).toHaveLength(0);
    });

    it('should convert complex mod with multiple components', async () => {
      // Generate complex test mod
      const testData = TEST_DATA_PRESETS.complex();
      const jarPath = path.join(tempDir, 'complex_mod.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      // Read JAR file
      const jarBuffer = await fs.readFile(jarPath);

      // Run complete conversion
      const result = await conversionService.processModFile(jarBuffer, 'complex_mod.jar');

      // Verify conversion success
      expect(result.success).toBe(true);
      expect(result.result?.modId).toBe(testData.modId);
      expect(result.result?.registryNames?.length).toBeGreaterThan(20); // Should find many registry names
      expect(result.result?.texturePaths?.length).toBeGreaterThan(20); // Should find many textures

      // Verify blocks and items were detected
      const blockNames =
        result.result?.registryNames?.filter((name) =>
          testData.blocks.some((block) => block.name.includes(name) || name.includes(block.name))
        ) || [];
      const itemNames =
        result.result?.registryNames?.filter((name) =>
          testData.items.some((item) => item.name.includes(name) || name.includes(item.name))
        ) || [];

      expect(blockNames.length).toBeGreaterThan(5);
      expect(itemNames.length).toBeGreaterThan(5);
    });

    it('should handle realistic mod structure', async () => {
      // Generate realistic test mod
      const testData = TEST_DATA_PRESETS.realistic();
      const jarPath = path.join(tempDir, 'realistic_mod.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      // Read JAR file
      const jarBuffer = await fs.readFile(jarPath);

      // Run complete conversion
      const result = await conversionService.processModFile(jarBuffer, 'realistic_mod.jar');

      // Verify conversion success
      expect(result.success).toBe(true);
      expect(result.result?.modId).toBe(testData.modId);

      // Verify specific realistic mod components
      expect(result.result?.registryNames).toContain('copper_ore');
      expect(result.result?.registryNames).toContain('copper_ingot');
      expect(result.result?.registryNames).toContain('copper_sword');

      // Verify textures were found
      expect(result.result?.texturePaths?.some((path) => path.includes('copper_ore'))).toBe(true);
      expect(result.result?.texturePaths?.some((path) => path.includes('copper_ingot'))).toBe(true);

      // Verify manifest information
      expect(result.result?.manifestInfo?.version).toBe(testData.version);
      expect(result.result?.manifestInfo?.author).toBe(testData.author);
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
      const result = await conversionService.processModFile(jarBuffer, 'edge_case_mod.jar');

      // Should succeed despite edge cases
      expect(result.success).toBe(true);
      expect(result.result?.modId).toBe(testData.modId);

      // Should have warnings about edge cases
      const warnings =
        result.result?.analysisNotes?.filter((note) => note.type === 'warning') || [];
      expect(warnings.length).toBeGreaterThan(0);

      // Should still extract some valid data
      expect(result.result?.registryNames?.length).toBeGreaterThan(0);
    });

    it('should provide detailed error information for failed conversions', async () => {
      // Create a JAR with invalid content
      const invalidJarBuffer = Buffer.from('This is not a valid JAR file');

      // Should throw validation error
      await expect(
        conversionService.processModFile(invalidJarBuffer, 'invalid.jar')
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
      const result = await conversionService.processModFile(jarBuffer, 'partial_corrupt.jar');

      expect(result.success).toBe(true);
      expect(result.result?.analysisNotes?.some((note) => note.type === 'warning')).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle small mods efficiently', async () => {
      const testData = TEST_DATA_PRESETS.performanceSmall();
      const jarPath = path.join(tempDir, 'small_perf.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);

      const startTime = process.hrtime.bigint();
      const result = await conversionService.processModFile(jarBuffer, 'small_perf.jar');
      const endTime = process.hrtime.bigint();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.success).toBe(true);
      expect(processingTimeMs).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.result?.registryNames?.length).toBeGreaterThan(15);
    });

    it('should handle medium mods within reasonable time', async () => {
      const testData = TEST_DATA_PRESETS.performanceMedium();
      const jarPath = path.join(tempDir, 'medium_perf.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);

      const startTime = process.hrtime.bigint();
      const result = await conversionService.processModFile(jarBuffer, 'medium_perf.jar');
      const endTime = process.hrtime.bigint();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.success).toBe(true);
      expect(processingTimeMs).toBeLessThan(15000); // Should complete within 15 seconds
      expect(result.result?.registryNames?.length).toBeGreaterThan(80);
    });

    it('should handle large mods with acceptable performance', async () => {
      const testData = TEST_DATA_PRESETS.performanceLarge();
      const jarPath = path.join(tempDir, 'large_perf.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);

      const startTime = process.hrtime.bigint();
      const result = await conversionService.processModFile(jarBuffer, 'large_perf.jar');
      const endTime = process.hrtime.bigint();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.success).toBe(true);
      expect(processingTimeMs).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.result?.registryNames?.length).toBeGreaterThan(300);
    });
  });

  describe('Conversion Quality Validation', () => {
    it('should produce valid Bedrock addon structure', async () => {
      const testData = TEST_DATA_PRESETS.realistic();
      const jarPath = path.join(tempDir, 'quality_test.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);
      const result = await conversionService.processModFile(jarBuffer, 'quality_test.jar');

      expect(result.success).toBe(true);
      expect(result.validation?.isValid).toBe(true);

      // Verify validation details
      expect(result.validation?.errors).toBeDefined();
      expect(result.validation?.errors).toHaveLength(0);

      // Should have minimal warnings
      expect(result.validation?.warnings?.length || 0).toBeLessThan(5);
    });

    it('should maintain data consistency throughout pipeline', async () => {
      const testData = TEST_DATA_PRESETS.simple();
      const jarPath = path.join(tempDir, 'consistency_test.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);
      const result = await conversionService.processModFile(jarBuffer, 'consistency_test.jar');

      expect(result.success).toBe(true);

      // Verify mod ID consistency
      expect(result.result?.modId).toBe(testData.modId);
      expect(result.result?.manifestInfo?.modId).toBe(testData.modId);

      // Verify registry names match expected blocks/items
      testData.blocks.forEach((block) => {
        expect(result.result?.registryNames).toContain(block.name);
      });
      testData.items.forEach((item) => {
        expect(result.result?.registryNames).toContain(item.name);
      });

      // Verify texture paths are correctly formatted
      result.result?.texturePaths?.forEach((texturePath) => {
        expect(texturePath).toMatch(/^assets\/[^/]+\/textures\/(block|item|entity)\/[^/]+\.png$/);
      });
    });

    it('should provide comprehensive analysis notes', async () => {
      const testData = TEST_DATA_PRESETS.complex();
      const jarPath = path.join(tempDir, 'analysis_test.jar');
      await TestDataGenerator.createJarFromTestData(testData, jarPath);

      const jarBuffer = await fs.readFile(jarPath);
      const result = await conversionService.processModFile(jarBuffer, 'analysis_test.jar');

      expect(result.success).toBe(true);

      // Should have analysis notes
      expect(result.result?.analysisNotes?.length).toBeGreaterThan(0);

      // Should categorize notes properly
      const infoNotes = result.result?.analysisNotes?.filter((note) => note.type === 'info') || [];
      const errorNotes =
        result.result?.analysisNotes?.filter((note) => note.type === 'error') || [];

      expect(infoNotes.length).toBeGreaterThan(0);
      // Should have minimal errors for valid mod
      expect(errorNotes.length).toBeLessThan(3);

      // Notes should have helpful messages
      result.result?.analysisNotes?.forEach((note) => {
        expect(note.message).toBeDefined();
        expect(note.message.length).toBeGreaterThan(10);
      });
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
        promises.push(conversionService.processModFile(jarBuffer, `concurrent${i}.jar`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrentCount);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.result?.modId).toBe(`concurrent${index}`);
        expect(result.result?.registryNames).toContain('test_block');
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
            const result = await conversionService.processModFile(jarBuffer, `load${i}.jar`);
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
        expect(result.success).toBe(true);
        expect(processingTime).toBeLessThan(10000); // Each should complete within 10 seconds
      });

      const avgProcessingTime =
        results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
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
        const result = await conversionService.processModFile(jarBuffer, `memory${i}.jar`);

        expect(result.success).toBe(true);
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

      const result = await conversionService.processModFile(jarBuffer, 'cleanup_test.jar');
      expect(result.success).toBe(true);

      // Check temp directory after conversion
      const finalTempFiles = await fs.readdir(path.join(process.cwd(), 'temp'));
      const finalTempCount = finalTempFiles.length;

      // Should not have significantly more temp files
      expect(finalTempCount - initialTempCount).toBeLessThan(5);
    });
  });
});
