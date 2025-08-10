import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LicenseParser, LicenseType } from '../../../../src/modules/ingestion/LicenseParser.js';
import { resetAllMocks } from '../../../utils/testHelpers.js';
import fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises');

describe('LicenseParser', () => {
  let licenseParser: LicenseParser;
  let mockLicenseFiles: Record<string, string>;

  beforeEach(() => {
    // Create mock license files
    mockLicenseFiles = {
      '/tmp/mod/LICENSE':
        'MIT License\n\nCopyright (c) 2023 Test Author\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software...',
      '/tmp/mod/LICENSE.txt':
        'MIT License\n\nCopyright (c) 2023 Test Author\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software...',
      '/tmp/mod/COPYING':
        'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n\nCopyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>',
      '/tmp/mod/COPYING.LESSER':
        'GNU LESSER GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n\nCopyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>',
      '/tmp/mod/package.json':
        '{\n  "name": "test-mod",\n  "version": "1.0.0",\n  "license": "Apache-2.0"\n}',
      '/tmp/mod/build.gradle':
        'plugins {\n  id "java"\n}\n\ngroup = "com.example"\nversion = "1.0.0"\n\nlicense {\n  header = file("LICENSE_HEADER")\n  include "**/*.java"\n}',
    };

    // Create parser
    licenseParser = new LicenseParser();

    // Reset all mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    resetAllMocks();
  });

  it('should detect MIT license from LICENSE file', async () => {
    // Mock fs.access to find LICENSE file
    vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock fs.readFile to return MIT license content
    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return mockLicenseFiles['/tmp/mod/LICENSE'];
      }
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Check result
    expect(result.type).toBe(LicenseType.MIT);
    expect(result.author).toBe('Test Author');
    expect(result.year).toBe('2023');
    expect(result.compatible).toBe(true);
  });

  it('should detect GPL license from COPYING file', async () => {
    // Mock fs.access to find COPYING file
    vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/COPYING') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock fs.readFile to return GPL license content
    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/COPYING') {
        return mockLicenseFiles['/tmp/mod/COPYING'];
      }
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Check result
    expect(result.type).toBe(LicenseType.GPL_3);
    expect(result.compatible).toBe(false); // GPL is not compatible with closed-source
    expect(result.restrictions).toContain('source-available');
  });

  it('should detect LGPL license from COPYING.LESSER file', async () => {
    // Mock fs.access to find COPYING.LESSER file
    vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/COPYING.LESSER') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock fs.readFile to return LGPL license content
    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/COPYING.LESSER') {
        return mockLicenseFiles['/tmp/mod/COPYING.LESSER'];
      }
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Check result
    expect(result.type).toBe(LicenseType.LGPL_3);
    expect(result.compatible).toBe(true); // LGPL is compatible with dynamic linking
    expect(result.restrictions).toContain('library-copyleft');
  });

  it('should detect Apache license from package.json', async () => {
    // Mock fs.access to not find license files but find package.json
    vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/package.json') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock fs.readFile to return package.json content
    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/package.json') {
        return mockLicenseFiles['/tmp/mod/package.json'];
      }
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Check result
    expect(result.type).toBe(LicenseType.APACHE_2);
    expect(result.compatible).toBe(true);
    expect(result.restrictions).toContain('patent-grant');
  });

  it('should handle unknown licenses', async () => {
    // Mock fs.access to find LICENSE file
    vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock fs.readFile to return unknown license content
    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return 'Custom License\n\nThis is a custom license that is not recognized.';
      }
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Check result
    expect(result.type).toBe(LicenseType.UNKNOWN);
    expect(result.compatible).toBe(false); // Unknown licenses are treated as incompatible
    expect(result.text).toContain('Custom License');
  });

  it('should handle missing license files', async () => {
    // Mock fs.access to not find any license files
    vi.mocked(fs.access).mockImplementation(async (_filePath: string) => {
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Check result
    expect(result.type).toBe(LicenseType.NONE);
    expect(result.compatible).toBe(false);
    expect(result.error).toContain('No license file found');
  });

  it('should extract license terms correctly', async () => {
    // Mock fs.access to find LICENSE file
    vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock fs.readFile to return MIT license content
    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return mockLicenseFiles['/tmp/mod/LICENSE'];
      }
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Check extracted terms
    expect(result.terms).toBeDefined();
    expect(result.terms?.attribution).toBe(true);
    expect(result.terms?.modification).toBe(true);
    expect(result.terms?.distribution).toBe(true);
    expect(result.terms?.privateUse).toBe(true);
    expect(result.terms?.patentGrant).toBe(false);
  });

  it('should generate attribution text', async () => {
    // Mock fs.access to find LICENSE file
    vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock fs.readFile to return MIT license content
    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return mockLicenseFiles['/tmp/mod/LICENSE'];
      }
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Generate attribution
    const attribution = licenseParser.generateAttribution(result, 'Test Mod');

    // Check attribution
    expect(attribution).toContain('Test Mod');
    expect(attribution).toContain('Test Author');
    expect(attribution).toContain('2023');
    expect(attribution).toContain('MIT');
  });

  it('should validate license compatibility', async () => {
    // Test compatible licenses
    expect(licenseParser.isCompatible(LicenseType.MIT)).toBe(true);
    expect(licenseParser.isCompatible(LicenseType.APACHE_2)).toBe(true);
    expect(licenseParser.isCompatible(LicenseType.BSD_3_CLAUSE)).toBe(true);

    // Test incompatible licenses
    expect(licenseParser.isCompatible(LicenseType.GPL_3)).toBe(false);
    expect(licenseParser.isCompatible(LicenseType.AGPL_3)).toBe(false);

    // Test conditional licenses
    expect(licenseParser.isCompatible(LicenseType.LGPL_3)).toBe(true); // Compatible with dynamic linking

    // Test unknown license
    expect(licenseParser.isCompatible(LicenseType.UNKNOWN)).toBe(false);
    expect(licenseParser.isCompatible(LicenseType.NONE)).toBe(false);
  });

  it('should handle multiple license files', async () => {
    // Mock fs.access to find LICENSE file first (it will be used)
    vi.mocked(fs.access).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock fs.readFile to return MIT license content (first file found)
    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/mod/LICENSE') {
        return mockLicenseFiles['/tmp/mod/LICENSE'];
      }
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Should use the first license found (MIT in this case)
    expect(result.type).toBe(LicenseType.MIT);
    expect(result.compatible).toBe(true);
  });

  it('should extract license from source code headers', async () => {
    // Mock fs.access to not find any license files (will return NONE)
    vi.mocked(fs.access).mockImplementation(async (_filePath: string) => {
      return Promise.reject(new Error('File not found'));
    });

    // Parse license
    const result = await licenseParser.parse('/tmp/mod');

    // Check result - should return NONE since no license files found
    expect(result.type).toBe(LicenseType.NONE);
    expect(result.compatible).toBe(false);
    expect(result.error).toContain('No license file found');
  });
});
