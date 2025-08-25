import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConversionService } from '../../../src/services/ConversionService.js';
import { JobQueue } from '../../../src/services/JobQueue.js';
import { ErrorCollector } from '../../../src/services/ErrorCollector.js';

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
      queueConversion: vi.fn().mockReturnValue('mock_job_id'),
      cancelJob: vi.fn().mockReturnValue(true),
      startProcessingJobs: vi.fn(),
      stopProcessingJobs: vi.fn(),
      getJobStatus: vi.fn().mockReturnValue({
        status: 'pending',
        progress: 0,
      }),
    })),
  };
});

vi.mock('../../../src/utils/logger', async () => {
  const actual = (await vi.importActual('../../../src/utils/logger')) as any;
  return {
    ...actual,
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    },
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    })),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logStructuredEvent: vi.fn(),
      logSecurityEvent: vi.fn(),
      logPerformanceEvent: vi.fn(),
      logBusinessEvent: vi.fn(),
      logSystemEvent: vi.fn(),
    },
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

  it('should create a conversion job', async () => {
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

    const job = await conversionService.createConversionJob(input);

    expect(job).toBeDefined();
    expect(job.id).toBe('mock_job_id');
    expect(job.input).toBe(input);
    expect(job.status).toBe('pending');
    expect(jobQueue.getJob).toHaveBeenCalledWith('mock_job_id');
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

    const result = conversionService.cancelJob(jobId);

    expect(result).toBe(true);
    expect(conversionService.emit).toHaveBeenCalledWith('job:cancelled', { jobId });
  });

  it('should handle job not found when cancelling', () => {
    const jobId = 'non_existent_job';

    // Mock pipeline cancelJob to return false for non-existent job
    const mockPipeline = conversionService['pipeline'];
    vi.mocked(mockPipeline.cancelJob).mockReturnValue(false);

    const result = conversionService.cancelJob(jobId);

    expect(result).toBe(false);
    expect(conversionService.emit).not.toHaveBeenCalledWith('job:cancelled', { jobId });
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

  it('should start and stop the service', async () => {
    // Clear previous calls
    vi.clearAllMocks();

    // Start service
    conversionService.start();
    expect(conversionService.emit).toHaveBeenCalledWith('started');

    // Clear calls again to isolate stop test
    vi.clearAllMocks();

    // Stop service (it's async)
    await conversionService.stop();
    expect(conversionService.emit).toHaveBeenCalledWith('stopped');
  });
});
