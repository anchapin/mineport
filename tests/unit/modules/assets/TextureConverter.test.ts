import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  TextureConverter,
  JavaTextureFile,
  BedrockTextureFile,
  TextureAtlasConfig,
} from '../../../../src/modules/assets/TextureConverter.js';

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
    if (filePath.includes('block_texture.png')) {
      return Promise.resolve(Buffer.from('mock-block-texture-data'));
    } else if (filePath.includes('item_texture.png')) {
      return Promise.resolve(Buffer.from('mock-item-texture-data'));
    } else if (filePath.includes('animated_texture.png')) {
      return Promise.resolve(Buffer.from('mock-animated-texture-data'));
    }
    return Promise.resolve(Buffer.from('mock-texture-data'));
  }),
}));

describe('TextureConverter', () => {
  let converter: TextureConverter;
  let mockJavaTextures: JavaTextureFile[];

  beforeEach(() => {
    converter = new TextureConverter();

    // Reset mocks
    vi.clearAllMocks();

    // Setup mock Java textures
    mockJavaTextures = [
      {
        path: 'assets/examplemod/textures/block/stone_block.png',
        data: Buffer.from('mock-block-texture-data'),
      },
      {
        path: 'assets/examplemod/textures/item/magic_wand.png',
        data: Buffer.from('mock-item-texture-data'),
      },
      {
        path: 'assets/examplemod/textures/block/lava_flow.png',
        data: Buffer.from('mock-animated-texture-data'),
        metadata: {
          animated: true,
          frameTime: 2,
          frames: [0, 1, 2, 3],
        },
      },
    ];
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('convertTextures', () => {
    it('should convert all textures successfully', async () => {
      const result = await converter.convertTextures(mockJavaTextures);

      // Check that we have the correct number of converted textures
      expect(result.convertedTextures).toHaveLength(mockJavaTextures.length);

      // Check that there are no conversion errors
      expect(result.conversionNotes.filter((note) => note.type === 'error')).toHaveLength(0);

      // Check that paths were mapped correctly
      expect(result.convertedTextures[0].path).toContain('blocks/examplemod_stone_block.png');
      expect(result.convertedTextures[1].path).toContain('items/examplemod_magic_wand.png');
    });

    it('should handle animated textures correctly', async () => {
      const result = await converter.convertTextures([mockJavaTextures[2]]);

      expect(result.convertedTextures).toHaveLength(1);
      expect(result.convertedTextures[0].metadata?.animated).toBe(true);
      expect(result.convertedTextures[0].metadata?.frameTime).toBe(2);
      expect(result.convertedTextures[0].metadata?.frames).toEqual([0, 1, 2, 3]);
    });

    it('should handle errors during conversion', async () => {
      // Mock implementation to simulate an error
      const originalConvertSingleTexture = TextureConverter.prototype['convertSingleTexture'];
      TextureConverter.prototype['convertSingleTexture'] = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      // Create a texture that will cause an error
      const errorTexture: JavaTextureFile = {
        path: 'assets/examplemod/textures/block/error_texture.png',
        data: Buffer.from('error-texture'),
      };

      const result = await converter.convertTextures([errorTexture]);

      // Restore the original method
      TextureConverter.prototype['convertSingleTexture'] = originalConvertSingleTexture;

      // We expect the convertedTextures to be empty since the conversion failed
      expect(result.convertedTextures).toHaveLength(0);
      // We expect a conversion note of type 'error'
      expect(result.conversionNotes.length).toBeGreaterThan(0);
      expect(result.conversionNotes[0].type).toBe('error');
    });
  });

  describe('generateTextureAtlas', () => {
    it('should generate a texture atlas', async () => {
      const atlasConfig: TextureAtlasConfig = {
        name: 'blocks',
        textures: mockJavaTextures.slice(0, 2), // Use the first two textures
        tileSize: 16,
      };

      const atlas = await converter.generateTextureAtlas(atlasConfig);

      expect(atlas).toBeDefined();
      expect(atlas.path).toBe('textures/atlas/blocks.png');
    });
  });

  describe('organizeTextures', () => {
    it('should organize textures in the correct directory structure', async () => {
      const mockBedrockTextures: BedrockTextureFile[] = [
        {
          path: 'textures/blocks/examplemod_stone_block.png',
          data: Buffer.from('mock-block-texture-data'),
        },
        {
          path: 'textures/items/examplemod_magic_wand.png',
          data: Buffer.from('mock-item-texture-data'),
        },
      ];

      await converter.organizeTextures(mockBedrockTextures, '/output/dir');

      // Check that directories were created
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(path.join('/output/dir', 'textures/blocks')),
        expect.anything()
      );

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(path.join('/output/dir', 'textures/items')),
        expect.anything()
      );

      // Check that files were written
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('examplemod_stone_block.png'),
        expect.anything()
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('examplemod_magic_wand.png'),
        expect.anything()
      );
    });

    it('should create animation definition files for animated textures', async () => {
      const mockAnimatedTexture: BedrockTextureFile = {
        path: 'textures/blocks/examplemod_lava_flow.png',
        data: Buffer.from('mock-animated-texture-data'),
        metadata: {
          animated: true,
          frameTime: 2,
          frames: [0, 1, 2, 3],
        },
      };

      await converter.organizeTextures([mockAnimatedTexture], '/output/dir');

      // Check that the animation definition file was written
      expect(fs.writeFile).toHaveBeenCalledTimes(2); // One for the texture, one for the animation def

      // Check that writeFile was called with the correct arguments for the animation file
      // We need to check the second call to writeFile
      const writeFileCalls = (fs.writeFile as any).mock.calls;
      const animationFileCall = writeFileCalls.find((call) => call[0].includes('animation.json'));

      expect(animationFileCall).toBeDefined();
      expect(animationFileCall[0]).toContain('examplemod_lava_flow.animation.json');
      // The JSON string might have different formatting, so we parse it and check the values
      const animationData = JSON.parse(animationFileCall[1]);
      expect(animationData.animation.frametime).toBe(2);
      expect(animationData.animation.frames).toEqual([0, 1, 2, 3]);
    });
  });
});
