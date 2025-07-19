import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AddonPackager } from '../../../../src/modules/packaging/AddonPackager';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  createWriteStream: vi.fn(() => ({
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(callback, 0);
      }
      return {};
    })
  }))
}));

// Create mock archiver object
const mockArchiver = {
  on: vi.fn().mockReturnThis(),
  pipe: vi.fn().mockReturnThis(),
  directory: vi.fn().mockReturnThis(),
  finalize: vi.fn()
};

// Mock require function to return our mock archiver
vi.mock('archiver', () => mockArchiver);

// Override the require function in the module scope
(global as any).require = vi.fn((name: string) => {
  if (name === 'archiver') {
    return () => mockArchiver;
  }
  return vi.fn();
});

describe('AddonPackager', () => {
  let addonPackager: AddonPackager;
  let mockInput: any;

  beforeEach(() => {
    addonPackager = new AddonPackager();
    
    // Reset mocks
    vi.resetAllMocks();
    
    // Mock existsSync to return false so directories are created
    (fs.existsSync as any).mockReturnValue(false);
    
    // Setup mock input data
    mockInput = {
      bedrockAssets: {
        textures: [{ path: 'blocks/test_texture.png', content: Buffer.from('texture data') }],
        models: [{ path: 'blocks/test_model.json', content: '{"geometry": "test"}' }],
        sounds: [{ path: 'music/test_sound.ogg', content: Buffer.from('sound data') }],
        particles: [{ path: 'particles/test_particle.json', content: '{"particle": "test"}' }]
      },
      bedrockConfigs: {
        manifests: {
          behaviorPack: {
            format_version: 2,
            header: {
              name: 'Test Behavior Pack',
              description: 'Test description',
              uuid: '12345678-1234-1234-1234-123456789012',
              version: [1, 0, 0],
              min_engine_version: [1, 16, 0]
            },
            modules: [
              {
                type: 'data',
                uuid: '12345678-1234-1234-1234-123456789013',
                version: [1, 0, 0]
              }
            ]
          },
          resourcePack: {
            format_version: 2,
            header: {
              name: 'Test Resource Pack',
              description: 'Test description',
              uuid: '12345678-1234-1234-1234-123456789014',
              version: [1, 0, 0],
              min_engine_version: [1, 16, 0]
            },
            modules: [
              {
                type: 'resources',
                uuid: '12345678-1234-1234-1234-123456789015',
                version: [1, 0, 0]
              }
            ]
          }
        },
        definitions: {
          blocks: [{ path: 'test_block.json', content: '{"block": "test"}' }],
          items: [{ path: 'test_item.json', content: '{"item": "test"}' }]
        },
        recipes: [{ path: 'test_recipe.json', content: '{"recipe": "test"}' }],
        lootTables: [{ path: 'test_loot_table.json', content: '{"loot_table": "test"}' }]
      },
      bedrockScripts: [{ path: 'main.js', content: 'console.log("Hello World");' }],
      conversionNotes: [
        { type: 'info', message: 'Test note', severity: 'info' }
      ],
      licenseInfo: {
        type: 'MIT',
        text: 'MIT License',
        attributions: ['Original mod by Test Author']
      },
      outputPath: '/test/output'
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create directories if they do not exist', async () => {
    await addonPackager.createAddon(mockInput);
    
    // Check if directories were created
    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/output/temp', { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/output/temp/behavior_pack', { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/output/temp/resource_pack', { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/output/temp/documentation', { recursive: true });
  });

  it('should write manifest files', async () => {
    await addonPackager.createAddon(mockInput);
    
    // Check if manifest files were written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/test/output/temp/behavior_pack/manifest.json',
      JSON.stringify(mockInput.bedrockConfigs.manifests.behaviorPack, null, 2)
    );
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/test/output/temp/resource_pack/manifest.json',
      JSON.stringify(mockInput.bedrockConfigs.manifests.resourcePack, null, 2)
    );
  });

  it('should write script files', async () => {
    await addonPackager.createAddon(mockInput);
    
    // Check if script directory was created
    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/output/temp/behavior_pack/scripts', { recursive: true });
    
    // Check if script file was written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/test/output/temp/behavior_pack/scripts/main.js',
      'console.log("Hello World");'
    );
  });

  it('should write license files', async () => {
    await addonPackager.createAddon(mockInput);
    
    // Expected license content
    const expectedLicenseContent = 'MIT License\n\nAttributions:\n- Original mod by Test Author\n';
    
    // Check if license files were written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/test/output/temp/behavior_pack/LICENSE',
      expectedLicenseContent
    );
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/test/output/temp/resource_pack/LICENSE',
      expectedLicenseContent
    );
  });

  it('should return the correct output paths', async () => {
    const result = await addonPackager.createAddon(mockInput);
    
    expect(result).toEqual({
      mcaddonFilePath: '/test/output/test_behavior_pack.mcaddon',
      behaviorPackPath: '/test/output/temp/behavior_pack',
      resourcePackPath: '/test/output/temp/resource_pack'
    });
  });
});