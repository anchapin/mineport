/**
 * Enhanced Conversion API Endpoints
 *
 * API endpoints that support enhanced validation and error reporting
 * with ModPorter-AI integration features.
 */

import { Request, Response } from 'express';
import { ConversionService } from '../services/ConversionService.js';
import { FeatureFlagService, MODPORTER_AI_FEATURES } from '../services/FeatureFlagService.js';
import { createLogger } from '../utils/logger.js';
import {
  FILE_PROCESSOR_ERRORS,
  JAVA_ANALYZER_ERRORS,
  ASSET_CONVERTER_ERRORS,
  createConversionError,
  ErrorType,
  ErrorSeverity,
} from '../types/errors.js';

const logger = createLogger('EnhancedConversionAPI');

/**
 * Enhanced conversion request interface
 */
export interface EnhancedConversionRequest {
  modFile: string;
  outputPath: string;
  options: {
    targetMinecraftVersion: string;
    compromiseStrategy: 'conservative' | 'balanced' | 'aggressive';
    includeDocumentation: boolean;
    optimizeAssets: boolean;
    customMappings?: Record<string, string>;
  };
  // Enhanced options
  enableEnhancedProcessing?: boolean;
  enableSecurityScanning?: boolean;
  enableMultiStrategyAnalysis?: boolean;
  validationLevel?: 'basic' | 'standard' | 'comprehensive';
}

/**
 * Enhanced conversion response interface
 */
export interface EnhancedConversionResponse {
  success: boolean;
  jobId?: string;
  message: string;
  // Enhanced response data
  validationResult?: {
    isValid: boolean;
    securityScanPassed: boolean;
    analysisCompleted: boolean;
    errors: any[];
    warnings: any[];
  };
  featureFlags?: {
    enhancedFileProcessing: boolean;
    multiStrategyAnalysis: boolean;
    specializedConversionAgents: boolean;
    comprehensiveValidation: boolean;
  };
  estimatedProcessingTime?: number;
  supportedFeatures?: string[];
}

/**
 * Enhanced conversion API controller
 */
export class EnhancedConversionController {
  constructor(
    private conversionService: ConversionService,
    private featureFlagService: FeatureFlagService
  ) {}

  /**
   * Create enhanced conversion job with detailed validation and error reporting
   */
  async createEnhancedConversion(req: Request, res: Response): Promise<void> {
    try {
      const requestData: EnhancedConversionRequest = req.body;

      logger.info('Enhanced conversion request received', {
        modFile: requestData.modFile,
        enableEnhancedProcessing: requestData.enableEnhancedProcessing,
        validationLevel: requestData.validationLevel,
      });

      // Check feature flag availability
      const featureFlags = {
        enhancedFileProcessing: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.ENHANCED_FILE_PROCESSING
        ),
        multiStrategyAnalysis: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.MULTI_STRATEGY_ANALYSIS
        ),
        specializedConversionAgents: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.SPECIALIZED_CONVERSION_AGENTS
        ),
        comprehensiveValidation: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.COMPREHENSIVE_VALIDATION
        ),
      };

      // Validate request
      const validationErrors = this.validateRequest(requestData);
      if (validationErrors.length > 0) {
        const response: EnhancedConversionResponse = {
          success: false,
          message: 'Request validation failed',
          validationResult: {
            isValid: false,
            securityScanPassed: false,
            analysisCompleted: false,
            errors: validationErrors,
            warnings: [],
          },
          featureFlags,
        };

        res.status(400).json(response);
        return;
      }

      // Create conversion job with enhanced processing
      const conversionInput = {
        modFile: requestData.modFile,
        outputPath: requestData.outputPath,
        options: requestData.options,
      };

      const job = await this.conversionService.createConversionJob(conversionInput);

      // Estimate processing time based on enabled features
      const estimatedTime = this.estimateProcessingTime(requestData, featureFlags);

      const response: EnhancedConversionResponse = {
        success: true,
        jobId: job.id,
        message: 'Enhanced conversion job created successfully',
        validationResult: {
          isValid: true,
          securityScanPassed: featureFlags.enhancedFileProcessing,
          analysisCompleted: featureFlags.multiStrategyAnalysis,
          errors: [],
          warnings: [],
        },
        featureFlags,
        estimatedProcessingTime: estimatedTime,
        supportedFeatures: this.getSupportedFeatures(featureFlags),
      };

      logger.info('Enhanced conversion job created', {
        jobId: job.id,
        featureFlags,
        estimatedTime,
      });

      res.status(201).json(response);
    } catch (error) {
      logger.error('Enhanced conversion creation failed', { error: error.message });

      const conversionError = createConversionError({
        code: FILE_PROCESSOR_ERRORS.VALIDATION_FAILED,
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: error.message,
        moduleOrigin: 'EnhancedConversionAPI',
        details: { originalError: error.message },
      });

      const response: EnhancedConversionResponse = {
        success: false,
        message: 'Failed to create enhanced conversion job',
        validationResult: {
          isValid: false,
          securityScanPassed: false,
          analysisCompleted: false,
          errors: [conversionError],
          warnings: [],
        },
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get enhanced job status with detailed progress information
   */
  async getEnhancedJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      const status = this.conversionService.getJobStatus(jobId);

      if (!status) {
        res.status(404).json({
          success: false,
          message: 'Job not found',
          jobId,
        });
        return;
      }

      // Get feature flags that were active for this job
      const featureFlags = {
        enhancedFileProcessing: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.ENHANCED_FILE_PROCESSING
        ),
        multiStrategyAnalysis: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.MULTI_STRATEGY_ANALYSIS
        ),
        specializedConversionAgents: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.SPECIALIZED_CONVERSION_AGENTS
        ),
        comprehensiveValidation: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.COMPREHENSIVE_VALIDATION
        ),
      };

      const enhancedStatus = {
        ...status,
        featureFlags,
        enhancedProcessingStages: this.getProcessingStages(status, featureFlags),
        detailedProgress: this.getDetailedProgress(status, featureFlags),
      };

      res.json({
        success: true,
        status: enhancedStatus,
      });
    } catch (error) {
      logger.error('Failed to get enhanced job status', {
        error: error.message,
        jobId: req.params.jobId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get job status',
        error: error.message,
      });
    }
  }

  /**
   * Get available enhanced features
   */
  async getAvailableFeatures(req: Request, res: Response): Promise<void> {
    try {
      const featureFlags = {
        enhancedFileProcessing: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.ENHANCED_FILE_PROCESSING
        ),
        multiStrategyAnalysis: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.MULTI_STRATEGY_ANALYSIS
        ),
        specializedConversionAgents: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.SPECIALIZED_CONVERSION_AGENTS
        ),
        comprehensiveValidation: await this.featureFlagService.isEnabled(
          MODPORTER_AI_FEATURES.COMPREHENSIVE_VALIDATION
        ),
      };

      const allFlags = await this.featureFlagService.getAllFlags();

      res.json({
        success: true,
        features: {
          available: featureFlags,
          supported: this.getSupportedFeatures(featureFlags),
          configuration: allFlags
            .filter((flag) => Object.values(MODPORTER_AI_FEATURES).includes(flag.name as any))
            .map((flag) => ({
              name: flag.name,
              description: flag.description,
              isEnabled: flag.isEnabled,
              rolloutPercentage: flag.rolloutPercentage,
            })),
        },
      });
    } catch (error) {
      logger.error('Failed to get available features', { error: error.message });

      res.status(500).json({
        success: false,
        message: 'Failed to get available features',
        error: error.message,
      });
    }
  }

  /**
   * Validate enhanced conversion request
   */
  private validateRequest(request: EnhancedConversionRequest): any[] {
    const errors: any[] = [];

    if (!request.modFile) {
      errors.push(
        createConversionError({
          code: FILE_PROCESSOR_ERRORS.VALIDATION_FAILED,
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'modFile is required',
          moduleOrigin: 'EnhancedConversionAPI',
        })
      );
    }

    if (!request.outputPath) {
      errors.push(
        createConversionError({
          code: FILE_PROCESSOR_ERRORS.VALIDATION_FAILED,
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'outputPath is required',
          moduleOrigin: 'EnhancedConversionAPI',
        })
      );
    }

    if (!request.options?.targetMinecraftVersion) {
      errors.push(
        createConversionError({
          code: FILE_PROCESSOR_ERRORS.VALIDATION_FAILED,
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'targetMinecraftVersion is required',
          moduleOrigin: 'EnhancedConversionAPI',
        })
      );
    }

    const validStrategies = ['conservative', 'balanced', 'aggressive'];
    if (
      request.options?.compromiseStrategy &&
      !validStrategies.includes(request.options.compromiseStrategy)
    ) {
      errors.push(
        createConversionError({
          code: FILE_PROCESSOR_ERRORS.VALIDATION_FAILED,
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: `Invalid compromiseStrategy. Must be one of: ${validStrategies.join(', ')}`,
          moduleOrigin: 'EnhancedConversionAPI',
        })
      );
    }

    const validValidationLevels = ['basic', 'standard', 'comprehensive'];
    if (request.validationLevel && !validValidationLevels.includes(request.validationLevel)) {
      errors.push(
        createConversionError({
          code: FILE_PROCESSOR_ERRORS.VALIDATION_FAILED,
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: `Invalid validationLevel. Must be one of: ${validValidationLevels.join(', ')}`,
          moduleOrigin: 'EnhancedConversionAPI',
        })
      );
    }

    return errors;
  }

  /**
   * Estimate processing time based on enabled features
   */
  private estimateProcessingTime(request: EnhancedConversionRequest, featureFlags: any): number {
    let baseTime = 30000; // 30 seconds base time

    if (featureFlags.enhancedFileProcessing) {
      baseTime += 5000; // Add 5 seconds for security scanning
    }

    if (featureFlags.multiStrategyAnalysis) {
      baseTime += 10000; // Add 10 seconds for enhanced analysis
    }

    if (featureFlags.specializedConversionAgents) {
      baseTime += 15000; // Add 15 seconds for specialized conversion
    }

    if (featureFlags.comprehensiveValidation) {
      baseTime += 8000; // Add 8 seconds for comprehensive validation
    }

    if (request.validationLevel === 'comprehensive') {
      baseTime += 12000; // Add 12 seconds for comprehensive validation level
    }

    return baseTime;
  }

  /**
   * Get supported features based on enabled flags
   */
  private getSupportedFeatures(featureFlags: any): string[] {
    const features: string[] = ['basic_conversion'];

    if (featureFlags.enhancedFileProcessing) {
      features.push('security_scanning', 'enhanced_file_validation');
    }

    if (featureFlags.multiStrategyAnalysis) {
      features.push('multi_strategy_analysis', 'registry_extraction', 'texture_detection');
    }

    if (featureFlags.specializedConversionAgents) {
      features.push('asset_conversion', 'bedrock_architecture', 'block_item_generation');
    }

    if (featureFlags.comprehensiveValidation) {
      features.push('comprehensive_validation', 'multi_stage_validation');
    }

    return features;
  }

  /**
   * Get processing stages based on enabled features
   */
  private getProcessingStages(status: any, featureFlags: any): string[] {
    const stages: string[] = ['queued'];

    if (featureFlags.enhancedFileProcessing) {
      stages.push('file_validation', 'security_scanning');
    }

    if (featureFlags.multiStrategyAnalysis) {
      stages.push('java_analysis', 'registry_extraction');
    }

    stages.push('conversion');

    if (featureFlags.specializedConversionAgents) {
      stages.push('asset_conversion', 'structure_generation');
    }

    if (featureFlags.comprehensiveValidation) {
      stages.push('validation');
    }

    stages.push('packaging', 'completed');

    return stages;
  }

  /**
   * Get detailed progress information
   */
  private getDetailedProgress(status: any, featureFlags: any): any {
    const stages = this.getProcessingStages(status, featureFlags);
    const currentStageIndex = stages.indexOf(status.currentStage || 'queued');

    return {
      totalStages: stages.length,
      currentStageIndex: Math.max(0, currentStageIndex),
      currentStage: status.currentStage || 'queued',
      completedStages: Math.max(0, currentStageIndex),
      remainingStages: Math.max(0, stages.length - currentStageIndex - 1),
      stageProgress: status.stageProgress || 0,
      overallProgress: status.progress || 0,
    };
  }
}
