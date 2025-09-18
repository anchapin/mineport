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

  private isWriting: boolean = false;
  private writeQueue: (() => void)[] = [];

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        if (this.isWriting) {
          this.writeQueue.push(execute);
          return;
        }

        this.isWriting = true;
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.isWriting = false;
          if (this.writeQueue.length > 0) {
            const next = this.writeQueue.shift();
            if (next) {
              next();
            }
          }
        }
      };
      execute();
    });
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
  private cache: Map<string, APIMapping> = new Map();
  private cacheEnabled: boolean = true;
  private cacheMaxSize: number = 1000;
  private configService: ConfigurationService;

  private constructor(configService: ConfigurationService, database?: MappingDatabase) {
    this.configService = configService;
    this.database = database || new InMemoryMappingDatabase();
    this.cacheEnabled = this.configService.get('apiMapper.cacheEnabled', true);
    this.cacheMaxSize = this.configService.get('apiMapper.cacheMaxSize', 1000);
  }

  public static async create(
    configService: ConfigurationService,
    database?: MappingDatabase
  ): Promise<APIMapperServiceImpl> {
    const service = new APIMapperServiceImpl(configService, database);
    await service.initializeDefaultMappings();
    logger.info('APIMapperService initialized', {
      cacheEnabled: service.cacheEnabled,
      cacheMaxSize: service.cacheMaxSize,
    });
    return service;
  }

  async getMapping(javaSignature: string): Promise<APIMapping | undefined> {
    if (this.cacheEnabled && this.cache.has(javaSignature)) {
      logger.debug(`Cache hit for signature: ${javaSignature}`);
      return this.cache.get(javaSignature)!;
    }

    const mapping = await this.findMappingWithFallbacks(javaSignature);

    if (mapping && this.cacheEnabled) {
      this.addToCache(javaSignature, mapping);
    }

    return mapping;
  }

  private async findMappingWithFallbacks(javaSignature: string): Promise<APIMapping | undefined> {
    try {
      // Step 1: Exact match
      const exactMapping = await this.database.getBySignature(javaSignature);
      if (exactMapping) {
        logger.info(`Found exact mapping for: ${javaSignature}`);
        return exactMapping;
      }

      // Fallback strategies
      logger.debug(`No exact mapping found for ${javaSignature}, trying fallbacks...`);

      // Step 2: Partial signature matching
      const partialMatch = await this.findPartialMatch(javaSignature);
      if (partialMatch) {
        return partialMatch;
      }

      // Step 3: Legacy system fallback
      const legacyMapping = await this.findLegacyMapping(javaSignature);
      if (legacyMapping) {
        return legacyMapping;
      }

      // Step 4: Impossible mapping generation
      return this.generateImpossibleMapping(javaSignature);
    } catch (error: any) {
      this.handleError(error, 'GET_MAPPING', { javaSignature });
      return this.generateImpossibleMapping(javaSignature, 'An unexpected error occurred.');
    }
  }

  private async findPartialMatch(javaSignature: string): Promise<APIMapping | null> {
    const allMappings = await this.database.getAll();
    if (allMappings.length === 0) {
      return null;
    }

    let bestMatch: APIMapping | null = null;
    let bestScore = 0;

    for (const mapping of allMappings) {
      const score = this.calculateSignatureSimilarity(javaSignature, mapping.javaSignature);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = mapping;
      }
    }

    const similarityThreshold = this.configService.get('apiMapper.partialMatchThreshold', 0.7);

    if (bestMatch && bestScore >= similarityThreshold) {
      logger.info(
        `Found partial match for "${javaSignature}" -> "${bestMatch.javaSignature}" with score ${bestScore}`
      );
      // Return a copy of the mapping with a note about the partial match
      return {
        ...bestMatch,
        notes: `[PARTIAL MATCH] ${bestMatch.notes || ''}`.trim(),
      };
    }

    return null;
  }

  /**
   * Calculates the similarity between two strings using the Levenshtein distance.
   * Returns a score between 0 and 1, where 1 is an exact match.
   */
  private calculateSignatureSimilarity(sig1: string, sig2: string): number {
    const len1 = sig1.length;
    const len2 = sig2.length;
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix: number[][] = Array(len1 + 1)
      .fill(0)
      .map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = sig1[i - 1] === sig2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return (maxLen - distance) / maxLen;
  }

  private async findLegacyMapping(javaSignature: string): Promise<APIMapping | null> {
    // In a real application, this might be a separate database or service.
    // For this example, we'll use a simple in-memory map.
    const legacyMappings = new Map<string, APIMapping>();
    legacyMappings.set('net.minecraft.world.World.isRemote', {
      id: 'legacy-1',
      javaSignature: 'net.minecraft.world.World.isRemote',
      bedrockEquivalent: 'system.isClient',
      conversionType: 'direct',
      notes: 'Legacy mapping for checking client-side execution.',
      version: 1,
      createdAt: new Date('2020-01-01'),
      lastUpdated: new Date('2020-01-01'),
      deprecated: true,
    });

    const legacyMapping = legacyMappings.get(javaSignature);
    if (legacyMapping) {
      logger.info(`Found legacy mapping for "${javaSignature}"`);
      return {
        ...legacyMapping,
        notes: `[LEGACY] ${legacyMapping.notes || ''}`.trim(),
      };
    }
    return null;
  }

  private generateImpossibleMapping(javaSignature: string, reason?: string): APIMapping {
    logger.warn(`No mapping found for: ${javaSignature}. Generating impossible mapping.`);
    return {
      id: uuidv4(),
      javaSignature,
      bedrockEquivalent: `// No direct equivalent found for ${javaSignature}`,
      conversionType: 'impossible',
      notes:
        reason ||
        'This API call has no direct or partial mapping and is considered untranslatable. Manual implementation is required.',
      version: 1,
      createdAt: new Date(),
      lastUpdated: new Date(),
      deprecated: false,
    };
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
      if (this.cacheEnabled) this.addToCache(newMapping.javaSignature, newMapping);
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
      const updatedMapping = await this.database.update(id, updates);
      if (this.cacheEnabled) {
        const oldMapping = await this.database.get(id);
        if (oldMapping && oldMapping.javaSignature !== updatedMapping.javaSignature) {
          this.cache.delete(oldMapping.javaSignature);
        }
        this.addToCache(updatedMapping.javaSignature, updatedMapping);
      }
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
      const deleted = await this.database.delete(id);
      if (deleted && mapping && this.cacheEnabled) this.cache.delete(mapping.javaSignature);
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
      this.clearCache();
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

  clearCache(): void {
    this.cache.clear();
    logger.info('API mapping cache cleared');
  }

  getCacheStats(): { size: number; maxSize: number; enabled: boolean } {
    return { size: this.cache.size, maxSize: this.cacheMaxSize, enabled: this.cacheEnabled };
  }

  async getDatabaseStats(): Promise<{ totalMappings: number }> {
    const totalMappings = await this.database.count();
    return { totalMappings };
  }

  private validateMapping(mapping: Partial<APIMapping>): void {
    validateAPIMapping(mapping);
  }

  private addToCache(signature: string, mapping: APIMapping): void {
    if (!this.cacheEnabled) return;
    if (this.cache.size >= this.cacheMaxSize && !this.cache.has(signature)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(signature, mapping);
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
  configService: ConfigurationService
): Promise<APIMapperService> {
  return APIMapperServiceImpl.create(configService);
}
