import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RecipeConverter,
  JavaRecipe,
  BedrockRecipe,
  RecipeConversionResult,
} from '../../../../src/modules/configuration/RecipeConverter.js';
import fs from 'fs/promises';

// Mock the fs module
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
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

describe('RecipeConverter', () => {
  let converter: RecipeConverter;

  beforeEach(() => {
    converter = new RecipeConverter();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('parseJavaRecipes', () => {
    it('should parse Java recipe JSON files from a directory', async () => {
      // Mock file system operations
      const mockFiles = ['shaped_recipe.json', 'shapeless_recipe.json'];
      const mockShapedContent = JSON.stringify({
        type: 'minecraft:crafting_shaped',
        pattern: ['###', '# #', '###'],
        key: {
          '#': { item: 'minecraft:iron_ingot' },
        },
        result: { item: 'minecraft:bucket', count: 1 },
      });

      const mockShapelessContent = JSON.stringify({
        type: 'minecraft:crafting_shapeless',
        ingredients: [
          { item: 'minecraft:dye', data: 4 },
          { item: 'minecraft:dye', data: 15 },
        ],
        result: { item: 'minecraft:light_blue_dye', count: 2 },
      });

      // Mock readdir to return our test files
      vi.mocked(fs.readdir).mockResolvedValue(
        mockFiles.map((file) => ({
          name: file,
          isDirectory: () => false,
          isFile: () => true,
        })) as any
      );

      // Mock readFile to return our test content
      vi.mocked(fs.readFile).mockImplementation((filePath: string) => {
        if (filePath.includes('shaped_recipe.json')) {
          return Promise.resolve(mockShapedContent);
        } else {
          return Promise.resolve(mockShapelessContent);
        }
      });

      const result = await converter.parseJavaRecipes('/mock/recipes', 'testmod');

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('minecraft:crafting_shaped');
      expect(result[1].type).toBe('minecraft:crafting_shapeless');
    });

    it('should handle errors when parsing recipe files', async () => {
      // Mock file system operations
      const mockFiles = ['invalid_recipe.json'];

      // Mock readdir to return our test file
      vi.mocked(fs.readdir).mockResolvedValue(
        mockFiles.map((file) => ({
          name: file,
          isDirectory: () => false,
          isFile: () => true,
        })) as any
      );

      // Mock readFile to throw an error
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Test error'));

      const result = await converter.parseJavaRecipes('/mock/recipes', 'testmod');

      expect(result).toHaveLength(0);
    });
  });

  describe('convertRecipes', () => {
    it('should convert shaped crafting recipes to Bedrock format', () => {
      const mockRecipes: JavaRecipe[] = [
        {
          type: 'minecraft:crafting_shaped',
          pattern: ['###', '# #', '###'],
          key: {
            '#': { item: 'minecraft:iron_ingot' },
          },
          result: { item: 'minecraft:bucket', count: 1 },
          sourceFile: 'shaped_recipe.json',
        },
      ];

      const result = converter.convertRecipes(mockRecipes, 'testmod');

      expect(result.success).toBe(true);
      expect(result.recipes).toHaveLength(1);
      expect(result.recipes[0]['minecraft:recipe_shaped']).toBeDefined();
      expect(result.recipes[0]['minecraft:recipe_shaped']?.pattern).toEqual(['###', '# #', '###']);
      expect(result.recipes[0]['minecraft:recipe_shaped']?.key['#'].item).toBe(
        'minecraft:iron_ingot'
      );
    });

    it('should convert shapeless crafting recipes to Bedrock format', () => {
      const mockRecipes: JavaRecipe[] = [
        {
          type: 'minecraft:crafting_shapeless',
          ingredients: [{ item: 'minecraft:dye' }, { item: 'minecraft:dye' }],
          result: { item: 'minecraft:light_blue_dye', count: 2 },
          sourceFile: 'shapeless_recipe.json',
        },
      ];

      const result = converter.convertRecipes(mockRecipes, 'testmod');

      expect(result.success).toBe(true);
      expect(result.recipes).toHaveLength(1);
      expect(result.recipes[0]['minecraft:recipe_shapeless']).toBeDefined();
      expect(result.recipes[0]['minecraft:recipe_shapeless']?.ingredients).toHaveLength(2);
      expect(result.recipes[0]['minecraft:recipe_shapeless']?.result.item).toBe(
        'minecraft:light_blue_dye'
      );
    });

    it('should convert furnace recipes to Bedrock format', () => {
      const mockRecipes: JavaRecipe[] = [
        {
          type: 'minecraft:smelting',
          ingredients: [{ item: 'minecraft:iron_ore' }],
          result: { item: 'minecraft:iron_ingot' },
          experience: 0.7,
          cookingtime: 200,
          sourceFile: 'smelting_recipe.json',
        },
      ];

      const result = converter.convertRecipes(mockRecipes, 'testmod');

      expect(result.success).toBe(true);
      expect(result.recipes).toHaveLength(1);
      expect(result.recipes[0]['minecraft:recipe_furnace']).toBeDefined();
      expect(result.recipes[0]['minecraft:recipe_furnace']?.input.item).toBe('minecraft:iron_ore');
      expect(result.recipes[0]['minecraft:recipe_furnace']?.output.item).toBe(
        'minecraft:iron_ingot'
      );
    });

    it('should convert stonecutting recipes to Bedrock format', () => {
      const mockRecipes: JavaRecipe[] = [
        {
          type: 'minecraft:stonecutting',
          ingredients: [{ item: 'minecraft:stone' }],
          result: { item: 'minecraft:stone_bricks', count: 1 },
          sourceFile: 'stonecutting_recipe.json',
        },
      ];

      const result = converter.convertRecipes(mockRecipes, 'testmod');

      expect(result.success).toBe(true);
      expect(result.recipes).toHaveLength(1);
      expect(result.recipes[0]['minecraft:recipe_furnace']).toBeDefined();
      expect(result.recipes[0]['minecraft:recipe_furnace']?.tags).toContain('stonecutter');
      expect(result.recipes[0]['minecraft:recipe_furnace']?.input.item).toBe('minecraft:stone');
      expect(result.recipes[0]['minecraft:recipe_furnace']?.output.item).toBe(
        'minecraft:stone_bricks'
      );
    });

    it('should convert smithing recipes to Bedrock format', () => {
      const mockRecipes: JavaRecipe[] = [
        {
          type: 'minecraft:smithing',
          base: { item: 'minecraft:diamond_chestplate' },
          addition: { item: 'minecraft:netherite_ingot' },
          result: { item: 'minecraft:netherite_chestplate' },
          sourceFile: 'smithing_recipe.json',
        },
      ];

      const result = converter.convertRecipes(mockRecipes, 'testmod');

      expect(result.success).toBe(true);
      expect(result.recipes).toHaveLength(1);
      expect(result.recipes[0]['minecraft:recipe_brewing_mix']).toBeDefined();
      expect(result.recipes[0]['minecraft:recipe_brewing_mix']?.input.item).toBe(
        'minecraft:diamond_chestplate'
      );
      expect(result.recipes[0]['minecraft:recipe_brewing_mix']?.reagent.item).toBe(
        'minecraft:netherite_ingot'
      );
      expect(result.recipes[0]['minecraft:recipe_brewing_mix']?.output.item).toBe(
        'minecraft:netherite_chestplate'
      );
    });

    it('should handle tag usage in recipes', () => {
      const mockRecipes: JavaRecipe[] = [
        {
          type: 'minecraft:crafting_shaped',
          pattern: ['###', '# #', '###'],
          key: {
            '#': { tag: 'forge:ingots/iron' },
          },
          result: { item: 'minecraft:bucket', count: 1 },
          sourceFile: 'shaped_recipe_with_tag.json',
        },
      ];

      const result = converter.convertRecipes(mockRecipes, 'testmod');

      expect(result.success).toBe(true);
      expect(result.recipes).toHaveLength(1);
      expect(
        result.conversionNotes.some(
          (note) => note.type === 'warning' && note.message.includes('tag')
        )
      ).toBe(true);
    });

    it('should handle errors in recipe conversion', () => {
      const mockRecipes: JavaRecipe[] = [
        {
          type: 'minecraft:crafting_shaped',
          // Missing pattern and key
          result: { item: 'minecraft:bucket', count: 1 },
          sourceFile: 'invalid_shaped_recipe.json',
        },
      ];

      const result = converter.convertRecipes(mockRecipes, 'testmod');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('writeRecipes', () => {
    it('should write converted recipes to the output directory', async () => {
      const mockResult: RecipeConversionResult = {
        success: true,
        recipes: [
          {
            format_version: '1.19.0',
            'minecraft:recipe_shaped': {
              description: {
                identifier: 'testmod:crafting_bucket_shaped_recipe',
              },
              tags: ['crafting_table'],
              pattern: ['###', '# #', '###'],
              key: {
                '#': { item: 'minecraft:iron_ingot' },
              },
              result: {
                item: 'minecraft:bucket',
                count: 1,
              },
            },
          },
        ],
        conversionNotes: [],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await converter.writeRecipes(mockResult, '/output/behavior_pack');

      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('recipes'), expect.anything());
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('testmod_crafting_bucket_shaped_recipe.json'),
        expect.anything()
      );
    });

    it('should return false if the conversion result is not successful', async () => {
      const mockResult: RecipeConversionResult = {
        success: false,
        recipes: [],
        errors: ['Test error'],
        conversionNotes: [],
      };

      const result = await converter.writeRecipes(mockResult, '/output/behavior_pack');

      expect(result).toBe(false);
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('validateRecipe', () => {
    it('should validate a shaped recipe correctly', () => {
      const recipe: BedrockRecipe = {
        format_version: '1.19.0',
        'minecraft:recipe_shaped': {
          description: {
            identifier: 'testmod:crafting_bucket_shaped_recipe',
          },
          tags: ['crafting_table'],
          pattern: ['###', '# #', '###'],
          key: {
            '#': { item: 'minecraft:iron_ingot' },
          },
          result: {
            item: 'minecraft:bucket',
            count: 1,
          },
        },
      };

      const result = converter.validateRecipe(recipe);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a shapeless recipe correctly', () => {
      const recipe: BedrockRecipe = {
        format_version: '1.19.0',
        'minecraft:recipe_shapeless': {
          description: {
            identifier: 'testmod:crafting_dye_shapeless_recipe',
          },
          tags: ['crafting_table'],
          ingredients: [{ item: 'minecraft:dye' }, { item: 'minecraft:dye' }],
          result: {
            item: 'minecraft:light_blue_dye',
            count: 2,
          },
        },
      };

      const result = converter.validateRecipe(recipe);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields in recipes', () => {
      const recipe: BedrockRecipe = {
        format_version: '1.19.0',
        'minecraft:recipe_shaped': {
          description: {
            // Missing identifier
          } as any,
          tags: [], // Empty tags array
          pattern: ['###', '# #', '###'],
          key: {
            '#': { item: 'minecraft:iron_ingot' },
          },
          result: {
            item: 'minecraft:bucket',
            count: 1,
          },
        },
      };

      const result = converter.validateRecipe(recipe);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Shaped recipe missing identifier');
      expect(result.errors).toContain('Shaped recipe missing tags');
    });

    it('should detect invalid recipe types', () => {
      const recipe = {
        format_version: '1.19.0',
        // No valid recipe type
      } as BedrockRecipe;

      const result = converter.validateRecipe(recipe);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Recipe must have one of the valid recipe types');
    });
  });
});
