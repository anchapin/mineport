/**
 * System Health Panel Component
 * 
 * This component displays system health information and error metrics
 * for monitoring the conversion system's performance and stability.
 */

import React, { useState } from 'react';
import { SystemHealthStatus, ErrorRateMetrics } from '../../../types/errors';

export interface SystemHealthPanelProps {
  health: SystemHealthStatus;
  errorMetrics?: ErrorRateMetrics;
}

/**
 * System Health Panel Component
 */
export const SystemHealthPanel: React.FC<SystemHealthPanelProps> = ({
  health,
  errorMetrics
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Get health status color
   */
  const getHealthColor = (status: string): string => {
    switch (status) {
      case 'healthy': return '#4CAF50';
      case 'degraded': return '#FF9800';
      case 'critical': return '#F44336';
      case 'failing': return '#D32F2F';
      default: return '#9E9E9E';
    }
  };

  /**
   * Get health status icon
   */
  const getHealthIcon = (status: string): string => {
    switch (status) {
      case 'healthy': return '🟢';
      case 'degraded': return '🟡';
      case 'critical': return '🟠';
      case 'failing': return '🔴';
      default: return '⚪';
    }
  };

  /**
   * Get component status icon
   */
  const getComponentIcon = (status: string): string => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'failing': return '❌';
      default: return '❓';
    }
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString();
  };

  /**
   * Format error rate
   */
  const formatErrorRate = (rate: number): string => {
    return rate.toFixed(2);
  };

  return (
    <div className="system-health-panel">
      <div className="health-header">
        <div className="health-status">
          <span className="health-icon">
            {getHealthIcon(health.overall)}
          </span>
          <span className="health-text">
            System Health: {health.overall.toUpperCase()}
          </span>
          {health.degradationLevel > 0 && (
            <span className="degradation-badge">
              Level {health.degradationLevel}
            </span>
          )}
        </div>
        
        <button
          className="expand-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {/* Quick Stats */}
      <div className="health-quick-stats">
        <div className="stat-item">
          <span className="stat-label">Error Rate:</span>
          <span className="stat-value">
            {errorMetrics ? formatErrorRate(errorMetrics.errorRate) : '0.00'} /min
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Active Recoveries:</span>
          <span className="stat-value">{health.activeRecoveries}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Last Check:</span>
          <span className="stat-value">{formatTimestamp(health.lastHealthCheck)}</span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="health-details">
          {/* Component Health */}
          <div className="health-section">
            <h4>Component Health</h4>
            <div className="component-list">
              {Object.entries(health.components).map(([componentName, componentHealth]) => (
                <div key={componentName} className="component-item">
                  <div className="component-header">
                    <span className="component-icon">
                      {getComponentIcon(componentHealth.status)}
                    </span>
                    <span className="component-name">{componentName}</span>
                    <span className="component-status">{componentHealth.status}</span>
                  </div>
                  
                  <div className="component-metrics">
                    <div className="metric">
                      <span className="metric-label">Errors:</span>
                      <span className="metric-value">{componentHealth.errorCount}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Error Rate:</span>
                      <span className="metric-value">
                        {formatErrorRate(componentHealth.errorRate)} /min
                      </span>
                    </div>
                    {componentHealth.lastError && (
                      <div className="metric">
                        <span className="metric-label">Last Error:</span>
                        <span className="metric-value">
                          {formatTimestamp(componentHealth.lastError)}
                        </span>
                      </div>
                    )}
                    {componentHealth.fallbackActive && (
                      <div className="metric">
                        <span className="metric-label">Fallback:</span>
                        <span className="metric-value active">Active</span>
                      </div>
                    )}
                    {componentHealth.recoveryAttempts > 0 && (
                      <div className="metric">
                        <span className="metric-label">Recovery Attempts:</span>
                        <span className="metric-value">{componentHealth.recoveryAttempts}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Metrics */}
          {errorMetrics && (
            <div className="health-section">
              <h4>Error Metrics</h4>
              
              <div className="metrics-overview">
                <div className="metric-card">
                  <div className="metric-value">{errorMetrics.totalErrors}</div>
                  <div className="metric-label">Total Errors</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatErrorRate(errorMetrics.errorRate)}</div>
                  <div className="metric-label">Errors/Min</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">
                    {errorMetrics.trend === 'increasing' ? '📈' : 
                     errorMetrics.trend === 'decreasing' ? '📉' : '➡️'}
                  </div>
                  <div className="metric-label">{errorMetrics.trend}</div>
                </div>
              </div>

              {/* Error Distribution */}
              <div className="error-distribution">
                <div className="distribution-section">
                  <h5>By Type</h5>
                  <div className="distribution-items">
                    {Object.entries(errorMetrics.errorsByType).map(([type, count]) => (
                      <div key={type} className="distribution-item">
                        <span className="distribution-label">{type}:</span>
                        <span className="distribution-value">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="distribution-section">
                  <h5>By Severity</h5>
                  <div className="distribution-items">
                    {Object.entries(errorMetrics.errorsBySeverity).map(([severity, count]) => (
                      <div key={severity} className="distribution-item">
                        <span className="distribution-label">{severity}:</span>
                        <span className="distribution-value">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="distribution-section">
                  <h5>By Module</h5>
                  <div className="distribution-items">
                    {Object.entries(errorMetrics.errorsByModule).map(([module, count]) => (
                      <div key={module} className="distribution-item">
                        <span className="distribution-label">{module}:</span>
                        <span className="distribution-value">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Thresholds */}
              <div className="error-thresholds">
                <h5>Alert Thresholds</h5>
                <div className="threshold-items">
                  <div className="threshold-item">
                    <span className="threshold-label">Warning:</span>
                    <span className="threshold-value">
                      {errorMetrics.threshold.warning} errors/min
                    </span>
                    <span className={`threshold-status ${
                      errorMetrics.errorRate >= errorMetrics.threshold.warning ? 'exceeded' : 'ok'
                    }`}>
                      {errorMetrics.errorRate >= errorMetrics.threshold.warning ? '⚠️' : '✅'}
                    </span>
                  </div>
                  <div className="threshold-item">
                    <span className="threshold-label">Critical:</span>
                    <span className="threshold-value">
                      {errorMetrics.threshold.critical} errors/min
                    </span>
                    <span className={`threshold-status ${
                      errorMetrics.errorRate >= errorMetrics.threshold.critical ? 'exceeded' : 'ok'
                    }`}>
                      {errorMetrics.errorRate >= errorMetrics.threshold.critical ? '🚨' : '✅'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {health.recommendations.length > 0 && (
            <div className="health-section">
              <h4>Recommendations</h4>
              <div className="recommendation-list">
                {health.recommendations.map((recommendation, index) => (
                  <div key={index} className="recommendation-item">
                    <span className="recommendation-icon">💡</span>
                    <span className="recommendation-text">{recommendation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Actions */}
          <div className="health-section">
            <h4>System Actions</h4>
            <div className="action-buttons">
              <button className="action-button">
                🔄 Refresh Health Check
              </button>
              <button className="action-button">
                📊 View Detailed Metrics
              </button>
              <button className="action-button">
                🧹 Clear Error History
              </button>
              <button className="action-button">
                📧 Send Health Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemHealthPanel;