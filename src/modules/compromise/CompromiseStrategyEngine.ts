import { Feature, CompromiseStrategy, FeatureType } from '../../types/compromise';
import { Logger } from '../../utils/logger';

/**
 * CompromiseStrategyEngine is responsible for selecting and applying appropriate
 * compromise strategies for features that cannot be directly translated to Bedrock.
 */
export class CompromiseStrategyEngine {
  private strategies: Map<FeatureType, CompromiseStrategy[]>;
  private appliedStrategies: Map<string, CompromiseStrategy>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.strategies = new Map();
    this.appliedStrategies = new Map();
    this.logger = logger;
    this.registerDefaultStrategies();
  }

  /**
   * Registers the default set of compromise strategies for different feature types.
   */
  private registerDefaultStrategies(): void {
    // Register dimension simulation strategies
    this.registerStrategy('dimension', {
      id: 'teleportation-simulation',
      name: 'Teleportation-based Dimension Simulation',
      description: 'Simulates custom dimensions using teleportation to isolated areas and visual effects',
      applicabilityCheck: (feature) => feature.compatibilityTier === 3 && feature.type === 'dimension',
      apply: (feature) => ({
        type: 'simulation',
        name: 'Dimension Simulation',
        description: `Simulates the ${feature.name} dimension using teleportation and visual effects`,
        implementationDetails: 'Uses teleportation to a designated area with custom visual effects',
        limitations: [
          'No true separate dimension',
          'Limited sky and environment control',
          'Shared world space with overworld'
        ]
      })
    });

    // Register rendering code stubbing strategies
    this.registerStrategy('rendering', {
      id: 'rendering-stub',
      name: 'Rendering Code Stubbing',
      description: 'Stubs out advanced rendering code with appropriate warnings',
      applicabilityCheck: (feature) => feature.compatibilityTier === 3 && feature.type === 'rendering',
      apply: (feature) => ({
        type: 'stubbing',
        name: 'Rendering Stub',
        description: `Stubs out advanced rendering for ${feature.name}`,
        implementationDetails: 'Creates stub functions with console warnings',
        limitations: [
          'No visual rendering effects',
          'Maintains logical functionality only',
          'User will need to implement custom visuals'
        ]
      })
    });

    // Register UI/HUD mapping strategies
    this.registerStrategy('ui', {
      id: 'form-mapping',
      name: 'Form-based UI Mapping',
      description: 'Maps Java UI components to Bedrock form system',
      applicabilityCheck: (feature) => feature.compatibilityTier === 3 && feature.type === 'ui',
      apply: (feature) => ({
        type: 'approximation',
        name: 'UI Form Mapping',
        description: `Maps ${feature.name} UI to Bedrock forms`,
        implementationDetails: 'Converts UI layout and logic to Bedrock form system',
        limitations: [
          'Limited UI customization',
          'Different interaction patterns',
          'Simplified visual appearance'
        ]
      })
    });
  }

  /**
   * Registers a new compromise strategy for a specific feature type.
   * 
   * @param featureType The type of feature this strategy applies to
   * @param strategy The compromise strategy to register
   */
  public registerStrategy(featureType: FeatureType, strategy: CompromiseStrategy): void {
    if (!this.strategies.has(featureType)) {
      this.strategies.set(featureType, []);
    }
    
    this.strategies.get(featureType)!.push(strategy);
    this.logger.debug(`Registered compromise strategy: ${strategy.name} for feature type: ${featureType}`);
  }

  /**
   * Selects the most appropriate compromise strategy for a given feature.
   * 
   * @param feature The feature that needs a compromise strategy
   * @returns The selected compromise strategy or undefined if none is applicable
   */
  public selectStrategy(feature: Feature): CompromiseStrategy | undefined {
    const featureType = feature.type as FeatureType;
    
    if (!this.strategies.has(featureType)) {
      this.logger.warn(`No compromise strategies registered for feature type: ${featureType}`);
      return undefined;
    }
    
    const applicableStrategies = this.strategies.get(featureType)!.filter(
      strategy => strategy.applicabilityCheck(feature)
    );
    
    if (applicableStrategies.length === 0) {
      this.logger.warn(`No applicable compromise strategies found for feature: ${feature.name}`);
      return undefined;
    }
    
    // For now, simply select the first applicable strategy
    // In the future, this could be enhanced with more sophisticated selection logic
    return applicableStrategies[0];
  }

  /**
   * Applies a compromise strategy to a feature.
   * 
   * @param feature The feature to apply a compromise strategy to
   * @returns The result of applying the strategy, or undefined if no strategy was applicable
   */
  public applyStrategy(feature: Feature): CompromiseStrategyResult | undefined {
    const strategy = this.selectStrategy(feature);
    
    if (!strategy) {
      return undefined;
    }
    
    const result = strategy.apply(feature);
    
    // Record that this strategy was applied to this feature
    this.appliedStrategies.set(feature.id, strategy);
    
    this.logger.info(`Applied compromise strategy: ${strategy.name} to feature: ${feature.name}`);
    
    return result;
  }

  /**
   * Gets a report of all compromise strategies that have been applied.
   * 
   * @returns A report of applied compromise strategies
   */
  public getCompromiseReport(): CompromiseReport {
    const appliedStrategiesArray: AppliedCompromiseStrategy[] = [];
    
    this.appliedStrategies.forEach((strategy, featureId) => {
      appliedStrategiesArray.push({
        featureId,
        strategyId: strategy.id,
        strategyName: strategy.name,
        strategyDescription: strategy.description
      });
    });
    
    return {
      totalCompromisesApplied: appliedStrategiesArray.length,
      appliedStrategies: appliedStrategiesArray
    };
  }
}

/**
 * Result of applying a compromise strategy to a feature.
 */
export interface CompromiseStrategyResult {
  type: 'simulation' | 'stubbing' | 'approximation';
  name: string;
  description: string;
  implementationDetails: string;
  limitations: string[];
}

/**
 * Report of applied compromise strategies.
 */
export interface CompromiseReport {
  totalCompromisesApplied: number;
  appliedStrategies: AppliedCompromiseStrategy[];
}

/**
 * Information about a compromise strategy that was applied to a feature.
 */
export interface AppliedCompromiseStrategy {
  featureId: string;
  strategyId: string;
  strategyName: string;
  strategyDescription: string;
}