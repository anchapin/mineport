import logger from './logger.js';
import {
  ConversionError,
  ErrorType,
  ErrorSeverity,
  createConversionError,
  createErrorCode,
} from '../types/errors.js';
import { ErrorCollector } from '../services/ErrorCollector.js';

// Global error collector instance
export const globalErrorCollector = new ErrorCollector();

/**
 * Error handler utility for consistent error handling across the application
 * Implements requirement 7.5: Fail gracefully and provide meaningful error messages
 */
export class ErrorHandler {
  /**
   * Handle an error with appropriate logging and response
   * @param error - The error to handle (Error or ConversionError)
   * @param moduleId - Optional module identifier for context
   * @returns Standardized ConversionError object
   */
  static handleError(error: Error | ConversionError, moduleId?: string): ConversionError {
    // If it's already a ConversionError, just log it
    if (this.isConversionError(error)) {
      logger.error(error.message, { error, moduleId: moduleId || error.moduleOrigin });
      globalErrorCollector.addError(error);
      return error;
    }

    // Convert to ConversionError with system type
    const conversionError = createConversionError({
      code: createErrorCode(moduleId || 'SYS', 'ERR', 1),
      type: ErrorType.SYSTEM,
      severity: ErrorSeverity.ERROR,
      message: error.message,
      moduleOrigin: moduleId || 'system',
      details: {
        originalError: error.name,
        stack: error.stack,
      },
    });

    logger.error(conversionError.message, { error: conversionError });
    globalErrorCollector.addError(conversionError);
    return conversionError;
  }

  /**
   * Create a validation error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param code - Optional custom error code
   * @returns ConversionError of validation type
   */
  static validationError(
    message: string,
    moduleId: string,
    details?: any,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'VAL', 1),
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.WARNING,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create an asset error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param severity - Error severity level (defaults to ERROR)
   * @param code - Optional custom error code
   * @returns ConversionError of asset type
   */
  static assetError(
    message: string,
    moduleId: string,
    details?: any,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'ASSET', 1),
      type: ErrorType.ASSET,
      severity,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create a config error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param severity - Error severity level (defaults to ERROR)
   * @param code - Optional custom error code
   * @returns ConversionError of config type
   */
  static configError(
    message: string,
    moduleId: string,
    details?: any,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'CFG', 1),
      type: ErrorType.CONFIG,
      severity,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create a logic error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param severity - Error severity level (defaults to ERROR)
   * @param code - Optional custom error code
   * @returns ConversionError of logic type
   */
  static logicError(
    message: string,
    moduleId: string,
    details?: any,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'LOGIC', 1),
      type: ErrorType.LOGIC,
      severity,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create a system error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param severity - Error severity level (defaults to ERROR)
   * @param code - Optional custom error code
   * @returns ConversionError of system type
   */
  static systemError(
    message: string,
    moduleId: string,
    details?: any,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'SYS', 1),
      type: ErrorType.SYSTEM,
      severity,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create a network error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param severity - Error severity level (defaults to ERROR)
   * @param code - Optional custom error code
   * @returns ConversionError of network type
   */
  static networkError(
    message: string,
    moduleId: string,
    details?: any,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'NET', 1),
      type: ErrorType.NETWORK,
      severity,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create a resource error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param severity - Error severity level (defaults to WARNING)
   * @param code - Optional custom error code
   * @returns ConversionError of resource type
   */
  static resourceError(
    message: string,
    moduleId: string,
    details?: any,
    severity: ErrorSeverity = ErrorSeverity.WARNING,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'RES', 1),
      type: ErrorType.RESOURCE,
      severity,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create a security error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param code - Optional custom error code
   * @returns ConversionError of security type with critical severity
   */
  static securityError(
    message: string,
    moduleId: string,
    details?: any,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'SEC', 1),
      type: ErrorType.SECURITY,
      severity: ErrorSeverity.CRITICAL,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create a user error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param code - Optional custom error code
   * @returns ConversionError of user type
   */
  static userError(
    message: string,
    moduleId: string,
    details?: any,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'USER', 1),
      type: ErrorType.USER,
      severity: ErrorSeverity.INFO,
      message,
      moduleOrigin: moduleId,
      details,
      userMessage: message, // For user errors, use the same message
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create a compromise error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param severity - Error severity level (defaults to WARNING)
   * @param code - Optional custom error code
   * @returns ConversionError of compromise type
   */
  static compromiseError(
    message: string,
    moduleId: string,
    details?: any,
    severity: ErrorSeverity = ErrorSeverity.WARNING,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'COMP', 1),
      type: ErrorType.COMPROMISE,
      severity,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Create a critical error
   * @param message - Error message
   * @param moduleId - Module identifier where the error occurred
   * @param details - Optional additional error details
   * @param code - Optional custom error code
   * @returns ConversionError of system type with critical severity
   */
  static criticalError(
    message: string,
    moduleId: string,
    details?: any,
    code?: string
  ): ConversionError {
    const error = createConversionError({
      code: code || createErrorCode(moduleId, 'CRIT', 1),
      type: ErrorType.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      message,
      moduleOrigin: moduleId,
      details,
    });

    globalErrorCollector.addError(error);
    return error;
  }

  /**
   * Try to execute a function and handle any errors
   */
  static async tryCatch<T>(
    fn: () => Promise<T>,
    errorHandler?: (error: Error) => ConversionError | Error,
    moduleId?: string
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const handledError = errorHandler
        ? errorHandler(error instanceof Error ? error : new Error(String(error)))
        : this.handleError(error instanceof Error ? error : new Error(String(error)), moduleId);

      throw handledError;
    }
  }

  /**
   * Create a user-friendly error response for API endpoints
   * @param error - Error object to convert to response format
   * @returns Standardized error response object
   * @example
   * ```typescript
   * const errorResponse = ErrorHandler.createErrorResponse(conversionError);
   * res.status(400).json(errorResponse);
   * ```
   */
  static createErrorResponse(error: Error | ConversionError): ErrorResponse {
    if (this.isConversionError(error)) {
      return {
        success: false,
        error: {
          message: error.userMessage || error.message,
          type: error.type.toString(),
          code: error.code,
          severity: error.severity.toString(),
        },
      };
    }

    return {
      success: false,
      error: {
        message: 'An unexpected error occurred. Please try again later.',
        type: ErrorType.SYSTEM.toString(),
        severity: ErrorSeverity.ERROR.toString(),
      },
    };
  }

  /**
   * Type guard to check if an error is a ConversionError
   * @param error - Object to check
   * @returns True if the object is a ConversionError
   * @example
   * ```typescript
   * if (ErrorHandler.isConversionError(error)) {
   *   console.log(`Error code: ${error.code}`);
   * }
   * ```
   */
  static isConversionError(error: any): error is ConversionError {
    return (
      error &&
      typeof error === 'object' &&
      'id' in error &&
      'code' in error &&
      'type' in error &&
      'severity' in error &&
      'moduleOrigin' in error &&
      'timestamp' in error
    );
  }
}

/**
 * Interface for standardized error responses
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    type: string;
    code?: string;
    severity?: string;
  };
}

/**
 * Higher-order function to wrap route handlers with error handling
 * @param handler - Route handler function to wrap
 * @param moduleId - Optional module identifier for error context
 * @returns Wrapped handler function with error handling
 * @example
 * ```typescript
 * const wrappedHandler = withErrorHandling(async (req) => {
 *   // Your route logic here
 *   return result;
 * }, 'USER_MODULE');
 * ```
 */
export function withErrorHandling<T, U>(
  handler: (req: T) => Promise<U>,
  moduleId?: string
): (req: T) => Promise<U | ErrorResponse> {
  return async (req: T) => {
    try {
      return await handler(req);
    } catch (error) {
      const handledError = ErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        moduleId
      );

      return ErrorHandler.createErrorResponse(handledError);
    }
  };
}
