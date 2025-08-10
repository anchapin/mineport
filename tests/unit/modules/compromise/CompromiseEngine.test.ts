import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CompromiseEngine,
  DEFAULT_COMPROMISE_ENGINE_CONFIG,
} from '../../../../src/modules/compromise/CompromiseEngine.js';
import {
  CompromiseStrategy,
  CompromiseResult,
} from '../../../../src/modules/compromise/CompromiseStrategy.js';
import { Feature, FeatureType, CompromiseLevel } from '../../../../src/types/compromise.js';
import { ConversionContext } from '../../../../src/types/modules.js';

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock strategy for testing
class MockCompromiseStrategy extends CompromiseStrategy {
  constructor(
    name: string = 'MockStrategy',
    supportedTypes: FeatureType[] = [FeatureType.GUI],
    shouldSucceed: boolean = true
  ) {
    super(name, supportedTypes);
    this.shouldSucceed = shouldSucceed;
  }

  private shouldSucceed: boolean;

  async apply(feature: Feature, _context: ConversionContext): Promise<CompromiseResult> {
    if (!this.shouldSucceed) {
      throw new Error('Mock strategy failure');
    }

    return {
      success: true,
      modifiedFeature: { ...feature, name: `${feature.name}_compromised` },
      description: 'Mock compromise applied',
      impactLevel: CompromiseLevel.LOW,
      userExperienceImpact: 20,
      warnings: [],
      suggestions: ['Mock suggestion'],
      metadata: {
        strategyUsed: this.name,
        confidence: 80,
        alternativesConsidered: [],
        reversible: true,
      },
    };
  }

  async estimateImpact() {
    return {
      impactLevel: CompromiseLevel.LOW,
      userExperienceImpact: 20,
      confidence: 80,
    };
  }

  getDescription(): string {
    return 'Mock strategy for testing';
  }

  protected isApplicable(feature: Feature): boolean {
    return feature.name.includes('test');
  }
}

describe('CompromiseEngine', () => {
  let engine: CompromiseEngine;
  let mockFeature: Feature;
  let mockContext: ConversionContext;

  beforeEach(() => {
    engine = new CompromiseEngine({
      ...DEFAULT_COMPROMISE_ENGINE_CONFIG,
      autoRegisterStrategies: false, // Don't register default strategies for testing
    });

    mockFeature = {
      name: 'test_feature',
      type: FeatureType.GUI,
      properties: {
        needsCompromise: true,
      },
      metadata: {},
    };

    mockContext = {
      sourceFormat: 'java',
      targetFormat: 'bedrock',
      conversionId: 'test-conversion',
      timestamp: new Date(),
      options: {},
    };
  });

  describe('processFeature', () => {
    it('should process a feature that needs compromise', async () => {
      const mockStrategy = new MockCompromiseStrategy();
      engine.registerStrategy(mockStrategy);

      const result = await engine.processFeature(mockFeature, mockContext);

      expect(result.compromiseApplied).toBe(true);
      expect(result.compromiseResult).toBeDefined();
      expect(result.compromiseResult?.success).toBe(true);
      expect(result.compromiseResult?.description).toBe('Mock compromise applied');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle features that do not need compromise', async () => {
      const featureNoCompromise = {
        ...mockFeature,
        properties: {}, // No needsCompromise flag
        name: 'normal_feature', // Doesn't match mock strategy criteria
      };

      const result = await engine.processFeature(featureNoCompromise, mockContext);

      expect(result.compromiseApplied).toBe(false);
      expect(result.compromiseResult).toBeUndefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should handle cases where no applicable strategy is found', async () => {
      const unsupportedFeature = {
        ...mockFeature,
        type: FeatureType.DIMENSION, // Not supported by mock strategy
        name: 'unsupported_feature',
      };

      const result = await engine.processFeature(unsupportedFeature, mockContext);

      expect(result.compromiseApplied).toBe(false);
      expect(result.errors).toContain('No applicable compromise strategy found');
    });

    it('should handle strategy application failures', async () => {
      const failingStrategy = new MockCompromiseStrategy(
        'FailingStrategy',
        [FeatureType.GUI],
        false
      );
      engine.registerStrategy(failingStrategy);

      const result = await engine.processFeature(mockFeature, mockContext);

      expect(result.compromiseApplied).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should track processing metadata', async () => {
      const mockStrategy = new MockCompromiseStrategy();
      engine.registerStrategy(mockStrategy);

      const result = await engine.processFeature(mockFeature, mockContext);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.strategiesConsidered).toBe(1);
      expect(result.metadata.fallbackUsed).toBe(false);
    });
  });

  describe('processBatch', () => {
    it('should process multiple features', async () => {
      const mockStrategy = new MockCompromiseStrategy();
      engine.registerStrategy(mockStrategy);

      const features = [
        mockFeature,
        { ...mockFeature, name: 'test_feature_2' },
        { ...mockFeature, name: 'test_feature_3' },
      ];

      const result = await engine.processBatch(features, mockContext);

      expect(result.results).toHaveLength(3);
      expect(result.statistics.totalFeatures).toBe(3);
      expect(result.statistics.compromisesApplied).toBe(3);
      expect(result.statistics.successRate).toBe(100);
    });

    it('should calculate correct statistics', async () => {
      const mockStrategy = new MockCompromiseStrategy();
      const failingStrategy = new MockCompromiseStrategy(
        'FailingStrategy',
        [FeatureType.GUI],
        false
      );
      engine.registerStrategy(mockStrategy);
      engine.registerStrategy(failingStrategy);

      const features = [
        mockFeature, // Should succeed
        { ...mockFeature, name: 'normal_feature' }, // Should not need compromise
      ];

      const result = await engine.processBatch(features, mockContext);

      expect(result.statistics.totalFeatures).toBe(2);
      expect(result.statistics.compromisesApplied).toBe(1);
      expect(result.statistics.successRate).toBe(50);
      expect(result.summary.strategiesUsed['MockStrategy']).toBe(1);
    });

    it('should collect common issues', async () => {
      const features = [
        { ...mockFeature, type: FeatureType.DIMENSION, name: 'unsupported_1' },
        { ...mockFeature, type: FeatureType.DIMENSION, name: 'unsupported_2' },
      ];

      const result = await engine.processBatch(features, mockContext);

      expect(result.summary.commonIssues).toContain('No applicable compromise strategy found');
    });
  });

  describe('strategy management', () => {
    it('should register and retrieve strategies', () => {
      const mockStrategy = new MockCompromiseStrategy();
      engine.registerStrategy(mockStrategy);

      const strategies = engine.getRegisteredStrategies();
      expect(strategies).toContain(mockStrategy);
    });

    it('should get applicable strategies for a feature', () => {
      const mockStrategy = new MockCompromiseStrategy();
      engine.registerStrategy(mockStrategy);

      const applicableStrategies = engine.getApplicableStrategies(mockFeature, mockContext);
      expect(applicableStrategies).toContain(mockStrategy);
    });

    it('should update configuration', () => {
      const newConfig = {
        maxAttempts: 5,
        generateReports: false,
      };

      engine.updateConfig(newConfig);

      // Configuration is private, so we test indirectly by checking behavior
      // This is a basic test to ensure the method doesn't throw
      expect(() => engine.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('default strategies', () => {
    it('should register default strategies when autoRegisterStrategies is true', () => {
      const engineWithDefaults = new CompromiseEngine({
        ...DEFAULT_COMPROMISE_ENGINE_CONFIG,
        autoRegisterStrategies: true,
      });

      const strategies = engineWithDefaults.getRegisteredStrategies();
      expect(strategies.length).toBeGreaterThan(0);

      const strategyNames = strategies.map((s) => s.getName());
      expect(strategyNames).toContain('DimensionCompromise');
      expect(strategyNames).toContain('RenderingCompromise');
      expect(strategyNames).toContain('UICompromise');
    });

    it('should register custom strategies from config', () => {
      const customStrategy = new MockCompromiseStrategy('CustomStrategy');
      const engineWithCustom = new CompromiseEngine({
        ...DEFAULT_COMPROMISE_ENGINE_CONFIG,
        autoRegisterStrategies: false,
        customStrategies: [customStrategy],
      });

      const strategies = engineWithCustom.getRegisteredStrategies();
      expect(strategies).toContain(customStrategy);
    });
  });
});
