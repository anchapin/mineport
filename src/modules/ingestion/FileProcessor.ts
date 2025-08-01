/**
 * Enhanced file processor with security scanning capabilities
 * 
 * This module provides comprehensive file processing including:
 * - MIME type validation
 * - Magic number verification
 * - File size validation
 * - Security scanning integration
 * - Comprehensive error reporting
 */

import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import { 
  FileValidationOptions, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning,
  FileMetadata,
  SecurityScanResult
} from '../../types/file-processing';
import { SecurityScanner } from './SecurityScanner';
import { CacheService } from '../../services/CacheService';
import { PerformanceMonitor } from '../../services/PerformanceMonitor';

export class FileProcessor {
  private static readonly ALLOWED_MIME_TYPES = {
    'application/java-archive': 'jar',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/octet-stream': 'jar' // Some systems report JAR as octet-stream
  };

  private static readonly MAGIC_NUMBERS = {
    ZIP: Buffer.from([0x50, 0x4B, 0x03, 0x04]),
    JAR: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // JAR files are ZIP files
  };

  private static readonly DEFAULT_OPTIONS: FileValidationOptions = {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    allowedMimeTypes: Object.keys(FileProcessor.ALLOWED_MIME_TYPES),
    enableMalwareScanning: true,
    tempDirectory: process.env.TEMP_DIR || '/tmp'
  };

  private options: FileValidationOptions;
  private securityScanner: SecurityScanner;
  private cache?: CacheService;
  private performanceMonitor?: PerformanceMonitor;

  constructor(
    options: Partial<FileValidationOptions> = {},
    cache?: CacheService,
    performanceMonitor?: PerformanceMonitor
  ) {
    this.options = { ...FileProcessor.DEFAULT_OPTIONS, ...options };
    this.securityScanner = new SecurityScanner();
    this.cache = cache;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Validate an uploaded file with comprehensive security checks
   */
  async validateUpload(file: Buffer, filename: string): Promise<ValidationResult> {
    const profileId = this.performanceMonitor?.startProfile('file-validation', { filename, size: file.length });
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      // Check cache first if available
      if (this.cache) {
        const fileHash = crypto.createHash('sha256').update(file).digest('hex');
        const cacheKey = { type: 'file_validation' as const, identifier: fileHash };
        const cachedResult = await this.cache.get<ValidationResult>(cacheKey);
        
        if (cachedResult) {
          this.performanceMonitor?.endProfile(profileId);
          return cachedResult;
        }
      }
      // Basic file validation
      const basicValidation = await this.performBasicValidation(file, filename);
      errors.push(...basicValidation.errors);
      warnings.push(...basicValidation.warnings);

      // If basic validation fails critically, don't proceed with security scanning
      const hasCriticalErrors = errors.some(error => error.severity === 'critical');
      if (hasCriticalErrors) {
        return {
          isValid: false,
          fileType: this.detectFileType(file, filename),
          size: file.length,
          errors,
          warnings
        };
      }

      // Security scanning
      let securityResult: SecurityScanResult | null = null;
      if (this.options.enableMalwareScanning) {
        try {
          securityResult = await this.securityScanner.scanBuffer(file, filename);
          
          if (!securityResult.isSafe) {
            for (const threat of securityResult.threats) {
              errors.push({
                code: `SECURITY_${threat.type.toUpperCase()}`,
                message: threat.description,
                severity: threat.severity === 'high' ? 'critical' : 'error',
                details: { threat, scanId: securityResult.scanId }
              });
            }
          }
        } catch (scanError) {
          warnings.push({
            code: 'SECURITY_SCAN_FAILED',
            message: `Security scan failed: ${scanError.message}`,
            details: { error: scanError.message }
          });
        }
      }

      // Generate file metadata
      const metadata = await this.generateFileMetadata(file, filename);

      const result: ValidationResult = {
        isValid: errors.length === 0,
        fileType: this.detectFileType(file, filename),
        size: file.length,
        errors,
        warnings,
        metadata
      };

      // Cache the result if available
      if (this.cache && result.isValid) {
        const fileHash = crypto.createHash('sha256').update(file).digest('hex');
        const cacheKey = { type: 'file_validation' as const, identifier: fileHash };
        await this.cache.set(cacheKey, result, 3600000); // Cache for 1 hour
      }

      this.performanceMonitor?.endProfile(profileId);
      return result;

    } catch (error) {
      errors.push({
        code: 'VALIDATION_FAILED',
        message: `File validation failed: ${error.message}`,
        severity: 'critical',
        details: { error: error.message }
      });

      this.performanceMonitor?.endProfile(profileId);
      return {
        isValid: false,
        fileType: 'unknown',
        size: file.length,
        errors,
        warnings
      };
    }
  }

  /**
   * Perform basic file validation checks
   */
  private async performBasicValidation(file: Buffer, filename: string): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // File size validation
    if (file.length > this.options.maxFileSize) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `File size ${file.length} bytes exceeds maximum allowed size of ${this.options.maxFileSize} bytes`,
        severity: 'critical',
        details: { 
          actualSize: file.length, 
          maxSize: this.options.maxFileSize 
        }
      });
    }

    // Empty file check
    if (file.length === 0) {
      errors.push({
        code: 'EMPTY_FILE',
        message: 'File is empty',
        severity: 'critical'
      });
      return { errors, warnings };
    }

    // Magic number validation
    const magicValidation = this.validateMagicNumber(file, filename);
    if (!magicValidation.isValid) {
      errors.push({
        code: 'INVALID_MAGIC_NUMBER',
        message: magicValidation.message,
        severity: 'error',
        details: magicValidation.details
      });
    }

    // MIME type validation (if we can determine it)
    const mimeValidation = this.validateMimeType(file, filename);
    if (!mimeValidation.isValid) {
      if (mimeValidation.severity === 'critical') {
        errors.push({
          code: 'INVALID_MIME_TYPE',
          message: mimeValidation.message,
          severity: 'critical',
          details: mimeValidation.details
        });
      } else {
        warnings.push({
          code: 'MIME_TYPE_WARNING',
          message: mimeValidation.message,
          details: mimeValidation.details
        });
      }
    }

    // File extension validation
    const extensionValidation = this.validateFileExtension(filename);
    if (!extensionValidation.isValid) {
      warnings.push({
        code: 'UNEXPECTED_EXTENSION',
        message: extensionValidation.message,
        details: extensionValidation.details
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate file magic number
   */
  private validateMagicNumber(file: Buffer, filename: string): {
    isValid: boolean;
    message: string;
    details?: any;
  } {
    if (file.length < 4) {
      return {
        isValid: false,
        message: 'File too small to contain valid magic number',
        details: { fileSize: file.length }
      };
    }

    const fileHeader = file.subarray(0, 4);
    const expectedExtension = path.extname(filename).toLowerCase();

    // Check ZIP/JAR magic number
    if (expectedExtension === '.jar' || expectedExtension === '.zip') {
      if (!fileHeader.equals(FileProcessor.MAGIC_NUMBERS.ZIP)) {
        return {
          isValid: false,
          message: `Invalid magic number for ${expectedExtension} file`,
          details: {
            expected: Array.from(FileProcessor.MAGIC_NUMBERS.ZIP),
            actual: Array.from(fileHeader),
            expectedExtension
          }
        };
      }
    }

    return {
      isValid: true,
      message: 'Magic number validation passed'
    };
  }

  /**
   * Validate MIME type (basic heuristic validation)
   */
  private validateMimeType(file: Buffer, filename: string): {
    isValid: boolean;
    message: string;
    severity: 'critical' | 'warning';
    details?: any;
  } {
    const detectedType = this.detectFileType(file, filename);
    const extension = path.extname(filename).toLowerCase();

    // For JAR/ZIP files, ensure they have the correct magic number
    if (extension === '.jar' || extension === '.zip') {
      const hasZipMagic = file.subarray(0, 4).equals(FileProcessor.MAGIC_NUMBERS.ZIP);
      
      if (!hasZipMagic) {
        return {
          isValid: false,
          message: `File with ${extension} extension does not have valid ZIP/JAR structure`,
          severity: 'critical',
          details: { extension, detectedType }
        };
      }
    }

    // Check if detected type is in allowed types
    const allowedTypes = Object.keys(FileProcessor.ALLOWED_MIME_TYPES);
    if (!allowedTypes.includes(detectedType)) {
      return {
        isValid: false,
        message: `File type '${detectedType}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        severity: 'critical',
        details: { detectedType, allowedTypes }
      };
    }

    return {
      isValid: true,
      message: 'MIME type validation passed',
      severity: 'warning'
    };
  }

  /**
   * Validate file extension
   */
  private validateFileExtension(filename: string): {
    isValid: boolean;
    message: string;
    details?: any;
  } {
    const extension = path.extname(filename).toLowerCase();
    const allowedExtensions = ['.jar', '.zip'];

    if (!allowedExtensions.includes(extension)) {
      return {
        isValid: false,
        message: `File extension '${extension}' is not typically expected. Expected: ${allowedExtensions.join(', ')}`,
        details: { extension, allowedExtensions }
      };
    }

    return {
      isValid: true,
      message: 'File extension validation passed'
    };
  }

  /**
   * Detect file type based on content and filename
   */
  private detectFileType(file: Buffer, filename: string): string {
    const extension = path.extname(filename).toLowerCase();
    
    // Check magic number first
    if (file.length >= 4) {
      const header = file.subarray(0, 4);
      
      if (header.equals(FileProcessor.MAGIC_NUMBERS.ZIP)) {
        // Distinguish between ZIP and JAR based on extension or content
        if (extension === '.jar') {
          return 'application/java-archive';
        }
        return 'application/zip';
      }
    }

    // Fallback to extension-based detection
    switch (extension) {
      case '.jar':
        return 'application/java-archive';
      case '.zip':
        return 'application/zip';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Generate comprehensive file metadata
   */
  private async generateFileMetadata(file: Buffer, filename: string): Promise<FileMetadata> {
    const fileType = this.detectFileType(file, filename);
    const extension = path.extname(filename).toLowerCase();
    
    // Generate checksum
    const hash = crypto.createHash('sha256');
    hash.update(file);
    const checksum = hash.digest('hex');

    // Extract magic number as hex string
    const magicNumber = file.length >= 4 
      ? file.subarray(0, 4).toString('hex').toUpperCase()
      : '';

    return {
      mimeType: fileType,
      extension,
      magicNumber,
      checksum,
      createdAt: new Date(),
      modifiedAt: new Date()
    };
  }

  /**
   * Get security scanner instance for external use
   */
  getSecurityScanner(): SecurityScanner {
    return this.securityScanner;
  }

  /**
   * Update validation options
   */
  updateOptions(newOptions: Partial<FileValidationOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current validation options
   */
  getOptions(): FileValidationOptions {
    return { ...this.options };
  }
}