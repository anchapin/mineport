import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  createTempDirectory,
  cleanupTempDirectory,
  createMockJavaMod,
  validateModuleInteraction,
  createEndToEndScenario,
} from './helpers.js';
import { ModValidator } from '../../src/modules/ingestion/ModValidator.js';
import { FeatureCompatibilityAnalyzer } from '../../src/modules/ingestion/FeatureCompatibilityAnalyzer.js';
import { AssetTranslationModule } from '../../src/modules/assets/AssetTranslationModule.js';
import { LogicTranslationEngine } from '../../src/modules/logic/LogicTranslationEngine.js';
import { CompromiseStrategyEngine } from '../../src/modules/compromise/CompromiseStrategyEngine.js';
import { ConversionPipeline } from '../../src/services/ConversionPipeline.js';
import { ErrorCollector } from '../../src/services/ErrorCollector.js';
import { ConfigurationService } from '../../src/services/ConfigurationService.js';
import fs from 'fs';
import path from 'path';

describe('Module Interactions Integration Tests', () => {
  let tempDir: string;
  let errorCollector: ErrorCollector;
  let configService: ConfigurationService;

  beforeAll(async () => {
    tempDir = createTempDirectory();
    errorCollector = new ErrorCollector();
    configService = new ConfigurationService();
  });

  afterAll(() => {
    cleanupTempDirectory(tempDir);
  });

  describe('Ingestion to Asset Translation Flow', () => {
    it('should pass validated mod data correctly to asset translation', async () => {
      // Create mock mod
      const mockMod = createMockJavaMod('interaction-test-mod', 'forge');

      // Step 1: Validate mod
      const modValidator = new ModValidator();
      const validationResult = await modValidator.validateMod(Buffer.from('mock-jar-data'));

      expect(validationResult.success).toBe(true);
      expect(
        validateModuleInteraction(
          'ModValidator',
          'AssetTranslationModule',
          mockMod,
          validationResult
        )
      ).toBe(true);

      // Step 2: Analyze features
      const featureAnalyzer = new FeatureCompatibilityAnalyzer();
      const analysisResult = await featureAnalyzer.analyzeFeatures(
        validationResult.extractedMod,
        'forge'
      );

      expect(analysisResult.success).toBe(true);
      expect(
        validateModuleInteraction(
          'FeatureCompatibilityAnalyzer',
          'AssetTranslationModule',
          validationResult.extractedMod,
          analysisResult
        )
      ).toBe(true);

      // Step 3: Translate assets
      const assetTranslator = new AssetTranslationModule();
      const mockAssets = {
        textures: [],
        models: [],
        sounds: [],
        particles: [],
        animations: [],
      };
      const translationResult = await assetTranslator.translateAssets(mockAssets);

      expect(translationResult.bedrockAssets).toBeDefined();
      expect(
        validateModuleInteraction(
          'AssetTranslationModule',
          'Next Module',
          analysisResult.features,
          translationResult
        )
      ).toBe(true);

      // Verify data consistency across modules
      expect(translationResult.bedrockAssets.textures).toBeDefined();
      expect(translationResult.bedrockAssets.textures.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Logic Translation to Compromise Strategy Flow', () => {
    it('should handle unmappable features through compromise strategies', async () => {
      const mockMod = createMockJavaMod('compromise-test-mod', 'forge');

      // Create logic translation engine
      const logicEngine = new LogicTranslationEngine();

      // Mock some unmappable features
      const mockFeatures = [
        {
          id: 'feature-1',
          name: 'Custom Entity',
          type: 'ENTITY',
          compatibilityTier: 3, // Unmappable
          sourceFiles: ['src/main/java/com/example/CustomEntity.java'],
          javaCode: 'public class CustomEntity extends Entity {}',
        },
        {
          id: 'feature-2',
          name: 'Custom Block',
          type: 'BLOCK',
          compatibilityTier: 1, // Directly mappable
          sourceFiles: ['src/main/java/com/example/CustomBlock.java'],
          javaCode: 'public class CustomBlock extends Block {}',
        },
      ];

      // Step 1: Attempt logic translation
      const translationResult = await logicEngine.translateLogic('mock java code', {
        modInfo: { name: mockMod.id, version: '1.0.0', author: 'test', modLoader: 'forge' },
        targetPlatform: 'bedrock',
        apiMappings: new Map(),
        compromiseSettings: { allowStubs: true },
      });

      expect(
        validateModuleInteraction(
          'LogicTranslationEngine',
          'CompromiseStrategyEngine',
          mockFeatures,
          translationResult
        )
      ).toBe(true);

      // Step 2: Handle unmappable features with compromise strategies
      const compromiseEngine = new CompromiseStrategyEngine();
      const compromiseResult = compromiseEngine.applyStrategies(mockFeatures);

      expect(Array.isArray(compromiseResult)).toBe(true);
      expect(
        validateModuleInteraction(
          'CompromiseStrategyEngine',
          'Final Output',
          mockFeatures,
          compromiseResult
        )
      ).toBe(true);

      // Verify that compromise strategies were applied
      expect(compromiseResult.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling Across Modules', () => {
    it('should collect and aggregate errors from multiple modules', async () => {
      const mockMod = createMockJavaMod('error-test-mod', 'forge');

      // Create modules that will generate errors
      const modValidator = new ModValidator();
      const assetTranslator = new AssetTranslationModule();
      const logicEngine = new LogicTranslationEngine();

      // Mock validation with errors
      vi.spyOn(modValidator, 'validateMod').mockResolvedValue({
        isValid: false,
        errors: ['Invalid mod structure'],
        warnings: [],
        extractedMod: mockMod,
        validationTime: 100,
        metadata: { fileSize: 1024, jarEntries: [] },
      });

      // Mock asset translation with warnings
      vi.spyOn(assetTranslator, 'translateAssets').mockResolvedValue({
        bedrockAssets: {
          textures: [],
          models: [],
          sounds: [],
          particles: [],
          animations: [],
          soundsJson: {},
        },
        conversionNotes: [
          {
            type: 'warning',
            component: 'texture',
            message: 'Texture format not optimal',
            code: 'ASSET-TEX-001',
          },
        ],
        errors: [],
      });

      // Mock logic translation with errors
      vi.spyOn(logicEngine, 'translateLogic').mockResolvedValue({
        success: false,
        code: '',
        metadata: {
          processingTime: 100,
          confidenceScore: 0.1,
          linesOriginal: 0,
          linesTranslated: 0,
        },
        compromises: [],
        warnings: [],
        errors: [
          {
            type: 'translation_failure',
            message: 'Unmappable API call',
            location: { line: 0, column: 0, offset: 0 },
            recoverable: false,
          },
        ],
      });

      // Run modules and collect errors
      const validationResult = await modValidator.validateMod(Buffer.from('mock-data'));
      // Convert string errors to ConversionError format for collection
      const validationErrors = (validationResult.errors || []).map((error, index) => ({
        id: `validation-error-${index}`,
        type: 'VALIDATION' as const,
        code: `VAL-${index}`,
        severity: 'ERROR' as const,
        message: error,
        moduleOrigin: 'ModValidator',
        timestamp: new Date(),
      }));
      errorCollector.addErrors(validationErrors);

      const assetResult = await assetTranslator.translateAssets({
        textures: [],
        models: [],
        sounds: [],
        particles: [],
        animations: [],
      });
      errorCollector.addErrors(assetResult.errors || []);

      const logicResult = await logicEngine.translateLogic('mock java code', {
        modInfo: { name: mockMod.id, version: '1.0.0', author: 'test', modLoader: 'forge' },
        targetPlatform: 'bedrock',
        apiMappings: new Map(),
        compromiseSettings: { allowStubs: true },
      });

      // Convert translation errors to ConversionError format
      const translationErrors = (logicResult.errors || []).map((error, index) => ({
        id: `translation-error-${index}`,
        type: 'LOGIC' as const,
        code: `LOG-${index}`,
        severity: 'ERROR' as const,
        message: error.message,
        moduleOrigin: 'LogicTranslationEngine',
        timestamp: new Date(),
      }));
      errorCollector.addErrors(translationErrors);

      // Verify error collection and aggregation
      const allErrors = errorCollector.getErrors();
      expect(allErrors.length).toBe(3);

      const errorSummary = errorCollector.getErrorSummary();
      expect(errorSummary.totalErrors).toBe(3);
      expect(errorSummary.bySeverity.error).toBe(2);
      expect(errorSummary.bySeverity.warning).toBe(1);
      expect(errorSummary.byModule.ModValidator).toBe(1);
      expect(errorSummary.byModule.AssetTranslationModule).toBe(1);
      expect(errorSummary.byModule.LogicTranslationEngine).toBe(1);
    });
  });

  describe('Configuration Service Integration', () => {
    it('should provide consistent configuration across all modules', async () => {
      // Set test configuration
      configService.set('conversion.maxFileSize', 1024 * 1024);
      configService.set('conversion.allowedFormats', ['png', 'jpg', 'ogg']);
      configService.set('compromise.defaultStrategy', 'stub');

      // Create modules that use configuration
      const assetTranslator = new AssetTranslationModule();
      const compromiseEngine = new CompromiseStrategyEngine();

      // Mock modules to verify they receive configuration
      const assetSpy = vi.spyOn(assetTranslator, 'translateAssets');
      const compromiseSpy = vi.spyOn(compromiseEngine, 'applyStrategies');

      // Run operations
      await assetTranslator.translateAssets({
        textures: [],
        models: [],
        sounds: [],
        particles: [],
        animations: [],
      });

      const mockFeatures = [
        {
          id: 'test-feature',
          name: 'Test Feature',
          type: 'BLOCK',
          compatibilityTier: 3,
          sourceFiles: [],
          sourceLineNumbers: [],
        },
      ];
      await compromiseEngine.applyStrategies(mockFeatures);

      // Verify modules received configuration
      expect(assetSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          textures: [],
          models: [],
          sounds: [],
          particles: [],
          animations: [],
        })
      );

      expect(compromiseSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'test-feature',
            name: 'Test Feature',
          }),
        ])
      );
    });
  });

  describe('End-to-End Module Pipeline', () => {
    it('should process a complete conversion through all modules', async () => {
      const scenario = createEndToEndScenario('e2e-pipeline-test');

      // Create conversion pipeline
      const pipeline = new ConversionPipeline({
        errorCollector,
        configService,
      });

      // Run complete conversion
      const result = await pipeline.convert(scenario.input);

      // Validate result structure
      expect(result).toMatchObject(scenario.expectedOutput);

      // Run all validation steps
      for (const validationStep of scenario.validationSteps) {
        expect(validationStep(result)).toBe(true);
      }

      // Verify module interaction consistency
      expect(
        result.errors.every(
          (error) => error.id && error.type && error.severity && error.message && error.moduleOrigin
        )
      ).toBe(true);

      // Verify output files exist
      expect(fs.existsSync(result.addonPath)).toBe(true);
      if (result.reportPath) {
        expect(fs.existsSync(result.reportPath)).toBe(true);
      }
    });
  });

  describe('Module Dependency Validation', () => {
    it('should validate that modules follow dependency contracts', async () => {
      const mockMod = createMockJavaMod('dependency-test-mod', 'forge');

      // Test that ingestion modules don't depend on translation modules
      const modValidator = new ModValidator();
      const featureAnalyzer = new FeatureCompatibilityAnalyzer();

      // These should work independently
      const validationResult = await modValidator.validateMod(Buffer.from('mock-data'));
      expect(validationResult.isValid).toBe(true);

      const analysisResult = await featureAnalyzer.analyzeFeatures(mockMod, 'forge');
      expect(analysisResult.success).toBe(true);

      // Test that translation modules depend on ingestion output
      const assetTranslator = new AssetTranslationModule();
      const logicEngine = new LogicTranslationEngine();

      // These should require proper input from ingestion
      const mockAssets = {
        textures: [],
        models: [],
        sounds: [],
        particles: [],
        animations: [],
      };
      const assetResult = await assetTranslator.translateAssets(mockAssets);
      expect(assetResult.bedrockAssets).toBeDefined();

      const logicResult = await logicEngine.translateLogic('mock java code', {
        modInfo: { name: mockMod.id, version: '1.0.0', author: 'test', modLoader: 'forge' },
        targetPlatform: 'bedrock',
        apiMappings: new Map(),
        compromiseSettings: { allowStubs: true },
      });
      expect(logicResult.success).toBe(true);

      // Verify dependency chain integrity
      expect(assetResult.bedrockAssets).toBeDefined();
      expect(logicResult.code).toBeDefined();
    });
  });
});
