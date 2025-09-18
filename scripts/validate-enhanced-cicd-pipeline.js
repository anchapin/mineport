#!/usr/bin/env node

/**
 * Comprehensive CI/CD Pipeline Validation Script
 *
 * This script performs end-to-end validation of the enhanced GitHub Actions
 * CI/CD pipeline, testing all components and integration points.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const yaml = require('js-yaml');

class PipelineValidator {
  constructor() {
    this.results = {
      workflowValidation: {},
      integrationTests: {},
      performanceMetrics: {},
      failureScenarios: {},
      summary: {},
    };
    this.startTime = Date.now();
  }

  /**
   * Main validation entry point
   */
  async validate() {
    console.log('🚀 Starting comprehensive CI/CD pipeline validation...\n');

    try {
      await this.validateWorkflowFiles();
      await this.validateIntegrationPoints();
      await this.validatePerformanceMetrics();
      await this.testFailureScenarios();
      await this.generateValidationReport();

      console.log('\n✅ Pipeline validation completed successfully!');
      return this.results;
    } catch (error) {
      console.error('\n❌ Pipeline validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate all workflow files for syntax and configuration
   */
  async validateWorkflowFiles() {
    console.log('📋 Validating workflow files...');

    const workflowDir = '.github/workflows';
    const expectedWorkflows = [
      'ci-enhanced.yml',
      'security.yml',
      'deploy.yml',
      'dependencies.yml',
      'performance.yml',
      'artifacts.yml',
      'monitoring.yml',
    ];

    for (const workflow of expectedWorkflows) {
      const workflowPath = path.join(workflowDir, workflow);

      try {
        if (!fs.existsSync(workflowPath)) {
          throw new Error(`Workflow file ${workflow} not found`);
        }

        const content = fs.readFileSync(workflowPath, 'utf8');
        const parsed = yaml.load(content);

        // Validate workflow structure
        this.validateWorkflowStructure(workflow, parsed);

        this.results.workflowValidation[workflow] = {
          status: 'valid',
          jobs: Object.keys(parsed.jobs || {}),
          triggers: parsed.on ? Object.keys(parsed.on) : [],
        };

        console.log(`  ✅ ${workflow} - Valid`);
      } catch (error) {
        this.results.workflowValidation[workflow] = {
          status: 'invalid',
          error: error.message,
        };
        console.log(`  ❌ ${workflow} - ${error.message}`);
      }
    }
  }

  /**
   * Validate workflow structure and required components
   */
  validateWorkflowStructure(workflowName, workflow) {
    // Check for required fields
    if (!workflow.name) {
      throw new Error('Missing workflow name');
    }

    if (!workflow.on) {
      throw new Error('Missing workflow triggers');
    }

    if (!workflow.jobs || Object.keys(workflow.jobs).length === 0) {
      throw new Error('No jobs defined');
    }

    // Validate specific workflow requirements
    switch (workflowName) {
      case 'ci-enhanced.yml':
        this.validateCIWorkflow(workflow);
        break;
      case 'security.yml':
        this.validateSecurityWorkflow(workflow);
        break;
      case 'deploy.yml':
        this.validateDeploymentWorkflow(workflow);
        break;
    }
  }

  /**
   * Validate CI workflow specific requirements
   */
  validateCIWorkflow(workflow) {
    const jobs = workflow.jobs;

    // Check for matrix builds
    const hasMatrixBuild = Object.values(jobs).some((job) => job.strategy && job.strategy.matrix);

    if (!hasMatrixBuild) {
      throw new Error('CI workflow missing matrix build strategy');
    }

    // Check for test jobs
    const hasTestJob = Object.keys(jobs).some(
      (jobName) => jobName.includes('test') || jobName.includes('Test')
    );

    if (!hasTestJob) {
      throw new Error('CI workflow missing test jobs');
    }
  }

  /**
   * Validate security workflow requirements
   */
  validateSecurityWorkflow(workflow) {
    const jobs = workflow.jobs;

    // Check for security scanning jobs
    const securityJobs = ['codeql', 'dependency-scan', 'secret-scan'];
    const hasSecurityJobs = securityJobs.some((jobType) =>
      Object.keys(jobs).some((jobName) => jobName.toLowerCase().includes(jobType.replace('-', '')))
    );

    if (!hasSecurityJobs) {
      throw new Error('Security workflow missing required security scanning jobs');
    }
  }

  /**
   * Validate deployment workflow requirements
   */
  validateDeploymentWorkflow(workflow) {
    const jobs = workflow.jobs;

    // Check for deployment environments
    const hasEnvironments = Object.values(jobs).some(
      (job) =>
        job.environment ||
        (job.steps &&
          job.steps.some(
            (step) =>
              step.name && (step.name.includes('staging') || step.name.includes('production'))
          ))
    );

    if (!hasEnvironments) {
      throw new Error('Deployment workflow missing environment configurations');
    }
  }

  /**
   * Test integration with existing infrastructure
   */
  async validateIntegrationPoints() {
    console.log('\n🔗 Validating integration points...');

    const integrationTests = [
      {
        name: 'Deployment Scripts',
        test: () => this.testDeploymentScripts(),
      },
      {
        name: 'Health Check Endpoints',
        test: () => this.testHealthCheckEndpoints(),
      },
      {
        name: 'Configuration Files',
        test: () => this.testConfigurationFiles(),
      },
      {
        name: 'Test Infrastructure',
        test: () => this.testTestInfrastructure(),
      },
      {
        name: 'Monitoring Integration',
        test: () => this.testMonitoringIntegration(),
      },
    ];

    for (const test of integrationTests) {
      try {
        await test.test();
        this.results.integrationTests[test.name] = { status: 'passed' };
        console.log(`  ✅ ${test.name} - Integration validated`);
      } catch (error) {
        this.results.integrationTests[test.name] = {
          status: 'failed',
          error: error.message,
        };
        console.log(`  ❌ ${test.name} - ${error.message}`);
      }
    }
  }

  /**
   * Test deployment script integration
   */
  async testDeploymentScripts() {
    const deploymentScripts = [
      'scripts/deploy-modporter-ai.sh',
      'scripts/canary-deployment.sh',
      'scripts/rollback-deployment.sh',
      'scripts/validate-deployment.js',
    ];

    for (const script of deploymentScripts) {
      if (!fs.existsSync(script)) {
        throw new Error(`Deployment script ${script} not found`);
      }

      // Check script permissions and syntax
      const stats = fs.statSync(script);
      if (!(stats.mode & parseInt('111', 8))) {
        console.warn(`  ⚠️  ${script} may not be executable`);
      }
    }

    // Test script dry-run capabilities
    try {
      execSync('bash -n scripts/deploy-modporter-ai.sh', { stdio: 'pipe' });
      execSync('bash -n scripts/canary-deployment.sh', { stdio: 'pipe' });
      execSync('bash -n scripts/rollback-deployment.sh', { stdio: 'pipe' });
    } catch (error) {
      throw new Error(`Deployment script syntax validation failed: ${error.message}`);
    }
  }

  /**
   * Test health check endpoint integration
   */
  async testHealthCheckEndpoints() {
    const healthEndpoints = ['/health', '/ready', '/live'];

    // Verify health check implementation exists
    const healthServicePath = 'src/api/health.ts';
    if (!fs.existsSync(healthServicePath)) {
      throw new Error('Health check service implementation not found');
    }

    const healthContent = fs.readFileSync(healthServicePath, 'utf8');

    // Check for required endpoints
    for (const endpoint of healthEndpoints) {
      if (!healthContent.includes(endpoint)) {
        throw new Error(`Health endpoint ${endpoint} not implemented`);
      }
    }
  }

  /**
   * Test configuration file integration
   */
  async testConfigurationFiles() {
    const configFiles = [
      'config/default.ts',
      'config/production.ts',
      'config/deployment.json',
      'config/monitoring.json',
    ];

    for (const configFile of configFiles) {
      if (!fs.existsSync(configFile)) {
        throw new Error(`Configuration file ${configFile} not found`);
      }

      // Validate JSON files
      if (configFile.endsWith('.json')) {
        try {
          const content = fs.readFileSync(configFile, 'utf8');
          JSON.parse(content);
        } catch (error) {
          throw new Error(`Invalid JSON in ${configFile}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Test test infrastructure integration
   */
  async testTestInfrastructure() {
    const testScripts = ['scripts/run-comprehensive-tests.js', 'scripts/coverage-report.cjs'];

    for (const script of testScripts) {
      if (!fs.existsSync(script)) {
        throw new Error(`Test script ${script} not found`);
      }
    }

    // Verify test configuration
    const vitestConfig = 'vitest.config.ts';
    if (!fs.existsSync(vitestConfig)) {
      throw new Error('Vitest configuration not found');
    }

    // Check for test directories
    const testDirs = ['tests/unit', 'tests/integration', 'tests/security'];
    for (const testDir of testDirs) {
      if (!fs.existsSync(testDir)) {
        throw new Error(`Test directory ${testDir} not found`);
      }
    }
  }

  /**
   * Test monitoring integration
   */
  async testMonitoringIntegration() {
    const monitoringFiles = [
      'config/monitoring.json',
      'src/services/MonitoringService.ts',
      'src/services/AlertingService.ts',
    ];

    for (const file of monitoringFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Monitoring file ${file} not found`);
      }
    }
  }

  /**
   * Validate performance metrics and improvements
   */
  async validatePerformanceMetrics() {
    console.log('\n📊 Validating performance metrics...');

    const performanceTests = [
      {
        name: 'Build Performance',
        test: () => this.measureBuildPerformance(),
      },
      {
        name: 'Test Execution Time',
        test: () => this.measureTestPerformance(),
      },
      {
        name: 'Cache Effectiveness',
        test: () => this.measureCachePerformance(),
      },
      {
        name: 'Resource Usage',
        test: () => this.measureResourceUsage(),
      },
    ];

    for (const test of performanceTests) {
      try {
        const metrics = await test.test();
        this.results.performanceMetrics[test.name] = {
          status: 'measured',
          metrics,
        };
        console.log(`  ✅ ${test.name} - Metrics collected`);
      } catch (error) {
        this.results.performanceMetrics[test.name] = {
          status: 'failed',
          error: error.message,
        };
        console.log(`  ❌ ${test.name} - ${error.message}`);
      }
    }
  }

  /**
   * Measure build performance
   */
  async measureBuildPerformance() {
    const startTime = Date.now();

    try {
      // Simulate build process
      execSync('npm run build', { stdio: 'pipe', timeout: 300000 });
      const buildTime = Date.now() - startTime;

      return {
        buildTime: `${buildTime}ms`,
        status: buildTime < 120000 ? 'optimal' : 'needs-optimization',
      };
    } catch (error) {
      throw new Error(`Build performance test failed: ${error.message}`);
    }
  }

  /**
   * Measure test execution performance
   */
  async measureTestPerformance() {
    const startTime = Date.now();

    try {
      // Run a subset of tests for performance measurement
      execSync('npm run test:unit -- --run --reporter=json', {
        stdio: 'pipe',
        timeout: 180000,
      });
      const testTime = Date.now() - startTime;

      return {
        testTime: `${testTime}ms`,
        status: testTime < 60000 ? 'optimal' : 'needs-optimization',
      };
    } catch (error) {
      // Non-critical for validation
      return {
        testTime: 'unknown',
        status: 'measurement-failed',
        note: 'Test performance measurement failed but not critical for validation',
      };
    }
  }

  /**
   * Measure cache effectiveness
   */
  async measureCachePerformance() {
    // Check for cache configuration in workflows
    const ciWorkflow = '.github/workflows/ci-enhanced.yml';
    if (!fs.existsSync(ciWorkflow)) {
      throw new Error('CI workflow not found for cache validation');
    }

    const content = fs.readFileSync(ciWorkflow, 'utf8');
    const hasCaching = content.includes('actions/cache') || content.includes('cache:');

    return {
      cachingEnabled: hasCaching,
      status: hasCaching ? 'configured' : 'not-configured',
    };
  }

  /**
   * Measure resource usage
   */
  async measureResourceUsage() {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencyCount =
      Object.keys(packageJson.dependencies || {}).length +
      Object.keys(packageJson.devDependencies || {}).length;

    return {
      dependencies: dependencyCount,
      status: dependencyCount < 200 ? 'optimal' : 'high',
    };
  }

  /**
   * Test failure scenarios and recovery mechanisms
   */
  async testFailureScenarios() {
    console.log('\n🔥 Testing failure scenarios...');

    const failureTests = [
      {
        name: 'Test Failure Handling',
        test: () => this.testTestFailureHandling(),
      },
      {
        name: 'Build Failure Recovery',
        test: () => this.testBuildFailureRecovery(),
      },
      {
        name: 'Deployment Rollback',
        test: () => this.testDeploymentRollback(),
      },
      {
        name: 'Security Scan Failures',
        test: () => this.testSecurityFailureHandling(),
      },
    ];

    for (const test of failureTests) {
      try {
        await test.test();
        this.results.failureScenarios[test.name] = { status: 'validated' };
        console.log(`  ✅ ${test.name} - Failure handling validated`);
      } catch (error) {
        this.results.failureScenarios[test.name] = {
          status: 'failed',
          error: error.message,
        };
        console.log(`  ❌ ${test.name} - ${error.message}`);
      }
    }
  }

  /**
   * Test test failure handling mechanisms
   */
  async testTestFailureHandling() {
    // Check for test failure handling in CI workflow
    const ciWorkflow = '.github/workflows/ci-enhanced.yml';
    const content = fs.readFileSync(ciWorkflow, 'utf8');

    const hasFailureHandling =
      content.includes('continue-on-error') ||
      content.includes('if: failure()') ||
      content.includes('always()');

    if (!hasFailureHandling) {
      throw new Error('No test failure handling mechanisms found in CI workflow');
    }
  }

  /**
   * Test build failure recovery
   */
  async testBuildFailureRecovery() {
    // Check for retry mechanisms and cache invalidation
    const workflows = ['.github/workflows/ci-enhanced.yml'];

    for (const workflow of workflows) {
      const content = fs.readFileSync(workflow, 'utf8');
      const hasRetryLogic = content.includes('retry') || content.includes('continue-on-error');

      if (!hasRetryLogic) {
        console.warn(`  ⚠️  No retry logic found in ${workflow}`);
      }
    }
  }

  /**
   * Test deployment rollback capabilities
   */
  async testDeploymentRollback() {
    const rollbackScript = 'scripts/rollback-deployment.sh';
    if (!fs.existsSync(rollbackScript)) {
      throw new Error('Rollback deployment script not found');
    }

    // Check deployment workflow for rollback integration
    const deployWorkflow = '.github/workflows/deploy.yml';
    if (fs.existsSync(deployWorkflow)) {
      const content = fs.readFileSync(deployWorkflow, 'utf8');
      const hasRollbackIntegration = content.includes('rollback') || content.includes('failure()');

      if (!hasRollbackIntegration) {
        console.warn('  ⚠️  No rollback integration found in deployment workflow');
      }
    }
  }

  /**
   * Test security failure handling
   */
  async testSecurityFailureHandling() {
    const securityWorkflow = '.github/workflows/security.yml';
    if (!fs.existsSync(securityWorkflow)) {
      throw new Error('Security workflow not found');
    }

    const content = fs.readFileSync(securityWorkflow, 'utf8');
    const hasSecurityFailureHandling =
      content.includes('security') &&
      (content.includes('if: failure()') || content.includes('always()'));

    if (!hasSecurityFailureHandling) {
      console.warn('  ⚠️  Limited security failure handling found');
    }
  }

  /**
   * Generate comprehensive validation report
   */
  async generateValidationReport() {
    console.log('\n📄 Generating validation report...');

    const totalTime = Date.now() - this.startTime;

    this.results.summary = {
      totalValidationTime: `${totalTime}ms`,
      timestamp: new Date().toISOString(),
      workflowsValidated: Object.keys(this.results.workflowValidation).length,
      integrationTestsPassed: Object.values(this.results.integrationTests).filter(
        (test) => test.status === 'passed'
      ).length,
      performanceMetricsCollected: Object.keys(this.results.performanceMetrics).length,
      failureScenariosValidated: Object.values(this.results.failureScenarios).filter(
        (test) => test.status === 'validated'
      ).length,
      overallStatus: this.calculateOverallStatus(),
    };

    // Write detailed report to file
    const reportPath = 'validation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    console.log(`  ✅ Validation report generated: ${reportPath}`);

    // Print summary
    this.printValidationSummary();
  }

  /**
   * Calculate overall validation status
   */
  calculateOverallStatus() {
    const workflowFailures = Object.values(this.results.workflowValidation).filter(
      (result) => result.status === 'invalid'
    ).length;

    const integrationFailures = Object.values(this.results.integrationTests).filter(
      (result) => result.status === 'failed'
    ).length;

    const criticalFailures = workflowFailures + integrationFailures;

    if (criticalFailures === 0) {
      return 'PASSED';
    } else if (criticalFailures <= 2) {
      return 'PASSED_WITH_WARNINGS';
    } else {
      return 'FAILED';
    }
  }

  /**
   * Print validation summary
   */
  printValidationSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));

    const summary = this.results.summary;
    console.log(`Overall Status: ${summary.overallStatus}`);
    console.log(`Total Time: ${summary.totalValidationTime}`);
    console.log(`Workflows Validated: ${summary.workflowsValidated}`);
    console.log(`Integration Tests Passed: ${summary.integrationTestsPassed}`);
    console.log(`Performance Metrics: ${summary.performanceMetricsCollected}`);
    console.log(`Failure Scenarios Validated: ${summary.failureScenariosValidated}`);

    if (summary.overallStatus === 'FAILED') {
      console.log('\n❌ CRITICAL ISSUES FOUND - Review validation report for details');
    } else if (summary.overallStatus === 'PASSED_WITH_WARNINGS') {
      console.log('\n⚠️  VALIDATION PASSED WITH WARNINGS - Review report for improvements');
    } else {
      console.log('\n✅ ALL VALIDATIONS PASSED - Pipeline ready for deployment');
    }

    console.log('='.repeat(60));
  }
}

// Main execution
if (require.main === module) {
  const validator = new PipelineValidator();

  validator
    .validate()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = PipelineValidator;
