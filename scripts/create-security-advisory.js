#!/usr/bin/env node

/**
 * Script to create GitHub Security Advisories for high-severity vulnerabilities
 * This script processes vulnerability scan results and creates advisories automatically
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityAdvisoryCreator {
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
    this.repoOwner = process.env.GITHUB_REPOSITORY?.split('/')[0];
    this.repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
    this.severityThreshold = process.env.SECURITY_SEVERITY_THRESHOLD || 'high';
  }

  /**
   * Parse vulnerability results from various sources
   */
  parseVulnerabilities() {
    const vulnerabilities = [];

    // Parse npm audit results
    try {
      const npmAuditPath = 'npm-audit-results.json';
      if (fs.existsSync(npmAuditPath)) {
        const npmAudit = JSON.parse(fs.readFileSync(npmAuditPath, 'utf8'));
        vulnerabilities.push(...this.parseNpmAudit(npmAudit));
      }
    } catch (error) {
      console.log('Error parsing npm audit results:', error.message);
    }

    // Parse enhanced npm audit results
    try {
      const npmAuditRawPath = 'npm-audit-raw.json';
      if (fs.existsSync(npmAuditRawPath)) {
        const npmAuditRaw = JSON.parse(fs.readFileSync(npmAuditRawPath, 'utf8'));
        vulnerabilities.push(...this.parseEnhancedNpmAudit(npmAuditRaw));
      }
    } catch (error) {
      console.log('Error parsing enhanced npm audit results:', error.message);
    }

    return this.filterHighSeverity(vulnerabilities);
  }

  /**
   * Parse npm audit results
   */
  parseNpmAudit(auditResults) {
    const vulnerabilities = [];

    if (auditResults.vulnerabilities) {
      Object.entries(auditResults.vulnerabilities).forEach(([packageName, vulnData]) => {
        vulnData.via.forEach((via) => {
          if (typeof via === 'object' && via.title) {
            vulnerabilities.push({
              source: 'npm-audit',
              package: packageName,
              title: via.title,
              severity: via.severity,
              cve: via.cve || null,
              url: via.url || null,
              range: via.range || null,
              description: `Vulnerability in ${packageName}: ${via.title}`,
            });
          }
        });
      });
    }

    return vulnerabilities;
  }

  /**
   * Parse enhanced npm audit results
   */
  parseEnhancedNpmAudit(npmAuditRaw) {
    const vulnerabilities = [];

    if (npmAuditRaw.vulnerabilities) {
      Object.entries(npmAuditRaw.vulnerabilities).forEach(([packageName, vulnData]) => {
        vulnerabilities.push({
          source: 'npm-audit-enhanced',
          package: packageName,
          title: vulnData.title || `${vulnData.severity} vulnerability in ${packageName}`,
          severity: vulnData.severity,
          cve: vulnData.cve || null,
          url: vulnData.url || null,
          range: vulnData.range || null,
          description: vulnData.title || `Vulnerability in ${packageName}: ${vulnData.severity} severity`,
        });
      });
    }

    return vulnerabilities;
  }

  /**
   * Filter vulnerabilities by severity threshold
   */
  filterHighSeverity(vulnerabilities) {
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const threshold = severityLevels[this.severityThreshold] || 3;

    return vulnerabilities.filter((vuln) => {
      const vulnLevel = severityLevels[vuln.severity] || 0;
      return vulnLevel >= threshold;
    });
  }

  /**
   * Create GitHub Security Advisory
   */
  async createSecurityAdvisory(vulnerability) {
    const advisory = {
      summary: `Security vulnerability in ${vulnerability.package}`,
      description: vulnerability.description,
      severity: vulnerability.severity.toUpperCase(),
      cve_id: vulnerability.cve,
      vulnerabilities: [
        {
          package: {
            ecosystem: 'npm',
            name: vulnerability.package,
          },
          vulnerable_version_range: vulnerability.range || '< 0.0.0',
          patched_versions: 'See advisory for details',
        },
      ],
    };

    console.log(`Creating security advisory for ${vulnerability.package}:`);
    console.log(JSON.stringify(advisory, null, 2));

    // In a real implementation, this would use the GitHub API
    // For now, we'll create an issue instead
    return this.createSecurityIssue(vulnerability);
  }

  /**
   * Create a security issue as a fallback
   */
  createSecurityIssue(vulnerability) {
    const issueBody = `## Security Vulnerability Detected

**Package:** ${vulnerability.package}
**Severity:** ${vulnerability.severity.toUpperCase()}
**Source:** ${vulnerability.source}

### Description
${vulnerability.description}

### Details
- **CVE:** ${vulnerability.cve || 'Not assigned'}
- **Affected Version:** ${vulnerability.range || 'Unknown'}
- **Reference:** ${vulnerability.url || 'Not available'}

### Recommended Actions
1. Update the affected package to a patched version
2. Review the vulnerability details at the provided reference URL
3. Test the application after updating dependencies
4. Consider implementing additional security measures if needed

### Automated Detection
This issue was automatically created by the security scanning pipeline.
Scan timestamp: ${new Date().toISOString()}
Workflow run: ${process.env.GITHUB_RUN_ID || 'Unknown'}

---
**Priority:** ${vulnerability.severity === 'critical' ? 'P0 - Critical' : 'P1 - High'}
**Labels:** security, vulnerability, ${vulnerability.severity}, automated`;

    try {
      // Create the issue using GitHub CLI if available
      const command = `gh issue create --title "Security: ${vulnerability.severity} vulnerability in ${vulnerability.package}" --body "${issueBody.replace(/"/g, '\\"')}" --label "security,vulnerability,${vulnerability.severity}"`;

      console.log('Creating security issue...');
      execSync(command, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error('Failed to create security issue:', error.message);

      // Fallback: write to file for manual processing
      const issueFile = `security-issue-${vulnerability.package}-${Date.now()}.md`;
      fs.writeFileSync(issueFile, `# Security Issue\n\n${issueBody}`);
      console.log(`Security issue details written to ${issueFile}`);
      return false;
    }
  }

  /**
   * Process all vulnerabilities and create advisories
   */
  async processVulnerabilities() {
    console.log('🔍 Processing security vulnerabilities...');

    const vulnerabilities = this.parseVulnerabilities();

    if (vulnerabilities.length === 0) {
      console.log('✅ No high-severity vulnerabilities found');
      return { created: 0, total: 0 };
    }

    console.log(`⚠️  Found ${vulnerabilities.length} high-severity vulnerabilities`);

    let created = 0;
    for (const vulnerability of vulnerabilities) {
      try {
        const success = await this.createSecurityAdvisory(vulnerability);
        if (success) created++;
      } catch (error) {
        console.error(`Failed to create advisory for ${vulnerability.package}:`, error.message);
      }
    }

    console.log(
      `📋 Created ${created} security advisories out of ${vulnerabilities.length} vulnerabilities`
    );
    return { created, total: vulnerabilities.length };
  }
}

// Main execution
async function main() {
  try {
    const creator = new SecurityAdvisoryCreator();
    const result = await creator.processVulnerabilities();

    // Set GitHub Actions outputs
    console.log(`::set-output name=advisories_created::${result.created}`);
    console.log(`::set-output name=vulnerabilities_total::${result.total}`);

    // Exit with error code if vulnerabilities were found but not all advisories were created
    if (result.total > 0 && result.created < result.total) {
      console.error('❌ Some security advisories could not be created');
      process.exit(1);
    }

    console.log('✅ Security advisory processing completed');
  } catch (error) {
    console.error('❌ Security advisory processing failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SecurityAdvisoryCreator;
