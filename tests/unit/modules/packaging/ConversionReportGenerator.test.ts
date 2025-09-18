import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ConversionReportGenerator } from '../../../../src/modules/packaging/ConversionReportGenerator.js';
import { ManualPostProcessingGuide } from '../../../../src/modules/packaging/ManualPostProcessingGuide.js';

// Mock fs and path modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ManualPostProcessingGuide
vi.mock('../../../../src/modules/packaging/ManualPostProcessingGuide', () => {
  return {
    ManualPostProcessingGuide: vi.fn().mockImplementation(() => {
      return {
        generateGuide: vi.fn().mockResolvedValue({
          htmlGuidePath: '/output/manual-post-processing.html',
          markdownGuidePath: '/output/manual-post-processing.md',
          jsonGuidePath: '/output/manual-post-processing.json',
          steps: [
            {
              id: 'test-step',
              title: 'Test Step',
              description: 'A test step',
              priority: 'high',
            },
          ],
        }),
      };
    }),
  };
});

describe('ConversionReportGenerator', () => {
  let reportGenerator: ConversionReportGenerator;
  let mockInput: any;

  beforeEach(() => {
    reportGenerator = new ConversionReportGenerator();

    // Mock input data
    mockInput = {
      modName: 'TestMod',
      modVersion: '1.0.0',
      modLoader: 'forge',
      conversionDate: new Date('2025-07-19T12:00:00Z'),
      features: {
        tier1: [
          {
            id: 'feature1',
            name: 'Simple Block',
            description: 'A simple block with basic properties',
            type: 'block',
            compatibilityTier: 1,
            sourceFiles: ['Block.java'],
            sourceLineNumbers: [[10, 20]],
          },
        ],
        tier2: [
          {
            id: 'feature2',
            name: 'Custom Item with Effects',
            description: 'An item that applies status effects',
            type: 'item',
            compatibilityTier: 2,
            sourceFiles: ['Item.java'],
            sourceLineNumbers: [[15, 30]],
          },
        ],
        tier3: [
          {
            id: 'feature3',
            name: 'Custom Dimension',
            description: 'A custom dimension with unique properties',
            type: 'dimension',
            compatibilityTier: 3,
            sourceFiles: ['Dimension.java'],
            sourceLineNumbers: [[5, 100]],
          },
        ],
        tier4: [
          {
            id: 'feature4',
            name: 'Advanced Rendering',
            description: 'Custom rendering pipeline',
            type: 'rendering',
            compatibilityTier: 4,
            sourceFiles: ['Renderer.java'],
            sourceLineNumbers: [[50, 200]],
          },
        ],
      },
      assets: {
        textures: 10,
        models: 5,
        sounds: 3,
        particles: 2,
      },
      configurations: {
        blocks: 8,
        items: 6,
        recipes: 4,
        lootTables: 2,
      },
      scripts: {
        total: 15,
        generated: 12,
        stubbed: 3,
      },
      compromiseReport: {
        totalCompromisesApplied: 2,
        appliedStrategies: [
          {
            featureId: 'feature3',
            strategyId: 'dimension-simulation',
            strategyName: 'Dimension Simulation',
            strategyDescription:
              'Simulates custom dimensions using teleportation and visual effects',
          },
          {
            featureId: 'feature4',
            strategyId: 'rendering-stub',
            strategyName: 'Rendering Stub',
            strategyDescription: 'Stubs out advanced rendering code with appropriate warnings',
          },
        ],
      },
      conversionNotes: [
        {
          type: 'texture',
          message: 'All textures converted successfully',
          severity: 'info',
        },
        {
          type: 'model',
          message: 'Some models required simplification',
          severity: 'warning',
          sourceFile: 'models/block/custom.json',
        },
        {
          type: 'script',
          message: 'Unable to convert custom rendering pipeline',
          severity: 'error',
          sourceFile: 'Renderer.java',
          sourceLine: 75,
        },
      ],
      conversionTime: 5000, // 5 seconds
    };

    // Mock fs.existsSync to return false for directory check
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create output directory if it does not exist', async () => {
    const outputDir = '/output';
    await reportGenerator.generateReport(mockInput, outputDir);

    expect(fs.existsSync).toHaveBeenCalledWith(outputDir);
    expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
  });

  it('should generate HTML, JSON, and Markdown reports', async () => {
    const outputDir = '/output';
    await reportGenerator.generateReport(mockInput, outputDir);

    // Check that writeFileSync was called for each report type
    expect(fs.writeFileSync).toHaveBeenCalledTimes(3);

    // Check HTML report
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(outputDir, 'conversion-report.html'),
      expect.stringContaining('<!DOCTYPE html>')
    );

    // Check JSON report (called second)
    expect(fs.writeFileSync).toHaveBeenNthCalledWith(
      2,
      path.join(outputDir, 'conversion-report.json'),
      expect.stringContaining('"name": "TestMod"')
    );

    // Check Markdown report (called third)
    expect(fs.writeFileSync).toHaveBeenNthCalledWith(
      3,
      path.join(outputDir, 'conversion-report.md'),
      expect.stringContaining('# Conversion Report: TestMod v1.0.0')
    );
  });

  it('should generate manual post-processing guide', async () => {
    const outputDir = '/output';
    await reportGenerator.generateReport(mockInput, outputDir);

    // Check that ManualPostProcessingGuide was instantiated and generateGuide was called
    expect(ManualPostProcessingGuide).toHaveBeenCalled();
    const mockConstructor = vi.mocked(ManualPostProcessingGuide);
    const mockInstance = mockConstructor.mock.results[0].value;
    expect(mockInstance.generateGuide).toHaveBeenCalledWith(
      {
        modName: mockInput.modName,
        modVersion: mockInput.modVersion,
        features: mockInput.features,
        compromiseReport: mockInput.compromiseReport,
        conversionNotes: mockInput.conversionNotes,
      },
      outputDir
    );
  });

  it('should return correct paths in the output', async () => {
    const outputDir = '/output';
    const result = await reportGenerator.generateReport(mockInput, outputDir);

    expect(result).toEqual({
      htmlReportPath: path.join(outputDir, 'conversion-report.html'),
      jsonReportPath: path.join(outputDir, 'conversion-report.json'),
      markdownReportPath: path.join(outputDir, 'conversion-report.md'),
      manualPostProcessingGuide: {
        htmlGuidePath: '/output/manual-post-processing.html',
        markdownGuidePath: '/output/manual-post-processing.md',
        jsonGuidePath: '/output/manual-post-processing.json',
        steps: [
          {
            id: 'test-step',
            title: 'Test Step',
            description: 'A test step',
            priority: 'high',
          },
        ],
      },
    });
  });

  it('should calculate quality metrics correctly', async () => {
    const outputDir = '/output';
    await reportGenerator.generateReport(mockInput, outputDir);

    // Check that the JSON report contains quality metrics
    const jsonCallArgs = vi
      .mocked(fs.writeFileSync)
      .mock.calls.find((call) => call[0] === path.join(outputDir, 'conversion-report.json'));

    if (jsonCallArgs) {
      const jsonContent = jsonCallArgs[1] as string;
      const report = JSON.parse(jsonContent);

      // Verify metrics exist
      expect(report.qualityMetrics).toBeDefined();
      expect(report.qualityMetrics.overall).toBeDefined();
      expect(report.qualityMetrics.assets).toBeDefined();
      expect(report.qualityMetrics.configurations).toBeDefined();
      expect(report.qualityMetrics.logic).toBeDefined();
      expect(report.qualityMetrics.compatibility).toBeDefined();

      // Verify metrics are in the correct range
      expect(report.qualityMetrics.overall).toBeGreaterThanOrEqual(0);
      expect(report.qualityMetrics.overall).toBeLessThanOrEqual(100);
    }
  });
});
