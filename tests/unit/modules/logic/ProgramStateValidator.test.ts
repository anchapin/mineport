/**
 * Unit tests for ProgramStateValidator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgramStateValidator } from '../../../../src/modules/logic/ProgramStateValidator.js';
import { TranslationContext } from '../../../../src/types/logic-translation.js';

vi.mock('../../../../src/utils/logger.js', async () => {
  const actual = (await vi.importActual('../../../../src/utils/logger.js')) as any;
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
      const validator = new ProgramStateValidator(mockOptions);
      const testCase = {
        code: 'class A {}',
        expected: 'class B {}',
        metadata: { language: 'typescript' },
      };

      // Force a timeout
      mockOptions.timeout = 1;
      const result = await validator.validate(testCase);
      expect(result.isEquivalent).toBe(false);
      expect(result.differences[0].type).toBe('error');
      expect(result.differences[0].description).toContain('Validation timed out');
    });

    it('should prioritize differences correctly', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences = [
        {
          code: 'class A {}',
          expected: 'class B {}',
          metadata: { language: 'typescript' },
        };
      const prioritized = validator['prioritizeDifferences'](differences);
      expect(prioritized[0].severity).toBe('high');
      expect(prioritized[1].severity).toBe('medium');
      expect(prioritized[2].severity).toBe('low');
    });

    it('should generate recommendations for differences', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences = [
        {
          code: 'class A {}',
          expected: 'class B {}',
          metadata: { language: 'typescript' },
        };
      const recommendations = validator['generateRecommendations'](differences);
      expect(recommendations.length).toBe(1);
      expect(recommendations[0].description).toContain('Add a constructor');
    });

    it('should calculate overall confidence based on differences', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences = [
        {
          code: 'class A {}',
          expected: 'class B {}',
          metadata: { language: 'typescript' },
        };
      const confidence = validator['calculateOverallConfidence'](differences);
      expect(confidence).toBe(0.75);
    });

    it('should handle empty or invalid inputs gracefully', async () => {
      const validator = new ProgramStateValidator(mockOptions);
      const testCase = { code: '', expected: '', metadata: { language: 'typescript' } };
      const result = await validator.validate(testCase);
      expect(result.isEquivalent).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Thresholds', () => {
    it('should approve translations above the confidence threshold', async () => {
      const validator = new ProgramStateValidator({ ...mockOptions, confidenceThreshold: 0.8 });
      const testCase = {
        code: 'class A {}',
        expected: 'class B {}',
        metadata: { language: 'typescript' },
      };

      // Mock analyzers to produce high confidence
      jest.spyOn(validator['staticAnalyzer'], 'analyze').mockResolvedValue({
        differences: [],
        confidence: 0.9,
      });
      jest.spyOn(validator['semanticAnalyzer'], 'analyze').mockResolvedValue({
        differences: [],
        confidence: 0.9,
      });
      jest.spyOn(validator['behaviorAnalyzer'], 'analyze').mockResolvedValue({
        differences: [],
        confidence: 0.9,
      });

      const result = await validator.validate(testCase);
      expect(result.isEquivalent).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should reject translations below the confidence threshold', async () => {
      const validator = new ProgramStateValidator({ ...mockOptions, confidenceThreshold: 0.9 });
      const testCase = {
        code: 'class A {}',
        expected: 'class B {}',
        metadata: { language: 'typescript' },
      };

      // Mock analyzers to produce low confidence
      jest.spyOn(validator['staticAnalyzer'], 'analyze').mockResolvedValue({
        differences: [{ type: 'complexity', severity: 'high', description: 'High complexity' }],
        confidence: 0.7,
      });
      jest.spyOn(validator['semanticAnalyzer'], 'analyze').mockResolvedValue({
        differences: [],
        confidence: 0.8,
      });
      jest.spyOn(validator['behaviorAnalyzer'], 'analyze').mockResolvedValue({
        differences: [],
        confidence: 0.8,
      });

      const result = await validator.validate(testCase);
      expect(result.isEquivalent).toBe(false);
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe('Analyzer Management', () => {
    it('should not run disabled analyzers', async () => {
      const validator = new ProgramStateValidator({
        ...mockOptions,
        disabledAnalyzers: ['static', 'semantic'],
      });
      const testCase = {
        code: 'class A {}',
        expected: 'class B {}',
        metadata: { language: 'typescript' },
      };

      const staticSpy = jest.spyOn(validator['staticAnalyzer'], 'analyze');
      const semanticSpy = jest.spyOn(validator['semanticAnalyzer'], 'analyze');
      const behaviorSpy = jest.spyOn(validator['behaviorAnalyzer'], 'analyze');

      await validator.validate(testCase);

      expect(staticSpy).not.toHaveBeenCalled();
      expect(semanticSpy).not.toHaveBeenCalled();
      expect(behaviorSpy).toHaveBeenCalled();
    });
  });

  describe('Context-Specific Recommendations', () => {
    it('should provide context-specific recommendations for Java', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences = [
        {
          code: 'class A {}',
          expected: 'class B {}',
          metadata: { language: 'typescript' },
        };
      const recommendations = validator['generateRecommendations'](differences, 'java');
      expect(recommendations[0].codeExample).toContain('try (FileInputStream fis = new FileInputStream("file.txt"))');
    });

    it('should provide context-specific recommendations for TypeScript', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences = [
        {
          code: 'class A {}',
          expected: 'class B {}',
          metadata: { language: 'typescript' },
        };
      const recommendations = validator['generateRecommendations'](differences, 'typescript');
      expect(recommendations[0].codeExample).toContain('async function fetchData()');
    });
  });
});

// Helper function for testing
function getSeverityOrder(severity: 'low' | 'medium' | 'high' | 'critical'): number {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[severity];
}
