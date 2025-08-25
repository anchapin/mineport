/**
 * Conversion Configuration Panel Component
 *
 * This component provides configuration options for the enhanced conversion system,
 * allowing users to customize conversion settings and specialized agent behavior.
 */

import React, { useState, useEffect } from 'react';
import { ConversionOptions } from '../../../types/services.js';
import { FeatureFlagService } from '../../../services/FeatureFlagService.js';

export interface ConversionConfigPanelProps {
  options: ConversionOptions & Record<string, any>;
  onOptionsChange: (options: ConversionOptions & Record<string, any>) => void;
  featureFlagService: FeatureFlagService;
}

/**
 * Conversion Configuration Panel Component
 */
export const ConversionConfigPanel: React.FC<ConversionConfigPanelProps> = ({
  options,
  onOptionsChange,
  featureFlagService,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [availableFeatures, setAvailableFeatures] = useState<Record<string, boolean>>({});

  /**
   * Load available feature flags
   */
  const loadFeatureFlags = async () => {
    try {
      const features = {
        enhancedFileProcessing: await featureFlagService.isEnabled('enhanced_file_processing'),
        multiStrategyAnalysis: await featureFlagService.isEnabled('multi_strategy_analysis'),
        specializedAgents: await featureFlagService.isEnabled('specialized_conversion_agents'),
        comprehensiveValidation: await featureFlagService.isEnabled('comprehensive_validation'),
      };
      setAvailableFeatures(features);
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    }
  };

  /**
   * Handle option change
   */
  const handleOptionChange = (key: string, value: any) => {
    const updatedOptions = {
      ...options,
      [key]: value,
    };
    onOptionsChange(updatedOptions);
  };

  /**
   * Handle nested option change
   */
  const handleNestedOptionChange = (parentKey: string, childKey: string, value: any) => {
    const updatedOptions = {
      ...options,
      [parentKey]: {
        ...(options as any)[parentKey],
        [childKey]: value,
      },
    };
    onOptionsChange(updatedOptions);
  };

  // Load feature flags on component mount
  useEffect(() => {
    loadFeatureFlags();
  }, []);

  return (
    <div className="conversion-config-panel">
      <div className="config-header">
        <h3>Conversion Settings</h3>
        <button className="expand-toggle" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide' : 'Show'} Advanced Options
        </button>
      </div>

      {/* Basic Options */}
      <div className="config-basic">
        <div className="config-group">
          <label htmlFor="target-version">Target Minecraft Version:</label>
          <select
            id="target-version"
            value={options.targetMinecraftVersion || '1.20.0'}
            onChange={(e) => handleOptionChange('targetMinecraftVersion', e.target.value)}
          >
            <option value="1.20.0">1.20.0 (Latest)</option>
            <option value="1.19.4">1.19.4</option>
            <option value="1.19.2">1.19.2</option>
            <option value="1.18.2">1.18.2</option>
          </select>
        </div>

        <div className="config-group">
          <label>
            <input
              type="checkbox"
              checked={options.includeDocumentation || false}
              onChange={(e) => handleOptionChange('includeDocumentation', e.target.checked)}
            />
            Include Documentation & Reports
          </label>
          <p className="config-hint">Generate detailed conversion reports and documentation</p>
        </div>

        <div className="config-group">
          <label>
            <input
              type="checkbox"
              checked={options.optimizeAssets || false}
              onChange={(e) => handleOptionChange('optimizeAssets', e.target.checked)}
            />
            Optimize Assets
          </label>
          <p className="config-hint">
            Compress textures and optimize models for better performance
          </p>
        </div>
      </div>

      {/* Advanced Options */}
      {isExpanded && (
        <div className="config-advanced">
          <h4>Advanced Options</h4>

          {/* Enhanced File Processing */}
          {availableFeatures.enhancedFileProcessing && (
            <div className="config-section">
              <h5>🔒 Enhanced File Processing</h5>
              <div className="config-group">
                <label>
                  <input
                    type="checkbox"
                    checked={options.enableSecurityScanning || false}
                    onChange={(e) => handleOptionChange('enableSecurityScanning', e.target.checked)}
                  />
                  Enable Security Scanning
                </label>
                <p className="config-hint">
                  Perform comprehensive security scans including malware detection
                </p>
              </div>

              <div className="config-group">
                <label htmlFor="max-file-size">Maximum File Size (MB):</label>
                <input
                  type="number"
                  id="max-file-size"
                  min="1"
                  max="500"
                  value={options.maxFileSize || 100}
                  onChange={(e) => handleOptionChange('maxFileSize', parseInt(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Multi-Strategy Analysis */}
          {availableFeatures.multiStrategyAnalysis && (
            <div className="config-section">
              <h5>🧠 Multi-Strategy Analysis</h5>
              <div className="config-group">
                <label>
                  <input
                    type="checkbox"
                    checked={options.enableBytecodeAnalysis || false}
                    onChange={(e) => handleOptionChange('enableBytecodeAnalysis', e.target.checked)}
                  />
                  Enable Bytecode Analysis
                </label>
                <p className="config-hint">
                  Analyze compiled bytecode for better registry extraction
                </p>
              </div>

              <div className="config-group">
                <label htmlFor="analysis-timeout">Analysis Timeout (seconds):</label>
                <input
                  type="number"
                  id="analysis-timeout"
                  min="30"
                  max="300"
                  value={options.analysisTimeout || 120}
                  onChange={(e) => handleOptionChange('analysisTimeout', parseInt(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Specialized Conversion Agents */}
          {availableFeatures.specializedAgents && (
            <div className="config-section">
              <h5>🤖 Specialized Conversion Agents</h5>
              <div className="config-group">
                <label>
                  <input
                    type="checkbox"
                    checked={options.enableAssetConverter || true}
                    onChange={(e) => handleOptionChange('enableAssetConverter', e.target.checked)}
                  />
                  Asset Converter Agent
                </label>
                <p className="config-hint">
                  Specialized agent for texture, model, and sound conversion
                </p>
              </div>

              <div className="config-group">
                <label>
                  <input
                    type="checkbox"
                    checked={options.enableBedrockArchitect || true}
                    onChange={(e) => handleOptionChange('enableBedrockArchitect', e.target.checked)}
                  />
                  Bedrock Architect Agent
                </label>
                <p className="config-hint">Specialized agent for addon structure generation</p>
              </div>

              <div className="config-group">
                <label>
                  <input
                    type="checkbox"
                    checked={options.enableBlockItemGenerator || true}
                    onChange={(e) =>
                      handleOptionChange('enableBlockItemGenerator', e.target.checked)
                    }
                  />
                  Block/Item Generator Agent
                </label>
                <p className="config-hint">
                  Specialized agent for block and item definition creation
                </p>
              </div>
            </div>
          )}

          {/* Comprehensive Validation */}
          {availableFeatures.comprehensiveValidation && (
            <div className="config-section">
              <h5>✅ Comprehensive Validation</h5>
              <div className="config-group">
                <label>
                  <input
                    type="checkbox"
                    checked={options.enableStrictValidation || false}
                    onChange={(e) => handleOptionChange('enableStrictValidation', e.target.checked)}
                  />
                  Enable Strict Validation
                </label>
                <p className="config-hint">
                  Perform comprehensive validation with strict quality checks
                </p>
              </div>

              <div className="config-group">
                <label htmlFor="validation-timeout">Validation Timeout (seconds):</label>
                <input
                  type="number"
                  id="validation-timeout"
                  min="30"
                  max="600"
                  value={options.validationTimeout || 180}
                  onChange={(e) =>
                    handleOptionChange('validationTimeout', parseInt(e.target.value))
                  }
                />
              </div>
            </div>
          )}

          {/* Debug Options */}
          <div className="config-section">
            <h5>🐛 Debug Options</h5>
            <div className="config-group">
              <label>
                <input
                  type="checkbox"
                  checked={options.enableDebugMode || false}
                  onChange={(e) => handleOptionChange('enableDebugMode', e.target.checked)}
                />
                Enable Debug Mode
              </label>
              <p className="config-hint">Include debug information and verbose logging</p>
            </div>

            <div className="config-group">
              <label>
                <input
                  type="checkbox"
                  checked={options.preserveIntermediateFiles || false}
                  onChange={(e) =>
                    handleOptionChange('preserveIntermediateFiles', e.target.checked)
                  }
                />
                Preserve Intermediate Files
              </label>
              <p className="config-hint">Keep temporary files for debugging purposes</p>
            </div>
          </div>

          {/* Performance Options */}
          <div className="config-section">
            <h5>⚡ Performance Options</h5>
            <div className="config-group">
              <label htmlFor="worker-threads">Worker Threads:</label>
              <input
                type="number"
                id="worker-threads"
                min="1"
                max="8"
                value={options.workerThreads || 2}
                onChange={(e) => handleOptionChange('workerThreads', parseInt(e.target.value))}
              />
              <p className="config-hint">Number of worker threads for parallel processing</p>
            </div>

            <div className="config-group">
              <label>
                <input
                  type="checkbox"
                  checked={options.enableCaching || true}
                  onChange={(e) => handleOptionChange('enableCaching', e.target.checked)}
                />
                Enable Caching
              </label>
              <p className="config-hint">Cache analysis results for improved performance</p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Summary */}
      <div className="config-summary">
        <h4>Configuration Summary</h4>
        <div className="summary-items">
          <div className="summary-item">
            <span className="summary-label">Target Version:</span>
            <span className="summary-value">{options.targetMinecraftVersion || '1.20.0'}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Enhanced Features:</span>
            <span className="summary-value">
              {Object.values(availableFeatures).filter(Boolean).length} enabled
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Debug Mode:</span>
            <span className="summary-value">
              {options.enableDebugMode ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversionConfigPanel;
