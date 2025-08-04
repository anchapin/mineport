/**
 * Unit tests for AssetConverter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetConverter } from '../../../../src/modules/conversion-agents/AssetConverter.js';
import { TextureInfo, SoundInfo, ModelInfo } from '../../../../src/modules/conversion-agents/types.js';
import sharp from 'sharp';

// Mock sharp
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 16, height: 16, channels: 4 }),
    ensureAlpha: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnValue({
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-png-data')),
    }),
  })),
}));

describe('AssetConverter', () => {
  let assetConverter: AssetConverter;

  beforeEach(() => {
    assetConverter = new AssetConverter();
    vi.clearAllMocks();
  });

  describe('convertTextures', () => {
    it('should convert textures successfully', async () => {
      const textures: TextureInfo[] = [
        {
          path: 'textures/blocks/stone.png',
          name: 'stone.png',
          type: 'block',
          buffer: Buffer.from('mock-image-data'),
          width: 16,
          height: 16,
          format: 'png',
        },
      ];

      const result = await assetConverter.convertTextures(textures);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0].path).toBe('textures/blocks/stone.png');
      expect(result.outputFiles[0].type).toBe('texture');
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.processedCount).toBe(1);
      expect(result.metadata.successCount).toBe(1);
    });

    it('should handle texture conversion errors', async () => {
      const mockSharp = vi.mocked(sharp);
      mockSharp.mockImplementation(() => {
        throw new Error('Sharp processing failed');
      });

      const textures: TextureInfo[] = [
        {
          path: 'textures/blocks/invalid.png',
          name: 'invalid.png',
          type: 'block',
          buffer: Buffer.from('invalid-data'),
        },
      ];

      const result = await assetConverter.convertTextures(textures);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Failed to convert texture invalid.png');
      expect(result.metadata.failureCount).toBe(1);
    });

    it('should resize textures when necessary', async () => {
      const mockSharpInstance = {
        metadata: vi.fn().mockResolvedValue({ width: 32, height: 32, channels: 4 }),
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        png: vi.fn().mockReturnValue({
          toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized-png-data')),
        }),
      };

      const mockSharp = vi.mocked(sharp);
      mockSharp.mockReturnValue(mockSharpInstance as any);

      const textures: TextureInfo[] = [
        {
          path: 'textures/blocks/large.png',
          name: 'large.png',
          type: 'block',
          buffer: Buffer.from('large-image-data'),
        },
      ];

      await assetConverter.convertTextures(textures);

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(16, 16, { kernel: 'nearest' });
    });

    it('should add compression info for highly compressed textures', async () => {
      const originalSize = 1000;
      const compressedSize = 200;

      const mockSharpInstance = {
        metadata: vi.fn().mockResolvedValue({ width: 16, height: 16, channels: 4 }),
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        png: vi.fn().mockReturnValue({
          toBuffer: vi.fn().mockResolvedValue(Buffer.alloc(compressedSize)),
        }),
      };

      const mockSharp = vi.mocked(sharp);
      mockSharp.mockReturnValue(mockSharpInstance as any);

      const textures: TextureInfo[] = [
        {
          path: 'textures/blocks/compressible.png',
          name: 'compressible.png',
          type: 'block',
          buffer: Buffer.alloc(originalSize),
        },
      ];

      const result = await assetConverter.convertTextures(textures);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('compressed by');
    });
  });

  describe('convertSounds', () => {
    it('should convert sounds successfully', async () => {
      const sounds: SoundInfo[] = [
        {
          path: 'sounds/block/stone/break.ogg',
          name: 'break.ogg',
          category: 'block',
          buffer: Buffer.from('mock-sound-data'),
          format: 'ogg',
        },
      ];

      const result = await assetConverter.convertSounds(sounds);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(2); // sound file + sounds.json
      expect(result.outputFiles[0].path).toBe('sounds.json');
      expect(result.outputFiles[1].path).toBe('sounds/break.ogg');
      expect(result.errors).toHaveLength(0);
    });

    it('should generate proper sounds.json', async () => {
      const sounds: SoundInfo[] = [
        {
          path: 'sounds/block/stone/break.ogg',
          name: 'break.ogg',
          category: 'block',
          buffer: Buffer.from('mock-sound-data'),
          format: 'ogg',
        },
      ];

      const result = await assetConverter.convertSounds(sounds);

      const soundsJsonFile = result.outputFiles.find((f) => f.path === 'sounds.json');
      expect(soundsJsonFile).toBeDefined();

      const soundsJson = JSON.parse(soundsJsonFile!.content as string);
      expect(soundsJson.break).toBeDefined();
      expect(soundsJson.break.category).toBe('block');
      expect(soundsJson.break.sounds).toHaveLength(1);
    });
  });

  describe('convertModels', () => {
    it('should convert models successfully', async () => {
      const models: ModelInfo[] = [
        {
          path: 'models/block/stone.json',
          name: 'stone',
          type: 'block',
          content: {
            texture_width: 16,
            texture_height: 16,
            elements: [
              {
                from: [0, 0, 0],
                to: [16, 16, 16],
                faces: {
                  north: { uv: [0, 0] },
                },
              },
            ],
          },
        },
      ];

      const result = await assetConverter.convertModels(models);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0].path).toBe('models/blocks/stone.json');
      expect(result.errors).toHaveLength(0);
    });

    it('should convert Java model format to Bedrock format', async () => {
      const models: ModelInfo[] = [
        {
          path: 'models/block/test.json',
          name: 'test',
          type: 'block',
          content: {
            texture_width: 32,
            texture_height: 32,
            elements: [
              {
                from: [0, 0, 0],
                to: [8, 8, 8],
                faces: {
                  north: { uv: [0, 0] },
                },
              },
            ],
          },
        },
      ];

      const result = await assetConverter.convertModels(models);

      const modelFile = result.outputFiles[0];
      const bedrockModel = JSON.parse(modelFile.content as string);

      expect(bedrockModel.format_version).toBe('1.12.0');
      expect(bedrockModel['minecraft:geometry']).toHaveLength(1);
      expect(bedrockModel['minecraft:geometry'][0].description.identifier).toBe('geometry.test');
      expect(bedrockModel['minecraft:geometry'][0].description.texture_width).toBe(32);
      expect(bedrockModel['minecraft:geometry'][0].bones).toHaveLength(1);
    });

    it('should warn about complex model features', async () => {
      const models: ModelInfo[] = [
        {
          path: 'models/block/complex.json',
          name: 'complex',
          type: 'block',
          content: {
            animation: { rotation: true },
            display: {
              thirdperson_righthand: {},
              thirdperson_lefthand: {},
              firstperson_righthand: {},
              firstperson_lefthand: {},
              gui: {},
              head: {},
              ground: {},
              fixed: {},
            },
          },
        },
      ];

      const result = await assetConverter.convertModels(models);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('complex features');
    });

    it('should handle models without elements', async () => {
      const models: ModelInfo[] = [
        {
          path: 'models/block/empty.json',
          name: 'empty',
          type: 'block',
          content: {
            texture_width: 16,
            texture_height: 16,
          },
        },
      ];

      const result = await assetConverter.convertModels(models);

      expect(result.success).toBe(true);

      const modelFile = result.outputFiles[0];
      const bedrockModel = JSON.parse(modelFile.content as string);

      expect(bedrockModel['minecraft:geometry'][0].bones).toHaveLength(1);
      expect(bedrockModel['minecraft:geometry'][0].bones[0].name).toBe('main');
    });
  });

  describe('path generation', () => {
    it('should generate correct texture paths for different types', async () => {
      const textures: TextureInfo[] = [
        { path: 'test', name: 'block.png', type: 'block', buffer: Buffer.alloc(0) },
        { path: 'test', name: 'item.png', type: 'item', buffer: Buffer.alloc(0) },
        { path: 'test', name: 'entity.png', type: 'entity', buffer: Buffer.alloc(0) },
        { path: 'test', name: 'gui.png', type: 'gui', buffer: Buffer.alloc(0) },
        { path: 'test', name: 'other.png', type: 'other', buffer: Buffer.alloc(0) },
      ];

      const result = await assetConverter.convertTextures(textures);

      expect(result.outputFiles[0].path).toBe('textures/blocks/block.png');
      expect(result.outputFiles[1].path).toBe('textures/items/item.png');
      expect(result.outputFiles[2].path).toBe('textures/entity/entity.png');
      expect(result.outputFiles[3].path).toBe('textures/gui/gui.png');
      expect(result.outputFiles[4].path).toBe('textures/other.png');
    });

    it('should generate correct model paths for different types', async () => {
      const models: ModelInfo[] = [
        { path: 'test', name: 'block.json', type: 'block', content: {} },
        { path: 'test', name: 'item.json', type: 'item', content: {} },
        { path: 'test', name: 'entity.json', type: 'entity', content: {} },
      ];

      const result = await assetConverter.convertModels(models);

      expect(result.outputFiles[0].path).toBe('models/blocks/block.json');
      expect(result.outputFiles[1].path).toBe('models/items/item.json');
      expect(result.outputFiles[2].path).toBe('models/entity/entity.json');
    });
  });

  describe('error handling', () => {
    it('should handle conversion errors gracefully', async () => {
      const textures: TextureInfo[] = [
        { path: 'valid', name: 'valid.png', type: 'block', buffer: Buffer.alloc(100) },
        { path: 'invalid', name: 'invalid.png', type: 'block', buffer: Buffer.alloc(0) },
      ];

      // Mock sharp to fail on the second texture
      let callCount = 0;
      const mockSharp = vi.mocked(sharp);
      mockSharp.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Processing failed');
        }
        return {
          metadata: vi.fn().mockResolvedValue({ width: 16, height: 16, channels: 4 }),
          ensureAlpha: vi.fn().mockReturnThis(),
          resize: vi.fn().mockReturnThis(),
          png: vi.fn().mockReturnValue({
            toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-data')),
          }),
        } as any;
      });

      const result = await assetConverter.convertTextures(textures);

      expect(result.success).toBe(false);
      expect(result.outputFiles).toHaveLength(1); // Only the successful one
      expect(result.errors).toHaveLength(1);
      expect(result.metadata.successCount).toBe(1);
      expect(result.metadata.failureCount).toBe(1);
    });
  });
});
