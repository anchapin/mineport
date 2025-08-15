import { CompromiseLevel } from '../../../types/compromise.js';
import { Feature, FeatureType } from '../../ingestion/index.js';
import { ConversionContext } from '../../../types/modules.js';
import { CompromiseStrategy, CompromiseResult, CompromiseOptions } from '../CompromiseStrategy.js';
import { logger } from '../../../utils/logger.js';

/**
 * Strategy for handling rendering features that don't have direct Bedrock equivalents
 */
export class RenderingCompromiseStrategy extends CompromiseStrategy {
  constructor() {
    super(
      'RenderingCompromise',
      [FeatureType.RENDERING, FeatureType.PARTICLE],
      CompromiseLevel.MEDIUM
    );
  }

  async apply(
    feature: Feature,
    _context: ConversionContext,
    _options: CompromiseOptions
  ): Promise<CompromiseResult> {
    logger.info('Applying rendering compromise strategy', {
      featureName: feature.name,
      featureType: feature.type,
    });

    try {
      const analysis = this.analyzeRenderingFeature(feature);

      let modifiedFeature: Feature;
      let description: string;
      let impactLevel: CompromiseLevel;
      let userExperienceImpact: number;
      const warnings: string[] = [];
      const suggestions: string[] = [];

      switch (analysis.compromiseType) {
        case 'particle_replacement':
          modifiedFeature = this.createParticleReplacement(feature);
          description = 'Custom rendering replaced with equivalent particle effects';
          impactLevel = CompromiseLevel.LOW;
          userExperienceImpact = 20;
          suggestions.push('Fine-tune particle parameters to match original visual effect');
          break;

        case 'texture_approximation':
          modifiedFeature = this.createTextureApproximation(feature);
          description = 'Complex rendering approximated with texture modifications';
          impactLevel = CompromiseLevel.MEDIUM;
          userExperienceImpact = 35;
          warnings.push('Visual effect may not be identical to original');
          suggestions.push('Consider using animated textures for dynamic effects');
          break;

        case 'model_simplification':
          modifiedFeature = this.createModelSimplification(feature);
          description = 'Complex 3D rendering simplified to basic model geometry';
          impactLevel = CompromiseLevel.MEDIUM;
          userExperienceImpact = 40;
          warnings.push('Reduced visual complexity compared to original');
          suggestions.push('Use multiple simple models to approximate complex shapes');
          break;

        case 'behavior_simulation':
          modifiedFeature = this.createBehaviorSimulation(feature);
          description = 'Visual effect simulated through entity behaviors and animations';
          impactLevel = CompromiseLevel.MEDIUM;
          userExperienceImpact = 30;
          suggestions.push('Combine with sound effects to enhance the illusion');
          break;

        case 'documentation_stub':
          modifiedFeature = this.createDocumentationStub(feature);
          description = 'Complex rendering documented for manual shader implementation';
          impactLevel = CompromiseLevel.HIGH;
          userExperienceImpact = 75;
          warnings.push('Visual effect will not be present in converted addon');
          warnings.push('Requires custom shader development for full implementation');
          suggestions.push('Consider using Bedrock render dragon features');
          suggestions.push('Implement as resource pack with custom materials');
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
          reversible: analysis.compromiseType !== 'documentation_stub',
        },
      };
    } catch (error) {
      logger.error('Failed to apply rendering compromise strategy', {
        featureName: feature.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        description: 'Failed to apply rendering compromise strategy',
        impactLevel: CompromiseLevel.CRITICAL,
        userExperienceImpact: 100,
        warnings: ['Strategy application failed'],
        suggestions: ['Consider alternative rendering approaches or manual implementation'],
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
    _context: ConversionContext
  ): Promise<{
    impactLevel: CompromiseLevel;
    userExperienceImpact: number;
    confidence: number;
  }> {
    const analysis = this.analyzeRenderingFeature(feature);

    let impactLevel: CompromiseLevel;
    let userExperienceImpact: number;

    switch (analysis.compromiseType) {
      case 'particle_replacement':
        impactLevel = CompromiseLevel.LOW;
        userExperienceImpact = 20;
        break;
      case 'texture_approximation':
        impactLevel = CompromiseLevel.MEDIUM;
        userExperienceImpact = 35;
        break;
      case 'model_simplification':
        impactLevel = CompromiseLevel.MEDIUM;
        userExperienceImpact = 40;
        break;
      case 'behavior_simulation':
        impactLevel = CompromiseLevel.MEDIUM;
        userExperienceImpact = 30;
        break;
      case 'documentation_stub':
        impactLevel = CompromiseLevel.HIGH;
        userExperienceImpact = 75;
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
    return 'Handles custom rendering effects by approximating them with available Bedrock rendering features';
  }

  protected isApplicable(feature: Feature, _context: ConversionContext): boolean {
    if (!this.supportedFeatureTypes.includes(feature.type)) {
      return false;
    }

    // Check for rendering-specific properties
    const properties = feature.properties || {};
    const hasRenderingProps =
      properties.shaderType ||
      properties.renderLayer ||
      properties.particleType ||
      properties.customRenderer;

    return hasRenderingProps || this.hasRenderingKeywords(feature.name);
  }

  /**
   * Check if feature name contains rendering-related keywords
   */
  private hasRenderingKeywords(name: string): boolean {
    const keywords = ['shader', 'render', 'particle', 'effect', 'glow', 'transparency', 'lighting'];
    const lowerName = name.toLowerCase();
    return keywords.some((keyword) => lowerName.includes(keyword));
  }

  /**
   * Analyze the rendering feature to determine the best compromise approach
   */
  private analyzeRenderingFeature(feature: Feature): {
    compromiseType:
      | 'particle_replacement'
      | 'texture_approximation'
      | 'model_simplification'
      | 'behavior_simulation'
      | 'documentation_stub';
    confidence: number;
    alternativesConsidered: string[];
  } {
    const properties = feature.properties || {};
    const alternativesConsidered: string[] = [];

    // Check for particle effects
    if (feature.type === FeatureType.PARTICLE_EFFECT || properties.particleType) {
      alternativesConsidered.push('Particle replacement', 'Entity-based simulation');
      return {
        compromiseType: 'particle_replacement',
        confidence: 85,
        alternativesConsidered,
      };
    }

    // Check for texture-based effects
    if (properties.textureEffect || properties.animatedTexture) {
      alternativesConsidered.push('Texture approximation', 'Animated texture', 'Model replacement');
      return {
        compromiseType: 'texture_approximation',
        confidence: 75,
        alternativesConsidered,
      };
    }

    // Check for 3D model effects
    if (properties.customModel || properties.geometryEffect) {
      alternativesConsidered.push('Model simplification', 'Geometry approximation');
      return {
        compromiseType: 'model_simplification',
        confidence: 70,
        alternativesConsidered,
      };
    }

    // Check for behavior-simulatable effects
    if (properties.animationEffect || properties.movementEffect) {
      alternativesConsidered.push('Behavior simulation', 'Animation-based effect');
      return {
        compromiseType: 'behavior_simulation',
        confidence: 65,
        alternativesConsidered,
      };
    }

    // Complex shader effects need documentation
    alternativesConsidered.push('Manual implementation', 'Feature removal', 'Alternative design');
    return {
      compromiseType: 'documentation_stub',
      confidence: 45,
      alternativesConsidered,
    };
  }

  /**
   * Create a particle-based replacement
   */
  private createParticleReplacement(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.PARTICLE_EFFECT,
      properties: {
        ...feature.properties,
        replacementType: 'particle',
        bedrockParticle: this.mapToBedrockParticle(feature),
        originalRendering: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a texture-based approximation
   */
  private createTextureApproximation(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.TEXTURE,
      properties: {
        ...feature.properties,
        replacementType: 'texture',
        textureModifications: this.generateTextureModifications(feature),
        originalRendering: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a simplified model
   */
  private createModelSimplification(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.MODEL,
      properties: {
        ...feature.properties,
        replacementType: 'simplified_model',
        geometrySimplification: this.generateGeometrySimplification(feature),
        originalRendering: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a behavior-based simulation
   */
  private createBehaviorSimulation(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.BEHAVIOR,
      properties: {
        ...feature.properties,
        replacementType: 'behavior_simulation',
        behaviorScript: this.generateBehaviorScript(feature),
        originalRendering: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a documentation stub
   */
  private createDocumentationStub(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.DOCUMENTATION,
      properties: {
        ...feature.properties,
        implementationType: 'manual_shader',
        documentationPath: `docs/rendering/${feature.name}.md`,
        shaderRequirements: this.analyzeShaderRequirements(feature),
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

  /**
   * Map feature to appropriate Bedrock particle
   */
  private mapToBedrockParticle(feature: Feature): string {
    const properties = feature.properties || {};

    if (properties.glowing || properties.light) {
      return 'minecraft:end_rod';
    }

    if (properties.fire || properties.flame) {
      return 'minecraft:basic_flame_particle';
    }

    if (properties.smoke) {
      return 'minecraft:basic_smoke_particle';
    }

    if (properties.sparkle || properties.magic) {
      return 'minecraft:villager_happy';
    }

    return 'minecraft:heart_particle'; // Default fallback
  }

  /**
   * Generate texture modification instructions
   */
  private generateTextureModifications(feature: Feature): any {
    return {
      animationFrames: feature.properties?.animationFrames || 1,
      glowEffect: feature.properties?.glowing || false,
      transparencyLayers: feature.properties?.transparency || false,
      colorVariations: feature.properties?.colorVariations || [],
    };
  }

  /**
   * Generate geometry simplification instructions
   */
  private generateGeometrySimplification(_feature: Feature): any {
    return {
      maxVertices: 1000, // Bedrock model limits
      simplificationLevel: 'medium',
      preserveMainShape: true,
      removeDetailFeatures: true,
    };
  }

  /**
   * Generate behavior script for simulation
   */
  private generateBehaviorScript(feature: Feature): any {
    return {
      animationType: 'continuous',
      triggerConditions: feature.properties?.triggers || [],
      effectDuration: feature.properties?.duration || 'permanent',
      visualCues: this.extractVisualCues(feature),
    };
  }

  /**
   * Analyze shader requirements for documentation
   */
  private analyzeShaderRequirements(feature: Feature): any {
    return {
      shaderType: feature.properties?.shaderType || 'unknown',
      renderPipeline: feature.properties?.renderPipeline || 'deferred',
      requiredFeatures: feature.properties?.requiredFeatures || [],
      complexity: 'high',
    };
  }

  /**
   * Extract visual cues from feature for behavior simulation
   */
  private extractVisualCues(feature: Feature): string[] {
    const cues: string[] = [];
    const properties = feature.properties || {};

    if (properties.glowing) cues.push('glowing_effect');
    if (properties.moving) cues.push('movement_animation');
    if (properties.pulsing) cues.push('pulsing_animation');
    if (properties.rotating) cues.push('rotation_animation');

    return cues;
  }
}
