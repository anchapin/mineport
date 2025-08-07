import winston from 'winston';
import config from '../../config/default.js';
import path from 'path';
import fs from 'fs';
import { ErrorSeverity, ConversionError } from '../types/errors.js';
import { LoggingConfig } from '../types/config.js';

/**
 * Setup the logger with enhanced error handling
 */
export function setupLogger() {
  // Handle cases where config might not be available (e.g., in tests)
  const logFile = config?.logging?.file || '/tmp/test.log';
  const logLevel = config?.logging?.level || 'info';

  // Ensure log directory exists
  const logDir = path.dirname(logFile);
  /**
   * if method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create custom format for structured errors
  const errorFormat = winston.format((info) => {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (info instanceof Error) {
      return Object.assign({}, info, {
        stack: info.stack,
        message: info.message,
      });
    }
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (info.error instanceof Error) {
      return Object.assign({}, info, {
        error: {
          name: info.error.name,
          message: info.error.message,
          stack: info.error.stack,
        },
      });
    }
    return info;
  });

  const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      /**
       * errorFormat method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      errorFormat(),
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'minecraft-mod-converter' },
    transports: [
      new winston.transports.File({
        filename: logFile,
        level: 'info',
      }),
      new winston.transports.File({
        filename: path.join(path.dirname(logFile), 'error.log'),
        level: 'error',
      }),
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
      }),
    ],
  });

  return logger;
}

/**
 * Create a logger for a specific module
 *
 * @param moduleId The module identifier
 * @returns A logger instance for the module
 */
export function createLogger(moduleId: string) {
  const logger = setupLogger();

  return {
    info: (message: string, meta?: any) => {
      logger.info(message, { moduleId, ...meta });
    },
    warn: (message: string, meta?: any) => {
      logger.warn(message, { moduleId, ...meta });
    },
    error: (message: string, meta?: any) => {
      logger.error(message, { moduleId, ...meta });
    },
    debug: (message: string, meta?: any) => {
      logger.debug(message, { moduleId, ...meta });
    },
    verbose: (message: string, meta?: any) => {
      logger.verbose(message, { moduleId, ...meta });
    },
  };
}

// Create and export the default logger instance
const defaultLogger = setupLogger();
export default defaultLogger;

/**
 * Global error handler for uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
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
/**

 * Security event types for structured logging
 */
export interface SecurityEvent {
  type: 'security';
  event:
    | 'threat_detected'
    | 'scan_completed'
    | 'file_quarantined'
    | 'malware_detected'
    | 'access_denied';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  fileName?: string;
  threatType?: string;
  details?: Record<string, any>;
}

/**
 * Performance event types for structured logging
 */
export interface PerformanceEvent {
  type: 'performance';
  operation: 'file_processing' | 'java_analysis' | 'asset_conversion' | 'validation';
  duration: number;
  success: boolean;
  userId?: string;
  fileSize?: number;
  details?: Record<string, any>;
}

/**
 * Business event types for structured logging
 */
export interface BusinessEvent {
  type: 'business';
  event: 'conversion_started' | 'conversion_completed' | 'conversion_failed' | 'user_action';
  userId?: string;
  conversionId?: string;
  details?: Record<string, any>;
}

/**
 * System event types for structured logging
 */
export interface SystemEvent {
  type: 'system';
  event: 'startup' | 'shutdown' | 'health_check' | 'configuration_change';
  component?: string;
  details?: Record<string, any>;
}

export type StructuredLogEvent = SecurityEvent | PerformanceEvent | BusinessEvent | SystemEvent;

/**
 * Enhanced logger with structured logging capabilities
 */
class EnhancedLogger {
  private winston: winston.Logger;
  private config: Partial<LoggingConfig>;

  constructor(winstonLogger: winston.Logger, config?: Partial<LoggingConfig>) {
    this.winston = winstonLogger;
    this.config = config || {};
  }

  /**
   * Log a structured event
   */
  logStructuredEvent(
    event: StructuredLogEvent,
    message: string,
    additionalData?: Record<string, any>
  ): void {
    const logData = {
      message,
      eventType: event.type,
      event: event,
      ...additionalData,
    };

    // Determine log level based on event type and severity
    let level = 'info';
    if ('severity' in event) {
      switch (event.severity) {
        case 'critical':
          level = 'error';
          break;
        case 'high':
          level = 'error';
          break;
        case 'medium':
          level = 'warn';
          break;
        case 'low':
          level = 'info';
          break;
      }
    }

    if (event.type === 'performance' && !event.success) {
      level = 'warn';
    }

    this.winston.log(level, logData);
  }

  /**
   * Log a security event
   */
  logSecurityEvent(
    event: Omit<SecurityEvent, 'type'>,
    message: string,
    additionalData?: Record<string, any>
  ): void {
    this.logStructuredEvent({ ...event, type: 'security' }, message, additionalData);
  }

  /**
   * Log a performance event
   */
  logPerformanceEvent(
    event: Omit<PerformanceEvent, 'type'>,
    message: string,
    additionalData?: Record<string, any>
  ): void {
    this.logStructuredEvent({ ...event, type: 'performance' }, message, additionalData);
  }

  /**
   * Log a business event
   */
  logBusinessEvent(
    event: Omit<BusinessEvent, 'type'>,
    message: string,
    additionalData?: Record<string, any>
  ): void {
    this.logStructuredEvent({ ...event, type: 'business' }, message, additionalData);
  }

  /**
   * Log a system event
   */
  logSystemEvent(
    event: Omit<SystemEvent, 'type'>,
    message: string,
    additionalData?: Record<string, any>
  ): void {
    this.logStructuredEvent({ ...event, type: 'system' }, message, additionalData);
  }

  // Standard logging methods
  debug(message: string, meta?: any): void {
    this.winston.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.winston.warn(message, meta);
  }

  error(message: string, meta?: any): void {
    this.winston.error(message, meta);
  }
}

// Create enhanced logger instance
export const logger = new EnhancedLogger(setupLogger());

/**
 * Create an enhanced logger for a specific module
 */
export function createEnhancedLogger(
  moduleId: string,
  config?: Partial<LoggingConfig>
): EnhancedLogger {
  const baseLogger = setupLogger();
  const childLogger = baseLogger.child({ moduleId });
  return new EnhancedLogger(childLogger, config);
}
