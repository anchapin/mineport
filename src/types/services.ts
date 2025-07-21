/**
 * Service-related type definitions
 * 
 * This file contains interfaces related to application services
 * like job queues, resource allocation, and caching.
 */

/**
 * Job status types
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Interface for conversion job
 * 
 * This interface represents a job in the conversion queue.
 */
export interface ConversionJob {
  id: string;
  input: ConversionInput;
  status: JobStatus;
  progress: number;
  priority?: number;
  result?: ConversionResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Interface for conversion input
 */
export interface ConversionInput {
  modFile: string;
  outputPath: string;
  options: ConversionOptions;
}

/**
 * Interface for conversion options
 */
export interface ConversionOptions {
  targetMinecraftVersion: string;
  compromiseStrategy: 'conservative' | 'balanced' | 'aggressive';
  includeDocumentation: boolean;
  optimizeAssets: boolean;
  customMappings?: Record<string, string>;
}

/**
 * Interface for conversion status
 */
export interface ConversionStatus {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentStage?: string;
  stageProgress?: number;
  estimatedTimeRemaining?: number;
}

/**
 * Interface for conversion result
 */
export interface ConversionResult {
  jobId: string;
  bedrockAddon: {
    resourcePack: string;
    behaviorPack: string;
  };
  report: any;
  errors: any[];
  warnings: any[];
}

/**
 * Interface for conversion orchestrator
 * 
 * This interface aligns with the design document's ConversionOrchestrator specification.
 */
export interface ConversionOrchestrator {
  queueConversion(input: any): Promise<string>; // Returns job ID
  processNextJob(): Promise<void>;
  getJobStatus(jobId: string): JobStatus;
  cancelJob(jobId: string): Promise<boolean>;
}

/**
 * Interface for conversion service
 * 
 * This service connects the JobQueue with the conversion pipeline components,
 * providing job creation, tracking, and management capabilities.
 */
export interface ConversionService {
  /**
   * Start the conversion service
   */
  start(): void;
  
  /**
   * Stop the conversion service
   */
  stop(): void;
  
  /**
   * Create a new conversion job
   * 
   * @param input Conversion input
   * @returns Created conversion job
   */
  createConversionJob(input: ConversionInput): ConversionJob;
  
  /**
   * Get the status of a conversion job
   * 
   * @param jobId Job ID
   * @returns Conversion status or undefined if job not found
   */
  getJobStatus(jobId: string): ConversionStatus | undefined;
  
  /**
   * Get all conversion jobs with optional filtering
   * 
   * @param filter Optional filter criteria
   * @returns Array of conversion jobs
   */
  getJobs(filter?: { status?: JobStatus }): ConversionJob[];
  
  /**
   * Cancel a conversion job
   * 
   * @param jobId Job ID
   * @returns True if job was cancelled, false otherwise
   */
  cancelJob(jobId: string): boolean;
  
  /**
   * Get the result of a completed conversion job
   * 
   * @param jobId Job ID
   * @returns Conversion result or undefined if job not found or not completed
   */
  getJobResult(jobId: string): ConversionResult | undefined;
  
  /**
   * Update job priority
   * 
   * @param jobId Job ID
   * @param priority New priority (higher number = higher priority)
   * @returns True if job priority was updated, false otherwise
   */
  updateJobPriority(jobId: string, priority: number): boolean;
}