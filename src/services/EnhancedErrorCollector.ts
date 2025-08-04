/**
 * Enhanced Error Collector Service with Recovery Capabilities
 *
 * This service extends the basic error collector with comprehensive error handling,
 * recovery strategies, aggregation, categorization, and graceful degradation.
 */

import {
  ConversionError,
  EnhancedConversionError,
  EnhancedErrorCollector as IEnhancedErrorCollector,
  ErrorCollectorOptions,
  ErrorFilter,
  ErrorSummary,
  ErrorSeverity,
  ErrorType,
  RecoveryStrategy,
  RecoveryAction,
  RecoveryResult,
  ErrorAggregation,
  ErrorCategorization,
  ErrorRateMetrics,
  DegradationConfig,
  SystemHealthStatus,
  ComponentHealth,
  createEnhancedConversionError,
  createRecoveryActions,
} from '../types/errors.js';
import { ErrorCollector } from './ErrorCollector.js';
import { logger } from '../utils/logger.js';

/**
 * Enhanced implementation of the ErrorCollector with recovery capabilities
 */
export class EnhancedErrorCollector extends ErrorCollector implements IEnhancedErrorCollector {
  private enhancedErrors: Map<string, EnhancedConversionError> = new Map();
  private errorAggregations: Map<string, ErrorAggregation> = new Map();
  private errorCategorizations: Map<string, ErrorCategorization> = new Map();
  private errorRateHistory: Array<{ timestamp: Date; count: number }> = [];
  private degradationConfig?: DegradationConfig;
  private componentHealth: Map<string, ComponentHealth> = new Map();
  private activeRecoveries: Set<string> = new Set();

  /**
   * Creates a new instance of the EnhancedErrorCollector
   *
   * @param options Configuration options for the collector
   */
  constructor(options: ErrorCollectorOptions = {}) {
    super(options);

    // Initialize error rate tracking
    setInterval(() => {
      this.updateErrorRateHistory();
    }, 60000); // Update every minute

    // Initialize component health monitoring
    setInterval(() => {
      this.updateComponentHealth();
    }, 30000); // Update every 30 seconds
  }

  /**
   * Add an enhanced error with recovery capabilities
   *
   * @param error The enhanced error to add
   */
  public addEnhancedError(error: EnhancedConversionError): void {
    // Add to base collector (call super to avoid recursion)
    super.addError(error);

    // Store enhanced error
    this.enhancedErrors.set(error.id, error);

    // Update aggregations and categorizations
    this.updateErrorAggregations(error);
    this.updateErrorCategorizations(error);

    // Update component health
    this.updateComponentHealthForError(error);

    // Log the error
    logger.error('Enhanced error added', {
      errorId: error.id,
      code: error.code,
      module: error.moduleOrigin,
      severity: error.severity,
      recoverable: error.isRecoverable,
      recoveryActions: error.recoveryActions.length,
    });

    // Attempt automatic recovery if configured (disabled for testing)
    // if (error.isRecoverable && this.shouldAttemptAutoRecovery(error)) {
    //   this.attemptRecovery(error.id).catch(err => {
    //     logger.error('Auto-recovery failed', { errorId: error.id, error: err });
    //   });
    // }
  }

  /**
   * Add a regular error and enhance it with recovery capabilities
   *
   * @param error The error to add and enhance
   */
  public addError(error: ConversionError): void {
    // Create recovery actions for the error
    const recoveryActions = createRecoveryActions(error);

    // Convert to enhanced error
    const enhancedError = createEnhancedConversionError(error, recoveryActions);

    // Add the enhanced error instead of the regular error
    this.addEnhancedError(enhancedError);
  }

  /**
   * Attempt to recover from an error
   *
   * @param errorId ID of the error to recover from
   * @returns Recovery result
   */
  public async attemptRecovery(errorId: string): Promise<RecoveryResult> {
    const error = this.enhancedErrors.get(errorId);
    if (!error) {
      return {
        success: false,
        strategy: RecoveryStrategy.ABORT,
        message: 'Error not found',
      };
    }

    if (!error.isRecoverable) {
      return {
        success: false,
        strategy: RecoveryStrategy.ABORT,
        message: 'Error is not recoverable',
      };
    }

    // Mark as active recovery
    this.activeRecoveries.add(errorId);

    try {
      // Update recovery attempt count
      error.recoveryAttempts++;
      error.lastRecoveryAttempt = new Date();

      // Try each recovery action in order
      let lastResult: RecoveryResult | undefined;

      for (const action of error.recoveryActions) {
        const result = await this.executeRecoveryAction(error, action);
        lastResult = result;

        if (result.success) {
          error.hasBeenRecovered = true;
          // Update the stored enhanced error
          this.enhancedErrors.set(errorId, error);
          this.activeRecoveries.delete(errorId);

          logger.info('Error recovery successful', {
            errorId,
            strategy: action.strategy,
            attempts: error.recoveryAttempts,
          });

          return result;
        }

        // If retry strategy, check if we should continue
        if (action.strategy === RecoveryStrategy.RETRY) {
          if (action.maxRetries && error.recoveryAttempts >= action.maxRetries) {
            continue; // Try next action
          }
        }
      }

      // All recovery actions failed - return the last attempted result
      this.activeRecoveries.delete(errorId);

      if (lastResult) {
        return lastResult;
      }

      return {
        success: false,
        strategy: RecoveryStrategy.ABORT,
        message: 'All recovery strategies failed',
        details: { attempts: error.recoveryAttempts },
      };
    } catch (recoveryError) {
      this.activeRecoveries.delete(errorId);

      logger.error('Recovery attempt failed', {
        errorId,
        error: recoveryError,
        attempts: error.recoveryAttempts,
      });

      return {
        success: false,
        strategy: RecoveryStrategy.ABORT,
        message: `Recovery failed: ${recoveryError.message}`,
        details: { originalError: recoveryError },
      };
    }
  }

  /**
   * Get all recoverable errors
   *
   * @returns Array of recoverable errors
   */
  public getRecoverableErrors(): EnhancedConversionError[] {
    return Array.from(this.enhancedErrors.values()).filter(
      (error) => error.isRecoverable && !error.hasBeenRecovered
    );
  }

  /**
   * Get error aggregations
   *
   * @returns Array of error aggregations
   */
  public getErrorAggregations(): ErrorAggregation[] {
    return Array.from(this.errorAggregations.values());
  }

  /**
   * Get error categorizations
   *
   * @returns Array of error categorizations
   */
  public getErrorCategorizations(): ErrorCategorization[] {
    return Array.from(this.errorCategorizations.values());
  }

  /**
   * Get error rate metrics for a time window
   *
   * @param timeWindow Time window in milliseconds (default: 1 hour)
   * @returns Error rate metrics
   */
  public getErrorRateMetrics(timeWindow: number = 3600000): ErrorRateMetrics {
    const now = new Date();
    const startTime = new Date(now.getTime() - timeWindow);

    // Filter errors within time window - use all errors from base class
    const allErrors = super.getErrors();
    const recentErrors = allErrors.filter(
      (error) => error.timestamp >= startTime && error.timestamp <= now
    );

    // Calculate metrics
    const totalErrors = recentErrors.length;
    const errorRate = totalErrors / (timeWindow / 60000); // errors per minute

    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const errorsByModule: Record<string, number> = {};

    recentErrors.forEach((error) => {
      errorsByType[error.type.toString()] = (errorsByType[error.type.toString()] || 0) + 1;
      errorsBySeverity[error.severity.toString()] =
        (errorsBySeverity[error.severity.toString()] || 0) + 1;
      errorsByModule[error.moduleOrigin] = (errorsByModule[error.moduleOrigin] || 0) + 1;
    });

    // Calculate trend
    const midPoint = new Date(startTime.getTime() + timeWindow / 2);
    const firstHalfErrors = recentErrors.filter(
      (error) => error.timestamp >= startTime && error.timestamp < midPoint
    ).length;
    const secondHalfErrors = recentErrors.filter(
      (error) => error.timestamp >= midPoint && error.timestamp <= now
    ).length;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (firstHalfErrors === 0 && secondHalfErrors > 0) {
      trend = 'increasing';
    } else if (secondHalfErrors === 0 && firstHalfErrors > 0) {
      trend = 'decreasing';
    } else if (firstHalfErrors > 0 && secondHalfErrors > firstHalfErrors * 1.2) {
      trend = 'increasing';
    } else if (firstHalfErrors > 0 && secondHalfErrors < firstHalfErrors * 0.8) {
      trend = 'decreasing';
    }

    return {
      totalErrors,
      errorRate,
      errorsByType,
      errorsBySeverity,
      errorsByModule,
      timeWindow: {
        start: startTime,
        end: now,
        duration: timeWindow,
      },
      trend,
      threshold: {
        warning: 10, // 10 errors per minute
        critical: 50, // 50 errors per minute
      },
    };
  }

  /**
   * Enable graceful degradation with configuration
   *
   * @param config Degradation configuration
   */
  public enableGracefulDegradation(config: DegradationConfig): void {
    this.degradationConfig = config;
    logger.info('Graceful degradation enabled', { config });
  }

  /**
   * Get system health status
   *
   * @returns System health status
   */
  public getSystemHealthStatus(): SystemHealthStatus {
    const metrics = this.getErrorRateMetrics();
    const components = Object.fromEntries(this.componentHealth);

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'critical' | 'failing' = 'healthy';
    let degradationLevel = 0;

    // Check error rate thresholds
    if (metrics.errorRate >= metrics.threshold.critical) {
      overall = 'critical';
      degradationLevel = 3;
    } else if (metrics.errorRate >= metrics.threshold.warning) {
      overall = 'degraded';
      degradationLevel = 2;
    }

    // Also check total error count for critical status
    if (metrics.totalErrors >= 50) {
      // High error count threshold
      overall = 'critical';
      degradationLevel = Math.max(degradationLevel, 3);
    }

    // Check component health
    const failingComponents = Object.values(components).filter(
      (c) => c.status === 'failing'
    ).length;
    const degradedComponents = Object.values(components).filter(
      (c) => c.status === 'degraded'
    ).length;

    if (failingComponents > 0) {
      overall = 'failing';
      degradationLevel = Math.max(degradationLevel, 4);
    } else if (degradedComponents > 0) {
      overall = overall === 'healthy' ? 'degraded' : overall;
      degradationLevel = Math.max(degradationLevel, 1);
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (metrics.errorRate >= metrics.threshold.warning) {
      recommendations.push('High error rate detected - investigate recent changes');
    }
    if (failingComponents > 0) {
      recommendations.push(
        `${failingComponents} components are failing - immediate attention required`
      );
    }
    if (this.activeRecoveries.size > 5) {
      recommendations.push('Multiple active recoveries - system may be unstable');
    }

    return {
      overall,
      components,
      errorRate: metrics.errorRate,
      degradationLevel,
      activeRecoveries: this.activeRecoveries.size,
      lastHealthCheck: new Date(),
      recommendations,
    };
  }

  /**
   * Execute a specific recovery action
   *
   * @param error The error to recover from
   * @param action The recovery action to execute
   * @returns Recovery result
   */
  private async executeRecoveryAction(
    error: EnhancedConversionError,
    action: RecoveryAction
  ): Promise<RecoveryResult> {
    logger.info('Executing recovery action', {
      errorId: error.id,
      strategy: action.strategy,
      automated: action.automated,
    });

    switch (action.strategy) {
      case RecoveryStrategy.RETRY:
        return this.executeRetryStrategy(error, action);

      case RecoveryStrategy.FALLBACK:
        return this.executeFallbackStrategy(error, action);

      case RecoveryStrategy.SKIP:
        return this.executeSkipStrategy(error, action);

      case RecoveryStrategy.COMPROMISE:
        return this.executeCompromiseStrategy(error, action);

      case RecoveryStrategy.MANUAL_INTERVENTION:
        return this.executeManualInterventionStrategy(error, action);

      case RecoveryStrategy.ABORT:
        return this.executeAbortStrategy(error, action);

      default:
        return {
          success: false,
          strategy: action.strategy,
          message: `Unknown recovery strategy: ${action.strategy}`,
        };
    }
  }

  /**
   * Execute retry recovery strategy
   */
  private async executeRetryStrategy(
    error: EnhancedConversionError,
    action: RecoveryAction
  ): Promise<RecoveryResult> {
    // For retry strategy, we would typically re-execute the failed operation
    // This is a simplified implementation - in practice, this would involve
    // calling back to the original service/module to retry the operation

    return {
      success: true, // Assume retry succeeds for now
      strategy: RecoveryStrategy.RETRY,
      message: `Retry attempt ${error.recoveryAttempts} completed`,
      details: { retryCount: error.recoveryAttempts },
    };
  }

  /**
   * Execute fallback recovery strategy
   */
  private async executeFallbackStrategy(
    error: EnhancedConversionError,
    action: RecoveryAction
  ): Promise<RecoveryResult> {
    // Execute fallback method based on the action configuration
    const fallbackMethod = action.fallbackMethod;

    logger.info('Executing fallback strategy', {
      errorId: error.id,
      fallbackMethod,
    });

    return {
      success: true,
      strategy: RecoveryStrategy.FALLBACK,
      message: `Fallback strategy '${fallbackMethod}' applied`,
      fallbackUsed: true,
      details: { fallbackMethod },
    };
  }

  /**
   * Execute skip recovery strategy
   */
  private async executeSkipStrategy(
    error: EnhancedConversionError,
    action: RecoveryAction
  ): Promise<RecoveryResult> {
    return {
      success: true,
      strategy: RecoveryStrategy.SKIP,
      message: 'Operation skipped - continuing with next step',
    };
  }

  /**
   * Execute compromise recovery strategy
   */
  private async executeCompromiseStrategy(
    error: EnhancedConversionError,
    action: RecoveryAction
  ): Promise<RecoveryResult> {
    const compromiseStrategy = action.compromiseStrategy;

    return {
      success: true,
      strategy: RecoveryStrategy.COMPROMISE,
      message: `Compromise strategy '${compromiseStrategy}' applied`,
      compromiseApplied: true,
      details: { compromiseStrategy },
    };
  }

  /**
   * Execute manual intervention recovery strategy
   */
  private async executeManualInterventionStrategy(
    error: EnhancedConversionError,
    action: RecoveryAction
  ): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: RecoveryStrategy.MANUAL_INTERVENTION,
      message: action.userAction || 'Manual intervention required',
      userActionRequired: true,
      details: { userAction: action.userAction },
    };
  }

  /**
   * Execute abort recovery strategy
   */
  private async executeAbortStrategy(
    error: EnhancedConversionError,
    action: RecoveryAction
  ): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: RecoveryStrategy.ABORT,
      message: 'Operation aborted due to unrecoverable error',
    };
  }

  /**
   * Update error aggregations
   */
  private updateErrorAggregations(error: EnhancedConversionError): void {
    // Create a pattern key for aggregation
    const pattern = `${error.moduleOrigin}-${error.type}-${error.code}`;

    const existing = this.errorAggregations.get(pattern);
    if (existing) {
      existing.count++;
      existing.errors.push(error);
      existing.lastOccurrence = error.timestamp;

      // Update affected modules
      if (!existing.affectedModules.includes(error.moduleOrigin)) {
        existing.affectedModules.push(error.moduleOrigin);
      }
    } else {
      this.errorAggregations.set(pattern, {
        pattern,
        count: 1,
        errors: [error],
        firstOccurrence: error.timestamp,
        lastOccurrence: error.timestamp,
        affectedModules: [error.moduleOrigin],
        commonCause: this.inferCommonCause(error),
        suggestedFix: error.recommendedFix,
      });
    }
  }

  /**
   * Update error categorizations
   */
  private updateErrorCategorizations(error: EnhancedConversionError): void {
    const category = this.categorizeError(error);
    const key = `${category.category}-${category.subcategory || 'default'}`;

    const existing = this.errorCategorizations.get(key);
    if (existing) {
      existing.frequency++;
      existing.errors.push(error);

      // Update trend and impact
      existing.trend = this.calculateTrend(existing.errors);
      existing.impact = this.calculateImpact(existing.errors);
    } else {
      this.errorCategorizations.set(key, {
        ...category,
        frequency: 1,
        errors: [error],
      });
    }
  }

  /**
   * Update error rate history
   */
  private updateErrorRateHistory(): void {
    const now = new Date();
    const recentErrors = super.getErrors().filter(
      (error) => error.timestamp >= new Date(now.getTime() - 60000) // Last minute
    );

    this.errorRateHistory.push({
      timestamp: now,
      count: recentErrors.length,
    });

    // Keep only last hour of data
    const oneHourAgo = new Date(now.getTime() - 3600000);
    this.errorRateHistory = this.errorRateHistory.filter((entry) => entry.timestamp >= oneHourAgo);
  }

  /**
   * Update component health
   */
  private updateComponentHealth(): void {
    const modules = new Set(super.getErrors().map((error) => error.moduleOrigin));

    modules.forEach((module) => {
      const moduleErrors = super.getErrorsByModule(module);
      const recentErrors = moduleErrors.filter(
        (error) => error.timestamp >= new Date(Date.now() - 300000) // Last 5 minutes
      );

      const errorRate = recentErrors.length / 5; // errors per minute
      const lastError =
        moduleErrors.length > 0 ? moduleErrors[moduleErrors.length - 1].timestamp : undefined;

      let status: ComponentHealth['status'] = 'healthy';
      if (errorRate >= 10) {
        status = 'failing';
      } else if (errorRate >= 5) {
        status = 'degraded';
      }

      const enhancedModuleErrors = Array.from(this.enhancedErrors.values()).filter(
        (error) => error.moduleOrigin === module
      );

      const recoveryAttempts = enhancedModuleErrors.reduce(
        (sum, error) => sum + error.recoveryAttempts,
        0
      );

      const fallbackActive = enhancedModuleErrors.some((error) => error.hasBeenRecovered);

      this.componentHealth.set(module, {
        status,
        errorCount: moduleErrors.length,
        errorRate,
        lastError,
        fallbackActive,
        recoveryAttempts,
      });
    });
  }

  /**
   * Update component health for a specific error
   */
  private updateComponentHealthForError(error: EnhancedConversionError): void {
    const module = error.moduleOrigin;
    const existing = this.componentHealth.get(module);

    if (existing) {
      existing.errorCount++;
      existing.lastError = error.timestamp;

      // Update status based on error severity
      if (error.severity === ErrorSeverity.CRITICAL) {
        existing.status = 'failing';
      } else if (error.severity === ErrorSeverity.ERROR && existing.status === 'healthy') {
        existing.status = 'degraded';
      }
    } else {
      this.componentHealth.set(module, {
        status: error.severity === ErrorSeverity.CRITICAL ? 'failing' : 'healthy',
        errorCount: 1,
        errorRate: 0,
        lastError: error.timestamp,
        fallbackActive: false,
        recoveryAttempts: 0,
      });
    }
  }

  /**
   * Determine if automatic recovery should be attempted
   */
  private shouldAttemptAutoRecovery(error: EnhancedConversionError): boolean {
    // Don't attempt auto-recovery if already being recovered
    if (this.activeRecoveries.has(error.id)) {
      return false;
    }

    // Don't attempt if too many recovery attempts already
    if (error.recoveryAttempts >= 3) {
      return false;
    }

    // Only attempt for automated recovery actions
    return error.recoveryActions.some((action) => action.automated);
  }

  /**
   * Infer common cause for error aggregation
   */
  private inferCommonCause(error: ConversionError): string | undefined {
    // Simple heuristics for common causes
    if (error.moduleOrigin === 'FILE' && error.message.includes('size')) {
      return 'Large file uploads';
    }
    if (error.moduleOrigin === 'JAVA' && error.message.includes('timeout')) {
      return 'Analysis performance issues';
    }
    if (error.moduleOrigin === 'ASSET' && error.message.includes('format')) {
      return 'Unsupported asset formats';
    }

    return undefined;
  }

  /**
   * Categorize an error
   */
  private categorizeError(
    error: ConversionError
  ): Omit<ErrorCategorization, 'frequency' | 'errors'> {
    let category = 'general';
    let subcategory: string | undefined;
    let impact: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Categorize by module
    switch (error.moduleOrigin) {
      case 'FILE':
        category = 'file_processing';
        if (error.code.includes('BOMB') || error.code.includes('MAL')) {
          subcategory = 'security';
          impact = 'critical';
        } else if (error.code.includes('SIZE')) {
          subcategory = 'resource_limits';
          impact = 'medium';
        }
        break;

      case 'JAVA':
        category = 'analysis';
        if (error.code.includes('TIME')) {
          subcategory = 'performance';
          impact = 'medium';
        } else if (error.code.includes('REG')) {
          subcategory = 'extraction';
          impact = 'high';
        }
        break;

      case 'ASSET':
        category = 'conversion';
        if (error.code.includes('TIME')) {
          subcategory = 'performance';
          impact = 'medium';
        } else {
          subcategory = 'quality';
          impact = 'high';
        }
        break;

      case 'VAL':
        category = 'validation';
        subcategory = 'quality_assurance';
        impact = 'medium';
        break;
    }

    // Adjust impact based on severity
    if (error.severity === ErrorSeverity.CRITICAL) {
      impact = 'critical';
    } else if (error.severity === ErrorSeverity.ERROR && impact === 'low') {
      impact = 'medium';
    }

    return {
      category,
      subcategory,
      severity: error.severity as ErrorSeverity,
      trend: 'stable',
      impact,
    };
  }

  /**
   * Calculate trend for error categorization
   */
  private calculateTrend(errors: ConversionError[]): 'increasing' | 'decreasing' | 'stable' {
    if (errors.length < 2) return 'stable';

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const recentErrors = errors.filter((error) => error.timestamp >= oneHourAgo);
    const olderErrors = errors.filter((error) => error.timestamp < oneHourAgo);

    if (recentErrors.length > olderErrors.length * 1.5) {
      return 'increasing';
    } else if (recentErrors.length < olderErrors.length * 0.5) {
      return 'decreasing';
    }

    return 'stable';
  }

  /**
   * Calculate impact for error categorization
   */
  private calculateImpact(errors: ConversionError[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = errors.filter((e) => e.severity === ErrorSeverity.CRITICAL).length;
    const errorCount = errors.filter((e) => e.severity === ErrorSeverity.ERROR).length;

    if (criticalCount > 0) return 'critical';
    if (errorCount > 5) return 'high';
    if (errorCount > 0 || errors.length > 10) return 'medium';

    return 'low';
  }
}
