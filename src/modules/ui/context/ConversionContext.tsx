/**
 * ConversionContext
 *
 * This context provides state management for the conversion process.
 */

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { ConversionProgress, UploadState, UserPreferences } from '../types/index.js';
import { ConversionJob, ConversionAPIResult } from '../services/ConversionAPIService.js';

// State interface
interface ConversionState {
  uploadState: UploadState;
  conversionProgress?: ConversionProgress;
  conversionJob?: ConversionJob;
  conversionResult?: ConversionAPIResult;
  userPreferences: UserPreferences;
}

// Action types
type ConversionAction =
  | { type: 'SET_FILE'; payload: File }
  | { type: 'SET_SOURCE_REPO'; payload: string }
  | { type: 'SET_UPLOAD_STATE'; payload: Partial<UploadState> }
  | { type: 'SET_CONVERSION_PROGRESS'; payload: ConversionProgress }
  | { type: 'SET_CONVERSION_JOB'; payload: ConversionJob }
  | { type: 'SET_CONVERSION_RESULT'; payload: ConversionAPIResult }
  | { type: 'SET_USER_PREFERENCES'; payload: UserPreferences }
  | { type: 'RESET_STATE' };

// Default user preferences
const defaultUserPreferences: UserPreferences = {
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
          type: 'boolean',
        },
        {
          id: 'structure-generation',
          name: 'Structure Generation',
          value: true,
          type: 'boolean',
        },
      ],
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
            { label: 'Detailed Placeholder', value: 'detailed' },
          ],
        },
      ],
    },
    {
      id: 'ui-flow-mapping',
      name: 'UI/HUD Flow Mapping',
      description: 'Maps Java UI components to Bedrock form types',
      isEnabled: true,
      options: [],
    },
  ],
  conversionOptions: {
    generateDebugInfo: false,
    optimizeOutput: true,
    includeComments: true,
    targetMinecraftVersion: '1.20.0',
  },
};

// Initial state
const initialState: ConversionState = {
  uploadState: {
    isUploading: false,
    progress: 0,
  },
  userPreferences: defaultUserPreferences,
};

// Reducer function
function conversionReducer(state: ConversionState, action: ConversionAction): ConversionState {
  switch (action.type) {
    case 'SET_FILE':
      return {
        ...state,
        uploadState: {
          ...state.uploadState,
          file: action.payload,
          error: undefined,
        },
      };

    case 'SET_SOURCE_REPO':
      return {
        ...state,
        uploadState: {
          ...state.uploadState,
          sourceRepo: action.payload,
        },
      };

    case 'SET_UPLOAD_STATE':
      return {
        ...state,
        uploadState: {
          ...state.uploadState,
          ...action.payload,
        },
      };

    case 'SET_CONVERSION_PROGRESS':
      return {
        ...state,
        conversionProgress: action.payload,
      };

    case 'SET_CONVERSION_JOB':
      return {
        ...state,
        conversionJob: action.payload,
      };

    case 'SET_CONVERSION_RESULT':
      return {
        ...state,
        conversionResult: action.payload,
      };

    case 'SET_USER_PREFERENCES':
      return {
        ...state,
        userPreferences: action.payload,
      };

    case 'RESET_STATE':
      return {
        ...initialState,
        userPreferences: state.userPreferences, // Preserve user preferences
      };

    default:
      return state;
  }
}

// Context interface
interface ConversionContextType {
  state: ConversionState;
  setFile: (file: File) => void;
  setSourceRepo: (repo: string) => void;
  setUploadState: (state: Partial<UploadState>) => void;
  setConversionProgress: (progress: ConversionProgress) => void;
  setConversionJob: (job: ConversionJob) => void;
  setConversionResult: (result: ConversionAPIResult) => void;
  setUserPreferences: (preferences: UserPreferences) => void;
  resetState: () => void;
}

// Create context
const ConversionContext = createContext<ConversionContextType | undefined>(undefined);

// Provider component
interface ConversionProviderProps {
  children: ReactNode;
}

export const ConversionProvider: React.FC<ConversionProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(conversionReducer, initialState);

  const setFile = useCallback((file: File) => {
    dispatch({ type: 'SET_FILE', payload: file });
  }, []);

  const setSourceRepo = useCallback((repo: string) => {
    dispatch({ type: 'SET_SOURCE_REPO', payload: repo });
  }, []);

  const setUploadState = useCallback((uploadState: Partial<UploadState>) => {
    dispatch({ type: 'SET_UPLOAD_STATE', payload: uploadState });
  }, []);

  const setConversionProgress = useCallback((progress: ConversionProgress) => {
    dispatch({ type: 'SET_CONVERSION_PROGRESS', payload: progress });
  }, []);

  const setConversionJob = useCallback((job: ConversionJob) => {
    dispatch({ type: 'SET_CONVERSION_JOB', payload: job });
  }, []);

  const setConversionResult = useCallback((result: ConversionAPIResult) => {
    dispatch({ type: 'SET_CONVERSION_RESULT', payload: result });
  }, []);

  const setUserPreferences = useCallback((preferences: UserPreferences) => {
    dispatch({ type: 'SET_USER_PREFERENCES', payload: preferences });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const value = {
    state,
    setFile,
    setSourceRepo,
    setUploadState,
    setConversionProgress,
    setConversionJob,
    setConversionResult,
    setUserPreferences,
    resetState,
  };

  return <ConversionContext.Provider value={value}>{children}</ConversionContext.Provider>;
};

// Custom hook to use the context
export const useConversionContext = (): ConversionContextType => {
  const context = useContext(ConversionContext);

  if (context === undefined) {
    throw new Error('useConversionContext must be used within a ConversionProvider');
  }

  return context;
};
