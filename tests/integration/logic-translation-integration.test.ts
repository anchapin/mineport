/**
 * Integration tests for the complete Logic Translation Engine infrastructure
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LogicTranslationEngine } from '../../src/modules/logic/LogicTranslationEngine.js';
import { ASTTranspiler } from '../../src/modules/logic/ASTTranspiler.js';
import { LLMTranslator } from '../../src/modules/logic/LLMTranslator.js';
import { ProgramStateValidator } from '../../src/modules/logic/ProgramStateValidator.js';
import { MMIRParser } from '../../src/modules/logic/MMIRParser.js';
import { TranslationContext } from '../../src/types/logic-translation.js';

describe('Logic Translation Engine Integration', () => {
  let engine: LogicTranslationEngine;
  let mockContext: TranslationContext;

  beforeEach(() => {
    // Create real instances for integration testing
    const mmirParser = new MMIRParser();
    const astTranspiler = new ASTTranspiler();
    const llmTranslator = new LLMTranslator(null); // Mock LLM client
    const programStateValidator = new ProgramStateValidator();

    engine = new LogicTranslationEngine(
      astTranspiler,
      llmTranslator,
      programStateValidator,
      mmirParser
    );

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

  describe('End-to-End Translation', () => {
    it('should translate simple Java class successfully', async () => {
      const javaCode = `
        public class SimpleBlock {
          public void onUse() {
            System.out.println("Block used");
          }
        }
      `;

      const result = await engine.translateJavaCode(javaCode, mockContext);

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.metadata.originalLinesOfCode).toBe(6);
      expect(result.metadata.confidenceScore).toBeGreaterThan(0.5);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle complex Java code with control flow', async () => {
      const javaCode = `
        public class ComplexLogic {
          public void processItems(List<Item> items) {
            for (Item item : items) {
              if (item.isValid()) {
                while (item.hasNext()) {
                  item.process();
                }
              }
            }
          }
        }
      `;

      const result = await engine.translateJavaCode(javaCode, mockContext);

      expect(result.success).toBe(true);
      expect(result.code).toContain('class ComplexLogic');
      expect(result.code).toContain('processItems');
      expect(result.metadata.complexityScore).toBeGreaterThan(1);
    });

    it('should preserve comments in translation', async () => {
      const javaCode = `
        // This is a test class
        public class CommentedClass {
          /* Multi-line comment
           * with details
           */
          public void method() {
            // Inline comment
            doSomething();
          }
        }
      `;

      const result = await engine.translateJavaCode(javaCode, mockContext);

      expect(result.success).toBe(true);
      expect(result.code).toContain('// This is a test class');
      expect(result.code).toContain('Multi-line comment');
    });

    it('should handle method calls and assignments', async () => {
      const javaCode = `
        public class MethodCalls {
          private String name;
          
          public void initialize() {
            name = "test";
            world.setBlock(pos, Blocks.STONE);
            player.sendMessage("Hello");
          }
        }
      `;

      const result = await engine.translateJavaCode(javaCode, mockContext);

      expect(result.success).toBe(true);
      expect(result.code).toContain('class MethodCalls');
      expect(result.code).toContain('initialize');
      expect(result.code).toContain('name = null');
    });

    it('should generate appropriate metadata', async () => {
      const javaCode = `
        public class MetadataTest {
          public void simpleMethod() {
            System.out.println("simple");
          }
          
          public void complexMethod() {
            if (condition) {
              for (int i = 0; i < 10; i++) {
                doSomething(i);
              }
            }
          }
        }
      `;

      const result = await engine.translateJavaCode(javaCode, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.originalLinesOfCode).toBeGreaterThan(0);
      expect(result.metadata.translatedLinesOfCode).toBeGreaterThan(0);
      expect(result.metadata.astTranslationPercentage).toBeGreaterThan(0);
      expect(result.metadata.complexityScore).toBeGreaterThan(0);
      expect(result.metadata.confidenceScore).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty or minimal code', async () => {
      const emptyClass = `
        public class Empty {
        }
      `;

      const result = await engine.translateJavaCode(emptyClass, mockContext);

      expect(result.success).toBe(true);
      expect(result.code).toContain('class Empty');
      expect(result.metadata.originalLinesOfCode).toBe(3);
    });

    it('should handle nested class structures', async () => {
      const javaCode = `
        public class OuterClass {
          public void outerMethod() {
            if (true) {
              for (int i = 0; i < 5; i++) {
                while (condition) {
                  innerCall();
                }
              }
            }
          }
        }
      `;

      const result = await engine.translateJavaCode(javaCode, mockContext);

      expect(result.success).toBe(true);
      expect(result.code).toContain('class OuterClass');
      expect(result.code).toContain('outerMethod');
      expect(result.code).toContain('if (condition)');
      expect(result.code).toContain('for (let i = 0; i < length; i++)');
      expect(result.code).toContain('while (condition)');
    });
  });

  describe('Component Integration', () => {
    it('should integrate MMIR parsing with AST transpilation', async () => {
      const javaCode = `
        public class IntegrationTest {
          public void testMethod() {
            System.out.println("test");
          }
        }
      `;

      // Test MMIR parsing
      const mmir = await engine.parseToMMIR(javaCode);
      expect(mmir.ast).toBeDefined();
      expect(mmir.metadata).toBeDefined();
      expect(mmir.dependencies).toBeDefined();
      expect(mmir.complexity).toBeDefined();

      // Test AST transpilation
      const astResult = await engine.transpileAST(mmir, mockContext);
      expect(astResult.code).toBeDefined();
      expect(astResult.confidence).toBeGreaterThan(0);
      expect(astResult.unmappableCode).toBeDefined();
    });

    it('should integrate validation with translation results', async () => {
      const javaCode = `
        public class ValidationTest {
          public void method() {
            System.out.println("Hello World");
          }
        }
      `;

      const jsCode = `
        class ValidationTest {
          method() {
            console.log("Hello World");
          }
        }
      `;

      const validation = await engine.validateTranslation(javaCode, jsCode, mockContext);
      expect(validation.isEquivalent).toBeDefined();
      expect(validation.confidence).toBeGreaterThan(0);
      expect(validation.differences).toBeDefined();
      expect(validation.recommendations).toBeDefined();
    });

    it('should handle LLM translation for unmappable code', async () => {
      const unmappableSegments = [
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

      const llmResult = await engine.translateWithLLM(unmappableSegments, mockContext);
      expect(llmResult.code).toBeDefined();
      expect(llmResult.confidence).toBeGreaterThan(0);
      expect(llmResult.reasoning).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Java code gracefully', async () => {
      const invalidJavaCode = `
        public class Invalid {
          missing syntax and braces
      `;

      const result = await engine.translateJavaCode(invalidJavaCode, mockContext);

      // Should not throw, but may have lower success/confidence
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should provide meaningful error information', async () => {
      const problematicCode = `
        public class Problematic {
          public void method() {
            // This might cause issues
            unknownAPI.call();
          }
        }
      `;

      const result = await engine.translateJavaCode(problematicCode, mockContext);

      expect(result).toBeDefined();
      if (!result.success) {
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle moderately large code efficiently', async () => {
      // Generate a moderately complex Java class
      const largeJavaCode = `
        public class LargeClass {
          private String[] items = new String[100];
          
          ${Array.from(
            { length: 10 },
            (_, i) => `
          public void method${i}() {
            for (int j = 0; j < items.length; j++) {
              if (items[j] != null) {
                System.out.println("Processing: " + items[j]);
              }
            }
          }`
          ).join('\n')}
        }
      `;

      const startTime = Date.now();
      const result = await engine.translateJavaCode(largeJavaCode, mockContext);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should provide consistent results for the same input', async () => {
      const javaCode = `
        public class ConsistencyTest {
          public void method() {
            System.out.println("consistent");
          }
        }
      `;

      const result1 = await engine.translateJavaCode(javaCode, mockContext);
      const result2 = await engine.translateJavaCode(javaCode, mockContext);

      expect(result1.success).toBe(result2.success);
      expect(result1.metadata.originalLinesOfCode).toBe(result2.metadata.originalLinesOfCode);
      // Note: Some variation in confidence/timing is expected due to LLM components
    });
  });

  describe('Configuration Options', () => {
    it('should respect different confidence thresholds', async () => {
      const highThresholdEngine = new LogicTranslationEngine(
        new ASTTranspiler(),
        new LLMTranslator(null),
        new ProgramStateValidator({ confidenceThreshold: 0.95 }),
        new MMIRParser(),
        { confidenceThreshold: 0.95 }
      );

      const javaCode = `
        public class ThresholdTest {
          public void method() {
            System.out.println("test");
          }
        }
      `;

      const result = await highThresholdEngine.translateJavaCode(javaCode, mockContext);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle different user preferences', async () => {
      const conservativeContext = {
        ...mockContext,
        userPreferences: {
          ...mockContext.userPreferences,
          compromiseLevel: 'minimal' as const,
        },
      };

      const javaCode = `
        public class PreferenceTest {
          public void method() {
            System.out.println("test");
          }
        }
      `;

      const result = await engine.translateJavaCode(javaCode, conservativeContext);
      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
    });
  });
});
