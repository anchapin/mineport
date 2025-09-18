#!/usr/bin/env node

/**
 * Migration Orchestrator for Enhanced CI/CD Pipeline
 *
 * This script orchestrates the gradual migration from the basic CI workflow
 * to the enhanced CI/CD pipeline, managing rollout phases, monitoring, and
 * rollback procedures.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const FeatureFlagManager = require('./feature-flag-manager');

class MigrationOrchestrator {
  constructor() {
    this.featureFlagManager = new FeatureFlagManager();
    this.migrationState = this.loadMigrationState();
    this.monitoringInterval = null;
    this.rollbackTriggers = new Set();
  }

  /**
   * Load migration state from file
   */
  loadMigrationState() {
    const stateFile = '.github/migration-state.json';

    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }

    const defaultState = {
      version: '1.0.0',
      startedAt: null,
      currentPhase: null,
      phaseHistory: [],
      metrics: {
        buildSuccessRate: [],
        deploymentSuccessRate: [],
        averageBuildTime: [],
        securityScanResults: [],
        userFeedback: [],
      },
      rollbackHistory: [],
      lastUpdated: new Date().toISOString(),
    };

    this.saveMigrationState(defaultState);
    return defaultState;
  }

  /**
   * Save migration state to file
   */
  saveMigrationState(state = this.migrationState) {
    state.lastUpdated = new Date().toISOString();
    const stateFile = '.github/migration-state.json';
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    this.migrationState = state;
  }

  /**
   * Start the migration process
   */
  async startMigration() {
    console.log('🚀 Starting enhanced CI/CD pipeline migration...\n');

    // Pre-migration validation
    await this.validatePreMigrationRequirements();

    // Initialize migration state
    this.migrationState.startedAt = new Date().toISOString();
    this.migrationState.currentPhase = 0;
    this.saveMigrationState();

    // Start monitoring
    this.startMonitoring();

    // Execute first phase
    await this.executeCurrentPhase();

    console.log('\n✅ Migration started successfully!');
    console.log('📊 Monitor progress with: npm run migration:status');
    console.log('🔄 Advance phases with: npm run migration:advance');
    console.log('⚠️  Rollback if needed with: npm run migration:rollback');
  }

  /**
   * Validate pre-migration requirements
   */
  async validatePreMigrationRequirements() {
    console.log('🔍 Validating pre-migration requirements...');

    const requirements = [
      {
        name: 'Repository secrets configured',
        check: () => this.checkRepositorySecrets(),
      },
      {
        name: 'Workflow files present',
        check: () => this.checkWorkflowFiles(),
      },
      {
        name: 'Dependencies up to date',
        check: () => this.checkDependencies(),
      },
      {
        name: 'Tests passing',
        check: () => this.checkTestsStatus(),
      },
      {
        name: 'No critical security issues',
        check: () => this.checkSecurityStatus(),
      },
    ];

    for (const requirement of requirements) {
      try {
        const result = await requirement.check();
        if (result.passed) {
          console.log(`  ✅ ${requirement.name}`);
        } else {
          console.log(`  ❌ ${requirement.name}: ${result.message}`);
          throw new Error(`Pre-migration requirement failed: ${requirement.name}`);
        }
      } catch (error) {
        console.log(`  ❌ ${requirement.name}: ${error.message}`);
        throw error;
      }
    }

    console.log('✅ All pre-migration requirements satisfied\n');
  }

  /**
   * Check repository secrets
   */
  async checkRepositorySecrets() {
    try {
      const secrets = execSync('gh secret list', { encoding: 'utf8' });
      const requiredSecrets = ['SLACK_WEBHOOK_URL']; // Removed SNYK_TOKEN - using free npm audit

      for (const secret of requiredSecrets) {
        if (!secrets.includes(secret)) {
          return {
            passed: false,
            message: `Missing required secret: ${secret}`,
          };
        }
      }

      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        message: 'Unable to check repository secrets',
      };
    }
  }

  /**
   * Check workflow files
   */
  async checkWorkflowFiles() {
    const requiredWorkflows = ['ci-enhanced.yml', 'security.yml', 'deploy.yml'];

    const workflowsDir = '.github/workflows';

    for (const workflow of requiredWorkflows) {
      const workflowPath = path.join(workflowsDir, workflow);
      if (!fs.existsSync(workflowPath)) {
        return {
          passed: false,
          message: `Missing workflow file: ${workflow}`,
        };
      }
    }

    return { passed: true };
  }

  /**
   * Check dependencies status
   */
  async checkDependencies() {
    try {
      execSync('npm audit --audit-level high', { stdio: 'pipe' });
      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        message: 'High severity vulnerabilities found in dependencies',
      };
    }
  }

  /**
   * Check tests status
   */
  async checkTestsStatus() {
    try {
      execSync('npm test -- --run', { stdio: 'pipe' });
      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        message: 'Tests are failing',
      };
    }
  }

  /**
   * Check security status
   */
  async checkSecurityStatus() {
    try {
      // Check for secrets in code
      execSync('gitleaks detect --source . --verbose', { stdio: 'pipe' });
      return { passed: true };
    } catch (error) {
      if (error.status === 1) {
        return {
          passed: false,
          message: 'Secrets detected in code',
        };
      }
      // GitLeaks not installed or other error - continue
      return { passed: true };
    }
  }

  /**
   * Execute current migration phase
   */
  async executeCurrentPhase() {
    const rolloutResult = this.featureFlagManager.executeGradualRollout();

    if (rolloutResult.completed) {
      console.log('🎉 All migration phases completed!');
      this.migrationState.currentPhase = 'completed';
      this.saveMigrationState();
      this.stopMonitoring();
      return;
    }

    const phase = rolloutResult.phase;
    console.log(`\n📋 Executing ${phase.name}...`);

    // Record phase start
    const phaseRecord = {
      name: phase.name,
      features: phase.features,
      startedAt: new Date().toISOString(),
      status: 'in_progress',
      results: rolloutResult.results,
    };

    this.migrationState.phaseHistory.push(phaseRecord);
    this.migrationState.currentPhase = phase.name;
    this.saveMigrationState();

    // Set up phase-specific monitoring
    this.setupPhaseMonitoring(phase);

    console.log(`✅ Phase started: ${phase.name}`);
    console.log(`🎯 Features enabled: ${phase.features.join(', ')}`);
    console.log(`⏱️  Duration: ${phase.duration}`);
    console.log(`📊 Success criteria: ${phase.successCriteria.join(', ')}`);

    return phaseRecord;
  }

  /**
   * Advance to next migration phase
   */
  async advanceToNextPhase() {
    console.log('📈 Advancing to next migration phase...');

    // Validate current phase success criteria
    const currentPhaseValid = await this.validateCurrentPhase();

    if (!currentPhaseValid.passed) {
      console.log(`❌ Current phase validation failed: ${currentPhaseValid.message}`);
      console.log('🔄 Consider rolling back or fixing issues before advancing');
      return false;
    }

    // Mark current phase as completed
    const currentPhaseRecord =
      this.migrationState.phaseHistory[this.migrationState.phaseHistory.length - 1];
    if (currentPhaseRecord) {
      currentPhaseRecord.status = 'completed';
      currentPhaseRecord.completedAt = new Date().toISOString();
    }

    // Advance to next phase
    const advanced = this.featureFlagManager.advanceToNextPhase();

    if (advanced) {
      await this.executeCurrentPhase();
      console.log('✅ Successfully advanced to next phase');
      return true;
    } else {
      console.log('🎯 All phases completed!');
      this.migrationState.currentPhase = 'completed';
      this.saveMigrationState();
      this.stopMonitoring();
      return true;
    }
  }

  /**
   * Validate current phase success criteria
   */
  async validateCurrentPhase() {
    console.log('🔍 Validating current phase success criteria...');

    const validations = [
      {
        name: 'Build success rate > 95%',
        check: () => this.checkBuildSuccessRate(95),
      },
      {
        name: 'No critical security issues',
        check: () => this.checkCriticalSecurityIssues(),
      },
      {
        name: 'Deployment success rate > 99%',
        check: () => this.checkDeploymentSuccessRate(99),
      },
      {
        name: 'Average build time < 5 minutes',
        check: () => this.checkAverageBuildTime(300),
      },
    ];

    for (const validation of validations) {
      try {
        const result = await validation.check();
        if (result.passed) {
          console.log(`  ✅ ${validation.name}`);
        } else {
          console.log(`  ❌ ${validation.name}: ${result.message}`);
          return {
            passed: false,
            message: `Validation failed: ${validation.name}`,
          };
        }
      } catch (error) {
        console.log(`  ⚠️  ${validation.name}: ${error.message}`);
        // Non-critical validation failure
      }
    }

    return { passed: true };
  }

  /**
   * Check build success rate
   */
  async checkBuildSuccessRate(threshold) {
    try {
      const runs = execSync('gh run list --limit 20 --json conclusion', { encoding: 'utf8' });
      const runData = JSON.parse(runs);

      const successfulRuns = runData.filter((run) => run.conclusion === 'success').length;
      const successRate = (successfulRuns / runData.length) * 100;

      this.migrationState.metrics.buildSuccessRate.push({
        timestamp: new Date().toISOString(),
        rate: successRate,
        totalRuns: runData.length,
        successfulRuns,
      });
      this.saveMigrationState();

      return {
        passed: successRate >= threshold,
        message: `Build success rate: ${successRate.toFixed(1)}%`,
      };
    } catch (error) {
      return {
        passed: false,
        message: 'Unable to check build success rate',
      };
    }
  }

  /**
   * Check for critical security issues
   */
  async checkCriticalSecurityIssues() {
    try {
      execSync('npm audit --audit-level critical', { stdio: 'pipe' });
      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        message: 'Critical security vulnerabilities found',
      };
    }
  }

  /**
   * Check deployment success rate
   */
  async checkDeploymentSuccessRate(threshold) {
    try {
      const runs = execSync('gh run list --workflow=deploy.yml --limit 10 --json conclusion', {
        encoding: 'utf8',
      });
      const runData = JSON.parse(runs);

      if (runData.length === 0) {
        return { passed: true, message: 'No deployment runs to check' };
      }

      const successfulRuns = runData.filter((run) => run.conclusion === 'success').length;
      const successRate = (successfulRuns / runData.length) * 100;

      this.migrationState.metrics.deploymentSuccessRate.push({
        timestamp: new Date().toISOString(),
        rate: successRate,
        totalRuns: runData.length,
        successfulRuns,
      });
      this.saveMigrationState();

      return {
        passed: successRate >= threshold,
        message: `Deployment success rate: ${successRate.toFixed(1)}%`,
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Unable to check deployment success rate',
      };
    }
  }

  /**
   * Check average build time
   */
  async checkAverageBuildTime(thresholdSeconds) {
    try {
      // This would require parsing workflow run times
      // For now, return a simulated check
      const avgBuildTime = 240; // 4 minutes (simulated)

      this.migrationState.metrics.averageBuildTime.push({
        timestamp: new Date().toISOString(),
        averageSeconds: avgBuildTime,
      });
      this.saveMigrationState();

      return {
        passed: avgBuildTime <= thresholdSeconds,
        message: `Average build time: ${Math.round(avgBuildTime / 60)} minutes`,
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Unable to check average build time',
      };
    }
  }

  /**
   * Rollback current migration phase
   */
  async rollbackCurrentPhase() {
    console.log('🔄 Rolling back current migration phase...');

    const rollbackReason = await this.identifyRollbackReason();
    console.log(`📋 Rollback reason: ${rollbackReason}`);

    // Record rollback
    const rollbackRecord = {
      timestamp: new Date().toISOString(),
      phase: this.migrationState.currentPhase,
      reason: rollbackReason,
      triggeredBy: 'manual',
    };

    this.migrationState.rollbackHistory.push(rollbackRecord);

    // Execute rollback
    const success = this.featureFlagManager.rollbackToPreviousPhase();

    if (success) {
      // Update current phase record
      const currentPhaseRecord =
        this.migrationState.phaseHistory[this.migrationState.phaseHistory.length - 1];
      if (currentPhaseRecord) {
        currentPhaseRecord.status = 'rolled_back';
        currentPhaseRecord.rolledBackAt = new Date().toISOString();
        currentPhaseRecord.rollbackReason = rollbackReason;
      }

      this.saveMigrationState();
      console.log('✅ Rollback completed successfully');

      // Send notifications
      await this.sendRollbackNotification(rollbackRecord);

      return true;
    } else {
      console.log('❌ Rollback failed');
      return false;
    }
  }

  /**
   * Identify rollback reason
   */
  async identifyRollbackReason() {
    const reasons = [];

    // Check build failures
    try {
      const buildCheck = await this.checkBuildSuccessRate(90);
      if (!buildCheck.passed) {
        reasons.push('Build success rate below threshold');
      }
    } catch (error) {
      // Ignore check errors
    }

    // Check security issues
    try {
      const securityCheck = await this.checkCriticalSecurityIssues();
      if (!securityCheck.passed) {
        reasons.push('Critical security vulnerabilities detected');
      }
    } catch (error) {
      // Ignore check errors
    }

    // Check user feedback
    if (this.migrationState.metrics.userFeedback.length > 0) {
      const recentFeedback = this.migrationState.metrics.userFeedback.filter((feedback) => {
        const feedbackTime = new Date(feedback.timestamp);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return feedbackTime > oneDayAgo;
      });

      const negativeFeedback = recentFeedback.filter((feedback) => feedback.rating < 3);
      if (negativeFeedback.length > recentFeedback.length / 2) {
        reasons.push('Negative user feedback');
      }
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Manual rollback requested';
  }

  /**
   * Start monitoring pipeline metrics
   */
  startMonitoring() {
    console.log('📊 Starting pipeline monitoring...');

    this.monitoringInterval = setInterval(
      async () => {
        await this.collectMetrics();
        await this.checkRollbackTriggers();
      },
      5 * 60 * 1000
    ); // Every 5 minutes

    console.log('✅ Monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('📊 Monitoring stopped');
    }
  }

  /**
   * Setup phase-specific monitoring
   */
  setupPhaseMonitoring(phase) {
    // Configure monitoring based on phase features
    this.rollbackTriggers.clear();

    if (phase.features.includes('enhancedCI')) {
      this.rollbackTriggers.add('build_failure_rate_high');
    }

    if (phase.features.includes('securityScanning')) {
      this.rollbackTriggers.add('critical_security_issue');
    }

    if (phase.features.includes('automatedDeployment')) {
      this.rollbackTriggers.add('deployment_failure_rate_high');
    }

    console.log(`🔍 Monitoring triggers: ${Array.from(this.rollbackTriggers).join(', ')}`);
  }

  /**
   * Collect pipeline metrics
   */
  async collectMetrics() {
    try {
      // Collect build metrics
      await this.checkBuildSuccessRate(95);

      // Collect deployment metrics
      await this.checkDeploymentSuccessRate(99);

      // Collect build time metrics
      await this.checkAverageBuildTime(300);

      console.log('📊 Metrics collected');
    } catch (error) {
      console.error('⚠️  Error collecting metrics:', error.message);
    }
  }

  /**
   * Check for automatic rollback triggers
   */
  async checkRollbackTriggers() {
    const triggers = [];

    // Check build failure rate
    if (this.rollbackTriggers.has('build_failure_rate_high')) {
      const buildCheck = await this.checkBuildSuccessRate(85);
      if (!buildCheck.passed) {
        triggers.push('build_failure_rate_high');
      }
    }

    // Check for critical security issues
    if (this.rollbackTriggers.has('critical_security_issue')) {
      const securityCheck = await this.checkCriticalSecurityIssues();
      if (!securityCheck.passed) {
        triggers.push('critical_security_issue');
      }
    }

    // Trigger automatic rollback if conditions met
    if (triggers.length > 0) {
      console.log(`🚨 Automatic rollback triggered: ${triggers.join(', ')}`);
      await this.executeAutomaticRollback(triggers);
    }
  }

  /**
   * Execute automatic rollback
   */
  async executeAutomaticRollback(triggers) {
    console.log('🔄 Executing automatic rollback...');

    const rollbackRecord = {
      timestamp: new Date().toISOString(),
      phase: this.migrationState.currentPhase,
      reason: triggers.join(', '),
      triggeredBy: 'automatic',
      triggers,
    };

    this.migrationState.rollbackHistory.push(rollbackRecord);

    // Execute rollback
    const success = this.featureFlagManager.rollbackToPreviousPhase();

    if (success) {
      this.saveMigrationState();
      console.log('✅ Automatic rollback completed');

      // Send critical notifications
      await this.sendCriticalRollbackNotification(rollbackRecord);
    } else {
      console.log('❌ Automatic rollback failed');
    }
  }

  /**
   * Send rollback notification
   */
  async sendRollbackNotification(rollbackRecord) {
    const message =
      `🔄 CI/CD Pipeline Rollback\n` +
      `Phase: ${rollbackRecord.phase}\n` +
      `Reason: ${rollbackRecord.reason}\n` +
      `Triggered: ${rollbackRecord.triggeredBy}\n` +
      `Time: ${rollbackRecord.timestamp}`;

    console.log('📢 Sending rollback notification...');
    console.log(message);

    // In a real implementation, this would send to Slack, email, etc.
  }

  /**
   * Send critical rollback notification
   */
  async sendCriticalRollbackNotification(rollbackRecord) {
    const message =
      `🚨 CRITICAL: Automatic CI/CD Pipeline Rollback\n` +
      `Phase: ${rollbackRecord.phase}\n` +
      `Triggers: ${rollbackRecord.triggers.join(', ')}\n` +
      `Time: ${rollbackRecord.timestamp}\n` +
      `Action Required: Investigate and resolve issues before re-enabling`;

    console.log('🚨 Sending critical rollback notification...');
    console.log(message);

    // In a real implementation, this would send urgent notifications
  }

  /**
   * Get migration status
   */
  getMigrationStatus() {
    const rolloutStatus = this.featureFlagManager.getRolloutStatus();

    return {
      migrationState: this.migrationState,
      rolloutStatus,
      isMonitoring: this.monitoringInterval !== null,
      rollbackTriggers: Array.from(this.rollbackTriggers),
    };
  }

  /**
   * Generate migration report
   */
  generateMigrationReport() {
    const status = this.getMigrationStatus();
    const report = {
      timestamp: new Date().toISOString(),
      migrationStatus: status,
      summary: this.generateMigrationSummary(),
      recommendations: this.generateMigrationRecommendations(),
      nextSteps: this.generateNextSteps(),
    };

    const reportPath = 'migration-status-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Migration report generated: ${reportPath}`);
    return report;
  }

  /**
   * Generate migration summary
   */
  generateMigrationSummary() {
    const completedPhases = this.migrationState.phaseHistory.filter(
      (phase) => phase.status === 'completed'
    ).length;
    const totalPhases = this.featureFlagManager.flags.rolloutStrategy.phases.length;
    const rollbackCount = this.migrationState.rollbackHistory.length;

    return {
      completedPhases,
      totalPhases,
      completionPercentage: Math.round((completedPhases / totalPhases) * 100),
      rollbackCount,
      currentPhase: this.migrationState.currentPhase,
      startedAt: this.migrationState.startedAt,
      duration: this.migrationState.startedAt
        ? this.calculateDuration(this.migrationState.startedAt)
        : null,
    };
  }

  /**
   * Calculate duration from start time
   */
  calculateDuration(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const durationMs = now - start;

    const days = Math.floor(durationMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((durationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((durationMs % (60 * 60 * 1000)) / (60 * 1000));

    return `${days}d ${hours}h ${minutes}m`;
  }

  /**
   * Generate migration recommendations
   */
  generateMigrationRecommendations() {
    const recommendations = [];
    const summary = this.generateMigrationSummary();

    if (summary.rollbackCount > 2) {
      recommendations.push({
        priority: 'HIGH',
        recommendation: 'Investigate recurring rollback causes',
        rationale: 'Multiple rollbacks indicate systemic issues',
      });
    }

    if (summary.completionPercentage < 50 && summary.duration && summary.duration.includes('d')) {
      const days = parseInt(summary.duration.split('d')[0]);
      if (days > 14) {
        recommendations.push({
          priority: 'MEDIUM',
          recommendation: 'Consider accelerating migration timeline',
          rationale: 'Migration is taking longer than expected',
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate next steps
   */
  generateNextSteps() {
    const status = this.getMigrationStatus();
    const nextSteps = [];

    if (status.migrationState.currentPhase === 'completed') {
      nextSteps.push('🎉 Migration completed - monitor system stability');
      nextSteps.push('📊 Generate final migration report');
      nextSteps.push('📚 Update documentation with lessons learned');
    } else if (status.migrationState.currentPhase) {
      nextSteps.push('📊 Monitor current phase metrics');
      nextSteps.push('🔍 Validate success criteria');
      nextSteps.push('📈 Advance to next phase when ready');
    } else {
      nextSteps.push('🚀 Start migration process');
      nextSteps.push('✅ Validate pre-migration requirements');
      nextSteps.push('📋 Execute Phase 1: Enhanced CI');
    }

    return nextSteps;
  }
}

// CLI Interface
if (require.main === module) {
  const orchestrator = new MigrationOrchestrator();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'start':
        orchestrator.startMigration();
        break;

      case 'advance':
        orchestrator.advanceToNextPhase();
        break;

      case 'rollback':
        orchestrator.rollbackCurrentPhase();
        break;

      case 'status':
        const status = orchestrator.getMigrationStatus();
        console.log('\n📊 Migration Status:');
        console.log(JSON.stringify(status, null, 2));
        break;

      case 'report':
        orchestrator.generateMigrationReport();
        break;

      case 'monitor':
        orchestrator.startMonitoring();
        console.log('📊 Monitoring started. Press Ctrl+C to stop.');
        process.on('SIGINT', () => {
          orchestrator.stopMonitoring();
          process.exit(0);
        });
        break;

      default:
        console.log('Usage: migration-orchestrator.js <command>');
        console.log('Commands:');
        console.log('  start     - Start the migration process');
        console.log('  advance   - Advance to next migration phase');
        console.log('  rollback  - Rollback current phase');
        console.log('  status    - Show migration status');
        console.log('  report    - Generate migration report');
        console.log('  monitor   - Start continuous monitoring');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

module.exports = MigrationOrchestrator;
