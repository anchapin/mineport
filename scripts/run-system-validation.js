#!/usr/bin/env node

/**
 * Comprehensive System Validation Runner
 *
 * This script orchestrates all system validation tests for the enhanced
 * GitHub Actions CI/CD pipeline, providing a single entry point for
 * complete system validation.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import validation modules
const PipelineValidator = require('./validate-enhanced-cicd-pipeline');
const PipelinePerformanceTester = require('./pipeline-performance-test');
const FailureScenarioTester = require('./test-failure-scenarios');

class SystemValidationRunner {
  constructor() {
    this.validationResults = {
      pipelineValidation: null,
      performanceValidation: null,
      failureScenarioValidation: null,
      overallStatus: null,
      summary: {},
      timestamp: new Date().toISOString(),
    };
    this.startTime = Date.now();
  }

  /**
   * Run comprehensive system validation
   */
  async runSystemValidation() {
    console.log('🚀 Starting comprehensive system validation...\n');
    console.log('This will validate the enhanced CI/CD pipeline across multiple dimensions:');
    console.log('  • Pipeline configuration and integration');
    console.log('  • Performance improvements and metrics');
    console.log('  • Failure scenarios and recovery mechanisms\n');

    try {
      // Run pipeline validation
      await this.runPipelineValidation();

      // Run performance validation
      await this.runPerformanceValidation();

      // Run failure scenario validation
      await this.runFailureScenarioValidation();

      // Generate comprehensive report
      await this.generateComprehensiveReport();

      // Print final summary
      this.printFinalSummary();

      console.log('\n✅ Comprehensive system validation completed!');
      return this.validationResults;
    } catch (error) {
      console.error('\n❌ System validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Run pipeline validation tests
   */
  async runPipelineValidation() {
    console.log('📋 Running pipeline validation...\n');

    try {
      const validator = new PipelineValidator();
      this.validationResults.pipelineValidation = await validator.validate();

      console.log('✅ Pipeline validation completed successfully');
    } catch (error) {
      console.error('❌ Pipeline validation failed:', error.message);
      this.validationResults.pipelineValidation = {
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  /**
   * Run performance validation tests
   */
  async runPerformanceValidation() {
    console.log('\n📊 Running performance validation...\n');

    try {
      const performanceTester = new PipelinePerformanceTester();
      this.validationResults.performanceValidation = await performanceTester.runPerformanceTests();

      console.log('✅ Performance validation completed successfully');
    } catch (error) {
      console.error('❌ Performance validation failed:', error.message);
      this.validationResults.performanceValidation = {
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  /**
   * Run failure scenario validation tests
   */
  async runFailureScenarioValidation() {
    console.log('\n🔥 Running failure scenario validation...\n');

    try {
      const failureTester = new FailureScenarioTester();
      this.validationResults.failureScenarioValidation = await failureTester.runFailureTests();

      console.log('✅ Failure scenario validation completed successfully');
    } catch (error) {
      console.error('❌ Failure scenario validation failed:', error.message);
      this.validationResults.failureScenarioValidation = {
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  /**
   * Generate comprehensive validation report
   */
  async generateComprehensiveReport() {
    console.log('\n📄 Generating comprehensive validation report...');

    const totalTime = Date.now() - this.startTime;

    // Calculate overall status
    this.validationResults.overallStatus = this.calculateOverallStatus();

    // Generate summary
    this.validationResults.summary = {
      totalValidationTime: `${totalTime}ms`,
      pipelineValidationStatus: this.getPipelineValidationStatus(),
      performanceValidationStatus: this.getPerformanceValidationStatus(),
      failureScenarioValidationStatus: this.getFailureScenarioValidationStatus(),
      overallStatus: this.validationResults.overallStatus,
      recommendations: this.generateOverallRecommendations(),
      nextSteps: this.generateNextSteps(),
    };

    // Write comprehensive report
    const reportPath = 'comprehensive-system-validation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.validationResults, null, 2));

    console.log(`  ✅ Comprehensive report generated: ${reportPath}`);

    // Generate executive summary
    await this.generateExecutiveSummary();
  }

  /**
   * Calculate overall validation status
   */
  calculateOverallStatus() {
    const statuses = [
      this.getPipelineValidationStatus(),
      this.getPerformanceValidationStatus(),
      this.getFailureScenarioValidationStatus(),
    ];

    const failedCount = statuses.filter((status) => status === 'FAILED').length;
    const passedCount = statuses.filter((status) => status === 'PASSED').length;
    const warningCount = statuses.filter((status) => status === 'PASSED_WITH_WARNINGS').length;

    if (failedCount > 0) {
      return 'FAILED';
    } else if (warningCount > 0) {
      return 'PASSED_WITH_WARNINGS';
    } else if (passedCount === statuses.length) {
      return 'PASSED';
    } else {
      return 'INCOMPLETE';
    }
  }

  /**
   * Get pipeline validation status
   */
  getPipelineValidationStatus() {
    if (!this.validationResults.pipelineValidation) {
      return 'NOT_RUN';
    }

    if (this.validationResults.pipelineValidation.status === 'FAILED') {
      return 'FAILED';
    }

    return this.validationResults.pipelineValidation.summary?.overallStatus || 'UNKNOWN';
  }

  /**
   * Get performance validation status
   */
  getPerformanceValidationStatus() {
    if (!this.validationResults.performanceValidation) {
      return 'NOT_RUN';
    }

    if (this.validationResults.performanceValidation.status === 'FAILED') {
      return 'FAILED';
    }

    // Check performance metrics for overall status
    const buildMetrics = Object.values(
      this.validationResults.performanceValidation.buildPerformance || {}
    );
    const testMetrics = Object.values(
      this.validationResults.performanceValidation.testPerformance || {}
    );

    const hasFailures = [...buildMetrics, ...testMetrics].some(
      (metric) => metric.status === 'NEEDS_OPTIMIZATION' || metric.status === 'FAILED'
    );

    return hasFailures ? 'PASSED_WITH_WARNINGS' : 'PASSED';
  }

  /**
   * Get failure scenario validation status
   */
  getFailureScenarioValidationStatus() {
    if (!this.validationResults.failureScenarioValidation) {
      return 'NOT_RUN';
    }

    if (this.validationResults.failureScenarioValidation.status === 'FAILED') {
      return 'FAILED';
    }

    // Check failure handling quality
    const allFailureTests = [
      ...Object.values(this.validationResults.failureScenarioValidation.buildFailures || {}),
      ...Object.values(this.validationResults.failureScenarioValidation.testFailures || {}),
      ...Object.values(this.validationResults.failureScenarioValidation.deploymentFailures || {}),
      ...Object.values(this.validationResults.failureScenarioValidation.securityFailures || {}),
    ];

    const hasFailures = allFailureTests.some((test) => test.status === 'FAILED');
    const hasPoorHandling = allFailureTests.some(
      (test) => test.handlingQuality === 'POOR' || test.handlingQuality === 'BASIC'
    );

    if (hasFailures) {
      return 'FAILED';
    } else if (hasPoorHandling) {
      return 'PASSED_WITH_WARNINGS';
    } else {
      return 'PASSED';
    }
  }

  /**
   * Generate overall recommendations
   */
  generateOverallRecommendations() {
    const recommendations = [];

    // Pipeline validation recommendations
    if (this.getPipelineValidationStatus() !== 'PASSED') {
      recommendations.push({
        category: 'Pipeline Configuration',
        priority: 'HIGH',
        recommendation: 'Address pipeline configuration issues before deployment',
        details: 'Review workflow files and integration points for errors',
      });
    }

    // Performance recommendations
    if (this.getPerformanceValidationStatus() === 'PASSED_WITH_WARNINGS') {
      recommendations.push({
        category: 'Performance Optimization',
        priority: 'MEDIUM',
        recommendation: 'Optimize pipeline performance for better efficiency',
        details: 'Focus on build times, test execution, and cache effectiveness',
      });
    }

    // Failure handling recommendations
    if (this.getFailureScenarioValidationStatus() !== 'PASSED') {
      recommendations.push({
        category: 'Failure Handling',
        priority: 'HIGH',
        recommendation: 'Improve failure detection and recovery mechanisms',
        details: 'Enhance error handling, retry logic, and rollback capabilities',
      });
    }

    // Overall system recommendations
    if (this.validationResults.overallStatus === 'PASSED') {
      recommendations.push({
        category: 'System Readiness',
        priority: 'INFO',
        recommendation: 'System is ready for production deployment',
        details: 'All validations passed successfully. Proceed with gradual rollout.',
      });
    }

    return recommendations;
  }

  /**
   * Generate next steps based on validation results
   */
  generateNextSteps() {
    const nextSteps = [];

    switch (this.validationResults.overallStatus) {
      case 'PASSED':
        nextSteps.push('✅ Proceed with gradual rollout and migration');
        nextSteps.push('📊 Monitor system performance during rollout');
        nextSteps.push('📚 Create documentation and training materials');
        nextSteps.push('🔄 Set up continuous monitoring and alerting');
        break;

      case 'PASSED_WITH_WARNINGS':
        nextSteps.push('⚠️  Address warning items before full deployment');
        nextSteps.push('🧪 Run additional targeted tests for warning areas');
        nextSteps.push('📋 Create action plan for performance improvements');
        nextSteps.push('🔍 Consider limited rollout with close monitoring');
        break;

      case 'FAILED':
        nextSteps.push('❌ Do not proceed with deployment');
        nextSteps.push('🔧 Fix critical issues identified in validation');
        nextSteps.push('🧪 Re-run validation tests after fixes');
        nextSteps.push('👥 Review issues with development team');
        break;

      default:
        nextSteps.push('❓ Complete all validation tests');
        nextSteps.push('📊 Review incomplete test results');
        nextSteps.push('🔄 Re-run system validation');
    }

    return nextSteps;
  }

  /**
   * Generate executive summary
   */
  async generateExecutiveSummary() {
    const executiveSummary = {
      title: 'Enhanced CI/CD Pipeline System Validation - Executive Summary',
      timestamp: new Date().toISOString(),
      overallStatus: this.validationResults.overallStatus,
      keyFindings: this.generateKeyFindings(),
      riskAssessment: this.generateRiskAssessment(),
      recommendations: this.generateExecutiveRecommendations(),
      deploymentReadiness: this.assessDeploymentReadiness(),
    };

    // Write executive summary
    const summaryPath = 'executive-summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(executiveSummary, null, 2));

    // Generate markdown version for easy reading
    const markdownSummary = this.generateMarkdownSummary(executiveSummary);
    fs.writeFileSync('executive-summary.md', markdownSummary);

    console.log(`  ✅ Executive summary generated: ${summaryPath} and executive-summary.md`);
  }

  /**
   * Generate key findings
   */
  generateKeyFindings() {
    const findings = [];

    // Pipeline validation findings
    if (this.validationResults.pipelineValidation?.summary) {
      const summary = this.validationResults.pipelineValidation.summary;
      findings.push({
        area: 'Pipeline Configuration',
        finding: `${summary.workflowsValidated} workflows validated with ${summary.integrationTestsPassed} integration tests passed`,
        impact: summary.overallStatus === 'PASSED' ? 'POSITIVE' : 'NEGATIVE',
      });
    }

    // Performance findings
    if (this.validationResults.performanceValidation) {
      findings.push({
        area: 'Performance',
        finding: 'Performance metrics collected across build, test, and deployment phases',
        impact: 'POSITIVE',
      });
    }

    // Failure handling findings
    if (this.validationResults.failureScenarioValidation) {
      findings.push({
        area: 'Failure Handling',
        finding: 'Failure scenarios tested across multiple pipeline stages',
        impact: 'POSITIVE',
      });
    }

    return findings;
  }

  /**
   * Generate risk assessment
   */
  generateRiskAssessment() {
    const risks = [];

    if (this.validationResults.overallStatus === 'FAILED') {
      risks.push({
        risk: 'Critical validation failures detected',
        severity: 'HIGH',
        mitigation: 'Address all critical issues before deployment',
      });
    }

    if (this.getPerformanceValidationStatus() === 'PASSED_WITH_WARNINGS') {
      risks.push({
        risk: 'Performance optimization opportunities identified',
        severity: 'MEDIUM',
        mitigation: 'Implement performance improvements for better efficiency',
      });
    }

    if (this.getFailureScenarioValidationStatus() !== 'PASSED') {
      risks.push({
        risk: 'Failure handling mechanisms need improvement',
        severity: 'MEDIUM',
        mitigation: 'Enhance error recovery and rollback capabilities',
      });
    }

    if (risks.length === 0) {
      risks.push({
        risk: 'No significant risks identified',
        severity: 'LOW',
        mitigation: 'Continue with planned deployment approach',
      });
    }

    return risks;
  }

  /**
   * Generate executive recommendations
   */
  generateExecutiveRecommendations() {
    const recommendations = [];

    switch (this.validationResults.overallStatus) {
      case 'PASSED':
        recommendations.push('Proceed with full deployment rollout');
        recommendations.push('Implement continuous monitoring and alerting');
        recommendations.push('Create comprehensive documentation');
        break;

      case 'PASSED_WITH_WARNINGS':
        recommendations.push('Address warning items before full deployment');
        recommendations.push('Consider phased rollout with monitoring');
        recommendations.push('Plan performance optimization initiatives');
        break;

      case 'FAILED':
        recommendations.push('Do not deploy until critical issues are resolved');
        recommendations.push('Conduct thorough review of failed components');
        recommendations.push('Re-validate system after implementing fixes');
        break;
    }

    return recommendations;
  }

  /**
   * Assess deployment readiness
   */
  assessDeploymentReadiness() {
    const readinessScore = this.calculateReadinessScore();

    return {
      score: readinessScore,
      status: this.getReadinessStatus(readinessScore),
      blockers: this.identifyDeploymentBlockers(),
      greenLights: this.identifyGreenLights(),
    };
  }

  /**
   * Calculate deployment readiness score
   */
  calculateReadinessScore() {
    let score = 0;
    const maxScore = 100;

    // Pipeline validation score (40 points)
    if (this.getPipelineValidationStatus() === 'PASSED') {
      score += 40;
    } else if (this.getPipelineValidationStatus() === 'PASSED_WITH_WARNINGS') {
      score += 30;
    }

    // Performance validation score (30 points)
    if (this.getPerformanceValidationStatus() === 'PASSED') {
      score += 30;
    } else if (this.getPerformanceValidationStatus() === 'PASSED_WITH_WARNINGS') {
      score += 20;
    }

    // Failure scenario validation score (30 points)
    if (this.getFailureScenarioValidationStatus() === 'PASSED') {
      score += 30;
    } else if (this.getFailureScenarioValidationStatus() === 'PASSED_WITH_WARNINGS') {
      score += 20;
    }

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Get readiness status based on score
   */
  getReadinessStatus(score) {
    if (score >= 90) return 'READY_FOR_DEPLOYMENT';
    if (score >= 70) return 'READY_WITH_CAUTION';
    if (score >= 50) return 'NEEDS_IMPROVEMENT';
    return 'NOT_READY';
  }

  /**
   * Identify deployment blockers
   */
  identifyDeploymentBlockers() {
    const blockers = [];

    if (this.getPipelineValidationStatus() === 'FAILED') {
      blockers.push('Critical pipeline configuration errors');
    }

    if (this.getFailureScenarioValidationStatus() === 'FAILED') {
      blockers.push('Inadequate failure handling mechanisms');
    }

    return blockers;
  }

  /**
   * Identify green lights for deployment
   */
  identifyGreenLights() {
    const greenLights = [];

    if (this.getPipelineValidationStatus() === 'PASSED') {
      greenLights.push('Pipeline configuration validated');
    }

    if (this.getPerformanceValidationStatus() !== 'FAILED') {
      greenLights.push('Performance metrics within acceptable range');
    }

    if (this.getFailureScenarioValidationStatus() !== 'FAILED') {
      greenLights.push('Failure handling mechanisms tested');
    }

    return greenLights;
  }

  /**
   * Generate markdown summary
   */
  generateMarkdownSummary(summary) {
    return `# Enhanced CI/CD Pipeline System Validation - Executive Summary

**Generated:** ${summary.timestamp}
**Overall Status:** ${summary.overallStatus}
**Deployment Readiness:** ${summary.deploymentReadiness.status} (${summary.deploymentReadiness.score}%)

## Key Findings

${summary.keyFindings
  .map((finding) => `- **${finding.area}:** ${finding.finding} (${finding.impact})`)
  .join('\n')}

## Risk Assessment

${summary.riskAssessment
  .map((risk) => `- **${risk.severity} Risk:** ${risk.risk}\n  - *Mitigation:* ${risk.mitigation}`)
  .join('\n\n')}

## Recommendations

${summary.recommendations.map((rec) => `- ${rec}`).join('\n')}

## Deployment Readiness

### Green Lights
${summary.deploymentReadiness.greenLights.map((item) => `✅ ${item}`).join('\n')}

### Blockers
${
  summary.deploymentReadiness.blockers.length > 0
    ? summary.deploymentReadiness.blockers.map((item) => `❌ ${item}`).join('\n')
    : '✅ No deployment blockers identified'
}

## Next Steps

${this.validationResults.summary.nextSteps.map((step) => `- ${step}`).join('\n')}
`;
  }

  /**
   * Print final validation summary
   */
  printFinalSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE SYSTEM VALIDATION SUMMARY');
    console.log('='.repeat(80));

    const summary = this.validationResults.summary;

    console.log(`Overall Status: ${summary.overallStatus}`);
    console.log(`Total Validation Time: ${summary.totalValidationTime}`);
    console.log(`Pipeline Validation: ${summary.pipelineValidationStatus}`);
    console.log(`Performance Validation: ${summary.performanceValidationStatus}`);
    console.log(`Failure Scenario Validation: ${summary.failureScenarioValidationStatus}`);

    console.log('\n📊 DEPLOYMENT READINESS');
    console.log('-'.repeat(40));
    const readiness = this.validationResults.summary;
    console.log(`Readiness Score: ${this.calculateReadinessScore()}%`);
    console.log(`Status: ${this.getReadinessStatus(this.calculateReadinessScore())}`);

    console.log('\n🎯 NEXT STEPS');
    console.log('-'.repeat(40));
    summary.nextSteps.forEach((step) => console.log(step));

    if (summary.overallStatus === 'PASSED') {
      console.log('\n🎉 SYSTEM VALIDATION PASSED - READY FOR DEPLOYMENT!');
    } else if (summary.overallStatus === 'PASSED_WITH_WARNINGS') {
      console.log('\n⚠️  SYSTEM VALIDATION PASSED WITH WARNINGS - PROCEED WITH CAUTION');
    } else {
      console.log('\n❌ SYSTEM VALIDATION FAILED - DO NOT DEPLOY');
    }

    console.log('='.repeat(80));
  }
}

// Main execution
if (require.main === module) {
  const runner = new SystemValidationRunner();

  runner
    .runSystemValidation()
    .then(() => {
      const readinessScore = runner.calculateReadinessScore();
      process.exit(readinessScore >= 70 ? 0 : 1);
    })
    .catch((error) => {
      console.error('System validation failed:', error);
      process.exit(1);
    });
}

module.exports = SystemValidationRunner;
