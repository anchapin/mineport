/**
 * Interface definitions for module inputs and outputs
 * 
 * This file contains shared interfaces used across different modules
 * to ensure consistent data structures throughout the application.
 */
import { JavaSourceFile } from './base';
import { LogicConversionNote, AssetConversionNote } from './errors';
import { APIMapping } from './api';
import { 
  JavaTextureFile, BedrockTextureFile, TextureConversionResult,
  JavaModelFile, BedrockModelFile, ModelConversionResult,
  JavaSoundFile, BedrockSoundFile, SoundConversionResult,
  JavaParticleDefinition, BedrockParticleDefinition, ParticleConversionResult
} from './assets';

/**
 * Logic Translation Module Types
 */

/**
 * Input for the logic translation process
 */
export interface LogicTranslationInput {
  javaSourceFiles: JavaSourceFile[];
  mmirContext?: MMIRContext;
  apiMappingDictionary?: APIMapping[];
}

/**
 * Output from the logic translation process
 */
export interface LogicTranslationOutput {
  javascriptFiles: JavaScriptFile[];
  stubFunctions: StubFunction[];
  conversionNotes: LogicConversionNote[];
}

/**
 * Represents a JavaScript output file
 */
export interface JavaScriptFile {
  path: string;
  content: string;
  sourceMap?: string;
}

/**
 * Represents a stub function for features that couldn't be fully translated
 */
export interface StubFunction {
  name: string;
  originalJavaCode: string;
  javascriptStub: string;
  reason: string;
  suggestedAlternatives?: string[];
  featureId?: string;
  strategyApplied?: string;
}

/**
 * Represents a feature that needs a compromise strategy
 */
export interface LogicFeature {
  id: string;
  name: string;
  description: string;
  type: string;
  compatibilityTier: 1 | 2 | 3 | 4;
  sourceFiles: string[];
  sourceLineNumbers: number[][];
  originalCode: string;
  context?: string;
}

/**
 * Represents the Minecraft Modding Intermediate Representation context
 */
export interface MMIRContext {
  nodes: MMIRNode[];
  relationships: MMIRRelationship[];
  metadata: MMIRMetadata;
}

/**
 * Represents a node in the MMIR
 */
export interface MMIRNode {
  id: string;
  type: string;
  sourceLocation: {
    file: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  properties: Record<string, any>;
  children: string[];
}

/**
 * Represents a relationship between MMIR nodes
 */
export interface MMIRRelationship {
  id: string;
  type: string;
  sourceNodeId: string;
  targetNodeId: string;
  properties: Record<string, any>;
}

/**
 * Represents metadata for the MMIR
 */
export interface MMIRMetadata {
  modId: string;
  modName: string;
  modVersion: string;
  modLoader: 'forge' | 'fabric';
  minecraftVersion: string;
}

/**
 * Asset Translation Module Types
 */

/**
 * Interface for Java assets collection
 * 
 * This interface follows the naming convention guidelines for asset collections.
 */
export interface JavaAssetCollection {
  textures: JavaTextureFile[];
  models: JavaModelFile[];
  sounds: JavaSoundFile[];
  particles: JavaParticleDefinition[];
}

/**
 * Interface for Bedrock assets collection
 * 
 * This interface follows the naming convention guidelines for asset collections.
 */
export interface BedrockAssetCollection {
  textures: BedrockTextureFile[];
  models: BedrockModelFile[];
  sounds: BedrockSoundFile[];
  particles: BedrockParticleDefinition[];
  soundsJson: object;
}

/**
 * Alias for JavaAssetCollection to maintain backward compatibility
 * @deprecated Use JavaAssetCollection instead
 */
export interface JavaAssets extends JavaAssetCollection {}

/**
 * Alias for BedrockAssetCollection to maintain backward compatibility
 * @deprecated Use BedrockAssetCollection instead
 */
export interface BedrockAssets extends BedrockAssetCollection {}

/**
 * Interface for asset translation result
 * 
 * This interface follows the naming convention guidelines for translation results.
 */
export interface AssetTranslationResult {
  bedrockAssets: BedrockAssetCollection;
  conversionNotes: AssetConversionNote[];
}