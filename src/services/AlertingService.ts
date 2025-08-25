import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { MonitoringConfig } from '../types/config.js';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Alert types
 */
export type AlertType =
  | 'security_threat'
  | 'performance_degradation'
  | 'system_health'
  | 'resource_usage'
  | 'error_rate'
  | 'conversion_failure';

/**
 * Alert interface
 */
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
  source: string;
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  enabled: boolean;
  conditions: AlertCondition[];
  severity: AlertSeverity;
  cooldownPeriod: number; // milliseconds
  lastTriggered?: Date;
  actions: AlertAction[];
}

/**
 * Alert condition
 */
export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  threshold: number | string;
  timeWindow?: number; // milliseconds
}

/**
 * Alert action
 */
export interface AlertAction {
  type: 'webhook' | 'email' | 'log' | 'slack';
  config: Record<string, any>;
  enabled: boolean;
}

/**
 * Webhook payload for alerts
 */
export interface WebhookPayload {
  alert: Alert;
  rule: AlertRule;
  timestamp: Date;
  environment: string;
}

/**
 * Alerting service for handling security threats and performance issues
 */
export class AlertingService extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private config: MonitoringConfig;
  private alertHistory: Alert[] = [];
  private maxHistorySize = 1000;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.initializeDefaultRules();
  }

  /**
   * Create a new alert
   */
  async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    metadata: Record<string, any> = {},
    source = 'system'
  ): Promise<Alert> {
    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      severity,
      title,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata,
      source,
    };

    this.alerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Trim history if needed
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
    }

    // Emit alert event
    this.emit('alert:created', alert);

    // Log the alert
    logger.logSecurityEvent(
      {
        event: 'threat_detected',
        severity: severity,
        details: metadata,
      },
      `Alert created: ${title}`,
      { alertId: alert.id, type, source }
    );

    // Execute alert actions
    await this.executeAlertActions(alert);

    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    if (resolvedBy) {
      alert.metadata.resolvedBy = resolvedBy;
    }

    this.emit('alert:resolved', alert);

    logger.info('Alert resolved', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      resolvedBy,
    });

    return true;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((alert) => !alert.resolved);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: AlertType): Alert[] {
    return Array.from(this.alerts.values()).filter((alert) => alert.type === type);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return Array.from(this.alerts.values()).filter((alert) => alert.severity === severity);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): Alert[] {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Add or update an alert rule
   */
  setAlertRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Alert rule updated', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info('Alert rule removed', { ruleId });
    }
    return removed;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Check if a metric triggers any alert rules
   */
  async checkAlertRules(metric: Record<string, any>): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (rule.lastTriggered && Date.now() - rule.lastTriggered.getTime() < rule.cooldownPeriod) {
        continue;
      }

      // Evaluate conditions
      if (await this.evaluateRule(rule, metric)) {
        await this.triggerRule(rule, metric);
      }
    }
  }

  /**
   * Create security threat alert
   */
  async createSecurityThreatAlert(
    threatType: string,
    fileName: string,
    severity: AlertSeverity,
    details: Record<string, any> = {}
  ): Promise<Alert> {
    return this.createAlert(
      'security_threat',
      severity,
      `Security Threat Detected: ${threatType}`,
      `A ${threatType} threat was detected in file: ${fileName}`,
      {
        threatType,
        fileName,
        ...details,
      },
      'security_scanner'
    );
  }

  /**
   * Create performance degradation alert
   */
  async createPerformanceDegradationAlert(
    operation: string,
    duration: number,
    threshold: number,
    details: Record<string, any> = {}
  ): Promise<Alert> {
    return this.createAlert(
      'performance_degradation',
      duration > threshold * 2 ? 'high' : 'medium',
      `Performance Degradation: ${operation}`,
      `Operation ${operation} took ${duration}ms, exceeding threshold of ${threshold}ms`,
      {
        operation,
        duration,
        threshold,
        ...details,
      },
      'performance_monitor'
    );
  }

  /**
   * Create system health alert
   */
  async createSystemHealthAlert(
    component: string,
    status: string,
    details: Record<string, any> = {}
  ): Promise<Alert> {
    const severity: AlertSeverity = status === 'unhealthy' ? 'high' : 'medium';

    return this.createAlert(
      'system_health',
      severity,
      `System Health Issue: ${component}`,
      `Component ${component} is ${status}`,
      {
        component,
        status,
        ...details,
      },
      'health_monitor'
    );
  }

  /**
   * Create resource usage alert
   */
  async createResourceUsageAlert(
    resource: string,
    usage: number,
    threshold: number,
    details: Record<string, any> = {}
  ): Promise<Alert> {
    const severity: AlertSeverity = usage > threshold * 1.5 ? 'high' : 'medium';

    return this.createAlert(
      'resource_usage',
      severity,
      `High Resource Usage: ${resource}`,
      `${resource} usage is ${usage}, exceeding threshold of ${threshold}`,
      {
        resource,
        usage,
        threshold,
        ...details,
      },
      'resource_monitor'
    );
  }

  /**
   * Execute alert actions
   */
  private async executeAlertActions(alert: Alert): Promise<void> {
    // Find matching rules and execute their actions
    for (const rule of this.rules.values()) {
      if (rule.type === alert.type) {
        for (const action of rule.actions) {
          if (action.enabled) {
            await this.executeAction(action, alert, rule);
          }
        }
      }
    }
  }

  /**
   * Execute a specific alert action
   */
  private async executeAction(action: AlertAction, alert: Alert, rule: AlertRule): Promise<void> {
    try {
      switch (action.type) {
        case 'webhook':
          await this.executeWebhookAction(action, alert, rule);
          break;
        case 'email':
          await this.executeEmailAction(action, alert, rule);
          break;
        case 'log':
          await this.executeLogAction(action, alert, rule);
          break;
        case 'slack':
          await this.executeSlackAction(action, alert, rule);
          break;
        default:
          logger.warn('Unknown alert action type', { actionType: action.type });
      }
    } catch (error) {
      logger.error('Failed to execute alert action', {
        actionType: action.type,
        alertId: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute webhook action
   */
  private async executeWebhookAction(
    action: AlertAction,
    alert: Alert,
    rule: AlertRule
  ): Promise<void> {
    const { url, headers = {}, timeout = 5000 } = action.config;

    if (!url) {
      logger.warn('Webhook action missing URL', { alertId: alert.id });
      return;
    }

    const payload: WebhookPayload = {
      alert,
      rule,
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
      }

      logger.info('Webhook alert sent successfully', {
        alertId: alert.id,
        url,
        status: response.status,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Execute email action (placeholder - would integrate with email service)
   */
  private async executeEmailAction(
    action: AlertAction,
    alert: Alert,
    _rule: AlertRule
  ): Promise<void> {
    const { to, subject, template } = action.config;

    logger.info('Email alert would be sent', {
      alertId: alert.id,
      to,
      subject: subject || `Alert: ${alert.title}`,
      template,
    });

    // In a real implementation, this would integrate with an email service
    // like SendGrid, AWS SES, or similar
  }

  /**
   * Execute log action
   */
  private async executeLogAction(
    action: AlertAction,
    alert: Alert,
    rule: AlertRule
  ): Promise<void> {
    const { level = 'warn' } = action.config;

    const validLevels = ['error', 'warn', 'info', 'debug'] as const;
    const logLevel = validLevels.includes(level as any) ? level : 'warn';

    logger[logLevel as keyof typeof logger]('Alert triggered', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      ruleId: rule.id,
    });
  }

  /**
   * Execute Slack action (placeholder - would integrate with Slack API)
   */
  private async executeSlackAction(
    action: AlertAction,
    alert: Alert,
    _rule: AlertRule
  ): Promise<void> {
    const { channel, webhookUrl, username = 'Mineport Alerts' } = action.config;

    logger.info('Slack alert would be sent', {
      alertId: alert.id,
      channel,
      webhookUrl: webhookUrl ? '[CONFIGURED]' : '[NOT CONFIGURED]',
      username,
    });

    // In a real implementation, this would send to Slack via webhook or API
  }

  /**
   * Evaluate if a rule should trigger based on metric data
   */
  private async evaluateRule(rule: AlertRule, metric: Record<string, any>): Promise<boolean> {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, metric)) {
        return false; // All conditions must be true
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: AlertCondition, metric: Record<string, any>): boolean {
    const value = this.getMetricValue(condition.metric, metric);
    if (value === undefined) return false;

    const threshold =
      typeof condition.threshold === 'string'
        ? parseFloat(condition.threshold)
        : condition.threshold;

    switch (condition.operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      case 'neq':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Extract metric value using dot notation
   */
  private getMetricValue(path: string, metric: Record<string, any>): number | undefined {
    const keys = path.split('.');
    let value = metric;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return typeof value === 'number' ? value : undefined;
  }

  /**
   * Trigger a rule and create an alert
   */
  private async triggerRule(rule: AlertRule, metric: Record<string, any>): Promise<void> {
    rule.lastTriggered = new Date();

    await this.createAlert(
      rule.type,
      rule.severity,
      `Rule Triggered: ${rule.name}`,
      `Alert rule "${rule.name}" was triggered`,
      {
        ruleId: rule.id,
        ruleName: rule.name,
        triggerMetric: metric,
      },
      'alert_rule'
    );
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'security_threat_critical',
        name: 'Critical Security Threat',
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
        cooldownPeriod: 60000, // 1 minute
        actions: [
          {
            type: 'webhook',
            config: {
              url: this.config.alertingWebhookUrl,
            },
            enabled: this.config.alertingEnabled,
          },
          {
            type: 'log',
            config: { level: 'error' },
            enabled: true,
          },
        ],
      },
      {
        id: 'performance_degradation_high',
        name: 'High Performance Degradation',
        type: 'performance_degradation',
        enabled: true,
        conditions: [
          {
            metric: 'duration',
            operator: 'gt',
            threshold: 30000, // 30 seconds
          },
        ],
        severity: 'high',
        cooldownPeriod: 300000, // 5 minutes
        actions: [
          {
            type: 'log',
            config: { level: 'warn' },
            enabled: true,
          },
        ],
      },
      {
        id: 'system_health_unhealthy',
        name: 'System Component Unhealthy',
        type: 'system_health',
        enabled: true,
        conditions: [
          {
            metric: 'status',
            operator: 'eq',
            threshold: 'unhealthy',
          },
        ],
        severity: 'high',
        cooldownPeriod: 300000, // 5 minutes
        actions: [
          {
            type: 'webhook',
            config: {
              url: this.config.alertingWebhookUrl,
            },
            enabled: this.config.alertingEnabled,
          },
          {
            type: 'log',
            config: { level: 'error' },
            enabled: true,
          },
        ],
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        type: 'resource_usage',
        enabled: true,
        conditions: [
          {
            metric: 'memoryUsage',
            operator: 'gt',
            threshold: 800, // MB
          },
        ],
        severity: 'medium',
        cooldownPeriod: 600000, // 10 minutes
        actions: [
          {
            type: 'log',
            config: { level: 'warn' },
            enabled: true,
          },
        ],
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }

    logger.info('Default alert rules initialized', { count: defaultRules.length });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.removeAllListeners();
    this.alerts.clear();
    this.rules.clear();
    this.alertHistory = [];
    logger.info('Alerting service disposed');
  }
}
