/**
 * Unit tests for APIMapperService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryMappingDatabase, createAPIMapperService, APIMapperServiceImpl } from '../../../src/services/APIMapperService';
import { ConfigurationService } from '../../../src/services/ConfigurationService';
import { APIMapping } from '../../../src/modules/logic/APIMapping';
import { APIMapperService } from '../../../src/types/api';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

vi.mock('../../../src/utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../src/utils/errorHandler', () => ({
  ErrorHandler: {
    systemError: vi.fn(),
  },
}));

vi.mock('uuid');

const DB_PATH = path.join(__dirname, 'test-api-mappings.json');

describe('APIMapperService with InMemoryMappingDatabase', () => {
  let apiMapperService: APIMapperService;
  let mockConfigService: ConfigurationService;

  beforeEach(async () => {
    await fs.unlink(DB_PATH).catch(e => {
      if (e.code !== 'ENOENT') console.error(e);
    });

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        const values: { [key: string]: any } = {
          'apiMapper.cacheEnabled': true,
          'apiMapper.cacheMaxSize': 100,
        };
        return values[key] || defaultValue;
      }),
      on: vi.fn(), // Add event listener mock
    } as any;

    // Create service directly instead of using create method to avoid initialization timeout
    const database = new InMemoryMappingDatabase(DB_PATH);
    apiMapperService = new (APIMapperServiceImpl as any)(mockConfigService, database);
  });

  afterEach(async () => {
    await fs.unlink(DB_PATH).catch(e => {
      if (e.code !== 'ENOENT') console.error(e);
    });
    vi.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    it('should add a new mapping and assign an ID, version, and timestamp', async () => {
      vi.mocked(uuidv4).mockReturnValue('mock-uuid-create');
      const mappingData = {
        javaSignature: 'test.crud.Create',
        bedrockEquivalent: 'bedrock.crud.create',
        conversionType: 'direct' as const,
        notes: 'A test mapping.',
      };
      const createdMapping = await apiMapperService.addMapping(mappingData);

      expect(createdMapping.id).toBe('mock-uuid-create');
      expect(createdMapping.version).toBe('1.0.0');
      expect(createdMapping.lastUpdated).toBeInstanceOf(Date);
      expect(createdMapping.javaSignature).toBe(mappingData.javaSignature);
    });

    it('should retrieve a mapping by signature', async () => {
        vi.mocked(uuidv4).mockReturnValue('mock-uuid-read');
      const mappingData = {
        javaSignature: 'test.crud.Read',
        bedrockEquivalent: 'bedrock.crud.read',
        conversionType: 'direct' as const,
        notes: 'A test mapping.',
      };
      await apiMapperService.addMapping(mappingData);
      const foundMapping = await apiMapperService.getMapping('test.crud.Read');
      
      expect(foundMapping).toBeDefined();
      expect(foundMapping?.javaSignature).toBe('test.crud.Read');
    });

    it('should update an existing mapping', async () => {
        vi.mocked(uuidv4).mockReturnValue('mock-uuid-update');
      const mappingData = {
        javaSignature: 'test.crud.Update',
        bedrockEquivalent: 'bedrock.crud.update',
        conversionType: 'direct' as const,
        notes: 'Original notes.',
      };
      const createdMapping = await apiMapperService.addMapping(mappingData);
      const updates = { notes: 'Updated notes.' };
      const updatedMapping = await apiMapperService.updateMapping(createdMapping.id, updates);

      expect(updatedMapping.notes).toBe('Updated notes.');
      expect(updatedMapping.lastUpdated.getTime()).toBeGreaterThan(createdMapping.lastUpdated.getTime());
    });

    it('should delete a mapping', async () => {
        vi.mocked(uuidv4).mockReturnValue('mock-uuid-delete');
      const mappingData = {
        javaSignature: 'test.crud.Delete',
        bedrockEquivalent: 'bedrock.crud.delete',
        conversionType: 'direct' as const,
        notes: 'A test mapping.',
      };
      const createdMapping = await apiMapperService.addMapping(mappingData);
      const isDeleted = await apiMapperService.deleteMapping(createdMapping.id);
      
      expect(isDeleted).toBe(true);
      const foundMapping = await apiMapperService.getMapping('test.crud.Delete');
      expect(foundMapping).toBeUndefined();
    });
  });

  describe('Versioning and Metadata', () => {
    it('should set initial version to 1 on creation', async () => {
        vi.mocked(uuidv4).mockReturnValue('mock-uuid-version');
      const mappingData = {
        javaSignature: 'test.versioning.Initial',
        bedrockEquivalent: 'bedrock.versioning.initial',
        conversionType: 'direct' as const,
        notes: 'A test mapping.',
      };
      const createdMapping = await apiMapperService.addMapping(mappingData);
      expect(createdMapping.version).toBe(1);
      expect(createdMapping.createdAt).toBeInstanceOf(Date);
    });

    it('should update lastUpdated timestamp and version on update', async () => {
        vi.mocked(uuidv4).mockReturnValue('mock-uuid-timestamp');
        const mappingData = {
            javaSignature: 'test.versioning.Timestamp',
            bedrockEquivalent: 'bedrock.versioning.timestamp',
            conversionType: 'direct' as const,
            notes: 'A test mapping.',
        };
        const createdMapping = await apiMapperService.addMapping(mappingData);
        await new Promise(resolve => setTimeout(resolve, 10));
        const updatedMapping = await apiMapperService.updateMapping(createdMapping.id, { notes: 'New notes' });
        expect(updatedMapping.lastUpdated.getTime()).toBeGreaterThan(createdMapping.lastUpdated.getTime());
        expect(updatedMapping.version).toBe(2); // Version should be incremented
        expect(updatedMapping.createdAt.getTime()).toBe(createdMapping.createdAt.getTime()); // createdAt should not change
    });
  });

  describe('Bulk Operations and Persistence', () => {
    it('should perform bulk import of mappings', async () => {
      vi.mocked(uuidv4).mockImplementation(() => `mock-uuid-${Math.random()}`);
      const mappingsToImport: Omit<APIMapping, 'id' | 'version' | 'lastUpdated'>[] = [
        { javaSignature: 'bulk.test.1', bedrockEquivalent: 'b.b.1', conversionType: 'direct', notes: '' },
        { javaSignature: 'bulk.test.2', bedrockEquivalent: 'b.b.2', conversionType: 'wrapper', notes: '' },
      ];

      const result = await apiMapperService.importMappings(mappingsToImport as any[]);
      
      expect(result.added).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);

      const db = (apiMapperService as any).database;
      const count = await db.count();
      expect(count).toBe(2 + 2); // 2 default + 2 imported
    });

    it('should persist data to a file and be able to load it back', async () => {
        vi.mocked(uuidv4).mockReturnValue('mock-uuid-persist');
      const mappingData = {
        javaSignature: 'test.persistence.Save',
        bedrockEquivalent: 'bedrock.persistence.save',
        conversionType: 'direct' as const,
        notes: 'A test mapping.',
      };
      await apiMapperService.addMapping(mappingData);

      const newApiMapperService = await APIMapperServiceImpl.create(mockConfigService, new InMemoryMappingDatabase(DB_PATH));
      const foundMapping = await newApiMapperService.getMapping('test.persistence.Save');
      expect(foundMapping).toBeDefined();
      expect(foundMapping?.javaSignature).toBe('test.persistence.Save');
    });
  });

  describe('Concurrent Access Safety', () => {
    it('should handle concurrent writes without data corruption', async () => {
        vi.mocked(uuidv4).mockImplementation(() => `mock-uuid-${Math.random()}`);

      const promises = [
        apiMapperService.addMapping({ javaSignature: 'concurrent.test.1', bedrockEquivalent: 'c.b.1', conversionType: 'direct', notes: '' }),
        apiMapperService.addMapping({ javaSignature: 'concurrent.test.2', bedrockEquivalent: 'c.b.2', conversionType: 'direct', notes: '' }),
      ];
      
      await Promise.all(promises);

      const db = (apiMapperService as any).database;
      const count = await db.count();
      expect(count).toBe(2 + 2); // 2 default + 2 concurrent
      
      const mapping1 = await apiMapperService.getMapping('concurrent.test.1');
      const mapping2 = await apiMapperService.getMapping('concurrent.test.2');
      expect(mapping1).toBeDefined();
      expect(mapping2).toBeDefined();
    });
  });

  describe('factory function', () => {
    it('should create APIMapperService instance', async () => {
      const service = await createAPIMapperService(mockConfigService);
      expect(service).toBeDefined();
      expect(typeof service.getMapping).toBe('function');
      expect(typeof service.addMapping).toBe('function');
      expect(typeof service.updateMapping).toBe('function');
    });
  });
});