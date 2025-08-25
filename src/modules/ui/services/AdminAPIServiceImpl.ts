/**
 * Implementation of the AdminAPIService
 *
 * This service provides the actual implementation for admin-specific API operations
 * related to job monitoring and management.
 *
 * Implements requirements:
 * - 7.2: Process multiple conversion requests in parallel
 * - 7.4: Provide real-time status updates for conversion jobs
 * - 7.5: Provide comprehensive error reporting
 */

import {
  AdminAPIService,
  AdminJobFilter,
  JobStatistics,
  SystemResourceUsage,
} from './AdminAPIService.js';
import { ConversionJob } from '../../../types/services.js';
import { APIError } from './ConversionAPIServiceImpl.js';

/**
 * Configuration for the AdminAPIService
 */
interface AdminAPIServiceConfig {
  /**
   * Base URL for API endpoints
   */
  baseUrl: string;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Whether to use mock data for development
   */
  useMockData?: boolean;
}

/**
 * Implementation of the AdminAPIService
 */
export class AdminAPIServiceImpl implements AdminAPIService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly useMockData: boolean;

  /**
   * Creates a new instance of the AdminAPIServiceImpl
   *
   * @param config Service configuration
   */
  constructor(config: AdminAPIServiceConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 30000; // Default timeout: 30 seconds
    this.useMockData = config.useMockData || false;
  }

  /**
   * Get all jobs with optional filtering
   *
   * @param filter Optional filter criteria
   * @returns Promise resolving to array of jobs
   */
  public async getJobs(filter?: AdminJobFilter): Promise<ConversionJob[]> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.useMockData) {
      return this.mockGetJobs(filter);
    }

    try {
      // Build query string from filter
      const queryParams = new URLSearchParams();

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter?.status) {
        queryParams.append('status', filter.status);
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter?.type) {
        queryParams.append('type', filter.type);
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter?.createdAfter) {
        queryParams.append('createdAfter', filter.createdAfter.toISOString());
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter?.createdBefore) {
        queryParams.append('createdBefore', filter.createdBefore.toISOString());
      }

      const queryString = queryParams.toString();
      const url = `${this.baseUrl}/api/admin/jobs${queryString ? `?${queryString}` : ''}`;

      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.message || 'Failed to get jobs',
          response.status,
          errorData.code || 'UNKNOWN_ERROR'
        );
      }

      return await response.json();
    } catch (error) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        error instanceof Error ? error.message : 'Failed to get jobs',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Get job statistics
   *
   * @returns Promise resolving to job statistics
   */
  public async getJobStatistics(): Promise<JobStatistics> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.useMockData) {
      return this.mockGetJobStatistics();
    }

    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/admin/jobs/statistics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.message || 'Failed to get job statistics',
          response.status,
          errorData.code || 'UNKNOWN_ERROR'
        );
      }

      return await response.json();
    } catch (error) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        error instanceof Error ? error.message : 'Failed to get job statistics',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Get system resource usage
   *
   * @returns Promise resolving to system resource usage
   */
  public async getSystemResourceUsage(): Promise<SystemResourceUsage> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.useMockData) {
      return this.mockGetSystemResourceUsage();
    }

    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/admin/system/resources`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.message || 'Failed to get system resource usage',
          response.status,
          errorData.code || 'UNKNOWN_ERROR'
        );
      }

      return await response.json();
    } catch (error) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        error instanceof Error ? error.message : 'Failed to get system resource usage',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Update job priority
   *
   * @param jobId Job ID
   * @param priority New priority (higher number = higher priority)
   * @returns Promise resolving to boolean indicating success
   */
  public async updateJobPriority(jobId: string, priority: number): Promise<boolean> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.useMockData) {
      return this.mockUpdateJobPriority(jobId, priority);
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/admin/jobs/${jobId}/priority`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ priority }),
        }
      );

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.message || 'Failed to update job priority',
          response.status,
          errorData.code || 'UNKNOWN_ERROR'
        );
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        error instanceof Error ? error.message : 'Failed to update job priority',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Cancel a job
   *
   * @param jobId Job ID
   * @returns Promise resolving to boolean indicating success
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.useMockData) {
      return this.mockCancelJob(jobId);
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/admin/jobs/${jobId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.message || 'Failed to cancel job',
          response.status,
          errorData.code || 'UNKNOWN_ERROR'
        );
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        error instanceof Error ? error.message : 'Failed to cancel job',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Fetch with timeout
   *
   * @param url URL to fetch
   * @param options Fetch options
   * @returns Promise resolving to fetch response
   */
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      return response;
    } finally {
      /**
       * clearTimeout method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      clearTimeout(timeoutId);
    }
  }

  // Mock implementations for development

  /**
   * Mock implementation of getJobs
   *
   * @param filter Optional filter criteria
   * @returns Promise resolving to mock jobs
   */
  private async mockGetJobs(filter?: AdminJobFilter): Promise<ConversionJob[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Generate mock jobs
    const mockJobs: ConversionJob[] = [
      {
        id: 'job_1',
        input: {
          modFile: 'test-mod.jar',
          outputPath: '/output',
          options: {
            targetMinecraftVersion: '1.19',
            compromiseStrategy: 'balanced',
            includeDocumentation: true,
            optimizeAssets: true,
          },
        },
        status: 'pending',
        progress: 0,
        priority: 1,
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        updatedAt: new Date(Date.now() - 3600000),
      },
      {
        id: 'job_2',
        input: {
          modFile: 'another-mod.jar',
          outputPath: '/output',
          options: {
            targetMinecraftVersion: '1.19',
            compromiseStrategy: 'balanced',
            includeDocumentation: true,
            optimizeAssets: true,
          },
        },
        status: 'processing',
        progress: 45,
        priority: 2,
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
        updatedAt: new Date(Date.now() - 3600000),
      },
      {
        id: 'job_3',
        input: {
          modFile: 'completed-mod.jar',
          outputPath: '/output',
          options: {
            targetMinecraftVersion: '1.19',
            compromiseStrategy: 'balanced',
            includeDocumentation: true,
            optimizeAssets: true,
          },
        },
        status: 'completed',
        progress: 100,
        priority: 1,
        createdAt: new Date(Date.now() - 10800000), // 3 hours ago
        updatedAt: new Date(Date.now() - 9000000),
        completedAt: new Date(Date.now() - 9000000),
      },
      {
        id: 'job_4',
        input: {
          modFile: 'failed-mod.jar',
          outputPath: '/output',
          options: {
            targetMinecraftVersion: '1.19',
            compromiseStrategy: 'balanced',
            includeDocumentation: true,
            optimizeAssets: true,
          },
        },
        status: 'failed',
        progress: 75,
        priority: 1,
        error: 'Failed to convert mod: incompatible features detected',
        createdAt: new Date(Date.now() - 14400000), // 4 hours ago
        updatedAt: new Date(Date.now() - 12600000),
        completedAt: new Date(Date.now() - 12600000),
      },
      {
        id: 'job_5',
        input: {
          modFile: 'cancelled-mod.jar',
          outputPath: '/output',
          options: {
            targetMinecraftVersion: '1.19',
            compromiseStrategy: 'balanced',
            includeDocumentation: true,
            optimizeAssets: true,
          },
        },
        status: 'cancelled',
        progress: 30,
        priority: 1,
        createdAt: new Date(Date.now() - 18000000), // 5 hours ago
        updatedAt: new Date(Date.now() - 17100000),
        completedAt: new Date(Date.now() - 17100000),
      },
    ];

    // Apply filters if provided
    let filteredJobs = [...mockJobs];

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (filter?.status) {
      filteredJobs = filteredJobs.filter((job) => job.status === filter.status);
    }

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (filter?.createdAfter) {
      filteredJobs = filteredJobs.filter((job) => job.createdAt >= filter.createdAfter!);
    }

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (filter?.createdBefore) {
      filteredJobs = filteredJobs.filter((job) => job.createdAt <= filter.createdBefore!);
    }

    return filteredJobs;
  }

  /**
   * Mock implementation of getJobStatistics
   *
   * @returns Promise resolving to mock job statistics
   */
  private async mockGetJobStatistics(): Promise<JobStatistics> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      total: 5,
      pending: 1,
      processing: 1,
      completed: 1,
      failed: 1,
      cancelled: 1,
      averageProcessingTime: 120,
      successRate: 0.6,
    };
  }

  /**
   * Mock implementation of getSystemResourceUsage
   *
   * @returns Promise resolving to mock system resource usage
   */
  private async mockGetSystemResourceUsage(): Promise<SystemResourceUsage> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      cpuUsage: 45,
      memoryUsage: 1024,
      diskUsage: 5120,
    };
  }

  /**
   * Mock implementation of updateJobPriority
   *
   * @param jobId Job ID
   * @param priority New priority
   * @returns Promise resolving to mock update result
   */
  private async mockUpdateJobPriority(jobId: string, priority: number): Promise<boolean> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Validate priority
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (priority < 1 || priority > 10) {
      throw new APIError('Invalid priority value', 400, 'INVALID_PRIORITY');
    }

    // Always succeed in mock mode
    return true;
  }

  /**
   * Mock implementation of cancelJob
   *
   * @param jobId Job ID
   * @returns Promise resolving to mock cancel result
   */
  private async mockCancelJob(_jobId: string): Promise<boolean> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Always succeed in mock mode
    return true;
  }
}
