#!/usr/bin/env node

/**
 * Security Patch Automation Script
 *
 * This script provides advanced security patch automation capabilities including:
 * - Security vulnerability detection and prioritization
 * - Automated patch application with validation
 * - Risk assessment for auto-merge decisions
 * - Integration with existing test infrastructure
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

class SecurityPatchAutomation {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      autoMerge: options.autoMerge !== false,
      maxSeverity: options.maxSeverity || 'high',
      testTimeout: options.testTimeout || 300000, // 5 minutes
      ...options,
    };

    this.vulnerabilities = [];
    this.patchResults = [];
  }

  /**
   * Main entry point for security patch automation
   */
  async run() {
    console.log('🔒 Starting Security Patch Automation');
    console.log(`Options: ${JSON.stringify(this.options, null, 2)}`);

    try {
      // Step 1: Scan for vulnerabilities
      await this.scanVulnerabilities();

      // Step 2: Prioritize vulnerabilities
      await this.prioritizeVulnerabilities();

      // Step 3: Apply patches
      await this.applySecurityPatches();

      // Step 4: Generate report
      await this.generateReport();

      console.log('✅ Security patch automation completed successfully');
      return this.patchResults;
    } catch (error) {
      console.error('❌ Security patch automation failed:', error.message);
      throw error;
    }
  }

  /**
   * Scan for security vulnerabilities using npm audit
   */
  async scanVulnerabilities() {
    console.log('🔍 Scanning for security vulnerabilities...');

    try {
      // Run npm audit with JSON output
      const auditOutput = execSync('npm audit --json', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const auditData = JSON.parse(auditOutput);

      if (auditData.vulnerabilities) {
        this.vulnerabilities = Object.entries(auditData.vulnerabilities).map(([name, vuln]) => ({
          name,
          severity: vuln.severity,
          via: vuln.via,
          range: vuln.range,
          fixAvailable: vuln.fixAvailable,
          effects: vuln.effects || [],
          nodes: vuln.nodes || [],
        }));
      }

      console.log(`Found ${this.vulnerabilities.length} vulnerabilities`);
    } catch (error) {
      if (error.status === 1) {
        // npm audit returns exit code 1 when vulnerabilities are found
        try {
          const auditData = JSON.parse(error.stdout);
          if (auditData.vulnerabilities) {
            this.vulnerabilities = Object.entries(auditData.vulnerabilities).map(
              ([name, vuln]) => ({
                name,
                severity: vuln.severity,
                via: vuln.via,
                range: vuln.range,
                fixAvailable: vuln.fixAvailable,
                effects: vuln.effects || [],
                nodes: vuln.nodes || [],
              })
            );
          }
          console.log(`Found ${this.vulnerabilities.length} vulnerabilities`);
        } catch (parseError) {
          console.error('Failed to parse audit output:', parseError.message);
          throw parseError;
        }
      } else {
        console.error('Failed to run npm audit:', error.message);
        throw error;
      }
    }
  }

  /**
   * Prioritize vulnerabilities based on severity and fix availability
   */
  async prioritizeVulnerabilities() {
    console.log('📊 Prioritizing vulnerabilities...');

    const severityOrder = { critical: 1, high: 2, moderate: 3, low: 4 };

    this.vulnerabilities = this.vulnerabilities
      .filter((vuln) => this.shouldProcessVulnerability(vuln))
      .sort((a, b) => {
        // Sort by severity first
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;

        // Then by fix availability
        if (a.fixAvailable && !b.fixAvailable) return -1;
        if (!a.fixAvailable && b.fixAvailable) return 1;

        return 0;
      });

    console.log(`Prioritized ${this.vulnerabilities.length} vulnerabilities for processing`);

    // Log prioritization summary
    const summary = this.vulnerabilities.reduce((acc, vuln) => {
      acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
      return acc;
    }, {});

    console.log('Vulnerability summary by severity:', summary);
  }

  /**
   * Check if a vulnerability should be processed based on configuration
   */
  shouldProcessVulnerability(vulnerability) {
    const severityOrder = { critical: 1, high: 2, moderate: 3, low: 4 };
    const maxSeverityLevel = severityOrder[this.options.maxSeverity];
    const vulnSeverityLevel = severityOrder[vulnerability.severity];

    return vulnSeverityLevel <= maxSeverityLevel;
  }

  /**
   * Apply security patches for prioritized vulnerabilities
   */
  async applySecurityPatches() {
    console.log('🔧 Applying security patches...');

    for (const vulnerability of this.vulnerabilities) {
      console.log(`\nProcessing ${vulnerability.name} (${vulnerability.severity})...`);

      try {
        const patchResult = await this.applyPatch(vulnerability);
        this.patchResults.push(patchResult);

        if (patchResult.success) {
          console.log(`✅ Successfully patched ${vulnerability.name}`);
        } else {
          console.log(`⚠️ Failed to patch ${vulnerability.name}: ${patchResult.error}`);
        }
      } catch (error) {
        console.error(`❌ Error patching ${vulnerability.name}:`, error.message);
        this.patchResults.push({
          vulnerability: vulnerability.name,
          success: false,
          error: error.message,
          autoMergeEligible: false,
        });
      }
    }
  }

  /**
   * Apply a single security patch
   */
  async applyPatch(vulnerability) {
    const result = {
      vulnerability: vulnerability.name,
      severity: vulnerability.severity,
      success: false,
      error: null,
      autoMergeEligible: false,
      testsRun: [],
      validationResults: {},
    };

    try {
      // Check if fix is available
      if (!vulnerability.fixAvailable) {
        result.error = 'No automatic fix available';
        return result;
      }

      if (this.options.dryRun) {
        console.log(`[DRY RUN] Would apply patch for ${vulnerability.name}`);
        result.success = true;
        result.autoMergeEligible = this.isAutoMergeEligible(vulnerability);
        return result;
      }

      // Create backup of package files
      await this.createBackup();

      // Apply the security fix
      console.log(`Applying security fix for ${vulnerability.name}...`);

      try {
        execSync(`npm audit fix --only=prod --audit-level=${vulnerability.severity}`, {
          cwd: projectRoot,
          stdio: 'pipe',
        });
      } catch (fixError) {
        // Try force fix for stubborn vulnerabilities
        console.log('Standard fix failed, trying force fix...');
        execSync(`npm audit fix --force --only=prod --audit-level=${vulnerability.severity}`, {
          cwd: projectRoot,
          stdio: 'pipe',
        });
      }

      // Validate the fix
      const validationResult = await this.validatePatch(vulnerability);
      result.validationResults = validationResult;

      if (!validationResult.isValid) {
        // Restore backup if validation fails
        await this.restoreBackup();
        result.error = 'Patch validation failed';
        return result;
      }

      // Run security tests
      const testResults = await this.runSecurityTests();
      result.testsRun = testResults.testsRun;

      if (!testResults.success) {
        // Restore backup if tests fail
        await this.restoreBackup();
        result.error = 'Security tests failed after patch';
        return result;
      }

      // Determine auto-merge eligibility
      result.autoMergeEligible =
        this.isAutoMergeEligible(vulnerability) && validationResult.isValid && testResults.success;

      result.success = true;
      console.log(`✅ Successfully applied and validated patch for ${vulnerability.name}`);
    } catch (error) {
      result.error = error.message;

      // Restore backup on any error
      try {
        await this.restoreBackup();
      } catch (restoreError) {
        console.error('Failed to restore backup:', restoreError.message);
      }
    }

    return result;
  }

  /**
   * Validate that a patch was applied correctly
   */
  async validatePatch(vulnerability) {
    console.log(`Validating patch for ${vulnerability.name}...`);

    const validation = {
      isValid: true,
      checks: [],
      warnings: [],
    };

    try {
      // Check if the vulnerability is still present
      const auditOutput = execSync('npm audit --json', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const auditData = JSON.parse(auditOutput);

      if (auditData.vulnerabilities && auditData.vulnerabilities[vulnerability.name]) {
        validation.isValid = false;
        validation.checks.push({
          name: 'vulnerability_resolved',
          status: 'failed',
          message: 'Vulnerability still present after patch',
        });
      } else {
        validation.checks.push({
          name: 'vulnerability_resolved',
          status: 'passed',
          message: 'Vulnerability successfully resolved',
        });
      }
    } catch (error) {
      if (error.status === 0) {
        // No vulnerabilities found - this is good
        validation.checks.push({
          name: 'vulnerability_resolved',
          status: 'passed',
          message: 'No vulnerabilities found after patch',
        });
      } else {
        validation.warnings.push(`Audit validation inconclusive: ${error.message}`);
      }
    }

    // Validate package integrity
    try {
      execSync('npm ls --depth=0', { cwd: projectRoot, stdio: 'pipe' });
      validation.checks.push({
        name: 'package_integrity',
        status: 'passed',
        message: 'Package tree is valid',
      });
    } catch (error) {
      validation.isValid = false;
      validation.checks.push({
        name: 'package_integrity',
        status: 'failed',
        message: 'Package tree has issues',
      });
    }

    // Check for peer dependency warnings
    try {
      const lsOutput = execSync('npm ls --depth=0 2>&1', {
        cwd: projectRoot,
        encoding: 'utf8',
      });

      if (lsOutput.includes('WARN')) {
        validation.warnings.push('Peer dependency warnings detected');
      }
    } catch (error) {
      // npm ls can exit with non-zero even with warnings
      if (error.stdout && error.stdout.includes('WARN')) {
        validation.warnings.push('Peer dependency warnings detected');
      }
    }

    return validation;
  }

  /**
   * Run security-specific tests
   */
  async runSecurityTests() {
    console.log('🧪 Running security tests...');

    const testResult = {
      success: true,
      testsRun: [],
      errors: [],
    };

    try {
      // Run security test suite
      console.log('Running security test suite...');
      execSync('npm run test:security', {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: this.options.testTimeout,
      });

      testResult.testsRun.push('security');
      console.log('✅ Security tests passed');
    } catch (error) {
      testResult.success = false;
      testResult.errors.push(`Security tests failed: ${error.message}`);
      console.log('❌ Security tests failed');
    }

    // Run dependency validation
    try {
      console.log('Running dependency validation...');
      execSync('npm run deps:validate', {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: this.options.testTimeout,
      });

      testResult.testsRun.push('dependency-validation');
      console.log('✅ Dependency validation passed');
    } catch (error) {
      testResult.success = false;
      testResult.errors.push(`Dependency validation failed: ${error.message}`);
      console.log('❌ Dependency validation failed');
    }

    // Run unit tests to ensure no regressions
    try {
      console.log('Running unit tests for regression detection...');
      execSync('npm run test:unit', {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: this.options.testTimeout,
      });

      testResult.testsRun.push('unit');
      console.log('✅ Unit tests passed');
    } catch (error) {
      // Unit test failures are warnings for security patches
      testResult.errors.push(`Unit tests failed (warning): ${error.message}`);
      console.log('⚠️ Unit tests failed (non-blocking for security patches)');
    }

    return testResult;
  }

  /**
   * Determine if a vulnerability patch is eligible for auto-merge
   */
  isAutoMergeEligible(vulnerability) {
    if (!this.options.autoMerge) {
      return false;
    }

    // Auto-merge criteria:
    // 1. Low or moderate severity
    // 2. Fix is available
    // 3. Not a major version change (would need more sophisticated detection)

    const autoMergeSeverities = ['low', 'moderate'];

    return autoMergeSeverities.includes(vulnerability.severity) && vulnerability.fixAvailable;
  }

  /**
   * Create backup of package files
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(projectRoot, '.security-patch-backup', timestamp);

    execSync(`mkdir -p "${backupDir}"`, { cwd: projectRoot });
    execSync(`cp package.json package-lock.json "${backupDir}/"`, { cwd: projectRoot });

    this.backupDir = backupDir;
    console.log(`Created backup at ${backupDir}`);
  }

  /**
   * Restore backup of package files
   */
  async restoreBackup() {
    if (!this.backupDir || !existsSync(this.backupDir)) {
      console.warn('No backup available to restore');
      return;
    }

    execSync(`cp "${this.backupDir}/package.json" "${this.backupDir}/package-lock.json" .`, {
      cwd: projectRoot,
    });

    // Reinstall dependencies
    execSync('npm ci --prefer-offline --no-audit', { cwd: projectRoot, stdio: 'pipe' });

    console.log('Restored backup and reinstalled dependencies');
  }

  /**
   * Generate comprehensive report of patch results
   */
  async generateReport() {
    console.log('📊 Generating security patch report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalVulnerabilities: this.vulnerabilities.length,
        patchesAttempted: this.patchResults.length,
        patchesSuccessful: this.patchResults.filter((r) => r.success).length,
        patchesFailed: this.patchResults.filter((r) => !r.success).length,
        autoMergeEligible: this.patchResults.filter((r) => r.autoMergeEligible).length,
      },
      vulnerabilities: this.vulnerabilities,
      patchResults: this.patchResults,
      recommendations: this.generateRecommendations(),
    };

    // Write report to file
    const reportPath = join(projectRoot, 'security-patch-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown summary
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = join(projectRoot, 'security-patch-report.md');
    writeFileSync(markdownPath, markdownReport);

    console.log(`Report generated: ${reportPath}`);
    console.log(`Markdown summary: ${markdownPath}`);

    // Print summary to console
    console.log('\n📊 Security Patch Summary:');
    console.log(`  Total vulnerabilities: ${report.summary.totalVulnerabilities}`);
    console.log(`  Patches attempted: ${report.summary.patchesAttempted}`);
    console.log(`  Patches successful: ${report.summary.patchesSuccessful}`);
    console.log(`  Patches failed: ${report.summary.patchesFailed}`);
    console.log(`  Auto-merge eligible: ${report.summary.autoMergeEligible}`);

    return report;
  }

  /**
   * Generate recommendations based on patch results
   */
  generateRecommendations() {
    const recommendations = [];

    const failedPatches = this.patchResults.filter((r) => !r.success);
    if (failedPatches.length > 0) {
      recommendations.push({
        type: 'manual_intervention',
        priority: 'high',
        message: `${failedPatches.length} vulnerabilities require manual intervention`,
        details: failedPatches.map((p) => `${p.vulnerability}: ${p.error}`),
      });
    }

    const criticalVulns = this.vulnerabilities.filter((v) => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      recommendations.push({
        type: 'urgent_review',
        priority: 'critical',
        message: `${criticalVulns.length} critical vulnerabilities detected`,
        details: criticalVulns.map((v) => v.name),
      });
    }

    const autoMergeEligible = this.patchResults.filter((r) => r.autoMergeEligible);
    if (autoMergeEligible.length > 0) {
      recommendations.push({
        type: 'auto_merge',
        priority: 'medium',
        message: `${autoMergeEligible.length} patches are eligible for auto-merge`,
        details: autoMergeEligible.map((p) => p.vulnerability),
      });
    }

    return recommendations;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    return `# Security Patch Report

Generated: ${report.timestamp}

## Summary

| Metric | Count |
|--------|-------|
| Total Vulnerabilities | ${report.summary.totalVulnerabilities} |
| Patches Attempted | ${report.summary.patchesAttempted} |
| Patches Successful | ${report.summary.patchesSuccessful} |
| Patches Failed | ${report.summary.patchesFailed} |
| Auto-merge Eligible | ${report.summary.autoMergeEligible} |

## Patch Results

${report.patchResults
  .map(
    (result) => `
### ${result.vulnerability}

- **Severity**: ${result.severity}
- **Status**: ${result.success ? '✅ Success' : '❌ Failed'}
- **Auto-merge Eligible**: ${result.autoMergeEligible ? 'Yes' : 'No'}
${result.error ? `- **Error**: ${result.error}` : ''}
${result.testsRun.length > 0 ? `- **Tests Run**: ${result.testsRun.join(', ')}` : ''}
`
  )
  .join('\n')}

## Recommendations

${report.recommendations
  .map(
    (rec) => `
### ${rec.type.replace('_', ' ').toUpperCase()} (${rec.priority})

${rec.message}

${rec.details ? rec.details.map((d) => `- ${d}`).join('\n') : ''}
`
  )
  .join('\n')}

---
*Report generated by Security Patch Automation*`;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--no-auto-merge':
        options.autoMerge = false;
        break;
      case '--max-severity':
        options.maxSeverity = args[++i];
        break;
      case '--timeout':
        options.testTimeout = parseInt(args[++i]) * 1000;
        break;
      case '--help':
        console.log(`
Security Patch Automation Script

Usage: node security-patch-automation.js [options]

Options:
  --dry-run              Perform dry run without applying patches
  --no-auto-merge        Disable auto-merge for eligible patches
  --max-severity LEVEL   Maximum severity to process (critical, high, moderate, low)
  --timeout SECONDS      Test timeout in seconds (default: 300)
  --help                 Show this help message

Examples:
  node security-patch-automation.js --dry-run
  node security-patch-automation.js --max-severity high --no-auto-merge
        `);
        process.exit(0);
    }
  }

  const automation = new SecurityPatchAutomation(options);

  automation
    .run()
    .then((results) => {
      console.log('\n✅ Security patch automation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Security patch automation failed:', error.message);
      process.exit(1);
    });
}

export default SecurityPatchAutomation;
