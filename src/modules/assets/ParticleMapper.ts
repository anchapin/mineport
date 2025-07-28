import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ParticleMapper');

/**
 * Interface representing a particle definition in Java format
 */
export interface JavaParticleDefinition {
  path: string;
  data: Buffer | object;
  name: string;
  textures?: string[];
  parameters?: Record<string, any>;
}

/**
 * Interface representing a particle definition in Bedrock format
 */
export interface BedrockParticleDefinition {
  path: string;
  data: Buffer | object;
  name: string;
  textures?: string[];
  parameters?: Record<string, any>;
}

/**
 * Interface for particle conversion result
 */
export interface ParticleConversionResult {
  convertedParticles: BedrockParticleDefinition[];
  conversionNotes: ParticleConversionNote[];
}

/**
 * Interface for particle conversion notes/warnings
 */
export interface ParticleConversionNote {
  type: 'info' | 'warning' | 'error';
  message: string;
  particleName?: string;
  fallbackApplied?: boolean;
  fallbackType?: string;
}

/**
 * Enum for fallback strategy types
 */
export enum FallbackStrategyType {
  SIMILAR_PARTICLE = 'similar_particle',
  SIMPLIFIED_EFFECT = 'simplified_effect',
  PLACEHOLDER = 'placeholder',
  OMIT = 'omit'
}

/**
 * Class responsible for mapping Java Edition particle effects to Bedrock Edition
 * and implementing fallback strategies for unmappable particles.
 */
export class ParticleMapper {
  // Mapping dictionary from Java particle names to Bedrock particle names
  private readonly PARTICLE_MAPPING: Record<string, string> = {
    // Vanilla Minecraft particles
    'minecraft:ambient_entity_effect': 'minecraft:mobspell_emitter',
    'minecraft:angry_villager': 'minecraft:villager_angry',
    'minecraft:block': 'minecraft:terrain',
    'minecraft:bubble': 'minecraft:bubble',
    'minecraft:cloud': 'minecraft:evaporation',
    'minecraft:crit': 'minecraft:crit',
    'minecraft:damage_indicator': 'minecraft:critical_hit_emitter',
    'minecraft:dragon_breath': 'minecraft:dragon_breath_trail',
    'minecraft:dripping_lava': 'minecraft:drip_lava',
    'minecraft:dripping_water': 'minecraft:drip_water',
    'minecraft:dust': 'minecraft:redstone_wire_dust',
    'minecraft:effect': 'minecraft:mobspell_emitter',
    'minecraft:elder_guardian': 'minecraft:elder_guardian_curse',
    'minecraft:enchanted_hit': 'minecraft:enchanting_table_particle',
    'minecraft:enchant': 'minecraft:enchanting_table_particle',
    'minecraft:end_rod': 'minecraft:end_rod',
    'minecraft:entity_effect': 'minecraft:mobspell_emitter',
    'minecraft:explosion_emitter': 'minecraft:huge_explosion_emitter',
    'minecraft:explosion': 'minecraft:explosion',
    'minecraft:falling_dust': 'minecraft:falling_dust',
    'minecraft:firework': 'minecraft:fireworks_spark',
    'minecraft:flame': 'minecraft:flame',
    'minecraft:flash': 'minecraft:camera_shoot_explosion',
    'minecraft:happy_villager': 'minecraft:villager_happy',
    'minecraft:heart': 'minecraft:heart',
    'minecraft:instant_effect': 'minecraft:mobspell_emitter',
    'minecraft:item': 'minecraft:breaking_item_icon',
    'minecraft:item_slime': 'minecraft:slime',
    'minecraft:item_snowball': 'minecraft:snowball_poof',
    'minecraft:large_smoke': 'minecraft:large_smoke',
    'minecraft:lava': 'minecraft:lava_drip',
    'minecraft:mycelium': 'minecraft:mycelium_dust',
    'minecraft:nautilus': 'minecraft:nautilus',
    'minecraft:note': 'minecraft:note',
    'minecraft:poof': 'minecraft:explode',
    'minecraft:portal': 'minecraft:portal',
    'minecraft:rain': 'minecraft:water_splash',
    'minecraft:smoke': 'minecraft:smoke',
    'minecraft:sneeze': 'minecraft:sneeze',
    'minecraft:spit': 'minecraft:spit',
    'minecraft:splash': 'minecraft:splash',
    'minecraft:squid_ink': 'minecraft:ink',
    'minecraft:sweep_attack': 'minecraft:slash',
    'minecraft:totem_of_undying': 'minecraft:totem',
    'minecraft:underwater': 'minecraft:underwater_particle',
    'minecraft:witch': 'minecraft:witch_spell_emitter',
    
    // Common mod particles with reasonable mappings
    'create:steam': 'minecraft:evaporation',
    'create:smoke': 'minecraft:smoke',
    'create:spark': 'minecraft:sparkler',
    'botania:wisp': 'minecraft:sparkler',
    'botania:petal': 'minecraft:falling_dust',
    'thaumcraft:flame': 'minecraft:flame',
    'thaumcraft:smoke': 'minecraft:smoke',
    'bloodmagic:blood': 'minecraft:redstone_ore_dust',
    'astralsorcery:sparkle': 'minecraft:sparkler',
    'twilightforest:firefly': 'minecraft:sparkler',
    'twilightforest:snow': 'minecraft:snowflake',
    'mekanism:laser': 'minecraft:colored_flame',
    'thermal:steam': 'minecraft:evaporation'
  };
  
  // Fallback mappings for categories of particles
  private readonly FALLBACK_MAPPING: Record<string, { type: FallbackStrategyType; target: string }> = {
    // Fallbacks by category
    'fire': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:flame' },
    'water': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:water_splash' },
    'smoke': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:smoke' },
    'magic': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:enchanting_table_particle' },
    'dust': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:redstone_wire_dust' },
    'spark': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:sparkler' },
    'explosion': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:explosion' },
    'portal': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:portal' },
    'energy': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:colored_flame' },
    'light': { type: FallbackStrategyType.SIMILAR_PARTICLE, target: 'minecraft:sparkler' },
    'default': { type: FallbackStrategyType.PLACEHOLDER, target: 'minecraft:basic_smoke_particle' }
  };
  
  /**
   * Converts a collection of Java particle definitions to Bedrock format
   * 
   * @param javaParticles - Array of Java particle definitions to convert
   * @returns Conversion result with converted particles and notes
   */
  public async convertParticles(javaParticles: JavaParticleDefinition[]): Promise<ParticleConversionResult> {
    logger.info(`Converting ${javaParticles.length} particle definitions`);
    
    const convertedParticles: BedrockParticleDefinition[] = [];
    const conversionNotes: ParticleConversionNote[] = [];
    
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const javaParticle of javaParticles) {
      try {
        const result = await this.convertSingleParticle(javaParticle);
        convertedParticles.push(result.particle);
        
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (result.note) {
          conversionNotes.push(result.note);
        }
      } catch (error) {
        logger.error(`Failed to convert particle ${javaParticle.name}: ${error}`);
        conversionNotes.push({
          type: 'error',
          message: `Failed to convert particle: ${error instanceof Error ? error.message : String(error)}`,
          particleName: javaParticle.name
        });
      }
    }
    
    return {
      convertedParticles,
      conversionNotes
    };
  }
  
  /**
   * Converts a single Java particle definition to Bedrock format
   * 
   * @param javaParticle - Java particle definition to convert
   * @returns Converted Bedrock particle and any conversion notes
   */
  private async convertSingleParticle(
    javaParticle: JavaParticleDefinition
  ): Promise<{ particle: BedrockParticleDefinition; note?: ParticleConversionNote }> {
    // Map the Java particle path to the corresponding Bedrock path
    const bedrockPath = this.mapParticlePath(javaParticle.path);
    
    // Try to map the particle name directly
    const directMapping = this.PARTICLE_MAPPING[javaParticle.name];
    
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (directMapping) {
      // Direct mapping exists
      logger.info(`Direct mapping found for particle ${javaParticle.name} -> ${directMapping}`);
      
      return {
        particle: {
          path: bedrockPath,
          data: this.generateBedrockParticleData(directMapping, javaParticle),
          name: directMapping,
          textures: javaParticle.textures,
          parameters: javaParticle.parameters
        },
        note: {
          type: 'info',
          message: `Mapped Java particle '${javaParticle.name}' to Bedrock particle '${directMapping}'`,
          particleName: javaParticle.name
        }
      };
    } else {
      // No direct mapping, apply fallback strategy
      const fallbackResult = this.applyFallbackStrategy(javaParticle);
      
      return {
        particle: {
          path: bedrockPath,
          data: this.generateBedrockParticleData(fallbackResult.targetParticle, javaParticle),
          name: fallbackResult.targetParticle,
          textures: javaParticle.textures,
          parameters: javaParticle.parameters
        },
        note: {
          type: 'warning',
          message: `No direct mapping for '${javaParticle.name}'. Applied ${fallbackResult.strategyType} fallback to '${fallbackResult.targetParticle}'`,
          particleName: javaParticle.name,
          fallbackApplied: true,
          fallbackType: fallbackResult.strategyType
        }
      };
    }
  }
  
  /**
   * Maps a Java particle path to the corresponding Bedrock path
   * 
   * @param javaPath - Original Java particle path
   * @returns Mapped Bedrock particle path
   */
  private mapParticlePath(javaPath: string): string {
    // Example mapping logic:
    // Java: assets/modid/particles/example.json
    // Bedrock: particles/example.json
    
    // Extract the relevant parts from the Java path
    const parts = javaPath.split('/');
    const modId = parts[1]; // Extract mod ID for potential namespacing
    
    // Find the particle file name
    let fileName = '';
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'particles' && i + 1 < parts.length) {
        fileName = parts[i + 1];
        break;
      }
    }
    
    // Construct the Bedrock path
    return `particles/${modId}_${fileName}`;
  }
  
  /**
   * Applies a fallback strategy for unmappable particles
   * 
   * @param javaParticle - Java particle that couldn't be directly mapped
   * @returns Fallback strategy result
   */
  private applyFallbackStrategy(
    javaParticle: JavaParticleDefinition
  ): { strategyType: string; targetParticle: string } {
    // Try to determine the particle category from its name
    const particleName = javaParticle.name.toLowerCase();
    
    // Check for category keywords in the particle name
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [category, fallback] of Object.entries(this.FALLBACK_MAPPING)) {
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (particleName.includes(category)) {
        logger.info(`Applied ${fallback.type} fallback for ${javaParticle.name} using category '${category}'`);
        return {
          strategyType: fallback.type,
          targetParticle: fallback.target
        };
      }
    }
    
    // If no category match, use the default fallback
    const defaultFallback = this.FALLBACK_MAPPING.default;
    logger.info(`Applied default ${defaultFallback.type} fallback for ${javaParticle.name}`);
    
    return {
      strategyType: defaultFallback.type,
      targetParticle: defaultFallback.target
    };
  }
  
  /**
   * Generates Bedrock particle data based on the target particle and Java source
   * 
   * @param targetParticle - Target Bedrock particle name
   * @param javaParticle - Source Java particle definition
   * @returns Generated Bedrock particle data
   */
  private generateBedrockParticleData(
    targetParticle: string,
    javaParticle: JavaParticleDefinition
  ): object {
    // Parse the Java particle data if it's a Buffer
    const javaData = typeof javaParticle.data === 'object' && !(javaParticle.data instanceof Buffer)
      ? javaParticle.data as Record<string, any>
      : JSON.parse(javaParticle.data.toString('utf-8'));
    
    // Create a basic Bedrock particle definition
    // The structure differs significantly between Java and Bedrock
    const bedrockData: Record<string, any> = {
      format_version: '1.10.0',
      particle_effect: {
        description: {
          identifier: `${javaParticle.name.replace(':', '_')}`,
          basic_render_parameters: {
            material: 'particles_alpha',
            texture: this.getParticleTexturePath(targetParticle, javaData)
          }
        },
        components: {
          // Map common components from Java to Bedrock where possible
          'minecraft:emitter_rate_instant': {
            num_particles: javaData.count || 1
          },
          'minecraft:emitter_lifetime_once': {
            active_time: 1
          },
          'minecraft:emitter_shape_point': {
            offset: [0, 0, 0]
          },
          'minecraft:particle_lifetime_expression': {
            max_lifetime: javaData.age || 1
          },
          'minecraft:particle_initial_speed': javaData.speed || 0
        }
      }
    };
    
    // Add texture-specific components if textures are defined
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (javaParticle.textures && javaParticle.textures.length > 0) {
      bedrockData.particle_effect.components['minecraft:particle_appearance_billboard'] = {
        size: [javaData.width || 0.1, javaData.height || 0.1],
        facing_camera_mode: 'rotate_xyz',
        uv: {
          texture_width: 16,
          texture_height: 16,
          uv: [0, 0],
          uv_size: [16, 16]
        }
      };
    }
    
    return bedrockData;
  }
  
  /**
   * Gets the appropriate texture path for a Bedrock particle
   * 
   * @param targetParticle - Target Bedrock particle name
   * @param javaData - Java particle data
   * @returns Texture path for the Bedrock particle
   */
  private getParticleTexturePath(targetParticle: string, javaData: Record<string, any>): string {
    // If the Java particle defines textures, use the first one
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (javaData.textures && javaData.textures.length > 0) {
      // Convert Java texture path to Bedrock format
      // Java: textures/particle/example
      // Bedrock: textures/particle/example
      return javaData.textures[0];
    }
    
    // Otherwise, use a default texture based on the target particle
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (targetParticle.startsWith('minecraft:')) {
      // For vanilla particles, use their standard textures
      const particleName = targetParticle.replace('minecraft:', '');
      return `textures/particle/${particleName}`;
    }
    
    // Default fallback texture
    return 'textures/particle/generic';
  }
  
  /**
   * Organizes converted particles according to Bedrock's resource pack structure
   * 
   * @param convertedParticles - Array of converted Bedrock particles
   * @param outputDir - Output directory for the organized particles
   */
  public async organizeParticles(
    convertedParticles: BedrockParticleDefinition[],
    outputDir: string
  ): Promise<void> {
    logger.info(`Organizing ${convertedParticles.length} particles in ${outputDir}`);
    
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const particle of convertedParticles) {
      const outputPath = path.join(outputDir, particle.path);
      const outputDirPath = path.dirname(outputPath);
      
      // Ensure the directory exists
      await fs.mkdir(outputDirPath, { recursive: true });
      
      // Write the particle file
      if (typeof particle.data === 'object') {
        await fs.writeFile(outputPath, JSON.stringify(particle.data, null, 2));
      } else {
        await fs.writeFile(outputPath, particle.data);
      }
      
      // Copy any associated texture files if needed
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (particle.textures && particle.textures.length > 0) {
        await this.copyParticleTextures(particle, outputDir);
      }
    }
  }
  
  /**
   * Copies particle textures to the appropriate location in the Bedrock resource pack
   * 
   * @param particle - Particle with textures to copy
   * @param outputDir - Base output directory
   */
  private async copyParticleTextures(
    particle: BedrockParticleDefinition,
    outputDir: string
  ): Promise<void> {
    // This is a placeholder for actual texture copying logic
    // In a real implementation, this would copy the texture files to the correct location
    logger.info(`Would copy textures for particle ${particle.name}`);
    
    // Example implementation (commented out as we don't have actual texture files to copy)
    /*
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!particle.textures) return;
    
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const texturePath of particle.textures) {
      const sourceTexturePath = `path/to/source/${texturePath}.png`;
      const targetTexturePath = path.join(outputDir, 'textures/particle', `${path.basename(texturePath)}.png`);
      const targetDir = path.dirname(targetTexturePath);
      
      await fs.mkdir(targetDir, { recursive: true });
      await fs.copyFile(sourceTexturePath, targetTexturePath);
    }
    */
  }
}