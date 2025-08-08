import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModValidator } from '../../../../src/modules/ingestion/ModValidator.js';
import { createMockFileBuffer, mockUnzipper, resetAllMocks } from '../../../utils/testHelpers.js';
import fs from 'fs';

describe('ModValidator', () => {
  let modValidator: ModValidator;
  let mockForgeModStructure: Record<string, string>;
  let mockFabricModStructure: Record<string, string>;

  beforeEach(() => {
    // Create mock file structures
    mockForgeModStructure = {
      'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0\nModId: test-forge-mod\nVersion: 1.0.0',
      'META-INF/mods.toml': 'modId="test-forge-mod"\nversion="1.0.0"\ndisplayName="Test Forge Mod"',
      LICENSE: 'MIT License\n\nCopyright (c) 2023 Test Author\n',
      'com/example/testmod/TestMod.class': 'mock class file content',
    };

    mockFabricModStructure = {
      'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0\nModId: test-fabric-mod\nVersion: 1.0.0',
      'fabric.mod.json': '{"id": "test-fabric-mod", "version": "1.0.0", "name": "Test Fabric Mod"}',
      LICENSE: 'MIT License\n\nCopyright (c) 2023 Test Author\n',
      'com/example/testmod/TestMod.class': 'mock class file content',
    };

    // Mock unzipper
    mockUnzipper(mockForgeModStructure);

    // Create validator
    modValidator = new ModValidator();
  });

  afterEach(() => {
    resetAllMocks();
  });

  it('should validate a valid Forge mod', async () => {
    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Validate the mod
    const result = await modValidator.validate(fileBuffer);

    // Check result
    expect(result.valid).toBe(true);
    expect(result.modId).toBe('test-forge-mod');
    expect(result.version).toBe('1.0.0');
    expect(result.modLoader).toBe('forge');
    expect(result.errors).toHaveLength(0);
  });

  it('should validate a valid Fabric mod', async () => {
    // Mock unzipper with Fabric structure
    resetAllMocks();
    mockUnzipper(mockFabricModStructure);

    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Validate the mod
    const result = await modValidator.validate(fileBuffer);

    // Check result
    expect(result.valid).toBe(true);
    expect(result.modId).toBe('test-fabric-mod');
    expect(result.version).toBe('1.0.0');
    expect(result.modLoader).toBe('fabric');
    expect(result.errors).toHaveLength(0);
  });

  it('should reject an invalid file format', async () => {
    // Create mock file buffer with invalid content
    const fileBuffer = createMockFileBuffer('not a jar file');

    // Mock unzipper to throw an error
    vi.mock('unzipper', () => {
      return {
        Open: {
          buffer: vi.fn(async () => {
            throw new Error('Invalid archive');
          }),
        },
      };
    });

    // Validate the mod
    const result = await modValidator.validate(fileBuffer);

    // Check result
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid JAR file format');
  });

  it('should reject a mod without required metadata', async () => {
    // Create mock file structure without metadata
    const invalidModStructure = {
      'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0',
      'com/example/testmod/TestMod.class': 'mock class file content',
    };

    // Mock unzipper with invalid structure
    resetAllMocks();
    mockUnzipper(invalidModStructure);

    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Validate the mod
    const result = await modValidator.validate(fileBuffer);

    // Check result
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing mod metadata');
  });

  it('should extract mod files to a temporary directory', async () => {
    // Mock fs.promises.mkdir
    const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

    // Mock fs.promises.writeFile
    const writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Extract the mod
    const extractPath = await modValidator.extractMod(fileBuffer, 'test-mod');

    // Check that directories were created
    expect(mkdirSpy).toHaveBeenCalled();

    // Check that files were written
    expect(writeFileSpy).toHaveBeenCalledTimes(Object.keys(mockForgeModStructure).length);

    // Check that the extract path is returned
    expect(extractPath).toContain('test-mod');
  });

  it('should detect mod type from file structure', async () => {
    // Test Forge detection
    let modType = await modValidator.detectModType(mockForgeModStructure);
    expect(modType).toBe('forge');

    // Test Fabric detection
    modType = await modValidator.detectModType(mockFabricModStructure);
    expect(modType).toBe('fabric');

    // Test unknown mod type
    const unknownModStructure = {
      'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0',
      'unknown-file.txt': 'content',
    };
    modType = await modValidator.detectModType(unknownModStructure);
    expect(modType).toBe('unknown');
  });

  it('should extract mod ID and version from metadata', async () => {
    // Test Forge metadata extraction
    let metadata = await modValidator.extractModMetadata(mockForgeModStructure, 'forge');
    expect(metadata.modId).toBe('test-forge-mod');
    expect(metadata.version).toBe('1.0.0');

    // Test Fabric metadata extraction
    metadata = await modValidator.extractModMetadata(mockFabricModStructure, 'fabric');
    expect(metadata.modId).toBe('test-fabric-mod');
    expect(metadata.version).toBe('1.0.0');

    // Test metadata extraction failure
    const invalidModStructure = {
      'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0',
    };
    await expect(modValidator.extractModMetadata(invalidModStructure, 'forge')).rejects.toThrow();
  });

  it('should validate mod structure against requirements', async () => {
    // Test valid structure
    let result = await modValidator.validateStructure(mockForgeModStructure, 'forge');
    expect(result.valid).toBe(true);

    // Test invalid structure (missing required files)
    const invalidModStructure = {
      'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0',
    };
    result = await modValidator.validateStructure(invalidModStructure, 'forge');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required file: META-INF/mods.toml');
  });

  it('should clean up temporary files after validation', async () => {
    // Mock fs.promises.rm
    const rmSpy = vi.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);

    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Validate the mod with cleanup
    await modValidator.validate(fileBuffer, { cleanup: true });

    // Check that cleanup was called
    expect(rmSpy).toHaveBeenCalled();
  });
});
