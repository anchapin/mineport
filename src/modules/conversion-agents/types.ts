/**
 * Type definitions for conversion agents
 */

import { ConversionError, AssetConversionNote } from '../../types/errors';

/**
 * Information about a texture to be converted
 */
export interface TextureInfo {
  path: string;
  name: string;
  type: 'block' | 'item' | 'entity' | 'gui' | 'other';
  buffer: Buffer;
  width?: number;
  height?: number;
  format?: string;
}

/**
 * Information about a sound file to be converted
 */
export interface SoundInfo {
  path: string;
  name: string;
  category: 'ambient' | 'block' | 'hostile' | 'master' | 'music' | 'neutral' | 'player' | 'record' | 'voice' | 'weather';
  buffer: Buffer;
  format: string;
  duration?: number;
}

/**
 * Information about a model to be converted
 */
export interface ModelInfo {
  path: string;
  name: string;
  type: 'block' | 'item' | 'entity';
  content: any; // Java model JSON structure
  textures?: Record<string, string>;
}

/**
 * Result of a conversion operation
 */
export interface ConversionResult {
  success: boolean;
  outputFiles: OutputFile[];
  errors: ConversionError[];
  warnings: AssetConversionNote[];
  metadata: ConversionMetadata;
}

/**
 * Metadata about the conversion process
 */
export interface ConversionMetadata {
  processedCount: number;
  successCount: number;
  failureCount: number;
  processingTime: number;
  totalSize: number;
  compressionRatio?: number;
}

/**
 * An output file from conversion
 */
export interface OutputFile {
  path: string;
  content: Buffer | string;
  type: 'texture' | 'model' | 'sound' | 'json' | 'manifest';
  originalPath?: string;
}

/**
 * Optimized texture result
 */
export interface OptimizedTexture {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  compressionRatio: number;
}

/**
 * Bedrock model structure
 */
export interface BedrockModel {
  format_version: string;
  'minecraft:geometry': BedrockGeometry[];
}

/**
 * Bedrock geometry definition
 */
export interface BedrockGeometry {
  description: {
    identifier: string;
    texture_width: number;
    texture_height: number;
    visible_bounds_width?: number;
    visible_bounds_height?: number;
    visible_bounds_offset?: [number, number, number];
  };
  bones: BedrockBone[];
}

/**
 * Bedrock bone definition
 */
export interface BedrockBone {
  name: string;
  parent?: string;
  pivot?: [number, number, number];
  rotation?: [number, number, number];
  cubes?: BedrockCube[];
}

/**
 * Bedrock cube definition
 */
export interface BedrockCube {
  origin: [number, number, number];
  size: [number, number, number];
  uv?: [number, number] | Record<string, [number, number]>;
  rotation?: [number, number, number];
  pivot?: [number, number, number];
  inflate?: number;
  mirror?: boolean;
}

/**
 * Addon structure definition
 */
export interface AddonStructure {
  behaviorPack: PackStructure;
  resourcePack: PackStructure;
  sharedFiles: string[];
}

/**
 * Pack structure definition
 */
export interface PackStructure {
  manifest: any;
  directories: Record<string, string[]>;
  files: Record<string, any>;
}

/**
 * Block information for generation
 */
export interface BlockInfo {
  identifier: string;
  displayName: string;
  textures: Record<string, string>;
  properties?: Record<string, any>;
  components?: Record<string, any>;
  permutations?: any[];
}

/**
 * Item information for generation
 */
export interface ItemInfo {
  identifier: string;
  displayName: string;
  texture?: string;
  components?: Record<string, any>;
  category?: string;
  maxStackSize?: number;
}

/**
 * Recipe information for generation
 */
export interface RecipeInfo {
  identifier: string;
  type: 'crafting_shaped' | 'crafting_shapeless' | 'furnace' | 'stonecutter' | 'smithing';
  input: any;
  output: any;
  tags?: string[];
}

/**
 * Block definition for Bedrock
 */
export interface BlockDefinition {
  format_version: string;
  'minecraft:block': {
    description: {
      identifier: string;
      properties?: Record<string, any>;
      states?: Record<string, any>;
    };
    components: Record<string, any>;
    permutations?: any[];
  };
}

/**
 * Item definition for Bedrock
 */
export interface ItemDefinition {
  format_version: string;
  'minecraft:item': {
    description: {
      identifier: string;
      category?: string;
    };
    components: Record<string, any>;
  };
}

/**
 * Recipe definition for Bedrock
 */
export interface RecipeDefinition {
  format_version: string;
  'minecraft:recipe_shaped'?: any;
  'minecraft:recipe_shapeless'?: any;
  'minecraft:recipe_furnace'?: any;
}