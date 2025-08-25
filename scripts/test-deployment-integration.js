#!/usr/bin/env node

/**
 * Deployment Integration Test Script
 * Tests integration with existing deployment scripts and infrastructure
 */

import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DeploymentIntegrationTester {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.scriptsDir = path.join(this.projectRoot, 'scripts');
    this.configDir = path.join(this.projectRoot, 'config');
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[34m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };

    console.log(`${colors[level]}[${level.toUpperCase()}]${colors.reset} ${timestamp} - ${message}`);
  }

  async runTest(name, testFn) {
    this.log('info', `Running test: ${name}`);

    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;

      this.results.passed++;
      this.results.tests.push({
        name,
        status: 'passed',
        duration,
        message: 'Test passed successfully'
      });

      this.log('success', `✓ ${name} (${duration}ms)`);
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({
        name,
        status: 'failed',
        duration: 0,
        message: error.message,
        error: error.stack
      });

      this.log('error', `✗ ${name}: ${error.message}`);
    }
  }

  async testDeploymentScriptIntegration() {
    await this.runTest('Deploy Script Syntax Check', async () => {
      const scriptPath = path.join(this.scriptsDir, 'deploy-modporter-ai.sh');

      // Check if script exists
      await fs.access(scriptPath);

      // Test script syntax with bash -n
      try {
        execSync(`bash -n "${scriptPath}"`, { stdio: 'pipe' });
      } catch (error) {
        throw new Error(`Deployment script has syntax errors: ${error.message}`);
      }
    });

    await this.runTest('Deploy Script Help Option', async () => {
      const scriptPath = path.join(this.scriptsDir, 'deploy-modporter-ai.sh');

      try {
        const output = execSync(`bash "${scriptPath}" --help`, {
          encoding: 'utf8',
          timeout: 10000
        });

        if (!output.includes('Usage:')) {
          throw new Error('Deploy script help output is missing usage information');
        }
      } catch (error) {
        if (error.status === 0) {
          // Help command succeeded
          return;
        }
        throw new Error(`Deploy script help failed: ${error.message}`);
      }
    });

    await this.runTest('Deploy Script Environment Variables', async () => {
      const scriptPath = path.join(this.scriptsDir, 'deploy-modporter-ai.sh');
      const scriptContent = await fs.readFile(scriptPath, 'utf8');

      // Check for required environment variable usage
      const requiredEnvVars = [
        'DEPLOYMENT_ENV',
        'PROJECT_ROOT',
        'FEATURE_FLAGS_FILE'
      ];

      for (const envVar of requiredEnvVars) {
        if (!scriptContent.includes(envVar)) {
          throw new Error(`Deploy script missing environment variable: ${envVar}`);
        }
      }
    });
  }

  async testCanaryDeploymentIntegration() {
    await this.runTest('Canary Script Syntax Check', async () => {
      const scriptPath = path.join(this.scriptsDir, 'canary-deployment.sh');

      await fs.access(scriptPath);

      try {
        execSync(`bash -n "${scriptPath}"`, { stdio: 'pipe' });
      } catch (error) {
        throw new Error(`Canary script has syntax errors: ${error.message}`);
      }
    });

    await this.runTest('Canary Script Dependencies', async () => {
      const scriptPath = path.join(this.scriptsDir, 'canary-deployment.sh');
      const scriptContent = await fs.readFile(scriptPath, 'utf8');

      // Check for required tool dependencies
      const requiredTools = ['jq', 'bc', 'curl'];

      for (const tool of requiredTools) {
        if (!scriptContent.includes(`command -v ${tool}`)) {
          throw new Error(`Canary script missing dependency check for: ${tool}`);
        }
      }
    });

    await this.runTest('Canary Script Configuration', async () => {
      const scriptPath = path.join(this.scriptsDir, 'canary-deployment.sh');
      const scriptContent = await fs.readFile(scriptPath, 'utf8');

      // Check for canary configuration variables
      const requiredConfig = [
        'CANARY_PERCENTAGE',
        'MONITORING_DURATION',
        'ERROR_THRESHOLD',
        'RESPONSE_TIME_THRESHOLD'
      ];

      for (const config of requiredConfig) {
        if (!scriptContent.includes(config)) {
          throw new Error(`Canary script missing configuration: ${config}`);
        }
      }
    });
  }

  async testRollbackScriptIntegration() {
    await this.runTest('Rollback Script Syntax Check', async () => {
      const scriptPath = path.join(this.scriptsDir, 'rollback-deployment.sh');

      await fs.access(scriptPath);

      try {
        execSync(`bash -n "${scriptPath}"`, { stdio: 'pipe' });
      } catch (error) {
        throw new Error(`Rollback script has syntax errors: ${error.message}`);
      }
    });

    await this.runTest('Rollback Script Types', async () => {
      const scriptPath = path.join(this.scriptsDir, 'rollback-deployment.sh');
      const scriptContent = await fs.readFile(scriptPath, 'utf8');

      // Check for different rollback types
      const rollbackTypes = ['standard', 'gradual', 'emergency'];

      for (const type of rollbackTypes) {
        if (!scriptContent.includes(type)) {
          throw new Error(`Rollback script missing rollback type: ${type}`);
        }
      }
    });

    await this.runTest('Rollback Script Backup Functionality', async () => {
      const scriptPath = path.join(this.scriptsDir, 'rollback-deployment.sh');
      const scriptContent = await fs.readFile(scriptPath, 'utf8');

      // Check for backup functionality
      if (!scriptContent.includes('backup_current_state')) {
        throw new Error('Rollback script missing backup functionality');
      }

      if (!scriptContent.includes('BACKUP_DIR')) {
        throw new Error('Rollback script missing backup directory configuration');
      }
    });
  }

  async testValidationScriptIntegration() {
    await this.runTest('Validation Script Syntax Check', async () => {
      const scriptPath = path.join(this.scriptsDir, 'validate-deployment.js');

      await fs.access(scriptPath);

      try {
        execSync(`node -c "${scriptPath}"`, { stdio: 'pipe' });
      } catch (error) {
        throw new Error(`Validation script has syntax errors: ${error.message}`);
      }
    });

    await this.runTest('Validation Script Dependencies', async () => {
      const scriptPath = path.join(this.scriptsDir, 'validate-deployment.js');
      const scriptContent = await fs.readFile(scriptPath, 'utf8');

      // Check for required dependencies
      const requiredDeps = ['axios', 'fs', 'path'];

      for (const dep of requiredDeps) {
        if (!scriptContent.includes(`require('${dep}')`)) {
          throw new Error(`Validation script missing dependency: ${dep}`);
        }
      }
    });

    await this.runTest('Validation Script Test Categories', async () => {
      const scriptPath = path.join(this.scriptsDir, 'validate-deployment.js');
      const scriptContent = await fs.readFile(scriptPath, 'utf8');

      // Check for validation categories
      const validationCategories = [
        'validatePrerequisites',
        'validateConfiguration',
        'validateDatabase',
        'validateService',
        'validateModPorterAI',
        'validateSecurity',
        'validatePerformance'
      ];

      for (const category of validationCategories) {
        if (!scriptContent.includes(category)) {
          throw new Error(`Validation script missing category: ${category}`);
        }
      }
    });
  }

  async testConfigurationIntegration() {
    await this.runTest('Deployment Configuration Structure', async () => {
      const configPath = path.join(this.configDir, 'deployment.json');

      await fs.access(configPath);

      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);

      // Validate structure
      if (!config.environments) {
        throw new Error('Deployment config missing environments section');
      }

      if (!config.deployment) {
        throw new Error('Deployment config missing deployment section');
      }

      if (!config.rollback) {
        throw new Error('Deployment config missing rollback section');
      }

      // Validate environments
      const requiredEnvs = ['canary', 'staging', 'production'];
      for (const env of requiredEnvs) {
        if (!config.environments[env]) {
          throw new Error(`Deployment config missing environment: ${env}`);
        }
      }
    });

    await this.runTest('Monitoring Configuration Structure', async () => {
      const configPath = path.join(this.configDir, 'monitoring.json');

      await fs.access(configPath);

      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);

      // Validate structure
      if (!config.monitoring) {
        throw new Error('Monitoring config missing monitoring section');
      }

      if (!config.metrics) {
        throw new Error('Monitoring config missing metrics section');
      }

      if (!config.alerts) {
        throw new Error('Monitoring config missing alerts section');
      }

      // Validate metrics categories
      const requiredMetrics = ['system', 'application', 'modporter_ai'];
      for (const metric of requiredMetrics) {
        if (!config.metrics[metric]) {
          throw new Error(`Monitoring config missing metric category: ${metric}`);
        }
      }
    });

    await this.runTest('Feature Flags Configuration', async () => {
      const configPath = path.join(this.configDir, 'feature-flags.json');

      await fs.access(configPath);

      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);

      // Validate required flags
      const requiredFlags = [
        'enhanced_file_processing',
        'multi_strategy_analysis',
        'specialized_conversion_agents',
        'comprehensive_validation'
      ];

      for (const flag of requiredFlags) {
        if (!(flag in config)) {
          throw new Error(`Feature flags missing flag: ${flag}`);
        }

        if (typeof config[flag] !== 'boolean') {
          throw new Error(`Feature flag ${flag} must be boolean`);
        }
      }
    });
  }

  async testHealthCheckIntegration() {
    await this.runTest('Health Check Service Integration', async () => {
      const healthServicePath = path.join(this.projectRoot, 'src', 'services', 'HealthCheckService.ts');

      await fs.access(healthServicePath);

      const serviceContent = await fs.readFile(healthServicePath, 'utf8');

      // Check for required health check methods
      const requiredMethods = [
        'performHealthCheck',
        'isReady',
        'checkDatabaseConnectivity',
        'checkModPorterAIComponents'
      ];

      for (const method of requiredMethods) {
        if (!serviceContent.includes(method)) {
          throw new Error(`Health service missing method: ${method}`);
        }
      }
    });

    await this.runTest('Health API Endpoints Integration', async () => {
      const healthAPIPath = path.join(this.projectRoot, 'src', 'api', 'health.ts');

      await fs.access(healthAPIPath);

      const apiContent = await fs.readFile(healthAPIPath, 'utf8');

      // Check for required endpoints
      const requiredEndpoints = [
        'health',
        'ready',
        'live',
        'metrics',
        'validateConfig'
      ];

      for (const endpoint of requiredEndpoints) {
        if (!apiContent.includes(`async ${endpoint}(`)) {
          throw new Error(`Health API missing endpoint: ${endpoint}`);
        }
      }
    });
  }

  async testDatabaseIntegration() {
    await this.runTest('Database Migration Files', async () => {
      const migrationDir = path.join(this.projectRoot, 'src', 'database', 'migrations');

      await fs.access(migrationDir);

      // Check for ModPorter-AI migration
      const migrationFile = path.join(migrationDir, '001_modporter_ai_integration.sql');
      await fs.access(migrationFile);

      // Check for rollback migration
      const rollbackFile = path.join(migrationDir, '001_modporter_ai_integration.rollback.sql');
      await fs.access(rollbackFile);
    });

    await this.runTest('Migration Script Integration', async () => {
      const migrationScript = path.join(this.scriptsDir, 'run-migrations.js');

      await fs.access(migrationScript);

      // Test script syntax
      try {
        execSync(`node -c "${migrationScript}"`, { stdio: 'pipe' });
      } catch (error) {
        throw new Error(`Migration script has syntax errors: ${error.message}`);
      }
    });
  }

  async testPackageScriptsIntegration() {
    await this.runTest('Package.json Scripts', async () => {
      const packagePath = path.join(this.projectRoot, 'package.json');

      await fs.access(packagePath);

      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      // Check for required scripts
      const requiredScripts = [
        'build',
        'test',
        'test:unit',
        'test:integration',
        'test:security',
        'test:smoke',
        'deploy',
        'deploy:canary',
        'rollback',
        'db:migrate',
        'db:check',
        'health:check'
      ];

      for (const script of requiredScripts) {
        if (!packageJson.scripts || !packageJson.scripts[script]) {
          throw new Error(`Package.json missing script: ${script}`);
        }
      }
    });
  }

  async testWorkflowIntegration() {
    await this.runTest('GitHub Actions Workflow Files', async () => {
      const workflowDir = path.join(this.projectRoot, '.github', 'workflows');

      await fs.access(workflowDir);

      const expectedWorkflows = [
        'ci-enhanced.yml',
        'security.yml',
        'deploy.yml',
        'dependencies.yml',
        'performance.yml'
      ];

      for (const workflow of expectedWorkflows) {
        const workflowPath = path.join(workflowDir, workflow);
        await fs.access(workflowPath);
      }
    });

    await this.runTest('Workflow Script References', async () => {
      const deployWorkflowPath = path.join(this.projectRoot, '.github', 'workflows', 'deploy.yml');

      await fs.access(deployWorkflowPath);

      const workflowContent = await fs.readFile(deployWorkflowPath, 'utf8');

      // Check if workflow references existing scripts
      const referencedScripts = [
        'deploy-modporter-ai.sh',
        'validate-deployment.js',
        'canary-deployment.sh'
      ];

      for (const script of referencedScripts) {
        if (!workflowContent.includes(script)) {
          throw new Error(`Deploy workflow missing script reference: ${script}`);
        }
      }
    });
  }

  generateReport() {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? (this.results.passed / total * 100).toFixed(2) : 0;

    console.log('\n' + '='.repeat(60));
    console.log('DEPLOYMENT INTEGRATION TEST REPORT');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${successRate}%`);
    console.log('='.repeat(60));

    if (this.results.failed > 0) {
      console.log('\nFAILED TESTS:');
      this.results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          console.log(`- ${test.name}: ${test.message}`);
        });
    }

    // Write detailed report
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: parseFloat(successRate)
      },
      tests: this.results.tests
    };

    const reportPath = path.join(this.projectRoot, 'deployment-integration-report.json');
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));

    console.log(`\nDetailed report saved to: ${reportPath}`);

    return this.results.failed === 0;
  }

  async run() {
    this.log('info', 'Starting deployment integration tests...');

    try {
      await this.testDeploymentScriptIntegration();
      await this.testCanaryDeploymentIntegration();
      await this.testRollbackScriptIntegration();
      await this.testValidationScriptIntegration();
      await this.testConfigurationIntegration();
      await this.testHealthCheckIntegration();
      await this.testDatabaseIntegration();
      await this.testPackageScriptsIntegration();
      await this.testWorkflowIntegration();

      const success = this.generateReport();

      if (success) {
        this.log('success', 'All deployment integration tests passed!');
        process.exit(0);
      } else {
        this.log('error', 'Some deployment integration tests failed!');
        process.exit(1);
      }
    } catch (error) {
      this.log('error', `Integration test failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new DeploymentIntegrationTester();
  tester.run();
}

export default DeploymentIntegrationTester;
