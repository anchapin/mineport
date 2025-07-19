const fs = require('fs');
const path = require('path');

// Path to the coverage report JSON file
const coverageJsonPath = path.join(__dirname, '../coverage/coverage-final.json');

// Check if the coverage report exists
if (!fs.existsSync(coverageJsonPath)) {
  console.error('Coverage report not found. Run "npm run test:coverage" first.');
  process.exit(1);
}

// Read the coverage report
const coverageData = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));

// Calculate overall statistics
let totalStatements = 0;
let coveredStatements = 0;
let totalBranches = 0;
let coveredBranches = 0;
let totalFunctions = 0;
let coveredFunctions = 0;
let totalLines = 0;
let coveredLines = 0;

// Module statistics
const moduleStats = {};

// Process each file in the coverage report
Object.entries(coverageData).forEach(([filePath, data]) => {
  // Skip node_modules and test files
  if (filePath.includes('node_modules') || filePath.includes('/tests/')) {
    return;
  }

  // Extract module name from file path
  const moduleName = getModuleName(filePath);
  
  if (!moduleStats[moduleName]) {
    moduleStats[moduleName] = {
      statements: { total: 0, covered: 0 },
      branches: { total: 0, covered: 0 },
      functions: { total: 0, covered: 0 },
      lines: { total: 0, covered: 0 },
      files: 0,
    };
  }
  
  // Count statements
  const statementTotal = Object.keys(data.s).length;
  const statementCovered = Object.values(data.s).filter(v => v > 0).length;
  totalStatements += statementTotal;
  coveredStatements += statementCovered;
  moduleStats[moduleName].statements.total += statementTotal;
  moduleStats[moduleName].statements.covered += statementCovered;
  
  // Count branches
  const branchTotal = Object.keys(data.b).length * 2; // Each branch has two paths
  const branchCovered = Object.values(data.b).reduce((sum, [t, f]) => sum + (t > 0 ? 1 : 0) + (f > 0 ? 1 : 0), 0);
  totalBranches += branchTotal;
  coveredBranches += branchCovered;
  moduleStats[moduleName].branches.total += branchTotal;
  moduleStats[moduleName].branches.covered += branchCovered;
  
  // Count functions
  const functionTotal = Object.keys(data.f).length;
  const functionCovered = Object.values(data.f).filter(v => v > 0).length;
  totalFunctions += functionTotal;
  coveredFunctions += functionCovered;
  moduleStats[moduleName].functions.total += functionTotal;
  moduleStats[moduleName].functions.covered += functionCovered;
  
  // Count lines
  const lineTotal = Object.keys(data.l).length;
  const lineCovered = Object.values(data.l).filter(v => v > 0).length;
  totalLines += lineTotal;
  coveredLines += lineCovered;
  moduleStats[moduleName].lines.total += lineTotal;
  moduleStats[moduleName].lines.covered += lineCovered;
  
  // Count files
  moduleStats[moduleName].files += 1;
});

// Generate the report
console.log('=== Code Coverage Report ===\n');

// Overall statistics
console.log('Overall Coverage:');
console.log(`Statements: ${formatPercentage(coveredStatements, totalStatements)} (${coveredStatements}/${totalStatements})`);
console.log(`Branches: ${formatPercentage(coveredBranches, totalBranches)} (${coveredBranches}/${totalBranches})`);
console.log(`Functions: ${formatPercentage(coveredFunctions, totalFunctions)} (${coveredFunctions}/${totalFunctions})`);
console.log(`Lines: ${formatPercentage(coveredLines, totalLines)} (${coveredLines}/${totalLines})`);
console.log('\n');

// Module statistics
console.log('Coverage by Module:');
Object.entries(moduleStats).sort().forEach(([moduleName, stats]) => {
  console.log(`\n${moduleName} (${stats.files} files):`);
  console.log(`  Statements: ${formatPercentage(stats.statements.covered, stats.statements.total)} (${stats.statements.covered}/${stats.statements.total})`);
  console.log(`  Branches: ${formatPercentage(stats.branches.covered, stats.branches.total)} (${stats.branches.covered}/${stats.branches.total})`);
  console.log(`  Functions: ${formatPercentage(stats.functions.covered, stats.functions.total)} (${stats.functions.covered}/${stats.functions.total})`);
  console.log(`  Lines: ${formatPercentage(stats.lines.covered, stats.lines.total)} (${stats.lines.covered}/${stats.lines.total})`);
});

// Helper function to format percentage
function formatPercentage(covered, total) {
  if (total === 0) return '100.00%';
  return `${((covered / total) * 100).toFixed(2)}%`;
}

// Helper function to extract module name from file path
function getModuleName(filePath) {
  if (filePath.includes('/src/modules/')) {
    const match = filePath.match(/\/src\/modules\/([^/]+)/);
    return match ? `modules/${match[1]}` : 'other';
  } else if (filePath.includes('/src/services/')) {
    return 'services';
  } else if (filePath.includes('/src/utils/')) {
    return 'utils';
  } else if (filePath.includes('/src/types/')) {
    return 'types';
  } else {
    return 'core';
  }
}

console.log('\nDetailed HTML report available at: coverage/index.html');