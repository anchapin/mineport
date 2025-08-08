import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManifestGenerator } from '../../../../src/modules/configuration/ManifestGenerator.js';
import fs from 'fs/promises';
import path from 'path';

// Mock the external dependencies
vi.mock('fs/promises');
vi.mock('../../../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('ManifestGenerator', () => {
  let manifestGenerator: ManifestGenerator;

  beforeEach(() => {
    manifestGenerator = new ManifestGenerator();

    // Reset all mocks
    vi.resetAllMocks();

    // Mock fs.access for fileExists
    vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
      if (
        filePath.includes('mods.toml') ||
        filePath.includes('fabric.mod.json') ||
        filePath.includes('mcmod.info')
      ) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock fs.readFile for metadata extraction
    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath.includes('mods.toml')) {
        return `
          modId = "examplemod"
          displayName = "Example Mod"
          version = "1.0.0"
          description = "This is an example mod"
          authors = "Developer1, Developer2"
          displayURL = "https://example.com"
          logoFile = "logo.png"
        `;
      } else if (filePath.includes('fabric.mod.json')) {
        return JSON.stringify({
          id: 'fabricmod',
          name: 'Fabric Example Mod',
          version: '2.0.0',
          description: 'A fabric mod example',
          authors: ['Developer1', 'Developer2'],
          contact: {
            homepage: 'https://fabricmc.net',
            sources: 'https://github.com/example/fabric-mod',
          },
          icon: 'assets/fabricmod/icon.png',
        });
      } else if (filePath.includes('mcmod.info')) {
        return JSON.stringify([
          {
            modid: 'legacymod',
            name: 'Legacy Mod',
            version: '0.9.0',
            description: 'A legacy forge mod',
            authorList: ['Developer1', 'Developer2'],
            url: 'https://legacy-forge.net',
            logoFile: 'logo.png',
          },
        ]);
      }
      return '';
    });

    // Mock fs.mkdir for directory creation
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    // Mock fs.writeFile for writing manifests
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('extractModMetadata', () => {
    it('should extract metadata from mods.toml', async () => {
      // Arrange
      const modPath = '/path/to/mod';

      // Mock fs.access to only find mods.toml
      vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
        if (filePath.includes('mods.toml')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      // Act
      const result = await manifestGenerator.extractModMetadata(modPath);

      // Assert
      expect(result).toEqual({
        modId: 'examplemod',
        modName: 'Example Mod',
        modVersion: '1.0.0',
        description: 'This is an example mod',
        authors: ['Developer1', 'Developer2'],
        website: 'https://example.com',
        logoFile: 'logo.png',
      });
    });

    it('should extract metadata from fabric.mod.json', async () => {
      // Arrange
      const modPath = '/path/to/mod';

      // Mock fs.access to only find fabric.mod.json
      vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
        if (filePath.includes('fabric.mod.json')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      // Act
      const result = await manifestGenerator.extractModMetadata(modPath);

      // Assert
      expect(result).toEqual({
        modId: 'fabricmod',
        modName: 'Fabric Example Mod',
        modVersion: '2.0.0',
        description: 'A fabric mod example',
        authors: ['Developer1', 'Developer2'],
        website: 'https://fabricmc.net',
        logoFile: 'assets/fabricmod/icon.png',
      });
    });

    it('should extract metadata from mcmod.info', async () => {
      // Arrange
      const modPath = '/path/to/mod';

      // Mock fs.access to only find mcmod.info
      vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
        if (filePath.includes('mcmod.info')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      // Act
      const result = await manifestGenerator.extractModMetadata(modPath);

      // Assert
      expect(result).toEqual({
        modId: 'legacymod',
        modName: 'Legacy Mod',
        modVersion: '0.9.0',
        description: 'A legacy forge mod',
        authors: ['Developer1', 'Developer2'],
        website: 'https://legacy-forge.net',
        logoFile: 'logo.png',
      });
    });

    it('should handle missing descriptor files', async () => {
      // Arrange
      const modPath = '/path/to/mod';

      // Mock fs.access to reject all descriptor files
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      // Act
      const result = await manifestGenerator.extractModMetadata(modPath);

      // Assert
      expect(result.modId).toBe('unknown');
      expect(result.modName).toBe('unknown');
      expect(result.modVersion).toBe('1.0.0');
    });
  });

  describe('generateManifests', () => {
    it('should generate valid behavior and resource pack manifests', () => {
      // Arrange
      const metadata = {
        modId: 'testmod',
        modName: 'Test Mod',
        modVersion: '1.2.3',
        description: 'A test mod',
        authors: ['Developer1', 'Developer2'],
        website: 'https://example.com',
      };

      // Act
      const result = manifestGenerator.generateManifests(metadata);

      // Assert
      expect(result.success).toBe(true);
      expect(result.behaviorPackManifest).toBeDefined();
      expect(result.resourcePackManifest).toBeDefined();

      // Check behavior pack manifest
      const behaviorManifest = result.behaviorPackManifest!;
      expect(behaviorManifest.format_version).toBe(2);
      expect(behaviorManifest.header.name).toBe('Test Mod Behavior');
      expect(behaviorManifest.header.description).toBe('A test mod');
      expect(behaviorManifest.header.version).toEqual([1, 2, 3]);
      expect(behaviorManifest.modules.length).toBe(2);
      expect(behaviorManifest.modules[0].type).toBe('data');
      expect(behaviorManifest.modules[1].type).toBe('script');
      expect(behaviorManifest.dependencies!.length).toBe(1);
      expect(behaviorManifest.metadata!.authors).toEqual(['Developer1', 'Developer2']);
      expect(behaviorManifest.metadata!.url).toBe('https://example.com');

      // Check resource pack manifest
      const resourceManifest = result.resourcePackManifest!;
      expect(resourceManifest.format_version).toBe(2);
      expect(resourceManifest.header.name).toBe('Test Mod Resources');
      expect(resourceManifest.header.description).toBe('A test mod');
      expect(resourceManifest.header.version).toEqual([1, 2, 3]);
      expect(resourceManifest.modules.length).toBe(1);
      expect(resourceManifest.modules[0].type).toBe('resources');
      expect(resourceManifest.metadata!.authors).toEqual(['Developer1', 'Developer2']);
      expect(resourceManifest.metadata!.url).toBe('https://example.com');
    });

    it('should handle missing mod ID', () => {
      // Arrange
      const metadata = {
        modId: '',
        modName: 'Test Mod',
        modVersion: '1.0.0',
      };

      // Act
      const result = manifestGenerator.generateManifests(metadata);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing mod ID in metadata');
    });

    it('should parse version strings correctly', () => {
      // Arrange
      const metadata = {
        modId: 'testmod',
        modName: 'Test Mod',
        modVersion: '1.2.3-beta.4',
      };

      // Act
      const result = manifestGenerator.generateManifests(metadata);

      // Assert
      expect(result.success).toBe(true);
      expect(result.behaviorPackManifest!.header.version).toEqual([1, 2, 3]);
    });

    it('should generate consistent UUIDs for the same mod ID', () => {
      // Arrange
      const metadata = {
        modId: 'testmod',
        modName: 'Test Mod',
        modVersion: '1.0.0',
      };

      // Act
      const result1 = manifestGenerator.generateManifests(metadata);
      const result2 = manifestGenerator.generateManifests(metadata);

      // Assert
      expect(result1.behaviorPackManifest!.header.uuid).toBe(
        result2.behaviorPackManifest!.header.uuid
      );
      expect(result1.resourcePackManifest!.header.uuid).toBe(
        result2.resourcePackManifest!.header.uuid
      );
    });
  });

  describe('writeManifests', () => {
    it('should write manifests to the specified directories', async () => {
      // Arrange
      const metadata = {
        modId: 'testmod',
        modName: 'Test Mod',
        modVersion: '1.0.0',
      };
      const manifestResult = manifestGenerator.generateManifests(metadata);
      const behaviorPackDir = '/output/behavior_pack';
      const resourcePackDir = '/output/resource_pack';

      // Act
      const result = await manifestGenerator.writeManifests(
        manifestResult,
        behaviorPackDir,
        resourcePackDir
      );

      // Assert
      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(behaviorPackDir, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(resourcePackDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(behaviorPackDir, 'manifest.json'),
        expect.any(String)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(resourcePackDir, 'manifest.json'),
        expect.any(String)
      );
    });

    it('should handle invalid manifest results', async () => {
      // Arrange
      const invalidResult = {
        success: false,
        errors: ['Invalid manifest'],
      };
      const behaviorPackDir = '/output/behavior_pack';
      const resourcePackDir = '/output/resource_pack';

      // Act
      const result = await manifestGenerator.writeManifests(
        invalidResult,
        behaviorPackDir,
        resourcePackDir
      );

      // Assert
      expect(result).toBe(false);
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file system errors', async () => {
      // Arrange
      const metadata = {
        modId: 'testmod',
        modName: 'Test Mod',
        modVersion: '1.0.0',
      };
      const manifestResult = manifestGenerator.generateManifests(metadata);
      const behaviorPackDir = '/output/behavior_pack';
      const resourcePackDir = '/output/resource_pack';

      // Mock fs.mkdir to throw an error
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Directory creation failed'));

      // Act
      const result = await manifestGenerator.writeManifests(
        manifestResult,
        behaviorPackDir,
        resourcePackDir
      );

      // Assert
      expect(result).toBe(false);
    });
  });
});
