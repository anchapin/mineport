import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AlertingService, AlertRule } from '../../../src/services/AlertingService.js';
import { MonitoringConfig } from '../../../src/types/config.js';

// Mock fetch for webhook testing
global.fetch = vi.fn();

describe('AlertingService', () => {
  let alertingService: AlertingService;
  let mockConfig: MonitoringConfig;

  beforeEach(() => {
    mockConfig = {
      enableMetrics: true,
      metricsPort: 9090,
      enableTracing: false,
      enableHealthChecks: true,
      healthCheckInterval: 30000,
      alertingEnabled: true,
      alertingWebhookUrl: 'https://example.com/webhook',
    };

    alertingService = new AlertingService(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    alertingService.dispose();
  });

  describe('alert creation', () => {
    it('should create alerts correctly', async () => {
      const alert = await alertingService.createAlert(
        'security_threat',
        'high',
        'Test Alert',
        'This is a test alert',
        { testData: 'value' },
        'test_source'
      );

      expect(alert.id).toBeDefined();
      expect(alert.type).toBe('security_threat');
      expect(alert.severity).toBe('high');
      expect(alert.title).toBe('Test Alert');
      expect(alert.message).toBe('This is a test alert');
      expect(alert.metadata.testData).toBe('value');
      expect(alert.source).toBe('test_source');
      expect(alert.resolved).toBe(false);
      expect(alert.timestamp).toBeInstanceOf(Date);
    });

    it('should emit alert created events', (done) => {
      alertingService.on('alert:created', (alert) => {
        expect(alert.type).toBe('performance_degradation');
        expect(alert.severity).toBe('medium');
        done();
      });

      alertingService.createAlert(
        'performance_degradation',
        'medium',
        'Performance Issue',
        'System is running slowly'
      );
    });

    it('should add alerts to active alerts list', async () => {
      await alertingService.createAlert(
        'system_health',
        'high',
        'System Down',
        'System is not responding'
      );

      const activeAlerts = alertingService.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].type).toBe('system_health');
    });

    it('should maintain alert history', async () => {
      await alertingService.createAlert(
        'error_rate',
        'low',
        'Error Rate Alert',
        'Error rate is elevated'
      );

      const history = alertingService.getAlertHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('error_rate');
    });
  });

  describe('alert resolution', () => {
    it('should resolve alerts correctly', async () => {
      const alert = await alertingService.createAlert(
        'resource_usage',
        'medium',
        'High Memory Usage',
        'Memory usage is high'
      );

      const resolved = await alertingService.resolveAlert(alert.id, 'admin');
      expect(resolved).toBe(true);

      const activeAlerts = alertingService.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);

      // Check that alert is marked as resolved
      const history = alertingService.getAlertHistory();
      const resolvedAlert = history.find((a) => a.id === alert.id);
      expect(resolvedAlert?.resolved).toBe(true);
      expect(resolvedAlert?.resolvedAt).toBeInstanceOf(Date);
      expect(resolvedAlert?.metadata.resolvedBy).toBe('admin');
    });

    it('should emit alert resolved events', async () => {
      const alert = await alertingService.createAlert(
        'conversion_failure',
        'high',
        'Conversion Failed',
        'File conversion failed'
      );

      return new Promise<void>((resolve) => {
        alertingService.on('alert:resolved', (resolvedAlert) => {
          expect(resolvedAlert.id).toBe(alert.id);
          expect(resolvedAlert.resolved).toBe(true);
          resolve();
        });

        alertingService.resolveAlert(alert.id);
      });
    });

    it('should return false when trying to resolve non-existent alert', async () => {
      const resolved = await alertingService.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });

    it('should return false when trying to resolve already resolved alert', async () => {
      const alert = await alertingService.createAlert(
        'security_threat',
        'critical',
        'Critical Threat',
        'Critical security threat detected'
      );

      await alertingService.resolveAlert(alert.id);
      const resolved = await alertingService.resolveAlert(alert.id);
      expect(resolved).toBe(false);
    });
  });

  describe('alert filtering', () => {
    beforeEach(async () => {
      await alertingService.createAlert('security_threat', 'high', 'Security Alert 1', 'Message 1');
      await alertingService.createAlert(
        'security_threat',
        'medium',
        'Security Alert 2',
        'Message 2'
      );
      await alertingService.createAlert(
        'performance_degradation',
        'high',
        'Performance Alert',
        'Message 3'
      );
      await alertingService.createAlert('system_health', 'low', 'Health Alert', 'Message 4');
    });

    it('should filter alerts by type', () => {
      const securityAlerts = alertingService.getAlertsByType('security_threat');
      expect(securityAlerts).toHaveLength(2);
      expect(securityAlerts.every((a) => a.type === 'security_threat')).toBe(true);

      const performanceAlerts = alertingService.getAlertsByType('performance_degradation');
      expect(performanceAlerts).toHaveLength(1);
      expect(performanceAlerts[0].type).toBe('performance_degradation');
    });

    it('should filter alerts by severity', () => {
      const highSeverityAlerts = alertingService.getAlertsBySeverity('high');
      expect(highSeverityAlerts).toHaveLength(2);
      expect(highSeverityAlerts.every((a) => a.severity === 'high')).toBe(true);

      const lowSeverityAlerts = alertingService.getAlertsBySeverity('low');
      expect(lowSeverityAlerts).toHaveLength(1);
      expect(lowSeverityAlerts[0].severity).toBe('low');
    });
  });

  describe('specialized alert creation methods', () => {
    it('should create security threat alerts', async () => {
      const alert = await alertingService.createSecurityThreatAlert(
        'malware',
        'suspicious.jar',
        'critical',
        { scanTime: 1500 }
      );

      expect(alert.type).toBe('security_threat');
      expect(alert.severity).toBe('critical');
      expect(alert.title).toBe('Security Threat Detected: malware');
      expect(alert.message).toContain('suspicious.jar');
      expect(alert.metadata.threatType).toBe('malware');
      expect(alert.metadata.fileName).toBe('suspicious.jar');
      expect(alert.metadata.scanTime).toBe(1500);
      expect(alert.source).toBe('security_scanner');
    });

    it('should create performance degradation alerts', async () => {
      const alert = await alertingService.createPerformanceDegradationAlert(
        'file_processing',
        45000,
        30000,
        { fileSize: 1024 }
      );

      expect(alert.type).toBe('performance_degradation');
      expect(alert.severity).toBe('medium'); // 45000 < 30000 * 2 (60000)
      expect(alert.title).toBe('Performance Degradation: file_processing');
      expect(alert.message).toContain('45000ms');
      expect(alert.message).toContain('30000ms');
      expect(alert.metadata.operation).toBe('file_processing');
      expect(alert.metadata.duration).toBe(45000);
      expect(alert.metadata.threshold).toBe(30000);
      expect(alert.source).toBe('performance_monitor');
    });

    it('should create system health alerts', async () => {
      const alert = await alertingService.createSystemHealthAlert('java_analyzer', 'unhealthy', {
        errorRate: 0.8,
      });

      expect(alert.type).toBe('system_health');
      expect(alert.severity).toBe('high'); // unhealthy = high severity
      expect(alert.title).toBe('System Health Issue: java_analyzer');
      expect(alert.message).toContain('java_analyzer is unhealthy');
      expect(alert.metadata.component).toBe('java_analyzer');
      expect(alert.metadata.status).toBe('unhealthy');
      expect(alert.source).toBe('health_monitor');
    });

    it('should create resource usage alerts', async () => {
      const alert = await alertingService.createResourceUsageAlert('memory', 900, 500, {
        processId: 1234,
      });

      expect(alert.type).toBe('resource_usage');
      expect(alert.severity).toBe('high'); // 900 > 500 * 1.5
      expect(alert.title).toBe('High Resource Usage: memory');
      expect(alert.message).toContain('900');
      expect(alert.message).toContain('500');
      expect(alert.metadata.resource).toBe('memory');
      expect(alert.metadata.usage).toBe(900);
      expect(alert.metadata.threshold).toBe(500);
      expect(alert.source).toBe('resource_monitor');
    });
  });

  describe('alert rules', () => {
    it('should add and retrieve alert rules', () => {
      const rule: AlertRule = {
        id: 'test_rule',
        name: 'Test Rule',
        type: 'security_threat',
        enabled: true,
        conditions: [
          {
            metric: 'severity',
            operator: 'eq',
            threshold: 'critical',
          },
        ],
        severity: 'critical',
        cooldownPeriod: 60000,
        actions: [
          {
            type: 'log',
            config: { level: 'error' },
            enabled: true,
          },
        ],
      };

      alertingService.setAlertRule(rule);

      const rules = alertingService.getAlertRules();
      const addedRule = rules.find((r) => r.id === 'test_rule');
      expect(addedRule).toBeDefined();
      expect(addedRule?.name).toBe('Test Rule');
    });

    it('should remove alert rules', () => {
      const rule: AlertRule = {
        id: 'removable_rule',
        name: 'Removable Rule',
        type: 'performance_degradation',
        enabled: true,
        conditions: [],
        severity: 'medium',
        cooldownPeriod: 30000,
        actions: [],
      };

      alertingService.setAlertRule(rule);
      expect(alertingService.getAlertRules().find((r) => r.id === 'removable_rule')).toBeDefined();

      const removed = alertingService.removeAlertRule('removable_rule');
      expect(removed).toBe(true);
      expect(
        alertingService.getAlertRules().find((r) => r.id === 'removable_rule')
      ).toBeUndefined();
    });

    it('should return false when removing non-existent rule', () => {
      const removed = alertingService.removeAlertRule('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('alert rule evaluation', () => {
    it('should check alert rules against metrics', async () => {
      const rule: AlertRule = {
        id: 'memory_rule',
        name: 'Memory Usage Rule',
        type: 'resource_usage',
        enabled: true,
        conditions: [
          {
            metric: 'memoryUsage',
            operator: 'gt',
            threshold: 800,
          },
        ],
        severity: 'high',
        cooldownPeriod: 60000,
        actions: [
          {
            type: 'log',
            config: { level: 'warn' },
            enabled: true,
          },
        ],
      };

      alertingService.setAlertRule(rule);

      // Trigger rule with metric that exceeds threshold
      await alertingService.checkAlertRules({
        memoryUsage: 900,
        component: 'test',
      });

      const activeAlerts = alertingService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const triggeredAlert = activeAlerts.find((a) => a.metadata.ruleId === 'memory_rule');
      expect(triggeredAlert).toBeDefined();
    });

    it('should respect cooldown periods', async () => {
      const rule: AlertRule = {
        id: 'cooldown_rule',
        name: 'Cooldown Test Rule',
        type: 'performance_degradation',
        enabled: true,
        conditions: [
          {
            metric: 'duration',
            operator: 'gt',
            threshold: 1000,
          },
        ],
        severity: 'medium',
        cooldownPeriod: 5000, // 5 seconds
        actions: [],
      };

      alertingService.setAlertRule(rule);

      // First trigger
      await alertingService.checkAlertRules({ duration: 2000 });
      const alertsAfterFirst = alertingService.getActiveAlerts().length;

      // Immediate second trigger (should be blocked by cooldown)
      await alertingService.checkAlertRules({ duration: 3000 });
      const alertsAfterSecond = alertingService.getActiveAlerts().length;

      expect(alertsAfterSecond).toBe(alertsAfterFirst);
    });

    it('should not trigger disabled rules', async () => {
      const rule: AlertRule = {
        id: 'disabled_rule',
        name: 'Disabled Rule',
        type: 'system_health',
        enabled: false, // Disabled
        conditions: [
          {
            metric: 'status',
            operator: 'eq',
            threshold: 'unhealthy',
          },
        ],
        severity: 'high',
        cooldownPeriod: 60000,
        actions: [],
      };

      alertingService.setAlertRule(rule);

      const initialAlertCount = alertingService.getActiveAlerts().length;

      await alertingService.checkAlertRules({ status: 'unhealthy' });

      const finalAlertCount = alertingService.getActiveAlerts().length;
      expect(finalAlertCount).toBe(initialAlertCount);
    });
  });

  describe('webhook actions', () => {
    it('should send webhook notifications when configured', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));

      const rule: AlertRule = {
        id: 'webhook_rule',
        name: 'Webhook Rule',
        type: 'security_threat',
        enabled: true,
        conditions: [
          {
            metric: 'severity',
            operator: 'eq',
            threshold: 'critical',
          },
        ],
        severity: 'critical',
        cooldownPeriod: 60000,
        actions: [
          {
            type: 'webhook',
            config: {
              url: 'https://example.com/webhook',
              headers: { 'X-Custom': 'test' },
            },
            enabled: true,
          },
        ],
      };

      alertingService.setAlertRule(rule);

      await alertingService.createSecurityThreatAlert('malware', 'test.jar', 'critical');

      // Wait a bit for async webhook call
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'test',
          }),
          body: expect.stringContaining('malware'),
        })
      );
    });

    it('should handle webhook failures gracefully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const rule: AlertRule = {
        id: 'failing_webhook_rule',
        name: 'Failing Webhook Rule',
        type: 'security_threat',
        enabled: true,
        conditions: [],
        severity: 'high',
        cooldownPeriod: 60000,
        actions: [
          {
            type: 'webhook',
            config: { url: 'https://failing.example.com/webhook' },
            enabled: true,
          },
        ],
      };

      alertingService.setAlertRule(rule);

      // This should not throw an error
      await expect(
        alertingService.createSecurityThreatAlert('test', 'test.jar', 'high')
      ).resolves.toBeDefined();
    });
  });

  describe('alert history management', () => {
    it('should limit alert history size', async () => {
      // Set a small history size for testing
      (alertingService as any).maxHistorySize = 3;

      // Create more alerts than the limit
      await alertingService.createAlert('security_threat', 'low', 'Alert 1', 'Message 1');
      await alertingService.createAlert('security_threat', 'low', 'Alert 2', 'Message 2');
      await alertingService.createAlert('security_threat', 'low', 'Alert 3', 'Message 3');
      await alertingService.createAlert('security_threat', 'low', 'Alert 4', 'Message 4');

      const history = alertingService.getAlertHistory();
      expect(history).toHaveLength(3); // Should be limited to maxHistorySize
      expect(history[0].title).toBe('Alert 4'); // Most recent first
    });

    it('should return limited history when requested', async () => {
      await alertingService.createAlert('security_threat', 'low', 'Alert 1', 'Message 1');
      await alertingService.createAlert('security_threat', 'low', 'Alert 2', 'Message 2');
      await alertingService.createAlert('security_threat', 'low', 'Alert 3', 'Message 3');

      const limitedHistory = alertingService.getAlertHistory(2);
      expect(limitedHistory).toHaveLength(2);
      expect(limitedHistory[0].title).toBe('Alert 3'); // Most recent first
      expect(limitedHistory[1].title).toBe('Alert 2');
    });
  });
});
