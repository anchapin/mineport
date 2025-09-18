/**
 * BlockItemGenerator - Block and item definition generation agent
 *
 * Handles generation of Bedrock block and item definitions from Java mod data
 */

import {
  BlockInfo,
  ItemInfo,
  RecipeInfo,
  BlockDefinition,
  ItemDefinition,
  RecipeDefinition,
  ConversionAgentResult,
  ConversionMetadata,
  OutputFile,
} from './types.js';
import {
  ConversionError,
  AssetConversionNote,
  createConversionError,
  ErrorType,
  ErrorSeverity,
  createErrorCode,
} from '../../types/errors.js';

/**
 * Block and item definition generation agent
 */
export class BlockItemGenerator {
  private static readonly MODULE_NAME = 'BlockItemGenerator';

  // Bedrock format constants
  private static readonly BLOCK_FORMAT_VERSION = '1.20.0';
  private static readonly ITEM_FORMAT_VERSION = '1.20.0';
  private static readonly RECIPE_FORMAT_VERSION = '1.20.0';

  // Default component values
  private static readonly DEFAULT_HARDNESS = 1.0;
  private static readonly DEFAULT_RESISTANCE = 1.0;
  private static readonly DEFAULT_STACK_SIZE = 64;

  /**
   * Generate block definitions from block information
   */
  async generateBlockDefinitions(blocks: BlockInfo[]): Promise<ConversionAgentResult> {
    const startTime = Date.now();
    const outputFiles: OutputFile[] = [];
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];
    let successCount = 0;
    let totalSize = 0;

    for (const block of blocks) {
      try {
        // Check for invalid identifier
        if (!block.identifier || block.identifier.trim() === '') {
          throw new Error('Block identifier is empty or invalid');
        }

        const definition = this.createBlockDefinition(block);
        const validationResult = this.validateDefinitionSyntax(definition);

        if (!validationResult.isValid) {
          // Add validation errors but continue processing
          for (const error of validationResult.errors) {
            warnings.push({
              type: ErrorSeverity.WARNING,
              message: `Block ${block.identifier} validation warning: ${error}`,
              component: 'model',
              details: { blockId: block.identifier, validationError: error },
            });
          }
        }

        const content = JSON.stringify(definition, null, 2);
        outputFiles.push({
          path: `blocks/${block.identifier.replace(':', '_')}.json`,
          content,
          type: 'json',
          originalPath: block.identifier,
        });

        successCount++;
        totalSize += content.length;
      } catch (error) {
        const conversionError = createConversionError({
          code: createErrorCode('BLKGEN', 'BLK', 1),
          type: ErrorType.ASSET,
          severity: ErrorSeverity.ERROR,
          message: `Failed to generate block definition for ${block.identifier || 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          moduleOrigin: BlockItemGenerator.MODULE_NAME,
          details: { blockId: block.identifier },
        });
        errors.push(conversionError);
      }
    }

    const metadata: ConversionMetadata = {
      processedCount: blocks.length,
      successCount,
      failureCount: blocks.length - successCount,
      processingTime: Date.now() - startTime,
      totalSize,
    };

    return {
      success: errors.length === 0,
      outputFiles,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Generate item definitions from item information
   */
  async generateItemDefinitions(items: ItemInfo[]): Promise<ConversionAgentResult> {
    const startTime = Date.now();
    const outputFiles: OutputFile[] = [];
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];
    let successCount = 0;
    let totalSize = 0;

    for (const item of items) {
      try {
        const definition = this.createItemDefinition(item);
        const validationResult = this.validateDefinitionSyntax(definition);

        if (!validationResult.isValid) {
          // Add validation errors but continue processing
          for (const error of validationResult.errors) {
            warnings.push({
              type: ErrorSeverity.WARNING,
              message: `Item ${item.identifier} validation warning: ${error}`,
              component: 'model',
              details: { itemId: item.identifier, validationError: error },
            });
          }
        }

        const content = JSON.stringify(definition, null, 2);
        outputFiles.push({
          path: `items/${item.identifier.replace(':', '_')}.json`,
          content,
          type: 'json',
          originalPath: item.identifier,
        });

        successCount++;
        totalSize += content.length;
      } catch (error) {
        const conversionError = createConversionError({
          code: createErrorCode('BLKGEN', 'ITM', 1),
          type: ErrorType.ASSET,
          severity: ErrorSeverity.ERROR,
          message: `Failed to generate item definition for ${item.identifier}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          moduleOrigin: BlockItemGenerator.MODULE_NAME,
          details: { itemId: item.identifier },
        });
        errors.push(conversionError);
      }
    }

    const metadata: ConversionMetadata = {
      processedCount: items.length,
      successCount,
      failureCount: items.length - successCount,
      processingTime: Date.now() - startTime,
      totalSize,
    };

    return {
      success: errors.length === 0,
      outputFiles,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Generate recipe definitions from recipe information
   */
  async createRecipeDefinitions(recipes: RecipeInfo[]): Promise<ConversionAgentResult> {
    const startTime = Date.now();
    const outputFiles: OutputFile[] = [];
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];
    let successCount = 0;
    let totalSize = 0;

    for (const recipe of recipes) {
      try {
        const definition = this.createRecipeDefinition(recipe);
        const validationResult = this.validateDefinitionSyntax(definition);

        if (!validationResult.isValid) {
          // Add validation errors but continue processing
          for (const error of validationResult.errors) {
            warnings.push({
              type: ErrorSeverity.WARNING,
              message: `Recipe ${recipe.identifier} validation warning: ${error}`,
              component: 'model',
              details: { recipeId: recipe.identifier, validationError: error },
            });
          }
        }

        const content = JSON.stringify(definition, null, 2);
        outputFiles.push({
          path: `recipes/${recipe.identifier.replace(':', '_')}.json`,
          content,
          type: 'json',
          originalPath: recipe.identifier,
        });

        successCount++;
        totalSize += content.length;
      } catch (error) {
        const conversionError = createConversionError({
          code: createErrorCode('BLKGEN', 'RCP', 1),
          type: ErrorType.ASSET,
          severity: ErrorSeverity.ERROR,
          message: `Failed to generate recipe definition for ${recipe.identifier}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          moduleOrigin: BlockItemGenerator.MODULE_NAME,
          details: { recipeId: recipe.identifier },
        });
        errors.push(conversionError);
      }
    }

    const metadata: ConversionMetadata = {
      processedCount: recipes.length,
      successCount,
      failureCount: recipes.length - successCount,
      processingTime: Date.now() - startTime,
      totalSize,
    };

    return {
      success: errors.length === 0,
      outputFiles,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Create a Bedrock block definition from block info
   */
  private createBlockDefinition(block: BlockInfo): BlockDefinition {
    const definition: BlockDefinition = {
      format_version: BlockItemGenerator.BLOCK_FORMAT_VERSION,
      'minecraft:block': {
        description: {
          identifier: block.identifier,
          properties: block.properties || {},
          states: this.convertPropertiesToStates(block.properties || {}),
        },
        components: this.createBlockComponents(block),
        permutations: block.permutations || [],
      },
    };

    return definition;
  }

  /**
   * Create a Bedrock item definition from item info
   */
  private createItemDefinition(item: ItemInfo): ItemDefinition {
    const definition: ItemDefinition = {
      format_version: BlockItemGenerator.ITEM_FORMAT_VERSION,
      'minecraft:item': {
        description: {
          identifier: item.identifier,
          category: item.category || 'items',
        },
        components: this.createItemComponents(item),
      },
    };

    return definition;
  }

  /**
   * Create a Bedrock recipe definition from recipe info
   */
  private createRecipeDefinition(recipe: RecipeInfo): RecipeDefinition {
    const definition: RecipeDefinition = {
      format_version: BlockItemGenerator.RECIPE_FORMAT_VERSION,
    };

    switch (recipe.type) {
      case 'crafting_shaped':
        definition['minecraft:recipe_shaped'] = {
          description: {
            identifier: recipe.identifier,
          },
          tags: recipe.tags || ['crafting_table'],
          pattern: this.convertShapedPattern(recipe.input),
          key: this.convertShapedKey(recipe.input),
          result: this.convertRecipeOutput(recipe.output),
        };
        break;

      case 'crafting_shapeless':
        definition['minecraft:recipe_shapeless'] = {
          description: {
            identifier: recipe.identifier,
          },
          tags: recipe.tags || ['crafting_table'],
          ingredients: this.convertShapelessIngredients(recipe.input),
          result: this.convertRecipeOutput(recipe.output),
        };
        break;

      case 'furnace':
        definition['minecraft:recipe_furnace'] = {
          description: {
            identifier: recipe.identifier,
          },
          tags: recipe.tags || ['furnace'],
          input: this.convertFurnaceInput(recipe.input),
          output: this.convertRecipeOutput(recipe.output),
        };
        break;

      case 'stonecutter':
        definition['minecraft:recipe_stonecutter'] = {
          description: {
            identifier: recipe.identifier,
          },
          tags: recipe.tags || ['stonecutter'],
          input: this.convertStonecutterInput(recipe.input),
          output: this.convertRecipeOutput(recipe.output),
        };
        break;

      case 'smithing':
        definition['minecraft:recipe_smithing_transform'] = {
          description: {
            identifier: recipe.identifier,
          },
          tags: recipe.tags || ['smithing_table'],
          template: this.convertSmithingTemplate(recipe.input),
          base: this.convertSmithingBase(recipe.input),
          addition: this.convertSmithingAddition(recipe.input),
          result: this.convertRecipeOutput(recipe.output),
        };
        break;

      default:
        throw new Error(`Unsupported recipe type: ${recipe.type}`);
    }

    return definition;
  }

  /**
   * Create block components from block info
   */
  private createBlockComponents(block: BlockInfo): Record<string, any> {
    const components: Record<string, any> = {
      'minecraft:material_instances': this.createMaterialInstances(block.textures),
      'minecraft:geometry': {
        identifier: `geometry.${block.identifier.replace(':', '.')}`,
      },
      'minecraft:destructible_by_mining': {
        seconds_to_destroy: BlockItemGenerator.DEFAULT_HARDNESS,
      },
      'minecraft:destructible_by_explosion': {
        explosion_resistance: BlockItemGenerator.DEFAULT_RESISTANCE,
      },
    };

    // Add custom components if provided
    if (block.components) {
      Object.assign(components, block.components);
    }

    // Add collision and selection boxes
    components['minecraft:collision_box'] = {
      origin: [-8, 0, -8],
      size: [16, 16, 16],
    };
    components['minecraft:selection_box'] = {
      origin: [-8, 0, -8],
      size: [16, 16, 16],
    };

    return components;
  }

  /**
   * Create item components from item info
   */
  private createItemComponents(item: ItemInfo): Record<string, any> {
    const components: Record<string, any> = {
      'minecraft:icon': {
        texture: item.texture || item.identifier.replace(':', '.'),
      },
      'minecraft:max_stack_size': item.maxStackSize || BlockItemGenerator.DEFAULT_STACK_SIZE,
      'minecraft:hand_equipped': false,
      'minecraft:stacked_by_data': true,
    };

    // Add custom components if provided
    if (item.components) {
      Object.assign(components, item.components);
    }

    return components;
  }

  /**
   * Create material instances for block textures
   */
  private createMaterialInstances(textures: Record<string, string>): Record<string, any> {
    const instances: Record<string, any> = {};

    // Default material instance
    instances['*'] = {
      texture: textures.all || textures.side || Object.values(textures)[0] || 'stone',
      render_method: 'opaque',
    };

    // Face-specific instances
    const faceMap = {
      up: 'top',
      down: 'bottom',
      north: 'north',
      south: 'south',
      east: 'east',
      west: 'west',
    };

    for (const [face, bedrockFace] of Object.entries(faceMap)) {
      if (textures[face]) {
        instances[bedrockFace] = {
          texture: textures[face],
          render_method: 'opaque',
        };
      }
    }

    return instances;
  }

  /**
   * Convert Java properties to Bedrock states
   */
  private convertPropertiesToStates(properties: Record<string, any>): Record<string, any> {
    const states: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === 'boolean') {
        states[key] = [false, true];
      } else if (typeof value === 'number') {
        // Assume it's a range from 0 to value
        states[key] = Array.from({ length: value + 1 }, (_, i) => i);
      } else if (Array.isArray(value)) {
        states[key] = value;
      } else {
        states[key] = [value];
      }
    }

    return states;
  }

  /**
   * Convert shaped recipe pattern
   */
  private convertShapedPattern(input: any): string[] {
    if (input.pattern && Array.isArray(input.pattern)) {
      return input.pattern;
    }
    if (Array.isArray(input) && Array.isArray(input[0])) {
      return input.map((row: any[]) => row.join(''));
    }
    return ['AAA', 'AAA', 'AAA']; // Default 3x3 pattern
  }

  /**
   * Convert shaped recipe key
   */
  private convertShapedKey(input: any): Record<string, any> {
    if (input.key) {
      return input.key;
    }
    return { A: { item: 'minecraft:stone' } }; // Default key
  }

  /**
   * Convert shapeless ingredients
   */
  private convertShapelessIngredients(input: any): any[] {
    if (Array.isArray(input)) {
      return input.map((ingredient) => ({ item: ingredient }));
    }
    return [{ item: 'minecraft:stone' }]; // Default ingredient
  }

  /**
   * Convert furnace input
   */
  private convertFurnaceInput(input: any): any {
    if (typeof input === 'string') {
      return { item: input };
    }
    return input || { item: 'minecraft:stone' };
  }

  /**
   * Convert stonecutter input
   */
  private convertStonecutterInput(input: any): any {
    if (typeof input === 'string') {
      return { item: input };
    }
    return input || { item: 'minecraft:stone' };
  }

  /**
   * Convert smithing template
   */
  private convertSmithingTemplate(input: any): any {
    return input.template || { item: 'minecraft:netherite_upgrade_smithing_template' };
  }

  /**
   * Convert smithing base
   */
  private convertSmithingBase(input: any): any {
    return input.base || { item: 'minecraft:diamond_sword' };
  }

  /**
   * Convert smithing addition
   */
  private convertSmithingAddition(input: any): any {
    return input.addition || { item: 'minecraft:netherite_ingot' };
  }

  /**
   * Convert recipe output
   */
  private convertRecipeOutput(output: any): any {
    if (typeof output === 'string') {
      return { item: output, count: 1 };
    }
    return output || { item: 'minecraft:stone', count: 1 };
  }

  /**
   * Validate definition syntax
   */
  validateDefinitionSyntax(definition: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check format version
    if (!definition.format_version) {
      errors.push('Missing format_version');
    }

    // Check for main object
    const mainKey = Object.keys(definition).find((key) => key.startsWith('minecraft:'));
    if (!mainKey) {
      errors.push('Missing main minecraft: object');
      return { isValid: false, errors };
    }

    const mainObject = definition[mainKey];

    // Check description
    if (!mainObject.description) {
      errors.push('Missing description object');
    } else {
      if (!mainObject.description.identifier) {
        errors.push('Missing identifier in description');
      }
    }

    // Check components (for blocks and items)
    if (mainKey.includes('block') || mainKey.includes('item')) {
      if (!mainObject.components) {
        errors.push('Missing components object');
      }
    }

    // Validate identifier format
    if (mainObject.description?.identifier) {
      const identifier = mainObject.description.identifier;
      if (!identifier.includes(':')) {
        errors.push('Identifier should include namespace (e.g., "modid:itemname")');
      }
      if (identifier.includes(' ')) {
        errors.push('Identifier should not contain spaces');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
