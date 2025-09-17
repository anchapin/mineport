import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AddonPackager } from '../../../../src/modules/packaging/AddonPackager.js';
import * as fs from 'fs';
import * as path from 'path';

// Create mock write stream
const mockWriteStream: any = {
  on: vi.fn((event: string, callback: () => void) => {
    if (event === 'close') {
      // Immediately call the callback to resolve the promise
      setImmediate(callback);
    }
    return mockWriteStream;
  }),
  once: vi.fn((event, callback) => {
    if (event === 'close') {
      setImmediate(callback);
    }
    return mockWriteStream;
  }),
  emit: vi.fn(),
  write: vi.fn(),
  end: vi.fn(),
  destroy: vi.fn(),
  writable: true,
  readable: false,
};

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  createWriteStream: vi.fn(() => mockWriteStream),
}));

// Create mock archiver object
const mockArchiver = {
  on: vi.fn().mockReturnThis(),
  pipe: vi.fn().mockReturnThis(),
  directory: vi.fn().mockReturnThis(),
  file: vi.fn().mockReturnThis(),
  append: vi.fn().mockReturnThis(),
  finalize: vi.fn(),
};

// Mock archiver module - it should return a function that creates archiver instances
vi.mock('archiver', () => ({
  default: vi.fn(() => mockArchiver),
}));

// Override the require function in the module scope
(global as any).require = vi.fn((name: string) => {
  if (name === 'archiver') {
    return vi.fn(() => mockArchiver);
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

    // Re-setup mocks after reset
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any);

    // Mock the createMcaddonArchive method to avoid archiver complexity
    vi.spyOn(addonPackager as any, 'createMcaddonArchive').mockResolvedValue(undefined);

    // Setup mock input data
    mockInput = {
      bedrockAssets: {
        textures: [{ path: 'blocks/test_texture.png', content: Buffer.from('texture data') }],
        models: [{ path: 'blocks/test_model.json', content: '{"geometry": "test"}' }],
        sounds: [{ path: 'music/test_sound.ogg', content: Buffer.from('sound data') }],
        particles: [{ path: 'particles/test_particle.json', content: '{"particle": "test"}' }],
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
              min_engine_version: [1, 16, 0],
            },
            modules: [
              {
                type: 'data',
                uuid: '12345678-1234-1234-1234-123456789013',
                version: [1, 0, 0],
              },
            ],
          },
          resourcePack: {
            format_version: 2,
            header: {
              name: 'Test Resource Pack',
              description: 'Test description',
              uuid: '12345678-1234-1234-1234-123456789014',
              version: [1, 0, 0],
              min_engine_version: [1, 16, 0],
            },
            modules: [
              {
                type: 'resources',
                uuid: '12345678-1234-1234-1234-123456789015',
                version: [1, 0, 0],
              },
            ],
          },
        },
        definitions: {
          blocks: [{ path: 'test_block.json', content: '{"block": "test"}' }],
          items: [{ path: 'test_item.json', content: '{"item": "test"}' }],
        },
        recipes: [{ path: 'test_recipe.json', content: '{"recipe": "test"}' }],
        lootTables: [{ path: 'test_loot_table.json', content: '{"loot_table": "test"}' }],
      },
      bedrockScripts: [{ path: 'main.js', content: 'console.log("Hello World");' }],
      conversionNotes: [{ type: 'info', message: 'Test note', severity: 'info' }],
      licenseInfo: {
        type: 'MIT',
        text: 'MIT License',
        attributions: ['Original mod by Test Author'],
      },
      outputPath: '/test/output',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create directories if they do not exist', async () => {
    await addonPackager.createAddon(mockInput);

    // Check if root directory was created
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/test/output/temp'), {
      recursive: true,
    });

    // Check if behavior pack directory was created
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/test/output/temp/behavior_pack'), {
      recursive: true,
    });

    // Check if resource pack directory was created
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/test/output/temp/resource_pack'), {
      recursive: true,
    });

    // Check if documentation directory was created
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/test/output/temp/documentation'), {
      recursive: true,
    });
  });

  it('should write manifest files', async () => {
    await addonPackager.createAddon(mockInput);

    // Check if manifest files were written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/test/output/temp/behavior_pack/manifest.json'),
      JSON.stringify(mockInput.bedrockConfigs.manifests.behaviorPack, null, 2)
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/test/output/temp/resource_pack/manifest.json'),
      JSON.stringify(mockInput.bedrockConfigs.manifests.resourcePack, null, 2)
    );
  });

  it('should write script files', async () => {
    await addonPackager.createAddon(mockInput);

    // Check if script directory was created
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.join('/test/output/temp/behavior_pack', 'scripts'),
      {
        recursive: true,
      }
    );

    // Check if script file was written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/test/output/temp/behavior_pack', 'scripts', 'main.js'),
      'console.log("Hello World");'
    );

    // Check if license files were written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/test/output/temp/resource_pack/LICENSE'),
      expect.stringContaining('MIT License')
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/test/output/temp/behavior_pack/LICENSE'),
      expect.stringContaining('MIT License')
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/test/output/temp/documentation/LICENSE'),
      expect.stringContaining('MIT License')
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/test/output/temp/metadata.json'),
      expect.stringContaining('"originalMod"')
    );
  });

  it('should return the correct output paths', async () => {
    const result = await addonPackager.createAddon(mockInput);

    expect(result).toEqual({
      mcaddonFilePath: expect.stringContaining('test_behavior_pack_v1.0.0.mcaddon'),
      behaviorPackPath: path.join('/test/output/temp/behavior_pack'),
      resourcePackPath: path.join('/test/output/temp/resource_pack'),
    });
  });
});
