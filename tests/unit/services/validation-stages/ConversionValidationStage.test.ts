/**
 * ConversionValidationStage Unit Tests
 *
 * Tests for the conversion validation stage implementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversionValidationStage } from '../../../../src/services/validation-stages/ConversionValidationStage.js';
import { ValidationInput } from '../../../../src/services/ValidationPipeline.js';
import { ErrorSeverity } from '../../../../src/types/errors.js';

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ConversionValidationStage', () => {
  let stage: ConversionValidationStage;

  beforeEach(() => {
    stage = new ConversionValidationStage();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('stage properties', () => {
    it('should have correct stage properties', () => {
      expect(stage.name).toBe('conversion');
      expect(stage.required).toBe(false);
      expect(stage.timeout).toBe(20000);
    });
  });

  describe('missing conversion results', () => {
    it('should skip validation when no conversion results provided', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        fileContent: Buffer.from('content'),
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('No conversion results provided');
      expect(result.metadata?.skipped).toBe(true);
    });
  });

  describe('addon structure validation', () => {
    it('should fail when addon structure is missing', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          manifests: {},
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some((e) => e.message.includes('Addon structure is missing'))).toBe(
        true
      );
    });

    it('should fail when behavior pack structure is missing', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            resourcePack: { directories: ['textures'] },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(
        result.errors.some((e) => e.message.includes('Behavior pack structure is missing'))
      ).toBe(true);
    });

    it('should fail when resource pack structure is missing', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(
        result.errors.some((e) => e.message.includes('Resource pack structure is missing'))
      ).toBe(true);
    });

    it('should warn about missing expected directories', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] }, // Missing entities, items, blocks
            resourcePack: { directories: ['textures'] }, // Missing models, sounds
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test Mod BP',
                description: 'Test behavior pack',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [
                { type: 'data', uuid: '87654321-4321-4321-4321-cba987654321', version: [1, 0, 0] },
              ],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test Mod RP',
                description: 'Test resource pack',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [
                {
                  type: 'resources',
                  uuid: '66666666-7777-8888-9999-aaaaaaaaaaaa',
                  version: [1, 0, 0],
                },
              ],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(
        result.warnings.some((w) =>
          w.message.includes('Behavior pack missing expected directories')
        )
      ).toBe(true);
      expect(
        result.warnings.some((w) =>
          w.message.includes('Resource pack missing expected directories')
        )
      ).toBe(true);
    });

    it('should pass with complete addon structure', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts', 'entities', 'items', 'blocks'] },
            resourcePack: { directories: ['textures', 'models', 'sounds'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test Mod BP',
                description: 'Test behavior pack',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [
                { type: 'data', uuid: '87654321-4321-4321-4321-cba987654321', version: [1, 0, 0] },
              ],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test Mod RP',
                description: 'Test resource pack',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [
                {
                  type: 'resources',
                  uuid: '66666666-7777-8888-9999-aaaaaaaaaaaa',
                  version: [1, 0, 0],
                },
              ],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('manifest files validation', () => {
    it('should fail when manifests are missing', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Manifest files are missing');
    });

    it('should fail when behavior pack manifest is missing', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Behavior pack manifest is missing');
    });

    it('should fail when resource pack manifest is missing', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Resource pack manifest is missing');
    });

    it('should fail when manifest is missing required fields', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              // Missing format_version, header, modules
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3); // Missing format_version, header, modules
    });

    it('should fail when manifest header is missing required fields', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                // Missing description, uuid, version
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3); // Missing description, uuid, version
    });

    it('should fail when UUID format is invalid', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: 'invalid-uuid-format',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('invalid UUID format');
    });

    it('should warn about invalid version format', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0], // Should be [major, minor, patch]
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(
        result.warnings.some((w) =>
          w.message.includes('version should be [major, minor, patch] format')
        )
      ).toBe(true);
    });
  });

  describe('asset conversion validation', () => {
    it('should warn when no converted assets found', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.message.includes('No converted assets found'))).toBe(
        true
      );
    });

    it('should fail when texture is missing path information', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          convertedAssets: {
            textures: [
              { originalPath: 'stone.png', convertedPath: 'textures/blocks/stone.png' },
              { originalPath: 'iron.png' }, // Missing convertedPath
            ],
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Texture 1 missing required path information');
    });

    it('should warn when texture is not converted to PNG', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          convertedAssets: {
            textures: [{ originalPath: 'stone.jpg', convertedPath: 'textures/blocks/stone.jpg' }],
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some((w) => w.message.includes('not converted to PNG format'))).toBe(
        true
      );
    });

    it('should warn when model is not converted to Bedrock format', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['models'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          convertedAssets: {
            models: [{ originalPath: 'block.json', convertedPath: 'models/block.json' }],
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(
        result.warnings.some((w) => w.message.includes('not converted to Bedrock geometry format'))
      ).toBe(true);
    });

    it('should warn when sound is not converted to supported format', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['sounds'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          convertedAssets: {
            sounds: [{ originalPath: 'sound.mp3', convertedPath: 'sounds/sound.mp3' }],
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(
        result.warnings.some((w) => w.message.includes('not converted to supported format'))
      ).toBe(true);
    });
  });

  describe('behavior pack content validation', () => {
    it('should warn when no behavior pack content found', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(
        result.warnings.some((w) => w.message.includes('No behavior pack content found'))
      ).toBe(true);
    });

    it('should fail when script is missing path or content', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          behaviorPack: {
            scripts: [
              { path: 'main.js', content: 'console.log("Hello");' },
              { path: 'broken.js' }, // Missing content
            ],
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Script 1 missing required path or content');
    });

    it('should warn about potential script syntax errors', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          behaviorPack: {
            scripts: [
              {
                path: 'broken.js',
                content: 'function test() { console.log("missing closing brace");',
              },
            ],
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some((w) => w.message.includes('may have syntax errors'))).toBe(true);
    });

    it('should fail when block definition is missing required fields', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['blocks'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          behaviorPack: {
            blocks: [
              { identifier: 'test:stone', definition: { components: {} } },
              { identifier: 'test:iron' }, // Missing definition
            ],
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain(
        'Block 1 missing required identifier or definition'
      );
    });
  });

  describe('conversion completeness validation', () => {
    it('should warn about low asset conversion count', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          convertedAssets: {
            textures: [],
            models: [],
            sounds: [],
          },
        },
      };

      const config = { minAssets: 5 };

      const result = await stage.validate(input, config);

      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.message.includes('Low asset conversion count'))).toBe(
        true
      );
    });

    it('should warn about low script conversion count', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          behaviorPack: {
            scripts: [],
          },
        },
      };

      const config = { minScripts: 2 };

      const result = await stage.validate(input, config);

      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.message.includes('Low script conversion count'))).toBe(
        true
      );
    });
  });

  describe('output file integrity validation', () => {
    it('should warn when no output files list found', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.message.includes('No output files list found'))).toBe(
        true
      );
    });

    it('should fail when output file is missing path', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          outputFiles: [
            { path: 'manifest.json', content: '{}' },
            { content: 'file without path' }, // Missing path
          ],
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Output file 1 missing path');
    });

    it('should warn about empty output files', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          outputFiles: [{ path: 'empty.json', size: 0 }],
        },
      };

      const result = await stage.validate(input);

      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some((w) => w.message.includes('is empty'))).toBe(true);
    });

    it('should warn about unusually large output files', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          outputFiles: [
            { path: 'huge.json', size: 200 * 1024 * 1024 }, // 200MB
          ],
        },
      };

      const result = await stage.validate(input);

      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some((w) => w.message.includes('unusually large'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle validation execution errors', async () => {
      // Mock an internal validation method to throw an error
      const originalValidateAddonStructure = (stage as any).validateAddonStructure;
      (stage as any).validateAddonStructure = vi.fn().mockImplementation(() => {
        throw new Error('Conversion validation error');
      });

      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(
        result.errors.some((e) => e.message.includes('Conversion validation execution failed'))
      ).toBe(true);
      expect(result.errors.some((e) => e.severity === ErrorSeverity.ERROR)).toBe(true);

      // Restore the original method
      (stage as any).validateAddonStructure = originalValidateAddonStructure;
    });
  });

  describe('metadata reporting', () => {
    it('should include checks performed in metadata', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
          convertedAssets: { textures: [] },
          behaviorPack: { scripts: [] },
          resourcePack: { textureDefinitions: [] },
          outputFiles: [],
        },
      };

      const result = await stage.validate(input);

      expect(result.metadata?.checksPerformed).toEqual([
        'addon_structure',
        'manifest_files',
        'asset_conversion',
        'behavior_pack_content',
        'resource_pack_content',
        'conversion_completeness',
        'output_file_integrity',
      ]);
    });

    it('should report execution time', async () => {
      const input: ValidationInput = {
        filePath: 'test.jar',
        conversionResults: {
          addonStructure: {
            behaviorPack: { directories: ['scripts'] },
            resourcePack: { directories: ['textures'] },
          },
          manifests: {
            behaviorPack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '12345678-1234-1234-1234-123456789abc',
                version: [1, 0, 0],
              },
              modules: [],
            },
            resourcePack: {
              format_version: '1.16.0',
              header: {
                name: 'Test',
                description: 'Test',
                uuid: '11111111-2222-3333-4444-555555555555',
                version: [1, 0, 0],
              },
              modules: [],
            },
          },
        },
      };

      const result = await stage.validate(input);

      expect(result.executionTime).toBeGreaterThan(0);
      expect(typeof result.executionTime).toBe('number');
    });
  });
});
