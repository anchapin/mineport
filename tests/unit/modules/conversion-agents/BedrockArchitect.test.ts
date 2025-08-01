/**
 * Unit tests for BedrockArchitect
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BedrockArchitect, ModInfo, AssetInfo } from '../../../../src/modules/conversion-agents/BedrockArchitect';

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234')
}));

describe('BedrockArchitect', () => {
  let architect: BedrockArchitect;

  beforeEach(() => {
    architect = new BedrockArchitect();
    vi.clearAllMocks();
  });

  describe('generateAddonStructure', () => {
    it('should generate complete addon structure', async () => {
      const modInfo: ModInfo = {
        id: 'testmod',
        name: 'Test Mod',
        version: '1.0.0',
        description: 'A test mod',
        author: 'Test Author'
      };

      const structure = await architect.generateAddonStructure(modInfo);

      expect(structure.behaviorPack).toBeDefined();
      expect(structure.resourcePack).toBeDefined();
      expect(structure.sharedFiles).toContain('pack_icon.png');
      expect(structure.sharedFiles).toContain('README.md');
      expect(structure.sharedFiles).toContain('CHANGELOG.md');
    });

    it('should create proper directory structures', async () => {
      const modInfo: ModInfo = {
        id: 'testmod',
        name: 'Test Mod',
        version: '1.0.0'
      };

      const structure = await architect.generateAddonStructure(modInfo);

      // Check behavior pack directories
      expect(structure.behaviorPack.directories).toHaveProperty('blocks');
      expect(structure.behaviorPack.directories).toHaveProperty('items');
      expect(structure.behaviorPack.directories).toHaveProperty('recipes');
      expect(structure.behaviorPack.directories).toHaveProperty('entities');

      // Check resource pack directories
      expect(structure.resourcePack.directories).toHaveProperty('textures/blocks');
      expect(structure.resourcePack.directories).toHaveProperty('textures/items');
      expect(structure.resourcePack.directories).toHaveProperty('models/blocks');
      expect(structure.resourcePack.directories).toHaveProperty('sounds');
    });
  });

  describe('createManifests', () => {
    it('should create valid manifests for both packs', async () => {
      const modInfo: ModInfo = {
        id: 'testmod',
        name: 'Test Mod',
        version: '1.2.3',
        description: 'A test mod',
        author: 'Test Author'
      };

      const manifests = await architect.createManifests(modInfo);

      // Check behavior pack manifest
      expect(manifests.behaviorPack.format_version).toBe(2);
      expect(manifests.behaviorPack.header.name).toBe('Test Mod Behavior Pack');
      expect(manifests.behaviorPack.header.description).toBe('A test mod');
      expect(manifests.behaviorPack.header.version).toEqual([1, 2, 3]);
      expect(manifests.behaviorPack.modules).toHaveLength(1);
      expect(manifests.behaviorPack.modules[0].type).toBe('data');

      // Check resource pack manifest
      expect(manifests.resourcePack.format_version).toBe(2);
      expect(manifests.resourcePack.header.name).toBe('Test Mod Resource Pack');
      expect(manifests.resourcePack.header.version).toEqual([1, 2, 3]);
      expect(manifests.resourcePack.modules).toHaveLength(1);
      expect(manifests.resourcePack.modules[0].type).toBe('resources');

      // Check dependencies
      expect(manifests.behaviorPack.dependencies).toHaveLength(1);
      expect(manifests.behaviorPack.dependencies[0].uuid).toBe('mock-uuid-1234');
    });

    it('should handle version parsing correctly', async () => {
      const testCases = [
        { input: '1.0.0', expected: [1, 0, 0] },
        { input: '2.5', expected: [2, 5, 0] },
        { input: '3', expected: [3, 0, 0] },
        { input: '1.0.0-beta', expected: [1, 0, 0] },
        { input: 'v2.1.3', expected: [2, 1, 3] }
      ];

      for (const testCase of testCases) {
        const modInfo: ModInfo = {
          id: 'test',
          name: 'Test',
          version: testCase.input
        };

        const manifests = await architect.createManifests(modInfo);
        expect(manifests.behaviorPack.header.version).toEqual(testCase.expected);
      }
    });

    it('should use default values when optional fields are missing', async () => {
      const modInfo: ModInfo = {
        id: 'minimal',
        name: 'Minimal Mod',
        version: '1.0.0'
      };

      const manifests = await architect.createManifests(modInfo);

      expect(manifests.behaviorPack.header.description).toBe('Behavior pack for Minimal Mod');
      expect(manifests.behaviorPack.header.min_engine_version).toEqual([1, 20, 0]);
      expect(manifests.behaviorPack.metadata.authors).toEqual([]);
    });
  });

  describe('organizeAssets', () => {
    it('should organize assets correctly', async () => {
      const assets: AssetInfo[] = [
        {
          path: 'textures/blocks/stone.png',
          type: 'texture',
          content: Buffer.from('texture-data'),
          category: 'blocks'
        },
        {
          path: 'models/blocks/stone.json',
          type: 'model',
          content: '{"test": "model"}',
          category: 'blocks'
        },
        {
          path: 'sounds/block/stone/break.ogg',
          type: 'sound',
          content: Buffer.from('sound-data')
        }
      ];

      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      const result = await architect.organizeAssets(assets, structure);

      expect(result.success).toBe(true);
      expect(result.outputFiles.length).toBeGreaterThan(assets.length); // Includes manifests
      
      // Check that manifests are included
      const manifestFiles = result.outputFiles.filter(f => f.type === 'manifest');
      expect(manifestFiles).toHaveLength(2);
      expect(manifestFiles.some(f => f.path === 'behavior_pack/manifest.json')).toBe(true);
      expect(manifestFiles.some(f => f.path === 'resource_pack/manifest.json')).toBe(true);

      // Check asset organization
      const textureFile = result.outputFiles.find(f => f.originalPath === 'textures/blocks/stone.png');
      expect(textureFile?.path).toBe('resource_pack/textures/blocks/stone.png');

      const modelFile = result.outputFiles.find(f => f.originalPath === 'models/blocks/stone.json');
      expect(modelFile?.path).toBe('resource_pack/models/blocks/stone.json');

      const soundFile = result.outputFiles.find(f => f.originalPath === 'sounds/block/stone/break.ogg');
      expect(soundFile?.path).toBe('resource_pack/sounds/break.ogg');
    });

    it('should generate additional structure files', async () => {
      const assets: AssetInfo[] = [];
      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      const result = await architect.organizeAssets(assets, structure);

      // Check for generated files
      const readmeFile = result.outputFiles.find(f => f.path === 'README.md');
      expect(readmeFile).toBeDefined();
      expect(readmeFile?.content).toContain('Test Behavior Pack');

      const structureFile = result.outputFiles.find(f => f.path === 'STRUCTURE.md');
      expect(structureFile).toBeDefined();

      const iconFiles = result.outputFiles.filter(f => f.path.includes('pack_icon.png'));
      expect(iconFiles).toHaveLength(2); // One for each pack
    });

    it('should handle asset organization errors', async () => {
      const assets: AssetInfo[] = [
        {
          path: 'invalid/path',
          type: 'texture' as any,
          content: null as any // Invalid content
        }
      ];

      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      const result = await architect.organizeAssets(assets, structure);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.metadata.failureCount).toBe(1);
    });
  });

  describe('validateStructureCompliance', () => {
    it('should validate correct structure', async () => {
      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test Mod',
        version: '1.0.0',
        description: 'Test description'
      });

      const validation = architect.validateStructureCompliance(structure);

      expect(validation.success).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing manifest fields', async () => {
      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      // Corrupt the manifest
      delete structure.behaviorPack.manifest.header;

      const validation = architect.validateStructureCompliance(structure);

      expect(validation.success).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0].message).toContain('Missing header');
    });

    it('should detect invalid UUIDs', async () => {
      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      // Remove UUID
      delete structure.behaviorPack.manifest.header.uuid;

      const validation = architect.validateStructureCompliance(structure);

      expect(validation.success).toBe(false);
      expect(validation.errors.some(e => e.message.includes('Missing UUID'))).toBe(true);
    });

    it('should detect missing modules', async () => {
      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      // Remove modules
      structure.behaviorPack.manifest.modules = [];

      const validation = architect.validateStructureCompliance(structure);

      expect(validation.success).toBe(false);
      expect(validation.errors.some(e => e.message.includes('Missing or empty modules'))).toBe(true);
    });

    it('should warn about missing optional fields', async () => {
      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      // Remove description
      delete structure.behaviorPack.manifest.header.description;

      const validation = architect.validateStructureCompliance(structure);

      expect(validation.warnings.some(w => w.message.includes('Missing description'))).toBe(true);
    });
  });

  describe('path determination', () => {
    it('should determine correct pack types for assets', async () => {
      const assets: AssetInfo[] = [
        { path: 'test', type: 'texture', content: Buffer.alloc(0) },
        { path: 'test', type: 'model', content: Buffer.alloc(0) },
        { path: 'test', type: 'sound', content: Buffer.alloc(0) },
        { path: 'test', type: 'animation', content: Buffer.alloc(0) },
        { path: 'test', type: 'particle', content: Buffer.alloc(0) },
        { path: 'test', type: 'other', content: Buffer.alloc(0) }
      ];

      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      const result = await architect.organizeAssets(assets, structure);

      const resourcePackFiles = result.outputFiles.filter(f => f.path.startsWith('resource_pack/'));
      const behaviorPackFiles = result.outputFiles.filter(f => f.path.startsWith('behavior_pack/'));

      // Resource pack should have texture, model, sound, animation, particle
      expect(resourcePackFiles.some(f => f.originalPath === 'test' && f.type === 'texture')).toBe(true);
      expect(resourcePackFiles.some(f => f.originalPath === 'test' && f.type === 'model')).toBe(true);
      expect(resourcePackFiles.some(f => f.originalPath === 'test' && f.type === 'sound')).toBe(true);
      expect(resourcePackFiles.some(f => f.originalPath === 'test' && f.type === 'animation')).toBe(true);
      expect(resourcePackFiles.some(f => f.originalPath === 'test' && f.type === 'particle')).toBe(true);

      // Behavior pack should have 'other' type
      expect(behaviorPackFiles.some(f => f.originalPath === 'test' && f.type === 'other')).toBe(true);
    });

    it('should organize assets with categories correctly', async () => {
      const assets: AssetInfo[] = [
        {
          path: 'texture1',
          type: 'texture',
          content: Buffer.alloc(0),
          category: 'blocks'
        },
        {
          path: 'texture2',
          type: 'texture',
          content: Buffer.alloc(0),
          category: 'items'
        },
        {
          path: 'texture3',
          type: 'texture',
          content: Buffer.alloc(0)
          // No category
        }
      ];

      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      const result = await architect.organizeAssets(assets, structure);

      const texture1 = result.outputFiles.find(f => f.originalPath === 'texture1');
      const texture2 = result.outputFiles.find(f => f.originalPath === 'texture2');
      const texture3 = result.outputFiles.find(f => f.originalPath === 'texture3');

      expect(texture1?.path).toBe('resource_pack/textures/blocks/texture1');
      expect(texture2?.path).toBe('resource_pack/textures/items/texture2');
      expect(texture3?.path).toBe('resource_pack/textures/texture3');
    });
  });

  describe('metadata tracking', () => {
    it('should track processing metadata correctly', async () => {
      const assets: AssetInfo[] = [
        { path: 'asset1', type: 'texture', content: Buffer.from('data1') },
        { path: 'asset2', type: 'model', content: 'model data' },
        { path: 'asset3', type: 'sound', content: Buffer.from('sound data') }
      ];

      const structure = await architect.generateAddonStructure({
        id: 'test',
        name: 'Test',
        version: '1.0.0'
      });

      const result = await architect.organizeAssets(assets, structure);

      expect(result.metadata.processedCount).toBe(3);
      expect(result.metadata.successCount).toBe(3);
      expect(result.metadata.failureCount).toBe(0);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.totalSize).toBeGreaterThan(0);
    });
  });
});