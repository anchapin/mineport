#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Comprehensive validation of ModPorter-AI deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class DeploymentValidator {
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
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

  async validatePrerequisites() {
    await this.runTest('Node.js Version Check', async () => {
      const nodeVersion = process.version;
      const requiredVersion = '18.0.0';
      
      if (!this.compareVersions(nodeVersion.slice(1), requiredVersion)) {
        throw new Error(`Node.js version ${nodeVersion} is below required ${requiredVersion}`);
      }
    });

    await this.runTest('Dependencies Check', async () => {
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
      
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
      }
      
      if (!fs.existsSync(nodeModulesPath)) {
        throw new Error('node_modules not found - run npm install');
      }
    });

    await this.runTest('Environment Variables Check', async () => {
      const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
      }
    });
  }

  async validateConfiguration() {
    await this.runTest('Feature Flags Configuration', async () => {
      const flagsPath = path.join(__dirname, '..', 'config', 'feature-flags.json');
      
      if (!fs.existsSync(flagsPath)) {
        throw new Error('Feature flags configuration not found');
      }
      
      const flags = JSON.parse(fs.readFileSync(flagsPath, 'utf8'));
      
      const requiredFlags = [
        'enhanced_file_processing',
        'multi_strategy_analysis',
        'specialized_conversion_agents',
        'comprehensive_validation'
      ];
      
      for (const flag of requiredFlags) {
        if (!(flag in flags)) {
          throw new Error(`Missing feature flag: ${flag}`);
        }
      }
    });

    await this.runTest('Deployment Configuration', async () => {
      const deployConfigPath = path.join(__dirname, '..', 'config', 'deployment.json');
      
      if (!fs.existsSync(deployConfigPath)) {
        throw new Error('Deployment configuration not found');
      }
      
      const config = JSON.parse(fs.readFileSync(deployConfigPath, 'utf8'));
      
      if (!config.environments || !config.deployment || !config.rollback) {
        throw new Error('Invalid deployment configuration structure');
      }
    });

    await this.runTest('Monitoring Configuration', async () => {
      const monitoringConfigPath = path.join(__dirname, '..', 'config', 'monitoring.json');
      
      if (!fs.existsSync(monitoringConfigPath)) {
        throw new Error('Monitoring configuration not found');
      }
      
      const config = JSON.parse(fs.readFileSync(monitoringConfigPath, 'utf8'));
      
      if (!config.monitoring || !config.metrics || !config.alerts) {
        throw new Error('Invalid monitoring configuration structure');
      }
    });
  }

  async validateDatabase() {
    await this.runTest('Database Connectivity', async () => {
      try {
        execSync('npm run db:check', { stdio: 'pipe' });
      } catch (error) {
        throw new Error('Database connectivity check failed');
      }
    });

    await this.runTest('Database Migrations', async () => {
      try {
        const output = execSync('npm run db:status', { encoding: 'utf8' });
        
        if (output.includes('Pending: 0')) {
          // All migrations are up to date
          return;
        }
        
        // Check if ModPorter-AI migration exists
        if (!output.includes('001_modporter_ai_integration.sql')) {
          throw new Error('ModPorter-AI migration not found');
        }
      } catch (error) {
        throw new Error(`Database migration check failed: ${error.message}`);
      }
    });
  }

  async validateService() {
    await this.runTest('Service Health Check', async () => {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 10000 });
      
      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      
      if (!['healthy', 'degraded'].includes(response.data.status)) {
        throw new Error(`Service status is ${response.data.status}`);
      }
    });

    await this.runTest('Service Readiness', async () => {
      const response = await axios.get(`${this.baseUrl}/ready`, { timeout: 5000 });
      
      if (response.status !== 200) {
        throw new Error(`Readiness check failed with status ${response.status}`);
      }
      
      if (response.data.status !== 'ready') {
        throw new Error('Service is not ready');
      }
    });

    await this.runTest('Service Liveness', async () => {
      const response = await axios.get(`${this.baseUrl}/live`, { timeout: 5000 });
      
      if (response.status !== 200) {
        throw new Error(`Liveness check failed with status ${response.status}`);
      }
      
      if (response.data.status !== 'alive') {
        throw new Error('Service is not alive');
      }
    });

    await this.runTest('Metrics Endpoint', async () => {
      const response = await axios.get(`${this.baseUrl}/metrics`, { timeout: 5000 });
      
      if (response.status !== 200) {
        throw new Error(`Metrics endpoint failed with status ${response.status}`);
      }
      
      const requiredMetrics = ['system', 'memory', 'health'];
      for (const metric of requiredMetrics) {
        if (!(metric in response.data)) {
          throw new Error(`Missing metric: ${metric}`);
        }
      }
    });
  }

  async validateModPorterAI() {
    await this.runTest('ModPorter-AI Components Health', async () => {
      const response = await axios.get(`${this.baseUrl}/health`);
      
      const modporterCheck = response.data.checks.find(
        check => check.name === 'modporter-ai-components'
      );
      
      if (!modporterCheck) {
        throw new Error('ModPorter-AI components health check not found');
      }
      
      if (modporterCheck.status !== 'healthy') {
        throw new Error(`ModPorter-AI components are ${modporterCheck.status}: ${modporterCheck.message}`);
      }
    });

    await this.runTest('Feature Flag Responsiveness', async () => {
      // This test would verify that feature flags are being read correctly
      const response = await axios.get(`${this.baseUrl}/config/validate`);
      
      if (response.status !== 200) {
        throw new Error('Configuration validation failed');
      }
      
      if (!response.data.valid) {
        throw new Error('Configuration is invalid');
      }
    });
  }

  async validateSecurity() {
    await this.runTest('Security Scanning Components', async () => {
      const response = await axios.get(`${this.baseUrl}/health`);
      
      // Check for security-related health checks
      const securityChecks = response.data.checks.filter(
        check => check.name.includes('security') || check.name === 'filesystem'
      );
      
      if (securityChecks.length === 0) {
        throw new Error('No security health checks found');
      }
      
      const unhealthySecurityChecks = securityChecks.filter(
        check => check.status !== 'healthy'
      );
      
      if (unhealthySecurityChecks.length > 0) {
        throw new Error(`Unhealthy security checks: ${unhealthySecurityChecks.map(c => c.name).join(', ')}`);
      }
    });
  }

  async validatePerformance() {
    await this.runTest('Response Time Check', async () => {
      const startTime = Date.now();
      await axios.get(`${this.baseUrl}/health`);
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 5000) {
        throw new Error(`Response time ${responseTime}ms exceeds 5000ms threshold`);
      }
    });

    await this.runTest('Memory Usage Check', async () => {
      const response = await axios.get(`${this.baseUrl}/metrics`);
      const memoryUsage = response.data.memory;
      
      // Check if memory usage is reasonable (less than 1GB heap)
      if (memoryUsage.heapUsed > 1024 * 1024 * 1024) {
        throw new Error(`High memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
      }
    });
  }

  async validateDeploymentScripts() {
    await this.runTest('Deployment Scripts Exist', async () => {
      const scripts = [
        'scripts/deploy-modporter-ai.sh',
        'scripts/rollback-deployment.sh',
        'scripts/canary-deployment.sh',
        'scripts/run-migrations.js'
      ];
      
      for (const script of scripts) {
        const scriptPath = path.join(__dirname, '..', script);
        if (!fs.existsSync(scriptPath)) {
          throw new Error(`Deployment script not found: ${script}`);
        }
        
        // Check if script is executable
        try {
          fs.accessSync(scriptPath, fs.constants.X_OK);
        } catch (error) {
          throw new Error(`Deployment script not executable: ${script}`);
        }
      }
    });

    await this.runTest('Package.json Scripts', async () => {
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      const requiredScripts = [
        'deploy',
        'deploy:canary',
        'rollback',
        'db:migrate',
        'test:smoke',
        'health:check'
      ];
      
      for (const script of requiredScripts) {
        if (!(script in packageJson.scripts)) {
          throw new Error(`Missing npm script: ${script}`);
        }
      }
    });
  }

  compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return true;
      if (v1part < v2part) return false;
    }
    
    return true; // Equal versions
  }

  generateReport() {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? (this.results.passed / total * 100).toFixed(2) : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('DEPLOYMENT VALIDATION REPORT');
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
    
    // Write detailed report to file
    const reportPath = path.join(__dirname, '..', 'deployment-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: parseFloat(successRate)
      },
      tests: this.results.tests
    }, null, 2));
    
    console.log(`\nDetailed report saved to: ${reportPath}`);
    
    return this.results.failed === 0;
  }

  async run() {
    this.log('info', 'Starting deployment validation...');
    
    try {
      await this.validatePrerequisites();
      await this.validateConfiguration();
      await this.validateDatabase();
      await this.validateService();
      await this.validateModPorterAI();
      await this.validateSecurity();
      await this.validatePerformance();
      await this.validateDeploymentScripts();
      
      const success = this.generateReport();
      
      if (success) {
        this.log('success', 'All deployment validations passed!');
        process.exit(0);
      } else {
        this.log('error', 'Some deployment validations failed!');
        process.exit(1);
      }
    } catch (error) {
      this.log('error', `Validation failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new DeploymentValidator();
  validator.run();
}

module.exports = DeploymentValidator;