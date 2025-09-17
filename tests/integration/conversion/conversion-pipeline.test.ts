import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTempDirectory,
  cleanupTempDirectory,
  loadMockMod,
  validateModuleInteraction,
} from '../helpers.js';
import { AssetTranslationModule } from '../../../src/modules/assets/AssetTranslationModule.js';
import { LogicTranslationEngine } from '../../../src/modules/logic/LogicTranslationEngine.js';
import { ConversionPipeline } from '../../../src/services/ConversionPipeline.js';
import { ErrorCollector } from '../../../src/services/ErrorCollector.js';
import { ConfigurationService } from '../../../src/services/ConfigurationService.js';
import fs from 'fs';
import path from 'path';

describe('Conversion Pipeline Integration', () => {
  let tempDir: string;
  let mockMod: any;
  let extractPath: string;
  let errorCollector: ErrorCollector;
  let configService: ConfigurationService;
  let conversionPipeline: ConversionPipeline;

  beforeAll(async () => {
    // Create temporary directory
    tempDir = createTempDirectory();

    // Load mock mod from fixtures
    mockMod = loadMockMod('mock-forge-mod');

    // Create mod directory structure
    extractPath = path.join(tempDir, 'mock-forge-mod');
    fs.mkdirSync(extractPath, { recursive: true });

    // Create files from mock mod
    for (const [filePath, content] of Object.entries(mockMod.files)) {
      const fullPath = path.join(extractPath, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content as string);
    }

    // Create source code directory
    const sourceCodePath = path.join(tempDir, 'source-code');
    fs.mkdirSync(sourceCodePath, { recursive: true });

    // Create source files from mock mod
    for (const [filePath, content] of Object.entries(mockMod.sourceCode)) {
      const fullPath = path.join(sourceCodePath, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content as string);
    }

    // Initialize services
    errorCollector = new ErrorCollector();
    configService = new ConfigurationService();

    conversionPipeline = new ConversionPipeline({
      errorCollector,
      configService,
    });
  });

  afterAll(() => {
    // Clean up
    cleanupTempDirectory(tempDir);
  });

  it('should convert assets through unified module interface', async () => {
    // Create output directory for assets
    const outputDir = path.join(tempDir, 'output/assets');
    fs.mkdirSync(outputDir, { recursive: true });

    // Create mock Java assets for translation
    const mockJavaAssets = {
      textures: [
        {
          path: 'assets/mock-forge-mod/textures/block/custom_block.png',
          data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG header
          metadata: {
            animated: false,
          },
        },
      ],
      models: [
        {
          path: 'assets/mock-forge-mod/models/block/custom_block.json',
          data: { parent: 'block/cube_all', textures: { all: 'mock-forge-mod:block/custom_block' } },
          type: 'block' as const,
          metadata: {
            parent: 'block/cube_all',
            textures: { all: 'mock-forge-mod:block/custom_block' },
          },
        },
      ],
      sounds: [],
      particles: [],
      animations: [],
    };

    // Use unified asset translation module
    const assetTranslator = new AssetTranslationModule();
    const assetResult = await assetTranslator.translateAssets(mockJavaAssets);

    expect(assetResult.bedrockAssets).toBeDefined();
    expect(
      validateModuleInteraction('AssetTranslationModule', 'Output', mockJavaAssets, assetResult)
    ).toBe(true);
    expect(assetResult.bedrockAssets.textures.length).toBeGreaterThan(0);
    expect(assetResult.conversionNotes).toBeDefined();

    // Verify error handling consistency
    if (assetResult.errors && assetResult.errors.length > 0) {
      expect(
        assetResult.errors.every((error) => error.moduleOrigin.includes('ASSET'))
      ).toBe(true);
    }

    // Test asset organization
    await assetTranslator.organizeAssets(assetResult.bedrockAssets, outputDir);
    expect(fs.existsSync(outputDir)).toBe(true);
  });

  it('should process configuration through pipeline stages', async () => {
    // Create output directory for configuration
    const outputDir = path.join(tempDir, 'output/config');
    fs.mkdirSync(outputDir, { recursive: true });

    // Create mock configuration features
    const mockConfigFeatures = [
      {
        id: 'recipe-feature',
        name: 'Custom Recipe',
        type: 'RECIPE',
        compatibilityTier: 1,
        sourceFiles: ['data/mock-forge-mod/recipes/custom_recipe.json'],
        configData: {
          type: 'crafting_shaped',
          pattern: ['###', '# #', '###'],
          result: 'mock-forge-mod:custom_item',
        },
      },
      {
        id: 'block-feature',
        name: 'Custom Block Definition',
        type: 'BLOCK',
        compatibilityTier: 1,
        sourceFiles: ['src/main/java/com/example/mockmod/blocks/CustomBlock.java'],
        configData: {
          identifier: 'mock-forge-mod:custom_block',
          material: 'stone',
          hardness: 1.5,
        },
      },
    ];

    // Test pipeline stage interaction
    const stageInput = {
      features: mockConfigFeatures,
      outputDir,
      modId: 'mock-forge-mod',
      modMetadata: {
        name: 'Mock Forge Mod',
        version: '1.0.0',
        author: 'Test Author',
      },
    };

    // Process through configuration stage
    const configResult = await conversionPipeline.processConfigurationStage(stageInput);

    expect(configResult.success).toBe(true);
    expect(
      validateModuleInteraction(
        'ConversionPipeline',
        'ConfigurationStage',
        stageInput,
        configResult
      )
    ).toBe(true);
    expect(configResult.generatedFiles.length).toBeGreaterThan(0);

    // Verify manifest generation
    expect(configResult.manifests.behaviorPack).toBeDefined();
    expect(configResult.manifests.resourcePack).toBeDefined();

    // Verify error collection
    errorCollector.addErrors(configResult.errors || []);
    const errors = errorCollector.getErrors();
    expect(errors.every((error) => error.moduleOrigin.includes('Configuration'))).toBe(true);
  });

  it('should translate Java logic through unified engine', async () => {
    // Create output directory for scripts
    const outputDir = path.join(tempDir, 'output/scripts');
    fs.mkdirSync(outputDir, { recursive: true });

    // Create mock logic features from source code
    const mockLogicFeatures = Object.entries(mockMod.sourceCode)
      .filter(([filePath]) => filePath.endsWith('.java'))
      .map(([filePath, content], index) => ({
        id: `logic-feature-${index}`,
        name: `Java Class ${index}`,
        type: 'LOGIC',
        compatibilityTier: 1,
        sourceFiles: [filePath],
        javaCode: content as string,
        className: filePath.split('/').pop()?.replace('.java', '') || 'Unknown',
      }));

    // Use unified logic translation engine
    const logicEngine = new LogicTranslationEngine();
    const logicResult = await logicEngine.translateLogic(mockLogicFeatures, {
      modId: 'mock-forge-mod',
      apiMappings: [],
      outputDir,
    });

    expect(logicResult.success).toBe(true);
    expect(
      validateModuleInteraction('LogicTranslationEngine', 'Output', mockLogicFeatures, logicResult)
    ).toBe(true);
    expect(logicResult.translatedCode).toBeDefined();
    expect(logicResult.translatedCode.length).toBeGreaterThan(0);

    // Verify error handling and unmappable features
    if (logicResult.errors) {
      expect(
        logicResult.errors.every((error) => error.moduleOrigin === 'LogicTranslationEngine')
      ).toBe(true);
    }

    if (logicResult.unmappableFeatures) {
      expect(Array.isArray(logicResult.unmappableFeatures)).toBe(true);
    }

    // Write JavaScript code to output directory
    fs.writeFileSync(path.join(outputDir, 'main.js'), logicResult.translatedCode);

    // Verify the JavaScript file exists and has content
    expect(fs.existsSync(path.join(outputDir, 'main.js'))).toBe(true);
    const generatedCode = fs.readFileSync(path.join(outputDir, 'main.js'), 'utf8');
    expect(generatedCode.length).toBeGreaterThan(0);
  });

  it('should handle complete pipeline with error aggregation', async () => {
    // Create complete conversion input
    const conversionInput = {
      modFile: Buffer.from('mock mod content'),
      sourceRepository: {
        url: 'https://github.com/test/mock-forge-mod',
        branch: 'main',
      },
      preferences: {
        compromiseStrategies: {
          allowStubs: true,
          allowWarnings: true,
          allowSimplifications: true,
        },
        outputFormat: 'addon' as const,
        includeSourceCode: true,
      },
      metadata: {
        modId: 'mock-forge-mod',
        name: 'Mock Forge Mod',
        version: '1.0.0',
        author: 'Test Author',
        description: 'A mock Forge mod for testing',
      },
    };

    // Run complete pipeline
    const pipelineResult = await conversionPipeline.convert(conversionInput);

    expect(pipelineResult.success).toBe(true);
    expect(pipelineResult.modId).toBe('mock-forge-mod');
    expect(pipelineResult.addonPath).toBeDefined();

    // Verify error aggregation across all modules
    const allErrors = errorCollector.getErrors();
    const errorSummary = errorCollector.getErrorSummary();

    expect(errorSummary.totalErrors).toBeGreaterThanOrEqual(0);
    expect(Object.keys(errorSummary.byModule).length).toBeGreaterThan(0);

    // Verify all errors follow consistent format
    expect(
      allErrors.every(
        (error) => error.id && error.type && error.severity && error.message && error.moduleOrigin
      )
    ).toBe(true);

    // Verify output files exist
    expect(fs.existsSync(pipelineResult.addonPath)).toBe(true);
  });
});
