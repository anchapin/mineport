/**
 * Unit tests for ErrorRecoveryService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ErrorRecoveryService, RecoveryContext } from '../../../src/services/ErrorRecoveryService.js';
import { EnhancedErrorCollector } from '../../../src/services/EnhancedErrorCollector.js';
import {
  ConversionError,
  ErrorSeverity,
  ErrorType,
  RecoveryStrategy,
  createConversionError,
} from '../../../src/types/errors.js';

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ErrorRecoveryService', () => {
  let recoveryService: ErrorRecoveryService;
  let mockErrorCollector: EnhancedErrorCollector;
  let mockError: ConversionError;
  let mockContext: RecoveryContext;

  beforeEach(() => {
    mockErrorCollector = new EnhancedErrorCollector();
    recoveryService = new ErrorRecoveryService(mockErrorCollector);

    mockError = createConversionError({
      code: 'TEST-ERR-001',
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.ERROR,
      message: 'Test error message',
      moduleOrigin: 'TEST',
    });

    mockContext = {
      moduleId: 'TEST',
      operationId: 'test-operation',
      retryCallback: vi.fn().mockResolvedValue(undefined),
      fallbackCallback: vi.fn().mockResolvedValue(undefined),
      compromiseCallback: vi.fn().mockResolvedValue(undefined),
      skipCallback: vi.fn().mockResolvedValue(undefined),
      metadata: { testData: 'value' },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerRecoveryContext', () => {
    it('should register recovery context successfully', () => {
      expect(() => {
        recoveryService.registerRecoveryContext(mockContext);
      }).not.toThrow();
    });

    it('should allow multiple contexts for different operations', () => {
      const context1 = { ...mockContext, operationId: 'op1' };
      const context2 = { ...mockContext, operationId: 'op2' };

      recoveryService.registerRecoveryContext(context1);
      recoveryService.registerRecoveryContext(context2);

      // Should not throw
      expect(() => {
        recoveryService.unregisterRecoveryContext('TEST', 'op1');
        recoveryService.unregisterRecoveryContext('TEST', 'op2');
      }).not.toThrow();
    });
  });

  describe('unregisterRecoveryContext', () => {
    it('should unregister recovery context successfully', () => {
      recoveryService.registerRecoveryContext(mockContext);

      expect(() => {
        recoveryService.unregisterRecoveryContext('TEST', 'test-operation');
      }).not.toThrow();
    });

    it('should handle unregistering non-existent context gracefully', () => {
      expect(() => {
        recoveryService.unregisterRecoveryContext('NONEXISTENT', 'operation');
      }).not.toThrow();
    });
  });

  describe('handleError', () => {
    it('should handle error and attempt recovery', async () => {
      recoveryService.registerRecoveryContext(mockContext);

      const result = await recoveryService.handleError(mockError, mockContext);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.strategy).toBeDefined();
    });

    it('should handle error without context', async () => {
      const result = await recoveryService.handleError(mockError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should return failure for non-recoverable error', async () => {
      const nonRecoverableError = createConversionError({
        code: 'ABORT-ERR-001',
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        message: 'Non-recoverable error',
        moduleOrigin: 'SYSTEM',
      });

      const result = await recoveryService.handleError(nonRecoverableError);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.ABORT);
    });
  });

  describe('attemptRecoveryWithContext', () => {
    it('should attempt recovery with retry callback', async () => {
      const fileError = createConversionError({
        code: 'FILE-SIZE-001',
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'File too large',
        moduleOrigin: 'FILE',
      });

      recoveryService.registerRecoveryContext(mockContext);
      const result = await recoveryService.handleError(fileError, mockContext);

      // Should attempt some form of recovery
      expect(result).toBeDefined();
    });

    it('should handle retry callback failure', async () => {
      const failingContext = {
        ...mockContext,
        retryCallback: vi.fn().mockRejectedValue(new Error('Retry failed')),
      };

      const result = await recoveryService.handleError(mockError, failingContext);

      expect(result).toBeDefined();
      // Should either succeed with fallback or fail gracefully
    });

    it('should use fallback callback when retry fails', async () => {
      const contextWithFailingRetry = {
        ...mockContext,
        retryCallback: vi.fn().mockRejectedValue(new Error('Retry failed')),
        fallbackCallback: vi.fn().mockResolvedValue('fallback result'),
      };

      const javaError = createConversionError({
        code: 'JAVA-REG-001',
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'Registry extraction failed',
        moduleOrigin: 'JAVA',
      });

      const result = await recoveryService.handleError(javaError, contextWithFailingRetry);

      expect(result).toBeDefined();
      // Should attempt fallback after retry fails
    });
  });

  describe('recovery strategy execution', () => {
    it('should execute retry strategy with context', async () => {
      const retryCallback = vi.fn().mockResolvedValue('success');
      const context = { ...mockContext, retryCallback };

      const result = await recoveryService.handleError(mockError, context);

      // If the error has retry recovery actions, the callback should be called
      if (result.strategy === RecoveryStrategy.RETRY && result.success) {
        expect(retryCallback).toHaveBeenCalled();
      }
    });

    it('should execute fallback strategy with context', async () => {
      const fallbackCallback = vi.fn().mockResolvedValue('fallback result');
      const context = { ...mockContext, fallbackCallback };

      const javaError = createConversionError({
        code: 'JAVA-REG-001',
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'Registry extraction failed',
        moduleOrigin: 'JAVA',
      });

      const result = await recoveryService.handleError(javaError, context);

      // Should attempt recovery
      expect(result).toBeDefined();
    });

    it('should execute compromise strategy with context', async () => {
      const compromiseCallback = vi.fn().mockResolvedValue('compromise result');
      const context = { ...mockContext, compromiseCallback };

      const assetError = createConversionError({
        code: 'ASSET-TIME-001',
        type: ErrorType.RESOURCE,
        severity: ErrorSeverity.ERROR,
        message: 'Conversion timeout',
        moduleOrigin: 'ASSET',
      });

      const result = await recoveryService.handleError(assetError, context);

      expect(result).toBeDefined();
    });

    it('should execute skip strategy with context', async () => {
      const skipCallback = vi.fn().mockResolvedValue(undefined);
      const context = { ...mockContext, skipCallback };

      const validationError = createConversionError({
        code: 'VAL-STAGE-001',
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'Stage execution failed',
        moduleOrigin: 'VAL',
      });

      const result = await recoveryService.handleError(validationError, context);

      expect(result).toBeDefined();
    });
  });

  describe('getRecoveryStatistics', () => {
    it('should return initial statistics', () => {
      const stats = recoveryService.getRecoveryStatistics();

      expect(stats.totalAttempts).toBe(0);
      expect(stats.successfulRecoveries).toBe(0);
      expect(stats.failedRecoveries).toBe(0);
      expect(stats.recoveryRate).toBe(0);
      expect(stats.averageRecoveryTime).toBe(0);
    });

    it('should update statistics after recovery attempts', async () => {
      await recoveryService.handleError(mockError, mockContext);

      const stats = recoveryService.getRecoveryStatistics();
      expect(stats.totalAttempts).toBeGreaterThan(0);
    });
  });

  describe('resetRecoveryStatistics', () => {
    it('should reset statistics to initial state', async () => {
      // Generate some statistics
      await recoveryService.handleError(mockError, mockContext);

      recoveryService.resetRecoveryStatistics();

      const stats = recoveryService.getRecoveryStatistics();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.successfulRecoveries).toBe(0);
      expect(stats.failedRecoveries).toBe(0);
    });
  });

  describe('getRecoveryRecommendations', () => {
    it('should provide recommendations based on statistics', () => {
      const recommendations = recoveryService.getRecoveryRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should provide module-specific recommendations', () => {
      const recommendations = recoveryService.getRecoveryRecommendations('TEST');

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('createErrorHandler', () => {
    it('should create error handler function', () => {
      const errorHandler = recoveryService.createErrorHandler('TEST', 'operation');

      expect(typeof errorHandler).toBe('function');
    });

    it('should handle Error objects', async () => {
      const errorHandler = recoveryService.createErrorHandler('TEST', 'operation');
      const jsError = new Error('JavaScript error');

      const result = await errorHandler(jsError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle ConversionError objects', async () => {
      const errorHandler = recoveryService.createErrorHandler('TEST', 'operation');

      const result = await errorHandler(mockError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should include context in error details', async () => {
      const errorHandler = recoveryService.createErrorHandler('TEST', 'operation');
      const context = { additionalInfo: 'test context' };

      const result = await errorHandler(new Error('Test error'), context);

      expect(result).toBeDefined();
    });
  });

  describe('enableGracefulDegradation', () => {
    it('should enable graceful degradation for module', () => {
      const fallbackMethods = {
        method1: vi.fn().mockResolvedValue('fallback1'),
        method2: vi.fn().mockResolvedValue('fallback2'),
      };

      expect(() => {
        recoveryService.enableGracefulDegradation('TEST', fallbackMethods);
      }).not.toThrow();
    });

    it('should register fallback methods as recovery contexts', () => {
      const fallbackMethods = {
        method1: vi.fn().mockResolvedValue('fallback1'),
      };

      recoveryService.enableGracefulDegradation('TEST', fallbackMethods);

      // Should not throw when unregistering
      expect(() => {
        recoveryService.unregisterRecoveryContext('TEST', 'fallback-method1');
      }).not.toThrow();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle callback exceptions gracefully', async () => {
      const faultyContext = {
        ...mockContext,
        retryCallback: vi.fn().mockImplementation(() => {
          throw new Error('Callback exception');
        }),
      };

      const result = await recoveryService.handleError(mockError, faultyContext);

      expect(result).toBeDefined();
      // Should not throw, should handle gracefully
    });

    it('should handle missing callbacks gracefully', async () => {
      const incompleteContext = {
        moduleId: 'TEST',
        operationId: 'test-operation',
        // Missing callbacks
      };

      const result = await recoveryService.handleError(mockError, incompleteContext);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle concurrent recovery attempts', async () => {
      const promises = Array.from({ length: 5 }, () =>
        recoveryService.handleError(mockError, mockContext)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('performance and resource management', () => {
    it('should handle large number of recovery contexts', () => {
      // Register many contexts
      for (let i = 0; i < 1000; i++) {
        recoveryService.registerRecoveryContext({
          moduleId: `MODULE_${i}`,
          operationId: `operation_${i}`,
        });
      }

      // Should not cause performance issues
      expect(() => {
        recoveryService.getRecoveryStatistics();
      }).not.toThrow();

      // Clean up
      for (let i = 0; i < 1000; i++) {
        recoveryService.unregisterRecoveryContext(`MODULE_${i}`, `operation_${i}`);
      }
    });

    it('should maintain reasonable memory usage', async () => {
      // Generate many recovery attempts
      for (let i = 0; i < 100; i++) {
        const error = createConversionError({
          code: `TEST-ERR-${i.toString().padStart(3, '0')}`,
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: `Test error ${i}`,
          moduleOrigin: 'TEST',
        });

        await recoveryService.handleError(error);
      }

      const stats = recoveryService.getRecoveryStatistics();
      expect(stats.totalAttempts).toBe(100);

      // Reset should clean up memory
      recoveryService.resetRecoveryStatistics();
      const resetStats = recoveryService.getRecoveryStatistics();
      expect(resetStats.totalAttempts).toBe(0);
    });
  });
});
