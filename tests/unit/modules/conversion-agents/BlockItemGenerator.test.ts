/**
 * Unit tests for BlockItemGenerator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BlockItemGenerator } from '../../../../src/modules/conversion-agents/BlockItemGenerator.js';
import {
  BlockInfo,
  ItemInfo,
  RecipeInfo,
} from '../../../../src/modules/conversion-agents/types.js';

describe('BlockItemGenerator', () => {
  let generator: BlockItemGenerator;

  beforeEach(() => {
    generator = new BlockItemGenerator();
  });

  describe('generateBlockDefinitions', () => {
    it('should generate valid block definitions', async () => {
      const blocks: BlockInfo[] = [
        {
          identifier: 'testmod:stone_block',
          displayName: 'Stone Block',
          textures: {
            all: 'stone',
          },
          properties: {
            hardness: 2.0,
            resistance: 3.0,
          },
        },
      ];

      const result = await generator.generateBlockDefinitions(blocks);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0].path).toBe('blocks/testmod_stone_block.json');
      expect(result.errors).toHaveLength(0);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      expect(definition.format_version).toBe('1.20.0');
      expect(definition['minecraft:block']).toBeDefined();
      expect(definition['minecraft:block'].description.identifier).toBe('testmod:stone_block');
    });

    it('should create proper block components', async () => {
      const blocks: BlockInfo[] = [
        {
          identifier: 'testmod:custom_block',
          displayName: 'Custom Block',
          textures: {
            up: 'top_texture',
            down: 'bottom_texture',
            north: 'north_texture',
            south: 'south_texture',
            east: 'east_texture',
            west: 'west_texture',
          },
        },
      ];

      const result = await generator.generateBlockDefinitions(blocks);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      const components = definition['minecraft:block'].components;

      expect(components['minecraft:material_instances']).toBeDefined();
      expect(components['minecraft:geometry']).toBeDefined();
      expect(components['minecraft:destructible_by_mining']).toBeDefined();
      expect(components['minecraft:destructible_by_explosion']).toBeDefined();
      expect(components['minecraft:collision_box']).toBeDefined();
      expect(components['minecraft:selection_box']).toBeDefined();

      // Check material instances
      const materialInstances = components['minecraft:material_instances'];
      expect(materialInstances.top.texture).toBe('top_texture');
      expect(materialInstances.bottom.texture).toBe('bottom_texture');
      expect(materialInstances.north.texture).toBe('north_texture');
    });

    it('should convert properties to states', async () => {
      const blocks: BlockInfo[] = [
        {
          identifier: 'testmod:stateful_block',
          displayName: 'Stateful Block',
          textures: { all: 'texture' },
          properties: {
            powered: true,
            level: 3,
            facing: ['north', 'south', 'east', 'west'],
          },
        },
      ];

      const result = await generator.generateBlockDefinitions(blocks);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      const states = definition['minecraft:block'].description.states;

      expect(states.powered).toEqual([false, true]);
      expect(states.level).toEqual([0, 1, 2, 3]);
      expect(states.facing).toEqual(['north', 'south', 'east', 'west']);
    });

    it('should handle block generation errors', async () => {
      const blocks: BlockInfo[] = [
        {
          identifier: '', // Invalid identifier
          displayName: 'Invalid Block',
          textures: {},
        },
      ];

      const result = await generator.generateBlockDefinitions(blocks);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.metadata.failureCount).toBe(1);
    });

    it('should add validation warnings for invalid definitions', async () => {
      const blocks: BlockInfo[] = [
        {
          identifier: 'invalid identifier with spaces',
          displayName: 'Invalid Block',
          textures: { all: 'texture' },
        },
      ];

      const result = await generator.generateBlockDefinitions(blocks);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('validation warning');
    });
  });

  describe('generateItemDefinitions', () => {
    it('should generate valid item definitions', async () => {
      const items: ItemInfo[] = [
        {
          identifier: 'testmod:custom_item',
          displayName: 'Custom Item',
          texture: 'custom_item_texture',
          category: 'tools',
          maxStackSize: 1,
        },
      ];

      const result = await generator.generateItemDefinitions(items);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0].path).toBe('items/testmod_custom_item.json');

      const definition = JSON.parse(result.outputFiles[0].content as string);
      expect(definition.format_version).toBe('1.20.0');
      expect(definition['minecraft:item']).toBeDefined();
      expect(definition['minecraft:item'].description.identifier).toBe('testmod:custom_item');
      expect(definition['minecraft:item'].description.category).toBe('tools');
    });

    it('should create proper item components', async () => {
      const items: ItemInfo[] = [
        {
          identifier: 'testmod:tool',
          displayName: 'Tool',
          texture: 'tool_texture',
          maxStackSize: 1,
          components: {
            'minecraft:durability': {
              max_durability: 100,
            },
          },
        },
      ];

      const result = await generator.generateItemDefinitions(items);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      const components = definition['minecraft:item'].components;

      expect(components['minecraft:icon']).toBeDefined();
      expect(components['minecraft:icon'].texture).toBe('tool_texture');
      expect(components['minecraft:max_stack_size']).toBe(1);
      expect(components['minecraft:hand_equipped']).toBe(false);
      expect(components['minecraft:stacked_by_data']).toBe(true);
      expect(components['minecraft:durability']).toBeDefined();
      expect(components['minecraft:durability'].max_durability).toBe(100);
    });

    it('should use default values when not specified', async () => {
      const items: ItemInfo[] = [
        {
          identifier: 'testmod:simple_item',
          displayName: 'Simple Item',
        },
      ];

      const result = await generator.generateItemDefinitions(items);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      const components = definition['minecraft:item'].components;

      expect(components['minecraft:icon'].texture).toBe('testmod.simple_item');
      expect(components['minecraft:max_stack_size']).toBe(64);
      expect(definition['minecraft:item'].description.category).toBe('items');
    });
  });

  describe('createRecipeDefinitions', () => {
    it('should generate shaped crafting recipes', async () => {
      const recipes: RecipeInfo[] = [
        {
          identifier: 'testmod:shaped_recipe',
          type: 'crafting_shaped',
          input: {
            pattern: ['AAA', 'ABA', 'AAA'],
            key: {
              A: { item: 'minecraft:stone' },
              B: { item: 'minecraft:diamond' },
            },
          },
          output: { item: 'testmod:custom_block', count: 1 },
          tags: ['crafting_table'],
        },
      ];

      const result = await generator.createRecipeDefinitions(recipes);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      expect(definition['minecraft:recipe_shaped']).toBeDefined();
      expect(definition['minecraft:recipe_shaped'].pattern).toEqual(['AAA', 'ABA', 'AAA']);
      expect(definition['minecraft:recipe_shaped'].key.A.item).toBe('minecraft:stone');
      expect(definition['minecraft:recipe_shaped'].result.item).toBe('testmod:custom_block');
    });

    it('should generate shapeless crafting recipes', async () => {
      const recipes: RecipeInfo[] = [
        {
          identifier: 'testmod:shapeless_recipe',
          type: 'crafting_shapeless',
          input: ['minecraft:stone', 'minecraft:diamond'],
          output: { item: 'testmod:custom_item', count: 2 },
        },
      ];

      const result = await generator.createRecipeDefinitions(recipes);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      expect(definition['minecraft:recipe_shapeless']).toBeDefined();
      expect(definition['minecraft:recipe_shapeless'].ingredients).toHaveLength(2);
      expect(definition['minecraft:recipe_shapeless'].ingredients[0].item).toBe('minecraft:stone');
      expect(definition['minecraft:recipe_shapeless'].result.count).toBe(2);
    });

    it('should generate furnace recipes', async () => {
      const recipes: RecipeInfo[] = [
        {
          identifier: 'testmod:furnace_recipe',
          type: 'furnace',
          input: { item: 'testmod:raw_ore' },
          output: { item: 'testmod:ingot', count: 1 },
        },
      ];

      const result = await generator.createRecipeDefinitions(recipes);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      expect(definition['minecraft:recipe_furnace']).toBeDefined();
      expect(definition['minecraft:recipe_furnace'].input.item).toBe('testmod:raw_ore');
      expect(definition['minecraft:recipe_furnace'].output.item).toBe('testmod:ingot');
    });

    it('should generate stonecutter recipes', async () => {
      const recipes: RecipeInfo[] = [
        {
          identifier: 'testmod:stonecutter_recipe',
          type: 'stonecutter',
          input: { item: 'minecraft:stone' },
          output: { item: 'testmod:stone_slab', count: 2 },
        },
      ];

      const result = await generator.createRecipeDefinitions(recipes);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      expect(definition['minecraft:recipe_stonecutter']).toBeDefined();
      expect(definition['minecraft:recipe_stonecutter'].input.item).toBe('minecraft:stone');
      expect(definition['minecraft:recipe_stonecutter'].output.count).toBe(2);
    });

    it('should generate smithing recipes', async () => {
      const recipes: RecipeInfo[] = [
        {
          identifier: 'testmod:smithing_recipe',
          type: 'smithing',
          input: {
            template: { item: 'minecraft:netherite_upgrade_smithing_template' },
            base: { item: 'minecraft:diamond_sword' },
            addition: { item: 'minecraft:netherite_ingot' },
          },
          output: { item: 'minecraft:netherite_sword', count: 1 },
        },
      ];

      const result = await generator.createRecipeDefinitions(recipes);

      const definition = JSON.parse(result.outputFiles[0].content as string);
      expect(definition['minecraft:recipe_smithing_transform']).toBeDefined();
      expect(definition['minecraft:recipe_smithing_transform'].template.item).toBe(
        'minecraft:netherite_upgrade_smithing_template'
      );
      expect(definition['minecraft:recipe_smithing_transform'].base.item).toBe(
        'minecraft:diamond_sword'
      );
      expect(definition['minecraft:recipe_smithing_transform'].addition.item).toBe(
        'minecraft:netherite_ingot'
      );
    });

    it('should handle unsupported recipe types', async () => {
      const recipes: RecipeInfo[] = [
        {
          identifier: 'testmod:unsupported_recipe',
          type: 'unsupported_type' as any,
          input: {},
          output: {},
        },
      ];

      const result = await generator.createRecipeDefinitions(recipes);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Unsupported recipe type');
    });
  });

  describe('validateDefinitionSyntax', () => {
    it('should validate correct block definition', () => {
      const definition = {
        format_version: '1.20.0',
        'minecraft:block': {
          description: {
            identifier: 'testmod:valid_block',
          },
          components: {
            'minecraft:material_instances': {},
          },
        },
      };

      const result = generator.validateDefinitionSyntax(definition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing format version', () => {
      const definition = {
        'minecraft:block': {
          description: {
            identifier: 'testmod:block',
          },
          components: {},
        },
      };

      const result = generator.validateDefinitionSyntax(definition);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing format_version');
    });

    it('should detect missing main object', () => {
      const definition = {
        format_version: '1.20.0',
      };

      const result = generator.validateDefinitionSyntax(definition);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing main minecraft: object');
    });

    it('should detect missing description', () => {
      const definition = {
        format_version: '1.20.0',
        'minecraft:block': {
          components: {},
        },
      };

      const result = generator.validateDefinitionSyntax(definition);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing description object');
    });

    it('should detect missing identifier', () => {
      const definition = {
        format_version: '1.20.0',
        'minecraft:block': {
          description: {},
          components: {},
        },
      };

      const result = generator.validateDefinitionSyntax(definition);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing identifier in description');
    });

    it('should detect missing components', () => {
      const definition = {
        format_version: '1.20.0',
        'minecraft:block': {
          description: {
            identifier: 'testmod:block',
          },
        },
      };

      const result = generator.validateDefinitionSyntax(definition);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing components object');
    });

    it('should detect invalid identifier format', () => {
      const definition = {
        format_version: '1.20.0',
        'minecraft:block': {
          description: {
            identifier: 'invalid_identifier_without_namespace',
          },
          components: {},
        },
      };

      const result = generator.validateDefinitionSyntax(definition);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Identifier should include namespace (e.g., "modid:itemname")'
      );
    });

    it('should detect spaces in identifier', () => {
      const definition = {
        format_version: '1.20.0',
        'minecraft:block': {
          description: {
            identifier: 'testmod:invalid identifier',
          },
          components: {},
        },
      };

      const result = generator.validateDefinitionSyntax(definition);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Identifier should not contain spaces');
    });

    it('should validate recipe definitions', () => {
      const definition = {
        format_version: '1.20.0',
        'minecraft:recipe_shaped': {
          description: {
            identifier: 'testmod:recipe',
          },
        },
      };

      const result = generator.validateDefinitionSyntax(definition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('path generation', () => {
    it('should generate correct file paths', async () => {
      const blocks: BlockInfo[] = [
        { identifier: 'testmod:stone_block', displayName: 'Stone', textures: {} },
      ];
      const items: ItemInfo[] = [{ identifier: 'testmod:custom_item', displayName: 'Item' }];
      const recipes: RecipeInfo[] = [
        { identifier: 'testmod:recipe', type: 'crafting_shaped', input: {}, output: {} },
      ];

      const blockResult = await generator.generateBlockDefinitions(blocks);
      const itemResult = await generator.generateItemDefinitions(items);
      const recipeResult = await generator.createRecipeDefinitions(recipes);

      expect(blockResult.outputFiles[0].path).toBe('blocks/testmod_stone_block.json');
      expect(itemResult.outputFiles[0].path).toBe('items/testmod_custom_item.json');
      expect(recipeResult.outputFiles[0].path).toBe('recipes/testmod_recipe.json');
    });
  });

  describe('metadata tracking', () => {
    it('should track processing metadata correctly', async () => {
      const blocks: BlockInfo[] = [
        { identifier: 'testmod:block1', displayName: 'Block 1', textures: {} },
        { identifier: 'testmod:block2', displayName: 'Block 2', textures: {} },
      ];

      const result = await generator.generateBlockDefinitions(blocks);

      expect(result.metadata.processedCount).toBe(2);
      expect(result.metadata.successCount).toBe(2);
      expect(result.metadata.failureCount).toBe(0);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.totalSize).toBeGreaterThan(0);
    });
  });
});
