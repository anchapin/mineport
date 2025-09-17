/**
 * JavaScriptGenerator.test.ts
 *
 * Unit tests for the JavaScript Generator module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  JavaScriptGenerator,
  CodeGenerationOptions,
} from '../../../../src/modules/logic/JavaScriptGenerator.js';
import {
  JavaScriptASTNode,
  TranspilationResult,
} from '../../../../src/modules/logic/ASTTranspiler.js';
import { LLMTranslationResult } from '../../../../src/modules/logic/LLMTranslationService.js';
import { MMIRNode, MMIRNodeType } from '../../../../src/modules/logic/MMIRGenerator.js';

describe('JavaScriptGenerator', () => {
  let generator: JavaScriptGenerator;
  let defaultOptions: CodeGenerationOptions;

  beforeEach(() => {
    defaultOptions = {
      includeSourceMaps: false,
      minify: false,
      includeComments: true,
      indent: 2,
      useSemicolons: true,
      useSingleQuotes: false,
    };
    generator = new JavaScriptGenerator(defaultOptions);
  });

  describe('generateFromAST', () => {
    it('should generate JavaScript code from AST', () => {
      // Create a simple AST
      const ast: JavaScriptASTNode[] = [
        {
          type: 'Program',
          sourceType: 'module',
          body: [
            {
              type: 'VariableDeclaration',
              kind: 'const',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: {
                    type: 'Identifier',
                    name: 'MOD_ID',
                  },
                  init: {
                    type: 'Literal',
                    value: 'test-mod',
                  },
                },
              ],
            },
            {
              type: 'ImportDeclaration',
              specifiers: [
                {
                  type: 'ImportDefaultSpecifier',
                  local: {
                    type: 'Identifier',
                    name: 'system',
                  },
                },
              ],
              source: {
                type: 'Literal',
                value: '@minecraft/server',
              },
            },
          ],
        },
      ];

      const code = generator.generateFromAST(ast);

      // Verify the generated code
      expect(code).toContain('const MOD_ID = "test-mod";');
      expect(code).toContain('import system from "@minecraft/server";');
    });

    it('should respect code generation options', () => {
      // Create a simple AST
      const ast: JavaScriptASTNode[] = [
        {
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: {
                type: 'Identifier',
                name: 'greeting',
              },
              init: {
                type: 'Literal',
                value: 'Hello, world!',
              },
            },
          ],
        },
      ];

      // Generate with single quotes
      const options: CodeGenerationOptions = {
        useSingleQuotes: true,
        useSemicolons: false,
      };

      const code = generator.generateFromAST(ast, options);

      // Verify the generated code
      expect(code).toContain("const greeting = 'Hello, world!'");
      expect(code).not.toContain(';');
    });
  });

  describe('generateFromTranspilationResult', () => {
    it('should generate JavaScript from transpilation result', () => {
      // Create a transpilation result
      const transpilationResult: TranspilationResult = {
        jsAst: [
          {
            type: 'FunctionDeclaration',
            id: {
              type: 'Identifier',
              name: 'initializeMod',
            },
            params: [],
            body: [
              {
                type: 'ExpressionStatement',
                expression: {
                  type: 'CallExpression',
                  callee: {
                    type: 'MemberExpression',
                    object: {
                      type: 'Identifier',
                      name: 'console',
                    },
                    property: {
                      type: 'Identifier',
                      name: 'log',
                    },
                    computed: false,
                  },
                  arguments: [
                    {
                      type: 'Literal',
                      value: 'Initializing mod',
                    },
                  ],
                },
              },
            ],
          },
        ],
        metadata: {
          modId: 'test-mod',
          modName: 'Test Mod',
          modVersion: '1.0.0',
          originalModLoader: 'forge',
        },
        unmappableNodes: [],
        warnings: [],
      };

      const result = generator.generateFromTranspilationResult(transpilationResult);

      // Verify the result
      expect(result.code).toContain('function initializeMod()');
      expect(result.code).toContain('console.log("Initializing mod");');
      expect(result.metadata.modId).toBe('test-mod');
      expect(result.metadata.stats.functionCount).toBeGreaterThan(0);
    });
  });

  describe('integrateASTAndLLMCode', () => {
    it('should integrate AST and LLM code', () => {
      // Create AST code
      const astCode = `
import { system } from "@minecraft/server";

const MOD_ID = "test-mod";

function initializeMod() {
  console.log("Initializing mod");
}

initializeMod();
`;

      // Create LLM translations
      const llmTranslations = new Map<string, LLMTranslationResult>();
      llmTranslations.set('node_1', {
        translatedCode: `
import { system } from "@minecraft/server";

// Custom block implementation
function createCustomBlock() {
  console.log("Creating custom block");
  return {
    id: "test-mod:custom_block",
    name: "Custom Block"
  };
}
`,
        confidence: 0.9,
        warnings: [],
        metadata: {
          tokensUsed: 100,
          processingTime: 500,
          modelVersion: 'test-model',
        },
      });

      // Create unmappable nodes
      const unmappableNodes: MMIRNode[] = [
        {
          id: 'node_1',
          type: MMIRNodeType.BlockDefinition,
          properties: {
            blockId: 'custom_block',
          },
          children: [],
        },
      ];

      const integratedCode = generator.integrateASTAndLLMCode(
        astCode,
        llmTranslations,
        unmappableNodes
      );

      // Verify the integrated code
      expect(integratedCode.length).toBe(2);
      expect(integratedCode[0].filePath).toBe('index.js');
      expect(integratedCode[0].code).toContain(
        "import { block_custom_block } from './block_custom_block.js';"
      );
      expect(integratedCode[1].filePath).toBe('block_custom_block.js');
      expect(integratedCode[1].code).toContain('export const block_custom_block');
    });
  });

  describe('optimizeCode', () => {
    it('should apply basic optimizations', () => {
      const code = `
function emptyFunction() {}

function logFunction() {
  console.log("This should be removed");
  return true;
}
`;

      const optimized = generator.optimizeCode(code);

      // Verify optimizations
      expect(optimized).not.toContain('console.log');
      // Note: In this simplified implementation, empty functions might not be removed
    });

    it('should minify code when requested', () => {
      const code = `
// This is a comment
function add(a, b) {
  return a + b;
}
`;

      const minified = generator.optimizeCode(code, { minify: true });

      // Verify minification
      expect(minified).not.toContain('//');
      expect(minified).not.toContain('\n');

      // Check for minified function with more flexible matching
      expect(minified).toMatch(/function add\(a,b\).*return a\+b/);
    });
  });
});
