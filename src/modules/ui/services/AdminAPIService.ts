/**
 * AdminAPIService
 * 
 * This service provides an interface for admin-specific API operations
 * related to job monitoring and management.
 * 
 * Implements requirements:
 * - 7.2: Process multiple conversion requests in parallel
 * - 7.4: Provide real-time status updates for conversion jobs
 * - 7.5: Provide comprehensive error reporting
 */

import { ConversionJob, JobStatus } from '../../../types/services';

/**
 * Admin job filter options
 */
export interface AdminJobFilter {
  /**
   * Filter by job status
   */
  status?: JobStatus;
  
  /**
   * Filter by job type
   */
  type?: string;
  
  /**
   * Filter by creation date range
   */
  createdAfter?: Date;
  
  /**
   * Filter by creation date range
   */
  createdBefore?: Date;
}

/**
 * Job statistics
 */
export interface JobStatistics {
  /**
   * Total number of jobs
   */
  total: number;
  
  /**
   * Number of pending jobs
   */
  pending: number;
  
  /**
   * Number of processing jobs
   */
  processing: number;
  
  /**
   * Number of completed jobs
   */
  completed: number;
  
  /**
   * Number of failed jobs
   */
  failed: number;
  
  /**
   * Number of cancelled jobs
   */
  cancelled: number;
  
  /**
   * Average processing time in seconds
   */
  averageProcessingTime?: number;
  
  /**
   * Success rate (0-1)
   */
  successRate?: number;
}

/**
 * System resource usage
 */
export interface SystemResourceUsage {
  /**
   * CPU usage percentage
   */
  cpuUsage: number;
  
  /**
   * Memory usage in MB
   */
  memoryUsage: number;
  
  /**
   * Disk usage in MB
   */
  diskUsage: number;
}

/**
 * Interface for the Admin API Service
 */
export interface AdminAPIService {
  /**
   * Get all jobs with optional filtering
   * 
   * @param filter Optional filter criteria
   * @returns Promise resolving to array of jobs
   */
  getJobs(filter?: AdminJobFilter): Promise<ConversionJob[]>;
  
  /**
   * Get job statistics
   * 
   * @returns Promise resolving to job statistics
   */
  getJobStatistics(): Promise<JobStatistics>;
  
  /**
   * Get system resource usage
   * 
   * @returns Promise resolving to system resource usage
   */
  getSystemResourceUsage(): Promise<SystemResourceUsage>;
  
  /**
   * Update job priority
   * 
   * @param jobId Job ID
   * @param priority New priority (higher number = higher priority)
   * @returns Promise resolving to boolean indicating success
   */
  updateJobPriority(jobId: string, priority: number): Promise<boolean>;
  
  /**
   * Cancel a job
   * 
   * @param jobId Job ID
   * @returns Promise resolving to boolean indicating success
   */
  cancelJob(jobId: string): Promise<boolean>;
}