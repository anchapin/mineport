/**
 * Worker Script - Handles CPU-intensive tasks in worker threads
 *
 * This script runs in worker threads to handle tasks like:
 * - File analysis
 * - Asset conversion
 * - Security scanning
 * - Validation processing
 */

import { parentPort, workerData } from 'worker_threads';
import path from 'path';

// Worker ID from worker data
const workerId = workerData?.workerId || 'unknown';

/**
 * Task handlers for different types of work
 */
const taskHandlers = {
  /**
   * Java analysis task
   */
  async javaAnalysis(data) {
    const { JavaAnalyzer } = await import('../modules/ingestion/JavaAnalyzer.js');
    const analyzer = new JavaAnalyzer();
    return await analyzer.analyzeJarForMVP(data.jarPath);
  },

  /**
   * File validation task
   */
  async fileValidation(data) {
    const { FileProcessor } = await import('../modules/ingestion/FileProcessor.js');
    const processor = new FileProcessor(data.options);
    return await processor.validateUpload(data.buffer, data.filename);
  },

  /**
   * Security scanning task
   */
  async securityScan(data) {
    const { SecurityScanner } = await import('../modules/ingestion/SecurityScanner.js');
    const scanner = new SecurityScanner();
    return await scanner.scanBuffer(data.buffer, data.filename);
  },

  /**
   * Asset conversion task
   */
  async assetConversion(data) {
    const { AssetConverter } = await import('../modules/conversion-agents/AssetConverter.js');
    const converter = new AssetConverter();

    switch (data.assetType) {
      case 'textures':
        return await converter.convertTextures(data.assets);
      case 'sounds':
        return await converter.convertSounds(data.assets);
      case 'models':
        return await converter.convertModels(data.assets);
      default:
        throw new Error(`Unknown asset type: ${data.assetType}`);
    }
  },

  /**
   * Validation pipeline task
   */
  async validation(data) {
    const { ValidationPipeline } = await import('../services/ValidationPipeline.js');
    const pipeline = new ValidationPipeline();

    // Add stages based on data configuration
    if (data.stages) {
      for (const stageConfig of data.stages) {
        const module = await import(stageConfig.modulePath);
        const StageClass = module[stageConfig.className];
        const stage = new StageClass(stageConfig.options);
        pipeline.addStage({
          name: stageConfig.name,
          validator: stage.validate.bind(stage),
          required: stageConfig.required
        });
      }
    }

    return await pipeline.runValidation(data.input);
  },

  /**
   * Parallel file processing task
   */
  async parallelFileProcessing(data) {
    const results = [];
    const errors = [];

    for (const fileData of data.files) {
      try {
        const result = await this.fileValidation(fileData);
        results.push({ file: fileData.filename, result });
      } catch (error) {
        errors.push({ file: fileData.filename, error: error.message });
      }
    }

    return { results, errors };
  },

  /**
   * Batch analysis task
   */
  async batchAnalysis(data) {
    const results = [];
    const errors = [];

    for (const analysisData of data.batch) {
      try {
        const result = await this.javaAnalysis(analysisData);
        results.push({ id: analysisData.id, result });
      } catch (error) {
        errors.push({ id: analysisData.id, error: error.message });
      }
    }

    return { results, errors };
  },

  /**
   * Memory-intensive computation task
   */
  async memoryIntensiveTask(data) {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const startMemory = process.memoryUsage();

    try {
      // Perform the actual computation
      const result = await taskHandlers[data.subtask](data.taskData);

      // Clean up and force GC again
      if (global.gc) {
        global.gc();
      }

      const endMemory = process.memoryUsage();

      return {
        result,
        memoryUsage: {
          start: startMemory,
          end: endMemory,
          peak: endMemory.heapUsed - startMemory.heapUsed
        }
      };
    } catch (error) {
      // Clean up on error
      if (global.gc) {
        global.gc();
      }
      throw error;
    }
  }
};

/**
 * Handle incoming messages from main thread
 */
if (parentPort) {
  parentPort.on('message', async (message) => {
    const { taskId, type, data } = message;

    try {
      // Check if handler exists
      if (!taskHandlers[type]) {
        throw new Error(`Unknown task type: ${type}`);
      }

      // Execute the task
      const result = await taskHandlers[type](data);

      // Send result back to main thread
      parentPort.postMessage({
        taskId,
        data: result,
        workerId
      });

    } catch (error) {
      // Send error back to main thread
      parentPort.postMessage({
        taskId,
        error: error.message,
        stack: error.stack,
        workerId
      });
    }
  });

  // Handle worker errors
  process.on('uncaughtException', (error) => {
    console.error(`Worker ${workerId} uncaught exception:`, error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error(`Worker ${workerId} unhandled rejection at:`, promise, 'reason:', reason);
    process.exit(1);
  });

  // Signal that worker is ready
  parentPort.postMessage({
    type: 'ready',
    workerId
  });
}

export { taskHandlers };
