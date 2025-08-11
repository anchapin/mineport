/**
 * Job-related type definitions for the JobQueue system
 */

export type JobType = 'conversion' | 'validation' | 'analysis' | 'packaging';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  stage: string;
  percentage: number;
  estimatedTimeRemaining?: number;
  details: ProgressDetails;
}

export interface ProgressDetails {
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  processingRate?: number;
  throughput?: number;
}

export interface JobError {
  code: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
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
