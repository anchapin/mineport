const fs = require('fs');
const path = require('path');

// Import benchmark utilities
const { generateBenchmarkReport, detectRegressions } = require('../dist/tests/benchmark/benchmark-utils');

// Path to benchmark history
const historyPath = path.join(__dirname, '../benchmark-results/benchmark-history.json');

// Path to output report
const reportPath = path.join(__dirname, '../benchmark-results/benchmark-report.md');

// Check if history exists
if (!fs.existsSync(historyPath)) {
  console.error(`Benchmark history not found at ${historyPath}`);
  console.error('Run benchmarks first with: npm run benchmark');
  process.exit(1);
}

try {
  // Generate report
  generateBenchmarkReport(historyPath, reportPath);
  console.log(`Benchmark report generated at ${reportPath}`);
  
  // Check for regressions
  const regressions = detectRegressions(historyPath);
  
  if (regressions.length > 0) {
    console.log('\nPerformance regressions detected:');
    regressions.forEach(regression => {
      console.log(`- ${regression.name}: ${(regression.regression * 100).toFixed(2)}% slower than baseline`);
    });
  } else {
    console.log('\nNo performance regressions detected.');
  }
} catch (error) {
  console.error('Error generating benchmark report:', error);
  process.exit(1);
}