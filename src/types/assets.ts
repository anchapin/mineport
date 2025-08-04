/**
 * Asset-related type definitions
 *
 * This file contains interfaces related to assets like textures, models,
 * sounds, and particles used in the conversion process.
 */

/**
 * Texture types
 */
export interface JavaTextureFile {
  path: string;
  content: Buffer;
  metadata?: Record<string, any>;
}

/**
 * BedrockTextureFile interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockTextureFile {
  path: string;
  content: Buffer;
  metadata?: Record<string, any>;
}

/**
 * TextureConversionResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface TextureConversionResult {
  convertedTextures: BedrockTextureFile[];
  conversionNotes: any[];
}

/**
 * Model types
 */
export interface JavaModelFile {
  path: string;
  content: string;
  type: 'block' | 'item' | 'entity';
}

/**
 * BedrockModelFile interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockModelFile {
  path: string;
  content: string;
  type: 'block' | 'item' | 'entity';
  geometryName?: string;
}

/**
 * ModelConversionResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface ModelConversionResult {
  convertedModels: BedrockModelFile[];
  conversionNotes: any[];
}

/**
 * Sound types
 */
export interface JavaSoundFile {
  path: string;
  content: Buffer;
  category?: string;
}

/**
 * BedrockSoundFile interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockSoundFile {
  path: string;
  content: Buffer;
  category?: string;
}

/**
 * SoundConversionResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface SoundConversionResult {
  convertedSounds: BedrockSoundFile[];
  soundsJson: object;
  conversionNotes: any[];
}

/**
 * Particle types
 */
export interface JavaParticleDefinition {
  name: string;
  content: string;
  textures: JavaTextureFile[];
}

/**
 * BedrockParticleDefinition interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockParticleDefinition {
  name: string;
  content: string;
  textures: BedrockTextureFile[];
}

/**
 * ParticleConversionResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface ParticleConversionResult {
  convertedParticles: BedrockParticleDefinition[];
  conversionNotes: any[];
}
