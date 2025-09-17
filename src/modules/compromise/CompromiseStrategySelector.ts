import { CompromiseLevel } from '../../types/compromise.js';
import { Feature } from '../ingestion/index.js';
import { ConversionContext } from '../../types/modules.js';
import { CompromiseStrategy, CompromiseOptions } from './CompromiseStrategy.js';
import { CompromiseStrategyRegistry } from './CompromiseStrategy.js';
import { logger } from '../../utils/logger.js';

/**
 * Criteria for selecting the best compromise strategy
 */
export interface SelectionCriteria {
  /** Weight for impact level (lower is better) */
  impactWeight: number;
  /** Weight for user experience impact (lower is better) */
  userExperienceWeight: number;
  /** Weight for strategy confidence (higher is better) */
  confidenceWeight: number;
  /** Weight for feature type compatibility */
  compatibilityWeight: number;
  /** Prefer strategies that preserve core functionality */
  preserveCoreFunctionality: boolean;
  /** Prefer reversible compromises */
  preferReversible: boolean;
}

/**
 * Result of strategy selection process
 */
export interface StrategySelectionResult {
  /** The selected strategy */
  strategy: CompromiseStrategy;
  /** Score used for selection (higher is better) */
  score: number;
  /** Estimated impact of using this strategy */
  estimatedImpact: {
    impactLevel: CompromiseLevel;
    userExperienceImpact: number;
    confidence: number;
  };
  /** Reasoning for why this strategy was selected */
  reasoning: string;
  /** Alternative strategies that were considered */
  alternatives: Array<{
    strategy: CompromiseStrategy;
    score: number;
    reason: string;
  }>;
}

/**
 * Default selection criteria optimized for balanced compromise decisions
 */
export const DEFAULT_SELECTION_CRITERIA: SelectionCriteria = {
  impactWeight: 0.3,
  userExperienceWeight: 0.25,
  confidenceWeight: 0.2,
  compatibilityWeight: 0.15,
  preserveCoreFunctionality: true,
  preferReversible: true,
};

/**
 * Selects the best compromise strategy for a given feature
 */
export class CompromiseStrategySelector {
  private registry: CompromiseStrategyRegistry;
  private defaultCriteria: SelectionCriteria;

  constructor(
    registry: CompromiseStrategyRegistry,
    defaultCriteria: SelectionCriteria = DEFAULT_SELECTION_CRITERIA
  ) {
    this.registry = registry;
    this.defaultCriteria = defaultCriteria;
  }

  /**
   * Select the best compromise strategy for a feature
   */
  async selectStrategy(
    feature: Feature,
    context: ConversionContext,
    options: CompromiseOptions,
    criteria: SelectionCriteria = this.defaultCriteria
  ): Promise<StrategySelectionResult | null> {
    const applicableStrategies = this.registry.getApplicableStrategies(feature, context);

    if (applicableStrategies.length === 0) {
      logger.warn('No applicable compromise strategies found', {
        featureType: feature.type,
        featureName: feature.name,
      });
      return null;
    }

    // Evaluate each strategy
    const evaluations = await Promise.all(
      applicableStrategies.map(async (strategy) => {
        try {
          const impact = await strategy.estimateImpact(feature, context);
          const score = this.calculateScore(strategy, impact, criteria, options);

          return {
            strategy,
            impact,
            score,
            error: null,
          };
        } catch (error) {
          logger.warn('Failed to evaluate compromise strategy', {
            strategyName: strategy.getName(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return {
            strategy,
            impact: {
              impactLevel: CompromiseLevel.HIGH,
              userExperienceImpact: 100,
              confidence: 0,
            },
            score: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Filter out failed evaluations and sort by score
    const validEvaluations = evaluations
      .filter((evaluation) => evaluation.error === null && evaluation.score > 0)
      .sort((a, b) => b.score - a.score);

    if (validEvaluations.length === 0) {
      logger.error('All compromise strategy evaluations failed', {
        featureType: feature.type,
        featureName: feature.name,
      });
      return null;
    }

    const best = validEvaluations[0];
    const alternatives = validEvaluations.slice(1, 4).map((evaluation) => ({
      strategy: evaluation.strategy,
      score: evaluation.score,
      reason: this.getAlternativeReason(evaluation, best),
    }));

    return {
      strategy: best.strategy,
      score: best.score,
      estimatedImpact: best.impact,
      reasoning: this.generateReasoning(best, criteria, options),
      alternatives,
    };
  }

  /**
   * Calculate a score for a strategy based on criteria
   */
  private calculateScore(
    strategy: CompromiseStrategy,
    impact: { impactLevel: CompromiseLevel; userExperienceImpact: number; confidence: number },
    criteria: SelectionCriteria,
    options: CompromiseOptions
  ): number {
    // Check if strategy exceeds maximum acceptable impact
    if (
      this.getImpactLevelValue(impact.impactLevel) >
      this.getImpactLevelValue(options.maxImpactLevel)
    ) {
      return 0; // Disqualify strategies that exceed max impact
    }

    let score = 0;

    // Impact level score (lower impact is better)
    const impactScore = (4 - this.getImpactLevelValue(impact.impactLevel)) / 4;
    score += impactScore * criteria.impactWeight;

    // User experience score (lower impact is better)
    const uxScore = (100 - impact.userExperienceImpact) / 100;
    score += uxScore * criteria.userExperienceWeight;

    // Confidence score (higher confidence is better)
    const confidenceScore = impact.confidence / 100;
    score += confidenceScore * criteria.confidenceWeight;

    // Compatibility score based on feature type support
    const compatibilityScore = this.calculateCompatibilityScore(strategy, options);
    score += compatibilityScore * criteria.compatibilityWeight;

    // Apply preference bonuses
    if (criteria.preserveCoreFunctionality) {
      score += this.getCorePreservationBonus(strategy, impact);
    }

    if (criteria.preferReversible) {
      score += this.getReversibilityBonus(strategy);
    }

    return Math.max(0, Math.min(1, score)); // Normalize to 0-1 range
  }

  /**
   * Convert impact level to numeric value for comparison
   */
  private getImpactLevelValue(level: CompromiseLevel): number {
    switch (level) {
      case CompromiseLevel.NONE:
        return 0;
      case CompromiseLevel.LOW:
        return 1;
      case CompromiseLevel.MEDIUM:
        return 2;
      case CompromiseLevel.HIGH:
        return 3;
      case CompromiseLevel.CRITICAL:
        return 4;
      default:
        return 4;
    }
  }

  /**
   * Calculate compatibility score based on user preferences
   */
  private calculateCompatibilityScore(
    strategy: CompromiseStrategy,
    options: CompromiseOptions
  ): number {
    let score = 0.5; // Base score

    // Adjust based on strategy characteristics and user preferences
    const strategyName = strategy.getName().toLowerCase();

    if (options.userPreferences.preferPerformance && strategyName.includes('performance')) {
      score += 0.2;
    }

    if (options.userPreferences.preferCompatibility && strategyName.includes('compatibility')) {
      score += 0.2;
    }

    if (options.userPreferences.preferVisualFidelity && strategyName.includes('visual')) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * Get bonus for strategies that preserve core functionality
   */
  private getCorePreservationBonus(
    strategy: CompromiseStrategy,
    impact: { impactLevel: CompromiseLevel; userExperienceImpact: number; confidence: number }
  ): number {
    // Lower impact levels get higher bonuses
    const impactValue = this.getImpactLevelValue(impact.impactLevel);
    return (4 - impactValue) * 0.05; // Up to 0.2 bonus
  }

  /**
   * Get bonus for reversible strategies
   */
  private getReversibilityBonus(strategy: CompromiseStrategy): number {
    // This would need to be determined by strategy metadata
    // For now, assume certain strategy types are more reversible
    const strategyName = strategy.getName().toLowerCase();
    if (strategyName.includes('stub') || strategyName.includes('placeholder')) {
      return 0.1;
    }
    return 0;
  }

  /**
   * Generate human-readable reasoning for strategy selection
   */
  private generateReasoning(
    evaluation: { strategy: CompromiseStrategy; impact: any; score: number },
    _criteria: SelectionCriteria,
    _options: CompromiseOptions
  ): string {
    const strategy = evaluation.strategy;
    const impact = evaluation.impact;

    const reasoning = `Selected "${strategy.getName()}" strategy because: `;
    const reasons: string[] = [];

    if (impact.impactLevel === CompromiseLevel.LOW) {
      reasons.push('it has minimal impact on functionality');
    } else if (impact.impactLevel === CompromiseLevel.MEDIUM) {
      reasons.push('it provides a balanced compromise');
    }

    if (impact.confidence > 80) {
      reasons.push('high confidence in successful application');
    }

    if (impact.userExperienceImpact < 30) {
      reasons.push('minimal user experience degradation');
    }

    if (reasons.length === 0) {
      reasons.push('it was the best available option among applicable strategies');
    }

    return reasoning + reasons.join(', ') + '.';
  }

  /**
   * Generate reason why an alternative wasn't selected
   */
  private getAlternativeReason(
    alternative: { strategy: CompromiseStrategy; impact: any; score: number },
    best: { strategy: CompromiseStrategy; impact: any; score: number }
  ): string {
    const altImpact = alternative.impact;
    const bestImpact = best.impact;

    if (altImpact.impactLevel > bestImpact.impactLevel) {
      return 'Higher impact level than selected strategy';
    }

    if (altImpact.userExperienceImpact > bestImpact.userExperienceImpact + 20) {
      return 'Significantly worse user experience impact';
    }

    if (altImpact.confidence < bestImpact.confidence - 20) {
      return 'Lower confidence in successful application';
    }

    return 'Lower overall score than selected strategy';
  }
}
