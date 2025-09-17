import React, { useState, useEffect } from 'react';
import { CompromiseStrategy, UserPreferences } from '../types/index.js';
import {
  CompromisePreferencesService,
  StrategyPreview,
} from '../services/CompromisePreferencesService.js';
import { StrategyPreviewPanel } from './StrategyPreviewPanel.js';
import { Feature } from '../../../types/compromise.js';

interface SettingsPanelProps {
  preferences: UserPreferences;
  onSave: (preferences: UserPreferences) => void;
  onCancel: () => void;
  preferencesService?: CompromisePreferencesService;
  sampleFeatures?: Feature[];
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  preferences,
  onSave,
  onCancel,
  preferencesService,
  sampleFeatures = [],
}) => {
  const [currentPreferences, setCurrentPreferences] = useState<UserPreferences>({ ...preferences });
  const [activeTab, setActiveTab] = useState<'general' | 'compromise' | 'preview' | 'advanced'>(
    'general'
  );
  const [strategyPreviews, setStrategyPreviews] = useState<StrategyPreview[]>([]);

  // Update previews when preferences change
  useEffect(() => {
    if (preferencesService && sampleFeatures.length > 0) {
      preferencesService.updatePreferences(currentPreferences);
      const previews = preferencesService.previewStrategyEffects(sampleFeatures);
      setStrategyPreviews(previews);
    }
  }, [currentPreferences, preferencesService, sampleFeatures]);

  const handleCompromiseStrategyToggle = (strategyId: string) => {
    setCurrentPreferences((prev) => ({
      ...prev,
      compromiseStrategies: prev.compromiseStrategies.map((strategy) =>
        strategy.id === strategyId ? { ...strategy, isEnabled: !strategy.isEnabled } : strategy
      ),
    }));
  };

  const handleCompromiseOptionChange = (
    strategyId: string,
    optionId: string,
    value: string | boolean | number
  ) => {
    setCurrentPreferences((prev) => ({
      ...prev,
      compromiseStrategies: prev.compromiseStrategies.map((strategy) =>
        strategy.id === strategyId
          ? {
              ...strategy,
              options: strategy.options?.map((option) =>
                option.id === optionId ? { ...option, value } : option
              ),
            }
          : strategy
      ),
    }));
  };

  const handleConversionOptionChange = (
    option: keyof UserPreferences['conversionOptions'],
    value: any
  ) => {
    setCurrentPreferences((prev) => ({
      ...prev,
      conversionOptions: {
        ...prev.conversionOptions,
        [option]: value,
      },
    }));
  };

  const handleThemeChange = (theme: 'light' | 'dark') => {
    setCurrentPreferences((prev) => ({
      ...prev,
      theme,
    }));
  };

  const handleSave = () => {
    // Update the preferences service with final preferences
    if (preferencesService) {
      preferencesService.updatePreferences(currentPreferences);
    }
    onSave(currentPreferences);
  };

  const handlePreviewUpdate = (featureId: string) => {
    if (preferencesService && sampleFeatures.length > 0) {
      const previews = preferencesService.previewStrategyEffects(sampleFeatures);
      setStrategyPreviews(previews);
    }
  };

  const renderCompromiseStrategies = () => {
    return currentPreferences.compromiseStrategies.map((strategy) => (
      <div key={strategy.id} className="compromise-strategy-item">
        <div className="strategy-header">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={strategy.isEnabled}
              onChange={() => handleCompromiseStrategyToggle(strategy.id)}
            />
            <span className="toggle-slider"></span>
          </label>
          <h4>{strategy.name}</h4>
        </div>

        <p className="strategy-description">{strategy.description}</p>

        {strategy.isEnabled && strategy.options && strategy.options.length > 0 && (
          <div className="strategy-options">
            {strategy.options.map((option) => (
              <div key={option.id} className="option-item">
                <label htmlFor={option.id}>{option.name}</label>

                {option.type === 'boolean' && (
                  <input
                    type="checkbox"
                    id={option.id}
                    checked={option.value as boolean}
                    onChange={(e) =>
                      handleCompromiseOptionChange(strategy.id, option.id, e.target.checked)
                    }
                  />
                )}

                {option.type === 'string' && (
                  <input
                    type="text"
                    id={option.id}
                    value={option.value as string}
                    onChange={(e) =>
                      handleCompromiseOptionChange(strategy.id, option.id, e.target.value)
                    }
                  />
                )}

                {option.type === 'number' && (
                  <input
                    type="number"
                    id={option.id}
                    value={option.value as number}
                    onChange={(e) =>
                      handleCompromiseOptionChange(
                        strategy.id,
                        option.id,
                        parseFloat(e.target.value)
                      )
                    }
                  />
                )}

                {option.type === 'select' && option.options && (
                  <select
                    id={option.id}
                    value={option.value as string}
                    onChange={(e) =>
                      handleCompromiseOptionChange(strategy.id, option.id, e.target.value)
                    }
                  >
                    {option.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="settings-panel">
      <header className="settings-header">
        <h2>Settings & Preferences</h2>
        <button className="close-button" onClick={onCancel}>
          ×
        </button>
      </header>

      <div className="settings-tabs">
        <button
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`tab ${activeTab === 'compromise' ? 'active' : ''}`}
          onClick={() => setActiveTab('compromise')}
        >
          Compromise Strategies
        </button>
        <button
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Strategy Preview
        </button>
        <button
          className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          Advanced
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'general' && (
          <div className="general-settings">
            <div className="setting-group">
              <h3>Appearance</h3>
              <div className="theme-selector">
                <label>Theme:</label>
                <div className="theme-options">
                  <button
                    className={`theme-option ${currentPreferences.theme === 'light' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('light')}
                  >
                    Light
                  </button>
                  <button
                    className={`theme-option ${currentPreferences.theme === 'dark' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>

            <div className="setting-group">
              <h3>Conversion Options</h3>

              <div className="option-item">
                <label htmlFor="targetVersion">Target Minecraft Version:</label>
                <select
                  id="targetVersion"
                  value={currentPreferences.conversionOptions.targetMinecraftVersion}
                  onChange={(e) =>
                    handleConversionOptionChange('targetMinecraftVersion', e.target.value)
                  }
                >
                  <option value="1.20.0">1.20.0</option>
                  <option value="1.19.0">1.19.0</option>
                  <option value="1.18.0">1.18.0</option>
                  <option value="1.17.0">1.17.0</option>
                </select>
              </div>

              <div className="option-item">
                <label htmlFor="optimizeOutput">Optimize Output:</label>
                <input
                  type="checkbox"
                  id="optimizeOutput"
                  checked={currentPreferences.conversionOptions.optimizeOutput}
                  onChange={(e) => handleConversionOptionChange('optimizeOutput', e.target.checked)}
                />
              </div>

              <div className="option-item">
                <label htmlFor="includeComments">Include Comments:</label>
                <input
                  type="checkbox"
                  id="includeComments"
                  checked={currentPreferences.conversionOptions.includeComments}
                  onChange={(e) =>
                    handleConversionOptionChange('includeComments', e.target.checked)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compromise' && (
          <div className="compromise-settings">
            <div className="compromise-explanation">
              <h3>Compromise Strategies</h3>
              <p>
                Compromise strategies are applied to features that cannot be directly translated to
                Bedrock Edition. Enable or disable specific strategies and configure their options
                below.
              </p>
            </div>

            <div className="compromise-list">{renderCompromiseStrategies()}</div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="preview-settings">
            <div className="preview-explanation">
              <h3>Strategy Preview</h3>
              <p>
                See how your compromise strategy preferences will affect feature conversion. This
                preview shows the expected behavior for each strategy based on your current
                settings.
              </p>
            </div>

            <StrategyPreviewPanel
              previews={strategyPreviews}
              onPreviewUpdate={handlePreviewUpdate}
            />
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="advanced-settings">
            <div className="setting-group">
              <h3>Debug Options</h3>

              <div className="option-item">
                <label htmlFor="generateDebugInfo">Generate Debug Information:</label>
                <input
                  type="checkbox"
                  id="generateDebugInfo"
                  checked={currentPreferences.conversionOptions.generateDebugInfo}
                  onChange={(e) =>
                    handleConversionOptionChange('generateDebugInfo', e.target.checked)
                  }
                />
              </div>

              <p className="setting-description">
                Enabling debug information will include additional details in the conversion report
                and generate debug logs during the conversion process.
              </p>
            </div>

            <div className="setting-group">
              <h3>Storage</h3>
              <button className="clear-storage-button">Clear Saved Preferences</button>
              <button className="export-settings-button">Export Settings</button>
              <button className="import-settings-button">Import Settings</button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-actions">
        <button className="cancel-button" onClick={onCancel}>
          Cancel
        </button>
        <button className="save-button" onClick={handleSave}>
          Save Preferences
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
