/**
 * Ingestion & Analysis Module
 * 
 * This module is responsible for accepting Java mod input, validating it, and performing initial analysis.
 * It includes components for mod validation, source code fetching, mod loader detection,
 * license parsing, and feature compatibility analysis.
 */

import { ModValidator, ModValidationResult } from './ModValidator';
import { SourceCodeFetcher, SourceCodeFetchOptions, SourceCodeFetchResult } from './SourceCodeFetcher';
import { ModLoaderDetector, ModLoaderType, ModLoaderDetectionResult } from './ModLoaderDetector';
import { LicenseParser, LicenseInfo as LicenseInfoType, LicenseParseResult } from './LicenseParser';
import { FeatureCompatibilityAnalyzer, FeatureAnalysisResult } from './FeatureCompatibilityAnalyzer';

export interface ModInput {
  jarFile: Buffer;
  sourceCodeRepo?: string;
}

export interface AnalysisResult {
  modId: string;
  modName: string;
  modVersion: string;
  modLoader: 'forge' | 'fabric';
  license: LicenseInfo;
  compatibilityReport: FeatureCompatibilityReport;
}

export interface LicenseInfo {
  type: string;
  text: string;
  permissions: string[];
  limitations: string[];
  conditions: string[];
}

export interface FeatureCompatibilityReport {
  tier1Features: Feature[]; // Fully Translatable
  tier2Features: Feature[]; // Approximation Possible
  tier3Features: Feature[]; // Natively Impossible
  tier4Features: Feature[]; // Unanalyzable
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  compatibilityTier: 1 | 2 | 3 | 4;
  sourceFiles: string[];
  sourceLineNumbers: number[][];
  compromiseStrategy?: CompromiseStrategy;
}

export interface CompromiseStrategy {
  type: 'simulation' | 'stubbing' | 'approximation';
  description: string;
  implementationDetails: string;
  limitations: string[];
}

// Export the ModValidator, SourceCodeFetcher, ModLoaderDetector, LicenseParser, and FeatureCompatibilityAnalyzer classes
export { ModValidator, ModValidationResult };
export { SourceCodeFetcher, SourceCodeFetchOptions, SourceCodeFetchResult };
export { ModLoaderDetector, ModLoaderType, ModLoaderDetectionResult };
export { LicenseParser, LicenseInfoType as LicenseParseInfo, LicenseParseResult };
export { FeatureCompatibilityAnalyzer, FeatureAnalysisResult };

export class IngestionModule {
  private modValidator: ModValidator;
  private sourceCodeFetcher: SourceCodeFetcher;
  private modLoaderDetector: ModLoaderDetector;
  private licenseParser: LicenseParser;
  private featureAnalyzer: FeatureCompatibilityAnalyzer;
  
  constructor(tempDir?: string) {
    this.modValidator = new ModValidator(tempDir);
    this.sourceCodeFetcher = new SourceCodeFetcher();
    this.modLoaderDetector = new ModLoaderDetector();
    this.licenseParser = new LicenseParser();
    this.featureAnalyzer = new FeatureCompatibilityAnalyzer();
  }
  
  async processModInput(input: ModInput): Promise<AnalysisResult> {
    // Validate the mod file
    const validationResult = await this.modValidator.validateMod(input.jarFile);
    
    if (!validationResult.isValid) {
      throw new Error(`Invalid mod file: ${validationResult.errors?.join(', ')}`);
    }
    
    // Extract source code if repository is provided
    let sourceCodePath = validationResult.extractedPath;
    if (input.sourceCodeRepo) {
      const sourceCodeResult = await this.sourceCodeFetcher.fetchSourceCode({
        repoUrl: input.sourceCodeRepo,
        modId: validationResult.modInfo?.modId || '',
      });
      
      if (sourceCodeResult.success) {
        sourceCodePath = sourceCodeResult.sourcePath;
      }
    }
    
    // Detect mod loader type
    const modLoaderResult = await this.modLoaderDetector.detectModLoader(sourceCodePath!);
    
    if (modLoaderResult.modLoader === 'unknown') {
      throw new Error('Could not determine mod loader type');
    }
    
    // Parse license information
    const licenseResult = await this.licenseParser.parseLicense(sourceCodePath!);
    
    // Analyze feature compatibility
    const featureAnalysisResult = await this.featureAnalyzer.analyzeFeatures(
      sourceCodePath!,
      modLoaderResult.modLoader
    );
    
    // Return the complete analysis result
    return {
      modId: validationResult.modInfo?.modId || '',
      modName: validationResult.modInfo?.modName || '',
      modVersion: validationResult.modInfo?.modVersion || '',
      modLoader: modLoaderResult.modLoader as 'forge' | 'fabric',
      license: {
        type: licenseResult.licenseInfo?.type || 'unknown',
        text: licenseResult.licenseInfo?.text || '',
        permissions: licenseResult.licenseInfo?.permissions || [],
        limitations: licenseResult.licenseInfo?.limitations || [],
        conditions: licenseResult.licenseInfo?.conditions || [],
      },
      compatibilityReport: featureAnalysisResult.compatibilityReport,
    };
  }
}