import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDirectory, cleanupTempDirectory, createMockModFile, createMockGitHubRepo } from '../helpers';
import { ModValidator } from '../../../src/modules/ingestion/ModValidator';
import { SourceCodeFetcher } from '../../../src/modules/ingestion/SourceCodeFetcher';
import { ModLoaderDetector } from '../../../src/modules/ingestion/ModLoaderDetector';
import { LicenseParser } from '../../../src/modules/ingestion/LicenseParser';
import { FeatureCompatibilityAnalyzer } from '../../../src/modules/ingestion/FeatureCompatibilityAnalyzer';
import fs from 'fs';
import path from 'path';

describe('Ingestion Pipeline Integration', () => {
  let tempDir: string;
  let modFile: string;
  let repoDir: string;
  
  beforeAll(async () => {
    // Create temporary directory
    tempDir = createTempDirectory();
    
    // Create mock mod file
    modFile = await createMockModFile(tempDir, 'test-mod', 'forge');
    
    // Create mock GitHub repo
    repoDir = createMockGitHubRepo(tempDir, 'test-mod', 'forge');
  });
  
  afterAll(() => {
    // Clean up
    cleanupTempDirectory(tempDir);
  });
  
  it('should process a mod through the complete ingestion pipeline', async () => {
    // Step 1: Validate the mod
    const modValidator = new ModValidator();
    const validationResult = await modValidator.validate(fs.readFileSync(modFile));
    
    expect(validationResult.valid).toBe(true);
    expect(validationResult.modId).toBe('test-mod');
    expect(validationResult.modLoader).toBe('forge');
    
    // Extract the mod to a directory
    const extractPath = await modValidator.extractMod(fs.readFileSync(modFile), validationResult.modId);
    
    // Step 2: Detect mod loader
    const modLoaderDetector = new ModLoaderDetector();
    const detectionResult = await modLoaderDetector.detect(extractPath);
    
    expect(detectionResult.modLoader).toBe('forge');
    expect(detectionResult.confidence).toBeGreaterThan(0.5);
    
    // Step 3: Parse license
    const licenseParser = new LicenseParser();
    const licenseResult = await licenseParser.parse(extractPath);
    
    expect(licenseResult.type).toBeDefined();
    expect(licenseResult.author).toBeDefined();
    
    // Step 4: Analyze feature compatibility
    const featureAnalyzer = new FeatureCompatibilityAnalyzer();
    const analysisResult = await featureAnalyzer.analyze(extractPath);
    
    expect(analysisResult.features.length).toBeGreaterThan(0);
    expect(analysisResult.summary.totalFeatures).toBeGreaterThan(0);
    
    // Verify that the pipeline produced consistent results
    expect(detectionResult.modLoader).toBe(validationResult.modLoader);
  });
  
  it('should handle source code fetching and analysis', async () => {
    // Mock GitHub API for testing
    vi.mock('../../../src/modules/ingestion/SourceCodeFetcher', () => {
      const original = vi.importActual('../../../src/modules/ingestion/SourceCodeFetcher');
      return {
        ...original,
        SourceCodeFetcher: class MockSourceCodeFetcher {
          async fetchSourceCode(repoInfo: any, outputDir: string) {
            // Instead of fetching from GitHub, copy our mock repo
            fs.cpSync(repoDir, outputDir, { recursive: true });
            return {
              success: true,
              fileCount: 10,
              outputPath: outputDir,
            };
          }
          
          parseRepositoryUrl(url: string) {
            return {
              owner: 'test-owner',
              repo: 'test-repo',
              branch: 'main',
            };
          }
        },
      };
    });
    
    // Create source code fetcher
    const sourceCodeFetcher = new SourceCodeFetcher({ githubToken: 'mock-token' });
    
    // Fetch source code
    const sourceCodeDir = path.join(tempDir, 'source-code');
    const fetchResult = await sourceCodeFetcher.fetchSourceCode(
      { owner: 'test-owner', repo: 'test-repo', branch: 'main' },
      sourceCodeDir
    );
    
    expect(fetchResult.success).toBe(true);
    expect(fetchResult.fileCount).toBeGreaterThan(0);
    
    // Analyze the source code
    const featureAnalyzer = new FeatureCompatibilityAnalyzer();
    const analysisResult = await featureAnalyzer.analyze(sourceCodeDir);
    
    expect(analysisResult.features.length).toBeGreaterThan(0);
    expect(analysisResult.summary.totalFeatures).toBeGreaterThan(0);
    
    // Verify that source code analysis found Java classes
    const javaFeatures = analysisResult.features.filter(f => 
      f.sourceFiles.some(file => file.endsWith('.java'))
    );
    expect(javaFeatures.length).toBeGreaterThan(0);
  });
  
  it('should handle mods with different loaders consistently', async () => {
    // Create a Fabric mod
    const fabricModFile = await createMockModFile(tempDir, 'test-fabric-mod', 'fabric');
    
    // Validate the mod
    const modValidator = new ModValidator();
    const validationResult = await modValidator.validate(fs.readFileSync(fabricModFile));
    
    expect(validationResult.valid).toBe(true);
    expect(validationResult.modId).toBe('test-fabric-mod');
    expect(validationResult.modLoader).toBe('fabric');
    
    // Extract the mod
    const extractPath = await modValidator.extractMod(fs.readFileSync(fabricModFile), validationResult.modId);
    
    // Detect mod loader
    const modLoaderDetector = new ModLoaderDetector();
    const detectionResult = await modLoaderDetector.detect(extractPath);
    
    expect(detectionResult.modLoader).toBe('fabric');
    
    // Analyze feature compatibility
    const featureAnalyzer = new FeatureCompatibilityAnalyzer();
    const analysisResult = await featureAnalyzer.analyze(extractPath);
    
    // Both Forge and Fabric mods should produce feature analysis
    expect(analysisResult.features.length).toBeGreaterThan(0);
  });
});