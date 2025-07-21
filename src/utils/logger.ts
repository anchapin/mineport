import winston from 'winston';
import config from '../../config/default.js';
import path from 'path';
import fs from 'fs';
import { ErrorSeverity, ConversionError } from '../types/errors';

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
    }
  };
}

// Create and export the logger instance
const logger = setupLogger();
export default logger;

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