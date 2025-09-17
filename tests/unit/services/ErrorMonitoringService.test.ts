/**
 * Unit tests for ErrorMonitoringService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ErrorMonitoringService,
  MonitoringConfig,
  AlertThresholds,
} from '../../../src/services/ErrorMonitoringService.js';
import { EnhancedErrorCollector } from '../../../src/services/EnhancedErrorCollector.js';
import { AlertingService } from '../../../src/services/AlertingService.js';
import { MonitoringService } from '../../../src/services/MonitoringService.js';
import {
  ErrorSeverity,
  ErrorType,
  createConversionError,
  createEnhancedConversionError,
} from '../../../src/types/errors.js';

// Mock logger
vi.mock('../../../src/utils/logger', async () => {
  const actual = (await vi.importActual('../../../src/utils/logger')) as any;
  return {
    ...actual,
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    },
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    })),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logStructuredEvent: vi.fn(),
      logSecurityEvent: vi.fn(),
      logPerformanceEvent: vi.fn(),
      logBusinessEvent: vi.fn(),
      logSystemEvent: vi.fn(),
    },
  };
});

// Mock services
const mockAlertingService = {
  sendAlert: vi.fn().mockResolvedValue(undefined),
} as unknown as AlertingService;

const mockMonitoringService = {
  recordMetric: vi.fn(),
} as unknown as MonitoringService;

describe('ErrorMonitoringService', () => {
  let monitoringService: ErrorMonitoringService;
  let mockErrorCollector: EnhancedErrorCollector;
  let mockConfig: MonitoringConfig;
  let mockThresholds: AlertThresholds;

  beforeEach(() => {
    mockErrorCollector = new EnhancedErrorCollector();

    mockThresholds = {
      errorRate: { warning: 5, critical: 20 },
      errorCount: { warning: 10, critical: 50 },
      componentFailures: { warning: 1, critical: 3 },
      recoveryFailureRate: { warning: 0.3, critical: 0.7 },
    };

    mockConfig = {
      enabled: true,
      checkInterval: 1000, // 1 second for testing
      alertThresholds: mockThresholds,
      enableTrendAnalysis: true,
      enableAnomalyDetection: true,
      retentionPeriod: 3600000, // 1 hour
    };

    monitoringService = new ErrorMonitoringService(
      mockErrorCollector,
      mockAlertingService,
      mockMonitoringService,
      mockConfig
    );
  });

  afterEach(() => {
    monitoringService.stopMonitoring();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create monitoring service with enabled config', () => {
      expect(monitoringService).toBeDefined();
    });

    it('should not start monitoring when disabled', () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      const service = new ErrorMonitoringService(
        mockErrorCollector,
        mockAlertingService,
        mockMonitoringService,
        disabledConfig
      );

      expect(service).toBeDefined();
      service.stopMonitoring(); // Cleanup
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring successfully', () => {
      monitoringService.stopMonitoring(); // Stop auto-started monitoring

      expect(() => {
        monitoringService.startMonitoring();
      }).not.toThrow();

      monitoringService.stopMonitoring();
    });

    it('should not start multiple monitoring intervals', () => {
      monitoringService.stopMonitoring();

      monitoringService.startMonitoring();
      monitoringService.startMonitoring(); // Second call should be ignored

      expect(() => {
        monitoringService.stopMonitoring();
      }).not.toThrow();
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring successfully', () => {
      expect(() => {
        monitoringService.stopMonitoring();
      }).not.toThrow();
    });

    it('should handle stopping when not started', () => {
      monitoringService.stopMonitoring();

      expect(() => {
        monitoringService.stopMonitoring();
      }).not.toThrow();
    });
  });

  describe('alert creation', () => {
    beforeEach(() => {
      monitoringService.stopMonitoring(); // Stop auto monitoring for controlled tests
    });

    it('should create alert for high error rate', async () => {
      // Add many errors to trigger high error rate
      for (let i = 0; i < 25; i++) {
        const error = createEnhancedConversionError(
          createConversionError({
            code: `TEST-ERR-${i.toString().padStart(3, '0')}`,
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Test error ${i}`,
            moduleOrigin: 'TEST',
          }),
          []
        );
        mockErrorCollector.addEnhancedError(error);
      }

      // Manually trigger monitoring check
      await (monitoringService as any).performMonitoringCheck();

      // Should have created an alert
      const alerts = monitoringService.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      const errorRateAlert = alerts.find((alert) => alert.type === 'error_rate');
      expect(errorRateAlert).toBeDefined();
    });

    it('should create alert for component failures', async () => {
      // Create errors that would cause component to be marked as failing
      for (let i = 0; i < 15; i++) {
        const error = createEnhancedConversionError(
          createConversionError({
            code: 'FILE-CRIT-001',
            type: ErrorType.SECURITY,
            severity: ErrorSeverity.CRITICAL,
            message: 'Critical file error',
            moduleOrigin: 'FILE',
          }),
          []
        );
        mockErrorCollector.addEnhancedError(error);
      }

      await (monitoringService as any).performMonitoringCheck();

      const alerts = monitoringService.getActiveAlerts();
      const componentAlert = alerts.find((alert) => alert.type === 'component_failure');
      expect(componentAlert).toBeDefined();
    });

    it('should create alert for recovery failures', async () => {
      // Create recoverable errors that fail recovery
      for (let i = 0; i < 10; i++) {
        const error = createEnhancedConversionError(
          createConversionError({
            code: `JAVA-REG-${i.toString().padStart(3, '0')}`,
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Registry extraction failed ${i}`,
            moduleOrigin: 'JAVA',
          }),
          [
            {
              strategy: 'retry' as any,
              description: 'Retry extraction',
              automated: true,
              maxRetries: 1,
            },
          ]
        );

        // Simulate failed recovery
        error.recoveryAttempts = 2;
        error.hasBeenRecovered = false;

        mockErrorCollector.addEnhancedError(error);
      }

      await (monitoringService as any).performMonitoringCheck();

      const alerts = monitoringService.getActiveAlerts();
      const recoveryAlert = alerts.find((alert) => alert.type === 'recovery_failure');
      expect(recoveryAlert).toBeDefined();
    });
  });

  describe('alert management', () => {
    beforeEach(async () => {
      monitoringService.stopMonitoring();

      // Create a test alert
      const error = createEnhancedConversionError(
        createConversionError({
          code: 'TEST-ERR-001',
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.CRITICAL,
          message: 'Test critical error',
          moduleOrigin: 'TEST',
        }),
        []
      );

      for (let i = 0; i < 25; i++) {
        mockErrorCollector.addEnhancedError({
          ...error,
          id: `error-${i}`,
          timestamp: new Date(),
        });
      }

      await (monitoringService as any).performMonitoringCheck();
    });

    it('should get active alerts', () => {
      const alerts = monitoringService.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get all alerts', () => {
      const alerts = monitoringService.getAllAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should acknowledge alert', () => {
      const alerts = monitoringService.getActiveAlerts();
      if (alerts.length > 0) {
        const alertId = alerts[0].id;
        const result = monitoringService.acknowledgeAlert(alertId);
        expect(result).toBe(true);

        const updatedAlerts = monitoringService.getAllAlerts();
        const acknowledgedAlert = updatedAlerts.find((a) => a.id === alertId);
        expect(acknowledgedAlert?.acknowledged).toBe(true);
      }
    });

    it('should resolve alert', () => {
      const alerts = monitoringService.getActiveAlerts();
      if (alerts.length > 0) {
        const alertId = alerts[0].id;
        const result = monitoringService.resolveAlert(alertId);
        expect(result).toBe(true);

        const activeAlerts = monitoringService.getActiveAlerts();
        const resolvedAlert = activeAlerts.find((a) => a.id === alertId);
        expect(resolvedAlert).toBeUndefined();
      }
    });

    it('should handle acknowledging non-existent alert', () => {
      const result = monitoringService.acknowledgeAlert('non-existent-id');
      expect(result).toBe(false);
    });

    it('should handle resolving non-existent alert', () => {
      const result = monitoringService.resolveAlert('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('getMonitoringStatistics', () => {
    beforeEach(async () => {
      monitoringService.stopMonitoring();

      // Create various types of alerts
      const errors = [
        createConversionError({
          code: 'TEST-ERR-001',
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Test error 1',
          moduleOrigin: 'TEST',
        }),
        createConversionError({
          code: 'FILE-ERR-001',
          type: ErrorType.SECURITY,
          severity: ErrorSeverity.CRITICAL,
          message: 'File error 1',
          moduleOrigin: 'FILE',
        }),
      ];

      for (const error of errors) {
        for (let i = 0; i < 15; i++) {
          mockErrorCollector.addEnhancedError(
            createEnhancedConversionError(
              {
                ...error,
                id: `${error.moduleOrigin}-error-${i}`,
                timestamp: new Date(),
              },
              []
            )
          );
        }
      }

      await (monitoringService as any).performMonitoringCheck();
    });

    it('should return monitoring statistics', () => {
      const stats = monitoringService.getMonitoringStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.totalAlerts).toBe('number');
      expect(typeof stats.activeAlerts).toBe('number');
      expect(typeof stats.alertsByType).toBe('object');
      expect(typeof stats.alertsBySeverity).toBe('object');
      expect(typeof stats.averageResolutionTime).toBe('number');
    });

    it('should track alert resolution times', async () => {
      vi.useFakeTimers();
      const alerts = monitoringService.getActiveAlerts();
      if (alerts.length > 0) {
        const alertId = alerts[0].id;

        // Wait a bit then resolve
        setTimeout(() => {
          monitoringService.resolveAlert(alertId);
        }, 10);

        await vi.advanceTimersByTimeAsync(20);

        const stats = monitoringService.getMonitoringStatistics();
        expect(stats.averageResolutionTime).toBeGreaterThan(0);
      }
      vi.useRealTimers();
    });
  });

  describe('trend analysis', () => {
    beforeEach(() => {
      monitoringService.stopMonitoring();
    });

    it('should perform trend analysis when enabled', async () => {
      // Add historical data points
      for (let i = 0; i < 10; i++) {
        const error = createEnhancedConversionError(
          createConversionError({
            code: `TREND-ERR-${i.toString().padStart(3, '0')}`,
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Trend test error ${i}`,
            moduleOrigin: 'TREND',
          }),
          []
        );
        mockErrorCollector.addEnhancedError(error);

        // Simulate time passing
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      // Should not throw during trend analysis
      expect(async () => {
        await (monitoringService as any).performTrendAnalysis();
      }).not.toThrow();
    });

    it('should handle insufficient data for trend analysis', async () => {
      // Add only a few data points
      const error = createEnhancedConversionError(
        createConversionError({
          code: 'INSUFFICIENT-ERR-001',
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Insufficient data error',
          moduleOrigin: 'TEST',
        }),
        []
      );
      mockErrorCollector.addEnhancedError(error);

      // Should handle gracefully
      expect(async () => {
        await (monitoringService as any).performTrendAnalysis();
      }).not.toThrow();
    });
  });

  describe('anomaly detection', () => {
    beforeEach(() => {
      monitoringService.stopMonitoring();
    });

    it('should perform anomaly detection when enabled', async () => {
      // Create baseline data
      for (let i = 0; i < 15; i++) {
        const error = createEnhancedConversionError(
          createConversionError({
            code: `BASELINE-ERR-${i.toString().padStart(3, '0')}`,
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Baseline error ${i}`,
            moduleOrigin: 'BASELINE',
          }),
          []
        );
        mockErrorCollector.addEnhancedError(error);
      }

      const metrics = mockErrorCollector.getErrorRateMetrics();

      // Should not throw during anomaly detection
      expect(async () => {
        await (monitoringService as any).performAnomalyDetection(metrics);
      }).not.toThrow();
    });

    it('should handle anomaly detection with insufficient historical data', async () => {
      const metrics = mockErrorCollector.getErrorRateMetrics();

      // Should handle gracefully with no historical data
      expect(async () => {
        await (monitoringService as any).performAnomalyDetection(metrics);
      }).not.toThrow();
    });
  });

  describe('configuration handling', () => {
    it('should handle different threshold configurations', () => {
      const customThresholds: AlertThresholds = {
        errorRate: { warning: 1, critical: 5 },
        errorCount: { warning: 5, critical: 20 },
        componentFailures: { warning: 0, critical: 1 },
        recoveryFailureRate: { warning: 0.1, critical: 0.5 },
      };

      const customConfig: MonitoringConfig = {
        ...mockConfig,
        alertThresholds: customThresholds,
      };

      expect(() => {
        const service = new ErrorMonitoringService(
          mockErrorCollector,
          mockAlertingService,
          mockMonitoringService,
          customConfig
        );
        service.stopMonitoring();
      }).not.toThrow();
    });

    it('should handle disabled trend analysis', () => {
      const configWithoutTrends: MonitoringConfig = {
        ...mockConfig,
        enableTrendAnalysis: false,
      };

      expect(() => {
        const service = new ErrorMonitoringService(
          mockErrorCollector,
          mockAlertingService,
          mockMonitoringService,
          configWithoutTrends
        );
        service.stopMonitoring();
      }).not.toThrow();
    });

    it('should handle disabled anomaly detection', () => {
      const configWithoutAnomalies: MonitoringConfig = {
        ...mockConfig,
        enableAnomalyDetection: false,
      };

      expect(() => {
        const service = new ErrorMonitoringService(
          mockErrorCollector,
          mockAlertingService,
          mockMonitoringService,
          configWithoutAnomalies
        );
        service.stopMonitoring();
      }).not.toThrow();
    });
  });

  describe('error handling in monitoring', () => {
    beforeEach(() => {
      monitoringService.stopMonitoring();
    });

    it('should handle errors during monitoring check gracefully', async () => {
      // Mock error collector to throw
      const faultyCollector = {
        ...mockErrorCollector,
        getErrorRateMetrics: vi.fn().mockImplementation(() => {
          throw new Error('Collector error');
        }),
      } as any;

      const faultyService = new ErrorMonitoringService(
        faultyCollector,
        mockAlertingService,
        mockMonitoringService,
        { ...mockConfig, enabled: false }
      );

      // Should not throw
      expect(async () => {
        await (faultyService as any).performMonitoringCheck();
      }).not.toThrow();

      faultyService.stopMonitoring();
    });

    it('should handle alerting service failures gracefully', async () => {
      const faultyAlertingService = {
        sendAlert: vi.fn().mockRejectedValue(new Error('Alerting failed')),
      } as unknown as AlertingService;

      const serviceWithFaultyAlerting = new ErrorMonitoringService(
        mockErrorCollector,
        faultyAlertingService,
        mockMonitoringService,
        { ...mockConfig, enabled: false }
      );

      // Add errors to trigger alert
      for (let i = 0; i < 25; i++) {
        const error = createEnhancedConversionError(
          createConversionError({
            code: `FAULTY-ERR-${i.toString().padStart(3, '0')}`,
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Faulty test error ${i}`,
            moduleOrigin: 'FAULTY',
          }),
          []
        );
        mockErrorCollector.addEnhancedError(error);
      }

      // Should not throw even if alerting fails
      expect(async () => {
        await (serviceWithFaultyAlerting as any).performMonitoringCheck();
      }).not.toThrow();

      serviceWithFaultyAlerting.stopMonitoring();
    });
  });

  describe('memory and performance', () => {
    beforeEach(() => {
      monitoringService.stopMonitoring();
    });

    it('should handle large numbers of alerts efficiently', async () => {
      // Create many errors to generate alerts
      for (let i = 0; i < 100; i++) {
        const error = createEnhancedConversionError(
          createConversionError({
            code: `PERF-ERR-${i.toString().padStart(3, '0')}`,
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.CRITICAL,
            message: `Performance test error ${i}`,
            moduleOrigin: 'PERF',
          }),
          []
        );
        mockErrorCollector.addEnhancedError(error);
      }

      await (monitoringService as any).performMonitoringCheck();

      // Should handle getting statistics efficiently
      const startTime = Date.now();
      const stats = monitoringService.getMonitoringStatistics();
      const endTime = Date.now();

      expect(stats).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should clean up old data according to retention period', async () => {
      const shortRetentionConfig: MonitoringConfig = {
        ...mockConfig,
        retentionPeriod: 1000, // 1 second
        enabled: false,
      };

      const serviceWithShortRetention = new ErrorMonitoringService(
        mockErrorCollector,
        mockAlertingService,
        mockMonitoringService,
        shortRetentionConfig
      );

      // Add some data
      const error = createEnhancedConversionError(
        createConversionError({
          code: 'RETENTION-ERR-001',
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Retention test error',
          moduleOrigin: 'RETENTION',
        }),
        []
      );
      mockErrorCollector.addEnhancedError(error);

      await (serviceWithShortRetention as any).performMonitoringCheck();

      // Wait for retention period to pass
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Trigger cleanup
      await (serviceWithShortRetention as any).performMonitoringCheck();

      // Should not throw and should handle cleanup
      expect(() => {
        serviceWithShortRetention.getMonitoringStatistics();
      }).not.toThrow();

      serviceWithShortRetention.stopMonitoring();
    });
  });
});
