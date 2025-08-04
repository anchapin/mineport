import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AddonValidator } from '../../../../src/modules/packaging/AddonValidator.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

describe('AddonValidator', () => {
  let addonValidator: AddonValidator;
  let mockAddonPaths: any;

  beforeEach(() => {
    addonValidator = new AddonValidator();

    // Reset mocks
    vi.resetAllMocks();

    // Setup mock addon paths
    mockAddonPaths = {
      behaviorPackPath: '/test/behavior_pack',
      resourcePackPath: '/test/resource_pack',
    };

    // Mock existsSync to return true for directories by default
    (fs.existsSync as any).mockImplementation((path: string) => {
      if (path === '/test/behavior_pack' || path === '/test/resource_pack') {
        return true;
      }
      if (
        path === '/test/behavior_pack/manifest.json' ||
        path === '/test/resource_pack/manifest.json'
      ) {
        return true;
      }
      return false;
    });

    // Mock readFileSync to return valid manifests by default
    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === '/test/behavior_pack/manifest.json') {
        return JSON.stringify({
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
        });
      }
      if (path === '/test/resource_pack/manifest.json') {
        return JSON.stringify({
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
        });
      }
      return '';
    });

    // Mock readdirSync to return empty arrays by default
    (fs.readdirSync as any).mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should validate addon structure', async () => {
    const result = await addonValidator.validateAddon(mockAddonPaths);

    expect(result.valid).toBe(false); // Should fail due to missing required directories
    expect(result.errors.length).toBeGreaterThan(0);

    // Check if it detected missing scripts directory
    const missingScriptsError = result.errors.find(
      (error) => error.type === 'structure' && error.message.includes('scripts')
    );
    expect(missingScriptsError).toBeDefined();

    // Check if it detected missing textures directory
    const missingTexturesError = result.errors.find(
      (error) => error.type === 'structure' && error.message.includes('textures')
    );
    expect(missingTexturesError).toBeDefined();
  });

  it('should validate manifests', async () => {
    // Mock readFileSync to return invalid manifest
    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === '/test/behavior_pack/manifest.json') {
        return JSON.stringify({
          // Missing format_version
          header: {
            name: 'Test Behavior Pack',
            description: 'Test description',
            uuid: '12345678-1234-1234-1234-123456789012',
            // Invalid version format
            version: '1.0.0',
            min_engine_version: [1, 16, 0],
          },
          modules: [
            {
              type: 'data',
              uuid: '12345678-1234-1234-1234-123456789013',
              version: [1, 0, 0],
            },
          ],
        });
      }
      if (path === '/test/resource_pack/manifest.json') {
        return JSON.stringify({
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
        });
      }
      return '';
    });

    const result = await addonValidator.validateAddon(mockAddonPaths);

    expect(result.valid).toBe(false);

    // Check if it detected missing format_version
    const missingFormatVersionError = result.errors.find(
      (error) => error.type === 'manifest' && error.message.includes('format_version')
    );
    expect(missingFormatVersionError).toBeDefined();

    // Check if it detected invalid version format
    const invalidVersionError = result.errors.find(
      (error) => error.type === 'manifest' && error.message.includes('Version should be an array')
    );
    expect(invalidVersionError).toBeDefined();
  });

  it('should validate pack relationships', async () => {
    // Mock readFileSync to return manifests without dependencies
    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === '/test/behavior_pack/manifest.json') {
        return JSON.stringify({
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
          dependencies: [], // Empty dependencies
        });
      }
      if (path === '/test/resource_pack/manifest.json') {
        return JSON.stringify({
          format_version: 2,
          header: {
            name: 'Test Resource Pack',
            description: 'Test description',
            uuid: '12345678-1234-1234-1234-123456789014',
            version: [2, 0, 0], // Different version
            min_engine_version: [1, 16, 0],
          },
          modules: [
            {
              type: 'resources',
              uuid: '12345678-1234-1234-1234-123456789015',
              version: [1, 0, 0],
            },
          ],
        });
      }
      return '';
    });

    const result = await addonValidator.validateAddon(mockAddonPaths);

    expect(result.valid).toBe(false);

    // Check if it detected missing dependency
    const missingDependencyError = result.errors.find(
      (error) =>
        error.type === 'manifest' && error.message.includes('dependency on the resource pack')
    );
    expect(missingDependencyError).toBeDefined();

    // Check if it detected version mismatch
    const versionMismatchError = result.errors.find(
      (error) => error.type === 'manifest' && error.message.includes('does not match')
    );
    expect(versionMismatchError).toBeDefined();
  });

  it('should validate scripts', async () => {
    // Mock existsSync to return true for scripts directory
    (fs.existsSync as any).mockImplementation((path: string) => {
      if (
        path === '/test/behavior_pack' ||
        path === '/test/resource_pack' ||
        path === '/test/behavior_pack/manifest.json' ||
        path === '/test/resource_pack/manifest.json' ||
        path === '/test/behavior_pack/scripts'
      ) {
        return true;
      }
      return false;
    });

    // Mock readdirSync to return script files
    (fs.readdirSync as any).mockImplementation((dir: string) => {
      if (dir === '/test/behavior_pack/scripts') {
        return [{ name: 'main.js', isDirectory: () => false, isFile: () => true }];
      }
      return [];
    });

    // Mock readFileSync to return script content
    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (
        path === '/test/behavior_pack/manifest.json' ||
        path === '/test/resource_pack/manifest.json'
      ) {
        return JSON.stringify({
          format_version: 2,
          header: {
            name: 'Test Pack',
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
        });
      }
      if (path === '/test/behavior_pack/scripts/main.js') {
        return 'import { something } from "somewhere"; // ES6 import not supported in Bedrock';
      }
      return '';
    });

    const result = await addonValidator.validateAddon(mockAddonPaths);

    expect(result.valid).toBe(false);

    // Check if it detected ES6 import
    const es6ImportError = result.errors.find(
      (error) => error.type === 'script' && error.message.includes('ES6 import/export')
    );
    expect(es6ImportError).toBeDefined();
  });

  it('should auto-fix issues', async () => {
    // Mock existsSync to return false for required directories
    (fs.existsSync as any).mockImplementation((path: string) => {
      if (
        path === '/test/behavior_pack' ||
        path === '/test/resource_pack' ||
        path === '/test/behavior_pack/manifest.json' ||
        path === '/test/resource_pack/manifest.json'
      ) {
        return true;
      }
      return false;
    });

    const validationResult = await addonValidator.validateAddon(mockAddonPaths);
    expect(validationResult.valid).toBe(false);

    // Filter only auto-fixable errors
    const fixableErrors = validationResult.errors.filter((error) => error.autoFixable);
    expect(fixableErrors.length).toBeGreaterThan(0);

    const fixResult = await addonValidator.autoFixIssues(mockAddonPaths, fixableErrors);

    expect(fixResult.fixed).toBe(true);
    expect(fixResult.fixedErrors.length).toBeGreaterThan(0);

    // Check if directories were created
    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  it('should fix manifest issues', async () => {
    // Mock readFileSync to return manifests with issues
    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === '/test/behavior_pack/manifest.json') {
        return JSON.stringify({
          format_version: '2', // String instead of number
          header: {
            name: 'Test Behavior Pack',
            description: 'Test description',
            uuid: '12345678-1234-1234-1234-123456789012',
            version: [1, 0], // Missing third element
            min_engine_version: [1, 16, 0],
          },
          modules: [
            {
              type: 'data',
              uuid: '12345678-1234-1234-1234-123456789013',
              version: [1, 0, 0],
            },
          ],
          dependencies: [], // Empty dependencies
        });
      }
      if (path === '/test/resource_pack/manifest.json') {
        return JSON.stringify({
          format_version: 2,
          header: {
            name: 'Test Resource Pack',
            description: 'Test description',
            uuid: '12345678-1234-1234-1234-123456789014',
            version: [2, 0, 0], // Different version
            min_engine_version: [1, 16, 0],
          },
          modules: [
            {
              type: 'resources',
              uuid: '12345678-1234-1234-1234-123456789015',
              version: [1, 0, 0],
            },
          ],
        });
      }
      return '';
    });

    const validationResult = await addonValidator.validateAddon(mockAddonPaths);
    const fixableErrors = validationResult.errors.filter((error) => error.autoFixable);

    await addonValidator.autoFixIssues(mockAddonPaths, fixableErrors);

    // Check if writeFileSync was called to fix the issues
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
