/**
 * Unit tests for EnhancedErrorCollector
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EnhancedErrorCollector } from '../../../src/services/EnhancedErrorCollector.js';
import {
  ConversionError,
  EnhancedConversionError,
  ErrorSeverity,
  ErrorType,
  RecoveryStrategy,
  createConversionError,
  createEnhancedConversionError,
  createRecoveryActions,
  FILE_PROCESSOR_ERRORS,
} from '../../../src/types/errors.js';

// Mock logger
vi.mock('../../../src/utils/logger', async () => {
  const actual = await vi.importActual('../../../src/utils/logger');
  return {
    ...actual,
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    },
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    })),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logStructuredEvent: vi.fn(),
      logSecurityEvent: vi.fn(),
      logPerformanceEvent: vi.fn(),
      logBusinessEvent: vi.fn(),
      logSystemEvent: vi.fn(),
    },
  };
});

describe('EnhancedErrorCollector', () => {
  let collector: EnhancedErrorCollector;
  let mockError: ConversionError;
  let mockEnhancedError: EnhancedConversionError;

  beforeEach(() => {
    collector = new EnhancedErrorCollector({
      maxErrors: 100,
      filterDuplicates: true,
    });

    mockError = createConversionError({
      code: 'TEST-ERR-001',
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.ERROR,
      message: 'Test error message',
      moduleOrigin: 'TEST',
    });

    mockEnhancedError = createEnhancedConversionError(mockError, [
      {
        strategy: RecoveryStrategy.RETRY,
        description: 'Retry the operation',
        automated: true,
        maxRetries: 3,
      },
      {
        strategy: RecoveryStrategy.FALLBACK,
        description: 'Use fallback method',
        automated: true,
        fallbackMethod: 'default_method',
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addEnhancedError', () => {
    it('should add enhanced error to collection', () => {
      collector.addEnhancedError(mockEnhancedError);

      const errors = collector.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].id).toBe(mockEnhancedError.id);
    });

    it('should update error aggregations', () => {
      collector.addEnhancedError(mockEnhancedError);

      const aggregations = collector.getErrorAggregations();
      expect(aggregations).toHaveLength(1);
      expect(aggregations[0].count).toBe(1);
      expect(aggregations[0].pattern).toBe('TEST-validation-TEST-ERR-001');
    });

    it('should update error categorizations', () => {
      collector.addEnhancedError(mockEnhancedError);

      const categorizations = collector.getErrorCategorizations();
      expect(categorizations).toHaveLength(1);
      expect(categorizations[0].frequency).toBe(1);
    });

    it('should update component health', () => {
      collector.addEnhancedError(mockEnhancedError);

      const healthStatus = collector.getSystemHealthStatus();
      expect(healthStatus.components['TEST']).toBeDefined();
      expect(healthStatus.components['TEST'].errorCount).toBe(1);
    });
  });

  describe('addError', () => {
    it('should convert regular error to enhanced error', () => {
      collector.addError(mockError);

      const recoverableErrors = collector.getRecoverableErrors();
      expect(recoverableErrors).toHaveLength(1);
      expect(recoverableErrors[0].recoveryActions.length).toBeGreaterThan(0);
    });

    it('should create appropriate recovery actions', () => {
      const fileError = createConversionError({
        code: 'FILE-SIZE-001',
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'File too large',
        moduleOrigin: 'FILE',
      });

      collector.addError(fileError);

      const recoverableErrors = collector.getRecoverableErrors();
      expect(recoverableErrors[0].recoveryActions).toContainEqual(
        expect.objectContaining({
          strategy: RecoveryStrategy.COMPROMISE,
          compromiseStrategy: 'chunk_processing',
        })
      );
    });
  });

  describe('attemptRecovery', () => {
    it('should successfully recover from error with retry strategy', async () => {
      collector.addEnhancedError(mockEnhancedError);

      const result = await collector.attemptRecovery(mockEnhancedError.id);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.RETRY);
    });

    it('should return failure for non-existent error', async () => {
      const result = await collector.attemptRecovery('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error not found');
    });

    it('should return failure for non-recoverable error', async () => {
      const nonRecoverableError = createEnhancedConversionError(mockError, []);
      collector.addEnhancedError(nonRecoverableError);

      const result = await collector.attemptRecovery(nonRecoverableError.id);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error is not recoverable');
    });

    it('should update recovery attempts count', async () => {
      // Create a simple error with just one recovery action to test the count
      const simpleError = createEnhancedConversionError(mockError, [
        {
          strategy: RecoveryStrategy.RETRY,
          description: 'Retry the operation',
          automated: true,
          maxRetries: 3,
        },
      ]);

      collector.addEnhancedError(simpleError);
      await collector.attemptRecovery(simpleError.id);

      // Check the enhanced errors map directly since recovered errors are filtered out
      const enhancedErrors = (collector as any).enhancedErrors;
      const recoveredError = enhancedErrors.get(simpleError.id);
      expect(recoveredError?.recoveryAttempts).toBe(1);
      expect(recoveredError?.hasBeenRecovered).toBe(true);
    });
  });

  describe('getRecoverableErrors', () => {
    it('should return only recoverable errors', () => {
      const recoverableError = createEnhancedConversionError(mockError, [
        { strategy: RecoveryStrategy.RETRY, description: 'Retry', automated: true },
      ]);

      // Create a truly non-recoverable error by setting isRecoverable to false
      const nonRecoverableError = createEnhancedConversionError(
        {
          ...mockError,
          id: 'non-recoverable-id',
          severity: ErrorSeverity.CRITICAL,
          code: 'CRITICAL-ERR-001',
        },
        []
      );
      nonRecoverableError.isRecoverable = false; // Force it to be non-recoverable

      collector.addEnhancedError(recoverableError);
      collector.addEnhancedError(nonRecoverableError);

      const recoverableErrors = collector.getRecoverableErrors();
      expect(recoverableErrors).toHaveLength(1);
      expect(recoverableErrors[0].id).toBe(recoverableError.id);
    });

    it('should not return already recovered errors', async () => {
      collector.addEnhancedError(mockEnhancedError);
      await collector.attemptRecovery(mockEnhancedError.id);

      const recoverableErrors = collector.getRecoverableErrors();
      expect(recoverableErrors).toHaveLength(0);
    });
  });

  describe('getErrorAggregations', () => {
    it('should aggregate similar errors', () => {
      const error1 = createEnhancedConversionError(mockError, []);
      const error2 = createEnhancedConversionError(
        {
          ...mockError,
          id: 'different-id',
          timestamp: new Date(),
        },
        []
      );

      collector.addEnhancedError(error1);
      collector.addEnhancedError(error2);

      const aggregations = collector.getErrorAggregations();
      expect(aggregations).toHaveLength(1);
      expect(aggregations[0].count).toBe(2);
      expect(aggregations[0].errors).toHaveLength(2);
    });

    it('should track first and last occurrence', () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 60000);

      const error1 = createEnhancedConversionError(
        {
          ...mockError,
          timestamp: earlier,
        },
        []
      );
      const error2 = createEnhancedConversionError(
        {
          ...mockError,
          id: 'different-id',
          timestamp: now,
        },
        []
      );

      collector.addEnhancedError(error1);
      collector.addEnhancedError(error2);

      const aggregations = collector.getErrorAggregations();
      expect(aggregations[0].firstOccurrence).toEqual(earlier);
      expect(aggregations[0].lastOccurrence).toEqual(now);
    });
  });

  describe('getErrorCategorizations', () => {
    it('should categorize errors by module and type', () => {
      const fileError = createEnhancedConversionError(
        createConversionError({
          code: 'FILE-VAL-001',
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'File validation error',
          moduleOrigin: 'FILE',
        }),
        []
      );

      const javaError = createEnhancedConversionError(
        createConversionError({
          code: 'JAVA-REG-001',
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Java analysis error',
          moduleOrigin: 'JAVA',
        }),
        []
      );

      collector.addEnhancedError(fileError);
      collector.addEnhancedError(javaError);

      const categorizations = collector.getErrorCategorizations();
      expect(categorizations).toHaveLength(2);

      const fileCategory = categorizations.find((c) => c.category === 'file_processing');
      const analysisCategory = categorizations.find((c) => c.category === 'analysis');

      expect(fileCategory).toBeDefined();
      expect(analysisCategory).toBeDefined();
    });

    it('should calculate impact based on severity', () => {
      const criticalError = createEnhancedConversionError(
        createConversionError({
          code: 'TEST-ERR-001',
          type: ErrorType.SECURITY,
          severity: ErrorSeverity.CRITICAL,
          message: 'Critical error',
          moduleOrigin: 'TEST',
        }),
        []
      );

      collector.addEnhancedError(criticalError);

      const categorizations = collector.getErrorCategorizations();
      expect(categorizations[0].impact).toBe('critical');
    });
  });

  describe('getErrorRateMetrics', () => {
    it('should calculate error rate correctly', () => {
      const now = new Date();
      const timeWindow = 60000; // 1 minute

      // Clear any existing errors first
      collector.clear();

      // Add errors within time window - make sure they're all within the window and unique
      for (let i = 0; i < 5; i++) {
        const error = createEnhancedConversionError(
          {
            ...mockError,
            id: `error-${i}`,
            code: `TEST-ERR-${i.toString().padStart(3, '0')}`, // Make each error unique
            message: `Test error message ${i}`, // Make each message unique
            timestamp: new Date(now.getTime() - i * 5000), // 5 seconds apart, all within 25 seconds
          },
          []
        );
        collector.addEnhancedError(error);
      }

      const metrics = collector.getErrorRateMetrics(timeWindow);
      expect(metrics.totalErrors).toBe(5);
      expect(metrics.errorRate).toBe(5); // 5 errors per minute
    });

    it('should categorize errors by type, severity, and module', () => {
      const validationError = createEnhancedConversionError(
        createConversionError({
          code: 'TEST-VAL-001',
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Validation error',
          moduleOrigin: 'TEST',
        }),
        []
      );

      const securityError = createEnhancedConversionError(
        createConversionError({
          code: 'FILE-SEC-001',
          type: ErrorType.SECURITY,
          severity: ErrorSeverity.CRITICAL,
          message: 'Security error',
          moduleOrigin: 'FILE',
        }),
        []
      );

      collector.addEnhancedError(validationError);
      collector.addEnhancedError(securityError);

      const metrics = collector.getErrorRateMetrics();
      expect(metrics.errorsByType['validation']).toBe(1);
      expect(metrics.errorsByType['security']).toBe(1);
      expect(metrics.errorsBySeverity['error']).toBe(1);
      expect(metrics.errorsBySeverity['critical']).toBe(1);
      expect(metrics.errorsByModule['TEST']).toBe(1);
      expect(metrics.errorsByModule['FILE']).toBe(1);
    });

    it('should calculate trend correctly', () => {
      const now = new Date();
      const timeWindow = 120000; // 2 minutes
      const startTime = new Date(now.getTime() - timeWindow);
      const midPoint = new Date(startTime.getTime() + timeWindow / 2);

      // Clear any existing errors first
      collector.clear();

      // Add fewer errors in first half (before midpoint)
      for (let i = 0; i < 2; i++) {
        const error = createEnhancedConversionError(
          {
            ...mockError,
            id: `early-error-${i}`,
            code: `EARLY-ERR-${i.toString().padStart(3, '0')}`, // Make unique
            message: `Early error message ${i}`, // Make unique
            timestamp: new Date(startTime.getTime() + i * 10000), // Early in the window
          },
          []
        );
        collector.addEnhancedError(error);
      }

      // Add more errors in second half (after midpoint)
      for (let i = 0; i < 5; i++) {
        const error = createEnhancedConversionError(
          {
            ...mockError,
            id: `late-error-${i}`,
            code: `LATE-ERR-${i.toString().padStart(3, '0')}`, // Make unique
            message: `Late error message ${i}`, // Make unique
            timestamp: new Date(midPoint.getTime() + 10000 + i * 5000), // Later in the window
          },
          []
        );
        collector.addEnhancedError(error);
      }

      const metrics = collector.getErrorRateMetrics(timeWindow);
      expect(metrics.trend).toBe('increasing');
    });
  });

  describe('enableGracefulDegradation', () => {
    it('should enable graceful degradation with configuration', () => {
      const config = {
        enableFallbacks: true,
        fallbackStrategies: { method1: 'fallback1' },
        maxDegradationLevel: 3,
        criticalComponents: ['FILE', 'JAVA'],
        nonEssentialComponents: ['ASSET'],
      };

      collector.enableGracefulDegradation(config);

      // Should not throw and should be configured
      expect(() => collector.getSystemHealthStatus()).not.toThrow();
    });
  });

  describe('getSystemHealthStatus', () => {
    it('should return healthy status with no errors', () => {
      const status = collector.getSystemHealthStatus();
      expect(status.overall).toBe('healthy');
      expect(status.errorRate).toBe(0);
      expect(status.degradationLevel).toBe(0);
    });

    it('should return degraded status with moderate error rate', () => {
      // Add errors to trigger warning threshold
      for (let i = 0; i < 15; i++) {
        const error = createEnhancedConversionError(
          {
            ...mockError,
            id: `error-${i}`,
            timestamp: new Date(),
          },
          []
        );
        collector.addEnhancedError(error);
      }

      const status = collector.getSystemHealthStatus();
      expect(status.overall).toBe('degraded');
      expect(status.degradationLevel).toBeGreaterThan(0);
    });

    it('should return critical status with high error rate', () => {
      // Clear any existing errors first
      collector.clear();

      // Add many errors to trigger critical threshold (50+ errors for critical status)
      for (let i = 0; i < 60; i++) {
        const error = createEnhancedConversionError(
          {
            ...mockError,
            id: `error-${i}`,
            code: `CRIT-ERR-${i.toString().padStart(3, '0')}`, // Make unique
            message: `Critical error message ${i}`, // Make unique
            timestamp: new Date(),
          },
          []
        );
        collector.addEnhancedError(error);
      }

      const status = collector.getSystemHealthStatus();
      // Should be critical due to high total error count (60 > 50)
      expect(status.overall).toBe('critical');
      expect(status.degradationLevel).toBeGreaterThan(2);
    });

    it('should provide recommendations based on status', () => {
      // Clear any existing errors first
      collector.clear();

      // Create a new collector with higher max errors to allow more errors to be stored
      const highCapacityCollector = new EnhancedErrorCollector({
        maxErrors: 1000,
        filterDuplicates: true,
      });

      // Add enough errors to trigger the warning threshold (10 errors per minute)
      // For a 1-hour window, we need 600+ errors to get 10+ errors per minute
      for (let i = 0; i < 700; i++) {
        const error = createEnhancedConversionError(
          {
            ...mockError,
            id: `error-${i}`,
            code: `WARN-ERR-${i.toString().padStart(3, '0')}`, // Make unique
            message: `Warning error message ${i}`, // Make unique
            timestamp: new Date(), // All within the current minute
          },
          []
        );
        highCapacityCollector.addEnhancedError(error);
      }

      const status = highCapacityCollector.getSystemHealthStatus();
      const metrics = highCapacityCollector.getErrorRateMetrics();

      // With 700 errors in 1 hour, we should get 700/60 = 11.67 errors per minute
      // This should exceed the warning threshold of 10
      expect(metrics.errorRate).toBeGreaterThan(10);
      expect(status.recommendations).toContain(
        'High error rate detected - investigate recent changes'
      );
    });
  });

  describe('error recovery execution', () => {
    it('should execute retry strategy successfully', async () => {
      const retryError = createEnhancedConversionError(mockError, [
        {
          strategy: RecoveryStrategy.RETRY,
          description: 'Retry operation',
          automated: true,
          maxRetries: 2,
        },
      ]);

      collector.addEnhancedError(retryError);
      const result = await collector.attemptRecovery(retryError.id);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.RETRY);
    });

    it('should execute fallback strategy successfully', async () => {
      const fallbackError = createEnhancedConversionError(mockError, [
        {
          strategy: RecoveryStrategy.FALLBACK,
          description: 'Use fallback',
          automated: true,
          fallbackMethod: 'default_method',
        },
      ]);

      collector.addEnhancedError(fallbackError);
      const result = await collector.attemptRecovery(fallbackError.id);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.FALLBACK);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should execute skip strategy successfully', async () => {
      const skipError = createEnhancedConversionError(mockError, [
        {
          strategy: RecoveryStrategy.SKIP,
          description: 'Skip operation',
          automated: true,
        },
      ]);

      collector.addEnhancedError(skipError);
      const result = await collector.attemptRecovery(skipError.id);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.SKIP);
    });

    it('should handle manual intervention strategy', async () => {
      // Create an error that will trigger manual intervention (invalid MIME type)
      const fileError = createConversionError({
        code: FILE_PROCESSOR_ERRORS.INVALID_MIME_TYPE, // Use the actual constant
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'Invalid file format',
        moduleOrigin: 'FILE',
      });

      collector.addError(fileError); // This will create recovery actions automatically

      const result = await collector.attemptRecovery(fileError.id);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.MANUAL_INTERVENTION);
      expect(result.userActionRequired).toBe(true);
    });

    it('should handle abort strategy', async () => {
      const abortError = createEnhancedConversionError(mockError, [
        {
          strategy: RecoveryStrategy.ABORT,
          description: 'Abort operation',
          automated: true,
        },
      ]);

      collector.addEnhancedError(abortError);
      const result = await collector.attemptRecovery(abortError.id);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.ABORT);
    });
  });
});
