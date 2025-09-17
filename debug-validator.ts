import { AddonValidator } from './src/modules/packaging/AddonValidator.js';
import * as fs from 'fs';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

const addonValidator = new AddonValidator();

// Mock addon paths
const mockAddonPaths = {
  behaviorPackPath: '/test/behavior_pack',
  resourcePackPath: '/test/resource_pack',
};

// Mock existsSync to return true for directories and manifest files
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

async function debug() {
  const result = await addonValidator.validateAddon(mockAddonPaths);
  console.log('Validation result:', JSON.stringify(result, null, 2));
}

debug();
