#!/usr/bin/env node

/**
 * Feature Flag Manager for CI/CD Pipeline Rollout
 *
 * This script manages feature flags for controlled rollout of enhanced
 * CI/CD pipeline features, allowing gradual migration and rollback capabilities.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FeatureFlagManager {
  constructor() {
    this.flagsFile = '.github/feature-flags.json';
    this.workflowsDir = '.github/workflows';
    this.backupDir = '.github/workflows-backup';
    this.flags = this.loadFlags();
  }

  /**
   * Load feature flags from configuration file
   */
  loadFlags() {
    if (fs.existsSync(this.flagsFile)) {
      return JSON.parse(fs.readFileSync(this.flagsFile, 'utf8'));
    }

    // Default feature flags configuration
    const defaultFlags = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      flags: {
        enhancedCI: {
          enabled: false,
          description: 'Enhanced CI workflow with matrix builds and caching',
          rolloutPercentage: 0,
          dependencies: [],
        },
        securityScanning: {
          enabled: false,
          description: 'Comprehensive security scanning workflow',
          rolloutPercentage: 0,
          dependencies: [],
        },
        automatedDeployment: {
          enabled: false,
          description: 'Automated deployment with canary strategy',
          rolloutPercentage: 0,
          dependencies: ['enhancedCI', 'securityScanning'],
        },
        dependencyManagement: {
          enabled: false,
          description: 'Automated dependency updates and security patches',
          rolloutPercentage: 0,
          dependencies: ['securityScanning'],
        },
        performanceMonitoring: {
          enabled: false,
          description: 'Performance monitoring and regression testing',
          rolloutPercentage: 0,
          dependencies: ['enhancedCI'],
        },
        artifactManagement: {
          enabled: false,
          description: 'Artifact creation and release automation',
          rolloutPercentage: 0,
          dependencies: ['enhancedCI'],
        },
        complianceReporting: {
          enabled: false,
          description: 'Compliance and audit capabilities',
          rolloutPercentage: 0,
          dependencies: ['securityScanning'],
        },
      },
      rolloutStrategy: {
        phases: [
          {
            name: 'Phase 1: Core CI Enhancement',
            features: ['enhancedCI'],
            duration: '1 week',
            successCriteria: ['build_success_rate > 95%', 'avg_build_time < 5min'],
          },
          {
            name: 'Phase 2: Security Integration',
            features: ['securityScanning'],
            duration: '1 week',
            successCriteria: ['security_scan_success_rate > 98%', 'no_critical_vulnerabilities'],
          },
          {
            name: 'Phase 3: Deployment Automation',
            features: ['automatedDeployment'],
            duration: '2 weeks',
            successCriteria: ['deployment_success_rate > 99%', 'rollback_time < 5min'],
          },
          {
            name: 'Phase 4: Advanced Features',
            features: ['dependencyManagement', 'performanceMonitoring', 'artifactManagement'],
            duration: '2 weeks',
            successCriteria: ['all_features_stable', 'performance_improved'],
          },
          {
            name: 'Phase 5: Compliance and Monitoring',
            features: ['complianceReporting'],
            duration: '1 week',
            successCriteria: ['compliance_reports_generated', 'audit_trail_complete'],
          },
        ],
        currentPhase: 0,
        rollbackPlan: {
          enabled: true,
          triggerConditions: [
            'build_failure_rate > 10%',
            'deployment_failure_rate > 5%',
            'critical_security_issue',
            'manual_trigger',
          ],
        },
      },
    };

    this.saveFlags(defaultFlags);
    return defaultFlags;
  }

  /**
   * Save feature flags to configuration file
   */
  saveFlags(flags = this.flags) {
    flags.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.flagsFile, JSON.stringify(flags, null, 2));
    this.flags = flags;
  }

  /**
   * Enable a specific feature flag
   */
  enableFeature(featureName, rolloutPercentage = 100) {
    if (!this.flags.flags[featureName]) {
      throw new Error(`Feature flag '${featureName}' not found`);
    }

    // Check dependencies
    const feature = this.flags.flags[featureName];
    for (const dependency of feature.dependencies) {
      if (!this.flags.flags[dependency].enabled) {
        throw new Error(`Dependency '${dependency}' must be enabled first`);
      }
    }

    this.flags.flags[featureName].enabled = true;
    this.flags.flags[featureName].rolloutPercentage = rolloutPercentage;
    this.flags.flags[featureName].enabledAt = new Date().toISOString();

    this.saveFlags();
    console.log(`✅ Feature '${featureName}' enabled with ${rolloutPercentage}% rollout`);

    return this.applyFeatureChanges(featureName);
  }

  /**
   * Disable a specific feature flag
   */
  disableFeature(featureName) {
    if (!this.flags.flags[featureName]) {
      throw new Error(`Feature flag '${featureName}' not found`);
    }

    // Check if other features depend on this one
    const dependentFeatures = Object.entries(this.flags.flags)
      .filter(([name, flag]) => flag.dependencies.includes(featureName) && flag.enabled)
      .map(([name]) => name);

    if (dependentFeatures.length > 0) {
      throw new Error(
        `Cannot disable '${featureName}' - required by: ${dependentFeatures.join(', ')}`
      );
    }

    this.flags.flags[featureName].enabled = false;
    this.flags.flags[featureName].rolloutPercentage = 0;
    this.flags.flags[featureName].disabledAt = new Date().toISOString();

    this.saveFlags();
    console.log(`❌ Feature '${featureName}' disabled`);

    return this.revertFeatureChanges(featureName);
  }

  /**
   * Apply workflow changes for a specific feature
   */
  applyFeatureChanges(featureName) {
    const changes = [];

    switch (featureName) {
      case 'enhancedCI':
        changes.push(this.enableEnhancedCI());
        break;
      case 'securityScanning':
        changes.push(this.enableSecurityScanning());
        break;
      case 'automatedDeployment':
        changes.push(this.enableAutomatedDeployment());
        break;
      case 'dependencyManagement':
        changes.push(this.enableDependencyManagement());
        break;
      case 'performanceMonitoring':
        changes.push(this.enablePerformanceMonitoring());
        break;
      case 'artifactManagement':
        changes.push(this.enableArtifactManagement());
        break;
      case 'complianceReporting':
        changes.push(this.enableComplianceReporting());
        break;
      default:
        throw new Error(`Unknown feature: ${featureName}`);
    }

    return changes.filter(Boolean);
  }

  /**
   * Revert workflow changes for a specific feature
   */
  revertFeatureChanges(featureName) {
    const changes = [];

    switch (featureName) {
      case 'enhancedCI':
        changes.push(this.disableEnhancedCI());
        break;
      case 'securityScanning':
        changes.push(this.disableSecurityScanning());
        break;
      case 'automatedDeployment':
        changes.push(this.disableAutomatedDeployment());
        break;
      case 'dependencyManagement':
        changes.push(this.disableDependencyManagement());
        break;
      case 'performanceMonitoring':
        changes.push(this.disablePerformanceMonitoring());
        break;
      case 'artifactManagement':
        changes.push(this.disableArtifactManagement());
        break;
      case 'complianceReporting':
        changes.push(this.disableComplianceReporting());
        break;
      default:
        throw new Error(`Unknown feature: ${featureName}`);
    }

    return changes.filter(Boolean);
  }

  /**
   * Enable enhanced CI workflow
   */
  enableEnhancedCI() {
    const ciWorkflow = path.join(this.workflowsDir, 'ci.yml');
    const enhancedCIWorkflow = path.join(this.workflowsDir, 'ci-enhanced.yml');

    // Backup existing CI workflow
    if (fs.existsSync(ciWorkflow)) {
      this.backupWorkflow('ci.yml');
    }

    // Enable enhanced CI workflow
    if (fs.existsSync(enhancedCIWorkflow)) {
      if (fs.existsSync(ciWorkflow)) {
        fs.unlinkSync(ciWorkflow);
      }
      fs.copyFileSync(enhancedCIWorkflow, ciWorkflow);
      return `Enhanced CI workflow activated: ${ciWorkflow}`;
    }

    return null;
  }

  /**
   * Disable enhanced CI workflow
   */
  disableEnhancedCI() {
    const ciWorkflow = path.join(this.workflowsDir, 'ci.yml');

    // Restore original CI workflow
    const backupPath = this.restoreWorkflow('ci.yml');
    if (backupPath) {
      return `Enhanced CI workflow disabled, restored from: ${backupPath}`;
    }

    return null;
  }

  /**
   * Enable security scanning workflow
   */
  enableSecurityScanning() {
    const securityWorkflow = path.join(this.workflowsDir, 'security.yml');

    if (fs.existsSync(securityWorkflow)) {
      // Workflow already exists, just ensure it's enabled
      return `Security scanning workflow already active: ${securityWorkflow}`;
    }

    return null;
  }

  /**
   * Disable security scanning workflow
   */
  disableSecurityScanning() {
    const securityWorkflow = path.join(this.workflowsDir, 'security.yml');

    if (fs.existsSync(securityWorkflow)) {
      this.backupWorkflow('security.yml');
      fs.unlinkSync(securityWorkflow);
      return `Security scanning workflow disabled: ${securityWorkflow}`;
    }

    return null;
  }

  /**
   * Enable automated deployment workflow
   */
  enableAutomatedDeployment() {
    const deployWorkflow = path.join(this.workflowsDir, 'deploy.yml');

    if (fs.existsSync(deployWorkflow)) {
      return `Automated deployment workflow already active: ${deployWorkflow}`;
    }

    return null;
  }

  /**
   * Disable automated deployment workflow
   */
  disableAutomatedDeployment() {
    const deployWorkflow = path.join(this.workflowsDir, 'deploy.yml');

    if (fs.existsSync(deployWorkflow)) {
      this.backupWorkflow('deploy.yml');
      fs.unlinkSync(deployWorkflow);
      return `Automated deployment workflow disabled: ${deployWorkflow}`;
    }

    return null;
  }

  /**
   * Enable dependency management workflow
   */
  enableDependencyManagement() {
    const dependenciesWorkflow = path.join(this.workflowsDir, 'dependencies.yml');

    if (fs.existsSync(dependenciesWorkflow)) {
      return `Dependency management workflow already active: ${dependenciesWorkflow}`;
    }

    return null;
  }

  /**
   * Disable dependency management workflow
   */
  disableDependencyManagement() {
    const dependenciesWorkflow = path.join(this.workflowsDir, 'dependencies.yml');

    if (fs.existsSync(dependenciesWorkflow)) {
      this.backupWorkflow('dependencies.yml');
      fs.unlinkSync(dependenciesWorkflow);
      return `Dependency management workflow disabled: ${dependenciesWorkflow}`;
    }

    return null;
  }

  /**
   * Enable performance monitoring workflow
   */
  enablePerformanceMonitoring() {
    const performanceWorkflow = path.join(this.workflowsDir, 'performance.yml');

    if (fs.existsSync(performanceWorkflow)) {
      return `Performance monitoring workflow already active: ${performanceWorkflow}`;
    }

    return null;
  }

  /**
   * Disable performance monitoring workflow
   */
  disablePerformanceMonitoring() {
    const performanceWorkflow = path.join(this.workflowsDir, 'performance.yml');

    if (fs.existsExists(performanceWorkflow)) {
      this.backupWorkflow('performance.yml');
      fs.unlinkSync(performanceWorkflow);
      return `Performance monitoring workflow disabled: ${performanceWorkflow}`;
    }

    return null;
  }

  /**
   * Enable artifact management workflow
   */
  enableArtifactManagement() {
    const artifactsWorkflow = path.join(this.workflowsDir, 'artifacts.yml');

    if (fs.existsSync(artifactsWorkflow)) {
      return `Artifact management workflow already active: ${artifactsWorkflow}`;
    }

    return null;
  }

  /**
   * Disable artifact management workflow
   */
  disableArtifactManagement() {
    const artifactsWorkflow = path.join(this.workflowsDir, 'artifacts.yml');

    if (fs.existsSync(artifactsWorkflow)) {
      this.backupWorkflow('artifacts.yml');
      fs.unlinkSync(artifactsWorkflow);
      return `Artifact management workflow disabled: ${artifactsWorkflow}`;
    }

    return null;
  }

  /**
   * Enable compliance reporting workflow
   */
  enableComplianceReporting() {
    const complianceWorkflow = path.join(this.workflowsDir, 'compliance-reporting.yml');

    if (fs.existsSync(complianceWorkflow)) {
      return `Compliance reporting workflow already active: ${complianceWorkflow}`;
    }

    return null;
  }

  /**
   * Disable compliance reporting workflow
   */
  disableComplianceReporting() {
    const complianceWorkflow = path.join(this.workflowsDir, 'compliance-reporting.yml');

    if (fs.existsSync(complianceWorkflow)) {
      this.backupWorkflow('compliance-reporting.yml');
      fs.unlinkSync(complianceWorkflow);
      return `Compliance reporting workflow disabled: ${complianceWorkflow}`;
    }

    return null;
  }

  /**
   * Backup a workflow file
   */
  backupWorkflow(workflowFile) {
    const sourcePath = path.join(this.workflowsDir, workflowFile);

    if (!fs.existsSync(sourcePath)) {
      return null;
    }

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `${workflowFile}.${timestamp}.backup`);

    fs.copyFileSync(sourcePath, backupPath);
    console.log(`📁 Backed up ${workflowFile} to ${backupPath}`);

    return backupPath;
  }

  /**
   * Restore a workflow file from backup
   */
  restoreWorkflow(workflowFile) {
    const targetPath = path.join(this.workflowsDir, workflowFile);

    if (!fs.existsSync(this.backupDir)) {
      return null;
    }

    // Find the most recent backup
    const backupFiles = fs
      .readdirSync(this.backupDir)
      .filter((file) => file.startsWith(`${workflowFile}.`) && file.endsWith('.backup'))
      .sort()
      .reverse();

    if (backupFiles.length === 0) {
      return null;
    }

    const latestBackup = path.join(this.backupDir, backupFiles[0]);
    fs.copyFileSync(latestBackup, targetPath);
    console.log(`📁 Restored ${workflowFile} from ${latestBackup}`);

    return latestBackup;
  }

  /**
   * Execute gradual rollout based on current phase
   */
  executeGradualRollout() {
    const strategy = this.flags.rolloutStrategy;
    const currentPhase = strategy.phases[strategy.currentPhase];

    if (!currentPhase) {
      console.log('🎉 All rollout phases completed!');
      return { completed: true };
    }

    console.log(`🚀 Executing ${currentPhase.name}...`);
    console.log(`Features: ${currentPhase.features.join(', ')}`);
    console.log(`Duration: ${currentPhase.duration}`);
    console.log(`Success Criteria: ${currentPhase.successCriteria.join(', ')}`);

    const results = [];

    // Enable features for this phase
    for (const featureName of currentPhase.features) {
      try {
        const changes = this.enableFeature(featureName);
        results.push({
          feature: featureName,
          status: 'enabled',
          changes,
        });
      } catch (error) {
        results.push({
          feature: featureName,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return {
      phase: currentPhase,
      results,
      nextSteps: this.generateNextSteps(currentPhase),
    };
  }

  /**
   * Advance to the next rollout phase
   */
  advanceToNextPhase() {
    const strategy = this.flags.rolloutStrategy;

    if (strategy.currentPhase < strategy.phases.length - 1) {
      strategy.currentPhase++;
      this.saveFlags();
      console.log(
        `📈 Advanced to phase ${strategy.currentPhase + 1}: ${strategy.phases[strategy.currentPhase].name}`
      );
      return true;
    } else {
      console.log('🎯 All phases completed!');
      return false;
    }
  }

  /**
   * Rollback to previous phase
   */
  rollbackToPreviousPhase() {
    const strategy = this.flags.rolloutStrategy;
    const currentPhase = strategy.phases[strategy.currentPhase];

    if (!currentPhase) {
      console.log('❌ No current phase to rollback from');
      return false;
    }

    console.log(`🔄 Rolling back ${currentPhase.name}...`);

    // Disable features from current phase
    for (const featureName of currentPhase.features) {
      try {
        this.disableFeature(featureName);
        console.log(`  ❌ Disabled ${featureName}`);
      } catch (error) {
        console.error(`  ⚠️  Failed to disable ${featureName}: ${error.message}`);
      }
    }

    // Move back to previous phase
    if (strategy.currentPhase > 0) {
      strategy.currentPhase--;
      this.saveFlags();
      console.log(
        `📉 Rolled back to phase ${strategy.currentPhase + 1}: ${strategy.phases[strategy.currentPhase].name}`
      );
    }

    return true;
  }

  /**
   * Generate next steps for current phase
   */
  generateNextSteps(phase) {
    return [
      `Monitor pipeline performance for ${phase.duration}`,
      `Verify success criteria: ${phase.successCriteria.join(', ')}`,
      'Collect feedback from development team',
      'Review metrics and logs for issues',
      'Prepare for next phase or rollback if needed',
    ];
  }

  /**
   * Get current rollout status
   */
  getRolloutStatus() {
    const strategy = this.flags.rolloutStrategy;
    const currentPhase = strategy.phases[strategy.currentPhase];

    const enabledFeatures = Object.entries(this.flags.flags)
      .filter(([name, flag]) => flag.enabled)
      .map(([name, flag]) => ({
        name,
        rolloutPercentage: flag.rolloutPercentage,
        enabledAt: flag.enabledAt,
      }));

    return {
      currentPhase: currentPhase
        ? {
            index: strategy.currentPhase,
            name: currentPhase.name,
            features: currentPhase.features,
            duration: currentPhase.duration,
          }
        : null,
      totalPhases: strategy.phases.length,
      enabledFeatures,
      completionPercentage: Math.round((strategy.currentPhase / strategy.phases.length) * 100),
    };
  }

  /**
   * List all available features
   */
  listFeatures() {
    console.log('\n📋 Available Features:');
    console.log('='.repeat(50));

    Object.entries(this.flags.flags).forEach(([name, flag]) => {
      const status = flag.enabled ? '✅ ENABLED' : '❌ DISABLED';
      const rollout = flag.enabled ? ` (${flag.rolloutPercentage}%)` : '';
      const deps = flag.dependencies.length > 0 ? ` [deps: ${flag.dependencies.join(', ')}]` : '';

      console.log(`${status} ${name}${rollout}`);
      console.log(`    ${flag.description}${deps}`);
    });
  }

  /**
   * Generate migration report
   */
  generateMigrationReport() {
    const status = this.getRolloutStatus();
    const report = {
      timestamp: new Date().toISOString(),
      rolloutStatus: status,
      featureFlags: this.flags.flags,
      recommendations: this.generateRecommendations(),
      riskAssessment: this.assessRolloutRisks(),
    };

    const reportPath = 'migration-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Migration report generated: ${reportPath}`);
    return report;
  }

  /**
   * Generate rollout recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const enabledFeatures = Object.entries(this.flags.flags).filter(([name, flag]) => flag.enabled);

    if (enabledFeatures.length === 0) {
      recommendations.push({
        priority: 'HIGH',
        recommendation: 'Start with Phase 1: Enable enhanced CI workflow',
        rationale: 'Core CI improvements provide foundation for other features',
      });
    }

    // Check for incomplete rollouts
    const partialRollouts = enabledFeatures.filter(([name, flag]) => flag.rolloutPercentage < 100);
    if (partialRollouts.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        recommendation: 'Complete partial rollouts before enabling new features',
        rationale: 'Partial rollouts can cause inconsistent behavior',
      });
    }

    // Check for dependency violations
    const dependencyIssues = Object.entries(this.flags.flags).filter(([name, flag]) => {
      if (!flag.enabled) return false;
      return flag.dependencies.some((dep) => !this.flags.flags[dep].enabled);
    });

    if (dependencyIssues.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        recommendation: 'Fix dependency violations before proceeding',
        rationale: 'Missing dependencies can cause feature failures',
        affectedFeatures: dependencyIssues.map(([name]) => name),
      });
    }

    return recommendations;
  }

  /**
   * Assess rollout risks
   */
  assessRolloutRisks() {
    const risks = [];
    const enabledFeatures = Object.entries(this.flags.flags).filter(([name, flag]) => flag.enabled);

    // Risk: Too many features enabled at once
    if (enabledFeatures.length > 3) {
      risks.push({
        level: 'MEDIUM',
        risk: 'Multiple features enabled simultaneously',
        impact: 'Difficult to isolate issues if problems occur',
        mitigation: 'Consider rolling back some features and enabling gradually',
      });
    }

    // Risk: Critical features without dependencies
    const criticalFeatures = ['automatedDeployment'];
    const criticalWithoutDeps = criticalFeatures.filter((feature) => {
      const flag = this.flags.flags[feature];
      return flag.enabled && flag.dependencies.some((dep) => !this.flags.flags[dep].enabled);
    });

    if (criticalWithoutDeps.length > 0) {
      risks.push({
        level: 'HIGH',
        risk: 'Critical features enabled without dependencies',
        impact: 'High probability of deployment failures',
        mitigation: 'Enable dependencies before critical features',
        affectedFeatures: criticalWithoutDeps,
      });
    }

    return risks;
  }
}

// CLI Interface
if (require.main === module) {
  const manager = new FeatureFlagManager();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    switch (command) {
      case 'list':
        manager.listFeatures();
        break;

      case 'enable':
        if (args.length < 1) {
          console.error('Usage: enable <feature-name> [rollout-percentage]');
          process.exit(1);
        }
        const rolloutPercentage = args[1] ? parseInt(args[1]) : 100;
        manager.enableFeature(args[0], rolloutPercentage);
        break;

      case 'disable':
        if (args.length < 1) {
          console.error('Usage: disable <feature-name>');
          process.exit(1);
        }
        manager.disableFeature(args[0]);
        break;

      case 'rollout':
        const result = manager.executeGradualRollout();
        console.log('\n📊 Rollout Results:');
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'advance':
        manager.advanceToNextPhase();
        break;

      case 'rollback':
        manager.rollbackToPreviousPhase();
        break;

      case 'status':
        const status = manager.getRolloutStatus();
        console.log('\n📊 Rollout Status:');
        console.log(JSON.stringify(status, null, 2));
        break;

      case 'report':
        manager.generateMigrationReport();
        break;

      default:
        console.log('Usage: feature-flag-manager.js <command> [args]');
        console.log('Commands:');
        console.log('  list                     - List all features and their status');
        console.log(
          '  enable <feature> [%]     - Enable a feature with optional rollout percentage'
        );
        console.log('  disable <feature>        - Disable a feature');
        console.log('  rollout                  - Execute current rollout phase');
        console.log('  advance                  - Advance to next rollout phase');
        console.log('  rollback                 - Rollback to previous phase');
        console.log('  status                   - Show current rollout status');
        console.log('  report                   - Generate migration report');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

module.exports = FeatureFlagManager;
