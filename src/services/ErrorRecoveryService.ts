/**
 * Error Recovery Service
 * 
 * This service provides centralized error recovery capabilities for all modules.
 * It implements various recovery strategies and coordinates with the enhanced error collector.
 */

import {
  ConversionError,
  EnhancedConversionError,
  RecoveryStrategy,
  RecoveryAction,
  RecoveryResult,
  ErrorSeverity,
  createEnhancedConversionError,
  createRecoveryActions
} from '../types/errors';
import { EnhancedErrorCollector } from './EnhancedErrorCollector';
import { logger } from '../utils/logger';

/**
 * Recovery context interface
 */
export interface RecoveryContext {
  moduleId: string;
  operationId: string;
  retryCallback?: () => Promise<any>;
  fallbackCallback?: (method: string) => Promise<any>;
  compromiseCallback?: (strategy: string) => Promise<any>;
  skipCallback?: () => Promise<any>;
  metadata?: Record<string, any>;
}

/**
 * Recovery statistics
 */
export interface RecoveryStatistics {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  recoveryRate: number;
  strategiesUsed: Record<RecoveryStrategy, number>;
  averageRecoveryTime: number;
  moduleRecoveryRates: Record<string, number>;
}

/**
 * Error Recovery Service implementation
 */
export class ErrorRecoveryService {
  private errorCollector: EnhancedErrorCollector;
  private recoveryContexts: Map<string, RecoveryContext> = new Map();
  private recoveryStatistics: RecoveryStatistics = {
    totalAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    recoveryRate: 0,
    strategiesUsed: {} as Record<RecoveryStrategy, number>,
    averageRecoveryTime: 0,
    moduleRecoveryRates: {}
  };
  private recoveryTimes: number[] = [];
  
  constructor(errorCollector: EnhancedErrorCollector) {
    this.errorCollector = errorCollector;
    
    // Initialize strategy counters
    Object.values(RecoveryStrategy).forEach(strategy => {
      this.recoveryStatistics.strategiesUsed[strategy] = 0;
    });
  }
  
  /**
   * Register a recovery context for a module operation
   * 
   * @param context Recovery context
   */
  public registerRecoveryContext(context: RecoveryContext): void {
    const key = `${context.moduleId}-${context.operationId}`;
    this.recoveryContexts.set(key, context);
    
    logger.debug('Recovery context registered', {
      moduleId: context.moduleId,
      operationId: context.operationId
    });
  }
  
  /**
   * Unregister a recovery context
   * 
   * @param moduleId Module identifier
   * @param operationId Operation identifier
   */
  public unregisterRecoveryContext(moduleId: string, operationId: string): void {
    const key = `${moduleId}-${operationId}`;
    this.recoveryContexts.delete(key);
    
    logger.debug('Recovery context unregistered', { moduleId, operationId });
  }
  
  /**
   * Handle an error with automatic recovery attempt
   * 
   * @param error The error to handle
   * @param context Optional recovery context
   * @returns Recovery result
   */
  public async handleError(
    error: ConversionError,
    context?: RecoveryContext
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    // Create enhanced error with recovery actions
    const recoveryActions = createRecoveryActions(error, context?.metadata);
    const enhancedError = createEnhancedConversionError(error, recoveryActions, context?.metadata);
    
    // Add to error collector
    this.errorCollector.addEnhancedError(enhancedError);
    
    // Attempt recovery if possible
    if (enhancedError.isRecoverable) {
      const result = await this.attemptRecoveryWithContext(enhancedError, context);
      
      // Update statistics
      this.updateRecoveryStatistics(result, Date.now() - startTime);
      
      return result;
    }
    
    // No recovery possible
    return {
      success: false,
      strategy: RecoveryStrategy.ABORT,
      message: 'Error is not recoverable'
    };
  }
  
  /**
   * Attempt recovery with context-aware callbacks
   * 
   * @param error Enhanced error to recover from
   * @param context Recovery context
   * @returns Recovery result
   */
  public async attemptRecoveryWithContext(
    error: EnhancedConversionError,
    context?: RecoveryContext
  ): Promise<RecoveryResult> {
    if (!context) {
      // Fall back to basic recovery
      return this.errorCollector.attemptRecovery(error.id);
    }
    
    logger.info('Attempting context-aware recovery', {
      errorId: error.id,
      moduleId: context.moduleId,
      operationId: context.operationId,
      strategies: error.recoveryActions.length
    });
    
    // Try each recovery action with context
    for (const action of error.recoveryActions) {
      try {
        const result = await this.executeContextualRecoveryAction(error, action, context);
        
        if (result.success) {
          error.hasBeenRecovered = true;
          error.recoveryAttempts++;
          error.lastRecoveryAttempt = new Date();
          
          logger.info('Context-aware recovery successful', {
            errorId: error.id,
            strategy: action.strategy,
            moduleId: context.moduleId
          });
          
          return result;
        }
      } catch (recoveryError) {
        logger.error('Context-aware recovery action failed', {
          errorId: error.id,
          strategy: action.strategy,
          error: recoveryError
        });
      }
    }
    
    // All recovery actions failed
    return {
      success: false,
      strategy: RecoveryStrategy.ABORT,
      message: 'All context-aware recovery strategies failed'
    };
  }
  
  /**
   * Execute a recovery action with context callbacks
   * 
   * @param error The error being recovered from
   * @param action The recovery action to execute
   * @param context The recovery context
   * @returns Recovery result
   */
  private async executeContextualRecoveryAction(
    error: EnhancedConversionError,
    action: RecoveryAction,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    this.recoveryStatistics.strategiesUsed[action.strategy]++;
    
    switch (action.strategy) {
      case RecoveryStrategy.RETRY:
        if (context.retryCallback) {
          try {
            await context.retryCallback();
            return {
              success: true,
              strategy: RecoveryStrategy.RETRY,
              message: 'Retry operation completed successfully'
            };
          } catch (retryError) {
            return {
              success: false,
              strategy: RecoveryStrategy.RETRY,
              message: `Retry failed: ${retryError.message}`
            };
          }
        }
        break;
        
      case RecoveryStrategy.FALLBACK:
        if (context.fallbackCallback && action.fallbackMethod) {
          try {
            await context.fallbackCallback(action.fallbackMethod);
            return {
              success: true,
              strategy: RecoveryStrategy.FALLBACK,
              message: `Fallback method '${action.fallbackMethod}' executed successfully`,
              fallbackUsed: true
            };
          } catch (fallbackError) {
            return {
              success: false,
              strategy: RecoveryStrategy.FALLBACK,
              message: `Fallback failed: ${fallbackError.message}`
            };
          }
        }
        break;
        
      case RecoveryStrategy.COMPROMISE:
        if (context.compromiseCallback && action.compromiseStrategy) {
          try {
            await context.compromiseCallback(action.compromiseStrategy);
            return {
              success: true,
              strategy: RecoveryStrategy.COMPROMISE,
              message: `Compromise strategy '${action.compromiseStrategy}' applied successfully`,
              compromiseApplied: true
            };
          } catch (compromiseError) {
            return {
              success: false,
              strategy: RecoveryStrategy.COMPROMISE,
              message: `Compromise failed: ${compromiseError.message}`
            };
          }
        }
        break;
        
      case RecoveryStrategy.SKIP:
        if (context.skipCallback) {
          try {
            await context.skipCallback();
            return {
              success: true,
              strategy: RecoveryStrategy.SKIP,
              message: 'Operation skipped successfully'
            };
          } catch (skipError) {
            return {
              success: false,
              strategy: RecoveryStrategy.SKIP,
              message: `Skip failed: ${skipError.message}`
            };
          }
        } else {
          // Skip without callback is always successful
          return {
            success: true,
            strategy: RecoveryStrategy.SKIP,
            message: 'Operation skipped'
          };
        }
        
      case RecoveryStrategy.MANUAL_INTERVENTION:
        return {
          success: false,
          strategy: RecoveryStrategy.MANUAL_INTERVENTION,
          message: action.userAction || 'Manual intervention required',
          userActionRequired: true
        };
        
      case RecoveryStrategy.ABORT:
        return {
          success: false,
          strategy: RecoveryStrategy.ABORT,
          message: 'Operation aborted'
        };
    }
    
    return {
      success: false,
      strategy: action.strategy,
      message: `No context callback available for strategy: ${action.strategy}`
    };
  }
  
  /**
   * Get recovery statistics
   * 
   * @returns Recovery statistics
   */
  public getRecoveryStatistics(): RecoveryStatistics {
    return { ...this.recoveryStatistics };
  }
  
  /**
   * Reset recovery statistics
   */
  public resetRecoveryStatistics(): void {
    this.recoveryStatistics = {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      recoveryRate: 0,
      strategiesUsed: {} as Record<RecoveryStrategy, number>,
      averageRecoveryTime: 0,
      moduleRecoveryRates: {}
    };
    
    // Reinitialize strategy counters
    Object.values(RecoveryStrategy).forEach(strategy => {
      this.recoveryStatistics.strategiesUsed[strategy] = 0;
    });
    
    this.recoveryTimes = [];
    
    logger.info('Recovery statistics reset');
  }
  
  /**
   * Get recovery recommendations based on error patterns
   * 
   * @param moduleId Optional module to get recommendations for
   * @returns Array of recommendations
   */
  public getRecoveryRecommendations(moduleId?: string): string[] {
    const recommendations: string[] = [];
    const stats = this.recoveryStatistics;
    
    // Overall recovery rate recommendations
    if (stats.recoveryRate < 0.5) {
      recommendations.push('Low recovery rate detected - review error handling strategies');
    }
    
    // Strategy-specific recommendations
    if (stats.strategiesUsed[RecoveryStrategy.RETRY] > stats.strategiesUsed[RecoveryStrategy.FALLBACK] * 2) {
      recommendations.push('High retry usage - consider implementing more fallback strategies');
    }
    
    if (stats.strategiesUsed[RecoveryStrategy.MANUAL_INTERVENTION] > stats.totalAttempts * 0.2) {
      recommendations.push('High manual intervention rate - automate more recovery actions');
    }
    
    // Module-specific recommendations
    if (moduleId && stats.moduleRecoveryRates[moduleId] < 0.3) {
      recommendations.push(`Module ${moduleId} has low recovery rate - review error handling`);
    }
    
    // Performance recommendations
    if (stats.averageRecoveryTime > 5000) { // 5 seconds
      recommendations.push('High average recovery time - optimize recovery operations');
    }
    
    return recommendations;
  }
  
  /**
   * Update recovery statistics
   * 
   * @param result Recovery result
   * @param recoveryTime Time taken for recovery in milliseconds
   */
  private updateRecoveryStatistics(result: RecoveryResult, recoveryTime: number): void {
    this.recoveryStatistics.totalAttempts++;
    
    if (result.success) {
      this.recoveryStatistics.successfulRecoveries++;
    } else {
      this.recoveryStatistics.failedRecoveries++;
    }
    
    // Update recovery rate
    this.recoveryStatistics.recoveryRate = 
      this.recoveryStatistics.successfulRecoveries / this.recoveryStatistics.totalAttempts;
    
    // Update average recovery time
    this.recoveryTimes.push(recoveryTime);
    if (this.recoveryTimes.length > 100) {
      this.recoveryTimes.shift(); // Keep only last 100 recovery times
    }
    
    this.recoveryStatistics.averageRecoveryTime = 
      this.recoveryTimes.reduce((sum, time) => sum + time, 0) / this.recoveryTimes.length;
  }
  
  /**
   * Create a recovery-aware error handler function
   * 
   * @param moduleId Module identifier
   * @param operationId Operation identifier
   * @returns Error handler function
   */
  public createErrorHandler(moduleId: string, operationId: string) {
    return async (error: Error | ConversionError, context?: Record<string, any>) => {
      // Convert Error to ConversionError if needed
      let conversionError: ConversionError;
      if ('code' in error && 'type' in error) {
        conversionError = error as ConversionError;
      } else {
        conversionError = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          code: `${moduleId.toUpperCase()}-ERR-001`,
          type: 'system' as any,
          severity: ErrorSeverity.ERROR,
          message: error.message,
          moduleOrigin: moduleId,
          timestamp: new Date(),
          details: context
        };
      }
      
      // Get recovery context if registered
      const recoveryContext = this.recoveryContexts.get(`${moduleId}-${operationId}`);
      
      // Handle error with recovery
      return this.handleError(conversionError, recoveryContext);
    };
  }
  
  /**
   * Enable graceful degradation for a module
   * 
   * @param moduleId Module identifier
   * @param fallbackMethods Available fallback methods
   */
  public enableGracefulDegradation(
    moduleId: string,
    fallbackMethods: Record<string, () => Promise<any>>
  ): void {
    logger.info('Graceful degradation enabled for module', {
      moduleId,
      fallbackMethods: Object.keys(fallbackMethods)
    });
    
    // Register fallback methods as recovery contexts
    Object.entries(fallbackMethods).forEach(([methodName, callback]) => {
      this.registerRecoveryContext({
        moduleId,
        operationId: `fallback-${methodName}`,
        fallbackCallback: async () => callback()
      });
    });
  }
}