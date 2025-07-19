import React from 'react';
import { ConversionProgress } from '../types';

interface ProgressTrackerProps {
  progress: ConversionProgress;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ progress }) => {
  const stages = [
    { id: 'uploading', label: 'Upload' },
    { id: 'analyzing', label: 'Analysis' },
    { id: 'converting', label: 'Conversion' },
    { id: 'packaging', label: 'Packaging' },
    { id: 'complete', label: 'Complete' }
  ];

  const currentStageIndex = stages.findIndex(stage => stage.id === progress.stage);

  return (
    <div className="progress-tracker">
      <div className="progress-stages">
        {stages.map((stage, index) => {
          const isActive = index === currentStageIndex;
          const isCompleted = index < currentStageIndex;
          
          return (
            <div 
              key={stage.id} 
              className={`stage ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <div className="stage-indicator">
                {isCompleted ? '✓' : index + 1}
              </div>
              <div className="stage-label">{stage.label}</div>
              {index < stages.length - 1 && (
                <div className={`stage-connector ${isCompleted ? 'completed' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="progress-bar-container">
        <div 
          className="progress-bar" 
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      
      {progress.currentTask && (
        <div className="current-task">
          {progress.currentTask}
        </div>
      )}
      
      {progress.error && (
        <div className="progress-error">
          Error: {progress.error}
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;