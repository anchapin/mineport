/**
 * Unit tests for FileProcessor class
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { FileProcessor } from '../../../../src/modules/ingestion/FileProcessor';
import { FileValidationConfig, SecurityScanningConfig } from '../../../../src/types/config';

// Mock fs module
vi.mock('fs/promises');

describe('FileProcessor Security Tests', () => {
  let fileProcessor: FileProcessor;
  let mockFileValidationConfig: FileValidationConfig;
  let mockSecurityScanningConfig: SecurityScanningConfig;

  beforeEach(() => {
    mockFileValidationConfig = {
      maxFileSize: 50 * 1024 * 1024, // 50MB for tests
      allowedMimeTypes: ['application/java-archive', 'application/zip'],
      enableMagicNumberValidation: true,
      cacheValidationResults: false,
      cacheTTL: 3600
    };
    mockSecurityScanningConfig = {
      enableZipBombDetection: true,
      maxCompressionRatio: 100,
      maxExtractedSize: 1024 * 1024 * 1024,
      enablePathTraversalDetection: true,
      enableMalwarePatternDetection: true,
      scanTimeout: 30000
    };
    fileProcessor = new FileProcessor(mockFileValidationConfig, mockSecurityScanningConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateUpload', () => {
    it('should validate a valid JAR file', async () => {
      const validJarBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test-mod.jar';

      // Mock security scanner to return safe result
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id'
        })
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
      const validZipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test-archive.zip';

      // Mock security scanner to return safe result
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id'
        })
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

    describe('File Size Validation', () => {
      it('should reject files exceeding size limit', async () => {
        const largeBuffer = Buffer.alloc(mockFileValidationConfig.maxFileSize + 1);
        const filename = 'large-mod.jar';

        const result = await fileProcessor.validateUpload(largeBuffer, filename);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'FILE_TOO_LARGE')).toBe(true);
      });

      it('should accept files within size limit', async () => {
        const validBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...new Array(100).fill(0)]);
        const filename = 'valid-size.jar';
        const mockSecurityScanner = { scanBuffer: vi.fn().mockResolvedValue({ isSafe: true, threats: [] }) };
        (fileProcessor as any).securityScanner = mockSecurityScanner;

        const result = await fileProcessor.validateUpload(validBuffer, filename);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle zero-byte files', async () => {
        const emptyBuffer = Buffer.alloc(0);
        const filename = 'empty.jar';

        const result = await fileProcessor.validateUpload(emptyBuffer, filename);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'EMPTY_FILE')).toBe(true);
      });

      it('should respect custom size limits', async () => {
        mockFileValidationConfig.maxFileSize = 1024; // 1KB
        fileProcessor = new FileProcessor(mockFileValidationConfig, mockSecurityScanningConfig);
        const largeBuffer = Buffer.alloc(1025);
        const filename = 'large-for-custom.jar';

        const result = await fileProcessor.validateUpload(largeBuffer, filename);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'FILE_TOO_LARGE')).toBe(true);
      });
    });

    describe('MIME Type Validation', () => {
      it('should accept valid JAR files', async () => {
        const validJarBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...new Array(100).fill(0)]);
        const filename = 'test-mod.jar';
        const mockSecurityScanner = { scanBuffer: vi.fn().mockResolvedValue({ isSafe: true, threats: [] }) };
        (fileProcessor as any).securityScanner = mockSecurityScanner;

        const result = await fileProcessor.validateUpload(validJarBuffer, filename);
        expect(result.errors.some(e => e.code === 'INVALID_MIME_TYPE')).toBe(false);
        expect(result.isValid).toBe(true);
      });

      it('should reject executable files', async () => {
        const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, ...new Array(100).fill(0)]); // .exe magic number
        const filename = 'bad.exe';

        const result = await fileProcessor.validateUpload(exeBuffer, filename);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'INVALID_MIME_TYPE')).toBe(true);
      });

      it('should reject script files', async () => {
        const scriptBuffer = Buffer.from('#!/bin/bash\necho "hello"');
        const filename = 'bad.sh';

        const result = await fileProcessor.validateUpload(scriptBuffer, filename);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'INVALID_MIME_TYPE')).toBe(true);
      });
    });

    describe('Magic Number Validation', () => {
      it('should reject files with invalid magic numbers', async () => {
        const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);
        const filename = 'invalid.jar';

        const result = await fileProcessor.validateUpload(invalidBuffer, filename);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.code === 'INVALID_MAGIC_NUMBER')).toBe(true);
      });

      it('should skip magic number validation if disabled', async () => {
        mockFileValidationConfig.enableMagicNumberValidation = false;
        fileProcessor = new FileProcessor(mockFileValidationConfig, mockSecurityScanningConfig);
        const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);
        const filename = 'invalid.jar';
        const mockSecurityScanner = { scanBuffer: vi.fn().mockResolvedValue({ isSafe: true, threats: [] }) };
        (fileProcessor as any).securityScanner = mockSecurityScanner;

        const result = await fileProcessor.validateUpload(invalidBuffer, filename);
        expect(result.isValid).toBe(true);
        expect(result.errors.some(error => error.code === 'INVALID_MAGIC_NUMBER')).toBe(false);
      });

      it('should detect corrupted archives (e.g. wrong magic number)', async () => {
        const corruptedBuffer = Buffer.from([0x50, 0x4B, 0x05, 0x06, ...new Array(100).fill(0)]); // Invalid ZIP header
        const filename = 'corrupted.zip';

        const result = await fileProcessor.validateUpload(corruptedBuffer, filename);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.code === 'INVALID_MAGIC_NUMBER')).toBe(true);
      });
    });

    it('should handle files that are too small for magic number validation', async () => {
      const tinyBuffer = Buffer.from([0x50, 0x4B]); // Only 2 bytes
      const filename = 'tiny.jar';

      const result = await fileProcessor.validateUpload(tinyBuffer, filename);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.code === 'INVALID_MAGIC_NUMBER')).toBe(true);
    });

    it('should generate correct file metadata', async () => {
      const testBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0x42)]);
      const filename = 'test-mod.jar';

      // Mock security scanner to return safe result
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id'
        })
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
      const validBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test-mod.exe'; // Wrong extension

      // Mock security scanner to return safe result
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({
          isSafe: true,
          threats: [],
          scanTime: 100,
          scanId: 'test-scan-id'
        })
      };
      (fileProcessor as any).securityScanner = mockSecurityScanner;

      const result = await fileProcessor.validateUpload(validBuffer, filename);

      expect(result.warnings.some(warning => warning.code === 'UNEXPECTED_EXTENSION')).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      const testBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test-mod.jar';

      // Mock security scanner to throw an error
      const mockSecurityScanner = {
        scanBuffer: vi.fn().mockRejectedValue(new Error('Scanner failed'))
      };
      
      // Replace the security scanner
      (fileProcessor as any).securityScanner = mockSecurityScanner;

      const result = await fileProcessor.validateUpload(testBuffer, filename);

      // Should still validate basic properties but add warning about security scan failure
      expect(result.warnings.some(warning => warning.code === 'SECURITY_SCAN_FAILED')).toBe(true);
    });
  });

  describe('updateOptions', () => {
    it('should update validation options', () => {
      const newOptions: Partial<FileValidationOptions> = {
        maxFileSize: 200 * 1024 * 1024,
        enableMalwareScanning: false
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
          scanId: 'test-scan-id'
        })
      };
      (fileProcessor as any).securityScanner = mockSecurityScanner;
    });

    it('should detect JAR files correctly', async () => {
      const jarBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'test.jar';

      const result = await fileProcessor.validateUpload(jarBuffer, filename);
      expect(result.fileType).toBe('application/java-archive');
    });

    it('should detect ZIP files correctly', async () => {
      const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
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
          scanId: 'test-scan-id'
        })
      };
      (fileProcessor as any).securityScanner = mockSecurityScanner;
    });

    it('should generate consistent checksums for identical content', async () => {
      const buffer1 = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x01, 0x02, 0x03]);
      const buffer2 = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x01, 0x02, 0x03]);
      
      const result1 = await fileProcessor.validateUpload(buffer1, 'test1.jar');
      const result2 = await fileProcessor.validateUpload(buffer2, 'test2.jar');

      expect(result1.metadata?.checksum).toBe(result2.metadata?.checksum);
    });

    it('should generate different checksums for different content', async () => {
      const buffer1 = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x01, 0x02, 0x03]);
      const buffer2 = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x01, 0x02, 0x04]);
      
      const result1 = await fileProcessor.validateUpload(buffer1, 'test1.jar');
      const result2 = await fileProcessor.validateUpload(buffer2, 'test2.jar');

      expect(result1.metadata?.checksum).not.toBe(result2.metadata?.checksum);
    });
  });
});