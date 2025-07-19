import winston from 'winston';
import config from '../../config/default.js';
import path from 'path';
import fs from 'fs';

/**
 * Error types for the application
 * Implements requirement 7.5: Fail gracefully and provide meaningful error messages
 */
export enum ErrorType {
  VALIDATION = 'validation',
  CONVERSION = 'conversion',
  SYSTEM = 'system',
  NETWORK = 'network',
  RESOURCE = 'resource',
  SECURITY = 'security',
  USER = 'user',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Interface for structured error information
 */
export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  details?: any;
  userMessage?: string;
  source?: string;
  moduleId?: string;
  timestamp?: Date;
}

/**
 * Custom error class with structured information
 */
export class AppError extends Error {
  type: ErrorType;
  severity: ErrorSeverity;
  code?: string;
  details?: any;
  userMessage: string;
  source?: string;
  moduleId?: string;
  timestamp: Date;

  constructor(info: ErrorInfo) {
    super(info.message);
    this.name = 'AppError';
    this.type = info.type;
    this.severity = info.severity;
    this.code = info.code;
    this.details = info.details;
    this.userMessage = info.userMessage || this.getUserFriendlyMessage(info);
    this.source = info.source;
    this.moduleId = info.moduleId;
    this.timestamp = info.timestamp || new Date();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Generate a user-friendly error message if one is not provided
   */
  private getUserFriendlyMessage(info: ErrorInfo): string {
    // Default user-friendly messages based on error type and severity
    switch (info.type) {
      case ErrorType.VALIDATION:
        return 'The mod file could not be validated. Please check that it is a valid Minecraft Java mod.';
      case ErrorType.CONVERSION:
        return 'An error occurred during the conversion process. Some features may not have been converted correctly.';
      case ErrorType.SYSTEM:
        return 'A system error occurred. Please try again later.';
      case ErrorType.NETWORK:
        return 'A network error occurred. Please check your connection and try again.';
      case ErrorType.RESOURCE:
        return 'The system is currently low on resources. Please try again later.';
      case ErrorType.SECURITY:
        return 'A security check failed. Please ensure you have the necessary permissions.';
      case ErrorType.USER:
        return info.message; // For user errors, the message is already user-friendly
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  /**
   * Convert to a plain object for logging
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      code: this.code,
      details: this.details,
      userMessage: this.userMessage,
      source: this.source,
      moduleId: this.moduleId,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Setup the logger with enhanced error handling
 */
export function setupLogger() {
  // Ensure log directory exists
  const logDir = path.dirname(config.logging.file);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create custom format for structured errors
  const errorFormat = winston.format((info) => {
    if (info instanceof Error) {
      return Object.assign({}, info, {
        stack: info.stack,
        message: info.message,
      });
    }
    if (info.error instanceof Error) {
      return Object.assign({}, info, {
        error: {
          name: info.error.name,
          message: info.error.message,
          stack: info.error.stack,
          ...(info.error instanceof AppError ? info.error.toJSON() : {}),
        },
      });
    }
    return info;
  });

  const logger = winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(
      errorFormat(),
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'minecraft-mod-converter' },
    transports: [
      new winston.transports.File({ 
        filename: config.logging.file,
        level: 'info',
      }),
      new winston.transports.File({ 
        filename: path.join(path.dirname(config.logging.file), 'error.log'),
        level: 'error',
      }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  });

  // Add helper methods for structured error logging
  const enhancedLogger = {
    ...logger,
    
    /**
     * Log an application error with structured information
     */
    logError(error: AppError | Error, context?: object): void {
      if (error instanceof AppError) {
        logger.log({
          level: this.mapSeverityToLevel(error.severity),
          message: error.message,
          error,
          ...context,
        });
      } else {
        logger.error({
          message: error.message,
          error,
          ...context,
        });
      }
    },
    
    /**
     * Create and log an application error
     */
    createAndLogError(info: ErrorInfo, context?: object): AppError {
      const error = new AppError(info);
      this.logError(error, context);
      return error;
    },
    
    /**
     * Map error severity to log level
     */
    mapSeverityToLevel(severity: ErrorSeverity): string {
      switch (severity) {
        case ErrorSeverity.INFO:
          return 'info';
        case ErrorSeverity.WARNING:
          return 'warn';
        case ErrorSeverity.ERROR:
          return 'error';
        case ErrorSeverity.CRITICAL:
          return 'error';
        default:
          return 'info';
      }
    },
  };

  return enhancedLogger;
}

// Create and export the logger instance
const logger = setupLogger();
export default logger;

/**
 * Global error handler for uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Give logger time to write before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

/**
 * Global error handler for unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
});