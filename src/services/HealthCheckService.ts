/**
 * Health Check Service for ModPorter-AI Integration
 * Provides comprehensive health monitoring for all system components
 */

import { Logger } from '../utils/logger.js';
import { ConfigurationService } from './ConfigurationService.js';
import { FeatureFlagService } from './FeatureFlagService.js';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: ComponentHealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface ComponentHealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface ReadinessProbe {
  name: string;
  check: () => Promise<boolean>;
  timeout: number;
  critical: boolean;
}

export class HealthCheckService {
  private logger: Logger;
  private configService: ConfigurationService;
  private featureFlagService: FeatureFlagService;
  private readinessProbes: Map<string, ReadinessProbe> = new Map();

  constructor(configService: ConfigurationService, featureFlagService: FeatureFlagService) {
    this.logger = new Logger('HealthCheckService');
    this.configService = configService;
    this.featureFlagService = featureFlagService;

    this.registerDefaultProbes();
  }

  private registerDefaultProbes(): void {
    // Database connectivity probe
    this.registerReadinessProbe({
      name: 'database',
      check: this.checkDatabaseConnectivity.bind(this),
      timeout: 5000,
      critical: true,
    });

    // File system probe
    this.registerReadinessProbe({
      name: 'filesystem',
      check: this.checkFileSystemAccess.bind(this),
      timeout: 3000,
      critical: true,
    });

    // Feature flags probe
    this.registerReadinessProbe({
      name: 'feature-flags',
      check: this.checkFeatureFlags.bind(this),
      timeout: 2000,
      critical: false,
    });

    // ModPorter-AI components probe
    this.registerReadinessProbe({
      name: 'modporter-ai-components',
      check: this.checkModPorterAIComponents.bind(this),
      timeout: 5000,
      critical: false,
    });

    // Memory usage probe
    this.registerReadinessProbe({
      name: 'memory',
      check: this.checkMemoryUsage.bind(this),
      timeout: 1000,
      critical: false,
    });

    // Disk space probe
    this.registerReadinessProbe({
      name: 'disk-space',
      check: this.checkDiskSpace.bind(this),
      timeout: 2000,
      critical: false,
    });
  }

  public registerReadinessProbe(probe: ReadinessProbe): void {
    this.readinessProbes.set(probe.name, probe);
    this.logger.info(`Registered readiness probe: ${probe.name}`);
  }

  public async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: ComponentHealthCheck[] = [];

    this.logger.info('Starting comprehensive health check');

    // Run all readiness probes
    for (const [name, probe] of this.readinessProbes) {
      const checkResult = await this.runProbe(probe);
      checks.push(checkResult);
    }

    // Calculate summary
    const summary = {
      total: checks.length,
      healthy: checks.filter((c) => c.status === 'healthy').length,
      degraded: checks.filter((c) => c.status === 'degraded').length,
      unhealthy: checks.filter((c) => c.status === 'unhealthy').length,
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    const criticalFailures = checks.filter(
      (c) => c.status === 'unhealthy' && this.readinessProbes.get(c.name)?.critical
    );

    if (criticalFailures.length > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.unhealthy > 0 || summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      summary,
    };

    const duration = Date.now() - startTime;
    this.logger.info(`Health check completed in ${duration}ms - Status: ${overallStatus}`);

    return result;
  }

  private async runProbe(probe: ReadinessProbe): Promise<ComponentHealthCheck> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), probe.timeout);
      });

      const checkPromise = probe.check();
      const result = await Promise.race([checkPromise, timeoutPromise]);

      const duration = Date.now() - startTime;

      return {
        name: probe.name,
        status: result ? 'healthy' : 'degraded',
        message: result ? 'Check passed' : 'Check failed',
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error.message === 'Timeout';

      return {
        name: probe.name,
        status: 'unhealthy',
        message: isTimeout ? `Check timed out after ${probe.timeout}ms` : error.message,
        duration,
        metadata: { error: error.message },
      };
    }
  }

  private async checkDatabaseConnectivity(): Promise<boolean> {
    try {
      // This would typically use your database connection pool
      // For now, we'll simulate a database check
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'mineport',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        connectionTimeoutMillis: 3000,
      });

      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();

      return true;
    } catch (error) {
      this.logger.error('Database connectivity check failed:', error);
      return false;
    }
  }

  private async checkFileSystemAccess(): Promise<boolean> {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');

      const testFile = path.join(os.tmpdir(), `health-check-${Date.now()}.tmp`);

      // Test write access
      await fs.writeFile(testFile, 'health check');

      // Test read access
      const content = await fs.readFile(testFile, 'utf8');

      // Clean up
      await fs.unlink(testFile);

      return content === 'health check';
    } catch (error) {
      this.logger.error('File system access check failed:', error);
      return false;
    }
  }

  private async checkFeatureFlags(): Promise<boolean> {
    try {
      const flags = await this.featureFlagService.getAllFlags();
      return typeof flags === 'object' && flags !== null;
    } catch (error) {
      this.logger.error('Feature flags check failed:', error);
      return false;
    }
  }

  private async checkModPorterAIComponents(): Promise<boolean> {
    try {
      // Check if ModPorter-AI components are properly initialized
      const config = await this.configService.getConfig();

      // Verify essential ModPorter-AI configuration exists
      const requiredConfigs = [
        'fileProcessor',
        'javaAnalyzer',
        'assetConverter',
        'validationPipeline',
      ];

      for (const configKey of requiredConfigs) {
        if (!config.modporterAI?.[configKey]) {
          this.logger.warn(`Missing ModPorter-AI configuration: ${configKey}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('ModPorter-AI components check failed:', error);
      return false;
    }
  }

  private async checkMemoryUsage(): Promise<boolean> {
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const usedMemory = memUsage.heapUsed;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      // Consider degraded if using more than 80% of available memory
      if (memoryUsagePercent > 80) {
        this.logger.warn(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Memory usage check failed:', error);
      return false;
    }
  }

  private async checkDiskSpace(): Promise<boolean> {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      // Check disk space for temp directory
      const tempDir = require('os').tmpdir();
      const stats = await fs.stat(tempDir);

      // This is a simplified check - in production you'd want to check actual disk space
      // For now, we'll just verify the temp directory is accessible
      return stats.isDirectory();
    } catch (error) {
      this.logger.error('Disk space check failed:', error);
      return false;
    }
  }

  public async isReady(): Promise<boolean> {
    const healthResult = await this.performHealthCheck();

    // System is ready if all critical probes are healthy
    const criticalProbes = Array.from(this.readinessProbes.values()).filter(
      (probe) => probe.critical
    );

    const criticalChecks = healthResult.checks.filter((check) =>
      criticalProbes.some((probe) => probe.name === check.name)
    );

    return criticalChecks.every((check) => check.status === 'healthy');
  }

  public getReadinessProbes(): ReadinessProbe[] {
    return Array.from(this.readinessProbes.values());
  }
}
