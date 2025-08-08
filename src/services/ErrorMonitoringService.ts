/**
 * Error Monitoring and Alerting Service
 *
 * This service monitors error rates, patterns, and system health,
 * providing alerting capabilities for critical error conditions.
 */

import {
  ErrorRateMetrics,
  SystemHealthStatus,
} from '../types/errors.js';
import { EnhancedErrorCollector } from './EnhancedErrorCollector.js';
import { AlertingService } from './AlertingService.js';
import { MonitoringService } from './MonitoringService.js';
import { logger } from '../utils/logger.js';

/**
 * Alert threshold configuration
 */
export interface AlertThresholds {
  errorRate: {
    warning: number;
    critical: number;
  };
  errorCount: {
    warning: number;
    critical: number;
  };
  componentFailures: {
    warning: number;
    critical: number;
  };
  recoveryFailureRate: {
    warning: number;
    critical: number;
  };
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  alertThresholds: AlertThresholds;
  enableTrendAnalysis: boolean;
  enableAnomalyDetection: boolean;
  retentionPeriod: number; // milliseconds
}

/**
 * Alert information
 */
export interface ErrorAlert {
  id: string;
  type: 'error_rate' | 'component_failure' | 'recovery_failure' | 'anomaly' | 'trend';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  data: Record<string, any>;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  confidence: number;
  prediction?: {
    nextValue: number;
    timeframe: number;
  };
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetection {
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Error Monitoring Service implementation
 */
export class ErrorMonitoringService {
  private errorCollector: EnhancedErrorCollector;
  private alertingService: AlertingService;
  private monitoringService: MonitoringService;
  private config: MonitoringConfig;
  private monitoringInterval?: NodeJS.Timeout;
  private alerts: Map<string, ErrorAlert> = new Map();
  private historicalMetrics: Array<{
    timestamp: Date;
    metrics: ErrorRateMetrics;
    healthStatus: SystemHealthStatus;
  }> = [];

  constructor(
    errorCollector: EnhancedErrorCollector,
    alertingService: AlertingService,
    monitoringService: MonitoringService,
    config: MonitoringConfig
  ) {
    this.errorCollector = errorCollector;
    this.alertingService = alertingService;
    this.monitoringService = monitoringService;
    this.config = config;

    if (config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start error monitoring
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    logger.info('Starting error monitoring', {
      checkInterval: this.config.checkInterval,
      alertThresholds: this.config.alertThresholds,
    });

    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCheck();
    }, this.config.checkInterval);

    // Initial check
    this.performMonitoringCheck();
  }

  /**
   * Stop error monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('Error monitoring stopped');
    }
  }

  /**
   * Perform a monitoring check
   */
  private async performMonitoringCheck(): Promise<void> {
    try {
      const metrics = this.errorCollector.getErrorRateMetrics();
      const healthStatus = this.errorCollector.getSystemHealthStatus();

      // Store historical data
      this.storeHistoricalMetrics(metrics, healthStatus);

      // Check error rate thresholds
      await this.checkErrorRateThresholds(metrics);

      // Check component health
      await this.checkComponentHealth(healthStatus);

      // Check recovery failure rates
      await this.checkRecoveryFailures();

      // Perform trend analysis if enabled
      if (this.config.enableTrendAnalysis) {
        await this.performTrendAnalysis();
      }

      // Perform anomaly detection if enabled
      if (this.config.enableAnomalyDetection) {
        await this.performAnomalyDetection(metrics);
      }

      // Clean up old data
      this.cleanupHistoricalData();

      // Update monitoring metrics
      this.monitoringService.recordMetric('error_monitoring.checks_performed', 1);
      this.monitoringService.recordMetric(
        'error_monitoring.active_alerts',
        this.getActiveAlerts().length
      );
    } catch (error) {
      logger.error('Error monitoring check failed', { error });
    }
  }

  /**
   * Check error rate thresholds
   */
  private async checkErrorRateThresholds(metrics: ErrorRateMetrics): Promise<void> {
    const { errorRate } = metrics;
    const thresholds = this.config.alertThresholds.errorRate;

    if (errorRate >= thresholds.critical) {
      await this.createAlert({
        type: 'error_rate',
        severity: 'critical',
        title: 'Critical Error Rate Detected',
        message: `Error rate (${errorRate.toFixed(2)}/min) exceeds critical threshold (${thresholds.critical}/min)`,
        data: { errorRate, threshold: thresholds.critical, metrics },
      });
    } else if (errorRate >= thresholds.warning) {
      await this.createAlert({
        type: 'error_rate',
        severity: 'warning',
        title: 'High Error Rate Detected',
        message: `Error rate (${errorRate.toFixed(2)}/min) exceeds warning threshold (${thresholds.warning}/min)`,
        data: { errorRate, threshold: thresholds.warning, metrics },
      });
    }

    // Check error count thresholds
    const { totalErrors } = metrics;
    const countThresholds = this.config.alertThresholds.errorCount;

    if (totalErrors >= countThresholds.critical) {
      await this.createAlert({
        type: 'error_rate',
        severity: 'critical',
        title: 'Critical Error Count Detected',
        message: `Total errors (${totalErrors}) exceeds critical threshold (${countThresholds.critical})`,
        data: { totalErrors, threshold: countThresholds.critical, metrics },
      });
    } else if (totalErrors >= countThresholds.warning) {
      await this.createAlert({
        type: 'error_rate',
        severity: 'warning',
        title: 'High Error Count Detected',
        message: `Total errors (${totalErrors}) exceeds warning threshold (${countThresholds.warning})`,
        data: { totalErrors, threshold: countThresholds.warning, metrics },
      });
    }
  }

  /**
   * Check component health status
   */
  private async checkComponentHealth(healthStatus: SystemHealthStatus): Promise<void> {
    const failingComponents = Object.entries(healthStatus.components).filter(
      ([, health]) => health.status === 'failing'
    );

    const degradedComponents = Object.entries(healthStatus.components).filter(
      ([, health]) => health.status === 'degraded'
    );

    const thresholds = this.config.alertThresholds.componentFailures;

    if (failingComponents.length >= thresholds.critical) {
      await this.createAlert({
        type: 'component_failure',
        severity: 'critical',
        title: 'Critical Component Failures',
        message: `${failingComponents.length} components are failing: ${failingComponents.map(([name]) => name).join(', ')}`,
        data: { failingComponents: failingComponents.map(([name, health]) => ({ name, health })) },
      });
    } else if (
      failingComponents.length >= thresholds.warning ||
      degradedComponents.length >= thresholds.warning
    ) {
      await this.createAlert({
        type: 'component_failure',
        severity: 'warning',
        title: 'Component Health Issues',
        message: `${failingComponents.length} failing, ${degradedComponents.length} degraded components detected`,
        data: {
          failingComponents: failingComponents.map(([name, health]) => ({ name, health })),
          degradedComponents: degradedComponents.map(([name, health]) => ({ name, health })),
        },
      });
    }

    // Check overall system health
    if (healthStatus.overall === 'failing') {
      await this.createAlert({
        type: 'component_failure',
        severity: 'critical',
        title: 'System Health Critical',
        message: 'Overall system health is in failing state',
        data: { healthStatus },
      });
    } else if (healthStatus.overall === 'critical') {
      await this.createAlert({
        type: 'component_failure',
        severity: 'critical',
        title: 'System Health Critical',
        message: 'System health is in critical state',
        data: { healthStatus },
      });
    }
  }

  /**
   * Check recovery failure rates
   */
  private async checkRecoveryFailures(): Promise<void> {
    const recoverableErrors = this.errorCollector.getRecoverableErrors();
    const failedRecoveries = recoverableErrors.filter(
      (error) => error.recoveryAttempts > 0 && !error.hasBeenRecovered
    );

    if (recoverableErrors.length === 0) return;

    const recoveryFailureRate = failedRecoveries.length / recoverableErrors.length;
    const thresholds = this.config.alertThresholds.recoveryFailureRate;

    if (recoveryFailureRate >= thresholds.critical) {
      await this.createAlert({
        type: 'recovery_failure',
        severity: 'critical',
        title: 'Critical Recovery Failure Rate',
        message: `Recovery failure rate (${(recoveryFailureRate * 100).toFixed(1)}%) exceeds critical threshold`,
        data: {
          recoveryFailureRate,
          threshold: thresholds.critical,
          failedRecoveries: failedRecoveries.length,
          totalRecoverable: recoverableErrors.length,
        },
      });
    } else if (recoveryFailureRate >= thresholds.warning) {
      await this.createAlert({
        type: 'recovery_failure',
        severity: 'warning',
        title: 'High Recovery Failure Rate',
        message: `Recovery failure rate (${(recoveryFailureRate * 100).toFixed(1)}%) exceeds warning threshold`,
        data: {
          recoveryFailureRate,
          threshold: thresholds.warning,
          failedRecoveries: failedRecoveries.length,
          totalRecoverable: recoverableErrors.length,
        },
      });
    }
  }

  /**
   * Perform trend analysis
   */
  private async performTrendAnalysis(): Promise<void> {
    if (this.historicalMetrics.length < 5) {
      return; // Need more data points for trend analysis
    }

    const trends = this.analyzeTrends();

    for (const trend of trends) {
      if (trend.trend === 'increasing' && trend.confidence > 0.8) {
        if (trend.metric === 'errorRate' && trend.changeRate > 0.5) {
          await this.createAlert({
            type: 'trend',
            severity: 'warning',
            title: 'Increasing Error Rate Trend',
            message: `Error rate is trending upward with ${(trend.changeRate * 100).toFixed(1)}% increase rate`,
            data: { trend },
          });
        }
      }
    }
  }

  /**
   * Perform anomaly detection
   */
  private async performAnomalyDetection(currentMetrics: ErrorRateMetrics): Promise<void> {
    const anomalies = this.detectAnomalies(currentMetrics);

    for (const anomaly of anomalies) {
      if (anomaly.isAnomaly && anomaly.severity === 'high') {
        await this.createAlert({
          type: 'anomaly',
          severity: 'warning',
          title: 'Error Rate Anomaly Detected',
          message: `${anomaly.metric} shows anomalous behavior: current=${anomaly.currentValue}, expected=${anomaly.expectedValue}`,
          data: { anomaly },
        });
      }
    }
  }

  /**
   * Create an alert
   */
  private async createAlert(
    alertData: Omit<ErrorAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>
  ): Promise<void> {
    const alert: ErrorAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      ...alertData,
    };

    // Check if similar alert already exists
    const existingAlert = this.findSimilarAlert(alert);
    if (existingAlert && !existingAlert.resolved) {
      logger.debug('Similar alert already exists, skipping', { alertId: existingAlert.id });
      return;
    }

    this.alerts.set(alert.id, alert);

    // Send alert through alerting service
    await this.alertingService.sendAlert({
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      data: alert.data,
    });

    logger.warn('Error alert created', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
    });
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): ErrorAlert[] {
    return Array.from(this.alerts.values())
      .filter((alert) => !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get all alerts
   */
  public getAllAlerts(): ErrorAlert[] {
    return Array.from(this.alerts.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.info('Alert acknowledged', { alertId });
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      logger.info('Alert resolved', { alertId });
      return true;
    }
    return false;
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStatistics(): {
    totalAlerts: number;
    activeAlerts: number;
    alertsByType: Record<string, number>;
    alertsBySeverity: Record<string, number>;
    averageResolutionTime: number;
  } {
    const alerts = Array.from(this.alerts.values());
    const activeAlerts = alerts.filter((alert) => !alert.resolved);

    const alertsByType: Record<string, number> = {};
    const alertsBySeverity: Record<string, number> = {};

    alerts.forEach((alert) => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    });

    // Calculate average resolution time
    const resolvedAlerts = alerts.filter((alert) => alert.resolved && alert.resolvedAt);
    const averageResolutionTime =
      resolvedAlerts.length > 0
        ? resolvedAlerts.reduce((sum, alert) => {
            const resolutionTime = alert.resolvedAt!.getTime() - alert.timestamp.getTime();
            return sum + resolutionTime;
          }, 0) / resolvedAlerts.length
        : 0;

    return {
      totalAlerts: alerts.length,
      activeAlerts: activeAlerts.length,
      alertsByType,
      alertsBySeverity,
      averageResolutionTime,
    };
  }

  /**
   * Store historical metrics
   */
  private storeHistoricalMetrics(
    metrics: ErrorRateMetrics,
    healthStatus: SystemHealthStatus
  ): void {
    this.historicalMetrics.push({
      timestamp: new Date(),
      metrics,
      healthStatus,
    });

    // Keep only data within retention period
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod);
    this.historicalMetrics = this.historicalMetrics.filter(
      (entry) => entry.timestamp >= cutoffTime
    );
  }

  /**
   * Analyze trends in historical data
   */
  private analyzeTrends(): TrendAnalysis[] {
    const trends: TrendAnalysis[] = [];

    if (this.historicalMetrics.length < 3) {
      return trends;
    }

    // Analyze error rate trend
    const errorRates = this.historicalMetrics.map((entry) => entry.metrics.errorRate);
    const errorRateTrend = this.calculateTrend(errorRates);
    trends.push({
      metric: 'errorRate',
      ...errorRateTrend,
    });

    // Analyze total errors trend
    const totalErrors = this.historicalMetrics.map((entry) => entry.metrics.totalErrors);
    const totalErrorsTrend = this.calculateTrend(totalErrors);
    trends.push({
      metric: 'totalErrors',
      ...totalErrorsTrend,
    });

    return trends;
  }

  /**
   * Calculate trend for a series of values
   */
  private calculateTrend(values: number[]): Omit<TrendAnalysis, 'metric'> {
    if (values.length < 2) {
      return { trend: 'stable', changeRate: 0, confidence: 0 };
    }

    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate correlation coefficient for confidence
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (values[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + (val - meanX) ** 2, 0));
    const denomY = Math.sqrt(values.reduce((sum, val) => sum + (val - meanY) ** 2, 0));
    const correlation = numerator / (denomX * denomY);
    const confidence = Math.abs(correlation);

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(slope) > 0.1) {
      trend = slope > 0 ? 'increasing' : 'decreasing';
    }

    return {
      trend,
      changeRate: Math.abs(slope),
      confidence,
      prediction: {
        nextValue: slope * n + intercept,
        timeframe: this.config.checkInterval,
      },
    };
  }

  /**
   * Detect anomalies in current metrics
   */
  private detectAnomalies(currentMetrics: ErrorRateMetrics): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];

    if (this.historicalMetrics.length < 10) {
      return anomalies; // Need more historical data
    }

    // Get recent historical values (excluding current)
    const recentMetrics = this.historicalMetrics.slice(-10);

    // Check error rate anomaly
    const historicalErrorRates = recentMetrics.map((entry) => entry.metrics.errorRate);
    const errorRateAnomaly = this.detectValueAnomaly(
      currentMetrics.errorRate,
      historicalErrorRates
    );
    anomalies.push({
      metric: 'errorRate',
      currentValue: currentMetrics.errorRate,
      ...errorRateAnomaly,
    });

    // Check total errors anomaly
    const historicalTotalErrors = recentMetrics.map((entry) => entry.metrics.totalErrors);
    const totalErrorsAnomaly = this.detectValueAnomaly(
      currentMetrics.totalErrors,
      historicalTotalErrors
    );
    anomalies.push({
      metric: 'totalErrors',
      currentValue: currentMetrics.totalErrors,
      ...totalErrorsAnomaly,
    });

    return anomalies;
  }

  /**
   * Detect if a value is anomalous compared to historical values
   */
  private detectValueAnomaly(
    currentValue: number,
    historicalValues: number[]
  ): Omit<AnomalyDetection, 'metric' | 'currentValue'> {
    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance =
      historicalValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);

    const deviation = Math.abs(currentValue - mean);
    const normalizedDeviation = stdDev > 0 ? deviation / stdDev : 0;

    let isAnomaly = false;
    let severity: 'low' | 'medium' | 'high' = 'low';

    if (normalizedDeviation > 3) {
      isAnomaly = true;
      severity = 'high';
    } else if (normalizedDeviation > 2) {
      isAnomaly = true;
      severity = 'medium';
    } else if (normalizedDeviation > 1.5) {
      isAnomaly = true;
      severity = 'low';
    }

    return {
      expectedValue: mean,
      deviation: normalizedDeviation,
      isAnomaly,
      severity,
    };
  }

  /**
   * Find similar existing alert
   */
  private findSimilarAlert(alert: ErrorAlert): ErrorAlert | undefined {
    return Array.from(this.alerts.values()).find(
      (existing) =>
        existing.type === alert.type &&
        existing.severity === alert.severity &&
        !existing.resolved &&
        Date.now() - existing.timestamp.getTime() < 300000 // Within 5 minutes
    );
  }

  /**
   * Clean up old historical data
   */
  private cleanupHistoricalData(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod);

    // Clean up historical metrics
    this.historicalMetrics = this.historicalMetrics.filter(
      (entry) => entry.timestamp >= cutoffTime
    );

    // Clean up old resolved alerts
    const alertCutoffTime = new Date(Date.now() - this.config.retentionPeriod * 2);
    const alertsToKeep = new Map<string, ErrorAlert>();

    this.alerts.forEach((alert, id) => {
      if (!alert.resolved || alert.timestamp >= alertCutoffTime) {
        alertsToKeep.set(id, alert);
      }
    });

    this.alerts = alertsToKeep;
  }
}
