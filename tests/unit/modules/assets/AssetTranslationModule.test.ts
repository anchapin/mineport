import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetTranslationModule } from '../../../../src/modules/assets/AssetTranslationModule';
import { TextureConverter } from '../../../../src/modules/assets/TextureConverter';
import { ModelConverter } from '../../../../src/modules/assets/ModelConverter';
import { SoundProcessor } from '../../../../src/modules/assets/SoundProcessor';
import { ParticleMapper } from '../../../../src/modules/assets/ParticleMapper';

// Mock the component classes
vi.mock('../../../../src/modules/assets/TextureConverter');
vi.mock('../../../../src/modules/assets/ModelConverter');
vi.mock('../../../../src/modules/assets/SoundProcessor');
vi.mock('../../../../src/modules/assets/ParticleMapper');
vi.mock('../../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('AssetTranslationModule', () => {
  let assetTranslationModule: AssetTranslationModule;
  let mockTextureConverter: any;
  let mockModelConverter: any;
  let mockSoundProcessor: any;
  let mockParticleMapper: any;
  
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Setup mock implementations
    mockTextureConverter = {
      convertTextures: vi.fn().mockResolvedValue({
        convertedTextures: [{ path: 'texture1.png' }],
        atlases: [],
        conversionNotes: [{ type: 'info', message: 'Texture converted', texturePath: 'texture1.png' }]
      }),
      organizeTextures: vi.fn().mockResolvedValue(undefined)
    };
    
    mockModelConverter = {
      convertModels: vi.fn().mockResolvedValue({
        convertedModels: [{ path: 'model1.json' }],
        conversionNotes: [{ type: 'info', message: 'Model converted', modelPath: 'model1.json' }]
      }),
      organizeModels: vi.fn().mockResolvedValue(undefined)
    };
    
    mockSoundProcessor = {
      convertSounds: vi.fn().mockResolvedValue({
        convertedSounds: [{ path: 'sound1.ogg' }],
        soundsJson: { sounds: {} },
        conversionNotes: [{ type: 'info', message: 'Sound converted', soundPath: 'sound1.ogg' }]
      }),
      organizeSounds: vi.fn().mockResolvedValue(undefined)
    };
    
    mockParticleMapper = {
      convertParticles: vi.fn().mockResolvedValue({
        convertedParticles: [{ path: 'particle1.json' }],
        conversionNotes: [{ type: 'info', message: 'Particle converted', particleName: 'particle1' }]
      }),
      organizeParticles: vi.fn().mockResolvedValue(undefined)
    };
    
    // Mock the constructors
    (TextureConverter as any).mockImplementation(() => mockTextureConverter);
    (ModelConverter as any).mockImplementation(() => mockModelConverter);
    (SoundProcessor as any).mockImplementation(() => mockSoundProcessor);
    (ParticleMapper as any).mockImplementation(() => mockParticleMapper);
    
    // Create the module instance
    assetTranslationModule = new AssetTranslationModule();
  });
  
  describe('translateAssets', () => {
    it('should translate all asset types and return combined results', async () => {
      // Prepare test data
      const javaAssets = {
        textures: [{ path: 'java_texture.png', data: Buffer.from([]) }],
        models: [{ path: 'java_model.json', data: {}, type: 'block' as const }],
        sounds: [{ path: 'java_sound.ogg', data: Buffer.from([]) }],
        particles: [{ path: 'java_particle.json', data: {}, name: 'test_particle' }]
      };
      
      // Call the method
      const result = await assetTranslationModule.translateAssets(javaAssets);
      
      // Verify component methods were called
      expect(mockTextureConverter.convertTextures).toHaveBeenCalledWith(javaAssets.textures);
      expect(mockModelConverter.convertModels).toHaveBeenCalledWith(javaAssets.models);
      expect(mockSoundProcessor.convertSounds).toHaveBeenCalledWith(javaAssets.sounds);
      expect(mockParticleMapper.convertParticles).toHaveBeenCalledWith(javaAssets.particles);
      
      // Verify the result structure
      expect(result).toHaveProperty('bedrockAssets');
      expect(result).toHaveProperty('conversionNotes');
      
      // Verify the assets were combined correctly
      expect(result.bedrockAssets.textures).toEqual([{ path: 'texture1.png' }]);
      expect(result.bedrockAssets.models).toEqual([{ path: 'model1.json' }]);
      expect(result.bedrockAssets.sounds).toEqual([{ path: 'sound1.ogg' }]);
      expect(result.bedrockAssets.particles).toEqual([{ path: 'particle1.json' }]);
      expect(result.bedrockAssets.soundsJson).toEqual({ sounds: {} });
      
      // Verify the notes were mapped correctly
      expect(result.conversionNotes).toHaveLength(4);
      expect(result.conversionNotes[0]).toEqual({
        type: 'info',
        component: 'texture',
        message: 'Texture converted',
        assetPath: 'texture1.png'
      });
    });
    
    it('should handle empty asset collections', async () => {
      // Prepare test data with empty collections
      const emptyAssets = {
        textures: [],
        models: [],
        sounds: [],
        particles: []
      };
      
      // Update mock return values for empty inputs
      mockTextureConverter.convertTextures.mockResolvedValue({
        convertedTextures: [],
        atlases: [],
        conversionNotes: []
      });
      
      mockModelConverter.convertModels.mockResolvedValue({
        convertedModels: [],
        conversionNotes: []
      });
      
      mockSoundProcessor.convertSounds.mockResolvedValue({
        convertedSounds: [],
        soundsJson: { sounds: {} },
        conversionNotes: []
      });
      
      mockParticleMapper.convertParticles.mockResolvedValue({
        convertedParticles: [],
        conversionNotes: []
      });
      
      // Call the method
      const result = await assetTranslationModule.translateAssets(emptyAssets);
      
      // Verify component methods were called with empty arrays
      expect(mockTextureConverter.convertTextures).toHaveBeenCalledWith([]);
      expect(mockModelConverter.convertModels).toHaveBeenCalledWith([]);
      expect(mockSoundProcessor.convertSounds).toHaveBeenCalledWith([]);
      expect(mockParticleMapper.convertParticles).toHaveBeenCalledWith([]);
      
      // Verify the result has empty collections
      expect(result.bedrockAssets.textures).toEqual([]);
      expect(result.bedrockAssets.models).toEqual([]);
      expect(result.bedrockAssets.sounds).toEqual([]);
      expect(result.bedrockAssets.particles).toEqual([]);
      expect(result.conversionNotes).toEqual([]);
    });
  });
  
  describe('organizeAssets', () => {
    it('should organize all asset types in the output directory', async () => {
      // Prepare test data
      const bedrockAssets = {
        textures: [{ path: 'texture1.png', data: Buffer.from([]) }],
        models: [{ path: 'model1.json', data: {} }],
        sounds: [{ path: 'sound1.ogg', data: Buffer.from([]) }],
        particles: [{ path: 'particle1.json', data: {} }],
        soundsJson: { sounds: {} }
      };
      
      const outputDir = '/output/path';
      
      // Call the method
      await assetTranslationModule.organizeAssets(bedrockAssets, outputDir);
      
      // Verify component methods were called
      expect(mockTextureConverter.organizeTextures).toHaveBeenCalledWith(
        bedrockAssets.textures,
        outputDir
      );
      
      expect(mockModelConverter.organizeModels).toHaveBeenCalledWith(
        bedrockAssets.models,
        outputDir
      );
      
      expect(mockSoundProcessor.organizeSounds).toHaveBeenCalledWith(
        bedrockAssets.sounds,
        bedrockAssets.soundsJson,
        outputDir
      );
      
      expect(mockParticleMapper.organizeParticles).toHaveBeenCalledWith(
        bedrockAssets.particles,
        outputDir
      );
    });
  });
});