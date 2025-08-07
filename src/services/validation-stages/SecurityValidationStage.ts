/**
 * Security Validation Stage
 *
 * This validation stage performs security checks on uploaded files and
 * conversion results to ensure safety and prevent security vulnerabilities.
 */

import { createLogger } from '../../utils/logger.js';
import { ValidationStage, ValidationInput, ValidationStageResult } from '../ValidationPipeline.js';
import {
  ConversionError,
  ErrorType,
  ErrorSeverity,
  createErrorCode,
  createConversionError,
} from '../../types/errors.js';

const logger = createLogger('SecurityValidationStage');
const MODULE_ID = 'SEC_VAL';

/**
 * Security validation stage implementation
 */
export class SecurityValidationStage implements ValidationStage {
  public readonly name = 'security';
  public readonly required = true;
  public readonly timeout = 30000; // 30 seconds

  /**
   * Execute security validation
   *
   * @param input Validation input data
   * @param config Stage configuration
   * @returns Validation stage result
   */
  public async validate(
    input: ValidationInput,
    config?: Record<string, any>
  ): Promise<ValidationStageResult> {
    const startTime = process.hrtime.bigint();
    const errors: ConversionError[] = [];
    const warnings: ConversionError[] = [];

    logger.debug('Starting security validation', { filePath: input.filePath });

    try {
      // Check file size limits
      if (input.fileContent) {
        await this.validateFileSize(input.fileContent, errors, config);
      }

      // Check for malicious patterns
      if (input.fileContent) {
        await this.validateMaliciousPatterns(input.fileContent, errors, warnings, input.filePath);
      }

      // Check for path traversal attempts
      if (input.filePath) {
        await this.validatePathTraversal(input.filePath, errors);
      }

      // Validate analysis results for security issues
      if (input.analysisResults) {
        await this.validateAnalysisResults(input.analysisResults, errors, warnings);
      }

      // Validate conversion results for security issues
      if (input.conversionResults) {
        await this.validateConversionResults(input.conversionResults, errors, warnings);
      }

      const executionTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      const passed = errors.length === 0;

      logger.debug('Security validation completed', {
        passed,
        errorCount: errors.length,
        warningCount: warnings.length,
        executionTime,
      });

      return {
        stageName: this.name,
        passed,
        errors,
        warnings,
        executionTime,
        metadata: {
          checksPerformed: [
            'file_size',
            'malicious_patterns',
            'path_traversal',
            'analysis_security',
            'conversion_security',
          ],
        },
      };
    } catch (error) {
      const executionTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Security validation failed', { error: errorMessage });

      const validationError = createConversionError({
        code: createErrorCode(MODULE_ID, 'EXEC', 1),
        type: ErrorType.SECURITY,
        severity: ErrorSeverity.CRITICAL,
        message: `Security validation execution failed: ${errorMessage}`,
        moduleOrigin: MODULE_ID,
        details: { originalError: error },
      });

      return {
        stageName: this.name,
        passed: false,
        errors: [validationError],
        warnings,
        executionTime,
        metadata: { error: errorMessage },
      };
    }
  }

  /**
   * Validate file size limits
   *
   * @param fileContent File content buffer
   * @param errors Error collection
   * @param config Stage configuration
   */
  private async validateFileSize(
    fileContent: Buffer,
    errors: ConversionError[],
    config?: Record<string, any>
  ): Promise<void> {
    const maxFileSize = config?.maxFileSize ?? 500 * 1024 * 1024; // 500MB default

    if (fileContent.length > maxFileSize) {
      errors.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'SIZE', 1),
          type: ErrorType.SECURITY,
          severity: ErrorSeverity.ERROR,
          message: `File size ${fileContent.length} bytes exceeds maximum allowed size of ${maxFileSize} bytes`,
          moduleOrigin: MODULE_ID,
          details: {
            fileSize: fileContent.length,
            maxSize: maxFileSize,
          },
        })
      );
    }
  }

  /**
   * Validate for malicious patterns in file content
   *
   * @param fileContent File content buffer
   * @param errors Error collection
   * @param warnings Warning collection
   * @param filePath Optional file path for context
   */
  private async validateMaliciousPatterns(
    fileContent: Buffer,
    errors: ConversionError[],
    warnings: ConversionError[],
    filePath?: string
  ): Promise<void> {
    const suspiciousPatterns = [
      {
        pattern: /Runtime\.getRuntime\(\)\.exec/,
        severity: ErrorSeverity.CRITICAL,
        description: 'Runtime execution detected',
      },
      {
        pattern: /ProcessBuilder/,
        severity: ErrorSeverity.CRITICAL,
        description: 'Process builder detected',
      },
      {
        pattern: /System\.exit/,
        severity: ErrorSeverity.ERROR,
        description: 'System exit call detected',
      },
      {
        pattern: /File\.delete/,
        severity: ErrorSeverity.WARNING,
        description: 'File deletion detected',
      },
      {
        pattern: /FileOutputStream/,
        severity: ErrorSeverity.WARNING,
        description: 'File output stream detected',
      },
      {
        pattern: /URLClassLoader/,
        severity: ErrorSeverity.WARNING,
        description: 'Dynamic class loading detected',
      },
      {
        pattern: /Reflection/,
        severity: ErrorSeverity.WARNING,
        description: 'Reflection usage detected',
      },
    ];

    // Skip pattern detection for very large files to avoid memory issues
    if (fileContent.length > 100 * 1024 * 1024) { // 100MB limit for pattern detection
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'PATTERN', 999),
          type: ErrorType.SECURITY,
          severity: ErrorSeverity.WARNING,
          message: 'File too large for malicious pattern detection',
          moduleOrigin: MODULE_ID,
          details: { fileSize: fileContent.length },
        })
      );
      return;
    }

    const content = fileContent.toString('utf-8');

    for (const { pattern, severity, description } of suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        const error = createConversionError({
          code: createErrorCode(
            MODULE_ID,
            'PATTERN',
            suspiciousPatterns.indexOf({ pattern, severity, description }) + 1
          ),
          type: ErrorType.SECURITY,
          severity,
          message: `Suspicious pattern detected: ${description}`,
          moduleOrigin: MODULE_ID,
          sourceLocation: filePath
            ? {
                file: filePath,
                startLine: 0,
                startColumn: 0,
                endLine: 0,
                endColumn: 0,
              }
            : undefined,
          details: {
            pattern: pattern.toString(),
            matches: matches.length,
            description,
          },
        });

        if (severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.ERROR) {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      }
    }
  }

  /**
   * Validate for path traversal attempts
   *
   * @param filePath File path to validate
   * @param errors Error collection
   */
  private async validatePathTraversal(filePath: string, errors: ConversionError[]): Promise<void> {
    const dangerousPatterns = [
      '../',
      '..\\',
      '/etc/',
      '/root/',
      'C:\\Windows\\',
      'C:\\System32\\',
      '~/',
      '%USERPROFILE%',
    ];

    for (const pattern of dangerousPatterns) {
      if (filePath.includes(pattern)) {
        errors.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'PATH', dangerousPatterns.indexOf(pattern) + 1),
            type: ErrorType.SECURITY,
            severity: ErrorSeverity.CRITICAL,
            message: `Path traversal attempt detected: ${pattern}`,
            moduleOrigin: MODULE_ID,
            sourceLocation: {
              file: filePath,
              startLine: 0,
              startColumn: 0,
              endLine: 0,
              endColumn: 0,
            },
            details: {
              filePath,
              dangerousPattern: pattern,
            },
          })
        );
      }
    }
  }

  /**
   * Validate analysis results for security issues
   *
   * @param analysisResults Analysis results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateAnalysisResults(
    analysisResults: any,
    errors: ConversionError[],
    warnings: ConversionError[]
  ): Promise<void> {
    // Check for suspicious registry names
    if (analysisResults.registryNames) {
      const suspiciousNames = analysisResults.registryNames.filter(
        (name: string) =>
          name.toLowerCase().includes('hack') ||
          name.toLowerCase().includes('exploit') ||
          name.toLowerCase().includes('backdoor') ||
          name.toLowerCase().includes('virus')
      );

      if (suspiciousNames.length > 0) {
        warnings.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'REGISTRY', 1),
            type: ErrorType.SECURITY,
            severity: ErrorSeverity.WARNING,
            message: `Suspicious registry names detected: ${suspiciousNames.join(', ')}`,
            moduleOrigin: MODULE_ID,
            details: { suspiciousNames },
          })
        );
      }
    }

    // Check for suspicious texture paths
    if (analysisResults.texturePaths) {
      const suspiciousPaths = analysisResults.texturePaths.filter(
        (path: string) => path.includes('..') || path.startsWith('/') || path.includes('\\')
      );

      if (suspiciousPaths.length > 0) {
        errors.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'TEXTURE', 1),
            type: ErrorType.SECURITY,
            severity: ErrorSeverity.ERROR,
            message: `Suspicious texture paths detected: ${suspiciousPaths.join(', ')}`,
            moduleOrigin: MODULE_ID,
            details: { suspiciousPaths },
          })
        );
      }
    }
  }

  /**
   * Validate conversion results for security issues
   *
   * @param conversionResults Conversion results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateConversionResults(
    conversionResults: any,
    errors: ConversionError[],
    warnings: ConversionError[]
  ): Promise<void> {
    // Check for suspicious output files
    if (conversionResults.outputFiles) {
      const suspiciousFiles = conversionResults.outputFiles.filter(
        (file: any) =>
          file.path &&
          (file.path.includes('..') ||
            file.path.startsWith('/') ||
            file.path.includes('system') ||
            file.path.includes('admin'))
      );

      if (suspiciousFiles.length > 0) {
        errors.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'OUTPUT', 1),
            type: ErrorType.SECURITY,
            severity: ErrorSeverity.ERROR,
            message: `Suspicious output file paths detected`,
            moduleOrigin: MODULE_ID,
            details: {
              suspiciousFiles: suspiciousFiles.map((f: any) => f.path),
            },
          })
        );
      }
    }

    // Check for excessive resource usage
    if (conversionResults.metadata) {
      const { processingTime, memoryUsage, fileCount } = conversionResults.metadata;

      if (processingTime && processingTime > 300000) {
        // 5 minutes
        warnings.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'PERF', 1),
            type: ErrorType.SECURITY,
            severity: ErrorSeverity.WARNING,
            message: `Excessive processing time detected: ${processingTime}ms`,
            moduleOrigin: MODULE_ID,
            details: { processingTime },
          })
        );
      }

      if (fileCount && fileCount > 10000) {
        warnings.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'PERF', 2),
            type: ErrorType.SECURITY,
            severity: ErrorSeverity.WARNING,
            message: `Excessive file count detected: ${fileCount}`,
            moduleOrigin: MODULE_ID,
            details: { fileCount },
          })
        );
      }
    }
  }
}
