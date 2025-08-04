import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompromisePreferencesService } from '../../../../../src/modules/ui/services/CompromisePreferencesService.js';
import { CompromiseStrategyEngine } from '../../../../../src/modules/compromise/CompromiseStrategyEngine.js';
import { Feature } from '../../../../../src/types/compromise.js';
import { UserPreferences } from '../../../../../src/modules/ui/types.js';

// Mock the logger
vi.mock('../../../../../src/utils/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('CompromisePreferencesService', () => {
  let service: CompromisePreferencesService;
  let mockCompromiseEngine: any;

  beforeEach(() => {
    mockCompromiseEngine = {
      registerStrategy: vi.fn(),
      provideFeedback: vi.fn(),
      getStrategyPerformanceReport: vi.fn().mockReturnValue({
        totalStrategies: 3,
        activeStrategies: 3,
        strategies: [],
        generatedAt: new Date(),
      }),
    };

    service = new CompromisePreferencesService(mockCompromiseEngine);
  });

  it('should initialize with default preferences', () => {
    const preferences = service.getPreferences();

    expect(preferences).toBeDefined();
    expect(preferences.theme).toBe('light');
    expect(preferences.compromiseStrategies).toHaveLength(3);
    expect(preferences.compromiseStrategies[0].id).toBe('teleportation-simulation');
  });

  it('should update preferences and reconfigure strategies', () => {
    const newPreferences: UserPreferences = {
      theme: 'dark',
      compromiseStrategies: [
        {
          id: 'teleportation-simulation',
          name: 'Dimension Simulation',
          description: 'Test description',
          isEnabled: false,
          options: [],
        },
      ],
      conversionOptions: {
        generateDebugInfo: true,
        optimizeOutput: false,
        includeComments: false,
        targetMinecraftVersion: '1.19',
      },
    };

    service.updatePreferences(newPreferences);

    const updatedPreferences = service.getPreferences();
    expect(updatedPreferences.theme).toBe('dark');
    expect(updatedPreferences.conversionOptions.generateDebugInfo).toBe(true);
  });

  it('should preview strategy effects for features', () => {
    const testFeatures: Feature[] = [
      {
        id: 'test-dimension',
        name: 'Test Dimension',
        description: 'A test dimension feature',
        type: 'dimension',
        compatibilityTier: 3,
        sourceFiles: ['TestDimension.java'],
        sourceLineNumbers: [[10, 20]],
      },
      {
        id: 'test-rendering',
        name: 'Test Rendering',
        description: 'A test rendering feature',
        type: 'rendering',
        compatibilityTier: 3,
        sourceFiles: ['TestRenderer.java'],
        sourceLineNumbers: [[30, 40]],
      },
    ];

    const previews = service.previewStrategyEffects(testFeatures);

    expect(previews).toHaveLength(2);
    expect(previews[0].featureId).toBe('test-dimension');
    expect(previews[0].strategyId).toBe('teleportation-simulation');
    expect(previews[0].userConfigurable).toBe(true);

    expect(previews[1].featureId).toBe('test-rendering');
    expect(previews[1].strategyId).toBe('rendering-stub');
    expect(previews[1].userConfigurable).toBe(true);
  });

  it('should handle features with no applicable strategies', () => {
    const testFeature: Feature = {
      id: 'unsupported-feature',
      name: 'Unsupported Feature',
      description: 'A feature with no applicable strategies',
      type: 'unknown',
      compatibilityTier: 3,
      sourceFiles: ['Unknown.java'],
      sourceLineNumbers: [[50, 60]],
    };

    const previews = service.previewStrategyEffects([testFeature]);

    expect(previews).toHaveLength(1);
    expect(previews[0].featureId).toBe('unsupported-feature');
    expect(previews[0].strategyId).toBe(null);
    expect(previews[0].strategyName).toBe('No applicable strategy');
    expect(previews[0].userConfigurable).toBe(false);
  });

  it('should collect user feedback and forward to engine', () => {
    const feedback = {
      strategyId: 'teleportation-simulation',
      featureId: 'test-dimension',
      effectiveness: {
        rating: 'good' as const,
        userSatisfaction: 8,
        technicalSuccess: true,
        issues: ['Minor visual glitch'],
        suggestions: ['Add more particles'],
        timestamp: new Date(),
      },
      context: {
        featureType: 'dimension',
        compatibilityTier: 3,
        sourceComplexity: 'medium' as const,
      },
    };

    service.collectUserFeedback(feedback);

    expect(mockCompromiseEngine.provideFeedback).toHaveBeenCalledWith(feedback);
  });

  it('should get strategy performance report from engine', () => {
    const report = service.getStrategyPerformanceReport();

    expect(report).toBeDefined();
    expect(report.totalStrategies).toBe(3);
    expect(mockCompromiseEngine.getStrategyPerformanceReport).toHaveBeenCalled();
  });

  it('should apply strategy with user preferences', () => {
    const testFeature: Feature = {
      id: 'test-dimension',
      name: 'Test Dimension',
      description: 'A test dimension feature',
      type: 'dimension',
      compatibilityTier: 3,
      sourceFiles: ['TestDimension.java'],
      sourceLineNumbers: [[10, 20]],
    };

    // Update preferences to customize dimension simulation
    const customPreferences: UserPreferences = {
      theme: 'light',
      compromiseStrategies: [
        {
          id: 'teleportation-simulation',
          name: 'Dimension Simulation',
          description: 'Custom dimension simulation',
          isEnabled: true,
          options: [
            {
              id: 'useParticleEffects',
              name: 'Use Particle Effects',
              value: false,
              type: 'boolean',
            },
            {
              id: 'teleportationDelay',
              name: 'Teleportation Delay (ms)',
              value: 2000,
              type: 'number',
            },
            {
              id: 'simulationQuality',
              name: 'Simulation Quality',
              value: 'low',
              type: 'select',
            },
          ],
        },
      ],
      conversionOptions: {
        generateDebugInfo: false,
        optimizeOutput: true,
        includeComments: true,
        targetMinecraftVersion: '1.20',
      },
    };

    service.updatePreferences(customPreferences);

    const previews = service.previewStrategyEffects([testFeature]);

    expect(previews).toHaveLength(1);
    expect(previews[0].previewResult.implementationDetails).toContain('2000ms');
    expect(previews[0].previewResult.implementationDetails).toContain('Quality: low');
    expect(previews[0].previewResult.limitations).toContain('No particle effects');
  });
});
