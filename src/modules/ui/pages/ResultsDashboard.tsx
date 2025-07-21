/**
 * ResultsDashboard Component
 * 
 * This component displays the results of a conversion.
 */

import React from 'react';
import { useConversionContext } from '../context/ConversionContext';

export const ResultsDashboard: React.FC = () => {
  const { state } = useConversionContext();
  const { conversionResult } = state;
  
  if (!conversionResult) {
    return (
      <div className="results-dashboard">
        <h1>No Conversion Results</h1>
        <p>No conversion results are available. Please complete a conversion first.</p>
        <button onClick={() => window.history.back()}>Go Back</button>
      </div>
    );
  }
  
  return (
    <div className="results-dashboard">
      <h1>Conversion Results</h1>
      
      <div className="results-summary">
        <h2>Summary</h2>
        <div className="summary-status">
          <span className={`status-badge ${conversionResult.success ? 'success' : 'failure'}`}>
            {conversionResult.success ? 'Success' : 'Failed'}
          </span>
        </div>
        
        <div className="summary-errors">
          <h3>Error Summary</h3>
          <ul className="error-counts">
            <li>
              <span className="error-type critical">Critical Errors:</span>
              <span className="error-count">{conversionResult.errorSummary.criticalErrors}</span>
            </li>
            <li>
              <span className="error-type error">Errors:</span>
              <span className="error-count">{conversionResult.errorSummary.errors}</span>
            </li>
            <li>
              <span className="error-type warning">Warnings:</span>
              <span className="error-count">{conversionResult.errorSummary.warnings}</span>
            </li>
            <li>
              <span className="error-type info">Info:</span>
              <span className="error-count">{conversionResult.errorSummary.info}</span>
            </li>
            <li>
              <span className="error-type total">Total:</span>
              <span className="error-count">{conversionResult.errorSummary.totalErrors}</span>
            </li>
          </ul>
        </div>
      </div>
      
      {conversionResult.criticalErrors && conversionResult.criticalErrors.length > 0 && (
        <div className="critical-errors">
          <h2>Critical Issues</h2>
          <ul className="error-list">
            {conversionResult.criticalErrors.map((error, index) => (
              <li key={index} className="error-item">
                <div className="error-header">
                  <span className={`error-severity ${error.severity.toLowerCase()}`}>
                    {error.severity}
                  </span>
                  <span className="error-code">{error.code}</span>
                  <span className="error-module">{error.moduleOrigin}</span>
                </div>
                <div className="error-message">{error.message}</div>
                {error.sourceLocation && (
                  <div className="error-location">
                    <span className="location-file">{error.sourceLocation.file}</span>
                    <span className="location-position">
                      Line {error.sourceLocation.line}, Column {error.sourceLocation.column}
                    </span>
                  </div>
                )}
                {error.recommendedFix && (
                  <div className="error-fix">
                    <strong>Recommended Fix:</strong> {error.recommendedFix}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="download-section">
        <h2>Downloads</h2>
        {conversionResult.downloadUrl && (
          <a 
            href={conversionResult.downloadUrl} 
            className="download-button"
            download
          >
            Download Addon (.mcaddon)
          </a>
        )}
        
        {conversionResult.reportUrl && (
          <a 
            href={conversionResult.reportUrl} 
            className="report-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Detailed Report
          </a>
        )}
      </div>
      
      <div className="action-buttons">
        <button 
          className="new-conversion-button"
          onClick={() => window.history.back()}
        >
          Start New Conversion
        </button>
      </div>
    </div>
  );
};

export default ResultsDashboard;