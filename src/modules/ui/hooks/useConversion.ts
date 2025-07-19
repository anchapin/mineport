import { useState, useCallback } from 'react';
import { ConversionProgress, UploadState } from '../types';

export const useConversion = () => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0
  });
  
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress | undefined>();

  const handleFileSelected = useCallback((file: File) => {
    setUploadState(prev => ({
      ...prev,
      file,
      error: undefined
    }));
  }, []);

  const handleSourceRepoChange = useCallback((repo: string) => {
    setUploadState(prev => ({
      ...prev,
      sourceRepo: repo
    }));
  }, []);

  const startConversion = useCallback(async () => {
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
        currentTask: 'Uploading mod file'
      });

      // Create form data for file upload
      const formData = new FormData();
      formData.append('modFile', uploadState.file);
      
      if (uploadState.sourceRepo) {
        formData.append('sourceRepo', uploadState.sourceRepo);
      }

      // TODO: Replace with actual API call
      // const response = await fetch('/api/convert', {
      //   method: 'POST',
      //   body: formData
      // });
      
      // if (!response.ok) {
      //   throw new Error('Failed to upload file');
      // }
      
      // const conversionId = await response.json();
      
      // Start polling for conversion status
      // pollConversionStatus(conversionId);
      
      // For now, simulate the conversion process
      simulateConversion();
      
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
  }, [uploadState.file, uploadState.sourceRepo]);

  // Simulate the conversion process for development
  const simulateConversion = useCallback(() => {
    // Simulate file upload progress
    let uploadProgress = 0;
    const uploadInterval = setInterval(() => {
      uploadProgress += 10;
      
      setUploadState(prev => ({
        ...prev,
        progress: Math.min(uploadProgress, 100)
      }));
      
      setConversionProgress(prev => prev ? {
        ...prev,
        percentage: Math.min(uploadProgress, 100)
      } : undefined);
      
      if (uploadProgress >= 100) {
        clearInterval(uploadInterval);
        
        setUploadState(prev => ({
          ...prev,
          isUploading: false
        }));
        
        // Move to analysis stage
        setTimeout(() => {
          setConversionProgress({
            stage: 'analyzing',
            percentage: 0,
            currentTask: 'Analyzing mod structure'
          });
          
          simulateStage('analyzing', 'Converting assets', 'converting');
        }, 500);
      }
    }, 300);
  }, []);

  // Helper function to simulate a conversion stage
  const simulateStage = useCallback((
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
            simulateStage('converting', 'Packaging addon files', 'packaging');
          } else if (nextStage === 'packaging') {
            simulateStage('packaging', 'Finalizing conversion', 'complete');
          }
        }, 500);
      }
    }, 200);
  }, []);

  // Function to poll conversion status from the server
  // const pollConversionStatus = useCallback((conversionId: string) => {
  //   const interval = setInterval(async () => {
  //     try {
  //       const response = await fetch(`/api/conversion/${conversionId}/status`);
  //       const status = await response.json();
  //       
  //       setConversionProgress(status);
  //       
  //       if (status.stage === 'complete' || status.error) {
  //         clearInterval(interval);
  //       }
  //     } catch (error) {
  //       console.error('Failed to fetch conversion status', error);
  //     }
  //   }, 1000);
  // }, []);

  return {
    uploadState,
    conversionProgress,
    handleFileSelected,
    handleSourceRepoChange,
    startConversion
  };
};

export default useConversion;