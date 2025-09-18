/**
 * Conversion agents module exports
 *
 * This module provides specialized conversion agents for different types of assets
 * and addon structure generation.
 */

export { AssetConverter } from './AssetConverter.js';
export { BedrockArchitect } from './BedrockArchitect.js';
export { BlockItemGenerator } from './BlockItemGenerator.js';

export type {
  TextureInfo,
  SoundInfo,
  ModelInfo,
  ConversionAgentResult,
  ConversionMetadata,
  OptimizedTexture,
  BedrockModel,
  AddonStructure,
  PackStructure,
  BlockInfo,
  ItemInfo,
  RecipeInfo,
  BlockDefinition,
  ItemDefinition,
  RecipeDefinition,
} from './types.js';
