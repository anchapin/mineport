// UI Type definitions

export interface ConversionProgress {
  stage: 'uploading' | 'analyzing' | 'converting' | 'packaging' | 'complete';
  percentage: number;
  currentTask?: string;
  error?: string;
}

export interface UploadState {
  file?: File;
  sourceRepo?: string;
  isUploading: boolean;
  progress: number;
  error?: string;
}

export interface UIState {
  theme: 'light' | 'dark';
  uploadState: UploadState;
  conversionProgress?: ConversionProgress;
}

export interface CompromiseStrategy {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  options?: CompromiseOption[];
}

export interface CompromiseOption {
  id: string;
  name: string;
  value: string | boolean | number;
  type: 'boolean' | 'string' | 'number' | 'select';
  options?: { label: string; value: string }[];
}

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