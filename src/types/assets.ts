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
  data: Buffer;
  metadata?: {
    animated?: boolean;
    frameTime?: number;
    frames?: number[];
  };
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
  data: Buffer;
  metadata?: {
    animated?: boolean;
    frameTime?: number;
    frames?: number[];
  };
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
  data: Buffer | object;
  type: 'block' | 'item' | 'entity';
  metadata?: {
    parent?: string;
    textures?: Record<string, string>;
    elements?: any[];
    display?: Record<string, any>;
  };
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
  data: Buffer | object;
  type: 'block' | 'item' | 'entity';
  metadata?: {
    textures?: Record<string, string>;
    geometry?: string;
    materials?: Record<string, any>;
  };
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
  data: Buffer;
  metadata?: {
    category?: string;
    subtitle?: string;
    stream?: boolean;
    volume?: number;
    pitch?: number;
    weight?: number;
  };
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
  data: Buffer;
  metadata?: {
    category?: string;
    subtitle?: string;
    stream?: boolean;
    volume?: number;
    pitch?: number;
    weight?: number;
  };
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
/**
 * Bedrock particle file interface
 */
export interface BedrockParticleFile {
  path: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Bedrock animation file interface
 */
export interface BedrockAnimationFile {
  path: string;
  content: string;
  metadata?: Record<string, any>;
}
