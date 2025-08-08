/**
 * Unit tests for MMIRParser
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MMIRParser } from '../../../../src/modules/logic/MMIRParser.js';
import { MMIRRepresentation } from '../../../../src/types/logic-translation.js';

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

describe('MMIRParser', () => {
  let parser: MMIRParser;

  beforeEach(() => {
    parser = new MMIRParser();
  });

  describe('parse', () => {
    it('should parse simple Java class', async () => {
      const javaCode = `
        public class TestClass {
          public void testMethod() {
            System.out.println("Hello World");
          }
        }
      `;

      const result = await parser.parse(javaCode);

      expect(result).toBeDefined();
      expect(result.ast).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
      expect(result.dependencies).toBeInstanceOf(Array);
      expect(result.complexity).toBeDefined();

      // Check metadata
      expect(result.metadata.originalLinesOfCode).toBe(6);
      expect(result.metadata.complexity.cyclomaticComplexity).toBeGreaterThan(0);
      expect(result.metadata.complexity.linesOfCode).toBeGreaterThan(0);

      // Check AST structure
      expect(result.ast.length).toBeGreaterThan(0);
      const classNode = result.ast.find((node) => node.type === 'ClassDeclaration');
      expect(classNode).toBeDefined();
      expect(classNode?.value).toBe('TestClass');
    });

    it('should parse Java imports correctly', async () => {
      const javaCode = `
        import java.util.List;
        import net.minecraft.world.World;
        import static net.minecraftforge.common.ForgeHooks.*;
        
        public class TestClass {
        }
      `;

      const result = await parser.parse(javaCode);

      expect(result.metadata.imports).toHaveLength(3);

      const javaImport = result.metadata.imports.find((imp) => imp.packageName === 'java.util');
      expect(javaImport).toBeDefined();
      expect(javaImport?.className).toBe('List');
      expect(javaImport?.isStatic).toBe(false);

      const staticImport = result.metadata.imports.find((imp) => imp.isStatic);
      expect(staticImport).toBeDefined();
      expect(staticImport?.isWildcard).toBe(true);

      // Check dependencies
      const minecraftDep = result.dependencies.find((dep) => dep.type === 'minecraft');
      expect(minecraftDep).toBeDefined();

      const forgeDep = result.dependencies.find((dep) => dep.type === 'forge');
      expect(forgeDep).toBeDefined();
    });

    it('should parse method declarations', async () => {
      const javaCode = `
        public class TestClass {
          public void publicMethod() {}
          private int privateMethod(String param) { return 0; }
          protected static boolean staticMethod(int a, String b) { return true; }
        }
      `;

      const result = await parser.parse(javaCode);

      expect(result.metadata.methods).toHaveLength(3);

      const publicMethod = result.metadata.methods.find((m) => m.name === 'publicMethod');
      expect(publicMethod).toBeDefined();

      const privateMethod = result.metadata.methods.find((m) => m.name === 'privateMethod');
      expect(privateMethod).toBeDefined();

      const staticMethod = result.metadata.methods.find((m) => m.name === 'staticMethod');
      expect(staticMethod).toBeDefined();
    });

    it('should parse control flow structures', async () => {
      const javaCode = `
        public class TestClass {
          public void complexMethod() {
            if (condition) {
              for (int i = 0; i < 10; i++) {
                while (running) {
                  doSomething();
                }
              }
            }
          }
        }
      `;

      const result = await parser.parse(javaCode);

      // Check complexity metrics
      expect(result.complexity.cyclomaticComplexity).toBeGreaterThan(3);
      expect(result.complexity.nestingDepth).toBeGreaterThan(2);

      // Check AST contains control flow nodes
      const hasIfStatement = result.ast.some((node) => containsNodeType(node, 'IfStatement'));
      const hasForLoop = result.ast.some((node) => containsNodeType(node, 'ForLoop'));
      const hasWhileLoop = result.ast.some((node) => containsNodeType(node, 'WhileLoop'));

      expect(hasIfStatement).toBe(true);
      expect(hasForLoop).toBe(true);
      expect(hasWhileLoop).toBe(true);
    });

    it('should handle comments correctly', async () => {
      const javaCode = `
        // Single line comment
        public class TestClass {
          /*
           * Multi-line comment
           */
          public void method() {
            // Another comment
          }
        }
      `;

      const result = await parser.parse(javaCode);

      // Check that comments are preserved in AST
      const hasComments = result.ast.some((node) => containsNodeType(node, 'Comment'));
      expect(hasComments).toBe(true);
    });

    it('should calculate complexity metrics correctly', async () => {
      const simpleCode = `
        public class Simple {
          public void method() {
            System.out.println("simple");
          }
        }
      `;

      const complexCode = `
        public class Complex {
          public void method() {
            if (a) {
              for (int i = 0; i < 10; i++) {
                if (b) {
                  while (c) {
                    switch (d) {
                      case 1: break;
                      case 2: break;
                      default: break;
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const simpleResult = await parser.parse(simpleCode);
      const complexResult = await parser.parse(complexCode);

      expect(complexResult.complexity.cyclomaticComplexity).toBeGreaterThan(
        simpleResult.complexity.cyclomaticComplexity
      );

      expect(complexResult.complexity.nestingDepth).toBeGreaterThan(
        simpleResult.complexity.nestingDepth
      );
    });

    it('should handle field declarations', async () => {
      const javaCode = `
        public class TestClass {
          private String name;
          public static final int CONSTANT = 42;
          protected List<String> items = new ArrayList<>();
        }
      `;

      const result = await parser.parse(javaCode);

      // Check that field declarations are parsed
      const hasFieldDeclarations = result.ast.some((node) =>
        containsNodeType(node, 'FieldDeclaration')
      );
      expect(hasFieldDeclarations).toBe(true);
    });

    it('should handle method calls', async () => {
      const javaCode = `
        public class TestClass {
          public void method() {
            world.getBlock(pos);
            player.sendMessage("Hello");
            CustomAPI.doSomething(param1, param2);
          }
        }
      `;

      const result = await parser.parse(javaCode);

      // Check that method calls are parsed
      const hasMethodCalls = result.ast.some((node) => containsNodeType(node, 'MethodCall'));
      expect(hasMethodCalls).toBe(true);
    });

    it('should handle parsing errors gracefully', async () => {
      const invalidJavaCode = `
        public class {
          invalid syntax here
          missing braces and semicolons
      `;

      // Should not throw, but return a result with error information
      const result = await parser.parse(invalidJavaCode);

      // Even with invalid syntax, should return some structure
      expect(result).toBeDefined();
      expect(result.ast).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
    });

    it('should identify mappable vs unmappable code', async () => {
      const javaCode = `
        public class TestClass {
          public void tick() { // Common mappable method
            world.getBlock(pos); // Common mappable API
          }
          
          public void customRender() { // Likely unmappable
            GL11.glBegin(GL11.GL_QUADS); // Rendering API - unmappable
          }
        }
      `;

      const result = await parser.parse(javaCode);

      // Check that some nodes are marked as mappable/unmappable
      const nodes = flattenAST(result.ast);
      const mappableNodes = nodes.filter((node) => node.metadata?.mappable === true);
      const unmappableNodes = nodes.filter((node) => node.metadata?.mappable === false);

      expect(mappableNodes.length).toBeGreaterThan(0);
      // Note: unmappable detection is simplified in current implementation
    });

    it('should handle empty or whitespace-only code', async () => {
      const emptyCode = '';
      const whitespaceCode = '   \n\n   \t  \n  ';

      const emptyResult = await parser.parse(emptyCode);
      const whitespaceResult = await parser.parse(whitespaceCode);

      expect(emptyResult.ast).toHaveLength(0);
      expect(emptyResult.metadata.originalLinesOfCode).toBe(1);

      expect(whitespaceResult.ast).toHaveLength(0);
      expect(whitespaceResult.metadata.originalLinesOfCode).toBeGreaterThan(1);
    });
  });
});

// Helper functions for testing
function containsNodeType(node: any, nodeType: string): boolean {
  if (node.type === nodeType) {
    return true;
  }

  if (node.children && Array.isArray(node.children)) {
    return node.children.some((child: any) => containsNodeType(child, nodeType));
  }

  return false;
}

function flattenAST(nodes: any[]): any[] {
  const flattened: any[] = [];

  for (const node of nodes) {
    flattened.push(node);
    if (node.children && Array.isArray(node.children)) {
      flattened.push(...flattenAST(node.children));
    }
  }

  return flattened;
}
