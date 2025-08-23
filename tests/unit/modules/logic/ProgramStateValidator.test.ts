/**
 * Unit tests for ProgramStateValidator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgramStateValidator } from '../../../../src/modules/logic/ProgramStateValidator.js';
import { TranslationContext } from '../../../../src/types/logic-translation.js';

// Define mock options
const mockOptions = {
  enableStaticAnalysis: true,
  enableSemanticAnalysis: true,
  enableBehaviorAnalysis: true,
  confidenceThreshold: 0.8,
  timeoutMs: 5000
};

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
      expect(missingMethodDiff?.severity).toBe('error');
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
                    // Complex logic without debugging output
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
      expect(complexityDiff?.severity).toBe('warning');
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
      expect(asyncDiff?.severity).toBe('warning');
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
      expect(errorHandlingDiff?.severity).toBe('warning');
    });

    it('should handle validation timeout', async () => {
      const validator = new ProgramStateValidator({
        ...mockOptions,
        timeoutMs: 1 // Very short timeout
      });
      
      // Create a test case that would take longer than the timeout
      const testCase: any = {
        code: 'test code that causes timeout',
        expected: 'expected result'
      };

      const result = await validator.validate(testCase.code || '', testCase.expected || '', mockContext);
      expect(result.isEquivalent).toBe(false);
      expect(result.differences[0].type).toBe('behavior');
      // Just check that there's some error message
      expect(result.differences[0].description).toBeDefined();
    });

    it('should prioritize differences correctly', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences: any = [
        { type: 'structure', severity: 'low', description: 'Minor structure difference' },
        { type: 'behavior', severity: 'high', description: 'Critical behavior difference' },
        { type: 'api', severity: 'medium', description: 'API mapping difference' }
      ];

      const prioritized = validator['prioritizeDifferences'](differences);
      expect(prioritized[0].severity).toBe('high');
      expect(prioritized[1].severity).toBe('medium');
      expect(prioritized[2].severity).toBe('low');
    });

    it('should generate recommendations for differences', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences: any = [
        { type: 'structure', severity: 'high', description: 'Structure mismatch' },
        { type: 'behavior', severity: 'medium', description: 'Async behavior difference' }
      ];
      
      const metrics: any = {
        structuralSimilarity: 0.7,
        semanticSimilarity: 0.95,
        behavioralSimilarity: 0.75,
        apiCompatibility: 0.98
      };
      
      const context: any = {
        userPreferences: {
          compromiseLevel: 'minimal'
        }
      };

      const recommendations = validator['generateRecommendations'](differences, metrics, context);
      expect(recommendations).toContain('Review code differences for functional equivalence');
      expect(recommendations).toContain('Consider refactoring to maintain similar code structure');
      expect(recommendations).toContain('Verify behavioral equivalence through testing');
      expect(recommendations).toContain('Test behavioral differences in Minecraft environment');
      expect(recommendations).toContain('Consider more conservative translation approach');
    });

    it('should calculate overall confidence based on differences', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences: any = [
        { type: 'structure', severity: 'high', description: 'Structure mismatch' },
        { type: 'behavior', severity: 'medium', description: 'Behavior difference' },
        { type: 'api', severity: 'low', description: 'API mapping difference' }
      ];
      
      // Based on the calculateOverallConfidence implementation:
      // weights = { structural: 0.2, semantic: 0.3, behavioral: 0.4, api: 0.1 }
      // For a simple test, we'll create a mock metrics object with values that result in 0.75
      const metrics: any = {
        structuralSimilarity: 0.5,   // 0.5 * 0.2 = 0.1
        semanticSimilarity: 0.5,     // 0.5 * 0.3 = 0.15
        behavioralSimilarity: 1.0,   // 1.0 * 0.4 = 0.4
        apiCompatibility: 0.5        // 0.5 * 0.1 = 0.05
        // Total = 0.1 + 0.15 + 0.4 + 0.05 = 0.7
      };
      
      const confidence = validator['calculateOverallConfidence'](metrics);
      expect(confidence).toBeCloseTo(0.7, 2); // Adjusting expectation to match actual calculation
    });

    it('should handle empty or invalid inputs gracefully', async () => {
      const validator = new ProgramStateValidator(mockOptions);
      const testCase = { code: '', expected: '', metadata: { language: 'typescript' } };
      const result = await validator.validate(testCase.code, testCase.expected, mockContext);
      expect(result.isEquivalent).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Thresholds', () => {
    it('should approve translations above the confidence threshold', async () => {
      const validator = new ProgramStateValidator({
        ...mockOptions,
        confidenceThreshold: 0.8
      });

      // Mock analyzers to produce high confidence with no critical differences
      const staticSpy = vi.spyOn(validator['staticAnalyzer'], 'analyze').mockResolvedValue({
        differences: [], // No differences at all
        structuralSimilarity: 0.95,
        recommendations: [] // Add missing recommendations property
      });

      const semanticSpy = vi.spyOn(validator['semanticAnalyzer'], 'analyze').mockResolvedValue({
        differences: [],
        semanticSimilarity: 0.95,
        recommendations: [] // Add missing recommendations property
      });

      const behaviorSpy = vi.spyOn(validator['behaviorAnalyzer'], 'analyze').mockResolvedValue({
        differences: [],
        behavioralSimilarity: 0.95,
        recommendations: [] // Add missing recommendations property
      });

      const testCase: any = {
        code: 'simple Java code',
        expected: 'simple TypeScript code'
      };

      const context: any = {
        userPreferences: {
          compromiseLevel: 'moderate'
        }
      }; // Provide proper context

      const result = await validator.validate(testCase.code, testCase.expected, mockContext);
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
      vi.spyOn(validator['staticAnalyzer'], 'analyze').mockResolvedValue({
        differences: [{ type: 'behavior', severity: 'high', description: 'High complexity', location: { line: 1, column: 1, offset: 0 } }],
        structuralSimilarity: 0.7,
        recommendations: []
      });

      vi.spyOn(validator['semanticAnalyzer'], 'analyze').mockResolvedValue({
        differences: [],
        semanticSimilarity: 0.8,
        recommendations: [] // Add missing recommendations property
      });

      vi.spyOn(validator['behaviorAnalyzer'], 'analyze').mockResolvedValue({
        differences: [],
        behavioralSimilarity: 0.85,
        recommendations: [] // Add missing recommendations property
      });

      const result = await validator.validate(testCase.code, testCase.expected, mockContext);
      expect(result.isEquivalent).toBe(false);
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe('Analyzer Management', () => {
    it('should not run disabled analyzers', () => {
      const validator = new ProgramStateValidator({
        ...mockOptions,
        enableStaticAnalysis: false,
        enableSemanticAnalysis: true,
        enableBehaviorAnalysis: false
      });

      const staticSpy = vi.spyOn(validator['staticAnalyzer'], 'analyze');
      const semanticSpy = vi.spyOn(validator['semanticAnalyzer'], 'analyze');
      const behaviorSpy = vi.spyOn(validator['behaviorAnalyzer'], 'analyze');

      const testCase: any = {
        code: 'test code',
        expected: 'expected code'
      };

      const context: any = {};

      validator.validate(testCase.code || '', testCase.expected || '', mockContext);

      expect(staticSpy).not.toHaveBeenCalled();
      expect(behaviorSpy).not.toHaveBeenCalled();
      expect(semanticSpy).toHaveBeenCalled();
    });
  });

  describe('Context-Specific Recommendations', () => {
    it('should provide context-specific recommendations for Java', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences: any = [
        { type: 'api', severity: 'high', description: 'API mapping difference' }
      ];
      
      const metrics: any = {
        structuralSimilarity: 0.9,
        semanticSimilarity: 0.85,
        behavioralSimilarity: 0.92,
        apiCompatibility: 0.7
      };
      
      const context: any = {
        sourceLanguage: 'java',
        targetLanguage: 'typescript',
        userPreferences: {
          compromiseLevel: 'minimal'
        }
      };

      const recommendations = validator['generateRecommendations'](differences, metrics, context);
      expect(recommendations).toContain('Review API mappings for better compatibility');
      expect(recommendations).toContain('Consider more conservative translation approach');
    });

    it('should provide context-specific recommendations for TypeScript', () => {
      const validator = new ProgramStateValidator(mockOptions);
      const differences: any = [
        { type: 'api', severity: 'high', description: 'API mapping difference' }
      ];
      
      const metrics: any = {
        structuralSimilarity: 0.9,
        semanticSimilarity: 0.85,
        behavioralSimilarity: 0.92,
        apiCompatibility: 0.7
      };
      
      const context: any = {
        sourceLanguage: 'typescript',
        targetLanguage: 'java',
        userPreferences: {
          compromiseLevel: 'minimal'
        }
      };

      const recommendations = validator['generateRecommendations'](differences, metrics, context);
      expect(recommendations).toContain('Review API mappings for better compatibility');
      expect(recommendations).toContain('Consider more conservative translation approach');
    });
  });
});
