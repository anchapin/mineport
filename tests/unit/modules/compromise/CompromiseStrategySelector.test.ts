import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompromiseStrategySelector, DEFAULT_SELECTION_CRITERIA } from '../../../../src/modules/compromise/CompromiseStrategySelector.js';
import { CompromiseStrategyRegistry, CompromiseStrategy } from '../../../../src/modules/compromise/CompromiseStrategy.js';
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

// Mock strategies for testing
class HighImpactStrategy extends CompromiseStrategy {
  constructor() {
    super('HighImpact', [FeatureType.GUI], CompromiseLevel.HIGH);
  }

  async apply() {
    throw new Error('Not implemented for test');
  }

  async estimateImpact() {
    return {
      impactLevel: CompromiseLevel.HIGH,
      userExperienceImpact: 80,
      confidence: 70,
    };
  }

  getDescription(): string {
    return 'High impact strategy';
  }

  protected isApplicable(): boolean {
    return true;
  }
}

class LowImpactStrategy extends CompromiseStrategy {
  constructor() {
    super('LowImpact', [FeatureType.GUI], CompromiseLevel.LOW);
  }

  async apply() {
    throw new Error('Not implemented for test');
  }

  async estimateImpact() {
    return {
      impactLevel: CompromiseLevel.LOW,
      userExperienceImpact: 20,
      confidence: 90,
    };
  }

  getDescription(): string {
    return 'Low impact strategy';
  }

  protected isApplicable(): boolean {
    return true;
  }
}

class FailingStrategy extends CompromiseStrategy {
  constructor() {
    super('Failing', [FeatureType.GUI], CompromiseLevel.MEDIUM);
  }

  async apply() {
    throw new Error('Not implemented for test');
  }

  async estimateImpact() {
    throw new Error('Estimation failed');
  }

  getDescription(): string {
    return 'Failing strategy';
  }

  protected isApplicable(): boolean {
    return true;
  }
}

describe('CompromiseStrategySelector', () => {
  let registry: CompromiseStrategyRegistry;
  let selector: CompromiseStrategySelector;
  let mockFeature: Feature;
  let mockContext: ConversionContext;

  beforeEach(() => {
    registry = new CompromiseStrategyRegistry();
    selector = new CompromiseStrategySelector(registry);

    mockFeature = {
      name: 'test_feature',
      type: FeatureType.GUI,
      properties: {},
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

  describe('selectStrategy', () => {
    it('should select the best strategy based on criteria', async () => {
      const lowImpactStrategy = new LowImpactStrategy();
      const highImpactStrategy = new HighImpactStrategy();
      
      registry.register(lowImpactStrategy);
      registry.register(highImpactStrategy);

      const options = {
        maxImpactLevel: CompromiseLevel.HIGH,
        userPreferences: {
          preferPerformance: false,
          preferCompatibility: true,
          preferVisualFidelity: false,
          acceptFunctionalityLoss: false,
        },
        contextOptions: {
          targetPlatform: 'bedrock' as const,
          performanceConstraints: false,
          compatibilityMode: true,
        },
      };

      const result = await selector.selectStrategy(mockFeature, mockContext, options);

      expect(result).toBeDefined();
      expect(result!.strategy).toBe(lowImpactStrategy); // Should prefer low impact
      expect(result!.score).toBeGreaterThan(0);
      expect(result!.reasoning).toContain('Low impact');
    });

    it('should return null when no applicable strategies exist', async () => {
      const result = await selector.selectStrategy(mockFeature, mockContext, {
        maxImpactLevel: CompromiseLevel.HIGH,
        userPreferences: {
          preferPerformance: false,
          preferCompatibility: true,
          preferVisualFidelity: false,
          acceptFunctionalityLoss: false,
        },
        contextOptions: {
          targetPlatform: 'bedrock',
          performanceConstraints: false,
          compatibilityMode: true,
        },
      });

      expect(result).toBeNull();
    });

    it('should exclude strategies that exceed max impact level', async () => {
      const lowImpactStrategy = new LowImpactStrategy();
      const highImpactStrategy = new HighImpactStrategy();
      
      registry.register(lowImpactStrategy);
      registry.register(highImpactStrategy);

      const options = {
        maxImpactLevel: CompromiseLevel.MEDIUM, // Exclude high impact
        userPreferences: {
          preferPerformance: false,
          preferCompatibility: true,
          preferVisualFidelity: false,
          acceptFunctionalityLoss: false,
        },
        contextOptions: {
          targetPlatform: 'bedrock' as const,
          performanceConstraints: false,
          compatibilityMode: true,
        },
      };

      const result = await selector.selectStrategy(mockFeature, mockContext, options);

      expect(result).toBeDefined();
      expect(result!.strategy).toBe(lowImpactStrategy); // High impact should be excluded
    });

    it('should handle strategy evaluation failures gracefully', async () => {
      const failingStrategy = new FailingStrategy();
      const workingStrategy = new LowImpactStrategy();
      
      registry.register(failingStrategy);
      registry.register(workingStrategy);

      const options = {
        maxImpactLevel: CompromiseLevel.HIGH,
        userPreferences: {
          preferPerformance: false,
          preferCompatibility: true,
          preferVisualFidelity: false,
          acceptFunctionalityLoss: false,
        },
        contextOptions: {
          targetPlatform: 'bedrock' as const,
          performanceConstraints: false,
          compatibilityMode: true,
        },
      };

      const result = await selector.selectStrategy(mockFeature, mockContext, options);

      expect(result).toBeDefined();
      expect(result!.strategy).toBe(workingStrategy); // Should select working strategy
    });

    it('should return null when all strategies fail evaluation', async () => {
      const failingStrategy = new FailingStrategy();
      registry.register(failingStrategy);

      const options = {
        maxImpactLevel: CompromiseLevel.HIGH,
        userPreferences: {
          preferPerformance: false,
          preferCompatibility: true,
          preferVisualFidelity: false,
          acceptFunctionalityLoss: false,
        },
        contextOptions: {
          targetPlatform: 'bedrock' as const,
          performanceConstraints: false,
          compatibilityMode: true,
        },
      };

      const result = await selector.selectStrategy(mockFeature, mockContext, options);

      expect(result).toBeNull();
    });

    it('should include alternatives in the result', async () => {
      const lowImpactStrategy = new LowImpactStrategy();
      const highImpactStrategy = new HighImpactStrategy();
      
      registry.register(lowImpactStrategy);
      registry.register(highImpactStrategy);

      const options = {
        maxImpactLevel: CompromiseLevel.HIGH,
        userPreferences: {
          preferPerformance: false,
          preferCompatibility: true,
          preferVisualFidelity: false,
          acceptFunctionalityLoss: false,
        },
        contextOptions: {
          targetPlatform: 'bedrock' as const,
          performanceConstraints: false,
          compatibilityMode: true,
        },
      };

      const result = await selector.selectStrategy(mockFeature, mockContext, options);

      expect(result).toBeDefined();
      expect(result!.alternatives).toBeDefined();
      expect(result!.alternatives.length).toBeGreaterThan(0);
      expect(result!.alternatives[0].strategy).toBe(highImpactStrategy);
      expect(result!.alternatives[0].reason).toBeTruthy();
    });

    it('should use custom selection criteria', async () => {
      const lowImpactStrategy = new LowImpactStrategy();
      const highImpactStrategy = new HighImpactStrategy();
      
      registry.register(lowImpactStrategy);
      registry.register(highImpactStrategy);

      const customCriteria = {
        ...DEFAULT_SELECTION_CRITERIA,
        confidenceWeight: 0.8, // Heavily weight confidence
        impactWeight: 0.1,     // De-emphasize impact
      };

      const options = {
        maxImpactLevel: CompromiseLevel.HIGH,
        userPreferences: {
          preferPerformance: false,
          preferCompatibility: true,
          preferVisualFidelity: false,
          acceptFunctionalityLoss: false,
        },
        contextOptions: {
          targetPlatform: 'bedrock' as const,
          performanceConstraints: false,
          compatibilityMode: true,
        },
      };

      const result = await selector.selectStrategy(mockFeature, mockContext, options, customCriteria);

      expect(result).toBeDefined();
      // With high confidence weight, low impact strategy should still win due to higher confidence
      expect(result!.strategy).toBe(lowImpactStrategy);
    });
  });

  describe('scoring algorithm', () => {
    it('should prefer strategies with lower impact levels', async () => {
      const lowImpactStrategy = new LowImpactStrategy();
      const highImpactStrategy = new HighImpactStrategy();
      
      registry.register(lowImpactStrategy);
      registry.register(highImpactStrategy);

      const options = {
        maxImpactLevel: CompromiseLevel.HIGH,
        userPreferences: {
          preferPerformance: false,
          preferCompatibility: true,
          preferVisualFidelity: false,
          acceptFunctionalityLoss: false,
        },
        contextOptions: {
          targetPlatform: 'bedrock' as const,
          performanceConstraints: false,
          compatibilityMode: true,
        },
      };

      const result = await selector.selectStrategy(mockFeature, mockContext, options);

      expect(result).toBeDefined();
      expect(result!.strategy).toBe(lowImpactStrategy);
      
      // Find the high impact alternative
      const highImpactAlternative = result!.alternatives.find(alt => alt.strategy === highImpactStrategy);
      expect(highImpactAlternative).toBeDefined();
      expect(result!.score).toBeGreaterThan(highImpactAlternative!.score);
    });

    it('should prefer strategies with higher confidence', async () => {
      // This is implicitly tested by the low impact strategy having higher confidence
      // and being selected over the high impact strategy
      const lowImpactStrategy = new LowImpactStrategy(); // 90% confidence
      const highImpactStrategy = new HighImpactStrategy(); // 70% confidence
      
      registry.register(lowImpactStrategy);
      registry.register(highImpactStrategy);

      const options = {
        maxImpactLevel: CompromiseLevel.HIGH,
        userPreferences: {
          preferPerformance: false,
          preferCompatibility: true,
          preferVisualFidelity: false,
          acceptFunctionalityLoss: false,
        },
        contextOptions: {
          targetPlatform: 'bedrock' as const,
          performanceConstraints: false,
          compatibilityMode: true,
        },
      };

      const result = await selector.selectStrategy(mockFeature, mockContext, options);

      expect(result).toBeDefined();
      expect(result!.strategy).toBe(lowImpactStrategy);
      expect(result!.estimatedImpact.confidence).toBe(90);
    });
  });
});