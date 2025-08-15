/**
 * LootTableConverter Component
 *
 * This component is responsible for transforming Java loot table JSON files to Bedrock format.
 * It implements parsing of Java loot table definitions, creates transformation logic for Bedrock loot tables,
 * and adds support for complex loot functions.
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger.js';

// Loot table pool function mappings between Java and Bedrock
const LOOT_FUNCTION_MAPPINGS: Record<string, string> = {
  'minecraft:set_count': 'set_count',
  'minecraft:set_damage': 'set_damage',
  'minecraft:set_name': 'set_name',
  'minecraft:set_lore': 'set_lore',
  'minecraft:enchant_with_levels': 'enchant_with_levels',
  'minecraft:enchant_randomly': 'enchant_randomly',
  'minecraft:set_nbt': 'set_data',
  'minecraft:furnace_smelt': 'furnace_smelt',
  'minecraft:looting_enchant': 'looting_enchant',
  'minecraft:explosion_decay': 'explosion_decay',
  'minecraft:apply_bonus': 'apply_bonus',
  'minecraft:set_attributes': 'set_attributes',
  'minecraft:set_contents': 'set_contents',
  'minecraft:limit_count': 'limit_count',
  'minecraft:copy_name': 'copy_name',
  'minecraft:copy_nbt': 'copy_data',
  'minecraft:exploration_map': 'exploration_map',
};

// Loot table condition mappings between Java and Bedrock
const LOOT_CONDITION_MAPPINGS: Record<string, string> = {
  'minecraft:random_chance': 'random_chance',
  'minecraft:random_chance_with_looting': 'random_chance_with_looting',
  'minecraft:entity_properties': 'entity_properties',
  'minecraft:killed_by_player': 'killed_by_player',
  'minecraft:entity_scores': 'entity_scores',
  'minecraft:match_tool': 'match_tool',
  'minecraft:weather_check': 'weather_check',
  'minecraft:time_check': 'time_check',
  'minecraft:inverted': 'inverted',
  'minecraft:alternative': 'alternative',
  'minecraft:reference': 'reference',
  'minecraft:block_state_property': 'block_state_property',
  'minecraft:damage_source_properties': 'damage_source_properties',
  'minecraft:location_check': 'location_check',
  'minecraft:survives_explosion': 'survives_explosion',
  'minecraft:table_bonus': 'table_bonus',
};

/**
 * JavaLootTable interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface JavaLootTable {
  type: string;
  pools?: JavaLootPool[];
  functions?: JavaLootFunction[];
  sourceFile: string;
}

/**
 * JavaLootPool interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface JavaLootPool {
  rolls: number | { min: number; max: number };
  bonus_rolls?: number | { min: number; max: number };
  entries: JavaLootEntry[];
  conditions?: JavaLootCondition[];
  functions?: JavaLootFunction[];
}

/**
 * JavaLootEntry interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface JavaLootEntry {
  type: string;
  name?: string;
  weight?: number;
  quality?: number;
  functions?: JavaLootFunction[];
  conditions?: JavaLootCondition[];
  children?: JavaLootEntry[];
  pools?: JavaLootPool[];
  // For item entries
  item?: string;
  // For tag entries
  tag?: string;
  // For loot table entries
  table?: string;
}

/**
 * JavaLootFunction interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface JavaLootFunction {
  function: string;
  count?: number | { min: number; max: number };
  damage?: number | { min: number; max: number };
  add?: boolean;
  name?: string;
  lore?: string[];
  levels?: number | { min: number; max: number };
  treasure?: boolean;
  enchantments?: { name: string; level: number }[];
  tag?: string;
  conditions?: JavaLootCondition[];
  limit?: number;
  // For apply_bonus function
  enchantment?: string;
  formula?: string;
  parameters?: Record<string, number>;
  // For set_attributes function
  modifiers?: Array<{
    name: string;
    attribute: string;
    operation: string;
    amount: number | { min: number; max: number };
    id?: string;
    slot?: string | string[];
  }>;
  // For set_contents function
  entries?: JavaLootEntry[];
  // For copy_nbt function
  source?: string;
  ops?: Array<{
    source: string;
    target: string;
    op: string;
  }>;
  // For exploration_map function
  destination?: string;
  decoration?: string;
  zoom?: number;
  search_radius?: number;
  skip_existing_chunks?: boolean;
}

/**
 * JavaLootCondition interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface JavaLootCondition {
  condition: string;
  chance?: number;
  looting_multiplier?: number;
  entity?: string;
  predicate?: Record<string, any>;
  killed_by_player?: boolean;
  scores?: Record<string, { min?: number; max?: number }>;
  item?: { items?: string[]; tag?: string };
  raining?: boolean;
  thundering?: boolean;
  value?: { min?: number; max?: number };
  term?: any; // Add missing term property
  terms?: any[]; // Add missing terms property
}

/**
 * BedrockLootTable interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockLootTable {
  pools: BedrockLootPool[];
}

/**
 * BedrockLootPool interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockLootPool {
  rolls: number | { min: number; max: number };
  entries: BedrockLootEntry[];
  conditions?: BedrockLootCondition[];
}

/**
 * BedrockLootEntry interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockLootEntry {
  type: string;
  name?: string;
  weight?: number;
  quality?: number;
  functions?: BedrockLootFunction[];
  conditions?: BedrockLootCondition[];
  // For item entries
  item?: string;
  // For loot table entries
  table?: string;
  // For empty entries
  empty?: boolean;
}

/**
 * BedrockLootFunction interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockLootFunction {
  function: string;
  count?: number | { min: number; max: number };
  damage?: number | { min: number; max: number };
  add?: boolean;
  name?: string;
  lore?: string[];
  levels?: number | { min: number; max: number };
  treasure?: boolean;
  enchants?: { id: string; level: number }[];
  data?: string;
  conditions?: BedrockLootCondition[];
  limit?: number;
  // For apply_bonus function
  enchantment?: string;
  formula?: string;
  parameters?: Record<string, number>;
  // For set_attributes function
  modifiers?: Array<{
    name: string;
    attribute: string;
    operation: string;
    amount: number | { min: number; max: number };
    id?: string;
    slot?: string | string[];
  }>;
  // For set_contents function
  entries?: BedrockLootEntry[];
  // For copy_data function (equivalent to copy_nbt)
  source?: string;
  ops?: Array<{
    source: string;
    target: string;
    op: string;
  }>;
  // For exploration_map function
  destination?: string;
  decoration?: string;
  zoom?: number;
  search_radius?: number;
  skip_existing_chunks?: boolean;
}

/**
 * BedrockLootCondition interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockLootCondition {
  condition: string;
  chance?: number;
  looting_multiplier?: number;
  entity_properties?: Record<string, any>;
  killed_by_player?: boolean;
  scores?: Record<string, { min?: number; max?: number }>;
  item?: { items?: string[] };
  raining?: boolean;
  thundering?: boolean;
  value?: { min?: number; max?: number };
  term?: any; // Add missing term property
}

/**
 * LootTableConversionResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface LootTableConversionResult {
  success: boolean;
  lootTables: Record<string, BedrockLootTable>;
  errors?: string[];
  conversionNotes: LootTableConversionNote[];
}

/**
 * LootTableConversionNote interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface LootTableConversionNote {
  type: 'info' | 'warning' | 'error';
  component: 'loot_table';
  message: string;
  details?: string;
  sourceFile?: string;
}

/**
 * LootTableConverter class.
 *
 * TODO: Add detailed description of the class purpose and functionality.
 *
 * @since 1.0.0
 */
export class LootTableConverter {
  /**
   * Parses Java loot table JSON files from a directory
   * @param lootTableDir Directory containing Java loot table JSON files
   * @returns Promise<JavaLootTable[]> Array of parsed Java loot tables
   */
  async parseJavaLootTables(lootTableDir: string): Promise<JavaLootTable[]> {
    try {
      const lootTables: JavaLootTable[] = [];
      const lootTableFiles = await this.findJsonFiles(lootTableDir);

      logger.info(`Found ${lootTableFiles.length} loot table files to parse`);

      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const file of lootTableFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const lootTable = JSON.parse(content) as JavaLootTable;

          // Add source file information
          lootTable.sourceFile = file;

          // Only process loot tables with valid types
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (lootTable.type) {
            lootTables.push(lootTable);
            logger.info(`Parsed loot table from ${file}`);
          } else {
            logger.warn(`Skipping invalid loot table: missing type`, { file });
          }
        } catch (error) {
          logger.error(`Error parsing loot table file: ${file}`, { error });
        }
      }

      return lootTables;
    } catch (error) {
      logger.error('Error parsing Java loot tables', { error });
      throw new Error(`Failed to parse Java loot tables: ${(error as Error).message}`);
    }
  }

  /**
   * Converts Java loot tables to Bedrock format
   * @param lootTables Array of Java loot tables
   * @param modId Mod ID for namespace
   * @returns LootTableConversionResult with converted loot tables
   */
  convertLootTables(lootTables: JavaLootTable[], modId: string): LootTableConversionResult {
    try {
      const bedrockLootTables: Record<string, BedrockLootTable> = {};
      const conversionNotes: LootTableConversionNote[] = [];
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
      for (const lootTable of lootTables) {
        try {
          // Generate a unique identifier for the loot table
          const lootTableId = this.generateLootTableId(lootTable, modId);

          // Convert the loot table
          const bedrockLootTable = this.convertLootTable(lootTable);

          bedrockLootTables[lootTableId] = bedrockLootTable;

          conversionNotes.push({
            type: 'info',
            component: 'loot_table',
            message: `Successfully converted loot table to Bedrock format`,
            sourceFile: lootTable.sourceFile,
          });
        } catch (error) {
          const errorMessage = `Failed to convert loot table: ${(error as Error).message}`;
          errors.push(errorMessage);

          conversionNotes.push({
            type: 'error',
            component: 'loot_table',
            message: errorMessage,
            sourceFile: lootTable.sourceFile,
          });
        }
      }

      // Check for potential issues
      const complexFunctionWarnings = this.checkForComplexFunctions(lootTables);
      conversionNotes.push(...complexFunctionWarnings);

      return {
        success: errors.length === 0,
        lootTables: bedrockLootTables,
        errors: errors.length > 0 ? errors : undefined,
        conversionNotes,
      };
    } catch (error) {
      logger.error('Error converting loot tables', { error });
      return {
        success: false,
        lootTables: {},
        errors: [`Failed to convert loot tables: ${(error as Error).message}`],
        conversionNotes: [
          {
            type: 'error',
            component: 'loot_table',
            message: `Failed to convert loot tables: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  /**
   * Writes Bedrock loot tables to output directory
   * @param result LootTableConversionResult with loot tables
   * @param behaviorPackDir Directory for the behavior pack
   * @returns Promise<boolean> indicating success
   */
  async writeLootTables(
    result: LootTableConversionResult,
    behaviorPackDir: string
  ): Promise<boolean> {
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
        logger.error('Cannot write invalid loot tables', { result });
        return false;
      }

      // Ensure loot_tables directory exists
      const lootTablesDir = path.join(behaviorPackDir, 'loot_tables');
      await fs.mkdir(lootTablesDir, { recursive: true });

      // Write loot table files
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const [lootTableId, lootTable] of Object.entries(result.lootTables)) {
        // Create subdirectories based on the loot table ID
        const [namespace, ...pathParts] = lootTableId.split(':');
        const lootTablePath = pathParts.join(':').split('/');
        const fileName = `${lootTablePath.pop()}.json`;

        const targetDir = path.join(lootTablesDir, namespace, ...lootTablePath);
        await fs.mkdir(targetDir, { recursive: true });

        await fs.writeFile(path.join(targetDir, fileName), JSON.stringify(lootTable, null, 2));

        logger.info(`Wrote loot table: ${lootTableId}`);
      }

      logger.info('Loot tables written successfully', {
        lootTableCount: Object.keys(result.lootTables).length,
      });
      return true;
    } catch (error) {
      logger.error('Error writing loot tables', { error });
      return false;
    }
  }

  /**
   * Validates a Bedrock loot table against specifications
   * @param lootTable BedrockLootTable to validate
   * @returns Object with validation result and errors
   */
  validateLootTable(lootTable: BedrockLootTable): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for pools
    if (!lootTable.pools || !Array.isArray(lootTable.pools) || lootTable.pools.length === 0) {
      errors.push('Loot table must have at least one pool');
    } else {
      // Validate each pool
      lootTable.pools.forEach((pool, poolIndex) => {
        // Check for rolls
        if (pool.rolls === undefined) {
          errors.push(`Pool ${poolIndex} is missing rolls`);
        }

        // Check for entries
        if (!pool.entries || !Array.isArray(pool.entries) || pool.entries.length === 0) {
          errors.push(`Pool ${poolIndex} must have at least one entry`);
        } else {
          // Validate each entry
          pool.entries.forEach((entry, entryIndex) => {
            // Check for type
            /**
             * if method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            if (!entry.type) {
              errors.push(`Entry ${entryIndex} in pool ${poolIndex} is missing type`);
            }

            // Check for required fields based on type
            if (entry.type === 'item' && !entry.name) {
              errors.push(`Item entry ${entryIndex} in pool ${poolIndex} is missing item name`);
            } else if (entry.type === 'loot_table' && !entry.table) {
              errors.push(
                `Loot table entry ${entryIndex} in pool ${poolIndex} is missing table reference`
              );
            }

            // Validate functions if present
            /**
             * if method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            if (entry.functions && Array.isArray(entry.functions)) {
              entry.functions.forEach((func, funcIndex) => {
                /**
                 * if method.
                 *
                 * TODO: Add detailed description of the method's purpose and behavior.
                 *
                 * @param param - TODO: Document parameters
                 * @returns result - TODO: Document return value
                 * @since 1.0.0
                 */
                if (!func.function) {
                  errors.push(
                    `Function ${funcIndex} in entry ${entryIndex}, pool ${poolIndex} is missing function name`
                  );
                }
              });
            }

            // Validate conditions if present
            /**
             * if method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            if (entry.conditions && Array.isArray(entry.conditions)) {
              entry.conditions.forEach((condition, condIndex) => {
                /**
                 * if method.
                 *
                 * TODO: Add detailed description of the method's purpose and behavior.
                 *
                 * @param param - TODO: Document parameters
                 * @returns result - TODO: Document return value
                 * @since 1.0.0
                 */
                if (!condition.condition) {
                  errors.push(
                    `Condition ${condIndex} in entry ${entryIndex}, pool ${poolIndex} is missing condition name`
                  );
                }
              });
            }
          });
        }

        // Validate pool conditions if present
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (pool.conditions && Array.isArray(pool.conditions)) {
          pool.conditions.forEach((condition, condIndex) => {
            /**
             * if method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            if (!condition.condition) {
              errors.push(`Condition ${condIndex} in pool ${poolIndex} is missing condition name`);
            }
          });
        }
      });
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
   * Generates a unique identifier for a loot table
   * @param lootTable Java loot table
   * @param modId Mod ID for namespace
   * @returns String identifier for the loot table
   */
  private generateLootTableId(lootTable: JavaLootTable, modId: string): string {
    // Extract the loot table path from the source file
    const sourceFile = path.basename(lootTable.sourceFile, '.json');

    // Determine the loot table type based on the directory structure
    let lootTableType = 'blocks';

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (lootTable.sourceFile.includes('entities')) {
      lootTableType = 'entities';
    } else if (lootTable.sourceFile.includes('chests')) {
      lootTableType = 'chests';
    } else if (lootTable.sourceFile.includes('gameplay')) {
      lootTableType = 'gameplay';
    }

    return `${modId}:${lootTableType}/${sourceFile}`;
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
   * Converts a Java loot table to Bedrock format
   * @param lootTable Java loot table
   * @returns BedrockLootTable
   */
  private convertLootTable(lootTable: JavaLootTable): BedrockLootTable {
    // Create the base Bedrock loot table
    const bedrockLootTable: BedrockLootTable = {
      pools: [],
    };

    // Convert pools if present
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (lootTable.pools && Array.isArray(lootTable.pools)) {
      bedrockLootTable.pools = lootTable.pools.map((pool) => this.convertLootPool(pool));
    }

    // Apply any top-level functions to all pools
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (
      lootTable.functions &&
      Array.isArray(lootTable.functions) &&
      lootTable.functions.length > 0
    ) {
      // In Bedrock, functions are applied at the entry level, not the table level
      // So we need to apply these functions to all entries in all pools
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const pool of bedrockLootTable.pools) {
        /**
         * for method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const entry of pool.entries) {
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (!entry.functions) {
            entry.functions = [];
          }

          entry.functions.push(
            ...lootTable.functions.map((func) => this.convertLootFunction(func))
          );
        }
      }
    }

    return bedrockLootTable;
  }

  /**
   * Converts a Java loot pool to Bedrock format
   * @param pool Java loot pool
   * @returns BedrockLootPool
   */
  private convertLootPool(pool: JavaLootPool): BedrockLootPool {
    const bedrockPool: BedrockLootPool = {
      rolls: pool.rolls,
      entries: [],
    };

    // Convert entries
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (pool.entries && Array.isArray(pool.entries)) {
      bedrockPool.entries = pool.entries.map((entry) => this.convertLootEntry(entry));
    }

    // Convert conditions if present
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (pool.conditions && Array.isArray(pool.conditions) && pool.conditions.length > 0) {
      bedrockPool.conditions = pool.conditions.map((condition) =>
        this.convertLootCondition(condition)
      );
    }

    // Apply pool-level functions to all entries
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (pool.functions && Array.isArray(pool.functions) && pool.functions.length > 0) {
      // In Bedrock, functions are applied at the entry level, not the pool level
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const entry of bedrockPool.entries) {
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!entry.functions) {
          entry.functions = [];
        }

        entry.functions.push(...pool.functions.map((func) => this.convertLootFunction(func)));
      }
    }

    return bedrockPool;
  }

  /**
   * Converts a Java loot entry to Bedrock format
   * @param entry Java loot entry
   * @returns BedrockLootEntry
   */
  private convertLootEntry(entry: JavaLootEntry): BedrockLootEntry {
    let bedrockEntry: BedrockLootEntry;

    // Convert based on entry type
    /**
     * switch method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    switch (entry.type) {
      case 'minecraft:item':
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!entry.item) {
          throw new Error('Item entry missing item name');
        }

        bedrockEntry = {
          type: 'item',
          name: this.convertItemId(entry.item),
          weight: entry.weight || 1,
          quality: entry.quality || 0,
        };
        break;

      case 'minecraft:tag':
        // Bedrock doesn't support tag entries directly
        // We'll create a warning and use a placeholder item
        logger.warn(`Tag entries are not directly supported in Bedrock: ${entry.tag}`);
        bedrockEntry = {
          type: 'item',
          name: 'minecraft:stone', // Placeholder
          weight: entry.weight || 1,
          quality: entry.quality || 0,
        };
        break;

      case 'minecraft:loot_table':
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!entry.table) {
          throw new Error('Loot table entry missing table reference');
        }

        bedrockEntry = {
          type: 'loot_table',
          name: entry.table, // Will need to be updated with the correct path
          weight: entry.weight || 1,
          quality: entry.quality || 0,
        };
        break;

      case 'minecraft:group': {
        // Bedrock doesn't support group entries directly
        // We'll flatten the children into the parent pool
        if (!entry.children || !Array.isArray(entry.children) || entry.children.length === 0) {
          throw new Error('Group entry missing children');
        }

        // Use the first child as a placeholder
        const firstChild = entry.children[0];
        bedrockEntry = this.convertLootEntry(firstChild);

        // Apply weight and quality from the group
        bedrockEntry.weight = entry.weight || 1;
        bedrockEntry.quality = entry.quality || 0;

        logger.warn(
          'Group entries are not directly supported in Bedrock, using first child as placeholder'
        );
        break;
      }

      case 'minecraft:empty':
        bedrockEntry = {
          type: 'empty',
          weight: entry.weight || 1,
          quality: entry.quality || 0,
        };
        break;

      default:
        throw new Error(`Unsupported entry type: ${entry.type}`);
    }

    // Convert functions if present
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (entry.functions && Array.isArray(entry.functions) && entry.functions.length > 0) {
      bedrockEntry.functions = entry.functions.map((func) => this.convertLootFunction(func));
    }

    // Convert conditions if present
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (entry.conditions && Array.isArray(entry.conditions) && entry.conditions.length > 0) {
      bedrockEntry.conditions = entry.conditions.map((condition) =>
        this.convertLootCondition(condition)
      );
    }

    return bedrockEntry;
  }

  /**
   * Converts a Java loot function to Bedrock format
   * @param func Java loot function
   * @returns BedrockLootFunction
   */
  private convertLootFunction(func: JavaLootFunction): BedrockLootFunction {
    // Map the function name to Bedrock equivalent
    const functionName =
      LOOT_FUNCTION_MAPPINGS[func.function] || func.function.split(':').pop() || '';

    const bedrockFunction: BedrockLootFunction = {
      function: functionName,
    };

    // Convert function-specific properties
    /**
     * switch method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    switch (func.function) {
      case 'minecraft:set_count':
        bedrockFunction.count = func.count;
        break;

      case 'minecraft:set_damage':
        bedrockFunction.damage = func.damage;
        break;

      case 'minecraft:set_name':
        bedrockFunction.name = func.name;
        break;

      case 'minecraft:set_lore':
        bedrockFunction.lore = func.lore;
        break;

      case 'minecraft:enchant_with_levels':
        bedrockFunction.levels = func.levels;
        bedrockFunction.treasure = func.treasure;
        break;

      case 'minecraft:enchant_randomly':
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (func.enchantments) {
          bedrockFunction.enchants = func.enchantments.map((enchant) => ({
            id: enchant.name,
            level: enchant.level,
          }));
        }
        break;

      case 'minecraft:set_nbt':
        bedrockFunction.data = func.tag;
        break;

      case 'minecraft:looting_enchant':
        bedrockFunction.count = func.count;
        bedrockFunction.limit = func.limit;
        break;

      case 'minecraft:apply_bonus':
        bedrockFunction.enchantment = func.enchantment;
        bedrockFunction.formula = func.formula;
        bedrockFunction.parameters = func.parameters;
        break;

      case 'minecraft:set_attributes':
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (func.modifiers) {
          bedrockFunction.modifiers = func.modifiers.map((modifier) => ({
            name: modifier.name,
            attribute: modifier.attribute,
            operation: modifier.operation,
            amount: modifier.amount,
            id: modifier.id,
            slot: modifier.slot,
          }));
        }
        break;

      case 'minecraft:set_contents':
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (func.entries) {
          // Convert entries to Bedrock format
          const convertedEntries = func.entries.map((entry) => this.convertLootEntry(entry));
          bedrockFunction.entries = convertedEntries;
        }
        break;

      case 'minecraft:copy_nbt':
        bedrockFunction.source = func.source;
        bedrockFunction.ops = func.ops;
        break;

      case 'minecraft:exploration_map':
        bedrockFunction.destination = func.destination;
        bedrockFunction.decoration = func.decoration;
        bedrockFunction.zoom = func.zoom;
        bedrockFunction.search_radius = func.search_radius;
        bedrockFunction.skip_existing_chunks = func.skip_existing_chunks;
        break;

      case 'minecraft:limit_count':
        bedrockFunction.limit = func.limit;
        break;

      case 'minecraft:copy_name':
        // Bedrock doesn't have a direct equivalent, but we can approximate
        bedrockFunction.function = 'copy_name';
        logger.warn('minecraft:copy_name function has limited support in Bedrock');
        break;

      case 'minecraft:furnace_smelt':
        // This function works similarly in both versions
        bedrockFunction.function = 'furnace_smelt';
        break;

      case 'minecraft:explosion_decay':
        // This function works similarly in both versions
        bedrockFunction.function = 'explosion_decay';
        break;

      default:
        // For unknown functions, log a warning
        logger.warn(`Unknown loot function: ${func.function}, attempting direct conversion`);
    }

    // Convert conditions if present
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (func.conditions && Array.isArray(func.conditions) && func.conditions.length > 0) {
      bedrockFunction.conditions = func.conditions.map((condition) =>
        this.convertLootCondition(condition)
      );
    }

    return bedrockFunction;
  }

  /**
   * Converts a Java loot condition to Bedrock format
   * @param condition Java loot condition
   * @returns BedrockLootCondition
   */
  private convertLootCondition(condition: JavaLootCondition): BedrockLootCondition {
    // Map the condition name to Bedrock equivalent
    const conditionName =
      LOOT_CONDITION_MAPPINGS[condition.condition] || condition.condition.split(':').pop() || '';

    const bedrockCondition: BedrockLootCondition = {
      condition: conditionName,
    };

    // Convert condition-specific properties
    /**
     * switch method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    switch (condition.condition) {
      case 'minecraft:random_chance':
        bedrockCondition.chance = condition.chance;
        break;

      case 'minecraft:random_chance_with_looting':
        bedrockCondition.chance = condition.chance;
        bedrockCondition.looting_multiplier = condition.looting_multiplier;
        break;

      case 'minecraft:entity_properties':
        bedrockCondition.entity_properties = condition.predicate;
        break;

      case 'minecraft:killed_by_player':
        bedrockCondition.killed_by_player = condition.killed_by_player;
        break;

      case 'minecraft:entity_scores':
        bedrockCondition.scores = condition.scores;
        break;

      case 'minecraft:match_tool':
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (condition.item) {
          bedrockCondition.item = {
            items: condition.item.items?.map((item) => this.convertItemId(item)),
          };
        }
        break;

      case 'minecraft:weather_check':
        bedrockCondition.raining = condition.raining;
        bedrockCondition.thundering = condition.thundering;
        break;

      case 'minecraft:time_check':
        bedrockCondition.value = condition.value;
        break;

      case 'minecraft:inverted':
        // Handle inverted conditions by recursively converting the term
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (condition.term) {
          const invertedCondition = this.convertLootCondition(
            condition.term as unknown as JavaLootCondition
          );
          bedrockCondition.term = invertedCondition;
        } else {
          logger.warn('Inverted condition missing term');
        }
        break;

      case 'minecraft:alternative':
        // Handle alternative conditions by recursively converting each term
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (condition.terms && Array.isArray(condition.terms)) {
          bedrockCondition.terms = condition.terms.map((term) =>
            this.convertLootCondition(term as unknown as JavaLootCondition)
          );
        } else {
          logger.warn('Alternative condition missing terms');
        }
        break;

      case 'minecraft:reference':
        // Handle reference conditions
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (condition.name) {
          bedrockCondition.name = condition.name as unknown as string;
        } else {
          logger.warn('Reference condition missing name');
        }
        break;

      case 'minecraft:block_state_property':
        // Convert block state properties
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (condition.block) {
          bedrockCondition.block = condition.block as unknown as string;
          bedrockCondition.properties = condition.properties as unknown as Record<string, string>;
        } else {
          logger.warn('Block state property condition missing block');
        }
        break;

      case 'minecraft:damage_source_properties':
        // Convert damage source properties
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (condition.predicate) {
          bedrockCondition.predicate = condition.predicate;
        } else {
          logger.warn('Damage source properties condition missing predicate');
        }
        break;

      case 'minecraft:location_check':
        // Convert location check
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (condition.predicate) {
          bedrockCondition.predicate = condition.predicate;
        } else {
          logger.warn('Location check condition missing predicate');
        }
        break;

      case 'minecraft:survives_explosion':
        // This is a simple condition with no parameters
        break;

      case 'minecraft:table_bonus':
        // Convert table bonus
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (condition.enchantment && condition.chances && Array.isArray(condition.chances)) {
          bedrockCondition.enchantment = condition.enchantment as unknown as string;
          bedrockCondition.chances = condition.chances as unknown as number[];
        } else {
          logger.warn('Table bonus condition missing enchantment or chances');
        }
        break;

      default:
        // For unknown conditions, log a warning
        logger.warn(`Unknown loot condition: ${condition.condition}, attempting direct conversion`);
    }

    return bedrockCondition;
  }

  /**
   * Checks for complex loot functions that may need special handling
   * @param lootTables Array of Java loot tables
   * @returns Array of conversion notes for complex functions
   */
  private checkForComplexFunctions(lootTables: JavaLootTable[]): LootTableConversionNote[] {
    const notes: LootTableConversionNote[] = [];

    // Complex functions that need special attention
    const complexFunctions = [
      'minecraft:set_nbt',
      'minecraft:copy_nbt',
      'minecraft:copy_state',
      'minecraft:set_attributes',
      'minecraft:set_contents',
      'minecraft:set_stew_effect',
      'minecraft:set_banner_pattern',
      'minecraft:exploration_map',
      'minecraft:set_enchantments',
    ];

    // Functions with limited or no support in Bedrock
    const unsupportedFunctions = [
      'minecraft:copy_state',
      'minecraft:set_stew_effect',
      'minecraft:set_banner_pattern',
      'minecraft:fill_player_head',
      'minecraft:copy_name',
      'minecraft:set_enchantments',
    ];

    // Functions that require special handling
    const specialHandlingFunctions = [
      'minecraft:apply_bonus',
      'minecraft:set_attributes',
      'minecraft:exploration_map',
    ];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const lootTable of lootTables) {
      // Check top-level functions
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (lootTable.functions) {
        this.checkFunctionsForComplexity(
          lootTable.functions,
          complexFunctions,
          notes,
          lootTable.sourceFile
        );
        this.checkFunctionsForUnsupported(
          lootTable.functions,
          unsupportedFunctions,
          notes,
          lootTable.sourceFile
        );
        this.checkFunctionsForSpecialHandling(
          lootTable.functions,
          specialHandlingFunctions,
          notes,
          lootTable.sourceFile
        );
      }

      // Check pool-level functions
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (lootTable.pools) {
        /**
         * for method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const pool of lootTable.pools) {
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (pool.functions) {
            this.checkFunctionsForComplexity(
              pool.functions,
              complexFunctions,
              notes,
              lootTable.sourceFile
            );
            this.checkFunctionsForUnsupported(
              pool.functions,
              unsupportedFunctions,
              notes,
              lootTable.sourceFile
            );
            this.checkFunctionsForSpecialHandling(
              pool.functions,
              specialHandlingFunctions,
              notes,
              lootTable.sourceFile
            );
          }

          // Check entry-level functions
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (pool.entries) {
            /**
             * for method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            for (const entry of pool.entries) {
              /**
               * if method.
               *
               * TODO: Add detailed description of the method's purpose and behavior.
               *
               * @param param - TODO: Document parameters
               * @returns result - TODO: Document return value
               * @since 1.0.0
               */
              if (entry.functions) {
                this.checkFunctionsForComplexity(
                  entry.functions,
                  complexFunctions,
                  notes,
                  lootTable.sourceFile
                );
                this.checkFunctionsForUnsupported(
                  entry.functions,
                  unsupportedFunctions,
                  notes,
                  lootTable.sourceFile
                );
                this.checkFunctionsForSpecialHandling(
                  entry.functions,
                  specialHandlingFunctions,
                  notes,
                  lootTable.sourceFile
                );
              }
            }
          }
        }
      }
    }

    return notes;
  }

  /**
   * Helper method to check functions for unsupported features
   * @param functions Array of loot functions
   * @param unsupportedFunctions List of unsupported function names
   * @param notes Array to add notes to
   * @param sourceFile Source file for context
   */
  private checkFunctionsForUnsupported(
    functions: JavaLootFunction[],
    unsupportedFunctions: string[],
    notes: LootTableConversionNote[],
    sourceFile?: string
  ): void {
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const func of functions) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (unsupportedFunctions.includes(func.function)) {
        notes.push({
          type: 'error',
          component: 'loot_table',
          message: `Unsupported function '${func.function}' cannot be converted to Bedrock`,
          details: `This function has no direct equivalent in Bedrock and will be omitted. Manual implementation may be required.`,
          sourceFile,
        });
      }
    }
  }

  /**
   * Helper method to check functions that require special handling
   * @param functions Array of loot functions
   * @param specialHandlingFunctions List of function names requiring special handling
   * @param notes Array to add notes to
   * @param sourceFile Source file for context
   */
  private checkFunctionsForSpecialHandling(
    functions: JavaLootFunction[],
    specialHandlingFunctions: string[],
    notes: LootTableConversionNote[],
    sourceFile?: string
  ): void {
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const func of functions) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (specialHandlingFunctions.includes(func.function)) {
        let details = '';

        // Provide specific guidance based on function type
        /**
         * switch method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        switch (func.function) {
          case 'minecraft:apply_bonus':
            details = `The apply_bonus function may behave differently in Bedrock. Verify the formula and parameters after conversion.`;
            break;

          case 'minecraft:set_attributes':
            details = `Attribute modifiers in Bedrock use different naming conventions. Verify attribute names and operations after conversion.`;
            break;

          case 'minecraft:exploration_map':
            details = `Exploration maps in Bedrock have different configuration options. Manual adjustment may be required.`;
            break;
        }

        notes.push({
          type: 'warning',
          component: 'loot_table',
          message: `Special handling required for '${func.function}'`,
          details,
          sourceFile,
        });
      }
    }
  }

  /**
   * Helper method to check functions for complexity
   * @param functions Array of loot functions
   * @param complexFunctions List of complex function names
   * @param notes Array to add notes to
   * @param sourceFile Source file for context
   */
  private checkFunctionsForComplexity(
    functions: JavaLootFunction[],
    complexFunctions: string[],
    notes: LootTableConversionNote[],
    sourceFile?: string
  ): void {
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const func of functions) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (complexFunctions.includes(func.function)) {
        notes.push({
          type: 'warning',
          component: 'loot_table',
          message: `Complex function '${func.function}' may not be fully supported in Bedrock`,
          details: `This function may require manual adjustment after conversion.`,
          sourceFile,
        });
      }
    }
  }
}
