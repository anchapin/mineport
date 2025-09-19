/**
 * API Mapper Service
 *
 * Service for managing and providing access to Java-to-Bedrock API mappings.
 * Implements database integration, versioning, and caching for API mappings.
 */

import { APIMapping, validateAPIMapping } from '../modules/logic/APIMapping';
import { APIMapperService, MappingFilter, ImportResult, MappingDatabase } from '../types/api';
import { createLogger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { ErrorSeverity, createErrorCode } from '../types/errors';
import { ConfigurationService } from './ConfigurationService';
import { CacheService, CacheMetrics } from './CacheService';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('APIMapperService');
const MODULE_ID = 'API_MAPPER';

/**
 * Custom error classes for API Mapper operations
 */
export class MappingNotFoundError extends Error {
  constructor(identifier: string, searchType: 'id' | 'signature' = 'id') {
    super(`Mapping not found: ${searchType} '${identifier}'`);
    this.name = 'MappingNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(`Validation error: ${message}`);
    this.name = 'ValidationError';
  }
}

export class VersionConflictError extends Error {
  constructor(id: string, expectedVersion: number, actualVersion: number) {
    super(
      `Version conflict for mapping '${id}': expected ${expectedVersion}, found ${actualVersion}`
    );
    this.name = 'VersionConflictError';
  }
}

export class InMemoryMappingDatabase implements MappingDatabase {
  private mappings: Map<string, APIMapping> = new Map();
  private signatureIndex: Map<string, string> = new Map();
  private dbPath: string;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(dbPath: string = path.join(__dirname, 'api-mappings.json')) {
    this.dbPath = dbPath;
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const previousLock = this.writeLock;
    let releaseLock!: () => void;
    this.writeLock = new Promise((resolve) => {
      releaseLock = resolve;
    });
    await previousLock;
    try {
      return await operation();
    } finally {
      releaseLock();
    }
  }

  async load(): Promise<void> {
    await this.withWriteLock(async () => {
      try {
        const data = await fs.readFile(this.dbPath, 'utf-8');
        const mappings: APIMapping[] = JSON.parse(data);
        this.mappings.clear();
        this.signatureIndex.clear();
        for (const mapping of mappings) {
          // Convert date strings back to Date objects
          mapping.lastUpdated = new Date(mapping.lastUpdated);
          if (mapping.createdAt) {
            mapping.createdAt = new Date(mapping.createdAt);
          } else {
            // Backward compatibility: if createdAt doesn't exist, use lastUpdated
            mapping.createdAt = new Date(mapping.lastUpdated);
          }

          // Ensure version is a number for backward compatibility
          if (typeof mapping.version === 'string') {
            mapping.version = 1; // Convert semantic versions to number
          }

          // Validate loaded mapping
          try {
            validateAPIMapping(mapping);
            this.mappings.set(mapping.id, mapping);
            this.signatureIndex.set(mapping.javaSignature, mapping.id);
          } catch (error) {
            logger.warn(`Skipping invalid mapping during load: ${mapping.id}`, {
              error: error.message,
            });
          }
        }
        logger.info(`Loaded ${mappings.length} mappings from ${this.dbPath}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw new Error(`Failed to load mapping database: ${error.message}`);
        }
        logger.warn(`Database file not found at ${this.dbPath}. Starting with an empty database.`);
        this.mappings.clear();
        this.signatureIndex.clear();
      }
    });
  }

  async persist(): Promise<void> {
    await this.withWriteLock(async () => {
      const data = JSON.stringify(Array.from(this.mappings.values()), null, 2);
      await fs.writeFile(this.dbPath, data, 'utf-8');
      logger.debug(`Persisted ${this.mappings.size} mappings to ${this.dbPath}`);
    });
  }

  async create(
    mapping: Omit<APIMapping, 'id' | 'version' | 'createdAt' | 'lastUpdated'>
  ): Promise<APIMapping> {
    // Validate the input mapping
    try {
      validateAPIMapping(mapping);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }

    const now = new Date();
    const newMapping: APIMapping = {
      ...mapping,
      id: uuidv4(),
      version: 1,
      createdAt: now,
      lastUpdated: now,
      notes: mapping.notes || '',
    };
    await this.withWriteLock(async () => {
      if (this.signatureIndex.has(mapping.javaSignature)) {
        throw new Error(`Mapping with signature "${mapping.javaSignature}" already exists.`);
      }
      this.mappings.set(newMapping.id, newMapping);
      this.signatureIndex.set(newMapping.javaSignature, newMapping.id);
      await this.persist();
    });
    return newMapping;
  }

  async get(id: string): Promise<APIMapping | undefined> {
    const mapping = this.mappings.get(id);
    return mapping ? this.deepCloneMapping(mapping) : undefined;
  }

  async getBySignature(javaSignature: string): Promise<APIMapping | undefined> {
    const id = this.signatureIndex.get(javaSignature);
    if (!id) return undefined;
    const mapping = this.mappings.get(id);
    return mapping ? this.deepCloneMapping(mapping) : undefined;
  }

  async getAll(filter?: MappingFilter): Promise<APIMapping[]> {
    let results = Array.from(this.mappings.values());
    if (filter) {
      results = results.filter(
        (m) =>
          (!filter.conversionType || m.conversionType === filter.conversionType) &&
          (!filter.version || m.version.toString() === filter.version) &&
          (!filter.search ||
            m.javaSignature.toLowerCase().includes(filter.search.toLowerCase()) ||
            m.bedrockEquivalent.toLowerCase().includes(filter.search.toLowerCase()) ||
            m.notes.toLowerCase().includes(filter.search.toLowerCase()))
      );
    }
    // Return deep cloned results to prevent external mutation
    return results.map((mapping) => this.deepCloneMapping(mapping));
  }

  private deepCloneMapping(mapping: APIMapping): APIMapping {
    return {
      ...mapping,
      createdAt: new Date(mapping.createdAt),
      lastUpdated: new Date(mapping.lastUpdated),
      minecraftVersions: mapping.minecraftVersions ? [...mapping.minecraftVersions] : undefined,
      modLoaders: mapping.modLoaders ? [...mapping.modLoaders] : undefined,
      exampleUsage: mapping.exampleUsage
        ? {
            java: mapping.exampleUsage.java,
            bedrock: mapping.exampleUsage.bedrock,
          }
        : undefined,
      metadata: mapping.metadata ? { ...mapping.metadata } : undefined,
    };
  }

  async update(
    id: string,
    updates: Partial<Omit<APIMapping, 'id' | 'createdAt'>>
  ): Promise<APIMapping> {
    // Validate updates if they contain core fields
    if (updates.javaSignature || updates.bedrockEquivalent || updates.conversionType) {
      try {
        validateAPIMapping({ ...updates } as Partial<APIMapping>);
      } catch (error: any) {
        throw new ValidationError(error.message);
      }
    }

    let updatedMapping: APIMapping;
    await this.withWriteLock(async () => {
      const existing = this.mappings.get(id);
      if (!existing) throw new MappingNotFoundError(id, 'id');

      // Create deep clone to prevent external mutation
      const updatedFields = { ...updates };
      delete (updatedFields as any).createdAt; // Prevent modification of createdAt
      delete (updatedFields as any).id; // Prevent modification of id

      updatedMapping = {
        ...existing,
        ...updatedFields,
        version: existing.version + 1,
        lastUpdated: new Date(),
      };
      if (updates.javaSignature && updates.javaSignature !== existing.javaSignature) {
        if (this.signatureIndex.has(updates.javaSignature)) {
          throw new Error(`Mapping with signature "${updates.javaSignature}" already exists.`);
        }
        this.signatureIndex.delete(existing.javaSignature);
        this.signatureIndex.set(updates.javaSignature, id);
      }
      this.mappings.set(id, updatedMapping);
      await this.persist();
    });
    return updatedMapping!;
  }

  async delete(id: string): Promise<boolean> {
    let deleted = false;
    await this.withWriteLock(async () => {
      const mapping = this.mappings.get(id);
      if (mapping) {
        this.mappings.delete(id);
        this.signatureIndex.delete(mapping.javaSignature);
        await this.persist();
        deleted = true;
      }
    });
    return deleted;
  }

  async bulkImport(mappings: APIMapping[]): Promise<ImportResult> {
    const result: ImportResult = { added: 0, updated: 0, failed: 0, failures: [] };
    for (const mapping of mappings) {
      try {
        const existing = await this.getBySignature(mapping.javaSignature);
        if (existing) {
          await this.update(existing.id, mapping);
          result.updated++;
        } else {
          await this.create(mapping);
          result.added++;
        }
      } catch (error: any) {
        result.failed++;
        result.failures.push({ mapping, reason: error.message });
      }
    }
    return result;
  }

  async count(): Promise<number> {
    return this.mappings.size;
  }
}

export class APIMapperServiceImpl implements APIMapperService {
  private database: MappingDatabase;
  private configService: ConfigurationService;
  private cacheService: CacheService;

  private constructor(
    configService: ConfigurationService,
    cacheService: CacheService,
    database?: MappingDatabase
  ) {
    this.configService = configService;
    this.database = database || new InMemoryMappingDatabase();
    this.cacheService = cacheService;
  }

  public static async create(
    configService: ConfigurationService,
    database?: MappingDatabase
  ): Promise<APIMapperServiceImpl> {
    const cacheService = await CacheService.create({
      configService,
      enablePersistence: configService.get('apiMapper.cache.persistenceEnabled', true),
      persistenceDir: configService.get('apiMapper.cache.persistenceDir', path.join(process.cwd(), '.cache', 'api-mappings')),
      defaultTTL: configService.get('apiMapper.cache.ttl', 24 * 60 * 60 * 1000), // 24 hours
    });

    const service = new APIMapperServiceImpl(configService, cacheService, database);
    await service.initializeDefaultMappings();
    logger.info('APIMapperService initialized', {
      cacheEnabled: configService.get('apiMapper.cacheEnabled', true),
      cacheMaxSize: configService.get('apiMapper.cacheMaxSize', 1000),
    });
    return service;
  }

  async getMapping(javaSignature: string): Promise<APIMapping | undefined> {
    const cacheKey = `api_mapping:${javaSignature}`;
    let mapping = await this.cacheService.get<APIMapping>(cacheKey);

    if (mapping) {
      logger.debug(`Cache hit for signature: ${javaSignature}`);
      return mapping;
    }

    logger.debug(`Cache miss for signature: ${javaSignature}`);
    try {
      mapping = await this.database.getBySignature(javaSignature);
      if (mapping) {
        await this.cacheService.set(cacheKey, mapping);
      }
      logger.debug(`Retrieved mapping for signature: ${javaSignature}`, { found: !!mapping });
      return mapping;
    } catch (error: any) {
      this.handleError(error, 'GET_MAPPING', { javaSignature });
      return undefined;
    }
  }

  async mapJavaToBedrock(javaSignature: string): Promise<string | undefined> {
    try {
      const mapping = await this.getMapping(javaSignature);
      if (!mapping) {
        logger.debug(`No mapping found for Java signature: ${javaSignature}`);
        return undefined;
      }

      if (mapping.deprecated) {
        logger.warn(`Using deprecated mapping for: ${javaSignature}`);
      }

      return mapping.bedrockEquivalent;
    } catch (error: any) {
      this.handleError(error, 'MAP_JAVA_TO_BEDROCK', { javaSignature });
      return undefined;
    }
  }

  async getMappings(filter?: MappingFilter): Promise<APIMapping[]> {
    try {
      const mappings = await this.database.getAll(filter);
      logger.debug(`Retrieved ${mappings.length} mappings`, { filter });
      return mappings;
    } catch (error: any) {
      this.handleError(error, 'GET_MAPPINGS', { filter });
      return [];
    }
  }

  async addMapping(
    mappingData: Omit<APIMapping, 'id' | 'version' | 'createdAt' | 'lastUpdated'>
  ): Promise<APIMapping> {
    try {
      this.validateMapping(mappingData);
      const newMapping = await this.database.create(mappingData);
      const cacheKey = `api_mapping:${newMapping.javaSignature}`;
      await this.cacheService.set(cacheKey, newMapping);
      logger.info(
        `Added new mapping: ${newMapping.javaSignature} -> ${newMapping.bedrockEquivalent}`
      );
      return newMapping;
    } catch (error: any) {
      this.handleError(error, 'ADD_MAPPING', { mappingData });
      throw error;
    }
  }

  async updateMapping(
    id: string,
    updates: Partial<Omit<APIMapping, 'id' | 'createdAt'>>
  ): Promise<APIMapping> {
    try {
      const oldMapping = await this.database.get(id);
      if (oldMapping) {
        const oldCacheKey = `api_mapping:${oldMapping.javaSignature}`;
        await this.cacheService.delete(oldCacheKey);
      }

      const updatedMapping = await this.database.update(id, updates);
      const newCacheKey = `api_mapping:${updatedMapping.javaSignature}`;
      await this.cacheService.set(newCacheKey, updatedMapping);

      logger.info(`Updated mapping: ${updatedMapping.javaSignature}`);
      return updatedMapping;
    } catch (error: any) {
      this.handleError(error, 'UPDATE_MAPPING', { mappingId: id, updates });
      throw error;
    }
  }

  async deleteMapping(id: string): Promise<boolean> {
    try {
      const mapping = await this.database.get(id);
      if (mapping) {
        const cacheKey = `api_mapping:${mapping.javaSignature}`;
        await this.cacheService.delete(cacheKey);
      }
      const deleted = await this.database.delete(id);
      logger.info(`Deleted mapping with ID: ${id}`, { success: deleted });
      return deleted;
    } catch (error: any) {
      this.handleError(error, 'DELETE_MAPPING', { mappingId: id });
      throw error;
    }
  }

  async importMappings(mappings: APIMapping[]): Promise<ImportResult> {
    logger.info(`Starting import of ${mappings.length} mappings`);
    try {
      const result = await this.database.bulkImport(mappings);
      logger.info(`Import completed`, result);
      await this.cacheService.clear();
      return result;
    } catch (error: any) {
      this.handleError(error, 'IMPORT_MAPPINGS', {});
      return {
        added: 0,
        updated: 0,
        failed: mappings.length,
        failures: mappings.map((m) => ({
          mapping: m as APIMapping,
          reason: 'A critical error occurred during import.',
        })),
      };
    }
  }

  clearCache(): Promise<void> {
    logger.info('API mapping cache cleared');
    return this.cacheService.clear();
  }

  getCacheStats(): CacheMetrics {
    return this.cacheService.getMetrics();
  }

  async getDatabaseStats(): Promise<{ totalMappings: number }> {
    const totalMappings = await this.database.count();
    return { totalMappings };
  }

  private validateMapping(mapping: Partial<APIMapping>): void {
    validateAPIMapping(mapping);
  }

  private async initializeDefaultMappings(): Promise<void> {
    try {
      await (this.database as InMemoryMappingDatabase).load();
      const count = await this.database.count();
      if (count > 0) {
        logger.info('Database already populated. Skipping default mappings initialization.');
        return;
      }
      const defaultMappings: Omit<APIMapping, 'id' | 'version' | 'createdAt' | 'lastUpdated'>[] = [
        {
          javaSignature: 'net.minecraftforge.event.entity.player.PlayerEvent.PlayerLoggedInEvent',
          bedrockEquivalent: 'system.events.playerJoin',
          conversionType: 'direct',
          notes: 'Player join event mapping',
          exampleUsage: {
            java: '@SubscribeEvent\\npublic void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event) { ... }',
            bedrock: 'system.events.playerJoin.subscribe(event => { ... });',
          },
        },
        {
          javaSignature: 'net.minecraft.world.World.setBlockState',
          bedrockEquivalent: 'dimension.getBlock().setPermutation',
          conversionType: 'wrapper',
          notes: 'Setting block state requires coordinate transformation',
        },
      ];
      for (const mappingData of defaultMappings) {
        await this.addMapping(mappingData);
      }
      logger.info(`Initialized ${defaultMappings.length} default mappings.`);
    } catch (error: any) {
      this.handleError(error, 'INIT_DEFAULTS', {}, ErrorSeverity.WARNING);
    }
  }

  private handleError(
    error: Error,
    errorCode: string,
    context: object,
    severity: ErrorSeverity = ErrorSeverity.ERROR
  ) {
    const errorMessage = error.message || 'An unknown error occurred.';
    logger.error(`Error in ${errorCode}: ${errorMessage}`, { error, ...context });
    ErrorHandler.systemError(
      `APIMapperService failed at ${errorCode}: ${errorMessage}`,
      MODULE_ID,
      { ...context, originalError: error },
      severity,
      createErrorCode(MODULE_ID, errorCode, 1)
    );
  }
}

export async function createAPIMapperService(
  configService: ConfigurationService,
  cacheService?: CacheService
): Promise<APIMapperService> {
  return APIMapperServiceImpl.create(configService);
}
