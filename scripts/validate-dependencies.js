#!/usr/bin/env node

/**
 * Dependency Validation Script
 * 
 * This script validates module dependencies and fails if circular dependencies are detected.
 * It can be integrated into the CI/CD pipeline to prevent circular dependencies.
 */

import DependencyAnalyzer from './analyze-dependencies.js';

class DependencyValidator {
  constructor() {
    this.analyzer = new DependencyAnalyzer();
  }

  /**
   * Validate dependencies and exit with appropriate code
   */
  validate() {
    console.log('🔍 Validating module dependencies...\n');
    
    // Analyze dependencies
    this.analyzer.analyze();
    
    let hasErrors = false;
    
    // Check for circular dependencies
    if (this.analyzer.circularDependencies.length > 0) {
      console.error(`❌ VALIDATION FAILED: ${this.analyzer.circularDependencies.length} circular dependencies detected\n`);
      
      this.analyzer.circularDependencies.forEach((cycle, i) => {
        console.error(`  ${i + 1}. ${cycle.join(' → ')}`);
      });
      
      console.error('\n💡 To fix circular dependencies:');
      console.error('  - Move shared functionality to a common module');
      console.error('  - Use dependency injection');
      console.error('  - Refactor to break circular references');
      console.error('  - Consider using interfaces to reduce coupling\n');
      
      hasErrors = true;
    } else {
      console.log('✅ No circular dependencies detected\n');
    }
    
    // Check for high coupling
    const highCouplingModules = [];
    for (const [module, deps] of this.analyzer.dependencies) {
      if (deps.size > 6) { // Threshold for high coupling
        highCouplingModules.push({ module, count: deps.size });
      }
    }
    
    if (highCouplingModules.length > 0) {
      console.warn(`⚠️  WARNING: High coupling detected in ${highCouplingModules.length} modules:\n`);
      
      highCouplingModules.forEach(({ module, count }) => {
        console.warn(`  - ${module}: ${count} dependencies`);
      });
      
      console.warn('\n💡 Consider refactoring highly coupled modules\n');
    }
    
    // Summary
    console.log(`📊 Dependency Analysis Summary:`);
    console.log(`  - Total Modules: ${this.analyzer.modules.size}`);
    console.log(`  - Total Dependencies: ${Array.from(this.analyzer.dependencies.values()).reduce((sum, deps) => sum + deps.size, 0)}`);
    console.log(`  - Circular Dependencies: ${this.analyzer.circularDependencies.length}`);
    console.log(`  - High Coupling Modules: ${highCouplingModules.length}\n`);
    
    if (hasErrors) {
      console.error('❌ Dependency validation failed!');
      process.exit(1);
    } else {
      console.log('✅ Dependency validation passed!');
      process.exit(0);
    }
  }
}

// Run validation
const validator = new DependencyValidator();
validator.validate();