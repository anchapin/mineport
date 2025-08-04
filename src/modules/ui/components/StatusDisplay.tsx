import React from 'react';
import { ConversionProgress } from '../types.js';

interface StatusDisplayProps {
  progress: ConversionProgress;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ progress }) => {
  const getStatusMessage = () => {
    switch (progress.stage) {
      case 'uploading':
        return 'Uploading your mod file...';
      case 'validating':
        return 'Validating mod structure and contents...';
      case 'analyzing':
        return 'Analyzing feature compatibility...';
      case 'assets':
        return 'Converting textures, models, and sounds...';
      case 'config':
        return 'Converting configuration files and manifests...';
      case 'logic':
        return 'Translating Java code to JavaScript...';
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