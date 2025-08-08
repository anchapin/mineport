/**
 * Results Display Component
 * 
 * This component displays comprehensive conversion results including
 * statistics, validation results, and download options.
 */

import React, { useState } from 'react';
import { ConversionResults } from './EnhancedConversionUI.js';

export interface ResultsDisplayProps {
  results: ConversionResults;
  onDownload: () => void;
}

/**
 * Results Display Component
 */
export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  onDownload
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'statistics' | 'validation' | 'compromises'>('summary');

  /**
   * Format processing time
   */
  const formatProcessingTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  /**
   * Get validation status icon
   */
  const getValidationIcon = (passed: boolean): string => {
    return passed ? '✅' : '❌';
  };

  return (
    <div className="results-display">
      <div className="results-header">
        <h2>🎉 Conversion Complete!</h2>
        <div className="results-actions">
          <button className="download-button primary" onClick={onDownload}>
            📥 Download Addon
          </button>
          <button className="share-button">
            🔗 Share Results
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="results-tabs">
        <button
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          Statistics
        </button>
        <button
          className={`tab ${activeTab === 'validation' ? 'active' : ''}`}
          onClick={() => setActiveTab('validation')}
        >
          Validation
        </button>
        <button
          className={`tab ${activeTab === 'compromises' ? 'active' : ''}`}
          onClick={() => setActiveTab('compromises')}
        >
          Compromises ({results.report.compromises.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="results-content">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="summary-tab">
            <div className="summary-overview">
              <h3>Conversion Summary</h3>
              <p className="summary-text">{results.report.summary}</p>
              
              <div className="summary-metrics">
                <div className="metric-card">
                  <div className="metric-value">{results.statistics.filesProcessed}</div>
                  <div className="metric-label">Files Processed</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{results.statistics.assetsConverted}</div>
                  <div className="metric-label">Assets Converted</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{formatProcessingTime(results.statistics.processingTime)}</div>
                  <div className="metric-label">Processing Time</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">
                    {getValidationIcon(results.validationResults.passed)}
                  </div>
                  <div className="metric-label">Validation</div>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {results.report.warnings.length > 0 && (
              <div className="summary-warnings">
                <h4>⚠️ Warnings ({results.report.warnings.length})</h4>
                <ul className="warning-list">
                  {results.report.warnings.map((warning, index) => (
                    <li key={index} className="warning-item">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {results.report.recommendations.length > 0 && (
              <div className="summary-recommendations">
                <h4>💡 Recommendations</h4>
                <ul className="recommendation-list">
                  {results.report.recommendations.map((recommendation, index) => (
                    <li key={index} className="recommendation-item">
                      {recommendation}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'statistics' && (
          <div className="statistics-tab">
            <h3>Detailed Statistics</h3>
            
            <div className="statistics-grid">
              <div className="stat-section">
                <h4>File Processing</h4>
                <div className="stat-items">
                  <div className="stat-item">
                    <span className="stat-label">Total Files:</span>
                    <span className="stat-value">{results.statistics.filesProcessed}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Assets Converted:</span>
                    <span className="stat-value">{results.statistics.assetsConverted}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Configurations Mapped:</span>
                    <span className="stat-value">{results.statistics.configurationsMapped}</span>
                  </div>
                </div>
              </div>

              <div className="stat-section">
                <h4>Code Translation</h4>
                <div className="stat-items">
                  <div className="stat-item">
                    <span className="stat-label">Code Translated:</span>
                    <span className="stat-value">{results.statistics.codeTranslated} lines</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Translation Method:</span>
                    <span className="stat-value">AST + LLM Hybrid</span>
                  </div>
                </div>
              </div>

              <div className="stat-section">
                <h4>Performance</h4>
                <div className="stat-items">
                  <div className="stat-item">
                    <span className="stat-label">Total Time:</span>
                    <span className="stat-value">{formatProcessingTime(results.statistics.processingTime)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Average per File:</span>
                    <span className="stat-value">
                      {results.statistics.filesProcessed > 0 
                        ? formatProcessingTime(results.statistics.processingTime / results.statistics.filesProcessed)
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Validation Tab */}
        {activeTab === 'validation' && (
          <div className="validation-tab">
            <h3>Validation Results</h3>
            
            <div className="validation-overview">
              <div className={`validation-status ${results.validationResults.passed ? 'passed' : 'failed'}`}>
                <span className="validation-icon">
                  {getValidationIcon(results.validationResults.passed)}
                </span>
                <span className="validation-text">
                  Overall Validation: {results.validationResults.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            </div>

            <div className="validation-stages">
              <h4>Validation Stages</h4>
              <div className="stage-list">
                {results.validationResults.stages.map((stage, index) => (
                  <div key={index} className={`validation-stage ${stage.passed ? 'passed' : 'failed'}`}>
                    <div className="stage-header">
                      <span className="stage-icon">
                        {getValidationIcon(stage.passed)}
                      </span>
                      <span className="stage-name">{stage.name}</span>
                      <span className="stage-status">
                        {stage.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                    
                    {stage.errors.length > 0 && (
                      <div className="stage-errors">
                        <h5>Errors:</h5>
                        <ul>
                          {stage.errors.map((error, errorIndex) => (
                            <li key={errorIndex} className="stage-error">
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {stage.warnings.length > 0 && (
                      <div className="stage-warnings">
                        <h5>Warnings:</h5>
                        <ul>
                          {stage.warnings.map((warning, warningIndex) => (
                            <li key={warningIndex} className="stage-warning">
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compromises Tab */}
        {activeTab === 'compromises' && (
          <div className="compromises-tab">
            <h3>Compromise Strategies Applied</h3>
            
            {results.report.compromises.length === 0 ? (
              <div className="no-compromises">
                <p>🎉 No compromises were needed! Your mod was fully convertible to Bedrock Edition.</p>
              </div>
            ) : (
              <div className="compromises-list">
                <div className="compromises-intro">
                  <p>
                    The following features couldn't be directly converted and required compromise strategies.
                    These compromises maintain the core functionality while adapting to Bedrock's limitations.
                  </p>
                </div>
                
                {results.report.compromises.map((compromise, index) => (
                  <div key={index} className="compromise-item">
                    <div className="compromise-header">
                      <h4 className="compromise-feature">{compromise.feature}</h4>
                      <span className="compromise-strategy">{compromise.strategy}</span>
                    </div>
                    
                    <div className="compromise-description">
                      <p>{compromise.description}</p>
                    </div>
                    
                    <div className="compromise-impact">
                      <strong>Impact:</strong> {compromise.impact}
                    </div>
                  </div>
                ))}
                
                <div className="compromises-note">
                  <p>
                    <strong>Note:</strong> These compromises are designed to preserve the core gameplay
                    experience while working within Bedrock Edition's capabilities. The converted addon
                    should provide similar functionality to the original Java mod.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Download Section */}
      <div className="results-download">
        <div className="download-info">
          <h3>Download Your Converted Addon</h3>
          <p>Your Minecraft Java mod has been successfully converted to a Bedrock Edition addon.</p>
          
          <div className="download-details">
            <div className="detail-item">
              <span className="detail-label">Output Format:</span>
              <span className="detail-value">.mcaddon</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Compatible With:</span>
              <span className="detail-value">Minecraft Bedrock Edition</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Installation:</span>
              <span className="detail-value">Double-click to install</span>
            </div>
          </div>
        </div>
        
        <div className="download-actions">
          <button className="download-button primary large" onClick={onDownload}>
            📥 Download Addon (.mcaddon)
          </button>
          
          <div className="additional-actions">
            <button className="action-button">
              📋 Copy Installation Instructions
            </button>
            <button className="action-button">
              📧 Email Results
            </button>
            <button className="action-button">
              🐛 Report Issues
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;