/**
 * Standardized error and note type definitions
 * 
 * This file contains interfaces related to error handling, reporting,
 * and conversion notes used throughout the application.
 */
import { SourceLocation } from './base';

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
  COMPROMISE = 'compromise'
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
  CRITICAL = 'critical'
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
  configType: 'manifest' | 'recipe' | 'loot_table' | 'block_definition' | 'item_definition' | 'license';
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
  addError(error: ConversionError): void;
  addErrors(errors: ConversionError[]): void;
  getErrors(filter?: ErrorFilter): ConversionError[];
  getErrorSummary(): ErrorSummary;
  getErrorsByModule(moduleId: string): ConversionError[];
  getErrorsByType(type: ErrorType | string): ConversionError[];
  getErrorsBySeverity(severity: ErrorSeverity | string): ConversionError[];
  hasErrors(severity?: ErrorSeverity | string): boolean;
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
    ...options
  };
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
  note: BaseConversionNote | LogicConversionNote | AssetConversionNote | ConfigConversionNote | CompromiseNote,
  moduleOrigin: string,
  type: ErrorType | keyof typeof ErrorType
): ConversionError {
  const severity = typeof note.type === 'string' ? note.type : ErrorSeverity.INFO;
  
  let sourceLocation: SourceLocation | undefined;
  if ('sourceLocation' in note && note.sourceLocation) {
    sourceLocation = {
      file: note.sourceLocation.file,
      line: note.sourceLocation.line,
      column: note.sourceLocation.column
    };
  } else if ('assetPath' in note && note.assetPath) {
    sourceLocation = {
      file: note.assetPath,
      line: 0,
      column: 0
    };
  } else if ('configPath' in note && note.configPath) {
    sourceLocation = {
      file: note.configPath,
      line: 0,
      column: 0
    };
  }
  
  let details: Record<string, any> = note.details || {};
  
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
    userMessage: note.message // Use the same message for user by default
  });
}