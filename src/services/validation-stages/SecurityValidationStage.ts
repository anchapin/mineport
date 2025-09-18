/**
 * Security Validation Stage
 * 
 * This validation stage performs security checks on uploaded files and
 * conversion results to ensure safety and prevent security vulnerabilities.
 */

import { createLogger } from '../../utils/logger';
import { 
  ValidationStage, 
  ValidationInput, 
  ValidationStageResult 
} from '../ValidationPipeline';
import { 
  ConversionError, 
  ErrorType, 
  ErrorSeverity, 
  createConversionError 
} from '../../types/errors';
import { FileProcessor } from '../../modules/ingestion/FileProcessor';
import { ValidationError, ValidationWarning } from '../../types/file-processing';
import { ConfigurationService } from '../ConfigurationService';
import { MonitoringService } from '../MonitoringService';

const logger = createLogger('SecurityValidationStage');
const MODULE_ID = 'SEC_VAL';

/**
 * Security validation stage implementation
 */
export class SecurityValidationStage implements ValidationStage {
  public readonly name = 'security_validation';
  public readonly required = true;
  public readonly timeout = 45000; // 45 seconds

  private fileProcessor: FileProcessor;

  constructor() {
    const configService = ConfigurationService.getInstance();
    const config = configService.getConfig();
    const monitoringService = new MonitoringService(config.monitoring);

    this.fileProcessor = new FileProcessor(
      config.security.fileValidation,
      config.security.securityScanning,
      undefined, // CacheService, can be undefined
      undefined, // PerformanceMonitor, can be undefined
      monitoringService
    );
  }
  
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
    const startTime = Date.now();
    
    logger.debug('Starting security validation', { filePath: input.filePath });
    
    if (!input.fileContent || !input.filePath) {
        const errorMessage = 'File content and file path are required for security validation.';
        logger.warn(errorMessage);
        const validationError = createConversionError({
            code: 'SEC_VAL-INPUT-001',
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: errorMessage,
            moduleOrigin: MODULE_ID,
        });
        return {
            stageName: this.name,
            passed: false,
            errors: [validationError],
            warnings: [],
            executionTime: Date.now() - startTime,
            metadata: { error: errorMessage }
        };
    }

    try {
      const validationResult = await this.fileProcessor.validateUpload(
          input.fileContent,
          input.filePath
      );

      const errors: ConversionError[] = validationResult.errors.map(e => this.createUserFriendlyError(e, input.filePath));
      const warnings: ConversionError[] = validationResult.warnings.map(w => this.createUserFriendlyError(w, input.filePath));

      const executionTime = Date.now() - startTime;
      const passed = validationResult.isValid;
      
      logger.debug('Security validation completed', { 
        passed, 
        errorCount: errors.length, 
        warningCount: warnings.length,
        executionTime
      });
      
      return {
        stageName: this.name,
        passed,
        errors,
        warnings,
        executionTime,
        metadata: {
          ...validationResult.metadata,
          checksPerformed: [
            'file_processor_validation',
            'security_scanner_scan'
          ]
        }
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Security validation failed', { error: errorMessage });
      
      const validationError = createConversionError({
        code: 'SEC_VAL-EXEC-001',
        type: ErrorType.SECURITY,
        severity: ErrorSeverity.CRITICAL,
        message: `Security validation execution failed: ${errorMessage}`,
        moduleOrigin: MODULE_ID,
        details: { originalError: error }
      });
      
      return {
        stageName: this.name,
        passed: false,
        errors: [validationError],
        warnings: [],
        executionTime,
        metadata: { error: errorMessage }
      };
    }
  }

  private createUserFriendlyError(error: ValidationError, filePath?: string): ConversionError {
    const errorMap = {
        'FILE_TOO_LARGE': { code: 'SEC-001', message: 'File is too large. Maximum allowed size is 500MB.' },
        'INVALID_MIME_TYPE': { code: 'SEC-002', message: 'Invalid file type. Only JAR and ZIP files are allowed.' },
        'INVALID_MAGIC_NUMBER': { code: 'SEC-003', message: 'File is corrupted or not a valid archive.' },
        'SECURITY_ZIP_BOMB': { code: 'SEC-004', message: 'File appears to be a ZIP bomb. Please verify the file is legitimate.' },
        'SECURITY_PATH_TRAVERSAL': { code: 'SEC-005', message: 'File contains suspicious path traversal attempts.' },
        'SECURITY_MALICIOUS_CODE': { code: 'SEC-006', message: 'File contains potentially malicious code patterns.' },
    };

    const mapping = errorMap[error.code] || { code: error.code, message: error.message };

    let severity: ErrorSeverity;
    switch (error.severity) {
      case 'critical':
        severity = ErrorSeverity.CRITICAL;
        break;
      case 'error':
        severity = ErrorSeverity.ERROR;
        break;
      case 'warning':
      default:
        severity = ErrorSeverity.WARNING;
        break;
    }

    return createConversionError({
      code: mapping.code,
      type: ErrorType.SECURITY,
      severity: severity,
      message: mapping.message,
      userMessage: mapping.message,
      moduleOrigin: MODULE_ID,
      sourceLocation: filePath ? { file: filePath, startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 } : undefined,
      details: error.details,
    });
  }
}