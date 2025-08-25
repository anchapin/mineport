import React, { useState } from 'react';
import { FileUploader, ProgressTracker, StatusDisplay, SettingsPanel } from '../components';
import { useConversion } from '../hooks/useConversion.js';
import { ConversionProvider } from '../context/ConversionContext.js';

// Wrapper component that provides the ConversionProvider
export const ConversionPage: React.FC = () => {
  return (
    <ConversionProvider>
      <ConversionPageContent />
    </ConversionProvider>
  );
};

// Main component that uses the ConversionContext
const ConversionPageContent: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);

  const {
    uploadState,
    conversionProgress,
    handleFileSelected,
    handleSourceRepoChange,
    handlePreferencesChange,
    startConversion,
    cancelConversion,
  } = useConversion();

  return (
    <div className="conversion-page">
      <header className="page-header">
        <h1>Minecraft Mod Converter</h1>
        <p>Convert Java Edition mods to Bedrock Edition addons</p>
        <button className="settings-button" onClick={() => setShowSettings(true)}>
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
                <button
                  className="view-dashboard-button"
                  onClick={() => {
                    // In a real application, this would navigate to the ResultsDashboard
                    // with the conversion results
                    console.log('Navigate to results dashboard');
                  }}
                >
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
            preferences={useConversion().state.userPreferences}
            onSave={(newPreferences: any) => {
              handlePreferencesChange(newPreferences);
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
