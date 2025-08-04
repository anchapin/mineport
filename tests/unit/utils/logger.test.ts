import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError, ErrorType, ErrorSeverity } from '../../../src/utils/logger.js';
import { ErrorHandler } from '../../../src/utils/errorHandler.js';

describe('Error Handling System', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError({
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'Test error message',
        code: 'TEST_001',
        details: { field: 'testField' },
        source: 'test-module',
      });

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.WARNING);
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_001');
      expect(error.details).toEqual({ field: 'testField' });
      expect(error.source).toBe('test-module');
      expect(error.userMessage).toBeTruthy();
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should use provided userMessage if available', () => {
      const customMessage = 'Custom user message';
      const error = new AppError({
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.ERROR,
        message: 'Technical error message',
        userMessage: customMessage,
      });

      expect(error.userMessage).toBe(customMessage);
    });

    it('should generate appropriate user message based on error type', () => {
      const validationError = new AppError({
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'Technical validation error',
      });

      const conversionError = new AppError({
        type: ErrorType.CONVERSION,
        severity: ErrorSeverity.ERROR,
        message: 'Technical conversion error',
      });

      expect(validationError.userMessage).toContain('mod file could not be validated');
      expect(conversionError.userMessage).toContain('error occurred during the conversion process');
    });

    it('should convert to JSON correctly', () => {
      const error = new AppError({
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.ERROR,
        message: 'Network error',
        code: 'NET_001',
      });

      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'AppError');
      expect(json).toHaveProperty('message', 'Network error');
      expect(json).toHaveProperty('type', ErrorType.NETWORK);
      expect(json).toHaveProperty('severity', ErrorSeverity.ERROR);
      expect(json).toHaveProperty('code', 'NET_001');
      expect(json).toHaveProperty('stack');
    });
  });

  describe('ErrorHandler', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should handle regular Error and convert to AppError', () => {
      const regularError = new Error('Regular error');
      const handledError = ErrorHandler.handleError(regularError, 'test-module');

      expect(handledError).toBeInstanceOf(AppError);
      expect(handledError.type).toBe(ErrorType.SYSTEM);
      expect(handledError.message).toBe('Regular error');
      expect(handledError.moduleId).toBe('test-module');
    });

    it('should pass through AppError instances', () => {
      const appError = new AppError({
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'Validation error',
      });

      const handledError = ErrorHandler.handleError(appError);

      expect(handledError).toBe(appError);
    });

    it('should create specific error types', () => {
      const validationError = ErrorHandler.validationError('Invalid input', { field: 'name' });
      const conversionError = ErrorHandler.conversionError('Conversion failed');
      const systemError = ErrorHandler.systemError('System failure');
      const networkError = ErrorHandler.networkError('Network timeout');
      const resourceError = ErrorHandler.resourceError('Out of memory');
      const securityError = ErrorHandler.securityError('Unauthorized access');
      const userError = ErrorHandler.userError('User input required');

      expect(validationError.type).toBe(ErrorType.VALIDATION);
      expect(conversionError.type).toBe(ErrorType.CONVERSION);
      expect(systemError.type).toBe(ErrorType.SYSTEM);
      expect(networkError.type).toBe(ErrorType.NETWORK);
      expect(resourceError.type).toBe(ErrorType.RESOURCE);
      expect(securityError.type).toBe(ErrorType.SECURITY);
      expect(userError.type).toBe(ErrorType.USER);

      expect(securityError.severity).toBe(ErrorSeverity.CRITICAL);
      expect(userError.severity).toBe(ErrorSeverity.INFO);
    });

    it('should wrap async functions with error handling', async () => {
      const successFn = async () => 'success';
      const failFn = async () => {
        throw new Error('Async error');
      };

      const result = await ErrorHandler.tryCatch(successFn);
      expect(result).toBe('success');

      await expect(ErrorHandler.tryCatch(failFn)).rejects.toBeInstanceOf(AppError);
    });

    it('should create user-friendly error responses', () => {
      const appError = new AppError({
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'Technical message',
        userMessage: 'User-friendly message',
        code: 'VAL_001',
      });

      const regularError = new Error('Regular error');

      const appErrorResponse = ErrorHandler.createErrorResponse(appError);
      const regularErrorResponse = ErrorHandler.createErrorResponse(regularError);

      expect(appErrorResponse.success).toBe(false);
      expect(appErrorResponse.error.message).toBe('User-friendly message');
      expect(appErrorResponse.error.type).toBe(ErrorType.VALIDATION);
      expect(appErrorResponse.error.code).toBe('VAL_001');

      expect(regularErrorResponse.success).toBe(false);
      expect(regularErrorResponse.error.message).toContain('unexpected error');
    });

    it('should wrap route handlers with error handling', async () => {
      const successHandler = async (req: any) => ({ success: true, data: req });
      const failHandler = async () => {
        throw new Error('Handler error');
      };

      const wrappedSuccessHandler = withErrorHandling(successHandler, 'api');
      const wrappedFailHandler = withErrorHandling(failHandler, 'api');

      const successResult = await wrappedSuccessHandler({ id: 1 });
      expect(successResult).toEqual({ success: true, data: { id: 1 } });

      const failResult = await wrappedFailHandler({ id: 1 });
      expect(failResult).toHaveProperty('success', false);
      expect(failResult).toHaveProperty('error.message');
    });
  });
});

// Import the withErrorHandling function for testing
import { withErrorHandling } from '../../../src/utils/errorHandler.js';
