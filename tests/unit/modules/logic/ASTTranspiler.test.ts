/**
 * ASTTranspiler.test.ts
 * 
 * Unit tests for the ASTTranspiler class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ASTTranspiler,
  JavaScriptASTNode,
  TranspilationResult
} from '../../../../src/modules/logic/ASTTranspiler';
import { 
  MMIRGenerator, 
  MMIRNode, 
  MMIRNodeType,
  MMIRContext
} from '../../../../src/modules/logic/MMIRGenerator';
import { JavaParser } from '../../../../src/modules/logic/JavaParser';

describe('ASTTranspiler', () => {
  let transpiler: ASTTranspiler;
  let mmirGenerator: MMIRGenerator;
  let javaParser: JavaParser;

  beforeEach(() => {
    transpiler = new ASTTranspiler();
    mmirGenerator = new MMIRGenerator();
    javaParser = new JavaParser();
  });

  describe('transpile', () => {
    it('should transpile a simple mod declaration', () => {
      // Create a simple MMIR node for a mod declaration
      const modNode: MMIRNode = {
        id: 'node_1',
        type: MMIRNodeType.ModDeclaration,
        properties: {
          modId: 'examplemod',
          className: 'ExampleMod'
        },
        children: []
      };

      // Create a minimal MMIR context
      const mmirContext: MMIRContext = {
        nodes: [modNode],
        relationships: [],
        metadata: {
          modId: 'examplemod',
          modName: 'Example Mod',
          modVersion: '1.0.0',
          modLoader: 'forge',
          minecraftVersion: '1.16.5',
          modLoaderVersion: '36.2.0',
          authors: ['ExampleAuthor'],
          description: 'An example mod',
          license: 'MIT'
        }
      };

      // Transpile the MMIR to JavaScript AST
      const result = transpiler.transpile(mmirContext);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.jsAst).toBeDefined();
      expect(result.jsAst.length).toBeGreaterThan(0);
      
      // The first node should be a module declaration
      const moduleNode = result.jsAst[0];
      expect(moduleNode.type).toBe('Program');
      
      // Verify that the module has the correct metadata
      expect(result.metadata.modId).toBe('examplemod');
      expect(result.metadata.modName).toBe('Example Mod');
      
      // Verify that no unmappable nodes were reported
      expect(result.unmappableNodes.length).toBe(0);
    });

    it('should transpile an event handler', () => {
      // Create an MMIR node for an event handler
      const eventHandlerNode: MMIRNode = {
        id: 'node_1',
        type: MMIRNodeType.EventHandler,
        properties: {
          methodName: 'onPlayerJoin',
          eventType: 'PlayerJoinEvent'
        },
        children: []
      };

      // Create a minimal MMIR context
      const mmirContext: MMIRContext = {
        nodes: [eventHandlerNode],
        relationships: [],
        metadata: {
          modId: 'examplemod',
          modName: 'Example Mod',
          modVersion: '1.0.0',
          modLoader: 'forge',
          minecraftVersion: '1.16.5',
          modLoaderVersion: '36.2.0',
          authors: ['ExampleAuthor'],
          description: 'An example mod',
          license: 'MIT'
        }
      };

      // Transpile the MMIR to JavaScript AST
      const result = transpiler.transpile(mmirContext);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.jsAst).toBeDefined();
      expect(result.jsAst.length).toBeGreaterThan(0);
      
      // Verify that an event handler was created
      const eventHandlerExists = result.jsAst.some(node => 
        node.type === 'ExpressionStatement' && 
        node.expression?.type === 'CallExpression' &&
        node.expression.callee?.property?.name === 'subscribe'
      );
      
      expect(eventHandlerExists).toBe(true);
    });

    it('should report unmappable nodes', () => {
      // Create an MMIR node with an unmappable type
      const unmappableNode: MMIRNode = {
        id: 'node_1',
        type: MMIRNodeType.Unknown,
        properties: {
          description: 'An unknown node type'
        },
        children: []
      };

      // Create a minimal MMIR context
      const mmirContext: MMIRContext = {
        nodes: [unmappableNode],
        relationships: [],
        metadata: {
          modId: 'examplemod',
          modName: 'Example Mod',
          modVersion: '1.0.0',
          modLoader: 'forge',
          minecraftVersion: '1.16.5',
          modLoaderVersion: '36.2.0',
          authors: ['ExampleAuthor'],
          description: 'An example mod',
          license: 'MIT'
        }
      };

      // Transpile the MMIR to JavaScript AST
      const result = transpiler.transpile(mmirContext);

      // Verify that the unmappable node was reported
      expect(result.unmappableNodes.length).toBe(1);
      expect(result.unmappableNodes[0].id).toBe('node_1');
    });

    it('should handle API mappings', () => {
      // Create an MMIR node for a method call that has an API mapping
      const methodNode: MMIRNode = {
        id: 'node_1',
        type: MMIRNodeType.Method,
        properties: {
          methodName: 'registerBlock',
          className: 'Registry',
          parameters: [
            { type: 'Identifier', name: 'blockId' },
            { type: 'NewExpression', className: 'Block', arguments: [] }
          ]
        },
        children: []
      };

      // Create a minimal MMIR context
      const mmirContext: MMIRContext = {
        nodes: [methodNode],
        relationships: [],
        metadata: {
          modId: 'examplemod',
          modName: 'Example Mod',
          modVersion: '1.0.0',
          modLoader: 'forge',
          minecraftVersion: '1.16.5',
          modLoaderVersion: '36.2.0',
          authors: ['ExampleAuthor'],
          description: 'An example mod',
          license: 'MIT'
        }
      };

      // Add a mock API mapping
      transpiler.addApiMapping({
        javaSignature: 'Registry.registerBlock',
        bedrockEquivalent: 'MinecraftServer.registerBlock',
        conversionType: 'direct',
        notes: 'Direct mapping for block registration'
      });

      // Transpile the MMIR to JavaScript AST
      const result = transpiler.transpile(mmirContext);

      // Verify that the API mapping was applied
      const mappedCallExists = result.jsAst.some(node => 
        node.type === 'ExpressionStatement' && 
        node.expression?.type === 'CallExpression' &&
        node.expression.callee?.object?.name === 'MinecraftServer' &&
        node.expression.callee?.property?.name === 'registerBlock'
      );
      
      expect(mappedCallExists).toBe(true);
    });
  });

  describe('integration with MMIRGenerator', () => {
    it('should transpile a complete mod from Java source', () => {
      const forgeModSource = `
        package com.example.forgemod;
        
        import net.minecraftforge.fml.common.Mod;
        import net.minecraftforge.eventbus.api.SubscribeEvent;
        import net.minecraftforge.event.entity.player.PlayerEvent;
        
        @Mod("examplemod")
        public class ExampleMod {
            public ExampleMod() {
                // Constructor
            }
            
            @SubscribeEvent
            public void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event) {
                // Event handler
                System.out.println("Player logged in: " + event.getPlayer().getName());
            }
        }
      `;
      
      // Parse the Java source
      const parseResult = javaParser.parseSource(forgeModSource, 'ExampleMod.java');
      
      // Generate MMIR
      const mmirContext = mmirGenerator.generateMMIR(
        [{ ast: parseResult.ast, sourceFile: 'ExampleMod.java' }],
        'forge',
        { modId: 'examplemod', modName: 'Example Mod', modVersion: '1.0.0' }
      );
      
      // Transpile the MMIR to JavaScript AST
      const result = transpiler.transpile(mmirContext);
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.jsAst).toBeDefined();
      expect(result.jsAst.length).toBeGreaterThan(0);
      
      // Generate JavaScript code from the AST
      const jsCode = transpiler.generateJavaScript(result.jsAst);
      
      // Verify that the JavaScript code contains expected elements
      expect(jsCode).toContain('MOD_ID');
      expect(jsCode).toContain('function');
      
      // In a real test, we would verify more aspects of the generated code
    });
  });
});