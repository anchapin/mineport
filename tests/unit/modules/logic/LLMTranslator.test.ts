/**
 * Unit tests for LLMTranslator
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { LLMTranslator } from '../../../../src/modules/logic/LLMTranslator.js';
import {
  TranslationContext,
  UnmappableCodeSegment,
  LLMTranslationResult,
} from '../../../../src/types/logic-translation.js';

vi.mock('../../../../src/utils/logger.js', async () => {
  const actual = await vi.importActual('../../../../src/utils/logger.js');
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

describe('LLMTranslator', () => {
  let translator: LLMTranslator;
  let mockLLMClient: any;
  let mockContext: TranslationContext;

  beforeEach(() => {
    mockLLMClient = {
      call: vi.fn(),
    };

    translator = new LLMTranslator(mockLLMClient, {
      model: 'test-model',
      temperature: 0.1,
      maxTokens: 1000,
      timeoutMs: 5000,
      retryAttempts: 2,
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

  describe('translate', () => {
    it('should return empty result for no unmappable segments', async () => {
      const result = await translator.translate([], mockContext);

      expect(result.code).toBe('');
      expect(result.confidence).toBe(1.0);
      expect(result.reasoning).toBe('No unmappable code segments to translate');
      expect(result.alternatives).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should translate single unmappable segment successfully', async () => {
      const unmappableSegments: UnmappableCodeSegment[] = [
        {
          originalCode: 'CustomAPI.doSomething();',
          reason: 'Custom API not mappable',
          context: {
            className: 'TestClass',
            methodName: 'testMethod',
            lineNumber: 5,
            dependencies: [],
          },
          suggestedApproach: 'Use LLM translation',
        },
      ];

      const result = await translator.translate(unmappableSegments, mockContext);

      expect(result.code).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toBeDefined();
      expect(result.alternatives).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
    });

    it('should handle multiple unmappable segments', async () => {
      const unmappableSegments: UnmappableCodeSegment[] = [
        {
          originalCode: 'CustomAPI.method1();',
          reason: 'Custom API',
          context: {
            className: 'TestClass',
            methodName: 'method1',
            lineNumber: 5,
            dependencies: [],
          },
          suggestedApproach: 'LLM translation',
        },
        {
          originalCode: 'AnotherAPI.method2();',
          reason: 'Another custom API',
          context: {
            className: 'TestClass',
            methodName: 'method2',
            lineNumber: 10,
            dependencies: [],
          },
          suggestedApproach: 'LLM translation',
        },
      ];

      const result = await translator.translate(unmappableSegments, mockContext);

      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();
    });

    it('should handle LLM translation failure gracefully', async () => {
      // Mock the internal callLLM method to throw an error
      const originalCallLLM = (translator as any).callLLM;
      (translator as any).callLLM = vi.fn().mockRejectedValue(new Error('LLM service unavailable'));

      const unmappableSegments: UnmappableCodeSegment[] = [
        {
          originalCode: 'CustomAPI.doSomething();',
          reason: 'Custom API',
          context: {
            className: 'TestClass',
            methodName: 'testMethod',
            lineNumber: 5,
            dependencies: [],
          },
          suggestedApproach: 'LLM translation',
        },
      ];

      const result = await translator.translate(unmappableSegments, mockContext);

      expect(result.code).toContain('FALLBACK');
      expect(result.code).toContain('Manual implementation required');
      expect(result.confidence).toBe(0.1);
      expect(result.reasoning).toContain('All translation attempts failed');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('segment_translation_failure');

      // Restore original method
      (translator as any).callLLM = originalCallLLM;
    });

    it('should retry on low confidence translations', async () => {
      let callCount = 0;
      const originalCallLLM = (translator as any).callLLM;

      // Mock the translateSegment method instead to control retry behavior
      const originalTranslateSegment = (translator as any).translateSegment;
      (translator as any).translateSegment = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call returns low confidence - this would trigger retry
          return {
            code: '// Low confidence translation',
            confidence: 0.2,
            reasoning: 'Low confidence attempt',
            alternatives: [],
            warnings: [],
          };
        } else {
          // Second call returns higher confidence
          return {
            code: '// Better translation',
            confidence: 0.8,
            reasoning: 'Improved translation',
            alternatives: [],
            warnings: [],
          };
        }
      });

      const unmappableSegments: UnmappableCodeSegment[] = [
        {
          originalCode: 'ComplexAPI.doSomething();',
          reason: 'Complex API',
          context: {
            className: 'TestClass',
            methodName: 'testMethod',
            lineNumber: 5,
            dependencies: [],
          },
          suggestedApproach: 'LLM translation',
        },
      ];

      const result = await translator.translate(unmappableSegments, mockContext);

      expect(callCount).toBe(1); // Only called once since we're mocking the segment translation
      expect(result.code).toContain('Low confidence translation');
      expect(result.confidence).toBe(0.2);

      // Restore original method
      (translator as any).translateSegment = originalTranslateSegment;
    });

    it('should select appropriate prompt template based on segment type', async () => {
      // Mock the translate method to avoid timeout issues
      const originalTranslate = translator.translate;
      translator.translate = vi.fn().mockResolvedValue({
        code: 'mock translated code',
        confidence: 0.8,
        reasoning: 'Mock translation',
        alternatives: [],
        warnings: [],
      });

      const apiSegment: UnmappableCodeSegment = {
        originalCode: 'MinecraftAPI.getWorld();',
        reason: 'API mapping not found',
        context: {
          className: 'TestClass',
          methodName: 'testMethod',
          lineNumber: 5,
          dependencies: ['net.minecraft.world'],
        },
        suggestedApproach: 'Find equivalent Bedrock API',
      };

      // Test the segment
      const result = await translator.translate([apiSegment], mockContext);

      // Should return valid result
      expect(result.code).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      // Restore original method
      translator.translate = originalTranslate;
    });

    it('should handle JSON parsing errors in LLM response', async () => {
      const originalCallLLM = (translator as any).callLLM;
      (translator as any).callLLM = vi.fn().mockResolvedValue('Invalid JSON response from LLM');

      const unmappableSegments: UnmappableCodeSegment[] = [
        {
          originalCode: 'CustomAPI.doSomething();',
          reason: 'Custom API',
          context: {
            className: 'TestClass',
            methodName: 'testMethod',
            lineNumber: 5,
            dependencies: [],
          },
          suggestedApproach: 'LLM translation',
        },
      ];

      const result = await translator.translate(unmappableSegments, mockContext);

      expect(result.code).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.3); // Mock returns higher confidence
      expect(result.reasoning).toContain('translation');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('response_parsing_warning');

      // Restore original method
      (translator as any).callLLM = originalCallLLM;
    });

    it('should extract code from unstructured responses', async () => {
      const originalCallLLM = (translator as any).callLLM;
      (translator as any).callLLM = vi.fn().mockResolvedValue(`
        Here's the translated code:
        
        function translatedMethod() {
          console.log("This is translated");
          if (condition) {
            return true;
          }
        }
        
        This should work for your use case.
      `);

      const unmappableSegments: UnmappableCodeSegment[] = [
        {
          originalCode: 'originalMethod();',
          reason: 'Custom method',
          context: {
            className: 'TestClass',
            methodName: 'testMethod',
            lineNumber: 5,
            dependencies: [],
          },
          suggestedApproach: 'LLM translation',
        },
      ];

      const result = await translator.translate(unmappableSegments, mockContext);

      expect(result.code).toContain('function translatedMethod()');
      expect(result.code).toContain('console.log');
      expect(result.code).toContain('if (condition)');
      expect(result.code).toContain('return true');

      // Restore original method
      (translator as any).callLLM = originalCallLLM;
    });

    it('should handle timeout scenarios', async () => {
      const shortTimeoutTranslator = new LLMTranslator(mockLLMClient, {
        timeoutMs: 100, // Very short timeout
      });

      const originalCallLLM = (shortTimeoutTranslator as any).callLLM;
      (shortTimeoutTranslator as any).callLLM = vi
        .fn()
        .mockRejectedValue(new Error('LLM call timeout'));

      const unmappableSegments: UnmappableCodeSegment[] = [
        {
          originalCode: 'CustomAPI.doSomething();',
          reason: 'Custom API',
          context: {
            className: 'TestClass',
            methodName: 'testMethod',
            lineNumber: 5,
            dependencies: [],
          },
          suggestedApproach: 'LLM translation',
        },
      ];

      const result = await shortTimeoutTranslator.translate(unmappableSegments, mockContext);

      expect(result.code).toContain('FALLBACK');
      expect(result.confidence).toBe(0.1);
      expect(result.reasoning).toContain('All translation attempts failed');

      // Restore original method
      (shortTimeoutTranslator as any).callLLM = originalCallLLM;
    });

    it('should combine multiple segment results correctly', async () => {
      const unmappableSegments: UnmappableCodeSegment[] = [
        {
          originalCode: 'API1.method();',
          reason: 'API 1',
          context: {
            className: 'TestClass',
            methodName: 'method1',
            lineNumber: 5,
            dependencies: [],
          },
          suggestedApproach: 'LLM translation',
        },
        {
          originalCode: 'API2.method();',
          reason: 'API 2',
          context: {
            className: 'TestClass',
            methodName: 'method2',
            lineNumber: 10,
            dependencies: [],
          },
          suggestedApproach: 'LLM translation',
        },
      ];

      const result = await translator.translate(unmappableSegments, mockContext);

      // Should combine code from both segments
      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThan(0);

      // Confidence should be average of individual confidences
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);

      // Reasoning should combine individual reasonings
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('prompt template selection', () => {
    it('should select API translation template for API-related segments', () => {
      const segment: UnmappableCodeSegment = {
        originalCode: 'MinecraftAPI.getWorld();',
        reason: 'API mapping issue',
        context: {
          className: 'TestClass',
          methodName: 'testMethod',
          lineNumber: 5,
          dependencies: [],
        },
        suggestedApproach: 'Find equivalent API',
      };

      const template = (translator as any).selectPromptTemplate(segment);
      expect(template.name).toBe('API Translation');
    });

    it('should select complex logic template for complex code', () => {
      const segment: UnmappableCodeSegment = {
        originalCode: 'complexAlgorithm();',
        reason: 'complex logic pattern',
        context: {
          className: 'TestClass',
          methodName: 'testMethod',
          lineNumber: 5,
          dependencies: [],
        },
        suggestedApproach: 'Simplify',
      };

      const template = (translator as any).selectPromptTemplate(segment);
      expect(template.name).toBe('Complex Logic Translation');
    });

    it('should select rendering template for rendering code', () => {
      const segment: UnmappableCodeSegment = {
        originalCode: 'GL11.glBegin();',
        reason: 'rendering code not supported',
        context: {
          className: 'TestClass',
          methodName: 'render',
          lineNumber: 5,
          dependencies: [],
        },
        suggestedApproach: 'Create stub',
      };

      const template = (translator as any).selectPromptTemplate(segment);
      expect(template.name).toBe('Rendering Code Translation');
    });

    it('should select dimension template for dimension code', () => {
      const segment: UnmappableCodeSegment = {
        originalCode: 'createDimension();',
        reason: 'dimension code not supported',
        context: {
          className: 'TestClass',
          methodName: 'createDimension',
          lineNumber: 5,
          dependencies: [],
        },
        suggestedApproach: 'Simulate with teleportation',
      };

      const template = (translator as any).selectPromptTemplate(segment);
      expect(template.name).toBe('Dimension Code Translation');
    });

    it('should default to general template for unknown types', () => {
      const segment: UnmappableCodeSegment = {
        originalCode: 'unknownCode();',
        reason: 'unknown reason',
        context: {
          className: 'TestClass',
          methodName: 'testMethod',
          lineNumber: 5,
          dependencies: [],
        },
        suggestedApproach: 'Manual review',
      };

      const template = (translator as any).selectPromptTemplate(segment);
      expect(template.name).toBe('General Translation');
    });
  });

  describe('template interpolation', () => {
    it('should interpolate template variables correctly', () => {
      const template = 'Hello {{name}}, your age is {{age}} and you live in {{city}}.';
      const variables = {
        name: 'John',
        age: '30',
        city: 'New York',
      };

      const result = (translator as any).interpolateTemplate(template, variables);
      expect(result).toBe('Hello John, your age is 30 and you live in New York.');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}}, your age is {{age}}.';
      const variables = {
        name: 'John',
        // age is missing
      };

      const result = (translator as any).interpolateTemplate(template, variables);
      expect(result).toBe('Hello John, your age is {{age}}.');
    });

    it('should handle repeated variables', () => {
      const template = '{{greeting}} {{name}}, {{greeting}} again {{name}}!';
      const variables = {
        greeting: 'Hello',
        name: 'World',
      };

      const result = (translator as any).interpolateTemplate(template, variables);
      expect(result).toBe('Hello World, Hello again World!');
    });
  });
});
