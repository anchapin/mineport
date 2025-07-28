import React from 'react';
import { StrategyPreview } from '../services/CompromisePreferencesService';

interface StrategyPreviewPanelProps {
  previews: StrategyPreview[];
  onPreviewUpdate?: (featureId: string) => void;
}

export const StrategyPreviewPanel: React.FC<StrategyPreviewPanelProps> = ({
  previews,
  onPreviewUpdate
}) => {
  const handleRefreshPreview = (featureId: string) => {
    if (onPreviewUpdate) {
      onPreviewUpdate(featureId);
    }
  };

  return (
    <div className="strategy-preview-panel">
      <h3>Strategy Preview</h3>
      <p className="preview-description">
        Preview how your compromise strategy preferences will affect feature conversion:
      </p>
      
      {previews.length === 0 ? (
        <div className="no-previews">
          <p>No features available for preview. Upload a mod to see strategy effects.</p>
        </div>
      ) : (
        <div className="preview-list">
          {previews.map(preview => (
            <div key={preview.featureId} className="preview-item">
              <div className="preview-header">
                <h4>{preview.featureName}</h4>
                <span className={`strategy-badge ${preview.userConfigurable ? 'configurable' : 'not-configurable'}`}>
                  {preview.strategyName}
                </span>
              </div>
              
              {preview.previewResult ? (
                <div className="preview-content">
                  <div className="strategy-type">
                    <strong>Type:</strong> {preview.previewResult.type}
                  </div>
                  
                  <div className="strategy-description">
                    <strong>Description:</strong> {preview.previewResult.description}
                  </div>
                  
                  <div className="implementation-details">
                    <strong>Implementation:</strong>
                    <p>{preview.previewResult.implementationDetails}</p>
                  </div>
                  
                  {preview.previewResult.limitations && preview.previewResult.limitations.length > 0 && (
                    <div className="limitations">
                      <strong>Limitations:</strong>
                      <ul>
                        {preview.previewResult.limitations.map((limitation: string, index: number) => (
                          <li key={index}>{limitation}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {preview.userConfigurable && (
                    <div className="preview-actions">
                      <button 
                        className="refresh-preview-btn"
                        onClick={() => handleRefreshPreview(preview.featureId)}
                      >
                        Refresh Preview
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-strategy">
                  <p>No applicable compromise strategy found for this feature.</p>
                  <p className="suggestion">
                    This feature may not be convertible or may require manual intervention.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="preview-legend">
        <h4>Legend:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="strategy-badge configurable">Configurable</span>
            <span>Strategy can be customized through preferences</span>
          </div>
          <div className="legend-item">
            <span className="strategy-badge not-configurable">Fixed</span>
            <span>Strategy behavior is fixed or no strategy available</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyPreviewPanel;