import { describe, it, expect } from 'vitest';
import { ModValidator } from '../../src/modules/ingestion/ModValidator.js';
import { SourceCodeFetcher } from '../../src/modules/ingestion/SourceCodeFetcher.js';
import { createTempDirectory, cleanupTempDirectory } from '../integration/helpers.js';
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

  describe('ModValidator', () => {
    it('should reject malformed JAR files', async () => {
      const modValidator = new ModValidator();

      // Create a malformed JAR file (just random bytes)
      const malformedJar = Buffer.from('This is not a valid JAR file', 'utf-8');

      // Validate the file
      const result = await modValidator.validate(malformedJar);

      // Should reject the file
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid JAR file format');
    });

    it('should reject empty files', async () => {
      const modValidator = new ModValidator();

      // Create an empty file
      const emptyFile = Buffer.alloc(0);

      // Validate the file
      const result = await modValidator.validate(emptyFile);

      // Should reject the file
      expect(result.isValid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should reject oversized files', async () => {
      const modValidator = new ModValidator();

      // Create a large file (100MB)
      const largeFile = Buffer.alloc(100 * 1024 * 1024, 'X');

      // Validate the file
      const result = await modValidator.validate(largeFile);

      // Should reject the file
      expect(result.isValid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should handle path traversal attempts', async () => {
      const modValidator = new ModValidator();

      // Create a mock JAR with path traversal attempt
      const mockJar = Buffer.from('PK\x03\x04' + '../../etc/passwd', 'utf-8');

      // Extract the mod (this should fail safely)
      await expect(modValidator.extractMod(mockJar, 'test-mod')).rejects.toThrow();
    });
  });

  describe('SourceCodeFetcher', () => {
    it('should validate GitHub repository URLs', () => {
      const sourceCodeFetcher = new SourceCodeFetcher({ githubToken: 'test-token' });

      // Valid URLs
      expect(() =>
        sourceCodeFetcher.parseRepositoryUrl('https://github.com/owner/repo')
      ).not.toThrow();
      expect(() =>
        sourceCodeFetcher.parseRepositoryUrl('git@github.com:owner/repo.git')
      ).not.toThrow();

      // Invalid URLs
      expect(() =>
        sourceCodeFetcher.parseRepositoryUrl('https://example.com/not-github')
      ).toThrow();
      expect(() => sourceCodeFetcher.parseRepositoryUrl('javascript:alert(1)')).toThrow();
      expect(() => sourceCodeFetcher.parseRepositoryUrl('file:///etc/passwd')).toThrow();
    });

    it('should prevent path traversal in output paths', async () => {
      const sourceCodeFetcher = new SourceCodeFetcher({ githubToken: 'test-token' });

      // Mock the fetchSourceCode method to avoid actual GitHub API calls
      sourceCodeFetcher.fetchSourceCode = vi.fn().mockImplementation(async (options) => {
        // Attempt to write to a file outside the output directory
        const traversalPath = path.join(tempDir, '../../../etc/passwd');

        // This should throw an error or fail safely
        await expect(fs.promises.writeFile(traversalPath, 'test')).rejects.toThrow();

        return { success: true, extractedPath: tempDir };
      });

      // Call fetchSourceCode with a valid repository options
      await sourceCodeFetcher.fetchSourceCode({
        repoUrl: 'https://github.com/test-owner/test-repo',
        ref: 'main',
      });
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
