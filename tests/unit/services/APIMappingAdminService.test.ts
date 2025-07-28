/**
 * Unit tests for APIMappingAdminService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIMappingAdminService, createAPIMappingAdminService } from '../../../src/services/APIMappingAdminService';
import { APIMapperService } from '../../../src/types/api';
import { APIMapping } from '../../../src/types/api';

// Mock dependencies
vi.mock('../../../src/utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

vi.mock('../../../src/utils/errorHandler', () => ({
  ErrorHandler: {
    systemError: vi.fn()
  }
}));

describe('APIMappingAdminService', () => {
  let adminService: APIMappingAdminService;
  let mockAPIMapperService: APIMapperService;

  beforeEach(() => {
    // Create mock API mapper service
    mockAPIMapperService = {
      getMapping: vi.fn(),
      getMappings: vi.fn().mockResolvedValue([]),
      addMapping: vi.fn().mockResolvedValue(undefined),
      updateMapping: vi.fn().mockResolvedValue(undefined),
      importMappings: vi.fn().mockResolvedValue({ added: 0, updated: 0, failed: 0, failures: [] })
    };

    adminService = new APIMappingAdminService(mockAPIMapperService);
  });

  describe('validateMapping', () => {
    it('should validate a correct mapping', () => {
      const validMapping: APIMapping = {
        id: 'test-mapping',
        javaSignature: 'net.minecraft.entity.Entity.getPosition',
        bedrockEquivalent: 'entity.location',
        conversionType: 'direct',
        notes: 'Test mapping',
        version: '1.0.0',
        lastUpdated: new Date()
      };

      const result = adminService.validateMapping(validMapping);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject mapping with missing required fields', () => {
      const invalidMapping = {
        javaSignature: 'test.signature',
        bedrockEquivalent: 'test.equivalent',
        conversionType: 'direct',
        notes: 'Test mapping'
        // Missing id and version
      } as APIMapping;

      const result = adminService.validateMapping(invalidMapping);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Mapping ID is required');
      expect(result.errors).toContain('Version is required');
    });

    it('should reject mapping with invalid conversion type', () => {
      const invalidMapping: APIMapping = {
        id: 'test-mapping',
        javaSignature: 'test.signature',
        bedrockEquivalent: 'test.equivalent',
        conversionType: 'invalid' as any,
        notes: 'Test mapping',
        version: '1.0.0',
        lastUpdated: new Date()
      };

      const result = adminService.validateMapping(invalidMapping);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid conversion type. Must be: direct, wrapper, complex, or impossible');
    });

    it('should warn about missing notes', () => {
      const mappingWithoutNotes: APIMapping = {
        id: 'test-mapping',
        javaSignature: 'test.signature',
        bedrockEquivalent: 'test.equivalent',
        conversionType: 'direct',
        notes: '',
        version: '1.0.0',
        lastUpdated: new Date()
      };

      const result = adminService.validateMapping(mappingWithoutNotes);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Notes are recommended for better documentation');
    });

    it('should validate impossible conversions correctly', () => {
      const impossibleMapping: APIMapping = {
        id: 'impossible-mapping',
        javaSignature: 'net.minecraft.client.renderer.RenderType',
        bedrockEquivalent: 'UNSUPPORTED',
        conversionType: 'impossible',
        notes: 'Client-side rendering not supported',
        version: '1.0.0',
        lastUpdated: new Date()
      };

      const result = adminService.validateMapping(impossibleMapping);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about inconsistent impossible mappings', () => {
      const inconsistentMapping: APIMapping = {
        id: 'inconsistent-mapping',
        javaSignature: 'test.signature',
        bedrockEquivalent: 'some.equivalent',
        conversionType: 'impossible',
        notes: 'Test mapping',
        version: '1.0.0',
        lastUpdated: new Date()
      };

      const result = adminService.validateMapping(inconsistentMapping);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Impossible conversions should have "UNSUPPORTED" as bedrock equivalent');
    });

    it('should reject direct conversions with UNSUPPORTED equivalent', () => {
      const invalidDirectMapping: APIMapping = {
        id: 'invalid-direct',
        javaSignature: 'test.signature',
        bedrockEquivalent: 'UNSUPPORTED',
        conversionType: 'direct',
        notes: 'Test mapping',
        version: '1.0.0',
        lastUpdated: new Date()
      };

      const result = adminService.validateMapping(invalidDirectMapping);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Direct conversions cannot have "UNSUPPORTED" as bedrock equivalent');
    });
  });

  describe('validateMappings', () => {
    it('should separate valid and invalid mappings', () => {
      const mappings: APIMapping[] = [
        {
          id: 'valid-mapping',
          javaSignature: 'valid.signature',
          bedrockEquivalent: 'valid.equivalent',
          conversionType: 'direct',
          notes: 'Valid mapping',
          version: '1.0.0',
          lastUpdated: new Date()
        },
        {
          // Missing required fields
          javaSignature: 'invalid.signature',
          bedrockEquivalent: 'invalid.equivalent',
          conversionType: 'direct',
          notes: 'Invalid mapping'
        } as APIMapping
      ];

      const result = adminService.validateMappings(mappings);
      
      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
      expect(result.valid[0].id).toBe('valid-mapping');
      expect(result.invalid[0].mapping.javaSignature).toBe('invalid.signature');
    });
  });

  describe('bulkAddMappings', () => {
    it('should add valid mappings and report failures', async () => {
      const mappings: APIMapping[] = [
        {
          id: 'valid-mapping-1',
          javaSignature: 'valid.signature1',
          bedrockEquivalent: 'valid.equivalent1',
          conversionType: 'direct',
          notes: 'Valid mapping 1',
          version: '1.0.0',
          lastUpdated: new Date()
        },
        {
          id: 'valid-mapping-2',
          javaSignature: 'valid.signature2',
          bedrockEquivalent: 'valid.equivalent2',
          conversionType: 'wrapper',
          notes: 'Valid mapping 2',
          version: '1.0.0',
          lastUpdated: new Date()
        }
      ];

      const result = await adminService.bulkAddMappings(mappings);
      
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockAPIMapperService.addMapping).toHaveBeenCalledTimes(2);
    });

    it('should handle validation failures', async () => {
      const mappings: APIMapping[] = [
        {
          id: 'valid-mapping',
          javaSignature: 'valid.signature',
          bedrockEquivalent: 'valid.equivalent',
          conversionType: 'direct',
          notes: 'Valid mapping',
          version: '1.0.0',
          lastUpdated: new Date()
        },
        {
          // Missing required fields
          javaSignature: 'invalid.signature',
          bedrockEquivalent: 'invalid.equivalent',
          conversionType: 'direct',
          notes: 'Invalid mapping'
        } as APIMapping
      ];

      const result = await adminService.bulkAddMappings(mappings);
      
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(mockAPIMapperService.addMapping).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors', async () => {
      const mappings: APIMapping[] = [
        {
          id: 'test-mapping',
          javaSignature: 'test.signature',
          bedrockEquivalent: 'test.equivalent',
          conversionType: 'direct',
          notes: 'Test mapping',
          version: '1.0.0',
          lastUpdated: new Date()
        }
      ];

      // Mock service to throw error
      mockAPIMapperService.addMapping = vi.fn().mockRejectedValue(new Error('Service error'));

      const result = await adminService.bulkAddMappings(mappings);
      
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Service error');
    });
  });

  describe('bulkUpdateMappings', () => {
    it('should update valid mappings', async () => {
      const mappings: APIMapping[] = [
        {
          id: 'existing-mapping',
          javaSignature: 'existing.signature',
          bedrockEquivalent: 'updated.equivalent',
          conversionType: 'wrapper',
          notes: 'Updated mapping',
          version: '1.1.0',
          lastUpdated: new Date()
        }
      ];

      const result = await adminService.bulkUpdateMappings(mappings);
      
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockAPIMapperService.updateMapping).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMappingStatistics', () => {
    it('should generate statistics from mappings', async () => {
      const mockMappings: APIMapping[] = [
        {
          id: 'mapping-1',
          javaSignature: 'test.signature1',
          bedrockEquivalent: 'test.equivalent1',
          conversionType: 'direct',
          notes: 'Test mapping 1',
          version: '1.0.0',
          lastUpdated: new Date()
        },
        {
          id: 'mapping-2',
          javaSignature: 'test.signature2',
          bedrockEquivalent: 'test.equivalent2',
          conversionType: 'direct',
          notes: 'Test mapping 2',
          version: '1.0.0',
          lastUpdated: new Date()
        },
        {
          id: 'mapping-3',
          javaSignature: 'test.signature3',
          bedrockEquivalent: 'UNSUPPORTED',
          conversionType: 'impossible',
          notes: 'Test mapping 3',
          version: '2.0.0',
          lastUpdated: new Date()
        }
      ];

      mockAPIMapperService.getMappings = vi.fn().mockResolvedValue(mockMappings);

      const stats = await adminService.getMappingStatistics();
      
      expect(stats.totalMappings).toBe(3);
      expect(stats.byConversionType.direct).toBe(2);
      expect(stats.byConversionType.impossible).toBe(1);
      expect(stats.byVersion['1.0.0']).toBe(2);
      expect(stats.byVersion['2.0.0']).toBe(1);
    });

    it('should handle service errors gracefully', async () => {
      mockAPIMapperService.getMappings = vi.fn().mockRejectedValue(new Error('Service error'));

      const stats = await adminService.getMappingStatistics();
      
      expect(stats.totalMappings).toBe(0);
      expect(stats.byConversionType).toEqual({});
      expect(stats.byVersion).toEqual({});
    });
  });

  describe('exportMappings', () => {
    it('should export mappings as JSON', async () => {
      const mockMappings: APIMapping[] = [
        {
          id: 'test-mapping',
          javaSignature: 'test.signature',
          bedrockEquivalent: 'test.equivalent',
          conversionType: 'direct',
          notes: 'Test mapping',
          version: '1.0.0',
          lastUpdated: new Date('2023-01-01')
        }
      ];

      mockAPIMapperService.getMappings = vi.fn().mockResolvedValue(mockMappings);

      const jsonString = await adminService.exportMappings();
      const exportData = JSON.parse(jsonString);
      
      expect(exportData.mappings).toHaveLength(1);
      expect(exportData.mappings[0].id).toBe('test-mapping');
      expect(exportData.version).toBe('1.0.0');
      expect(exportData.exportedAt).toBeDefined();
    });
  });

  describe('importMappingsFromJson', () => {
    it('should import valid mappings from JSON', async () => {
      const importData = {
        version: '1.0.0',
        mappings: [
          {
            id: 'imported-mapping',
            javaSignature: 'imported.signature',
            bedrockEquivalent: 'imported.equivalent',
            conversionType: 'direct',
            notes: 'Imported mapping',
            version: '1.0.0',
            lastUpdated: new Date().toISOString()
          }
        ]
      };

      const jsonString = JSON.stringify(importData);
      const result = await adminService.importMappingsFromJson(jsonString);
      
      expect(mockAPIMapperService.importMappings).toHaveBeenCalledTimes(1);
      expect(result.added).toBeDefined();
    });

    it('should handle invalid JSON format', async () => {
      const invalidJson = '{"invalid": "format"}';
      
      await expect(adminService.importMappingsFromJson(invalidJson))
        .rejects.toThrow('Invalid import format: mappings array not found');
    });

    it('should handle malformed JSON', async () => {
      const malformedJson = '{"invalid": json}';
      
      await expect(adminService.importMappingsFromJson(malformedJson))
        .rejects.toThrow();
    });
  });

  describe('factory function', () => {
    it('should create APIMappingAdminService instance', () => {
      const service = createAPIMappingAdminService(mockAPIMapperService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(APIMappingAdminService);
    });
  });
});