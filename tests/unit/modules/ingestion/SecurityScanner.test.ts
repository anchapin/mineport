/**
 * Unit tests for SecurityScanner class
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { SecurityScanner } from '../../../../src/modules/ingestion/SecurityScanner';
import { SecurityScanningConfig } from '../../../../src/types/config';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('adm-zip');

describe('SecurityScanner Threat Detection', () => {
  let securityScanner: SecurityScanner;
  let mockConfig: SecurityScanningConfig;
  const mockFs = vi.mocked(fs);
  const mockAdmZip = vi.mocked(AdmZip);

  beforeEach(() => {
    mockConfig = {
      enableZipBombDetection: true,
      maxCompressionRatio: 100,
      maxExtractedSize: 1024 * 1024 * 1024,
      enablePathTraversalDetection: true,
      enableMalwarePatternDetection: true,
      scanTimeout: 30000
    };
    securityScanner = new SecurityScanner(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scanBuffer', () => {
    beforeEach(() => {
      // Mock fs.writeFile and fs.unlink for temp file operations
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(Buffer.from([0x50, 0x4B, 0x03, 0x04]));
    });

    it('should return safe result for clean files', async () => {
      const cleanBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'clean-mod.jar';

      // Mock AdmZip for clean file
      const mockZipInstance = {
        getEntries: vi.fn().mockReturnValue([
          {
            entryName: 'META-INF/MANIFEST.MF',
            isDirectory: false,
            header: { size: 100, compressedSize: 50 },
            getData: vi.fn().mockReturnValue(Buffer.from('clean content'))
          }
        ])
      };
      mockAdmZip.mockImplementation(() => mockZipInstance as any);

      const result = await securityScanner.scanBuffer(cleanBuffer, filename);

      expect(result.isSafe).toBe(true);
      expect(result.threats).toHaveLength(0);
      expect(result.scanTime).toBeGreaterThanOrEqual(0);
      expect(result.scanId).toBeDefined();
    });

    describe('ZIP Bomb Detection', () => {
      it('should detect high compression ratio attacks', async () => {
        const suspiciousBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
        const filename = 'bomb.jar';

        // Mock AdmZip for ZIP bomb
        const mockZipInstance = {
          getEntries: vi.fn().mockReturnValue([
            {
              entryName: 'large-file.txt',
              isDirectory: false,
              header: { size: (mockConfig.maxCompressionRatio + 1) * 1000, compressedSize: 1000 },
              getData: vi.fn().mockReturnValue(Buffer.from('compressed content'))
            }
          ])
        };
        mockAdmZip.mockImplementation(() => mockZipInstance as any);

        const result = await securityScanner.scanBuffer(suspiciousBuffer, filename);

        expect(result.isSafe).toBe(false);
        expect(result.threats.some(t => t.type === 'zip_bomb')).toBe(true);
      });

      it('should detect excessive uncompressed size', async () => {
        const suspiciousBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
        const filename = 'large_uncompressed.jar';
        const mockZipInstance = {
          getEntries: vi.fn().mockReturnValue([
            {
              entryName: 'large-file.txt',
              isDirectory: false,
              header: { size: mockConfig.maxExtractedSize + 1, compressedSize: mockConfig.maxExtractedSize },
              getData: vi.fn()
            }
          ])
        };
        mockAdmZip.mockImplementation(() => mockZipInstance as any);
        const result = await securityScanner.scanBuffer(suspiciousBuffer, filename);
        expect(result.isSafe).toBe(false);
        expect(result.threats.some(t => t.type === 'zip_bomb')).toBe(true);
      });

      it('should allow legitimate compressed files', async () => {
        const cleanBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
        const filename = 'clean-mod.jar';
        const mockZipInstance = {
          getEntries: vi.fn().mockReturnValue([
            {
              entryName: 'legit-file.txt',
              isDirectory: false,
              header: { size: 1000, compressedSize: 500 },
              getData: vi.fn().mockReturnValue(Buffer.from('clean content'))
            }
          ])
        };
        mockAdmZip.mockImplementation(() => mockZipInstance as any);
        const result = await securityScanner.scanBuffer(cleanBuffer, filename);
        expect(result.isSafe).toBe(true);
      });
    });

    describe('Path Traversal Prevention', () => {
      it('should detect ../ traversal attempts', async () => {
        const maliciousBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
        const filename = 'traversal.jar';
        const mockZipInstance = {
          getEntries: vi.fn().mockReturnValue([
            { entryName: '../../../etc/passwd', isDirectory: false, header: {}, getData: vi.fn() }
          ])
        };
        mockAdmZip.mockImplementation(() => mockZipInstance as any);
        const result = await securityScanner.scanBuffer(maliciousBuffer, filename);
        expect(result.isSafe).toBe(false);
        expect(result.threats.some(t => t.type === 'path_traversal')).toBe(true);
      });

      it('should detect absolute path attempts', async () => {
        const maliciousBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
        const filename = 'absolute.jar';
        const mockZipInstance = {
          getEntries: vi.fn().mockReturnValue([
            { entryName: '/etc/passwd', isDirectory: false, header: {}, getData: vi.fn() }
          ])
        };
        mockAdmZip.mockImplementation(() => mockZipInstance as any);
        const result = await securityScanner.scanBuffer(maliciousBuffer, filename);
        expect(result.isSafe).toBe(false);
        expect(result.threats.some(t => t.type === 'path_traversal')).toBe(true);
      });

      it('should detect Windows path traversal', async () => {
        const maliciousBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
        const filename = 'windows_traversal.jar';
        const mockZipInstance = {
          getEntries: vi.fn().mockReturnValue([
            { entryName: '..\\..\\Windows\\System32\\SAM', isDirectory: false, header: {}, getData: vi.fn() }
          ])
        };
        mockAdmZip.mockImplementation(() => mockZipInstance as any);
        const result = await securityScanner.scanBuffer(maliciousBuffer, filename);
        expect(result.isSafe).toBe(false);
        expect(result.threats.some(t => t.type === 'path_traversal')).toBe(true);
      });

      it('should allow legitimate nested paths', async () => {
        const cleanBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
        const filename = 'clean-mod.jar';
        const mockZipInstance = {
          getEntries: vi.fn().mockReturnValue([
            { entryName: 'assets/minecraft/textures/block/stone.png', isDirectory: false, header: {}, getData: vi.fn() }
          ])
        };
        mockAdmZip.mockImplementation(() => mockZipInstance as any);
        const result = await securityScanner.scanBuffer(cleanBuffer, filename);
        expect(result.isSafe).toBe(true);
      });
    });

    describe('Malware Pattern Detection', () => {
      it('should detect Runtime.exec patterns', async () => {
        const maliciousBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
        const filename = 'malicious.jar';
        const mockZipInstance = {
          getEntries: vi.fn().mockReturnValue([
            {
              entryName: 'com/example/MaliciousClass.class',
              isDirectory: false,
              header: { size: 200, compressedSize: 100 },
              getData: vi.fn().mockReturnValue(Buffer.from('Runtime.getRuntime().exec("rm -rf /")'))
            }
          ])
        };
        mockAdmZip.mockImplementation(() => mockZipInstance as any);

        const result = await securityScanner.scanBuffer(maliciousBuffer, filename);

        expect(result.isSafe).toBe(false);
        expect(result.threats.some(t => t.type === 'malicious_code')).toBe(true);
      });

      it('should detect reflection usage', async () => {
        const maliciousBuffer = Buffer.from('java.lang.reflect.Method');
        const filename = 'reflection.class';
        mockFs.readFile.mockResolvedValue(maliciousBuffer); // For non-zip files

        const result = await securityScanner.scanBuffer(maliciousBuffer, filename);
        expect(result.isSafe).toBe(false);
        expect(result.threats.some(t => t.type === 'malicious_code')).toBe(true);
      });

      it('should detect network socket creation', async () => {
        const maliciousBuffer = Buffer.from('new java.net.Socket("evil.com", 80)');
        const filename = 'socket.class';
        mockFs.readFile.mockResolvedValue(maliciousBuffer);

        const result = await securityScanner.scanBuffer(maliciousBuffer, filename);
        expect(result.isSafe).toBe(false);
        expect(result.threats.some(t => t.type === 'malicious_code')).toBe(true);
      });

      it('should allow legitimate Minecraft mod patterns', async () => {
        const cleanBuffer = Buffer.from('This is a clean file with no malicious patterns.');
        const filename = 'clean.class';
        mockFs.readFile.mockResolvedValue(cleanBuffer);

        const result = await securityScanner.scanBuffer(cleanBuffer, filename);
        expect(result.isSafe).toBe(true);
      });
    });

    it('should handle multiple threats in one file', async () => {
      const multiThreatBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'multi-threat.jar';

      // Mock AdmZip for multiple threats
      const mockZipInstance = {
        getEntries: vi.fn().mockReturnValue([
          {
            entryName: '../../../etc/passwd', // Path traversal
            isDirectory: false,
            header: { size: 1000000000, compressedSize: 1000 }, // ZIP bomb
            getData: vi.fn().mockReturnValue(Buffer.from('Runtime.getRuntime().exec("malicious")')) // Malicious code
          }
        ])
      };
      mockAdmZip.mockImplementation(() => mockZipInstance as any);

      const result = await securityScanner.scanBuffer(multiThreatBuffer, filename);

      expect(result.isSafe).toBe(false);
      expect(result.threats.length).toBeGreaterThan(1);
      
      const threatTypes = result.threats.map(threat => threat.type);
      expect(threatTypes).toContain('zip_bomb');
      expect(threatTypes).toContain('path_traversal');
      expect(threatTypes).toContain('malicious_code');
    });

    it('should handle corrupted ZIP files gracefully', async () => {
      const corruptedBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'corrupted.jar';

      // Mock AdmZip to throw error for corrupted file
      mockAdmZip.mockImplementation(() => {
        throw new Error('Invalid ZIP file');
      });

      const result = await securityScanner.scanBuffer(corruptedBuffer, filename);

      expect(result.isSafe).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some(threat => threat.type === 'zip_bomb')).toBe(true);
      expect(result.threats.some(threat => threat.description.includes('Unable to analyze ZIP file structure'))).toBe(true);
    });

    it('should handle scan errors gracefully', async () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      
      // Mock fs.writeFile to throw an error
      mockFs.writeFile.mockRejectedValue(new Error('File system error'));

      const result = await securityScanner.scanBuffer(buffer, 'error-test.jar');

      expect(result.isSafe).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some(threat => 
        threat.description.includes('Security scan failed')
      )).toBe(true);
    });

    it('should handle non-ZIP files', async () => {
      const textBuffer = Buffer.from('This is not a ZIP file');
      const filename = 'text-file.txt';

      // Mock fs.readFile to return non-ZIP magic number
      mockFs.readFile.mockResolvedValue(Buffer.from([0x54, 0x68, 0x69, 0x73])); // "This"

      const result = await securityScanner.scanBuffer(textBuffer, filename);

      expect(result.isSafe).toBe(true);
      expect(result.threats).toHaveLength(0);
    });

    it('should clean up temporary files', async () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'cleanup-test.jar';

      // Mock AdmZip for clean file
      const mockZipInstance = {
        getEntries: vi.fn().mockReturnValue([])
      };
      mockAdmZip.mockImplementation(() => mockZipInstance as any);

      await securityScanner.scanBuffer(buffer, filename);

      // Verify temp file was created and cleaned up
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      const filename = 'cleanup-error-test.jar';

      // Mock cleanup to fail
      mockFs.unlink.mockRejectedValue(new Error('Cleanup failed'));

      // Mock AdmZip for clean file
      const mockZipInstance = {
        getEntries: vi.fn().mockReturnValue([])
      };
      mockAdmZip.mockImplementation(() => mockZipInstance as any);

      // Should not throw error even if cleanup fails
      const result = await securityScanner.scanBuffer(buffer, filename);
      expect(result).toBeDefined();
    });
  });

  describe('threat detection edge cases', () => {
    beforeEach(() => {
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(Buffer.from([0x50, 0x4B, 0x03, 0x04]));
    });

    it('should detect absolute paths as path traversal', async () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      
      const mockZipInstance = {
        getEntries: vi.fn().mockReturnValue([
          {
            entryName: '/absolute/path/file.txt',
            isDirectory: false,
            header: { size: 100, compressedSize: 50 },
            getData: vi.fn().mockReturnValue(Buffer.from('content'))
          }
        ])
      };
      mockAdmZip.mockImplementation(() => mockZipInstance as any);

      const result = await securityScanner.scanBuffer(buffer, 'absolute-path.jar');

      expect(result.isSafe).toBe(false);
      expect(result.threats[0].type).toBe('path_traversal');
    });

    it('should detect excessive parent directory traversal', async () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      
      const mockZipInstance = {
        getEntries: vi.fn().mockReturnValue([
          {
            entryName: '../../../../../../../../file.txt', // Many parent dirs
            isDirectory: false,
            header: { size: 100, compressedSize: 50 },
            getData: vi.fn().mockReturnValue(Buffer.from('content'))
          }
        ])
      };
      mockAdmZip.mockImplementation(() => mockZipInstance as any);

      const result = await securityScanner.scanBuffer(buffer, 'excessive-traversal.jar');

      expect(result.isSafe).toBe(false);
      expect(result.threats[0].type).toBe('path_traversal');
    });

    it('should limit reported paths for readability', async () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      
      // Create 15 malicious entries (more than the 10 limit)
      const maliciousEntries = Array.from({ length: 15 }, (_, i) => ({
        entryName: `../../../malicious-${i}.txt`,
        isDirectory: false,
        header: { size: 100, compressedSize: 50 },
        getData: vi.fn().mockReturnValue(Buffer.from('content'))
      }));
      
      const mockZipInstance = {
        getEntries: vi.fn().mockReturnValue(maliciousEntries)
      };
      mockAdmZip.mockImplementation(() => mockZipInstance as any);

      const result = await securityScanner.scanBuffer(buffer, 'many-paths.jar');

      expect(result.isSafe).toBe(false);
      expect(result.threats[0].type).toBe('path_traversal');
      expect(result.threats[0].details?.paths).toHaveLength(10); // Limited to 10
    });
  });
});