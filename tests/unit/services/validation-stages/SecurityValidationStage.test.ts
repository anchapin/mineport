/**
 * SecurityValidationStage Unit Tests
 *
 * Tests for the security validation stage implementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SecurityValidationStage } from '../../../../src/services/validation-stages/SecurityValidationStage.js';
import { ValidationInput } from '../../../../src/services/ValidationPipeline.js';
import { ErrorType, ErrorSeverity } from '../../../../src/types/errors.js';

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('SecurityValidationStage', () => {
  let stage: SecurityValidationStage;

  beforeEach(() => {
    stage = new SecurityValidationStage();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('stage properties', () => {
    it('should have correct stage properties', () => {
      expect(stage.name).toBe('security');
      expect(stage.required).toBe(true);
      expect(stage.timeout).toBe(30000);
    });
  });

  describe('file size validation', () => {
    it('should pass validation for files within size limit', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('small file content'),
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stageName).toBe('security');
    });

    it('should fail validation for files exceeding size limit', async () => {
      const largeContent = Buffer.alloc(600 * 1024 * 1024); // 600MB
      const input: ValidationInput = {
        filePath: 'large.jar',
        fileContent: largeContent,
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('exceeds maximum allowed size');
      expect(result.errors[0].type).toBe(ErrorType.SECURITY);
      expect(result.errors[0].severity).toBe(ErrorSeverity.ERROR);
    });

    it('should respect custom size limit from config', async () => {
      const content = Buffer.alloc(10 * 1024); // 10KB
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: content,
      };

      const config = { maxFileSize: 5 * 1024 }; // 5KB limit

      const result = await stage.validate(input, config);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('exceeds maximum allowed size');
    });
  });

  describe('malicious pattern detection', () => {
    it('should detect Runtime.getRuntime().exec patterns', async () => {
      const maliciousContent = Buffer.from('Runtime.getRuntime().exec("rm -rf /")');
      const input: ValidationInput = {
        filePath: 'malicious.jar',
        fileContent: maliciousContent,
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Runtime execution detected');
      expect(result.errors[0].severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should detect ProcessBuilder patterns', async () => {
      const maliciousContent = Buffer.from('new ProcessBuilder("cmd", "/c", "del").start()');
      const input: ValidationInput = {
        filePath: 'malicious.jar',
        fileContent: maliciousContent,
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Process builder detected');
      expect(result.errors[0].severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should detect System.exit patterns', async () => {
      const maliciousContent = Buffer.from('System.exit(1)');
      const input: ValidationInput = {
        filePath: 'malicious.jar',
        fileContent: maliciousContent,
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('System exit call detected');
      expect(result.errors[0].severity).toBe(ErrorSeverity.ERROR);
    });

    it('should detect File.delete patterns as warnings', async () => {
      const suspiciousContent = Buffer.from('File.delete()');
      const input: ValidationInput = {
        filePath: 'suspicious.jar',
        fileContent: suspiciousContent,
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true); // Warnings don't fail validation
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('File deletion detected');
      expect(result.warnings[0].severity).toBe(ErrorSeverity.WARNING);
    });

    it('should detect multiple suspicious patterns', async () => {
      const maliciousContent = Buffer.from(`
        Runtime.getRuntime().exec("malicious");
        new ProcessBuilder("bad").start();
        System.exit(0);
        File.delete();
      `);
      const input: ValidationInput = {
        filePath: 'very-malicious.jar',
        fileContent: maliciousContent,
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('path traversal validation', () => {
    it('should detect ../ path traversal attempts', async () => {
      const input: ValidationInput = {
        filePath: '../../../safe/file.txt',
        fileContent: Buffer.from('content'),
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Path traversal attempt detected');
      expect(result.errors[0].severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should detect ..\\  path traversal attempts', async () => {
      const input: ValidationInput = {
        filePath: '..\\..\\Windows\\System32\\config',
        fileContent: Buffer.from('content'),
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Path traversal attempt detected');
    });

    it('should detect /etc/ access attempts', async () => {
      const input: ValidationInput = {
        filePath: '/etc/shadow',
        fileContent: Buffer.from('content'),
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Path traversal attempt detected');
    });

    it('should detect Windows system directory access', async () => {
      const input: ValidationInput = {
        filePath: 'C:\\Windows\\System32\\important.dll',
        fileContent: Buffer.from('content'),
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Path traversal attempt detected');
    });

    it('should allow safe file paths', async () => {
      const input: ValidationInput = {
        filePath: 'assets/textures/block/stone.png',
        fileContent: Buffer.from('content'),
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('analysis results validation', () => {
    it('should detect suspicious registry names', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
        analysisResults: {
          registryNames: ['normal_block', 'hack_tool', 'exploit_item', 'backdoor_entity'],
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true); // Warnings don't fail validation
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Suspicious registry names detected');
      expect(result.warnings[0].details?.suspiciousNames).toEqual([
        'hack_tool',
        'exploit_item',
        'backdoor_entity',
      ]);
    });

    it('should detect suspicious texture paths', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
        analysisResults: {
          texturePaths: [
            'textures/block/stone.png',
            '../../../system/hack.png',
            '/root/exploit.png',
          ],
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Suspicious texture paths detected');
      expect(result.errors[0].details?.suspiciousPaths).toEqual([
        '../../../system/hack.png',
        '/root/exploit.png',
      ]);
    });

    it('should pass with clean analysis results', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
        analysisResults: {
          registryNames: ['stone_block', 'iron_ore', 'diamond_sword'],
          texturePaths: ['textures/block/stone.png', 'textures/item/diamond.png'],
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('conversion results validation', () => {
    it('should detect suspicious output file paths', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
        conversionResults: {
          outputFiles: [
            { path: 'behavior_pack/blocks/stone.json' },
            { path: '../../../system/malicious.exe' },
            { path: '/admin/backdoor.js' },
          ],
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Suspicious output file paths detected');
      expect(result.errors[0].details?.suspiciousFiles).toEqual([
        '../../../system/malicious.exe',
        '/admin/backdoor.js',
      ]);
    });

    it('should warn about excessive processing time', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
        conversionResults: {
          metadata: {
            processingTime: 400000, // 6.67 minutes
            memoryUsage: 1024 * 1024,
            fileCount: 100,
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Excessive processing time detected');
    });

    it('should warn about excessive file count', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
        conversionResults: {
          metadata: {
            processingTime: 5000,
            memoryUsage: 1024 * 1024,
            fileCount: 15000,
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Excessive file count detected');
    });
  });

  describe('error handling', () => {
    it('should handle validation execution errors', async () => {
      // Mock one of the internal methods to throw an error
      const originalValidateFileSize = (stage as any).validateFileSize;
      (stage as any).validateFileSize = vi.fn().mockImplementation(() => {
        throw new Error('Internal validation error');
      });

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Security validation execution failed');
      expect(result.errors[0].severity).toBe(ErrorSeverity.CRITICAL);

      // Restore the original method
      (stage as any).validateFileSize = originalValidateFileSize;
    });
  });

  describe('metadata reporting', () => {
    it('should include checks performed in metadata', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
        analysisResults: { registryNames: [] },
        conversionResults: { outputFiles: [] },
      };

      const result = await stage.validate(input);

      expect(result.metadata?.checksPerformed).toEqual([
        'file_size',
        'malicious_patterns',
        'path_traversal',
        'analysis_security',
        'conversion_security',
      ]);
    });

    it('should report execution time', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
      };

      const result = await stage.validate(input);

      expect(result.executionTime).toBeGreaterThan(0);
      expect(typeof result.executionTime).toBe('number');
    });
  });
});
