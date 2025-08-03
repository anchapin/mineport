/**
 * Infrastructure Integration Tests
 * Tests integration with existing deployment scripts and infrastructure
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';

describe('Infrastructure Integration Tests', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const scriptsDir = path.join(projectRoot, 'scripts');
  const configDir = path.join(projectRoot, 'config');
  
  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.DEPLOYMENT_ENV = 'test';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'mineport_test';
    process.env.DB_USER = 'postgres';
  });

  describe('Deployment Scripts Integration', () => {
    it('should validate deploy-modporter-ai.sh script exists and is executable', async () => {
      const scriptPath = path.join(scriptsDir, 'deploy-modporter-ai.sh');
      
      // Check if script exists
      const scriptExists = await fs.access(scriptPath).then(() => true).catch(() => false);
      expect(scriptExists).toBe(true);
      
      // Check if script is executable
      const stats = await fs.stat(scriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeGreaterThan(0);
    });

    it('should validate canary-deployment.sh script exists and is executable', async () => {
      const scriptPath = path.join(scriptsDir, 'canary-deployment.sh');
      
      const scriptExists = await fs.access(scriptPath).then(() => true).catch(() => false);
      expect(scriptExists).toBe(true);
      
      const stats = await fs.stat(scriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeGreaterThan(0);
    });

    it('should validate rollback-deployment.sh script exists and is executable', async () => {
      const scriptPath = path.join(scriptsDir, 'rollback-deployment.sh');
      
      const scriptExists = await fs.access(scriptPath).then(() => true).catch(() => false);
      expect(scriptExists).toBe(true);
      
      const stats = await fs.stat(scriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeGreaterThan(0);
    });

    it('should validate validate-deployment.js script exists and is executable', async () => {
      const scriptPath = path.join(scriptsDir, 'validate-deployment.js');
      
      const scriptExists = await fs.access(scriptPath).then(() => true).catch(() => false);
      expect(scriptExists).toBe(true);
      
      const stats = await fs.stat(scriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeGreaterThan(0);
    });

    it('should validate run-migrations.js script exists', async () => {
      const scriptPath = path.join(scriptsDir, 'run-migrations.js');
      
      const scriptExists = await fs.access(scriptPath).then(() => true).catch(() => false);
      expect(scriptExists).toBe(true);
    });

    it('should validate run-comprehensive-tests.js script exists', async () => {
      const scriptPath = path.join(scriptsDir, 'run-comprehensive-tests.js');
      
      const scriptExists = await fs.access(scriptPath).then(() => true).catch(() => false);
      expect(scriptExists).toBe(true);
    });
  });

  describe('Configuration Files Integration', () => {
    it('should validate deployment.json configuration exists and has required structure', async () => {
      const configPath = path.join(configDir, 'deployment.json');
      
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(configExists).toBe(true);
      
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // Validate required structure
      expect(config).toHaveProperty('environments');
      expect(config).toHaveProperty('deployment');
      expect(config).toHaveProperty('rollback');
      
      // Validate environments
      expect(config.environments).toHaveProperty('canary');
      expect(config.environments).toHaveProperty('staging');
      expect(config.environments).toHaveProperty('production');
      
      // Validate deployment configuration
      expect(config.deployment).toHaveProperty('strategy');
      expect(config.deployment).toHaveProperty('healthCheckPath');
      expect(config.deployment).toHaveProperty('preDeploymentChecks');
      expect(config.deployment).toHaveProperty('postDeploymentChecks');
      
      // Validate rollback configuration
      expect(config.rollback).toHaveProperty('automaticRollback');
      expect(config.rollback).toHaveProperty('rollbackTriggers');
      expect(config.rollback).toHaveProperty('rollbackSteps');
    });

    it('should validate monitoring.json configuration exists and has required structure', async () => {
      const configPath = path.join(configDir, 'monitoring.json');
      
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(configExists).toBe(true);
      
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // Validate required structure
      expect(config).toHaveProperty('monitoring');
      expect(config).toHaveProperty('metrics');
      expect(config).toHaveProperty('alerts');
      
      // Validate metrics configuration
      expect(config.metrics).toHaveProperty('system');
      expect(config.metrics).toHaveProperty('application');
      expect(config.metrics).toHaveProperty('modporter_ai');
      
      // Validate alerts configuration
      expect(config.alerts).toHaveProperty('channels');
      expect(config.alerts).toHaveProperty('rules');
    });

    it('should validate feature-flags.json configuration exists', async () => {
      const configPath = path.join(configDir, 'feature-flags.json');
      
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(configExists).toBe(true);
      
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // Validate required feature flags
      const requiredFlags = [
        'enhanced_file_processing',
        'multi_strategy_analysis',
        'specialized_conversion_agents',
        'comprehensive_validation'
      ];
      
      for (const flag of requiredFlags) {
        expect(config).toHaveProperty(flag);
        expect(typeof config[flag]).toBe('boolean');
      }
    });
  });

  describe('Health Check Endpoints Integration', () => {
    const baseUrl = 'http://localhost:3000';
    let serverRunning = false;

    beforeAll(async () => {
      // Check if server is running
      try {
        await axios.get(`${baseUrl}/health`, { timeout: 1000 });
        serverRunning = true;
      } catch (error) {
        console.warn('Server not running, skipping endpoint tests');
        serverRunning = false;
      }
    });

    it('should validate /health endpoint exists and returns expected structure', async () => {
      if (!serverRunning) {
        console.warn('Skipping health endpoint test - server not running');
        return;
      }

      const response = await axios.get(`${baseUrl}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('checks');
      expect(response.data).toHaveProperty('summary');
      
      // Validate checks structure
      expect(Array.isArray(response.data.checks)).toBe(true);
      
      // Validate summary structure
      expect(response.data.summary).toHaveProperty('total');
      expect(response.data.summary).toHaveProperty('healthy');
      expect(response.data.summary).toHaveProperty('degraded');
      expect(response.data.summary).toHaveProperty('unhealthy');
    });

    it('should validate /ready endpoint exists and returns expected structure', async () => {
      if (!serverRunning) {
        console.warn('Skipping ready endpoint test - server not running');
        return;
      }

      const response = await axios.get(`${baseUrl}/ready`);
      
      expect([200, 503]).toContain(response.status);
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('timestamp');
      expect(['ready', 'not-ready']).toContain(response.data.status);
    });

    it('should validate /live endpoint exists and returns expected structure', async () => {
      if (!serverRunning) {
        console.warn('Skipping live endpoint test - server not running');
        return;
      }

      const response = await axios.get(`${baseUrl}/live`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('pid');
      expect(response.data).toHaveProperty('uptime');
      expect(response.data.status).toBe('alive');
    });

    it('should validate /metrics endpoint exists and returns expected structure', async () => {
      if (!serverRunning) {
        console.warn('Skipping metrics endpoint test - server not running');
        return;
      }

      const response = await axios.get(`${baseUrl}/metrics`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('system');
      expect(response.data).toHaveProperty('memory');
      expect(response.data).toHaveProperty('health');
      
      // Validate system metrics
      expect(response.data.system).toHaveProperty('uptime');
      expect(response.data.system).toHaveProperty('pid');
      expect(response.data.system).toHaveProperty('platform');
      
      // Validate memory metrics
      expect(response.data.memory).toHaveProperty('rss');
      expect(response.data.memory).toHaveProperty('heapTotal');
      expect(response.data.memory).toHaveProperty('heapUsed');
      
      // Validate health metrics
      expect(response.data.health).toHaveProperty('status');
      expect(response.data.health).toHaveProperty('totalChecks');
      expect(response.data.health).toHaveProperty('healthyChecks');
    });

    it('should validate /config/validate endpoint exists and returns expected structure', async () => {
      if (!serverRunning) {
        console.warn('Skipping config validate endpoint test - server not running');
        return;
      }

      const response = await axios.get(`${baseUrl}/config/validate`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('valid');
      expect(response.data).toHaveProperty('checks');
      expect(typeof response.data.valid).toBe('boolean');
      expect(Array.isArray(response.data.checks)).toBe(true);
    });
  });

  describe('Database Migration Integration', () => {
    it('should validate migration files exist', async () => {
      const migrationDir = path.join(projectRoot, 'src', 'database', 'migrations');
      
      const migrationExists = await fs.access(migrationDir).then(() => true).catch(() => false);
      expect(migrationExists).toBe(true);
      
      // Check for ModPorter-AI migration
      const migrationFile = path.join(migrationDir, '001_modporter_ai_integration.sql');
      const migrationFileExists = await fs.access(migrationFile).then(() => true).catch(() => false);
      expect(migrationFileExists).toBe(true);
      
      // Check for rollback migration
      const rollbackFile = path.join(migrationDir, '001_modporter_ai_integration.rollback.sql');
      const rollbackFileExists = await fs.access(rollbackFile).then(() => true).catch(() => false);
      expect(rollbackFileExists).toBe(true);
    });
  });

  describe('Package.json Scripts Integration', () => {
    it('should validate required npm scripts exist', async () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
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
        expect(packageJson.scripts).toHaveProperty(script);
        expect(typeof packageJson.scripts[script]).toBe('string');
        expect(packageJson.scripts[script].length).toBeGreaterThan(0);
      }
    });
  });

  describe('Environment Variables Integration', () => {
    it('should validate required environment variables are documented', async () => {
      // Check if there's documentation for environment variables
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envExampleExists = await fs.access(envExamplePath).then(() => true).catch(() => false);
      
      if (envExampleExists) {
        const envContent = await fs.readFile(envExamplePath, 'utf8');
        
        const requiredEnvVars = [
          'DB_HOST',
          'DB_PORT',
          'DB_NAME',
          'DB_USER',
          'DB_PASSWORD'
        ];
        
        for (const envVar of requiredEnvVars) {
          expect(envContent).toContain(envVar);
        }
      }
    });
  });

  describe('Workflow Integration Points', () => {
    it('should validate GitHub Actions workflow files exist', async () => {
      const workflowDir = path.join(projectRoot, '.github', 'workflows');
      
      const workflowExists = await fs.access(workflowDir).then(() => true).catch(() => false);
      expect(workflowExists).toBe(true);
      
      const expectedWorkflows = [
        'ci-enhanced.yml',
        'security.yml',
        'deploy.yml',
        'dependencies.yml',
        'performance.yml'
      ];
      
      for (const workflow of expectedWorkflows) {
        const workflowPath = path.join(workflowDir, workflow);
        const workflowFileExists = await fs.access(workflowPath).then(() => true).catch(() => false);
        expect(workflowFileExists).toBe(true);
      }
    });

    it('should validate workflow files reference existing scripts', async () => {
      const workflowDir = path.join(projectRoot, '.github', 'workflows');
      const deployWorkflowPath = path.join(workflowDir, 'deploy.yml');
      
      const workflowExists = await fs.access(deployWorkflowPath).then(() => true).catch(() => false);
      
      if (workflowExists) {
        const workflowContent = await fs.readFile(deployWorkflowPath, 'utf8');
        
        // Check if workflow references existing scripts
        expect(workflowContent).toContain('deploy-modporter-ai.sh');
        expect(workflowContent).toContain('validate-deployment.js');
        expect(workflowContent).toContain('canary-deployment.sh');
      }
    });
  });

  describe('Test Infrastructure Integration', () => {
    it('should validate test configuration files exist', async () => {
      const vitestConfigPath = path.join(projectRoot, 'vitest.config.ts');
      const vitestConfigExists = await fs.access(vitestConfigPath).then(() => true).catch(() => false);
      expect(vitestConfigExists).toBe(true);
      
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
      const tsconfigExists = await fs.access(tsconfigPath).then(() => true).catch(() => false);
      expect(tsconfigExists).toBe(true);
    });

    it('should validate test directories exist', async () => {
      const testDirs = [
        'tests/unit',
        'tests/integration',
        'tests/security',
        'tests/benchmark',
        'tests/deployment'
      ];
      
      for (const testDir of testDirs) {
        const testDirPath = path.join(projectRoot, testDir);
        const testDirExists = await fs.access(testDirPath).then(() => true).catch(() => false);
        expect(testDirExists).toBe(true);
      }
    });
  });

  describe('Security Configuration Integration', () => {
    it('should validate security configuration files exist', async () => {
      const securityConfigDir = path.join(projectRoot, 'security-config');
      const securityConfigExists = await fs.access(securityConfigDir).then(() => true).catch(() => false);
      expect(securityConfigExists).toBe(true);
      
      const gitleaksConfigPath = path.join(projectRoot, '.gitleaks.toml');
      const gitleaksConfigExists = await fs.access(gitleaksConfigPath).then(() => true).catch(() => false);
      expect(gitleaksConfigExists).toBe(true);
    });
  });

  describe('Logging and Monitoring Integration', () => {
    it('should validate log directories exist or can be created', async () => {
      const logDir = path.join(projectRoot, 'logs');
      
      try {
        await fs.access(logDir);
      } catch (error) {
        // Directory doesn't exist, try to create it
        await fs.mkdir(logDir, { recursive: true });
      }
      
      const logDirExists = await fs.access(logDir).then(() => true).catch(() => false);
      expect(logDirExists).toBe(true);
    });
  });
});