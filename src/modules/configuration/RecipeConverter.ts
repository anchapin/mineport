/**
 * RecipeConverter Component
 *
 * This component is responsible for transforming Java recipe JSON files to Bedrock format.
 * It implements parsing of Java recipe files, creates transformation logic for Bedrock recipe format,
 * and adds validation for converted recipes.
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger.js';

// Recipe types in Java and their Bedrock equivalents
const RECIPE_TYPE_MAPPINGS: Record<string, string> = {
  'minecraft:crafting_shaped': 'crafting_table',
  'minecraft:crafting_shapeless': 'crafting_table',
  'minecraft:smelting': 'furnace',
  'minecraft:blasting': 'blast_furnace',
  'minecraft:smoking': 'smoker',
  'minecraft:campfire_cooking': 'campfire',
  'minecraft:stonecutting': 'stonecutter',
  'minecraft:smithing': 'smithing_table',
};

/**
 * JavaRecipe interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface JavaRecipe {
  type: string;
  pattern?: string[];
  key?: Record<string, { item: string } | { tag: string }>;
  ingredients?: Array<
    { item: string } | { tag: string } | Array<{ item: string } | { tag: string }>
  >;
  result: { item: string; count?: number };
  experience?: number;
  cookingtime?: number;
  base?: { item: string } | { tag: string };
  addition?: { item: string } | { tag: string };
  sourceFile: string;
}

/**
 * BedrockRecipe interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockRecipe {
  format_version: string;
  'minecraft:recipe_shaped'?: {
    description: {
      identifier: string;
    };
    tags: string[];
    pattern: string[];
    key: Record<string, { item: string }>;
    result: { item: string; count?: number };
  };
  'minecraft:recipe_shapeless'?: {
    description: {
      identifier: string;
    };
    tags: string[];
    ingredients: Array<{ item: string; count?: number }>;
    result: { item: string; count?: number };
  };
  'minecraft:recipe_furnace'?: {
    description: {
      identifier: string;
    };
    tags: string[];
    input: { item: string };
    output: { item: string; count?: number };
  };
  'minecraft:recipe_brewing_mix'?: {
    description: {
      identifier: string;
    };
    tags: string[];
    input: { item: string };
    reagent: { item: string };
    output: { item: string };
  };
}

/**
 * RecipeConversionResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface RecipeConversionResult {
  success: boolean;
  recipes: BedrockRecipe[];
  errors?: string[];
  conversionNotes: RecipeConversionNote[];
}

/**
 * RecipeConversionNote interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
import { ErrorSeverity } from '../../types/errors.js';

export interface RecipeConversionNote {
  type: ErrorSeverity;
  component: 'recipe';
  message: string;
  details?: string;
  sourceFile?: string;
}

/**
 * RecipeConverter class.
 *
 * TODO: Add detailed description of the class purpose and functionality.
 *
 * @since 1.0.0
 */
export class RecipeConverter {
  /**
   * Parses Java recipe JSON files from a directory
   * @param recipeDir Directory containing Java recipe JSON files
   * @param modId Mod ID for namespace
   * @returns Promise<JavaRecipe[]> Array of parsed Java recipes
   */
  async parseJavaRecipes(recipeDir: string, _modId: string): Promise<JavaRecipe[]> {
    try {
      const recipes: JavaRecipe[] = [];
      const recipeFiles = await this.findJsonFiles(recipeDir);

      logger.info(`Found ${recipeFiles.length} recipe files to parse`);

      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const file of recipeFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const recipe = JSON.parse(content) as JavaRecipe;

          // Add source file information
          recipe.sourceFile = file;

          // Only process recipes with valid types
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (recipe.type && Object.keys(RECIPE_TYPE_MAPPINGS).includes(recipe.type)) {
            recipes.push(recipe);
            logger.info(`Parsed recipe from ${file}`);
          } else {
            logger.warn(`Skipping unsupported recipe type: ${recipe.type}`, { file });
          }
        } catch (error) {
          logger.error(`Error parsing recipe file: ${file}`, { error });
        }
      }

      return recipes;
    } catch (error) {
      logger.error('Error parsing Java recipes', { error });
      throw new Error(`Failed to parse Java recipes: ${(error as Error).message}`);
    }
  }

  /**
   * Converts Java recipes to Bedrock format
   * @param recipes Array of Java recipes
   * @param modId Mod ID for namespace
   * @returns RecipeConversionResult with converted recipes
   */
  convertRecipes(recipes: JavaRecipe[], modId: string): RecipeConversionResult {
    try {
      const bedrockRecipes: BedrockRecipe[] = [];
      const conversionNotes: RecipeConversionNote[] = [];
      const errors: string[] = [];

      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const recipe of recipes) {
        try {
          // Generate a unique identifier for the recipe
          const recipeId = this.generateRecipeId(recipe, modId);

          // Convert based on recipe type
          /**
           * switch method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          switch (recipe.type) {
            case 'minecraft:crafting_shaped':
              bedrockRecipes.push(this.convertShapedRecipe(recipe, recipeId));
              break;

            case 'minecraft:crafting_shapeless':
              bedrockRecipes.push(this.convertShapelessRecipe(recipe, recipeId));
              break;

            case 'minecraft:smelting':
            case 'minecraft:blasting':
            case 'minecraft:smoking':
            case 'minecraft:campfire_cooking':
              bedrockRecipes.push(this.convertFurnaceRecipe(recipe, recipeId));
              break;

            case 'minecraft:stonecutting':
              bedrockRecipes.push(this.convertStonecuttingRecipe(recipe, recipeId));
              break;

            case 'minecraft:smithing':
              bedrockRecipes.push(this.convertSmithingRecipe(recipe, recipeId));
              break;

            default:
              throw new Error(`Unsupported recipe type: ${recipe.type}`);
          }

          conversionNotes.push({
            type: ErrorSeverity.INFO,
            component: 'recipe',
            message: `Successfully converted ${recipe.type} recipe to Bedrock format`,
            sourceFile: recipe.sourceFile,
          });
        } catch (error) {
          const errorMessage = `Failed to convert recipe: ${(error as Error).message}`;
          errors.push(errorMessage);

          conversionNotes.push({
            type: ErrorSeverity.ERROR,
            component: 'recipe',
            message: errorMessage,
            sourceFile: recipe.sourceFile,
          });
        }
      }

      // Check for potential issues
      const tagWarnings = this.checkForTagUsage(recipes);
      conversionNotes.push(...tagWarnings);

      return {
        success: errors.length === 0,
        recipes: bedrockRecipes,
        errors: errors.length > 0 ? errors : undefined,
        conversionNotes,
      };
    } catch (error) {
      logger.error('Error converting recipes', { error });
      return {
        success: false,
        recipes: [],
        errors: [`Failed to convert recipes: ${(error as Error).message}`],
        conversionNotes: [
          {
            type: ErrorSeverity.ERROR,
            component: 'recipe',
            message: `Failed to convert recipes: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  /**
   * Writes Bedrock recipes to output directory
   * @param result RecipeConversionResult with recipes
   * @param behaviorPackDir Directory for the behavior pack
   * @returns Promise<boolean> indicating success
   */
  async writeRecipes(result: RecipeConversionResult, behaviorPackDir: string): Promise<boolean> {
    try {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!result.success) {
        logger.error('Cannot write invalid recipes', { result });
        return false;
      }

      // Ensure recipes directory exists
      const recipesDir = path.join(behaviorPackDir, 'recipes');
      await fs.mkdir(recipesDir, { recursive: true });

      // Write recipe files
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const recipe of result.recipes) {
        // Determine recipe type and identifier
        let recipeType: string;
        let identifier: string;

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (recipe['minecraft:recipe_shaped']) {
          recipeType = 'shaped';
          identifier = recipe['minecraft:recipe_shaped'].description.identifier;
        } else if (recipe['minecraft:recipe_shapeless']) {
          recipeType = 'shapeless';
          identifier = recipe['minecraft:recipe_shapeless'].description.identifier;
        } else if (recipe['minecraft:recipe_furnace']) {
          recipeType = 'furnace';
          identifier = recipe['minecraft:recipe_furnace'].description.identifier;
        } else if (recipe['minecraft:recipe_brewing_mix']) {
          recipeType = 'brewing';
          identifier = recipe['minecraft:recipe_brewing_mix'].description.identifier;
        } else {
          logger.warn('Unknown recipe type, skipping', { recipe });
          continue;
        }

        const fileName = `${identifier.replace(':', '_')}.json`;

        await fs.writeFile(path.join(recipesDir, fileName), JSON.stringify(recipe, null, 2));

        logger.info(`Wrote ${recipeType} recipe: ${fileName}`);
      }

      logger.info('Recipes written successfully', { recipeCount: result.recipes.length });
      return true;
    } catch (error) {
      logger.error('Error writing recipes', { error });
      return false;
    }
  }

  /**
   * Validates a Bedrock recipe against specifications
   * @param recipe BedrockRecipe to validate
   * @returns Object with validation result and errors
   */
  validateRecipe(recipe: BedrockRecipe): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check format version
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!recipe.format_version) {
      errors.push('Missing format_version');
    }

    // Check for recipe type
    const recipeTypes = [
      'minecraft:recipe_shaped',
      'minecraft:recipe_shapeless',
      'minecraft:recipe_furnace',
      'minecraft:recipe_brewing_mix',
    ];

    const hasValidType = recipeTypes.some((type) => recipe[type as keyof BedrockRecipe]);

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!hasValidType) {
      errors.push('Recipe must have one of the valid recipe types');
    }

    // Validate shaped recipe
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (recipe['minecraft:recipe_shaped']) {
      const shaped = recipe['minecraft:recipe_shaped'];

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!shaped.description || !shaped.description.identifier) {
        errors.push('Shaped recipe missing identifier');
      }

      if (!shaped.tags || !Array.isArray(shaped.tags) || shaped.tags.length === 0) {
        errors.push('Shaped recipe missing tags');
      }

      if (!shaped.pattern || !Array.isArray(shaped.pattern) || shaped.pattern.length === 0) {
        errors.push('Shaped recipe missing pattern');
      }

      if (!shaped.key || typeof shaped.key !== 'object') {
        errors.push('Shaped recipe missing key');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!shaped.result || !shaped.result.item) {
        errors.push('Shaped recipe missing result');
      }
    }

    // Validate shapeless recipe
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (recipe['minecraft:recipe_shapeless']) {
      const shapeless = recipe['minecraft:recipe_shapeless'];

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!shapeless.description || !shapeless.description.identifier) {
        errors.push('Shapeless recipe missing identifier');
      }

      if (!shapeless.tags || !Array.isArray(shapeless.tags) || shapeless.tags.length === 0) {
        errors.push('Shapeless recipe missing tags');
      }

      if (
        !shapeless.ingredients ||
        !Array.isArray(shapeless.ingredients) ||
        shapeless.ingredients.length === 0
      ) {
        errors.push('Shapeless recipe missing ingredients');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!shapeless.result || !shapeless.result.item) {
        errors.push('Shapeless recipe missing result');
      }
    }

    // Validate furnace recipe
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (recipe['minecraft:recipe_furnace']) {
      const furnace = recipe['minecraft:recipe_furnace'];

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!furnace.description || !furnace.description.identifier) {
        errors.push('Furnace recipe missing identifier');
      }

      if (!furnace.tags || !Array.isArray(furnace.tags) || furnace.tags.length === 0) {
        errors.push('Furnace recipe missing tags');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!furnace.input || !furnace.input.item) {
        errors.push('Furnace recipe missing input');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!furnace.output || !furnace.output.item) {
        errors.push('Furnace recipe missing output');
      }
    }

    // Validate brewing recipe
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (recipe['minecraft:recipe_brewing_mix']) {
      const brewing = recipe['minecraft:recipe_brewing_mix'];

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!brewing.description || !brewing.description.identifier) {
        errors.push('Brewing recipe missing identifier');
      }

      if (!brewing.tags || !Array.isArray(brewing.tags) || brewing.tags.length === 0) {
        errors.push('Brewing recipe missing tags');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!brewing.input || !brewing.input.item) {
        errors.push('Brewing recipe missing input');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!brewing.reagent || !brewing.reagent.item) {
        errors.push('Brewing recipe missing reagent');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!brewing.output || !brewing.output.item) {
        errors.push('Brewing recipe missing output');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Finds all JSON files in a directory recursively
   * @param dir Directory to search
   * @returns Promise<string[]> Array of JSON file paths
   */
  private async findJsonFiles(dir: string): Promise<string[]> {
    const jsonFiles: string[] = [];

    async function scanDir(currentDir: string) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        /**
         * for method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            jsonFiles.push(fullPath);
          }
        }
      } catch (error) {
        logger.error(`Error scanning directory: ${currentDir}`, { error });
      }
    }

    await scanDir(dir);
    return jsonFiles;
  }

  /**
   * Generates a unique identifier for a recipe
   * @param recipe Java recipe
   * @param modId Mod ID for namespace
   * @returns String identifier for the recipe
   */
  private generateRecipeId(recipe: JavaRecipe, modId: string): string {
    // Extract the result item name
    const resultItem = recipe.result.item;
    const resultName = resultItem.split(':').pop() || 'unknown';

    // Extract recipe type
    const recipeType = recipe.type.split(':').pop() || 'recipe';

    // Generate a unique suffix based on the source file
    const sourceFile = path.basename(recipe.sourceFile, '.json');

    return `${modId}:${recipeType}_${resultName}_${sourceFile}`;
  }

  /**
   * Converts a Java item identifier to Bedrock format
   * @param javaItem Java item identifier
   * @returns Bedrock item identifier
   */
  private convertItemId(javaItem: string): string {
    // If it's already a namespaced ID, return as is
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (javaItem.includes(':')) {
      return javaItem;
    }

    // Otherwise, add the minecraft namespace
    return `minecraft:${javaItem}`;
  }

  /**
   * Converts a Java shaped crafting recipe to Bedrock format
   * @param recipe Java shaped recipe
   * @param recipeId Unique identifier for the recipe
   * @returns BedrockRecipe in shaped format
   */
  private convertShapedRecipe(recipe: JavaRecipe, recipeId: string): BedrockRecipe {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!recipe.pattern || !recipe.key) {
      throw new Error('Shaped recipe missing pattern or key');
    }

    // Convert the key to Bedrock format
    const bedrockKey: Record<string, { item: string }> = {};

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [keyChar, keyValue] of Object.entries(recipe.key)) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if ('item' in keyValue) {
        bedrockKey[keyChar] = { item: this.convertItemId(keyValue.item) };
      } else if ('tag' in keyValue) {
        // Bedrock doesn't support tags directly, so we'll use a placeholder
        // In a real implementation, we would need to handle this more robustly
        bedrockKey[keyChar] = { item: `minecraft:placeholder_for_tag_${keyValue.tag}` };
      }
    }

    return {
      format_version: '1.19.0',
      'minecraft:recipe_shaped': {
        description: {
          identifier: recipeId,
        },
        tags: ['crafting_table'],
        pattern: recipe.pattern,
        key: bedrockKey,
        result: {
          item: this.convertItemId(recipe.result.item),
          count: recipe.result.count || 1,
        },
      },
    };
  }

  /**
   * Converts a Java shapeless crafting recipe to Bedrock format
   * @param recipe Java shapeless recipe
   * @param recipeId Unique identifier for the recipe
   * @returns BedrockRecipe in shapeless format
   */
  private convertShapelessRecipe(recipe: JavaRecipe, recipeId: string): BedrockRecipe {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!recipe.ingredients) {
      throw new Error('Shapeless recipe missing ingredients');
    }

    // Convert ingredients to Bedrock format
    const bedrockIngredients: Array<{ item: string; count?: number }> = [];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const ingredient of recipe.ingredients) {
      bedrockIngredients.push({ item: this.getIngredientItem(ingredient) });
    }

    return {
      format_version: '1.19.0',
      'minecraft:recipe_shapeless': {
        description: {
          identifier: recipeId,
        },
        tags: ['crafting_table'],
        ingredients: bedrockIngredients,
        result: {
          item: this.convertItemId(recipe.result.item),
          count: recipe.result.count || 1,
        },
      },
    };
  }

  /**
   * Gets the item identifier from a Java recipe ingredient
   * @param ingredient The ingredient to process
   * @returns The item identifier string
   */
  private getIngredientItem(ingredient: { item: string } | { tag: string } | Array<{ item: string } | { tag: string }>): string {
    if (Array.isArray(ingredient)) {
      if (ingredient.length > 0) {
        const itemOrTag = ingredient[0];
        if ('item' in itemOrTag) {
          return this.convertItemId(itemOrTag.item);
        } else if ('tag' in itemOrTag) {
          return `minecraft:placeholder_for_tag_${itemOrTag.tag}`;
        }
      }
      throw new Error('Invalid ingredient');
    } else if ('item' in ingredient) {
      return this.convertItemId(ingredient.item);
    } else if ('tag' in ingredient) {
      return `minecraft:placeholder_for_tag_${ingredient.tag}`;
    }
    throw new Error('Invalid ingredient');
  }

  /**
   * Converts a Java furnace-type recipe to Bedrock format
   * @param recipe Java furnace recipe
   * @param recipeId Unique identifier for the recipe
   * @returns BedrockRecipe in furnace format
   */
  private convertFurnaceRecipe(recipe: JavaRecipe, recipeId: string): BedrockRecipe {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!recipe.ingredients) {
      throw new Error('Furnace recipe missing ingredient');
    }

    // Determine the input item
    const inputItem = this.getIngredientItem(recipe.ingredients[0]);

    // Determine the tag based on the recipe type
    const tag = RECIPE_TYPE_MAPPINGS[recipe.type] || 'furnace';

    return {
      format_version: '1.19.0',
      'minecraft:recipe_furnace': {
        description: {
          identifier: recipeId,
        },
        tags: [tag],
        input: { item: inputItem },
        output: {
          item: this.convertItemId(recipe.result.item),
          count: recipe.result.count || 1,
        },
      },
    };
  }

  /**
   * Converts a Java stonecutting recipe to Bedrock format
   * @param recipe Java stonecutting recipe
   * @param recipeId Unique identifier for the recipe
   * @returns BedrockRecipe in furnace format (Bedrock uses furnace format for stonecutting)
   */
  private convertStonecuttingRecipe(recipe: JavaRecipe, recipeId: string): BedrockRecipe {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!recipe.ingredients) {
      throw new Error('Stonecutting recipe missing ingredient');
    }

    // Determine the input item
    const inputItem = this.getIngredientItem(recipe.ingredients[0]);

    return {
      format_version: '1.19.0',
      'minecraft:recipe_furnace': {
        description: {
          identifier: recipeId,
        },
        tags: ['stonecutter'],
        input: { item: inputItem },
        output: {
          item: this.convertItemId(recipe.result.item),
          count: recipe.result.count || 1,
        },
      },
    };
  }

  /**
   * Converts a Java smithing recipe to Bedrock format
   * @param recipe Java smithing recipe
   * @param recipeId Unique identifier for the recipe
   * @returns BedrockRecipe in brewing format (closest Bedrock equivalent)
   */
  private convertSmithingRecipe(recipe: JavaRecipe, recipeId: string): BedrockRecipe {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!recipe.base || !recipe.addition) {
      throw new Error('Smithing recipe missing base or addition');
    }

    // Determine the base item
    const baseItem = this.getIngredientItem(recipe.base);

    // Determine the addition item
    const additionItem = this.getIngredientItem(recipe.addition);

    // Bedrock doesn't have a direct equivalent for smithing recipes,
    // so we'll use a brewing recipe as the closest approximation
    return {
      format_version: '1.19.0',
      'minecraft:recipe_brewing_mix': {
        description: {
          identifier: recipeId,
        },
        tags: ['smithing_table'],
        input: { item: baseItem },
        reagent: { item: additionItem },
        output: { item: this.convertItemId(recipe.result.item) },
      },
    };
  }

  /**
   * Checks for tag usage in recipes and generates warnings
   * @param recipes Array of Java recipes
   * @returns Array of conversion notes for tag usage
   */
  private checkForTagUsage(recipes: JavaRecipe[]): RecipeConversionNote[] {
    const notes: RecipeConversionNote[] = [];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const recipe of recipes) {
      // Check for tags in shaped recipe keys
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (recipe.key) {
        /**
         * for method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const [keyChar, keyValue] of Object.entries(recipe.key)) {
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if ('tag' in keyValue) {
            notes.push({
              type: ErrorSeverity.WARNING,
              component: 'recipe',
              message: `Recipe uses tag '${keyValue.tag}' which is not directly supported in Bedrock`,
              details: `Tag used in key '${keyChar}' of shaped recipe. A placeholder was used, but manual adjustment may be needed.`,
              sourceFile: recipe.sourceFile,
            });
          }
        }
      }

      // Check for tags in ingredients
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (recipe.ingredients) {
        const ingredients = recipe.ingredients;

        /**
         * for method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const ingredient of ingredients) {
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (Array.isArray(ingredient)) {
            /**
             * for method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            for (const option of ingredient) {
              /**
               * if method.
               *
               * TODO: Add detailed description of the method's purpose and behavior.
               *
               * @param param - TODO: Document parameters
               * @returns result - TODO: Document return value
               * @since 1.0.0
               */
              if ('tag' in option) {
                notes.push({
                  type: ErrorSeverity.WARNING,
                  component: 'recipe',
                  message: `Recipe uses tag '${option.tag}' which is not directly supported in Bedrock`,
                  details: `Tag used in ingredient alternatives. A placeholder was used, but manual adjustment may be needed.`,
                  sourceFile: recipe.sourceFile,
                });
              }
            }
          } else if ('tag' in ingredient) {
            notes.push({
              type: ErrorSeverity.WARNING,
              component: 'recipe',
              message: `Recipe uses tag '${ingredient.tag}' which is not directly supported in Bedrock`,
              details: `Tag used in ingredient. A placeholder was used, but manual adjustment may be needed.`,
              sourceFile: recipe.sourceFile,
            });
          }
        }
      }

      // Check for tags in base and addition
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (recipe.base && 'tag' in recipe.base) {
        notes.push({
          type: ErrorSeverity.WARNING,
          component: 'recipe',
          message: `Recipe uses tag '${recipe.base.tag}' which is not directly supported in Bedrock`,
          details: `Tag used in smithing recipe base. A placeholder was used, but manual adjustment may be needed.`,
          sourceFile: recipe.sourceFile,
        });
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (recipe.addition && 'tag' in recipe.addition) {
        notes.push({
          type: ErrorSeverity.WARNING,
          component: 'recipe',
          message: `Recipe uses tag '${recipe.addition.tag}' which is not directly supported in Bedrock`,
          details: `Tag used in smithing recipe addition. A placeholder was used, but manual adjustment may be needed.`,
          sourceFile: recipe.sourceFile,
        });
      }
    }

    return notes;
  }
}
