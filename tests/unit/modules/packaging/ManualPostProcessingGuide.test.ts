import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ManualPostProcessingGuide, PostProcessingGuideInput } from '../../../../src/modules/packaging/ManualPostProcessingGuide';

// Mock fs and path modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ManualPostProcessingGuide', () => {
  let postProcessingGuide: ManualPostProcessingGuide;
  let mockInput: PostProcessingGuideInput;
  
  beforeEach(() => {
    postProcessingGuide = new ManualPostProcessingGuide();
    
    // Mock input data
    mockInput = {
      modName: 'TestMod',
      modVersion: '1.0.0',
      features: {
        tier1: [],
        tier2: [],
        tier3: [
          {
            id: 'feature3',
            name: 'Custom Dimension',
            description: 'A custom dimension with unique properties',
            type: 'dimension',
            compatibilityTier: 3,
            sourceFiles: ['Dimension.java'],
            sourceLineNumbers: [[5, 100]]
          }
        ],
        tier4: [
          {
            id: 'feature4',
            name: 'Advanced Rendering',
            description: 'Custom rendering pipeline',
            type: 'rendering',
            compatibilityTier: 4,
            sourceFiles: ['Renderer.java'],
            sourceLineNumbers: [[50, 200]]
          }
        ]
      },
      compromiseReport: {
        totalCompromisesApplied: 2,
        appliedStrategies: [
          {
            featureId: 'feature3',
            strategyId: 'dimension-simulation',
            strategyName: 'Dimension Simulation',
            strategyDescription: 'Simulates custom dimensions using teleportation and visual effects'
          },
          {
            featureId: 'feature4',
            strategyId: 'rendering-stub',
            strategyName: 'Rendering Stub',
            strategyDescription: 'Stubs out advanced rendering code with appropriate warnings'
          }
        ]
      },
      conversionNotes: [
        {
          type: 'texture',
          message: 'Some textures required format conversion',
          severity: 'warning',
          sourceFile: 'textures/blocks/custom.png'
        },
        {
          type: 'script',
          message: 'Unable to convert custom rendering pipeline',
          severity: 'error',
          sourceFile: 'Renderer.java',
          sourceLine: 75
        }
      ]
    };
    
    // Mock fs.existsSync to return false for directory check
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create output directory if it does not exist', async () => {
    const outputDir = '/output';
    await postProcessingGuide.generateGuide(mockInput, outputDir);
    
    expect(fs.existsSync).toHaveBeenCalledWith(outputDir);
    expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
  });
  
  it('should generate HTML, Markdown, and JSON guides', async () => {
    const outputDir = '/output';
    await postProcessingGuide.generateGuide(mockInput, outputDir);
    
    // Check that writeFileSync was called for each guide type
    expect(fs.writeFileSync).toHaveBeenCalledTimes(3);
    
    // Check HTML guide
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(outputDir, 'manual-post-processing.html'),
      expect.stringContaining('<!DOCTYPE html>')
    );
    
    // Check Markdown guide
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(outputDir, 'manual-post-processing.md'),
      expect.stringContaining('# Manual Post-Processing Guide: TestMod v1.0.0')
    );
    
    // Check JSON guide
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(outputDir, 'manual-post-processing.json'),
      expect.stringContaining('"name":"TestMod"')
    );
  });
  
  it('should return correct paths in the output', async () => {
    const outputDir = '/output';
    const result = await postProcessingGuide.generateGuide(mockInput, outputDir);
    
    expect(result).toEqual({
      htmlGuidePath: path.join(outputDir, 'manual-post-processing.html'),
      markdownGuidePath: path.join(outputDir, 'manual-post-processing.md'),
      jsonGuidePath: path.join(outputDir, 'manual-post-processing.json'),
      steps: expect.any(Array)
    });
  });
  
  it('should generate steps for tier3 features with compromise strategies', async () => {
    const outputDir = '/output';
    const result = await postProcessingGuide.generateGuide(mockInput, outputDir);
    
    // Find step for dimension simulation
    const dimensionStep = result.steps.find(step => 
      step.title.includes('Dimension') && step.priority === 'high'
    );
    
    expect(dimensionStep).toBeDefined();
    expect(dimensionStep?.codeSnippet).toContain('DimensionSimulator');
    expect(dimensionStep?.affectedFiles).toContain('scripts/dimension/custom_dimension.js');
  });
  
  it('should generate steps for tier4 features', async () => {
    const outputDir = '/output';
    const result = await postProcessingGuide.generateGuide(mockInput, outputDir);
    
    // Find step for unanalyzable feature
    const unanalyzableStep = result.steps.find(step => 
      step.title.includes('Manually Implement') && step.priority === 'critical'
    );
    
    expect(unanalyzableStep).toBeDefined();
    expect(unanalyzableStep?.description).toContain('Advanced Rendering');
    expect(unanalyzableStep?.codeSnippet).toContain('TODO: Implement using Bedrock Script API');
  });
  
  it('should generate steps for error notes', async () => {
    const outputDir = '/output';
    const result = await postProcessingGuide.generateGuide(mockInput, outputDir);
    
    // Find step for error note
    const errorStep = result.steps.find(step => 
      step.title.includes('Fix script Error') && step.priority === 'critical'
    );
    
    expect(errorStep).toBeDefined();
    expect(errorStep?.description).toContain('Unable to convert custom rendering pipeline');
    expect(errorStep?.codeSnippet).toContain('This code needs manual implementation or fixing');
  });
  
  it('should generate steps for warning notes', async () => {
    const outputDir = '/output';
    const result = await postProcessingGuide.generateGuide(mockInput, outputDir);
    
    // Find step for warning note
    const warningStep = result.steps.find(step => 
      step.title.includes('Address texture Warning') && step.priority === 'medium'
    );
    
    expect(warningStep).toBeDefined();
    expect(warningStep?.description).toContain('Some textures required format conversion');
    expect(warningStep?.codeSnippet).toContain('You may need to adjust the texture file');
  });
  
  it('should sort steps by priority', async () => {
    const outputDir = '/output';
    const result = await postProcessingGuide.generateGuide(mockInput, outputDir);
    
    // Check that critical steps come before high priority steps
    const criticalIndex = result.steps.findIndex(step => step.priority === 'critical');
    const highIndex = result.steps.findIndex(step => step.priority === 'high');
    const mediumIndex = result.steps.findIndex(step => step.priority === 'medium');
    
    expect(criticalIndex).toBeLessThan(highIndex);
    expect(highIndex).toBeLessThan(mediumIndex);
  });
});