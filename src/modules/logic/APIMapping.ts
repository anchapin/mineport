/**
 * APIMapping.ts
 * 
 * This module provides a database of mappings between Java mod APIs and Bedrock script APIs.
 * It supports different types of mappings and includes versioning for different Minecraft versions.
 */

/**
 * Represents a mapping between a Java API and its Bedrock equivalent.
 * This interface defines the core data structure for API translations,
 * including versioning and metadata.
 */
export interface APIMapping {
  /**
   * Unique identifier for the mapping.
   */
  id: string;

  /**
   * The version of this mapping entry as a number (auto-incremented).
   */
  version: number;

  /**
   * The timestamp when this mapping was first created.
   */
  createdAt: Date;

  /**
   * The timestamp of the last update to this mapping.
   */
  lastUpdated: Date;

  /**
   * The fully qualified Java method signature or class name.
   * @example "net.minecraft.world.World.setBlockState"
   */
  javaSignature: string;

  /**
   * The equivalent API call or property in the Bedrock Scripting API.
   * Can be "UNSUPPORTED" if no equivalent exists.
   * @example "dimension.getBlock(location).setPermutation(permutation)"
   */
  bedrockEquivalent: string;

  /**
   * The type of conversion required to map the Java API to Bedrock.
   * - `direct`: A direct, one-to-one mapping.
   * - `wrapper`: The Bedrock API requires a wrapper or helper function.
   * - `complex`: A complex transformation is needed, potentially involving state management.
   * - `impossible`: The functionality cannot be replicated in Bedrock.
   */
  conversionType: 'direct' | 'wrapper' | 'complex' | 'impossible';

  /**
   * Additional notes, implementation details, or warnings about the mapping.
   */
  notes: string;

  /**
   * Whether this mapping is deprecated and should not be used for new conversions.
   */
  deprecated?: boolean;

  /**
   * Optional code examples demonstrating the usage in both Java and Bedrock.
   */
  exampleUsage?: {
    java: string;
    bedrock: string;
  };

  /**
   * The Minecraft versions for which this mapping is applicable.
   * If not specified, it is considered applicable to all versions.
   */
  minecraftVersions?: string[];

  /**
   * The mod loaders for which this mapping is relevant.
   * If not specified, it is considered applicable to all mod loaders.
   */
  modLoaders?: ('forge' | 'fabric')[];

  /**
   * Additional metadata for extensibility and future-proofing.
   */
  metadata?: { [key: string]: any };
}

/**
 * Validates an APIMapping object for correctness
 * @param mapping The mapping object to validate
 * @throws Error if the mapping is invalid
 */
export function validateAPIMapping(mapping: Partial<APIMapping>): void {
  if (!mapping.javaSignature || typeof mapping.javaSignature !== 'string' || mapping.javaSignature.trim().length === 0) {
    throw new Error('Java signature is required and must be a non-empty string');
  }
  
  if (!mapping.bedrockEquivalent || typeof mapping.bedrockEquivalent !== 'string' || mapping.bedrockEquivalent.trim().length === 0) {
    throw new Error('Bedrock equivalent is required and must be a non-empty string');
  }
  
  const validConversionTypes = ['direct', 'wrapper', 'complex', 'impossible'];
  if (!mapping.conversionType || !validConversionTypes.includes(mapping.conversionType)) {
    throw new Error(`Conversion type must be one of: ${validConversionTypes.join(', ')}`);
  }
  
  if (mapping.notes !== undefined && typeof mapping.notes !== 'string') {
    throw new Error('Notes must be a string if provided');
  }
  
  if (mapping.deprecated !== undefined && typeof mapping.deprecated !== 'boolean') {
    throw new Error('Deprecated must be a boolean if provided');
  }
  
  if (mapping.version !== undefined && (typeof mapping.version !== 'number' || mapping.version < 1)) {
    throw new Error('Version must be a positive number if provided');
  }
  
  if (mapping.createdAt !== undefined && !(mapping.createdAt instanceof Date)) {
    throw new Error('createdAt must be a Date object if provided');
  }
  
  if (mapping.lastUpdated !== undefined && !(mapping.lastUpdated instanceof Date)) {
    throw new Error('lastUpdated must be a Date object if provided');
  }
  
  if (mapping.minecraftVersions !== undefined && !Array.isArray(mapping.minecraftVersions)) {
    throw new Error('minecraftVersions must be an array if provided');
  }
  
  if (mapping.modLoaders !== undefined) {
    if (!Array.isArray(mapping.modLoaders)) {
      throw new Error('modLoaders must be an array if provided');
    }
    const validLoaders = ['forge', 'fabric'];
    for (const loader of mapping.modLoaders) {
      if (!validLoaders.includes(loader)) {
        throw new Error(`Invalid mod loader: ${loader}. Must be one of: ${validLoaders.join(', ')}`);
      }
    }
  }
}
