import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConversionService } from '../../../src/services/ConversionService.js';
import { JobQueue } from '../../../src/services/JobQueue.js';
import { ResourceAllocator } from '../../../src/services/ResourceAllocator.js';
import { ErrorCollector } from '../../../src/services/ErrorCollector.js';
import { ConversionPipeline } from '../../../src/services/ConversionPipeline.js';

// Mock dependencies
vi.mock('../../../src/services/ConversionPipeline', async () => {
  const { EventEmitter } = await vi.importActual<typeof import('events')>('events');
  const MockConversionPipeline = class extends EventEmitter {
    convert = vi.fn().mockResolvedValue({
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
      });
      queueConversion = vi.fn().mockReturnValue('mock_job_id');
      cancelJob = vi.fn().mockReturnValue(true);
      startProcessingJobs = vi.fn();
      stopProcessingJobs = vi.fn();
      getJobStatus = vi.fn().mockReturnValue({
        status: 'pending',
        progress: 0,
      });
    };

  return { ConversionPipeline: MockConversionPipeline };
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
  let conversionPipeline: ConversionPipeline;
  let resourceAllocator: ResourceAllocator;
  let conversionService: ConversionService;

  beforeEach(() => {
    // Create fresh instances for each test
    jobQueue = new JobQueue();
    errorCollector = new ErrorCollector();
    conversionPipeline = new ConversionPipeline();
    resourceAllocator = new ResourceAllocator();

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
      // Only return job data for known job IDs
      if (id === 'mock_job_id' || id === 'completed_job' || id === 'pending_job') {
        return {
          id,
          type: 'conversion',
          data: { modFile: 'test.jar', outputPath: '/output', options: {} },
          priority: 1,
          createdAt: new Date(),
          status: id === 'completed_job' ? 'completed' : 'pending',
        };
      }
      // Return undefined for non-existent jobs
      return undefined;
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

    // Mock ResourceAllocator
    resourceAllocator.releaseJobResources = vi.fn();

    // Create the service
    conversionService = new ConversionService({
      jobQueue,
      conversionPipeline,
      resourceAllocator,
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

    // Mock the pipeline's cancelJob to return true
    const mockPipeline = (conversionService as any).pipeline;
    mockPipeline.cancelJob.mockReturnValue(true);

    const result = conversionService.cancelJob(jobId);

    expect(result).toBe(true);
    // The service itself no longer emits 'job:cancelled' directly, the queue does.
    // We will test the cleanup logic in a separate test.
  });

  it('should handle job not found when cancelling', () => {
    const jobId = 'non_existent_job';

    // Mock pipeline cancelJob to return false for non-existent job
    const mockPipeline = (conversionService as any).pipeline;
    mockPipeline.cancelJob = vi.fn().mockReturnValue(false);

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

  it('should update job progress and emit status update event', async () => {
    const jobId = 'mock_job_id';
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

    await conversionService.createConversionJob(input);

    const progressData = {
      status: 'processing' as const,
      progress: 50,
      currentStage: 'Asset Conversion',
      stageProgress: 25,
    };

    conversionService.updateJobProgress(jobId, progressData);

    const status = conversionService.getJobStatus(jobId);

    expect(status).toBeDefined();
    expect(status?.status).toBe('processing');
    expect(status?.progress).toBe(50);
    expect(status?.currentStage).toBe('Asset Conversion');
    expect(status?.stageProgress).toBe(25);
    expect(conversionService.emit).toHaveBeenCalledWith('job-status:updated', status);
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources when a job is cancelled', () => {
      const cancelledJob = { id: 'cancelled_job', type: 'conversion' };
      // Find the 'job:cancelled' event registration
      const onCancelled = (jobQueue.on as any).mock.calls.find(
        (call: any) => call[0] === 'job:cancelled'
      );
      expect(onCancelled).toBeDefined();

      // Trigger the event
      const eventCallback = onCancelled[1];
      eventCallback(cancelledJob);

      // Verify cleanup was called
      expect(resourceAllocator.releaseJobResources).toHaveBeenCalledWith(cancelledJob.id);
    });

    it('should clean up resources when a job fails', () => {
      const failedJob = { id: 'failed_job', type: 'conversion', error: new Error('Failure') };
      const onFailed = (jobQueue.on as any).mock.calls.find(
        (call: any) => call[0] === 'job:failed'
      );
      expect(onFailed).toBeDefined();

      const eventCallback = onFailed[1];
      eventCallback(failedJob);

      expect(resourceAllocator.releaseJobResources).toHaveBeenCalledWith(failedJob.id);
    });

    it('should clean up resources for an orphaned job', () => {
      const orphanedJob = { id: 'orphaned_job', type: 'conversion' };
      const onOrphaned = (jobQueue.on as any).mock.calls.find(
        (call: any) => call[0] === 'job:orphaned'
      );
      expect(onOrphaned).toBeDefined();

      const eventCallback = onOrphaned[1];
      eventCallback(orphanedJob);

      expect(resourceAllocator.releaseJobResources).toHaveBeenCalledWith(orphanedJob.id);
    });
  });
});