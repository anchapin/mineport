#!/usr/bin/env node

/**
 * Module Dependency Analyzer
 *
 * This script analyzes the dependencies between modules in the Minecraft Mod Converter
 * and generates documentation and validation reports.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DependencyAnalyzer {
  constructor() {
    this.dependencies = new Map();
    this.modules = new Set();
    this.circularDependencies = [];
  }

  /**
   * Analyze all TypeScript files in the project
   */
  analyze() {
    console.log('🔍 Analyzing module dependencies...\n');

    // Find all TypeScript files
    const srcDir = path.join(process.cwd(), 'src');
    this.scanDirectory(srcDir);

    // Detect circular dependencies
    this.detectCircularDependencies();

    // Generate reports
    this.generateDependencyGraph();
    this.generateModuleDocumentation();
    this.generateValidationReport();

    console.log('✅ Dependency analysis complete!');
  }

  /**
   * Recursively scan directory for TypeScript files
   */
  scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        this.scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        this.analyzeFile(fullPath);
      }
    }
  }

  /**
   * Analyze a single TypeScript file for dependencies
   */
  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    // Extract module name from path
    const moduleName = this.getModuleName(relativePath);
    if (moduleName) {
      this.modules.add(moduleName);
    }

    // Find import statements
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    const fileDependencies = new Set();

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const dependencyModule = this.resolveDependency(relativePath, importPath);

      if (dependencyModule && dependencyModule !== moduleName) {
        fileDependencies.add(dependencyModule);
      }
    }

    if (moduleName && fileDependencies.size > 0) {
      if (!this.dependencies.has(moduleName)) {
        this.dependencies.set(moduleName, new Set());
      }

      for (const dep of fileDependencies) {
        this.dependencies.get(moduleName).add(dep);
      }
    }
  }

  /**
   * Extract module name from file path
   */
  getModuleName(filePath) {
    const parts = filePath.split('/');

    if (parts.includes('modules')) {
      const moduleIndex = parts.indexOf('modules');
      if (moduleIndex + 1 < parts.length) {
        return `modules/${parts[moduleIndex + 1]}`;
      }
    } else if (parts.includes('services')) {
      return 'services';
    } else if (parts.includes('utils')) {
      return 'utils';
    } else if (parts.includes('types')) {
      return 'types';
    }

    return null;
  }

  /**
   * Resolve import path to module name
   */
  resolveDependency(currentFile, importPath) {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const currentDir = path.dirname(currentFile);
      const resolvedPath = path.resolve(currentDir, importPath);
      const relativePath = path.relative(process.cwd(), resolvedPath);
      return this.getModuleName(relativePath);
    }

    // Handle absolute imports (if any)
    if (importPath.startsWith('src/')) {
      return this.getModuleName(importPath);
    }

    return null;
  }

  /**
   * Detect circular dependencies using DFS
   */
  detectCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();

    for (const module of this.modules) {
      if (!visited.has(module)) {
        this.dfsCircularCheck(module, visited, recursionStack, []);
      }
    }
  }

  /**
   * DFS helper for circular dependency detection
   */
  dfsCircularCheck(module, visited, recursionStack, path) {
    visited.add(module);
    recursionStack.add(module);
    path.push(module);

    const dependencies = this.dependencies.get(module) || new Set();

    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        this.dfsCircularCheck(dep, visited, recursionStack, [...path]);
      } else if (recursionStack.has(dep)) {
        // Found circular dependency
        const cycleStart = path.indexOf(dep);
        const cycle = path.slice(cycleStart).concat([dep]);
        this.circularDependencies.push(cycle);
      }
    }

    recursionStack.delete(module);
  }

  /**
   * Generate dependency graph in Mermaid format
   */
  generateDependencyGraph() {
    let mermaid = '```mermaid\ngraph TD\n';

    // Add nodes
    for (const module of this.modules) {
      const displayName = module.replace('modules/', '').replace(/\//g, '_');
      mermaid += `    ${displayName}[${module}]\n`;
    }

    mermaid += '\n';

    // Add edges
    for (const [module, deps] of this.dependencies) {
      const fromName = module.replace('modules/', '').replace(/\//g, '_');
      for (const dep of deps) {
        const toName = dep.replace('modules/', '').replace(/\//g, '_');
        mermaid += `    ${fromName} --> ${toName}\n`;
      }
    }

    mermaid += '```\n';

    // Write to file
    const outputPath = path.join(process.cwd(), 'docs', 'module-dependencies.md');
    const content = `# Module Dependency Graph

This document shows the dependencies between modules in the Minecraft Mod Converter.

## Dependency Graph

${mermaid}

## Module Descriptions

${this.generateModuleDescriptions()}

## Dependency Analysis

- **Total Modules**: ${this.modules.size}
- **Total Dependencies**: ${Array.from(this.dependencies.values()).reduce((sum, deps) => sum + deps.size, 0)}
- **Circular Dependencies**: ${this.circularDependencies.length}

${this.circularDependencies.length > 0 ? `
## ⚠️ Circular Dependencies Detected

${this.circularDependencies.map((cycle, i) => `
### Circular Dependency ${i + 1}
\`${cycle.join(' → ')}\`
`).join('')}
` : '## ✅ No Circular Dependencies Found'}
`;

    fs.writeFileSync(outputPath, content);
    console.log(`📊 Dependency graph written to: ${outputPath}`);
  }

  /**
   * Generate module descriptions
   */
  generateModuleDescriptions() {
    const descriptions = {
      'modules/assets': 'Handles conversion of textures, models, sounds, and particles',
      'modules/compromise': 'Implements smart compromise strategies for unsupported features',
      'modules/configuration': 'Converts manifests, recipes, and configuration files',
      'modules/ingestion': 'Validates and analyzes input Java mods',
      'modules/logic': 'Transpiles Java code to JavaScript',
      'modules/packaging': 'Packages and validates the final addon',
      'modules/ui': 'Provides the React-based user interface',
      'services': 'Core application services and infrastructure',
      'utils': 'Utility functions and helpers',
      'types': 'TypeScript type definitions'
    };

    return Array.from(this.modules)
      .sort()
      .map(module => `- **${module}**: ${descriptions[module] || 'Module description not available'}`)
      .join('\n');
  }

  /**
   * Generate module documentation
   */
  generateModuleDocumentation() {
    const outputPath = path.join(process.cwd(), 'docs', 'module-interactions.md');

    let content = `# Module Interactions Documentation

This document describes how modules interact with each other in the Minecraft Mod Converter.

## Module Dependency Matrix

| Module | Dependencies | Dependents |
|--------|-------------|------------|
`;

    for (const module of Array.from(this.modules).sort()) {
      const deps = this.dependencies.get(module) || new Set();
      const dependents = this.getDependents(module);

      content += `| ${module} | ${Array.from(deps).join(', ') || 'None'} | ${dependents.join(', ') || 'None'} |\n`;
    }

    content += `\n## Detailed Module Interactions\n\n`;

    for (const module of Array.from(this.modules).sort()) {
      const deps = this.dependencies.get(module) || new Set();
      if (deps.size > 0) {
        content += `### ${module}\n\n`;
        content += `**Dependencies**: ${Array.from(deps).join(', ')}\n\n`;
        content += `**Interaction Details**:\n`;

        for (const dep of deps) {
          content += `- Uses **${dep}** for ${this.getInteractionDescription(module, dep)}\n`;
        }

        content += '\n';
      }
    }

    fs.writeFileSync(outputPath, content);
    console.log(`📋 Module interactions documented in: ${outputPath}`);
  }

  /**
   * Get modules that depend on the given module
   */
  getDependents(targetModule) {
    const dependents = [];

    for (const [module, deps] of this.dependencies) {
      if (deps.has(targetModule)) {
        dependents.push(module);
      }
    }

    return dependents;
  }

  /**
   * Get interaction description between modules
   */
  getInteractionDescription(from, to) {
    const interactions = {
      'services': {
        'modules/assets': 'asset conversion orchestration',
        'modules/compromise': 'compromise strategy execution',
        'modules/configuration': 'configuration processing',
        'modules/ingestion': 'mod validation and analysis',
        'modules/logic': 'code translation',
        'modules/packaging': 'addon packaging and validation',
        'utils': 'utility functions and logging',
        'types': 'type definitions'
      },
      'modules/ui': {
        'services': 'backend API communication',
        'types': 'type definitions',
        'modules/compromise': 'compromise strategy configuration'
      }
    };

    return interactions[from]?.[to] || 'shared functionality';
  }

  /**
   * Generate validation report
   */
  generateValidationReport() {
    const outputPath = path.join(process.cwd(), 'docs', 'dependency-validation.md');

    let content = `# Dependency Validation Report

Generated on: ${new Date().toISOString()}

## Summary

- **Total Modules Analyzed**: ${this.modules.size}
- **Total Dependencies**: ${Array.from(this.dependencies.values()).reduce((sum, deps) => sum + deps.size, 0)}
- **Circular Dependencies**: ${this.circularDependencies.length}

## Validation Results

`;

    if (this.circularDependencies.length === 0) {
      content += `✅ **PASS**: No circular dependencies detected\n\n`;
    } else {
      content += `❌ **FAIL**: ${this.circularDependencies.length} circular dependencies detected\n\n`;
      content += `### Circular Dependencies\n\n`;

      this.circularDependencies.forEach((cycle, i) => {
        content += `${i + 1}. \`${cycle.join(' → ')}\`\n`;
      });

      content += '\n### Recommendations\n\n';
      content += '- Review the circular dependencies listed above\n';
      content += '- Consider refactoring to break circular dependencies\n';
      content += '- Move shared functionality to a common module\n';
      content += '- Use dependency injection to reduce coupling\n\n';
    }

    // Check for high coupling
    const highCouplingModules = [];
    for (const [module, deps] of this.dependencies) {
      if (deps.size > 5) {
        highCouplingModules.push({ module, count: deps.size });
      }
    }

    if (highCouplingModules.length > 0) {
      content += `⚠️ **WARNING**: High coupling detected in ${highCouplingModules.length} modules\n\n`;
      content += `### High Coupling Modules\n\n`;

      highCouplingModules.forEach(({ module, count }) => {
        content += `- **${module}**: ${count} dependencies\n`;
      });

      content += '\n### Recommendations\n\n';
      content += '- Consider breaking down highly coupled modules\n';
      content += '- Use interfaces to reduce direct dependencies\n';
      content += '- Apply the Single Responsibility Principle\n\n';
    } else {
      content += `✅ **PASS**: No high coupling detected\n\n`;
    }

    content += `## Module Dependency Details\n\n`;

    for (const [module, deps] of Array.from(this.dependencies.entries()).sort()) {
      content += `### ${module}\n`;
      content += `- **Dependency Count**: ${deps.size}\n`;
      content += `- **Dependencies**: ${Array.from(deps).join(', ') || 'None'}\n`;
      content += `- **Dependents**: ${this.getDependents(module).join(', ') || 'None'}\n\n`;
    }

    fs.writeFileSync(outputPath, content);
    console.log(`✅ Validation report written to: ${outputPath}`);
  }
}

// Run the analyzer
const analyzer = new DependencyAnalyzer();
analyzer.analyze();

export default DependencyAnalyzer;
