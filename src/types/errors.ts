/**
 * Standardized error and note type definitions
 *
 * This file contains interfaces related to error handling, reporting,
 * and conversion notes used throughout the application.
 */
import { SourceLocation } from './base.js';

/**
 * Enum for error types
 *
 * Provides a standardized set of error types across the application
 */
export enum ErrorType {
  VALIDATION = 'validation',
  ASSET = 'asset',
  CONFIG = 'config',
  LOGIC = 'logic',
  SYSTEM = 'system',
  NETWORK = 'network',
  RESOURCE = 'resource',
  SECURITY = 'security',
  USER = 'user',
  COMPROMISE = 'compromise',
}

/**
 * Enum for error severity levels
 *
 * Provides a standardized set of severity levels across the application
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error code format: [MODULE]-[TYPE]-[NUMBER]
 * Example: ASSET-VAL-001 (Asset module validation error #1)
 */
export type ErrorCode = string;

/**
 * Represents a conversion error
 *
 * This interface aligns with the design document's error model specification.
 */
export interface ConversionError {
  id: string;
  code: ErrorCode;
  type: ErrorType | keyof typeof ErrorType;
  severity: ErrorSeverity | keyof typeof ErrorSeverity;
  message: string;
  sourceLocation?: SourceLocation;
  recommendedFix?: string;
  moduleOrigin: string;
  timestamp: Date;
  details?: Record<string, any>;
  userMessage?: string;
}

/**
 * Summary of errors encountered during conversion
 */
export interface ErrorSummary {
  totalErrors: number;
  bySeverity: Record<ErrorSeverity | string, number>;
  byType: Record<ErrorType | string, number>;
  byModule: Record<string, number>;
  mostCritical: ConversionError[];
}

/**
 * Filter for errors
 */
export interface ErrorFilter {
  types?: Array<ErrorType | string>;
  severities?: Array<ErrorSeverity | string>;
  modules?: string[];
  search?: string;
  codes?: string[];
}

/**
 * Base interface for all module-specific conversion notes
 */
export interface BaseConversionNote {
  type: ErrorSeverity | keyof typeof ErrorSeverity;
  message: string;
  code?: ErrorCode;
  details?: Record<string, any>;
}

/**
 * Represents a logic conversion note
 */
export interface LogicConversionNote extends BaseConversionNote {
  sourceLocation?: {
    file: string;
    line: number;
    column: number;
  };
  code?: string;
}

/**
 * Represents an asset conversion note
 *
 * This interface follows the naming convention guidelines for conversion notes.
 */
export interface AssetConversionNote extends BaseConversionNote {
  component: 'texture' | 'model' | 'sound' | 'particle';
  assetPath?: string;
}

/**
 * Represents a configuration conversion note
 */
export interface ConfigConversionNote extends BaseConversionNote {
  configType:
    | 'manifest'
    | 'recipe'
    | 'loot_table'
    | 'block_definition'
    | 'item_definition'
    | 'license';
  configPath?: string;
}

/**
 * Represents a compromise strategy note
 */
export interface CompromiseNote extends BaseConversionNote {
  strategyApplied: string;
  originalFeature: string;
  compromiseReason: string;
  alternativeSuggestion?: string;
}

/**
 * Interface for error collector options
 */
export interface ErrorCollectorOptions {
  maxErrors?: number;
  groupSimilarErrors?: boolean;
  filterDuplicates?: boolean;
  categorizeByModule?: boolean;
}

/**
 * Interface for error collector service
 *
 * This interface aligns with the design document's ErrorCollector specification.
 */
export interface ErrorCollector {
  /**
   * addError method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  addError(error: ConversionError): void;
  /**
   * addErrors method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  addErrors(errors: ConversionError[]): void;
  /**
   * getErrors method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getErrors(filter?: ErrorFilter): ConversionError[];
  /**
   * getErrorSummary method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getErrorSummary(): ErrorSummary;
  /**
   * getErrorsByModule method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getErrorsByModule(moduleId: string): ConversionError[];
  /**
   * getErrorsByType method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getErrorsByType(type: ErrorType | string): ConversionError[];
  /**
   * getErrorsBySeverity method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getErrorsBySeverity(severity: ErrorSeverity | string): ConversionError[];
  /**
   * hasErrors method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  hasErrors(severity?: ErrorSeverity | string): boolean;
  /**
   * clear method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  clear(): void;
}

/**
 * Helper function to create a standardized error code
 *
 * @param module Module identifier (e.g., ASSET, LOGIC)
 * @param type Error type abbreviation (e.g., VAL for validation)
 * @param number Error number within the module-type combination
 * @returns Formatted error code
 */
export function createErrorCode(module: string, type: string, number: number): ErrorCode {
  return `${module.toUpperCase()}-${type.toUpperCase()}-${number.toString().padStart(3, '0')}`;
}

/**
 * Helper function to create a conversion error
 *
 * @param options Error properties
 * @returns Conversion error object
 */
export function createConversionError(options: {
  code: ErrorCode;
  type: ErrorType | keyof typeof ErrorType;
  severity: ErrorSeverity | keyof typeof ErrorSeverity;
  message: string;
  moduleOrigin: string;
  sourceLocation?: SourceLocation;
  recommendedFix?: string;
  details?: Record<string, any>;
  userMessage?: string;
}): ConversionError {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    ...options,
  };
}

// Enhanced error codes for ModPorter-AI integration components
export const FILE_PROCESSOR_ERRORS = {
  INVALID_MIME_TYPE: createErrorCode('FILE', 'MIME', 1),
  FILE_TOO_LARGE: createErrorCode('FILE', 'SIZE', 1),
  ZIP_BOMB_DETECTED: createErrorCode('FILE', 'BOMB', 1),
  PATH_TRAVERSAL: createErrorCode('FILE', 'PATH', 1),
  MALWARE_DETECTED: createErrorCode('FILE', 'MAL', 1),
  VALIDATION_FAILED: createErrorCode('FILE', 'VAL', 1),
};

export const JAVA_ANALYZER_ERRORS = {
  REGISTRY_EXTRACTION_FAILED: createErrorCode('JAVA', 'REG', 1),
  MANIFEST_PARSE_ERROR: createErrorCode('JAVA', 'MAN', 1),
  TEXTURE_DETECTION_FAILED: createErrorCode('JAVA', 'TEX', 1),
  ANALYSIS_TIMEOUT: createErrorCode('JAVA', 'TIME', 1),
  BYTECODE_ANALYSIS_FAILED: createErrorCode('JAVA', 'BYTE', 1),
};

export const ASSET_CONVERTER_ERRORS = {
  TEXTURE_CONVERSION_FAILED: createErrorCode('ASSET', 'TEX', 1),
  MODEL_CONVERSION_FAILED: createErrorCode('ASSET', 'MOD', 1),
  SOUND_CONVERSION_FAILED: createErrorCode('ASSET', 'SND', 1),
  ASSET_NOT_FOUND: createErrorCode('ASSET', 'NF', 1),
  CONVERSION_TIMEOUT: createErrorCode('ASSET', 'TIME', 1),
};

export const BEDROCK_ARCHITECT_ERRORS = {
  STRUCTURE_GENERATION_FAILED: createErrorCode('ARCH', 'STRUCT', 1),
  MANIFEST_GENERATION_FAILED: createErrorCode('ARCH', 'MAN', 1),
  ASSET_ORGANIZATION_FAILED: createErrorCode('ARCH', 'ORG', 1),
  VALIDATION_FAILED: createErrorCode('ARCH', 'VAL', 1),
};

export const VALIDATION_PIPELINE_ERRORS = {
  STAGE_EXECUTION_FAILED: createErrorCode('VAL', 'STAGE', 1),
  PIPELINE_TIMEOUT: createErrorCode('VAL', 'TIME', 1),
  VALIDATION_CONFIG_ERROR: createErrorCode('VAL', 'CONF', 1),
  AGGREGATION_FAILED: createErrorCode('VAL', 'AGG', 1),
};

/**
 * Error recovery strategy types
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  SKIP = 'skip',
  COMPROMISE = 'compromise',
  ABORT = 'abort',
  MANUAL_INTERVENTION = 'manual_intervention',
}

/**
 * Recovery action interface
 */
export interface RecoveryAction {
  strategy: RecoveryStrategy;
  description: string;
  automated: boolean;
  retryCount?: number;
  maxRetries?: number;
  fallbackMethod?: string;
  compromiseStrategy?: string;
  userAction?: string;
}

/**
 * Enhanced conversion error with recovery capabilities
 */
export interface EnhancedConversionError extends ConversionError {
  recoveryActions: RecoveryAction[];
  isRecoverable: boolean;
  hasBeenRecovered: boolean;
  recoveryAttempts: number;
  lastRecoveryAttempt?: Date;
  originalError?: Error;
  context?: Record<string, any>;
}

/**
 * Error aggregation result
 */
export interface ErrorAggregation {
  pattern: string;
  count: number;
  errors: ConversionError[];
  firstOccurrence: Date;
  lastOccurrence: Date;
  affectedModules: string[];
  commonCause?: string;
  suggestedFix?: string;
}

/**
 * Error categorization result
 */
export interface ErrorCategorization {
  category: string;
  subcategory?: string;
  severity: ErrorSeverity;
  frequency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  impact: 'low' | 'medium' | 'high' | 'critical';
  errors: ConversionError[];
}

/**
 * Error rate metrics
 */
export interface ErrorRateMetrics {
  totalErrors: number;
  errorRate: number; // errors per minute/hour
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByModule: Record<string, number>;
  timeWindow: {
    start: Date;
    end: Date;
    duration: number; // in milliseconds
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  threshold: {
    warning: number;
    critical: number;
  };
}

/**
 * Graceful degradation configuration
 */
export interface DegradationConfig {
  enableFallbacks: boolean;
  fallbackStrategies: Record<string, string>;
  maxDegradationLevel: number;
  criticalComponents: string[];
  nonEssentialComponents: string[];
}

/**
 * Error recovery result
 */
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  message: string;
  newError?: ConversionError;
  fallbackUsed?: boolean;
  compromiseApplied?: boolean;
  userActionRequired?: boolean;
  details?: Record<string, any>;
}

/**
 * Enhanced error collector interface with recovery capabilities
 */
export interface EnhancedErrorCollector extends ErrorCollector {
  addEnhancedError(error: EnhancedConversionError): void;
  attemptRecovery(errorId: string): Promise<RecoveryResult>;
  getRecoverableErrors(): EnhancedConversionError[];
  getErrorAggregations(): ErrorAggregation[];
  getErrorCategorizations(): ErrorCategorization[];
  getErrorRateMetrics(timeWindow?: number): ErrorRateMetrics;
  enableGracefulDegradation(config: DegradationConfig): void;
  getSystemHealthStatus(): SystemHealthStatus;
}

/**
 * System health status
 */
export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'failing';
  components: Record<string, ComponentHealth>;
  errorRate: number;
  degradationLevel: number;
  activeRecoveries: number;
  lastHealthCheck: Date;
  recommendations: string[];
}

/**
 * Component health status
 */
export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'failing' | 'disabled';
  errorCount: number;
  errorRate: number;
  lastError?: Date;
  fallbackActive: boolean;
  recoveryAttempts: number;
}

/**
 * Helper function to create an enhanced conversion error with recovery capabilities
 *
 * @param baseError Base conversion error
 * @param recoveryActions Available recovery actions
 * @param context Additional context for recovery
 * @returns Enhanced conversion error
 */
export function createEnhancedConversionError(
  baseError: ConversionError,
  recoveryActions: RecoveryAction[] = [],
  context?: Record<string, any>
): EnhancedConversionError {
  return {
    ...baseError,
    recoveryActions,
    isRecoverable: recoveryActions.length > 0,
    hasBeenRecovered: false,
    recoveryAttempts: 0,
    context,
  };
}

/**
 * Helper function to create recovery actions based on error type and context
 *
 * @param error Conversion error
 * @param context Error context
 * @returns Array of recovery actions
 */
export function createRecoveryActions(
  error: ConversionError,
  context?: Record<string, any>
): RecoveryAction[] {
  const actions: RecoveryAction[] = [];

  // File processing errors
  if (error.moduleOrigin === 'FILE') {
    if (error.code === FILE_PROCESSOR_ERRORS.FILE_TOO_LARGE) {
      actions.push({
        strategy: RecoveryStrategy.COMPROMISE,
        description: 'Process file in chunks or reduce quality',
        automated: true,
        compromiseStrategy: 'chunk_processing',
      });
    } else if (error.code === FILE_PROCESSOR_ERRORS.INVALID_MIME_TYPE) {
      actions.push({
        strategy: RecoveryStrategy.MANUAL_INTERVENTION,
        description: 'User should verify file format and re-upload',
        automated: false,
        userAction: 'Please verify the file is a valid JAR or ZIP file and try again',
      });
    } else if (error.code === FILE_PROCESSOR_ERRORS.ZIP_BOMB_DETECTED) {
      actions.push({
        strategy: RecoveryStrategy.ABORT,
        description: 'Security threat detected - processing aborted',
        automated: true,
      });
    }
  }

  // Java analysis errors
  if (error.moduleOrigin === 'JAVA') {
    if (error.code === JAVA_ANALYZER_ERRORS.REGISTRY_EXTRACTION_FAILED) {
      actions.push({
        strategy: RecoveryStrategy.FALLBACK,
        description: 'Try alternative extraction methods',
        automated: true,
        fallbackMethod: 'multi_strategy_extraction',
      });
    } else if (error.code === JAVA_ANALYZER_ERRORS.ANALYSIS_TIMEOUT) {
      actions.push({
        strategy: RecoveryStrategy.RETRY,
        description: 'Retry analysis with extended timeout',
        automated: true,
        maxRetries: 2,
      });
    }
  }

  // Asset conversion errors
  if (error.moduleOrigin === 'ASSET') {
    if (error.code === ASSET_CONVERTER_ERRORS.TEXTURE_CONVERSION_FAILED) {
      actions.push({
        strategy: RecoveryStrategy.FALLBACK,
        description: 'Use default texture or skip texture conversion',
        automated: true,
        fallbackMethod: 'default_texture',
      });
    } else if (error.code === ASSET_CONVERTER_ERRORS.CONVERSION_TIMEOUT) {
      actions.push({
        strategy: RecoveryStrategy.COMPROMISE,
        description: 'Reduce conversion quality for faster processing',
        automated: true,
        compromiseStrategy: 'reduced_quality',
      });
    }
  }

  // Validation pipeline errors
  if (error.moduleOrigin === 'VAL') {
    if (error.code === VALIDATION_PIPELINE_ERRORS.STAGE_EXECUTION_FAILED) {
      actions.push({
        strategy: RecoveryStrategy.SKIP,
        description: 'Skip failed validation stage and continue',
        automated: true,
      });
    }
  }

  // Generic fallback for any error that doesn't have specific recovery actions
  if (actions.length === 0) {
    // Add a generic retry action for most errors
    if (error.severity !== ErrorSeverity.CRITICAL) {
      actions.push({
        strategy: RecoveryStrategy.RETRY,
        description: 'Retry the failed operation',
        automated: true,
        maxRetries: 2,
      });
    }

    // Add a skip action for non-critical errors
    if (error.severity === ErrorSeverity.WARNING || error.severity === ErrorSeverity.INFO) {
      actions.push({
        strategy: RecoveryStrategy.SKIP,
        description: 'Skip this operation and continue',
        automated: true,
      });
    }
  }

  return actions;
}

/**
 * Helper function to convert module-specific notes to standardized conversion errors
 *
 * @param note Module-specific conversion note
 * @param moduleOrigin Module identifier
 * @param type Error type
 * @returns Standardized conversion error
 */
export function noteToConversionError(
  note:
    | BaseConversionNote
    | LogicConversionNote
    | AssetConversionNote
    | ConfigConversionNote
    | CompromiseNote,
  moduleOrigin: string,
  type: ErrorType | keyof typeof ErrorType
): ConversionError {
  const severity = typeof note.type === 'string' ? note.type : ErrorSeverity.INFO;

  let sourceLocation: SourceLocation | undefined;
  if ('sourceLocation' in note && note.sourceLocation) {
    sourceLocation = {
      file: note.sourceLocation.file,
      line: note.sourceLocation.line,
      column: note.sourceLocation.column,
    };
  } else if ('assetPath' in note && note.assetPath) {
    sourceLocation = {
      file: note.assetPath,
      line: 0,
      column: 0,
    };
  } else if ('configPath' in note && note.configPath) {
    sourceLocation = {
      file: note.configPath,
      line: 0,
      column: 0,
    };
  }

  const details: Record<string, any> = note.details || {};

  // Add component-specific details
  if ('component' in note) {
    details.component = note.component;
  }
  if ('configType' in note) {
    details.configType = note.configType;
  }
  if ('strategyApplied' in note) {
    details.strategyApplied = note.strategyApplied;
    details.originalFeature = note.originalFeature;
    details.compromiseReason = note.compromiseReason;
    details.alternativeSuggestion = note.alternativeSuggestion;
  }

  return createConversionError({
    code: note.code || createErrorCode(moduleOrigin, type.toString(), 1),
    type,
    severity: severity as ErrorSeverity,
    message: note.message,
    moduleOrigin,
    sourceLocation,
    details,
    userMessage: note.message, // Use the same message for user by default
  });
}
