/**
 * BlockItemDefinitionConverter Component
 *
 * This component is responsible for transforming Java block/item registrations to Bedrock JSON format.
 * It implements static analysis for Java registration code and creates conversion logic for Bedrock
 * block/item JSON with support for property mapping between platforms.
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger.js';
import { ErrorSeverity } from '../../types/errors.js';

// Java registration code patterns
const BLOCK_REGISTRATION_PATTERNS = [
  /Registry\.register\(\s*Registry\.BLOCK\s*,\s*new ResourceLocation\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)\s*,\s*([^)]+)\)/g,
  /registerBlock\(\s*["']([^"']+)["']\s*,\s*\(\)\s*->\s*new\s+([^(]+)\(/g,
  /Registry\.register\(\s*Registries\.BLOCK\s*,\s*([^,]+)\s*,\s*([^)]+)\)/g,
];

const ITEM_REGISTRATION_PATTERNS = [
  /Registry\.register\(\s*Registry\.ITEM\s*,\s*new ResourceLocation\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)\s*,\s*([^)]+)\)/g,
  /registerItem\(\s*["']([^"']+)["']\s*,\s*\(\)\s*->\s*new\s+([^(]+)\(/g,
  /Registry\.register\(\s*Registries\.ITEM\s*,\s*([^,]+)\s*,\s*([^)]+)\)/g,
];

// Common block properties in Java that need mapping to Bedrock
const BLOCK_PROPERTY_MAPPINGS = {
  // Material properties
  'Material.ROCK': { material: 'stone' },
  'Material.WOOD': { material: 'wood' },
  'Material.EARTH': { material: 'dirt' },
  'Material.METAL': { material: 'metal' },
  'Material.GLASS': { material: 'glass' },
  'Material.WOOL': { material: 'wool' },

  // Block properties
  hardnessAndResistance: 'destroy_time',
  lightValue: 'light_emission',
  slipperiness: 'friction',
  soundType: 'sound',

  // Sound types
  'SoundType.STONE': { sound: 'stone' },
  'SoundType.WOOD': { sound: 'wood' },
  'SoundType.GRAVEL': { sound: 'gravel' },
  'SoundType.METAL': { sound: 'metal' },
  'SoundType.GLASS': { sound: 'glass' },
  'SoundType.CLOTH': { sound: 'cloth' },
  'SoundType.SAND': { sound: 'sand' },
  'SoundType.SNOW': { sound: 'snow' },
  'SoundType.LADDER': { sound: 'ladder' },
  'SoundType.ANVIL': { sound: 'anvil' },
  'SoundType.SLIME': { sound: 'slime' },
};

// Common item properties in Java that need mapping to Bedrock
const ITEM_PROPERTY_MAPPINGS = {
  maxStackSize: 'max_stack_size',
  maxDamage: 'max_damage',
  rarity: 'rarity',

  // Rarity values
  'Rarity.COMMON': { rarity: 'common' },
  'Rarity.UNCOMMON': { rarity: 'uncommon' },
  'Rarity.RARE': { rarity: 'rare' },
  'Rarity.EPIC': { rarity: 'epic' },
};

/**
 * JavaRegistrationCode interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface JavaRegistrationCode {
  type: 'block' | 'item';
  modId: string;
  name: string;
  className: string;
  properties: Record<string, any>;
  sourceFile: string;
  lineNumber: number;
}

/**
 * BedrockBlockDefinition interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockBlockDefinition {
  format_version: string;
  'minecraft:block': {
    description: {
      identifier: string;
      register_to_creative_menu?: boolean;
      is_experimental?: boolean;
    };
    components: Record<string, any>;
  };
}

/**
 * BedrockItemDefinition interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockItemDefinition {
  format_version: string;
  'minecraft:item': {
    description: {
      identifier: string;
      category?: string;
      register_to_creative_menu?: boolean;
      is_experimental?: boolean;
    };
    components: Record<string, any>;
  };
}

/**
 * BlockItemConversionResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BlockItemConversionResult {
  success: boolean;
  blocks: BedrockBlockDefinition[];
  items: BedrockItemDefinition[];
  errors?: string[];
  conversionNotes: BlockItemConversionNote[];
}

/**
 * BlockItemConversionNote interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BlockItemConversionNote {
  type: ErrorSeverity;
  component: 'block' | 'item';
  message: string;
  details?: string;
  sourceFile?: string;
  lineNumber?: number;
}

/**
 * BlockItemDefinitionConverter class.
 *
 * TODO: Add detailed description of the class purpose and functionality.
 *
 * @since 1.0.0
 */
export class BlockItemDefinitionConverter {
  /**
   * Analyzes Java source files to extract block and item registrations
   * @param sourceDir Directory containing Java source files
   * @param modId Mod ID for namespace
   * @returns Promise<JavaRegistrationCode[]> Array of extracted registrations
   */
  async analyzeJavaRegistrations(
    sourceDir: string,
    modId: string
  ): Promise<JavaRegistrationCode[]> {
    try {
      const registrations: JavaRegistrationCode[] = [];
      const javaFiles = await this.findJavaFiles(sourceDir);

      logger.info(`Found ${javaFiles.length} Java files to analyze for registrations`);

      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const file of javaFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Extract block registrations
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Check for block registrations
          /**
           * for method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          for (const pattern of BLOCK_REGISTRATION_PATTERNS) {
            const matches = [...line.matchAll(pattern)];
            /**
             * for method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            for (const match of matches) {
              let name: string;
              let className: string;

              // Different patterns have different group structures
              /**
               * if method.
               *
               * TODO: Add detailed description of the method's purpose and behavior.
               *
               * @param param - TODO: Document parameters
               * @returns result - TODO: Document return value
               * @since 1.0.0
               */
              if (match[2] && !match[2].includes('ResourceLocation')) {
                name = match[2];
                className = match[3] || '';
              } else {
                name = match[1];
                className = match[2] || '';
              }

              // Extract properties from surrounding lines
              const properties = this.extractBlockProperties(lines, i);

              registrations.push({
                type: 'block',
                modId,
                name,
                className,
                properties,
                sourceFile: file,
                lineNumber: i + 1,
              });

              logger.info(`Found block registration: ${name}`, { file, line: i + 1 });
            }
          }

          // Check for item registrations
          /**
           * for method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          for (const pattern of ITEM_REGISTRATION_PATTERNS) {
            const matches = [...line.matchAll(pattern)];
            /**
             * for method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            for (const match of matches) {
              let name: string;
              let className: string;

              // Different patterns have different group structures
              /**
               * if method.
               *
               * TODO: Add detailed description of the method's purpose and behavior.
               *
               * @param param - TODO: Document parameters
               * @returns result - TODO: Document return value
               * @since 1.0.0
               */
              if (match[2] && !match[2].includes('ResourceLocation')) {
                name = match[2];
                className = match[3] || '';
              } else {
                name = match[1];
                className = match[2] || '';
              }

              // Extract properties from surrounding lines
              const properties = this.extractItemProperties(lines, i);

              registrations.push({
                type: 'item',
                modId,
                name,
                className,
                properties,
                sourceFile: file,
                lineNumber: i + 1,
              });

              logger.info(`Found item registration: ${name}`, { file, line: i + 1 });
            }
          }
        }
      }

      return registrations;
    } catch (error) {
      logger.error('Error analyzing Java registrations', { error });
      throw new Error(`Failed to analyze Java registrations: ${(error as Error).message}`);
    }
  }

  /**
   * Converts Java block registrations to Bedrock block definitions
   * @param registrations Array of Java registrations
   * @returns BedrockBlockDefinition[] Array of Bedrock block definitions
   */
  convertBlockDefinitions(registrations: JavaRegistrationCode[]): BedrockBlockDefinition[] {
    const blockDefinitions: BedrockBlockDefinition[] = [];

    for (const reg of registrations.filter((r) => r.type === 'block')) {
      try {
        const blockId = `${reg.modId}:${reg.name}`;

        // Create basic block definition
        const blockDef: BedrockBlockDefinition = {
          format_version: '1.19.0',
          'minecraft:block': {
            description: {
              identifier: blockId,
              register_to_creative_menu: true,
            },
            components: {
              // Default components
              'minecraft:destructible_by_mining': {
                seconds_to_destroy: 1.0,
              },
              'minecraft:friction': 0.6,
              'minecraft:material_instances': {
                '*': {
                  texture: `${reg.name}`,
                  render_method: 'opaque',
                },
              },
            },
          },
        };

        // Map Java properties to Bedrock components
        this.mapBlockProperties(blockDef, reg.properties);

        blockDefinitions.push(blockDef);

        logger.info(`Converted block definition: ${blockId}`);
      } catch (error) {
        logger.error(`Error converting block definition for ${reg.name}`, { error });
      }
    }

    return blockDefinitions;
  }

  /**
   * Converts Java item registrations to Bedrock item definitions
   * @param registrations Array of Java registrations
   * @returns BedrockItemDefinition[] Array of Bedrock item definitions
   */
  convertItemDefinitions(registrations: JavaRegistrationCode[]): BedrockItemDefinition[] {
    const itemDefinitions: BedrockItemDefinition[] = [];

    for (const reg of registrations.filter((r) => r.type === 'item')) {
      try {
        const itemId = `${reg.modId}:${reg.name}`;

        // Create basic item definition
        const itemDef: BedrockItemDefinition = {
          format_version: '1.19.0',
          'minecraft:item': {
            description: {
              identifier: itemId,
              category: 'items',
              register_to_creative_menu: true,
            },
            components: {
              // Default components
              'minecraft:icon': {
                texture: reg.name,
              },
              'minecraft:display_name': {
                value: this.formatDisplayName(reg.name),
              },
            },
          },
        };

        // Map Java properties to Bedrock components
        this.mapItemProperties(itemDef, reg.properties);

        itemDefinitions.push(itemDef);

        logger.info(`Converted item definition: ${itemId}`);
      } catch (error) {
        logger.error(`Error converting item definition for ${reg.name}`, { error });
      }
    }

    return itemDefinitions;
  }

  /**
   * Processes Java registrations and converts them to Bedrock definitions
   * @param registrations Array of Java registrations
   * @returns BlockItemConversionResult with conversion results
   */
  processRegistrations(registrations: JavaRegistrationCode[]): BlockItemConversionResult {
    try {
      const conversionNotes: BlockItemConversionNote[] = [];

      // Convert blocks
      const blocks = this.convertBlockDefinitions(registrations);

      // Convert items
      const items = this.convertItemDefinitions(registrations);

      // Generate conversion notes
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const reg of registrations) {
        conversionNotes.push({
          type: ErrorSeverity.INFO,
          component: reg.type,
          message: `Converted ${reg.type} '${reg.name}' to Bedrock format`,
          sourceFile: reg.sourceFile,
          lineNumber: reg.lineNumber,
        });
      }

      // Check for potential issues
      const missingTextures = this.checkForMissingTextures(registrations);
      conversionNotes.push(...missingTextures);

      return {
        success: true,
        blocks,
        items,
        conversionNotes,
      };
    } catch (error) {
      logger.error('Error processing registrations', { error });
      return {
        success: false,
        blocks: [],
        items: [],
        errors: [`Failed to process registrations: ${(error as Error).message}`],
        conversionNotes: [
          {
            type: ErrorSeverity.ERROR,
            component: 'block',
            message: `Failed to process registrations: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  /**
   * Writes Bedrock block and item definitions to output directories
   * @param result BlockItemConversionResult with blocks and items
   * @param behaviorPackDir Directory for the behavior pack
   * @returns Promise<boolean> indicating success
   */
  async writeDefinitions(
    result: BlockItemConversionResult,
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
        logger.error('Cannot write invalid definitions', { result });
        return false;
      }

      // Ensure directories exist
      const blocksDir = path.join(behaviorPackDir, 'blocks');
      const itemsDir = path.join(behaviorPackDir, 'items');

      await fs.mkdir(blocksDir, { recursive: true });
      await fs.mkdir(itemsDir, { recursive: true });

      // Write block definitions
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const block of result.blocks) {
        const identifier = block['minecraft:block'].description.identifier;
        const fileName = identifier.replace(':', '_') + '.json';

        await fs.writeFile(path.join(blocksDir, fileName), JSON.stringify(block, null, 2));

        logger.info(`Wrote block definition: ${fileName}`);
      }

      // Write item definitions
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const item of result.items) {
        const identifier = item['minecraft:item'].description.identifier;
        const fileName = identifier.replace(':', '_') + '.json';

        await fs.writeFile(path.join(itemsDir, fileName), JSON.stringify(item, null, 2));

        logger.info(`Wrote item definition: ${fileName}`);
      }

      logger.info('Definitions written successfully', {
        blockCount: result.blocks.length,
        itemCount: result.items.length,
      });

      return true;
    } catch (error) {
      logger.error('Error writing definitions', { error });
      return false;
    }
  }

  /**
   * Finds all Java files in a directory recursively
   * @param dir Directory to search
   * @returns Promise<string[]> Array of Java file paths
   */
  private async findJavaFiles(dir: string): Promise<string[]> {
    const javaFiles: string[] = [];

    async function scanDir(currentDir: string) {
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
        } else if (entry.isFile() && entry.name.endsWith('.java')) {
          javaFiles.push(fullPath);
        }
      }
    }

    await scanDir(dir);
    return javaFiles;
  }

  /**
   * Extracts block properties from Java code
   * @param lines Array of code lines
   * @param lineIndex Index of the registration line
   * @returns Record<string, any> Extracted properties
   */
  private extractBlockProperties(lines: string[], lineIndex: number): Record<string, any> {
    const properties: Record<string, any> = {};
    const classPattern = /extends\s+Block\s*\{/;
    const propertyPattern = /\.([a-zA-Z]+)\(([^)]+)\)/g;

    // Look for block class definition
    let classStart = -1;
    for (let i = Math.max(0, lineIndex - 50); i < Math.min(lines.length, lineIndex + 50); i++) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (classPattern.test(lines[i])) {
        classStart = i;
        break;
      }
    }

    if (classStart >= 0) {
      // Extract properties from constructor and methods
      for (let i = classStart; i < Math.min(lines.length, classStart + 30); i++) {
        const line = lines[i];
        const matches = [...line.matchAll(propertyPattern)];

        /**
         * for method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const match of matches) {
          const propertyName = match[1];
          const propertyValue = match[2].trim();
          properties[propertyName] = propertyValue;
        }

        // Look for specific property patterns
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (line.includes('setHardness') || line.includes('hardnessAndResistance')) {
          const hardnessMatch = line.match(/(?:setHardness|hardnessAndResistance)\(([^,)]+)/);
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (hardnessMatch) {
            properties['hardness'] = hardnessMatch[1].trim();
          }
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
        if (line.includes('setResistance')) {
          const resistanceMatch = line.match(/setResistance\(([^)]+)\)/);
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (resistanceMatch) {
            properties['resistance'] = resistanceMatch[1].trim();
          }
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
        if (line.includes('setLightValue')) {
          const lightMatch = line.match(/setLightValue\(([^)]+)\)/);
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (lightMatch) {
            properties['lightValue'] = lightMatch[1].trim();
          }
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
        if (line.includes('setSoundType')) {
          const soundMatch = line.match(/setSoundType\(([^)]+)\)/);
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (soundMatch) {
            properties['soundType'] = soundMatch[1].trim();
          }
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
        if (line.includes('setSlipperiness')) {
          const slipMatch = line.match(/setSlipperiness\(([^)]+)\)/);
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (slipMatch) {
            properties['slipperiness'] = slipMatch[1].trim();
          }
        }
      }
    }

    return properties;
  }

  /**
   * Extracts item properties from Java code
   * @param lines Array of code lines
   * @param lineIndex Index of the registration line
   * @returns Record<string, any> Extracted properties
   */
  private extractItemProperties(lines: string[], lineIndex: number): Record<string, any> {
    const properties: Record<string, any> = {};
    const classPattern = /extends\s+Item\s*\{/;
    const propertyPattern = /\.([a-zA-Z]+)\(([^)]+)\)/g;

    // Look for item class definition
    let classStart = -1;
    for (let i = Math.max(0, lineIndex - 50); i < Math.min(lines.length, lineIndex + 50); i++) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (classPattern.test(lines[i])) {
        classStart = i;
        break;
      }
    }

    if (classStart >= 0) {
      // Extract properties from constructor and methods
      for (let i = classStart; i < Math.min(lines.length, classStart + 30); i++) {
        const line = lines[i];
        const matches = [...line.matchAll(propertyPattern)];

        /**
         * for method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const match of matches) {
          const propertyName = match[1];
          const propertyValue = match[2].trim();
          properties[propertyName] = propertyValue;
        }

        // Look for specific property patterns
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (line.includes('maxStackSize')) {
          const stackMatch = line.match(/maxStackSize\s*=\s*(\d+)/);
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (stackMatch) {
            properties['maxStackSize'] = stackMatch[1].trim();
          }
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
        if (line.includes('maxDamage')) {
          const damageMatch = line.match(/maxDamage\((\d+)\)/);
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (damageMatch) {
            properties['maxDamage'] = damageMatch[1].trim();
          }
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
        if (line.includes('rarity')) {
          const rarityMatch = line.match(/rarity\(([^)]+)\)/);
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (rarityMatch) {
            properties['rarity'] = rarityMatch[1].trim();
          }
        }
      }
    }

    return properties;
  }

  /**
   * Maps Java block properties to Bedrock components
   * @param blockDef Bedrock block definition to modify
   * @param properties Java properties
   */
  private mapBlockProperties(
    blockDef: BedrockBlockDefinition,
    properties: Record<string, any>
  ): void {
    const components = blockDef['minecraft:block'].components;

    // Map hardness to destroy_time
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (properties['hardness']) {
      const hardness = parseFloat(properties['hardness']);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!isNaN(hardness)) {
        components['minecraft:destructible_by_mining'] = {
          seconds_to_destroy: Number(hardness), // Ensure it's a number
        };
      }
    }

    // Map light value
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (properties['lightValue']) {
      const lightValue = parseInt(properties['lightValue']);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!isNaN(lightValue) && lightValue > 0) {
        // Force conversion to number with unary plus operator
        components['minecraft:light_emission'] = +lightValue;
      }
    }

    // Map slipperiness to friction
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (properties['slipperiness']) {
      const friction = parseFloat(properties['slipperiness']);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!isNaN(friction)) {
        components['minecraft:friction'] = Number(friction); // Ensure it's a number
      }
    }

    // Map sound type
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (properties['soundType']) {
      const soundType = properties['soundType'];
      const mappedSound =
        BLOCK_PROPERTY_MAPPINGS[soundType as keyof typeof BLOCK_PROPERTY_MAPPINGS];
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (mappedSound && typeof mappedSound === 'object' && 'sound' in mappedSound) {
        components['minecraft:block_sounds'] = {
          sound: (mappedSound as { sound: string }).sound,
        };
      }
    }

    // Map material properties
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [javaProperty, bedrockProperty] of Object.entries(BLOCK_PROPERTY_MAPPINGS)) {
      if (properties[javaProperty] || properties[javaProperty] === javaProperty) {
        if (typeof bedrockProperty === 'string') {
          components[`minecraft:${bedrockProperty}`] = properties[javaProperty];
        } else {
          Object.entries(bedrockProperty).forEach(([key, value]) => {
            if (key === 'material') {
              components['minecraft:material_instances'] = {
                '*': {
                  texture: blockDef['minecraft:block'].description.identifier.split(':')[1],
                  render_method: 'opaque',
                  ambient_occlusion: true,
                  face_dimming: true,
                },
              };
            } else {
              components[`minecraft:${key}`] = value;
            }
          });
        }
      }
    }
  }

  /**
   * Maps Java item properties to Bedrock components
   * @param itemDef Bedrock item definition to modify
   * @param properties Java properties
   */
  private mapItemProperties(itemDef: BedrockItemDefinition, properties: Record<string, any>): void {
    const components = itemDef['minecraft:item'].components;

    // Map max stack size
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (properties['maxStackSize']) {
      const stackSize = parseInt(properties['maxStackSize']);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!isNaN(stackSize)) {
        components['minecraft:max_stack_size'] = Number(stackSize); // Force conversion to number
      }
    }

    // Map max damage
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (properties['maxDamage']) {
      const maxDamage = parseInt(properties['maxDamage']);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!isNaN(maxDamage) && maxDamage > 0) {
        components['minecraft:durability'] = {
          max_durability: Number(maxDamage), // Force conversion to number
        };
      }
    }

    // Map rarity to custom data
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (properties['rarity']) {
      const rarity = properties['rarity'];
      const mappedRarity = ITEM_PROPERTY_MAPPINGS[rarity as keyof typeof ITEM_PROPERTY_MAPPINGS];
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (mappedRarity && typeof mappedRarity === 'object' && 'rarity' in mappedRarity) {
        // Store rarity as custom data since Bedrock doesn't have direct rarity
        components['minecraft:custom_data'] = {
          rarity: (mappedRarity as { rarity: string }).rarity,
        };
      }
    }

    // Map other properties
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [javaProperty, bedrockProperty] of Object.entries(ITEM_PROPERTY_MAPPINGS)) {
      if (properties[javaProperty] || properties[javaProperty] === javaProperty) {
        if (typeof bedrockProperty === 'string') {
          components[`minecraft:${bedrockProperty}`] = properties[javaProperty];
        } else {
          Object.entries(bedrockProperty).forEach(([key, value]) => {
            if (key === 'rarity') {
              components['minecraft:custom_data'] = {
                ...components['minecraft:custom_data'],
                rarity: value,
              };
            } else {
              components[`minecraft:${key}`] = value;
            }
          });
        }
      }
    }

    // Check for tool properties
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (properties['efficiency'] || properties['attackDamage']) {
      // This is likely a tool
      components['minecraft:hand_equipped'] = true;

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (properties['efficiency']) {
        const efficiency = parseFloat(properties['efficiency']);
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!isNaN(efficiency)) {
          components['minecraft:mining_speed'] = efficiency;
        }
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
      if (properties['attackDamage']) {
        const damage = parseFloat(properties['attackDamage']);
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!isNaN(damage)) {
          components['minecraft:damage'] = damage;
        }
      }
    }
  }

  /**
   * Formats a snake_case or camelCase identifier as a display name
   * @param name The identifier to format
   * @returns Formatted display name
   */
  private formatDisplayName(name: string): string {
    // Replace underscores and hyphens with spaces
    let displayName = name.replace(/[_-]/g, ' ');

    // Split camelCase
    displayName = displayName.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Capitalize each word
    displayName = displayName
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return displayName;
  }

  /**
   * Checks for potential missing textures in the registrations
   * @param registrations Array of Java registrations
   * @returns Array of conversion notes for missing textures
   */
  private checkForMissingTextures(
    registrations: JavaRegistrationCode[]
  ): BlockItemConversionNote[] {
    const notes: BlockItemConversionNote[] = [];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const reg of registrations) {
      // In a real implementation, we would check if texture files exist
      // For now, just add a note about texture requirements
      notes.push({
        type: ErrorSeverity.INFO,
        component: reg.type,
        message: `${reg.type === 'block' ? 'Block' : 'Item'} '${reg.name}' requires texture file: ${reg.name}.png`,
        sourceFile: reg.sourceFile,
        lineNumber: reg.lineNumber,
      });
    }

    return notes;
  }
}
