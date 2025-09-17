/**
 * ValidationPipeline Unit Tests
 *
 * Tests for the comprehensive validation pipeline service.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ValidationPipeline,
  ValidationStage,
  ValidationInput,
  ValidationStageResult,
  ValidationPipelineConfig,
} from '../../../src/services/ValidationPipeline.js';
import { ErrorCollector } from '../../../src/services/ErrorCollector.js';
import {
  ErrorType,
  ErrorSeverity,
  createErrorCode,
  createConversionError,
} from '../../../src/types/errors.js';

// Mock logger
vi.mock('../../../src/utils/logger', async () => {
  const actual = (await vi.importActual('../../../src/utils/logger')) as any;
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

// Mock validation stage for testing
class MockValidationStage implements ValidationStage {
  public readonly name: string;
  public readonly required: boolean;
  public readonly timeout?: number;

  private shouldPass: boolean;
  private executionTime: number;
  private shouldThrow: boolean;

  constructor(
    name: string,
    required: boolean = false,
    shouldPass: boolean = true,
    executionTime: number = 100,
    shouldThrow: boolean = false,
    timeout?: number
  ) {
    this.name = name;
    this.required = required;
    this.shouldPass = shouldPass;
    this.executionTime = executionTime;
    this.shouldThrow = shouldThrow;
    this.timeout = timeout;
  }

  async validate(
    _input: ValidationInput,
    _config?: Record<string, any>
  ): Promise<ValidationStageResult> {
    if (this.shouldThrow) {
      throw new Error(`Mock stage ${this.name} error`);
    }

    // Simulate execution time
    await new Promise((resolve) => setTimeout(resolve, this.executionTime));

    const errors = this.shouldPass
      ? []
      : [
          createConversionError({
            code: createErrorCode('MOCK', 'TEST', 1),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Mock validation error from ${this.name}`,
            moduleOrigin: 'MOCK',
          }),
        ];

    return {
      stageName: this.name,
      passed: this.shouldPass,
      errors,
      warnings: [],
      executionTime: this.executionTime,
      metadata: { mock: true },
    };
  }
}

describe('ValidationPipeline', () => {
  let pipeline: ValidationPipeline;
  let errorCollector: ErrorCollector;

  beforeEach(() => {
    errorCollector = new ErrorCollector();
    pipeline = new ValidationPipeline({
      errorCollector,
      collectMetrics: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultPipeline = new ValidationPipeline();
      expect(defaultPipeline).toBeDefined();
      expect(defaultPipeline.getStages()).toHaveLength(0);
    });

    it('should initialize with custom configuration', () => {
      const config: ValidationPipelineConfig = {
        maxExecutionTime: 60000,
        continueOnFailure: false,
        collectMetrics: false,
        errorCollector,
      };

      const customPipeline = new ValidationPipeline(config);
      expect(customPipeline).toBeDefined();
      expect(customPipeline.getErrorCollector()).toBe(errorCollector);
    });
  });

  describe('stage management', () => {
    it('should add validation stages', () => {
      const stage = new MockValidationStage('test-stage');

      pipeline.addStage(stage);

      const stages = pipeline.getStages();
      expect(stages).toHaveLength(1);
      expect(stages[0]).toBe(stage);
    });

    it('should prevent duplicate stage names', () => {
      const stage1 = new MockValidationStage('duplicate');
      const stage2 = new MockValidationStage('duplicate');

      pipeline.addStage(stage1);

      expect(() => pipeline.addStage(stage2)).toThrow(
        "Validation stage 'duplicate' already exists"
      );
    });

    it('should remove validation stages', () => {
      const stage = new MockValidationStage('removable');

      pipeline.addStage(stage);
      expect(pipeline.getStages()).toHaveLength(1);

      const removed = pipeline.removeStage('removable');
      expect(removed).toBe(true);
      expect(pipeline.getStages()).toHaveLength(0);
    });

    it('should return false when removing non-existent stage', () => {
      const removed = pipeline.removeStage('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('validation execution', () => {
    it('should run validation with no stages', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await pipeline.runValidation(input);

      expect(result.passed).toBe(true);
      expect(result.totalStages).toBe(0);
      expect(result.passedStages).toBe(0);
      expect(result.failedStages).toBe(0);
      expect(result.stageResults).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should run validation with passing stages', async () => {
      const stage1 = new MockValidationStage('stage1', false, true, 50);
      const stage2 = new MockValidationStage('stage2', false, true, 75);

      pipeline.addStage(stage1);
      pipeline.addStage(stage2);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await pipeline.runValidation(input);

      expect(result.passed).toBe(true);
      expect(result.totalStages).toBe(2);
      expect(result.passedStages).toBe(2);
      expect(result.failedStages).toBe(0);
      expect(result.stageResults).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.totalExecutionTime).toBeGreaterThan(100);
    });

    it('should run validation with failing non-required stages', async () => {
      const stage1 = new MockValidationStage('stage1', false, true, 50);
      const stage2 = new MockValidationStage('stage2', false, false, 75);

      pipeline.addStage(stage1);
      pipeline.addStage(stage2);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await pipeline.runValidation(input);

      // With continueOnFailure=true and non-required stages, validation passes overall
      expect(result.passed).toBe(true);
      expect(result.totalStages).toBe(2);
      expect(result.passedStages).toBe(1);
      expect(result.failedStages).toBe(1);
      expect(result.stageResults).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it('should fail validation with failing required stages', async () => {
      const stage1 = new MockValidationStage('stage1', false, true, 50);
      const stage2 = new MockValidationStage('stage2', true, false, 75); // Required and failing

      pipeline.addStage(stage1);
      pipeline.addStage(stage2);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await pipeline.runValidation(input);

      // Required stage failure causes overall failure
      expect(result.passed).toBe(false);
      expect(result.totalStages).toBe(2);
      expect(result.passedStages).toBe(1);
      expect(result.failedStages).toBe(1);
      expect(result.stageResults).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it('should stop on required stage failure when continueOnFailure is false', async () => {
      const customPipeline = new ValidationPipeline({
        continueOnFailure: false,
        errorCollector,
      });

      const stage1 = new MockValidationStage('stage1', true, false, 50);
      const stage2 = new MockValidationStage('stage2', false, true, 75);

      customPipeline.addStage(stage1);
      customPipeline.addStage(stage2);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await customPipeline.runValidation(input);

      expect(result.passed).toBe(false);
      expect(result.totalStages).toBe(2);
      expect(result.passedStages).toBe(0);
      expect(result.failedStages).toBe(1);
      expect(result.stageResults).toHaveLength(1); // Only first stage executed
      expect(result.errors).toHaveLength(1);
    });

    it('should continue on required stage failure when continueOnFailure is true', async () => {
      const stage1 = new MockValidationStage('stage1', true, false, 50);
      const stage2 = new MockValidationStage('stage2', false, true, 75);

      pipeline.addStage(stage1);
      pipeline.addStage(stage2);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await pipeline.runValidation(input);

      expect(result.passed).toBe(false);
      expect(result.totalStages).toBe(2);
      expect(result.passedStages).toBe(1);
      expect(result.failedStages).toBe(1);
      expect(result.stageResults).toHaveLength(2); // Both stages executed
      expect(result.errors).toHaveLength(1);
    });

    it('should handle stage execution errors', async () => {
      const stage1 = new MockValidationStage('stage1', false, true, 50);
      const stage2 = new MockValidationStage('stage2', false, true, 75, true); // Will throw

      pipeline.addStage(stage1);
      pipeline.addStage(stage2);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await pipeline.runValidation(input);

      // With continueOnFailure=true and non-required stages, validation passes overall
      expect(result.passed).toBe(true);
      expect(result.totalStages).toBe(2);
      expect(result.passedStages).toBe(1);
      expect(result.failedStages).toBe(1);
      expect(result.stageResults).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.stageResults[1].passed).toBe(false);
      expect(result.stageResults[1].metadata?.error).toContain('Mock stage stage2 error');
    });

    it('should handle stage timeout', async () => {
      const slowStage = new MockValidationStage('slow-stage', false, true, 2000, false, 100); // 2s execution, 100ms timeout

      pipeline.addStage(slowStage);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await pipeline.runValidation(input);

      // With continueOnFailure=true and non-required stage, validation passes overall
      expect(result.passed).toBe(true);
      expect(result.stageResults).toHaveLength(1);
      expect(result.stageResults[0].passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('timed out');
    });
  });

  describe('metrics collection', () => {
    it('should collect and update metrics', async () => {
      const stage1 = new MockValidationStage('stage1', false, true, 50);
      const stage2 = new MockValidationStage('stage2', false, false, 75);

      pipeline.addStage(stage1);
      pipeline.addStage(stage2);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      // Run validation twice
      await pipeline.runValidation(input);
      await pipeline.runValidation(input);

      const metrics = pipeline.getMetrics();

      expect(metrics.totalValidations).toBe(2);
      expect(metrics.successRate).toBe(1); // Both passed overall due to continueOnFailure=true
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.stageMetrics['stage1'].executionCount).toBe(2);
      expect(metrics.stageMetrics['stage1'].successRate).toBe(1);
      expect(metrics.stageMetrics['stage2'].executionCount).toBe(2);
      expect(metrics.stageMetrics['stage2'].successRate).toBe(0);
      expect(metrics.errorsByType[ErrorType.VALIDATION]).toBe(2);
      expect(metrics.errorsBySeverity[ErrorSeverity.ERROR]).toBe(2);
    });

    it('should reset metrics', async () => {
      const stage = new MockValidationStage('stage', false, true, 50);
      pipeline.addStage(stage);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      await pipeline.runValidation(input);

      let metrics = pipeline.getMetrics();
      expect(metrics.totalValidations).toBe(1);

      pipeline.resetMetrics();

      metrics = pipeline.getMetrics();
      expect(metrics.totalValidations).toBe(0);
      expect(metrics.stageMetrics['stage'].executionCount).toBe(0);
    });

    it('should not collect metrics when disabled', async () => {
      const noPipeline = new ValidationPipeline({
        collectMetrics: false,
        errorCollector,
      });

      const stage = new MockValidationStage('stage', false, true, 50);
      noPipeline.addStage(stage);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await noPipeline.runValidation(input);

      expect(result.metrics.totalValidations).toBe(0);
      expect(Object.keys(result.metrics.stageMetrics)).toHaveLength(0);
    });
  });

  describe('error collection', () => {
    it('should collect errors in error collector', async () => {
      const stage = new MockValidationStage('stage', false, false, 50);
      pipeline.addStage(stage);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      await pipeline.runValidation(input);

      const collectedErrors = errorCollector.getErrors();
      expect(collectedErrors).toHaveLength(1);
      expect(collectedErrors[0].message).toContain('Mock validation error');
    });

    it('should clear error collector before validation', async () => {
      // Add some initial errors
      errorCollector.addError(
        createConversionError({
          code: createErrorCode('TEST', 'INIT', 1),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Initial error',
          moduleOrigin: 'TEST',
        })
      );

      expect(errorCollector.getErrors()).toHaveLength(1);

      const stage = new MockValidationStage('stage', false, true, 50);
      pipeline.addStage(stage);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      await pipeline.runValidation(input);

      // Error collector should be cleared and only contain new errors (none in this case)
      const collectedErrors = errorCollector.getErrors();
      expect(collectedErrors).toHaveLength(0);
    });
  });

  describe('pipeline failure handling', () => {
    it('should handle unexpected pipeline errors', async () => {
      // Create a stage that will cause the pipeline to throw during execution
      const problematicStage = {
        name: 'problematic',
        required: false,
        validate: vi.fn().mockImplementation(() => {
          throw new Error('Unexpected pipeline error');
        }),
      } as ValidationStage;

      pipeline.addStage(problematicStage);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
      };

      const result = await pipeline.runValidation(input);

      // With continueOnFailure=true and non-required stage, validation passes overall
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Validation stage 'problematic' failed");
      expect(result.errors[0].severity).toBe(ErrorSeverity.WARNING);
    });
  });

  describe('validation input handling', () => {
    it('should handle empty validation input', async () => {
      const stage = new MockValidationStage('stage', false, true, 50);
      pipeline.addStage(stage);

      const input: ValidationInput = {};

      const result = await pipeline.runValidation(input);

      expect(result.passed).toBe(true);
      expect(result.stageResults).toHaveLength(1);
    });

    it('should handle validation input with all fields', async () => {
      const stage = new MockValidationStage('stage', false, true, 50);
      pipeline.addStage(stage);

      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('test content'),
        analysisResults: { modId: 'test_mod' },
        conversionResults: { success: true },
        metadata: { source: 'test' },
      };

      const result = await pipeline.runValidation(input);

      expect(result.passed).toBe(true);
      expect(result.stageResults).toHaveLength(1);
    });
  });
});
