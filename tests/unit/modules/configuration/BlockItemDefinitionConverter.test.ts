import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BlockItemDefinitionConverter,
  JavaRegistrationCode,
} from '../../../../src/modules/configuration/BlockItemDefinitionConverter.js';
import fs from 'fs/promises';

// Mock the fs module
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
  },
}));

// Mock the logger
vi.mock('../../../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('BlockItemDefinitionConverter', () => {
  let converter: BlockItemDefinitionConverter;

  beforeEach(() => {
    converter = new BlockItemDefinitionConverter();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeJavaRegistrations', () => {
    it('should extract block registrations from Java files', async () => {
      // Mock file system operations
      const mockFiles = ['BlockRegistry.java'];
      const mockContent = `
        public class BlockRegistry {
          public static void registerBlocks() {
            Registry.register(Registry.BLOCK, new ResourceLocation("testmod", "example_block"), new ExampleBlock(Block.Properties.of(Material.ROCK).hardnessAndResistance(2.0f, 3.0f)));
          }
        }
      `;

      // Mock readdir to return only one file
      vi.mocked(fs.readdir).mockResolvedValue(
        mockFiles.map((file) => ({
          name: file,
          isDirectory: () => false,
          isFile: () => true,
        })) as any
      );

      // Mock readFile to return our test content
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await converter.analyzeJavaRegistrations('/mock/path', 'testmod');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('block');
      expect(result[0].modId).toBe('testmod');
      expect(result[0].name).toBe('example_block');
    });

    it('should extract item registrations from Java files', async () => {
      // Mock file system operations
      const mockFiles = ['ItemRegistry.java'];
      const mockContent = `
        public class ItemRegistry {
          public static void registerItems() {
            Registry.register(Registry.ITEM, new ResourceLocation("testmod", "example_item"), new ExampleItem(new Item.Properties().maxStackSize(16)));
          }
        }
      `;

      // Mock readdir to return only one file
      vi.mocked(fs.readdir).mockResolvedValue(
        mockFiles.map((file) => ({
          name: file,
          isDirectory: () => false,
          isFile: () => true,
        })) as any
      );

      // Mock readFile to return our test content
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await converter.analyzeJavaRegistrations('/mock/path', 'testmod');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('item');
      expect(result[0].modId).toBe('testmod');
      expect(result[0].name).toBe('example_item');
    });
  });

  describe('convertBlockDefinitions', () => {
    it('should convert Java block registrations to Bedrock block definitions', () => {
      const mockRegistrations: JavaRegistrationCode[] = [
        {
          type: 'block',
          modId: 'testmod',
          name: 'example_block',
          className: 'ExampleBlock',
          properties: {
            hardness: '2.0',
            resistance: '3.0',
            lightValue: '7',
            soundType: 'SoundType.STONE',
          },
          sourceFile: 'BlockRegistry.java',
          lineNumber: 5,
        },
      ];

      const result = converter.convertBlockDefinitions(mockRegistrations);

      expect(result).toHaveLength(1);
      expect(result[0].format_version).toBe('1.19.0');
      expect(result[0]['minecraft:block'].description.identifier).toBe('testmod:example_block');

      // Check destructible_by_mining property
      const destroyTime =
        result[0]['minecraft:block'].components['minecraft:destructible_by_mining']
          .seconds_to_destroy;
      expect(destroyTime).toBe(2.0);

      // Check light emission property
      const lightEmission = result[0]['minecraft:block'].components['minecraft:light_emission'];
      expect(lightEmission).toBe('7');
    });
  });

  describe('convertItemDefinitions', () => {
    it('should convert Java item registrations to Bedrock item definitions', () => {
      const mockRegistrations: JavaRegistrationCode[] = [
        {
          type: 'item',
          modId: 'testmod',
          name: 'example_item',
          className: 'ExampleItem',
          properties: {
            maxStackSize: '16',
            maxDamage: '100',
            rarity: 'Rarity.RARE',
          },
          sourceFile: 'ItemRegistry.java',
          lineNumber: 5,
        },
      ];

      const result = converter.convertItemDefinitions(mockRegistrations);

      expect(result).toHaveLength(1);
      expect(result[0].format_version).toBe('1.19.0');
      expect(result[0]['minecraft:item'].description.identifier).toBe('testmod:example_item');

      // Verify max stack size
      expect(result[0]['minecraft:item'].components['minecraft:max_stack_size']).toBe('16');

      // Verify max durability
      expect(result[0]['minecraft:item'].components['minecraft:durability'].max_durability).toBe(
        100
      );

      // Verify rarity
      expect(result[0]['minecraft:item'].components['minecraft:custom_data'].rarity).toBe('rare');
    });
  });

  describe('processRegistrations', () => {
    it('should process both block and item registrations', () => {
      const mockRegistrations: JavaRegistrationCode[] = [
        {
          type: 'block',
          modId: 'testmod',
          name: 'example_block',
          className: 'ExampleBlock',
          properties: { hardness: '2.0' },
          sourceFile: 'BlockRegistry.java',
          lineNumber: 5,
        },
        {
          type: 'item',
          modId: 'testmod',
          name: 'example_item',
          className: 'ExampleItem',
          properties: { maxStackSize: '16' },
          sourceFile: 'ItemRegistry.java',
          lineNumber: 5,
        },
      ];

      const result = converter.processRegistrations(mockRegistrations);

      expect(result.success).toBe(true);
      expect(result.blocks).toHaveLength(1);
      expect(result.items).toHaveLength(1);
      expect(result.conversionNotes).toHaveLength(4); // 2 conversion notes + 2 texture notes
    });
  });

  describe('writeDefinitions', () => {
    it('should write block and item definitions to the output directory', async () => {
      const mockResult = {
        success: true,
        blocks: [
          {
            format_version: '1.19.0',
            'minecraft:block': {
              description: {
                identifier: 'testmod:example_block',
                register_to_creative_menu: true,
              },
              components: {
                'minecraft:destructible_by_mining': {
                  seconds_to_destroy: 2.0,
                },
              },
            },
          },
        ],
        items: [
          {
            format_version: '1.19.0',
            'minecraft:item': {
              description: {
                identifier: 'testmod:example_item',
                category: 'items',
                register_to_creative_menu: true,
              },
              components: {
                'minecraft:max_stack_size': 16,
              },
            },
          },
        ],
        conversionNotes: [],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await converter.writeDefinitions(mockResult, '/output/behavior_pack');

      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should return false if the conversion result is not successful', async () => {
      const mockResult = {
        success: false,
        blocks: [],
        items: [],
        errors: ['Test error'],
        conversionNotes: [],
      };

      const result = await converter.writeDefinitions(mockResult, '/output/behavior_pack');

      expect(result).toBe(false);
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});
