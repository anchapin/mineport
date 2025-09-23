/**
 * Unit tests for APIMapperService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  InMemoryMappingDatabase,
  createAPIMapperService,
  APIMapperServiceImpl,
} from '../../../src/services/APIMapperService';
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
    await fs.unlink(DB_PATH).catch((e) => {
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
      on: vi.fn(),
    } as any;

    const database = new InMemoryMappingDatabase(DB_PATH);
    const cacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getMetrics: vi.fn().mockReturnValue({ totalEntries: 0 }),
    };

    apiMapperService = new (APIMapperServiceImpl as any)(
      mockConfigService,
      cacheService,
      database
    );
  });

  afterEach(async () => {
    await fs.unlink(DB_PATH).catch((e) => {
      if (e.code !== 'ENOENT') console.error(e);
    });
    vi.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    it('should add a new mapping and assign an ID, version, and timestamp', async () => {
      vi.mocked(uuidv4).mockReturnValue('mock-uuid-create');
      const mappingData = {
        javaSignature: 'test.crud.Create()',
        bedrockEquivalent: 'bedrock.crud.create',
        conversionType: 'direct' as const,
        notes: 'A test mapping.',
      };

      const createdMapping = await apiMapperService.addMapping(mappingData);

      expect(createdMapping.id).toBe('mock-uuid-create');
      expect(createdMapping.version).toBe(1);
      expect(createdMapping.createdAt).toBeInstanceOf(Date);
      expect(createdMapping.lastUpdated).toBeInstanceOf(Date);
      expect(createdMapping.javaSignature).toBe(mappingData.javaSignature);
      expect(createdMapping.bedrockEquivalent).toBe(mappingData.bedrockEquivalent);
    });

    it('should retrieve a mapping by signature', async () => {
      vi.mocked(uuidv4).mockReturnValue('mock-uuid-retrieve');
      const mappingData = {
        javaSignature: 'test.crud.Retrieve()',
        bedrockEquivalent: 'bedrock.crud.retrieve',
        conversionType: 'direct' as const,
        notes: 'A test mapping for retrieval.',
      };

      const createdMapping = await apiMapperService.addMapping(mappingData);
      const retrievedMapping = await apiMapperService.getMapping('test.crud.Retrieve()');

      expect(retrievedMapping).toBeDefined();
      expect(retrievedMapping!.id).toBe(createdMapping.id);
      expect(retrievedMapping!.javaSignature).toBe(mappingData.javaSignature);
    });

    it('should update an existing mapping', async () => {
      vi.mocked(uuidv4).mockReturnValue('mock-uuid-update');
      const mappingData = {
        javaSignature: 'test.crud.Update()',
        bedrockEquivalent: 'bedrock.crud.update',
        conversionType: 'direct' as const,
        notes: 'A test mapping for updating.',
      };

      const createdMapping = await apiMapperService.addMapping(mappingData);
      const updates = {
        bedrockEquivalent: 'bedrock.crud.updated',
        notes: 'Updated mapping',
        conversionType: 'wrapper' as const,
      };

      const updatedMapping = await apiMapperService.updateMapping(createdMapping.id, updates);

      expect(updatedMapping.bedrockEquivalent).toBe(updates.bedrockEquivalent);
      expect(updatedMapping.notes).toBe(updates.notes);
      expect(updatedMapping.version).toBe(2); // Version should increment
      expect(updatedMapping.lastUpdated.getTime()).toBeGreaterThan(
        createdMapping.lastUpdated.getTime()
      );
    });

    it('should delete a mapping', async () => {
      vi.mocked(uuidv4).mockReturnValue('mock-uuid-delete');
      const mappingData = {
        javaSignature: 'test.crud.Delete()',
        bedrockEquivalent: 'bedrock.crud.delete',
        conversionType: 'direct' as const,
        notes: 'A test mapping for deletion.',
      };

      const createdMapping = await apiMapperService.addMapping(mappingData);
      const deleteResult = await apiMapperService.deleteMapping(createdMapping.id);

      expect(deleteResult).toBe(true);

      const retrievedMapping = await apiMapperService.getMapping('test.crud.Delete()');
      expect(retrievedMapping?.conversionType).toBe('impossible');
    });
  });

  describe('Caching', () => {
    it('should cache retrieved mappings', async () => {
      vi.mocked(uuidv4).mockReturnValue('mock-uuid-cache');
      const mappingData = {
        javaSignature: 'test.cache.Mapping()',
        bedrockEquivalent: 'bedrock.cache.mapping',
        conversionType: 'direct' as const,
        notes: 'A test mapping for caching.',
      };

      await apiMapperService.addMapping(mappingData);

      // First retrieval should hit the database
      const firstRetrieval = await apiMapperService.getMapping('test.cache.Mapping()');
      expect(firstRetrieval).toBeDefined();

      // Second retrieval should hit the cache (same object reference)
      const secondRetrieval = await apiMapperService.getMapping('test.cache.Mapping()');
      expect(secondRetrieval).toBeDefined();
    });

    it('should clear cache', () => {
      apiMapperService.clearCache();
      const stats = apiMapperService.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Filtering', () => {
    beforeEach(async () => {
      // Add test mappings with different characteristics
      const testMappings = [
        {
          javaSignature: 'test.filter.Direct()',
          bedrockEquivalent: 'bedrock.filter.direct',
          conversionType: 'direct' as const,
          notes: 'Direct mapping',
        },
        {
          javaSignature: 'test.filter.Wrapper()',
          bedrockEquivalent: 'bedrock.filter.wrapper',
          conversionType: 'wrapper' as const,
          notes: 'Wrapper mapping',
        },
        {
          javaSignature: 'test.filter.Complex()',
          bedrockEquivalent: 'bedrock.filter.complex',
          conversionType: 'complex' as const,
          notes: 'Complex mapping',
        },
      ];

      for (const mapping of testMappings) {
        await apiMapperService.addMapping(mapping);
      }
    });

    it('should filter by conversion type', async () => {
      const directMappings = await apiMapperService.getMappings({ conversionType: 'direct' });
      const wrapperMappings = await apiMapperService.getMappings({ conversionType: 'wrapper' });

      expect(directMappings.length).toBe(1);
      expect(wrapperMappings.length).toBe(1);

      directMappings.forEach((mapping) => {
        expect(mapping.conversionType).toBe('direct');
      });

      wrapperMappings.forEach((mapping) => {
        expect(mapping.conversionType).toBe('wrapper');
      });
    });

    it('should filter by search term', async () => {
      const searchResults = await apiMapperService.getMappings({ search: 'filter' });
      expect(searchResults.length).toBe(3);

      searchResults.forEach((mapping) => {
        const hasSearchTerm =
          mapping.javaSignature.toLowerCase().includes('filter') ||
          mapping.bedrockEquivalent.toLowerCase().includes('filter') ||
          mapping.notes.toLowerCase().includes('filter');
        expect(hasSearchTerm).toBe(true);
      });
    });
  });

  describe('Fallback Strategies', () => {
    beforeEach(async () => {
      const partialMatchMapping = {
        javaSignature: 'net.minecraft.world.World.getBlockState()',
        bedrockEquivalent: 'dimension.getBlock',
        conversionType: 'direct' as const,
        notes: 'Partial match test mapping',
      };
      await apiMapperService.addMapping(partialMatchMapping);
    });

    it('should return a partial match when no exact match is found', async () => {
      const result = await apiMapperService.getMapping(
        'net.minecraft.world.World.getBlockState(BlockPos)'
      );
      expect(result).toBeDefined();
      expect(result!.javaSignature).toBe('net.minecraft.world.World.getBlockState()');
      expect(result!.notes).toContain('[PARTIAL MATCH]');
    }, 60000);

    it('should return a legacy mapping if no exact or partial match is found', async () => {
      const result = await apiMapperService.getMapping('net.minecraft.world.World.isRemote()');
      expect(result).toBeDefined();
      expect(result!.javaSignature).toBe('net.minecraft.world.World.isRemote()');
      expect(result!.notes).toContain('[LEGACY]');
      expect(result!.deprecated).toBe(true);
    }, 60000);

    it('should generate an impossible mapping when no other match is found', async () => {
      vi.mocked(uuidv4).mockReturnValue('mock-uuid-impossible');
      const result = await apiMapperService.getMapping(
        'com.example.mod.NonExistentClass.nonExistentMethod()'
      );
      expect(result).toBeDefined();
      expect(result!.conversionType).toBe('impossible');
      expect(result!.id).toBe('mock-uuid-impossible');
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle missing mappings gracefully', async () => {
      const result = await apiMapperService.getMapping('non.existent.Signature()');
      expect(result).toBeDefined();
      expect(result!.conversionType).toBe('impossible');
    });

    it('should reject adding a mapping with an invalid signature', async () => {
      const invalidMappingData = {
        javaSignature: 'invalid-signature-format',
        bedrockEquivalent: 'bedrock.equivalent',
        conversionType: 'direct' as const,
        notes: 'Invalid mapping',
      };
      await expect(apiMapperService.addMapping(invalidMappingData)).rejects.toThrow(
        'Invalid Java signature format. Expected format: package.class.method(parameters)'
      );
    });

    it('should handle duplicate signature additions', async () => {
      const mappingData = {
        javaSignature: 'test.duplicate.Signature()',
        bedrockEquivalent: 'bedrock.duplicate',
        conversionType: 'direct' as const,
        notes: 'First mapping',
      };

      await apiMapperService.addMapping(mappingData);

      // Attempting to add same signature should throw
      await expect(apiMapperService.addMapping(mappingData)).rejects.toThrow();
    });
  });

  describe('Statistics', () => {
    it('should provide cache statistics', () => {
      const stats = apiMapperService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('enabled');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
      expect(typeof stats.enabled).toBe('boolean');
    });

    it('should provide database statistics', async () => {
      const stats = await apiMapperService.getDatabaseStats();
      expect(stats).toHaveProperty('totalMappings');
      expect(typeof stats.totalMappings).toBe('number');
    });
  });

  describe('Bulk Operations', () => {
    it('should import multiple mappings', async () => {
      const mappingsToImport: APIMapping[] = [
        {
          id: 'import-1',
          javaSignature: 'import.test.First()',
          bedrockEquivalent: 'bedrock.import.first',
          conversionType: 'direct',
          notes: 'First import',
          version: 1,
          createdAt: new Date(),
          lastUpdated: new Date(),
        },
        {
          id: 'import-2',
          javaSignature: 'import.test.Second()',
          bedrockEquivalent: 'bedrock.import.second',
          conversionType: 'wrapper',
          notes: 'Second import',
          version: 1,
          createdAt: new Date(),
          lastUpdated: new Date(),
        },
      ];

      const result = await apiMapperService.importMappings(mappingsToImport);

      expect(result.added).toBeGreaterThan(0);
      expect(result.failed).toBe(0);

      // Verify mappings were actually imported
      const firstMapping = await apiMapperService.getMapping('import.test.First()');
      const secondMapping = await apiMapperService.getMapping('import.test.Second()');

      expect(firstMapping).toBeDefined();
      expect(secondMapping).toBeDefined();
    });
  });
});
