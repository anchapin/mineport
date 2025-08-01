/**
 * Enhanced Progress Tracker Component
 * 
 * This component provides detailed progress tracking for the enhanced conversion system,
 * showing real-time updates from the ValidationPipeline stages and providing visual
 * feedback on the conversion process.
 */

import React from 'react';
import { ConversionStage, ProgressInfo } from './EnhancedConversionUI';

export interface EnhancedProgressTrackerProps {
  progress: ProgressInfo;
  currentStage: ConversionStage;
}

/**
 * Enhanced Progress Tracker Component
 */
export const EnhancedProgressTracker: React.FC<EnhancedProgressTrackerProps> = ({
  progress,
  currentStage
}) => {
  const stages = [
    { id: 'initializing', label: 'Initialize', icon: '🚀' },
    { id: 'queued', label: 'Queued', icon: '⏳' },
    { id: 'validating', label: 'Validate', icon: '🔍' },
    { id: 'analyzing', label: 'Analyze', icon: '🧠' },
    { id: 'converting_assets', label: 'Assets', icon: '🎨' },
    { id: 'converting_config', label: 'Config', icon: '⚙️' },
    { id: 'translating_logic', label: 'Logic', icon: '💻' },
    { id: 'validating_output', label: 'Validate', icon: '✅' },
    { id: 'packaging', label: 'Package', icon: '📦' },
    { id: 'completed', label: 'Complete', icon: '🎉' }
  ];

  const getCurrentStageIndex = () => {
    return stages.findIndex(stage => stage.id === currentStage.name);
  };

  const currentStageIndex = getCurrentStageIndex();

  const getStageStatus = (index: number) => {
    if (index < currentStageIndex) return 'completed';
    if (index === currentStageIndex) {
      switch (currentStage.status) {
        case 'running': return 'active';
        case 'completed': return 'completed';
        case 'failed': return 'failed';
        default: return 'pending';
      }
    }
    return 'pending';
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getElapsedTime = (): string => {
    if (!progress.startTime) return '';
    const elapsed = (Date.now() - progress.startTime.getTime()) / 1000;
    return formatTime(elapsed);
  };

  return (
    <div className="enhanced-progress-tracker">
      {/* Overall Progress Bar */}
      <div className="overall-progress">
        <div className="progress-header">
          <h3>Conversion Progress</h3>
          <div className="progress-stats">
            <span className="percentage">{Math.round(progress.overall)}%</span>
            {progress.startTime && (
              <span className="elapsed-time">Elapsed: {getElapsedTime()}</span>
            )}
            {progress.estimatedTimeRemaining && (
              <span className="remaining-time">
                ETA: {formatTime(progress.estimatedTimeRemaining)}
              </span>
            )}
          </div>
        </div>
        
        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            style={{ width: `${progress.overall}%` }}
          />
        </div>
      </div>

      {/* Stage Progress */}
      <div className="stage-progress">
        <div className="stages-container">
          {stages.map((stage, index) => {
            const status = getStageStatus(index);
            const isActive = index === currentStageIndex;
            
            return (
              <div key={stage.id} className="stage-wrapper">
                <div className={`stage ${status} ${isActive ? 'active' : ''}`}>
                  <div className="stage-indicator">
                    <div className="stage-icon">
                      {status === 'completed' ? '✓' : 
                       status === 'failed' ? '❌' : 
                       status === 'active' ? (
                         <div className="spinner">{stage.icon}</div>
                       ) : stage.icon}
                    </div>
                    {isActive && currentStage.progress > 0 && (
                      <div className="stage-progress-ring">
                        <svg className="progress-ring" width="60" height="60">
                          <circle
                            className="progress-ring-background"
                            stroke="#e6e6e6"
                            strokeWidth="3"
                            fill="transparent"
                            r="26"
                            cx="30"
                            cy="30"
                          />
                          <circle
                            className="progress-ring-progress"
                            stroke="#4CAF50"
                            strokeWidth="3"
                            fill="transparent"
                            r="26"
                            cx="30"
                            cy="30"
                            strokeDasharray={`${2 * Math.PI * 26}`}
                            strokeDashoffset={`${2 * Math.PI * 26 * (1 - currentStage.progress / 100)}`}
                            transform="rotate(-90 30 30)"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="stage-label">
                    <span className="stage-name">{stage.label}</span>
                    {isActive && currentStage.progress > 0 && (
                      <span className="stage-percentage">
                        {Math.round(currentStage.progress)}%
                      </span>
                    )}
                  </div>
                </div>
                
                {index < stages.length - 1 && (
                  <div className={`stage-connector ${status === 'completed' ? 'completed' : ''}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Stage Details */}
      {currentStage.details && (
        <div className="current-stage-details">
          <div className="stage-description">
            <h4>{currentStage.details.description}</h4>
            {currentStage.details.currentTask && (
              <p className="current-task">{currentStage.details.currentTask}</p>
            )}
          </div>
          
          {/* Sub-tasks */}
          {currentStage.details.subTasks && currentStage.details.subTasks.length > 0 && (
            <div className="sub-tasks">
              <h5>Tasks:</h5>
              <ul className="sub-task-list">
                {currentStage.details.subTasks.map((subTask, index) => (
                  <li key={index} className={`sub-task ${subTask.completed ? 'completed' : ''}`}>
                    <span className="sub-task-icon">
                      {subTask.completed ? '✓' : '○'}
                    </span>
                    <span className="sub-task-name">{subTask.name}</span>
                    {subTask.progress !== undefined && !subTask.completed && (
                      <span className="sub-task-progress">
                        ({Math.round(subTask.progress)}%)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Stage Metadata */}
          {currentStage.details.metadata && Object.keys(currentStage.details.metadata).length > 0 && (
            <div className="stage-metadata">
              <details>
                <summary>Technical Details</summary>
                <div className="metadata-content">
                  {Object.entries(currentStage.details.metadata).map(([key, value]) => (
                    <div key={key} className="metadata-item">
                      <span className="metadata-key">{key}:</span>
                      <span className="metadata-value">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedProgressTracker;