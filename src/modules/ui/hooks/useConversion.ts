/**
 * useConversion Hook
 *
 * This hook provides functionality for the conversion process using the ConversionContext.
 */

import { useCallback } from 'react';
import { ConversionAPIServiceImpl } from '../services/index.js';
import { UserPreferences } from '../types/index.js';
import { useConversionContext } from '../context/ConversionContext.js';

export const useConversion = () => {
  const {
    state,
    setFile,
    setSourceRepo,
    setUploadState,
    setConversionProgress,
    setConversionJob,
    setConversionResult,
    setUserPreferences,
    resetState,
  } = useConversionContext();

  const { uploadState, conversionProgress, conversionJob, userPreferences, conversionResult } =
    state;

  // Create API service instance
  const apiService = useCallback(() => {
    return new ConversionAPIServiceImpl({
      baseUrl: process.env.REACT_APP_API_URL || '',
      useMockData: process.env.NODE_ENV === 'development',
    });
  }, []);

  const handleFileSelected = useCallback(
    (file: File) => {
      /**
       * setFile method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      setFile(file);
    },
    [setFile]
  );

  const handleSourceRepoChange = useCallback(
    (repo: string) => {
      /**
       * setSourceRepo method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      setSourceRepo(repo);
    },
    [setSourceRepo]
  );

  const handlePreferencesChange = useCallback(
    (preferences: UserPreferences) => {
      /**
       * setUserPreferences method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      setUserPreferences(preferences);
    },
    [setUserPreferences]
  );

  const startConversion = useCallback(async () => {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!uploadState.file) {
      return;
    }

    try {
      // Set uploading state
      /**
       * setUploadState method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      setUploadState({
        isUploading: true,
        error: undefined,
      });

      /**
       * setConversionProgress method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      setConversionProgress({
        stage: 'uploading',
        percentage: 0,
        currentTask: 'Uploading mod file',
      });

      // Prepare conversion input
      const input = {
        modFile: uploadState.file,
        sourceRepo: uploadState.sourceRepo,
        preferences: userPreferences
          ? {
              compromiseStrategies: userPreferences.compromiseStrategies.map((strategy) => ({
                id: strategy.id,
                isEnabled: strategy.isEnabled,
                options: strategy.options?.map((option) => ({
                  id: option.id,
                  value: option.value,
                })),
              })),
              conversionOptions: userPreferences.conversionOptions,
            }
          : undefined,
      };

      // Start conversion using API service
      const job = await apiService().startConversion(input);
      /**
       * setConversionJob method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      setConversionJob(job);

      // Start polling for conversion status
      /**
       * pollConversionStatus method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      pollConversionStatus(job.jobId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to upload file. Please try again.';

      /**
       * setUploadState method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      setUploadState({
        isUploading: false,
        error: errorMessage,
      });

      /**
       * setConversionProgress method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      setConversionProgress({
        stage: 'uploading',
        percentage: 0,
        currentTask: 'Upload failed',
        error: errorMessage,
      });
    }
  }, [
    uploadState.file,
    uploadState.sourceRepo,
    userPreferences,
    apiService,
    setUploadState,
    setConversionProgress,
    setConversionJob,
  ]);

  // Function to poll conversion status from the server
  const pollConversionStatus = useCallback(
    (jobId: string) => {
      const interval = setInterval(async () => {
        try {
          const status = await apiService().getConversionStatus(jobId);

          // Update upload state if still uploading
          if (status.progress.stage === 'uploading') {
            /**
             * setUploadState method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            setUploadState({
              progress: status.progress.percentage,
              isUploading: status.progress.percentage < 100,
            });
          } else if (uploadState.isUploading) {
            // If we've moved past uploading stage, update upload state
            /**
             * setUploadState method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            setUploadState({
              progress: 100,
              isUploading: false,
            });
          }

          // Update conversion progress
          /**
           * setConversionProgress method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          setConversionProgress(status.progress);

          // If conversion is complete or failed, stop polling
          if (
            status.status === 'completed' ||
            status.status === 'failed' ||
            status.progress.error
          ) {
            /**
             * clearInterval method.
             *
             * TODO: Add detailed description of the method's purpose and behavior.
             *
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            clearInterval(interval);

            // If completed, fetch the result
            if (status.status === 'completed') {
              try {
                const result = await apiService().getConversionResult(jobId);
                /**
                 * setConversionResult method.
                 *
                 * TODO: Add detailed description of the method's purpose and behavior.
                 *
                 * @param param - TODO: Document parameters
                 * @returns result - TODO: Document return value
                 * @since 1.0.0
                 */
                setConversionResult(result);
              } catch (resultError) {
                console.error('Failed to fetch conversion result', resultError);

                /**
                 * setConversionProgress method.
                 *
                 * TODO: Add detailed description of the method's purpose and behavior.
                 *
                 * @param param - TODO: Document parameters
                 * @returns result - TODO: Document return value
                 * @since 1.0.0
                 */
                setConversionProgress({
                  ...status.progress,
                  error: 'Failed to fetch conversion result. Please try again.',
                });
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch conversion status', error);

          // Update error state
          /**
           * setConversionProgress method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          setConversionProgress(
            conversionProgress
              ? {
                  ...conversionProgress,
                  error: 'Failed to fetch conversion status. Please try again.',
                }
              : {
                  stage: 'uploading',
                  percentage: 0,
                  error: 'Failed to fetch conversion status. Please try again.',
                }
          );

          // Stop polling on error
          /**
           * clearInterval method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          clearInterval(interval);
        }
      }, 2000); // Poll every 2 seconds

      // Clean up interval on unmount
      return () => clearInterval(interval);
    },
    [
      apiService,
      uploadState.isUploading,
      conversionProgress,
      setUploadState,
      setConversionProgress,
      setConversionResult,
    ]
  );

  // Cancel a conversion
  const cancelConversion = useCallback(async () => {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!conversionJob) {
      return;
    }

    try {
      const success = await apiService().cancelConversion(conversionJob.jobId);

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (success) {
        /**
         * setConversionProgress method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        setConversionProgress(
          conversionProgress
            ? {
                ...conversionProgress,
                error: 'Conversion cancelled by user.',
              }
            : {
                stage: 'uploading',
                percentage: 0,
                error: 'Conversion cancelled by user.',
              }
        );
      }
    } catch (error) {
      console.error('Failed to cancel conversion', error);

      /**
       * setConversionProgress method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      setConversionProgress(
        conversionProgress
          ? {
              ...conversionProgress,
              error: 'Failed to cancel conversion. Please try again.',
            }
          : {
              stage: 'uploading',
              percentage: 0,
              error: 'Failed to cancel conversion. Please try again.',
            }
      );
    }
  }, [conversionJob, conversionProgress, apiService, setConversionProgress]);

  // Reset the conversion state
  const resetConversion = useCallback(() => {
    /**
     * resetState method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    resetState();
  }, [resetState]);

  return {
    uploadState,
    conversionProgress,
    conversionJob,
    state: {
      userPreferences,
      uploadState,
      conversionProgress,
      conversionJob,
      conversionResult,
    },
    handleFileSelected,
    handleSourceRepoChange,
    handlePreferencesChange,
    startConversion,
    cancelConversion,
    resetConversion,
  };
};

export default useConversion;
