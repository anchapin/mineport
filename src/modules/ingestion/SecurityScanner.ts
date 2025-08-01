/**
 * Security scanner for detecting threats in uploaded files
 * 
 * This module provides comprehensive security scanning capabilities including:
 * - ZIP bomb detection
 * - Path traversal prevention
 * - Malware pattern detection
 * - Suspicious code pattern analysis
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import { 
  SecurityScanResult, 
  ThreatInfo, 
  SecurityScanOptions, 
  TempFileInfo 
} from '../../types/file-processing';

export class SecurityScanner {
  private static readonly DEFAULT_OPTIONS: SecurityScanOptions = {
    enableZipBombDetection: true,
    enablePathTraversalDetection: true,
    enableMalwarePatternDetection: true,
    maxCompressionRatio: 100,
    maxExtractedSize: 1024 * 1024 * 1024, // 1GB
    scanTimeout: 30000 // 30 seconds
  };

  private static readonly DANGEROUS_PATHS = [
    '../', '..\\', '/etc/', '/root/', 'C:\\Windows\\', 
    '/usr/', '/var/', '/tmp/', '/boot/', '/sys/', '/proc/'
  ];

  private static readonly SUSPICIOUS_PATTERNS = [
    Buffer.from('Runtime.getRuntime().exec'),
    Buffer.from('ProcessBuilder'),
    Buffer.from('System.exit'),
    Buffer.from('File.delete'),
    Buffer.from('FileOutputStream'),
    Buffer.from('FileInputStream'),
    Buffer.from('ClassLoader'),
    Buffer.from('URLClassLoader'),
    Buffer.from('ScriptEngine'),
    Buffer.from('javax.script'),
    Buffer.from('sun.misc.Unsafe'),
    Buffer.from('java.lang.reflect'),
    Buffer.from('java.net.Socket'),
    Buffer.from('java.net.ServerSocket')
  ];

  private options: SecurityScanOptions;

  constructor(options: Partial<SecurityScanOptions> = {}) {
    this.options = { ...SecurityScanner.DEFAULT_OPTIONS, ...options };
  }

  /**
   * Scan a file buffer for security threats
   */
  async scanBuffer(file: Buffer, filename: string): Promise<SecurityScanResult> {
    const scanId = crypto.randomUUID();
    const startTime = Date.now();
    const threats: ThreatInfo[] = [];

    try {
      // Create temporary file for analysis
      const tempFile = await this.writeToTempFile(file, filename);
      
      try {
        // Run security checks with timeout
        await Promise.race([
          this.performSecurityChecks(tempFile, threats),
          this.createTimeoutPromise()
        ]);
      } finally {
        await tempFile.cleanup();
      }

      return {
        isSafe: threats.length === 0,
        threats,
        scanTime: Date.now() - startTime,
        scanId
      };

    } catch (error) {
      // If scanning fails, treat as potentially unsafe
      threats.push({
        type: 'suspicious_pattern',
        description: `Security scan failed: ${error.message}`,
        severity: 'medium',
        details: { suspiciousFiles: [error.message] }
      });

      return {
        isSafe: false,
        threats,
        scanTime: Date.now() - startTime,
        scanId
      };
    }
  }

  /**
   * Perform all security checks on the temporary file
   */
  private async performSecurityChecks(tempFile: TempFileInfo, threats: ThreatInfo[]): Promise<void> {
    // Check for ZIP bomb
    if (this.options.enableZipBombDetection && await this.isZipFile(tempFile.path)) {
      const zipBombThreat = await this.checkZipBomb(tempFile.path);
      if (zipBombThreat) {
        threats.push(zipBombThreat);
      }
    }

    // Check for path traversal
    if (this.options.enablePathTraversalDetection && await this.isArchiveFile(tempFile.path)) {
      const pathTraversalThreats = await this.checkPathTraversal(tempFile.path);
      threats.push(...pathTraversalThreats);
    }

    // Check for malicious patterns
    if (this.options.enableMalwarePatternDetection) {
      const malwareThreats = await this.checkMaliciousPatterns(tempFile.path);
      threats.push(...malwareThreats);
    }
  }

  /**
   * Check if file is a ZIP bomb
   */
  private async checkZipBomb(filePath: string): Promise<ThreatInfo | null> {
    try {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      
      let totalUncompressedSize = 0;
      let totalCompressedSize = 0;

      for (const entry of entries) {
        totalUncompressedSize += entry.header.size;
        totalCompressedSize += entry.header.compressedSize;
      }

      const compressionRatio = totalCompressedSize > 0 ? totalUncompressedSize / totalCompressedSize : 0;

      if (compressionRatio > this.options.maxCompressionRatio || 
          totalUncompressedSize > this.options.maxExtractedSize) {
        return {
          type: 'zip_bomb',
          description: `Potential ZIP bomb detected - compression ratio: ${compressionRatio.toFixed(2)}, uncompressed size: ${totalUncompressedSize} bytes`,
          severity: 'high',
          details: {
            compressionRatio,
            extractedSize: totalUncompressedSize
          }
        };
      }

      return null;
    } catch (error) {
      // If we can't read the ZIP, it might be corrupted or malicious
      return {
        type: 'zip_bomb',
        description: `Unable to analyze ZIP file structure: ${error.message}`,
        severity: 'medium'
      };
    }
  }

  /**
   * Check for path traversal attempts
   */
  private async checkPathTraversal(filePath: string): Promise<ThreatInfo[]> {
    const threats: ThreatInfo[] = [];
    
    try {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      const suspiciousPaths: string[] = [];

      for (const entry of entries) {
        const entryPath = entry.entryName;
        
        // Check for dangerous path patterns
        for (const dangerousPath of SecurityScanner.DANGEROUS_PATHS) {
          if (entryPath.includes(dangerousPath)) {
            suspiciousPaths.push(entryPath);
            break;
          }
        }

        // Check for absolute paths
        if (path.isAbsolute(entryPath)) {
          suspiciousPaths.push(entryPath);
        }

        // Check for excessive parent directory traversal
        const parentDirCount = (entryPath.match(/\.\./g) || []).length;
        if (parentDirCount > 3) {
          suspiciousPaths.push(entryPath);
        }
      }

      if (suspiciousPaths.length > 0) {
        threats.push({
          type: 'path_traversal',
          description: `Path traversal attempt detected in ${suspiciousPaths.length} entries`,
          severity: 'high',
          details: {
            paths: suspiciousPaths.slice(0, 10) // Limit to first 10 for readability
          }
        });
      }

    } catch (error) {
      threats.push({
        type: 'path_traversal',
        description: `Unable to analyze archive paths: ${error.message}`,
        severity: 'medium'
      });
    }

    return threats;
  }

  /**
   * Check for malicious code patterns
   */
  private async checkMaliciousPatterns(filePath: string): Promise<ThreatInfo[]> {
    const threats: ThreatInfo[] = [];
    
    try {
      if (await this.isArchiveFile(filePath)) {
        // For archives, check contents
        const zip = new AdmZip(filePath);
        const entries = zip.getEntries();
        const suspiciousFiles: string[] = [];
        const foundPatterns: string[] = [];

        for (const entry of entries) {
          if (!entry.isDirectory) {
            const content = entry.getData();
            
            for (const pattern of SecurityScanner.SUSPICIOUS_PATTERNS) {
              if (content.includes(pattern)) {
                suspiciousFiles.push(entry.entryName);
                foundPatterns.push(pattern.toString());
                break;
              }
            }
          }
        }

        if (suspiciousFiles.length > 0) {
          threats.push({
            type: 'malicious_code',
            description: `Suspicious code patterns detected in ${suspiciousFiles.length} files`,
            severity: 'medium',
            details: {
              suspiciousFiles: suspiciousFiles.slice(0, 5),
              patterns: Array.from(new Set(foundPatterns)).slice(0, 5)
            }
          });
        }
      } else {
        // For regular files, scan directly
        const content = await fs.readFile(filePath);
        const foundPatterns: string[] = [];

        for (const pattern of SecurityScanner.SUSPICIOUS_PATTERNS) {
          if (content.includes(pattern)) {
            foundPatterns.push(pattern.toString());
          }
        }

        if (foundPatterns.length > 0) {
          threats.push({
            type: 'malicious_code',
            description: `Suspicious code patterns detected`,
            severity: 'medium',
            details: {
              patterns: Array.from(new Set(foundPatterns))
            }
          });
        }
      }

    } catch (error) {
      threats.push({
        type: 'suspicious_pattern',
        description: `Unable to scan for malicious patterns: ${error.message}`,
        severity: 'low'
      });
    }

    return threats;
  }

  /**
   * Write buffer to temporary file for analysis
   */
  private async writeToTempFile(buffer: Buffer, originalName: string): Promise<TempFileInfo> {
    const tempDir = process.env.TEMP_DIR || '/tmp';
    const tempFileName = `scan_${crypto.randomUUID()}_${path.basename(originalName)}`;
    const tempPath = path.join(tempDir, tempFileName);

    try {
      await fs.writeFile(tempPath, buffer);
    } catch (error) {
      throw new Error(`Failed to create temporary file: ${error.message}`);
    }

    return {
      path: tempPath,
      originalName,
      size: buffer.length,
      createdAt: new Date(),
      cleanup: async () => {
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }

  /**
   * Check if file is a ZIP archive
   */
  private async isZipFile(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath, { encoding: null });
      const zipMagic = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      return buffer.subarray(0, 4).equals(zipMagic);
    } catch {
      return false;
    }
  }

  /**
   * Check if file is any type of archive
   */
  private async isArchiveFile(filePath: string): Promise<boolean> {
    return await this.isZipFile(filePath); // For now, only ZIP files
  }

  /**
   * Create a timeout promise for scan operations
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Security scan timeout after ${this.options.scanTimeout}ms`));
      }, this.options.scanTimeout);
    });
  }
}