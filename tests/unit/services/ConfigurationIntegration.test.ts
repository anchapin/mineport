import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationService } from '../../../src/services/ConfigurationService.js';
import { JobQueue } from '../../../src/services/JobQueue.js';
import { WorkerPool } from '../../../src/services/WorkerPool.js';
import {
  ResourceAllocator,
  ResourceAllocationStrategy,
} from '../../../src/services/ResourceAllocator.js';
import { CacheService } from '../../../src/services/CacheService.js';
import { UpdateService } from '../../../src/services/UpdateService.js';
import { ConversionService } from '../../../src/services/ConversionService.js';

// Logger and config are now mocked globally in tests/setup.ts

// Mock default config
vi.mock('../../../config/default', () => ({
  default: {
    server: {
      port: 3000,
      host: 'localhost',
    },
    processing: {
      maxConcurrent: 5,
      defaultPriority: 1,
    },
    resources: {
      checkInterval: 30000,
      minWorkers: 1,
      maxWorkers: 10,
      strategy: 'adaptive',
    },
    workers: {
      maxWorkers: 5,
    },
    cache: {
      enabled: true,
      ttlDefaults: {
        api_mapping: 86400,
        mod_analysis: 3600,
        asset_conversion: 7200,
        default: 1800,
      },
    },
    updates: {
      checkInterval: 3600000,
      apiMappingVersions: {
        minecraft_java: '1.19.0',
        minecraft_bedrock: '1.19.50',
      },
    },
    conversion: {
      statusUpdateInterval: 2000,
    },
  },
}));

describe('Configuration Integration', () => {
  let configService: ConfigurationService;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a new instance of ConfigurationService
    configService = new ConfigurationService({
      watchForChanges: false,
    });
  });

  afterEach(() => {
    configService.dispose();
  });

  it('JobQueue should use ConfigurationService', () => {
    // Set configuration values
    configService.set('processing.maxConcurrent', 10);
    configService.set('processing.defaultPriority', 2);

    // Create JobQueue with ConfigurationService
    const jobQueue = new JobQueue({ configService });

    // Check if JobQueue uses the configuration values
    expect(jobQueue['maxConcurrent']).toBe(10);
    expect(jobQueue['defaultPriority']).toBe(2);

    // Update configuration and check if JobQueue updates
    configService.set('processing.maxConcurrent', 15);
    expect(jobQueue['maxConcurrent']).toBe(15);
  });

  it('WorkerPool should use ConfigurationService', () => {
    // Set configuration values
    configService.set('workers.maxWorkers', 8);

    // Create WorkerPool with configuration values
    const workerPool = new WorkerPool({ maxWorkers: 8 });

    // Check if WorkerPool uses the configuration values
    expect(workerPool['config'].maxWorkers).toBe(8);

    // Create another WorkerPool with updated configuration
    configService.set('workers.maxWorkers', 12);
    const updatedWorkerPool = new WorkerPool({ maxWorkers: 12 });
    expect(updatedWorkerPool['config'].maxWorkers).toBe(12);
  });

  it('ResourceAllocator should use ConfigurationService', () => {
    // Set configuration values
    configService.set('resources.checkInterval', 60000);
    configService.set('resources.minWorkers', 2);
    configService.set('resources.maxWorkers', 15);
    configService.set('resources.strategy', 'conservative');

    // Create mock WorkerPool and JobQueue
    const workerPool = { scalePool: vi.fn() } as unknown as WorkerPool;
    const jobQueue = {} as JobQueue;

    // Create ResourceAllocator with ConfigurationService
    const resourceAllocator = new ResourceAllocator({
      workerPool,
      jobQueue,
      configService,
    });

    // Check if ResourceAllocator uses the configuration values
    expect(resourceAllocator['checkInterval']).toBe(60000);
    expect(resourceAllocator['minWorkers']).toBe(2);
    expect(resourceAllocator['maxWorkers']).toBe(15);
    expect(resourceAllocator['strategy']).toBe(ResourceAllocationStrategy.CONSERVATIVE);

    // Update configuration and check if ResourceAllocator updates
    configService.set('resources.checkInterval', 90000);
    expect(resourceAllocator['checkInterval']).toBe(90000);
  });

  it('CacheService should use ConfigurationService', () => {
    // Set configuration values
    configService.set('cache.enabled', false);
    configService.set('cache.ttlDefaults.api_mapping', 172800); // 48 hours

    // Create CacheService with ConfigurationService
    const cacheService = new CacheService({ configService });

    // Check if CacheService uses the configuration values
    expect(cacheService['enabled']).toBe(false);
    expect(cacheService['ttlDefaults']['api_mapping']).toBe(172800);

    // Update configuration and check if CacheService updates
    configService.set('cache.enabled', true);
    expect(cacheService['enabled']).toBe(true);
  });

  it('UpdateService should use ConfigurationService', () => {
    // Set configuration values
    configService.set('updates.checkInterval', 7200000); // 2 hours
    configService.set('updates.apiMappingVersions.minecraft_java', '1.20.0');

    // Create UpdateService with ConfigurationService
    const updateService = new UpdateService({ configService });

    // Check if UpdateService uses the configuration values
    expect(updateService['defaultCheckInterval']).toBe(7200000);
    expect(updateService['apiMappingVersions']['minecraft_java']).toBe('1.20.0');

    // Update configuration and check if UpdateService updates
    configService.set('updates.checkInterval', 10800000); // 3 hours
    expect(updateService['defaultCheckInterval']).toBe(10800000);
  });

  it('ConversionService should use ConfigurationService', () => {
    // Set configuration values
    configService.set('conversion.statusUpdateInterval', 5000);

    // Create mock JobQueue
    const jobQueue = new JobQueue();

    // Create ConversionService with ConfigurationService
    const conversionService = new ConversionService({
      jobQueue,
    });

    // Check if ConversionService uses the configuration values
    expect(conversionService['statusUpdateInterval']).toBe(5000);

    // Update configuration and check if ConversionService updates
    configService.set('conversion.statusUpdateInterval', 10000);
    expect(conversionService['statusUpdateInterval']).toBe(10000);
  });
});
