/**
 * API Mapper Service
 *
 * Service for managing and providing access to Java-to-Bedrock API mappings.
 * Implements database integration, versioning, and caching for API mappings.
 */

import { APIMapping, APIMapperService, MappingFilter, ImportResult } from '../types/api.js';
import { createLogger } from '../utils/logger.js';
import { ErrorHandler, globalErrorCollector } from '../utils/errorHandler.js';
import { ErrorSeverity, createErrorCode } from '../types/errors.js';
import { ConfigurationService } from './ConfigurationService.js';

const logger = createLogger('APIMapperService');
const MODULE_ID = 'API_MAPPER';

/**
 * Database interface for API mappings storage
 */
interface MappingDatabase {
  /**
   * get method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  get(id: string): Promise<APIMapping | undefined>;
  /**
   * getBySignature method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getBySignature(javaSignature: string): Promise<APIMapping | undefined>;
  /**
   * getAll method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getAll(filter?: MappingFilter): Promise<APIMapping[]>;
  /**
   * save method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  save(mapping: APIMapping): Promise<void>;
  /**
   * update method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  update(mapping: APIMapping): Promise<void>;
  /**
   * delete method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  delete(id: string): Promise<void>;
  /**
   * count method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  count(): Promise<number>;
}

/**
 * In-memory database implementation for API mappings
 * In a production environment, this would be replaced with a proper database
 */
class InMemoryMappingDatabase implements MappingDatabase {
  private mappings: Map<string, APIMapping> = new Map();
  private signatureIndex: Map<string, string> = new Map(); // signature -> id mapping

  /**
   * get method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  async get(id: string): Promise<APIMapping | undefined> {
    return this.mappings.get(id);
  }

  /**
   * getBySignature method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  async getBySignature(javaSignature: string): Promise<APIMapping | undefined> {
    const id = this.signatureIndex.get(javaSignature);
    return id ? this.mappings.get(id) : undefined;
  }

  /**
   * getAll method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  async getAll(filter?: MappingFilter): Promise<APIMapping[]> {
    let mappings = Array.from(this.mappings.values());

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (filter) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter.conversionType) {
        mappings = mappings.filter((m) => m.conversionType === filter.conversionType);
      }
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter.version) {
        mappings = mappings.filter((m) => m.version === filter.version);
      }
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        mappings = mappings.filter(
          (m) =>
            m.javaSignature.toLowerCase().includes(searchLower) ||
            m.bedrockEquivalent.toLowerCase().includes(searchLower) ||
            m.notes.toLowerCase().includes(searchLower)
        );
      }
    }

    return mappings;
  }

  /**
   * save method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  async save(mapping: APIMapping): Promise<void> {
    this.mappings.set(mapping.id, mapping);
    this.signatureIndex.set(mapping.javaSignature, mapping.id);
  }

  /**
   * update method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  async update(mapping: APIMapping): Promise<void> {
    const existing = this.mappings.get(mapping.id);
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (existing) {
      // Update signature index if signature changed
      if (existing.javaSignature !== mapping.javaSignature) {
        this.signatureIndex.delete(existing.javaSignature);
        this.signatureIndex.set(mapping.javaSignature, mapping.id);
      }
      this.mappings.set(mapping.id, mapping);
    } else {
      throw new Error(`Mapping with id ${mapping.id} not found`);
    }
  }

  /**
   * delete method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  async delete(id: string): Promise<void> {
    const mapping = this.mappings.get(id);
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (mapping) {
      this.mappings.delete(id);
      this.signatureIndex.delete(mapping.javaSignature);
    }
  }

  /**
   * count method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  async count(): Promise<number> {
    return this.mappings.size;
  }
}

/**
 * Implementation of the API Mapper Service
 */
export class APIMapperServiceImpl implements APIMapperService {
  private database: MappingDatabase;
  private cache: Map<string, APIMapping> = new Map();
  private cacheEnabled: boolean = true;
  private cacheMaxSize: number = 1000;
  private configService: ConfigurationService;

  /**
   * constructor method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  constructor(configService: ConfigurationService, database?: MappingDatabase) {
    this.configService = configService;
    this.database = database || new InMemoryMappingDatabase();

    // Load configuration
    this.cacheEnabled = this.configService.get('apiMapper.cacheEnabled', true);
    this.cacheMaxSize = this.configService.get('apiMapper.cacheMaxSize', 1000);

    logger.info('APIMapperService initialized', {
      cacheEnabled: this.cacheEnabled,
      cacheMaxSize: this.cacheMaxSize,
    });

    // Initialize with default mappings
    this.initializeDefaultMappings();
  }

  /**
   * Get a mapping by Java signature
   */
  async getMapping(javaSignature: string): Promise<APIMapping | undefined> {
    try {
      // Check cache first
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (this.cacheEnabled && this.cache.has(javaSignature)) {
        logger.debug(`Cache hit for signature: ${javaSignature}`);
        return this.cache.get(javaSignature);
      }

      // Query database
      const mapping = await this.database.getBySignature(javaSignature);

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (mapping && this.cacheEnabled) {
        this.addToCache(javaSignature, mapping);
      }

      logger.debug(`Retrieved mapping for signature: ${javaSignature}`, { found: !!mapping });
      return mapping;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error retrieving mapping for signature ${javaSignature}: ${errorMessage}`, {
        error,
      });

      ErrorHandler.systemError(
        `Failed to retrieve API mapping: ${errorMessage}`,
        MODULE_ID,
        { javaSignature, originalError: error },
        ErrorSeverity.ERROR,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'GET_MAPPING', 1)
      );

      return undefined;
    }
  }

  /**
   * Get mappings with optional filtering
   */
  async getMappings(filter?: MappingFilter): Promise<APIMapping[]> {
    try {
      const mappings = await this.database.getAll(filter);
      logger.debug(`Retrieved ${mappings.length} mappings`, { filter });
      return mappings;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error retrieving mappings: ${errorMessage}`, { error, filter });

      ErrorHandler.systemError(
        `Failed to retrieve API mappings: ${errorMessage}`,
        MODULE_ID,
        { filter, originalError: error },
        ErrorSeverity.ERROR,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'GET_MAPPINGS', 1)
      );

      return [];
    }
  }

  /**
   * Add a new mapping
   */
  async addMapping(mapping: APIMapping): Promise<void> {
    try {
      // Validate mapping
      this.validateMapping(mapping);

      // Check if mapping already exists
      const existing = await this.database.getBySignature(mapping.javaSignature);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (existing) {
        throw new Error(`Mapping for signature '${mapping.javaSignature}' already exists`);
      }

      // Set metadata
      mapping.lastUpdated = new Date();

      // Save to database
      await this.database.save(mapping);

      // Update cache
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (this.cacheEnabled) {
        this.addToCache(mapping.javaSignature, mapping);
      }

      logger.info(`Added new mapping: ${mapping.javaSignature} -> ${mapping.bedrockEquivalent}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error adding mapping: ${errorMessage}`, { error, mapping });

      ErrorHandler.systemError(
        `Failed to add API mapping: ${errorMessage}`,
        MODULE_ID,
        { mapping, originalError: error },
        ErrorSeverity.ERROR,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'ADD_MAPPING', 1)
      );

      throw error;
    }
  }

  /**
   * Update an existing mapping
   */
  async updateMapping(mapping: APIMapping): Promise<void> {
    try {
      // Validate mapping
      this.validateMapping(mapping);

      // Update metadata
      mapping.lastUpdated = new Date();

      // Update in database
      await this.database.update(mapping);

      // Update cache
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (this.cacheEnabled) {
        this.addToCache(mapping.javaSignature, mapping);
      }

      logger.info(`Updated mapping: ${mapping.javaSignature} -> ${mapping.bedrockEquivalent}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error updating mapping: ${errorMessage}`, { error, mapping });

      ErrorHandler.systemError(
        `Failed to update API mapping: ${errorMessage}`,
        MODULE_ID,
        { mapping, originalError: error },
        ErrorSeverity.ERROR,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'UPDATE_MAPPING', 1)
      );

      throw error;
    }
  }

  /**
   * Import multiple mappings
   */
  async importMappings(mappings: APIMapping[]): Promise<ImportResult> {
    const result: ImportResult = {
      added: 0,
      updated: 0,
      failed: 0,
      failures: [],
    };

    logger.info(`Starting import of ${mappings.length} mappings`);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const mapping of mappings) {
      try {
        // Validate mapping
        this.validateMapping(mapping);

        // Check if mapping exists
        const existing = await this.database.getBySignature(mapping.javaSignature);

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (existing) {
          // Update existing mapping
          mapping.lastUpdated = new Date();
          await this.database.update({ ...mapping, id: existing.id });
          result.updated++;

          // Update cache
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (this.cacheEnabled) {
            this.addToCache(mapping.javaSignature, { ...mapping, id: existing.id });
          }
        } else {
          // Add new mapping
          mapping.lastUpdated = new Date();
          await this.database.save(mapping);
          result.added++;

          // Update cache
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (this.cacheEnabled) {
            this.addToCache(mapping.javaSignature, mapping);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed++;
        result.failures.push({
          mapping,
          reason: errorMessage,
        });

        logger.warn(`Failed to import mapping ${mapping.javaSignature}: ${errorMessage}`);
      }
    }

    logger.info(`Import completed`, result);
    return result;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('API mapping cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; enabled: boolean } {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      enabled: this.cacheEnabled,
    };
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{ totalMappings: number }> {
    const totalMappings = await this.database.count();
    return { totalMappings };
  }

  /**
   * Validate a mapping object
   */
  private validateMapping(mapping: APIMapping): void {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!mapping.id) {
      throw new Error('Mapping ID is required');
    }
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!mapping.javaSignature) {
      throw new Error('Java signature is required');
    }
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!mapping.bedrockEquivalent) {
      throw new Error('Bedrock equivalent is required');
    }
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!mapping.conversionType) {
      throw new Error('Conversion type is required');
    }
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!['direct', 'wrapper', 'complex', 'impossible'].includes(mapping.conversionType)) {
      throw new Error('Invalid conversion type');
    }
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!mapping.version) {
      throw new Error('Version is required');
    }
  }

  /**
   * Add mapping to cache with size management
   */
  private addToCache(signature: string, mapping: APIMapping): void {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!this.cacheEnabled) return;

    // Remove oldest entry if cache is full
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(signature, mapping);
  }

  /**
   * Initialize default mappings
   */
  private async initializeDefaultMappings(): Promise<void> {
    try {
      const defaultMappings: APIMapping[] = [
        {
          id: 'player-join-event',
          javaSignature: 'net.minecraftforge.event.entity.player.PlayerEvent.PlayerLoggedInEvent',
          bedrockEquivalent: 'system.events.playerJoin',
          conversionType: 'direct',
          notes: 'Player join event mapping',
          version: '1.0.0',
          lastUpdated: new Date(),
          exampleUsage: {
            java: '@SubscribeEvent\npublic void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event) { ... }',
            bedrock: 'system.events.playerJoin.subscribe(event => { ... });',
          },
        },
        {
          id: 'player-leave-event',
          javaSignature: 'net.minecraftforge.event.entity.player.PlayerEvent.PlayerLoggedOutEvent',
          bedrockEquivalent: 'system.events.playerLeave',
          conversionType: 'direct',
          notes: 'Player leave event mapping',
          version: '1.0.0',
          lastUpdated: new Date(),
        },
        {
          id: 'entity-position',
          javaSignature: 'net.minecraft.entity.Entity.getPosition',
          bedrockEquivalent: 'entity.location',
          conversionType: 'direct',
          notes: 'Entity position property',
          version: '1.0.0',
          lastUpdated: new Date(),
        },
        {
          id: 'world-set-block',
          javaSignature: 'net.minecraft.world.World.setBlockState',
          bedrockEquivalent: 'dimension.getBlock().setPermutation',
          conversionType: 'wrapper',
          notes: 'Setting block state requires coordinate transformation',
          version: '1.0.0',
          lastUpdated: new Date(),
          exampleUsage: {
            java: 'world.setBlockState(pos, Blocks.STONE.getDefaultState());',
            bedrock:
              'const block = dimension.getBlock(pos);\nblock.setPermutation(BlockPermutation.resolve("minecraft:stone"));',
          },
        },
        {
          id: 'client-rendering',
          javaSignature: 'net.minecraft.client.renderer.RenderType',
          bedrockEquivalent: 'UNSUPPORTED',
          conversionType: 'impossible',
          notes: 'Client-side rendering is not supported in Bedrock scripting',
          version: '1.0.0',
          lastUpdated: new Date(),
        },
      ];

      // Check if mappings already exist to avoid duplicates
      const existingCount = await this.database.count();
      if (existingCount === 0) {
        /**
         * for method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const mapping of defaultMappings) {
          await this.database.save(mapping);
        }
        logger.info(`Initialized ${defaultMappings.length} default mappings`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error initializing default mappings: ${errorMessage}`, { error });

      ErrorHandler.systemError(
        `Failed to initialize default API mappings: ${errorMessage}`,
        MODULE_ID,
        { originalError: error },
        ErrorSeverity.WARNING,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'INIT_DEFAULTS', 1)
      );
    }
  }
}

/**
 * Factory function to create an APIMapperService instance
 */
export function createAPIMapperService(configService: ConfigurationService): APIMapperService {
  return new APIMapperServiceImpl(configService);
}
