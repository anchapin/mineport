#!/usr/bin/env node

/**
 * Artifact Security Management Utility
 * Provides comprehensive security scanning, signing, and compliance features for artifacts
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class ArtifactSecurity {
  constructor(options = {}) {
    this.options = {
      artifactsDir: options.artifactsDir || 'artifacts',
      outputDir: options.outputDir || 'security-reports',
      gpgKeyId: options.gpgKeyId,
      enableSigning: options.enableSigning !== false,
      enableScanning: options.enableScanning !== false,
      ...options
    };
    
    this.securityReport = {
      timestamp: new Date().toISOString(),
      artifacts: [],
      vulnerabilities: [],
      signatures: [],
      compliance: {
        scanned: false,
        signed: false,
        audit_trail: false
      }
    };
  }

  /**
   * Perform comprehensive security operations on artifacts
   */
  async secureArtifacts() {
    console.log('Starting artifact security operations...');
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.options.outputDir)) {
        fs.mkdirSync(this.options.outputDir, { recursive: true });
      }

      // Scan artifacts for vulnerabilities
      if (this.options.enableScanning) {
        await this.scanArtifacts();
      }

      // Sign artifacts
      if (this.options.enableSigning) {
        await this.signArtifacts();
      }

      // Generate compliance report
      await this.generateComplianceReport();

      // Create audit trail
      await this.createAuditTrail();

      console.log('Artifact security operations completed successfully');
      return this.securityReport;

    } catch (error) {
      console.error('Error in artifact security operations:', error.message);
      throw error;
    }
  }

  /**
   * Scan artifacts for security vulnerabilities
   */
  async scanArtifacts() {
    console.log('Scanning artifacts for security vulnerabilities...');
    
    if (!fs.existsSync(this.options.artifactsDir)) {
      throw new Error(`Artifacts directory not found: ${this.options.artifactsDir}`);
    }

    const artifacts = fs.readdirSync(this.options.artifactsDir)
      .filter(file => fs.statSync(path.join(this.options.artifactsDir, file)).isFile());

    for (const artifact of artifacts) {
      const artifactPath = path.join(this.options.artifactsDir, artifact);
      console.log(`Scanning ${artifact}...`);

      const scanResult = {
        name: artifact,
        path: artifactPath,
        size: fs.statSync(artifactPath).size,
        checksums: this.generateChecksums(artifactPath),
        vulnerabilities: [],
        scan_timestamp: new Date().toISOString()
      };

      // Perform different scans based on file type
      if (artifact.endsWith('.tgz') || artifact.endsWith('.tar.gz')) {
        await this.scanNpmPackage(artifactPath, scanResult);
      } else if (artifact.endsWith('.zip')) {
        await this.scanZipArchive(artifactPath, scanResult);
      } else if (artifact.endsWith('.json')) {
        await this.scanJsonFile(artifactPath, scanResult);
      }

      this.securityReport.artifacts.push(scanResult);
    }

    this.securityReport.compliance.scanned = true;
    console.log(`Scanned ${artifacts.length} artifacts`);
  }

  /**
   * Scan npm package for vulnerabilities
   */
  async scanNpmPackage(packagePath, scanResult) {
    try {
      // Extract package to temporary directory
      const tempDir = path.join(this.options.outputDir, 'temp-extract', path.basename(packagePath));
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Extract package
      execSync(`tar -xzf "${packagePath}" -C "${tempDir}"`, { stdio: 'pipe' });

      // Check for package.json
      const packageJsonPath = path.join(tempDir, 'package', 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Basic security checks
        const securityIssues = this.checkPackageJsonSecurity(packageJson);
        scanResult.vulnerabilities.push(...securityIssues);
      }

      // Scan for sensitive files
      const sensitiveFiles = this.findSensitiveFiles(tempDir);
      if (sensitiveFiles.length > 0) {
        scanResult.vulnerabilities.push({
          type: 'sensitive_files',
          severity: 'medium',
          description: 'Sensitive files found in package',
          files: sensitiveFiles
        });
      }

      // Scan for large files that might indicate issues
      const largeFiles = this.findLargeFiles(tempDir, 10 * 1024 * 1024); // 10MB threshold
      if (largeFiles.length > 0) {
        scanResult.vulnerabilities.push({
          type: 'large_files',
          severity: 'low',
          description: 'Unusually large files found',
          files: largeFiles
        });
      }

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });

    } catch (error) {
      console.warn(`Error scanning npm package ${packagePath}:`, error.message);
      scanResult.vulnerabilities.push({
        type: 'scan_error',
        severity: 'unknown',
        description: `Failed to scan package: ${error.message}`
      });
    }
  }

  /**
   * Scan zip archive for vulnerabilities
   */
  async scanZipArchive(zipPath, scanResult) {
    try {
      // Extract zip to temporary directory
      const tempDir = path.join(this.options.outputDir, 'temp-extract', path.basename(zipPath));
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Extract zip
      execSync(`unzip -q "${zipPath}" -d "${tempDir}"`, { stdio: 'pipe' });

      // Scan for sensitive files
      const sensitiveFiles = this.findSensitiveFiles(tempDir);
      if (sensitiveFiles.length > 0) {
        scanResult.vulnerabilities.push({
          type: 'sensitive_files',
          severity: 'medium',
          description: 'Sensitive files found in archive',
          files: sensitiveFiles
        });
      }

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });

    } catch (error) {
      console.warn(`Error scanning zip archive ${zipPath}:`, error.message);
      scanResult.vulnerabilities.push({
        type: 'scan_error',
        severity: 'unknown',
        description: `Failed to scan archive: ${error.message}`
      });
    }
  }

  /**
   * Scan JSON file for security issues
   */
  async scanJsonFile(jsonPath, scanResult) {
    try {
      const content = fs.readFileSync(jsonPath, 'utf8');
      
      // Validate JSON format
      try {
        JSON.parse(content);
      } catch (error) {
        scanResult.vulnerabilities.push({
          type: 'invalid_json',
          severity: 'medium',
          description: 'Invalid JSON format',
          details: error.message
        });
        return;
      }

      // Check for sensitive data patterns
      const sensitivePatterns = [
        /password["\s]*[:=]["\s]*[^"\s]+/i,
        /api[_-]?key["\s]*[:=]["\s]*[^"\s]+/i,
        /secret["\s]*[:=]["\s]*[^"\s]+/i,
        /token["\s]*[:=]["\s]*[^"\s]+/i,
        /private[_-]?key["\s]*[:=]/i
      ];

      sensitivePatterns.forEach((pattern, index) => {
        if (pattern.test(content)) {
          scanResult.vulnerabilities.push({
            type: 'sensitive_data',
            severity: 'high',
            description: 'Potential sensitive data found in JSON',
            pattern: `Pattern ${index + 1}`
          });
        }
      });

    } catch (error) {
      console.warn(`Error scanning JSON file ${jsonPath}:`, error.message);
      scanResult.vulnerabilities.push({
        type: 'scan_error',
        severity: 'unknown',
        description: `Failed to scan JSON: ${error.message}`
      });
    }
  }

  /**
   * Check package.json for security issues
   */
  checkPackageJsonSecurity(packageJson) {
    const issues = [];

    // Check for suspicious scripts
    if (packageJson.scripts) {
      const suspiciousCommands = ['curl', 'wget', 'rm -rf', 'sudo', 'chmod +x'];
      
      Object.entries(packageJson.scripts).forEach(([scriptName, command]) => {
        suspiciousCommands.forEach(suspiciousCmd => {
          if (command.includes(suspiciousCmd)) {
            issues.push({
              type: 'suspicious_script',
              severity: 'medium',
              description: `Suspicious command in script "${scriptName}": ${suspiciousCmd}`,
              script: scriptName,
              command: command
            });
          }
        });
      });
    }

    // Check for missing security fields
    if (!packageJson.license) {
      issues.push({
        type: 'missing_license',
        severity: 'low',
        description: 'Package is missing license information'
      });
    }

    // Check for overly permissive file patterns
    if (packageJson.files && packageJson.files.includes('*')) {
      issues.push({
        type: 'permissive_files',
        severity: 'low',
        description: 'Package includes all files (*)  which may expose sensitive data'
      });
    }

    return issues;
  }

  /**
   * Find sensitive files in directory
   */
  findSensitiveFiles(directory) {
    const sensitivePatterns = [
      /\.env$/,
      /\.key$/,
      /\.pem$/,
      /\.p12$/,
      /\.pfx$/,
      /id_rsa$/,
      /id_dsa$/,
      /\.ssh\/.*$/,
      /password/i,
      /secret/i,
      /\.git\/config$/
    ];

    const sensitiveFiles = [];
    
    const scanDirectory = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        entries.forEach(entry => {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(directory, fullPath);
          
          if (entry.isDirectory()) {
            scanDirectory(fullPath);
          } else {
            sensitivePatterns.forEach(pattern => {
              if (pattern.test(relativePath)) {
                sensitiveFiles.push(relativePath);
              }
            });
          }
        });
      } catch (error) {
        // Ignore permission errors
      }
    };

    scanDirectory(directory);
    return sensitiveFiles;
  }

  /**
   * Find files larger than threshold
   */
  findLargeFiles(directory, threshold) {
    const largeFiles = [];
    
    const scanDirectory = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        entries.forEach(entry => {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(directory, fullPath);
          
          if (entry.isDirectory()) {
            scanDirectory(fullPath);
          } else {
            const stats = fs.statSync(fullPath);
            if (stats.size > threshold) {
              largeFiles.push({
                path: relativePath,
                size: stats.size
              });
            }
          }
        });
      } catch (error) {
        // Ignore permission errors
      }
    };

    scanDirectory(directory);
    return largeFiles;
  }

  /**
   * Generate checksums for file
   */
  generateChecksums(filePath) {
    const data = fs.readFileSync(filePath);
    
    return {
      md5: crypto.createHash('md5').update(data).digest('hex'),
      sha1: crypto.createHash('sha1').update(data).digest('hex'),
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      sha512: crypto.createHash('sha512').update(data).digest('hex')
    };
  }

  /**
   * Sign artifacts with GPG
   */
  async signArtifacts() {
    console.log('Signing artifacts with GPG...');
    
    try {
      // Check if GPG is available
      execSync('gpg --version', { stdio: 'pipe' });
    } catch (error) {
      console.warn('GPG not available, skipping signing');
      return;
    }

    const signaturesDir = path.join(this.options.outputDir, 'signatures');
    if (!fs.existsSync(signaturesDir)) {
      fs.mkdirSync(signaturesDir, { recursive: true });
    }

    const artifacts = fs.readdirSync(this.options.artifactsDir)
      .filter(file => fs.statSync(path.join(this.options.artifactsDir, file)).isFile());

    for (const artifact of artifacts) {
      const artifactPath = path.join(this.options.artifactsDir, artifact);
      const signaturePath = path.join(signaturesDir, `${artifact}.asc`);

      try {
        console.log(`Signing ${artifact}...`);
        
        // Create detached signature
        const gpgCommand = this.options.gpgKeyId 
          ? `gpg --armor --detach-sign --local-user ${this.options.gpgKeyId} --output "${signaturePath}" "${artifactPath}"`
          : `gpg --armor --detach-sign --output "${signaturePath}" "${artifactPath}"`;
        
        execSync(gpgCommand, { stdio: 'pipe' });

        // Verify signature
        execSync(`gpg --verify "${signaturePath}" "${artifactPath}"`, { stdio: 'pipe' });

        this.securityReport.signatures.push({
          artifact: artifact,
          signature: `${artifact}.asc`,
          created_at: new Date().toISOString(),
          verified: true
        });

        console.log(`✅ Successfully signed ${artifact}`);

      } catch (error) {
        console.error(`❌ Failed to sign ${artifact}:`, error.message);
        this.securityReport.signatures.push({
          artifact: artifact,
          signature: null,
          created_at: new Date().toISOString(),
          verified: false,
          error: error.message
        });
      }
    }

    // Create signature manifest
    const manifest = {
      created_at: new Date().toISOString(),
      signer: this.getGpgSignerInfo(),
      signatures: this.securityReport.signatures
    };

    fs.writeFileSync(
      path.join(signaturesDir, 'signature-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    this.securityReport.compliance.signed = this.securityReport.signatures.some(sig => sig.verified);
    console.log(`Signed ${this.securityReport.signatures.filter(sig => sig.verified).length} artifacts`);
  }

  /**
   * Get GPG signer information
   */
  getGpgSignerInfo() {
    try {
      const output = execSync('gpg --list-secret-keys --with-colons', { encoding: 'utf8' });
      const lines = output.split('\n');
      
      const secLine = lines.find(line => line.startsWith('sec:'));
      const uidLine = lines.find(line => line.startsWith('uid:'));
      
      if (secLine && uidLine) {
        const keyId = secLine.split(':')[4];
        const userId = uidLine.split(':')[9];
        
        return {
          key_id: keyId,
          user_id: userId
        };
      }
    } catch (error) {
      console.warn('Could not get GPG signer info:', error.message);
    }
    
    return { key_id: 'unknown', user_id: 'unknown' };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport() {
    console.log('Generating compliance report...');
    
    // Count vulnerabilities by severity
    const vulnerabilityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0
    };

    this.securityReport.artifacts.forEach(artifact => {
      artifact.vulnerabilities.forEach(vuln => {
        vulnerabilityCounts[vuln.severity] = (vulnerabilityCounts[vuln.severity] || 0) + 1;
      });
    });

    // Determine compliance status
    const hasHighCriticalVulns = vulnerabilityCounts.critical > 0 || vulnerabilityCounts.high > 0;
    const allArtifactsSigned = this.securityReport.signatures.length > 0 && 
                              this.securityReport.signatures.every(sig => sig.verified);

    const complianceReport = {
      timestamp: new Date().toISOString(),
      summary: {
        total_artifacts: this.securityReport.artifacts.length,
        total_vulnerabilities: Object.values(vulnerabilityCounts).reduce((a, b) => a + b, 0),
        vulnerability_breakdown: vulnerabilityCounts,
        artifacts_signed: this.securityReport.signatures.filter(sig => sig.verified).length,
        compliance_status: hasHighCriticalVulns ? 'FAILED' : 'PASSED'
      },
      compliance_checks: {
        security_scan_completed: this.securityReport.compliance.scanned,
        no_critical_vulnerabilities: vulnerabilityCounts.critical === 0,
        no_high_vulnerabilities: vulnerabilityCounts.high === 0,
        artifacts_signed: allArtifactsSigned,
        audit_trail_created: false // Will be set later
      },
      recommendations: this.generateRecommendations(vulnerabilityCounts, allArtifactsSigned)
    };

    // Write compliance report
    fs.writeFileSync(
      path.join(this.options.outputDir, 'compliance-report.json'),
      JSON.stringify(complianceReport, null, 2)
    );

    // Generate human-readable report
    this.generateHumanReadableReport(complianceReport);

    console.log(`Compliance status: ${complianceReport.summary.compliance_status}`);
    return complianceReport;
  }

  /**
   * Generate recommendations based on findings
   */
  generateRecommendations(vulnerabilityCounts, allArtifactsSigned) {
    const recommendations = [];

    if (vulnerabilityCounts.critical > 0) {
      recommendations.push('URGENT: Address critical security vulnerabilities before release');
    }

    if (vulnerabilityCounts.high > 0) {
      recommendations.push('Address high-severity security vulnerabilities');
    }

    if (vulnerabilityCounts.medium > 0) {
      recommendations.push('Consider addressing medium-severity vulnerabilities');
    }

    if (!allArtifactsSigned) {
      recommendations.push('Sign all artifacts with GPG for integrity verification');
    }

    if (recommendations.length === 0) {
      recommendations.push('All security checks passed - artifacts are ready for release');
    }

    return recommendations;
  }

  /**
   * Generate human-readable compliance report
   */
  generateHumanReadableReport(complianceReport) {
    let report = '# Artifact Security Compliance Report\n\n';
    report += `**Generated:** ${complianceReport.timestamp}\n`;
    report += `**Status:** ${complianceReport.summary.compliance_status}\n\n`;

    report += '## Summary\n\n';
    report += `- **Total Artifacts:** ${complianceReport.summary.total_artifacts}\n`;
    report += `- **Total Vulnerabilities:** ${complianceReport.summary.total_vulnerabilities}\n`;
    report += `- **Signed Artifacts:** ${complianceReport.summary.artifacts_signed}\n\n`;

    if (complianceReport.summary.total_vulnerabilities > 0) {
      report += '## Vulnerability Breakdown\n\n';
      Object.entries(complianceReport.summary.vulnerability_breakdown).forEach(([severity, count]) => {
        if (count > 0) {
          const emoji = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : 
                       severity === 'medium' ? '🟡' : '🔵';
          report += `- ${emoji} **${severity.toUpperCase()}:** ${count}\n`;
        }
      });
      report += '\n';
    }

    report += '## Compliance Checks\n\n';
    Object.entries(complianceReport.compliance_checks).forEach(([check, passed]) => {
      const emoji = passed ? '✅' : '❌';
      const checkName = check.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      report += `- ${emoji} ${checkName}\n`;
    });
    report += '\n';

    if (complianceReport.recommendations.length > 0) {
      report += '## Recommendations\n\n';
      complianceReport.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      report += '\n';
    }

    fs.writeFileSync(
      path.join(this.options.outputDir, 'compliance-report.md'),
      report
    );
  }

  /**
   * Create comprehensive audit trail
   */
  async createAuditTrail() {
    console.log('Creating audit trail...');
    
    const auditTrail = {
      audit_version: '1.0',
      timestamp: new Date().toISOString(),
      environment: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        user: process.env.USER || process.env.USERNAME || 'unknown',
        working_directory: process.cwd()
      },
      operations: {
        security_scan: {
          performed: this.securityReport.compliance.scanned,
          artifacts_scanned: this.securityReport.artifacts.length,
          vulnerabilities_found: this.securityReport.artifacts.reduce(
            (total, artifact) => total + artifact.vulnerabilities.length, 0
          )
        },
        artifact_signing: {
          performed: this.securityReport.compliance.signed,
          artifacts_signed: this.securityReport.signatures.filter(sig => sig.verified).length,
          signing_method: 'GPG'
        }
      },
      artifacts: this.securityReport.artifacts.map(artifact => ({
        name: artifact.name,
        size: artifact.size,
        checksums: artifact.checksums,
        vulnerabilities_count: artifact.vulnerabilities.length,
        scan_timestamp: artifact.scan_timestamp
      })),
      signatures: this.securityReport.signatures,
      compliance_status: this.securityReport.compliance
    };

    // Write audit trail
    fs.writeFileSync(
      path.join(this.options.outputDir, 'audit-trail.json'),
      JSON.stringify(auditTrail, null, 2)
    );

    this.securityReport.compliance.audit_trail = true;
    console.log('Audit trail created successfully');
  }

  /**
   * Validate artifact integrity
   */
  validateIntegrity(artifactPath, expectedChecksums) {
    console.log(`Validating integrity of ${path.basename(artifactPath)}...`);
    
    const actualChecksums = this.generateChecksums(artifactPath);
    const validationResults = {};

    Object.entries(expectedChecksums).forEach(([algorithm, expectedHash]) => {
      const actualHash = actualChecksums[algorithm];
      validationResults[algorithm] = {
        expected: expectedHash,
        actual: actualHash,
        valid: expectedHash === actualHash
      };
    });

    const allValid = Object.values(validationResults).every(result => result.valid);
    
    console.log(`Integrity validation: ${allValid ? '✅ PASSED' : '❌ FAILED'}`);
    return { valid: allValid, results: validationResults };
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  async function main() {
    try {
      const security = new ArtifactSecurity({
        enableSigning: !process.argv.includes('--no-signing'),
        enableScanning: !process.argv.includes('--no-scanning'),
        gpgKeyId: process.env.GPG_KEY_ID
      });

      switch (command) {
        case 'secure':
          await security.secureArtifacts();
          break;
        
        case 'scan':
          await security.scanArtifacts();
          break;
        
        case 'sign':
          await security.signArtifacts();
          break;
        
        case 'validate':
          const artifactPath = process.argv[3];
          const checksumsFile = process.argv[4];
          
          if (!artifactPath || !checksumsFile) {
            console.error('Usage: node artifact-security.js validate <artifact> <checksums.json>');
            process.exit(1);
          }
          
          const expectedChecksums = JSON.parse(fs.readFileSync(checksumsFile, 'utf8'));
          const result = security.validateIntegrity(artifactPath, expectedChecksums);
          
          if (!result.valid) {
            process.exit(1);
          }
          break;
        
        default:
          console.log('Usage: node artifact-security.js <command> [options]');
          console.log('');
          console.log('Commands:');
          console.log('  secure    - Perform all security operations');
          console.log('  scan      - Scan artifacts for vulnerabilities');
          console.log('  sign      - Sign artifacts with GPG');
          console.log('  validate  - Validate artifact integrity');
          console.log('');
          console.log('Options:');
          console.log('  --no-signing   - Skip artifact signing');
          console.log('  --no-scanning  - Skip vulnerability scanning');
          console.log('');
          console.log('Environment Variables:');
          console.log('  GPG_KEY_ID     - GPG key ID for signing');
          process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }

  main();
}

module.exports = ArtifactSecurity;