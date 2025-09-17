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
 * Database of API mappings
 */
export class APIMappingDatabase {
  private mappings: Map<string, APIMapping> = new Map();

  /**
   * Creates a new APIMappingDatabase instance
   */
  constructor() {
    this.initializeDefaultMappings();
  }

  /**
   * Initialize default API mappings
   */
  private initializeDefaultMappings(): void {
    // Event mappings
    this.addMapping({
      javaSignature: 'net.minecraftforge.event.entity.player.PlayerEvent.PlayerLoggedInEvent',
      bedrockEquivalent: 'system.events.playerJoin',
      conversionType: 'direct',
      notes: 'Player join event mapping',
      exampleUsage: {
        java: '@SubscribeEvent\npublic void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event) { ... }',
        bedrock: 'system.events.playerJoin.subscribe(event => { ... });',
      },
      modLoaders: ['forge'],
    });

    this.addMapping({
      javaSignature: 'net.minecraftforge.event.entity.player.PlayerEvent.PlayerLoggedOutEvent',
      bedrockEquivalent: 'system.events.playerLeave',
      conversionType: 'direct',
      notes: 'Player leave event mapping',
      modLoaders: ['forge'],
    });

    this.addMapping({
      javaSignature:
        'net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents.ServerStarted',
      bedrockEquivalent: 'system.events.worldInitialize',
      conversionType: 'direct',
      notes: 'Server started event mapping',
      modLoaders: ['fabric'],
    });

    // Block/Item registration mappings
    this.addMapping({
      javaSignature: 'net.minecraft.util.registry.Registry.register(Registry.BLOCK, ...)',
      bedrockEquivalent: 'system.registerBlock',
      conversionType: 'wrapper',
      notes: 'Block registration with parameter transformation',
      modLoaders: ['fabric'],
    });

    this.addMapping({
      javaSignature:
        'net.minecraftforge.registries.DeferredRegister.create(ForgeRegistries.BLOCKS, ...)',
      bedrockEquivalent: 'system.registerBlock',
      conversionType: 'complex',
      notes: 'Forge block registration system',
      modLoaders: ['forge'],
    });

    this.addMapping({
      javaSignature: 'net.minecraft.util.registry.Registry.register(Registry.ITEM, ...)',
      bedrockEquivalent: 'system.registerItem',
      conversionType: 'wrapper',
      notes: 'Item registration with parameter transformation',
      modLoaders: ['fabric'],
    });

    this.addMapping({
      javaSignature:
        'net.minecraftforge.registries.DeferredRegister.create(ForgeRegistries.ITEMS, ...)',
      bedrockEquivalent: 'system.registerItem',
      conversionType: 'complex',
      notes: 'Forge item registration system',
      modLoaders: ['forge'],
    });

    // Entity mappings
    this.addMapping({
      javaSignature: 'net.minecraft.entity.Entity.getPosition',
      bedrockEquivalent: 'entity.location',
      conversionType: 'direct',
      notes: 'Entity position property',
      minecraftVersions: ['1.16.5', '1.17.1', '1.18.2'],
    });

    this.addMapping({
      javaSignature: 'net.minecraft.entity.player.PlayerEntity.getGameProfile().getName()',
      bedrockEquivalent: 'player.name',
      conversionType: 'direct',
      notes: 'Player name property',
    });

    // World interaction mappings
    this.addMapping({
      javaSignature: 'net.minecraft.world.World.setBlockState',
      bedrockEquivalent: 'dimension.getBlock().setPermutation',
      conversionType: 'wrapper',
      notes: 'Setting block state requires coordinate transformation',
      exampleUsage: {
        java: 'world.setBlockState(pos, Blocks.STONE.getDefaultState());',
        bedrock:
          'const block = dimension.getBlock(pos);\nblock.setPermutation(BlockPermutation.resolve("minecraft:stone"));',
      },
    });

    this.addMapping({
      javaSignature: 'net.minecraft.world.World.getBlockState',
      bedrockEquivalent: 'dimension.getBlock().permutation',
      conversionType: 'wrapper',
      notes: 'Getting block state requires coordinate transformation',
    });

    // Impossible mappings (for demonstration)
    this.addMapping({
      javaSignature: 'net.minecraft.client.renderer.RenderType',
      bedrockEquivalent: 'UNSUPPORTED',
      conversionType: 'impossible',
      notes: 'Client-side rendering is not supported in Bedrock scripting',
    });

    this.addMapping({
      javaSignature: 'net.minecraft.world.gen.feature.ConfiguredFeature',
      bedrockEquivalent: 'UNSUPPORTED',
      conversionType: 'impossible',
      notes: 'Custom world generation features are not supported in Bedrock scripting',
    });
  }

  /**
   * Add a mapping to the database
   * @param mapping The mapping to add
   */
  public addMapping(mapping: APIMapping): void {
    this.mappings.set(mapping.javaSignature, mapping);
  }

  /**
   * Get a mapping by Java signature
   * @param javaSignature The Java signature to look up
   * @returns The mapping if found, undefined otherwise
   */
  public getMapping(javaSignature: string): APIMapping | undefined {
    return this.mappings.get(javaSignature);
  }

  /**
   * Find mappings that match a partial Java signature
   * @param partialSignature Part of a Java signature to match
   * @returns Array of matching mappings
   */
  public findMappings(partialSignature: string): APIMapping[] {
    const results: APIMapping[] = [];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [signature, mapping] of this.mappings.entries()) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (signature.includes(partialSignature)) {
        results.push(mapping);
      }
    }

    return results;
  }

  /**
   * Get all mappings for a specific mod loader
   * @param modLoader The mod loader to filter by ('forge' or 'fabric')
   * @returns Array of mappings for the specified mod loader
   */
  public getMappingsForModLoader(modLoader: 'forge' | 'fabric'): APIMapping[] {
    const results: APIMapping[] = [];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const mapping of this.mappings.values()) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!mapping.modLoaders || mapping.modLoaders.includes(modLoader)) {
        results.push(mapping);
      }
    }

    return results;
  }

  /**
   * Get all mappings for a specific Minecraft version
   * @param version The Minecraft version to filter by
   * @returns Array of mappings for the specified version
   */
  public getMappingsForVersion(version: string): APIMapping[] {
    const results: APIMapping[] = [];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const mapping of this.mappings.values()) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!mapping.minecraftVersions || mapping.minecraftVersions.includes(version)) {
        results.push(mapping);
      }
    }

    return results;
  }

  /**
   * Get all mappings by conversion type
   * @param conversionType The conversion type to filter by
   * @returns Array of mappings with the specified conversion type
   */
  public getMappingsByType(
    conversionType: 'direct' | 'wrapper' | 'complex' | 'impossible'
  ): APIMapping[] {
    const results: APIMapping[] = [];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const mapping of this.mappings.values()) {
      if (mapping.conversionType === conversionType) {
        results.push(mapping);
      }
    }

    return results;
  }

  /**
   * Get all mappings in the database
   * @returns Array of all mappings
   */
  public getAllMappings(): APIMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Get the number of mappings in the database
   * @returns The number of mappings
   */
  public getMappingCount(): number {
    return this.mappings.size;
  }
}

/**
 * Factory function to create an APIMappingDatabase instance
 * @returns A new APIMappingDatabase instance
 */
export function createAPIMappingDatabase(): APIMappingDatabase {
  return new APIMappingDatabase();
}
