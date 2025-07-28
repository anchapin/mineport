import { WorkerPool } from './WorkerPool';
import { JobQueue } from './JobQueue';
import { ConfigurationService } from './ConfigurationService';
import { createLogger } from '../utils/logger';

const logger = createLogger('ResourceAllocator');

/**
 * SystemResources interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface SystemResources {
  cpu: {
    total: number;
    available: number;
  };
  memory: {
    total: number; // in MB
    available: number; // in MB
  };
}

/**
 * ResourceAllocationStrategy interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface ResourceAllocationStrategy {
  name: string;
  /**
   * allocateResources method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  allocateResources(resources: SystemResources, jobQueue: JobQueue): number;
}

/**
 * ResourceAllocatorOptions interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface ResourceAllocatorOptions {
  workerPool: WorkerPool;
  jobQueue: JobQueue;
  configService?: ConfigurationService;
  checkInterval?: number; // milliseconds
  minWorkers?: number;
  maxWorkers?: number;
  strategyName?: string;
}

/**
 * ResourceAllocator service for managing system resources
 * Implements requirement 7.2: Process multiple conversion requests in parallel with resource awareness
 */
export class ResourceAllocator {
  private workerPool: WorkerPool;
  private jobQueue: JobQueue;
  private configService?: ConfigurationService;
  private checkInterval: number;
  private minWorkers: number;
  private maxWorkers: number;
  private intervalId?: NodeJS.Timeout;
  private strategy: ResourceAllocationStrategy;
  private strategies: Map<string, ResourceAllocationStrategy> = new Map();

  /**
   * constructor method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  constructor(options: ResourceAllocatorOptions) {
    this.workerPool = options.workerPool;
    this.jobQueue = options.jobQueue;
    this.configService = options.configService;
    
    // Register available strategies
    this.registerStrategies();
    
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.configService) {
      // Use configuration service if available
      this.checkInterval = this.configService.get('resources.checkInterval', options.checkInterval || 30000);
      this.minWorkers = this.configService.get('resources.minWorkers', options.minWorkers || 1);
      this.maxWorkers = this.configService.get('resources.maxWorkers', options.maxWorkers || 10);
      
      // Get strategy from configuration or options
      const strategyName = this.configService.get('resources.strategy', options.strategyName || 'adaptive');
      this.strategy = this.getStrategy(strategyName);
      
      // Listen for configuration changes
      this.configService.on('config:updated', this.handleConfigUpdate.bind(this));
      
      logger.info('ResourceAllocator initialized with ConfigurationService', {
        checkInterval: this.checkInterval,
        minWorkers: this.minWorkers,
        maxWorkers: this.maxWorkers,
        strategy: this.strategy.name
      });
    } else {
      // Use provided options or defaults
      this.checkInterval = options.checkInterval || 30000; // 30 seconds default
      this.minWorkers = options.minWorkers || 1;
      this.maxWorkers = options.maxWorkers || 10;
      
      // Default strategy
      this.strategy = this.getStrategy(options.strategyName || 'adaptive');
      
      logger.info('ResourceAllocator initialized with default options', {
        checkInterval: this.checkInterval,
        minWorkers: this.minWorkers,
        maxWorkers: this.maxWorkers,
        strategy: this.strategy.name
      });
    }
  }
  
  /**
   * Register available allocation strategies
   */
  private registerStrategies(): void {
    this.strategies.set('adaptive', new AdaptiveAllocationStrategy());
    this.strategies.set('conservative', new ConservativeAllocationStrategy());
    this.strategies.set('aggressive', new AggressiveAllocationStrategy());
  }
  
  /**
   * Get a strategy by name
   */
  private getStrategy(name: string): ResourceAllocationStrategy {
    const strategy = this.strategies.get(name.toLowerCase());
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!strategy) {
      logger.warn(`Strategy "${name}" not found, using adaptive strategy`);
      return this.strategies.get('adaptive')!;
    }
    return strategy;
  }
  
  /**
   * Handle configuration updates
   */
  private handleConfigUpdate(update: { key: string; value: any }): void {
    /**
     * switch method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    switch (update.key) {
      case 'resources.checkInterval':
        this.checkInterval = update.value;
        logger.info('Updated checkInterval from configuration', { checkInterval: this.checkInterval });
        
        // Restart interval if running
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (this.intervalId) {
          this.stop();
          this.start();
        }
        break;
        
      case 'resources.minWorkers':
        this.minWorkers = update.value;
        logger.info('Updated minWorkers from configuration', { minWorkers: this.minWorkers });
        this.allocateResources();
        break;
        
      case 'resources.maxWorkers':
        this.maxWorkers = update.value;
        logger.info('Updated maxWorkers from configuration', { maxWorkers: this.maxWorkers });
        this.allocateResources();
        break;
        
      case 'resources.strategy':
        this.strategy = this.getStrategy(update.value);
        logger.info('Updated strategy from configuration', { strategy: this.strategy.name });
        this.allocateResources();
        break;
    }
  }

  /**
   * Start the resource allocator
   */
  public start(): void {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.intervalId) return;
    
    // Initial allocation
    this.allocateResources();
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.allocateResources();
    }, this.checkInterval);
  }

  /**
   * Stop the resource allocator
   */
  public stop(): void {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.intervalId) {
      /**
       * clearInterval method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Set the resource allocation strategy
   */
  public setStrategy(strategy: ResourceAllocationStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Allocate resources based on current system state and job queue
   */
  private allocateResources(): void {
    // Get current system resources
    const resources = this.getCurrentSystemResources();
    
    // Use strategy to determine optimal worker count
    const optimalWorkerCount = this.strategy.allocateResources(resources, this.jobQueue);
    
    // Apply constraints
    const targetWorkerCount = Math.max(
      this.minWorkers,
      Math.min(this.maxWorkers, optimalWorkerCount)
    );
    
    // Scale the worker pool
    this.workerPool.scalePool(targetWorkerCount);
  }

  /**
   * Get current system resources
   * In a real implementation, this would use OS-level metrics
   */
  private getCurrentSystemResources(): SystemResources {
    // This is a simplified implementation
    // In a real system, we would use something like node-os-utils or similar
    
    try {
      // Simulate getting system resources
      // In production, use actual system metrics
      const totalMemory = 16384; // 16GB in MB
      const totalCPU = 8; // 8 cores
      
      // Simulate variable resource usage
      const memoryUsagePercent = Math.random() * 0.5 + 0.2; // 20-70%
      const cpuUsagePercent = Math.random() * 0.6 + 0.1; // 10-70%
      
      return {
        cpu: {
          total: totalCPU,
          available: totalCPU * (1 - cpuUsagePercent),
        },
        memory: {
          total: totalMemory,
          available: totalMemory * (1 - memoryUsagePercent),
        },
      };
    } catch (error) {
      // Fallback to conservative estimates if we can't get actual metrics
      return {
        cpu: {
          total: 4,
          available: 2,
        },
        memory: {
          total: 8192, // 8GB
          available: 4096, // 4GB
        },
      };
    }
  }
}

/**
 * Adaptive allocation strategy that considers both system resources and job queue
 */
export class AdaptiveAllocationStrategy implements ResourceAllocationStrategy {
  name = 'adaptive';
  
  /**
   * allocateResources method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  allocateResources(resources: SystemResources, jobQueue: JobQueue): number {
    // Get job queue stats
    const queueStats = jobQueue.getStats();
    
    // Base worker count on available CPU cores
    const basedOnCPU = Math.floor(resources.cpu.available);
    
    // Consider pending jobs in queue
    const queueFactor = Math.min(3, Math.ceil(queueStats.pending / 5));
    
    // Consider memory constraints (each worker might need ~500MB)
    const memoryLimitedWorkers = Math.floor(resources.memory.available / 500);
    
    // Calculate target worker count
    const targetWorkers = Math.min(
      basedOnCPU + queueFactor,
      memoryLimitedWorkers
    );
    
    return targetWorkers;
  }
}

/**
 * Conservative allocation strategy that prioritizes system stability
 */
export class ConservativeAllocationStrategy implements ResourceAllocationStrategy {
  name = 'conservative';
  
  /**
   * allocateResources method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  allocateResources(resources: SystemResources, jobQueue: JobQueue): number {
    // Use at most 50% of available CPU
    const maxWorkers = Math.floor(resources.cpu.available * 0.5);
    
    // Ensure we have at least 2GB free memory per worker
    const memoryConstrainedWorkers = Math.floor(resources.memory.available / 2048);
    
    return Math.min(maxWorkers, memoryConstrainedWorkers);
  }
}

/**
 * Aggressive allocation strategy that prioritizes throughput
 */
export class AggressiveAllocationStrategy implements ResourceAllocationStrategy {
  name = 'aggressive';
  
  /**
   * allocateResources method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  allocateResources(resources: SystemResources, jobQueue: JobQueue): number {
    // Use up to 90% of available CPU
    const maxWorkers = Math.floor(resources.cpu.available * 0.9);
    
    // Ensure we have at least 1GB free memory per worker
    const memoryConstrainedWorkers = Math.floor(resources.memory.available / 1024);
    
    return Math.min(maxWorkers, memoryConstrainedWorkers);
  }
}