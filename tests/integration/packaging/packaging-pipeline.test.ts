import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDirectory, cleanupTempDirectory, verifyAddonStructure } from '../helpers.js';
import { AddonPackager } from '../../../src/modules/packaging/AddonPackager.js';
import { AddonValidator } from '../../../src/modules/packaging/AddonValidator.js';
import { ConversionReportGenerator } from '../../../src/modules/packaging/ConversionReportGenerator.js';
import { ManualPostProcessingGuide } from '../../../src/modules/packaging/ManualPostProcessingGuide.js';
import { LicenseEmbedder } from '../../../src/modules/configuration/LicenseEmbedder.js';
import fs from 'fs';
import path from 'path';

describe('Packaging Pipeline Integration', () => {
  let tempDir: string;
  let outputDir: string;
  let behaviorPackDir: string;
  let resourcePackDir: string;

  beforeAll(async () => {
    // Create temporary directory
    tempDir = createTempDirectory();

    // Create output directory structure
    outputDir = path.join(tempDir, 'output');
    behaviorPackDir = path.join(outputDir, 'behavior_pack');
    resourcePackDir = path.join(outputDir, 'resource_pack');

    fs.mkdirSync(behaviorPackDir, { recursive: true });
    fs.mkdirSync(resourcePackDir, { recursive: true });

    // Create mock addon files

    // Behavior pack manifest
    const behaviorManifest = {
      format_version: 2,
      header: {
        name: 'Mock Forge Mod',
        description: 'A mock Forge mod for testing',
        uuid: '00000000-0000-0000-0000-000000000001',
        version: [1, 0, 0],
        min_engine_version: [1, 19, 0],
      },
      modules: [
        {
          type: 'data',
          uuid: '00000000-0000-0000-0000-000000000002',
          version: [1, 0, 0],
        },
        {
          type: 'script',
          uuid: '00000000-0000-0000-0000-000000000003',
          version: [1, 0, 0],
          entry: 'scripts/main.js',
        },
      ],
      dependencies: [
        {
          uuid: '00000000-0000-0000-0000-000000000004',
          version: [1, 0, 0],
        },
      ],
    };

    fs.writeFileSync(
      path.join(behaviorPackDir, 'manifest.json'),
      JSON.stringify(behaviorManifest, null, 2)
    );

    // Resource pack manifest
    const resourceManifest = {
      format_version: 2,
      header: {
        name: 'Mock Forge Mod Resources',
        description: 'Resources for Mock Forge Mod',
        uuid: '00000000-0000-0000-0000-000000000004',
        version: [1, 0, 0],
        min_engine_version: [1, 19, 0],
      },
      modules: [
        {
          type: 'resources',
          uuid: '00000000-0000-0000-0000-000000000005',
          version: [1, 0, 0],
        },
      ],
    };

    fs.writeFileSync(
      path.join(resourcePackDir, 'manifest.json'),
      JSON.stringify(resourceManifest, null, 2)
    );

    // Create scripts directory and main.js
    fs.mkdirSync(path.join(behaviorPackDir, 'scripts'), { recursive: true });
    fs.writeFileSync(
      path.join(behaviorPackDir, 'scripts/main.js'),
      'console.log("Hello from Mock Forge Mod!");'
    );

    // Create block definition
    fs.mkdirSync(path.join(behaviorPackDir, 'blocks'), { recursive: true });
    fs.writeFileSync(
      path.join(behaviorPackDir, 'blocks/custom_block.json'),
      JSON.stringify(
        {
          format_version: '1.19.0',
          'minecraft:block': {
            description: {
              identifier: 'mock-forge-mod:custom_block',
            },
            components: {
              'minecraft:material': { stone: true },
              'minecraft:destroy_time': 1.5,
            },
          },
        },
        null,
        2
      )
    );

    // Create item definition
    fs.mkdirSync(path.join(behaviorPackDir, 'items'), { recursive: true });
    fs.writeFileSync(
      path.join(behaviorPackDir, 'items/custom_item.json'),
      JSON.stringify(
        {
          format_version: '1.19.0',
          'minecraft:item': {
            description: {
              identifier: 'mock-forge-mod:custom_item',
            },
            components: {
              'minecraft:max_stack_size': 64,
              'minecraft:icon': 'custom_item',
            },
          },
        },
        null,
        2
      )
    );

    // Create textures
    fs.mkdirSync(path.join(resourcePackDir, 'textures/blocks'), { recursive: true });
    fs.mkdirSync(path.join(resourcePackDir, 'textures/items'), { recursive: true });
    fs.writeFileSync(
      path.join(resourcePackDir, 'textures/blocks/custom_block.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]) // PNG header
    );
    fs.writeFileSync(
      path.join(resourcePackDir, 'textures/items/custom_item.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]) // PNG header
    );

    // Create models
    fs.mkdirSync(path.join(resourcePackDir, 'models/blocks'), { recursive: true });
    fs.writeFileSync(
      path.join(resourcePackDir, 'models/blocks/custom_block.json'),
      JSON.stringify(
        {
          format_version: '1.19.0',
          'minecraft:geometry': [
            {
              description: {
                identifier: 'geometry.custom_block',
                texture_width: 16,
                texture_height: 16,
              },
              bones: [
                {
                  name: 'block',
                  pivot: [0, 0, 0],
                  cubes: [
                    {
                      origin: [-8, 0, -8],
                      size: [16, 16, 16],
                      uv: {
                        north: { uv: [0, 0], uv_size: [16, 16] },
                        east: { uv: [0, 0], uv_size: [16, 16] },
                        south: { uv: [0, 0], uv_size: [16, 16] },
                        west: { uv: [0, 0], uv_size: [16, 16] },
                        up: { uv: [0, 0], uv_size: [16, 16] },
                        down: { uv: [0, 0], uv_size: [16, 16] },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2
      )
    );

    // Create pack icons
    fs.writeFileSync(
      path.join(behaviorPackDir, 'pack_icon.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]) // PNG header
    );
    fs.writeFileSync(
      path.join(resourcePackDir, 'pack_icon.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]) // PNG header
    );

    // Create license file
    fs.writeFileSync(
      path.join(tempDir, 'LICENSE'),
      'MIT License\n\nCopyright (c) 2023 Test Author\n'
    );
  });

  afterAll(() => {
    // Clean up
    cleanupTempDirectory(tempDir);
  });

  it('should embed license information', async () => {
    // Create license embedder
    const licenseEmbedder = new LicenseEmbedder();

    // Embed license
    const licenseResult = await licenseEmbedder.embedLicense(
      {
        type: 'MIT',
        author: 'Test Author',
        year: '2023',
        text: 'MIT License\n\nCopyright (c) 2023 Test Author\n',
        compatible: true,
      },
      {
        modId: 'mock-forge-mod',
        modName: 'Mock Forge Mod',
        author: 'Test Author',
        version: '1.0.0',
      },
      outputDir
    );

    expect(licenseResult.success).toBe(true);
    expect(fs.existsSync(path.join(behaviorPackDir, 'LICENSE.txt'))).toBe(true);
    expect(fs.existsSync(path.join(resourcePackDir, 'LICENSE.txt'))).toBe(true);
  });

  it('should validate the addon', async () => {
    // Create addon validator
    const addonValidator = new AddonValidator();

    // Validate addon
    const addonValidation = await addonValidator.validateAddon({
      behaviorPackPath: behaviorPackDir,
      resourcePackPath: resourcePackDir,
    });
    expect(addonValidation.valid).toBe(true);
  });

  it('should generate a conversion report', async () => {
    // Create report generator
    const reportGenerator = new ConversionReportGenerator();

    // Generate report
    const report = await reportGenerator.generateReport(
      {
        modId: 'mock-forge-mod',
        modName: 'Mock Forge Mod',
        modVersion: '1.0.0',
        modLoader: 'forge',
        conversionDate: new Date(),
        features: [
          {
            id: 'feature-1',
            name: 'Custom Block',
            description: 'A custom block implementation',
            type: 'BLOCK',
            compatibilityTier: 1,
            sourceFiles: ['src/main/java/com/example/mockmod/blocks/CustomBlock.java'],
          },
          {
            id: 'feature-2',
            name: 'Custom Item',
            description: 'A custom item implementation',
            type: 'ITEM',
            compatibilityTier: 1,
            sourceFiles: ['src/main/java/com/example/mockmod/items/CustomItem.java'],
          },
        ],
        assets: {
          textures: 2,
          models: 1,
          sounds: 0,
        },
        configuration: {
          blocks: 1,
          items: 1,
          recipes: 0,
          lootTables: 0,
        },
        scripts: {
          generatedFiles: 1,
          totalLines: 10,
        },
        compromises: [],
      },
      outputDir
    );

    expect(report).toBeDefined();
    expect(report.html).toBeDefined();
    expect(report.json).toBeDefined();

    // Write report to file
    fs.writeFileSync(path.join(outputDir, 'conversion-report.html'), report.html);
    fs.writeFileSync(
      path.join(outputDir, 'conversion-report.json'),
      JSON.stringify(report.json, null, 2)
    );

    // Verify report files exist
    expect(fs.existsSync(path.join(outputDir, 'conversion-report.html'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'conversion-report.json'))).toBe(true);
  });

  it('should generate manual post-processing guide', async () => {
    // Create guide generator
    const guideGenerator = new ManualPostProcessingGuide();

    // Generate guide
    const guide = await guideGenerator.generateGuide(
      {
        modId: 'mock-forge-mod',
        modName: 'Mock Forge Mod',
        manualSteps: [
          {
            id: 'step-1',
            title: 'Configure Custom Block Properties',
            description: 'Adjust the custom block properties in the blocks/custom_block.json file.',
            priority: 'high',
            codeSnippet:
              '{\n  "minecraft:block": {\n    "components": {\n      "minecraft:material": { "stone": true },\n      // Add additional properties here\n    }\n  }\n}',
          },
          {
            id: 'step-2',
            title: 'Test the Addon In-Game',
            description: 'Import the addon into Minecraft and test all features.',
            priority: 'medium',
          },
        ],
      },
      outputDir
    );

    expect(guide).toBeDefined();
    expect(guide.markdown).toBeDefined();

    // Write guide to file
    fs.writeFileSync(path.join(outputDir, 'post-processing-guide.md'), guide.markdown);

    // Verify guide file exists
    expect(fs.existsSync(path.join(outputDir, 'post-processing-guide.md'))).toBe(true);
  });

  it('should package the addon', async () => {
    // Create addon packager
    const addonPackager = new AddonPackager();

    // Package the addon
    const packageResult = await addonPackager.createAddon({
      outputPath: outputDir,
      bedrockConfigs: {
        manifests: {
          behaviorPack: {
            format_version: 2,
            header: {
              name: 'Mock Forge Mod',
              description: 'A mock Forge mod for testing',
              uuid: '00000000-0000-0000-0000-000000000001',
              version: [1, 0, 0],
              min_engine_version: [1, 19, 0],
            },
            modules: [],
          },
          resourcePack: {
            format_version: 2,
            header: {
              name: 'Mock Forge Mod Resources',
              description: 'Resources for Mock Forge Mod',
              uuid: '00000000-0000-0000-0000-000000000004',
              version: [1, 0, 0],
              min_engine_version: [1, 19, 0],
            },
            modules: [],
          },
        },
      },
      behaviorPackFiles: [],
      resourcePackFiles: [],
      documentation: {
        conversionReport: { html: '', json: '', markdown: '' },
        postProcessingGuide: { html: '', markdown: '' },
      },
    });

    expect(packageResult.success).toBe(true);
    expect(packageResult.addonPath).toBeDefined();
    expect(fs.existsSync(packageResult.addonPath)).toBe(true);

    // Verify addon structure
    const validStructure = await verifyAddonStructure(packageResult.addonPath);
    expect(validStructure).toBe(true);
  });
});
