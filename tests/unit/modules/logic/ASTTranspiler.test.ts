/**
 * Unit tests for ASTTranspiler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ASTTranspiler } from '../../../../src/modules/logic/ASTTranspiler.js';
import {
  MMIRRepresentation,
  TranslationContext,
  ASTNode,
  ASTTranspilationResult,
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

describe('ASTTranspiler', () => {
  let transpiler: ASTTranspiler;
  let mockContext: TranslationContext;

  beforeEach(() => {
    transpiler = new ASTTranspiler();

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

  describe('transpile', () => {
    it('should transpile simple class declaration', async () => {
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
          originalLinesOfCode: 3,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 3,
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
          linesOfCode: 3,
          nestingDepth: 1,
        },
      };

      const result = await transpiler.transpile(mockMMIR, mockContext);

      expect(result.code).toContain('class TestClass');
      expect(result.code).toContain('constructor()');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.unmappableCode).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should transpile method declarations', async () => {
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'MethodDeclaration',
            value: 'testMethod',
            children: [],
            position: { line: 2, column: 3, offset: 20 },
            metadata: { javaType: 'method', complexity: 1, mappable: true },
          },
        ],
        metadata: {
          originalLinesOfCode: 3,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 3,
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
          linesOfCode: 3,
          nestingDepth: 1,
        },
      };

      const result = await transpiler.transpile(mockMMIR, mockContext);

      expect(result.code).toContain('testMethod()');
      expect(result.code).toContain('// Method implementation');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should transpile control flow structures', async () => {
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'IfStatement',
            value: 'if',
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'control_flow', complexity: 1, mappable: true },
          },
          {
            type: 'ForLoop',
            value: 'for',
            children: [],
            position: { line: 2, column: 1, offset: 20 },
            metadata: { javaType: 'control_flow', complexity: 2, mappable: true },
          },
          {
            type: 'WhileLoop',
            value: 'while',
            children: [],
            position: { line: 3, column: 1, offset: 40 },
            metadata: { javaType: 'control_flow', complexity: 2, mappable: true },
          },
        ],
        metadata: {
          originalLinesOfCode: 10,
          complexity: {
            cyclomaticComplexity: 5,
            cognitiveComplexity: 5,
            linesOfCode: 10,
            nestingDepth: 2,
          },
          imports: [],
          classes: [],
          methods: [],
        },
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 5,
          cognitiveComplexity: 5,
          linesOfCode: 10,
          nestingDepth: 2,
        },
      };

      const result = await transpiler.transpile(mockMMIR, mockContext);

      expect(result.code).toContain('if (condition)');
      expect(result.code).toContain('for (let i = 0; i < length; i++)');
      expect(result.code).toContain('while (condition)');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle method calls', async () => {
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'MethodCall',
            value: 'doSomething',
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'method_call', complexity: 1, mappable: true },
          },
        ],
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

      const result = await transpiler.transpile(mockMMIR, mockContext);

      expect(result.code).toContain('doSomething();');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should handle assignments and field declarations', async () => {
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'Assignment',
            value: 'variable',
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'assignment', complexity: 1, mappable: true },
          },
          {
            type: 'FieldDeclaration',
            value: 'field',
            children: [],
            position: { line: 2, column: 1, offset: 20 },
            metadata: { javaType: 'field', complexity: 1, mappable: true },
          },
        ],
        metadata: {
          originalLinesOfCode: 2,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 2,
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
          linesOfCode: 2,
          nestingDepth: 0,
        },
      };

      const result = await transpiler.transpile(mockMMIR, mockContext);

      expect(result.code).toContain('let variable = value;');
      expect(result.code).toContain('field = null;');
    });

    it('should preserve comments', async () => {
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'Comment',
            value: '// This is a comment',
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'comment', complexity: 0, mappable: true },
          },
        ],
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

      const result = await transpiler.transpile(mockMMIR, mockContext);

      expect(result.code).toContain('// This is a comment');
      expect(result.confidence).toBe(1.0);
    });

    it('should handle unmappable nodes', async () => {
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'UnknownNode',
            value: 'unknownCode',
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'unknown', complexity: 1, mappable: false },
          },
        ],
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

      const result = await transpiler.transpile(mockMMIR, mockContext);

      expect(result.unmappableCode).toHaveLength(1);
      expect(result.unmappableCode[0].originalCode).toContain('unknownCode');
      expect(result.unmappableCode[0].reason).toContain('No transpilation rule found');
      expect(result.unmappableCode[0].suggestedApproach).toBe('Use LLM-based semantic translation');
    });

    it('should handle nested AST structures', async () => {
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'ClassDeclaration',
            value: 'TestClass',
            children: [
              {
                type: 'MethodDeclaration',
                value: 'testMethod',
                children: [
                  {
                    type: 'IfStatement',
                    value: 'if',
                    children: [
                      {
                        type: 'MethodCall',
                        value: 'doSomething',
                        children: [],
                        position: { line: 4, column: 5, offset: 80 },
                        metadata: { javaType: 'method_call', complexity: 1, mappable: true },
                      },
                    ],
                    position: { line: 3, column: 3, offset: 60 },
                    metadata: { javaType: 'control_flow', complexity: 1, mappable: true },
                  },
                ],
                position: { line: 2, column: 2, offset: 20 },
                metadata: { javaType: 'method', complexity: 2, mappable: true },
              },
            ],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'class', complexity: 3, mappable: true },
          },
        ],
        metadata: {
          originalLinesOfCode: 8,
          complexity: {
            cyclomaticComplexity: 3,
            cognitiveComplexity: 4,
            linesOfCode: 8,
            nestingDepth: 3,
          },
          imports: [],
          classes: [],
          methods: [],
        },
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 3,
          cognitiveComplexity: 4,
          linesOfCode: 8,
          nestingDepth: 3,
        },
      };

      const result = await transpiler.transpile(mockMMIR, mockContext);

      expect(result.code).toContain('class TestClass');
      expect(result.code).toContain('testMethod()');
      expect(result.code).toContain('if (condition)');
      expect(result.code).toContain('doSomething();');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should generate warnings for low confidence transpilation', async () => {
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'MethodCall',
            value: 'complexMethod',
            children: Array(15)
              .fill(null)
              .map((_, i) => ({
                type: 'GenericStatement',
                value: `statement${i}`,
                children: [],
                position: { line: i + 2, column: 1, offset: i * 20 },
                metadata: { javaType: 'generic', complexity: 1, mappable: false },
              })),
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'method_call', complexity: 1, mappable: true },
          },
        ],
        metadata: {
          originalLinesOfCode: 16,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 16,
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
          linesOfCode: 16,
          nestingDepth: 1,
        },
      };

      const result = await transpiler.transpile(mockMMIR, mockContext);

      expect(result.warnings.length).toBeGreaterThan(0);
      const complexityWarning = result.warnings.find((w) => w.type === 'complex_node_structure');
      expect(complexityWarning).toBeDefined();
      expect(complexityWarning?.message).toContain('many children');
    });

    it('should handle transpilation errors gracefully', async () => {
      // Create a mock MMIR that would cause an error during transpilation
      const mockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'ClassDeclaration',
            value: null, // This might cause an error in transpilation
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'class', complexity: 1, mappable: true },
          },
        ],
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

      const result = await transpiler.transpile(mockMMIR, mockContext);

      // Should handle the error gracefully and still return a result
      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it('should calculate confidence based on transpilation success', async () => {
      const highConfidenceMockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'Comment',
            value: '// Simple comment',
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'comment', complexity: 0, mappable: true },
          },
        ],
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

      const lowConfidenceMockMMIR: MMIRRepresentation = {
        ast: [
          {
            type: 'UnknownComplexNode',
            value: 'complex code',
            children: [],
            position: { line: 1, column: 1, offset: 0 },
            metadata: { javaType: 'unknown', complexity: 10, mappable: false },
          },
        ],
        metadata: {
          originalLinesOfCode: 1,
          complexity: {
            cyclomaticComplexity: 10,
            cognitiveComplexity: 10,
            linesOfCode: 1,
            nestingDepth: 0,
          },
          imports: [],
          classes: [],
          methods: [],
        },
        dependencies: [],
        complexity: {
          cyclomaticComplexity: 10,
          cognitiveComplexity: 10,
          linesOfCode: 1,
          nestingDepth: 0,
        },
      };

      const highConfidenceResult = await transpiler.transpile(highConfidenceMockMMIR, mockContext);
      const lowConfidenceResult = await transpiler.transpile(lowConfidenceMockMMIR, mockContext);

      expect(highConfidenceResult.confidence).toBeGreaterThan(lowConfidenceResult.confidence);
      expect(highConfidenceResult.confidence).toBeGreaterThan(0.8);
    });

    it('should handle empty AST', async () => {
      const emptyMMIR: MMIRRepresentation = {
        ast: [],
        metadata: {
          originalLinesOfCode: 0,
          complexity: {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 0,
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
          linesOfCode: 0,
          nestingDepth: 0,
        },
      };

      const result = await transpiler.transpile(emptyMMIR, mockContext);

      expect(result.code).toBe('');
      expect(result.unmappableCode).toHaveLength(0);
      expect(result.confidence).toBe(0); // No nodes processed
      expect(result.warnings).toHaveLength(0);
    });
  });
});
