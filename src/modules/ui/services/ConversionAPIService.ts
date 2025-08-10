/**
 * ConversionAPIService
 *
 * This service provides an interface for frontend-backend communication
 * related to the conversion process.
 */

import { ConversionError } from '../../../types/errors.js';
import { ConversionProgress } from '../types.js';

/**
 * Input for starting a conversion
 */
export interface ConversionInput {
  /**
   * The mod file to convert
   */
  modFile: File;

  /**
   * Optional source repository URL
   */
  sourceRepo?: string;

  /**
   * User preferences for the conversion
   */
  preferences?: {
    compromiseStrategies?: {
      id: string;
      isEnabled: boolean;
      options?: Array<{
        id: string;
        value: any;
      }>;
    }[];
    conversionOptions?: {
      generateDebugInfo?: boolean;
      optimizeOutput?: boolean;
      includeComments?: boolean;
      targetMinecraftVersion?: string;
    };
  };
}

/**
 * Status of a conversion job
 */
export interface ConversionStatus {
  /**
   * Job ID
   */
  jobId: string;

  /**
   * Current status of the job
   */
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /**
   * Current progress of the conversion
   */
  progress: ConversionProgress;

  /**
   * Timestamp when the job was created
   */
  createdAt: Date;

  /**
   * Timestamp when the job was last updated
   */
  updatedAt: Date;
}

/**
 * Result of a conversion job
 */
export interface ConversionResult {
  /**
   * Job ID
   */
  jobId: string;

  /**
   * Whether the conversion was successful
   */
  success: boolean;

  /**
   * URL to download the converted addon
   */
  downloadUrl?: string;

  /**
   * URL to view the conversion report
   */
  reportUrl?: string;

  /**
   * Summary of errors encountered during conversion
   */
  errorSummary: {
    totalErrors: number;
    criticalErrors: number;
    errors: number;
    warnings: number;
    info: number;
  };

  /**
   * Most critical errors encountered during conversion
   */
  criticalErrors?: ConversionError[];
}

/**
 * Conversion job information
 */
export interface ConversionJob {
  /**
   * Job ID
   */
  jobId: string;

  /**
   * Estimated time to completion in seconds
   */
  estimatedTimeSeconds?: number;

  /**
   * Position in queue (if pending)
   */
  queuePosition?: number;
}

/**
 * Interface for the Conversion API Service
 */
export interface ConversionAPIService {
  /**
   * Start a new conversion
   *
   * @param input Conversion input
   * @returns Promise resolving to conversion job information
   */
  startConversion(input: ConversionInput): Promise<ConversionJob>;

  /**
   * Get the status of a conversion
   *
   * @param jobId Job ID
   * @returns Promise resolving to conversion status
   */
  getConversionStatus(jobId: string): Promise<ConversionStatus>;

  /**
   * Cancel a conversion
   *
   * @param jobId Job ID
   * @returns Promise resolving to boolean indicating success
   */
  cancelConversion(jobId: string): Promise<boolean>;

  /**
   * Get the result of a completed conversion
   *
   * @param jobId Job ID
   * @returns Promise resolving to conversion result
   */
  getConversionResult(jobId: string): Promise<ConversionResult>;
}
