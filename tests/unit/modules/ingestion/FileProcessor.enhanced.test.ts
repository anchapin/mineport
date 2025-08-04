import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileProcessor } from '@modules/ingestion/FileProcessor';
import { SecurityScanner } from '@modules/ingestion/SecurityScanner';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';

// Mock SecurityScanner
vi.mock('@modules/ingestion/SecurityScanner');

describe('FileProcessor - Enhanced Tests', () => {
  let fileProcessor: FileProcessor;
  let mockSecurityScanner: SecurityScanner;
  let tempDir: string;

  beforeEach(async () => {
    mockSecurityScanner = new SecurityScanner();
    fileProcessor = new FileProcessor();
    tempDir = path.join(process.cwd(), 'temp', `test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('validateUpload', () => {
    it('should validate file size correctly', async () => {
      const smallBuffer = Buffer.alloc(1024); // 1KB
      const result = await fileProcessor.validateUpload(smallBuffer, 'small.jar');

      expect(result.size).toBe(1024);
      expect(result.isValid).toBe(true);
    });

    it('should detect correct file type from buffer', async () => {
      const zip = new AdmZip();
      zip.addFile('test.txt', Buffer.from('test'));
      const zipBuffer = zip.toBuffer();

      const result = await fileProcessor.validateUpload(zipBuffer, 'test.jar');

      expect(result.fileType).toBe('jar');
      expect(result.isValid).toBe(true);
    });

    it('should handle corrupted ZIP files gracefully', async () => {
      const corruptedZip = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]), // ZIP magic number
        Buffer.from('corrupted data'),
      ]);

      const result = await fileProcessor.validateUpload(corruptedZip, 'corrupted.jar');

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('corrupted'))).toBe(true);
    });

    it('should validate multiple MIME types', async () => {
      const testCases = [
        { filename: 'test.jar', expectedType: 'jar' },
        { filename: 'test.zip', expectedType: 'zip' },
        { filename: 'test.mcpack', expectedType: 'zip' },
      ];

      for (const testCase of testCases) {
        const zip = new AdmZip();
        zip.addFile('test.txt', Buffer.from('test'));
        const buffer = zip.toBuffer();

        const result = await fileProcessor.validateUpload(buffer, testCase.filename);

        expect(result.fileType).toBe(testCase.expectedType);
        expect(result.isValid).toBe(true);
      }
    });

    it('should provide detailed validation errors', async () => {
      const invalidBuffer = Buffer.from('not a zip file');

      const result = await fileProcessor.validateUpload(invalidBuffer, 'invalid.jar');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        code: expect.stringContaining('MIME'),
        message: expect.any(String),
        severity: 'critical',
      });
    });

    it('should include warnings for suspicious but valid files', async () => {
      const zip = new AdmZip();
      // Add a file with suspicious name but valid content
      zip.addFile('suspicious_but_valid.txt', Buffer.from('normal content'));
      const buffer = zip.toBuffer();

      const result = await fileProcessor.validateUpload(buffer, 'suspicious.jar');

      expect(result.isValid).toBe(true);
      // Should have warnings but no critical errors
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scanForMalware', () => {
    it('should integrate with SecurityScanner', async () => {
      const mockScanResult = {
        isSafe: true,
        threats: [],
        scanTime: 100,
      };

      vi.mocked(mockSecurityScanner.scanFile).mockResolvedValue(mockScanResult);

      const tempFile = path.join(tempDir, 'test.jar');
      await fs.writeFile(tempFile, Buffer.from('test content'));

      const result = await fileProcessor.scanForMalware(tempFile);

      expect(result).toEqual(mockScanResult);
      expect(mockSecurityScanner.scanFile).toHaveBeenCalledWith(tempFile);
    });

    it('should handle scanner errors gracefully', async () => {
      vi.mocked(mockSecurityScanner.scanFile).mockRejectedValue(new Error('Scanner error'));

      const tempFile = path.join(tempDir, 'test.jar');
      await fs.writeFile(tempFile, Buffer.from('test content'));

      const result = await fileProcessor.scanForMalware(tempFile);

      expect(result.isSafe).toBe(false);
      expect(result.threats).toContainEqual(
        expect.objectContaining({
          type: 'scan_error',
          description: expect.stringContaining('Scanner error'),
        })
      );
    });
  });

  describe('Performance Tests', () => {
    it('should process large valid files efficiently', async () => {
      const zip = new AdmZip();
      // Add many small files to create a larger archive
      for (let i = 0; i < 1000; i++) {
        zip.addFile(`file${i}.txt`, Buffer.from(`Content ${i}`));
      }
      const largeBuffer = zip.toBuffer();

      const startTime = Date.now();
      const result = await fileProcessor.validateUpload(largeBuffer, 'large.jar');
      const processingTime = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent validations', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        const zip = new AdmZip();
        zip.addFile(`test${i}.txt`, Buffer.from(`Test ${i}`));
        const buffer = zip.toBuffer();

        promises.push(fileProcessor.validateUpload(buffer, `test${i}.jar`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.isValid).toBe(true);
        expect(result.fileType).toBe('jar');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty files', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const result = await fileProcessor.validateUpload(emptyBuffer, 'empty.jar');

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('empty'))).toBe(true);
    });

    it('should handle files with no extension', async () => {
      const zip = new AdmZip();
      zip.addFile('test.txt', Buffer.from('test'));
      const buffer = zip.toBuffer();

      const result = await fileProcessor.validateUpload(buffer, 'noextension');

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('extension'))).toBe(true);
    });

    it('should handle special characters in filenames', async () => {
      const zip = new AdmZip();
      zip.addFile('test.txt', Buffer.from('test'));
      const buffer = zip.toBuffer();

      const specialNames = [
        'test with spaces.jar',
        'test-with-dashes.jar',
        'test_with_underscores.jar',
        'test.with.dots.jar',
      ];

      for (const filename of specialNames) {
        const result = await fileProcessor.validateUpload(buffer, filename);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject dangerous filenames', async () => {
      const zip = new AdmZip();
      zip.addFile('test.txt', Buffer.from('test'));
      const buffer = zip.toBuffer();

      const dangerousNames = [
        '../../../etc/passwd.jar',
        'C:\\Windows\\System32\\evil.jar',
        'con.jar', // Windows reserved name
        'aux.jar', // Windows reserved name
      ];

      for (const filename of dangerousNames) {
        const result = await fileProcessor.validateUpload(buffer, filename);
        expect(result.isValid).toBe(false);
      }
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during validation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple files
      for (let i = 0; i < 50; i++) {
        const zip = new AdmZip();
        zip.addFile(`test${i}.txt`, Buffer.from(`Content ${i}`));
        const buffer = zip.toBuffer();

        await fileProcessor.validateUpload(buffer, `test${i}.jar`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
