#!/usr/bin/env node

/**
 * Audit Logger for CI/CD Operations
 * Provides comprehensive logging for all workflow executions with timestamps and actors
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AuditLogger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(process.cwd(), 'audit-logs');
    this.retentionDays = options.retentionDays || 365;
    this.maxLogSize = options.maxLogSize || 100 * 1024 * 1024; // 100MB
    this.enableEncryption = options.enableEncryption || false;
    this.encryptionKey = options.encryptionKey || process.env.AUDIT_ENCRYPTION_KEY;
  }

  /**
   * Initialize audit logging system
   */
  async initialize() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      await this.createIndexFile();
      await this.cleanupOldLogs();
      console.log('Audit logging system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audit logging system:', error);
      throw error;
    }
  }

  /**
   * Log a CI/CD operation with comprehensive metadata
   */
  async logOperation(operation) {
    const auditEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      operation: operation.type,
      actor: this.getActor(),
      repository: this.getRepository(),
      branch: this.getBranch(),
      commit: this.getCommit(),
      workflow: this.getWorkflow(),
      job: this.getJob(),
      step: this.getStep(),
      status: operation.status,
      duration: operation.duration,
      metadata: operation.metadata || {},
      environment: this.getEnvironmentInfo(),
      security: this.getSecurityContext(),
      compliance: this.getComplianceInfo()
    };

    try {
      await this.writeAuditEntry(auditEntry);
      await this.updateIndex(auditEntry);
      console.log(`Audit entry logged: ${auditEntry.id}`);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      throw error;
    }
  }

  /**
   * Log workflow start event
   */
  async logWorkflowStart(workflowName, trigger) {
    await this.logOperation({
      type: 'workflow_start',
      status: 'started',
      metadata: {
        workflow_name: workflowName,
        trigger_event: trigger.event,
        trigger_ref: trigger.ref,
        trigger_actor: trigger.actor
      }
    });
  }

  /**
   * Log workflow completion event
   */
  async logWorkflowComplete(workflowName, status, duration) {
    await this.logOperation({
      type: 'workflow_complete',
      status: status,
      duration: duration,
      metadata: {
        workflow_name: workflowName
      }
    });
  }

  /**
   * Log deployment event
   */
  async logDeployment(environment, status, metadata = {}) {
    await this.logOperation({
      type: 'deployment',
      status: status,
      metadata: {
        environment: environment,
        deployment_id: metadata.deploymentId,
        strategy: metadata.strategy,
        artifacts: metadata.artifacts,
        health_checks: metadata.healthChecks
      }
    });
  }

  /**
   * Log security scan event
   */
  async logSecurityScan(scanType, status, results) {
    await this.logOperation({
      type: 'security_scan',
      status: status,
      metadata: {
        scan_type: scanType,
        vulnerabilities_found: results.vulnerabilities?.length || 0,
        severity_breakdown: results.severityBreakdown,
        scan_duration: results.duration,
        tools_used: results.tools
      }
    });
  }

  /**
   * Log compliance check event
   */
  async logComplianceCheck(checkType, status, results) {
    await this.logOperation({
      type: 'compliance_check',
      status: status,
      metadata: {
        check_type: checkType,
        policies_evaluated: results.policies,
        violations_found: results.violations?.length || 0,
        compliance_score: results.score
      }
    });
  }

  /**
   * Generate unique audit entry ID
   */
  generateId() {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get actor information from GitHub context
   */
  getActor() {
    return {
      username: process.env.GITHUB_ACTOR,
      type: process.env.GITHUB_ACTOR_ID ? 'user' : 'system',
      id: process.env.GITHUB_ACTOR_ID,
      email: process.env.GITHUB_ACTOR_EMAIL || null
    };
  }

  /**
   * Get repository information
   */
  getRepository() {
    return {
      name: process.env.GITHUB_REPOSITORY,
      owner: process.env.GITHUB_REPOSITORY_OWNER,
      url: `https://github.com/${process.env.GITHUB_REPOSITORY}`
    };
  }

  /**
   * Get branch information
   */
  getBranch() {
    return {
      name: process.env.GITHUB_REF_NAME,
      ref: process.env.GITHUB_REF,
      protected: process.env.GITHUB_REF_PROTECTED === 'true'
    };
  }

  /**
   * Get commit information
   */
  getCommit() {
    return {
      sha: process.env.GITHUB_SHA,
      message: process.env.GITHUB_EVENT_HEAD_COMMIT_MESSAGE,
      author: process.env.GITHUB_EVENT_HEAD_COMMIT_AUTHOR_NAME,
      url: `https://github.com/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`
    };
  }

  /**
   * Get workflow information
   */
  getWorkflow() {
    return {
      name: process.env.GITHUB_WORKFLOW,
      run_id: process.env.GITHUB_RUN_ID,
      run_number: process.env.GITHUB_RUN_NUMBER,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT,
      url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    };
  }

  /**
   * Get job information
   */
  getJob() {
    return {
      name: process.env.GITHUB_JOB,
      status: process.env.GITHUB_JOB_STATUS || 'running'
    };
  }

  /**
   * Get step information
   */
  getStep() {
    return {
      name: process.env.GITHUB_STEP_NAME || 'unknown',
      summary: process.env.GITHUB_STEP_SUMMARY || null
    };
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo() {
    return {
      runner_os: process.env.RUNNER_OS,
      runner_arch: process.env.RUNNER_ARCH,
      runner_name: process.env.RUNNER_NAME,
      node_version: process.version,
      github_server_url: process.env.GITHUB_SERVER_URL,
      github_api_url: process.env.GITHUB_API_URL
    };
  }

  /**
   * Get security context information
   */
  getSecurityContext() {
    return {
      token_permissions: process.env.GITHUB_TOKEN_PERMISSIONS,
      event_name: process.env.GITHUB_EVENT_NAME,
      event_path: process.env.GITHUB_EVENT_PATH,
      workspace: process.env.GITHUB_WORKSPACE,
      retention_days: process.env.GITHUB_RETENTION_DAYS
    };
  }

  /**
   * Get compliance information
   */
  getComplianceInfo() {
    return {
      required_checks: process.env.REQUIRED_STATUS_CHECKS?.split(',') || [],
      branch_protection: process.env.GITHUB_REF_PROTECTED === 'true',
      signed_commits: process.env.REQUIRE_SIGNED_COMMITS === 'true',
      audit_required: true
    };
  }

  /**
   * Write audit entry to file
   */
  async writeAuditEntry(entry) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `audit-${date}.jsonl`);

    let logData = JSON.stringify(entry) + '\n';

    if (this.enableEncryption && this.encryptionKey) {
      logData = this.encrypt(logData);
    }

    await fs.appendFile(logFile, logData);

    // Check file size and rotate if necessary
    const stats = await fs.stat(logFile);
    if (stats.size > this.maxLogSize) {
      await this.rotateLogFile(logFile);
    }
  }

  /**
   * Update audit index for fast searching
   */
  async updateIndex(entry) {
    const indexFile = path.join(this.logDir, 'audit-index.json');
    let index = {};

    try {
      const indexData = await fs.readFile(indexFile, 'utf8');
      index = JSON.parse(indexData);
    } catch (error) {
      // Index file doesn't exist or is corrupted, create new one
      index = { entries: [], operations: {}, actors: {}, repositories: {} };
    }

    // Add entry to index
    index.entries.push({
      id: entry.id,
      timestamp: entry.timestamp,
      operation: entry.operation,
      actor: entry.actor.username,
      status: entry.status
    });

    // Update operation counts
    index.operations[entry.operation] = (index.operations[entry.operation] || 0) + 1;

    // Update actor counts
    index.actors[entry.actor.username] = (index.actors[entry.actor.username] || 0) + 1;

    // Update repository counts
    index.repositories[entry.repository.name] = (index.repositories[entry.repository.name] || 0) + 1;

    // Keep only last 10000 entries in index for performance
    if (index.entries.length > 10000) {
      index.entries = index.entries.slice(-10000);
    }

    await fs.writeFile(indexFile, JSON.stringify(index, null, 2));
  }

  /**
   * Create initial index file
   */
  async createIndexFile() {
    const indexFile = path.join(this.logDir, 'audit-index.json');
    try {
      await fs.access(indexFile);
    } catch (error) {
      const initialIndex = {
        created: new Date().toISOString(),
        entries: [],
        operations: {},
        actors: {},
        repositories: {}
      };
      await fs.writeFile(indexFile, JSON.stringify(initialIndex, null, 2));
    }
  }

  /**
   * Rotate log file when it gets too large
   */
  async rotateLogFile(logFile) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = logFile.replace('.jsonl', `-${timestamp}.jsonl`);
    await fs.rename(logFile, rotatedFile);
    console.log(`Log file rotated: ${rotatedFile}`);
  }

  /**
   * Clean up old log files based on retention policy
   */
  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      for (const file of files) {
        if (file.startsWith('audit-') && file.endsWith('.jsonl')) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            console.log(`Deleted old audit log: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }

  /**
   * Encrypt sensitive audit data
   */
  encrypt(data) {
    if (!this.encryptionKey) return data;

    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Search audit logs
   */
  async searchLogs(criteria) {
    const indexFile = path.join(this.logDir, 'audit-index.json');
    try {
      const indexData = await fs.readFile(indexFile, 'utf8');
      const index = JSON.parse(indexData);

      let results = index.entries;

      if (criteria.operation) {
        results = results.filter(entry => entry.operation === criteria.operation);
      }

      if (criteria.actor) {
        results = results.filter(entry => entry.actor === criteria.actor);
      }

      if (criteria.status) {
        results = results.filter(entry => entry.status === criteria.status);
      }

      if (criteria.startDate) {
        results = results.filter(entry => entry.timestamp >= criteria.startDate);
      }

      if (criteria.endDate) {
        results = results.filter(entry => entry.timestamp <= criteria.endDate);
      }

      return results.slice(0, criteria.limit || 100);
    } catch (error) {
      console.error('Error searching audit logs:', error);
      return [];
    }
  }

  /**
   * Generate audit report
   */
  async generateReport(startDate, endDate) {
    const criteria = { startDate, endDate, limit: 10000 };
    const entries = await this.searchLogs(criteria);

    const report = {
      period: { start: startDate, end: endDate },
      total_operations: entries.length,
      operations_by_type: {},
      operations_by_actor: {},
      operations_by_status: {},
      security_events: 0,
      compliance_events: 0,
      deployment_events: 0,
      failed_operations: 0
    };

    entries.forEach(entry => {
      // Count by operation type
      report.operations_by_type[entry.operation] =
        (report.operations_by_type[entry.operation] || 0) + 1;

      // Count by actor
      report.operations_by_actor[entry.actor] =
        (report.operations_by_actor[entry.actor] || 0) + 1;

      // Count by status
      report.operations_by_status[entry.status] =
        (report.operations_by_status[entry.status] || 0) + 1;

      // Count specific event types
      if (entry.operation.includes('security')) report.security_events++;
      if (entry.operation.includes('compliance')) report.compliance_events++;
      if (entry.operation.includes('deployment')) report.deployment_events++;
      if (entry.status === 'failed' || entry.status === 'error') report.failed_operations++;
    });

    return report;
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const logger = new AuditLogger();

  switch (command) {
    case 'init':
      logger.initialize();
      break;
    case 'log':
      const operation = JSON.parse(process.argv[3] || '{}');
      logger.logOperation(operation);
      break;
    case 'search':
      const criteria = JSON.parse(process.argv[3] || '{}');
      logger.searchLogs(criteria).then(results => {
        console.log(JSON.stringify(results, null, 2));
      });
      break;
    case 'report':
      const startDate = process.argv[3];
      const endDate = process.argv[4];
      logger.generateReport(startDate, endDate).then(report => {
        console.log(JSON.stringify(report, null, 2));
      });
      break;
    default:
      console.log('Usage: audit-logger.js <init|log|search|report> [args]');
  }
}

module.exports = AuditLogger;
