import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ConversionService } from '@services/ConversionService';
import { ConfigurationService } from '@services/ConfigurationService';
import { JobQueue } from '@services/JobQueue';
import { FileProcessor } from '@modules/ingestion/FileProcessor';
import { JavaAnalyzer } from '@modules/ingestion/JavaAnalyzer';
import { AssetConverter } from '@modules/conversion-agents/AssetConverter';
import { ValidationPipeline } from '@services/ValidationPipeline';
import { FeatureFlagService } from '@services/FeatureFlagService';
import { MonitoringService } from '@services/MonitoringService';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';

describe('Conversion Pipeline Integration', () => {
  let conversionService: ConversionService;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = path.join(process.cwd(), 'temp', `conversion-pipeline-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const configService = ConfigurationService.getInstance();
    const config = configService.getConfig();
    const monitoringService = new MonitoringService(config.monitoring);
    vi.spyOn(monitoringService, 'recordMetric').mockImplementation(() => {});

    const jobQueue = new JobQueue();
    const fileProcessor = new FileProcessor(config.fileProcessor, monitoringService);
    const javaAnalyzer = new JavaAnalyzer(config.javaAnalyzer);
    const assetConverter = new AssetConverter();
    const validationPipeline = new ValidationPipeline();
    const featureFlagService = new FeatureFlagService();

    conversionService = new ConversionService({
      jobQueue,
      fileProcessor,
      javaAnalyzer,
      assetConverter,
      validationPipeline,
      featureFlagService,
      configService,
    });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle complete pipeline with error aggregation', async () => {
    const zip = new AdmZip();
    zip.addFile('mcmod.info', Buffer.from(JSON.stringify([{
      "modid": "mock-forge-mod",
      "name": "Mock Forge Mod",
      "version": "1.0.0"
    }])));
    const jarBuffer = zip.toBuffer();

    const result = await conversionService.createConversionJob({ buffer: jarBuffer, originalname: 'mock-forge-mod.jar' });

    expect(result).toBeDefined();
    expect(result.jobId).toBeDefined();
  });
});