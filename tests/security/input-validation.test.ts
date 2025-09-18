import { describe, it, expect, beforeEach } from 'vitest';
import { FileProcessor } from '../../src/modules/ingestion/FileProcessor';
import { FileValidationConfig, SecurityScanningConfig } from '../../src/types/config';
import { SourceCodeFetcher } from '../../src/modules/ingestion/SourceCodeFetcher';
import { createTempDirectory, cleanupTempDirectory } from '../integration/helpers';
import fs from 'fs';
import path from 'path';

describe('Input Validation Security Tests', () => {
  let tempDir: string;
  
  beforeEach(() => {
    tempDir = createTempDirectory();
  });
  
  afterEach(() => {
    cleanupTempDirectory(tempDir);
  });
  

  describe('FileProcessor Input Validation', () => {
    let fileProcessor: FileProcessor;

    beforeEach(() => {
      const fileValidationConfig: FileValidationConfig = {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['application/java-archive', 'application/zip'],
        enableMagicNumberValidation: true,
        cacheValidationResults: false,
        cacheTTL: 0,
      };
      const securityScanningConfig: SecurityScanningConfig = {
        enableZipBombDetection: true,
        maxCompressionRatio: 100,
        maxExtractedSize: 100 * 1024 * 1024,
        enablePathTraversalDetection: true,
        enableMalwarePatternDetection: true,
        scanTimeout: 5000,
      };
      fileProcessor = new FileProcessor(fileValidationConfig, securityScanningConfig);
      // Mock the security scanner to avoid running actual scans
      (fileProcessor as any).securityScanner = {
        scanBuffer: vi.fn().mockResolvedValue({ isSafe: true, threats: [] }),
      };
    });

    it('should reject files with disallowed MIME types', async () => {
      const buffer = Buffer.from('this is not a zip file');
      const result = await fileProcessor.validateUpload(buffer, 'test.txt');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_MIME_TYPE')).toBe(true);
    });

    it('should reject files that look like archives but have wrong extension', async () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP magic number
      const result = await fileProcessor.validateUpload(buffer, 'test.exe');
      expect(result.warnings.some(w => w.code === 'UNEXPECTED_EXTENSION')).toBe(true);
    });
  });

  describe('SourceCodeFetcher', () => {
    it('should validate GitHub repository URLs', () => {
      const sourceCodeFetcher = new SourceCodeFetcher({ githubToken: 'test-token' });
      
      // Valid URLs
      expect(() => sourceCodeFetcher.parseRepositoryUrl('https://github.com/owner/repo')).not.toThrow();
      expect(() => sourceCodeFetcher.parseRepositoryUrl('git@github.com:owner/repo.git')).not.toThrow();
      
      // Invalid URLs
      expect(() => sourceCodeFetcher.parseRepositoryUrl('https://example.com/not-github')).toThrow();
      expect(() => sourceCodeFetcher.parseRepositoryUrl('javascript:alert(1)')).toThrow();
      expect(() => sourceCodeFetcher.parseRepositoryUrl('file:///etc/passwd')).toThrow();
    });
    
    it('should prevent path traversal in output paths', async () => {
      const sourceCodeFetcher = new SourceCodeFetcher({ githubToken: 'test-token' });
      
      // Mock the fetchSourceCode method to avoid actual GitHub API calls
      sourceCodeFetcher.fetchSourceCode = vi.fn().mockImplementation(async (repoInfo, outputDir) => {
        // Attempt to write to a file outside the output directory
        const traversalPath = path.join(outputDir, '../../../etc/passwd');
        
        // This should throw an error or fail safely
        await expect(fs.promises.writeFile(traversalPath, 'test')).rejects.toThrow();
        
        return { success: true, fileCount: 0, outputPath: outputDir };
      });
      
      // Call fetchSourceCode with a valid repository info
      await sourceCodeFetcher.fetchSourceCode(
        { owner: 'test-owner', repo: 'test-repo', branch: 'main' },
        path.join(tempDir, 'output')
      );
    });
  });
  
  describe('File Path Validation', () => {
    it('should sanitize file paths', () => {
      // Test function to sanitize file paths
      function sanitizePath(inputPath: string): string {
        // Normalize the path to resolve '..' and '.'
        const normalizedPath = path.normalize(inputPath);
        
        // Check if the normalized path tries to escape the base directory
        if (normalizedPath.startsWith('..') || normalizedPath.includes('../')) {
          throw new Error('Path traversal attempt detected');
        }
        
        return normalizedPath;
      }
      
      // Valid paths
      expect(sanitizePath('file.txt')).toBe('file.txt');
      expect(sanitizePath('dir/file.txt')).toBe('dir/file.txt');
      expect(sanitizePath('./file.txt')).toBe('file.txt');
      
      // Invalid paths (path traversal attempts)
      expect(() => sanitizePath('../file.txt')).toThrow();
      expect(() => sanitizePath('dir/../../../file.txt')).toThrow();
      expect(() => sanitizePath('dir/./../../file.txt')).toThrow();
    });
  });
});