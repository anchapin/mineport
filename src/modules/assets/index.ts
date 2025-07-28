/**
 * Asset Translation Module
 * 
 * This module is responsible for converting and translating asset files from Java mods
 * to Bedrock addon format. It includes components for texture conversion, model conversion,
 * sound processing, particle mapping, and overall asset translation orchestration.
 * 
 * Public API:
 * - TextureConverter: Converts Java mod textures to Bedrock format
 * - ModelConverter: Converts Java mod models to Bedrock format  
 * - SoundProcessor: Processes and converts sound files
 * - ParticleMapper: Maps Java particle effects to Bedrock equivalents
 * - AssetTranslationModule: Main orchestrator for asset translation
 */

// Export all individual components
export * from './TextureConverter';
export * from './ModelConverter';
export * from './SoundProcessor';
export * from './ParticleMapper';
export * from './AssetTranslationModule';

// Re-export the main module class as default for convenience
export { AssetTranslationModule as default } from './AssetTranslationModule';