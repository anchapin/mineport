/**
 * Unit tests for FileProcessor class
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { FileProcessor } from '../../../../src/modules/ingestion/FileProcessor.js';
import { FileValidationOptions } from '../../../../src/types/file-processing.js';

// Mock fs module
vi.mock('fs/promises');

describe('FileProcessor', () => {
  let fileProcessor: FileProcessor;
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    fileProcessor = new FileProcessor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const processor = new FileProcessor();
      const options = processor.getOptions();

      expect(options.maxFileSize).toBe(500 * 1024 * 1024);
      expect(options.enableMalwareScanning).toBe(true);
      expect(options.allowedMimeTypes).toContain('application/java-archive');
      expect(options.allowedMimeTypes).toContain('application/zip');
    });

    it('should accept custom options', () => {
      const customOptions: Partial<FileValidationOptions> = {
        maxFileSize: 100 * 1024 * 1024,
        enableMalwareScanning: false,
      };

      const processor = new FileProcessor(customOptions);
      const options = processor.getOptions();

      expect(options.maxFileSize).toBe(100 * 1024 * 1024);
      expect(options.enableMalwareScanning).toBe(false);
    });
  });

  describe('validateUpload', () => {
    it('should validate a valid JAR file', async () => {
      const validJarBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test-mod.jar';

      // Mock security scanner to return safe result
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id',
        }),
      };
      (fileProcessor as any).securityScanner = mockSecurityScanner;

      const result = await fileProcessor.validateUpload(validJarBuffer, filename);

      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('application/java-archive');
      expect(result.size).toBe(validJarBuffer.length);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.mimeType).toBe('application/java-archive');
      expect(result.metadata?.extension).toBe('.jar');
    });

    it('should validate a valid ZIP file', async () => {
      const validZipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test-archive.zip';

      // Mock security scanner to return safe result
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id',
        }),
      };
      (fileProcessor as any).securityScanner = mockSecurityScanner;

      const result = await fileProcessor.validateUpload(validZipBuffer, filename);

      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('application/zip');
      expect(result.size).toBe(validZipBuffer.length);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty files', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const filename = 'empty.jar';

      const result = await fileProcessor.validateUpload(emptyBuffer, filename);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('EMPTY_FILE');
      expect(result.errors[0].severity).toBe('critical');
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(600 * 1024 * 1024); // 600MB
      const filename = 'large-mod.jar';

      const result = await fileProcessor.validateUpload(largeBuffer, filename);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => error.code === 'FILE_TOO_LARGE')).toBe(true);
      expect(result.errors.find((error) => error.code === 'FILE_TOO_LARGE')?.severity).toBe(
        'critical'
      );
    });

    it('should reject files with invalid magic numbers', async () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);
      const filename = 'invalid.jar';

      const result = await fileProcessor.validateUpload(invalidBuffer, filename);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.code === 'INVALID_MAGIC_NUMBER')).toBe(true);
    });

    it('should handle files that are too small for magic number validation', async () => {
      const tinyBuffer = Buffer.from([0x50, 0x4b]); // Only 2 bytes
      const filename = 'tiny.jar';

      const result = await fileProcessor.validateUpload(tinyBuffer, filename);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.code === 'INVALID_MAGIC_NUMBER')).toBe(true);
    });

    it('should generate correct file metadata', async () => {
      const testBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0x42)]);
      const filename = 'test-mod.jar';

      // Mock security scanner to return safe result
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id',
        }),
      };
      (fileProcessor as any).securityScanner = mockSecurityScanner;

      const result = await fileProcessor.validateUpload(testBuffer, filename);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.mimeType).toBe('application/java-archive');
      expect(result.metadata?.extension).toBe('.jar');
      expect(result.metadata?.magicNumber).toBe('504B0304');
      expect(result.metadata?.checksum).toBeDefined();
      expect(result.metadata?.checksum).toHaveLength(64); // SHA-256 hex string
    });

    it('should warn about unexpected file extensions', async () => {
      const validBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test-mod.exe'; // Wrong extension

      // Mock security scanner to return safe result
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id',
        }),
      };
      (fileProcessor as any).securityScanner = mockSecurityScanner;

      const result = await fileProcessor.validateUpload(validBuffer, filename);

      expect(result.warnings.some((warning) => warning.code === 'UNEXPECTED_EXTENSION')).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      const testBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test-mod.jar';

      // Mock security scanner to throw an error
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockRejectedValue(new Error('Scanner failed')),
      };

      // Replace the security scanner
      (fileProcessor as any).securityScanner = mockSecurityScanner;

      const result = await fileProcessor.validateUpload(testBuffer, filename);

      // Should still validate basic properties but add warning about security scan failure
      expect(result.warnings.some((warning) => warning.code === 'SECURITY_SCAN_FAILED')).toBe(true);
    });
  });

  describe('updateOptions', () => {
    it('should update validation options', () => {
      const newOptions: Partial<FileValidationOptions> = {
        maxFileSize: 200 * 1024 * 1024,
        enableMalwareScanning: false,
      };

      fileProcessor.updateOptions(newOptions);
      const options = fileProcessor.getOptions();

      expect(options.maxFileSize).toBe(200 * 1024 * 1024);
      expect(options.enableMalwareScanning).toBe(false);
      // Should preserve other options
      expect(options.allowedMimeTypes).toContain('application/java-archive');
    });
  });

  describe('getSecurityScanner', () => {
    it('should return the security scanner instance', () => {
      const scanner = fileProcessor.getSecurityScanner();
      expect(scanner).toBeDefined();
    });
  });

  describe('file type detection', () => {
    beforeEach(() => {
      // Mock security scanner for all file type detection tests
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id',
        }),
      };
      (fileProcessor as any).securityScanner = mockSecurityScanner;
    });

    it('should detect JAR files correctly', async () => {
      const jarBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test.jar';

      const result = await fileProcessor.validateUpload(jarBuffer, filename);
      expect(result.fileType).toBe('application/java-archive');
    });

    it('should detect ZIP files correctly', async () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test.zip';

      const result = await fileProcessor.validateUpload(zipBuffer, filename);
      expect(result.fileType).toBe('application/zip');
    });

    it('should handle files without proper magic numbers', async () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);
      const filename = 'test.jar';

      const result = await fileProcessor.validateUpload(invalidBuffer, filename);
      expect(result.fileType).toBe('application/java-archive'); // Based on extension fallback
    });
  });

  describe('checksum generation', () => {
    beforeEach(() => {
      // Mock security scanner for checksum tests
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id',
        }),
      };
      (fileProcessor as any).securityScanner = mockSecurityScanner;
    });

    it('should generate consistent checksums for identical content', async () => {
      const buffer1 = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02, 0x03]);
      const buffer2 = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02, 0x03]);

      const result1 = await fileProcessor.validateUpload(buffer1, 'test1.jar');
      const result2 = await fileProcessor.validateUpload(buffer2, 'test2.jar');

      expect(result1.metadata?.checksum).toBe(result2.metadata?.checksum);
    });

    it('should generate different checksums for different content', async () => {
      const buffer1 = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02, 0x03]);
      const buffer2 = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02, 0x04]);

      const result1 = await fileProcessor.validateUpload(buffer1, 'test1.jar');
      const result2 = await fileProcessor.validateUpload(buffer2, 'test2.jar');

      expect(result1.metadata?.checksum).not.toBe(result2.metadata?.checksum);
    });
  });
});
