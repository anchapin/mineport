import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ModLoaderDetector,
  ModLoaderType,
} from '../../../../src/modules/ingestion/ModLoaderDetector.js';
import { createMockFileSystem, resetAllMocks } from '../../../utils/testHelpers.js';
import fs from 'fs';

describe('ModLoaderDetector', () => {
  let modLoaderDetector: ModLoaderDetector;
  let mockForgeModFiles: Record<string, string>;
  let mockFabricModFiles: Record<string, string>;

  beforeEach(() => {
    // Create mock file structures
    mockForgeModFiles = {
      '/tmp/mod/META-INF/MANIFEST.MF':
        'Manifest-Version: 1.0\nModId: test-forge-mod\nVersion: 1.0.0',
      '/tmp/mod/META-INF/mods.toml':
        'modId="test-forge-mod"\nversion="1.0.0"\ndisplayName="Test Forge Mod"',
      '/tmp/mod/src/main/java/com/example/testmod/TestMod.java':
        'package com.example.testmod;\n\nimport net.minecraftforge.fml.common.Mod;\n\n@Mod("test-forge-mod")\npublic class TestMod {}',
      '/tmp/mod/build.gradle': 'plugins {\n  id "net.minecraftforge.gradle" version "5.1.+"\n}',
    };

    mockFabricModFiles = {
      '/tmp/mod/META-INF/MANIFEST.MF':
        'Manifest-Version: 1.0\nModId: test-fabric-mod\nVersion: 1.0.0',
      '/tmp/mod/fabric.mod.json':
        '{"id": "test-fabric-mod", "version": "1.0.0", "name": "Test Fabric Mod"}',
      '/tmp/mod/src/main/java/com/example/testmod/TestMod.java':
        'package com.example.testmod;\n\nimport net.fabricmc.api.ModInitializer;\n\npublic class TestMod implements ModInitializer {\n  @Override\n  public void onInitialize() {}\n}',
      '/tmp/mod/build.gradle': 'plugins {\n  id "fabric-loom" version "0.12.+"\n}',
    };

    // Create detector
    modLoaderDetector = new ModLoaderDetector();
  });

  afterEach(() => {
    resetAllMocks();
  });

  it('should detect Forge mod from file structure', async () => {
    // Mock file system with Forge files
    createMockFileSystem(mockForgeModFiles);

    // Detect mod loader
    const result = await modLoaderDetector.detect('/tmp/mod');

    // Check result
    expect(result.modLoader).toBe(ModLoaderType.FORGE);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.evidence).toContain('Found META-INF/mods.toml');
  });

  it('should detect Fabric mod from file structure', async () => {
    // Mock file system with Fabric files
    createMockFileSystem(mockFabricModFiles);

    // Detect mod loader
    const result = await modLoaderDetector.detect('/tmp/mod');

    // Check result
    expect(result.modLoader).toBe(ModLoaderType.FABRIC);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.evidence).toContain('Found fabric.mod.json');
  });

  it('should detect mod loader from source code imports', async () => {
    // Create mock file with only source code (no metadata files)
    const mockSourceOnlyFiles = {
      '/tmp/mod/src/main/java/com/example/testmod/TestMod.java':
        'package com.example.testmod;\n\nimport net.minecraftforge.fml.common.Mod;\n\n@Mod("test-mod")\npublic class TestMod {}',
    };

    // Mock file system
    createMockFileSystem(mockSourceOnlyFiles);

    // Detect mod loader
    const result = await modLoaderDetector.detect('/tmp/mod');

    // Check result
    expect(result.modLoader).toBe(ModLoaderType.FORGE);
    expect(result.confidence).toBeLessThan(0.8); // Lower confidence with just imports
    expect(result.evidence).toContain('Found Forge imports');
  });

  it('should detect mod loader from build files', async () => {
    // Create mock file with only build file (no metadata or source)
    const mockBuildOnlyFiles = {
      '/tmp/mod/build.gradle': 'plugins {\n  id "net.minecraftforge.gradle" version "5.1.+"\n}',
    };

    // Mock file system
    createMockFileSystem(mockBuildOnlyFiles);

    // Detect mod loader
    const result = await modLoaderDetector.detect('/tmp/mod');

    // Check result
    expect(result.modLoader).toBe(ModLoaderType.FORGE);
    expect(result.confidence).toBeLessThan(0.8); // Lower confidence with just build file
    expect(result.evidence).toContain('Found Forge build configuration');
  });

  it('should handle unknown mod loaders', async () => {
    // Create mock file with no identifiable mod loader
    const mockUnknownFiles = {
      '/tmp/mod/src/main/java/com/example/testmod/TestMod.java':
        'package com.example.testmod;\n\npublic class TestMod {}',
      '/tmp/mod/build.gradle': 'plugins {\n  id "java"\n}',
    };

    // Mock file system
    createMockFileSystem(mockUnknownFiles);

    // Detect mod loader
    const result = await modLoaderDetector.detect('/tmp/mod');

    // Check result
    expect(result.modLoader).toBe(ModLoaderType.UNKNOWN);
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.evidence).toContain('No definitive mod loader evidence found');
  });

  it('should detect mixed mod loader signals', async () => {
    // Create mock file with both Forge and Fabric signals
    const mockMixedFiles = {
      '/tmp/mod/META-INF/mods.toml': 'modId="test-mod"\nversion="1.0.0"\ndisplayName="Test Mod"', // Forge
      '/tmp/mod/src/main/java/com/example/testmod/TestMod.java':
        'package com.example.testmod;\n\nimport net.fabricmc.api.ModInitializer;\n\npublic class TestMod implements ModInitializer {}', // Fabric
    };

    // Mock file system
    createMockFileSystem(mockMixedFiles);

    // Detect mod loader
    const result = await modLoaderDetector.detect('/tmp/mod');

    // Check result - should prefer file structure over imports
    expect(result.modLoader).toBe(ModLoaderType.FORGE);
    expect(result.confidence).toBeLessThan(0.8); // Lower confidence due to mixed signals
    expect(result.evidence).toContain('Found META-INF/mods.toml');
    expect(result.evidence).toContain('Found conflicting evidence');
  });

  it('should handle errors during detection', async () => {
    // Mock fs.promises.readdir to throw an error
    vi.spyOn(fs.promises, 'readdir').mockRejectedValue(new Error('Access denied'));

    // Detect mod loader
    const result = await modLoaderDetector.detect('/tmp/mod');

    // Check result
    expect(result.modLoader).toBe(ModLoaderType.UNKNOWN);
    expect(result.confidence).toBe(0);
    expect(result.error).toBeDefined();
  });

  it('should detect Forge version from build files', async () => {
    // Create mock file with Forge version info
    const mockForgeVersionFiles = {
      '/tmp/mod/build.gradle':
        'minecraft {\n  mappings channel: "official", version: "1.19.2"\n  runs {\n    client {\n      workingDirectory project.file("run")\n      property "forge.logging.markers", "REGISTRIES"\n    }\n  }\n}\ndependencies {\n  minecraft "net.minecraftforge:forge:1.19.2-43.1.7"\n}',
    };

    // Mock file system
    createMockFileSystem(mockForgeVersionFiles);

    // Detect mod loader
    const result = await modLoaderDetector.detect('/tmp/mod');

    // Check result
    expect(result.modLoader).toBe(ModLoaderType.FORGE);
    expect(result.minecraftVersion).toBe('1.19.2');
    expect(result.loaderVersion).toBe('43.1.7');
  });

  it('should detect Fabric version from build files', async () => {
    // Create mock file with Fabric version info
    const mockFabricVersionFiles = {
      '/tmp/mod/gradle.properties': 'minecraft_version=1.19.2\nfabric_version=0.14.9',
    };

    // Mock file system
    createMockFileSystem(mockFabricVersionFiles);

    // Detect mod loader
    const result = await modLoaderDetector.detect('/tmp/mod');

    // Check result
    expect(result.modLoader).toBe(ModLoaderType.FABRIC);
    expect(result.minecraftVersion).toBe('1.19.2');
    expect(result.loaderVersion).toBe('0.14.9');
  });
});
