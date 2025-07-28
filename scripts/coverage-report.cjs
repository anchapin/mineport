const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Interface coverage tracking
const interfaceCoverage = {
  totalInterfaces: 0,
  testedInterfaces: 0,
  interfaceDetails: {},
};

// Error handling coverage tracking
const errorHandlingCoverage = {
  totalErrorHandlers: 0,
  testedErrorHandlers: 0,
  errorHandlerDetails: {},
};

// Integration test coverage tracking
const integrationCoverage = {
  totalModuleInteractions: 0,
  testedModuleInteractions: 0,
  interactionDetails: {},
};

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
      interfaces: { total: 0, tested: 0 },
      errorHandlers: { total: 0, tested: 0 },
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
  
  // Analyze interface and error handling coverage
  analyzeInterfaceAndErrorCoverage(filePath, data, moduleName);
});

// Analyze integration test coverage
analyzeIntegrationTestCoverage();

// Generate the report
console.log('=== Code Coverage Report ===\n');

// Overall statistics
console.log('Overall Coverage:');
console.log(`Statements: ${formatPercentage(coveredStatements, totalStatements)} (${coveredStatements}/${totalStatements})`);
console.log(`Branches: ${formatPercentage(coveredBranches, totalBranches)} (${coveredBranches}/${totalBranches})`);
console.log(`Functions: ${formatPercentage(coveredFunctions, totalFunctions)} (${coveredFunctions}/${totalFunctions})`);
console.log(`Lines: ${formatPercentage(coveredLines, totalLines)} (${coveredLines}/${totalLines})`);
console.log('\n');

// Interface coverage statistics
console.log('Interface Coverage:');
console.log(`Total Interfaces: ${interfaceCoverage.totalInterfaces}`);
console.log(`Tested Interfaces: ${interfaceCoverage.testedInterfaces}`);
console.log(`Interface Coverage: ${formatPercentage(interfaceCoverage.testedInterfaces, interfaceCoverage.totalInterfaces)}`);
console.log('\n');

// Error handling coverage statistics
console.log('Error Handling Coverage:');
console.log(`Total Error Handlers: ${errorHandlingCoverage.totalErrorHandlers}`);
console.log(`Tested Error Handlers: ${errorHandlingCoverage.testedErrorHandlers}`);
console.log(`Error Handling Coverage: ${formatPercentage(errorHandlingCoverage.testedErrorHandlers, errorHandlingCoverage.totalErrorHandlers)}`);
console.log('\n');

// Integration test coverage statistics
console.log('Integration Test Coverage:');
console.log(`Total Module Interactions: ${integrationCoverage.totalModuleInteractions}`);
console.log(`Tested Module Interactions: ${integrationCoverage.testedModuleInteractions}`);
console.log(`Integration Coverage: ${formatPercentage(integrationCoverage.testedModuleInteractions, integrationCoverage.totalModuleInteractions)}`);
console.log('\n');

// Module statistics
console.log('Coverage by Module:');
Object.entries(moduleStats).sort().forEach(([moduleName, stats]) => {
  console.log(`\n${moduleName} (${stats.files} files):`);
  console.log(`  Statements: ${formatPercentage(stats.statements.covered, stats.statements.total)} (${stats.statements.covered}/${stats.statements.total})`);
  console.log(`  Branches: ${formatPercentage(stats.branches.covered, stats.branches.total)} (${stats.branches.covered}/${stats.branches.total})`);
  console.log(`  Functions: ${formatPercentage(stats.functions.covered, stats.functions.total)} (${stats.functions.covered}/${stats.functions.total})`);
  console.log(`  Lines: ${formatPercentage(stats.lines.covered, stats.lines.total)} (${stats.lines.covered}/${stats.lines.total})`);
  console.log(`  Interfaces: ${formatPercentage(stats.interfaces.tested, stats.interfaces.total)} (${stats.interfaces.tested}/${stats.interfaces.total})`);
  console.log(`  Error Handlers: ${formatPercentage(stats.errorHandlers.tested, stats.errorHandlers.total)} (${stats.errorHandlers.tested}/${stats.errorHandlers.total})`);
});

// Detailed interface coverage
if (Object.keys(interfaceCoverage.interfaceDetails).length > 0) {
  console.log('\n\nDetailed Interface Coverage:');
  Object.entries(interfaceCoverage.interfaceDetails).forEach(([interfaceName, details]) => {
    console.log(`  ${interfaceName}: ${details.tested ? '✓' : '✗'} (${details.filePath})`);
  });
}

// Detailed error handling coverage
if (Object.keys(errorHandlingCoverage.errorHandlerDetails).length > 0) {
  console.log('\n\nDetailed Error Handling Coverage:');
  Object.entries(errorHandlingCoverage.errorHandlerDetails).forEach(([handlerName, details]) => {
    console.log(`  ${handlerName}: ${details.tested ? '✓' : '✗'} (${details.filePath})`);
  });
}

// Detailed integration test coverage
if (Object.keys(integrationCoverage.interactionDetails).length > 0) {
  console.log('\n\nDetailed Integration Test Coverage:');
  Object.entries(integrationCoverage.interactionDetails).forEach(([interactionName, details]) => {
    console.log(`  ${interactionName}: ${details.tested ? '✓' : '✗'}`);
  });
}

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

// Analysis functions

function analyzeInterfaceAndErrorCoverage(filePath, coverageData, moduleName) {
  try {
    // Read the source file to analyze interfaces and error handling
    const sourceContent = fs.readFileSync(filePath, 'utf8');
    
    // Find interfaces in the file
    const interfaceMatches = sourceContent.match(/(?:export\s+)?interface\s+(\w+)/g) || [];
    interfaceMatches.forEach(match => {
      const interfaceName = match.match(/interface\s+(\w+)/)[1];
      const interfaceKey = `${moduleName}:${interfaceName}`;
      
      interfaceCoverage.totalInterfaces++;
      moduleStats[moduleName].interfaces.total++;
      
      // Check if interface is tested by looking for test files that import it
      const isTested = checkIfInterfaceIsTested(interfaceName, filePath);
      
      interfaceCoverage.interfaceDetails[interfaceKey] = {
        tested: isTested,
        filePath: filePath.replace(process.cwd(), ''),
      };
      
      if (isTested) {
        interfaceCoverage.testedInterfaces++;
        moduleStats[moduleName].interfaces.tested++;
      }
    });
    
    // Find error handling patterns
    const errorHandlingPatterns = [
      /try\s*{[\s\S]*?catch/g,
      /\.catch\s*\(/g,
      /throw\s+new\s+\w*Error/g,
      /ConversionError/g,
    ];
    
    errorHandlingPatterns.forEach((pattern, index) => {
      const matches = sourceContent.match(pattern) || [];
      matches.forEach((match, matchIndex) => {
        const handlerKey = `${moduleName}:${path.basename(filePath)}:handler-${index}-${matchIndex}`;
        
        errorHandlingCoverage.totalErrorHandlers++;
        moduleStats[moduleName].errorHandlers.total++;
        
        // Check if error handler is covered by looking at coverage data
        const isTested = checkIfErrorHandlerIsTested(match, sourceContent, coverageData);
        
        errorHandlingCoverage.errorHandlerDetails[handlerKey] = {
          tested: isTested,
          filePath: filePath.replace(process.cwd(), ''),
          pattern: match.substring(0, 50) + (match.length > 50 ? '...' : ''),
        };
        
        if (isTested) {
          errorHandlingCoverage.testedErrorHandlers++;
          moduleStats[moduleName].errorHandlers.tested++;
        }
      });
    });
    
  } catch (error) {
    // Silently skip files that can't be read
  }
}

function checkIfInterfaceIsTested(interfaceName, filePath) {
  try {
    // Look for test files that might test this interface
    const testPatterns = [
      `tests/**/*${path.basename(filePath, '.ts')}.test.ts`,
      `tests/**/*${interfaceName}*.test.ts`,
      'tests/integration/**/*.test.ts',
    ];
    
    for (const pattern of testPatterns) {
      const testFiles = findFiles(pattern);
      for (const testFile of testFiles) {
        try {
          const testContent = fs.readFileSync(testFile, 'utf8');
          if (testContent.includes(interfaceName)) {
            return true;
          }
        } catch (e) {
          // Skip files that can't be read
        }
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

function checkIfErrorHandlerIsTested(errorHandler, sourceContent, coverageData) {
  // Find the line number of the error handler
  const lines = sourceContent.split('\n');
  let lineNumber = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(errorHandler.substring(0, 20))) {
      lineNumber = i + 1;
      break;
    }
  }
  
  if (lineNumber === -1) return false;
  
  // Check if this line is covered in the coverage data
  return coverageData.l && coverageData.l[lineNumber] && coverageData.l[lineNumber] > 0;
}

function analyzeIntegrationTestCoverage() {
  try {
    // Find all integration test files
    const integrationTestFiles = findFiles('tests/integration/**/*.test.ts');
    
    // Define expected module interactions
    const expectedInteractions = [
      'ModValidator -> AssetTranslationModule',
      'AssetTranslationModule -> LogicTranslationEngine',
      'LogicTranslationEngine -> CompromiseStrategyEngine',
      'CompromiseStrategyEngine -> AddonPackager',
      'ErrorCollector -> All Modules',
      'ConfigurationService -> All Modules',
      'ConversionPipeline -> All Modules',
    ];
    
    integrationCoverage.totalModuleInteractions = expectedInteractions.length;
    
    // Check which interactions are tested
    expectedInteractions.forEach(interaction => {
      let isTested = false;
      
      for (const testFile of integrationTestFiles) {
        try {
          const testContent = fs.readFileSync(testFile, 'utf8');
          
          // Check if the test file contains references to both modules in the interaction
          const [sourceModule, targetModule] = interaction.split(' -> ');
          
          if (testContent.includes(sourceModule) && 
              (testContent.includes(targetModule) || targetModule === 'All Modules')) {
            isTested = true;
            break;
          }
        } catch (e) {
          // Skip files that can't be read
        }
      }
      
      integrationCoverage.interactionDetails[interaction] = {
        tested: isTested,
      };
      
      if (isTested) {
        integrationCoverage.testedModuleInteractions++;
      }
    });
    
  } catch (error) {
    // Silently handle errors
  }
}

function findFiles(pattern) {
  try {
    // Simple file finding - in a real implementation, you might use glob
    const files = [];
    const searchDir = pattern.includes('integration') ? 'tests/integration' : 'tests';
    
    if (fs.existsSync(searchDir)) {
      const findInDir = (dir) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            findInDir(fullPath);
          } else if (item.endsWith('.test.ts')) {
            files.push(fullPath);
          }
        }
      };
      
      findInDir(searchDir);
    }
    
    return files;
  } catch (error) {
    return [];
  }
}