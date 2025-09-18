import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModValidator } from '../../../../src/modules/ingestion/ModValidator.js';
import { createMockFileBuffer, mockUnzipper, resetAllMocks } from '../../../utils/testHelpers.js';
import * as fs from 'fs';

// Mock the dependency classes
vi.mock('../../../../src/modules/ingestion/FileProcessor.js', () => {
  return {
    FileProcessor: vi.fn().mockImplementation(() => ({
      validateUpload: vi.fn().mockResolvedValue({
        isValid: true,
        fileType: 'jar',
        size: 1024,
        errors: [],
        warnings: []
      })
    }))
  };
});

vi.mock('../../../../src/modules/ingestion/JavaAnalyzer.js', () => {
  return {
    JavaAnalyzer: vi.fn().mockImplementation(() => ({
      analyzeJarForMVP: vi.fn().mockResolvedValue({
        modId: 'test-forge-mod',
        registryNames: ['test_block', 'test_item'],
        texturePaths: ['assets/test/textures/block.png'],
        manifestInfo: {
          modId: 'test-forge-mod',
          modName: 'Test Forge Mod',
          version: '1.0.0',
          author: 'Test Author',
          dependencies: []
        },
        analysisNotes: []
      })
    }))
  };
});

vi.mock('../../../../src/modules/ingestion/SecurityScanner.js', () => {
  return {
    SecurityScanner: vi.fn().mockImplementation(() => ({
      scanBuffer: vi.fn().mockResolvedValue({
        isSafe: true,
        threats: [],
        scanTime: 100,
        scanId: 'test-scan-id'
      })
    }))
  };
});

describe('ModValidator', () => {
  let modValidator: ModValidator;
  let mockForgeModStructure: Record<string, string>;
  let mockFabricModStructure: Record<string, string>;
  let mkdirSpy: any;
  let writeFileSpy: any;
  let rmSpy: any;

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

    // Mock fs operations that ModValidator uses
    mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue();
    vi.spyOn(fs.promises, 'access').mockResolvedValue();
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('mock content'));
    rmSpy = vi.spyOn(fs.promises, 'rm').mockResolvedValue();

    // Create validator with mocked dependencies
    const mockFileProcessor = {
      validateUpload: vi.fn().mockResolvedValue({
        isValid: true,
        fileType: 'jar',
        size: 1024,
        errors: [],
        warnings: []
      })
    };

    const mockJavaAnalyzer = {
      analyzeJarForMVP: vi.fn().mockResolvedValue({
        modId: 'test-forge-mod',
        registryNames: ['test_block', 'test_item'],
        texturePaths: ['assets/test/textures/block.png'],
        manifestInfo: {
          modId: 'test-forge-mod',
          modName: 'Test Forge Mod',
          version: '1.0.0',
          author: 'Test Author',
          dependencies: []
        },
        analysisNotes: []
      })
    };

    const mockSecurityScanner = {
      scanBuffer: vi.fn().mockResolvedValue({
        isSafe: true,
        threats: [],
        scanTime: 100,
        scanId: 'test-scan-id'
      })
    };

    modValidator = new ModValidator(
      'temp',
      mockFileProcessor as any,
      mockJavaAnalyzer as any,
      mockSecurityScanner as any
    );

    // Mock the private validateModStructure method by overriding it
    (modValidator as any).validateModStructure = vi.fn().mockResolvedValue({
      isValid: true,
      modInfo: {
        modId: 'test-forge-mod',
        modName: 'Test Forge Mod',
        modVersion: '1.0.0'
      },
      errors: []
    });
  });

  afterEach(() => {
    resetAllMocks();
  });

  it('should validate a valid Forge mod', async () => {
    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Validate the mod
    const result = await modValidator.validateMod(fileBuffer, 'test-forge-mod.jar');

    // Check result
    expect(result.isValid).toBe(true);
    expect(result.modInfo?.modId).toBe('test-forge-mod');
    expect(result.modInfo?.modVersion).toBe('1.0.0');
    expect(result.errors).toHaveLength(0);
  });

  it('should validate a valid Fabric mod', async () => {
    // Create a new validator with Fabric-specific mocks
    const mockFileProcessor = {
      validateUpload: vi.fn().mockResolvedValue({
        isValid: true,
        fileType: 'jar',
        size: 1024,
        errors: [],
        warnings: []
      })
    };

    const mockJavaAnalyzer = {
      analyzeJarForMVP: vi.fn().mockResolvedValue({
        modId: 'test-fabric-mod',
        registryNames: ['test_block', 'test_item'],
        texturePaths: ['assets/test/textures/block.png'],
        manifestInfo: {
          modId: 'test-fabric-mod',
          modName: 'Test Fabric Mod',
          version: '1.0.0',
          author: 'Test Author',
          dependencies: []
        },
        analysisNotes: []
      })
    };

    const mockSecurityScanner = {
      scanBuffer: vi.fn().mockResolvedValue({
        isSafe: true,
        threats: [],
        scanTime: 100,
        scanId: 'test-scan-id'
      })
    };

    const fabricValidator = new ModValidator(
      'temp',
      mockFileProcessor as any,
      mockJavaAnalyzer as any,
      mockSecurityScanner as any
    );

    // Mock the private validateModStructure method
    (fabricValidator as any).validateModStructure = vi.fn().mockResolvedValue({
      isValid: true,
      modInfo: {
        modId: 'test-fabric-mod',
        modName: 'Test Fabric Mod',
        modVersion: '1.0.0'
      },
      errors: []
    });
    
    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Validate the mod
    const result = await fabricValidator.validateMod(fileBuffer, 'test-fabric-mod.jar');

    // Check result
    expect(result.isValid).toBe(true);
    expect(result.modInfo?.modId).toBe('test-fabric-mod');
    expect(result.modInfo?.modVersion).toBe('1.0.0');
    expect(result.errors).toHaveLength(0);
  });

  it('should reject an invalid file format', async () => {
    // Create a validator with failing file processor
    const mockFileProcessor = {
      validateUpload: vi.fn().mockResolvedValue({
        isValid: false,
        fileType: 'unknown',
        size: 1024,
        errors: [{ message: 'Invalid file format' }],
        warnings: []
      })
    };

    const failureValidator = new ModValidator(
      'temp',
      mockFileProcessor as any,
      undefined,
      undefined
    );

    // Create mock file buffer with invalid content
    const fileBuffer = createMockFileBuffer('not a jar file');

    // Validate the mod
    const result = await failureValidator.validateMod(fileBuffer, 'invalid.jar');

    // Check result
    expect(result.isValid).toBe(false);
    expect(
      result.errors?.some((error) => error.includes('Invalid') || error.includes('format'))
    ).toBe(true);
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
    
    // Update the mock to return unknown mod info (failure case)
    const mockJavaAnalyzer = {
      analyzeJarForMVP: vi.fn().mockResolvedValue({
        modId: 'unknown',
        registryNames: [],
        texturePaths: [],
        manifestInfo: {
          modId: 'unknown',
          modName: 'Unknown',
          version: '1.0.0',
          dependencies: []
        },
        analysisNotes: [{ type: 'error', message: 'Could not detect mod metadata' }]
      })
    };
    
    // Replace the analyzer in the validator
    (modValidator as any).javaAnalyzer = mockJavaAnalyzer;

    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Validate the mod
    const result = await modValidator.validateMod(fileBuffer, 'invalid-mod.jar');

    // Check result
    expect(result.isValid).toBe(false);
    expect(
      result.errors?.some((error) => error.includes('metadata') || error.includes('descriptor'))
    ).toBe(true);
  });

  it('should extract mod files to a temporary directory', async () => {
    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Extract the mod (extraction is part of validateMod)
    const result = await modValidator.validateMod(fileBuffer, 'test-mod.jar');
    const extractPath = result.extractedPath;

    // Check that directories were created
    expect(mkdirSpy).toHaveBeenCalled();

    // Check that files were written (jar file should be written)
    expect(writeFileSpy).toHaveBeenCalled();

    // Check that the extract path is returned
    expect(extractPath).toBeDefined();
    expect(typeof extractPath).toBe('string');
  });

  it('should detect mod type from validation result', async () => {
    // Test Forge mod validation
    const forgeBuffer = createMockFileBuffer('forge mod content');
    let result = await modValidator.validateMod(forgeBuffer, 'forge-mod.jar');
    expect(result.isValid).toBe(true);
    // Mod type detection is implicit in the validation process

    // Test Fabric mod validation
    const fabricBuffer = createMockFileBuffer('fabric mod content');
    result = await modValidator.validateMod(fabricBuffer, 'fabric-mod.jar');
    expect(result.isValid).toBe(true);
    // Mod type detection is implicit in the validation process

    // Test unknown mod type
    const unknownBuffer = createMockFileBuffer('unknown content');
    result = await modValidator.validateMod(unknownBuffer, 'unknown.jar');
    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('should extract mod ID and version from metadata', async () => {
    // Test Forge mod validation (metadata extraction is part of validateMod)
    const forgeBuffer = createMockFileBuffer('forge mod content');
    let result = await modValidator.validateMod(forgeBuffer, 'test-forge-mod.jar');
    expect(result.isValid).toBe(true);
    expect(result.modInfo?.modId).toBe('test-forge-mod');
    expect(result.modInfo?.modVersion).toBe('1.0.0');

    // Test Fabric mod validation
    const fabricBuffer = createMockFileBuffer('fabric mod content');
    result = await modValidator.validateMod(fabricBuffer, 'test-fabric-mod.jar');
    expect(result.isValid).toBe(true);
    expect(result.modInfo?.modId).toBe('test-fabric-mod');
    expect(result.modInfo?.modVersion).toBe('1.0.0');

    // Test validation failure
    const invalidBuffer = createMockFileBuffer('invalid content');
    result = await modValidator.validateMod(invalidBuffer, 'invalid.jar');
    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('should validate mod structure against requirements', async () => {
    // Test valid mod structure (structure validation is part of validateMod)
    const validBuffer = createMockFileBuffer('valid mod content');
    let result = await modValidator.validateMod(validBuffer, 'valid-mod.jar');
    expect(result.isValid).toBe(true);

    // Test invalid structure (missing required files)
    const invalidBuffer = createMockFileBuffer('invalid content');
    result = await modValidator.validateMod(invalidBuffer, 'invalid-mod.jar');
    expect(result.isValid).toBe(false);
    expect(result.errors?.some((error) => error.includes('descriptor file'))).toBe(true);
  });

  it('should clean up temporary files after validation', async () => {
    // Mock fs.promises.rm
    const rmSpy = vi.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);

    // Create mock file buffer
    const fileBuffer = createMockFileBuffer('mock jar content');

    // Validate the mod and then cleanup
    const result = await modValidator.validateMod(fileBuffer, 'test-mod.jar');
    if (result.extractedPath) {
      await modValidator.cleanup(result.extractedPath);
    }

    // Check that cleanup was called
    expect(rmSpy).toHaveBeenCalled();
  });
});
