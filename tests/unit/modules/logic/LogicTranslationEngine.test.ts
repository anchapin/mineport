/**
 * Unit tests for LogicTranslationEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogicTranslationEngine } from '../../../../src/modules/logic/LogicTranslationEngine.js';
import {
  TranslationContext,
  MMIRRepresentation,
  ASTTranspilationResult,
  LLMTranslationResult,
  ValidationResult,
} from '../../../../src/types/logic-translation.js';

// Mock dependencies
vi.mock('../../../../src/modules/logic/ASTTranspiler.js');
vi.mock('../../../../src/modules/logic/LLMTranslator.js');
vi.mock('../../../../src/modules/logic/ProgramStateValidator.js');
vi.mock('../../../../src/modules/logic/MMIRParser.js');
vi.mock('../../../../src/utils/logger.js', async () => {
  const actual = await vi.importActual('../../../../src/utils/logger.js');
  return {
    ...(actual as any),
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

describe('LogicTranslationEngine', () => {
  let engine: LogicTranslationEngine;
  let mockASTTranspiler: any;
  let mockLLMTranslator: any;
  let mockProgramStateValidator: any;
  let mockMMIRParser: any;
  let mockContext: TranslationContext;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockASTTranspiler = {
      transpile: vi.fn(),
    } as any;
    mockLLMTranslator = {
      translate: vi.fn(),
    } as any;
    mockProgramStateValidator = {
      validate: vi.fn(),
    } as any;
    mockMMIRParser = {
      parse: vi.fn(),
    } as any;

    // Create engine instance
    engine = new LogicTranslationEngine(
      mockASTTranspiler as any,
      mockLLMTranslator as any,
      mockProgramStateValidator as any,
      mockMMIRParser as any
    );

    // Setup mock context
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
        description: 'Default compromise strategy',
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

  describe('translateJavaCode', () => {
    it('should successfully translate simple Java code', async () => {
      const javaCode = `
        public class TestClass {
          public void testMethod() {
            System.out.println("Hello World");
          }
        }
      `;

      // Mock MMIR parsing
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'ClassDeclaration',
            value: 'TestClass',
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'class', complexity: 1, mappable: true },
          },
        ],
        metadata: {
          originalLinesOfCode: 6,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 6,
            nestingDepth: 1,
          },
          imports: [],
          classes: [],
          methods: [],
        },
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 1,
          linesOfCode: 6,
          nestingDepth: 1,
        },
      };

      mockMMIRParser.parse.mockResolvedValue(mockMMIR);

      // Mock AST transpilation
      const mockASTResult: ASTTranspilationResult = {
        code: 'class TestClass {\n  testMethod() {\n    console.log("Hello World");\n  }\n}',
        unmappableCode: [],
        mappedAPIs: [],
        confidence: 0.9,
        warnings: [],
      };

      mockASTTranspiler.transpile.mockResolvedValue(mockASTResult);

      // Mock LLM translation (no unmappable code)
      const mockLLMResult: LLMTranslationResult = {
        code: '',
        confidence: 1.0,
        reasoning: 'No unmappable code segments',
        alternatives: [],
        warnings: [],
      };

      mockLLMTranslator.translate.mockResolvedValue(mockLLMResult);

      // Mock validation
      const mockValidation: ValidationResult = {
        isEquivalent: true,
        confidence: 0.95,
        differences: [],
        recommendations: [],
      };

      mockProgramStateValidator.validate.mockResolvedValue(mockValidation);

      // Execute translation
      const result = await engine.translateJavaCode(javaCode, mockContext);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.code).toContain('class TestClass');
      expect(result.code).toContain('console.log');
      expect(result.metadata.originalLinesOfCode).toBe(6);
      expect(result.metadata.confidenceScore).toBeGreaterThan(0.8);
      expect(result.compromises).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      // Verify method calls
      expect(mockMMIRParser.parse).toHaveBeenCalledWith(javaCode);
      expect(mockASTTranspiler.transpile).toHaveBeenCalledWith(mockMMIR, mockContext);
      // LLM translator should not be called when there's no unmappable code
      expect(mockLLMTranslator.translate).not.toHaveBeenCalled();
      expect(mockProgramStateValidator.validate).toHaveBeenCalledWith(
        javaCode,
        mockASTResult.code,
        mockContext
      );
    });

    it('should handle unmappable code with LLM translation', async () => {
      const javaCode = `
        public class ComplexClass {
          public void complexMethod() {
            // Complex unmappable code
            CustomAPI.doSomethingComplex();
          }
        }
      `;

      // Mock MMIR parsing
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'ClassDeclaration',
            value: 'ComplexClass',
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'class', complexity: 2, mappable: false },
          },
        ],
        metadata: {
          originalLinesOfCode: 6,
          complexity: {
            cyclomaticComplexity: 2,
            cognitiveComplexity: 2,
            linesOfCode: 6,
            nestingDepth: 1,
          },
          imports: [],
          classes: [],
          methods: [],
        },
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 2,
          cognitiveComplexity: 2,
          linesOfCode: 6,
          nestingDepth: 1,
        },
      };

      mockMMIRParser.parse.mockResolvedValue(mockMMIR);

      // Mock AST transpilation with unmappable code
      const mockASTResult: ASTTranspilationResult = {
        code: 'class ComplexClass {\n  // Partial transpilation\n}',
        unmappableCode: [
          {
            originalCode: 'CustomAPI.doSomethingComplex();',
            reason: 'Custom API not mappable',
            context: {
              className: 'ComplexClass',
              methodName: 'complexMethod',
              lineNumber: 4,
              dependencies: [],
            },
            suggestedApproach: 'Use LLM translation',
          },
        ],
        mappedAPIs: [],
        confidence: 0.6,
        warnings: [],
      };

      mockASTTranspiler.transpile.mockResolvedValue(mockASTResult);

      // Mock LLM translation
      const mockLLMResult: LLMTranslationResult = {
        code: '// LLM-translated complex method\nfunction complexMethod() {\n  // Equivalent Bedrock implementation\n}',
        confidence: 0.7,
        reasoning: 'Translated using semantic understanding',
        alternatives: [],
        warnings: [],
      };

      mockLLMTranslator.translate.mockResolvedValue(mockLLMResult);

      // Mock validation
      const mockValidation: ValidationResult = {
        isEquivalent: true,
        confidence: 0.8,
        differences: [],
        recommendations: [],
      };

      mockProgramStateValidator.validate.mockResolvedValue(mockValidation);

      // Execute translation
      const result = await engine.translateJavaCode(javaCode, mockContext);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.code).toContain('class ComplexClass');
      expect(result.code).toContain('LLM-translated');
      expect(result.compromises).toHaveLength(1);
      expect(result.compromises[0].originalFeature.type).toBe('unmappable_code');
      expect(result.metadata.llmTranslationPercentage).toBeGreaterThan(0);

      // Verify LLM was called with unmappable code
      expect(mockLLMTranslator.translate).toHaveBeenCalledWith(
        mockASTResult.unmappableCode,
        mockContext
      );
    });

    it('should handle validation failures and attempt refinement', async () => {
      const javaCode = 'public class TestClass { }';

      // Mock MMIR parsing
      const mockMMIR: MMIRRepresentation = {
        ast: [],
        metadata: {
          originalLinesOfCode: 1,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 1,
            nestingDepth: 0,
          },
          imports: [],
          classes: [],
          methods: [],
        },
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 1,
          linesOfCode: 1,
          nestingDepth: 0,
        },
      };

      mockMMIRParser.parse.mockResolvedValue(mockMMIR);

      // Mock AST transpilation
      const mockASTResult: ASTTranspilationResult = {
        code: 'class TestClass { }',
        unmappableCode: [],
        mappedAPIs: [],
        confidence: 0.8,
        warnings: [],
      };

      mockASTTranspiler.transpile.mockResolvedValue(mockASTResult);

      // Mock LLM translation
      const mockLLMResult: LLMTranslationResult = {
        code: '',
        confidence: 1.0,
        reasoning: 'No unmappable code',
        alternatives: [],
        warnings: [],
      };

      mockLLMTranslator.translate.mockResolvedValue(mockLLMResult);

      // Mock validation failure
      const mockValidation: ValidationResult = {
        isEquivalent: false,
        confidence: 0.5, // Below threshold
        differences: [
          {
            type: 'behavior',
            description: 'Behavioral difference detected',
            severity: 'medium',
            location: { line: 1, column: 1, offset: 0 },
            suggestion: 'Review implementation',
          },
        ],
        recommendations: ['Manual review required'],
      };

      mockProgramStateValidator.validate.mockResolvedValue(mockValidation);

      // Execute translation
      const result = await engine.translateJavaCode(javaCode, mockContext);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('validation_behavior');
      expect(result.metadata.confidenceScore).toBeLessThan(0.8);
    });

    it('should handle translation errors gracefully', async () => {
      const javaCode = 'invalid java code';

      // Mock MMIR parsing failure
      mockMMIRParser.parse.mockRejectedValue(new Error('Parse error'));

      // Execute translation
      const result = await engine.translateJavaCode(javaCode, mockContext);

      // Verify error handling
      expect(result.success).toBe(false);
      expect(result.code).toBe('');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('translation_failure');
      expect(result.errors[0].message).toContain('Parse error');
      expect(result.errors[0].recoverable).toBe(false);
    });

    it('should respect configuration options', async () => {
      const customOptions = {
        maxRefinementIterations: 5,
        confidenceThreshold: 0.9,
        enableParallelProcessing: false,
        timeoutMs: 120000,
      };

      const customEngine = new LogicTranslationEngine(
        mockASTTranspiler as any,
        mockLLMTranslator as any,
        mockProgramStateValidator as any,
        mockMMIRParser as any,
        customOptions
      );

      const javaCode = 'public class TestClass { }';

      // Mock successful flow
      mockMMIRParser.parse.mockResolvedValue({
        ast: [],
        metadata: {
          originalLinesOfCode: 1,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 1,
            nestingDepth: 0,
          },
          imports: [],
          classes: [],
          methods: [],
        },
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 1,
          linesOfCode: 1,
          nestingDepth: 0,
        },
      });

      mockASTTranspiler.transpile.mockResolvedValue({
        code: 'class TestClass { }',
        unmappableCode: [],
        mappedAPIs: [],
        confidence: 0.95,
        warnings: [],
      });

      mockLLMTranslator.translate.mockResolvedValue({
        code: '',
        confidence: 1.0,
        reasoning: 'No unmappable code',
        alternatives: [],
        warnings: [],
      });

      mockProgramStateValidator.validate.mockResolvedValue({
        isEquivalent: true,
        confidence: 0.95,
        differences: [],
        recommendations: [],
      });

      const result = await customEngine.translateJavaCode(javaCode, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata.confidenceScore).toBeGreaterThan(0.9);
    });
  });

  describe('parseToMMIR', () => {
    it('should delegate to MMIRParser', async () => {
      const javaCode = 'public class Test { }';
      const mockMMIR: MMIRRepresentation = {
        ast: [],
        metadata: {
          originalLinesOfCode: 1,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 1,
            nestingDepth: 0,
          },
          imports: [],
          classes: [],
          methods: [],
        },
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 1,
          linesOfCode: 1,
          nestingDepth: 0,
        },
      };

      mockMMIRParser.parse.mockResolvedValue(mockMMIR);

      const result = await engine.parseToMMIR(javaCode);

      expect(result).toBe(mockMMIR);
      expect(mockMMIRParser.parse).toHaveBeenCalledWith(javaCode);
    });
  });

  describe('transpileAST', () => {
    it('should delegate to ASTTranspiler', async () => {
      const mockMMIR: MMIRRepresentation = {
        ast: [],
        metadata: {
          originalLinesOfCode: 1,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 1,
            nestingDepth: 0,
          },
          imports: [],
          classes: [],
          methods: [],
        },
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 1,
          linesOfCode: 1,
          nestingDepth: 0,
        },
      };

      const mockResult: ASTTranspilationResult = {
        code: 'transpiled code',
        unmappableCode: [],
        mappedAPIs: [],
        confidence: 0.9,
        warnings: [],
      };

      mockASTTranspiler.transpile.mockResolvedValue(mockResult);

      const result = await engine.transpileAST(mockMMIR, mockContext);

      expect(result).toBe(mockResult);
      expect(mockASTTranspiler.transpile).toHaveBeenCalledWith(mockMMIR, mockContext);
    });
  });

  describe('translateWithLLM', () => {
    it('should handle empty unmappable code', async () => {
      const result = await engine.translateWithLLM([], mockContext);

      expect(result.code).toBe('');
      expect(result.confidence).toBe(1.0);
      expect(result.reasoning).toBe('No unmappable code segments');
      expect(mockLLMTranslator.translate).not.toHaveBeenCalled();
    });

    it('should delegate to LLMTranslator for unmappable code', async () => {
      const unmappableCode = [
        {
          originalCode: 'CustomAPI.call()',
          reason: 'Custom API',
          context: { className: 'Test', methodName: 'test', lineNumber: 1, dependencies: [] },
          suggestedApproach: 'LLM translation',
        },
      ];

      const mockResult: LLMTranslationResult = {
        code: 'translated code',
        confidence: 0.8,
        reasoning: 'LLM translation',
        alternatives: [],
        warnings: [],
      };

      mockLLMTranslator.translate.mockResolvedValue(mockResult);

      const result = await engine.translateWithLLM(unmappableCode, mockContext);

      expect(result).toBe(mockResult);
      expect(mockLLMTranslator.translate).toHaveBeenCalledWith(unmappableCode, mockContext);
    });
  });

  describe('validateTranslation', () => {
    it('should delegate to ProgramStateValidator', async () => {
      const originalCode = 'original java code';
      const translatedCode = 'translated js code';

      const mockResult: ValidationResult = {
        isEquivalent: true,
        confidence: 0.9,
        differences: [],
        recommendations: [],
      };

      mockProgramStateValidator.validate.mockResolvedValue(mockResult);

      const result = await engine.validateTranslation(originalCode, translatedCode, mockContext);

      expect(result).toBe(mockResult);
      expect(mockProgramStateValidator.validate).toHaveBeenCalledWith(
        originalCode,
        translatedCode,
        mockContext
      );
    });
  });
});
