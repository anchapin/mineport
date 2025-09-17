/**
 * Unit tests for InMemoryMappingDatabase
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  InMemoryMappingDatabase,
  MappingNotFoundError,
  ValidationError,
} from '../../../src/services/APIMapperService';
import { APIMapping } from '../../../src/modules/logic/APIMapping';
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

const DB_PATH = path.join(__dirname, 'test-mapping-db.json');

describe('InMemoryMappingDatabase', () => {
  let database: InMemoryMappingDatabase;

  beforeEach(async () => {
    await fs.unlink(DB_PATH).catch((e) => {
      if (e.code !== 'ENOENT') console.error(e);
    });
    database = new InMemoryMappingDatabase(DB_PATH);
  });

  afterEach(async () => {
    await fs.unlink(DB_PATH).catch((e) => {
      if (e.code !== 'ENOENT') console.error(e);
    });
    vi.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    it('should create a new mapping with proper versioning and timestamps', async () => {
      vi.mocked(uuidv4).mockReturnValue('test-uuid-123');

      const mappingData = {
        javaSignature: 'test.create.Method',
        bedrockEquivalent: 'test.bedrock.method',
        conversionType: 'direct' as const,
        notes: 'Test mapping',
      };

      const createdMapping = await database.create(mappingData);

      expect(createdMapping.id).toBe('test-uuid-123');
      expect(createdMapping.version).toBe(1);
      expect(createdMapping.createdAt).toBeInstanceOf(Date);
      expect(createdMapping.lastUpdated).toBeInstanceOf(Date);
      expect(createdMapping.javaSignature).toBe(mappingData.javaSignature);
      expect(createdMapping.bedrockEquivalent).toBe(mappingData.bedrockEquivalent);
      expect(createdMapping.conversionType).toBe(mappingData.conversionType);
      expect(createdMapping.notes).toBe(mappingData.notes);
    });

    it('should throw ValidationError for invalid mapping data', async () => {
      const invalidMappingData = {
        javaSignature: '', // Invalid: empty signature
        bedrockEquivalent: 'test.bedrock.method',
        conversionType: 'direct' as const,
        notes: 'Test mapping',
      };

      await expect(database.create(invalidMappingData)).rejects.toThrow(ValidationError);
    });

    it('should retrieve a mapping by ID', async () => {
      vi.mocked(uuidv4).mockReturnValue('test-uuid-456');

      const mappingData = {
        javaSignature: 'test.get.Method',
        bedrockEquivalent: 'test.bedrock.get',
        conversionType: 'wrapper' as const,
        notes: 'Test get mapping',
      };

      const createdMapping = await database.create(mappingData);
      const retrievedMapping = await database.get(createdMapping.id);

      expect(retrievedMapping).toBeDefined();
      expect(retrievedMapping!.id).toBe(createdMapping.id);
      expect(retrievedMapping!.javaSignature).toBe(mappingData.javaSignature);

      // Ensure it's a deep clone (different object instances but same dates)
      expect(retrievedMapping!.createdAt).toBeInstanceOf(Date);
      expect(retrievedMapping!.createdAt.getTime()).toBe(createdMapping.createdAt.getTime());
    });

    it('should retrieve a mapping by Java signature', async () => {
      vi.mocked(uuidv4).mockReturnValue('test-uuid-789');

      const mappingData = {
        javaSignature: 'test.getBySignature.Method',
        bedrockEquivalent: 'test.bedrock.getBySignature',
        conversionType: 'complex' as const,
        notes: 'Test get by signature mapping',
      };

      await database.create(mappingData);
      const retrievedMapping = await database.getBySignature(mappingData.javaSignature);

      expect(retrievedMapping).toBeDefined();
      expect(retrievedMapping!.javaSignature).toBe(mappingData.javaSignature);
    });

    it('should update a mapping with version increment', async () => {
      vi.mocked(uuidv4).mockReturnValue('test-uuid-update');

      const mappingData = {
        javaSignature: 'test.update.Method',
        bedrockEquivalent: 'test.bedrock.update',
        conversionType: 'direct' as const,
        notes: 'Original notes',
      };

      const createdMapping = await database.create(mappingData);
      const originalVersion = createdMapping.version;
      const originalCreatedAt = createdMapping.createdAt;

      // Wait a moment to ensure lastUpdated timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 1));

      const updates = {
        notes: 'Updated notes',
        bedrockEquivalent: 'test.bedrock.updated',
      };

      const updatedMapping = await database.update(createdMapping.id, updates);

      expect(updatedMapping.version).toBe(originalVersion + 1);
      expect(updatedMapping.notes).toBe(updates.notes);
      expect(updatedMapping.bedrockEquivalent).toBe(updates.bedrockEquivalent);
      expect(updatedMapping.lastUpdated.getTime()).toBeGreaterThan(
        createdMapping.lastUpdated.getTime()
      );
      expect(updatedMapping.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    });

    it('should throw MappingNotFoundError when updating non-existent mapping', async () => {
      await expect(database.update('non-existent-id', { notes: 'test' })).rejects.toThrow(
        MappingNotFoundError
      );
    });

    it('should delete a mapping', async () => {
      vi.mocked(uuidv4).mockReturnValue('test-uuid-delete');

      const mappingData = {
        javaSignature: 'test.delete.Method',
        bedrockEquivalent: 'test.bedrock.delete',
        conversionType: 'impossible' as const,
        notes: 'To be deleted',
      };

      const createdMapping = await database.create(mappingData);
      const deleteResult = await database.delete(createdMapping.id);

      expect(deleteResult).toBe(true);

      const retrievedMapping = await database.get(createdMapping.id);
      expect(retrievedMapping).toBeUndefined();
    });

    it('should return false when deleting non-existent mapping', async () => {
      const deleteResult = await database.delete('non-existent-id');
      expect(deleteResult).toBe(false);
    });
  });

  describe('Filtering and Bulk Operations', () => {
    beforeEach(async () => {
      vi.mocked(uuidv4).mockImplementation(() => `uuid-${Math.random()}`);

      // Create test mappings
      await database.create({
        javaSignature: 'test.filter.Direct',
        bedrockEquivalent: 'test.bedrock.direct',
        conversionType: 'direct',
        notes: 'Direct conversion test',
      });

      await database.create({
        javaSignature: 'test.filter.Wrapper',
        bedrockEquivalent: 'test.bedrock.wrapper',
        conversionType: 'wrapper',
        notes: 'Wrapper conversion test',
      });
    });

    it('should filter mappings by conversion type', async () => {
      const directMappings = await database.getAll({ conversionType: 'direct' });
      const wrapperMappings = await database.getAll({ conversionType: 'wrapper' });

      expect(directMappings).toHaveLength(1);
      expect(directMappings[0].conversionType).toBe('direct');

      expect(wrapperMappings).toHaveLength(1);
      expect(wrapperMappings[0].conversionType).toBe('wrapper');
    });

    it('should filter mappings by search term', async () => {
      const searchResults = await database.getAll({ search: 'direct' });

      expect(searchResults.length).toBeGreaterThan(0);
      expect(
        searchResults.some(
          (m) =>
            m.javaSignature.toLowerCase().includes('direct') ||
            m.notes.toLowerCase().includes('direct')
        )
      ).toBe(true);
    });

    it('should return correct count', async () => {
      const count = await database.count();
      expect(count).toBe(2); // From beforeEach setup
    });
  });

  describe('Persistence', () => {
    it('should persist and load mappings from file', async () => {
      vi.mocked(uuidv4).mockReturnValue('test-uuid-persist');

      const mappingData = {
        javaSignature: 'test.persist.Method',
        bedrockEquivalent: 'test.bedrock.persist',
        conversionType: 'direct' as const,
        notes: 'Persistence test',
      };

      await database.create(mappingData);

      // Create new database instance and load from file
      const newDatabase = new InMemoryMappingDatabase(DB_PATH);
      await newDatabase.load();

      const loadedMapping = await newDatabase.getBySignature(mappingData.javaSignature);
      expect(loadedMapping).toBeDefined();
      expect(loadedMapping!.javaSignature).toBe(mappingData.javaSignature);
      expect(loadedMapping!.version).toBe(1);
    });
  });

  describe('Thread Safety', () => {
    it('should handle concurrent operations without race conditions', async () => {
      vi.mocked(uuidv4).mockImplementation(() => `concurrent-${Math.random()}`);

      const concurrentOps = Array.from({ length: 10 }, (_, i) =>
        database.create({
          javaSignature: `concurrent.test.Method${i}`,
          bedrockEquivalent: `concurrent.bedrock.method${i}`,
          conversionType: 'direct',
          notes: `Concurrent test ${i}`,
        })
      );

      const results = await Promise.all(concurrentOps);

      // All operations should succeed
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.javaSignature).toBe(`concurrent.test.Method${i}`);
        expect(result.version).toBe(1);
      });

      // Check final count
      const count = await database.count();
      expect(count).toBe(10);
    });
  });
});
