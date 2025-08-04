/**
 * ProgramStateAlignmentValidator.test.ts
 *
 * Unit tests for the ProgramStateAlignmentValidator class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProgramStateAlignmentValidator,
  ExecutionTrace,
  ProgramStateSnapshot,
  ValidationResult,
} from '../../../../src/modules/logic/ProgramStateAlignmentValidator.js';
import { LLMTranslationResult } from '../../../../src/modules/logic/LLMTranslationService.js';

describe('ProgramStateAlignmentValidator', () => {
  let validator: ProgramStateAlignmentValidator;

  beforeEach(() => {
    validator = new ProgramStateAlignmentValidator();
  });

  describe('instrumentJavaCode', () => {
    it('should add instrumentation to Java code', () => {
      // Arrange
      const javaCode = `
public class Example {
  public int calculateSum(int a, int b) {
    int result = a + b;
    return result;
  }
}`;

      // Act
      const instrumentedCode = validator.instrumentJavaCode(javaCode);

      // Assert
      expect(instrumentedCode).toContain('import java.util.HashMap');
      expect(instrumentedCode).toContain('class StateTracker');
      expect(instrumentedCode).toContain('captureState');
      expect(instrumentedCode).toContain('Map<String, Object> _stateVars = new HashMap<>()');
    });

    it('should instrument method entries and return statements', () => {
      // Arrange
      const javaCode = `
public int add(int a, int b) {
  return a + b;
}`;

      // Act
      const instrumentedCode = validator.instrumentJavaCode(javaCode);

      // Assert
      expect(instrumentedCode).toContain('_stateVars.put("a", a)');
      expect(instrumentedCode).toContain('_stateVars.put("b", b)');
      expect(instrumentedCode).toContain('StateTracker.captureState("add"');
      expect(instrumentedCode).toContain('StateTracker.captureReturnValue');
    });
  });

  describe('instrumentJavaScriptCode', () => {
    it('should add instrumentation to JavaScript code', () => {
      // Arrange
      const jsCode = `
function calculateSum(a, b) {
  const result = a + b;
  return result;
}`;

      // Act
      const instrumentedCode = validator.instrumentJavaScriptCode(jsCode);

      // Assert
      expect(instrumentedCode).toContain('const StateTracker');
      expect(instrumentedCode).toContain('captureState');
      expect(instrumentedCode).toContain('const _stateVars = {}');
    });

    it('should instrument function declarations and return statements', () => {
      // Arrange
      const jsCode = `
function add(a, b) {
  return a + b;
}`;

      // Act
      const instrumentedCode = validator.instrumentJavaScriptCode(jsCode);

      // Assert
      expect(instrumentedCode).toContain('_stateVars["a"] = a');
      expect(instrumentedCode).toContain('_stateVars["b"] = b');
      expect(instrumentedCode).toContain('StateTracker.captureState("add"');
      expect(instrumentedCode).toContain('StateTracker.captureReturnValue');
    });

    it('should instrument arrow functions', () => {
      // Arrange
      const jsCode = `
const multiply = (a, b) => {
  return a * b;
};`;

      // Act
      const instrumentedCode = validator.instrumentJavaScriptCode(jsCode);

      // Assert
      expect(instrumentedCode).toContain('_stateVars["a"] = a');
      expect(instrumentedCode).toContain('_stateVars["b"] = b');
      expect(instrumentedCode).toContain('StateTracker.captureState("multiply"');
    });
  });

  describe('compareTraces', () => {
    it('should detect when traces are aligned', () => {
      // Arrange
      const javaTrace: ExecutionTrace = {
        language: 'java',
        snapshots: [
          {
            timestamp: 0,
            functionName: 'calculateSum',
            lineNumber: 10,
            variables: new Map([
              ['a', '5'],
              ['b', '10'],
            ]),
            callStack: ['calculateSum', 'main'],
          },
          {
            timestamp: 5,
            functionName: 'calculateSum',
            lineNumber: 15,
            returnValue: '15',
            callStack: ['calculateSum', 'main'],
          },
        ],
        metadata: {
          sourceFile: 'Example.java',
          executionTime: 10,
          snapshotCount: 2,
        },
      };

      const jsTrace: ExecutionTrace = {
        language: 'javascript',
        snapshots: [
          {
            timestamp: 0,
            functionName: 'calculateSum',
            lineNumber: 5,
            variables: new Map([
              ['a', 5],
              ['b', 10],
            ]),
            callStack: ['calculateSum', 'global'],
          },
          {
            timestamp: 3,
            functionName: 'calculateSum',
            lineNumber: 8,
            returnValue: 15,
            callStack: ['calculateSum', 'global'],
          },
        ],
        metadata: {
          sourceFile: 'example.js',
          executionTime: 5,
          snapshotCount: 2,
        },
      };

      // Act
      const result = validator.compareTraces(javaTrace, jsTrace);

      // Assert
      expect(result.isAligned).toBe(true);
      expect(result.divergencePoints).toHaveLength(0);
      expect(result.alignmentScore).toBe(1);
    });

    it('should detect variable value divergence', () => {
      // Arrange
      const javaTrace: ExecutionTrace = {
        language: 'java',
        snapshots: [
          {
            timestamp: 0,
            functionName: 'calculateSum',
            lineNumber: 10,
            variables: new Map([
              ['a', '5'],
              ['b', '10'],
            ]),
            callStack: ['calculateSum', 'main'],
          },
        ],
        metadata: {
          sourceFile: 'Example.java',
          executionTime: 10,
          snapshotCount: 1,
        },
      };

      const jsTrace: ExecutionTrace = {
        language: 'javascript',
        snapshots: [
          {
            timestamp: 0,
            functionName: 'calculateSum',
            lineNumber: 5,
            variables: new Map([
              ['a', 5],
              ['b', 15],
            ]), // b has different value
            callStack: ['calculateSum', 'global'],
          },
        ],
        metadata: {
          sourceFile: 'example.js',
          executionTime: 5,
          snapshotCount: 1,
        },
      };

      // Act
      const result = validator.compareTraces(javaTrace, jsTrace);

      // Assert
      expect(result.isAligned).toBe(false);
      expect(result.divergencePoints).toHaveLength(1);
      expect(result.divergencePoints[0].divergenceType).toBe('variable_value');
      expect(result.alignmentScore).toBeLessThan(1);
    });

    it('should detect return value divergence', () => {
      // Arrange
      const javaTrace: ExecutionTrace = {
        language: 'java',
        snapshots: [
          {
            timestamp: 0,
            functionName: 'calculateSum',
            lineNumber: 10,
            variables: new Map([
              ['a', '5'],
              ['b', '10'],
            ]),
            callStack: ['calculateSum', 'main'],
          },
          {
            timestamp: 5,
            functionName: 'calculateSum',
            lineNumber: 15,
            returnValue: '15',
            callStack: ['calculateSum', 'main'],
          },
        ],
        metadata: {
          sourceFile: 'Example.java',
          executionTime: 10,
          snapshotCount: 2,
        },
      };

      const jsTrace: ExecutionTrace = {
        language: 'javascript',
        snapshots: [
          {
            timestamp: 0,
            functionName: 'calculateSum',
            lineNumber: 5,
            variables: new Map([
              ['a', 5],
              ['b', 10],
            ]),
            callStack: ['calculateSum', 'global'],
          },
          {
            timestamp: 3,
            functionName: 'calculateSum',
            lineNumber: 8,
            returnValue: 50, // Different return value
            callStack: ['calculateSum', 'global'],
          },
        ],
        metadata: {
          sourceFile: 'example.js',
          executionTime: 5,
          snapshotCount: 2,
        },
      };

      // Act
      const result = validator.compareTraces(javaTrace, jsTrace);

      // Assert
      expect(result.isAligned).toBe(false);
      expect(result.divergencePoints).toHaveLength(1);
      expect(result.divergencePoints[0].divergenceType).toBe('return_value');
      expect(result.alignmentScore).toBeLessThan(1);
    });

    it('should detect missing functions', () => {
      // Arrange
      const javaTrace: ExecutionTrace = {
        language: 'java',
        snapshots: [
          {
            timestamp: 0,
            functionName: 'calculateSum',
            lineNumber: 10,
            variables: new Map([
              ['a', '5'],
              ['b', '10'],
            ]),
            callStack: ['calculateSum', 'main'],
          },
          {
            timestamp: 5,
            functionName: 'calculateProduct',
            lineNumber: 20,
            variables: new Map([
              ['a', '5'],
              ['b', '10'],
            ]),
            callStack: ['calculateProduct', 'main'],
          },
        ],
        metadata: {
          sourceFile: 'Example.java',
          executionTime: 10,
          snapshotCount: 2,
        },
      };

      const jsTrace: ExecutionTrace = {
        language: 'javascript',
        snapshots: [
          {
            timestamp: 0,
            functionName: 'calculateSum',
            lineNumber: 5,
            variables: new Map([
              ['a', 5],
              ['b', 10],
            ]),
            callStack: ['calculateSum', 'global'],
          },
          // calculateProduct is missing
        ],
        metadata: {
          sourceFile: 'example.js',
          executionTime: 5,
          snapshotCount: 1,
        },
      };

      // Mock the mapFunctions method to return an empty map
      // This will simulate the case where no functions are mapped
      vi.spyOn<any, any>(validator, 'mapFunctions').mockReturnValue(new Map());

      // Act
      const result = validator.compareTraces(javaTrace, jsTrace);

      // Assert
      expect(result.isAligned).toBe(false);
      expect(result.divergencePoints.length).toBeGreaterThan(0);
      expect(result.divergencePoints.some((dp) => dp.divergenceType === 'missing_state')).toBe(
        true
      );
      expect(result.alignmentScore).toBeLessThan(1);
    });

    it('should handle empty traces', () => {
      // Arrange
      const javaTrace: ExecutionTrace = {
        language: 'java',
        snapshots: [],
        metadata: {
          sourceFile: 'Example.java',
          executionTime: 0,
          snapshotCount: 0,
        },
      };

      const jsTrace: ExecutionTrace = {
        language: 'javascript',
        snapshots: [],
        metadata: {
          sourceFile: 'example.js',
          executionTime: 0,
          snapshotCount: 0,
        },
      };

      // Act
      const result = validator.compareTraces(javaTrace, jsTrace);

      // Assert
      expect(result.isAligned).toBe(false);
      expect(result.divergencePoints).toHaveLength(1);
      expect(result.divergencePoints[0].divergenceType).toBe('missing_state');
      expect(result.alignmentScore).toBe(0);
    });
  });

  describe('validateTranslation', () => {
    it('should validate translation and return results', async () => {
      // Arrange
      const javaCode = `
public int add(int a, int b) {
  return a + b;
}`;

      const jsCode = `
function add(a, b) {
  return a + b;
}`;

      // Mock the compareTraces method
      vi.spyOn(validator, 'compareTraces').mockReturnValue({
        isAligned: true,
        divergencePoints: [],
        alignmentScore: 1,
        recommendations: [],
      });

      // Act
      const result = await validator.validateTranslation(javaCode, jsCode);

      // Assert
      expect(result.isAligned).toBe(true);
      expect(result.divergencePoints).toHaveLength(0);
      expect(result.alignmentScore).toBe(1);
    });

    it('should handle errors during validation', async () => {
      // Arrange
      const javaCode = `
public int add(int a, int b) {
  return a + b;
}`;

      const jsCode = `
function add(a, b) {
  return a + b;
}`;

      // Mock the compareTraces method to throw an error
      vi.spyOn(validator, 'compareTraces').mockImplementation(() => {
        throw new Error('Test error');
      });

      // Act
      const result = await validator.validateTranslation(javaCode, jsCode);

      // Assert
      expect(result.isAligned).toBe(false);
      expect(result.alignmentScore).toBe(0);
      expect(result.recommendations[0]).toContain('Error during validation');
    });
  });

  describe('refineTranslation', () => {
    it('should not modify aligned translations', async () => {
      // Arrange
      const originalTranslation: LLMTranslationResult = {
        translatedCode: 'function add(a, b) { return a + b; }',
        confidence: 0.9,
        warnings: [],
        metadata: {
          tokensUsed: 100,
          processingTime: 500,
          modelVersion: 'test-model',
        },
      };

      const validationResult: ValidationResult = {
        isAligned: true,
        divergencePoints: [],
        alignmentScore: 1,
        recommendations: [],
      };

      // Act
      const refinedTranslation = await validator.refineTranslation(
        originalTranslation,
        validationResult
      );

      // Assert
      expect(refinedTranslation).toEqual(originalTranslation);
    });

    it('should add comments and warnings to misaligned translations', async () => {
      // Arrange
      const originalTranslation: LLMTranslationResult = {
        translatedCode: 'function add(a, b) { return a - b; }', // Bug: subtraction instead of addition
        confidence: 0.9,
        warnings: [],
        metadata: {
          tokensUsed: 100,
          processingTime: 500,
          modelVersion: 'test-model',
        },
      };

      const validationResult: ValidationResult = {
        isAligned: false,
        divergencePoints: [
          {
            javaSnapshot: {
              timestamp: 5,
              functionName: 'add',
              lineNumber: 15,
              returnValue: '15',
              variables: new Map(),
              callStack: ['add', 'main'],
            },
            javascriptSnapshot: {
              timestamp: 3,
              functionName: 'add',
              lineNumber: 8,
              returnValue: -5,
              variables: new Map(),
              callStack: ['add', 'global'],
            },
            divergenceType: 'return_value',
            description: 'Return values differ: Java=15, JS=-5',
            severity: 'high',
          },
        ],
        alignmentScore: 0.8,
        recommendations: [
          'Focus on ensuring return values match between Java and JavaScript implementations',
        ],
      };

      // Act
      const refinedTranslation = await validator.refineTranslation(
        originalTranslation,
        validationResult
      );

      // Assert
      expect(refinedTranslation.translatedCode).toContain('REFINED TRANSLATION');
      expect(refinedTranslation.translatedCode).toContain('Return values differ');
      expect(refinedTranslation.confidence).toBeLessThan(originalTranslation.confidence);
      expect(refinedTranslation.warnings.length).toBeGreaterThan(
        originalTranslation.warnings.length
      );
      expect(refinedTranslation.metadata).toHaveProperty('refinementApplied', true);
    });
  });

  describe('parseExecutionTrace', () => {
    it('should parse valid execution trace JSON', () => {
      // Arrange
      const traceJson = JSON.stringify({
        language: 'java',
        snapshots: [
          {
            timestamp: 0,
            functionName: 'add',
            lineNumber: 10,
            variables: { a: '5', b: '10' },
            callStack: ['add', 'main'],
          },
        ],
        metadata: {
          sourceFile: 'Example.java',
          executionTime: 10,
          snapshotCount: 1,
        },
      });

      // Act
      const trace = validator.parseExecutionTrace(traceJson);

      // Assert
      expect(trace.language).toBe('java');
      expect(trace.snapshots).toHaveLength(1);
      expect(trace.snapshots[0].functionName).toBe('add');
      expect(trace.snapshots[0].variables.get('a')).toBe('5');
      expect(trace.metadata.sourceFile).toBe('Example.java');
    });

    it('should throw error for invalid JSON', () => {
      // Arrange
      const invalidJson = '{ invalid json }';

      // Act & Assert
      expect(() => validator.parseExecutionTrace(invalidJson)).toThrow();
    });

    it('should throw error for invalid trace format', () => {
      // Arrange
      const invalidTraceJson = JSON.stringify({
        // Missing required fields
        snapshots: [],
      });

      // Act & Assert
      expect(() => validator.parseExecutionTrace(invalidTraceJson)).toThrow();
    });
  });
});
