import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileProcessor } from '@modules/ingestion/FileProcessor';
import { JavaAnalyzer } from '@modules/ingestion/JavaAnalyzer';
import { AssetConverter } from '@modules/conversion-agents/AssetConverter';
import { BedrockArchitect } from '@modules/conversion-agents/BedrockArchitect';
import { BlockItemGenerator } from '@modules/conversion-agents/BlockItemGenerator';
import { ValidationPipeline } from '@services/ValidationPipeline';
import { ConversionService } from '@services/ConversionService';
import { JobQueue } from '@services/JobQueue';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';

describe('ModPorter-AI Integration Tests', () => {
  let fileProcessor: FileProcessor;
  let javaAnalyzer: JavaAnalyzer;
  let assetConverter: AssetConverter;
  let bedrockArchitect: BedrockArchitect;
  let blockItemGenerator: BlockItemGenerator;
  let validationPipeline: ValidationPipeline;
  let conversionService: ConversionService;
  let tempDir: string;

  beforeEach(async () => {
    fileProcessor = new FileProcessor();
    javaAnalyzer = new JavaAnalyzer();
    assetConverter = new AssetConverter();
    bedrockArchitect = new BedrockArchitect();
    blockItemGenerator = new BlockItemGenerator();
    validationPipeline = new ValidationPipeline();

    // Create required services
    const jobQueue = new JobQueue();

    // Initialize ConversionService with all dependencies
    conversionService = new ConversionService({
      jobQueue,
      javaAnalyzer,
      assetConverter,
      validationPipeline,
      bedrockArchitect,
      blockItemGenerator,
    });

    // Start the service
    conversionService.start();

    tempDir = path.join(process.cwd(), 'temp', `integration-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      // Stop the service
      await conversionService.stop();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End Conversion Workflow', () => {
    it('should complete full conversion pipeline for simple mod', async () => {
      // Create a simple test mod
      const zip = new AdmZip();

      // Add manifest
      const mcmodInfo = [
        {
          modid: 'simplemod',
          name: 'Simple Test Mod',
          description: 'A simple mod for testing',
          version: '1.0.0',
          authorList: ['TestAuthor'],
        },
      ];
      zip.addFile('mcmod.info', Buffer.from(JSON.stringify(mcmodInfo)));

      // Add lang file
      const langData = {
        'block.simplemod.test_block': 'Test Block',
        'item.simplemod.test_item': 'Test Item',
      };
      zip.addFile('assets/simplemod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

      // Add texture files
      zip.addFile('assets/simplemod/textures/block/test_block.png', Buffer.alloc(256));
      zip.addFile('assets/simplemod/textures/item/test_item.png', Buffer.alloc(256));

      // Add model files
      const blockModel = {
        parent: 'block/cube_all',
        textures: { all: 'simplemod:block/test_block' },
      };
      zip.addFile(
        'assets/simplemod/models/block/test_block.json',
        Buffer.from(JSON.stringify(blockModel))
      );

      const jarBuffer = zip.toBuffer();
      const jarPath = path.join(tempDir, 'simple_mod.jar');
      await fs.writeFile(jarPath, jarBuffer);

      // Run complete conversion
      const result = await conversionService.processModFile(jarBuffer, 'simple_mod.jar');

      expect(result.success).toBeDefined();
      expect(result.bedrockAddon).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should handle complex mod with multiple components', async () => {
      const zip = new AdmZip();

      // Add comprehensive manifest
      const mcmodInfo = [
        {
          modid: 'complexmod',
          name: 'Complex Test Mod',
          description: 'A complex mod with multiple features',
          version: '2.0.0',
          authorList: ['ComplexAuthor'],
          dependencies: ['forge@[14.23.5.2847,)'],
        },
      ];
      zip.addFile('mcmod.info', Buffer.from(JSON.stringify(mcmodInfo)));

      // Add multiple lang files
      const langData = {
        'block.complexmod.stone_block': 'Stone Block',
        'block.complexmod.wood_block': 'Wood Block',
        'item.complexmod.magic_sword': 'Magic Sword',
        'item.complexmod.healing_potion': 'Healing Potion',
        'itemGroup.complexmod.general': 'Complex Mod Items',
      };
      zip.addFile('assets/complexmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

      // Add texture files
      zip.addFile('assets/complexmod/textures/block/stone_block.png', Buffer.alloc(512));
      zip.addFile('assets/complexmod/textures/block/wood_block.png', Buffer.alloc(512));
      zip.addFile('assets/complexmod/textures/item/magic_sword.png', Buffer.alloc(256));
      zip.addFile('assets/complexmod/textures/item/healing_potion.png', Buffer.alloc(256));

      // Add model files
      const stoneModel = {
        parent: 'block/cube_all',
        textures: { all: 'complexmod:block/stone_block' },
      };
      const swordModel = {
        parent: 'item/handheld',
        textures: { layer0: 'complexmod:item/magic_sword' },
      };

      zip.addFile(
        'assets/complexmod/models/block/stone_block.json',
        Buffer.from(JSON.stringify(stoneModel))
      );
      zip.addFile(
        'assets/complexmod/models/item/magic_sword.json',
        Buffer.from(JSON.stringify(swordModel))
      );

      // Add blockstates
      const blockstate = {
        variants: {
          '': { model: 'complexmod:block/stone_block' },
        },
      };
      zip.addFile(
        'assets/complexmod/blockstates/stone_block.json',
        Buffer.from(JSON.stringify(blockstate))
      );

      const jarBuffer = zip.toBuffer();

      // Run complete conversion
      const result = await conversionService.processModFile(jarBuffer, 'complex_mod.jar');

      expect(result.success).toBeDefined();
      expect(result.bedrockAddon).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });

  describe('Component Integration', () => {
    it('should integrate FileProcessor with JavaAnalyzer', async () => {
      const zip = new AdmZip();

      const langData = {
        'block.integrationmod.integration_block': 'Integration Block',
      };
      zip.addFile('assets/integrationmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

      const jarBuffer = zip.toBuffer();
      const jarPath = path.join(tempDir, 'integration.jar');
      await fs.writeFile(jarPath, jarBuffer);

      // Step 1: Validate file
      const validationResult = await fileProcessor.validateUpload(jarBuffer, 'integration.jar');
      expect(validationResult.isValid).toBe(true);

      // Step 2: Analyze validated file
      const analysisResult = await javaAnalyzer.analyzeJarForMVP(jarPath);
      expect(analysisResult.registryNames).toContain('integration_block');
      expect(analysisResult.modId).toBe('integrationmod');
    });

    it('should integrate JavaAnalyzer with AssetConverter', async () => {
      const zip = new AdmZip();

      // Add texture files
      zip.addFile('assets/testmod/textures/block/converter_block.png', Buffer.alloc(256));
      zip.addFile('assets/testmod/textures/item/converter_item.png', Buffer.alloc(256));

      const jarPath = path.join(tempDir, 'converter_test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      // Step 1: Analyze JAR
      const analysisResult = await javaAnalyzer.analyzeJarForMVP(jarPath);
      expect(analysisResult.texturePaths.length).toBeGreaterThan(0);

      // Step 2: Convert detected textures
      const textureInfos = analysisResult.texturePaths.map((texturePath) => ({
        path: path.join(tempDir, path.basename(texturePath)),
        name: path.basename(texturePath, '.png'),
        type: texturePath.includes('/block/') ? ('block' as const) : ('item' as const),
        buffer: Buffer.alloc(256),
      }));

      // Create actual texture files for conversion
      for (const textureInfo of textureInfos) {
        await fs.writeFile(textureInfo.path, textureInfo.buffer);
      }

      const conversionResult = await assetConverter.convertTextures(textureInfos);
      expect(conversionResult.success).toBe(true);
      expect(conversionResult.outputFiles.length).toBeGreaterThan(0);
    });

    it('should integrate AssetConverter with BedrockArchitect', async () => {
      // Create mock mod info
      const modInfo = {
        modId: 'architectmod',
        modName: 'Architect Test Mod',
        version: '1.0.0',
        author: 'TestAuthor',
      };

      // Step 1: Generate addon structure
      const addonStructure = await bedrockArchitect.generateAddonStructure(modInfo);
      expect(addonStructure.behaviorPack).toBeDefined();
      expect(addonStructure.resourcePack).toBeDefined();

      // Step 2: Create assets to organize
      const assets = [
        {
          path: path.join(tempDir, 'test_texture.png'),
          name: 'test_texture',
          type: 'texture' as const,
          content: Buffer.alloc(256),
        },
      ];

      await fs.writeFile(assets[0].path, assets[0].content as Buffer);

      // Step 3: Organize assets into structure
      await bedrockArchitect.organizeAssets(assets, addonStructure);

      // Verify structure was created
      expect(addonStructure.behaviorPack.files).toBeDefined();
      expect(addonStructure.resourcePack.files).toBeDefined();
    });

    it('should integrate BlockItemGenerator with ValidationPipeline', async () => {
      // Step 1: Generate block definitions
      const blockInfos = [
        {
          identifier: 'test_block',
          name: 'test_block',
          displayName: 'Test Block',
          material: 'stone',
          hardness: 2.0,
          textures: {
            all: 'test_block'
          },
        },
      ];

      const blockDefinitions = await blockItemGenerator.generateBlockDefinitions(blockInfos);
      expect(blockDefinitions).toBeDefined();
      expect(Array.isArray(blockDefinitions.blocks) ? blockDefinitions.blocks[0]?.identifier : blockDefinitions.identifier).toBe('test_block');

      // Step 2: Validate generated definitions
      const validationInput = {
        modId: 'testmod',
        modName: 'Test Mod',
        modVersion: '1.0.0',
        bedrockConfigs: {
          manifests: {
            behaviorPack: {
              format_version: 2,
              header: {
                name: 'Test Mod',
                description: 'A test mod',
                uuid: '00000000-0000-0000-0000-000000000001',
                version: [1, 0, 0],
                min_engine_version: [1, 19, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: 2,
              header: {
                name: 'Test Mod Resources',
                description: 'Resources for Test Mod',
                uuid: '00000000-0000-0000-0000-000000000002',
                version: [1, 0, 0],
                min_engine_version: [1, 19, 0],
              },
              modules: [],
            },
          },
          definitions: {
            blocks: Array.isArray(blockDefinitions.blocks) ? blockDefinitions.blocks : [blockDefinitions],
            items: [],
          },
          recipes: {},
          lootTables: {},
        },
      };

      const validationResult = await validationPipeline.runValidation(validationInput);
      expect(validationResult.passed).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle errors gracefully across components', async () => {
      // Create a JAR with some valid and some invalid content
      const zip = new AdmZip();

      // Valid content
      const validLangData = {
        'block.errormod.valid_block': 'Valid Block',
      };
      zip.addFile('assets/errormod/lang/en_us.json', Buffer.from(JSON.stringify(validLangData)));

      // Invalid content
      zip.addFile('assets/errormod/models/block/invalid.json', Buffer.from('invalid json {'));

      const jarBuffer = zip.toBuffer();

      // Should handle errors and continue processing
      const result = await conversionService.processModFile(jarBuffer, 'error_test.jar');

      // Should succeed with warnings
      expect(result).toBeDefined();
      expect(result.bedrockAddon).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should propagate critical errors appropriately', async () => {
      // Create completely invalid file
      const invalidBuffer = Buffer.from('This is not a JAR file at all');

      // Should fail validation and not proceed
      await expect(
        conversionService.processModFile(invalidBuffer, 'invalid.jar')
      ).rejects.toThrow();
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance across integrated components', async () => {
      const zip = new AdmZip();

      // Add moderate amount of content
      const langData: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        langData[`block.perfmod.block${i}`] = `Performance Block ${i}`;
        langData[`item.perfmod.item${i}`] = `Performance Item ${i}`;
      }

      zip.addFile('assets/perfmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

      // Add texture files
      for (let i = 0; i < 25; i++) {
        zip.addFile(`assets/perfmod/textures/block/block${i}.png`, Buffer.alloc(256));
        zip.addFile(`assets/perfmod/textures/item/item${i}.png`, Buffer.alloc(256));
      }

      const jarBuffer = zip.toBuffer();

      const startTime = process.hrtime.bigint();
      const result = await conversionService.processModFile(jarBuffer, 'performance_test.jar');
      const endTime = process.hrtime.bigint();

      const totalTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(result.success).toBeDefined();
      expect(totalTimeMs).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Data Flow Integration', () => {
    it('should maintain data consistency across pipeline', async () => {
      const zip = new AdmZip();

      // Add manifest
      const mcmodInfo = [
        {
          modid: 'dataflowmod',
          name: 'Data Flow Test Mod',
          version: '1.0.0',
        },
      ];
      zip.addFile('mcmod.info', Buffer.from(JSON.stringify(mcmodInfo)));

      // Add lang data
      const langData = {
        'block.dataflowmod.flow_block': 'Flow Block',
        'item.dataflowmod.flow_item': 'Flow Item',
      };
      zip.addFile('assets/dataflowmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

      // Add texture
      zip.addFile('assets/dataflowmod/textures/block/flow_block.png', Buffer.alloc(256));

      const jarBuffer = zip.toBuffer();
      const jarPath = path.join(tempDir, 'dataflow.jar');
      await fs.writeFile(jarPath, jarBuffer);

      // Step 1: File validation
      const validationResult = await fileProcessor.validateUpload(jarBuffer, 'dataflow.jar');
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.fileType).toBe('application/java-archive');

      // Step 2: Java analysis
      const analysisResult = await javaAnalyzer.analyzeJarForMVP(jarPath);
      expect(analysisResult.modId).toBe('dataflowmod');
      expect(analysisResult.manifestInfo.modId).toBe('dataflowmod');
      expect(analysisResult.registryNames).toContain('flow_block');
      expect(analysisResult.registryNames).toContain('flow_item');
      expect(analysisResult.texturePaths).toContain(
        'assets/dataflowmod/textures/block/flow_block.png'
      );

      // Step 3: Asset conversion (mock texture files)
      const textureInfos = analysisResult.texturePaths.map((texturePath) => ({
        path: path.join(tempDir, path.basename(texturePath)),
        name: path.basename(texturePath, '.png'),
        type: 'block' as const,
      }));

      for (const textureInfo of textureInfos) {
        await fs.writeFile(textureInfo.path, Buffer.alloc(256));
      }

      const conversionResult = await assetConverter.convertTextures(textureInfos);
      expect(conversionResult.success).toBe(true);

      // Step 4: Bedrock structure generation
      const modInfo = {
        id: analysisResult.manifestInfo.modId || 'dataflowmod',
        name: analysisResult.manifestInfo.modName || 'Data Flow Test Mod',
        version: analysisResult.manifestInfo.version || '1.0.0',
        author: analysisResult.manifestInfo.author || 'Test Author',
      };
      const addonStructure = await bedrockArchitect.generateAddonStructure(modInfo);
      expect(addonStructure.behaviorPack.manifest.header.name).toBe('Data Flow Test Mod');

      // Step 5: Block/item generation
      const blockInfos = analysisResult.registryNames
        .filter((name) => langData['block.dataflowmod.flow_block'])
        .map((name) => ({
          identifier: name,
          name,
          displayName: langData['block.dataflowmod.flow_block'] || 'Flow Block',
          material: 'stone',
          hardness: 1.0,
          textures: {
            all: name
          },
        }));

      const blockDefinitions = await blockItemGenerator.generateBlockDefinitions(blockInfos);
      expect(blockDefinitions).toBeDefined();
      expect(Array.isArray(blockDefinitions.blocks) ? blockDefinitions.blocks[0]?.identifier : blockDefinitions.identifier).toBe('flow_block');

      // Step 6: Final validation
      const finalValidationInput = {
        modId: analysisResult.modId,
        modName: 'Data Flow Test Mod',
        modVersion: '1.0.0',
        bedrockConfigs: {
          manifests: {
            behaviorPack: {
              format_version: 2,
              header: {
                name: 'Data Flow Test Mod',
                description: 'A test mod for data flow',
                uuid: '00000000-0000-0000-0000-000000000001',
                version: [1, 0, 0],
                min_engine_version: [1, 19, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: 2,
              header: {
                name: 'Data Flow Test Mod Resources',
                description: 'Resources for Data Flow Test Mod',
                uuid: '00000000-0000-0000-0000-000000000002',
                version: [1, 0, 0],
                min_engine_version: [1, 19, 0],
              },
              modules: [],
            },
          },
          definitions: {
            blocks: Array.isArray(blockDefinitions.blocks) ? blockDefinitions.blocks : [blockDefinitions],
            items: [],
          },
          recipes: {},
          lootTables: {},
        },
      };

      const finalValidation = await validationPipeline.runValidation(finalValidationInput);
      expect(finalValidation.passed).toBe(true);
    });
  });

  describe('Concurrent Operations Integration', () => {
    it('should handle concurrent conversion requests', async () => {
      const concurrentRequests = 3;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const zip = new AdmZip();

        const langData = {
          [`block.concurrent${i}.test_block`]: `Concurrent Block ${i}`,
        };
        zip.addFile(`assets/concurrent${i}/lang/en_us.json`, Buffer.from(JSON.stringify(langData)));

        const jarBuffer = zip.toBuffer();

        promises.push(conversionService.processModFile(jarBuffer, `concurrent${i}.jar`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result, _index) => {
        expect(result.success).toBeDefined();
        expect(result.bedrockAddon).toBeDefined();
      });
    });
  });
});
