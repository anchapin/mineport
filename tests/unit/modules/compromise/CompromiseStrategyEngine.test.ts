import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompromiseStrategyEngine } from '../../../../src/modules/compromise/CompromiseStrategyEngine.js';
import { Feature, CompromiseStrategy, FeatureType } from '../../../../src/types/compromise.js';

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('CompromiseStrategyEngine', () => {
  let engine: CompromiseStrategyEngine;

  beforeEach(() => {
    engine = new CompromiseStrategyEngine(mockLogger);
    vi.clearAllMocks();
  });

  it('should register default strategies', () => {
    // Create a test feature for each type
    const dimensionFeature: Feature = {
      id: 'test-dimension',
      name: 'Test Dimension',
      description: 'A test dimension',
      type: 'dimension',
      compatibilityTier: 3,
      sourceFiles: ['TestDimension.java'],
      sourceLineNumbers: [[10, 20]],
    };

    const renderingFeature: Feature = {
      id: 'test-rendering',
      name: 'Test Rendering',
      description: 'A test rendering feature',
      type: 'rendering',
      compatibilityTier: 3,
      sourceFiles: ['TestRenderer.java'],
      sourceLineNumbers: [[30, 40]],
    };

    const uiFeature: Feature = {
      id: 'test-ui',
      name: 'Test UI',
      description: 'A test UI feature',
      type: 'ui',
      compatibilityTier: 3,
      sourceFiles: ['TestUI.java'],
      sourceLineNumbers: [[50, 60]],
    };

    // Test that strategies are selected for each feature type
    const dimensionStrategy = engine.selectStrategy(dimensionFeature);
    const renderingStrategy = engine.selectStrategy(renderingFeature);
    const uiStrategy = engine.selectStrategy(uiFeature);

    expect(dimensionStrategy).toBeDefined();
    expect(renderingStrategy).toBeDefined();
    expect(uiStrategy).toBeDefined();

    expect(dimensionStrategy?.id).toBe('teleportation-simulation');
    expect(renderingStrategy?.id).toBe('rendering-stub');
    expect(uiStrategy?.id).toBe('form-mapping');
  });

  it('should register custom strategies', () => {
    const customStrategy: CompromiseStrategy = {
      id: 'custom-strategy',
      name: 'Custom Strategy',
      description: 'A custom compromise strategy',
      applicabilityCheck: (feature) => feature.compatibilityTier === 3 && feature.type === 'custom',
      apply: (feature) => ({
        type: 'approximation',
        name: 'Custom Approximation',
        description: `Custom approximation for ${feature.name}`,
        implementationDetails: 'Custom implementation details',
        limitations: ['Custom limitation'],
      }),
    };

    // Register with 'custom' as the feature type to match our test feature
    engine.registerStrategy('custom' as FeatureType, customStrategy);

    const customFeature: Feature = {
      id: 'test-custom',
      name: 'Test Custom',
      description: 'A test custom feature',
      type: 'custom',
      compatibilityTier: 3,
      sourceFiles: ['TestCustom.java'],
      sourceLineNumbers: [[70, 80]],
    };

    const selectedStrategy = engine.selectStrategy(customFeature);

    expect(selectedStrategy).toBeDefined();
    expect(selectedStrategy?.id).toBe('custom-strategy');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Registered compromise strategy: Custom Strategy for feature type: custom'
    );
  });

  it('should apply strategies and generate results', () => {
    const dimensionFeature: Feature = {
      id: 'test-dimension',
      name: 'Test Dimension',
      description: 'A test dimension',
      type: 'dimension',
      compatibilityTier: 3,
      sourceFiles: ['TestDimension.java'],
      sourceLineNumbers: [[10, 20]],
    };

    const result = engine.applyStrategy(dimensionFeature);

    expect(result).toBeDefined();
    expect(result?.type).toBe('simulation');
    expect(result?.name).toBe('Dimension Simulation');
    expect(result?.description).toBe(
      'Simulates the Test Dimension dimension using teleportation and visual effects'
    );
    expect(result?.limitations).toHaveLength(3);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Applied compromise strategy: Teleportation-based Dimension Simulation to feature: Test Dimension'
    );
  });

  it('should generate a compromise report', () => {
    const dimensionFeature: Feature = {
      id: 'test-dimension',
      name: 'Test Dimension',
      description: 'A test dimension',
      type: 'dimension',
      compatibilityTier: 3,
      sourceFiles: ['TestDimension.java'],
      sourceLineNumbers: [[10, 20]],
    };

    const renderingFeature: Feature = {
      id: 'test-rendering',
      name: 'Test Rendering',
      description: 'A test rendering feature',
      type: 'rendering',
      compatibilityTier: 3,
      sourceFiles: ['TestRenderer.java'],
      sourceLineNumbers: [[30, 40]],
    };

    // Apply strategies to features
    engine.applyStrategy(dimensionFeature);
    engine.applyStrategy(renderingFeature);

    // Get the compromise report
    const report = engine.getCompromiseReport();

    expect(report.totalCompromisesApplied).toBe(2);
    expect(report.appliedStrategies).toHaveLength(2);

    const dimensionStrategy = report.appliedStrategies.find(
      (s) => s.featureId === 'test-dimension'
    );
    const renderingStrategy = report.appliedStrategies.find(
      (s) => s.featureId === 'test-rendering'
    );

    expect(dimensionStrategy).toBeDefined();
    expect(renderingStrategy).toBeDefined();

    expect(dimensionStrategy?.strategyId).toBe('teleportation-simulation');
    expect(renderingStrategy?.strategyId).toBe('rendering-stub');
  });

  it('should handle features with no applicable strategies', () => {
    const unsupportedFeature: Feature = {
      id: 'unsupported',
      name: 'Unsupported Feature',
      description: 'A feature with no applicable strategies',
      type: 'unknown',
      compatibilityTier: 3,
      sourceFiles: ['Unsupported.java'],
      sourceLineNumbers: [[90, 100]],
    };

    const result = engine.applyStrategy(unsupportedFeature);

    expect(result).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'No compromise strategies registered for feature type: unknown'
    );
  });

  it('should accept and process strategy feedback', () => {
    const dimensionFeature: Feature = {
      id: 'test-dimension',
      name: 'Test Dimension',
      description: 'A test dimension',
      type: 'dimension',
      compatibilityTier: 3,
      sourceFiles: ['TestDimension.java'],
      sourceLineNumbers: [[10, 20]],
    };

    // Apply a strategy first
    const result = engine.applyStrategy(dimensionFeature);
    expect(result).toBeDefined();

    // Provide feedback
    const feedback = {
      strategyId: 'teleportation-simulation',
      featureId: 'test-dimension',
      effectiveness: {
        rating: 'good' as const,
        userSatisfaction: 8,
        technicalSuccess: true,
        issues: ['Limited visual effects'],
        suggestions: ['Add more particle effects'],
        timestamp: new Date(),
      },
      context: {
        featureType: 'dimension',
        compatibilityTier: 3,
        sourceComplexity: 'medium' as const,
      },
    };

    // This should not throw
    expect(() => {
      engine.provideFeedback(feedback);
    }).not.toThrow();

    // Verify feedback was recorded
    const strategyFeedback = engine.getStrategyFeedback('teleportation-simulation');
    expect(strategyFeedback).toHaveLength(1);
    expect(strategyFeedback[0].effectiveness.rating).toBe('good');
  });

  it('should track strategy metrics', () => {
    const dimensionFeature: Feature = {
      id: 'test-dimension',
      name: 'Test Dimension',
      description: 'A test dimension',
      type: 'dimension',
      compatibilityTier: 3,
      sourceFiles: ['TestDimension.java'],
      sourceLineNumbers: [[10, 20]],
    };

    // Apply a strategy
    engine.applyStrategy(dimensionFeature);

    // Check metrics were created
    const metrics = engine.getStrategyMetrics('teleportation-simulation');
    expect(metrics).toBeDefined();
    expect(metrics?.totalApplications).toBe(1);
    expect(metrics?.successfulApplications).toBe(1);
  });

  it('should generate strategy performance report', () => {
    const dimensionFeature: Feature = {
      id: 'test-dimension',
      name: 'Test Dimension',
      description: 'A test dimension',
      type: 'dimension',
      compatibilityTier: 3,
      sourceFiles: ['TestDimension.java'],
      sourceLineNumbers: [[10, 20]],
    };

    // Apply a strategy
    engine.applyStrategy(dimensionFeature);

    // Get performance report
    const report = engine.getStrategyPerformanceReport();

    expect(report).toBeDefined();
    expect(report.totalStrategies).toBeGreaterThan(0);
    expect(report.strategies).toHaveLength(1);
    expect(report.generatedAt).toBeInstanceOf(Date);
  });
});
