/**
 * Enhanced Status Display Component
 *
 * This component provides detailed status information for the enhanced conversion system,
 * showing current stage information, errors, warnings, and system status.
 */

import React from 'react';
import { ConversionStage, ProgressInfo, UIError, UIWarning } from './EnhancedConversionUI.js';

export interface EnhancedStatusDisplayProps {
  progress: ProgressInfo;
  currentStage: ConversionStage;
  errors: UIError[];
  warnings: UIWarning[];
}

/**
 * Enhanced Status Display Component
 */
export const EnhancedStatusDisplay: React.FC<EnhancedStatusDisplayProps> = ({
  progress,
  currentStage,
  errors,
  warnings,
}) => {
  const getStatusMessage = (): string => {
    switch (currentStage.name) {
      case 'initializing':
        return 'Setting up conversion environment...';
      case 'queued':
        return 'Your conversion is queued and will start shortly...';
      case 'validating':
        return 'Performing enhanced file validation and security scanning...';
      case 'analyzing':
        return 'Analyzing mod structure with multi-strategy extraction...';
      case 'converting_assets':
        return 'Converting textures, models, and sounds to Bedrock format...';
      case 'converting_config':
        return 'Converting configuration files and metadata...';
      case 'translating_logic':
        return 'Translating Java code to JavaScript using AI assistance...';
      case 'validating_output':
        return 'Validating converted components for quality assurance...';
      case 'packaging':
        return 'Creating final Bedrock addon package...';
      case 'completed':
        return 'Conversion completed successfully! 🎉';
      case 'failed':
        return 'Conversion failed. Please check the errors below.';
      case 'cancelled':
        return 'Conversion was cancelled by user.';
      default:
        return 'Processing your mod conversion...';
    }
  };

  const getStatusIcon = (): string => {
    if (errors.length > 0) {
      return '❌';
    }

    switch (currentStage.status) {
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'running':
        return '⏳';
      default:
        return '🔄';
    }
  };

  const getStatusClass = (): string => {
    if (errors.length > 0) return 'error';
    if (warnings.length > 0) return 'warning';

    switch (currentStage.status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'processing';
      default:
        return 'pending';
    }
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString();
  };

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const getSeverityClass = (severity: string): string => {
    return `severity-${severity}`;
  };

  return (
    <div className={`enhanced-status-display ${getStatusClass()}`}>
      {/* Main Status */}
      <div className="status-main">
        <div className="status-icon">{getStatusIcon()}</div>

        <div className="status-content">
          <h3 className="status-title">{getStatusMessage()}</h3>

          {currentStage.details.currentTask && (
            <p className="status-detail">{currentStage.details.currentTask}</p>
          )}

          <div className="status-meta">
            <span className="status-stage">Stage: {currentStage.name}</span>
            <span className="status-progress">Progress: {Math.round(progress.overall)}%</span>
            {progress.startTime && (
              <span className="status-time">Started: {formatTimestamp(progress.startTime)}</span>
            )}
          </div>
        </div>

        <div className="status-percentage">
          <div className="percentage-circle">
            <span className="percentage-text">
              {currentStage.status === 'completed' ? 'Done' : `${Math.round(progress.overall)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings Section */}
      {warnings.length > 0 && (
        <div className="status-warnings">
          <div className="warnings-header">
            <h4>⚠️ Warnings ({warnings.length})</h4>
            <button className="toggle-warnings">Show/Hide</button>
          </div>

          <div className="warnings-list">
            {warnings.slice(0, 3).map((warning) => (
              <div key={warning.id} className="warning-item">
                <div className="warning-content">
                  <span className="warning-message">{warning.message}</span>
                  <span className="warning-module">({warning.module})</span>
                </div>
                <span className="warning-time">{formatTimestamp(warning.timestamp)}</span>
                {warning.suggestion && (
                  <div className="warning-suggestion">💡 {warning.suggestion}</div>
                )}
              </div>
            ))}

            {warnings.length > 3 && (
              <div className="warnings-more">+{warnings.length - 3} more warnings</div>
            )}
          </div>
        </div>
      )}

      {/* Errors Section */}
      {errors.length > 0 && (
        <div className="status-errors">
          <div className="errors-header">
            <h4>🚨 Errors ({errors.length})</h4>
          </div>

          <div className="errors-list">
            {errors.slice(0, 3).map((error) => (
              <div key={error.id} className={`error-item ${getSeverityClass(error.severity)}`}>
                <div className="error-header">
                  <span className="error-severity">{getSeverityIcon(error.severity)}</span>
                  <span className="error-message">{error.message}</span>
                  <span className="error-module">({error.module})</span>
                </div>

                <div className="error-meta">
                  <span className="error-time">{formatTimestamp(error.timestamp)}</span>
                  {error.recoverable && <span className="error-recoverable">🔄 Recoverable</span>}
                </div>

                {error.details && (
                  <details className="error-details">
                    <summary>Technical Details</summary>
                    <pre className="error-details-content">
                      {typeof error.details === 'object'
                        ? JSON.stringify(error.details, null, 2)
                        : String(error.details)}
                    </pre>
                  </details>
                )}
              </div>
            ))}

            {errors.length > 3 && (
              <div className="errors-more">+{errors.length - 3} more errors</div>
            )}
          </div>
        </div>
      )}

      {/* Stage-specific Information */}
      {currentStage.status === 'running' && (
        <div className="stage-info">
          <div className="stage-info-header">
            <h4>Current Stage: {currentStage.name}</h4>
          </div>

          <div className="stage-info-content">
            <p>{currentStage.details.description}</p>

            {currentStage.details.currentTask && (
              <div className="current-task">
                <strong>Current Task:</strong> {currentStage.details.currentTask}
              </div>
            )}

            {currentStage.progress > 0 && (
              <div className="stage-progress-bar">
                <div className="stage-progress-label">
                  Stage Progress: {Math.round(currentStage.progress)}%
                </div>
                <div className="stage-progress-track">
                  <div
                    className="stage-progress-fill"
                    style={{ width: `${currentStage.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Information */}
      {currentStage.status === 'completed' && (
        <div className="success-info">
          <div className="success-message">
            <h4>🎉 Conversion Completed Successfully!</h4>
            <p>Your Minecraft Java mod has been successfully converted to a Bedrock addon.</p>
          </div>

          <div className="success-stats">
            <div className="stat-item">
              <span className="stat-label">Total Time:</span>
              <span className="stat-value">
                {progress.startTime
                  ? Math.round((Date.now() - progress.startTime.getTime()) / 1000) + 's'
                  : 'N/A'}
              </span>
            </div>

            <div className="stat-item">
              <span className="stat-label">Warnings:</span>
              <span className="stat-value">{warnings.length}</span>
            </div>

            <div className="stat-item">
              <span className="stat-label">Errors:</span>
              <span className="stat-value">{errors.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Failure Information */}
      {currentStage.status === 'failed' && (
        <div className="failure-info">
          <div className="failure-message">
            <h4>❌ Conversion Failed</h4>
            <p>The conversion process encountered critical errors and could not complete.</p>
          </div>

          <div className="failure-actions">
            <button className="retry-button">🔄 Retry Conversion</button>
            <button className="support-button">📞 Contact Support</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedStatusDisplay;
