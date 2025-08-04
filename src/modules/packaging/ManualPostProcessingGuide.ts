import * as fs from 'fs';
import * as path from 'path';
import logger from '../../utils/logger.js';
import { Feature, CompromiseReport, AppliedCompromiseStrategy } from '../../types/compromise.js';

/**
 * Interface for manual post-processing step
 */
export interface PostProcessingStep {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  codeSnippet?: string;
  affectedFiles?: string[];
  relatedFeature?: string;
}

/**
 * Interface for manual post-processing guide input
 */
export interface PostProcessingGuideInput {
  modName: string;
  modVersion: string;
  features: {
    tier1: Feature[];
    tier2: Feature[];
    tier3: Feature[];
    tier4: Feature[];
  };
  compromiseReport: CompromiseReport;
  conversionNotes: {
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    sourceFile?: string;
    sourceLine?: number;
  }[];
}

/**
 * Interface for manual post-processing guide output
 */
export interface PostProcessingGuideOutput {
  htmlGuidePath: string;
  markdownGuidePath: string;
  jsonGuidePath: string;
  steps: PostProcessingStep[];
}

/**
 * ManualPostProcessingGuide class responsible for generating comprehensive guides
 * for manual steps needed after automatic conversion. It prioritizes critical fixes
 * and provides code snippets for common issues.
 *
 * This class handles:
 * 1. Analyzing conversion results to identify needed manual interventions
 * 2. Generating clear instructions with prioritization
 * 3. Providing code snippets for common post-processing tasks
 */
export class ManualPostProcessingGuide {
  /**
   * Generates a comprehensive manual post-processing guide
   * @param input The post-processing guide input data
   * @param outputDir The directory to save the guide to
   * @returns A promise that resolves to the post-processing guide output
   */
  public async generateGuide(
    input: PostProcessingGuideInput,
    outputDir: string
  ): Promise<PostProcessingGuideOutput> {
    logger.info('Generating manual post-processing guide');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate post-processing steps
    const steps = this.generatePostProcessingSteps(input);

    // Generate guides in different formats
    const htmlGuidePath = path.join(outputDir, 'manual-post-processing.html');
    const markdownGuidePath = path.join(outputDir, 'manual-post-processing.md');
    const jsonGuidePath = path.join(outputDir, 'manual-post-processing.json');

    // Generate HTML guide
    await this.generateHtmlGuide(input, steps, htmlGuidePath);

    // Generate Markdown guide
    await this.generateMarkdownGuide(input, steps, markdownGuidePath);

    // Generate JSON guide
    await this.generateJsonGuide(input, steps, jsonGuidePath);

    logger.info('Manual post-processing guide generated successfully');

    return {
      htmlGuidePath,
      markdownGuidePath,
      jsonGuidePath,
      steps,
    };
  }

  /**
   * Generates post-processing steps based on the input data
   * @param input The post-processing guide input data
   * @returns An array of post-processing steps
   */
  private generatePostProcessingSteps(input: PostProcessingGuideInput): PostProcessingStep[] {
    const steps: PostProcessingStep[] = [];

    // Add steps for tier3 features (Natively Impossible)
    this.addTier3FeatureSteps(input.features.tier3, input.compromiseReport, steps);

    // Add steps for tier4 features (Unanalyzable)
    this.addTier4FeatureSteps(input.features.tier4, steps);

    // Add steps for error notes
    this.addErrorNoteSteps(
      input.conversionNotes.filter((note) => note.severity === 'error'),
      steps
    );

    // Add steps for warning notes
    this.addWarningNoteSteps(
      input.conversionNotes.filter((note) => note.severity === 'warning'),
      steps
    );

    // Sort steps by priority
    return this.sortStepsByPriority(steps);
  } /**
 
  * Adds post-processing steps for tier3 features
   * @param tier3Features The tier3 features
   * @param compromiseReport The compromise report
   * @param steps The steps array to add to
   */
  private addTier3FeatureSteps(
    tier3Features: Feature[],
    compromiseReport: CompromiseReport,
    steps: PostProcessingStep[]
  ): void {
    tier3Features.forEach((feature) => {
      // Find applied compromise strategy for this feature
      const strategy = compromiseReport.appliedStrategies.find((s) => s.featureId === feature.id);

      if (strategy) {
        // Add step based on compromise strategy type
        switch (strategy.strategyId) {
          case 'dimension-simulation':
            steps.push(this.createDimensionSimulationStep(feature, strategy));
            break;
          case 'rendering-stub':
            steps.push(this.createRenderingStubStep(feature, strategy));
            break;
          case 'ui-flow-mapping':
            steps.push(this.createUIFlowMappingStep(feature, strategy));
            break;
          default:
            steps.push({
              id: `feature-${feature.id}`,
              title: `Review ${feature.name} Implementation`,
              description: `The feature "${feature.name}" was implemented using the "${strategy.strategyName}" compromise strategy. Please review the implementation and make any necessary adjustments.`,
              priority: 'medium',
              relatedFeature: feature.id,
            });
        }
      }
    });
  }

  /**
   * Creates a step for dimension simulation compromise
   * @param feature The feature
   * @param strategy The applied compromise strategy
   * @returns A post-processing step
   */
  private createDimensionSimulationStep(
    feature: Feature,
    strategy: AppliedCompromiseStrategy
  ): PostProcessingStep {
    return {
      id: `dimension-${feature.id}`,
      title: `Review Dimension Simulation for ${feature.name}`,
      description: `The custom dimension "${feature.name}" has been simulated using teleportation and visual effects. You may need to adjust the visual effects or teleportation coordinates to match your desired experience.`,
      priority: 'high',
      codeSnippet: `// Example: Adjusting dimension simulation visual effects
import { world, DimensionSimulator } from "dimension-simulator";

// Find the dimension simulator for this dimension
const simulator = world.getDimensionSimulator("${feature.name.toLowerCase().replace(/\s+/g, '_')}");

// Customize fog color and density
simulator.setFogColor(0.2, 0.3, 0.7); // RGB values (0-1)
simulator.setFogDensity(0.05); // 0-1 scale

// Customize ambient lighting
simulator.setAmbientLight(0.6); // 0-1 scale

// Customize sky appearance
simulator.setSkyProperties({
  hasSun: false,
  hasStars: true,
  starBrightness: 0.8
});`,
      affectedFiles: [`scripts/dimension/${feature.name.toLowerCase().replace(/\s+/g, '_')}.js`],
      relatedFeature: feature.id,
    };
  } /**

   * Creates a step for rendering stub compromise
   * @param feature The feature
   * @param strategy The applied compromise strategy
   * @returns A post-processing step
   */
  private createRenderingStubStep(
    feature: Feature,
    strategy: AppliedCompromiseStrategy
  ): PostProcessingStep {
    return {
      id: `rendering-${feature.id}`,
      title: `Implement Alternative for Stubbed Rendering in ${feature.name}`,
      description: `The advanced rendering code in "${feature.name}" could not be directly converted and has been stubbed out. You'll need to implement an alternative approach using Bedrock's rendering capabilities.`,
      priority: 'critical',
      codeSnippet: `// Example: Alternative implementation for custom rendering
import { Entity, RenderController } from "@minecraft/server";

// Find the stubbed rendering function
function replaceCustomRendering(entity) {
  // Original Java code used custom rendering pipeline
  // Here's an alternative using Bedrock's built-in capabilities
  
  // 1. Use entity render controller
  const renderController = new RenderController(entity);
  
  // 2. Apply available visual effects
  renderController.applyModelScale(1.2); // Scale the entity model
  
  // 3. Use particles for additional visual effects
  const pos = entity.location;
  world.spawnParticle("minecraft:basic_flame_particle", 
    { x: pos.x, y: pos.y + 1, z: pos.z }, 
    { x: 0, y: 0.1, z: 0 });
}`,
      affectedFiles: [`scripts/rendering/${feature.name.toLowerCase().replace(/\s+/g, '_')}.js`],
      relatedFeature: feature.id,
    };
  }

  /**
   * Creates a step for UI flow mapping compromise
   * @param feature The feature
   * @param strategy The applied compromise strategy
   * @returns A post-processing step
   */
  private createUIFlowMappingStep(
    feature: Feature,
    strategy: AppliedCompromiseStrategy
  ): PostProcessingStep {
    return {
      id: `ui-${feature.id}`,
      title: `Review UI Implementation for ${feature.name}`,
      description: `The custom UI/HUD elements in "${feature.name}" have been mapped to Bedrock form types. You may need to adjust the layout and styling to match the original design.`,
      priority: 'high',
      codeSnippet: `// Example: Customizing mapped UI elements
import { FormBuilder } from "@minecraft/server-ui";

// Find the mapped UI form
const form = FormBuilder.createCustomForm()
  .title("${feature.name}")
  .addLabel("Customize this form to match the original Java UI");
  
// Add custom styling elements
form.addSlider("Opacity", 0, 100, 1, 80);
form.addToggle("Show Background", true);

// Adjust layout properties
form.setPosition({ x: 0.5, y: 0.3 }); // Center top
form.setSize({ width: 0.8, height: 0.6 }); // 80% width, 60% height`,
      affectedFiles: [`scripts/ui/${feature.name.toLowerCase().replace(/\s+/g, '_')}.js`],
      relatedFeature: feature.id,
    };
  } /**

   * Adds post-processing steps for tier4 features
   * @param tier4Features The tier4 features
   * @param steps The steps array to add to
   */
  private addTier4FeatureSteps(tier4Features: Feature[], steps: PostProcessingStep[]): void {
    tier4Features.forEach((feature) => {
      steps.push({
        id: `unanalyzable-${feature.id}`,
        title: `Manually Implement ${feature.name}`,
        description: `The feature "${feature.name}" could not be analyzed or converted automatically. You'll need to implement this feature manually using Bedrock's capabilities.`,
        priority: 'critical',
        codeSnippet: `// This feature requires manual implementation
// Original Java feature: ${feature.name}
// Description: ${feature.description}
// Source files: ${feature.sourceFiles.join(', ')}

// TODO: Implement using Bedrock Script API
// Refer to the original Java code and Bedrock documentation
// https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/`,
        affectedFiles: feature.sourceFiles,
        relatedFeature: feature.id,
      });
    });
  }

  /**
   * Adds post-processing steps for error notes
   * @param errorNotes The error notes
   * @param steps The steps array to add to
   */
  private addErrorNoteSteps(
    errorNotes: { type: string; message: string; sourceFile?: string; sourceLine?: number }[],
    steps: PostProcessingStep[]
  ): void {
    errorNotes.forEach((note, index) => {
      const sourceInfo = note.sourceFile
        ? `${note.sourceFile}${note.sourceLine ? `:${note.sourceLine}` : ''}`
        : 'Unknown source';

      steps.push({
        id: `error-${index}`,
        title: `Fix ${note.type} Error`,
        description: `Error: ${note.message}\nSource: ${sourceInfo}`,
        priority: 'critical',
        codeSnippet: this.getCodeSnippetForError(note),
        affectedFiles: note.sourceFile ? [note.sourceFile] : undefined,
      });
    });
  }

  /**
   * Adds post-processing steps for warning notes
   * @param warningNotes The warning notes
   * @param steps The steps array to add to
   */
  private addWarningNoteSteps(
    warningNotes: { type: string; message: string; sourceFile?: string; sourceLine?: number }[],
    steps: PostProcessingStep[]
  ): void {
    warningNotes.forEach((note, index) => {
      const sourceInfo = note.sourceFile
        ? `${note.sourceFile}${note.sourceLine ? `:${note.sourceLine}` : ''}`
        : 'Unknown source';

      steps.push({
        id: `warning-${index}`,
        title: `Address ${note.type} Warning`,
        description: `Warning: ${note.message}\nSource: ${sourceInfo}`,
        priority: 'medium',
        codeSnippet: this.getCodeSnippetForWarning(note),
        affectedFiles: note.sourceFile ? [note.sourceFile] : undefined,
      });
    });
  }
  /**
   * Gets a code snippet for an error note
   * @param note The error note
   * @returns A code snippet
   */
  private getCodeSnippetForError(note: {
    type: string;
    message: string;
    sourceFile?: string;
    sourceLine?: number;
  }): string {
    // Generate appropriate code snippet based on error type
    switch (note.type.toLowerCase()) {
      case 'script':
      case 'logic':
      case 'api':
        return `// Error: ${note.message}
// This code needs manual implementation or fixing
// Refer to Bedrock Script API documentation
// https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/

// TODO: Implement correct functionality here
// Example implementation (adjust based on your needs):
import { world } from "@minecraft/server";

function fixedImplementation() {
  // Replace this with proper implementation
  console.warn("This function needs manual implementation");
  return null;
}`;

      case 'block':
      case 'item':
        return `// Error in ${note.type} definition: ${note.message}
// Check the JSON definition file and fix the issues
// Example fix:
{
  "format_version": "1.16.100",
  "${note.type === 'block' ? 'block' : 'item'}": {
    "description": {
      "identifier": "namespace:your_${note.type}"
    },
    // Fix the properties according to the error message
    // ...
  }
}`;

      case 'recipe':
      case 'lootTable':
        return `// Error in ${note.type}: ${note.message}
// Check the JSON definition file and fix the issues
// Example fix:
{
  "format_version": "1.16.0",
  // Fix the structure according to the error message
  // ...
}`;

      default:
        return `// Error: ${note.message}
// This requires manual fixing
// TODO: Implement the fix based on the error message`;
    }
  }

  /**
   * Gets a code snippet for a warning note
   * @param note The warning note
   * @returns A code snippet
   */
  private getCodeSnippetForWarning(note: {
    type: string;
    message: string;
    sourceFile?: string;
    sourceLine?: number;
  }): string {
    // Generate appropriate code snippet based on warning type
    switch (note.type.toLowerCase()) {
      case 'texture':
      case 'model':
        return `// Warning: ${note.message}
// You may need to adjust the ${note.type} file
// Check the resource pack structure and fix any visual issues

// For textures, ensure proper resolution and format
// For models, check geometry and texture references`;

      case 'sound':
      case 'particle':
        return `// Warning: ${note.message}
// You may need to adjust the ${note.type} definition
// Example fix for ${note.type === 'sound' ? 'sounds.json' : 'particle effect'}:

// ${
          note.type === 'sound'
            ? '{\n  "sound_name": {\n    "category": "ambient",\n    "sounds": [\n      "sounds/path/to/fixed_sound"\n    ]\n  }\n}'
            : '{\n  "format_version": "1.10.0",\n  "particle_effect": {\n    "description": {\n      "identifier": "namespace:particle_name"\n    },\n    // Fix particle properties here\n  }\n}'
        }`;

      case 'script':
      case 'logic':
        return `// Warning: ${note.message}
// This code may not function as expected
// Consider reviewing and testing this section

// Example improvement:
function improvedImplementation() {
  try {
    // Original code with potential issues
    // ...
    
    // Add proper error handling and logging
    console.log("Operation completed successfully");
  } catch (error) {
    console.error("Error in operation:", error);
  }
}`;

      default:
        return `// Warning: ${note.message}
// Consider addressing this issue to improve addon quality
// TODO: Review and fix based on the warning message`;
    }
  }

  /**
   * Sorts steps by priority
   * @param steps The steps to sort
   * @returns Sorted steps
   */
  private sortStepsByPriority(steps: PostProcessingStep[]): PostProcessingStep[] {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...steps].sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  /**
   * Generates an HTML guide
   * @param input The post-processing guide input data
   * @param steps The post-processing steps
   * @param outputPath The path to save the HTML guide to
   */
  private async generateHtmlGuide(
    input: PostProcessingGuideInput,
    steps: PostProcessingStep[],
    outputPath: string
  ): Promise<void> {
    // Generate HTML content with styling and interactive elements
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manual Post-Processing Guide: ${input.modName} v${input.modVersion}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3, h4 {
      color: #2c3e50;
    }
    .guide-header {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
      border-left: 5px solid #3498db;
    }
    .step {
      margin-bottom: 30px;
      padding: 20px;
      background-color: #fff;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      border-left: 5px solid #3498db;
    }
    .step.critical {
      border-left-color: #e74c3c;
    }
    .step.high {
      border-left-color: #f39c12;
    }
    .step.medium {
      border-left-color: #3498db;
    }
    .step.low {
      border-left-color: #2ecc71;
    }
    .priority-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      color: white;
      font-weight: bold;
      font-size: 0.8em;
      margin-left: 10px;
    }
    .critical {
      background-color: #e74c3c;
    }
    .high {
      background-color: #f39c12;
    }
    .medium {
      background-color: #3498db;
    }
    .low {
      background-color: #2ecc71;
    }
    .code-block {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      font-family: 'Courier New', Courier, monospace;
      overflow-x: auto;
      margin: 15px 0;
      border-left: 3px solid #7f8c8d;
    }
    .affected-files {
      margin-top: 10px;
      font-size: 0.9em;
      color: #7f8c8d;
    }
    .file {
      background-color: #f8f9fa;
      padding: 3px 6px;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
      margin-right: 5px;
      display: inline-block;
      margin-bottom: 5px;
    }
    .filter-container {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 5px;
    }
    .filter-button {
      margin-right: 10px;
      padding: 8px 15px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .filter-button.active {
      background-color: #3498db;
      color: white;
    }
    .filter-button.critical {
      background-color: #e74c3c;
      color: white;
    }
    .filter-button.high {
      background-color: #f39c12;
      color: white;
    }
    .filter-button.medium {
      background-color: #3498db;
      color: white;
    }
    .filter-button.low {
      background-color: #2ecc71;
      color: white;
    }
    .copy-button {
      background-color: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 5px 10px;
      font-size: 0.8em;
      cursor: pointer;
      float: right;
    }
    .copy-button:hover {
      background-color: #e9ecef;
    }
    .step-counter {
      display: inline-block;
      width: 30px;
      height: 30px;
      background-color: #3498db;
      color: white;
      border-radius: 50%;
      text-align: center;
      line-height: 30px;
      margin-right: 10px;
    }
    .step-counter.critical {
      background-color: #e74c3c;
    }
    .step-counter.high {
      background-color: #f39c12;
    }
    .step-counter.medium {
      background-color: #3498db;
    }
    .step-counter.low {
      background-color: #2ecc71;
    }
  </style>
</head>
<body>
  <div class="guide-header">
    <h1>Manual Post-Processing Guide: ${input.modName} v${input.modVersion}</h1>
    <p>This guide provides step-by-step instructions for manual fixes and improvements needed after the automatic conversion process.</p>
    <p><strong>Total steps:</strong> ${steps.length}</p>
    <p>
      <strong>Priority breakdown:</strong>
      <span class="priority-badge critical">${steps.filter((s) => s.priority === 'critical').length} Critical</span>
      <span class="priority-badge high">${steps.filter((s) => s.priority === 'high').length} High</span>
      <span class="priority-badge medium">${steps.filter((s) => s.priority === 'medium').length} Medium</span>
      <span class="priority-badge low">${steps.filter((s) => s.priority === 'low').length} Low</span>
    </p>
  </div>

  <div class="filter-container">
    <h3>Filter by Priority</h3>
    <button class="filter-button active" data-priority="all">All Steps</button>
    <button class="filter-button critical" data-priority="critical">Critical</button>
    <button class="filter-button high" data-priority="high">High</button>
    <button class="filter-button medium" data-priority="medium">Medium</button>
    <button class="filter-button low" data-priority="low">Low</button>
  </div>

  <div id="steps-container">
    ${steps
      .map(
        (step, index) => `
      <div class="step ${step.priority}" data-priority="${step.priority}">
        <h2>
          <span class="step-counter ${step.priority}">${index + 1}</span>
          ${step.title}
          <span class="priority-badge ${step.priority}">${step.priority.charAt(0).toUpperCase() + step.priority.slice(1)}</span>
        </h2>
        <p>${step.description}</p>
        
        ${
          step.codeSnippet
            ? `
          <div class="code-container">
            <button class="copy-button" onclick="copyToClipboard('code-${index}')">Copy Code</button>
            <pre class="code-block" id="code-${index}">${step.codeSnippet}</pre>
          </div>
        `
            : ''
        }
        
        ${
          step.affectedFiles && step.affectedFiles.length > 0
            ? `
          <div class="affected-files">
            <strong>Affected Files:</strong>
            ${step.affectedFiles.map((file) => `<span class="file">${file}</span>`).join('')}
          </div>
        `
            : ''
        }
      </div>
    `
      )
      .join('')}
  </div>

  <script>
    // Copy to clipboard functionality
    function copyToClipboard(elementId) {
      const element = document.getElementById(elementId);
      const text = element.textContent;
      
      navigator.clipboard.writeText(text).then(function() {
        const button = element.previousElementSibling;
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      });
    }
    
    // Filter functionality
    document.querySelectorAll('.filter-button').forEach(button => {
      button.addEventListener('click', function() {
        // Update active button
        document.querySelectorAll('.filter-button').forEach(btn => {
          btn.classList.remove('active');
        });
        this.classList.add('active');
        
        // Filter steps
        const priority = this.getAttribute('data-priority');
        const steps = document.querySelectorAll('.step');
        
        steps.forEach(step => {
          if (priority === 'all' || step.getAttribute('data-priority') === priority) {
            step.style.display = 'block';
          } else {
            step.style.display = 'none';
          }
        });
      });
    });
  </script>
</body>
</html>`;

    fs.writeFileSync(outputPath, html);
  } /**
   *
 Generates a Markdown guide
   * @param input The post-processing guide input data
   * @param steps The post-processing steps
   * @param outputPath The path to save the Markdown guide to
   */
  private async generateMarkdownGuide(
    input: PostProcessingGuideInput,
    steps: PostProcessingStep[],
    outputPath: string
  ): Promise<void> {
    // Generate Markdown content
    let markdown = `# Manual Post-Processing Guide: ${input.modName} v${input.modVersion}\n\n`;
    markdown += `This guide provides step-by-step instructions for manual fixes and improvements needed after the automatic conversion process.\n\n`;
    markdown += `**Total steps:** ${steps.length}\n\n`;
    markdown += `**Priority breakdown:**\n`;
    markdown += `- Critical: ${steps.filter((s) => s.priority === 'critical').length}\n`;
    markdown += `- High: ${steps.filter((s) => s.priority === 'high').length}\n`;
    markdown += `- Medium: ${steps.filter((s) => s.priority === 'medium').length}\n`;
    markdown += `- Low: ${steps.filter((s) => s.priority === 'low').length}\n\n`;

    markdown += `## Table of Contents\n\n`;
    steps.forEach((step, index) => {
      markdown += `${index + 1}. [${step.title}](#${index + 1}-${step.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')})\n`;
    });
    markdown += `\n`;

    // Add steps
    steps.forEach((step, index) => {
      markdown += `## ${index + 1}. ${step.title}\n\n`;
      markdown += `**Priority:** ${step.priority.charAt(0).toUpperCase() + step.priority.slice(1)}\n\n`;
      markdown += `${step.description}\n\n`;

      if (step.codeSnippet) {
        markdown += `### Code Example\n\n`;
        markdown += `\`\`\`javascript\n${step.codeSnippet}\n\`\`\`\n\n`;
      }

      if (step.affectedFiles && step.affectedFiles.length > 0) {
        markdown += `### Affected Files\n\n`;
        step.affectedFiles.forEach((file) => {
          markdown += `- \`${file}\`\n`;
        });
        markdown += `\n`;
      }
    });

    fs.writeFileSync(outputPath, markdown);
  }

  /**
   * Generates a JSON guide
   * @param input The post-processing guide input data
   * @param steps The post-processing steps
   * @param outputPath The path to save the JSON guide to
   */
  private async generateJsonGuide(
    input: PostProcessingGuideInput,
    steps: PostProcessingStep[],
    outputPath: string
  ): Promise<void> {
    // Generate JSON content
    const jsonGuide = {
      modInfo: {
        name: input.modName,
        version: input.modVersion,
      },
      summary: {
        totalSteps: steps.length,
        criticalSteps: steps.filter((s) => s.priority === 'critical').length,
        highPrioritySteps: steps.filter((s) => s.priority === 'high').length,
        mediumPrioritySteps: steps.filter((s) => s.priority === 'medium').length,
        lowPrioritySteps: steps.filter((s) => s.priority === 'low').length,
      },
      steps: steps,
    };

    fs.writeFileSync(outputPath, JSON.stringify(jsonGuide, null, 2));
  }
}
