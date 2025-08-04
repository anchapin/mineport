import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConversionService } from '../../../src/services/ConversionService.js';
import { JobQueue } from '../../../src/services/JobQueue.js';
import { ErrorCollector } from '../../../src/services/ErrorCollector.js';
import { ConversionPipeline } from '../../../src/services/ConversionPipeline.js';

// Mock dependencies
vi.mock('../../../src/services/ConversionPipeline', () => {
  return {
    ConversionPipeline: vi.fn().mockImplementation(() => ({
      convert: vi.fn().mockResolvedValue({
        success: true,
        outputPath: '/mock/output',
        reportPath: '/mock/report.html',
        addonPath: '/mock/addon.mcaddon',
        errorSummary: {
          totalErrors: 0,
          criticalErrors: 0,
          errors: 0,
          warnings: 0,
          info: 0,
        },
      }),
    })),
  };
});

vi.mock('../../../src/utils/logger', () => {
  return {
    createLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  };
});

describe('ConversionService', () => {
  let jobQueue: JobQueue;
  let errorCollector: ErrorCollector;
  let conversionService: ConversionService;

  beforeEach(() => {
    // Create fresh instances for each test
    jobQueue = new JobQueue();
    errorCollector = new ErrorCollector();

    // Mock JobQueue methods
    jobQueue.addJob = vi.fn().mockImplementation((type, data, priority) => {
      return {
        id: 'mock_job_id',
        type,
        data,
        priority: priority || 1,
        createdAt: new Date(),
        status: 'pending',
      };
    });

    jobQueue.getJob = vi.fn().mockImplementation((id) => {
      return {
        id,
        type: 'conversion',
        data: { modFile: 'test.jar', outputPath: '/output', options: {} },
        priority: 1,
        createdAt: new Date(),
        status: 'pending',
      };
    });

    jobQueue.getJobs = vi.fn().mockReturnValue([
      {
        id: 'mock_job_id',
        type: 'conversion',
        data: { modFile: 'test.jar', outputPath: '/output', options: {} },
        priority: 1,
        createdAt: new Date(),
        status: 'pending',
      },
    ]);

    jobQueue.completeJob = vi.fn();
    jobQueue.failJob = vi.fn();

    // Mock event emitter methods
    jobQueue.on = vi.fn();
    jobQueue.emit = vi.fn();

    // Create the service
    conversionService = new ConversionService({
      jobQueue,
      errorCollector,
    });

    // Mock event emitter methods
    conversionService.emit = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a conversion job', () => {
    const input = {
      modFile: 'test.jar',
      outputPath: '/output',
      options: {
        targetMinecraftVersion: '1.19',
        compromiseStrategy: 'balanced' as const,
        includeDocumentation: true,
        optimizeAssets: true,
      },
    };

    const job = conversionService.createConversionJob(input);

    expect(job).toBeDefined();
    expect(job.id).toBe('mock_job_id');
    expect(job.input).toBe(input);
    expect(job.status).toBe('pending');
    expect(jobQueue.addJob).toHaveBeenCalled();
    expect(jobQueue.addJob).toHaveBeenCalledWith('conversion', input);
    expect(conversionService.emit).toHaveBeenCalledWith('job:created', job);
  });

  it('should get job status', () => {
    const jobId = 'mock_job_id';

    // Create a job first to add it to activeJobs
    const input = {
      modFile: 'test.jar',
      outputPath: '/output',
      options: {
        targetMinecraftVersion: '1.19',
        compromiseStrategy: 'balanced' as const,
        includeDocumentation: true,
        optimizeAssets: true,
      },
    };

    conversionService.createConversionJob(input);

    const status = conversionService.getJobStatus(jobId);

    expect(status).toBeDefined();
    expect(status?.jobId).toBe(jobId);
    expect(status?.status).toBe('pending');
  });

  it('should get all jobs', () => {
    const jobs = conversionService.getJobs();

    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('mock_job_id');
    expect(jobQueue.getJobs).toHaveBeenCalledWith({
      type: 'conversion',
      status: undefined,
    });
  });

  it('should cancel a pending job', () => {
    const jobId = 'mock_job_id';

    // Mock job status
    (jobQueue.getJob as any).mockReturnValue({
      id: jobId,
      type: 'conversion',
      data: { modFile: 'test.jar', outputPath: '/output', options: {} },
      priority: 1,
      createdAt: new Date(),
      status: 'pending',
    });

    const result = conversionService.cancelJob(jobId);

    expect(result).toBe(true);
    expect(jobQueue.failJob).toHaveBeenCalledWith(jobId, expect.any(Error));
    expect(conversionService.emit).toHaveBeenCalledWith('job:cancelled', { jobId });
  });

  it('should handle job not found when cancelling', () => {
    const jobId = 'non_existent_job';

    // Mock job not found
    (jobQueue.getJob as any).mockReturnValue(undefined);

    const result = conversionService.cancelJob(jobId);

    expect(result).toBe(false);
    expect(jobQueue.failJob).not.toHaveBeenCalled();
  });

  it('should get job result for completed job', () => {
    const jobId = 'completed_job';

    // Mock completed job
    (jobQueue.getJob as any).mockReturnValue({
      id: jobId,
      type: 'conversion',
      data: { modFile: 'test.jar', outputPath: '/output', options: {} },
      priority: 1,
      createdAt: new Date(),
      status: 'completed',
      result: {
        jobId,
        bedrockAddon: {
          resourcePack: '/output/resource_pack',
          behaviorPack: '/output/behavior_pack',
        },
        report: { path: '/output/report.html' },
        errors: [],
        warnings: [],
      },
    });

    const result = conversionService.getJobResult(jobId);

    expect(result).toBeDefined();
    expect(result?.jobId).toBe(jobId);
    expect(result?.bedrockAddon).toBeDefined();
  });

  it('should return undefined for non-completed job result', () => {
    const jobId = 'pending_job';

    // Mock pending job
    (jobQueue.getJob as any).mockReturnValue({
      id: jobId,
      type: 'conversion',
      data: { modFile: 'test.jar', outputPath: '/output', options: {} },
      priority: 1,
      createdAt: new Date(),
      status: 'pending',
    });

    const result = conversionService.getJobResult(jobId);

    expect(result).toBeUndefined();
  });

  it('should start and stop the service', () => {
    // Mock methods
    const startMock = vi.spyOn(conversionService, 'start');
    const stopMock = vi.spyOn(conversionService, 'stop');

    // Start service
    conversionService.start();
    expect(startMock).toHaveBeenCalled();
    expect(conversionService.emit).toHaveBeenCalledWith('started');

    // Stop service
    conversionService.stop();
    expect(stopMock).toHaveBeenCalled();
    expect(conversionService.emit).toHaveBeenCalledWith('stopped');
  });
});
