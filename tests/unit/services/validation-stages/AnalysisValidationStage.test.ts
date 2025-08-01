/**
 * AnalysisValidationStage Unit Tests
 * 
 * Tests for the analysis validation stage implementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnalysisValidationStage } from '../../../../src/services/validation-stages/AnalysisValidationStage';
import { ValidationInput } from '../../../../src/services/ValidationPipeline';
import { ErrorType, ErrorSeverity } from '../../../../src/types/errors';

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

describe('AnalysisValidationStage', () => {
  let stage: AnalysisValidationStage;
  
  beforeEach(() => {
    stage = new AnalysisValidationStage();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('stage properties', () => {
    it('should have correct stage properties', () => {
      expect(stage.name).toBe('analysis');
      expect(stage.required).toBe(false);
      expect(stage.timeout).toBe(15000);
    });
  });
  
  describe('missing analysis results', () => {
    it('should skip validation when no analysis results provided', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content')
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('No analysis results provided');
      expect(result.metadata?.skipped).toBe(true);
    });
  });
  
  describe('mod ID validation', () => {
    it('should fail when mod ID is missing', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          registryNames: ['test_block']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Mod ID is missing');
      expect(result.errors[0].type).toBe(ErrorType.VALIDATION);
    });
    
    it('should fail when mod ID is empty string', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: '',
          registryNames: ['test_block']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be a non-empty string');
    });
    
    it('should fail when mod ID is not a string', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 123,
          registryNames: ['test_block']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be a non-empty string');
    });
    
    it('should warn about invalid naming conventions', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'Invalid-Mod-Name',
          registryNames: ['test_block']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('should follow naming conventions');
    });
    
    it('should warn about unusually long mod ID', async () => {
      const longModId = 'a'.repeat(70);
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: longModId,
          registryNames: ['test_block']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('unusually long');
    });
    
    it('should pass with valid mod ID', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          texturePaths: ['textures/block/test.png'],
          manifestInfo: {
            modId: 'test_mod',
            modName: 'Test Mod',
            version: '1.0.0'
          }
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
  
  describe('registry names validation', () => {
    it('should warn when no registry names found', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod'
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.message.includes('No registry names found'))).toBe(true);
    });
    
    it('should fail when registry names is not an array', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: 'not_an_array'
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be an array');
    });
    
    it('should warn when registry names array is empty', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: []
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.message.includes('No registry names extracted'))).toBe(true);
    });
    
    it('should fail when registry name is invalid', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['valid_name', 123, 'another_valid']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Registry name at index 1 is invalid');
    });
    
    it('should warn about invalid naming conventions', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['valid_name', 'Invalid-Name', 'another_valid']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('doesn\'t follow naming conventions');
    });
    
    it('should warn about duplicate registry names', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['block_one', 'block_two', 'block_one', 'block_three']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Duplicate registry names detected');
    });
  });
  
  describe('texture paths validation', () => {
    it('should warn when no texture paths found', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.message.includes('No texture paths found'))).toBe(true);
    });
    
    it('should fail when texture paths is not an array', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          texturePaths: 'not_an_array'
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be an array');
    });
    
    it('should fail when texture path is invalid', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          texturePaths: ['valid/path.png', null, 'another/path.png']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Texture path at index 1 is invalid');
    });
    
    it('should warn about unrecognized image extensions', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          texturePaths: ['textures/block/stone.png', 'textures/item/sword.txt']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('doesn\'t have a recognized image extension');
    });
    
    it('should warn about missing directory structure', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          texturePaths: ['stone.png', 'textures/block/iron.png']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('missing directory structure');
    });
  });
  
  describe('manifest info validation', () => {
    it('should warn when no manifest info found', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.message.includes('No manifest information found'))).toBe(true);
    });
    
    it('should fail when required manifest fields are missing', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          manifestInfo: {
            modName: 'Test Mod'
            // Missing modId and version
          }
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2); // Missing modId and version
      expect(result.errors.some(e => e.message.includes('modId'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('version'))).toBe(true);
    });
    
    it('should warn about non-semantic version format', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          manifestInfo: {
            modId: 'test_mod',
            modName: 'Test Mod',
            version: 'v1.0-beta'
          }
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('doesn\'t follow semantic versioning');
    });
    
    it('should fail when dependencies are malformed', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          manifestInfo: {
            modId: 'test_mod',
            modName: 'Test Mod',
            version: '1.0.0',
            dependencies: [
              { modId: 'dep1', version: '1.0.0' },
              { modId: 'dep2' }, // Missing version
              { version: '2.0.0' } // Missing modId
            ]
          }
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.some(e => e.message.includes('Dependency at index 1'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('Dependency at index 2'))).toBe(true);
    });
    
    it('should pass with valid manifest info', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          manifestInfo: {
            modId: 'test_mod',
            modName: 'Test Mod',
            version: '1.0.0',
            description: 'A test mod',
            author: 'Test Author',
            dependencies: [
              { modId: 'forge', version: '36.2.0', required: true }
            ]
          }
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
  
  describe('analysis notes validation', () => {
    it('should pass when no analysis notes provided', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
    });
    
    it('should fail when analysis notes is not an array', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          analysisNotes: 'not_an_array'
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be an array');
    });
    
    it('should fail when analysis note is missing required fields', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          analysisNotes: [
            { type: 'info', message: 'Valid note' },
            { type: 'warning' }, // Missing message
            { message: 'Missing type' } // Missing type
          ]
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.some(e => e.message.includes('Analysis note at index 1'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('Analysis note at index 2'))).toBe(true);
    });
    
    it('should warn about invalid note types', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          analysisNotes: [
            { type: 'info', message: 'Valid note' },
            { type: 'invalid_type', message: 'Invalid type note' }
          ]
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('has invalid type');
    });
  });
  
  describe('extraction completeness validation', () => {
    it('should warn about low registry name count', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: [],
          texturePaths: ['texture1.png', 'texture2.png']
        }
      };
      
      const config = { minRegistryNames: 2 };
      
      const result = await stage.validate(input, config);
      
      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.message.includes('Low registry name count'))).toBe(true);
    });
    
    it('should warn about low texture path count', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['block1', 'block2'],
          texturePaths: []
        }
      };
      
      const config = { minTexturePaths: 1 };
      
      const result = await stage.validate(input, config);
      
      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.message.includes('Low texture path count'))).toBe(true);
    });
    
    it('should warn when registry names don\'t match mod ID', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'my_mod',
          registryNames: ['other_block', 'different_item'],
          texturePaths: ['texture.png']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.message.includes('No registry names match the mod ID'))).toBe(true);
    });
    
    it('should pass when registry names match mod ID', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'my_mod',
          registryNames: ['my_mod_block', 'other_block', 'my_mod_item'],
          texturePaths: ['texture.png']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.passed).toBe(true);
      expect(result.warnings.filter(w => w.message.includes('No registry names match')).length).toBe(0);
    });
  });
  
  describe('error handling', () => {
    it('should handle validation execution errors', async () => {
      // Create a mock that throws during validation
      const originalValidate = stage.validate;
      stage.validate = vi.fn().mockImplementation(() => {
        throw new Error('Analysis validation error');
      });
      
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: { modId: 'test_mod' }
      };
      
      const result = await originalValidate.call(stage, input);
      
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Analysis validation execution failed');
      expect(result.errors[0].severity).toBe(ErrorSeverity.ERROR);
    });
  });
  
  describe('metadata reporting', () => {
    it('should include checks performed in metadata', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block'],
          texturePaths: ['texture.png'],
          manifestInfo: { modId: 'test_mod', modName: 'Test', version: '1.0.0' },
          analysisNotes: [{ type: 'info', message: 'Test note' }]
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.metadata?.checksPerformed).toEqual([
        'mod_id',
        'registry_names',
        'texture_paths',
        'manifest_info',
        'analysis_notes',
        'extraction_completeness'
      ]);
    });
    
    it('should report execution time', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        analysisResults: {
          modId: 'test_mod',
          registryNames: ['test_block']
        }
      };
      
      const result = await stage.validate(input);
      
      expect(result.executionTime).toBeGreaterThan(0);
      expect(typeof result.executionTime).toBe('number');
    });
  });
});