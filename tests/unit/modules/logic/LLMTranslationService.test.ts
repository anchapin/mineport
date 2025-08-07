/**
 * LLMTranslationService.test.ts
 *
 * Unit tests for the LLMTranslationService class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LLMTranslationService,
  LLMApiConfig,
  TranslationContext,
  LLMTranslationResult,
} from '../../../../src/modules/logic/LLMTranslationService.js';
import {
  MMIRNode,
  MMIRNodeType,
  MMIRContext,
} from '../../../../src/modules/logic/MMIRGenerator.js';
import { APIMapping } from '../../../../src/modules/logic/APIMapping.js';

describe('LLMTranslationService', () => {
  let translationService: LLMTranslationService;
  let defaultConfig: LLMApiConfig;

  beforeEach(() => {
    defaultConfig = {
      endpoint: 'https://api.example.com/v1/completions',
      model: 'gpt-4',
      maxTokens: 2048,
      temperature: 0.3,
      timeout: 30000,
    };

    translationService = new LLMTranslationService(defaultConfig);

    // Mock the private callLLMApi method
    vi.spyOn<any, any>(translationService, 'callLLMApi').mockImplementation(
      async (prompt: string) => {
        return {
          choices: [
            {
              message: {
                content: `
// Translated code
import { system } from "@minecraft/server";

// Example translation of Java code to JavaScript
const MOD_ID = "testmod";

// Register event handler
system.events.playerJoin.subscribe(event => {
  const player = event.player;
  console.log(\`Player joined: \${player.name}\`);
});
`,
              },
            },
          ],
          usage: {
            total_tokens: 150,
          },
          model: defaultConfig.model,
        };
      }
    );
  });

  describe('translateCode', () => {
    it('should translate Java code to JavaScript', async () => {
      const context: TranslationContext = {
        javaCode: `
          @SubscribeEvent
          public void onPlayerJoin(PlayerEvent.PlayerLoggedInEvent event) {
            PlayerEntity player = event.getPlayer();
            System.out.println("Player joined: " + player.getName().getString());
          }
        `,
        mmirNode: {
          id: 'node_1',
          type: MMIRNodeType.EventHandler,
          properties: {
            methodName: 'onPlayerJoin',
            eventType: 'PlayerEvent.PlayerLoggedInEvent',
          },
          children: [],
        },
        apiMappings: [
          {
            javaSignature: 'PlayerEvent.PlayerLoggedInEvent',
            bedrockEquivalent: 'system.events.playerJoin',
            conversionType: 'direct',
            notes: 'Player join event mapping',
          },
        ],
        modContext: {
          modId: 'testmod',
          modLoader: 'forge',
          minecraftVersion: '1.16.5',
        },
      };

      const result = await translationService.translateCode(context);

      expect(result).toBeDefined();
      expect(result.translatedCode).toContain('import { system }');
      expect(result.translatedCode).toContain('system.events.playerJoin.subscribe');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors during translation', async () => {
      // Mock the callLLMApi method to throw an error
      vi.spyOn<any, any>(translationService, 'callLLMApi').mockImplementation(async () => {
        throw new Error('API error');
      });

      const context: TranslationContext = {
        javaCode: 'public void brokenMethod() { }',
        mmirNode: {
          id: 'node_1',
          type: MMIRNodeType.Method,
          properties: {
            methodName: 'brokenMethod',
          },
          children: [],
        },
        apiMappings: [],
        modContext: {
          modId: 'testmod',
          modLoader: 'forge',
          minecraftVersion: '1.16.5',
        },
      };

      const result = await translationService.translateCode(context);

      expect(result).toBeDefined();
      expect(result.translatedCode).toContain('// Error translating code');
      expect(result.confidence).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('knowledge base', () => {
    it('should allow adding and retrieving knowledge', () => {
      const key = 'test_knowledge';
      const value = 'This is test knowledge';

      translationService.addKnowledge(key, value);
      const retrievedValue = translationService.getKnowledge(key);

      expect(retrievedValue).toBe(value);
    });

    it('should include relevant knowledge in the prompt', async () => {
      const context: TranslationContext = {
        javaCode: 'public void testMethod() { }',
        mmirNode: {
          id: 'node_1',
          type: MMIRNodeType.Method,
          properties: {
            methodName: 'testMethod',
          },
          children: [],
        },
        apiMappings: [],
        modContext: {
          modId: 'testmod',
          modLoader: 'forge',
          minecraftVersion: '1.16.5',
        },
      };

      // Spy on the preparePrompt method
      const preparePromptSpy = vi.spyOn<any, any>(translationService, 'preparePrompt');

      await translationService.translateCode(context);

      // Check that the prompt includes knowledge base entries
      const prompt = preparePromptSpy.mock.results[0].value;
      expect(prompt).toContain('Java classes typically become JavaScript constructor functions');
      expect(prompt).toContain('Forge event handlers typically become Bedrock event subscribers');
    });
  });

  describe('translateUnmappableNodes', () => {
    it('should translate multiple unmappable nodes', async () => {
      const mmirContext: MMIRContext = {
        nodes: [],
        relationships: [],
        metadata: {
          modId: 'testmod',
          modName: 'Test Mod',
          modVersion: '1.0.0',
          modLoader: 'forge',
          minecraftVersion: '1.16.5',
          modLoaderVersion: '36.2.0',
          authors: ['TestAuthor'],
          description: 'A test mod',
          license: 'MIT',
        },
      };

      const unmappableNodes: MMIRNode[] = [
        {
          id: 'node_1',
          type: MMIRNodeType.Method,
          sourceLocation: {
            file: 'TestMod.java',
            startLine: 10,
            startColumn: 1,
            endLine: 15,
            endColumn: 1,
          },
          properties: {
            methodName: 'complexMethod',
          },
          children: [],
        },
        {
          id: 'node_2',
          type: MMIRNodeType.Unknown,
          sourceLocation: {
            file: 'TestMod.java',
            startLine: 20,
            startColumn: 1,
            endLine: 25,
            endColumn: 1,
          },
          properties: {
            description: 'Unknown node',
          },
          children: [],
        },
      ];

      const apiMappings: APIMapping[] = [];

      const results = await translationService.translateUnmappableNodes(
        mmirContext,
        unmappableNodes,
        apiMappings
      );

      expect(results.size).toBe(2);
      expect(results.has('node_1')).toBe(true);
      expect(results.has('node_2')).toBe(true);

      const result1 = results.get('node_1');
      expect(result1?.translatedCode).toBeDefined();

      const result2 = results.get('node_2');
      expect(result2?.translatedCode).toBeDefined();
    });

    it('should handle nodes without source location', async () => {
      const mmirContext: MMIRContext = {
        nodes: [],
        relationships: [],
        metadata: {
          modId: 'testmod',
          modName: 'Test Mod',
          modVersion: '1.0.0',
          modLoader: 'forge',
          minecraftVersion: '1.16.5',
          modLoaderVersion: '36.2.0',
          authors: ['TestAuthor'],
          description: 'A test mod',
          license: 'MIT',
        },
      };

      const unmappableNodes: MMIRNode[] = [
        {
          id: 'node_1',
          type: MMIRNodeType.Method,
          properties: {
            methodName: 'methodWithoutLocation',
          },
          children: [],
        },
      ];

      const apiMappings: APIMapping[] = [];

      const results = await translationService.translateUnmappableNodes(
        mmirContext,
        unmappableNodes,
        apiMappings
      );

      expect(results.size).toBe(1);
      expect(results.has('node_1')).toBe(true);

      const result = results.get('node_1');
      expect(result?.translatedCode).toContain('Unable to translate node');
      expect(result?.warnings).toContain('No source location available for this node');
    });
  });
});
