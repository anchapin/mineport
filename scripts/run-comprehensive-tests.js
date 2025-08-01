#!/usr/bin/env node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive test runner for ModPorter-AI integration
 * Runs all test suites and generates detailed reports
 */

const TEST_SUITES = {
  unit: {
    name: 'Unit Tests',
    command: 'vitest run tests/unit --coverage',
    timeout: 300000, // 5 minutes
    required: true
  },
  integration: {
    name: 'Integration Tests',
    command: 'vitest run tests/integration',
    timeout: 600000, // 10 minutes
    required: true
  },
  security: {
    name: 'Security Tests',
    command: 'vitest run tests/security',
    timeout: 300000, // 5 minutes
    required: true
  },
  performance: {
    name: 'Performance Tests',
    command: 'vitest run tests/benchmark',
    timeout: 900000, // 15 minutes
    required: false
  },
  e2e: {
    name: 'End-to-End Tests',
    command: 'vitest run tests/integration/end-to-end-conversion.test.ts',
    timeout: 1200000, // 20 minutes
    required: true
  }
};

class TestRunner {
  constructor() {
    this.results = {};
    this.startTime = Date.now();
    this.reportDir = path.join(process.cwd(), 'test-reports');
    this.ensureReportDirectory();
  }

  ensureReportDirectory() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive ModPorter-AI test suite...\n');

    for (const [suiteKey, suite] of Object.entries(TEST_SUITES)) {
      await this.runTestSuite(suiteKey, suite);
    }

    await this.generateReport();
    this.printSummary();
  }

  async runTestSuite(suiteKey, suite) {
    console.log(`📋 Running ${suite.name}...`);
    const startTime = Date.now();

    try {
      const output = execSync(suite.command, {
        encoding: 'utf8',
        timeout: suite.timeout,
        stdio: 'pipe'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.results[suiteKey] = {
        name: suite.name,
        status: 'passed',
        duration,
        output,
        required: suite.required
      };

      console.log(`✅ ${suite.name} passed (${this.formatDuration(duration)})\n`);

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.results[suiteKey] = {
        name: suite.name,
        status: 'failed',
        duration,
        output: error.stdout || '',
        error: error.stderr || error.message,
        required: suite.required
      };

      if (suite.required) {
        console.log(`❌ ${suite.name} failed (${this.formatDuration(duration)})`);
        console.log(`Error: ${error.message}\n`);
      } else {
        console.log(`⚠️  ${suite.name} failed (optional) (${this.formatDuration(duration)})\n`);
      }
    }
  }

  async generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const timestamp = new Date().toISOString();

    const report = {
      timestamp,
      totalDuration,
      summary: this.generateSummary(),
      suites: this.results,
      coverage: await this.extractCoverageData(),
      performance: this.extractPerformanceMetrics(),
      security: this.extractSecurityMetrics()
    };

    // Write JSON report
    const jsonReportPath = path.join(this.reportDir, `test-report-${Date.now()}.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Write HTML report
    const htmlReportPath = path.join(this.reportDir, `test-report-${Date.now()}.html`);
    fs.writeFileSync(htmlReportPath, this.generateHtmlReport(report));

    console.log(`📊 Test reports generated:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   HTML: ${htmlReportPath}\n`);
  }

  generateSummary() {
    const total = Object.keys(this.results).length;
    const passed = Object.values(this.results).filter(r => r.status === 'passed').length;
    const failed = Object.values(this.results).filter(r => r.status === 'failed').length;
    const requiredFailed = Object.values(this.results).filter(r => r.status === 'failed' && r.required).length;

    return {
      total,
      passed,
      failed,
      requiredFailed,
      passRate: (passed / total * 100).toFixed(1)
    };
  }

  async extractCoverageData() {
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        
        // Calculate overall coverage
        let totalLines = 0;
        let coveredLines = 0;
        let totalFunctions = 0;
        let coveredFunctions = 0;
        let totalBranches = 0;
        let coveredBranches = 0;

        for (const file of Object.values(coverageData)) {
          totalLines += file.s ? Object.keys(file.s).length : 0;
          coveredLines += file.s ? Object.values(file.s).filter(count => count > 0).length : 0;
          
          totalFunctions += file.f ? Object.keys(file.f).length : 0;
          coveredFunctions += file.f ? Object.values(file.f).filter(count => count > 0).length : 0;
          
          totalBranches += file.b ? Object.keys(file.b).length : 0;
          coveredBranches += file.b ? Object.values(file.b).filter(branches => branches.some(count => count > 0)).length : 0;
        }

        return {
          lines: {
            total: totalLines,
            covered: coveredLines,
            percentage: totalLines > 0 ? (coveredLines / totalLines * 100).toFixed(1) : 0
          },
          functions: {
            total: totalFunctions,
            covered: coveredFunctions,
            percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions * 100).toFixed(1) : 0
          },
          branches: {
            total: totalBranches,
            covered: coveredBranches,
            percentage: totalBranches > 0 ? (coveredBranches / totalBranches * 100).toFixed(1) : 0
          }
        };
      }
    } catch (error) {
      console.warn('Could not extract coverage data:', error.message);
    }
    
    return null;
  }

  extractPerformanceMetrics() {
    const performanceResult = this.results.performance;
    if (!performanceResult || performanceResult.status !== 'passed') {
      return null;
    }

    // Extract performance metrics from test output
    const output = performanceResult.output;
    const metrics = {};

    // Look for timing information in test output
    const timingRegex = /(\w+)\s+completed\s+in\s+(\d+)ms/g;
    let match;
    while ((match = timingRegex.exec(output)) !== null) {
      metrics[match[1]] = parseInt(match[2]);
    }

    return metrics;
  }

  extractSecurityMetrics() {
    const securityResult = this.results.security;
    if (!securityResult || securityResult.status !== 'passed') {
      return null;
    }

    // Extract security test results
    const output = securityResult.output;
    const metrics = {
      zipBombDetection: output.includes('ZIP bomb') ? 'passed' : 'unknown',
      pathTraversalPrevention: output.includes('path traversal') ? 'passed' : 'unknown',
      malwareDetection: output.includes('malware') ? 'passed' : 'unknown',
      fileValidation: output.includes('file validation') ? 'passed' : 'unknown'
    };

    return metrics;
  }

  generateHtmlReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ModPorter-AI Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .value { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .warning { color: #ffc107; }
        .suite { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .suite-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .suite-name { font-weight: bold; font-size: 1.1em; }
        .duration { color: #666; font-size: 0.9em; }
        .status-badge { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status-passed { background-color: #28a745; }
        .status-failed { background-color: #dc3545; }
        .coverage-bar { width: 100%; height: 20px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; }
        .coverage-fill { height: 100%; background-color: #28a745; transition: width 0.3s ease; }
        .error-details { background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 10px; margin-top: 10px; }
        .error-details pre { margin: 0; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ModPorter-AI Test Report</h1>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
            <p>Total Duration: ${this.formatDuration(report.totalDuration)}</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Total Suites</h3>
                <div class="value">${report.summary.total}</div>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <div class="value passed">${report.summary.passed}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value failed">${report.summary.failed}</div>
            </div>
            <div class="summary-card">
                <h3>Pass Rate</h3>
                <div class="value">${report.summary.passRate}%</div>
            </div>
        </div>

        ${report.coverage ? `
        <div class="summary">
            <div class="summary-card">
                <h3>Line Coverage</h3>
                <div class="value">${report.coverage.lines.percentage}%</div>
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${report.coverage.lines.percentage}%"></div>
                </div>
            </div>
            <div class="summary-card">
                <h3>Function Coverage</h3>
                <div class="value">${report.coverage.functions.percentage}%</div>
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${report.coverage.functions.percentage}%"></div>
                </div>
            </div>
            <div class="summary-card">
                <h3>Branch Coverage</h3>
                <div class="value">${report.coverage.branches.percentage}%</div>
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${report.coverage.branches.percentage}%"></div>
                </div>
            </div>
        </div>
        ` : ''}

        <h2>Test Suites</h2>
        ${Object.entries(report.suites).map(([key, suite]) => `
        <div class="suite">
            <div class="suite-header">
                <span class="suite-name">${suite.name}</span>
                <div>
                    <span class="status-badge status-${suite.status}">${suite.status.toUpperCase()}</span>
                    <span class="duration">${this.formatDuration(suite.duration)}</span>
                </div>
            </div>
            ${suite.error ? `
            <div class="error-details">
                <strong>Error:</strong>
                <pre>${suite.error}</pre>
            </div>
            ` : ''}
        </div>
        `).join('')}

        ${report.security ? `
        <h2>Security Test Results</h2>
        <div class="summary">
            <div class="summary-card">
                <h3>ZIP Bomb Detection</h3>
                <div class="value ${report.security.zipBombDetection === 'passed' ? 'passed' : 'warning'}">${report.security.zipBombDetection}</div>
            </div>
            <div class="summary-card">
                <h3>Path Traversal Prevention</h3>
                <div class="value ${report.security.pathTraversalPrevention === 'passed' ? 'passed' : 'warning'}">${report.security.pathTraversalPrevention}</div>
            </div>
            <div class="summary-card">
                <h3>Malware Detection</h3>
                <div class="value ${report.security.malwareDetection === 'passed' ? 'passed' : 'warning'}">${report.security.malwareDetection}</div>
            </div>
            <div class="summary-card">
                <h3>File Validation</h3>
                <div class="value ${report.security.fileValidation === 'passed' ? 'passed' : 'warning'}">${report.security.fileValidation}</div>
            </div>
        </div>
        ` : ''}
    </div>
</body>
</html>
    `;
  }

  printSummary() {
    const summary = this.generateSummary();
    const totalDuration = Date.now() - this.startTime;

    console.log('📊 Test Summary:');
    console.log(`   Total Suites: ${summary.total}`);
    console.log(`   Passed: ${summary.passed} ✅`);
    console.log(`   Failed: ${summary.failed} ${summary.failed > 0 ? '❌' : ''}`);
    console.log(`   Pass Rate: ${summary.passRate}%`);
    console.log(`   Total Duration: ${this.formatDuration(totalDuration)}`);

    if (summary.requiredFailed > 0) {
      console.log(`\n❌ ${summary.requiredFailed} required test suite(s) failed!`);
      process.exit(1);
    } else {
      console.log('\n🎉 All required tests passed!');
      process.exit(0);
    }
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

// Run the tests
const runner = new TestRunner();
runner.runAllTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});