/**
 * API Mapper Service
 * 
 * Service for managing and providing access to Java-to-Bedrock API mappings.
 * Implements database integration, versioning, and caching for API mappings.
 */

import { APIMapping } from '../modules/logic/APIMapping';
import { APIMapperService, MappingFilter, ImportResult, MappingDatabase, MappingFailure } from '../types/api';
import { createLogger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { ErrorSeverity, createErrorCode } from '../types/errors';
import { ConfigurationService } from './ConfigurationService';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';


const logger = createLogger('APIMapperService');
const MODULE_ID = 'API_MAPPER';

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
    this.writeLock = new Promise(resolve => {
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
          mapping.lastUpdated = new Date(mapping.lastUpdated);
          this.mappings.set(mapping.id, mapping);
          this.signatureIndex.set(mapping.javaSignature, mapping.id);
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

  async create(mapping: Omit<APIMapping, 'id' | 'version' | 'lastUpdated'>): Promise<APIMapping> {
    const newMapping: APIMapping = {
      ...mapping,
      id: uuidv4(),
      version: '1.0.0',
      lastUpdated: new Date(),
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
    return this.mappings.get(id);
  }

  async getBySignature(javaSignature: string): Promise<APIMapping | undefined> {
    const id = this.signatureIndex.get(javaSignature);
    return id ? this.mappings.get(id) : undefined;
  }

  async getAll(filter?: MappingFilter): Promise<APIMapping[]> {
    let results = Array.from(this.mappings.values());
    if (!filter) return results;
    return results.filter(m =>
      (!filter.conversionType || m.conversionType === filter.conversionType) &&
      (!filter.version || m.version === filter.version) &&
      (!filter.search ||
        (m.javaSignature.toLowerCase().includes(filter.search.toLowerCase()) ||
         m.bedrockEquivalent.toLowerCase().includes(filter.search.toLowerCase()) ||
         m.notes.toLowerCase().includes(filter.search.toLowerCase())))
    );
  }

  async update(id: string, updates: Partial<Omit<APIMapping, 'id'>>): Promise<APIMapping> {
    let updatedMapping: APIMapping;
    await this.withWriteLock(async () => {
      const existing = this.mappings.get(id);
      if (!existing) throw new Error(`Mapping with id "${id}" not found.`);
      updatedMapping = { ...existing, ...updates, lastUpdated: new Date() };
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

  public static async create(configService: ConfigurationService, database?: MappingDatabase): Promise<APIMapperServiceImpl> {
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
      return this.cache.get(javaSignature);
    }
    try {
      const mapping = await this.database.getBySignature(javaSignature);
      if (mapping && this.cacheEnabled) this.addToCache(javaSignature, mapping);
      logger.debug(`Retrieved mapping for signature: ${javaSignature}`, { found: !!mapping });
      return mapping;
    } catch (error: any) {
      this.handleError(error, 'GET_MAPPING', { javaSignature });
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

  async addMapping(mappingData: Omit<APIMapping, 'id' | 'version' | 'lastUpdated'>): Promise<APIMapping> {
    try {
      this.validateMapping(mappingData);
      const newMapping = await this.database.create(mappingData);
      if (this.cacheEnabled) this.addToCache(newMapping.javaSignature, newMapping);
      logger.info(`Added new mapping: ${newMapping.javaSignature} -> ${newMapping.bedrockEquivalent}`);
      return newMapping;
    } catch (error: any) {
      this.handleError(error, 'ADD_MAPPING', { mappingData });
      throw error;
    }
  }

  async updateMapping(id: string, updates: Partial<Omit<APIMapping, 'id'>>): Promise<APIMapping> {
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
      return { added: 0, updated: 0, failed: mappings.length, failures: mappings.map(m => ({ mapping: m as APIMapping, reason: 'A critical error occurred during import.' })) };
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
    if (!mapping.javaSignature) throw new Error('Java signature is required');
    if (!mapping.bedrockEquivalent) throw new Error('Bedrock equivalent is required');
    if (!mapping.conversionType) throw new Error('Conversion type is required');
    if (!['direct', 'wrapper', 'complex', 'impossible'].includes(mapping.conversionType)) {
      throw new Error('Invalid conversion type');
    }
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
      const defaultMappings: Omit<APIMapping, 'id' | 'version' | 'lastUpdated'>[] = [
        {
          javaSignature: 'net.minecraftforge.event.entity.player.PlayerEvent.PlayerLoggedInEvent',
          bedrockEquivalent: 'system.events.playerJoin',
          conversionType: 'direct',
          notes: 'Player join event mapping',
          exampleUsage: {
            java: '@SubscribeEvent\npublic void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event) { ... }',
            bedrock: 'system.events.playerJoin.subscribe(event => { ... });'
          }
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

  private handleError(error: Error, errorCode: string, context: object, severity: ErrorSeverity = ErrorSeverity.ERROR) {
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

export async function createAPIMapperService(configService: ConfigurationService): Promise<APIMapperService> {
    return APIMapperServiceImpl.create(configService);
}