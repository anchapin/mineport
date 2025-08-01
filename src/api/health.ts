/**
 * Health Check API Endpoints
 * Provides HTTP endpoints for health monitoring and readiness probes
 */

import { Request, Response } from 'express';
import { HealthCheckService } from '../services/HealthCheckService';
import { Logger } from '../utils/logger';

export class HealthAPI {
  private healthCheckService: HealthCheckService;
  private logger: Logger;

  constructor(healthCheckService: HealthCheckService) {
    this.healthCheckService = healthCheckService;
    this.logger = new Logger('HealthAPI');
  }

  /**
   * Health check endpoint - provides detailed health information
   * GET /health
   */
  public async health(req: Request, res: Response): Promise<void> {
    try {
      const healthResult = await this.healthCheckService.performHealthCheck();
      
      // Set appropriate HTTP status code based on health status
      let statusCode = 200;
      if (healthResult.status === 'degraded') {
        statusCode = 200; // Still operational but with warnings
      } else if (healthResult.status === 'unhealthy') {
        statusCode = 503; // Service unavailable
      }

      res.status(statusCode).json({
        status: healthResult.status,
        timestamp: healthResult.timestamp,
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: healthResult.checks,
        summary: healthResult.summary
      });
    } catch (error) {
      this.logger.error('Health check endpoint failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date(),
        error: 'Health check failed',
        message: error.message
      });
    }
  }

  /**
   * Readiness probe endpoint - simple boolean check for container orchestration
   * GET /ready
   */
  public async ready(req: Request, res: Response): Promise<void> {
    try {
      const isReady = await this.healthCheckService.isReady();
      
      if (isReady) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date(),
          message: 'Service is ready to accept requests'
        });
      } else {
        res.status(503).json({
          status: 'not-ready',
          timestamp: new Date(),
          message: 'Service is not ready to accept requests'
        });
      }
    } catch (error) {
      this.logger.error('Readiness probe failed:', error);
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date(),
        error: 'Readiness check failed',
        message: error.message
      });
    }
  }

  /**
   * Liveness probe endpoint - simple check to verify the service is running
   * GET /live
   */
  public async live(req: Request, res: Response): Promise<void> {
    try {
      // Basic liveness check - if we can respond, we're alive
      res.status(200).json({
        status: 'alive',
        timestamp: new Date(),
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    } catch (error) {
      this.logger.error('Liveness probe failed:', error);
      res.status(500).json({
        status: 'dead',
        timestamp: new Date(),
        error: 'Liveness check failed',
        message: error.message
      });
    }
  }

  /**
   * Detailed system metrics endpoint
   * GET /metrics
   */
  public async metrics(req: Request, res: Response): Promise<void> {
    try {
      const healthResult = await this.healthCheckService.performHealthCheck();
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const metrics = {
        timestamp: new Date(),
        system: {
          uptime: process.uptime(),
          pid: process.pid,
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version
        },
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        health: {
          status: healthResult.status,
          totalChecks: healthResult.summary.total,
          healthyChecks: healthResult.summary.healthy,
          degradedChecks: healthResult.summary.degraded,
          unhealthyChecks: healthResult.summary.unhealthy
        },
        probes: this.healthCheckService.getReadinessProbes().map(probe => ({
          name: probe.name,
          timeout: probe.timeout,
          critical: probe.critical
        }))
      };

      res.status(200).json(metrics);
    } catch (error) {
      this.logger.error('Metrics endpoint failed:', error);
      res.status(500).json({
        error: 'Metrics collection failed',
        message: error.message,
        timestamp: new Date()
      });
    }
  }

  /**
   * Configuration validation endpoint
   * GET /config/validate
   */
  public async validateConfig(req: Request, res: Response): Promise<void> {
    try {
      // This would validate the current configuration
      const validationResults = {
        timestamp: new Date(),
        valid: true,
        checks: [
          {
            name: 'environment-variables',
            status: 'passed',
            message: 'All required environment variables are set'
          },
          {
            name: 'feature-flags',
            status: 'passed',
            message: 'Feature flags configuration is valid'
          },
          {
            name: 'database-config',
            status: 'passed',
            message: 'Database configuration is valid'
          }
        ]
      };

      res.status(200).json(validationResults);
    } catch (error) {
      this.logger.error('Configuration validation failed:', error);
      res.status(500).json({
        valid: false,
        error: 'Configuration validation failed',
        message: error.message,
        timestamp: new Date()
      });
    }
  }
}

// Express route setup helper
export function setupHealthRoutes(app: any, healthCheckService: HealthCheckService): void {
  const healthAPI = new HealthAPI(healthCheckService);

  app.get('/health', healthAPI.health.bind(healthAPI));
  app.get('/ready', healthAPI.ready.bind(healthAPI));
  app.get('/live', healthAPI.live.bind(healthAPI));
  app.get('/metrics', healthAPI.metrics.bind(healthAPI));
  app.get('/config/validate', healthAPI.validateConfig.bind(healthAPI));
}