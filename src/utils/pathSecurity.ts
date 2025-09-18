import path from 'path';
import { promises as fs } from 'fs';

/**
 * Security utility for safe path operations
 */

/**
 * Validates and normalizes a file path to prevent path traversal attacks
 * @param filePath - The file path to validate
 * @param allowedBasePaths - Optional array of allowed base paths
 * @returns Normalized safe path
 * @throws Error if path is unsafe
 */
export function validateAndNormalizePath(filePath: string, allowedBasePaths?: string[]): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided');
  }

  // Normalize the path to resolve any relative components
  const normalizedPath = path.normalize(filePath);

  // Check for path traversal attempts
  if (normalizedPath.includes('..') || normalizedPath.includes('\0')) {
    throw new Error('Path traversal attempt detected');
  }

  // If allowed base paths are specified, ensure the path is within them
  if (allowedBasePaths && allowedBasePaths.length > 0) {
    const resolvedPath = path.resolve(normalizedPath);
    const isAllowed = allowedBasePaths.some((basePath) => {
      const resolvedBasePath = path.resolve(basePath);
      return (
        resolvedPath.startsWith(resolvedBasePath + path.sep) || resolvedPath === resolvedBasePath
      );
    });

    if (!isAllowed) {
      throw new Error('Path is outside allowed directories');
    }
  }

  return normalizedPath;
}

/**
 * Safely reads a file with path validation
 * @param filePath - The file path to read
 * @param allowedBasePaths - Optional array of allowed base paths
 * @returns File buffer
 */
export async function safeReadFile(filePath: string, allowedBasePaths?: string[]): Promise<Buffer> {
  const safePath = validateAndNormalizePath(filePath, allowedBasePaths);
  return fs.readFile(safePath);
}

/**
 * Safely gets file stats with path validation
 * @param filePath - The file path to stat
 * @param allowedBasePaths - Optional array of allowed base paths
 * @returns File stats
 */
export async function safeStatFile(
  filePath: string,
  allowedBasePaths?: string[]
): Promise<import('fs').Stats> {
  const safePath = validateAndNormalizePath(filePath, allowedBasePaths);
  return fs.stat(safePath);
}
