import logger, { AppError, ErrorType, ErrorSeverity, ErrorInfo } from './logger';

/**
 * Error handler utility for consistent error handling across the application
 * Implements requirement 7.5: Fail gracefully and provide meaningful error messages
 */
export class ErrorHandler {
  /**
   * Handle an error with appropriate logging and response
   */
  static handleError(error: Error | AppError, moduleId?: string): AppError {
    // If it's already an AppError, just log it
    if (error instanceof AppError) {
      logger.logError(error, { moduleId });
      return error;
    }
    
    // Convert to AppError with system type
    const appError = new AppError({
      type: ErrorType.SYSTEM,
      severity: ErrorSeverity.ERROR,
      message: error.message,
      details: {
        originalError: error.name,
        stack: error.stack,
      },
      moduleId,
    });
    
    logger.logError(appError);
    return appError;
  }
  
  /**
   * Create a validation error
   */
  static validationError(message: string, details?: any, moduleId?: string): AppError {
    return new AppError({
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.WARNING,
      message,
      details,
      moduleId,
    });
  }
  
  /**
   * Create a conversion error
   */
  static conversionError(message: string, details?: any, moduleId?: string): AppError {
    return new AppError({
      type: ErrorType.CONVERSION,
      severity: ErrorSeverity.ERROR,
      message,
      details,
      moduleId,
    });
  }
  
  /**
   * Create a system error
   */
  static systemError(message: string, details?: any, moduleId?: string): AppError {
    return new AppError({
      type: ErrorType.SYSTEM,
      severity: ErrorSeverity.ERROR,
      message,
      details,
      moduleId,
    });
  }
  
  /**
   * Create a network error
   */
  static networkError(message: string, details?: any, moduleId?: string): AppError {
    return new AppError({
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.ERROR,
      message,
      details,
      moduleId,
    });
  }
  
  /**
   * Create a resource error
   */
  static resourceError(message: string, details?: any, moduleId?: string): AppError {
    return new AppError({
      type: ErrorType.RESOURCE,
      severity: ErrorSeverity.WARNING,
      message,
      details,
      moduleId,
    });
  }
  
  /**
   * Create a security error
   */
  static securityError(message: string, details?: any, moduleId?: string): AppError {
    return new AppError({
      type: ErrorType.SECURITY,
      severity: ErrorSeverity.CRITICAL,
      message,
      details,
      moduleId,
    });
  }
  
  /**
   * Create a user error
   */
  static userError(message: string, details?: any, moduleId?: string): AppError {
    return new AppError({
      type: ErrorType.USER,
      severity: ErrorSeverity.INFO,
      message,
      details,
      moduleId,
      userMessage: message, // For user errors, use the same message
    });
  }
  
  /**
   * Create a critical error
   */
  static criticalError(message: string, details?: any, moduleId?: string): AppError {
    return new AppError({
      type: ErrorType.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      message,
      details,
      moduleId,
    });
  }
  
  /**
   * Try to execute a function and handle any errors
   */
  static async tryCatch<T>(
    fn: () => Promise<T>,
    errorHandler?: (error: Error) => AppError | Error,
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
   */
  static createErrorResponse(error: Error | AppError): ErrorResponse {
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          message: error.userMessage,
          type: error.type,
          code: error.code,
        },
      };
    }
    
    return {
      success: false,
      error: {
        message: 'An unexpected error occurred. Please try again later.',
        type: 'system',
      },
    };
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
  };
}

/**
 * Higher-order function to wrap route handlers with error handling
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