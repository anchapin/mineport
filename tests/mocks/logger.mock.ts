import { vi } from 'vitest';

// Create a comprehensive logger mock that covers all exports from logger.ts
export const createLoggerMock = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
});

export const createEnhancedLoggerMock = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  logStructuredEvent: vi.fn(),
  logSecurityEvent: vi.fn(),
  logPerformanceEvent: vi.fn(),
  logBusinessEvent: vi.fn(),
  logSystemEvent: vi.fn(),
});

// Complete logger mock that includes all exports
export const loggerMock = {
  // Default export (winston logger instance)
  default: createLoggerMock(),
  
  // Named exports
  setupLogger: vi.fn(() => createLoggerMock()),
  createLogger: vi.fn(() => createLoggerMock()),
  createEnhancedLogger: vi.fn(() => createEnhancedLoggerMock()),
  logger: createEnhancedLoggerMock(),
};