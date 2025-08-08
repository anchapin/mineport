import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ModelConverter,
  JavaModelFile,
  BedrockModelFile,
} from '../../../../src/modules/assets/ModelConverter.js';

// Mock the logger
vi.mock('../../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation((filePath) => {
    // Return different mock data based on file path
    if (filePath.includes('block_model.json')) {
      return Promise.resolve(
        Buffer.from(
          JSON.stringify({
            parent: 'minecraft:block/cube_all',
            textures: {
              all: 'examplemod:block/example_block',
            },
            elements: [
              {
                from: [0, 0, 0],
                to: [16, 16, 16],
                faces: {
                  north: { texture: '#all', uv: [0, 0, 16, 16] },
                  east: { texture: '#all', uv: [0, 0, 16, 16] },
                  south: { texture: '#all', uv: [0, 0, 16, 16] },
                  west: { texture: '#all', uv: [0, 0, 16, 16] },
                  up: { texture: '#all', uv: [0, 0, 16, 16] },
                  down: { texture: '#all', uv: [0, 0, 16, 16] },
                },
              },
            ],
          })
        )
      );
    } else if (filePath.includes('item_model.json')) {
      return Promise.resolve(
        Buffer.from(
          JSON.stringify({
            parent: 'minecraft:item/generated',
            textures: {
              layer0: 'examplemod:item/example_item',
            },
          })
        )
      );
    } else if (filePath.includes('entity_model.json')) {
      return Promise.resolve(
        Buffer.from(
          JSON.stringify({
            textures: {
              0: 'examplemod:entity/example_entity',
            },
            bones: [
              {
                name: 'head',
                pivot: [0, 24, 0],
                cubes: [
                  {
                    origin: [-4, 20, -4],
                    size: [8, 8, 8],
                    uv: [0, 0],
                  },
                ],
              },
              {
                name: 'body',
                pivot: [0, 12, 0],
                cubes: [
                  {
                    origin: [-4, 12, -2],
                    size: [8, 12, 4],
                    uv: [16, 16],
                  },
                ],
              },
            ],
          })
        )
      );
    }
    return Promise.resolve(Buffer.from('mock-model-data'));
  }),
}));

describe('ModelConverter', () => {
  let converter: ModelConverter;
  let mockJavaModels: JavaModelFile[];

  beforeEach(() => {
    converter = new ModelConverter();

    // Reset mocks
    vi.clearAllMocks();

    // Setup mock Java models
    mockJavaModels = [
      {
        path: 'assets/examplemod/models/block/example_block.json',
        data: {
          parent: 'minecraft:block/cube_all',
          textures: {
            all: 'examplemod:block/example_block',
          },
          elements: [
            {
              from: [0, 0, 0],
              to: [16, 16, 16],
              faces: {
                north: { texture: '#all', uv: [0, 0, 16, 16] },
                east: { texture: '#all', uv: [0, 0, 16, 16] },
                south: { texture: '#all', uv: [0, 0, 16, 16] },
                west: { texture: '#all', uv: [0, 0, 16, 16] },
                up: { texture: '#all', uv: [0, 0, 16, 16] },
                down: { texture: '#all', uv: [0, 0, 16, 16] },
              },
            },
          ],
        },
        type: 'block',
      },
      {
        path: 'assets/examplemod/models/item/example_item.json',
        data: {
          parent: 'minecraft:item/generated',
          textures: {
            layer0: 'examplemod:item/example_item',
          },
        },
        type: 'item',
      },
      {
        path: 'assets/examplemod/models/entity/example_entity.json',
        data: {
          textures: {
            0: 'examplemod:entity/example_entity',
          },
          bones: [
            {
              name: 'head',
              pivot: [0, 24, 0],
              cubes: [
                {
                  origin: [-4, 20, -4],
                  size: [8, 8, 8],
                  uv: [0, 0],
                },
              ],
            },
            {
              name: 'body',
              pivot: [0, 12, 0],
              cubes: [
                {
                  origin: [-4, 12, -2],
                  size: [8, 12, 4],
                  uv: [16, 16],
                },
              ],
            },
          ],
        },
        type: 'entity',
      },
    ];
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('convertModels', () => {
    it('should convert all models successfully', async () => {
      const result = await converter.convertModels(mockJavaModels);

      // Check that we have the correct number of converted models
      expect(result.convertedModels).toHaveLength(mockJavaModels.length);

      // Check that there are no conversion errors
      expect(result.conversionNotes.filter((note) => note.type === 'error')).toHaveLength(0);

      // Check that paths were mapped correctly
      expect(result.convertedModels[0].path).toContain(
        'models/blocks/examplemod_example_block.geo.json'
      );
      expect(result.convertedModels[1].path).toContain(
        'models/items/examplemod_example_item.geo.json'
      );
      expect(result.convertedModels[2].path).toContain(
        'models/entity/examplemod_example_entity.geo.json'
      );
    });

    it('should handle errors during conversion', async () => {
      // Mock implementation to simulate an error
      const originalConvertSingleModel = ModelConverter.prototype['convertSingleModel'];
      ModelConverter.prototype['convertSingleModel'] = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      // Create a model that will cause an error
      const errorModel: JavaModelFile = {
        path: 'assets/examplemod/models/block/error_model.json',
        data: Buffer.from('error-model'),
        type: 'block',
      };

      const result = await converter.convertModels([errorModel]);

      // Restore the original method
      ModelConverter.prototype['convertSingleModel'] = originalConvertSingleModel;

      // We expect the convertedModels to be empty since the conversion failed
      expect(result.convertedModels).toHaveLength(0);
      // We expect a conversion note of type 'error'
      expect(result.conversionNotes.length).toBeGreaterThan(0);
      expect(result.conversionNotes[0].type).toBe('error');
    });
  });

  describe('validateModel', () => {
    it('should validate a valid model', () => {
      const validModel: BedrockModelFile = {
        path: 'models/blocks/examplemod_example_block.geo.json',
        data: {
          format_version: '1.12.0',
          'minecraft:geometry': [
            {
              description: {
                identifier: 'geometry.examplemod_example_block',
                texture_width: 16,
                texture_height: 16,
                visible_bounds_width: 2,
                visible_bounds_height: 2,
                visible_bounds_offset: [0, 0, 0],
              },
              bones: [
                {
                  name: 'block',
                  pivot: [0, 0, 0],
                  cubes: [
                    {
                      origin: [-8, 0, -8],
                      size: [16, 16, 16],
                      uv: {
                        north: { uv: [0, 0], uv_size: [16, 16] },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        type: 'block',
      };

      const result = converter.validateModel(validModel);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect issues in an invalid model', () => {
      const invalidModel: BedrockModelFile = {
        path: 'models/blocks/examplemod_invalid_block.geo.json',
        data: {
          // Missing format_version
          'minecraft:geometry': [
            {
              // Missing description
              bones: [
                {
                  // Missing name
                  pivot: 'not-an-array', // Invalid pivot
                  cubes: [
                    {
                      // Missing origin and size
                    },
                  ],
                },
              ],
            },
          ],
        },
        type: 'block',
      };

      const result = converter.validateModel(invalidModel);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues).toContain('Missing format_version');
      expect(result.issues).toContain('Missing geometry description');
    });
  });

  describe('organizeModels', () => {
    it('should organize models in the correct directory structure', async () => {
      const mockBedrockModels: BedrockModelFile[] = [
        {
          path: 'models/blocks/examplemod_example_block.geo.json',
          data: {
            format_version: '1.12.0',
            'minecraft:geometry': [
              {
                description: {
                  identifier: 'geometry.examplemod_example_block',
                  texture_width: 16,
                  texture_height: 16,
                  visible_bounds_width: 2,
                  visible_bounds_height: 2,
                  visible_bounds_offset: [0, 0, 0],
                },
                bones: [
                  {
                    name: 'block',
                    pivot: [0, 0, 0],
                    cubes: [
                      {
                        origin: [-8, 0, -8],
                        size: [16, 16, 16],
                        uv: {
                          north: { uv: [0, 0], uv_size: [16, 16] },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          type: 'block',
        },
        {
          path: 'models/items/examplemod_example_item.geo.json',
          data: {
            format_version: '1.12.0',
            'minecraft:geometry': [
              {
                description: {
                  identifier: 'geometry.examplemod_example_item',
                  texture_width: 16,
                  texture_height: 16,
                  visible_bounds_width: 2,
                  visible_bounds_height: 2,
                  visible_bounds_offset: [0, 0, 0],
                },
                bones: [
                  {
                    name: 'item',
                    pivot: [0, 0, 0],
                    cubes: [
                      {
                        origin: [-8, 0, 0],
                        size: [16, 16, 0.1],
                        uv: {
                          north: { uv: [0, 0], uv_size: [16, 16] },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          type: 'item',
        },
      ];

      await converter.organizeModels(mockBedrockModels, '/output/dir');

      // Check that directories were created
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(path.join('/output/dir', 'models/blocks')),
        expect.anything()
      );

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(path.join('/output/dir', 'models/items')),
        expect.anything()
      );

      // Check that files were written
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('examplemod_example_block.geo.json'),
        expect.anything()
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('examplemod_example_item.geo.json'),
        expect.anything()
      );
    });

    it('should create material definition files when needed', async () => {
      const mockModelWithMaterials: BedrockModelFile = {
        path: 'models/blocks/examplemod_material_block.geo.json',
        data: {
          format_version: '1.12.0',
          'minecraft:geometry': [
            {
              description: {
                identifier: 'geometry.examplemod_material_block',
                texture_width: 16,
                texture_height: 16,
                visible_bounds_width: 2,
                visible_bounds_height: 2,
                visible_bounds_offset: [0, 0, 0],
              },
              bones: [
                {
                  name: 'block',
                  pivot: [0, 0, 0],
                  cubes: [
                    {
                      origin: [-8, 0, -8],
                      size: [16, 16, 16],
                      uv: {
                        north: { uv: [0, 0], uv_size: [16, 16] },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        type: 'block',
        metadata: {
          materials: {
            default: {
              texture: 'examplemod:block/example_block',
              render_method: 'opaque',
            },
          },
        },
      };

      await converter.organizeModels([mockModelWithMaterials], '/output/dir');

      // Check that the material definition file was written
      expect(fs.writeFile).toHaveBeenCalledTimes(2); // One for the model, one for the material def

      // Check that writeFile was called with the correct arguments for the material file
      const writeFileCalls = (fs.writeFile as jest.Mock).mock.calls;
      const materialFileCall = writeFileCalls.find((call) => call[0].includes('material.json'));

      expect(materialFileCall).toBeDefined();
      expect(materialFileCall[0]).toContain('examplemod_material_block.material.json');

      // The JSON string might have different formatting, so we parse it and check the values
      const materialData = JSON.parse(materialFileCall[1]);
      expect(materialData.materials).toBeDefined();
      expect(materialData.materials.default).toBeDefined();
      expect(materialData.materials.default.texture).toBe('examplemod:block/example_block');
    });
  });

  describe('convertBlockModel', () => {
    it('should convert a block model correctly', async () => {
      // We need to access a private method for this test
      const convertBlockModel = (ModelConverter.prototype as any)['convertBlockModel'];

      const result = convertBlockModel.call(converter, mockJavaModels[0]);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.format_version).toBe('1.12.0');
      expect(result.data['minecraft:geometry']).toBeDefined();
      expect(result.data['minecraft:geometry'][0].bones).toHaveLength(1);
      expect(result.data['minecraft:geometry'][0].bones[0].name).toBe('block');
      expect(result.data['minecraft:geometry'][0].bones[0].cubes).toHaveLength(1);

      // Check that the cube was converted correctly
      const cube = result.data['minecraft:geometry'][0].bones[0].cubes[0];
      expect(cube.origin).toEqual([-8, 0, -8]);
      expect(cube.size).toEqual([16, 16, 16]);
      expect(cube.uv).toBeDefined();
    });
  });

  describe('convertItemModel', () => {
    it('should convert an item model correctly', async () => {
      // We need to access a private method for this test
      const convertItemModel = (ModelConverter.prototype as any)['convertItemModel'];

      const result = convertItemModel.call(converter, mockJavaModels[1]);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.format_version).toBe('1.12.0');
      expect(result.data['minecraft:geometry']).toBeDefined();
      expect(result.data['minecraft:geometry'][0].bones).toHaveLength(1);
      expect(result.data['minecraft:geometry'][0].bones[0].name).toBe('item');

      // Check that the item is represented as a flat plane
      const cube = result.data['minecraft:geometry'][0].bones[0].cubes[0];
      expect(cube.size[2]).toBeLessThan(1); // Should be a thin plane
    });
  });

  describe('convertEntityModel', () => {
    it('should convert an entity model correctly', async () => {
      // We need to access a private method for this test
      const convertEntityModel = (ModelConverter.prototype as any)['convertEntityModel'];

      const result = convertEntityModel.call(converter, mockJavaModels[2]);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.format_version).toBe('1.12.0');
      expect(result.data['minecraft:geometry']).toBeDefined();

      // Check that the bones were converted correctly
      const bones = result.data['minecraft:geometry'][0].bones;
      expect(bones).toHaveLength(2); // Should have head and body
      expect(bones[0].name).toBe('head');
      expect(bones[1].name).toBe('body');

      // Check that the head bone has the correct pivot and cube
      expect(bones[0].pivot).toEqual([0, 24, 0]);
      expect(bones[0].cubes).toHaveLength(1);
      expect(bones[0].cubes[0].size).toEqual([8, 8, 8]);
    });
  });
});
