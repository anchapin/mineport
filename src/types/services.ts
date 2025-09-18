/**
 * Service-related type definitions
 *
 * This file contains interfaces and types related to application services
 * including job queues, resource allocation, caching, and conversion orchestration.
 * These types define the contracts between different service components.
 *
 * @since 1.0.0
 */

/**
 * Job status enumeration representing the lifecycle states of a conversion job.
 *
 * - pending: Job is queued but not yet started
 * - processing: Job is currently being processed
 * - completed: Job finished successfully
 * - failed: Job encountered an error and failed
 * - cancelled: Job was cancelled by user or system
 *
 * @since 1.0.0
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Represents a conversion job in the system.
 *
 * This interface defines the structure of a conversion job, including its
 * input parameters, current status, progress tracking, and results.
 *
 * @since 1.0.0
 */
export interface ConversionJob {
  /** Unique identifier for the job */
  id: string;
  /** Input parameters for the conversion */
  input: ConversionInput;
  /** Current status of the job */
  status: JobStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Job priority (higher number = higher priority) */
  priority?: number;
  /** Conversion result (available when status is 'completed') */
  result?: ConversionResult;
  /** Error message (available when status is 'failed') */
  error?: string;
  /** Timestamp when job was created */
  createdAt: Date;
  /** Timestamp when job was last updated */
  updatedAt: Date;
  /** Timestamp when job was completed (success or failure) */
  completedAt?: Date;
}

/**
 * Input parameters for a conversion job.
 *
 * Defines the required information to start a mod conversion process,
 * including source file, output location, and conversion options.
 *
 * @since 1.0.0
 */
export interface ConversionInput {
  /** Path to the Java mod file to convert or Buffer containing the mod file */
  modFile: string | Buffer;
  /** Output directory for the converted Bedrock addon */
  outputPath: string;
  /** Configuration options for the conversion process */
  options: ConversionOptions;
}

/**
 * Configuration options for the conversion process.
 *
 * These options control various aspects of how the conversion is performed,
 * including target version, compromise strategies, and optimization settings.
 *
 * @since 1.0.0
 */
export interface ConversionOptions {
  /** Target Minecraft Bedrock version for the conversion */
  targetMinecraftVersion: string;
  /** Strategy for handling unmappable features */
  compromiseStrategy?: 'conservative' | 'balanced' | 'aggressive';
  /** Whether to include documentation in the output */
  includeDocumentation: boolean;
  /** Whether to optimize assets during conversion */
  optimizeAssets: boolean;
  /** Custom API mappings to override defaults */
  customMappings?: Record<string, string>;
  
  // Enhanced conversion options
  /** Enable enhanced security scanning */
  enableSecurityScanning?: boolean;
  /** Maximum file size for processing (MB) */
  maxFileSize?: number;
  /** Enable bytecode analysis */
  enableBytecodeAnalysis?: boolean;
  /** Analysis timeout in seconds */
  analysisTimeout?: number;
  /** Enable specialized asset converter agent */
  enableAssetConverter?: boolean;
  /** Enable specialized bedrock architect agent */
  enableBedrockArchitect?: boolean;
  /** Enable specialized block item generator agent */
  enableBlockItemGenerator?: boolean;
  /** Enable strict validation mode */
  enableStrictValidation?: boolean;
  /** Validation timeout in seconds */
  validationTimeout?: number;
  /** Enable debug mode with detailed logging */
  enableDebugMode?: boolean;
  /** Preserve intermediate files for debugging */
  preserveIntermediateFiles?: boolean;
  /** Number of worker threads to use */
  workerThreads?: number;
  /** Enable caching for improved performance */
  enableCaching?: boolean;
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
  currentTask?: string;
  metadata?: Record<string, any>;
}

/**
 * Interface for conversion result
 */
export interface ConversionResult {
  jobId: string;
  success: boolean;
  result?: {
    modId: string;
    manifestInfo: {
      modId: string;
      modName: string;
      version: string;
      author: string;
    };
    registryNames: string[];
    texturePaths: string[];
    analysisNotes: Array<{
      type: 'info' | 'warning' | 'error';
      message: string;
    }>;
    bedrockAddon: {
      resourcePack: string;
      behaviorPack: string;
    };
    report: any;
    convertedFiles?: any[];
    [key: string]: any;
  };
  bedrockAddon?: {
    resourcePack: string;
    behaviorPack: string;
  };
  validation?: {
    isValid: boolean;
    errors: any[];
    warnings: any[];
  };
  errors: any[];
  warnings: any[];
  
  // Enhanced result properties
  outputPath?: string;
  downloadUrl?: string;
  summary?: string;
  compromises?: any[];
  recommendations?: string[];
  statistics?: {
    filesProcessed: number;
    assetsConverted: number;
    codeTranslated: number;
    configurationsMapped: number;
    processingTime: number;
  };
  validationResults?: {
    passed: boolean;
    stages: Array<{
      name: string;
      passed: boolean;
      errors: string[];
      warnings: string[];
    }>;
  };
}

/**
 * Interface for conversion orchestrator
 *
 * This interface aligns with the design document's ConversionOrchestrator specification.
 */
export interface ConversionOrchestrator {
  /**
   * queueConversion method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  queueConversion(input: any): Promise<string>; // Returns job ID
  /**
   * processNextJob method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  processNextJob(): Promise<void>;
  /**
   * getJobStatus method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getJobStatus(jobId: string): JobStatus;
  /**
   * cancelJob method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
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
  createConversionJob(input: ConversionInput): Promise<ConversionJob>;

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
