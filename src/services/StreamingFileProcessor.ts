/**
 * Streaming File Processor - Handles large files efficiently using streams
 *
 * This service provides streaming-based file processing to handle large files
 * without loading them entirely into memory, improving performance and reducing
 * memory usage for large mod files.
 */

import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { FileValidationOptions, ValidationResult } from '../types/file-processing.js';
import { SecurityScanner } from '../modules/ingestion/SecurityScanner.js';
import logger from '../utils/logger.js';

const pipelineAsync = promisify(pipeline);

export interface StreamingValidationResult extends ValidationResult {
  streamProcessingTime: number;
  chunksProcessed: number;
  peakMemoryUsage: number;
}

export interface StreamingOptions {
  chunkSize: number;
  maxConcurrentChunks: number;
  enableProgressTracking: boolean;
  memoryThreshold: number; // MB
}

/**
 * Streaming file processor for handling large files efficiently
 */
export class StreamingFileProcessor {
  private static readonly DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB chunks
  private static readonly DEFAULT_MAX_CONCURRENT = 4;
  private static readonly DEFAULT_MEMORY_THRESHOLD = 100; // 100MB

  private options: StreamingOptions;
  private securityScanner: SecurityScanner;

  constructor(options: Partial<StreamingOptions> = {}) {
    this.options = {
      chunkSize: options.chunkSize || StreamingFileProcessor.DEFAULT_CHUNK_SIZE,
      maxConcurrentChunks:
        options.maxConcurrentChunks || StreamingFileProcessor.DEFAULT_MAX_CONCURRENT,
      enableProgressTracking: options.enableProgressTracking ?? true,
      memoryThreshold: options.memoryThreshold || StreamingFileProcessor.DEFAULT_MEMORY_THRESHOLD,
    };
    this.securityScanner = new SecurityScanner();
  }

  /**
   * Process a large file using streaming approach
   */
  async processLargeFile(
    filePath: string,
    _validationOptions: FileValidationOptions
  ): Promise<StreamingValidationResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    let peakMemoryUsage = startMemory;

    try {
      // Get file stats first
      const stats = await fs.stat(filePath);

      // If file is small enough, use regular processing
      if (stats.size < this.options.chunkSize * 2) {
        const buffer = await fs.readFile(filePath);
        const result = await this.processSmallFile(buffer, filePath, _validationOptions);
        return {
          ...result,
          streamProcessingTime: Date.now() - startTime,
          chunksProcessed: 1,
          peakMemoryUsage: process.memoryUsage().heapUsed - startMemory,
        };
      }

      // Create streaming validation pipeline
      const validationResult = await this.createValidationPipeline(
        filePath,
        stats.size,
        _validationOptions
      );

      // Track memory usage
      const currentMemory = process.memoryUsage().heapUsed;
      peakMemoryUsage = Math.max(peakMemoryUsage, currentMemory);

      // Force garbage collection if memory usage is high
      if (currentMemory - startMemory > this.options.memoryThreshold * 1024 * 1024) {
        if (global.gc) {
          global.gc();
        }
      }

      return {
        ...validationResult,
        streamProcessingTime: Date.now() - startTime,
        chunksProcessed: 0,
        peakMemoryUsage: peakMemoryUsage - startMemory,
      };
    } catch (error) {
      logger.error('Streaming file processing failed', { error, filePath });
      throw error;
    }
  }

  /**
   * Create a streaming validation pipeline
   */
  private async createValidationPipeline(
    filePath: string,
    fileSize: number,
    _validationOptions: FileValidationOptions
  ): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Create hash stream for checksum calculation
    const hashStream = crypto.createHash('sha256');

    // Create magic number validator
    let magicNumberChecked = false;
    let fileTypeDetected = 'unknown';

    // Create streaming transforms
    const validationTransform = new Transform({
      transform(chunk: Buffer, encoding, callback) {
        try {
          // Check magic number on first chunk
          if (!magicNumberChecked && chunk.length >= 4) {
            const magicNumber = chunk.subarray(0, 4);
            fileTypeDetected = this.detectFileTypeFromMagic(magicNumber);
            magicNumberChecked = true;
          }

          // Update hash
          hashStream.update(chunk);

          // Memory management - don't accumulate chunks
          callback(null, null); // Don't pass chunk downstream to save memory
        } catch (error) {
          callback(error);
        }
      },
    });

    // Create progress tracker if enabled
    const progressTransform = this.options.enableProgressTracking
      ? this.createProgressTracker(fileSize)
      : new Transform({
          transform(chunk, encoding, callback) {
            callback(null, chunk);
          },
        });

    // Execute streaming pipeline
    const fileStream = await fs.open(filePath, 'r');
    const readStream = fileStream.createReadStream({
      highWaterMark: this.options.chunkSize,
    });

    try {
      await pipelineAsync(readStream, progressTransform, validationTransform);
    } finally {
      await fileStream.close();
    }

    // Finalize hash
    const checksum = hashStream.digest('hex');

    // Perform security scan on file (using temporary approach for large files)
    let securityResult;
    try {
      securityResult = await this.securityScanner.scanFile(filePath);
      if (!securityResult.isSafe) {
        securityResult.threats.forEach((threat) => {
          errors.push({
            code: `SECURITY_${threat.type.toUpperCase()}`,
            message: threat.description,
            severity: threat.severity === 'high' ? 'critical' : 'error',
          });
        });
      }
    } catch (scanError) {
      warnings.push({
        code: 'SECURITY_SCAN_FAILED',
        message: `Security scan failed: ${scanError.message}`,
      });
    }

    return {
      isValid: errors.length === 0,
      fileType: fileTypeDetected,
      size: fileSize,
      errors,
      warnings,
      metadata: {
        mimeType: fileTypeDetected,
        extension: filePath.split('.').pop() || '',
        magicNumber: '',
        checksum,
        createdAt: new Date(),
        modifiedAt: new Date(),
      },
    };
  }

  /**
   * Create progress tracking transform
   */
  private createProgressTracker(totalSize: number): Transform {
    let processedBytes = 0;
    let lastProgressReport = 0;

    return new Transform({
      transform(chunk: Buffer, encoding, callback) {
        processedBytes += chunk.length;
        const progress = (processedBytes / totalSize) * 100;

        // Report progress every 10%
        if (progress - lastProgressReport >= 10) {
          logger.info('Streaming file processing progress', {
            progress: Math.round(progress),
            processedBytes,
            totalSize,
          });
          lastProgressReport = Math.floor(progress / 10) * 10;
        }

        callback(null, chunk);
      },
    });
  }

  /**
   * Process small files using regular approach
   */
  private async processSmallFile(
    buffer: Buffer,
    filePath: string,
    validationOptions: FileValidationOptions
  ): Promise<ValidationResult> {
    // Use existing FileProcessor for small files
    const { FileProcessor } = await import('../modules/ingestion/FileProcessor.js');
    const processor = new FileProcessor(validationOptions);
    return processor.validateUpload(buffer, filePath);
  }

  /**
   * Detect file type from magic number
   */
  private detectFileTypeFromMagic(magicNumber: Buffer): string {
    const magicHex = magicNumber.toString('hex').toUpperCase();

    if (magicHex.startsWith('504B0304')) {
      return 'application/zip'; // Could be ZIP or JAR
    }

    return 'application/octet-stream';
  }

  /**
   * Get current streaming options
   */
  getOptions(): StreamingOptions {
    return { ...this.options };
  }

  /**
   * Update streaming options
   */
  updateOptions(newOptions: Partial<StreamingOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}
