import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogicTranslationEngine } from '../../../../src/modules/logic/LogicTranslationEngine';
import { JavaParser } from '../../../../src/modules/logic/JavaParser';
import { MMIRGenerator } from '../../../../src/modules/logic/MMIRGenerator';
import { ASTTranspiler } from '../../../../src/modules/logic/ASTTranspiler';
import { APIMapping } from '../../../../src/modules/logic/APIMapping';
import { LLMTranslationService } from '../../../../src/modules/logic/LLMTranslationService';
import { ProgramStateAlignmentValidator } from '../../../../src/modules/logic/ProgramStateAlignmentValidator';
import { JavaScriptGenerator } from '../../../../src/modules/logic/JavaScriptGenerator';

// Mock all dependencies
vi.mock('../../../../src/modules/logic/JavaParser');
vi.mock('../../../../src/modules/logic/MMIRGenerator');
vi.mock('../../../../src/modules/logic/ASTTranspiler');
vi.mock('../../../../src/modules/logic/APIMapping');
vi.mock('../../../../src/modules/logic/LLMTranslationService');
vi.mock('../../../../src/modules/logic/ProgramStateAlignmentValidator');
vi.mock('../../../../src/modules/logic/JavaScriptGenerator');
vi.mock('../../../../src/utils/logger');

describe('LogicTranslationEngine', () => {
  let engine: LogicTranslationEngine;
  let mockJavaParser: any;
  let mockMMIRGenerator: any;
  let mockASTTranspiler: any;
  let mockAPIMapping: any;
  let mockLLMTranslationService: any;
  let mockProgramStateAlignmentValidator: any;
  let mockJavaScriptGenerator: any;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Setup mock implementations
    mockJavaParser = {
      parse: vi.fn().mockResolvedValue({ type: 'JavaAST' })
    };
    (JavaParser as any).mockImplementation(() => mockJavaParser);

    mockMMIRGenerator = {
      generate: vi.fn().mockResolvedValue({
        nodes: [],
        relationships: [],
        metadata: { modId: 'test-mod', modLoader: 'forge' }
      })
    };
    (MMIRGenerator as any).mockImplementation(() => mockMMIRGenerator);

    mockASTTranspiler = {
      transpile: vi.fn().mockResolvedValue({
        jsASTs: [{ type: 'JSAst' }],
        unmappableNodes: []
      })
    };
    (ASTTranspiler as any).mockImplementation(() => mockASTTranspiler);

    mockAPIMapping = {
      loadMappings: vi.fn().mockResolvedValue([{ javaSignature: 'test', bedrockEquivalent: 'test' }])
    };
    (APIMapping as any).mockImplementation(() => mockAPIMapping);

    mockLLMTranslationService = {
      translate: vi.fn().mockResolvedValue([]),
      refineWithFeedback: vi.fn().mockResolvedValue([])
    };
    (LLMTranslationService as any).mockImplementation(() => mockLLMTranslationService);

    mockProgramStateAlignmentValidator = {
      validate: vi.fn().mockResolvedValue({
        allValid: true,
        invalidTranslations: [],
        notes: []
      })
    };
    (ProgramStateAlignmentValidator as any).mockImplementation(() => mockProgramStateAlignmentValidator);

    mockJavaScriptGenerator = {
      generate: vi.fn().mockResolvedValue([
        {
          path: 'output.js',
          content: 'console.log("Hello World");'
        }
      ])
    };
    (JavaScriptGenerator as any).mockImplementation(() => mockJavaScriptGenerator);

    // Create instance of LogicTranslationEngine
    engine = new LogicTranslationEngine();
  });

  describe('translate', () => {
    it('should successfully translate Java source files to JavaScript', async () => {
      // Arrange
      const input = {
        javaSourceFiles: [
          {
            path: 'Test.java',
            content: 'public class Test {}',
            modLoader: 'forge' as const
          }
        ]
      };

      // Act
      const result = await engine.translate(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.javascriptFiles).toHaveLength(1);
      expect(result.javascriptFiles[0].path).toBe('output.js');
      expect(result.stubFunctions).toHaveLength(0);
      expect(result.conversionNotes).toHaveLength(0);

      // Verify all components were called
      expect(mockJavaParser.parse).toHaveBeenCalledTimes(1);
      expect(mockMMIRGenerator.generate).toHaveBeenCalledTimes(1);
      expect(mockAPIMapping.loadMappings).toHaveBeenCalledTimes(1);
      expect(mockASTTranspiler.transpile).toHaveBeenCalledTimes(1);
      expect(mockLLMTranslationService.translate).toHaveBeenCalledTimes(1);
      expect(mockJavaScriptGenerator.generate).toHaveBeenCalledTimes(1);
      expect(mockProgramStateAlignmentValidator.validate).toHaveBeenCalledTimes(1);
    });

    it('should handle validation failures and refine translations', async () => {
      // Arrange
      const input = {
        javaSourceFiles: [
          {
            path: 'Test.java',
            content: 'public class Test {}',
            modLoader: 'forge' as const
          }
        ]
      };

      // Mock validation failure
      mockProgramStateAlignmentValidator.validate.mockResolvedValue({
        allValid: false,
        invalidTranslations: [
          { id: 'test', originalCode: 'test', translatedCode: 'test' }
        ],
        notes: [
          { type: 'warning', message: 'Validation failed for some translations' }
        ]
      });

      // Mock refined translations
      mockLLMTranslationService.refineWithFeedback.mockResolvedValue([
        { id: 'test', refinedCode: 'refined test' }
      ]);

      // Act
      const result = await engine.translate(input);

      // Assert
      expect(result).toBeDefined();
      expect(mockLLMTranslationService.refineWithFeedback).toHaveBeenCalledTimes(1);
      expect(mockJavaScriptGenerator.generate).toHaveBeenCalledTimes(2); // Called twice due to refinement
      expect(result.conversionNotes).toHaveLength(1);
      expect(result.conversionNotes[0].type).toBe('warning');
    });

    it('should handle errors during translation', async () => {
      // Arrange
      const input = {
        javaSourceFiles: [
          {
            path: 'Test.java',
            content: 'public class Test {}',
            modLoader: 'forge' as const
          }
        ]
      };

      // Mock an error
      mockJavaParser.parse.mockRejectedValue(new Error('Parsing failed'));

      // Act
      const result = await engine.translate(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.javascriptFiles).toHaveLength(0);
      expect(result.conversionNotes).toHaveLength(1);
      expect(result.conversionNotes[0].type).toBe('error');
      expect(result.conversionNotes[0].message).toContain('Logic translation failed');
    });

    it('should collect stub functions from LLM translations', async () => {
      // Arrange
      const input = {
        javaSourceFiles: [
          {
            path: 'Test.java',
            content: 'public class Test {}',
            modLoader: 'forge' as const
          }
        ]
      };

      // Mock LLM translations with stubs
      mockLLMTranslationService.translate.mockResolvedValue([
        {
          isStub: true,
          name: 'testFunction',
          originalCode: 'void test() {}',
          stubCode: 'function test() { console.warn("Not implemented"); }',
          stubReason: 'No direct mapping available',
          alternatives: ['Use alternative approach']
        }
      ]);

      // Act
      const result = await engine.translate(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.stubFunctions).toHaveLength(1);
      expect(result.stubFunctions[0].name).toBe('testFunction');
      expect(result.stubFunctions[0].reason).toBe('No direct mapping available');
    });

    it('should use provided MMIR context and API mappings if available', async () => {
      // Arrange
      const mmirContext = {
        nodes: [{ id: 'test', type: 'test', sourceLocation: { file: '', startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 }, properties: {}, children: [] }],
        relationships: [],
        metadata: { modId: 'test', modName: 'test', modVersion: '1.0', modLoader: 'forge' as const, minecraftVersion: '1.16' }
      };
      
      const apiMappings = [
        { javaSignature: 'custom', bedrockEquivalent: 'custom' }
      ];
      
      const input = {
        javaSourceFiles: [
          {
            path: 'Test.java',
            content: 'public class Test {}',
            modLoader: 'forge' as const
          }
        ],
        mmirContext,
        apiMappingDictionary: apiMappings
      };

      // Act
      const result = await engine.translate(input);

      // Assert
      expect(result).toBeDefined();
      
      // Verify MMIR generator was not called since we provided the context
      expect(mockMMIRGenerator.generate).not.toHaveBeenCalled();
      
      // Verify API mappings loader was not called since we provided the mappings
      expect(mockAPIMapping.loadMappings).not.toHaveBeenCalled();
      
      // Verify the transpiler was called with our provided context and mappings
      expect(mockASTTranspiler.transpile).toHaveBeenCalledWith(mmirContext, apiMappings);
    });
  });
});