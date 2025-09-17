/**
 * Type definitions for enhanced file processing and security scanning
 */

import { ErrorSeverity } from './errors.js';

/**
 * Configuration options for file validation
 */
export interface FileValidationOptions {
  maxFileSize: number;
  allowedMimeTypes: string[];
  enableMalwareScanning: boolean;
  tempDirectory?: string;
}

/**
 * Result of file validation process
 */
export interface ValidationResult {
  isValid: boolean;
  fileType: string;
  size: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: FileMetadata;
}

/**
 * Validation error information
 */
export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'error' | 'warning';
  details?: any;
}

/**
 * Validation warning information
 */
export interface ValidationWarning {
  code: string;
  message: string;
  details?: any;
}

/**
 * File metadata extracted during validation
 */
export interface FileMetadata {
  mimeType: string;
  extension: string;
  magicNumber: string;
  checksum: string;
  createdAt?: Date;
  modifiedAt?: Date;
}

/**
 * Result of security scanning process
 */
export interface SecurityScanResult {
  isSafe: boolean;
  threats: ThreatInfo[];
  scanTime: number;
  scanId: string;
}

/**
 * Information about detected security threats
 */
export interface ThreatInfo {
  type: 'zip_bomb' | 'path_traversal' | 'malicious_code' | 'suspicious_pattern';
  description: string;
  severity: ErrorSeverity;
  location?: string;
  details?: ThreatDetails;
}

/**
 * Additional details about security threats
 */
export interface ThreatDetails {
  paths?: string[];
  patterns?: string[];
  compressionRatio?: number;
  extractedSize?: number;
  suspiciousFiles?: string[];
}

/**
 * Configuration for security scanning
 */
export interface SecurityScanOptions {
  enableZipBombDetection: boolean;
  enablePathTraversalDetection: boolean;
  enableMalwarePatternDetection: boolean;
  maxCompressionRatio: number;
  maxExtractedSize: number;
  scanTimeout: number;
}

/**
 * Temporary file information for processing
 */
export interface TempFileInfo {
  path: string;
  originalName: string;
  size: number;
  createdAt: Date;
  cleanup: () => Promise<void>;
}
