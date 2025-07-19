import React, { useState } from 'react';

// Define types for the compatibility report
interface FeatureItem {
  id: string;
  name: string;
  description: string;
  compatibilityTier: 1 | 2 | 3 | 4;
  sourceFiles: string[];
  compromiseStrategy?: {
    type: string;
    description: string;
    limitations: string[];
  };
}

interface CompatibilityReport {
  tier1Features: FeatureItem[]; // Fully Translatable
  tier2Features: FeatureItem[]; // Approximation Possible
  tier3Features: FeatureItem[]; // Natively Impossible
  tier4Features: FeatureItem[]; // Unanalyzable
}

interface ConversionResult {
  modId: string;
  modName: string;
  modVersion: string;
  modLoader: 'forge' | 'fabric';
  compatibilityReport: CompatibilityReport;
  downloadUrl: string;
  reportUrl: string;
}

interface ResultsDashboardProps {
  result: ConversionResult;
  onDownload: () => void;
  onViewReport: () => void;
  onNewConversion: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  result,
  onDownload,
  onViewReport,
  onNewConversion
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'features' | 'compromises'>('summary');
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  // Calculate statistics
  const totalFeatures = 
    result.compatibilityReport.tier1Features.length +
    result.compatibilityReport.tier2Features.length +
    result.compatibilityReport.tier3Features.length +
    result.compatibilityReport.tier4Features.length;
  
  const conversionRate = Math.round(
    ((result.compatibilityReport.tier1Features.length + 
      result.compatibilityReport.tier2Features.length) / totalFeatures) * 100
  );

  const getTierLabel = (tier: 1 | 2 | 3 | 4) => {
    switch (tier) {
      case 1: return 'Fully Translatable';
      case 2: return 'Approximation Possible';
      case 3: return 'Natively Impossible';
      case 4: return 'Unanalyzable';
    }
  };

  const getTierColor = (tier: 1 | 2 | 3 | 4) => {
    switch (tier) {
      case 1: return 'green';
      case 2: return 'blue';
      case 3: return 'orange';
      case 4: return 'red';
    }
  };

  const renderFeatureList = (features: FeatureItem[]) => {
    return features.map(feature => (
      <div 
        key={feature.id} 
        className={`feature-item tier-${feature.compatibilityTier} ${expandedFeature === feature.id ? 'expanded' : ''}`}
        onClick={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
      >
        <div className="feature-header">
          <span className={`feature-tier tier-${feature.compatibilityTier}`}>
            {getTierLabel(feature.compatibilityTier)}
          </span>
          <h4 className="feature-name">{feature.name}</h4>
          <span className="expand-icon">{expandedFeature === feature.id ? '▼' : '▶'}</span>
        </div>
        
        {expandedFeature === feature.id && (
          <div className="feature-details">
            <p>{feature.description}</p>
            
            <div className="feature-source">
              <h5>Source Files:</h5>
              <ul>
                {feature.sourceFiles.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
              </ul>
            </div>
            
            {feature.compromiseStrategy && (
              <div className="compromise-strategy">
                <h5>Compromise Strategy:</h5>
                <p><strong>Type:</strong> {feature.compromiseStrategy.type}</p>
                <p>{feature.compromiseStrategy.description}</p>
                
                {feature.compromiseStrategy.limitations.length > 0 && (
                  <>
                    <h6>Limitations:</h6>
                    <ul>
                      {feature.compromiseStrategy.limitations.map((limitation, index) => (
                        <li key={index}>{limitation}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="results-dashboard">
      <header className="dashboard-header">
        <h2>Conversion Results</h2>
        <div className="mod-info">
          <h3>{result.modName} <span className="mod-version">v{result.modVersion}</span></h3>
          <p>Mod ID: {result.modId} | Loader: {result.modLoader.toUpperCase()}</p>
        </div>
      </header>
      
      <div className="dashboard-actions">
        <button className="download-button" onClick={onDownload}>
          Download .mcaddon
        </button>
        <button className="report-button" onClick={onViewReport}>
          View Full Report
        </button>
        <button className="new-conversion-button" onClick={onNewConversion}>
          Convert Another Mod
        </button>
      </div>
      
      <div className="dashboard-tabs">
        <button 
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button 
          className={`tab ${activeTab === 'features' ? 'active' : ''}`}
          onClick={() => setActiveTab('features')}
        >
          Features
        </button>
        <button 
          className={`tab ${activeTab === 'compromises' ? 'active' : ''}`}
          onClick={() => setActiveTab('compromises')}
        >
          Compromises
        </button>
      </div>
      
      <div className="dashboard-content">
        {activeTab === 'summary' && (
          <div className="summary-tab">
            <div className="conversion-stats">
              <div className="stat-card">
                <h4>Conversion Rate</h4>
                <div className="stat-value">{conversionRate}%</div>
                <div className="stat-description">of features successfully converted</div>
              </div>
              
              <div className="stat-card">
                <h4>Total Features</h4>
                <div className="stat-value">{totalFeatures}</div>
                <div className="stat-description">detected in the mod</div>
              </div>
              
              <div className="stat-card">
                <h4>Compromises</h4>
                <div className="stat-value">{result.compatibilityReport.tier3Features.length}</div>
                <div className="stat-description">features with compromise strategies</div>
              </div>
            </div>
            
            <div className="compatibility-chart">
              <h4>Compatibility Breakdown</h4>
              <div className="chart-container">
                {/* This would be a chart in a real implementation */}
                <div className="chart-bar-container">
                  <div 
                    className="chart-bar tier-1" 
                    style={{ width: `${(result.compatibilityReport.tier1Features.length / totalFeatures) * 100}%` }}
                  >
                    {result.compatibilityReport.tier1Features.length}
                  </div>
                  <div 
                    className="chart-bar tier-2" 
                    style={{ width: `${(result.compatibilityReport.tier2Features.length / totalFeatures) * 100}%` }}
                  >
                    {result.compatibilityReport.tier2Features.length}
                  </div>
                  <div 
                    className="chart-bar tier-3" 
                    style={{ width: `${(result.compatibilityReport.tier3Features.length / totalFeatures) * 100}%` }}
                  >
                    {result.compatibilityReport.tier3Features.length}
                  </div>
                  <div 
                    className="chart-bar tier-4" 
                    style={{ width: `${(result.compatibilityReport.tier4Features.length / totalFeatures) * 100}%` }}
                  >
                    {result.compatibilityReport.tier4Features.length}
                  </div>
                </div>
                
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-color tier-1"></span>
                    <span className="legend-label">Fully Translatable</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color tier-2"></span>
                    <span className="legend-label">Approximation Possible</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color tier-3"></span>
                    <span className="legend-label">Natively Impossible</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color tier-4"></span>
                    <span className="legend-label">Unanalyzable</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="next-steps">
              <h4>Next Steps</h4>
              <ol>
                <li>Download the converted .mcaddon file</li>
                <li>Review the conversion report for any manual steps needed</li>
                <li>Test the addon in Minecraft Bedrock Edition</li>
                <li>Make any necessary manual adjustments based on the report</li>
              </ol>
            </div>
          </div>
        )}
        
        {activeTab === 'features' && (
          <div className="features-tab">
            <div className="feature-filters">
              <button className="filter-button active">All Features</button>
              <button className="filter-button">Tier 1</button>
              <button className="filter-button">Tier 2</button>
              <button className="filter-button">Tier 3</button>
              <button className="filter-button">Tier 4</button>
            </div>
            
            <div className="feature-list">
              <h4>Tier 1: Fully Translatable</h4>
              {renderFeatureList(result.compatibilityReport.tier1Features)}
              
              <h4>Tier 2: Approximation Possible</h4>
              {renderFeatureList(result.compatibilityReport.tier2Features)}
              
              <h4>Tier 3: Natively Impossible</h4>
              {renderFeatureList(result.compatibilityReport.tier3Features)}
              
              <h4>Tier 4: Unanalyzable</h4>
              {renderFeatureList(result.compatibilityReport.tier4Features)}
            </div>
          </div>
        )}
        
        {activeTab === 'compromises' && (
          <div className="compromises-tab">
            <div className="compromise-explanation">
              <h4>About Compromise Strategies</h4>
              <p>
                Compromise strategies are applied to features that cannot be directly translated to Bedrock Edition.
                These strategies aim to preserve the core functionality and experience of the original mod while
                working within the limitations of the Bedrock API.
              </p>
            </div>
            
            <div className="compromise-list">
              <h4>Applied Compromise Strategies</h4>
              {renderFeatureList(result.compatibilityReport.tier3Features)}
            </div>
            
            <div className="manual-steps">
              <h4>Manual Post-Processing Steps</h4>
              <p>
                Some compromises may require manual adjustments after conversion. Please refer to the
                full conversion report for detailed instructions on any manual steps needed.
              </p>
              <button className="view-report-button" onClick={onViewReport}>
                View Full Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsDashboard;