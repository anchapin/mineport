/**
 * Validation Pipeline Service
 * 
 * This service provides a comprehensive validation pipeline with configurable
 * validation stages for security, analysis, and conversion checks.
 * 
 * Implements requirements:
 * - 7.1: Multi-stage validation with security, analysis, and conversion checks
 * - 7.2: Validation result aggregation and error reporting
 * - 7.3: Configurable validation stages
 * - 8.1: Validation metrics collection and reporting
 * - 8.2: Comprehensive error handling with detailed error codes
 */

import { createLogger } from '../utils/logger';
import { ErrorCollector } from './ErrorCollector';
import { 
  ConversionError, 
  ErrorType, 
  ErrorSeverity, 
  createErrorCode, 
  createConversionError 
} from '../types/errors';

const logger = createLogger('ValidationPipeline');
const MODULE_ID = 'VALIDATION';

/**
 * Input data for validation pipeline
 */
export interface ValidationInput {
  /** File path or identifier being validated */
  filePath?: string;
  /** File content buffer */
  fileContent?: Buffer;
  /** Analysis results from previous stages */
  analysisResults?: any;
  /** Conversion results from previous stages */
  conversionResults?: any;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Result of a single validation stage
 */
export interface ValidationStageResult {
  /** Stage name */
  stageName: string;
  /** Whether the stage passed validation */
  passed: boolean;
  /** Validation errors found in this stage */
  errors: ConversionError[];
  /** Validation warnings found in this stage */
  warnings: ConversionError[];
  /** Stage execution time in milliseconds */
  executionTime: number;
  /** Stage-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Overall validation summary
 */
export interface ValidationSummary {
  /** Whether all validation stages passed */
  passed: boolean;
  /** Total number of stages executed */
  totalStages: number;
  /** Number of stages that passed */
  passedStages: number;
  /** Number of stages that failed */
  failedStages: number;
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
  /** Results from each stage */
  stageResults: ValidationStageResult[];
  /** Aggregated errors from all stages */
  errors: ConversionError[];
  /** Aggregated warnings from all stages */
  warnings: ConversionError[];
  /** Validation metrics */
  metrics: ValidationMetrics;
}

/**
 * Validation metrics for monitoring and reporting
 */
export interface ValidationMetrics {
  /** Total validations performed */
  totalValidations: number;
  /** Success rate percentage */
  successRate: number;
  /** Average execution time in milliseconds */
  averageExecutionTime: number;
  /** Error distribution by type */
  errorsByType: Record<string, number>;
  /** Error distribution by severity */
  errorsBySeverity: Record<string, number>;
  /** Stage performance metrics */
  stageMetrics: Record<string, {
    executionCount: number;
    averageTime: number;
    successRate: number;
  }>;
}

/**
 * Configuration for a validation stage
 */
export interface ValidationStageConfig {
  /** Stage name */
  name: string;
  /** Whether this stage is required (failure stops pipeline) */
  required: boolean;
  /** Stage timeout in milliseconds */
  timeout?: number;
  /** Stage-specific configuration */
  config?: Record<string, any>;
}

/**
 * Interface for validation stage implementations
 */
export interface ValidationStage {
  /** Stage name */
  readonly name: string;
  /** Whether this stage is required */
  readonly required: boolean;
  /** Stage timeout in milliseconds */
  readonly timeout?: number;
  
  /**
   * Execute the validation stage
   * 
   * @param input Validation input data
   * @param config Stage configuration
   * @returns Validation stage result
   */
  validate(input: ValidationInput, config?: Record<string, any>): Promise<ValidationStageResult>;
}

/**
 * Validation pipeline configuration
 */
export interface ValidationPipelineConfig {
  /** Maximum execution time for entire pipeline in milliseconds */
  maxExecutionTime?: number;
  /** Whether to continue on stage failures */
  continueOnFailure?: boolean;
  /** Whether to collect detailed metrics */
  collectMetrics?: boolean;
  /** Custom error collector */
  errorCollector?: ErrorCollector;
}

/**
 * Comprehensive validation pipeline implementation
 */
export class ValidationPipeline {
  private stages: ValidationStage[] = [];
  private config: Required<ValidationPipelineConfig>;
  private errorCollector: ErrorCollector;
  private metrics: ValidationMetrics;
  
  /**
   * Creates a new validation pipeline
   * 
   * @param config Pipeline configuration
   */
  constructor(config: ValidationPipelineConfig = {}) {
    this.config = {
      maxExecutionTime: config.maxExecutionTime ?? 300000, // 5 minutes default
      continueOnFailure: config.continueOnFailure ?? true,
      collectMetrics: config.collectMetrics ?? true,
      errorCollector: config.errorCollector ?? new ErrorCollector()
    };
    
    this.errorCollector = this.config.errorCollector;
    this.metrics = this.initializeMetrics();
    
    logger.info('ValidationPipeline initialized', { 
      maxExecutionTime: this.config.maxExecutionTime,
      continueOnFailure: this.config.continueOnFailure,
      collectMetrics: this.config.collectMetrics
    });
  }
  
  /**
   * Add a validation stage to the pipeline
   * 
   * @param stage Validation stage to add
   */
  public addStage(stage: ValidationStage): void {
    // Check for duplicate stage names
    if (this.stages.some(s => s.name === stage.name)) {
      throw new Error(`Validation stage '${stage.name}' already exists`);
    }
    
    this.stages.push(stage);
    
    // Initialize stage metrics
    if (this.config.collectMetrics) {
      this.metrics.stageMetrics[stage.name] = {
        executionCount: 0,
        averageTime: 0,
        successRate: 0
      };
    }
    
    logger.debug('Added validation stage', { 
      stageName: stage.name, 
      required: stage.required,
      totalStages: this.stages.length
    });
  }
  
  /**
   * Remove a validation stage from the pipeline
   * 
   * @param stageName Name of the stage to remove
   * @returns True if stage was removed, false if not found
   */
  public removeStage(stageName: string): boolean {
    const index = this.stages.findIndex(s => s.name === stageName);
    if (index === -1) {
      return false;
    }
    
    this.stages.splice(index, 1);
    
    // Remove stage metrics
    if (this.config.collectMetrics && this.metrics.stageMetrics[stageName]) {
      delete this.metrics.stageMetrics[stageName];
    }
    
    logger.debug('Removed validation stage', { 
      stageName, 
      totalStages: this.stages.length 
    });
    
    return true;
  }
  
  /**
   * Get all configured validation stages
   * 
   * @returns Array of validation stages
   */
  public getStages(): ValidationStage[] {
    return [...this.stages];
  }
  
  /**
   * Run the complete validation pipeline
   * 
   * @param input Validation input data
   * @returns Validation summary
   */
  public async runValidation(input: ValidationInput): Promise<ValidationSummary> {
    const startTime = Date.now();
    const stageResults: ValidationStageResult[] = [];
    const allErrors: ConversionError[] = [];
    const allWarnings: ConversionError[] = [];
    
    logger.info('Starting validation pipeline', { 
      totalStages: this.stages.length,
      filePath: input.filePath
    });
    
    // Clear error collector
    this.errorCollector.clear();
    
    try {
      // Execute each validation stage
      for (const stage of this.stages) {
        const stageStartTime = Date.now();
        
        try {
          logger.debug('Executing validation stage', { stageName: stage.name });
          
          // Execute stage with timeout
          const stageResult = await this.executeStageWithTimeout(stage, input);
          stageResults.push(stageResult);
          
          // Collect errors and warnings
          allErrors.push(...stageResult.errors);
          allWarnings.push(...stageResult.warnings);
          
          // Add errors to error collector
          this.errorCollector.addErrors(stageResult.errors);
          this.errorCollector.addErrors(stageResult.warnings);
          
          // Update stage metrics
          if (this.config.collectMetrics) {
            this.updateStageMetrics(stage.name, stageResult.executionTime, stageResult.passed);
          }
          
          // Check if required stage failed and we should stop
          if (!stageResult.passed && stage.required && !this.config.continueOnFailure) {
            logger.warn('Required validation stage failed, stopping pipeline', { 
              stageName: stage.name 
            });
            break;
          }
          
        } catch (error) {
          const executionTime = Date.now() - stageStartTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          logger.error('Validation stage execution failed', { 
            stageName: stage.name, 
            error: errorMessage 
          });
          
          // Create stage failure result
          const stageError = createConversionError({
            code: createErrorCode(MODULE_ID, 'STAGE', stageResults.length + 1),
            type: ErrorType.VALIDATION,
            severity: stage.required ? ErrorSeverity.ERROR : ErrorSeverity.WARNING,
            message: `Validation stage '${stage.name}' failed: ${errorMessage}`,
            moduleOrigin: MODULE_ID,
            details: { stageName: stage.name, originalError: error }
          });
          
          const failedStageResult: ValidationStageResult = {
            stageName: stage.name,
            passed: false,
            errors: [stageError],
            warnings: [],
            executionTime,
            metadata: { error: errorMessage }
          };
          
          stageResults.push(failedStageResult);
          allErrors.push(stageError);
          this.errorCollector.addError(stageError);
          
          // Update stage metrics
          if (this.config.collectMetrics) {
            this.updateStageMetrics(stage.name, executionTime, false);
          }
          
          // Check if required stage failed and we should stop
          if (stage.required && !this.config.continueOnFailure) {
            logger.warn('Required validation stage failed, stopping pipeline', { 
              stageName: stage.name 
            });
            break;
          }
        }
      }
      
      const totalExecutionTime = Date.now() - startTime;
      const passedStages = stageResults.filter(r => r.passed).length;
      const failedStages = stageResults.length - passedStages;
      
      // Determine overall pass/fail status
      let overallPassed = true;
      
      if (this.config.continueOnFailure) {
        // When continueOnFailure is true, only required stage failures cause overall failure
        overallPassed = !stageResults.some(r => {
          if (r.passed) return false;
          const stage = this.stages.find(s => s.name === r.stageName);
          return stage?.required === true;
        });
      } else {
        // When continueOnFailure is false, any stage failure causes overall failure
        overallPassed = stageResults.every(r => r.passed);
      }
      
      // Update overall metrics
      if (this.config.collectMetrics) {
        this.updateOverallMetrics(totalExecutionTime, overallPassed, allErrors);
      }
      
      const summary: ValidationSummary = {
        passed: overallPassed,
        totalStages: this.stages.length,
        passedStages,
        failedStages,
        totalExecutionTime,
        stageResults,
        errors: allErrors,
        warnings: allWarnings,
        metrics: this.config.collectMetrics ? { ...this.metrics } : this.initializeMetrics()
      };
      
      logger.info('Validation pipeline completed', {
        passed: overallPassed,
        totalStages: this.stages.length,
        passedStages,
        failedStages,
        totalExecutionTime,
        errorCount: allErrors.length,
        warningCount: allWarnings.length
      });
      
      return summary;
      
    } catch (error) {
      const totalExecutionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Validation pipeline failed', { error: errorMessage });
      
      // Create pipeline failure error
      const pipelineError = createConversionError({
        code: createErrorCode(MODULE_ID, 'PIPELINE', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.CRITICAL,
        message: `Validation pipeline failed: ${errorMessage}`,
        moduleOrigin: MODULE_ID,
        details: { originalError: error }
      });
      
      allErrors.push(pipelineError);
      this.errorCollector.addError(pipelineError);
      
      // Update overall metrics
      if (this.config.collectMetrics) {
        this.updateOverallMetrics(totalExecutionTime, false, allErrors);
      }
      
      return {
        passed: false,
        totalStages: this.stages.length,
        passedStages: stageResults.filter(r => r.passed).length,
        failedStages: stageResults.length - stageResults.filter(r => r.passed).length,
        totalExecutionTime,
        stageResults,
        errors: allErrors,
        warnings: allWarnings,
        metrics: this.config.collectMetrics ? { ...this.metrics } : this.initializeMetrics()
      };
    }
  }
  
  /**
   * Execute a validation stage with timeout protection
   * 
   * @param stage Validation stage to execute
   * @param input Validation input data
   * @returns Stage result
   */
  private async executeStageWithTimeout(
    stage: ValidationStage, 
    input: ValidationInput
  ): Promise<ValidationStageResult> {
    const timeout = stage.timeout ?? 30000; // 30 seconds default
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Validation stage '${stage.name}' timed out after ${timeout}ms`));
      }, timeout);
      
      stage.validate(input)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  /**
   * Initialize metrics structure
   * 
   * @returns Initial metrics object
   */
  private initializeMetrics(): ValidationMetrics {
    return {
      totalValidations: 0,
      successRate: 0,
      averageExecutionTime: 0,
      errorsByType: {},
      errorsBySeverity: {},
      stageMetrics: {}
    };
  }
  
  /**
   * Update stage-specific metrics
   * 
   * @param stageName Name of the stage
   * @param executionTime Execution time in milliseconds
   * @param passed Whether the stage passed
   */
  private updateStageMetrics(stageName: string, executionTime: number, passed: boolean): void {
    const stageMetric = this.metrics.stageMetrics[stageName];
    if (!stageMetric) return;
    
    const newCount = stageMetric.executionCount + 1;
    const newAverageTime = ((stageMetric.averageTime * stageMetric.executionCount) + executionTime) / newCount;
    const newSuccessRate = ((stageMetric.successRate * stageMetric.executionCount) + (passed ? 1 : 0)) / newCount;
    
    this.metrics.stageMetrics[stageName] = {
      executionCount: newCount,
      averageTime: newAverageTime,
      successRate: newSuccessRate
    };
  }
  
  /**
   * Update overall pipeline metrics
   * 
   * @param executionTime Total execution time
   * @param passed Whether validation passed
   * @param errors All errors encountered
   */
  private updateOverallMetrics(executionTime: number, passed: boolean, errors: ConversionError[]): void {
    const newCount = this.metrics.totalValidations + 1;
    const newAverageTime = ((this.metrics.averageExecutionTime * this.metrics.totalValidations) + executionTime) / newCount;
    const newSuccessRate = ((this.metrics.successRate * this.metrics.totalValidations) + (passed ? 1 : 0)) / newCount;
    
    this.metrics.totalValidations = newCount;
    this.metrics.averageExecutionTime = newAverageTime;
    this.metrics.successRate = newSuccessRate;
    
    // Update error distribution
    errors.forEach(error => {
      const type = error.type.toString();
      const severity = error.severity.toString();
      
      this.metrics.errorsByType[type] = (this.metrics.errorsByType[type] || 0) + 1;
      this.metrics.errorsBySeverity[severity] = (this.metrics.errorsBySeverity[severity] || 0) + 1;
    });
  }
  
  /**
   * Get current validation metrics
   * 
   * @returns Current metrics
   */
  public getMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    
    // Reinitialize stage metrics for existing stages
    this.stages.forEach(stage => {
      this.metrics.stageMetrics[stage.name] = {
        executionCount: 0,
        averageTime: 0,
        successRate: 0
      };
    });
    
    logger.info('Validation metrics reset');
  }
  
  /**
   * Get error collector instance
   * 
   * @returns Error collector
   */
  public getErrorCollector(): ErrorCollector {
    return this.errorCollector;
  }
}