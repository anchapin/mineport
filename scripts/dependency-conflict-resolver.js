#!/usr/bin/env node

/**
 * Dependency Conflict Resolution Script
 * 
 * This script provides advanced dependency conflict detection and resolution guidance including:
 * - Dependency tree analysis and conflict detection
 * - Peer dependency conflict resolution
 * - Version compatibility checking
 * - Automated resolution suggestions
 * - Integration with GitHub Issues for tracking
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

class DependencyConflictResolver {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      createIssues: options.createIssues !== false,
      autoFix: options.autoFix || false,
      verbose: options.verbose || false,
      ...options
    };
    
    this.conflicts = [];
    this.resolutions = [];
    this.dependencyTree = null;
  }

  /**
   * Main entry point for dependency conflict resolution
   */
  async run() {
    console.log('🔧 Starting Dependency Conflict Resolution');
    console.log(`Options: ${JSON.stringify(this.options, null, 2)}`);

    try {
      // Step 1: Analyze dependency tree
      await this.analyzeDependencyTree();
      
      // Step 2: Detect conflicts
      await this.detectConflicts();
      
      // Step 3: Generate resolution strategies
      await this.generateResolutionStrategies();
      
      // Step 4: Apply automatic fixes if enabled
      if (this.options.autoFix) {
        await this.applyAutomaticFixes();
      }
      
      // Step 5: Create issues for manual resolution
      if (this.options.createIssues) {
        await this.createResolutionIssues();
      }
      
      // Step 6: Generate report
      await this.generateReport();
      
      console.log('✅ Dependency conflict resolution completed successfully');
      return {
        conflicts: this.conflicts,
        resolutions: this.resolutions
      };
      
    } catch (error) {
      console.error('❌ Dependency conflict resolution failed:', error.message);
      throw error;
    }
  }

  /**
   * Analyze the current dependency tree
   */
  async analyzeDependencyTree() {
    console.log('🔍 Analyzing dependency tree...');
    
    try {
      // Get dependency tree as JSON
      const treeOutput = execSync('npm ls --json --depth=10', { 
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.dependencyTree = JSON.parse(treeOutput);
      
    } catch (error) {
      // npm ls can exit with non-zero even with valid output
      if (error.stdout) {
        try {
          this.dependencyTree = JSON.parse(error.stdout);
        } catch (parseError) {
          console.error('Failed to parse dependency tree:', parseError.message);
          throw parseError;
        }
      } else {
        console.error('Failed to get dependency tree:', error.message);
        throw error;
      }
    }

    // Get peer dependency warnings
    try {
      const peerOutput = execSync('npm ls --depth=0 2>&1', { 
        cwd: projectRoot,
        encoding: 'utf8'
      });
      
      this.peerWarnings = this.parsePeerWarnings(peerOutput);
      
    } catch (error) {
      // npm ls can exit with non-zero for peer warnings
      if (error.stdout || error.stderr) {
        const output = error.stdout || error.stderr;
        this.peerWarnings = this.parsePeerWarnings(output);
      } else {
        this.peerWarnings = [];
      }
    }

    console.log(`Analyzed dependency tree with ${Object.keys(this.dependencyTree.dependencies || {}).length} direct dependencies`);
    console.log(`Found ${this.peerWarnings.length} peer dependency warnings`);
  }

  /**
   * Parse peer dependency warnings from npm ls output
   */
  parsePeerWarnings(output) {
    const warnings = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('WARN') && (line.includes('peer dep') || line.includes('UNMET PEER DEPENDENCY'))) {
        const warning = this.parsePeerWarningLine(line);
        if (warning) {
          warnings.push(warning);
        }
      }
    }
    
    return warnings;
  }

  /**
   * Parse individual peer warning line
   */
  parsePeerWarningLine(line) {
    // Example: "npm WARN package@1.0.0 requires a peer of react@^16.0.0 but none is installed."
    const peerRegex = /WARN\s+(.+?)\s+requires a peer of\s+(.+?)\s+but\s+(.+)/;
    const match = line.match(peerRegex);
    
    if (match) {
      return {
        package: match[1],
        peerDependency: match[2],
        issue: match[3],
        type: 'peer_dependency',
        severity: 'warning'
      };
    }
    
    return null;
  }

  /**
   * Detect various types of dependency conflicts
   */
  async detectConflicts() {
    console.log('🔍 Detecting dependency conflicts...');
    
    // Detect version conflicts
    await this.detectVersionConflicts();
    
    // Detect peer dependency conflicts
    await this.detectPeerDependencyConflicts();
    
    // Detect duplicate dependencies
    await this.detectDuplicateDependencies();
    
    // Detect outdated dependencies that might cause conflicts
    await this.detectOutdatedConflicts();
    
    console.log(`Detected ${this.conflicts.length} potential conflicts`);
  }

  /**
   * Detect version conflicts in the dependency tree
   */
  async detectVersionConflicts() {
    if (!this.dependencyTree || !this.dependencyTree.dependencies) {
      return;
    }

    const versionMap = new Map();
    
    // Recursively collect all package versions
    const collectVersions = (deps, path = []) => {
      for (const [name, info] of Object.entries(deps)) {
        const currentPath = [...path, name];
        
        if (!versionMap.has(name)) {
          versionMap.set(name, []);
        }
        
        versionMap.get(name).push({
          version: info.version,
          path: currentPath,
          resolved: info.resolved
        });
        
        if (info.dependencies) {
          collectVersions(info.dependencies, currentPath);
        }
      }
    };
    
    collectVersions(this.dependencyTree.dependencies);
    
    // Find packages with multiple versions
    for (const [packageName, versions] of versionMap.entries()) {
      if (versions.length > 1) {
        const uniqueVersions = [...new Set(versions.map(v => v.version))];
        
        if (uniqueVersions.length > 1) {
          this.conflicts.push({
            type: 'version_conflict',
            package: packageName,
            versions: uniqueVersions,
            instances: versions,
            severity: this.assessVersionConflictSeverity(uniqueVersions),
            description: `Package ${packageName} has multiple versions: ${uniqueVersions.join(', ')}`
          });
        }
      }
    }
  }

  /**
   * Assess the severity of version conflicts
   */
  assessVersionConflictSeverity(versions) {
    // Check if versions span major versions
    const majorVersions = versions.map(v => parseInt(v.split('.')[0]));
    const uniqueMajors = [...new Set(majorVersions)];
    
    if (uniqueMajors.length > 1) {
      return 'high'; // Major version differences are high severity
    }
    
    // Check if versions span minor versions
    const minorVersions = versions.map(v => {
      const parts = v.split('.');
      return `${parts[0]}.${parts[1]}`;
    });
    const uniqueMinors = [...new Set(minorVersions)];
    
    if (uniqueMinors.length > 1) {
      return 'medium'; // Minor version differences are medium severity
    }
    
    return 'low'; // Only patch differences are low severity
  }

  /**
   * Detect peer dependency conflicts
   */
  async detectPeerDependencyConflicts() {
    for (const warning of this.peerWarnings) {
      this.conflicts.push({
        type: 'peer_dependency_conflict',
        package: warning.package,
        peerDependency: warning.peerDependency,
        issue: warning.issue,
        severity: 'medium',
        description: `Peer dependency conflict: ${warning.package} requires ${warning.peerDependency} but ${warning.issue}`
      });
    }
  }

  /**
   * Detect duplicate dependencies that could be deduplicated
   */
  async detectDuplicateDependencies() {
    try {
      const dedupeOutput = execSync('npm ls --json --depth=10', { 
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Run npm dedupe in dry-run mode to see what would be deduplicated
      const dedupeCheck = execSync('npm dedupe --dry-run', { 
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      if (dedupeCheck.trim()) {
        this.conflicts.push({
          type: 'duplicate_dependencies',
          description: 'Dependencies can be deduplicated to reduce conflicts',
          severity: 'low',
          details: dedupeCheck.trim()
        });
      }
      
    } catch (error) {
      // Dedupe check is optional
      if (this.options.verbose) {
        console.log('Could not check for duplicate dependencies:', error.message);
      }
    }
  }

  /**
   * Detect outdated dependencies that might cause conflicts
   */
  async detectOutdatedConflicts() {
    try {
      const outdatedOutput = execSync('npm outdated --json', { 
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const outdated = JSON.parse(outdatedOutput);
      
      for (const [packageName, info] of Object.entries(outdated)) {
        const currentParts = info.current.split('.');
        const wantedParts = info.wanted.split('.');
        const latestParts = info.latest.split('.');
        
        // Check if there's a major version difference
        if (currentParts[0] !== latestParts[0]) {
          this.conflicts.push({
            type: 'outdated_major_conflict',
            package: packageName,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest,
            severity: 'medium',
            description: `${packageName} is ${currentParts[0]} major versions behind (current: ${info.current}, latest: ${info.latest})`
          });
        }
      }
      
    } catch (error) {
      // No outdated packages or error checking
      if (this.options.verbose && error.status !== 1) {
        console.log('Could not check for outdated dependencies:', error.message);
      }
    }
  }

  /**
   * Generate resolution strategies for detected conflicts
   */
  async generateResolutionStrategies() {
    console.log('💡 Generating resolution strategies...');
    
    for (const conflict of this.conflicts) {
      const resolution = await this.generateResolutionStrategy(conflict);
      this.resolutions.push(resolution);
    }
    
    console.log(`Generated ${this.resolutions.length} resolution strategies`);
  }

  /**
   * Generate resolution strategy for a specific conflict
   */
  async generateResolutionStrategy(conflict) {
    const resolution = {
      conflict: conflict,
      strategies: [],
      recommendedStrategy: null,
      automatable: false,
      priority: this.getResolutionPriority(conflict)
    };

    switch (conflict.type) {
      case 'version_conflict':
        resolution.strategies = [
          {
            name: 'deduplicate',
            description: 'Run npm dedupe to consolidate versions',
            command: 'npm dedupe',
            risk: 'low',
            automatable: true
          },
          {
            name: 'update_to_latest',
            description: `Update all instances to latest compatible version`,
            command: `npm update ${conflict.package}`,
            risk: 'medium',
            automatable: false
          },
          {
            name: 'pin_version',
            description: 'Pin to specific version in package.json',
            command: `npm install ${conflict.package}@${conflict.versions[0]}`,
            risk: 'low',
            automatable: false
          }
        ];
        resolution.recommendedStrategy = resolution.strategies[0];
        resolution.automatable = conflict.severity === 'low';
        break;

      case 'peer_dependency_conflict':
        resolution.strategies = [
          {
            name: 'install_peer',
            description: `Install missing peer dependency: ${conflict.peerDependency}`,
            command: `npm install ${conflict.peerDependency}`,
            risk: 'medium',
            automatable: false
          },
          {
            name: 'update_package',
            description: `Update ${conflict.package} to version compatible with existing peers`,
            command: `npm update ${conflict.package}`,
            risk: 'medium',
            automatable: false
          },
          {
            name: 'ignore_peer_warning',
            description: 'Add to .npmrc to ignore peer dependency warnings',
            command: 'echo "legacy-peer-deps=true" >> .npmrc',
            risk: 'high',
            automatable: false
          }
        ];
        resolution.recommendedStrategy = resolution.strategies[0];
        break;

      case 'duplicate_dependencies':
        resolution.strategies = [
          {
            name: 'deduplicate',
            description: 'Run npm dedupe to remove duplicate dependencies',
            command: 'npm dedupe',
            risk: 'low',
            automatable: true
          }
        ];
        resolution.recommendedStrategy = resolution.strategies[0];
        resolution.automatable = true;
        break;

      case 'outdated_major_conflict':
        resolution.strategies = [
          {
            name: 'update_major',
            description: `Update ${conflict.package} to latest major version`,
            command: `npm install ${conflict.package}@latest`,
            risk: 'high',
            automatable: false
          },
          {
            name: 'update_minor',
            description: `Update ${conflict.package} to latest compatible minor version`,
            command: `npm update ${conflict.package}`,
            risk: 'medium',
            automatable: false
          },
          {
            name: 'keep_current',
            description: 'Keep current version and monitor for security issues',
            command: null,
            risk: 'medium',
            automatable: false
          }
        ];
        resolution.recommendedStrategy = resolution.strategies[1];
        break;
    }

    return resolution;
  }

  /**
   * Get resolution priority based on conflict severity and type
   */
  getResolutionPriority(conflict) {
    const severityPriority = { high: 1, medium: 2, low: 3 };
    const typePriority = {
      peer_dependency_conflict: 1,
      version_conflict: 2,
      outdated_major_conflict: 3,
      duplicate_dependencies: 4
    };

    return severityPriority[conflict.severity] * 10 + typePriority[conflict.type];
  }

  /**
   * Apply automatic fixes for low-risk conflicts
   */
  async applyAutomaticFixes() {
    console.log('🔧 Applying automatic fixes...');
    
    const automatableResolutions = this.resolutions.filter(r => r.automatable);
    
    if (automatableResolutions.length === 0) {
      console.log('No automatic fixes available');
      return;
    }

    console.log(`Applying ${automatableResolutions.length} automatic fixes...`);

    for (const resolution of automatableResolutions) {
      if (this.options.dryRun) {
        console.log(`[DRY RUN] Would apply: ${resolution.recommendedStrategy.command}`);
        continue;
      }

      try {
        console.log(`Applying: ${resolution.recommendedStrategy.description}`);
        
        if (resolution.recommendedStrategy.command) {
          execSync(resolution.recommendedStrategy.command, { 
            cwd: projectRoot,
            stdio: 'pipe'
          });
        }
        
        resolution.applied = true;
        console.log(`✅ Applied fix for ${resolution.conflict.type}`);
        
      } catch (error) {
        resolution.applied = false;
        resolution.error = error.message;
        console.log(`❌ Failed to apply fix for ${resolution.conflict.type}: ${error.message}`);
      }
    }

    // Validate fixes by re-analyzing
    if (!this.options.dryRun) {
      console.log('Validating applied fixes...');
      await this.validateFixes();
    }
  }

  /**
   * Validate that applied fixes resolved conflicts
   */
  async validateFixes() {
    try {
      // Re-run dependency analysis
      const originalConflicts = this.conflicts.length;
      
      await this.analyzeDependencyTree();
      this.conflicts = [];
      await this.detectConflicts();
      
      const remainingConflicts = this.conflicts.length;
      const resolvedConflicts = originalConflicts - remainingConflicts;
      
      console.log(`Validation complete: ${resolvedConflicts} conflicts resolved, ${remainingConflicts} remaining`);
      
    } catch (error) {
      console.error('Failed to validate fixes:', error.message);
    }
  }

  /**
   * Create GitHub issues for manual resolution
   */
  async createResolutionIssues() {
    console.log('📝 Creating resolution issues...');
    
    const manualResolutions = this.resolutions.filter(r => !r.automatable || !r.applied);
    
    if (manualResolutions.length === 0) {
      console.log('No manual resolutions needed');
      return;
    }

    // Group resolutions by priority
    const groupedResolutions = manualResolutions.reduce((groups, resolution) => {
      const priority = resolution.priority;
      if (!groups[priority]) {
        groups[priority] = [];
      }
      groups[priority].push(resolution);
      return groups;
    }, {});

    // Create issues for each priority group
    for (const [priority, resolutions] of Object.entries(groupedResolutions)) {
      if (this.options.dryRun) {
        console.log(`[DRY RUN] Would create issue for ${resolutions.length} conflicts with priority ${priority}`);
        continue;
      }

      try {
        await this.createResolutionIssue(resolutions, priority);
      } catch (error) {
        console.error(`Failed to create issue for priority ${priority}:`, error.message);
      }
    }
  }

  /**
   * Create a GitHub issue for a group of resolutions
   */
  async createResolutionIssue(resolutions, priority) {
    const priorityLabels = {
      1: 'high',
      2: 'high', 
      3: 'medium',
      4: 'medium',
      5: 'low'
    };
    
    const priorityLevel = priorityLabels[Math.floor(priority / 10)] || 'low';
    const conflictTypes = [...new Set(resolutions.map(r => r.conflict.type))];
    
    const title = `🔧 Dependency Conflicts: ${conflictTypes.join(', ')} (${priorityLevel} priority)`;
    
    const body = this.generateIssueBody(resolutions, priorityLevel);
    
    try {
      execSync(`gh issue create --title "${title}" --body "${body}" --label "dependencies,conflict-resolution,${priorityLevel}-priority" --assignee "${{ github.actor }}"`, {
        cwd: projectRoot,
        stdio: 'pipe'
      });
      
      console.log(`✅ Created issue: ${title}`);
      
    } catch (error) {
      console.error(`Failed to create GitHub issue: ${error.message}`);
    }
  }

  /**
   * Generate issue body for resolution guidance
   */
  generateIssueBody(resolutions, priorityLevel) {
    let body = `## Dependency Conflict Resolution Required

This issue tracks ${resolutions.length} dependency conflicts that require manual resolution.

**Priority Level**: ${priorityLevel.toUpperCase()}

### Conflicts Detected

`;

    resolutions.forEach((resolution, index) => {
      const conflict = resolution.conflict;
      
      body += `#### ${index + 1}. ${conflict.type.replace('_', ' ').toUpperCase()}

**Package**: ${conflict.package || 'Multiple'}
**Severity**: ${conflict.severity}
**Description**: ${conflict.description}

**Recommended Resolution**: ${resolution.recommendedStrategy.description}
**Command**: \`${resolution.recommendedStrategy.command || 'Manual action required'}\`
**Risk Level**: ${resolution.recommendedStrategy.risk}

`;

      if (resolution.strategies.length > 1) {
        body += `**Alternative Strategies**:
`;
        resolution.strategies.slice(1).forEach(strategy => {
          body += `- ${strategy.description} (\`${strategy.command || 'Manual'}\`) - Risk: ${strategy.risk}
`;
        });
        body += '\n';
      }
    });

    body += `### Resolution Steps

1. **Review each conflict** listed above and understand the impact
2. **Choose appropriate strategy** based on your project requirements
3. **Test thoroughly** after applying any changes
4. **Run validation** to ensure conflicts are resolved

### Validation Commands

After applying fixes, run these commands to validate:

\`\`\`bash
# Check for remaining conflicts
npm run deps:validate

# Analyze dependency tree
npm ls --depth=0

# Check for peer dependency warnings
npm ls 2>&1 | grep WARN

# Run tests to ensure no regressions
npm test
\`\`\`

### Automated Analysis

This issue was generated by the dependency conflict resolver. For detailed analysis, check the conflict resolution report artifacts.

---
*This issue was automatically generated by the dependency management workflow.*`;

    return body;
  }

  /**
   * Generate comprehensive report
   */
  async generateReport() {
    console.log('📊 Generating conflict resolution report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalConflicts: this.conflicts.length,
        conflictTypes: this.getConflictTypeSummary(),
        resolutionsGenerated: this.resolutions.length,
        automaticFixesApplied: this.resolutions.filter(r => r.applied).length,
        manualResolutionsRequired: this.resolutions.filter(r => !r.automatable || !r.applied).length
      },
      conflicts: this.conflicts,
      resolutions: this.resolutions,
      dependencyTree: this.dependencyTree,
      peerWarnings: this.peerWarnings,
      recommendations: this.generateRecommendations()
    };

    // Write report to file
    const reportPath = join(projectRoot, 'dependency-conflict-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate markdown summary
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = join(projectRoot, 'dependency-conflict-report.md');
    writeFileSync(markdownPath, markdownReport);
    
    console.log(`Report generated: ${reportPath}`);
    console.log(`Markdown summary: ${markdownPath}`);
    
    // Print summary to console
    console.log('\n📊 Dependency Conflict Summary:');
    console.log(`  Total conflicts: ${report.summary.totalConflicts}`);
    console.log(`  Resolutions generated: ${report.summary.resolutionsGenerated}`);
    console.log(`  Automatic fixes applied: ${report.summary.automaticFixesApplied}`);
    console.log(`  Manual resolutions required: ${report.summary.manualResolutionsRequired}`);
    
    return report;
  }

  /**
   * Get summary of conflict types
   */
  getConflictTypeSummary() {
    return this.conflicts.reduce((summary, conflict) => {
      summary[conflict.type] = (summary[conflict.type] || 0) + 1;
      return summary;
    }, {});
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations() {
    const recommendations = [];
    
    const highSeverityConflicts = this.conflicts.filter(c => c.severity === 'high');
    if (highSeverityConflicts.length > 0) {
      recommendations.push({
        type: 'urgent_resolution',
        priority: 'high',
        message: `${highSeverityConflicts.length} high-severity conflicts require immediate attention`,
        actions: ['Review major version conflicts', 'Test thoroughly before applying fixes']
      });
    }
    
    const peerConflicts = this.conflicts.filter(c => c.type === 'peer_dependency_conflict');
    if (peerConflicts.length > 0) {
      recommendations.push({
        type: 'peer_dependency_review',
        priority: 'medium',
        message: `${peerConflicts.length} peer dependency conflicts detected`,
        actions: ['Install missing peer dependencies', 'Update packages to compatible versions']
      });
    }
    
    const automatableResolutions = this.resolutions.filter(r => r.automatable);
    if (automatableResolutions.length > 0) {
      recommendations.push({
        type: 'automatic_fixes',
        priority: 'low',
        message: `${automatableResolutions.length} conflicts can be automatically resolved`,
        actions: ['Run npm dedupe', 'Enable automatic conflict resolution']
      });
    }
    
    return recommendations;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    return `# Dependency Conflict Resolution Report

Generated: ${report.timestamp}

## Summary

| Metric | Count |
|--------|-------|
| Total Conflicts | ${report.summary.totalConflicts} |
| Resolutions Generated | ${report.summary.resolutionsGenerated} |
| Automatic Fixes Applied | ${report.summary.automaticFixesApplied} |
| Manual Resolutions Required | ${report.summary.manualResolutionsRequired} |

## Conflict Types

${Object.entries(report.summary.conflictTypes).map(([type, count]) => `- **${type.replace('_', ' ')}**: ${count}`).join('\n')}

## Detected Conflicts

${report.conflicts.map((conflict, index) => `
### ${index + 1}. ${conflict.type.replace('_', ' ').toUpperCase()}

- **Package**: ${conflict.package || 'Multiple'}
- **Severity**: ${conflict.severity}
- **Description**: ${conflict.description}
${conflict.versions ? `- **Versions**: ${conflict.versions.join(', ')}` : ''}
`).join('\n')}

## Resolution Strategies

${report.resolutions.map((resolution, index) => `
### ${index + 1}. ${resolution.conflict.package || resolution.conflict.type}

**Recommended Strategy**: ${resolution.recommendedStrategy.description}
**Command**: \`${resolution.recommendedStrategy.command || 'Manual action required'}\`
**Risk Level**: ${resolution.recommendedStrategy.risk}
**Automatable**: ${resolution.automatable ? 'Yes' : 'No'}
${resolution.applied !== undefined ? `**Applied**: ${resolution.applied ? 'Yes' : 'No'}` : ''}

${resolution.strategies.length > 1 ? `
**Alternative Strategies**:
${resolution.strategies.slice(1).map(s => `- ${s.description} (Risk: ${s.risk})`).join('\n')}
` : ''}
`).join('\n')}

## Recommendations

${report.recommendations.map(rec => `
### ${rec.type.replace('_', ' ').toUpperCase()} (${rec.priority})

${rec.message}

**Actions**:
${rec.actions.map(action => `- ${action}`).join('\n')}
`).join('\n')}

---
*Report generated by Dependency Conflict Resolver*`;
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
      case '--no-issues':
        options.createIssues = false;
        break;
      case '--auto-fix':
        options.autoFix = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Dependency Conflict Resolution Script

Usage: node dependency-conflict-resolver.js [options]

Options:
  --dry-run      Perform analysis without applying fixes or creating issues
  --no-issues    Skip creating GitHub issues for manual resolution
  --auto-fix     Apply automatic fixes for low-risk conflicts
  --verbose      Enable verbose logging
  --help         Show this help message

Examples:
  node dependency-conflict-resolver.js --dry-run
  node dependency-conflict-resolver.js --auto-fix --verbose
  node dependency-conflict-resolver.js --no-issues
        `);
        process.exit(0);
    }
  }
  
  const resolver = new DependencyConflictResolver(options);
  
  resolver.run()
    .then(results => {
      console.log('\n✅ Dependency conflict resolution completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Dependency conflict resolution failed:', error.message);
      process.exit(1);
    });
}

export default DependencyConflictResolver;