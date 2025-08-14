import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LootTableConverter,
  JavaLootTable,
  BedrockLootTable,
  LootTableConversionResult,
} from '../../../../src/modules/configuration/LootTableConverter.js';
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

describe('LootTableConverter', () => {
  let converter: LootTableConverter;

  beforeEach(() => {
    converter = new LootTableConverter();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('parseJavaLootTables', () => {
    it('should parse Java loot table JSON files from a directory', async () => {
      // Mock file system operations
      const mockFiles = ['block_loot_table.json', 'entity_loot_table.json'];
      const mockBlockLootTable = JSON.stringify({
        type: 'minecraft:block',
        pools: [
          {
            rolls: 1,
            entries: [
              {
                type: 'minecraft:item',
                name: 'minecraft:diamond',
              },
            ],
          },
        ],
      });

      const mockEntityLootTable = JSON.stringify({
        type: 'minecraft:entity',
        pools: [
          {
            rolls: {
              min: 0,
              max: 2,
            },
            entries: [
              {
                type: 'minecraft:item',
                name: 'minecraft:bone',
                weight: 1,
              },
              {
                type: 'minecraft:item',
                name: 'minecraft:string',
                weight: 1,
              },
            ],
          },
        ],
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
      vi.mocked(fs.readFile).mockImplementation((filePath: any) => {
        if (filePath.includes('block_loot_table.json')) {
          return Promise.resolve(mockBlockLootTable);
        } else {
          return Promise.resolve(mockEntityLootTable);
        }
      });

      const result = await converter.parseJavaLootTables('/mock/loot_tables');

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('minecraft:block');
      expect(result[1].type).toBe('minecraft:entity');
    });

    it('should handle errors when parsing loot table files', async () => {
      // Mock file system operations
      const mockFiles = ['invalid_loot_table.json'];

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

      const result = await converter.parseJavaLootTables('/mock/loot_tables');

      expect(result).toHaveLength(0);
    });
  });

  describe('convertLootTables', () => {
    it('should convert block loot tables to Bedrock format', () => {
      const mockLootTables: JavaLootTable[] = [
        {
          type: 'minecraft:block',
          pools: [
            {
              rolls: 1,
              entries: [
                {
                  type: 'minecraft:item',
                  item: 'minecraft:diamond',
                  functions: [
                    {
                      function: 'minecraft:set_count',
                      count: {
                        min: 1,
                        max: 3,
                      },
                    },
                  ],
                },
              ],
            },
          ],
          sourceFile: 'blocks/diamond_ore.json',
        },
      ];

      const result = converter.convertLootTables(mockLootTables, 'testmod');

      expect(result.success).toBe(true);
      expect(Object.keys(result.lootTables)).toHaveLength(1);

      const lootTableId = Object.keys(result.lootTables)[0];
      const lootTable = result.lootTables[lootTableId];

      expect(lootTable.pools).toHaveLength(1);
      expect(lootTable.pools[0].rolls).toBe(1);
      expect(lootTable.pools[0].entries).toHaveLength(1);
      expect(lootTable.pools[0].entries[0].type).toBe('item');
      expect(lootTable.pools[0].entries[0].name).toBe('minecraft:diamond');
      expect(lootTable.pools[0].entries[0].functions).toHaveLength(1);
      expect(lootTable.pools[0].entries[0].functions?.[0].function).toBe('set_count');
    });

    it('should convert entity loot tables to Bedrock format', () => {
      const mockLootTables: JavaLootTable[] = [
        {
          type: 'minecraft:entity',
          pools: [
            {
              rolls: {
                min: 0,
                max: 2,
              },
              entries: [
                {
                  type: 'minecraft:item',
                  item: 'minecraft:bone',
                  weight: 1,
                  conditions: [
                    {
                      condition: 'minecraft:killed_by_player',
                      killed_by_player: true,
                    },
                  ],
                },
                {
                  type: 'minecraft:item',
                  item: 'minecraft:string',
                  weight: 1,
                },
              ],
            },
          ],
          sourceFile: 'entities/skeleton.json',
        },
      ];

      const result = converter.convertLootTables(mockLootTables, 'testmod');

      expect(result.success).toBe(true);
      expect(Object.keys(result.lootTables)).toHaveLength(1);

      const lootTableId = Object.keys(result.lootTables)[0];
      const lootTable = result.lootTables[lootTableId];

      expect(lootTable.pools).toHaveLength(1);
      expect(lootTable.pools[0].entries).toHaveLength(2);
      expect(lootTable.pools[0].entries[0].type).toBe('item');
      expect(lootTable.pools[0].entries[0].name).toBe('minecraft:bone');
      expect(lootTable.pools[0].entries[0].weight).toBe(1);
      expect(lootTable.pools[0].entries[0].conditions).toHaveLength(1);
      expect(lootTable.pools[0].entries[0].conditions?.[0].condition).toBe('killed_by_player');
    });

    it('should handle complex loot functions and generate warnings', () => {
      const mockLootTables: JavaLootTable[] = [
        {
          type: 'minecraft:block',
          pools: [
            {
              rolls: 1,
              entries: [
                {
                  type: 'minecraft:item',
                  item: 'minecraft:diamond',
                  functions: [
                    {
                      function: 'minecraft:set_nbt',
                      tag: '{display:{Name:\\"Special Diamond\\"}}',
                    },
                  ],
                },
              ],
            },
          ],
          sourceFile: 'blocks/special_diamond_ore.json',
        },
      ];

      const result = converter.convertLootTables(mockLootTables, 'testmod');

      expect(result.success).toBe(true);
      expect(
        result.conversionNotes.some(
          (note) => note.type === 'warning' && note.message.includes('Complex function')
        )
      ).toBe(true);
    });

    it('should handle tag entries and generate warnings', () => {
      const mockLootTables: JavaLootTable[] = [
        {
          type: 'minecraft:block',
          pools: [
            {
              rolls: 1,
              entries: [
                {
                  type: 'minecraft:tag',
                  tag: 'minecraft:planks',
                  weight: 1,
                },
              ],
            },
          ],
          sourceFile: 'blocks/wooden_structure.json',
        },
      ];

      const result = converter.convertLootTables(mockLootTables, 'testmod');

      expect(result.success).toBe(true);
      // The tag entry should be converted to a placeholder item
      const lootTableId = Object.keys(result.lootTables)[0];
      const lootTable = result.lootTables[lootTableId];

      expect(lootTable.pools[0].entries[0].type).toBe('item');
      expect(lootTable.pools[0].entries[0].name).toBe('minecraft:stone'); // Placeholder
    });

    it('should handle errors in loot table conversion', () => {
      const mockLootTables: JavaLootTable[] = [
        {
          type: 'minecraft:block',
          pools: [
            {
              rolls: 1,
              entries: [
                {
                  type: 'minecraft:item',
                  // Missing item name
                  weight: 1,
                } as any,
              ],
            },
          ],
          sourceFile: 'blocks/invalid_loot_table.json',
        },
      ];

      const result = converter.convertLootTables(mockLootTables, 'testmod');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('writeLootTables', () => {
    it('should write converted loot tables to the output directory', async () => {
      const mockResult: LootTableConversionResult = {
        success: true,
        lootTables: {
          'testmod:blocks/diamond_ore': {
            pools: [
              {
                rolls: 1,
                entries: [
                  {
                    type: 'item',
                    name: 'minecraft:diamond',
                    weight: 1,
                    functions: [
                      {
                        function: 'set_count',
                        count: {
                          min: 1,
                          max: 3,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        conversionNotes: [],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await converter.writeLootTables(mockResult, '/output/behavior_pack');

      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('loot_tables'),
        expect.anything()
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('diamond_ore.json'),
        expect.anything()
      );
    });

    it('should return false if the conversion result is not successful', async () => {
      const mockResult: LootTableConversionResult = {
        success: false,
        lootTables: {},
        errors: ['Test error'],
        conversionNotes: [],
      };

      const result = await converter.writeLootTables(mockResult, '/output/behavior_pack');

      expect(result).toBe(false);
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('validateLootTable', () => {
    it('should validate a loot table correctly', () => {
      const lootTable: BedrockLootTable = {
        pools: [
          {
            rolls: 1,
            entries: [
              {
                type: 'item',
                name: 'minecraft:diamond',
                weight: 1,
              },
            ],
          },
        ],
      };

      const result = converter.validateLootTable(lootTable);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields in loot tables', () => {
      const lootTable: BedrockLootTable = {
        pools: [
          {
            // Missing rolls
            entries: [
              {
                type: 'item',
                name: 'minecraft:diamond',
                weight: 1,
              },
            ],
          } as any,
        ],
      };

      const result = converter.validateLootTable(lootTable);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Pool 0 is missing rolls');
    });

    it('should detect missing entries in pools', () => {
      const lootTable: BedrockLootTable = {
        pools: [
          {
            rolls: 1,
            entries: [], // Empty entries array
          },
        ],
      };

      const result = converter.validateLootTable(lootTable);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Pool 0 must have at least one entry');
    });

    it('should detect missing type in entries', () => {
      const lootTable: BedrockLootTable = {
        pools: [
          {
            rolls: 1,
            entries: [
              {
                // Missing type
                name: 'minecraft:diamond',
                weight: 1,
              } as any,
            ],
          },
        ],
      };

      const result = converter.validateLootTable(lootTable);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry 0 in pool 0 is missing type');
    });

    it('should detect missing item name in item entries', () => {
      const lootTable: BedrockLootTable = {
        pools: [
          {
            rolls: 1,
            entries: [
              {
                type: 'item',
                // Missing item name
                weight: 1,
              } as any,
            ],
          },
        ],
      };

      const result = converter.validateLootTable(lootTable);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item entry 0 in pool 0 is missing item name');
    });
  });
});
