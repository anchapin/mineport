import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  SoundProcessor,
  JavaSoundFile,
  BedrockSoundFile,
} from '../../../../src/modules/assets/SoundProcessor.js';

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
    if (filePath.includes('block_sound.ogg')) {
      return Promise.resolve(Buffer.from('mock-block-sound-data'));
    } else if (filePath.includes('item_sound.mp3')) {
      return Promise.resolve(Buffer.from('mock-item-sound-data'));
    } else if (filePath.includes('entity_sound.wav')) {
      return Promise.resolve(Buffer.from('mock-entity-sound-data'));
    }
    return Promise.resolve(Buffer.from('mock-sound-data'));
  }),
}));

describe('SoundProcessor', () => {
  let processor: SoundProcessor;
  let mockJavaSounds: JavaSoundFile[];

  beforeEach(() => {
    processor = new SoundProcessor();

    // Reset mocks
    vi.clearAllMocks();

    // Setup mock Java sounds
    mockJavaSounds = [
      {
        path: 'assets/examplemod/sounds/block/example_block.ogg',
        data: Buffer.from('mock-block-sound-data'),
        metadata: {
          category: 'block',
          subtitle: 'Example Block Sound',
          volume: 1.0,
          pitch: 1.0,
        },
      },
      {
        path: 'assets/examplemod/sounds/item/example_item.mp3',
        data: Buffer.from('mock-item-sound-data'),
        metadata: {
          category: 'player',
          subtitle: 'Example Item Sound',
          volume: 0.8,
          pitch: 1.2,
        },
      },
      {
        path: 'assets/examplemod/sounds/entity/example_entity.wav',
        data: Buffer.from('mock-entity-sound-data'),
        metadata: {
          category: 'hostile',
          subtitle: 'Example Entity Sound',
          stream: true,
          volume: 0.9,
          pitch: 0.9,
        },
      },
    ];
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('convertSounds', () => {
    it('should convert all sounds successfully', async () => {
      const result = await processor.convertSounds(mockJavaSounds);

      // Check that we have the correct number of converted sounds
      expect(result.convertedSounds).toHaveLength(mockJavaSounds.length);

      // Check that there are no conversion errors
      expect(result.conversionNotes.filter((note) => note.type === 'error')).toHaveLength(0);

      // Check that paths were mapped correctly
      expect(result.convertedSounds[0].path).toContain('sounds/block/examplemod_example_block.ogg');
      expect(result.convertedSounds[1].path).toContain('sounds/item/examplemod_example_item.mp3');
      expect(result.convertedSounds[2].path).toContain(
        'sounds/entity/examplemod_example_entity.wav'
      );

      // Check that sounds.json was generated
      expect(result.soundsJson).toBeDefined();
      expect(result.soundsJson['format_version']).toBe('1.14.0');
      expect(result.soundsJson['sound_definitions']).toBeDefined();
    });

    it('should handle errors during conversion', async () => {
      // Mock implementation to simulate an error
      const originalConvertSingleSound = SoundProcessor.prototype['convertSingleSound'];
      SoundProcessor.prototype['convertSingleSound'] = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      // Create a sound that will cause an error
      const errorSound: JavaSoundFile = {
        path: 'assets/examplemod/sounds/block/error_sound.ogg',
        data: Buffer.from('error-sound'),
        metadata: {
          category: 'block',
        },
      };

      const result = await processor.convertSounds([errorSound]);

      // Restore the original method
      SoundProcessor.prototype['convertSingleSound'] = originalConvertSingleSound;

      // We expect the convertedSounds to be empty since the conversion failed
      expect(result.convertedSounds).toHaveLength(0);
      // We expect a conversion note of type 'error'
      expect(result.conversionNotes.length).toBeGreaterThan(0);
      expect(result.conversionNotes[0].type).toBe('error');
    });
  });

  describe('mapSoundPath', () => {
    it('should map Java sound paths to Bedrock paths correctly', () => {
      // We need to access a private method for this test
      const mapSoundPath = (SoundProcessor.prototype as any)['mapSoundPath'];

      // Test block sound path mapping
      const blockPath = mapSoundPath.call(
        processor,
        'assets/examplemod/sounds/block/example_block.ogg'
      );
      expect(blockPath).toBe('sounds/block/examplemod_example_block.ogg');

      // Test item sound path mapping
      const itemPath = mapSoundPath.call(
        processor,
        'assets/examplemod/sounds/item/example_item.mp3'
      );
      expect(itemPath).toBe('sounds/item/examplemod_example_item.mp3');

      // Test entity sound path mapping
      const entityPath = mapSoundPath.call(
        processor,
        'assets/examplemod/sounds/entity/example_entity.wav'
      );
      expect(entityPath).toBe('sounds/entity/examplemod_example_entity.wav');
    });
  });

  describe('extractSoundEvent', () => {
    it('should extract sound event names correctly', () => {
      // We need to access a private method for this test
      const extractSoundEvent = (SoundProcessor.prototype as any)['extractSoundEvent'];

      // Test block sound event extraction
      const blockEvent = extractSoundEvent.call(
        processor,
        'assets/examplemod/sounds/block/example_block.ogg'
      );
      expect(blockEvent).toBe('examplemod:block.example_block');

      // Test item sound event extraction
      const itemEvent = extractSoundEvent.call(
        processor,
        'assets/examplemod/sounds/item/example_item.mp3'
      );
      expect(itemEvent).toBe('examplemod:item.example_item');

      // Test entity sound event extraction
      const entityEvent = extractSoundEvent.call(
        processor,
        'assets/examplemod/sounds/entity/example_entity.wav'
      );
      expect(entityEvent).toBe('examplemod:entity.example_entity');

      // Test nested path extraction
      const nestedEvent = extractSoundEvent.call(
        processor,
        'assets/examplemod/sounds/entity/example/nested/sound.wav'
      );
      expect(nestedEvent).toBe('examplemod:entity.example.nested.sound');
    });

    it('should return undefined for invalid paths', () => {
      // We need to access a private method for this test
      const extractSoundEvent = (SoundProcessor.prototype as any)['extractSoundEvent'];

      // Test invalid path
      const invalidEvent = extractSoundEvent.call(processor, 'invalid/path.ogg');
      expect(invalidEvent).toBeUndefined();
    });
  });

  describe('generateSoundsJson', () => {
    it('should generate a valid sounds.json structure', () => {
      // We need to access a private method for this test
      const generateSoundsJson = (SoundProcessor.prototype as any)['generateSoundsJson'];

      const mockSoundEvents = {
        'examplemod:block.example_block': {
          category: 'block',
          subtitle: 'Example Block Sound',
          sounds: [
            {
              name: 'block/examplemod_example_block',
              volume: 1.0,
              pitch: 1.0,
            },
          ],
        },
        'examplemod:item.example_item': {
          category: 'player',
          sounds: [
            {
              name: 'item/examplemod_example_item',
              volume: 0.8,
              pitch: 1.2,
            },
          ],
        },
      };

      const result = generateSoundsJson.call(processor, mockSoundEvents);

      expect(result).toBeDefined();
      expect(result.format_version).toBe('1.14.0');
      expect(result.sound_definitions).toBeDefined();

      // Check that sound events were converted correctly
      expect(result.sound_definitions['examplemod:block.example_block']).toBeDefined();
      expect(result.sound_definitions['examplemod:block.example_block'].category).toBe('block');
      expect(result.sound_definitions['examplemod:block.example_block'].sounds).toHaveLength(1);
      expect(result.sound_definitions['examplemod:block.example_block'].sounds[0].name).toBe(
        'block/examplemod_example_block'
      );
      expect(result.sound_definitions['examplemod:block.example_block'].sounds[0].volume).toBe(1.0);

      expect(result.sound_definitions['examplemod:item.example_item']).toBeDefined();
      expect(result.sound_definitions['examplemod:item.example_item'].category).toBe('player');
      expect(result.sound_definitions['examplemod:item.example_item'].sounds).toHaveLength(1);
      expect(result.sound_definitions['examplemod:item.example_item'].sounds[0].name).toBe(
        'item/examplemod_example_item'
      );
      expect(result.sound_definitions['examplemod:item.example_item'].sounds[0].volume).toBe(0.8);
    });
  });

  describe('mapSoundEvent', () => {
    it('should map Java sound events to Bedrock sound events', () => {
      // Test vanilla Minecraft sound event mapping
      const vanillaEvent = processor.mapSoundEvent('minecraft:block.stone.break');
      expect(vanillaEvent).toBe('block.stone.break');

      // Test mod sound event mapping
      const modEvent = processor.mapSoundEvent('examplemod:block.example_block');
      expect(modEvent).toBe('examplemod:block.example_block');

      // Test custom mapping
      const customMappings = [
        {
          javaEvent: 'examplemod:custom.event',
          bedrockEvent: 'custom.mapped.event',
          category: 'block',
        },
      ];

      const customEvent = processor.mapSoundEvent('examplemod:custom.event', customMappings);
      expect(customEvent).toBe('custom.mapped.event');
    });
  });

  describe('organizeSounds', () => {
    it('should organize sounds in the correct directory structure', async () => {
      const mockBedrockSounds: BedrockSoundFile[] = [
        {
          path: 'sounds/block/examplemod_example_block.ogg',
          data: Buffer.from('mock-block-sound-data'),
          metadata: {
            category: 'block',
            subtitle: 'Example Block Sound',
            volume: 1.0,
            pitch: 1.0,
          },
        },
        {
          path: 'sounds/item/examplemod_example_item.mp3',
          data: Buffer.from('mock-item-sound-data'),
          metadata: {
            category: 'player',
            subtitle: 'Example Item Sound',
            volume: 0.8,
            pitch: 1.2,
          },
        },
      ];

      const mockSoundsJson = {
        format_version: '1.14.0',
        sound_definitions: {
          'examplemod:block.example_block': {
            category: 'block',
            sounds: [
              {
                name: 'block/examplemod_example_block',
                volume: 1.0,
                pitch: 1.0,
              },
            ],
          },
          'examplemod:item.example_item': {
            category: 'player',
            sounds: [
              {
                name: 'item/examplemod_example_item',
                volume: 0.8,
                pitch: 1.2,
              },
            ],
          },
        },
      };

      await processor.organizeSounds(mockBedrockSounds, mockSoundsJson, '/output/dir');

      // Check that directories were created
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(path.join('/output/dir', 'sounds/block')),
        expect.anything()
      );

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(path.join('/output/dir', 'sounds/item')),
        expect.anything()
      );

      // Check that sound files were written
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('examplemod_example_block.ogg'),
        expect.anything()
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('examplemod_example_item.mp3'),
        expect.anything()
      );

      // Check that sounds.json was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('sounds.json'),
        expect.stringMatching(/format_version/)
      );
    });
  });
});
