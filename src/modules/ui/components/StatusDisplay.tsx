import React from 'react';
import { ConversionProgress } from '../types';

interface StatusDisplayProps {
  progress: ConversionProgress;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ progress }) => {
  const getStatusMessage = () => {
    switch (progress.stage) {
      case 'uploading':
        return 'Uploading your mod file...';
      case 'analyzing':
        return 'Analyzing mod structure and compatibility...';
      case 'converting':
        return 'Converting mod components to Bedrock format...';
      case 'packaging':
        return 'Packaging addon files...';
      case 'complete':
        return 'Conversion complete!';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = () => {
    if (progress.error) {
      return '❌';
    }
    
    switch (progress.stage) {
      case 'complete':
        return '✅';
      default:
        return '⏳';
    }
  };

  return (
    <div className={`status-display ${progress.error ? 'error' : progress.stage}`}>
      <div className="status-icon">
        {getStatusIcon()}
      </div>
      <div className="status-content">
        <h3 className="status-title">{getStatusMessage()}</h3>
        {progress.currentTask && (
          <p className="status-detail">{progress.currentTask}</p>
        )}
        {progress.error && (
          <div className="status-error">
            <p>{progress.error}</p>
            <button className="retry-button">Retry</button>
          </div>
        )}
      </div>
      <div className="status-percentage">
        {progress.stage === 'complete' ? 'Done' : `${Math.round(progress.percentage)}%`}
      </div>
    </div>
  );
};

export default StatusDisplay;