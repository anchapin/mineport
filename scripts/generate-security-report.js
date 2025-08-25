#!/usr/bin/env node
/**
 * Security Report Generator
 * Aggregates security scan results and generates comprehensive reports
 */

import fs from 'fs';
import path from 'path';

class SecurityReportGenerator {
  constructor() {
    this.timestamp = new Date().toISOString();
    this.workflowRun = process.env.GITHUB_RUN_ID || 'unknown';
    this.commit = process.env.GITHUB_SHA || 'unknown';
    this.branch = process.env.GITHUB_REF_NAME || 'unknown';
    this.repository = process.env.GITHUB_REPOSITORY || 'unknown';
  }

  /**
   * Parse CodeQL results from SARIF files
   */
  parseCodeQLResults() {
    const results = {
      status: 'completed',
      issues: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      details: []
    };

    try {
      // Look for CodeQL SARIF files
      const files = fs.readdirSync('.').filter(f => f.includes('codeql') && f.endsWith('.sarif'));

      for (const file of files) {
        const sarif = JSON.parse(fs.readFileSync(file, 'utf8'));

        if (sarif.runs && sarif.runs.length > 0) {
          for (const run of sarif.runs) {
            if (run.results) {
              results.issues += run.results.length;

              run.results.forEach(result => {
                const severity = this.getSeverityFromCodeQL(result);
                results[severity]++;

                results.details.push({
                  tool: 'CodeQL',
                  ruleId: result.ruleId,
                  message: result.message.text,
                  severity: severity,
                  file: result.locations?.[0]?.physicalLocation?.artifactLocation?.uri || 'unknown',
                  line: result.locations?.[0]?.physicalLocation?.region?.startLine || 0
                });
              });
            }
          }
        }
      }
    } catch (error) {
      console.log('Error parsing CodeQL results:', error.message);
      results.status = 'error';
    }

    return results;
  }

  /**
   * Parse dependency scan results
   */
  parseDependencyResults() {
    const results = {
      status: 'completed',
      vulnerabilities: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      packages: new Set(),
      details: []
    };

    // Parse npm audit results
    try {
      if (fs.existsSync('npm-audit-results.json')) {
        const npmAudit = JSON.parse(fs.readFileSync('npm-audit-results.json', 'utf8'));

        if (npmAudit.vulnerabilities) {
          Object.entries(npmAudit.vulnerabilities).forEach(([packageName, vulnData]) => {
            results.packages.add(packageName);

            vulnData.via.forEach(via => {
              if (typeof via === 'object' && via.title) {
                results.vulnerabilities++;
                results[via.severity]++;

                results.details.push({
                  tool: 'npm audit',
                  package: packageName,
                  title: via.title,
                  severity: via.severity,
                  cve: via.cve || null,
                  url: via.url || null
                });
              }
            });
          });
        }
      }
    } catch (error) {
      console.log('Error parsing npm audit results:', error.message);
    }

    // Parse Snyk results
    try {
      if (fs.existsSync('snyk-results.json')) {
        const snykResults = JSON.parse(fs.readFileSync('snyk-results.json', 'utf8'));

        if (snykResults.vulnerabilities) {
          snykResults.vulnerabilities.forEach(vuln => {
            results.vulnerabilities++;
            results[vuln.severity]++;
            results.packages.add(vuln.packageName);

            results.details.push({
              tool: 'Snyk',
              package: vuln.packageName,
              title: vuln.title,
              severity: vuln.severity,
              cve: vuln.identifiers?.CVE?.[0] || null,
              url: vuln.url || null
            });
          });
        }
      }
    } catch (error) {
      console.log('Error parsing Snyk results:', error.message);
    }

    results.packages = Array.from(results.packages);
    return results;
  }

  /**
   * Parse secret scan results
   */
  parseSecretResults() {
    const results = {
      status: 'completed',
      secrets: 0,
      details: []
    };

    try {
      if (fs.existsSync('results.sarif')) {
        const sarif = JSON.parse(fs.readFileSync('results.sarif', 'utf8'));

        if (sarif.runs && sarif.runs.length > 0) {
          for (const run of sarif.runs) {
            if (run.results) {
              results.secrets += run.results.length;

              run.results.forEach(result => {
                results.details.push({
                  tool: 'GitLeaks',
                  ruleId: result.ruleId,
                  message: result.message.text,
                  file: result.locations?.[0]?.physicalLocation?.artifactLocation?.uri || 'unknown',
                  line: result.locations?.[0]?.physicalLocation?.region?.startLine || 0
                });
              });
            }
          }
        }
      }
    } catch (error) {
      console.log('Error parsing secret scan results:', error.message);
      results.status = 'error';
    }

    return results;
  }

  /**
   * Parse container scan results
   */
  parseContainerResults() {
    const results = {
      status: 'completed',
      vulnerabilities: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      details: []
    };

    try {
      if (fs.existsSync('trivy-results.sarif')) {
        const sarif = JSON.parse(fs.readFileSync('trivy-results.sarif', 'utf8'));

        if (sarif.runs && sarif.runs.length > 0) {
          for (const run of sarif.runs) {
            if (run.results) {
              run.results.forEach(result => {
                const severity = this.getSeverityFromTrivy(result);
                results.vulnerabilities++;
                results[severity]++;

                results.details.push({
                  tool: 'Trivy',
                  ruleId: result.ruleId,
                  message: result.message.text,
                  severity: severity,
                  file: result.locations?.[0]?.physicalLocation?.artifactLocation?.uri || 'unknown'
                });
              });
            }
          }
        }
      }
    } catch (error) {
      console.log('Error parsing container scan results:', error.message);
      results.status = 'error';
    }

    return results;
  }

  /**
   * Get severity from CodeQL result
   */
  getSeverityFromCodeQL(result) {
    const level = result.level || 'note';
    const severity = result.properties?.['security-severity'];

    if (severity) {
      const score = parseFloat(severity);
      if (score >= 9.0) return 'critical';
      if (score >= 7.0) return 'high';
      if (score >= 4.0) return 'medium';
      return 'low';
    }

    switch (level) {
      case 'error': return 'high';
      case 'warning': return 'medium';
      case 'note': return 'low';
      default: return 'low';
    }
  }

  /**
   * Get severity from Trivy result
   */
  getSeverityFromTrivy(result) {
    const properties = result.properties || {};
    const severity = properties['security-severity'] || properties.severity;

    if (severity) {
      const severityLower = severity.toLowerCase();
      if (['critical'].includes(severityLower)) return 'critical';
      if (['high'].includes(severityLower)) return 'high';
      if (['medium', 'moderate'].includes(severityLower)) return 'medium';
      return 'low';
    }

    return 'medium'; // Default for container vulnerabilities
  }

  /**
   * Generate comprehensive security report
   */
  generateReport() {
    console.log('🔍 Generating comprehensive security report...');

    const codeql = this.parseCodeQLResults();
    const dependencies = this.parseDependencyResults();
    const secrets = this.parseSecretResults();
    const containers = this.parseContainerResults();

    const report = {
      metadata: {
        timestamp: this.timestamp,
        workflow_run: this.workflowRun,
        commit: this.commit,
        branch: this.branch,
        repository: this.repository,
        scan_version: '1.0.0'
      },
      summary: {
        overall_status: this.calculateOverallStatus(codeql, dependencies, secrets, containers),
        total_issues: codeql.issues + dependencies.vulnerabilities + secrets.secrets + containers.vulnerabilities,
        critical_issues: codeql.critical + dependencies.critical + containers.critical,
        high_issues: codeql.high + dependencies.high + containers.high,
        secrets_found: secrets.secrets
      },
      scans: {
        static_analysis: codeql,
        dependencies: dependencies,
        secrets: secrets,
        containers: containers
      },
      recommendations: this.generateRecommendations(codeql, dependencies, secrets, containers)
    };

    // Write detailed JSON report
    fs.writeFileSync('security-report.json', JSON.stringify(report, null, 2));

    // Generate human-readable report
    this.generateMarkdownReport(report);

    // Generate dashboard data
    this.generateDashboardData(report);

    console.log('✅ Security report generated successfully');
    return report;
  }

  /**
   * Calculate overall security status
   */
  calculateOverallStatus(codeql, dependencies, secrets, containers) {
    // Critical issues = immediate failure
    if (codeql.critical > 0 || dependencies.critical > 0 || containers.critical > 0) {
      return 'critical';
    }

    // Secrets = immediate failure
    if (secrets.secrets > 0) {
      return 'failed';
    }

    // High severity issues = warning
    if (codeql.high > 0 || dependencies.high > 0 || containers.high > 0) {
      return 'warning';
    }

    // Medium/low issues = passed with notes
    if (codeql.issues > 0 || dependencies.vulnerabilities > 0 || containers.vulnerabilities > 0) {
      return 'passed_with_issues';
    }

    return 'passed';
  }

  /**
   * Generate recommendations based on scan results
   */
  generateRecommendations(codeql, dependencies, secrets, containers) {
    const recommendations = [];

    if (secrets.secrets > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'secrets',
        title: 'Remove detected secrets immediately',
        description: `${secrets.secrets} potential secrets detected. Remove them and rotate any exposed credentials.`
      });
    }

    if (dependencies.critical > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'dependencies',
        title: 'Update critical dependency vulnerabilities',
        description: `${dependencies.critical} critical vulnerabilities in dependencies. Update affected packages immediately.`
      });
    }

    if (codeql.critical > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'code',
        title: 'Fix critical code security issues',
        description: `${codeql.critical} critical security issues detected in code. Review and fix immediately.`
      });
    }

    if (dependencies.high > 0) {
      recommendations.push({
        priority: 'high',
        category: 'dependencies',
        title: 'Address high-severity dependency vulnerabilities',
        description: `${dependencies.high} high-severity vulnerabilities in dependencies. Plan updates soon.`
      });
    }

    if (containers.vulnerabilities > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'containers',
        title: 'Review container security',
        description: `${containers.vulnerabilities} vulnerabilities detected in container images. Consider base image updates.`
      });
    }

    return recommendations;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    const md = `# Security Scan Report

**Repository:** ${report.metadata.repository}
**Branch:** ${report.metadata.branch}
**Commit:** ${report.metadata.commit}
**Timestamp:** ${report.metadata.timestamp}
**Overall Status:** ${report.summary.overall_status.toUpperCase()}

## Summary

- **Total Issues:** ${report.summary.total_issues}
- **Critical Issues:** ${report.summary.critical_issues}
- **High Severity Issues:** ${report.summary.high_issues}
- **Secrets Found:** ${report.summary.secrets_found}

## Scan Results

### Static Code Analysis (CodeQL)
- **Status:** ${report.scans.static_analysis.status}
- **Issues Found:** ${report.scans.static_analysis.issues}
- **Critical:** ${report.scans.static_analysis.critical}
- **High:** ${report.scans.static_analysis.high}
- **Medium:** ${report.scans.static_analysis.medium}
- **Low:** ${report.scans.static_analysis.low}

### Dependency Vulnerabilities
- **Status:** ${report.scans.dependencies.status}
- **Vulnerabilities:** ${report.scans.dependencies.vulnerabilities}
- **Affected Packages:** ${report.scans.dependencies.packages.length}
- **Critical:** ${report.scans.dependencies.critical}
- **High:** ${report.scans.dependencies.high}
- **Medium:** ${report.scans.dependencies.medium}
- **Low:** ${report.scans.dependencies.low}

### Secret Detection
- **Status:** ${report.scans.secrets.status}
- **Secrets Found:** ${report.scans.secrets.secrets}

### Container Security
- **Status:** ${report.scans.containers.status}
- **Vulnerabilities:** ${report.scans.containers.vulnerabilities}
- **Critical:** ${report.scans.containers.critical}
- **High:** ${report.scans.containers.high}
- **Medium:** ${report.scans.containers.medium}
- **Low:** ${report.scans.containers.low}

## Recommendations

${report.recommendations.map(rec =>
  `### ${rec.title} (${rec.priority.toUpperCase()})\n${rec.description}\n`
).join('\n')}

---
*Report generated by ModPorter-AI Security Pipeline*`;

    fs.writeFileSync('security-report.md', md);
  }

  /**
   * Generate dashboard data
   */
  generateDashboardData(report) {
    const dashboard = {
      timestamp: report.metadata.timestamp,
      status: report.summary.overall_status,
      metrics: {
        total_issues: report.summary.total_issues,
        critical_issues: report.summary.critical_issues,
        high_issues: report.summary.high_issues,
        secrets_found: report.summary.secrets_found
      },
      trends: {
        // This would be populated by comparing with historical data
        issues_trend: 'stable',
        security_score: this.calculateSecurityScore(report)
      }
    };

    fs.writeFileSync('security-dashboard.json', JSON.stringify(dashboard, null, 2));
  }

  /**
   * Calculate security score (0-100)
   */
  calculateSecurityScore(report) {
    let score = 100;

    // Deduct points for issues
    score -= report.summary.critical_issues * 20;
    score -= report.summary.high_issues * 10;
    score -= report.summary.secrets_found * 25;
    score -= (report.summary.total_issues - report.summary.critical_issues - report.summary.high_issues) * 2;

    return Math.max(0, score);
  }
}

// Main execution
async function main() {
  try {
    const generator = new SecurityReportGenerator();
    const report = generator.generateReport();

    // Set GitHub Actions outputs
    console.log(`::set-output name=overall_status::${report.summary.overall_status}`);
    console.log(`::set-output name=total_issues::${report.summary.total_issues}`);
    console.log(`::set-output name=critical_issues::${report.summary.critical_issues}`);
    console.log(`::set-output name=secrets_found::${report.summary.secrets_found}`);
    console.log(`::set-output name=security_score::${generator.calculateSecurityScore(report)}`);

    console.log('✅ Security report generation completed');
  } catch (error) {
    console.error('❌ Security report generation failed:', error.message);
    process.exit(1);
  }
}

// Execute if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SecurityReportGenerator;
