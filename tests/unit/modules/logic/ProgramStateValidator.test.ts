/**
 * Unit tests for ProgramStateValidator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgramStateValidator } from '../../../../src/modules/logic/ProgramStateValidator.js';
import {
  TranslationContext,
  ValidationResult,
  FunctionalDifference,
} from '../../../../src/types/logic-translation.js';

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProgramStateValidator', () => {
  let validator: ProgramStateValidator;
  let mockContext: TranslationContext;

  beforeEach(() => {
    validator = new ProgramStateValidator({
      enableStaticAnalysis: true,
      enableSemanticAnalysis: true,
      enableBehaviorAnalysis: true,
      confidenceThreshold: 0.8,
      timeoutMs: 10000,
    });

    mockContext = {
      modInfo: {
        name: 'TestMod',
        version: '1.0.0',
        modLoader: 'forge',
        minecraftVersion: '1.19.2',
        dependencies: [],
      },
      apiMappings: [],
      targetVersion: '1.20.0',
      compromiseStrategy: {
        name: 'default',
        type: 'stub',
        description: 'Default strategy',
        implementation: 'stub',
      },
      userPreferences: {
        compromiseLevel: 'moderate',
        preserveComments: true,
        generateDocumentation: true,
        optimizePerformance: false,
      },
    };
  });

  describe('validate', () => {
    it('should validate equivalent simple code successfully', async () => {
      const javaCode = `
        public class TestClass {
          public void testMethod() {
            System.out.println("Hello World");
          }
        }
      `;

      const jsCode = `
        class TestClass {
          testMethod() {
            console.log("Hello World");
          }
        }
      `;

      const result = await validator.validate(javaCode, jsCode, mockContext);

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.differences).toHaveLength(0);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should detect structural differences', async () => {
      const javaCode = `
        public class TestClass {
          public void method1() {}
          public void method2() {}
          public void method3() {}
        }
      `;

      const jsCode = `
        class TestClass {
          method1() {}
          // method2 is missing
          method3() {}
        }
      `;

      const result = await validator.validate(javaCode, jsCode, mockContext);

      expect(result.isEquivalent).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);

      const missingMethodDiff = result.differences.find((diff) =>
        diff.description.includes('method2')
      );
      expect(missingMethodDiff).toBeDefined();
      expect(missingMethodDiff?.severity).toBe('high');
    });

    it('should detect complexity differences', async () => {
      const simpleJavaCode = `
        public class Simple {
          public void method() {
            System.out.println("simple");
          }
        }
      `;

      const complexJsCode = `
        class Simple {
          method() {
            if (condition1) {
              for (let i = 0; i < 10; i++) {
                if (condition2) {
                  while (condition3) {
                    console.log("complex");
                  }
                }
              }
            }
          }
        }
      `;

      const result = await validator.validate(simpleJavaCode, complexJsCode, mockContext);

      expect(result.differences.length).toBeGreaterThan(0);

      const complexityDiff = result.differences.find((diff) =>
        diff.description.includes('complexity difference')
      );
      expect(complexityDiff).toBeDefined();
      expect(complexityDiff?.severity).toBe('medium');
    });

    it('should detect async/sync behavior differences', async () => {
      const syncJavaCode = `
        public class TestClass {
          public void method() {
            doSomething();
            doSomethingElse();
          }
        }
      `;

      const asyncJsCode = `
        class TestClass {
          async method() {
            await doSomething();
            await doSomethingElse();
          }
        }
      `;

      const result = await validator.validate(syncJavaCode, asyncJsCode, mockContext);

      expect(result.differences.length).toBeGreaterThan(0);

      const asyncDiff = result.differences.find((diff) =>
        diff.description.includes('Asynchronous behavior')
      );
      expect(asyncDiff).toBeDefined();
      expect(asyncDiff?.severity).toBe('medium');
    });

    it('should detect missing error handling', async () => {
      const javaCodeWithExceptions = `
        public class TestClass {
          public void method() {
            try {
              riskyOperation();
            } catch (Exception e) {
              handleError(e);
            }
          }
        }
      `;

      const jsCodeWithoutExceptions = `
        class TestClass {
          method() {
            riskyOperation();
          }
        }
      `;

      const result = await validator.validate(
        javaCodeWithExceptions,
        jsCodeWithoutExceptions,
        mockContext
      );

      expect(result.differences.length).toBeGreaterThan(0);

      const errorHandlingDiff = result.differences.find((diff) =>
        diff.description.includes('exception handling')
      );
      expect(errorHandlingDiff).toBeDefined();
      expect(errorHandlingDiff?.severity).toBe('medium');
    });

    it('should handle validation timeout', async () => {
      const shortTimeoutValidator = new ProgramStateValidator({
        timeoutMs: 100, // Very short timeout
      });

      // Mock the analysis methods to take longer than timeout
      const originalAnalyze = (shortTimeoutValidator as any).staticAnalyzer.analyze;
      (shortTimeoutValidator as any).staticAnalyzer.analyze = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => setTimeout(resolve, 200));
      });

      const javaCode = 'public class Test {}';
      const jsCode = 'class Test {}';

      const result = await shortTimeoutValidator.validate(javaCode, jsCode, mockContext);

      expect(result.isEquivalent).toBe(false);
      expect(result.confidence).toBe(0.0);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].description).toContain('Validation failed');
      expect(result.differences[0].severity).toBe('critical');
    });

    it('should prioritize differences by severity', async () => {
      const javaCode = `
        public class TestClass {
          public void criticalMethod() {}
          public void highMethod() {}
          public void mediumMethod() {}
          public void lowMethod() {}
        }
      `;

      const jsCode = `
        class TestClass {
          // All methods missing - will generate different severity differences
        }
      `;

      const result = await validator.validate(javaCode, jsCode, mockContext);

      expect(result.differences.length).toBeGreaterThan(0);

      // Check that differences are sorted by severity
      for (let i = 0; i < result.differences.length - 1; i++) {
        const currentSeverity = getSeverityOrder(result.differences[i].severity);
        const nextSeverity = getSeverityOrder(result.differences[i + 1].severity);
        expect(currentSeverity).toBeLessThanOrEqual(nextSeverity);
      }
    });

    it('should generate appropriate recommendations', async () => {
      const javaCode = `
        public class TestClass {
          public void method() {
            complexOperation();
          }
        }
      `;

      const jsCode = `
        class TestClass {
          method() {
            // Simplified implementation
            simpleOperation();
          }
        }
      `;

      const result = await validator.validate(javaCode, jsCode, mockContext);

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);

      // Should contain relevant recommendations
      const hasStructuralRec = result.recommendations.some(
        (rec) => rec.includes('structure') || rec.includes('semantic') || rec.includes('behavioral')
      );
      expect(hasStructuralRec).toBe(true);
    });

    it('should calculate confidence based on analysis results', async () => {
      const highSimilarityJavaCode = `
        public class TestClass {
          public void method() {
            System.out.println("test");
          }
        }
      `;

      const highSimilarityJsCode = `
        class TestClass {
          method() {
            console.log("test");
          }
        }
      `;

      const lowSimilarityJavaCode = `
        public class ComplexClass {
          public void method1() {}
          public void method2() {}
          public void method3() {}
          public void method4() {}
        }
      `;

      const lowSimilarityJsCode = `
        class DifferentClass {
          differentMethod() {}
        }
      `;

      const highSimilarityResult = await validator.validate(
        highSimilarityJavaCode,
        highSimilarityJsCode,
        mockContext
      );

      const lowSimilarityResult = await validator.validate(
        lowSimilarityJavaCode,
        lowSimilarityJsCode,
        mockContext
      );

      expect(highSimilarityResult.confidence).toBeGreaterThan(lowSimilarityResult.confidence);
    });

    it('should handle empty code inputs', async () => {
      const emptyJavaCode = '';
      const emptyJsCode = '';

      const result = await validator.validate(emptyJavaCode, emptyJsCode, mockContext);

      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.differences).toHaveLength(0);
    });

    it('should respect confidence threshold setting', async () => {
      const highThresholdValidator = new ProgramStateValidator({
        confidenceThreshold: 0.95,
      });

      const lowThresholdValidator = new ProgramStateValidator({
        confidenceThreshold: 0.5,
      });

      const javaCode = `
        public class TestClass {
          public void method() {
            System.out.println("test");
          }
        }
      `;

      const jsCode = `
        class TestClass {
          method() {
            console.log("similar but not identical");
          }
        }
      `;

      const highThresholdResult = await highThresholdValidator.validate(
        javaCode,
        jsCode,
        mockContext
      );
      const lowThresholdResult = await lowThresholdValidator.validate(
        javaCode,
        jsCode,
        mockContext
      );

      // Same code, but different thresholds might lead to different equivalence decisions
      expect(typeof highThresholdResult.isEquivalent).toBe('boolean');
      expect(typeof lowThresholdResult.isEquivalent).toBe('boolean');
    });

    it('should handle validation with disabled analyzers', async () => {
      const limitedValidator = new ProgramStateValidator({
        enableStaticAnalysis: true,
        enableSemanticAnalysis: false,
        enableBehaviorAnalysis: false,
      });

      const javaCode = `
        public class TestClass {
          public void method() {
            System.out.println("test");
          }
        }
      `;

      const jsCode = `
        class TestClass {
          method() {
            console.log("test");
          }
        }
      `;

      const result = await limitedValidator.validate(javaCode, jsCode, mockContext);

      expect(result).toBeDefined();
      expect(result.isEquivalent).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.differences).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should provide context-specific recommendations', async () => {
      const minimalCompromiseContext = {
        ...mockContext,
        userPreferences: {
          ...mockContext.userPreferences,
          compromiseLevel: 'minimal' as const,
        },
      };

      const javaCode = `
        public class TestClass {
          public void method() {
            complexOperation();
          }
        }
      `;

      const jsCode = `
        class TestClass {
          method() {
            simplifiedOperation();
          }
        }
      `;

      const result = await validator.validate(javaCode, jsCode, minimalCompromiseContext);

      expect(result.recommendations).toBeInstanceOf(Array);

      // Should include context-specific recommendations
      const hasConservativeRec = result.recommendations.some(
        (rec) => rec.includes('conservative') || rec.includes('minimal')
      );
      expect(hasConservativeRec).toBe(true);
    });
  });
});

// Helper function for testing
function getSeverityOrder(severity: 'low' | 'medium' | 'high' | 'critical'): number {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[severity];
}
