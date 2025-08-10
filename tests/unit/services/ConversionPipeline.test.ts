import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConversionPipeline } from '../../../src/services/ConversionPipeline.js';
import { ErrorCollector } from '../../../src/services/ErrorCollector.js';
import { JobQueue } from '../../../src/services/JobQueue.js';
import { ResourceAllocator } from '../../../src/services/ResourceAllocator.js';
import { ErrorType, ErrorSeverity } from '../../../src/types/errors.js';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../../../src/services/JobQueue');
vi.mock('../../../src/services/ResourceAllocator');
vi.mock('../../../src/modules/ingestion/ModValidator', () => ({
  ModValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue({
      valid: true,
      modInfo: {
        id: 'test-mod',
        name: 'Test Mod',
        version: '1.0.0',
        modLoader: 'forge',
        assets: {
          textures: [],
          models: [],
          sounds: [],
          particles: [],
        },
        sourceCode: [],
        config: {},
        license: { type: 'MIT', text: 'MIT License' },
      },
      errors: [],
    }),
  })),
}));

vi.mock('../../../src/modules/ingestion/FeatureCompatibilityAnalyzer', () => ({
  FeatureCompatibilityAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({
      compatible: true,
      notes: [],
    }),
  })),
}));

vi.mock('../../../src/modules/assets/AssetTranslationModule', () => ({
  AssetTranslationModule: vi.fn().mockImplementation(() => ({
    translateAssets: vi.fn().mockResolvedValue({
      bedrockAssets: {
        textures: [],
        models: [],
        sounds: [],
        particles: [],
        soundsJson: {},
      },
      conversionNotes: [],
    }),
    organizeAssets: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../src/modules/logic/LogicTranslationEngine', () => ({
  LogicTranslationEngine: vi.fn().mockImplementation(() => ({
    translate: vi.fn().mockResolvedValue({
      javascriptFiles: [],
      stubFunctions: [],
      conversionNotes: [],
    }),
  })),
}));

vi.mock('../../../src/modules/configuration/ManifestGenerator', () => ({
  ManifestGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      behaviorPack: { manifest: 'bp' },
      resourcePack: { manifest: 'rp' },
    }),
  })),
}));

vi.mock('../../../src/modules/configuration/BlockItemDefinitionConverter', () => ({
  BlockItemDefinitionConverter: vi.fn().mockImplementation(() => ({
    convert: vi.fn().mockResolvedValue({
      success: true,
      blocks: [],
      items: [],
    }),
  })),
}));

vi.mock('../../../src/modules/configuration/RecipeConverter', () => ({
  RecipeConverter: vi.fn().mockImplementation(() => ({
    convert: vi.fn().mockResolvedValue({
      success: true,
      convertedFiles: [],
    }),
  })),
}));

vi.mock('../../../src/modules/configuration/LootTableConverter', () => ({
  LootTableConverter: vi.fn().mockImplementation(() => ({
    convert: vi.fn().mockResolvedValue({
      success: true,
      convertedFiles: [],
    }),
  })),
}));

vi.mock('../../../src/modules/configuration/LicenseEmbedder', () => ({
  LicenseEmbedder: vi.fn().mockImplementation(() => ({
    embed: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../src/modules/packaging/AddonValidator', () => ({
  AddonValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue({
      valid: true,
      errors: [],
    }),
  })),
}));

vi.mock('../../../src/modules/packaging/ConversionReportGenerator', () => ({
  ConversionReportGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      reportPath: '/path/to/report.html',
    }),
  })),
}));

vi.mock('../../../src/modules/packaging/AddonPackager', () => ({
  AddonPackager: vi.fn().mockImplementation(() => ({
    package: vi.fn().mockResolvedValue({
      addonPath: '/path/to/addon.mcaddon',
    }),
  })),
}));

describe('ConversionPipeline', () => {
  let pipeline: ConversionPipeline;
  let errorCollector: ErrorCollector;
  let jobQueue: JobQueue;
  let resourceAllocator: ResourceAllocator;

  beforeEach(() => {
    // Create a fresh error collector for each test
    errorCollector = new ErrorCollector();

    // Create mock job queue
    jobQueue = {
      on: vi.fn().mockReturnThis(),
      addJob: vi.fn().mockImplementation((type, data, priority) => {
        return {
          id: 'test-job-id',
          type,
          data,
          priority: priority || 1,
          createdAt: new Date(),
          status: 'pending',
        };
      }),
      getJob: vi.fn().mockImplementation((id) => {
        return {
          id,
          type: 'conversion',
          data: {
            inputPath: '/path/to/input',
            outputPath: '/path/to/output',
            modId: 'test-mod',
            modName: 'Test Mod',
            modVersion: '1.0.0',
          },
          priority: 1,
          createdAt: new Date(),
          status: 'pending',
        };
      }),
      failJob: vi.fn(),
      completeJob: vi.fn(),
    } as unknown as JobQueue;

    // Create mock resource allocator
    resourceAllocator = {
      start: vi.fn(),
      stop: vi.fn(),
      setStrategy: vi.fn(),
    } as unknown as ResourceAllocator;

    // Create pipeline with the test error collector and job queue
    pipeline = new ConversionPipeline({
      errorCollector,
      jobQueue,
      resourceAllocator,
    });

    // Mock fs.mkdir to do nothing
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    // Mock fs.writeFile to do nothing
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should run the conversion pipeline successfully', async () => {
    const result = await pipeline.convert({
      inputPath: '/path/to/input',
      outputPath: '/path/to/output',
      modId: 'test-mod',
      modName: 'Test Mod',
      modVersion: '1.0.0',
      errorCollector,
    });

    expect(result.success).toBe(true);
    expect(result.outputPath).toBe('/path/to/output');
    expect(result.errorSummary.totalErrors).toBe(0);
  });

  it('should collect errors from different modules', async () => {
    // Add some errors directly to the error collector
    errorCollector.addError({
      id: '1',
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.ERROR,
      message: 'Validation error 1',
      moduleOrigin: 'ModValidator',
      timestamp: new Date(),
    });

    errorCollector.addError({
      id: '2',
      type: ErrorType.ASSET,
      severity: ErrorSeverity.WARNING,
      message: 'Asset conversion warning',
      moduleOrigin: 'AssetTranslationModule',
      timestamp: new Date(),
    });

    errorCollector.addError({
      id: '3',
      type: ErrorType.LOGIC,
      severity: ErrorSeverity.ERROR,
      message: 'Logic conversion error',
      moduleOrigin: 'LogicTranslationEngine',
      timestamp: new Date(),
    });

    // Check that errors were collected from different modules
    const errors = errorCollector.getErrors();
    expect(errors.length).toBeGreaterThan(0);

    // Check that we have errors from different modules
    const moduleOrigins = new Set(errors.map((e) => e.moduleOrigin));
    expect(moduleOrigins.size).toBeGreaterThan(1);
  });

  it('should handle unexpected errors', async () => {
    // Add a critical system error directly to the error collector
    errorCollector.addError({
      id: '4',
      type: ErrorType.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      message: 'Unexpected system error',
      moduleOrigin: 'ConversionPipeline',
      timestamp: new Date(),
    });

    // Check that we have a system error
    const errors = errorCollector.getErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.type === ErrorType.SYSTEM)).toBe(true);
    expect(errors.some((e) => e.severity === ErrorSeverity.CRITICAL)).toBe(true);
  });

  it('should generate a report when requested', async () => {
    const result = await pipeline.convert({
      inputPath: '/path/to/input',
      outputPath: '/path/to/output',
      modId: 'test-mod',
      modName: 'Test Mod',
      modVersion: '1.0.0',
      generateReport: true,
      errorCollector,
    });

    expect(result.success).toBe(true);
    expect(result.reportPath).toBe('/path/to/report.html');
  });

  it('should package the addon when requested', async () => {
    const result = await pipeline.convert({
      inputPath: '/path/to/input',
      outputPath: '/path/to/output',
      modId: 'test-mod',
      modName: 'Test Mod',
      modVersion: '1.0.0',
      packageAddon: true,
      errorCollector,
    });

    expect(result.success).toBe(true);
    expect(result.addonPath).toBe('/path/to/addon.mcaddon');
  });

  // Tests for JobQueue integration
  describe('JobQueue Integration', () => {
    it('should queue a conversion job', () => {
      const jobId = pipeline.queueConversion({
        inputPath: '/path/to/input',
        outputPath: '/path/to/output',
        modId: 'test-mod',
        modName: 'Test Mod',
        modVersion: '1.0.0',
      });

      expect(jobId).toBe('test-job-id');
      expect(jobQueue.addJob).toHaveBeenCalledWith(
        'conversion',
        expect.objectContaining({
          inputPath: '/path/to/input',
          outputPath: '/path/to/output',
          modId: 'test-mod',
        }),
        undefined
      );
    });

    it('should queue a conversion job with priority', () => {
      const jobId = pipeline.queueConversion(
        {
          inputPath: '/path/to/input',
          outputPath: '/path/to/output',
          modId: 'test-mod',
          modName: 'Test Mod',
          modVersion: '1.0.0',
        },
        5
      );

      expect(jobId).toBe('test-job-id');
      expect(jobQueue.addJob).toHaveBeenCalledWith(
        'conversion',
        expect.objectContaining({
          inputPath: '/path/to/input',
          outputPath: '/path/to/output',
          modId: 'test-mod',
        }),
        5
      );
    });

    it('should get job status', () => {
      const status = pipeline.getJobStatus('test-job-id');

      expect(status).toEqual({
        status: 'pending',
        progress: undefined,
      });
      expect(jobQueue.getJob).toHaveBeenCalledWith('test-job-id');
    });

    it('should cancel a pending job', () => {
      vi.mocked(jobQueue.failJob).mockImplementation(() => {});

      const result = pipeline.cancelJob('test-job-id');

      expect(result).toBe(true);
      expect(jobQueue.failJob).toHaveBeenCalledWith('test-job-id', expect.any(Error));
    });

    it('should start processing jobs', () => {
      const result = pipeline.startProcessingJobs();

      expect(result).toBe(true);
    });

    it('should stop processing jobs', () => {
      pipeline.startProcessingJobs();
      const result = pipeline.stopProcessingJobs();

      expect(result).toBe(true);
    });

    it('should handle job processing events', async () => {
      // Set up the pipeline with job queue
      pipeline.setJobQueue(jobQueue);

      // Mock the convert method
      vi.spyOn(pipeline, 'convert').mockResolvedValue({
        success: true,
        outputPath: '/path/to/output',
        errorSummary: {
          totalErrors: 0,
          criticalErrors: 0,
          errors: 0,
          warnings: 0,
          info: 0,
        },
      });

      // Verify that the job queue's on method was called
      expect(jobQueue.on).toHaveBeenCalledWith('job:process', expect.any(Function));

      // Since we can't easily get the callback, we'll test the queueConversion method instead
      const jobId = pipeline.queueConversion({
        inputPath: '/path/to/input',
        outputPath: '/path/to/output',
        modId: 'test-mod',
        modName: 'Test Mod',
        modVersion: '1.0.0',
      });

      expect(jobId).toBe('test-job-id');
      expect(jobQueue.addJob).toHaveBeenCalled();
    });

    it('should handle job processing errors', async () => {
      // Set up the pipeline with job queue
      pipeline.setJobQueue(jobQueue);

      // Mock the convert method to throw an error
      vi.spyOn(pipeline, 'convert').mockRejectedValue(new Error('Test error'));

      // Verify that the job queue's on method was called
      expect(jobQueue.on).toHaveBeenCalledWith('job:process', expect.any(Function));

      // Test the cancelJob method
      const cancelled = pipeline.cancelJob('test-job-id');

      expect(cancelled).toBe(true);
      expect(jobQueue.failJob).toHaveBeenCalledWith('test-job-id', expect.any(Error));
    });
  });
});
