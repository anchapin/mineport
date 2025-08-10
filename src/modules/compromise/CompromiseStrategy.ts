import { Feature, FeatureType, CompromiseLevel } from '../../types/compromise.js';
import { ConversionContext } from '../../types/modules.js';

/**
 * Represents the result of applying a compromise strategy
 */
export interface CompromiseResult {
  /** Whether the compromise was successfully applied */
  success: boolean;
  /** The modified feature after applying the compromise */
  modifiedFeature?: Feature;
  /** Description of what compromise was made */
  description: string;
  /** Impact level of the compromise on functionality */
  impactLevel: CompromiseLevel;
  /** Estimated user experience impact (0-100) */
  userExperienceImpact: number;
  /** Any warnings or limitations introduced by the compromise */
  warnings: string[];
  /** Suggestions for manual improvements */
  suggestions: string[];
  /** Metadata about the compromise decision */
  metadata: {
    strategyUsed: string;
    confidence: number;
    alternativesConsidered: string[];
    reversible: boolean;
  };
}

/**
 * Configuration options for compromise strategies
 */
export interface CompromiseOptions {
  /** Maximum acceptable impact level */
  maxImpactLevel: CompromiseLevel;
  /** User preferences for compromise types */
  userPreferences: {
    preferPerformance: boolean;
    preferCompatibility: boolean;
    preferVisualFidelity: boolean;
    acceptFunctionalityLoss: boolean;
  };
  /** Context-specific options */
  contextOptions: {
    targetPlatform: 'bedrock' | 'java';
    performanceConstraints: boolean;
    compatibilityMode: boolean;
  };
}

/**
 * Abstract base class for compromise strategies
 */
export abstract class CompromiseStrategy {
  protected readonly name: string;
  protected readonly supportedFeatureTypes: FeatureType[];
  protected readonly maxImpactLevel: CompromiseLevel;

  constructor(
    name: string,
    supportedFeatureTypes: FeatureType[],
    maxImpactLevel: CompromiseLevel = CompromiseLevel.MEDIUM
  ) {
    this.name = name;
    this.supportedFeatureTypes = supportedFeatureTypes;
    this.maxImpactLevel = maxImpactLevel;
  }

  /**
   * Check if this strategy can handle the given feature
   */
  canHandle(feature: Feature, context: ConversionContext): boolean {
    return this.supportedFeatureTypes.includes(feature.type) &&
           this.isApplicable(feature, context);
  }

  /**
   * Apply the compromise strategy to the feature
   */
  abstract apply(
    feature: Feature,
    context: ConversionContext,
    options: CompromiseOptions
  ): Promise<CompromiseResult>;

  /**
   * Estimate the impact of applying this strategy
   */
  abstract estimateImpact(
    feature: Feature,
    context: ConversionContext
  ): Promise<{
    impactLevel: CompromiseLevel;
    userExperienceImpact: number;
    confidence: number;
  }>;

  /**
   * Get a human-readable description of what this strategy does
   */
  abstract getDescription(): string;

  /**
   * Check if this strategy is applicable to the specific feature
   */
  protected abstract isApplicable(feature: Feature, context: ConversionContext): boolean;

  /**
   * Get the name of this strategy
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the supported feature types
   */
  getSupportedFeatureTypes(): FeatureType[] {
    return [...this.supportedFeatureTypes];
  }

  /**
   * Get the maximum impact level this strategy can produce
   */
  getMaxImpactLevel(): CompromiseLevel {
    return this.maxImpactLevel;
  }
}

/**
 * Registry for managing compromise strategies
 */
export class CompromiseStrategyRegistry {
  private strategies: Map<string, CompromiseStrategy> = new Map();

  /**
   * Register a new compromise strategy
   */
  register(strategy: CompromiseStrategy): void {
    this.strategies.set(strategy.getName(), strategy);
  }

  /**
   * Get all registered strategies
   */
  getAll(): CompromiseStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategies that can handle a specific feature
   */
  getApplicableStrategies(feature: Feature, context: ConversionContext): CompromiseStrategy[] {
    return this.getAll().filter(strategy => strategy.canHandle(feature, context));
  }

  /**
   * Get a strategy by name
   */
  getStrategy(name: string): CompromiseStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Remove a strategy from the registry
   */
  unregister(name: string): boolean {
    return this.strategies.delete(name);
  }

  /**
   * Clear all registered strategies
   */
  clear(): void {
    this.strategies.clear();
  }
}