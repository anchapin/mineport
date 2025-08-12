/**
 * Job-related type definitions for the JobQueue system
 */

/** Type of job being processed */
export type JobType = 'conversion' | 'validation' | 'analysis' | 'packaging';

/** Priority level for job processing */
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Current status of a job */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Progress information for a running job
 */
export interface JobProgress {
  /** Current processing stage description */
  stage: string;
  /** Completion percentage (0-100) */
  percentage: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  /** Detailed progress information */
  details: ProgressDetails;
}

/**
 * Detailed progress information for job execution
 */
export interface ProgressDetails {
  /** Description of the current processing step */
  currentStep: string;
  /** Total number of steps in the job */
  totalSteps: number;
  /** Number of completed steps */
  completedSteps: number;
  /** Processing rate (items per second) */
  processingRate?: number;
  /** Data throughput (bytes per second) */
  throughput?: number;
}

/**
 * Error information for failed jobs
 */
export interface JobError {
  /** Error code for categorization */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Stack trace if available */
  stack?: string;
  /** Additional error context */
  context?: Record<string, any>;
  /** Whether the error is recoverable with retry */
  recoverable: boolean;
}

export interface JobPayload {
  type: JobType;
  data: any;
  options: JobOptions;
}

export interface JobOptions {
  timeout: number;
  retryCount: number;
  maxRetries: number;
  notificationEndpoint?: string;
  priority: JobPriority;
  resourceRequirements: ResourceRequirements;
}

export interface ResourceRequirements {
  memory: number; // MB
  cpu: number; // CPU cores
  disk: number; // MB
  network?: boolean;
}

export interface Job {
  id: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  payload: JobPayload;
  progress: JobProgress;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: JobError;
  result?: any;
  resourceAllocation?: ResourceAllocation;
  retryCount: number;
  maxRetries: number;
}

export interface ResourceAllocation {
  memory: number;
  cpu: number;
  disk: number;
  workerId: string;
  allocatedAt: Date;
}

export interface JobData {
  type: JobType;
  priority: JobPriority;
  payload: any;
  options: JobOptions;
}

export interface JobStatusUpdate {
  jobId: string;
  status: JobStatus;
  progress?: JobProgress;
  error?: JobError;
  result?: any;
  timestamp: Date;
}

export interface WorkerInfo {
  id: string;
  status: 'idle' | 'busy' | 'error';
  currentJobId?: string;
  capabilities: JobType[];
  resourceCapacity: ResourceRequirements;
  resourceUsage: ResourceRequirements;
  lastHeartbeat: Date;
}

export interface QueueStats {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  queueLength: number;
  activeWorkers: number;
}
