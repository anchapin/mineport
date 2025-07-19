import React, { useState } from 'react';
import { FileUploader, ProgressTracker, StatusDisplay, SettingsPanel } from '../components';
import { ConversionProgress, UploadState, UserPreferences } from '../types';

export const ConversionPage: React.FC = () => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0
  });
  
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress | undefined>();
  
  const [showSettings, setShowSettings] = useState(false);
  
  // Default user preferences
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    theme: 'light',
    compromiseStrategies: [
      {
        id: 'dimension-simulation',
        name: 'Custom Dimension Simulation',
        description: 'Simulates custom dimensions using teleportation and visual effects',
        isEnabled: true,
        options: [
          {
            id: 'visual-effects',
            name: 'Visual Effects',
            value: true,
            type: 'boolean'
          },
          {
            id: 'structure-generation',
            name: 'Structure Generation',
            value: true,
            type: 'boolean'
          }
        ]
      },
      {
        id: 'rendering-stubbing',
        name: 'Rendering Code Stubbing',
        description: 'Creates stubs for advanced rendering code with appropriate warnings',
        isEnabled: true,
        options: [
          {
            id: 'stub-type',
            name: 'Stub Type',
            value: 'warning',
            type: 'select',
            options: [
              { label: 'Warning Only', value: 'warning' },
              { label: 'Basic Approximation', value: 'basic' },
              { label: 'Detailed Placeholder', value: 'detailed' }
            ]
          }
        ]
      },
      {
        id: 'ui-flow-mapping',
        name: 'UI/HUD Flow Mapping',
        description: 'Maps Java UI components to Bedrock form types',
        isEnabled: true,
        options: []
      }
    ],
    conversionOptions: {
      generateDebugInfo: false,
      optimizeOutput: true,
      includeComments: true,
      targetMinecraftVersion: '1.20.0'
    }
  });

  const handleFileSelected = (file: File) => {
    setUploadState(prev => ({
      ...prev,
      file,
      error: undefined
    }));
  };

  const handleSourceRepoChange = (repo: string) => {
    setUploadState(prev => ({
      ...prev,
      sourceRepo: repo
    }));
  };

  const startConversion = async () => {
    if (!uploadState.file) {
      return;
    }

    try {
      // Set uploading state
      setUploadState(prev => ({
        ...prev,
        isUploading: true,
        error: undefined
      }));

      setConversionProgress({
        stage: 'uploading',
        percentage: 0,
        currentTask: 'Preparing to upload mod file'
      });

      // Simulate file upload progress
      const uploadInterval = setInterval(() => {
        setUploadState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 100)
        }));
        
        setConversionProgress(prev => prev ? {
          ...prev,
          percentage: Math.min(prev.percentage + 10, 100)
        } : undefined);
        
      }, 300);

      // Simulate upload completion after 3 seconds
      setTimeout(() => {
        clearInterval(uploadInterval);
        
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          progress: 100
        }));
        
        // Move to analysis stage
        setConversionProgress({
          stage: 'analyzing',
          percentage: 0,
          currentTask: 'Analyzing mod structure'
        });
        
        // Simulate analysis progress
        simulateConversionStage('analyzing', 'Converting assets', 'converting');
      }, 3000);
      
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: 'Failed to upload file. Please try again.'
      }));
      
      setConversionProgress(prev => prev ? {
        ...prev,
        error: 'Upload failed'
      } : undefined);
    }
  };

  // Helper function to simulate conversion stages
  const simulateConversionStage = (
    currentStage: ConversionProgress['stage'], 
    nextTask: string, 
    nextStage: ConversionProgress['stage']
  ) => {
    let progress = 0;
    
    const interval = setInterval(() => {
      progress += 5;
      
      setConversionProgress(prev => prev ? {
        ...prev,
        percentage: Math.min(progress, 100)
      } : undefined);
      
      if (progress >= 100) {
        clearInterval(interval);
        
        // Move to next stage
        setTimeout(() => {
          setConversionProgress({
            stage: nextStage,
            percentage: 0,
            currentTask: nextTask
          });
          
          if (nextStage === 'converting') {
            simulateConversionStage('converting', 'Packaging addon files', 'packaging');
          } else if (nextStage === 'packaging') {
            simulateConversionStage('packaging', 'Finalizing conversion', 'complete');
          }
        }, 500);
      }
    }, 200);
  };

  return (
    <div className="conversion-page">
      <header className="page-header">
        <h1>Minecraft Mod Converter</h1>
        <p>Convert Java Edition mods to Bedrock Edition addons</p>
        <button 
          className="settings-button"
          onClick={() => setShowSettings(true)}
        >
          Settings
        </button>
      </header>
      
      <main className="page-content">
        {!conversionProgress || conversionProgress.stage === 'uploading' ? (
          <section className="upload-section">
            <FileUploader 
              onFileSelected={handleFileSelected}
              onSourceRepoChange={handleSourceRepoChange}
              uploadState={uploadState}
            />
            <button 
              className="start-conversion-button"
              disabled={!uploadState.file || uploadState.isUploading}
              onClick={startConversion}
            >
              {uploadState.isUploading ? 'Uploading...' : 'Start Conversion'}
            </button>
          </section>
        ) : (
          <section className="conversion-section">
            <ProgressTracker progress={conversionProgress} />
            <StatusDisplay progress={conversionProgress} />
            
            {conversionProgress.stage === 'complete' && (
              <div className="conversion-complete">
                <h2>Conversion Complete!</h2>
                <p>Your Bedrock addon is ready for download.</p>
                <button className="download-button">Download .mcaddon</button>
                <button className="view-report-button">View Conversion Report</button>
                <button className="view-dashboard-button" onClick={() => {
                  // In a real application, this would navigate to the ResultsDashboard
                  // with the conversion results
                  console.log('Navigate to results dashboard');
                }}>
                  View Results Dashboard
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      
      <footer className="page-footer">
        <p>Minecraft Mod Converter &copy; 2025</p>
      </footer>
      
      {showSettings && (
        <div className="settings-overlay">
          <SettingsPanel 
            preferences={userPreferences}
            onSave={(newPreferences) => {
              setUserPreferences(newPreferences);
              setShowSettings(false);
              
              // In a real application, we would save these preferences to localStorage
              console.log('Saving preferences:', newPreferences);
            }}
            onCancel={() => setShowSettings(false)}
          />
        </div>
      )}
    </div>
  );
};

export default ConversionPage;