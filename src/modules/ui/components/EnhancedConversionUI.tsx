/**
 * Enhanced Conversion UI Component
 *
 * This component provides the main interface for the enhanced conversion system,
 * integrating with the ModPorter-AI backend services to provide real-time progress
 * tracking, detailed error reporting, and comprehensive result display.
 *
 * Features:
 * - Real-time progress tracking using enhanced ValidationPipeline stages
 * - Integration with EnhancedErrorCollector for detailed error feedback
 * - Configuration UI for specialized conversion agents
 * - WebSocket connections for real-time job status updates
 * - Comprehensive result display with analysis and validation results
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConversionService } from '../../../services/ConversionService.js';
import { ValidationPipeline } from '../../../services/ValidationPipeline.js';
import { EnhancedErrorCollector } from '../../../services/EnhancedErrorCollector.js';
import { FeatureFlagService } from '../../../services/FeatureFlagService.js';
import {
  ConversionInput,
  ConversionOptions,
  ConversionStatus,
  ConversionResult,
  JobStatus,
} from '../../../types/services.js';
import {
  EnhancedConversionError,
  SystemHealthStatus,
  ErrorRateMetrics,
} from '../../../types/errors.js';
import { FileUploader } from './FileUploader.js';
import { EnhancedProgressTracker } from './EnhancedProgressTracker.js';
import { EnhancedStatusDisplay } from './EnhancedStatusDisplay.js';
import { ErrorDisplay } from './ErrorDisplay.js';
import { ResultsDisplay } from './ResultsDisplay.js';
import { ConversionConfigPanel } from './ConversionConfigPanel.js';
import { SystemHealthPanel } from './SystemHealthPanel.js';

/**
 * Enhanced conversion UI state
 */
export interface EnhancedConversionUIState {
  currentStage: ConversionStage;
  progress: ProgressInfo;
  errors: UIError[];
  warnings: UIWarning[];
  results?: ConversionResults;
  systemHealth?: SystemHealthStatus;
  errorMetrics?: ErrorRateMetrics;
}

/**
 * Conversion stage information
 */
export interface ConversionStage {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  details: StageDetails;
}

/**
 * Progress information
 */
export interface ProgressInfo {
  overall: number;
  stages: ConversionStage[];
  currentStage?: string;
  estimatedTimeRemaining?: number;
  startTime?: Date;
}

/**
 * Stage details
 */
export interface StageDetails {
  description: string;
  currentTask?: string;
  subTasks?: Array<{
    name: string;
    completed: boolean;
    progress?: number;
  }>;
  metadata?: Record<string, any>;
}

/**
 * UI Error representation
 */
export interface UIError {
  id: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  module: string;
  recoverable: boolean;
  timestamp: Date;
  details?: any;
}

/**
 * UI Warning representation
 */
export interface UIWarning {
  id: string;
  message: string;
  module: string;
  timestamp: Date;
  suggestion?: string;
}

/**
 * Conversion results
 */
export interface ConversionResults {
  success: boolean;
  outputPath?: string;
  downloadUrl?: string;
  report: ConversionReport;
  statistics: ConversionStatistics;
  validationResults: ValidationResults;
}

/**
 * Conversion report
 */
export interface ConversionReport {
  summary: string;
  compromises: CompromiseInfo[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Conversion statistics
 */
export interface ConversionStatistics {
  filesProcessed: number;
  assetsConverted: number;
  codeTranslated: number;
  configurationsMapped: number;
  processingTime: number;
}

/**
 * Validation results
 */
export interface ValidationResults {
  passed: boolean;
  stages: Array<{
    name: string;
    passed: boolean;
    errors: string[];
    warnings: string[];
  }>;
}

/**
 * Compromise information
 */
export interface CompromiseInfo {
  feature: string;
  strategy: string;
  description: string;
  impact: string;
}

/**
 * Component props
 */
export interface EnhancedConversionUIProps {
  conversionService: ConversionService;
  validationPipeline: ValidationPipeline;
  errorCollector: EnhancedErrorCollector;
  featureFlagService: FeatureFlagService;
  onConversionComplete?: (result: ConversionResults) => void;
  onError?: (error: Error) => void;
}

/**
 * Enhanced Conversion UI Component
 */
export const EnhancedConversionUI: React.FC<EnhancedConversionUIProps> = ({
  conversionService,
  validationPipeline,
  errorCollector,
  featureFlagService,
  onConversionComplete,
  onError,
}) => {
  // State management
  const [uiState, setUIState] = useState<EnhancedConversionUIState>({
    currentStage: {
      name: 'idle',
      status: 'pending',
      progress: 0,
      details: { description: 'Ready to start conversion' },
    },
    progress: {
      overall: 0,
      stages: [],
    },
    errors: [],
    warnings: [],
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [conversionOptions, setConversionOptions] = useState<ConversionOptions & Record<string, any>>({
    targetMinecraftVersion: '1.20.0',
    compromiseStrategy: 'balanced' as const,
    includeDocumentation: true,
    optimizeAssets: true,
    enableDebugMode: false,
  });
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket connection for real-time updates
  const wsRef = useRef<WebSocket | null>(null);
  const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize WebSocket connection for real-time updates
   */
  const initializeWebSocket = useCallback(() => {
    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws';
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            initializeWebSocket();
          }
        }, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  /**
   * Handle WebSocket messages
   */
  const handleWebSocketMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case 'job_progress':
          if (data.jobId === currentJobId) {
            updateProgressFromJobStatus(data.status);
          }
          break;

        case 'job_completed':
          if (data.jobId === currentJobId) {
            handleJobCompleted(data.result);
          }
          break;

        case 'job_failed':
          if (data.jobId === currentJobId) {
            handleJobFailed(data.error);
          }
          break;

        case 'system_health':
          updateSystemHealth(data.health);
          break;

        default:
          console.log('Unknown WebSocket message type:', data.type);
      }
    },
    [currentJobId]
  );

  /**
   * Start status polling as fallback when WebSocket is not available
   */
  const startStatusPolling = useCallback(() => {
    if (statusUpdateIntervalRef.current) {
      clearInterval(statusUpdateIntervalRef.current);
    }

    statusUpdateIntervalRef.current = setInterval(async () => {
      if (currentJobId && !isConnected) {
        try {
          const status = conversionService.getJobStatus(currentJobId);
          if (status) {
            updateProgressFromJobStatus(status);
          }
        } catch (error) {
          console.error('Failed to poll job status:', error);
        }
      }
    }, 2000); // Poll every 2 seconds
  }, [currentJobId, isConnected, conversionService]);

  /**
   * Stop status polling
   */
  const stopStatusPolling = useCallback(() => {
    if (statusUpdateIntervalRef.current) {
      clearInterval(statusUpdateIntervalRef.current);
      statusUpdateIntervalRef.current = null;
    }
  }, []);

  /**
   * Update progress from job status
   */
  const updateProgressFromJobStatus = useCallback((status: ConversionStatus & Record<string, any>) => {
    setUIState((prevState) => ({
      ...prevState,
      currentStage: {
        name: status.currentStage || 'processing',
        status:
          status.status === 'completed'
            ? 'completed'
            : status.status === 'failed'
              ? 'failed'
              : 'running',
        progress: status.progress || 0,
        details: {
          description: getStageDescription(status.currentStage || 'processing'),
          currentTask: status.currentTask,
          metadata: status.metadata,
        },
      },
      progress: {
        ...prevState.progress,
        overall: status.progress || 0,
        currentStage: status.currentStage,
        estimatedTimeRemaining: status.estimatedTimeRemaining,
      },
    }));
  }, []);

  /**
   * Handle job completion
   */
  const handleJobCompleted = useCallback(
    (result: ConversionResult & Record<string, any>) => {
      const conversionResults: ConversionResults = {
        success: true,
        outputPath: result.outputPath,
        downloadUrl: result.downloadUrl,
        report: {
          summary: result.summary || 'Conversion completed successfully',
          compromises: result.compromises || [],
          warnings: result.warnings || [],
          recommendations: result.recommendations || [],
        },
        statistics: {
          filesProcessed: result.statistics?.filesProcessed || 0,
          assetsConverted: result.statistics?.assetsConverted || 0,
          codeTranslated: result.statistics?.codeTranslated || 0,
          configurationsMapped: result.statistics?.configurationsMapped || 0,
          processingTime: result.statistics?.processingTime || 0,
        },
        validationResults: {
          passed: result.validationResults?.passed || false,
          stages: result.validationResults?.stages || [],
        },
      };

      setUIState((prevState) => ({
        ...prevState,
        currentStage: {
          name: 'completed',
          status: 'completed',
          progress: 100,
          details: { description: 'Conversion completed successfully' },
        },
        progress: {
          ...prevState.progress,
          overall: 100,
        },
        results: conversionResults,
      }));

      stopStatusPolling();

      if (onConversionComplete) {
        onConversionComplete(conversionResults);
      }
    },
    [onConversionComplete, stopStatusPolling]
  );

  /**
   * Handle job failure
   */
  const handleJobFailed = useCallback(
    (error: any) => {
      const uiError: UIError = {
        id: `job_error_${Date.now()}`,
        message: error.message || 'Conversion failed',
        severity: 'critical',
        module: error.module || 'CONVERSION',
        recoverable: error.recoverable || false,
        timestamp: new Date(),
        details: error.details,
      };

      setUIState((prevState) => ({
        ...prevState,
        currentStage: {
          name: 'failed',
          status: 'failed',
          progress: prevState.progress.overall,
          details: {
            description: 'Conversion failed',
            currentTask: error.message,
          },
        },
        errors: [...prevState.errors, uiError],
      }));

      stopStatusPolling();

      if (onError) {
        onError(new Error(error.message));
      }
    },
    [onError, stopStatusPolling]
  );

  /**
   * Update system health information
   */
  const updateSystemHealth = useCallback((health: SystemHealthStatus) => {
    setUIState((prevState) => ({
      ...prevState,
      systemHealth: health,
    }));
  }, []);

  /**
   * Initiate conversion process
   */
  const initiateConversion = useCallback(
    async (file: File, options: ConversionOptions) => {
      try {
        // Reset state
        setUIState({
          currentStage: {
            name: 'initializing',
            status: 'running',
            progress: 0,
            details: { description: 'Initializing conversion process' },
          },
          progress: {
            overall: 0,
            stages: [],
            startTime: new Date(),
          },
          errors: [],
          warnings: [],
        });

        // Create conversion input
        const conversionInput: ConversionInput = {
          modFile: file.name, // This would be the uploaded file path in a real implementation
          outputPath: `/tmp/conversion_${Date.now()}`,
          options,
        };

        // Create conversion job
        const job = await conversionService.createConversionJob(conversionInput);
        setCurrentJobId(job.id);

        // Start real-time updates
        if (isConnected && wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'subscribe_job',
              jobId: job.id,
            })
          );
        } else {
          startStatusPolling();
        }

        // Update UI state
        setUIState((prevState) => ({
          ...prevState,
          currentStage: {
            name: 'queued',
            status: 'running',
            progress: 5,
            details: { description: 'Job queued for processing' },
          },
          progress: {
            ...prevState.progress,
            overall: 5,
          },
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        const uiError: UIError = {
          id: `init_error_${Date.now()}`,
          message: errorMessage,
          severity: 'critical',
          module: 'UI',
          recoverable: false,
          timestamp: new Date(),
        };

        setUIState((prevState) => ({
          ...prevState,
          currentStage: {
            name: 'failed',
            status: 'failed',
            progress: 0,
            details: { description: 'Failed to start conversion' },
          },
          errors: [...prevState.errors, uiError],
        }));

        if (onError) {
          onError(error instanceof Error ? error : new Error(errorMessage));
        }
      }
    },
    [conversionService, isConnected, startStatusPolling, onError]
  );

  /**
   * Cancel current conversion
   */
  const cancelConversion = useCallback(() => {
    if (currentJobId) {
      const cancelled = conversionService.cancelJob(currentJobId);
      if (cancelled) {
        setUIState((prevState) => ({
          ...prevState,
          currentStage: {
            name: 'cancelled',
            status: 'failed',
            progress: prevState.progress.overall,
            details: { description: 'Conversion cancelled by user' },
          },
        }));

        stopStatusPolling();
        setCurrentJobId(null);
      }
    }
  }, [currentJobId, conversionService, stopStatusPolling]);

  /**
   * Get stage description
   */
  const getStageDescription = (stageName: string): string => {
    const descriptions: Record<string, string> = {
      initializing: 'Setting up conversion environment',
      queued: 'Waiting in processing queue',
      validating: 'Validating file and performing security scans',
      analyzing: 'Analyzing mod structure with multi-strategy extraction',
      converting_assets: 'Converting textures, models, and sounds',
      converting_config: 'Converting configuration and metadata',
      translating_logic: 'Translating Java code to JavaScript',
      validating_output: 'Validating converted components',
      packaging: 'Creating Bedrock addon package',
      completed: 'Conversion completed successfully',
      failed: 'Conversion failed',
      cancelled: 'Conversion cancelled',
    };

    return descriptions[stageName] || 'Processing...';
  };

  /**
   * Load error metrics periodically
   */
  const loadErrorMetrics = useCallback(async () => {
    try {
      const metrics = errorCollector.getErrorRateMetrics();
      setUIState((prevState) => ({
        ...prevState,
        errorMetrics: metrics,
      }));
    } catch (error) {
      console.error('Failed to load error metrics:', error);
    }
  }, [errorCollector]);

  // Initialize component
  useEffect(() => {
    initializeWebSocket();
    loadErrorMetrics();

    // Load error metrics every 30 seconds
    const metricsInterval = setInterval(loadErrorMetrics, 30000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopStatusPolling();
      clearInterval(metricsInterval);
    };
  }, [initializeWebSocket, loadErrorMetrics, stopStatusPolling]);

  // Render component
  return (
    <div className="enhanced-conversion-ui">
      <div className="conversion-header">
        <h1>Minecraft Mod Converter</h1>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
      </div>

      <div className="conversion-content">
        {/* File Upload Section */}
        {!currentJobId && (
          <div className="upload-section">
            <FileUploader
              onFileSelected={setSelectedFile}
              onSourceRepoChange={() => {}} // Implement if needed
              uploadState={{
                file: selectedFile ?? undefined,
                isUploading: false,
                progress: 0,
              }}
            />

            <ConversionConfigPanel
              options={conversionOptions}
              onOptionsChange={setConversionOptions}
              featureFlagService={featureFlagService}
            />

            <button
              className="start-conversion-btn"
              disabled={!selectedFile}
              onClick={() => selectedFile && initiateConversion(selectedFile, conversionOptions)}
            >
              Start Enhanced Conversion
            </button>
          </div>
        )}

        {/* Progress Section */}
        {currentJobId && (
          <div className="progress-section">
            <EnhancedProgressTracker
              progress={uiState.progress}
              currentStage={uiState.currentStage}
            />

            <EnhancedStatusDisplay
              progress={uiState.progress}
              currentStage={uiState.currentStage}
              errors={uiState.errors}
              warnings={uiState.warnings}
            />

            {uiState.currentStage.status === 'running' && (
              <button className="cancel-conversion-btn" onClick={cancelConversion}>
                Cancel Conversion
              </button>
            )}
          </div>
        )}

        {/* Error Display */}
        {uiState.errors.length > 0 && (
          <ErrorDisplay
            errors={uiState.errors}
            warnings={uiState.warnings}
            errorCollector={errorCollector}
          />
        )}

        {/* Results Display */}
        {uiState.results && (
          <ResultsDisplay
            results={uiState.results}
            onDownload={() => {
              if (uiState.results?.downloadUrl) {
                window.open(uiState.results.downloadUrl, '_blank');
              }
            }}
          />
        )}

        {/* System Health Panel */}
        {uiState.systemHealth && (
          <SystemHealthPanel health={uiState.systemHealth} errorMetrics={uiState.errorMetrics} />
        )}
      </div>
    </div>
  );
};

export default EnhancedConversionUI;
