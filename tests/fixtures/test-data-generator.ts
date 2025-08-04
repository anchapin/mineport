import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ModTestData {
  name: string;
  modId: string;
  version: string;
  author: string;
  description: string;
  blocks: BlockTestData[];
  items: ItemTestData[];
  textures: TextureTestData[];
  models: ModelTestData[];
  recipes?: RecipeTestData[];
  lootTables?: LootTableTestData[];
}

export interface BlockTestData {
  name: string;
  displayName: string;
  material: string;
  hardness: number;
  hasTexture: boolean;
  hasModel: boolean;
  hasBlockstate: boolean;
}

export interface ItemTestData {
  name: string;
  displayName: string;
  type: 'tool' | 'food' | 'material' | 'misc';
  hasTexture: boolean;
  hasModel: boolean;
}

export interface TextureTestData {
  name: string;
  type: 'block' | 'item' | 'entity';
  size: number;
  animated: boolean;
}

export interface ModelTestData {
  name: string;
  type: 'block' | 'item';
  parent: string;
  textures: string[];
}

export interface RecipeTestData {
  name: string;
  type: 'crafting_shaped' | 'crafting_shapeless' | 'smelting';
  result: string;
  ingredients: string[];
}

export interface LootTableTestData {
  name: string;
  type: 'block' | 'entity' | 'chest';
  pools: Array<{
    rolls: number;
    entries: Array<{
      item: string;
      weight: number;
    }>;
  }>;
}

export class TestDataGenerator {
  private static readonly COMMON_MATERIALS = ['stone', 'wood', 'metal', 'glass', 'dirt'];
  private static readonly COMMON_TOOLS = ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'];
  private static readonly COMMON_FOODS = ['apple', 'bread', 'meat', 'fish', 'cake'];

  /**
   * Generate a simple test mod with basic blocks and items
   */
  static generateSimpleMod(modId: string = 'testmod'): ModTestData {
    return {
      name: 'Simple Test Mod',
      modId,
      version: '1.0.0',
      author: 'TestAuthor',
      description: 'A simple mod for testing purposes',
      blocks: [
        {
          name: 'test_block',
          displayName: 'Test Block',
          material: 'stone',
          hardness: 2.0,
          hasTexture: true,
          hasModel: true,
          hasBlockstate: true,
        },
      ],
      items: [
        {
          name: 'test_item',
          displayName: 'Test Item',
          type: 'misc',
          hasTexture: true,
          hasModel: true,
        },
      ],
      textures: [
        {
          name: 'test_block',
          type: 'block',
          size: 16,
          animated: false,
        },
        {
          name: 'test_item',
          type: 'item',
          size: 16,
          animated: false,
        },
      ],
      models: [
        {
          name: 'test_block',
          type: 'block',
          parent: 'block/cube_all',
          textures: [`${modId}:block/test_block`],
        },
        {
          name: 'test_item',
          type: 'item',
          parent: 'item/generated',
          textures: [`${modId}:item/test_item`],
        },
      ],
    };
  }

  /**
   * Generate a complex test mod with many components
   */
  static generateComplexMod(modId: string = 'complexmod'): ModTestData {
    const blocks: BlockTestData[] = [];
    const items: ItemTestData[] = [];
    const textures: TextureTestData[] = [];
    const models: ModelTestData[] = [];
    const recipes: RecipeTestData[] = [];

    // Generate blocks
    for (let i = 0; i < 10; i++) {
      const material = this.COMMON_MATERIALS[i % this.COMMON_MATERIALS.length];
      const blockName = `${material}_block_${i}`;

      blocks.push({
        name: blockName,
        displayName: `${material.charAt(0).toUpperCase() + material.slice(1)} Block ${i}`,
        material,
        hardness: Math.random() * 5 + 0.5,
        hasTexture: true,
        hasModel: true,
        hasBlockstate: true,
      });

      textures.push({
        name: blockName,
        type: 'block',
        size: 16,
        animated: i % 5 === 0, // Every 5th texture is animated
      });

      models.push({
        name: blockName,
        type: 'block',
        parent: 'block/cube_all',
        textures: [`${modId}:block/${blockName}`],
      });
    }

    // Generate items
    for (let i = 0; i < 15; i++) {
      const toolType = this.COMMON_TOOLS[i % this.COMMON_TOOLS.length];
      const itemName = `${toolType}_${i}`;

      items.push({
        name: itemName,
        displayName: `${toolType.charAt(0).toUpperCase() + toolType.slice(1)} ${i}`,
        type: 'tool',
        hasTexture: true,
        hasModel: true,
      });

      textures.push({
        name: itemName,
        type: 'item',
        size: 16,
        animated: false,
      });

      models.push({
        name: itemName,
        type: 'item',
        parent: toolType === 'sword' ? 'item/handheld' : 'item/generated',
        textures: [`${modId}:item/${itemName}`],
      });
    }

    // Generate recipes
    for (let i = 0; i < 5; i++) {
      recipes.push({
        name: `recipe_${i}`,
        type: 'crafting_shaped',
        result: items[i].name,
        ingredients: ['minecraft:stick', 'minecraft:iron_ingot'],
      });
    }

    return {
      name: 'Complex Test Mod',
      modId,
      version: '2.0.0',
      author: 'ComplexAuthor',
      description: 'A complex mod with many components for comprehensive testing',
      blocks,
      items,
      textures,
      models,
      recipes,
    };
  }

  /**
   * Generate a mod with edge cases and problematic content
   */
  static generateEdgeCaseMod(modId: string = 'edgemod'): ModTestData {
    return {
      name: 'Edge Case Test Mod',
      modId,
      version: '0.1.0-alpha',
      author: 'EdgeAuthor',
      description: 'A mod designed to test edge cases and error handling',
      blocks: [
        {
          name: 'block-with-dashes',
          displayName: 'Block With Dashes',
          material: 'stone',
          hardness: 1.0,
          hasTexture: true,
          hasModel: false, // Missing model
          hasBlockstate: true,
        },
        {
          name: 'block_with_unicode_名前',
          displayName: 'Block With Unicode 名前',
          material: 'wood',
          hardness: 0.5,
          hasTexture: false, // Missing texture
          hasModel: true,
          hasBlockstate: true,
        },
      ],
      items: [
        {
          name: 'item.with.dots',
          displayName: 'Item With Dots',
          type: 'misc',
          hasTexture: true,
          hasModel: true,
        },
        {
          name: 'UPPERCASE_ITEM',
          displayName: 'UPPERCASE ITEM',
          type: 'tool',
          hasTexture: true,
          hasModel: false, // Missing model
        },
      ],
      textures: [
        {
          name: 'block-with-dashes',
          type: 'block',
          size: 32, // Non-standard size
          animated: false,
        },
        {
          name: 'item.with.dots',
          type: 'item',
          size: 16,
          animated: true, // Animated item texture
        },
        {
          name: 'UPPERCASE_ITEM',
          type: 'item',
          size: 8, // Very small texture
          animated: false,
        },
      ],
      models: [
        {
          name: 'item.with.dots',
          type: 'item',
          parent: 'item/generated',
          textures: [`${modId}:item/item.with.dots`],
        },
        {
          name: 'block_with_unicode_名前',
          type: 'block',
          parent: 'block/cube_all',
          textures: [`${modId}:block/missing_texture`], // References missing texture
        },
      ],
    };
  }

  /**
   * Generate a mod that mimics real-world mod structures
   */
  static generateRealisticMod(modId: string = 'realisticmod'): ModTestData {
    return {
      name: 'Realistic Test Mod',
      modId,
      version: '1.12.2-2.5.0',
      author: 'RealisticAuthor',
      description: 'A mod that mimics real-world mod structures and patterns',
      blocks: [
        {
          name: 'copper_ore',
          displayName: 'Copper Ore',
          material: 'stone',
          hardness: 3.0,
          hasTexture: true,
          hasModel: true,
          hasBlockstate: true,
        },
        {
          name: 'copper_block',
          displayName: 'Block of Copper',
          material: 'metal',
          hardness: 5.0,
          hasTexture: true,
          hasModel: true,
          hasBlockstate: true,
        },
        {
          name: 'machine_frame',
          displayName: 'Machine Frame',
          material: 'metal',
          hardness: 4.0,
          hasTexture: true,
          hasModel: true,
          hasBlockstate: true,
        },
      ],
      items: [
        {
          name: 'copper_ingot',
          displayName: 'Copper Ingot',
          type: 'material',
          hasTexture: true,
          hasModel: true,
        },
        {
          name: 'copper_sword',
          displayName: 'Copper Sword',
          type: 'tool',
          hasTexture: true,
          hasModel: true,
        },
        {
          name: 'energy_crystal',
          displayName: 'Energy Crystal',
          type: 'misc',
          hasTexture: true,
          hasModel: true,
        },
      ],
      textures: [
        {
          name: 'copper_ore',
          type: 'block',
          size: 16,
          animated: false,
        },
        {
          name: 'copper_block',
          type: 'block',
          size: 16,
          animated: false,
        },
        {
          name: 'machine_frame',
          type: 'block',
          size: 16,
          animated: false,
        },
        {
          name: 'copper_ingot',
          type: 'item',
          size: 16,
          animated: false,
        },
        {
          name: 'copper_sword',
          type: 'item',
          size: 16,
          animated: false,
        },
        {
          name: 'energy_crystal',
          type: 'item',
          size: 16,
          animated: true,
        },
      ],
      models: [
        {
          name: 'copper_ore',
          type: 'block',
          parent: 'block/cube_all',
          textures: [`${modId}:block/copper_ore`],
        },
        {
          name: 'copper_block',
          type: 'block',
          parent: 'block/cube_all',
          textures: [`${modId}:block/copper_block`],
        },
        {
          name: 'copper_sword',
          type: 'item',
          parent: 'item/handheld',
          textures: [`${modId}:item/copper_sword`],
        },
      ],
      recipes: [
        {
          name: 'copper_ingot_from_ore',
          type: 'smelting',
          result: 'copper_ingot',
          ingredients: ['copper_ore'],
        },
        {
          name: 'copper_block',
          type: 'crafting_shaped',
          result: 'copper_block',
          ingredients: ['copper_ingot', 'copper_ingot', 'copper_ingot'],
        },
        {
          name: 'copper_sword',
          type: 'crafting_shaped',
          result: 'copper_sword',
          ingredients: ['copper_ingot', 'minecraft:stick'],
        },
      ],
      lootTables: [
        {
          name: 'copper_ore',
          type: 'block',
          pools: [
            {
              rolls: 1,
              entries: [
                {
                  item: 'copper_ore',
                  weight: 1,
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Create a JAR file from mod test data
   */
  static async createJarFromTestData(testData: ModTestData, outputPath: string): Promise<void> {
    const zip = new AdmZip();

    // Add manifest (mcmod.info format)
    const mcmodInfo = [
      {
        modid: testData.modId,
        name: testData.name,
        description: testData.description,
        version: testData.version,
        authorList: [testData.author],
      },
    ];
    zip.addFile('mcmod.info', Buffer.from(JSON.stringify(mcmodInfo, null, 2)));

    // Add lang file
    const langData: Record<string, string> = {};
    testData.blocks.forEach((block) => {
      langData[`block.${testData.modId}.${block.name}`] = block.displayName;
    });
    testData.items.forEach((item) => {
      langData[`item.${testData.modId}.${item.name}`] = item.displayName;
    });
    langData[`itemGroup.${testData.modId}.general`] = `${testData.name} Items`;

    zip.addFile(
      `assets/${testData.modId}/lang/en_us.json`,
      Buffer.from(JSON.stringify(langData, null, 2))
    );

    // Add texture files
    testData.textures.forEach((texture) => {
      const texturePath = `assets/${testData.modId}/textures/${texture.type}/${texture.name}.png`;
      // Create fake PNG data
      const pngData = this.createFakePngData(texture.size, texture.animated);
      zip.addFile(texturePath, pngData);

      // Add animation metadata for animated textures
      if (texture.animated) {
        const animationData = {
          animation: {
            frametime: 4,
            frames: [0, 1, 2, 3],
          },
        };
        zip.addFile(`${texturePath}.mcmeta`, Buffer.from(JSON.stringify(animationData, null, 2)));
      }
    });

    // Add model files
    testData.models.forEach((model) => {
      const modelPath = `assets/${testData.modId}/models/${model.type}/${model.name}.json`;
      const modelData = {
        parent: model.parent,
        textures: model.textures.reduce(
          (acc, texture, index) => {
            acc[index === 0 ? (model.type === 'block' ? 'all' : 'layer0') : `layer${index}`] =
              texture;
            return acc;
          },
          {} as Record<string, string>
        ),
      };
      zip.addFile(modelPath, Buffer.from(JSON.stringify(modelData, null, 2)));
    });

    // Add blockstate files for blocks
    testData.blocks.forEach((block) => {
      if (block.hasBlockstate) {
        const blockstatePath = `assets/${testData.modId}/blockstates/${block.name}.json`;
        const blockstateData = {
          variants: {
            '': {
              model: `${testData.modId}:block/${block.name}`,
            },
          },
        };
        zip.addFile(blockstatePath, Buffer.from(JSON.stringify(blockstateData, null, 2)));
      }
    });

    // Add recipe files
    if (testData.recipes) {
      testData.recipes.forEach((recipe) => {
        const recipePath = `data/${testData.modId}/recipes/${recipe.name}.json`;
        const recipeData = this.createRecipeData(recipe, testData.modId);
        zip.addFile(recipePath, Buffer.from(JSON.stringify(recipeData, null, 2)));
      });
    }

    // Add loot table files
    if (testData.lootTables) {
      testData.lootTables.forEach((lootTable) => {
        const lootTablePath = `data/${testData.modId}/loot_tables/${lootTable.type}s/${lootTable.name}.json`;
        const lootTableData = {
          type: `minecraft:${lootTable.type}`,
          pools: lootTable.pools.map((pool) => ({
            rolls: pool.rolls,
            entries: pool.entries.map((entry) => ({
              type: 'minecraft:item',
              name: entry.item.includes(':') ? entry.item : `${testData.modId}:${entry.item}`,
              weight: entry.weight,
            })),
          })),
        };
        zip.addFile(lootTablePath, Buffer.from(JSON.stringify(lootTableData, null, 2)));
      });
    }

    // Write the JAR file
    await fs.writeFile(outputPath, zip.toBuffer());
  }

  /**
   * Create fake PNG data for testing
   */
  private static createFakePngData(size: number, animated: boolean): Buffer {
    // Create a minimal PNG header
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // Create IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(size, 0); // Width
    ihdrData.writeUInt32BE(animated ? size * 4 : size, 4); // Height (4x for animated)
    ihdrData.writeUInt8(8, 8); // Bit depth
    ihdrData.writeUInt8(2, 9); // Color type (RGB)
    ihdrData.writeUInt8(0, 10); // Compression
    ihdrData.writeUInt8(0, 11); // Filter
    ihdrData.writeUInt8(0, 12); // Interlace

    const ihdrChunk = Buffer.concat([Buffer.from('IHDR'), ihdrData]);

    // Create minimal IDAT chunk (compressed image data)
    const idatData = Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]);
    const idatChunk = Buffer.concat([Buffer.from('IDAT'), idatData]);

    // Create IEND chunk
    const iendChunk = Buffer.from('IEND');

    // Combine all chunks with length and CRC (simplified)
    return Buffer.concat([
      pngSignature,
      Buffer.from([0x00, 0x00, 0x00, 0x0d]), // IHDR length
      ihdrChunk,
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // IHDR CRC (fake)
      Buffer.from([0x00, 0x00, 0x00, 0x08]), // IDAT length
      idatChunk,
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // IDAT CRC (fake)
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // IEND length
      iendChunk,
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // IEND CRC (fake)
    ]);
  }

  /**
   * Create recipe data based on recipe test data
   */
  private static createRecipeData(recipe: RecipeTestData, modId: string): any {
    const result = recipe.result.includes(':') ? recipe.result : `${modId}:${recipe.result}`;

    switch (recipe.type) {
      case 'crafting_shaped':
        return {
          type: 'minecraft:crafting_shaped',
          pattern: ['XXX', ' Y ', ' Y '],
          key: {
            X: { item: recipe.ingredients[0] },
            Y: { item: recipe.ingredients[1] || 'minecraft:stick' },
          },
          result: { item: result },
        };

      case 'crafting_shapeless':
        return {
          type: 'minecraft:crafting_shapeless',
          ingredients: recipe.ingredients.map((ingredient) => ({ item: ingredient })),
          result: { item: result },
        };

      case 'smelting':
        return {
          type: 'minecraft:smelting',
          ingredient: { item: recipe.ingredients[0] },
          result: result,
          experience: 0.1,
          cookingtime: 200,
        };

      default:
        throw new Error(`Unknown recipe type: ${recipe.type}`);
    }
  }

  /**
   * Generate test data for performance testing
   */
  static generatePerformanceTestData(
    modId: string,
    scale: 'small' | 'medium' | 'large'
  ): ModTestData {
    const scales = {
      small: { blocks: 10, items: 10, textures: 20 },
      medium: { blocks: 50, items: 50, textures: 100 },
      large: { blocks: 200, items: 200, textures: 400 },
    };

    const config = scales[scale];
    const blocks: BlockTestData[] = [];
    const items: ItemTestData[] = [];
    const textures: TextureTestData[] = [];
    const models: ModelTestData[] = [];

    // Generate blocks
    for (let i = 0; i < config.blocks; i++) {
      const blockName = `perf_block_${i}`;
      blocks.push({
        name: blockName,
        displayName: `Performance Block ${i}`,
        material: this.COMMON_MATERIALS[i % this.COMMON_MATERIALS.length],
        hardness: Math.random() * 5,
        hasTexture: true,
        hasModel: true,
        hasBlockstate: true,
      });

      textures.push({
        name: blockName,
        type: 'block',
        size: 16,
        animated: i % 10 === 0,
      });

      models.push({
        name: blockName,
        type: 'block',
        parent: 'block/cube_all',
        textures: [`${modId}:block/${blockName}`],
      });
    }

    // Generate items
    for (let i = 0; i < config.items; i++) {
      const itemName = `perf_item_${i}`;
      items.push({
        name: itemName,
        displayName: `Performance Item ${i}`,
        type: 'misc',
        hasTexture: true,
        hasModel: true,
      });

      textures.push({
        name: itemName,
        type: 'item',
        size: 16,
        animated: false,
      });

      models.push({
        name: itemName,
        type: 'item',
        parent: 'item/generated',
        textures: [`${modId}:item/${itemName}`],
      });
    }

    return {
      name: `Performance Test Mod (${scale})`,
      modId,
      version: '1.0.0',
      author: 'PerformanceAuthor',
      description: `A ${scale} mod for performance testing`,
      blocks,
      items,
      textures,
      models,
    };
  }
}

// Export test data presets
export const TEST_DATA_PRESETS = {
  simple: () => TestDataGenerator.generateSimpleMod(),
  complex: () => TestDataGenerator.generateComplexMod(),
  edgeCase: () => TestDataGenerator.generateEdgeCaseMod(),
  realistic: () => TestDataGenerator.generateRealisticMod(),
  performanceSmall: () => TestDataGenerator.generatePerformanceTestData('perfmod', 'small'),
  performanceMedium: () => TestDataGenerator.generatePerformanceTestData('perfmod', 'medium'),
  performanceLarge: () => TestDataGenerator.generatePerformanceTestData('perfmod', 'large'),
};
