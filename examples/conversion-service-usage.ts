/**
 * Example usage of the ConversionService
 * 
 * This example demonstrates how to use the ConversionService to create and manage conversion jobs.
 */

import { JobQueue } from '../src/services/JobQueue';
import { ConversionService } from '../src/services/ConversionService';
import { ErrorCollector } from '../src/services/ErrorCollector';
import { ResourceAllocator } from '../src/services/ResourceAllocator';
import { WorkerPool } from '../src/services/WorkerPool';

// Create dependencies
const jobQueue = new JobQueue({ maxConcurrent: 3 });
const workerPool = new WorkerPool({ maxWorkers: 5 });
const resourceAllocator = new ResourceAllocator({ 
  workerPool, 
  jobQueue,
  minWorkers: 1,
  maxWorkers: 5
});
const errorCollector = new ErrorCollector();

// Create conversion service
const conversionService = new ConversionService({
  jobQueue,
  resourceAllocator,
  errorCollector,
  statusUpdateInterval: 1000 // Update status every second
});

// Start the service
conversionService.start();

// Listen for events
conversionService.on('job:created', (job) => {
  console.log(`Job created: ${job.id}`);
});

conversionService.on('job:status', (status) => {
  console.log(`Job ${status.jobId} status: ${status.status}, progress: ${status.progress}%, stage: ${status.currentStage}`);
});

conversionService.on('job:completed', (data) => {
  console.log(`Job ${data.jobId} completed`);
  console.log('Result:', data.result);
});

conversionService.on('job:failed', (data) => {
  console.log(`Job ${data.jobId} failed: ${data.error?.message}`);
});

// Create a conversion job
const job = conversionService.createConversionJob({
  modFile: '/path/to/mod.jar',
  outputPath: '/path/to/output',
  options: {
    targetMinecraftVersion: '1.19',
    compromiseStrategy: 'balanced',
    includeDocumentation: true,
    optimizeAssets: true
  }
});

console.log(`Created job: ${job.id}`);

// Get job status
setTimeout(() => {
  const status = conversionService.getJobStatus(job.id);
  console.log('Job status:', status);
}, 2000);

// Get all jobs
setTimeout(() => {
  const jobs = conversionService.getJobs();
  console.log(`Found ${jobs.length} jobs`);
}, 4000);

// Cancel a job (uncomment to test)
// setTimeout(() => {
//   const cancelled = conversionService.cancelJob(job.id);
//   console.log(`Job cancelled: ${cancelled}`);
// }, 6000);

// Stop the service when done
setTimeout(() => {
  conversionService.stop();
  console.log('Conversion service stopped');
}, 10000);