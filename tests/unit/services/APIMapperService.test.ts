/**
 * Unit tests for APIMapperService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  APIMapperServiceImpl,
  createAPIMapperService,
} from '../../../src/services/APIMapperService.js';
import { ConfigurationService } from '../../../src/services/ConfigurationService.js';
import { APIMapping, MappingFilter, ImportResult } from '../../../src/types/api.js';

// Mock dependencies
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
    logicError: vi.fn(),
    compromiseError: vi.fn(),
  },
  globalErrorCollector: {
    addError: vi.fn(),
  },
}));

describe('APIMapperService', () => {
  let apiMapperService: APIMapperServiceImpl;
  let mockConfigService: ConfigurationService;

  beforeEach(() => {
    // Create mock configuration service
    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        switch (key) {
          case 'apiMapper.cacheEnabled':
            return true;
          case 'apiMapper.cacheMaxSize':
            return 1000;
          default:
            return defaultValue;
        }
      }),
      set: vi.fn(),
      getSection: vi.fn(),
      reload: vi.fn(),
      validate: vi.fn(),
    } as any;

    apiMapperService = new APIMapperServiceImpl(mockConfigService);
  });

  describe('getMapping', () => {
    it('should return undefined for non-existent mapping', async () => {
      const result = await apiMapperService.getMapping('non.existent.Signature');
      expect(result).toBeUndefined();
    });

    it('should return mapping for existing signature', async () => {
      // Add a test mapping first
      const testMapping: APIMapping = {
        id: 'test-mapping',
        javaSignature: 'test.java.Signature',
        bedrockEquivalent: 'test.bedrock.equivalent',
        conversionType: 'direct',
        notes: 'Test mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await apiMapperService.addMapping(testMapping);
      const result = await apiMapperService.getMapping('test.java.Signature');

      expect(result).toBeDefined();
      expect(result?.javaSignature).toBe('test.java.Signature');
      expect(result?.bedrockEquivalent).toBe('test.bedrock.equivalent');
    });

    it('should use cache for repeated requests', async () => {
      const testMapping: APIMapping = {
        id: 'cached-mapping',
        javaSignature: 'cached.java.Signature',
        bedrockEquivalent: 'cached.bedrock.equivalent',
        conversionType: 'direct',
        notes: 'Cached mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await apiMapperService.addMapping(testMapping);

      // First call should populate cache
      const result1 = await apiMapperService.getMapping('cached.java.Signature');
      expect(result1).toBeDefined();

      // Second call should use cache
      const result2 = await apiMapperService.getMapping('cached.java.Signature');
      expect(result2).toBeDefined();
      expect(result1).toEqual(result2);
    });
  });

  describe('getMappings', () => {
    beforeEach(async () => {
      // Add test mappings
      const testMappings: APIMapping[] = [
        {
          id: 'direct-mapping',
          javaSignature: 'direct.java.Signature',
          bedrockEquivalent: 'direct.bedrock.equivalent',
          conversionType: 'direct',
          notes: 'Direct mapping',
          version: '1.0.0',
          lastUpdated: new Date(),
        },
        {
          id: 'wrapper-mapping',
          javaSignature: 'wrapper.java.Signature',
          bedrockEquivalent: 'wrapper.bedrock.equivalent',
          conversionType: 'wrapper',
          notes: 'Wrapper mapping',
          version: '1.0.0',
          lastUpdated: new Date(),
        },
        {
          id: 'complex-mapping',
          javaSignature: 'complex.java.Signature',
          bedrockEquivalent: 'complex.bedrock.equivalent',
          conversionType: 'complex',
          notes: 'Complex mapping',
          version: '2.0.0',
          lastUpdated: new Date(),
        },
      ];

      for (const mapping of testMappings) {
        await apiMapperService.addMapping(mapping);
      }
    });

    it('should return all mappings when no filter is provided', async () => {
      const result = await apiMapperService.getMappings();
      expect(result.length).toBeGreaterThanOrEqual(3); // At least our test mappings + defaults
    });

    it('should filter by conversion type', async () => {
      const filter: MappingFilter = { conversionType: 'direct' };
      const result = await apiMapperService.getMappings(filter);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((mapping) => {
        expect(mapping.conversionType).toBe('direct');
      });
    });

    it('should filter by version', async () => {
      const filter: MappingFilter = { version: '2.0.0' };
      const result = await apiMapperService.getMappings(filter);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((mapping) => {
        expect(mapping.version).toBe('2.0.0');
      });
    });

    it('should filter by search term', async () => {
      const filter: MappingFilter = { search: 'wrapper' };
      const result = await apiMapperService.getMappings(filter);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((mapping) => {
        const searchTerm = 'wrapper';
        const matchesSignature = mapping.javaSignature.toLowerCase().includes(searchTerm);
        const matchesBedrock = mapping.bedrockEquivalent.toLowerCase().includes(searchTerm);
        const matchesNotes = mapping.notes.toLowerCase().includes(searchTerm);

        expect(matchesSignature || matchesBedrock || matchesNotes).toBe(true);
      });
    });
  });

  describe('addMapping', () => {
    it('should add a valid mapping', async () => {
      const testMapping: APIMapping = {
        id: 'new-mapping',
        javaSignature: 'new.java.Signature',
        bedrockEquivalent: 'new.bedrock.equivalent',
        conversionType: 'direct',
        notes: 'New mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await expect(apiMapperService.addMapping(testMapping)).resolves.not.toThrow();

      const retrieved = await apiMapperService.getMapping('new.java.Signature');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('new-mapping');
    });

    it('should reject mapping with missing required fields', async () => {
      const invalidMapping = {
        javaSignature: 'invalid.java.Signature',
        bedrockEquivalent: 'invalid.bedrock.equivalent',
        conversionType: 'direct',
        notes: 'Invalid mapping',
        // Missing id and version
      } as APIMapping;

      await expect(apiMapperService.addMapping(invalidMapping)).rejects.toThrow();
    });

    it('should reject mapping with invalid conversion type', async () => {
      const invalidMapping: APIMapping = {
        id: 'invalid-type-mapping',
        javaSignature: 'invalid.type.Signature',
        bedrockEquivalent: 'invalid.type.equivalent',
        conversionType: 'invalid' as any,
        notes: 'Invalid type mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await expect(apiMapperService.addMapping(invalidMapping)).rejects.toThrow(
        'Invalid conversion type'
      );
    });

    it('should reject duplicate mappings', async () => {
      const testMapping: APIMapping = {
        id: 'duplicate-mapping',
        javaSignature: 'duplicate.java.Signature',
        bedrockEquivalent: 'duplicate.bedrock.equivalent',
        conversionType: 'direct',
        notes: 'Duplicate mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await apiMapperService.addMapping(testMapping);

      const duplicateMapping: APIMapping = {
        id: 'duplicate-mapping-2',
        javaSignature: 'duplicate.java.Signature', // Same signature
        bedrockEquivalent: 'different.bedrock.equivalent',
        conversionType: 'wrapper',
        notes: 'Different mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await expect(apiMapperService.addMapping(duplicateMapping)).rejects.toThrow('already exists');
    });
  });

  describe('updateMapping', () => {
    it('should update an existing mapping', async () => {
      const originalMapping: APIMapping = {
        id: 'update-mapping',
        javaSignature: 'update.java.Signature',
        bedrockEquivalent: 'update.bedrock.equivalent',
        conversionType: 'direct',
        notes: 'Original mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await apiMapperService.addMapping(originalMapping);

      const updatedMapping: APIMapping = {
        ...originalMapping,
        bedrockEquivalent: 'updated.bedrock.equivalent',
        notes: 'Updated mapping',
        version: '1.1.0',
      };

      await expect(apiMapperService.updateMapping(updatedMapping)).resolves.not.toThrow();

      const retrieved = await apiMapperService.getMapping('update.java.Signature');
      expect(retrieved?.bedrockEquivalent).toBe('updated.bedrock.equivalent');
      expect(retrieved?.notes).toBe('Updated mapping');
      expect(retrieved?.version).toBe('1.1.0');
    });

    it('should reject update for non-existent mapping', async () => {
      const nonExistentMapping: APIMapping = {
        id: 'non-existent',
        javaSignature: 'non.existent.Signature',
        bedrockEquivalent: 'non.existent.equivalent',
        conversionType: 'direct',
        notes: 'Non-existent mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await expect(apiMapperService.updateMapping(nonExistentMapping)).rejects.toThrow('not found');
    });
  });

  describe('importMappings', () => {
    it('should import valid mappings', async () => {
      const mappingsToImport: APIMapping[] = [
        {
          id: 'import-1',
          javaSignature: 'import1.java.Signature',
          bedrockEquivalent: 'import1.bedrock.equivalent',
          conversionType: 'direct',
          notes: 'Import mapping 1',
          version: '1.0.0',
          lastUpdated: new Date(),
        },
        {
          id: 'import-2',
          javaSignature: 'import2.java.Signature',
          bedrockEquivalent: 'import2.bedrock.equivalent',
          conversionType: 'wrapper',
          notes: 'Import mapping 2',
          version: '1.0.0',
          lastUpdated: new Date(),
        },
      ];

      const result = await apiMapperService.importMappings(mappingsToImport);

      expect(result.added).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.failures).toHaveLength(0);
    });

    it('should handle mixed import with valid and invalid mappings', async () => {
      const mappingsToImport: APIMapping[] = [
        {
          id: 'valid-import',
          javaSignature: 'valid.import.Signature',
          bedrockEquivalent: 'valid.import.equivalent',
          conversionType: 'direct',
          notes: 'Valid import mapping',
          version: '1.0.0',
          lastUpdated: new Date(),
        },
        {
          // Missing required fields
          javaSignature: 'invalid.import.Signature',
          bedrockEquivalent: 'invalid.import.equivalent',
          conversionType: 'direct',
          notes: 'Invalid import mapping',
        } as APIMapping,
      ];

      const result = await apiMapperService.importMappings(mappingsToImport);

      expect(result.added).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.failures).toHaveLength(1);
    });

    it('should update existing mappings during import', async () => {
      // First add a mapping
      const originalMapping: APIMapping = {
        id: 'existing-import',
        javaSignature: 'existing.import.Signature',
        bedrockEquivalent: 'existing.import.equivalent',
        conversionType: 'direct',
        notes: 'Original mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await apiMapperService.addMapping(originalMapping);

      // Then import an updated version
      const updatedMapping: APIMapping = {
        id: 'updated-import',
        javaSignature: 'existing.import.Signature', // Same signature
        bedrockEquivalent: 'updated.import.equivalent',
        conversionType: 'wrapper',
        notes: 'Updated mapping',
        version: '2.0.0',
        lastUpdated: new Date(),
      };

      const result = await apiMapperService.importMappings([updatedMapping]);

      expect(result.added).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.failed).toBe(0);

      const retrieved = await apiMapperService.getMapping('existing.import.Signature');
      expect(retrieved?.bedrockEquivalent).toBe('updated.import.equivalent');
      expect(retrieved?.conversionType).toBe('wrapper');
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = apiMapperService.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('enabled');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
      expect(typeof stats.enabled).toBe('boolean');
    });

    it('should clear cache', async () => {
      // Add a mapping to populate cache
      const testMapping: APIMapping = {
        id: 'cache-test',
        javaSignature: 'cache.test.Signature',
        bedrockEquivalent: 'cache.test.equivalent',
        conversionType: 'direct',
        notes: 'Cache test mapping',
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      await apiMapperService.addMapping(testMapping);
      await apiMapperService.getMapping('cache.test.Signature'); // Populate cache

      const statsBefore = apiMapperService.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);

      apiMapperService.clearCache();

      const statsAfter = apiMapperService.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe('database statistics', () => {
    it('should provide database statistics', async () => {
      const stats = await apiMapperService.getDatabaseStats();

      expect(stats).toHaveProperty('totalMappings');
      expect(typeof stats.totalMappings).toBe('number');
      expect(stats.totalMappings).toBeGreaterThan(0); // Should have default mappings
    });
  });

  describe('factory function', () => {
    it('should create APIMapperService instance', () => {
      const service = createAPIMapperService(mockConfigService);
      expect(service).toBeDefined();
      expect(typeof service.getMapping).toBe('function');
      expect(typeof service.getMappings).toBe('function');
      expect(typeof service.addMapping).toBe('function');
      expect(typeof service.updateMapping).toBe('function');
      expect(typeof service.importMappings).toBe('function');
    });
  });
});
