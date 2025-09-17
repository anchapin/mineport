#!/usr/bin/env node

/**
 * Alert Manager - Centralized alerting and notification system
 * Integrates with the MonitoringService to provide comprehensive alerting
 */

const fs = require('fs');
const path = require('path');
const { MonitoringService } = require('../src/services/MonitoringService.js');

class AlertManager {
  constructor() {
    this.alertRules = new Map();
    this.notificationChannels = new Map();
    this.alertHistory = [];
    this.cooldowns = new Map();

    this.loadConfiguration();
    this.setupDefaultRules();
    this.setupNotificationChannels();
  }

  loadConfiguration() {
    try {
      const configPath = path.join(__dirname, '..', 'config', 'monitoring.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.config = config;
        console.log('Alert manager configuration loaded');
      } else {
        console.warn('Monitoring configuration not found, using defaults');
        this.config = { alerts: { channels: {}, rules: [] } };
      }
    } catch (error) {
      console.error('Failed to load alert configuration:', error.message);
      this.config = { alerts: { channels: {}, rules: [] } };
    }
  }

  setupDefaultRules() {
    const defaultRules = [
      {
        id: 'pipeline_failure',
        name: 'Pipeline Failure',
        condition: {
          metric: 'pipeline_success_rate',
          operator: 'lt',
          threshold: 0.8,
          timeWindow: 3600000 // 1 hour
        },
        severity: 'critical',
        channels: ['slack', 'email'],
        cooldown: 1800000, // 30 minutes
        escalation: {
          enabled: true,
          delay: 900000, // 15 minutes
          channels: ['pagerduty']
        }
      },
      {
        id: 'deployment_failure',
        name: 'Deployment Failure',
        condition: {
          metric: 'deployment_success_rate',
          operator: 'lt',
          threshold: 0.9,
          timeWindow: 3600000
        },
        severity: 'critical',
        channels: ['slack', 'email', 'pagerduty'],
        cooldown: 300000, // 5 minutes
        escalation: {
          enabled: true,
          delay: 600000, // 10 minutes
          channels: ['oncall']
        }
      },
      {
        id: 'security_threat',
        name: 'Security Threat Detected',
        condition: {
          metric: 'security_threats',
          operator: 'gt',
          threshold: 0,
          timeWindow: 300000 // 5 minutes
        },
        severity: 'critical',
        channels: ['slack', 'email', 'security-team'],
        cooldown: 0, // No cooldown for security
        escalation: {
          enabled: true,
          delay: 300000, // 5 minutes
          channels: ['security-oncall']
        }
      },
      {
        id: 'performance_degradation',
        name: 'Performance Degradation',
        condition: {
          metric: 'response_time',
          operator: 'gt',
          threshold: 5000, // 5 seconds
          timeWindow: 900000 // 15 minutes
        },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 1800000, // 30 minutes
        escalation: {
          enabled: false
        }
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        condition: {
          metric: 'memory_usage_percent',
          operator: 'gt',
          threshold: 85,
          timeWindow: 600000 // 10 minutes
        },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 900000, // 15 minutes
        escalation: {
          enabled: true,
          delay: 1800000, // 30 minutes
          channels: ['email']
        }
      },
      {
        id: 'disk_space_low',
        name: 'Low Disk Space',
        condition: {
          metric: 'disk_usage_percent',
          operator: 'gt',
          threshold: 90,
          timeWindow: 300000 // 5 minutes
        },
        severity: 'critical',
        channels: ['slack', 'email'],
        cooldown: 600000, // 10 minutes
        escalation: {
          enabled: true,
          delay: 900000, // 15 minutes
          channels: ['pagerduty']
        }
      }
    ];

    // Load rules from configuration if available
    const configRules = this.config.alerts?.rules || [];
    const allRules = [...defaultRules, ...configRules];

    for (const rule of allRules) {
      this.alertRules.set(rule.id, rule);
    }

    console.log(`Loaded ${this.alertRules.size} alert rules`);
  }

  setupNotificationChannels() {
    const channels = {
      slack: {
        name: 'Slack',
        enabled: this.config.alerts?.channels?.slack?.enabled || false,
        webhook_url: process.env.SLACK_WEBHOOK_URL || this.config.alerts?.channels?.slack?.webhook_url,
        channel: this.config.alerts?.channels?.slack?.channel || '#alerts',
        username: this.config.alerts?.channels?.slack?.username || 'Alert Manager'
      },
      email: {
        name: 'Email',
        enabled: this.config.alerts?.channels?.email?.enabled || false,
        smtp_host: process.env.SMTP_HOST || this.config.alerts?.channels?.email?.smtp_host,
        smtp_port: process.env.SMTP_PORT || this.config.alerts?.channels?.email?.smtp_port || 587,
        from: process.env.ALERT_EMAIL_FROM || this.config.alerts?.channels?.email?.from,
        to: (process.env.ALERT_EMAIL_TO || this.config.alerts?.channels?.email?.to || '').split(',').filter(Boolean)
      },
      pagerduty: {
        name: 'PagerDuty',
        enabled: this.config.alerts?.channels?.pagerduty?.enabled || false,
        integration_key: process.env.PAGERDUTY_INTEGRATION_KEY || this.config.alerts?.channels?.pagerduty?.integration_key
      },
      webhook: {
        name: 'Webhook',
        enabled: !!process.env.MONITORING_WEBHOOK_URL,
        url: process.env.MONITORING_WEBHOOK_URL
      }
    };

    for (const [channelId, channelConfig] of Object.entries(channels)) {
      this.notificationChannels.set(channelId, channelConfig);
    }

    const enabledChannels = Array.from(this.notificationChannels.values())
      .filter(channel => channel.enabled)
      .map(channel => channel.name);

    console.log(`Configured notification channels: ${enabledChannels.join(', ')}`);
  }

  async processMetrics(metrics) {
    console.log('Processing metrics for alert evaluation...');

    const alerts = [];

    for (const [ruleId, rule] of this.alertRules) {
      try {
        const shouldAlert = await this.evaluateRule(rule, metrics);

        if (shouldAlert && !this.isInCooldown(ruleId)) {
          const alert = this.createAlert(rule, metrics);
          alerts.push(alert);

          // Update cooldown
          this.updateCooldown(ruleId, rule.cooldown);

          // Schedule escalation if enabled
          if (rule.escalation?.enabled) {
            setTimeout(() => {
              this.handleEscalation(alert, rule.escalation);
            }, rule.escalation.delay);
          }
        }
      } catch (error) {
        console.error(`Error evaluating rule ${ruleId}:`, error.message);
      }
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }

    // Update alert history
    this.alertHistory.push(...alerts);
    this.cleanupAlertHistory();

    return alerts;
  }

  async evaluateRule(rule, metrics) {
    const { condition } = rule;
    const metricValue = this.extractMetricValue(condition.metric, metrics);

    if (metricValue === null || metricValue === undefined) {
      return false;
    }

    // Evaluate condition
    switch (condition.operator) {
      case 'gt':
        return metricValue > condition.threshold;
      case 'gte':
        return metricValue >= condition.threshold;
      case 'lt':
        return metricValue < condition.threshold;
      case 'lte':
        return metricValue <= condition.threshold;
      case 'eq':
        return metricValue === condition.threshold;
      case 'ne':
        return metricValue !== condition.threshold;
      default:
        console.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  extractMetricValue(metricName, metrics) {
    // Extract metric value from various metric sources
    switch (metricName) {
      case 'pipeline_success_rate':
        return metrics.pipeline?.success_rate || null;
      case 'deployment_success_rate':
        return metrics.deployment?.success_rate || null;
      case 'security_threats':
        return metrics.security?.threats_detected || 0;
      case 'response_time':
        return metrics.performance?.response_time || null;
      case 'memory_usage_percent':
        return metrics.system?.memory_usage_percent || null;
      case 'disk_usage_percent':
        return metrics.system?.disk_usage_percent || null;
      case 'error_rate':
        return metrics.application?.error_rate || null;
      case 'cpu_usage':
        return metrics.system?.cpu_usage || null;
      default:
        // Try to find metric in nested structure
        return this.findNestedMetric(metricName, metrics);
    }
  }

  findNestedMetric(metricName, obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (key === metricName || currentPath === metricName) {
        return value;
      }

      if (typeof value === 'object' && value !== null) {
        const result = this.findNestedMetric(metricName, value, currentPath);
        if (result !== null) {
          return result;
        }
      }
    }

    return null;
  }

  createAlert(rule, metrics) {
    const metricValue = this.extractMetricValue(rule.condition.metric, metrics);

    return {
      id: `${rule.id}-${Date.now()}`,
      rule_id: rule.id,
      title: rule.name,
      message: this.generateAlertMessage(rule, metricValue),
      severity: rule.severity,
      timestamp: new Date().toISOString(),
      channels: rule.channels,
      metric: {
        name: rule.condition.metric,
        value: metricValue,
        threshold: rule.condition.threshold,
        operator: rule.condition.operator
      },
      metadata: {
        rule: rule,
        metrics: metrics,
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }

  generateAlertMessage(rule, metricValue) {
    const { condition } = rule;
    const operatorText = {
      'gt': 'greater than',
      'gte': 'greater than or equal to',
      'lt': 'less than',
      'lte': 'less than or equal to',
      'eq': 'equal to',
      'ne': 'not equal to'
    }[condition.operator] || condition.operator;

    return `${rule.name}: ${condition.metric} is ${metricValue} (${operatorText} threshold of ${condition.threshold})`;
  }

  isInCooldown(ruleId) {
    const cooldownEnd = this.cooldowns.get(ruleId);
    return cooldownEnd && Date.now() < cooldownEnd;
  }

  updateCooldown(ruleId, cooldownDuration) {
    if (cooldownDuration > 0) {
      this.cooldowns.set(ruleId, Date.now() + cooldownDuration);
    }
  }

  async sendAlert(alert) {
    console.log(`Sending alert: ${alert.title}`);

    const results = await Promise.allSettled(
      alert.channels.map(channelId => this.sendToChannel(channelId, alert))
    );

    // Log results
    results.forEach((result, index) => {
      const channelId = alert.channels[index];
      if (result.status === 'fulfilled') {
        console.log(`✅ Alert sent to ${channelId}`);
      } else {
        console.error(`❌ Failed to send alert to ${channelId}:`, result.reason.message);
      }
    });
  }

  async sendToChannel(channelId, alert) {
    const channel = this.notificationChannels.get(channelId);

    if (!channel || !channel.enabled) {
      throw new Error(`Channel ${channelId} is not configured or disabled`);
    }

    switch (channelId) {
      case 'slack':
        return this.sendSlackAlert(alert, channel);
      case 'email':
        return this.sendEmailAlert(alert, channel);
      case 'pagerduty':
        return this.sendPagerDutyAlert(alert, channel);
      case 'webhook':
        return this.sendWebhookAlert(alert, channel);
      default:
        throw new Error(`Unknown channel: ${channelId}`);
    }
  }

  async sendSlackAlert(alert, channel) {
    if (!channel.webhook_url) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = {
      'critical': '#ff0000',
      'warning': '#ffaa00',
      'info': '#0099ff'
    }[alert.severity] || '#cccccc';

    const payload = {
      username: channel.username,
      channel: channel.channel,
      icon_emoji: ':warning:',
      attachments: [{
        color: color,
        title: alert.title,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Metric',
            value: alert.metric.name,
            short: true
          },
          {
            title: 'Value',
            value: alert.metric.value.toString(),
            short: true
          },
          {
            title: 'Threshold',
            value: alert.metric.threshold.toString(),
            short: true
          },
          {
            title: 'Environment',
            value: alert.metadata.environment,
            short: true
          },
          {
            title: 'Timestamp',
            value: alert.timestamp,
            short: true
          }
        ],
        footer: 'Alert Manager',
        ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
      }]
    };

    const response = await fetch(channel.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  async sendEmailAlert(alert, channel) {
    // This is a placeholder for email integration
    // In a real implementation, you would use nodemailer or similar
    console.log(`📧 Email alert would be sent to: ${channel.to.join(', ')}`);
    console.log(`Subject: [${alert.severity.toUpperCase()}] ${alert.title}`);
    console.log(`Body: ${alert.message}`);

    // For now, just log the email content
    return Promise.resolve();
  }

  async sendPagerDutyAlert(alert, channel) {
    if (!channel.integration_key) {
      throw new Error('PagerDuty integration key not configured');
    }

    const payload = {
      routing_key: channel.integration_key,
      event_action: 'trigger',
      dedup_key: alert.id,
      payload: {
        summary: alert.title,
        source: 'Alert Manager',
        severity: alert.severity === 'critical' ? 'critical' : 'warning',
        component: alert.metric.name,
        group: 'CI/CD Pipeline',
        class: alert.rule_id,
        custom_details: {
          message: alert.message,
          metric_value: alert.metric.value,
          threshold: alert.metric.threshold,
          environment: alert.metadata.environment,
          timestamp: alert.timestamp
        }
      }
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`PagerDuty API failed: ${response.status} ${response.statusText}`);
    }
  }

  async sendWebhookAlert(alert, channel) {
    if (!channel.url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      type: 'alert',
      alert: alert,
      timestamp: new Date().toISOString(),
      source: 'Alert Manager'
    };

    const response = await fetch(channel.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  async handleEscalation(alert, escalationConfig) {
    console.log(`🚨 Escalating alert: ${alert.title}`);

    const escalatedAlert = {
      ...alert,
      id: `${alert.id}-escalated`,
      title: `[ESCALATED] ${alert.title}`,
      message: `ESCALATED: ${alert.message}`,
      channels: escalationConfig.channels,
      severity: 'critical'
    };

    await this.sendAlert(escalatedAlert);
  }

  cleanupAlertHistory() {
    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    // Clean up old cooldowns
    const now = Date.now();
    for (const [ruleId, cooldownEnd] of this.cooldowns.entries()) {
      if (now >= cooldownEnd) {
        this.cooldowns.delete(ruleId);
      }
    }
  }

  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }

  getActiveAlerts() {
    const now = Date.now();
    const activeWindow = 24 * 60 * 60 * 1000; // 24 hours

    return this.alertHistory.filter(alert => {
      const alertTime = new Date(alert.timestamp).getTime();
      return (now - alertTime) < activeWindow;
    });
  }

  addAlertRule(rule) {
    this.alertRules.set(rule.id, rule);
    console.log(`Added alert rule: ${rule.id}`);
  }

  removeAlertRule(ruleId) {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      console.log(`Removed alert rule: ${ruleId}`);
    }
    return removed;
  }

  updateAlertRule(ruleId, updates) {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      const updatedRule = { ...rule, ...updates };
      this.alertRules.set(ruleId, updatedRule);
      console.log(`Updated alert rule: ${ruleId}`);
      return updatedRule;
    }
    return null;
  }

  getAlertRules() {
    return Array.from(this.alertRules.values());
  }

  generateReport() {
    const activeAlerts = this.getActiveAlerts();
    const alertsByRule = {};
    const alertsBySeverity = { critical: 0, warning: 0, info: 0 };

    for (const alert of activeAlerts) {
      alertsByRule[alert.rule_id] = (alertsByRule[alert.rule_id] || 0) + 1;
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_rules: this.alertRules.size,
        active_alerts: activeAlerts.length,
        alerts_by_severity: alertsBySeverity,
        alerts_by_rule: alertsByRule
      },
      active_alerts: activeAlerts,
      configured_channels: Array.from(this.notificationChannels.keys()),
      enabled_channels: Array.from(this.notificationChannels.values())
        .filter(channel => channel.enabled)
        .map(channel => channel.name)
    };

    return report;
  }
}

// CLI interface
if (require.main === module) {
  const alertManager = new AlertManager();

  const command = process.argv[2];

  switch (command) {
    case 'test':
      // Test alert functionality
      const testMetrics = {
        pipeline: { success_rate: 0.7 },
        system: { memory_usage_percent: 90 },
        security: { threats_detected: 1 }
      };

      alertManager.processMetrics(testMetrics)
        .then(alerts => {
          console.log(`Generated ${alerts.length} test alerts`);
          process.exit(0);
        })
        .catch(error => {
          console.error('Test failed:', error);
          process.exit(1);
        });
      break;

    case 'report':
      const report = alertManager.generateReport();
      console.log(JSON.stringify(report, null, 2));
      break;

    case 'rules':
      const rules = alertManager.getAlertRules();
      console.log('Alert Rules:');
      rules.forEach(rule => {
        console.log(`- ${rule.id}: ${rule.name} (${rule.severity})`);
      });
      break;

    case 'history':
      const limit = parseInt(process.argv[3]) || 10;
      const history = alertManager.getAlertHistory(limit);
      console.log(`Last ${history.length} alerts:`);
      history.forEach(alert => {
        console.log(`- ${alert.timestamp}: ${alert.title} (${alert.severity})`);
      });
      break;

    default:
      console.log('Usage: alert-manager.js <command>');
      console.log('Commands:');
      console.log('  test     - Test alert functionality');
      console.log('  report   - Generate alert report');
      console.log('  rules    - List alert rules');
      console.log('  history  - Show alert history');
      break;
  }
}

module.exports = { AlertManager };
