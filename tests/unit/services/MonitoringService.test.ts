import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MonitoringService } from '../../../src/services/MonitoringService.js';
import { MonitoringConfig } from '../../../src/types/config.js';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockConfig: MonitoringConfig;

  beforeEach(() => {
    mockConfig = {
      enableMetrics: true,
      metricsPort: 9090,
      enableTracing: false,
      enableHealthChecks: true,
      healthCheckInterval: 30000,
      alertingEnabled: false,
    };

    monitoringService = new MonitoringService(mockConfig);
  });

  afterEach(() => {
    monitoringService.dispose();
  });

  describe('security metrics', () => {
    it('should record security metrics correctly', () => {
      const metric = {
        event: 'threat_detected' as const,
        severity: 'high' as const,
        details: {
          threatType: 'malware',
          fileName: 'suspicious.jar',
          fileSize: 1024,
        },
      };

      monitoringService.recordSecurityMetric(metric);

      const summary = monitoringService.getMetricsSummary(new Date(Date.now() - 60000), new Date());

      expect(summary.security.threatsDetected).toBe(1);
      expect(summary.security.threatsByType.malware).toBe(1);
    });

    it('should emit security metric events', () => {
      return new Promise<void>((resolve) => {
        const metric = {
          event: 'scan_completed' as const,
          severity: 'low' as const,
          details: {
            scanDuration: 1500,
            fileName: 'test.jar',
          },
        };

        monitoringService.on('metric:security', (emittedMetric) => {
          expect(emittedMetric.event).toBe('scan_completed');
          expect(emittedMetric.severity).toBe('low');
          expect(emittedMetric.details.scanDuration).toBe(1500);
          resolve();
        });

        monitoringService.recordSecurityMetric(metric);
      });
    });

    it('should aggregate security metrics correctly', () => {
      // Record multiple security metrics
      monitoringService.recordSecurityMetric({
        event: 'threat_detected',
        severity: 'high',
        details: { threatType: 'malware', scanDuration: 1000 },
      });

      monitoringService.recordSecurityMetric({
        event: 'threat_detected',
        severity: 'medium',
        details: { threatType: 'zip_bomb', scanDuration: 2000 },
      });

      monitoringService.recordSecurityMetric({
        event: 'scan_completed',
        severity: 'low',
        details: { scanDuration: 1500 },
      });

      const summary = monitoringService.getMetricsSummary(new Date(Date.now() - 60000), new Date());

      expect(summary.security.threatsDetected).toBe(2);
      expect(summary.security.totalScans).toBe(1);
      expect(summary.security.averageScanTime).toBe(1500);
      expect(summary.security.threatsByType.malware).toBe(1);
      expect(summary.security.threatsByType.zip_bomb).toBe(1);
    });
  });

  describe('performance metrics', () => {
    it('should record performance metrics correctly', () => {
      const metric = {
        operation: 'file_processing' as const,
        duration: 5000,
        success: true,
        details: {
          fileSize: 2048,
          userId: 'user123',
        },
      };

      monitoringService.recordPerformanceMetric(metric);

      const summary = monitoringService.getMetricsSummary(new Date(Date.now() - 60000), new Date());

      expect(summary.performance.totalOperations).toBe(1);
      expect(summary.performance.averageDuration).toBe(5000);
      expect(summary.performance.successRate).toBe(1);
      expect(summary.performance.operationsByType.file_processing).toBe(1);
    });

    it('should emit performance metric events', () => {
      return new Promise<void>((resolve) => {
        const metric = {
          operation: 'java_analysis' as const,
          duration: 3000,
          success: false,
          details: { errorCode: 'TIMEOUT' },
        };

        monitoringService.on('metric:performance', (emittedMetric) => {
          expect(emittedMetric.operation).toBe('java_analysis');
          expect(emittedMetric.success).toBe(false);
          expect(emittedMetric.duration).toBe(3000);
          resolve();
        });

        monitoringService.recordPerformanceMetric(metric);
      });
    });

    it('should calculate success rate correctly', () => {
      // Record successful operations
      monitoringService.recordPerformanceMetric({
        operation: 'asset_conversion',
        duration: 2000,
        success: true,
        details: {},
      });

      monitoringService.recordPerformanceMetric({
        operation: 'validation',
        duration: 1000,
        success: true,
        details: {},
      });

      // Record failed operation
      monitoringService.recordPerformanceMetric({
        operation: 'file_processing',
        duration: 5000,
        success: false,
        details: {},
      });

      const summary = monitoringService.getMetricsSummary(new Date(Date.now() - 60000), new Date());

      expect(summary.performance.totalOperations).toBe(3);
      expect(summary.performance.successRate).toBeCloseTo(2 / 3, 2);
      expect(summary.performance.averageDuration).toBeCloseTo(2666.67, 0);
    });
  });

  describe('conversion quality metrics', () => {
    it('should record conversion quality metrics correctly', () => {
      const metric = {
        stage: 'conversion' as const,
        success: true,
        qualityScore: 0.85,
        details: {
          extractedItems: 10,
          convertedAssets: 8,
        },
      };

      monitoringService.recordConversionQualityMetric(metric);

      const summary = monitoringService.getMetricsSummary(new Date(Date.now() - 60000), new Date());

      expect(summary.conversionQuality.totalConversions).toBe(1);
      expect(summary.conversionQuality.successRate).toBe(1);
      expect(summary.conversionQuality.averageQualityScore).toBe(0.85);
    });

    it('should track errors by stage', () => {
      monitoringService.recordConversionQualityMetric({
        stage: 'analysis',
        success: false,
        details: {},
      });

      monitoringService.recordConversionQualityMetric({
        stage: 'conversion',
        success: false,
        details: {},
      });

      monitoringService.recordConversionQualityMetric({
        stage: 'analysis',
        success: false,
        details: {},
      });

      const summary = monitoringService.getMetricsSummary(new Date(Date.now() - 60000), new Date());

      expect(summary.conversionQuality.errorsByStage.analysis).toBe(2);
      expect(summary.conversionQuality.errorsByStage.conversion).toBe(1);
      expect(summary.conversionQuality.successRate).toBe(0);
    });
  });

  describe('system health metrics', () => {
    it('should record system health metrics correctly', () => {
      const metric = {
        component: 'file_processor' as const,
        status: 'healthy' as const,
        details: {
          memoryUsage: 256,
          cpuUsage: 0.15,
        },
      };

      monitoringService.recordSystemHealthMetric(metric);

      const summary = monitoringService.getMetricsSummary(new Date(Date.now() - 60000), new Date());

      expect(summary.systemHealth.componentStatus.file_processor).toBe('healthy');
      expect(summary.systemHealth.averageMemoryUsage).toBe(256);
      expect(summary.systemHealth.averageCpuUsage).toBe(0.15);
      expect(summary.systemHealth.overallHealth).toBe('healthy');
    });

    it('should determine overall health status correctly', () => {
      // Record healthy component
      monitoringService.recordSystemHealthMetric({
        component: 'file_processor',
        status: 'healthy',
        details: {},
      });

      // Record degraded component
      monitoringService.recordSystemHealthMetric({
        component: 'java_analyzer',
        status: 'degraded',
        details: {},
      });

      let summary = monitoringService.getMetricsSummary(new Date(Date.now() - 60000), new Date());

      expect(summary.systemHealth.overallHealth).toBe('degraded');

      // Record unhealthy component
      monitoringService.recordSystemHealthMetric({
        component: 'asset_converter',
        status: 'unhealthy',
        details: {},
      });

      summary = monitoringService.getMetricsSummary(new Date(Date.now() - 60000), new Date());

      expect(summary.systemHealth.overallHealth).toBe('unhealthy');
    });
  });

  describe('alert management', () => {
    it('should create and manage alerts', () => {
      const alertRule = {
        id: 'test_rule',
        name: 'Test Rule',
        condition: {
          metric: 'security_threat_count',
          operator: 'gte' as const,
          threshold: 1,
          timeWindow: 60000,
        },
        severity: 'high' as const,
        enabled: true,
        cooldown: 60000,
      };

      monitoringService.setAlertRule(alertRule);

      // Record a metric that should trigger the alert
      monitoringService.recordSecurityMetric({
        event: 'threat_detected',
        severity: 'high',
        details: { threatType: 'malware' },
      });

      const activeAlerts = monitoringService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
    });

    it('should resolve alerts', () => {
      const alertRule = {
        id: 'test_rule_2',
        name: 'Test Rule 2',
        condition: {
          metric: 'security_threat_count',
          operator: 'gte' as const,
          threshold: 1,
          timeWindow: 60000,
        },
        severity: 'medium' as const,
        enabled: true,
        cooldown: 60000,
      };

      monitoringService.setAlertRule(alertRule);

      // Trigger alert
      monitoringService.recordSecurityMetric({
        event: 'threat_detected',
        severity: 'medium',
        details: { threatType: 'suspicious' },
      });

      let activeAlerts = monitoringService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      // Resolve alert
      const alertId = activeAlerts[0].id;
      const resolved = monitoringService.resolveAlert(alertId);
      expect(resolved).toBe(true);

      activeAlerts = monitoringService.getActiveAlerts();
      const resolvedAlert = activeAlerts.find((a) => a.id === alertId);
      expect(resolvedAlert).toBeUndefined();
    });

    it('should respect alert cooldown periods', () => {
      const alertRule = {
        id: 'cooldown_test',
        name: 'Cooldown Test',
        condition: {
          metric: 'security_threat_count',
          operator: 'gte' as const,
          threshold: 1,
          timeWindow: 60000,
        },
        severity: 'low' as const,
        enabled: true,
        cooldown: 5000, // 5 seconds
      };

      monitoringService.setAlertRule(alertRule);

      // Trigger first alert
      monitoringService.recordSecurityMetric({
        event: 'threat_detected',
        severity: 'low',
        details: { threatType: 'test1' },
      });

      const alertsAfterFirst = monitoringService.getActiveAlerts();
      const firstCount = alertsAfterFirst.length;

      // Immediately trigger second alert (should be blocked by cooldown)
      monitoringService.recordSecurityMetric({
        event: 'threat_detected',
        severity: 'low',
        details: { threatType: 'test2' },
      });

      const alertsAfterSecond = monitoringService.getActiveAlerts();
      expect(alertsAfterSecond.length).toBe(firstCount); // No new alert due to cooldown
    });
  });

  describe('health status', () => {
    it('should return current health status of components', () => {
      // Record recent health metrics
      monitoringService.recordSystemHealthMetric({
        component: 'file_processor',
        status: 'healthy',
        details: {},
      });

      monitoringService.recordSystemHealthMetric({
        component: 'java_analyzer',
        status: 'degraded',
        details: {},
      });

      const healthStatus = monitoringService.getHealthStatus();

      expect(healthStatus.file_processor).toBe('healthy');
      expect(healthStatus.java_analyzer).toBe('degraded');
      expect(healthStatus.asset_converter).toBe('unknown'); // No recent metrics
    });
  });

  describe('metrics cleanup', () => {
    it('should clean up old metrics', () => {
      // Record multiple metrics to ensure we have enough to clean up
      monitoringService.recordPerformanceMetric({
        operation: 'file_processing',
        duration: 1000,
        success: true,
        details: {},
      });

      monitoringService.recordPerformanceMetric({
        operation: 'java_analysis',
        duration: 2000,
        success: true,
        details: {},
      });

      monitoringService.recordPerformanceMetric({
        operation: 'asset_conversion',
        duration: 3000,
        success: true,
        details: {},
      });

      // Manually set old timestamps to simulate old metrics
      const metrics = (monitoringService as any).metrics;
      const initialCount = metrics.length;

      // Make the first two metrics old
      if (metrics.length >= 2) {
        metrics[0].timestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
        metrics[1].timestamp = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000); // 9 days ago
      }

      monitoringService.cleanupOldMetrics();
      const finalCount = metrics.length;

      expect(finalCount).toBeLessThan(initialCount);
      expect(finalCount).toBe(1); // Should keep only the recent metric
    });
  });

  describe('time range filtering', () => {
    it('should filter metrics by time range correctly', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Record metrics at different times
      monitoringService.recordPerformanceMetric({
        operation: 'file_processing',
        duration: 1000,
        success: true,
        details: {},
      });

      // Manually adjust timestamp for testing
      const metrics = (monitoringService as any).metrics;
      if (metrics.length > 0) {
        metrics[0].timestamp = twoHoursAgo;
      }

      // Get summary for last hour only
      const summary = monitoringService.getMetricsSummary(oneHourAgo, now);

      expect(summary.performance.totalOperations).toBe(0); // Metric is older than range
    });
  });

  describe('event emission', () => {
    it('should emit metric events for all metric types', () => {
      return new Promise<void>((resolve) => {
        let eventCount = 0;
        const expectedEvents = 4;

        const checkComplete = () => {
          eventCount++;
          if (eventCount === expectedEvents) {
            resolve();
          }
        };

        monitoringService.on('metric:security', checkComplete);
        monitoringService.on('metric:performance', checkComplete);
        monitoringService.on('metric:conversion_quality', checkComplete);
        monitoringService.on('metric:system_health', checkComplete);

        // Record all types of metrics
        monitoringService.recordSecurityMetric({
          event: 'scan_completed',
          severity: 'low',
          details: {},
        });

        monitoringService.recordPerformanceMetric({
          operation: 'file_processing',
          duration: 1000,
          success: true,
          details: {},
        });

        monitoringService.recordConversionQualityMetric({
          stage: 'conversion',
          success: true,
          details: {},
        });

        monitoringService.recordSystemHealthMetric({
          component: 'file_processor',
          status: 'healthy',
          details: {},
        });
      });
    });
  });
});
