#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Enhanced coverage report generator for ModPorter-AI integration
 * Generates detailed coverage reports with component-specific analysis
 */

class CoverageReporter {
  constructor() {
    this.coverageDir = path.join(process.cwd(), 'coverage');
    this.reportDir = path.join(process.cwd(), 'test-reports');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async generateReport() {
    console.log('📊 Generating enhanced coverage report...');

    try {
      const coverageData = this.loadCoverageData();
      const analysis = this.analyzeCoverage(coverageData);
      const componentAnalysis = this.analyzeByComponent(coverageData);
      
      await this.generateJsonReport(analysis, componentAnalysis);
      await this.generateHtmlReport(analysis, componentAnalysis);
      await this.generateMarkdownReport(analysis, componentAnalysis);
      
      this.printSummary(analysis);
      
    } catch (error) {
      console.error('❌ Failed to generate coverage report:', error.message);
      process.exit(1);
    }
  }

  loadCoverageData() {
    const coveragePath = path.join(this.coverageDir, 'coverage-final.json');
    
    if (!fs.existsSync(coveragePath)) {
      throw new Error('Coverage data not found. Run tests with --coverage first.');
    }

    return JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  }

  analyzeCoverage(coverageData) {
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalLines = 0;
    let coveredLines = 0;

    const fileAnalysis = [];

    for (const [filePath, fileData] of Object.entries(coverageData)) {
      const statements = fileData.s || {};
      const functions = fileData.f || {};
      const branches = fileData.b || {};
      const lines = fileData.l || {};

      const fileStatements = Object.keys(statements).length;
      const fileCoveredStatements = Object.values(statements).filter(count => count > 0).length;
      
      const fileFunctions = Object.keys(functions).length;
      const fileCoveredFunctions = Object.values(functions).filter(count => count > 0).length;
      
      const fileBranches = Object.keys(branches).length;
      const fileCoveredBranches = Object.values(branches).filter(branchArray => 
        branchArray.some(count => count > 0)
      ).length;
      
      const fileLines = Object.keys(lines).length;
      const fileCoveredLines = Object.values(lines).filter(count => count > 0).length;

      totalStatements += fileStatements;
      coveredStatements += fileCoveredStatements;
      totalFunctions += fileFunctions;
      coveredFunctions += fileCoveredFunctions;
      totalBranches += fileBranches;
      coveredBranches += fileCoveredBranches;
      totalLines += fileLines;
      coveredLines += fileCoveredLines;

      fileAnalysis.push({
        path: filePath,
        statements: {
          total: fileStatements,
          covered: fileCoveredStatements,
          percentage: fileStatements > 0 ? (fileCoveredStatements / fileStatements * 100) : 100
        },
        functions: {
          total: fileFunctions,
          covered: fileCoveredFunctions,
          percentage: fileFunctions > 0 ? (fileCoveredFunctions / fileFunctions * 100) : 100
        },
        branches: {
          total: fileBranches,
          covered: fileCoveredBranches,
          percentage: fileBranches > 0 ? (fileCoveredBranches / fileBranches * 100) : 100
        },
        lines: {
          total: fileLines,
          covered: fileCoveredLines,
          percentage: fileLines > 0 ? (fileCoveredLines / fileLines * 100) : 100
        }
      });
    }

    return {
      overall: {
        statements: {
          total: totalStatements,
          covered: coveredStatements,
          percentage: totalStatements > 0 ? (coveredStatements / totalStatements * 100) : 100
        },
        functions: {
          total: totalFunctions,
          covered: coveredFunctions,
          percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions * 100) : 100
        },
        branches: {
          total: totalBranches,
          covered: coveredBranches,
          percentage: totalBranches > 0 ? (coveredBranches / totalBranches * 100) : 100
        },
        lines: {
          total: totalLines,
          covered: coveredLines,
          percentage: totalLines > 0 ? (coveredLines / totalLines * 100) : 100
        }
      },
      files: fileAnalysis.sort((a, b) => a.statements.percentage - b.statements.percentage)
    };
  }

  analyzeByComponent(coverageData) {
    const components = {
      'File Processing': [],
      'Java Analysis': [],
      'Asset Conversion': [],
      'Validation Pipeline': [],
      'Security Scanner': [],
      'Services': [],
      'Other': []
    };

    for (const [filePath, fileData] of Object.entries(coverageData)) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      
      let component = 'Other';
      
      if (normalizedPath.includes('/modules/ingestion/FileProcessor') || 
          normalizedPath.includes('/modules/ingestion/SecurityScanner')) {
        component = normalizedPath.includes('SecurityScanner') ? 'Security Scanner' : 'File Processing';
      } else if (normalizedPath.includes('/modules/ingestion/JavaAnalyzer') ||
                 normalizedPath.includes('/modules/ingestion/ManifestParser')) {
        component = 'Java Analysis';
      } else if (normalizedPath.includes('/modules/conversion-agents/')) {
        component = 'Asset Conversion';
      } else if (normalizedPath.includes('/services/ValidationPipeline') ||
                 normalizedPath.includes('/services/validation-stages/')) {
        component = 'Validation Pipeline';
      } else if (normalizedPath.includes('/services/')) {
        component = 'Services';
      }

      components[component].push({
        path: normalizedPath,
        data: fileData
      });
    }

    // Calculate component-level coverage
    const componentAnalysis = {};
    
    for (const [componentName, files] of Object.entries(components)) {
      if (files.length === 0) continue;

      let totalStatements = 0;
      let coveredStatements = 0;
      let totalFunctions = 0;
      let coveredFunctions = 0;

      for (const file of files) {
        const statements = file.data.s || {};
        const functions = file.data.f || {};

        totalStatements += Object.keys(statements).length;
        coveredStatements += Object.values(statements).filter(count => count > 0).length;
        totalFunctions += Object.keys(functions).length;
        coveredFunctions += Object.values(functions).filter(count => count > 0).length;
      }

      componentAnalysis[componentName] = {
        fileCount: files.length,
        statements: {
          total: totalStatements,
          covered: coveredStatements,
          percentage: totalStatements > 0 ? (coveredStatements / totalStatements * 100) : 100
        },
        functions: {
          total: totalFunctions,
          covered: coveredFunctions,
          percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions * 100) : 100
        },
        files: files.map(f => f.path)
      };
    }

    return componentAnalysis;
  }

  async generateJsonReport(analysis, componentAnalysis) {
    const report = {
      timestamp: new Date().toISOString(),
      overall: analysis.overall,
      components: componentAnalysis,
      files: analysis.files,
      summary: {
        totalFiles: analysis.files.length,
        wellCovered: analysis.files.filter(f => f.statements.percentage >= 90).length,
        poorlyCovered: analysis.files.filter(f => f.statements.percentage < 70).length,
        averageCoverage: analysis.files.reduce((sum, f) => sum + f.statements.percentage, 0) / analysis.files.length
      }
    };

    const reportPath = path.join(this.reportDir, `coverage-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 JSON report: ${reportPath}`);
  }

  async generateHtmlReport(analysis, componentAnalysis) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ModPorter-AI Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-card h3 { margin: 0 0 10px 0; color: #333; }
        .metric-value { font-size: 2em; font-weight: bold; }
        .coverage-bar { width: 100%; height: 20px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; margin-top: 10px; }
        .coverage-fill { height: 100%; transition: width 0.3s ease; }
        .excellent { color: #28a745; background-color: #28a745; }
        .good { color: #17a2b8; background-color: #17a2b8; }
        .fair { color: #ffc107; background-color: #ffc107; }
        .poor { color: #dc3545; background-color: #dc3545; }
        .component { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .component-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .file-list { max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 4px; }
        .file-item { padding: 5px 0; border-bottom: 1px solid #eee; }
        .file-item:last-child { border-bottom: none; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .percentage { font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ModPorter-AI Coverage Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <h3>Statement Coverage</h3>
                <div class="metric-value ${this.getCoverageClass(analysis.overall.statements.percentage)}">${analysis.overall.statements.percentage.toFixed(1)}%</div>
                <div class="coverage-bar">
                    <div class="coverage-fill ${this.getCoverageClass(analysis.overall.statements.percentage)}" style="width: ${analysis.overall.statements.percentage}%"></div>
                </div>
                <small>${analysis.overall.statements.covered} / ${analysis.overall.statements.total}</small>
            </div>
            <div class="metric-card">
                <h3>Function Coverage</h3>
                <div class="metric-value ${this.getCoverageClass(analysis.overall.functions.percentage)}">${analysis.overall.functions.percentage.toFixed(1)}%</div>
                <div class="coverage-bar">
                    <div class="coverage-fill ${this.getCoverageClass(analysis.overall.functions.percentage)}" style="width: ${analysis.overall.functions.percentage}%"></div>
                </div>
                <small>${analysis.overall.functions.covered} / ${analysis.overall.functions.total}</small>
            </div>
            <div class="metric-card">
                <h3>Branch Coverage</h3>
                <div class="metric-value ${this.getCoverageClass(analysis.overall.branches.percentage)}">${analysis.overall.branches.percentage.toFixed(1)}%</div>
                <div class="coverage-bar">
                    <div class="coverage-fill ${this.getCoverageClass(analysis.overall.branches.percentage)}" style="width: ${analysis.overall.branches.percentage}%"></div>
                </div>
                <small>${analysis.overall.branches.covered} / ${analysis.overall.branches.total}</small>
            </div>
            <div class="metric-card">
                <h3>Line Coverage</h3>
                <div class="metric-value ${this.getCoverageClass(analysis.overall.lines.percentage)}">${analysis.overall.lines.percentage.toFixed(1)}%</div>
                <div class="coverage-bar">
                    <div class="coverage-fill ${this.getCoverageClass(analysis.overall.lines.percentage)}" style="width: ${analysis.overall.lines.percentage}%"></div>
                </div>
                <small>${analysis.overall.lines.covered} / ${analysis.overall.lines.total}</small>
            </div>
        </div>

        <h2>Component Coverage</h2>
        ${Object.entries(componentAnalysis).map(([name, component]) => `
        <div class="component">
            <div class="component-header">
                <h3>${name}</h3>
                <div>
                    <span class="percentage ${this.getCoverageClass(component.statements.percentage)}">${component.statements.percentage.toFixed(1)}%</span>
                    <small>(${component.fileCount} files)</small>
                </div>
            </div>
            <div class="coverage-bar">
                <div class="coverage-fill ${this.getCoverageClass(component.statements.percentage)}" style="width: ${component.statements.percentage}%"></div>
            </div>
            <div class="file-list">
                ${component.files.map(file => `<div class="file-item">${file}</div>`).join('')}
            </div>
        </div>
        `).join('')}

        <h2>File Coverage Details</h2>
        <table>
            <thead>
                <tr>
                    <th>File</th>
                    <th>Statements</th>
                    <th>Functions</th>
                    <th>Branches</th>
                    <th>Lines</th>
                </tr>
            </thead>
            <tbody>
                ${analysis.files.map(file => `
                <tr>
                    <td>${file.path.replace(process.cwd(), '.')}</td>
                    <td class="percentage ${this.getCoverageClass(file.statements.percentage)}">${file.statements.percentage.toFixed(1)}%</td>
                    <td class="percentage ${this.getCoverageClass(file.functions.percentage)}">${file.functions.percentage.toFixed(1)}%</td>
                    <td class="percentage ${this.getCoverageClass(file.branches.percentage)}">${file.branches.percentage.toFixed(1)}%</td>
                    <td class="percentage ${this.getCoverageClass(file.lines.percentage)}">${file.lines.percentage.toFixed(1)}%</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
    `;

    const reportPath = path.join(this.reportDir, `coverage-report-${Date.now()}.html`);
    fs.writeFileSync(reportPath, html);
    
    console.log(`🌐 HTML report: ${reportPath}`);
  }

  async generateMarkdownReport(analysis, componentAnalysis) {
    const markdown = `# ModPorter-AI Coverage Report

Generated on ${new Date().toLocaleString()}

## Overall Coverage

| Metric | Coverage | Covered/Total |
|--------|----------|---------------|
| Statements | ${analysis.overall.statements.percentage.toFixed(1)}% | ${analysis.overall.statements.covered}/${analysis.overall.statements.total} |
| Functions | ${analysis.overall.functions.percentage.toFixed(1)}% | ${analysis.overall.functions.covered}/${analysis.overall.functions.total} |
| Branches | ${analysis.overall.branches.percentage.toFixed(1)}% | ${analysis.overall.branches.covered}/${analysis.overall.branches.total} |
| Lines | ${analysis.overall.lines.percentage.toFixed(1)}% | ${analysis.overall.lines.covered}/${analysis.overall.lines.total} |

## Component Coverage

${Object.entries(componentAnalysis).map(([name, component]) => `
### ${name}
- **Coverage:** ${component.statements.percentage.toFixed(1)}%
- **Files:** ${component.fileCount}
- **Statements:** ${component.statements.covered}/${component.statements.total}
- **Functions:** ${component.functions.covered}/${component.functions.total}
`).join('')}

## Files Needing Attention

### Poorly Covered Files (< 70%)
${analysis.files.filter(f => f.statements.percentage < 70).map(file => 
  `- \`${file.path.replace(process.cwd(), '.')}\` - ${file.statements.percentage.toFixed(1)}%`
).join('\n') || 'None! 🎉'}

### Well Covered Files (≥ 90%)
${analysis.files.filter(f => f.statements.percentage >= 90).slice(0, 10).map(file => 
  `- \`${file.path.replace(process.cwd(), '.')}\` - ${file.statements.percentage.toFixed(1)}%`
).join('\n')}

## Recommendations

${this.generateRecommendations(analysis, componentAnalysis)}
`;

    const reportPath = path.join(this.reportDir, `coverage-report-${Date.now()}.md`);
    fs.writeFileSync(reportPath, markdown);
    
    console.log(`📝 Markdown report: ${reportPath}`);
  }

  generateRecommendations(analysis, componentAnalysis) {
    const recommendations = [];

    // Overall coverage recommendations
    if (analysis.overall.statements.percentage < 80) {
      recommendations.push('- **Increase overall test coverage** - Current statement coverage is below 80%');
    }

    if (analysis.overall.branches.percentage < 70) {
      recommendations.push('- **Add more branch coverage tests** - Many conditional paths are not tested');
    }

    // Component-specific recommendations
    for (const [name, component] of Object.entries(componentAnalysis)) {
      if (component.statements.percentage < 70) {
        recommendations.push(`- **Improve ${name} coverage** - Currently at ${component.statements.percentage.toFixed(1)}%`);
      }
    }

    // File-specific recommendations
    const poorFiles = analysis.files.filter(f => f.statements.percentage < 50);
    if (poorFiles.length > 0) {
      recommendations.push(`- **Focus on poorly covered files** - ${poorFiles.length} files have less than 50% coverage`);
    }

    if (recommendations.length === 0) {
      recommendations.push('- **Great job!** - Coverage levels are good across all components');
      recommendations.push('- **Consider adding edge case tests** - Look for complex functions that might need more test scenarios');
    }

    return recommendations.join('\n');
  }

  getCoverageClass(percentage) {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 70) return 'fair';
    return 'poor';
  }

  printSummary(analysis) {
    console.log('\n📊 Coverage Summary:');
    console.log(`   Statements: ${analysis.overall.statements.percentage.toFixed(1)}% (${analysis.overall.statements.covered}/${analysis.overall.statements.total})`);
    console.log(`   Functions:  ${analysis.overall.functions.percentage.toFixed(1)}% (${analysis.overall.functions.covered}/${analysis.overall.functions.total})`);
    console.log(`   Branches:   ${analysis.overall.branches.percentage.toFixed(1)}% (${analysis.overall.branches.covered}/${analysis.overall.branches.total})`);
    console.log(`   Lines:      ${analysis.overall.lines.percentage.toFixed(1)}% (${analysis.overall.lines.covered}/${analysis.overall.lines.total})`);

    const poorFiles = analysis.files.filter(f => f.statements.percentage < 70);
    if (poorFiles.length > 0) {
      console.log(`\n⚠️  ${poorFiles.length} files have less than 70% coverage`);
    }

    if (analysis.overall.statements.percentage >= 90) {
      console.log('\n🎉 Excellent coverage! Keep up the great work!');
    } else if (analysis.overall.statements.percentage >= 80) {
      console.log('\n✅ Good coverage! Consider adding more tests for edge cases.');
    } else {
      console.log('\n📈 Coverage could be improved. Focus on adding tests for uncovered code paths.');
    }
  }
}

// Run the coverage reporter
const reporter = new CoverageReporter();
reporter.generateReport().catch(error => {
  console.error('❌ Coverage report generation failed:', error);
  process.exit(1);
});