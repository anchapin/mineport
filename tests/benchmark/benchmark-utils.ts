import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

/**
 * Interface for benchmark results
 */
export interface BenchmarkResult {
  name: string;
  duration: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  success: boolean;
  error?: Error;
}

/**
 * Interface for benchmark suite results
 */
export interface BenchmarkSuiteResult {
  name: string;
  results: BenchmarkResult[];
  totalDuration: number;
  averageDuration: number;
  startTime: Date;
  endTime: Date;
}

/**
 * Interface for benchmark history
 */
export interface BenchmarkHistory {
  benchmarks: {
    [name: string]: {
      results: {
        timestamp: string;
        duration: number;
        memoryUsage: {
          rss: number;
          heapTotal: number;
          heapUsed: number;
          external: number;
        };
      }[];
    };
  };
}

/**
 * Runs a benchmark test
 */
export async function runBenchmark(
  name: string,
  fn: () => Promise<any>
): Promise<BenchmarkResult> {
  // Record initial memory usage
  const initialMemory = process.memoryUsage();
  
  // Record start time
  const startTime = performance.now();
  
  try {
    // Run the function
    await fn();
    
    // Record end time
    const endTime = performance.now();
    
    // Record final memory usage
    const finalMemory = process.memoryUsage();
    
    // Calculate memory usage delta
    const memoryUsage = {
      rss: finalMemory.rss - initialMemory.rss,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      external: finalMemory.external - initialMemory.external,
    };
    
    // Return benchmark result
    return {
      name,
      duration: endTime - startTime,
      memoryUsage,
      success: true,
    };
  } catch (error) {
    // Record end time even if there's an error
    const endTime = performance.now();
    
    // Record final memory usage
    const finalMemory = process.memoryUsage();
    
    // Calculate memory usage delta
    const memoryUsage = {
      rss: finalMemory.rss - initialMemory.rss,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      external: finalMemory.external - initialMemory.external,
    };
    
    // Return benchmark result with error
    return {
      name,
      duration: endTime - startTime,
      memoryUsage,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Runs a benchmark suite
 */
export async function runBenchmarkSuite(
  name: string,
  benchmarks: { name: string; fn: () => Promise<any> }[]
): Promise<BenchmarkSuiteResult> {
  const startTime = new Date();
  const results: BenchmarkResult[] = [];
  
  for (const benchmark of benchmarks) {
    const result = await runBenchmark(benchmark.name, benchmark.fn);
    results.push(result);
  }
  
  const endTime = new Date();
  const totalDuration = results.reduce((sum, result) => sum + result.duration, 0);
  const averageDuration = totalDuration / results.length;
  
  return {
    name,
    results,
    totalDuration,
    averageDuration,
    startTime,
    endTime,
  };
}

/**
 * Saves benchmark results to a file
 */
export function saveBenchmarkResults(
  result: BenchmarkSuiteResult,
  outputPath: string
): void {
  // Create directory if it doesn't exist
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Format results for saving
  const formattedResults = {
    name: result.name,
    timestamp: result.startTime.toISOString(),
    duration: {
      total: result.totalDuration,
      average: result.averageDuration,
    },
    results: result.results.map(r => ({
      name: r.name,
      duration: r.duration,
      memoryUsage: r.memoryUsage,
      success: r.success,
      error: r.error ? r.error.message : undefined,
    })),
  };
  
  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(formattedResults, null, 2));
}

/**
 * Updates benchmark history
 */
export function updateBenchmarkHistory(
  result: BenchmarkSuiteResult,
  historyPath: string
): void {
  // Create directory if it doesn't exist
  const dir = path.dirname(historyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Load existing history or create new one
  let history: BenchmarkHistory = { benchmarks: {} };
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    } catch (error) {
      console.error('Error parsing benchmark history:', error);
    }
  }
  
  // Update history with new results
  for (const benchmarkResult of result.results) {
    if (!history.benchmarks[benchmarkResult.name]) {
      history.benchmarks[benchmarkResult.name] = { results: [] };
    }
    
    history.benchmarks[benchmarkResult.name].results.push({
      timestamp: result.startTime.toISOString(),
      duration: benchmarkResult.duration,
      memoryUsage: benchmarkResult.memoryUsage,
    });
  }
  
  // Write updated history to file
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Detects performance regressions
 */
export function detectRegressions(
  historyPath: string,
  threshold: number = 0.2 // 20% regression threshold
): { name: string; regression: number }[] {
  // Load history
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  
  const history: BenchmarkHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  const regressions: { name: string; regression: number }[] = [];
  
  // Check each benchmark for regressions
  for (const [name, data] of Object.entries(history.benchmarks)) {
    if (data.results.length < 2) {
      continue; // Need at least 2 results to detect regression
    }
    
    // Sort results by timestamp
    const sortedResults = [...data.results].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Get the most recent result
    const latestResult = sortedResults[sortedResults.length - 1];
    
    // Calculate baseline as average of previous results (excluding the latest)
    const previousResults = sortedResults.slice(0, sortedResults.length - 1);
    const baselineDuration = previousResults.reduce(
      (sum, result) => sum + result.duration,
      0
    ) / previousResults.length;
    
    // Calculate regression percentage
    const regression = (latestResult.duration - baselineDuration) / baselineDuration;
    
    // Check if regression exceeds threshold
    if (regression > threshold) {
      regressions.push({ name, regression });
    }
  }
  
  return regressions;
}

/**
 * Generates a benchmark report
 */
export function generateBenchmarkReport(
  historyPath: string,
  outputPath: string
): void {
  // Load history
  if (!fs.existsSync(historyPath)) {
    throw new Error(`Benchmark history not found at ${historyPath}`);
  }
  
  const history: BenchmarkHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  
  // Generate report
  let report = '# Benchmark Performance Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Add benchmark results
  report += '## Benchmark Results\n\n';
  
  for (const [name, data] of Object.entries(history.benchmarks)) {
    report += `### ${name}\n\n`;
    
    // Sort results by timestamp
    const sortedResults = [...data.results].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Create table header
    report += '| Date | Duration (ms) | Memory Usage (MB) |\n';
    report += '|------|--------------|------------------|\n';
    
    // Add table rows
    for (const result of sortedResults) {
      const date = new Date(result.timestamp).toLocaleDateString();
      const duration = result.duration.toFixed(2);
      const memoryUsage = (result.memoryUsage.heapUsed / (1024 * 1024)).toFixed(2);
      
      report += `| ${date} | ${duration} | ${memoryUsage} |\n`;
    }
    
    report += '\n';
    
    // Add trend analysis
    if (sortedResults.length >= 2) {
      const firstResult = sortedResults[0];
      const latestResult = sortedResults[sortedResults.length - 1];
      
      const durationChange = ((latestResult.duration - firstResult.duration) / firstResult.duration) * 100;
      const memoryChange = ((latestResult.memoryUsage.heapUsed - firstResult.memoryUsage.heapUsed) / firstResult.memoryUsage.heapUsed) * 100;
      
      report += '#### Trend Analysis\n\n';
      report += `- Duration: ${durationChange >= 0 ? '+' : ''}${durationChange.toFixed(2)}% since first measurement\n`;
      report += `- Memory Usage: ${memoryChange >= 0 ? '+' : ''}${memoryChange.toFixed(2)}% since first measurement\n\n`;
    }
  }
  
  // Add regression analysis
  const regressions = detectRegressions(historyPath);
  if (regressions.length > 0) {
    report += '## Performance Regressions\n\n';
    
    for (const regression of regressions) {
      report += `- **${regression.name}**: ${(regression.regression * 100).toFixed(2)}% slower than baseline\n`;
    }
    
    report += '\n';
  }
  
  // Write report to file
  fs.writeFileSync(outputPath, report);
}

/**
 * Creates a benchmark test for a specific mod complexity
 */
export function createModComplexityBenchmark(
  complexity: 'simple' | 'medium' | 'complex',
  modCount: number
): { name: string; fn: () => Promise<any> } {
  return {
    name: `${complexity}-mod-${modCount}`,
    fn: async () => {
      // Implementation depends on complexity and count
      // This is a placeholder for the actual benchmark implementation
      await new Promise(resolve => setTimeout(resolve, 100 * modCount));
    }
  };
}