import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { MonitoringConfig } from '../types/config.js';

/**
 * Security metric for tracking security events and threats
 */
export interface SecurityMetric {
  type: 'security_event';
  event: 'threat_detected' | 'scan_completed' | 'file_quarantined' | 'malware_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: {
    threatType?: string;
    fileName?: string;
    fileSize?: number;
    scanDuration?: number;
    userId?: string;
  };
  timestamp: Date;
}

/**
 * Performance metric for tracking operation performance and success rates
 */
export interface PerformanceMetric {
  type: 'performance';
  operation: 'file_processing' | 'java_analysis' | 'asset_conversion' | 'validation';
  duration: number;
  success: boolean;
  details: {
    fileSize?: number;
    itemCount?: number;
    errorCode?: string;
    userId?: string;
  };
  timestamp: Date;
}

/**
 * Conversion quality metric for tracking conversion process quality and success rates
 */
export interface ConversionQualityMetric {
  type: 'conversion_quality';
  stage: 'analysis' | 'conversion' | 'validation' | 'packaging';
  success: boolean;
  qualityScore?: number;
  details: {
    extractedItems?: number;
    convertedAssets?: number;
    validationErrors?: number;
    userId?: string;
  };
  timestamp: Date;
}

/**
 * System health metric for tracking component health status
 */
export interface SystemHealthMetric {
  type: 'system_health';
  component: 'file_processor' | 'java_analyzer' | 'asset_converter' | 'validation_pipeline';
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    memoryUsage?: number;
    cpuUsage?: number;
    errorRate?: number;
    responseTime?: number;
  };
  timestamp: Date;
}

export type Metric =
  | SecurityMetric
  | PerformanceMetric
  | ConversionQualityMetric
  | SystemHealthMetric;

/**
 * Aggregated metrics summary for reporting and analysis
 */
export interface MetricsSummary {
  timeRange: {
    start: Date;
    end: Date;
  };
  security: {
    totalScans: number;
    threatsDetected: number;
    averageScanTime: number;
    threatsByType: Record<string, number>;
  };
  performance: {
    totalOperations: number;
    averageDuration: number;
    successRate: number;
    operationsByType: Record<string, number>;
  };
  conversionQuality: {
    totalConversions: number;
    successRate: number;
    averageQualityScore: number;
    errorsByStage: Record<string, number>;
  };
  systemHealth: {
    componentStatus: Record<string, string>;
    averageMemoryUsage: number;
    averageCpuUsage: number;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  };
}

/**
 * Alert rule configuration for defining alert conditions and thresholds
 */
export interface AlertRule {
  id: string;
  name: string;
  condition: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    timeWindow: number; // in milliseconds
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // in milliseconds
  lastTriggered?: Date;
}

/**
 * Alert instance representing a triggered alert with metadata
 */
export interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Monitoring service for collecting, analyzing, and alerting on system metrics
 */
export class MonitoringService extends EventEmitter {
  private metrics: Metric[] = [];
  private alerts: Alert[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private config: MonitoringConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsRetentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.initializeDefaultAlertRules();

    if (config.enableHealthChecks) {
      this.startHealthChecks();
    }
  }

  /**
   * Generic method to record any metric (for testing compatibility)
   */
  recordMetric(metric: any): void {
    // Determine metric type and delegate to appropriate method
    if (metric.type === 'security_event' || metric.event) {
      this.recordSecurityMetric(metric);
    } else if (metric.type === 'performance' || metric.operation) {
      this.recordPerformanceMetric(metric);
    } else if (metric.type === 'conversion_quality' || metric.stage) {
      this.recordConversionQualityMetric(metric);
    } else if (metric.type === 'system_health' || metric.component) {
      this.recordSystemHealthMetric(metric);
    } else {
      // Default to performance metric
      this.recordPerformanceMetric({
        operation: 'file_processing',
        duration: metric.duration || 0,
        success: metric.success !== false,
        details: metric.details || {}
      });
    }
  }

  /**
   * Record a security metric event
   * @param metric - Security metric data without type and timestamp
   * @returns void
   * @example
   * ```typescript
   * monitoringService.recordSecurityMetric({
   *   event: 'threat_detected',
   *   severity: 'high',
   *   details: {
   *     threatType: 'malware',
   *     fileName: 'suspicious.jar'
   *   }
   * });
   * ```
   */
  recordSecurityMetric(metric: Omit<SecurityMetric, 'type' | 'timestamp'>): void {
    const fullMetric: SecurityMetric = {
      ...metric,
      type: 'security_event',
      timestamp: new Date(),
    };

    this.metrics.push(fullMetric);
    this.emit('metric:security', fullMetric);
    this.checkAlertRules(fullMetric);

    logger.info('Security metric recorded', {
      event: metric.event,
      severity: metric.severity,
      details: metric.details,
    });
  }

  /**
   * Record a performance metric event
   * @param metric - Performance metric data without type and timestamp
   * @returns void
   * @example
   * ```typescript
   * monitoringService.recordPerformanceMetric({
   *   operation: 'file_processing',
   *   duration: 1500,
   *   success: true,
   *   details: {
   *     fileSize: 1024000
   *   }
   * });
   * ```
   */
  recordPerformanceMetric(metric: Omit<PerformanceMetric, 'type' | 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      type: 'performance',
      timestamp: new Date(),
    };

    this.metrics.push(fullMetric);
    this.emit('metric:performance', fullMetric);
    this.checkAlertRules(fullMetric);

    logger.debug('Performance metric recorded', {
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
    });
  }

  /**
   * Record a conversion quality metric event
   * @param metric - Conversion quality metric data without type and timestamp
   * @returns void
   * @example
   * ```typescript
   * monitoringService.recordConversionQualityMetric({
   *   stage: 'analysis',
   *   success: true,
   *   qualityScore: 95.5,
   *   details: {
   *     extractedItems: 42
   *   }
   * });
   * ```
   */
  recordConversionQualityMetric(metric: Omit<ConversionQualityMetric, 'type' | 'timestamp'>): void {
    const fullMetric: ConversionQualityMetric = {
      ...metric,
      type: 'conversion_quality',
      timestamp: new Date(),
    };

    this.metrics.push(fullMetric);
    this.emit('metric:conversion_quality', fullMetric);
    this.checkAlertRules(fullMetric);

    logger.info('Conversion quality metric recorded', {
      stage: metric.stage,
      success: metric.success,
      qualityScore: metric.qualityScore,
    });
  }

  /**
   * Record a system health metric event
   * @param metric - System health metric data without type and timestamp
   * @returns void
   * @example
   * ```typescript
   * monitoringService.recordSystemHealthMetric({
   *   component: 'file_processor',
   *   status: 'healthy',
   *   details: {
   *     memoryUsage: 256.5
   *   }
   * });
   * ```
   */
  recordSystemHealthMetric(metric: Omit<SystemHealthMetric, 'type' | 'timestamp'>): void {
    const fullMetric: SystemHealthMetric = {
      ...metric,
      type: 'system_health',
      timestamp: new Date(),
    };

    this.metrics.push(fullMetric);
    this.emit('metric:system_health', fullMetric);
    this.checkAlertRules(fullMetric);

    if (metric.status !== 'healthy') {
      logger.warn('System health degraded', {
        component: metric.component,
        status: metric.status,
        details: metric.details,
      });
    }
  }

  /**
   * Get metrics summary for a time range
   * @param startTime - Start of the time range to analyze
   * @param endTime - End of the time range to analyze
   * @returns Aggregated metrics summary for the specified time range
   * @example
   * ```typescript
   * const summary = monitoringService.getMetricsSummary(
   *   new Date(Date.now() - 24*60*60*1000), // Last 24 hours
   *   new Date()
   * );
   * console.log(`Security threats: ${summary.security.threatsDetected}`);
   * ```
   */
  getMetricsSummary(startTime: Date, endTime: Date): MetricsSummary {
    const filteredMetrics = this.metrics.filter(
      (metric) => metric.timestamp >= startTime && metric.timestamp <= endTime
    );

    const securityMetrics = filteredMetrics.filter(
      (m) => m.type === 'security_event'
    ) as SecurityMetric[];
    const performanceMetrics = filteredMetrics.filter(
      (m) => m.type === 'performance'
    ) as PerformanceMetric[];
    const qualityMetrics = filteredMetrics.filter(
      (m) => m.type === 'conversion_quality'
    ) as ConversionQualityMetric[];
    const healthMetrics = filteredMetrics.filter(
      (m) => m.type === 'system_health'
    ) as SystemHealthMetric[];

    return {
      timeRange: { start: startTime, end: endTime },
      security: this.aggregateSecurityMetrics(securityMetrics),
      performance: this.aggregatePerformanceMetrics(performanceMetrics),
      conversionQuality: this.aggregateQualityMetrics(qualityMetrics),
      systemHealth: this.aggregateHealthMetrics(healthMetrics),
    };
  }

  /**
   * Get all active alerts that have not been resolved
   * @returns Array of unresolved alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  /**
   * Resolve an alert by marking it as resolved
   * @param alertId - Unique identifier of the alert to resolve
   * @returns True if the alert was found and resolved, false otherwise
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert:resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Add or update an alert rule
   * @param rule - Alert rule configuration to set
   * @returns void
   */
  setAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info('Alert rule updated', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Remove an alert rule
   * @param ruleId - Unique identifier of the rule to remove
   * @returns True if the rule was found and removed, false otherwise
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      logger.info('Alert rule removed', { ruleId });
    }
    return removed;
  }

  /**
   * Get health status of all system components
   * @returns Record mapping component names to their current health status
   */
  getHealthStatus(): Record<string, string> {
    const recentHealthMetrics = this.metrics
      .filter(
        (m) => m.type === 'system_health' && m.timestamp > new Date(Date.now() - 5 * 60 * 1000)
      ) // Last 5 minutes
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) as SystemHealthMetric[];

    const componentStatus: Record<string, string> = {};
    const components = [
      'file_processor',
      'java_analyzer',
      'asset_converter',
      'validation_pipeline',
    ];

    for (const component of components) {
      const latestMetric = recentHealthMetrics.find((m) => m.component === component);
      componentStatus[component] = latestMetric?.status || 'unknown';
    }

    return componentStatus;
  }

  /**
   * Clean up old metrics that are beyond the retention period
   * @returns void
   * @example
   * ```typescript
   * // Clean up metrics older than retention period
   * monitoringService.cleanupOldMetrics();
   * ```
   */
  cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.metricsRetentionPeriod);
    const initialCount = this.metrics.length;

    this.metrics = this.metrics.filter((metric) => metric.timestamp > cutoffTime);

    const removedCount = initialCount - this.metrics.length;
    if (removedCount > 0) {
      logger.info('Cleaned up old metrics', { removedCount, totalMetrics: this.metrics.length });
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    logger.info('Health checks started', { interval: this.config.healthCheckInterval });
  }

  /**
   * Perform system health check
   */
  private performHealthCheck(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Check memory usage
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
    let memoryStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (memoryUsageMB > 1000) {
      // > 1GB
      memoryStatus = 'unhealthy';
    } else if (memoryUsageMB > 500) {
      // > 500MB
      memoryStatus = 'degraded';
    }

    this.recordSystemHealthMetric({
      component: 'file_processor',
      status: memoryStatus,
      details: {
        memoryUsage: memoryUsageMB,
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      },
    });
  }

  /**
   * Check alert rules against a new metric
   */
  private checkAlertRules(metric: Metric): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && Date.now() - rule.lastTriggered.getTime() < rule.cooldown) {
        continue;
      }

      if (this.evaluateAlertRule(rule, metric)) {
        this.triggerAlert(rule, metric);
      }
    }
  }

  /**
   * Evaluate if a metric triggers an alert rule
   */
  private evaluateAlertRule(rule: AlertRule, metric: Metric): boolean {
    // Simple rule evaluation - in production this would be more sophisticated
    const { condition } = rule;

    let value: number | undefined;

    // Extract relevant value from metric based on rule condition
    switch (condition.metric) {
      case 'security_threat_count':
        if (metric.type === 'security_event' && metric.event === 'threat_detected') {
          value = 1;
        }
        break;
      case 'performance_duration':
        if (metric.type === 'performance') {
          value = metric.duration;
        }
        break;
      case 'memory_usage':
        if (metric.type === 'system_health' && metric.details.memoryUsage) {
          value = metric.details.memoryUsage;
        }
        break;
    }

    if (value === undefined) return false;

    // Evaluate condition
    switch (condition.operator) {
      case 'gt':
        return value > condition.threshold;
      case 'gte':
        return value >= condition.threshold;
      case 'lt':
        return value < condition.threshold;
      case 'lte':
        return value <= condition.threshold;
      case 'eq':
        return value === condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, metric: Metric): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      message: `Alert: ${rule.name} triggered`,
      severity: rule.severity,
      timestamp: new Date(),
      resolved: false,
      metadata: { metric },
    };

    this.alerts.push(alert);
    rule.lastTriggered = new Date();

    this.emit('alert:triggered', alert);

    logger.warn('Alert triggered', {
      alertId: alert.id,
      ruleName: rule.name,
      severity: alert.severity,
    });

    // Send webhook notification if configured
    if (this.config.alertingEnabled && this.config.alertingWebhookUrl) {
      this.sendAlertWebhook(alert);
    }
  }

  /**
   * Send alert webhook notification
   */
  private async sendAlertWebhook(alert: Alert): Promise<void> {
    try {
      const response = await fetch(this.config.alertingWebhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            message: alert.message,
            severity: alert.severity,
            timestamp: alert.timestamp,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }

      logger.info('Alert webhook sent successfully', { alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send alert webhook', {
        alertId: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        condition: {
          metric: 'memory_usage',
          operator: 'gt',
          threshold: 800, // MB
          timeWindow: 60000, // 1 minute
        },
        severity: 'high',
        enabled: true,
        cooldown: 300000, // 5 minutes
      },
      {
        id: 'security_threat_detected',
        name: 'Security Threat Detected',
        condition: {
          metric: 'security_threat_count',
          operator: 'gte',
          threshold: 1,
          timeWindow: 1000, // 1 second
        },
        severity: 'critical',
        enabled: true,
        cooldown: 60000, // 1 minute
      },
      {
        id: 'slow_performance',
        name: 'Slow Performance',
        condition: {
          metric: 'performance_duration',
          operator: 'gt',
          threshold: 30000, // 30 seconds
          timeWindow: 60000, // 1 minute
        },
        severity: 'medium',
        enabled: true,
        cooldown: 300000, // 5 minutes
      },
    ];

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule);
    }

    logger.info('Default alert rules initialized', { count: defaultRules.length });
  }

  // Aggregation helper methods
  private aggregateSecurityMetrics(metrics: SecurityMetric[]) {
    const threatsByType: Record<string, number> = {};
    let totalScanTime = 0;
    let scanCount = 0;

    for (const metric of metrics) {
      if (metric.event === 'threat_detected' && metric.details.threatType) {
        threatsByType[metric.details.threatType] =
          (threatsByType[metric.details.threatType] || 0) + 1;
      }
      if (metric.details.scanDuration) {
        totalScanTime += metric.details.scanDuration;
        scanCount++;
      }
    }

    return {
      totalScans: metrics.filter((m) => m.event === 'scan_completed').length,
      threatsDetected: metrics.filter((m) => m.event === 'threat_detected').length,
      averageScanTime: scanCount > 0 ? totalScanTime / scanCount : 0,
      threatsByType,
    };
  }

  private aggregatePerformanceMetrics(metrics: PerformanceMetric[]) {
    const operationsByType: Record<string, number> = {};
    let totalDuration = 0;
    let successCount = 0;

    for (const metric of metrics) {
      operationsByType[metric.operation] = (operationsByType[metric.operation] || 0) + 1;
      totalDuration += metric.duration;
      if (metric.success) successCount++;
    }

    return {
      totalOperations: metrics.length,
      averageDuration: metrics.length > 0 ? totalDuration / metrics.length : 0,
      successRate: metrics.length > 0 ? successCount / metrics.length : 0,
      operationsByType,
    };
  }

  private aggregateQualityMetrics(metrics: ConversionQualityMetric[]) {
    const errorsByStage: Record<string, number> = {};
    let totalQualityScore = 0;
    let qualityScoreCount = 0;
    let successCount = 0;

    for (const metric of metrics) {
      if (!metric.success) {
        errorsByStage[metric.stage] = (errorsByStage[metric.stage] || 0) + 1;
      } else {
        successCount++;
      }

      if (metric.qualityScore !== undefined) {
        totalQualityScore += metric.qualityScore;
        qualityScoreCount++;
      }
    }

    return {
      totalConversions: metrics.length,
      successRate: metrics.length > 0 ? successCount / metrics.length : 0,
      averageQualityScore: qualityScoreCount > 0 ? totalQualityScore / qualityScoreCount : 0,
      errorsByStage,
    };
  }

  private aggregateHealthMetrics(metrics: SystemHealthMetric[]) {
    const componentStatus: Record<string, string> = {};
    let totalMemoryUsage = 0;
    let totalCpuUsage = 0;
    let memoryCount = 0;
    let cpuCount = 0;

    // Get latest status for each component
    const latestByComponent: Record<string, SystemHealthMetric> = {};
    for (const metric of metrics) {
      if (
        !latestByComponent[metric.component] ||
        metric.timestamp > latestByComponent[metric.component].timestamp
      ) {
        latestByComponent[metric.component] = metric;
      }

      if (metric.details.memoryUsage) {
        totalMemoryUsage += metric.details.memoryUsage;
        memoryCount++;
      }
      if (metric.details.cpuUsage) {
        totalCpuUsage += metric.details.cpuUsage;
        cpuCount++;
      }
    }

    for (const [component, metric] of Object.entries(latestByComponent)) {
      componentStatus[component] = metric.status;
    }

    // Determine overall health
    const statuses = Object.values(componentStatus);
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (statuses.includes('unhealthy')) {
      overallHealth = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallHealth = 'degraded';
    }

    return {
      componentStatus,
      averageMemoryUsage: memoryCount > 0 ? totalMemoryUsage / memoryCount : 0,
      averageCpuUsage: cpuCount > 0 ? totalCpuUsage / cpuCount : 0,
      overallHealth,
    };
  }

  /**
   * Dispose of the monitoring service and clean up resources
   * @returns void
   */
  dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.removeAllListeners();
    logger.info('Monitoring service disposed');
  }
}
