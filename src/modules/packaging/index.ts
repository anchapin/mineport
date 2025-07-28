/**
 * Packaging & Reporting Module
 * 
 * This module is responsible for packaging the converted addon files and generating
 * comprehensive conversion reports. It includes components for addon packaging,
 * validation, report generation, and manual post-processing guidance.
 * 
 * Public API:
 * - AddonPackager: Packages converted files into Bedrock addon format
 * - AddonValidator: Validates the generated addon for correctness
 * - ConversionReportGenerator: Generates detailed conversion reports
 * - ManualPostProcessingGuide: Provides guidance for manual post-processing steps
 */

// Export all individual components
export * from './AddonPackager';
export * from './AddonValidator';
export * from './ConversionReportGenerator';
export * from './ManualPostProcessingGuide';

// Re-export the main packager as default for convenience
export { AddonPackager as default } from './AddonPackager';