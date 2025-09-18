/**
 * Error Display Component
 * 
 * This component provides comprehensive error display and management,
 * integrating with the EnhancedErrorCollector to show detailed error
 * information, recovery options, and error analytics.
 */

import React, { useState, useEffect } from 'react';
import { EnhancedErrorCollector } from '../../../services/EnhancedErrorCollector';
import { 
  EnhancedConversionError,
  ErrorAggregation,
  ErrorCategorization,
  RecoveryResult,
  SystemHealthStatus
} from '../../../types/errors';
import { UIError, UIWarning } from './EnhancedConversionUI';

export interface ErrorDisplayProps {
  errors: UIError[];
  warnings: UIWarning[];
  errorCollector: EnhancedErrorCollector;
}

/**
 * Error Display Component
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  errors,
  warnings,
  errorCollector
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'aggregated' | 'categorized' | 'recoverable'>('current');
  const [aggregatedErrors, setAggregatedErrors] = useState<ErrorAggregation[]>([]);
  const [categorizedErrors, setCategorizedErrors] = useState<ErrorCategorization[]>([]);
  const [recoverableErrors, setRecoverableErrors] = useState<EnhancedConversionError[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthStatus | null>(null);
  const [recoveryInProgress, setRecoveryInProgress] = useState<Set<string>>(new Set());

  /**
   * Load error analytics data
   */
  const loadErrorAnalytics = async () => {
    try {
      const aggregations = errorCollector.getErrorAggregations();
      const categorizations = errorCollector.getErrorCategorizations();
      const recoverable = errorCollector.getRecoverableErrors();
      const health = errorCollector.getSystemHealthStatus();

      setAggregatedErrors(aggregations);
      setCategorizedErrors(categorizations);
      setRecoverableErrors(recoverable);
      setSystemHealth(health);
    } catch (error) {
      console.error('Failed to load error analytics:', error);
    }
  };

  /**
   * Attempt error recovery
   */
  const attemptRecovery = async (errorId: string) => {
    setRecoveryInProgress(prev => new Set(prev).add(errorId));
    
    try {
      const result: RecoveryResult = await errorCollector.attemptRecovery(errorId);
      
      if (result.success) {
        // Refresh recoverable errors list
        const updatedRecoverable = errorCollector.getRecoverableErrors();
        setRecoverableErrors(updatedRecoverable);
        
        // Show success message
        alert(`Recovery successful: ${result.message}`);
      } else {
        // Show failure message
        alert(`Recovery failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Recovery attempt failed:', error);
      alert('Recovery attempt failed due to an unexpected error');
    } finally {
      setRecoveryInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(errorId);
        return newSet;
      });
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (date: Date): string => {
    return date.toLocaleString();
  };

  /**
   * Get severity color class
   */
  const getSeverityClass = (severity: string): string => {
    return `severity-${severity}`;
  };

  /**
   * Get severity icon
   */
  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  };

  /**
   * Get trend icon
   */
  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  // Load error analytics on component mount and when errors change
  useEffect(() => {
    loadErrorAnalytics();
  }, [errors, warnings]);

  // Auto-refresh error analytics every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadErrorAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="error-display">
      <div className="error-display-header">
        <h3>Error Analysis & Management</h3>
        
        {/* System Health Indicator */}
        {systemHealth && (
          <div className={`health-indicator health-${systemHealth.overall}`}>
            <span className="health-status">
              System Health: {systemHealth.overall.toUpperCase()}
            </span>
            {systemHealth.degradationLevel > 0 && (
              <span className="degradation-level">
                Level {systemHealth.degradationLevel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="error-tabs">
        <button
          className={`tab ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          Current ({errors.length + warnings.length})
        </button>
        <button
          className={`tab ${activeTab === 'aggregated' ? 'active' : ''}`}
          onClick={() => setActiveTab('aggregated')}
        >
          Patterns ({aggregatedErrors.length})
        </button>
        <button
          className={`tab ${activeTab === 'categorized' ? 'active' : ''}`}
          onClick={() => setActiveTab('categorized')}
        >
          Categories ({categorizedErrors.length})
        </button>
        <button
          className={`tab ${activeTab === 'recoverable' ? 'active' : ''}`}
          onClick={() => setActiveTab('recoverable')}
        >
          Recoverable ({recoverableErrors.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="error-content">
        {/* Current Errors Tab */}
        {activeTab === 'current' && (
          <div className="current-errors">
            {/* Errors */}
            {errors.length > 0 && (
              <div className="error-section">
                <h4>Errors ({errors.length})</h4>
                <div className="error-list">
                  {errors.map((error) => (
                    <div key={error.id} className={`error-item ${getSeverityClass(error.severity)}`}>
                      <div className="error-header">
                        <span className="error-severity">
                          {getSeverityIcon(error.severity)}
                        </span>
                        <span className="error-message">{error.message}</span>
                        <span className="error-module">({error.module})</span>
                        <span className="error-time">
                          {formatTimestamp(error.timestamp)}
                        </span>
                      </div>
                      
                      {error.recoverable && (
                        <div className="error-recovery">
                          <span className="recoverable-indicator">🔄 Recoverable</span>
                        </div>
                      )}
                      
                      {error.details && (
                        <details className="error-details">
                          <summary>Technical Details</summary>
                          <pre className="error-details-content">
                            {typeof error.details === 'object' 
                              ? JSON.stringify(error.details, null, 2)
                              : String(error.details)
                            }
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="warning-section">
                <h4>Warnings ({warnings.length})</h4>
                <div className="warning-list">
                  {warnings.map((warning) => (
                    <div key={warning.id} className="warning-item">
                      <div className="warning-header">
                        <span className="warning-icon">⚠️</span>
                        <span className="warning-message">{warning.message}</span>
                        <span className="warning-module">({warning.module})</span>
                        <span className="warning-time">
                          {formatTimestamp(warning.timestamp)}
                        </span>
                      </div>
                      
                      {warning.suggestion && (
                        <div className="warning-suggestion">
                          💡 {warning.suggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aggregated Errors Tab */}
        {activeTab === 'aggregated' && (
          <div className="aggregated-errors">
            <h4>Error Patterns</h4>
            <div className="aggregation-list">
              {aggregatedErrors.map((aggregation, index) => (
                <div key={index} className="aggregation-item">
                  <div className="aggregation-header">
                    <span className="aggregation-pattern">{aggregation.pattern}</span>
                    <span className="aggregation-count">
                      {aggregation.count} occurrences
                    </span>
                  </div>
                  
                  <div className="aggregation-details">
                    <div className="aggregation-timespan">
                      <span>First: {formatTimestamp(aggregation.firstOccurrence)}</span>
                      <span>Last: {formatTimestamp(aggregation.lastOccurrence)}</span>
                    </div>
                    
                    <div className="aggregation-modules">
                      Affected modules: {aggregation.affectedModules.join(', ')}
                    </div>
                    
                    {aggregation.commonCause && (
                      <div className="aggregation-cause">
                        Common cause: {aggregation.commonCause}
                      </div>
                    )}
                    
                    {aggregation.suggestedFix && (
                      <div className="aggregation-fix">
                        💡 Suggested fix: {aggregation.suggestedFix}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categorized Errors Tab */}
        {activeTab === 'categorized' && (
          <div className="categorized-errors">
            <h4>Error Categories</h4>
            <div className="categorization-list">
              {categorizedErrors.map((categorization, index) => (
                <div key={index} className="categorization-item">
                  <div className="categorization-header">
                    <span className="categorization-category">
                      {categorization.category}
                      {categorization.subcategory && ` > ${categorization.subcategory}`}
                    </span>
                    <span className="categorization-frequency">
                      {categorization.frequency} errors
                    </span>
                  </div>
                  
                  <div className="categorization-details">
                    <div className="categorization-metrics">
                      <span className={`impact impact-${categorization.impact}`}>
                        Impact: {categorization.impact}
                      </span>
                      <span className="trend">
                        {getTrendIcon(categorization.trend)} {categorization.trend}
                      </span>
                      <span className={`severity ${getSeverityClass(categorization.severity.toString())}`}>
                        {getSeverityIcon(categorization.severity.toString())} {categorization.severity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recoverable Errors Tab */}
        {activeTab === 'recoverable' && (
          <div className="recoverable-errors">
            <h4>Recoverable Errors</h4>
            {recoverableErrors.length === 0 ? (
              <div className="no-recoverable-errors">
                <p>No recoverable errors found. All errors have been resolved or are not recoverable.</p>
              </div>
            ) : (
              <div className="recoverable-list">
                {recoverableErrors.map((error) => (
                  <div key={error.id} className="recoverable-item">
                    <div className="recoverable-header">
                      <span className="recoverable-message">{error.message}</span>
                      <span className="recoverable-module">({error.moduleOrigin})</span>
                      <span className="recoverable-attempts">
                        Attempts: {error.recoveryAttempts}
                      </span>
                    </div>
                    
                    <div className="recoverable-details">
                      <div className="recovery-actions">
                        <h5>Available Recovery Actions:</h5>
                        <ul>
                          {error.recoveryActions.map((action, index) => (
                            <li key={index} className="recovery-action">
                              <span className="action-strategy">{action.strategy}</span>
                              {action.description && (
                                <span className="action-description">: {action.description}</span>
                              )}
                              {action.automated && (
                                <span className="action-automated">🤖 Automated</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="recovery-controls">
                        <button
                          className="recovery-button"
                          disabled={recoveryInProgress.has(error.id)}
                          onClick={() => attemptRecovery(error.id)}
                        >
                          {recoveryInProgress.has(error.id) ? 'Recovering...' : '🔄 Attempt Recovery'}
                        </button>
                        
                        {error.lastRecoveryAttempt && (
                          <span className="last-attempt">
                            Last attempt: {formatTimestamp(error.lastRecoveryAttempt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* System Health Recommendations */}
      {systemHealth && systemHealth.recommendations.length > 0 && (
        <div className="health-recommendations">
          <h4>System Health Recommendations</h4>
          <ul className="recommendation-list">
            {systemHealth.recommendations.map((recommendation, index) => (
              <li key={index} className="recommendation-item">
                💡 {recommendation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ErrorDisplay;