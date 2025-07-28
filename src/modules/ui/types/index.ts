/**
 * UI Type Definitions
 * 
 * TypeScript interfaces and types for the user interface module.
 * 
 * Public API:
 * - ConversionProgress: Progress tracking for conversion process
 * - UploadState: State management for file uploads
 * - UIState: Global UI state interface
 * - CompromiseStrategy: User-configurable compromise strategies
 * - CompromiseOption: Configuration options for strategies
 * - UserPreferences: User preference settings
 */

// Conversion and progress types
export interface ConversionProgress {
  stage: 'uploading' | 'validating' | 'analyzing' | 'assets' | 'config' | 'logic' | 'packaging' | 'complete';
  percentage: number;
  currentTask?: string;
  error?: string;
}

/**
 * UploadState interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface UploadState {
  file?: File;
  sourceRepo?: string;
  isUploading: boolean;
  progress: number;
  error?: string;
}

// UI state management types
/**
 * UIState interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface UIState {
  theme: 'light' | 'dark';
  uploadState: UploadState;
  conversionProgress?: ConversionProgress;
}

// Compromise strategy types
/**
 * CompromiseStrategy interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface CompromiseStrategy {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  options?: CompromiseOption[];
}

/**
 * CompromiseOption interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface CompromiseOption {
  id: string;
  name: string;
  value: string | boolean | number;
  type: 'boolean' | 'string' | 'number' | 'select';
  options?: { label: string; value: string }[];
}

// User preference types
/**
 * UserPreferences interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface UserPreferences {
  theme: 'light' | 'dark';
  compromiseStrategies: CompromiseStrategy[];
  conversionOptions: {
    generateDebugInfo: boolean;
    optimizeOutput: boolean;
    includeComments: boolean;
    targetMinecraftVersion: string;
  };
}