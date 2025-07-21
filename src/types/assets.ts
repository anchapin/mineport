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

export interface BedrockTextureFile {
  path: string;
  content: Buffer;
  metadata?: Record<string, any>;
}

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

export interface BedrockModelFile {
  path: string;
  content: string;
  type: 'block' | 'item' | 'entity';
  geometryName?: string;
}

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

export interface BedrockSoundFile {
  path: string;
  content: Buffer;
  category?: string;
}

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

export interface BedrockParticleDefinition {
  name: string;
  content: string;
  textures: BedrockTextureFile[];
}

export interface ParticleConversionResult {
  convertedParticles: BedrockParticleDefinition[];
  conversionNotes: any[];
}