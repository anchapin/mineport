import { CompromiseLevel } from '../../types/compromise.js';
import { Feature } from '../ingestion/index.js';
import { ConversionContext } from '../../types/modules.js';
import { CompromiseStrategy, CompromiseOptions, CompromiseResult } from './CompromiseStrategy.js';
import { CompromiseStrategyRegistry } from './CompromiseStrategy.js';
import {
  CompromiseStrategySelector,
  StrategySelectionResult,
} from './CompromiseStrategySelector.js';
import { DimensionCompromiseStrategy } from './strategies/DimensionCompromiseStrategy.js';
import { RenderingCompromiseStrategy } from './strategies/RenderingCompromiseStrategy.js';
import { UICompromiseStrategy } from './strategies/UICompromiseStrategy.js';
import { logger } from '../../utils/logger.js';

/**
 * Configuration for the compromise engine
 */
export interface CompromiseEngineConfig {
  /** Default options for compromise strategies */
  defaultOptions: CompromiseOptions;
  /** Whether to enable automatic strategy registration */
  autoRegisterStrategies: boolean;
  /** Maximum number of compromise attempts per feature */
  maxAttempts: number;
  /** Whether to generate detailed reports */
  generateReports: boolean;
  /** Custom strategies to register */
  customStrategies?: CompromiseStrategy[];
}

/**
 * Result of processing a feature through the compromise engine
 */
export interface CompromiseEngineResult {
  /** Original feature that was processed */
  originalFeature: Feature;
  /** Whether a compromise was successfully applied */
  compromiseApplied: boolean;
  /** The compromise result if applied */
  compromiseResult?: CompromiseResult;
  /** Strategy selection details */
  strategySelection?: StrategySelectionResult;
  /** Any errors that occurred during processing */
  errors: string[];
  /** Processing metadata */
  metadata: {
    processingTime: number;
    strategiesConsidered: number;
    fallbackUsed: boolean;
  };
}

/**
 * Batch processing result for multiple features
 */
export interface BatchCompromiseResult {
  /** Results for each processed feature */
  results: CompromiseEngineResult[];
  /** Overall statistics */
  statistics: {
    totalFeatures: number;
    compromisesApplied: number;
    successRate: number;
    averageImpact: number;
    impactDistribution: Record<CompromiseLevel, number>;
  };
  /** Processing summary */
  summary: {
    processingTime: number;
    strategiesUsed: Record<string, number>;
    commonIssues: string[];
  };
}

/**
 * Default configuration for the compromise engine
 */
export const DEFAULT_COMPROMISE_ENGINE_CONFIG: CompromiseEngineConfig = {
  defaultOptions: {
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
  },
  autoRegisterStrategies: true,
  maxAttempts: 3,
  generateReports: true,
};

/**
 * Main compromise engine that orchestrates the compromise process
 */
export class CompromiseEngine {
  private registry: CompromiseStrategyRegistry;
  private selector: CompromiseStrategySelector;
  private config: CompromiseEngineConfig;

  constructor(config: CompromiseEngineConfig = DEFAULT_COMPROMISE_ENGINE_CONFIG) {
    this.config = { ...DEFAULT_COMPROMISE_ENGINE_CONFIG, ...config };
    this.registry = new CompromiseStrategyRegistry();
    this.selector = new CompromiseStrategySelector(this.registry);

    if (this.config.autoRegisterStrategies) {
      this.registerDefaultStrategies();
    }

    if (this.config.customStrategies) {
      this.config.customStrategies.forEach((strategy) => {
        this.registry.register(strategy);
      });
    }
  }

  /**
   * Process a single feature through the compromise engine
   */
  async processFeature(
    feature: Feature,
    context: ConversionContext,
    options?: Partial<CompromiseOptions>
  ): Promise<CompromiseEngineResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.config.defaultOptions, ...options };
    const errors: string[] = [];

    logger.info('Processing feature for compromise', {
      featureName: feature.name,
      featureType: feature.type,
    });

    try {
      // Check if compromise is needed
      if (!this.needsCompromise(feature, context)) {
        return {
          originalFeature: feature,
          compromiseApplied: false,
          errors,
          metadata: {
            processingTime: Date.now() - startTime,
            strategiesConsidered: 0,
            fallbackUsed: false,
          },
        };
      }

      // Select the best strategy
      const strategySelection = await this.selector.selectStrategy(feature, context, mergedOptions);

      if (!strategySelection) {
        errors.push('No applicable compromise strategy found');
        return {
          originalFeature: feature,
          compromiseApplied: false,
          errors,
          metadata: {
            processingTime: Date.now() - startTime,
            strategiesConsidered: this.registry.getApplicableStrategies(feature, context).length,
            fallbackUsed: false,
          },
        };
      }

      // Apply the selected strategy
      const compromiseResult = await this.applyStrategyWithRetry(
        strategySelection.strategy,
        feature,
        context,
        mergedOptions
      );

      return {
        originalFeature: feature,
        compromiseApplied: compromiseResult.success,
        compromiseResult,
        strategySelection,
        errors,
        metadata: {
          processingTime: Date.now() - startTime,
          strategiesConsidered: this.registry.getApplicableStrategies(feature, context).length,
          fallbackUsed: false,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      logger.error('Failed to process feature for compromise', {
        featureName: feature.name,
        error: errorMessage,
      });

      return {
        originalFeature: feature,
        compromiseApplied: false,
        errors,
        metadata: {
          processingTime: Date.now() - startTime,
          strategiesConsidered: 0,
          fallbackUsed: false,
        },
      };
    }
  }

  /**
   * Process multiple features in batch
   */
  async processBatch(
    features: Feature[],
    context: ConversionContext,
    options?: Partial<CompromiseOptions>
  ): Promise<BatchCompromiseResult> {
    const startTime = Date.now();
    const results: CompromiseEngineResult[] = [];
    const strategiesUsed: Record<string, number> = {};
    const commonIssues: string[] = [];

    logger.info('Processing feature batch for compromise', {
      featureCount: features.length,
    });

    // Process each feature
    for (const feature of features) {
      const result = await this.processFeature(feature, context, options);
      results.push(result);

      // Track strategy usage
      if (result.strategySelection) {
        const strategyName = result.strategySelection.strategy.getName();
        strategiesUsed[strategyName] = (strategiesUsed[strategyName] || 0) + 1;
      }

      // Collect common issues
      result.errors.forEach((error) => {
        if (!commonIssues.includes(error)) {
          commonIssues.push(error);
        }
      });
    }

    // Calculate statistics
    const statistics = this.calculateStatistics(results);

    return {
      results,
      statistics,
      summary: {
        processingTime: Date.now() - startTime,
        strategiesUsed,
        commonIssues,
      },
    };
  }

  /**
   * Register a custom compromise strategy
   */
  registerStrategy(strategy: CompromiseStrategy): void {
    this.registry.register(strategy);
  }

  /**
   * Get all registered strategies
   */
  getRegisteredStrategies(): CompromiseStrategy[] {
    return this.registry.getAll();
  }

  /**
   * Get strategies applicable to a specific feature
   */
  getApplicableStrategies(feature: Feature, context: ConversionContext): CompromiseStrategy[] {
    return this.registry.getApplicableStrategies(feature, context);
  }

  /**
   * Update engine configuration
   */
  updateConfig(config: Partial<CompromiseEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Register default compromise strategies
   */
  private registerDefaultStrategies(): void {
    this.registry.register(new DimensionCompromiseStrategy());
    this.registry.register(new RenderingCompromiseStrategy());
    this.registry.register(new UICompromiseStrategy());
  }

  /**
   * Check if a feature needs compromise
   */
  private needsCompromise(feature: Feature, context: ConversionContext): boolean {
    // Features with compatibility tier 3 or 4 typically need compromise
    if (feature.compatibilityTier >= 3) {
      return true;
    }

    // Features that already have a compromise strategy assigned
    if (feature.compromiseStrategy) {
      return true;
    }

    // Features with custom implementations
    if (properties.customImplementation || properties.javaSpecific) {
      return true;
    }

    // Check if any applicable strategies exist (indicates potential need)
    const applicableStrategies = this.registry.getApplicableStrategies(feature, context);
    return applicableStrategies.length > 0;
  }

  /**
   * Apply strategy with retry logic
   */
  private async applyStrategyWithRetry(
    strategy: CompromiseStrategy,
    feature: Feature,
    context: ConversionContext,
    options: CompromiseOptions
  ): Promise<CompromiseResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        logger.debug('Applying compromise strategy', {
          strategyName: strategy.getName(),
          featureName: feature.name,
          attempt,
        });

        const result = await strategy.apply(feature, context, options);

        if (result.success) {
          return result;
        } else {
          logger.warn('Strategy application unsuccessful', {
            strategyName: strategy.getName(),
            featureName: feature.name,
            attempt,
          });
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn('Strategy application failed', {
          strategyName: strategy.getName(),
          featureName: feature.name,
          attempt,
          error: lastError.message,
        });

        if (attempt < this.config.maxAttempts) {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All attempts failed
    throw lastError || new Error('Strategy application failed after all attempts');
  }

  /**
   * Calculate statistics for batch processing results
   */
  private calculateStatistics(
    results: CompromiseEngineResult[]
  ): BatchCompromiseResult['statistics'] {
    const totalFeatures = results.length;
    const compromisesApplied = results.filter((r) => r.compromiseApplied).length;
    const successRate = totalFeatures > 0 ? (compromisesApplied / totalFeatures) * 100 : 0;

    // Calculate average impact
    const impactValues = results
      .filter((r) => r.compromiseResult)
      .map((r) => r.compromiseResult!.userExperienceImpact);
    const averageImpact =
      impactValues.length > 0
        ? impactValues.reduce((sum, impact) => sum + impact, 0) / impactValues.length
        : 0;

    // Calculate impact distribution
    const impactDistribution: Record<CompromiseLevel, number> = {
      [CompromiseLevel.NONE]: 0,
      [CompromiseLevel.LOW]: 0,
      [CompromiseLevel.MEDIUM]: 0,
      [CompromiseLevel.HIGH]: 0,
      [CompromiseLevel.CRITICAL]: 0,
    };

    results
      .filter((r) => r.compromiseResult)
      .forEach((r) => {
        const level = r.compromiseResult!.impactLevel;
        impactDistribution[level]++;
      });

    return {
      totalFeatures,
      compromisesApplied,
      successRate,
      averageImpact,
      impactDistribution,
    };
  }
}
