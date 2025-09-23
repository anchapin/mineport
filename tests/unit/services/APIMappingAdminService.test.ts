import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  APIMappingAdminService,
  createAPIMappingAdminService,
} from '../../../src/services/APIMappingAdminService.js';
import { APIMapperService, APIMapping } from '../../../src/types/api.js';

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
  },
}));

describe('APIMappingAdminService', () => {
  let adminService: APIMappingAdminService;
  let mockAPIMapperService: APIMapperService;

  beforeEach(() => {
    mockAPIMapperService = {
      getMapping: vi.fn(),
      getMappings: vi.fn().mockResolvedValue([]),
      addMapping: vi.fn(),
      updateMapping: vi.fn(),
      importMappings: vi.fn().mockResolvedValue({ added: 0, updated: 0, failed: 0, failures: [] }),
      deleteMapping: vi.fn(),
      mapJavaToBedrock: vi.fn(),
      getDatabaseStats: vi.fn(),
      getCacheStats: vi.fn(),
      clearCache: vi.fn(),
    };

    adminService = new APIMappingAdminService(mockAPIMapperService);
  });

  describe('validateMapping', () => {
    it('should validate a correct mapping', async () => {
      const validMapping: Partial<APIMapping> = {
        javaSignature: 'net.minecraft.entity.Entity.getPosition()',
        bedrockEquivalent: 'entity.location',
        conversionType: 'direct',
        notes: 'Test mapping',
      };
      (mockAPIMapperService.getMapping as vi.Mock).mockResolvedValue(undefined);
      const result = await adminService.validateMapping(validMapping);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject mapping with invalid Java signature', async () => {
      const invalidMapping: Partial<APIMapping> = {
        javaSignature: 'invalid-signature',
        bedrockEquivalent: 'entity.location',
        conversionType: 'direct',
      };
      const result = await adminService.validateMapping(invalidMapping);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid Java signature format. Expected format: package.class.method(parameters)'
      );
    });

    it('should reject mapping with existing signature', async () => {
      const existingMapping: APIMapping = {
        id: 'existing-id',
        javaSignature: 'net.minecraft.entity.Entity.getPosition()',
        bedrockEquivalent: 'entity.location',
        conversionType: 'direct',
        notes: 'Test mapping',
        version: 1,
        createdAt: new Date(),
        lastUpdated: new Date(),
      };
      const newMapping: Partial<APIMapping> = {
        id: 'new-id',
        javaSignature: 'net.minecraft.entity.Entity.getPosition()',
        bedrockEquivalent: 'entity.location',
        conversionType: 'direct',
      };
      (mockAPIMapperService.getMapping as vi.Mock).mockResolvedValue(existingMapping);
      const result = await adminService.validateMapping(newMapping);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `A mapping with the signature "${newMapping.javaSignature}" already exists (ID: ${existingMapping.id}).`
      );
    });
  });

  describe('validateMappings', () => {
    it('should separate valid and invalid mappings', async () => {
      const mappings: APIMapping[] = [
        {
          id: 'valid-1',
          javaSignature: 'valid.signature.one()',
          bedrockEquivalent: 'valid.one',
          conversionType: 'direct',
          notes: 'Valid',
          version: 1,
          createdAt: new Date(),
          lastUpdated: new Date(),
        },
        {
          id: 'invalid-1',
          javaSignature: 'invalid-signature',
          bedrockEquivalent: 'invalid.one',
          conversionType: 'direct',
          notes: 'Invalid',
          version: 1,
          createdAt: new Date(),
          lastUpdated: new Date(),
        },
      ];
      (mockAPIMapperService.getMapping as vi.Mock).mockResolvedValue(undefined);
      const result = await adminService.validateMappings(mappings);
      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
      expect(result.valid[0].id).toBe('valid-1');
      expect(result.invalid[0].mapping.id).toBe('invalid-1');
    });

    it('should detect duplicate signatures within the batch', async () => {
      const mappings: APIMapping[] = [
        {
          id: 'valid-1',
          javaSignature: 'duplicate.signature()',
          bedrockEquivalent: 'valid.one',
          conversionType: 'direct',
          notes: 'Valid',
          version: 1,
          createdAt: new Date(),
          lastUpdated: new Date(),
        },
        {
          id: 'valid-2',
          javaSignature: 'duplicate.signature()',
          bedrockEquivalent: 'valid.two',
          conversionType: 'direct',
          notes: 'Valid',
          version: 1,
          createdAt: new Date(),
          lastUpdated: new Date(),
        },
      ];
      (mockAPIMapperService.getMapping as vi.Mock).mockResolvedValue(undefined);
      const result = await adminService.validateMappings(mappings);
      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].validation.errors).toContain(
        `Duplicate Java signature "duplicate.signature()" found in the import batch.`
      );
    });
  });

  describe('bulkAddMappings', () => {
    it('should add valid mappings and report failures', async () => {
      const mappings: APIMapping[] = [
        {
          id: 'valid-1',
          javaSignature: 'valid.signature.one()',
          bedrockEquivalent: 'valid.one',
          conversionType: 'direct',
          notes: 'Valid',
          version: 1,
          createdAt: new Date(),
          lastUpdated: new Date(),
        },
        {
          id: 'invalid-1',
          javaSignature: 'invalid-signature',
          bedrockEquivalent: 'invalid.one',
          conversionType: 'direct',
          notes: 'Invalid',
          version: 1,
          createdAt: new Date(),
          lastUpdated: new Date(),
        },
      ];
      (mockAPIMapperService.getMapping as vi.Mock).mockResolvedValue(undefined);
      const result = await adminService.bulkAddMappings(mappings);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(mockAPIMapperService.addMapping).toHaveBeenCalledTimes(1);
    });
  });
});
