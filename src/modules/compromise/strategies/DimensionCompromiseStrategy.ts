import { Feature, FeatureType, CompromiseLevel } from '../../../types/compromise.js';
import { ConversionContext } from '../../../types/modules.js';
import { CompromiseStrategy, CompromiseResult, CompromiseOptions } from '../CompromiseStrategy.js';
import { logger } from '../../../utils/logger.js';

/**
 * Strategy for handling custom dimension features that don't have direct Bedrock equivalents
 */
export class DimensionCompromiseStrategy extends CompromiseStrategy {
  constructor() {
    super(
      'DimensionCompromise',
      [FeatureType.DIMENSION, FeatureType.WORLD_GENERATION],
      CompromiseLevel.HIGH
    );
  }

  async apply(
    feature: Feature,
    context: ConversionContext,
    options: CompromiseOptions
  ): Promise<CompromiseResult> {
    logger.info('Applying dimension compromise strategy', {
      featureName: feature.name,
      featureType: feature.type,
    });

    try {
      // Analyze the dimension feature to determine the best compromise approach
      const analysis = this.analyzeDimensionFeature(feature);
      
      let modifiedFeature: Feature;
      let description: string;
      let impactLevel: CompromiseLevel;
      let userExperienceImpact: number;
      const warnings: string[] = [];
      const suggestions: string[] = [];

      switch (analysis.compromiseType) {
        case 'overworld_replacement':
          modifiedFeature = this.createOverworldReplacement(feature);
          description = 'Custom dimension replaced with modified Overworld biome';
          impactLevel = CompromiseLevel.MEDIUM;
          userExperienceImpact = 40;
          warnings.push('Dimension-specific mechanics may not work as expected');
          suggestions.push('Consider using behavior packs to simulate dimension-specific effects');
          break;

        case 'nether_adaptation':
          modifiedFeature = this.createNetherAdaptation(feature);
          description = 'Custom dimension adapted to use Nether environment';
          impactLevel = CompromiseLevel.MEDIUM;
          userExperienceImpact = 35;
          warnings.push('Some custom blocks may not generate correctly');
          suggestions.push('Use custom biomes within the Nether to maintain uniqueness');
          break;

        case 'end_adaptation':
          modifiedFeature = this.createEndAdaptation(feature);
          description = 'Custom dimension adapted to use End environment';
          impactLevel = CompromiseLevel.MEDIUM;
          userExperienceImpact = 45;
          warnings.push('Limited biome variety compared to original dimension');
          suggestions.push('Focus on unique structures and entities to maintain dimension identity');
          break;

        case 'documentation_only':
          modifiedFeature = this.createDocumentationPlaceholder(feature);
          description = 'Custom dimension documented for manual implementation';
          impactLevel = CompromiseLevel.HIGH;
          userExperienceImpact = 80;
          warnings.push('Dimension will not be functional in the converted addon');
          warnings.push('Manual implementation required using Bedrock dimension APIs');
          suggestions.push('Use the provided documentation to implement the dimension manually');
          suggestions.push('Consider breaking the dimension into multiple smaller features');
          break;

        default:
          throw new Error(`Unknown compromise type: ${analysis.compromiseType}`);
      }

      return {
        success: true,
        modifiedFeature,
        description,
        impactLevel,
        userExperienceImpact,
        warnings,
        suggestions,
        metadata: {
          strategyUsed: this.name,
          confidence: analysis.confidence,
          alternativesConsidered: analysis.alternativesConsidered,
          reversible: analysis.compromiseType !== 'documentation_only',
        },
      };
    } catch (error) {
      logger.error('Failed to apply dimension compromise strategy', {
        featureName: feature.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        description: 'Failed to apply dimension compromise strategy',
        impactLevel: CompromiseLevel.CRITICAL,
        userExperienceImpact: 100,
        warnings: ['Strategy application failed'],
        suggestions: ['Consider manual implementation or alternative approaches'],
        metadata: {
          strategyUsed: this.name,
          confidence: 0,
          alternativesConsidered: [],
          reversible: false,
        },
      };
    }
  }

  async estimateImpact(
    feature: Feature,
    context: ConversionContext
  ): Promise<{
    impactLevel: CompromiseLevel;
    userExperienceImpact: number;
    confidence: number;
  }> {
    const analysis = this.analyzeDimensionFeature(feature);
    
    let impactLevel: CompromiseLevel;
    let userExperienceImpact: number;

    switch (analysis.compromiseType) {
      case 'overworld_replacement':
        impactLevel = CompromiseLevel.MEDIUM;
        userExperienceImpact = 40;
        break;
      case 'nether_adaptation':
        impactLevel = CompromiseLevel.MEDIUM;
        userExperienceImpact = 35;
        break;
      case 'end_adaptation':
        impactLevel = CompromiseLevel.MEDIUM;
        userExperienceImpact = 45;
        break;
      case 'documentation_only':
        impactLevel = CompromiseLevel.HIGH;
        userExperienceImpact = 80;
        break;
      default:
        impactLevel = CompromiseLevel.CRITICAL;
        userExperienceImpact = 100;
    }

    return {
      impactLevel,
      userExperienceImpact,
      confidence: analysis.confidence,
    };
  }

  getDescription(): string {
    return 'Handles custom dimensions by adapting them to existing Bedrock dimensions or providing implementation guidance';
  }

  protected isApplicable(feature: Feature, context: ConversionContext): boolean {
    // Check if this is a custom dimension that needs compromise
    if (feature.type !== FeatureType.DIMENSION && feature.type !== FeatureType.WORLD_GENERATION) {
      return false;
    }

    // Check if the feature has properties that indicate it's a custom dimension
    const hasCustomProperties = feature.properties && (
      feature.properties.customBiomes ||
      feature.properties.customWorldGen ||
      feature.properties.dimensionType
    );

    return hasCustomProperties || feature.name.toLowerCase().includes('dimension');
  }

  /**
   * Analyze the dimension feature to determine the best compromise approach
   */
  private analyzeDimensionFeature(feature: Feature): {
    compromiseType: 'overworld_replacement' | 'nether_adaptation' | 'end_adaptation' | 'documentation_only';
    confidence: number;
    alternativesConsidered: string[];
  } {
    const properties = feature.properties || {};
    const alternativesConsidered: string[] = [];

    // Check for environmental characteristics
    const hasOverworldLike = properties.hasNormalWeather || properties.hasDayNightCycle;
    const hasNetherLike = properties.hasLava || properties.isHot || properties.noWeather;
    const hasEndLike = properties.hasVoid || properties.hasEndStone || properties.isFloating;

    if (hasOverworldLike) {
      alternativesConsidered.push('Overworld replacement', 'Custom biome creation');
      return {
        compromiseType: 'overworld_replacement',
        confidence: 75,
        alternativesConsidered,
      };
    }

    if (hasNetherLike) {
      alternativesConsidered.push('Nether adaptation', 'Custom Nether biome');
      return {
        compromiseType: 'nether_adaptation',
        confidence: 70,
        alternativesConsidered,
      };
    }

    if (hasEndLike) {
      alternativesConsidered.push('End adaptation', 'End island modification');
      return {
        compromiseType: 'end_adaptation',
        confidence: 65,
        alternativesConsidered,
      };
    }

    // If no clear match, fall back to documentation
    alternativesConsidered.push('Manual implementation', 'Feature removal', 'Alternative design');
    return {
      compromiseType: 'documentation_only',
      confidence: 40,
      alternativesConsidered,
    };
  }

  /**
   * Create a modified feature that uses Overworld as base
   */
  private createOverworldReplacement(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.BIOME,
      properties: {
        ...feature.properties,
        dimensionType: 'overworld',
        replacementStrategy: 'overworld_biome',
        originalDimension: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a modified feature that uses Nether as base
   */
  private createNetherAdaptation(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.BIOME,
      properties: {
        ...feature.properties,
        dimensionType: 'nether',
        replacementStrategy: 'nether_biome',
        originalDimension: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a modified feature that uses End as base
   */
  private createEndAdaptation(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.BIOME,
      properties: {
        ...feature.properties,
        dimensionType: 'end',
        replacementStrategy: 'end_biome',
        originalDimension: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a documentation placeholder for manual implementation
   */
  private createDocumentationPlaceholder(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.DOCUMENTATION,
      properties: {
        ...feature.properties,
        implementationType: 'manual',
        documentationPath: `docs/manual-implementation/${feature.name}.md`,
        originalFeature: feature,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
        requiresManualImplementation: true,
      },
    };
  }
}