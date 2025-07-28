import { JobQueue } from './JobQueue';
import { WorkerPool } from './WorkerPool';
import { ResourceAllocator, AdaptiveAllocationStrategy } from './ResourceAllocator';

/**
 * Example of how to use the infrastructure services together
 * This demonstrates the scalable processing system for requirement 7.2
 */
export function setupInfrastructure() {
  // Create the job queue with a maximum of 5 concurrent jobs
  const jobQueue = new JobQueue({ maxConcurrent: 5 });
  
  // Create the worker pool with the job queue
  const workerPool = new WorkerPool({ 
    maxWorkers: 5,
    jobQueue
  });
  
  // Create the resource allocator with adaptive strategy
  const resourceAllocator = new ResourceAllocator({
    workerPool,
    jobQueue,
    checkInterval: 30000, // Check every 30 seconds
    minWorkers: 2,
    maxWorkers: 10
  });
  
  // Set up event listeners for monitoring
  jobQueue.on('job:added', (job) => {
    console.log(`Job added: ${job.id} (${job.type})`);
  });
  
  jobQueue.on('job:completed', (job) => {
    console.log(`Job completed: ${job.id} (${job.type})`);
  });
  
  jobQueue.on('job:failed', (job) => {
    console.error(`Job failed: ${job.id} (${job.type})`, job.error);
  });
  
  // Start the resource allocator
  resourceAllocator.start();
  
  // Return the infrastructure components
  return {
    jobQueue,
    workerPool,
    resourceAllocator,
    
    // Helper function to add a mod conversion job
    addModConversionJob: (modData: any, priority = 1) => {
      return jobQueue.addJob('mod_conversion', {
        ...modData,
        complexity: calculateModComplexity(modData)
      }, priority);
    },
    
    // Helper function to shut down the infrastructure
    shutdown: () => {
      resourceAllocator.stop();
    }
  };
}

/**
 * Calculate the complexity of a mod to determine processing time
 * This is a simplified example - in a real system this would be more sophisticated
 */
function calculateModComplexity(modData: any): number {
  let complexity = 1; // Base complexity
  
  // Add complexity based on mod size
  /**
   * if method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  if (modData.sizeInMB) {
    complexity += modData.sizeInMB / 10; // 10MB = +1 complexity
  }
  
  // Add complexity based on number of features
  /**
   * if method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  if (modData.features) {
    complexity += modData.features.length * 0.2;
  }
  
  // Add complexity based on mod type
  if (modData.modLoader === 'forge') {
    complexity *= 1.2; // Forge mods are typically more complex
  }
  
  return complexity;
}