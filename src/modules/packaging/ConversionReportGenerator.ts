import * as fs from 'fs';
import * as path from 'path';
import logger from '../../utils/logger.js';
import { Feature, CompromiseReport, AppliedCompromiseStrategy } from '../../types/compromise.js';
import { ManualPostProcessingGuide, PostProcessingStep } from './ManualPostProcessingGuide.js';

/**
 * Interface for conversion report input
 */
interface ConversionReportInput {
  modName: string;
  modVersion: string;
  modLoader: 'forge' | 'fabric';
  conversionDate: Date;
  features: {
    tier1: Feature[];
    tier2: Feature[];
    tier3: Feature[];
    tier4: Feature[];
  };
  assets: {
    textures: number;
    models: number;
    sounds: number;
    particles: number;
  };
  configurations: {
    blocks: number;
    items: number;
    recipes: number;
    lootTables: number;
  };
  scripts: {
    total: number;
    generated: number;
    stubbed: number;
  };
  compromiseReport: CompromiseReport;
  conversionNotes: ConversionNote[];
  conversionTime: number; // in milliseconds
}

/**
 * Interface for conversion note
 */
interface ConversionNote {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  sourceFile?: string;
  sourceLine?: number;
}

/**
 * Interface for conversion report output
 */
interface ConversionReportOutput {
  htmlReportPath: string;
  jsonReportPath: string;
  markdownReportPath: string;
  manualPostProcessingGuide: {
    htmlGuidePath: string;
    markdownGuidePath: string;
    jsonGuidePath: string;
    steps: PostProcessingStep[];
  };
}

/**
 * Interface for conversion quality metrics
 */
interface ConversionQualityMetrics {
  overall: number; // 0-100 score
  assets: number;
  configurations: number;
  logic: number;
  compatibility: number;
}

/**
 * ConversionReportGenerator class responsible for generating comprehensive reports
 * about the mod conversion process, including detailed sections for each conversion aspect
 * and visual indicators for conversion quality.
 *
 * This class handles:
 * 1. Creating a structured report with sections for each conversion aspect
 * 2. Generating visual indicators for conversion quality
 * 3. Providing detailed information about compromises and issues
 */
export class ConversionReportGenerator {
  /**
   * Generates a comprehensive conversion report
   * @param input The conversion report input data
   * @param outputDir The directory to save the report to
   * @returns A promise that resolves to the conversion report output
   */
  public async generateReport(
    input: ConversionReportInput,
    outputDir: string
  ): Promise<ConversionReportOutput> {
    logger.info('Generating conversion report');

    // Ensure output directory exists
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(input);

    // Generate reports in different formats
    const htmlReportPath = path.join(outputDir, 'conversion-report.html');
    const jsonReportPath = path.join(outputDir, 'conversion-report.json');
    const markdownReportPath = path.join(outputDir, 'conversion-report.md');

    // Generate HTML report
    await this.generateHtmlReport(input, qualityMetrics, htmlReportPath);

    // Generate JSON report
    await this.generateJsonReport(input, qualityMetrics, jsonReportPath);

    // Generate Markdown report
    await this.generateMarkdownReport(input, qualityMetrics, markdownReportPath);

    // Generate manual post-processing guide
    const postProcessingGuide = new ManualPostProcessingGuide();
    const postProcessingGuideOutput = await postProcessingGuide.generateGuide(
      {
        modName: input.modName,
        modVersion: input.modVersion,
        features: input.features,
        compromiseReport: input.compromiseReport,
        conversionNotes: input.conversionNotes,
      },
      outputDir
    );

    logger.info('Conversion report and manual post-processing guide generated successfully');

    return {
      htmlReportPath,
      jsonReportPath,
      markdownReportPath,
      manualPostProcessingGuide: postProcessingGuideOutput,
    };
  }

  /**
   * Calculates quality metrics for the conversion
   * @param input The conversion report input data
   * @returns The calculated quality metrics
   */
  private calculateQualityMetrics(input: ConversionReportInput): ConversionQualityMetrics {
    // Calculate asset quality (0-100)
    const totalAssets =
      input.assets.textures + input.assets.models + input.assets.sounds + input.assets.particles;
    const assetNotes = input.conversionNotes.filter(
      (note) =>
        note.type === 'texture' ||
        note.type === 'model' ||
        note.type === 'sound' ||
        note.type === 'particle'
    );
    const assetWarnings = assetNotes.filter((note) => note.severity === 'warning').length;
    const assetErrors = assetNotes.filter((note) => note.severity === 'error').length;

    const assetQuality =
      totalAssets === 0
        ? 100
        : Math.max(0, 100 - ((assetWarnings * 5 + assetErrors * 15) / totalAssets) * 100);

    // Calculate configuration quality (0-100)
    const totalConfigs =
      input.configurations.blocks +
      input.configurations.items +
      input.configurations.recipes +
      input.configurations.lootTables;
    const configNotes = input.conversionNotes.filter(
      (note) =>
        note.type === 'block' ||
        note.type === 'item' ||
        note.type === 'recipe' ||
        note.type === 'lootTable'
    );
    const configWarnings = configNotes.filter((note) => note.severity === 'warning').length;
    const configErrors = configNotes.filter((note) => note.severity === 'error').length;

    const configQuality =
      totalConfigs === 0
        ? 100
        : Math.max(0, 100 - ((configWarnings * 5 + configErrors * 15) / totalConfigs) * 100);

    // Calculate logic quality (0-100)
    const logicNotes = input.conversionNotes.filter(
      (note) => note.type === 'script' || note.type === 'logic' || note.type === 'api'
    );
    const logicWarnings = logicNotes.filter((note) => note.severity === 'warning').length;
    const logicErrors = logicNotes.filter((note) => note.severity === 'error').length;

    const stubbedPercentage =
      input.scripts.total === 0 ? 0 : (input.scripts.stubbed / input.scripts.total) * 100;
    const logicQuality =
      input.scripts.total === 0
        ? 100
        : Math.max(
            0,
            100 -
              stubbedPercentage -
              ((logicWarnings * 2 + logicErrors * 10) / input.scripts.total) * 100
          );

    // Calculate compatibility quality (0-100)
    const totalFeatures =
      input.features.tier1.length +
      input.features.tier2.length +
      input.features.tier3.length +
      input.features.tier4.length;

    const tier1Weight = 1.0;
    const tier2Weight = 0.7;
    const tier3Weight = 0.3;
    const tier4Weight = 0.0;

    const compatibilityScore =
      totalFeatures === 0
        ? 100
        : ((input.features.tier1.length * tier1Weight +
            input.features.tier2.length * tier2Weight +
            input.features.tier3.length * tier3Weight +
            input.features.tier4.length * tier4Weight) /
            totalFeatures) *
          100;

    // Calculate overall quality (weighted average)
    const overall = Math.round(
      assetQuality * 0.25 + configQuality * 0.25 + logicQuality * 0.3 + compatibilityScore * 0.2
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      assets: Math.min(100, Math.max(0, Math.round(assetQuality))),
      configurations: Math.min(100, Math.max(0, Math.round(configQuality))),
      logic: Math.min(100, Math.max(0, Math.round(logicQuality))),
      compatibility: Math.min(100, Math.max(0, Math.round(compatibilityScore))),
    };
  }

  /**
   * Gets the CSS class for a quality score
   * @param score The quality score (0-100)
   * @returns The CSS class name
   */
  private getQualityClass(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  /**
   * Gets a descriptive label for a quality score
   * @param score The quality score (0-100)
   * @returns The descriptive label
   */
  private getQualityLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  }

  /**
   * Generates HTML for feature table rows
   * @param features The features object
   * @returns HTML string for feature table rows
   */
  private generateFeatureTableRows(features: {
    tier1: Feature[];
    tier2: Feature[];
    tier3: Feature[];
    tier4: Feature[];
  }): string {
    let rows = '';

    // Add Tier 1 features
    features.tier1.forEach((feature) => {
      rows += `
        <tr>
          <td>${feature.name}</td>
          <td>${feature.type}</td>
          <td><span class="feature-tier tier-1">Tier 1</span></td>
          <td>${feature.description}</td>
        </tr>
      `;
    });

    // Add Tier 2 features
    features.tier2.forEach((feature) => {
      rows += `
        <tr>
          <td>${feature.name}</td>
          <td>${feature.type}</td>
          <td><span class="feature-tier tier-2">Tier 2</span></td>
          <td>${feature.description}</td>
        </tr>
      `;
    });

    // Add Tier 3 features
    features.tier3.forEach((feature) => {
      rows += `
        <tr>
          <td>${feature.name}</td>
          <td>${feature.type}</td>
          <td><span class="feature-tier tier-3">Tier 3</span></td>
          <td>${feature.description}</td>
        </tr>
      `;
    });

    // Add Tier 4 features
    features.tier4.forEach((feature) => {
      rows += `
        <tr>
          <td>${feature.name}</td>
          <td>${feature.type}</td>
          <td><span class="feature-tier tier-4">Tier 4</span></td>
          <td>${feature.description}</td>
        </tr>
      `;
    });

    return rows;
  }

  /**
   * Generates Markdown for feature table
   * @param features The features object
   * @returns Markdown string for feature table
   */
  private generateFeatureTableMarkdown(features: {
    tier1: Feature[];
    tier2: Feature[];
    tier3: Feature[];
    tier4: Feature[];
  }): string {
    let markdown = '| Feature | Type | Compatibility | Description |\n';
    markdown += '|---------|------|--------------|-------------|\n';

    // Add Tier 1 features
    features.tier1.forEach((feature) => {
      markdown += `| ${feature.name} | ${feature.type} | Tier 1 | ${feature.description} |\n`;
    });

    // Add Tier 2 features
    features.tier2.forEach((feature) => {
      markdown += `| ${feature.name} | ${feature.type} | Tier 2 | ${feature.description} |\n`;
    });

    // Add Tier 3 features
    features.tier3.forEach((feature) => {
      markdown += `| ${feature.name} | ${feature.type} | Tier 3 | ${feature.description} |\n`;
    });

    // Add Tier 4 features
    features.tier4.forEach((feature) => {
      markdown += `| ${feature.name} | ${feature.type} | Tier 4 | ${feature.description} |\n`;
    });

    return markdown;
  }

  /**
   * Generates HTML for conversion notes
   * @param notes The conversion notes
   * @returns HTML string for conversion notes
   */
  private generateNotesHtml(notes: ConversionNote[]): string {
    if (notes.length === 0) {
      return '<p>No notes for this section.</p>';
    }

    let html = '';

    // Group notes by severity
    const infoNotes = notes.filter((note) => note.severity === 'info');
    const warningNotes = notes.filter((note) => note.severity === 'warning');
    const errorNotes = notes.filter((note) => note.severity === 'error');

    // Add info notes
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (infoNotes.length > 0) {
      html += '<h5>Information</h5>';
      infoNotes.forEach((note) => {
        html += `
          <div class="note info">
            <strong>${note.type}:</strong> ${note.message}
            ${note.sourceFile ? `<br><small>Source: ${note.sourceFile}${note.sourceLine ? `:${note.sourceLine}` : ''}</small>` : ''}
          </div>
        `;
      });
    }

    // Add warning notes
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (warningNotes.length > 0) {
      html += '<h5>Warnings</h5>';
      warningNotes.forEach((note) => {
        html += `
          <div class="note warning">
            <strong>${note.type}:</strong> ${note.message}
            ${note.sourceFile ? `<br><small>Source: ${note.sourceFile}${note.sourceLine ? `:${note.sourceLine}` : ''}</small>` : ''}
          </div>
        `;
      });
    }

    // Add error notes
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (errorNotes.length > 0) {
      html += '<h5>Errors</h5>';
      errorNotes.forEach((note) => {
        html += `
          <div class="note error">
            <strong>${note.type}:</strong> ${note.message}
            ${note.sourceFile ? `<br><small>Source: ${note.sourceFile}${note.sourceLine ? `:${note.sourceLine}` : ''}</small>` : ''}
          </div>
        `;
      });
    }

    return html;
  }

  /**
   * Generates Markdown for conversion notes
   * @param notes The conversion notes
   * @returns Markdown string for conversion notes
   */
  private generateNotesMarkdown(notes: ConversionNote[]): string {
    if (notes.length === 0) {
      return 'No notes for this section.\n';
    }

    let markdown = '';

    // Group notes by severity
    const infoNotes = notes.filter((note) => note.severity === 'info');
    const warningNotes = notes.filter((note) => note.severity === 'warning');
    const errorNotes = notes.filter((note) => note.severity === 'error');

    // Add info notes
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (infoNotes.length > 0) {
      markdown += '#### Information\n\n';
      infoNotes.forEach((note) => {
        markdown += `- **${note.type}:** ${note.message}`;
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (note.sourceFile) {
          markdown += ` (Source: ${note.sourceFile}${note.sourceLine ? `:${note.sourceLine}` : ''})`;
        }
        markdown += '\n';
      });
      markdown += '\n';
    }

    // Add warning notes
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (warningNotes.length > 0) {
      markdown += '#### Warnings\n\n';
      warningNotes.forEach((note) => {
        markdown += `- **${note.type}:** ${note.message}`;
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (note.sourceFile) {
          markdown += ` (Source: ${note.sourceFile}${note.sourceLine ? `:${note.sourceLine}` : ''})`;
        }
        markdown += '\n';
      });
      markdown += '\n';
    }

    // Add error notes
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (errorNotes.length > 0) {
      markdown += '#### Errors\n\n';
      errorNotes.forEach((note) => {
        markdown += `- **${note.type}:** ${note.message}`;
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (note.sourceFile) {
          markdown += ` (Source: ${note.sourceFile}${note.sourceLine ? `:${note.sourceLine}` : ''})`;
        }
        markdown += '\n';
      });
      markdown += '\n';
    }

    return markdown;
  }

  /**
   * Generates HTML for compromise strategies
   * @param strategies The applied compromise strategies
   * @returns HTML string for compromise strategies
   */
  private generateCompromiseStrategiesHtml(strategies: AppliedCompromiseStrategy[]): string {
    if (strategies.length === 0) {
      return '<p>No compromise strategies were applied.</p>';
    }

    let html = '';

    strategies.forEach((strategy) => {
      html += `
        <div class="compromise-strategy">
          <h4>${strategy.strategyName}</h4>
          <p>${strategy.strategyDescription}</p>
          <p><strong>Applied to feature:</strong> ${strategy.featureId}</p>
        </div>
      `;
    });

    return html;
  }

  /**
   * Generates Markdown for compromise strategies
   * @param strategies The applied compromise strategies
   * @returns Markdown string for compromise strategies
   */
  private generateCompromiseStrategiesMarkdown(strategies: AppliedCompromiseStrategy[]): string {
    if (strategies.length === 0) {
      return 'No compromise strategies were applied.\n';
    }

    let markdown = '';

    strategies.forEach((strategy) => {
      markdown += `### ${strategy.strategyName}\n\n`;
      markdown += `${strategy.strategyDescription}\n\n`;
      markdown += `**Applied to feature:** ${strategy.featureId}\n\n`;
    });

    return markdown;
  }
  /**
   * Generates an HTML report
   * @param input The conversion report input data
   * @param qualityMetrics The calculated quality metrics
   * @param outputPath The path to save the HTML report to
   */
  private async generateHtmlReport(
    input: ConversionReportInput,
    qualityMetrics: ConversionQualityMetrics,
    outputPath: string
  ): Promise<void> {
    // Generate HTML content with styling and interactive elements
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversion Report: ${input.modName} v${input.modVersion}</title>
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
    .report-header {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
      border-left: 5px solid #3498db;
    }
    .quality-indicator {
      display: flex;
      align-items: center;
      margin: 10px 0;
    }
    .quality-bar {
      height: 20px;
      background-color: #ecf0f1;
      border-radius: 10px;
      width: 200px;
      margin-right: 10px;
      overflow: hidden;
    }
    .quality-fill {
      height: 100%;
      border-radius: 10px;
    }
    .excellent {
      background-color: #2ecc71;
    }
    .good {
      background-color: #3498db;
    }
    .fair {
      background-color: #f39c12;
    }
    .poor {
      background-color: #e74c3c;
    }
    .section {
      margin-bottom: 30px;
      padding: 20px;
      background-color: #fff;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .note {
      padding: 10px;
      margin: 5px 0;
      border-radius: 3px;
    }
    .info {
      background-color: #d1ecf1;
      border-left: 4px solid #17a2b8;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
    }
    .error {
      background-color: #f8d7da;
      border-left: 4px solid #dc3545;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f8f9fa;
    }
    .feature-tier {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      color: white;
      font-weight: bold;
      font-size: 0.8em;
    }
    .tier-1 {
      background-color: #2ecc71;
    }
    .tier-2 {
      background-color: #3498db;
    }
    .tier-3 {
      background-color: #f39c12;
    }
    .tier-4 {
      background-color: #e74c3c;
    }
    .compromise-strategy {
      background-color: #f8f9fa;
      padding: 10px;
      margin: 5px 0;
      border-radius: 3px;
      border-left: 4px solid #9b59b6;
    }
    .stats-container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
    }
    .stat-box {
      flex: 1;
      min-width: 200px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
    }
    .stat-label {
      font-size: 14px;
      color: #7f8c8d;
    }
    .collapsible {
      background-color: #f8f9fa;
      cursor: pointer;
      padding: 18px;
      width: 100%;
      border: none;
      text-align: left;
      outline: none;
      font-size: 16px;
      font-weight: bold;
      border-radius: 5px;
      margin-bottom: 5px;
    }
    .active, .collapsible:hover {
      background-color: #e9ecef;
    }
    .collapsible:after {
      content: '\\002B';
      color: #777;
      font-weight: bold;
      float: right;
      margin-left: 5px;
    }
    .active:after {
      content: "\\2212";
    }
    .content {
      padding: 0 18px;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.2s ease-out;
      background-color: white;
      border-radius: 0 0 5px 5px;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Conversion Report: ${input.modName} v${input.modVersion}</h1>
    <p>Mod Loader: ${input.modLoader.toUpperCase()}</p>
    <p>Conversion Date: ${input.conversionDate.toLocaleDateString()} ${input.conversionDate.toLocaleTimeString()}</p>
    <p>Conversion Time: ${(input.conversionTime / 1000).toFixed(2)} seconds</p>

    <h3>Overall Conversion Quality</h3>
    <div class="quality-indicator">
      <div class="quality-bar">
        <div class="quality-fill ${this.getQualityClass(qualityMetrics.overall)}" style="width: ${qualityMetrics.overall}%"></div>
      </div>
      <span>${qualityMetrics.overall}% - ${this.getQualityLabel(qualityMetrics.overall)}</span>
    </div>
  </div>

  <div class="section">
    <h2>Conversion Quality Metrics</h2>
    <div class="stats-container">
      <div class="stat-box">
        <div class="stat-value">${qualityMetrics.assets}%</div>
        <div class="stat-label">Asset Quality</div>
        <div class="quality-bar">
          <div class="quality-fill ${this.getQualityClass(qualityMetrics.assets)}" style="width: ${qualityMetrics.assets}%"></div>
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${qualityMetrics.configurations}%</div>
        <div class="stat-label">Configuration Quality</div>
        <div class="quality-bar">
          <div class="quality-fill ${this.getQualityClass(qualityMetrics.configurations)}" style="width: ${qualityMetrics.configurations}%"></div>
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${qualityMetrics.logic}%</div>
        <div class="stat-label">Logic Quality</div>
        <div class="quality-bar">
          <div class="quality-fill ${this.getQualityClass(qualityMetrics.logic)}" style="width: ${qualityMetrics.logic}%"></div>
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${qualityMetrics.compatibility}%</div>
        <div class="stat-label">Compatibility Score</div>
        <div class="quality-bar">
          <div class="quality-fill ${this.getQualityClass(qualityMetrics.compatibility)}" style="width: ${qualityMetrics.compatibility}%"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Conversion Statistics</h2>
    <div class="stats-container">
      <div class="stat-box">
        <div class="stat-value">${input.features.tier1.length + input.features.tier2.length + input.features.tier3.length + input.features.tier4.length}</div>
        <div class="stat-label">Total Features</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${input.assets.textures + input.assets.models + input.assets.sounds + input.assets.particles}</div>
        <div class="stat-label">Total Assets</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${input.configurations.blocks + input.configurations.items + input.configurations.recipes + input.configurations.lootTables}</div>
        <div class="stat-label">Total Configurations</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${input.scripts.total}</div>
        <div class="stat-label">Total Scripts</div>
      </div>
    </div>

    <h3>Feature Compatibility Breakdown</h3>
    <div class="stats-container">
      <div class="stat-box">
        <div class="stat-value">${input.features.tier1.length}</div>
        <div class="stat-label">Fully Translatable</div>
        <div class="feature-tier tier-1">Tier 1</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${input.features.tier2.length}</div>
        <div class="stat-label">Approximation Possible</div>
        <div class="feature-tier tier-2">Tier 2</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${input.features.tier3.length}</div>
        <div class="stat-label">Natively Impossible</div>
        <div class="feature-tier tier-3">Tier 3</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${input.features.tier4.length}</div>
        <div class="stat-label">Unanalyzable</div>
        <div class="feature-tier tier-4">Tier 4</div>
      </div>
    </div>
  </div>

  <button class="collapsible">Feature Details</button>
  <div class="content">
    <div class="section">
      <h3>Feature Compatibility Details</h3>
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Type</th>
            <th>Compatibility</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${this.generateFeatureTableRows(input.features)}
        </tbody>
      </table>
    </div>
  </div>

  <button class="collapsible">Asset Conversion Details</button>
  <div class="content">
    <div class="section">
      <h3>Asset Conversion Summary</h3>
      <div class="stats-container">
        <div class="stat-box">
          <div class="stat-value">${input.assets.textures}</div>
          <div class="stat-label">Textures</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${input.assets.models}</div>
          <div class="stat-label">Models</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${input.assets.sounds}</div>
          <div class="stat-label">Sounds</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${input.assets.particles}</div>
          <div class="stat-label">Particles</div>
        </div>
      </div>

      <h4>Asset Conversion Notes</h4>
      ${this.generateNotesHtml(
        input.conversionNotes.filter(
          (note) =>
            note.type === 'texture' ||
            note.type === 'model' ||
            note.type === 'sound' ||
            note.type === 'particle'
        )
      )}
    </div>
  </div>

  <button class="collapsible">Configuration Conversion Details</button>
  <div class="content">
    <div class="section">
      <h3>Configuration Conversion Summary</h3>
      <div class="stats-container">
        <div class="stat-box">
          <div class="stat-value">${input.configurations.blocks}</div>
          <div class="stat-label">Blocks</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${input.configurations.items}</div>
          <div class="stat-label">Items</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${input.configurations.recipes}</div>
          <div class="stat-label">Recipes</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${input.configurations.lootTables}</div>
          <div class="stat-label">Loot Tables</div>
        </div>
      </div>

      <h4>Configuration Conversion Notes</h4>
      ${this.generateNotesHtml(
        input.conversionNotes.filter(
          (note) =>
            note.type === 'block' ||
            note.type === 'item' ||
            note.type === 'recipe' ||
            note.type === 'lootTable'
        )
      )}
    </div>
  </div>

  <button class="collapsible">Logic Conversion Details</button>
  <div class="content">
    <div class="section">
      <h3>Logic Conversion Summary</h3>
      <div class="stats-container">
        <div class="stat-box">
          <div class="stat-value">${input.scripts.total}</div>
          <div class="stat-label">Total Scripts</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${input.scripts.generated}</div>
          <div class="stat-label">Generated Scripts</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${input.scripts.stubbed}</div>
          <div class="stat-label">Stubbed Functions</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${input.scripts.total > 0 ? Math.round((input.scripts.stubbed / input.scripts.total) * 100) : 0}%</div>
          <div class="stat-label">Stubbed Percentage</div>
        </div>
      </div>

      <h4>Logic Conversion Notes</h4>
      ${this.generateNotesHtml(
        input.conversionNotes.filter(
          (note) => note.type === 'script' || note.type === 'logic' || note.type === 'api'
        )
      )}
    </div>
  </div>

  <button class="collapsible">Compromise Strategies</button>
  <div class="content">
    <div class="section">
      <h3>Applied Compromise Strategies</h3>
      <p>Total compromises applied: ${input.compromiseReport.totalCompromisesApplied}</p>

      ${this.generateCompromiseStrategiesHtml(input.compromiseReport.appliedStrategies)}
    </div>
  </div>

  <button class="collapsible">All Conversion Notes</button>
  <div class="content">
    <div class="section">
      <h3>All Conversion Notes</h3>
      ${this.generateNotesHtml(input.conversionNotes)}
    </div>
  </div>

  <script>
    var coll = document.getElementsByClassName("collapsible");
    for (var i = 0; i < coll.length; i++) {
      coll[i].addEventListener("click", function() {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (content.style.maxHeight) {
          content.style.maxHeight = null;
        } else {
          content.style.maxHeight = content.scrollHeight + "px";
        }
      });
    }
  </script>
</body>
</html>`;

    fs.writeFileSync(outputPath, html);
  }

  /**
   * Generates a JSON report
   * @param input The conversion report input data
   * @param qualityMetrics The calculated quality metrics
   * @param outputPath The path to save the JSON report to
   */
  private async generateJsonReport(
    input: ConversionReportInput,
    qualityMetrics: ConversionQualityMetrics,
    outputPath: string
  ): Promise<void> {
    const jsonReport = {
      modInfo: {
        name: input.modName,
        version: input.modVersion,
        modLoader: input.modLoader,
      },
      conversionInfo: {
        date: input.conversionDate.toISOString(),
        durationMs: input.conversionTime,
      },
      qualityMetrics,
      features: {
        tier1: input.features.tier1,
        tier2: input.features.tier2,
        tier3: input.features.tier3,
        tier4: input.features.tier4,
        total:
          input.features.tier1.length +
          input.features.tier2.length +
          input.features.tier3.length +
          input.features.tier4.length,
      },
      assets: {
        textures: input.assets.textures,
        models: input.assets.models,
        sounds: input.assets.sounds,
        particles: input.assets.particles,
        total:
          input.assets.textures +
          input.assets.models +
          input.assets.sounds +
          input.assets.particles,
      },
      configurations: {
        blocks: input.configurations.blocks,
        items: input.configurations.items,
        recipes: input.configurations.recipes,
        lootTables: input.configurations.lootTables,
        total:
          input.configurations.blocks +
          input.configurations.items +
          input.configurations.recipes +
          input.configurations.lootTables,
      },
      scripts: {
        total: input.scripts.total,
        generated: input.scripts.generated,
        stubbed: input.scripts.stubbed,
        stubbedPercentage:
          input.scripts.total > 0 ? (input.scripts.stubbed / input.scripts.total) * 100 : 0,
      },
      compromiseReport: input.compromiseReport,
      conversionNotes: input.conversionNotes,
    };

    fs.writeFileSync(outputPath, JSON.stringify(jsonReport, null, 2));
  }

  /**
   * Generates a Markdown report
   * @param input The conversion report input data
   * @param qualityMetrics The calculated quality metrics
   * @param outputPath The path to save the Markdown report to
   */
  private async generateMarkdownReport(
    input: ConversionReportInput,
    qualityMetrics: ConversionQualityMetrics,
    outputPath: string
  ): Promise<void> {
    const markdown = `# Conversion Report: ${input.modName} v${input.modVersion}

**Mod Loader:** ${input.modLoader.toUpperCase()}
**Conversion Date:** ${input.conversionDate.toLocaleDateString()} ${input.conversionDate.toLocaleTimeString()}
**Conversion Time:** ${(input.conversionTime / 1000).toFixed(2)} seconds

## Overall Conversion Quality

**Overall Quality Score:** ${qualityMetrics.overall}% - ${this.getQualityLabel(qualityMetrics.overall)}

| Metric | Score | Rating |
|--------|-------|--------|
| Asset Quality | ${qualityMetrics.assets}% | ${this.getQualityLabel(qualityMetrics.assets)} |
| Configuration Quality | ${qualityMetrics.configurations}% | ${this.getQualityLabel(qualityMetrics.configurations)} |
| Logic Quality | ${qualityMetrics.logic}% | ${this.getQualityLabel(qualityMetrics.logic)} |
| Compatibility Score | ${qualityMetrics.compatibility}% | ${this.getQualityLabel(qualityMetrics.compatibility)} |

## Conversion Statistics

| Category | Count |
|----------|-------|
| Total Features | ${input.features.tier1.length + input.features.tier2.length + input.features.tier3.length + input.features.tier4.length} |
| Total Assets | ${input.assets.textures + input.assets.models + input.assets.sounds + input.assets.particles} |
| Total Configurations | ${input.configurations.blocks + input.configurations.items + input.configurations.recipes + input.configurations.lootTables} |
| Total Scripts | ${input.scripts.total} |

### Feature Compatibility Breakdown

| Tier | Category | Count |
|------|----------|-------|
| Tier 1 | Fully Translatable | ${input.features.tier1.length} |
| Tier 2 | Approximation Possible | ${input.features.tier2.length} |
| Tier 3 | Natively Impossible | ${input.features.tier3.length} |
| Tier 4 | Unanalyzable | ${input.features.tier4.length} |

## Feature Details

${this.generateFeatureTableMarkdown(input.features)}

## Asset Conversion Details

| Asset Type | Count |
|------------|-------|
| Textures | ${input.assets.textures} |
| Models | ${input.assets.models} |
| Sounds | ${input.assets.sounds} |
| Particles | ${input.assets.particles} |

### Asset Conversion Notes

${this.generateNotesMarkdown(
  input.conversionNotes.filter(
    (note) =>
      note.type === 'texture' ||
      note.type === 'model' ||
      note.type === 'sound' ||
      note.type === 'particle'
  )
)}

## Configuration Conversion Details

| Configuration Type | Count |
|-------------------|-------|
| Blocks | ${input.configurations.blocks} |
| Items | ${input.configurations.items} |
| Recipes | ${input.configurations.recipes} |
| Loot Tables | ${input.configurations.lootTables} |

### Configuration Conversion Notes

${this.generateNotesMarkdown(
  input.conversionNotes.filter(
    (note) =>
      note.type === 'block' ||
      note.type === 'item' ||
      note.type === 'recipe' ||
      note.type === 'lootTable'
  )
)}

## Logic Conversion Details

| Script Metric | Count |
|--------------|-------|
| Total Scripts | ${input.scripts.total} |
| Generated Scripts | ${input.scripts.generated} |
| Stubbed Functions | ${input.scripts.stubbed} |
| Stubbed Percentage | ${input.scripts.total > 0 ? Math.round((input.scripts.stubbed / input.scripts.total) * 100) : 0}% |

### Logic Conversion Notes

${this.generateNotesMarkdown(
  input.conversionNotes.filter(
    (note) => note.type === 'script' || note.type === 'logic' || note.type === 'api'
  )
)}

## Applied Compromise Strategies

Total compromises applied: ${input.compromiseReport.totalCompromisesApplied}

${this.generateCompromiseStrategiesMarkdown(input.compromiseReport.appliedStrategies)}

## All Conversion Notes

${this.generateNotesMarkdown(input.conversionNotes)}
`;

    fs.writeFileSync(outputPath, markdown);
  }
}
