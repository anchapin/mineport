import { CompromiseLevel } from '../../types/compromise.js';
import { Feature } from '../ingestion/index.js';
import { CompromiseEngineResult, BatchCompromiseResult } from './CompromiseEngine.js';
// import { CompromiseResult } from './CompromiseStrategy.js';
import { logger } from '../../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration for compromise reporting
 */
export interface CompromiseReportConfig {
  /** Output directory for reports */
  outputDirectory: string;
  /** Whether to generate HTML reports */
  generateHTML: boolean;
  /** Whether to generate JSON reports */
  generateJSON: boolean;
  /** Whether to generate markdown reports */
  generateMarkdown: boolean;
  /** Whether to include detailed strategy information */
  includeStrategyDetails: boolean;
  /** Whether to include user impact assessments */
  includeImpactAssessment: boolean;
  /** Whether to generate implementation guides */
  generateImplementationGuides: boolean;
}

/**
 * Report data structure
 */
export interface CompromiseReport {
  /** Report metadata */
  metadata: {
    generatedAt: Date;
    totalFeatures: number;
    compromisesApplied: number;
    successRate: number;
    averageImpact: number;
  };
  /** Summary statistics */
  summary: {
    impactDistribution: Record<CompromiseLevel, number>;
    strategiesUsed: Record<string, number>;
    commonIssues: string[];
    recommendations: string[];
  };
  /** Detailed results */
  details: {
    successfulCompromises: CompromiseDetail[];
    failedFeatures: FailedFeatureDetail[];
    highImpactFeatures: CompromiseDetail[];
  };
  /** Implementation guidance */
  implementation: {
    manualSteps: ManualImplementationStep[];
    alternativeApproaches: AlternativeApproach[];
    resourceRequirements: ResourceRequirement[];
  };
}

/**
 * Detailed compromise information
 */
export interface CompromiseDetail {
  feature: Feature;
  strategy: string;
  impact: {
    level: CompromiseLevel;
    userExperience: number;
    description: string;
  };
  warnings: string[];
  suggestions: string[];
  reversible: boolean;
}

/**
 * Failed feature information
 */
export interface FailedFeatureDetail {
  feature: Feature;
  errors: string[];
  strategiesConsidered: number;
  recommendations: string[];
}

/**
 * Manual implementation step
 */
export interface ManualImplementationStep {
  feature: string;
  step: number;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  requiredSkills: string[];
  resources: string[];
}

/**
 * Alternative approach suggestion
 */
export interface AlternativeApproach {
  feature: string;
  approach: string;
  description: string;
  pros: string[];
  cons: string[];
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Resource requirement information
 */
export interface ResourceRequirement {
  type: 'documentation' | 'tools' | 'skills' | 'time';
  description: string;
  priority: 'low' | 'medium' | 'high';
  features: string[];
}

/**
 * Default report configuration
 */
export const DEFAULT_REPORT_CONFIG: CompromiseReportConfig = {
  outputDirectory: './reports/compromise',
  generateHTML: true,
  generateJSON: true,
  generateMarkdown: true,
  includeStrategyDetails: true,
  includeImpactAssessment: true,
  generateImplementationGuides: true,
};

/**
 * Generates comprehensive reports about compromise decisions
 */
export class CompromiseReporter {
  private config: CompromiseReportConfig;

  constructor(config: CompromiseReportConfig = DEFAULT_REPORT_CONFIG) {
    this.config = { ...DEFAULT_REPORT_CONFIG, ...config };
  }

  /**
   * Generate a comprehensive report from batch results
   */
  async generateReport(batchResult: BatchCompromiseResult): Promise<CompromiseReport> {
    logger.info('Generating compromise report', {
      totalFeatures: batchResult.statistics.totalFeatures,
      compromisesApplied: batchResult.statistics.compromisesApplied,
    });

    const report: CompromiseReport = {
      metadata: {
        generatedAt: new Date(),
        totalFeatures: batchResult.statistics.totalFeatures,
        compromisesApplied: batchResult.statistics.compromisesApplied,
        successRate: batchResult.statistics.successRate,
        averageImpact: batchResult.statistics.averageImpact,
      },
      summary: {
        impactDistribution: batchResult.statistics.impactDistribution,
        strategiesUsed: batchResult.summary.strategiesUsed,
        commonIssues: batchResult.summary.commonIssues,
        recommendations: this.generateRecommendations(batchResult),
      },
      details: {
        successfulCompromises: this.extractSuccessfulCompromises(batchResult.results),
        failedFeatures: this.extractFailedFeatures(batchResult.results),
        highImpactFeatures: this.extractHighImpactFeatures(batchResult.results),
      },
      implementation: {
        manualSteps: this.generateManualSteps(batchResult.results),
        alternativeApproaches: this.generateAlternativeApproaches(batchResult.results),
        resourceRequirements: this.generateResourceRequirements(batchResult.results),
      },
    };

    // Save reports in requested formats
    await this.saveReports(report);

    return report;
  }

  /**
   * Generate a single feature report
   */
  async generateFeatureReport(result: CompromiseEngineResult): Promise<string> {
    const feature = result.originalFeature;
    let report = `# Compromise Report: ${feature.name}\n\n`;

    report += `**Feature Type:** ${feature.type}\n`;
    report += `**Compromise Applied:** ${result.compromiseApplied ? 'Yes' : 'No'}\n\n`;

    if (result.compromiseApplied && result.compromiseResult) {
      const compromise = result.compromiseResult;
      report += `## Compromise Details\n\n`;
      report += `**Strategy Used:** ${compromise.metadata.strategyUsed}\n`;
      report += `**Description:** ${compromise.description}\n`;
      report += `**Impact Level:** ${compromise.impactLevel}\n`;
      report += `**User Experience Impact:** ${compromise.userExperienceImpact}%\n`;
      report += `**Confidence:** ${compromise.metadata.confidence}%\n`;
      report += `**Reversible:** ${compromise.metadata.reversible ? 'Yes' : 'No'}\n\n`;

      if (compromise.warnings.length > 0) {
        report += `### Warnings\n\n`;
        compromise.warnings.forEach((warning) => {
          report += `- ${warning}\n`;
        });
        report += '\n';
      }

      if (compromise.suggestions.length > 0) {
        report += `### Suggestions\n\n`;
        compromise.suggestions.forEach((suggestion) => {
          report += `- ${suggestion}\n`;
        });
        report += '\n';
      }
    } else {
      report += `## No Compromise Applied\n\n`;
      if (result.errors.length > 0) {
        report += `### Errors\n\n`;
        result.errors.forEach((error) => {
          report += `- ${error}\n`;
        });
        report += '\n';
      }
    }

    return report;
  }

  /**
   * Update reporter configuration
   */
  updateConfig(config: Partial<CompromiseReportConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(batchResult: BatchCompromiseResult): string[] {
    const recommendations: string[] = [];
    const stats = batchResult.statistics;

    if (stats.successRate < 50) {
      recommendations.push('Consider reviewing feature compatibility before conversion');
      recommendations.push('Evaluate if manual implementation would be more effective');
    }

    if (stats.averageImpact > 60) {
      recommendations.push(
        'High average impact detected - consider alternative conversion approaches'
      );
      recommendations.push('Review user requirements to determine acceptable impact levels');
    }

    if (stats.impactDistribution[CompromiseLevel.CRITICAL] > 0) {
      recommendations.push('Critical impact features require immediate attention');
      recommendations.push('Consider excluding critical impact features from automated conversion');
    }

    const topStrategy = Object.entries(batchResult.summary.strategiesUsed).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (topStrategy && topStrategy[1] > stats.totalFeatures * 0.3) {
      recommendations.push(
        `${topStrategy[0]} strategy is heavily used - consider optimizing this approach`
      );
    }

    return recommendations;
  }

  /**
   * Extract successful compromise details
   */
  private extractSuccessfulCompromises(results: CompromiseEngineResult[]): CompromiseDetail[] {
    return results
      .filter((r) => r.compromiseApplied && r.compromiseResult)
      .map((r) => ({
        feature: r.originalFeature,
        strategy: r.compromiseResult!.metadata.strategyUsed,
        impact: {
          level: r.compromiseResult!.impactLevel,
          userExperience: r.compromiseResult!.userExperienceImpact,
          description: r.compromiseResult!.description,
        },
        warnings: r.compromiseResult!.warnings,
        suggestions: r.compromiseResult!.suggestions,
        reversible: r.compromiseResult!.metadata.reversible,
      }));
  }

  /**
   * Extract failed feature details
   */
  private extractFailedFeatures(results: CompromiseEngineResult[]): FailedFeatureDetail[] {
    return results
      .filter((r) => !r.compromiseApplied)
      .map((r) => ({
        feature: r.originalFeature,
        errors: r.errors,
        strategiesConsidered: r.metadata.strategiesConsidered,
        recommendations: this.generateFeatureRecommendations(r),
      }));
  }

  /**
   * Extract high impact features
   */
  private extractHighImpactFeatures(results: CompromiseEngineResult[]): CompromiseDetail[] {
    return this.extractSuccessfulCompromises(results).filter(
      (detail) =>
        detail.impact.level === CompromiseLevel.HIGH ||
        detail.impact.level === CompromiseLevel.CRITICAL ||
        detail.impact.userExperience > 70
    );
  }

  /**
   * Generate manual implementation steps
   */
  private generateManualSteps(results: CompromiseEngineResult[]): ManualImplementationStep[] {
    const steps: ManualImplementationStep[] = [];

    results
      .filter((r) => r.compromiseResult?.metadata.requiresManualImplementation)
      .forEach((r, index) => {
        const feature = r.originalFeature;
        steps.push({
          feature: feature.name,
          step: index + 1,
          description: `Manually implement ${feature.name} using Bedrock-specific APIs`,
          difficulty: this.assessDifficulty(feature),
          estimatedTime: this.estimateImplementationTime(feature),
          requiredSkills: this.getRequiredSkills(feature),
          resources: this.getRequiredResources(feature),
        });
      });

    return steps;
  }

  /**
   * Generate alternative approaches
   */
  private generateAlternativeApproaches(results: CompromiseEngineResult[]): AlternativeApproach[] {
    const approaches: AlternativeApproach[] = [];

    results
      .filter(
        (r) => r.strategySelection?.alternatives && r.strategySelection.alternatives.length > 0
      )
      .forEach((r) => {
        const feature = r.originalFeature;
        r.strategySelection!.alternatives.forEach((alt) => {
          approaches.push({
            feature: feature.name,
            approach: alt.strategy.getName(),
            description: alt.strategy.getDescription(),
            pros: [`Alternative to ${r.strategySelection!.strategy.getName()}`],
            cons: [alt.reason],
            complexity: this.assessComplexity(alt.strategy.getMaxImpactLevel()),
          });
        });
      });

    return approaches;
  }

  /**
   * Generate resource requirements
   */
  private generateResourceRequirements(results: CompromiseEngineResult[]): ResourceRequirement[] {
    const requirements: ResourceRequirement[] = [];

    // Documentation requirements
    const docFeatures = results
      .filter((r) => r.compromiseResult?.metadata.requiresManualImplementation)
      .map((r) => r.originalFeature.name);

    if (docFeatures.length > 0) {
      requirements.push({
        type: 'documentation',
        description: 'Comprehensive implementation guides for manual features',
        priority: 'high',
        features: docFeatures,
      });
    }

    // Skill requirements
    const complexFeatures = results
      .filter(
        (r) =>
          r.compromiseResult?.impactLevel === CompromiseLevel.HIGH ||
          r.compromiseResult?.impactLevel === CompromiseLevel.CRITICAL
      )
      .map((r) => r.originalFeature.name);

    if (complexFeatures.length > 0) {
      requirements.push({
        type: 'skills',
        description: 'Advanced Bedrock development skills for complex features',
        priority: 'high',
        features: complexFeatures,
      });
    }

    return requirements;
  }

  /**
   * Generate feature-specific recommendations
   */
  private generateFeatureRecommendations(result: CompromiseEngineResult): string[] {
    const recommendations: string[] = [];

    if (result.metadata.strategiesConsidered === 0) {
      recommendations.push('No applicable strategies found - consider custom implementation');
    } else {
      recommendations.push('Review available strategies and their requirements');
    }

    if (result.errors.includes('No applicable compromise strategy found')) {
      recommendations.push('Feature may require complete redesign for Bedrock compatibility');
    }

    return recommendations;
  }

  /**
   * Save reports in requested formats
   */
  private async saveReports(report: CompromiseReport): Promise<void> {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.config.outputDirectory, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFilename = `compromise-report-${timestamp}`;

      if (this.config.generateJSON) {
        const jsonPath = path.join(this.config.outputDirectory, `${baseFilename}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
        logger.info('JSON report saved', { path: jsonPath });
      }

      if (this.config.generateMarkdown) {
        const mdPath = path.join(this.config.outputDirectory, `${baseFilename}.md`);
        const markdown = this.generateMarkdownReport(report);
        await fs.writeFile(mdPath, markdown);
        logger.info('Markdown report saved', { path: mdPath });
      }

      if (this.config.generateHTML) {
        const htmlPath = path.join(this.config.outputDirectory, `${baseFilename}.html`);
        const html = this.generateHTMLReport(report);
        await fs.writeFile(htmlPath, html);
        logger.info('HTML report saved', { path: htmlPath });
      }
    } catch (error) {
      logger.error('Failed to save reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate markdown report content
   */
  private generateMarkdownReport(report: CompromiseReport): string {
    let md = `# Compromise Report\n\n`;
    md += `Generated: ${report.metadata.generatedAt.toISOString()}\n\n`;

    md += `## Summary\n\n`;
    md += `- **Total Features:** ${report.metadata.totalFeatures}\n`;
    md += `- **Compromises Applied:** ${report.metadata.compromisesApplied}\n`;
    md += `- **Success Rate:** ${report.metadata.successRate.toFixed(1)}%\n`;
    md += `- **Average Impact:** ${report.metadata.averageImpact.toFixed(1)}%\n\n`;

    md += `## Impact Distribution\n\n`;
    Object.entries(report.summary.impactDistribution).forEach(([level, count]) => {
      md += `- **${level}:** ${count}\n`;
    });
    md += '\n';

    md += `## Strategies Used\n\n`;
    Object.entries(report.summary.strategiesUsed).forEach(([strategy, count]) => {
      md += `- **${strategy}:** ${count}\n`;
    });
    md += '\n';

    if (report.summary.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      report.summary.recommendations.forEach((rec) => {
        md += `- ${rec}\n`;
      });
      md += '\n';
    }

    return md;
  }

  /**
   * Generate HTML report content
   */
  private generateHTMLReport(report: CompromiseReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Compromise Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 3px; }
        .high-impact { color: #d32f2f; }
        .medium-impact { color: #f57c00; }
        .low-impact { color: #388e3c; }
    </style>
</head>
<body>
    <h1>Compromise Report</h1>
    <p>Generated: ${report.metadata.generatedAt.toISOString()}</p>

    <div class="summary">
        <h2>Summary</h2>
        <div class="metric">Total Features: ${report.metadata.totalFeatures}</div>
        <div class="metric">Compromises Applied: ${report.metadata.compromisesApplied}</div>
        <div class="metric">Success Rate: ${report.metadata.successRate.toFixed(1)}%</div>
        <div class="metric">Average Impact: ${report.metadata.averageImpact.toFixed(1)}%</div>
    </div>

    <h2>Detailed Results</h2>
    <p>See JSON report for complete details.</p>
</body>
</html>`;
  }

  // Helper methods for assessment
  private assessDifficulty(feature: Feature): 'easy' | 'medium' | 'hard' {
    const complexity = feature.properties?.complexity || 'medium';
    if (complexity === 'low') return 'easy';
    if (complexity === 'high') return 'hard';
    return 'medium';
  }

  private estimateImplementationTime(feature: Feature): string {
    const difficulty = this.assessDifficulty(feature);
    switch (difficulty) {
      case 'easy':
        return '1-2 hours';
      case 'medium':
        return '4-8 hours';
      case 'hard':
        return '1-3 days';
      default:
        return '4-8 hours';
    }
  }

  private getRequiredSkills(feature: Feature): string[] {
    const skills = ['Bedrock development'];

    if (feature.type?.includes('UI')) {
      skills.push('UI/UX design');
    }

    if (feature.type?.includes('RENDERING')) {
      skills.push('Shader programming');
    }

    return skills;
  }

  private getRequiredResources(_feature: Feature): string[] {
    return ['Bedrock documentation', 'Development environment', 'Testing devices'];
  }

  private assessComplexity(impactLevel: CompromiseLevel): 'low' | 'medium' | 'high' {
    switch (impactLevel) {
      case CompromiseLevel.LOW:
      case CompromiseLevel.NONE:
        return 'low';
      case CompromiseLevel.MEDIUM:
        return 'medium';
      case CompromiseLevel.HIGH:
      case CompromiseLevel.CRITICAL:
        return 'high';
      default:
        return 'medium';
    }
  }
}
