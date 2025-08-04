import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  createTempDirectory,
  cleanupTempDirectory,
  createMockJavaMod,
  createMockConversionInput,
  createMockConversionErrors,
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
      const validationResult = await modValidator.validateMod(mockMod);

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
      const analysisResult = await featureAnalyzer.analyzeFeatures(validationResult.extractedMod);

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
      const translationResult = await assetTranslator.translateAssets(
        analysisResult.features,
        path.join(tempDir, 'assets'),
        { modId: mockMod.id }
      );

      expect(translationResult.success).toBe(true);
      expect(
        validateModuleInteraction(
          'AssetTranslationModule',
          'Next Module',
          analysisResult.features,
          translationResult
        )
      ).toBe(true);

      // Verify data consistency across modules
      expect(translationResult.modId).toBe(mockMod.id);
      expect(translationResult.assets.length).toBeGreaterThan(0);
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
      const translationResult = await logicEngine.translateLogic(mockFeatures, {
        modId: mockMod.id,
        apiMappings: [],
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
      const compromiseResult = await compromiseEngine.applyStrategies(
        translationResult.unmappableFeatures,
        {
          allowStubs: true,
          allowWarnings: true,
          allowSimplifications: true,
        }
      );

      expect(compromiseResult.success).toBe(true);
      expect(
        validateModuleInteraction(
          'CompromiseStrategyEngine',
          'Final Output',
          translationResult.unmappableFeatures,
          compromiseResult
        )
      ).toBe(true);

      // Verify that compromise strategies were applied
      expect(compromiseResult.appliedStrategies.length).toBeGreaterThan(0);
      expect(compromiseResult.generatedCode).toBeDefined();
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
        success: false,
        errors: [
          {
            id: 'validation-error-1',
            type: 'validation',
            severity: 'error',
            message: 'Invalid mod structure',
            moduleOrigin: 'ModValidator',
            timestamp: new Date(),
          },
        ],
        extractedMod: mockMod,
      });

      // Mock asset translation with warnings
      vi.spyOn(assetTranslator, 'translateAssets').mockResolvedValue({
        success: true,
        errors: [
          {
            id: 'asset-warning-1',
            type: 'asset',
            severity: 'warning',
            message: 'Texture format not optimal',
            moduleOrigin: 'AssetTranslationModule',
            timestamp: new Date(),
          },
        ],
        assets: [],
        modId: mockMod.id,
      });

      // Mock logic translation with errors
      vi.spyOn(logicEngine, 'translateLogic').mockResolvedValue({
        success: false,
        errors: [
          {
            id: 'logic-error-1',
            type: 'logic',
            severity: 'error',
            message: 'Unmappable API call',
            moduleOrigin: 'LogicTranslationEngine',
            timestamp: new Date(),
          },
        ],
        translatedCode: '',
        unmappableFeatures: [],
      });

      // Run modules and collect errors
      const validationResult = await modValidator.validateMod(mockMod);
      errorCollector.addErrors(validationResult.errors || []);

      const assetResult = await assetTranslator.translateAssets([], tempDir, { modId: mockMod.id });
      errorCollector.addErrors(assetResult.errors || []);

      const logicResult = await logicEngine.translateLogic([], {
        modId: mockMod.id,
        apiMappings: [],
      });
      errorCollector.addErrors(logicResult.errors || []);

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
      await assetTranslator.translateAssets([], tempDir, {
        modId: 'config-test-mod',
        maxFileSize: configService.get('conversion.maxFileSize'),
        allowedFormats: configService.get('conversion.allowedFormats'),
      });

      await compromiseEngine.applyStrategies([], {
        defaultStrategy: configService.get('compromise.defaultStrategy'),
        allowStubs: true,
        allowWarnings: true,
        allowSimplifications: true,
      });

      // Verify modules received configuration
      expect(assetSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          maxFileSize: 1024 * 1024,
          allowedFormats: ['png', 'jpg', 'ogg'],
        })
      );

      expect(compromiseSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          defaultStrategy: 'stub',
        })
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
      const validationResult = await modValidator.validateMod(mockMod);
      expect(validationResult.success).toBe(true);

      const analysisResult = await featureAnalyzer.analyzeFeatures(mockMod);
      expect(analysisResult.success).toBe(true);

      // Test that translation modules depend on ingestion output
      const assetTranslator = new AssetTranslationModule();
      const logicEngine = new LogicTranslationEngine();

      // These should require proper input from ingestion
      const assetResult = await assetTranslator.translateAssets(
        analysisResult.features,
        path.join(tempDir, 'assets'),
        { modId: mockMod.id }
      );
      expect(assetResult.success).toBe(true);

      const logicResult = await logicEngine.translateLogic(analysisResult.features, {
        modId: mockMod.id,
        apiMappings: [],
      });
      expect(logicResult.success).toBe(true);

      // Verify dependency chain integrity
      expect(assetResult.modId).toBe(mockMod.id);
      expect(logicResult.translatedCode).toBeDefined();
    });
  });
});
