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
   * The version of this mapping entry. Follows semantic versioning.
   */
  version: string;

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
}