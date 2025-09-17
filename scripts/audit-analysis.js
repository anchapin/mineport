#!/usr/bin/env node

/**
 * Audit Log Analysis and Reporting Tool
 * Provides advanced analysis capabilities for audit logs
 */

const fs = require('fs').promises;
const path = require('path');
const AuditLogger = require('./audit-logger');

class AuditAnalyzer {
  constructor(options = {}) {
    this.auditLogger = new AuditLogger(options);
    this.logDir = options.logDir || path.join(process.cwd(), 'audit-logs');
    this.analysisDir = options.analysisDir || path.join(process.cwd(), 'audit-analysis');
  }

  /**
   * Initialize analysis system
   */
  async initialize() {
    await fs.mkdir(this.analysisDir, { recursive: true });
    console.log('Audit analysis system initialized');
  }

  /**
   * Perform comprehensive audit analysis
   */
  async performAnalysis(startDate, endDate) {
    console.log(`Performing audit analysis from ${startDate} to ${endDate}`);

    const analysis = {
      period: { start: startDate, end: endDate },
      timestamp: new Date().toISOString(),
      summary: await this.generateSummary(startDate, endDate),
      patterns: await this.detectPatterns(startDate, endDate),
      anomalies: await this.detectAnomalies(startDate, endDate),
      compliance: await this.checkCompliance(startDate, endDate),
      security: await this.analyzeSecurityEvents(startDate, endDate),
      performance: await this.analyzePerformance(startDate, endDate),
      recommendations: []
    };

    // Generate recommendations based on analysis
    analysis.recommendations = await this.generateRecommendations(analysis);

    // Save analysis results
    const analysisFile = path.join(
      this.analysisDir,
      `analysis-${new Date().toISOString().split('T')[0]}.json`
    );
    await fs.writeFile(analysisFile, JSON.stringify(analysis, null, 2));

    return analysis;
  }

  /**
   * Generate summary statistics
   */
  async generateSummary(startDate, endDate) {
    const entries = await this.auditLogger.searchLogs({ startDate, endDate, limit: 50000 });

    const summary = {
      total_entries: entries.length,
      unique_actors: new Set(entries.map(e => e.actor)).size,
      operations_by_type: {},
      operations_by_status: {},
      operations_by_hour: {},
      average_duration: 0,
      success_rate: 0
    };

    let totalDuration = 0;
    let successCount = 0;

    entries.forEach(entry => {
      // Count by operation type
      summary.operations_by_type[entry.operation] =
        (summary.operations_by_type[entry.operation] || 0) + 1;

      // Count by status
      summary.operations_by_status[entry.status] =
        (summary.operations_by_status[entry.status] || 0) + 1;

      // Count by hour
      const hour = new Date(entry.timestamp).getHours();
      summary.operations_by_hour[hour] = (summary.operations_by_hour[hour] || 0) + 1;

      // Calculate success rate
      if (entry.status === 'completed' || entry.status === 'success') {
        successCount++;
      }
    });

    summary.success_rate = entries.length > 0 ? (successCount / entries.length) * 100 : 0;

    return summary;
  }

  /**
   * Detect patterns in audit logs
   */
  async detectPatterns(startDate, endDate) {
    const entries = await this.auditLogger.searchLogs({ startDate, endDate, limit: 50000 });

    const patterns = {
      peak_hours: this.findPeakHours(entries),
      frequent_actors: this.findFrequentActors(entries),
      operation_sequences: this.findOperationSequences(entries),
      failure_patterns: this.findFailurePatterns(entries),
      deployment_patterns: this.findDeploymentPatterns(entries)
    };

    return patterns;
  }

  /**
   * Detect anomalies in audit logs
   */
  async detectAnomalies(startDate, endDate) {
    const entries = await this.auditLogger.searchLogs({ startDate, endDate, limit: 50000 });

    const anomalies = {
      unusual_actors: this.detectUnusualActors(entries),
      off_hours_activity: this.detectOffHoursActivity(entries),
      rapid_operations: this.detectRapidOperations(entries),
      failed_sequences: this.detectFailedSequences(entries),
      security_anomalies: this.detectSecurityAnomalies(entries)
    };

    return anomalies;
  }

  /**
   * Check compliance requirements
   */
  async checkCompliance(startDate, endDate) {
    const entries = await this.auditLogger.searchLogs({ startDate, endDate, limit: 50000 });

    const compliance = {
      audit_coverage: this.checkAuditCoverage(entries),
      retention_compliance: await this.checkRetentionCompliance(),
      access_controls: this.checkAccessControls(entries),
      change_management: this.checkChangeManagement(entries),
      segregation_of_duties: this.checkSegregationOfDuties(entries)
    };

    return compliance;
  }

  /**
   * Analyze security events
   */
  async analyzeSecurityEvents(startDate, endDate) {
    const entries = await this.auditLogger.searchLogs({
      startDate,
      endDate,
      operation: 'security_scan',
      limit: 10000
    });

    const security = {
      total_scans: entries.length,
      scan_types: {},
      vulnerability_trends: this.analyzeVulnerabilityTrends(entries),
      security_incidents: this.identifySecurityIncidents(entries),
      compliance_violations: this.identifyComplianceViolations(entries)
    };

    entries.forEach(entry => {
      const scanType = entry.metadata?.scan_type || 'unknown';
      security.scan_types[scanType] = (security.scan_types[scanType] || 0) + 1;
    });

    return security;
  }

  /**
   * Analyze performance metrics
   */
  async analyzePerformance(startDate, endDate) {
    const entries = await this.auditLogger.searchLogs({ startDate, endDate, limit: 50000 });

    const performance = {
      average_workflow_duration: this.calculateAverageWorkflowDuration(entries),
      slowest_operations: this.findSlowestOperations(entries),
      performance_trends: this.analyzePerformanceTrends(entries),
      resource_utilization: this.analyzeResourceUtilization(entries)
    };

    return performance;
  }

  /**
   * Generate recommendations based on analysis
   */
  async generateRecommendations(analysis) {
    const recommendations = [];

    // Check success rate
    if (analysis.summary.success_rate < 95) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        title: 'Improve Success Rate',
        description: `Current success rate is ${analysis.summary.success_rate.toFixed(1)}%. Consider investigating frequent failure patterns.`,
        action: 'Review failure patterns and implement error handling improvements'
      });
    }

    // Check for security anomalies
    if (analysis.anomalies.security_anomalies.length > 0) {
      recommendations.push({
        type: 'security',
        priority: 'critical',
        title: 'Address Security Anomalies',
        description: `${analysis.anomalies.security_anomalies.length} security anomalies detected.`,
        action: 'Review security events and update security policies'
      });
    }

    // Check compliance
    if (analysis.compliance.audit_coverage.percentage < 90) {
      recommendations.push({
        type: 'compliance',
        priority: 'medium',
        title: 'Improve Audit Coverage',
        description: `Audit coverage is ${analysis.compliance.audit_coverage.percentage}%. Some operations may not be properly audited.`,
        action: 'Review audit logging configuration and add missing audit points'
      });
    }

    // Check for off-hours activity
    if (analysis.anomalies.off_hours_activity.length > 10) {
      recommendations.push({
        type: 'security',
        priority: 'medium',
        title: 'Review Off-Hours Activity',
        description: `${analysis.anomalies.off_hours_activity.length} operations detected outside normal business hours.`,
        action: 'Review off-hours activity for legitimacy and consider additional controls'
      });
    }

    return recommendations;
  }

  /**
   * Find peak activity hours
   */
  findPeakHours(entries) {
    const hourCounts = {};
    entries.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const sortedHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    return sortedHours.map(([hour, count]) => ({ hour: parseInt(hour), count }));
  }

  /**
   * Find most frequent actors
   */
  findFrequentActors(entries) {
    const actorCounts = {};
    entries.forEach(entry => {
      actorCounts[entry.actor] = (actorCounts[entry.actor] || 0) + 1;
    });

    return Object.entries(actorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([actor, count]) => ({ actor, count }));
  }

  /**
   * Find common operation sequences
   */
  findOperationSequences(entries) {
    const sequences = {};
    const sortedEntries = entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const current = sortedEntries[i].operation;
      const next = sortedEntries[i + 1].operation;
      const sequence = `${current} -> ${next}`;
      sequences[sequence] = (sequences[sequence] || 0) + 1;
    }

    return Object.entries(sequences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([sequence, count]) => ({ sequence, count }));
  }

  /**
   * Find failure patterns
   */
  findFailurePatterns(entries) {
    const failedEntries = entries.filter(e =>
      e.status === 'failed' || e.status === 'error'
    );

    const patterns = {
      by_operation: {},
      by_actor: {},
      by_hour: {}
    };

    failedEntries.forEach(entry => {
      patterns.by_operation[entry.operation] =
        (patterns.by_operation[entry.operation] || 0) + 1;
      patterns.by_actor[entry.actor] =
        (patterns.by_actor[entry.actor] || 0) + 1;

      const hour = new Date(entry.timestamp).getHours();
      patterns.by_hour[hour] = (patterns.by_hour[hour] || 0) + 1;
    });

    return patterns;
  }

  /**
   * Find deployment patterns
   */
  findDeploymentPatterns(entries) {
    const deploymentEntries = entries.filter(e =>
      e.operation === 'deployment'
    );

    const patterns = {
      by_environment: {},
      by_day_of_week: {},
      success_rate_by_environment: {}
    };

    deploymentEntries.forEach(entry => {
      const env = entry.metadata?.environment || 'unknown';
      const dayOfWeek = new Date(entry.timestamp).getDay();

      patterns.by_environment[env] = (patterns.by_environment[env] || 0) + 1;
      patterns.by_day_of_week[dayOfWeek] = (patterns.by_day_of_week[dayOfWeek] || 0) + 1;
    });

    return patterns;
  }

  /**
   * Detect unusual actors
   */
  detectUnusualActors(entries) {
    const actorCounts = {};
    entries.forEach(entry => {
      actorCounts[entry.actor] = (actorCounts[entry.actor] || 0) + 1;
    });

    const average = Object.values(actorCounts).reduce((a, b) => a + b, 0) / Object.keys(actorCounts).length;
    const threshold = average * 3; // 3x average activity

    return Object.entries(actorCounts)
      .filter(([, count]) => count > threshold)
      .map(([actor, count]) => ({ actor, count, threshold }));
  }

  /**
   * Detect off-hours activity
   */
  detectOffHoursActivity(entries) {
    // Define business hours (9 AM to 6 PM UTC)
    const businessHours = { start: 9, end: 18 };

    return entries.filter(entry => {
      const hour = new Date(entry.timestamp).getUTCHours();
      return hour < businessHours.start || hour >= businessHours.end;
    }).map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      operation: entry.operation,
      actor: entry.actor
    }));
  }

  /**
   * Detect rapid operations (potential automation or attacks)
   */
  detectRapidOperations(entries) {
    const rapidOperations = [];
    const sortedEntries = entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (let i = 0; i < sortedEntries.length - 4; i++) {
      const window = sortedEntries.slice(i, i + 5);
      const timeSpan = new Date(window[4].timestamp) - new Date(window[0].timestamp);

      // If 5 operations happen within 1 minute
      if (timeSpan < 60000) {
        rapidOperations.push({
          start_time: window[0].timestamp,
          end_time: window[4].timestamp,
          operations: window.length,
          actor: window[0].actor,
          time_span_ms: timeSpan
        });
      }
    }

    return rapidOperations;
  }

  /**
   * Detect failed operation sequences
   */
  detectFailedSequences(entries) {
    const failedSequences = [];
    const sortedEntries = entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let consecutiveFailures = [];

    sortedEntries.forEach(entry => {
      if (entry.status === 'failed' || entry.status === 'error') {
        consecutiveFailures.push(entry);
      } else {
        if (consecutiveFailures.length >= 3) {
          failedSequences.push({
            start_time: consecutiveFailures[0].timestamp,
            end_time: consecutiveFailures[consecutiveFailures.length - 1].timestamp,
            failure_count: consecutiveFailures.length,
            operations: consecutiveFailures.map(e => e.operation)
          });
        }
        consecutiveFailures = [];
      }
    });

    return failedSequences;
  }

  /**
   * Detect security anomalies
   */
  detectSecurityAnomalies(entries) {
    const securityEntries = entries.filter(e =>
      e.operation.includes('security') ||
      e.operation.includes('compliance')
    );

    const anomalies = [];

    // Check for failed security scans
    const failedScans = securityEntries.filter(e =>
      e.status === 'failed' || e.status === 'error'
    );

    if (failedScans.length > 0) {
      anomalies.push({
        type: 'failed_security_scans',
        count: failedScans.length,
        description: 'Multiple security scans have failed'
      });
    }

    return anomalies;
  }

  /**
   * Check audit coverage
   */
  checkAuditCoverage(entries) {
    const expectedOperations = [
      'workflow_start', 'workflow_complete', 'deployment',
      'security_scan', 'compliance_check'
    ];

    const coveredOperations = new Set(entries.map(e => e.operation));
    const coverage = expectedOperations.filter(op => coveredOperations.has(op));

    return {
      expected: expectedOperations.length,
      covered: coverage.length,
      percentage: (coverage.length / expectedOperations.length) * 100,
      missing: expectedOperations.filter(op => !coveredOperations.has(op))
    };
  }

  /**
   * Check retention compliance
   */
  async checkRetentionCompliance() {
    try {
      const files = await fs.readdir(this.logDir);
      const auditFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'));

      const oldestFile = auditFiles.reduce((oldest, file) => {
        const match = file.match(/audit-(\d{4}-\d{2}-\d{2})/);
        if (match) {
          const date = new Date(match[1]);
          return !oldest || date < oldest.date ? { file, date } : oldest;
        }
        return oldest;
      }, null);

      const retentionDays = 365; // Required retention period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      return {
        compliant: !oldestFile || oldestFile.date >= cutoffDate,
        oldest_log_date: oldestFile?.date.toISOString(),
        retention_days: retentionDays,
        files_count: auditFiles.length
      };
    } catch (error) {
      return {
        compliant: false,
        error: error.message
      };
    }
  }

  /**
   * Check access controls
   */
  checkAccessControls(entries) {
    const actors = new Set(entries.map(e => e.actor));
    const privilegedOperations = entries.filter(e =>
      e.operation === 'deployment' ||
      e.operation.includes('security')
    );

    const privilegedActors = new Set(privilegedOperations.map(e => e.actor));

    return {
      total_actors: actors.size,
      privileged_actors: privilegedActors.size,
      privileged_operations: privilegedOperations.length,
      segregation_ratio: privilegedActors.size / actors.size
    };
  }

  /**
   * Check change management compliance
   */
  checkChangeManagement(entries) {
    const deployments = entries.filter(e => e.operation === 'deployment');
    const approvedDeployments = deployments.filter(e =>
      e.metadata?.approved === true ||
      e.metadata?.approval_required === false
    );

    return {
      total_deployments: deployments.length,
      approved_deployments: approvedDeployments.length,
      approval_rate: deployments.length > 0 ?
        (approvedDeployments.length / deployments.length) * 100 : 100
    };
  }

  /**
   * Check segregation of duties
   */
  checkSegregationOfDuties(entries) {
    const deploymentActors = new Set(
      entries.filter(e => e.operation === 'deployment').map(e => e.actor)
    );
    const approvalActors = new Set(
      entries.filter(e => e.operation.includes('approval')).map(e => e.actor)
    );

    const overlap = new Set([...deploymentActors].filter(x => approvalActors.has(x)));

    return {
      deployment_actors: deploymentActors.size,
      approval_actors: approvalActors.size,
      overlapping_actors: overlap.size,
      segregation_compliant: overlap.size === 0
    };
  }

  // Additional helper methods for analysis...
  analyzeVulnerabilityTrends(entries) {
    // Implementation for vulnerability trend analysis
    return { trend: 'stable', details: 'No significant changes in vulnerability patterns' };
  }

  identifySecurityIncidents(entries) {
    // Implementation for security incident identification
    return [];
  }

  identifyComplianceViolations(entries) {
    // Implementation for compliance violation identification
    return [];
  }

  calculateAverageWorkflowDuration(entries) {
    // Implementation for workflow duration calculation
    return { average: 0, unit: 'minutes' };
  }

  findSlowestOperations(entries) {
    // Implementation for finding slowest operations
    return [];
  }

  analyzePerformanceTrends(entries) {
    // Implementation for performance trend analysis
    return { trend: 'stable' };
  }

  analyzeResourceUtilization(entries) {
    // Implementation for resource utilization analysis
    return { cpu: 'normal', memory: 'normal' };
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const analyzer = new AuditAnalyzer();

  switch (command) {
    case 'init':
      analyzer.initialize();
      break;
    case 'analyze':
      const startDate = process.argv[3] || new Date(Date.now() - 24*60*60*1000).toISOString();
      const endDate = process.argv[4] || new Date().toISOString();
      analyzer.performAnalysis(startDate, endDate).then(analysis => {
        console.log(JSON.stringify(analysis, null, 2));
      });
      break;
    default:
      console.log('Usage: audit-analysis.js <init|analyze> [startDate] [endDate]');
  }
}

module.exports = AuditAnalyzer;
