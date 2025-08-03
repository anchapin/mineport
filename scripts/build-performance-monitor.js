#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Build Performance Monitor
 * Tracks build times, cache performance, and optimization metrics
 */

class BuildPerformanceMonitor {
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      buildTimes: {},
      cacheMetrics: {},
      resourceUsage: {},
      optimizations: {},
      warnings: [],
      recommendations: []
    };
    this.reportDir = path.join(process.cwd(), 'build-reports');
    this.historyFile = path.join(this.reportDir, 'build-history.json');
    this.ensureReportDirectory();
  }

  ensureReportDirectory() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * Start monitoring a build phase
   */
  startPhase(phaseName) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    console.log(`📊 Starting build phase: ${phaseName}`);
    
    this.metrics.buildTimes[phaseName] = {
      startTime,
      startMemory,
      status: 'running'
    };
    
    return {
      phaseName,
      startTime,
      startMemory
    };
  }

  /**
   * End monitoring a build phase
   */
  endPhase(phaseName, success = true, additionalMetrics = {}) {
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    if (!this.metrics.buildTimes[phaseName]) {
      console.warn(`⚠️ Phase ${phaseName} was not started`);
      return;
    }

    const phase = this.metrics.buildTimes[phaseName];
    const duration = endTime - phase.startTime;
    const memoryDelta = {
      rss: endMemory.rss - phase.startMemory.rss,
      heapTotal: endMemory.heapTotal - phase.startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - phase.startMemory.heapUsed,
      external: endMemory.external - phase.startMemory.external
    };

    this.metrics.buildTimes[phaseName] = {
      ...phase,
      endTime,
      duration,
      memoryDelta,
      status: success ? 'completed' : 'failed',
      ...additionalMetrics
    };

    const statusIcon = success ? '✅' : '❌';
    console.log(`${statusIcon} Build phase ${phaseName} ${success ? 'completed' : 'failed'} in ${this.formatDuration(duration)}`);
    
    // Check for performance issues
    this.checkPhasePerformance(phaseName, duration, memoryDelta);
  }

  /**
   * Monitor cache performance
   */
  monitorCachePerformance(cacheType, cacheKey, hit = false, size = 0) {
    if (!this.metrics.cacheMetrics[cacheType]) {
      this.metrics.cacheMetrics[cacheType] = {
        hits: 0,
        misses: 0,
        totalSize: 0,
        keys: []
      };
    }

    const cache = this.metrics.cacheMetrics[cacheType];
    
    if (hit) {
      cache.hits++;
      console.log(`🎯 Cache hit for ${cacheType}: ${cacheKey}`);
    } else {
      cache.misses++;
      console.log(`💾 Cache miss for ${cacheType}: ${cacheKey}`);
    }

    cache.totalSize += size;
    cache.keys.push({
      key: cacheKey,
      hit,
      size,
      timestamp: Date.now()
    });

    // Calculate hit rate
    const hitRate = cache.hits / (cache.hits + cache.misses);
    
    // Warn about low hit rates
    if (hitRate < 0.5 && (cache.hits + cache.misses) > 5) {
      this.addWarning(`Low cache hit rate for ${cacheType}: ${(hitRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * Monitor resource usage
   */
  monitorResourceUsage() {
    const usage = process.resourceUsage();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.resourceUsage = {
      timestamp: Date.now(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      system: {
        userCPUTime: usage.userCPUTime,
        systemCPUTime: usage.systemCPUTime,
        maxRSS: usage.maxRSS,
        sharedMemorySize: usage.sharedMemorySize,
        unsharedDataSize: usage.unsharedDataSize,
        unsharedStackSize: usage.unsharedStackSize,
        minorPageFault: usage.minorPageFault,
        majorPageFault: usage.majorPageFault,
        swappedOut: usage.swappedOut,
        fsRead: usage.fsRead,
        fsWrite: usage.fsWrite,
        ipcSent: usage.ipcSent,
        ipcReceived: usage.ipcReceived,
        signalsCount: usage.signalsCount,
        voluntaryContextSwitches: usage.voluntaryContextSwitches,
        involuntaryContextSwitches: usage.involuntaryContextSwitches
      },
      platform: {
        arch: os.arch(),
        platform: os.platform(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg()
      }
    };

    // Check for resource issues
    this.checkResourceUsage();
  }

  /**
   * Track TypeScript compilation performance
   */
  monitorTypeScriptBuild() {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    const buildInfoPath = path.join(process.cwd(), 'tsconfig.tsbuildinfo');
    
    let tsConfig = {};
    let buildInfo = {};
    
    try {
      if (fs.existsSync(tsconfigPath)) {
        tsConfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      }
      
      if (fs.existsSync(buildInfoPath)) {
        buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not read TypeScript configuration:', error.message);
    }

    this.metrics.optimizations.typescript = {
      incremental: !!tsConfig.compilerOptions?.incremental,
      composite: !!tsConfig.compilerOptions?.composite,
      buildInfoExists: fs.existsSync(buildInfoPath),
      buildInfoSize: fs.existsSync(buildInfoPath) ? fs.statSync(buildInfoPath).size : 0,
      sourceFiles: buildInfo.program?.fileNames?.length || 0,
      affectedFiles: buildInfo.program?.affectedFilesPendingEmit?.length || 0
    };

    // Recommendations for TypeScript optimization
    if (!tsConfig.compilerOptions?.incremental) {
      this.addRecommendation('Enable incremental compilation in tsconfig.json for faster builds');
    }

    if (!fs.existsSync(buildInfoPath)) {
      this.addRecommendation('TypeScript build info file not found - incremental compilation may not be working');
    }
  }

  /**
   * Monitor dependency installation performance
   */
  monitorDependencyInstallation(packageManager = 'npm') {
    const lockFiles = {
      npm: 'package-lock.json',
      yarn: 'yarn.lock',
      pnpm: 'pnpm-lock.yaml'
    };

    const lockFile = lockFiles[packageManager];
    const lockFilePath = path.join(process.cwd(), lockFile);
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');

    this.metrics.optimizations.dependencies = {
      packageManager,
      lockFileExists: fs.existsSync(lockFilePath),
      lockFileSize: fs.existsSync(lockFilePath) ? fs.statSync(lockFilePath).size : 0,
      nodeModulesExists: fs.existsSync(nodeModulesPath),
      nodeModulesSize: this.getDirectorySize(nodeModulesPath),
      packageCount: this.countPackages(nodeModulesPath)
    };

    // Check for optimization opportunities
    if (!fs.existsSync(lockFilePath)) {
      this.addWarning(`Lock file ${lockFile} not found - dependency resolution may be inconsistent`);
    }

    const nodeModulesSize = this.metrics.optimizations.dependencies.nodeModulesSize;
    if (nodeModulesSize > 500 * 1024 * 1024) { // 500MB
      this.addWarning(`Large node_modules directory: ${this.formatBytes(nodeModulesSize)}`);
      this.addRecommendation('Consider using npm ci instead of npm install for faster, more reliable builds');
    }
  }

  /**
   * Check phase performance against thresholds
   */
  checkPhasePerformance(phaseName, duration, memoryDelta) {
    const thresholds = {
      'dependency-install': { maxDuration: 120000, maxMemory: 200 * 1024 * 1024 }, // 2 minutes, 200MB
      'typescript-build': { maxDuration: 60000, maxMemory: 300 * 1024 * 1024 },    // 1 minute, 300MB
      'lint': { maxDuration: 30000, maxMemory: 100 * 1024 * 1024 },                // 30 seconds, 100MB
      'test': { maxDuration: 300000, maxMemory: 500 * 1024 * 1024 }                // 5 minutes, 500MB
    };

    const threshold = thresholds[phaseName];
    if (!threshold) return;

    if (duration > threshold.maxDuration) {
      this.addWarning(`${phaseName} took ${this.formatDuration(duration)}, exceeding threshold of ${this.formatDuration(threshold.maxDuration)}`);
    }

    if (memoryDelta.heapUsed > threshold.maxMemory) {
      this.addWarning(`${phaseName} used ${this.formatBytes(memoryDelta.heapUsed)} memory, exceeding threshold of ${this.formatBytes(threshold.maxMemory)}`);
    }
  }

  /**
   * Check overall resource usage
   */
  checkResourceUsage() {
    const { memory, platform } = this.metrics.resourceUsage;
    
    // Check memory usage
    const memoryUsagePercent = (memory.heapUsed / platform.totalMemory) * 100;
    if (memoryUsagePercent > 80) {
      this.addWarning(`High memory usage: ${memoryUsagePercent.toFixed(1)}% of total system memory`);
    }

    // Check available memory
    const availableMemoryPercent = (platform.freeMemory / platform.totalMemory) * 100;
    if (availableMemoryPercent < 10) {
      this.addWarning(`Low available memory: ${availableMemoryPercent.toFixed(1)}% remaining`);
    }

    // Check load average (Unix systems)
    if (platform.loadAverage && platform.loadAverage.length > 0) {
      const loadAvg1min = platform.loadAverage[0];
      if (loadAvg1min > platform.cpus * 2) {
        this.addWarning(`High system load: ${loadAvg1min.toFixed(2)} (${platform.cpus} CPUs available)`);
      }
    }
  }

  /**
   * Add a warning
   */
  addWarning(message) {
    this.metrics.warnings.push({
      message,
      timestamp: Date.now()
    });
    console.warn(`⚠️ ${message}`);
  }

  /**
   * Add a recommendation
   */
  addRecommendation(message) {
    this.metrics.recommendations.push({
      message,
      timestamp: Date.now()
    });
    console.log(`💡 ${message}`);
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration,
      commit: process.env.GITHUB_SHA || 'unknown',
      branch: process.env.GITHUB_REF_NAME || 'unknown',
      runner: process.env.RUNNER_OS || 'unknown',
      nodeVersion: process.version,
      workflow: process.env.GITHUB_WORKFLOW || 'unknown',
      runId: process.env.GITHUB_RUN_ID || 'unknown',
      runNumber: process.env.GITHUB_RUN_NUMBER || 'unknown',
      actor: process.env.GITHUB_ACTOR || 'unknown',
      eventName: process.env.GITHUB_EVENT_NAME || 'unknown',
      ...this.metrics
    };

    // Save JSON report
    const reportPath = path.join(this.reportDir, `build-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = path.join(this.reportDir, `build-report-${Date.now()}.md`);
    fs.writeFileSync(markdownPath, markdownReport);

    // Update history
    this.updateHistory(report);

    // Generate pipeline metrics for monitoring system
    this.generatePipelineMetrics(report);

    console.log(`📊 Build performance report generated:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   Markdown: ${markdownPath}`);

    return report;
  }

  /**
   * Generate pipeline metrics for the monitoring system
   */
  generatePipelineMetrics(report) {
    try {
      const pipelineMetrics = {
        timestamp: report.timestamp,
        workflow: {
          name: report.workflow,
          run_id: report.runId,
          run_number: report.runNumber,
          actor: report.actor,
          event: report.eventName,
          commit: report.commit,
          branch: report.branch,
          runner: report.runner
        },
        performance: {
          total_duration: report.totalDuration,
          phases: Object.entries(report.buildTimes).map(([name, phase]) => ({
            name,
            duration: phase.duration || 0,
            status: phase.status,
            memory_delta: phase.memoryDelta ? {
              heap_used: phase.memoryDelta.heapUsed,
              heap_total: phase.memoryDelta.heapTotal,
              rss: phase.memoryDelta.rss
            } : null
          })),
          cache_performance: Object.entries(report.cacheMetrics).map(([type, cache]) => ({
            type,
            hit_rate: cache.hits + cache.misses > 0 ? cache.hits / (cache.hits + cache.misses) : 0,
            hits: cache.hits,
            misses: cache.misses,
            total_size: cache.totalSize
          })),
          resource_usage: report.resourceUsage ? {
            memory: {
              heap_used: report.resourceUsage.memory.heapUsed,
              heap_total: report.resourceUsage.memory.heapTotal,
              rss: report.resourceUsage.memory.rss,
              external: report.resourceUsage.memory.external
            },
            system: {
              cpu_count: report.resourceUsage.platform.cpus,
              total_memory: report.resourceUsage.platform.totalMemory,
              free_memory: report.resourceUsage.platform.freeMemory,
              load_average: report.resourceUsage.platform.loadAverage
            }
          } : null
        },
        quality: {
          warnings_count: report.warnings.length,
          recommendations_count: report.recommendations.length,
          warnings: report.warnings.map(w => ({
            message: w.message,
            timestamp: w.timestamp
          })),
          recommendations: report.recommendations.map(r => ({
            message: r.message,
            timestamp: r.timestamp
          }))
        },
        optimizations: {
          typescript: report.optimizations.typescript || null,
          dependencies: report.optimizations.dependencies || null
        }
      };

      // Save pipeline metrics
      const pipelineMetricsPath = path.join(this.reportDir, `pipeline-metrics-${Date.now()}.json`);
      fs.writeFileSync(pipelineMetricsPath, JSON.stringify(pipelineMetrics, null, 2));

      console.log(`📈 Pipeline metrics generated: ${pipelineMetricsPath}`);

      // If monitoring webhook is configured, send metrics
      if (process.env.MONITORING_WEBHOOK_URL) {
        this.sendPipelineMetrics(pipelineMetrics);
      }

      return pipelineMetrics;
    } catch (error) {
      console.warn('Failed to generate pipeline metrics:', error.message);
    }
  }

  /**
   * Send pipeline metrics to monitoring webhook
   */
  async sendPipelineMetrics(metrics) {
    try {
      const response = await fetch(process.env.MONITORING_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BuildPerformanceMonitor/1.0'
        },
        body: JSON.stringify({
          type: 'pipeline_metrics',
          data: metrics
        })
      });

      if (response.ok) {
        console.log('✅ Pipeline metrics sent to monitoring system');
      } else {
        console.warn(`⚠️ Failed to send pipeline metrics: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to send pipeline metrics:', error.message);
    }
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    let markdown = `# Build Performance Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n`;
    markdown += `**Commit:** ${report.commit}\n`;
    markdown += `**Branch:** ${report.branch}\n`;
    markdown += `**Runner:** ${report.runner}\n`;
    markdown += `**Node Version:** ${report.nodeVersion}\n`;
    markdown += `**Total Duration:** ${this.formatDuration(report.totalDuration)}\n\n`;

    // Build phases
    markdown += `## Build Phases\n\n`;
    markdown += `| Phase | Duration | Status | Memory Usage |\n`;
    markdown += `|-------|----------|--------|-------------|\n`;
    
    for (const [phaseName, phase] of Object.entries(report.buildTimes)) {
      const status = phase.status === 'completed' ? '✅' : phase.status === 'failed' ? '❌' : '⏳';
      const memoryUsage = phase.memoryDelta ? this.formatBytes(phase.memoryDelta.heapUsed) : 'N/A';
      markdown += `| ${phaseName} | ${this.formatDuration(phase.duration || 0)} | ${status} | ${memoryUsage} |\n`;
    }
    markdown += `\n`;

    // Cache performance
    if (Object.keys(report.cacheMetrics).length > 0) {
      markdown += `## Cache Performance\n\n`;
      markdown += `| Cache Type | Hit Rate | Hits | Misses | Total Size |\n`;
      markdown += `|------------|----------|------|--------|------------|\n`;
      
      for (const [cacheType, cache] of Object.entries(report.cacheMetrics)) {
        const hitRate = cache.hits + cache.misses > 0 ? (cache.hits / (cache.hits + cache.misses) * 100).toFixed(1) : '0';
        markdown += `| ${cacheType} | ${hitRate}% | ${cache.hits} | ${cache.misses} | ${this.formatBytes(cache.totalSize)} |\n`;
      }
      markdown += `\n`;
    }

    // Resource usage
    if (report.resourceUsage.memory) {
      markdown += `## Resource Usage\n\n`;
      markdown += `**Memory:**\n`;
      markdown += `- Heap Used: ${this.formatBytes(report.resourceUsage.memory.heapUsed)}\n`;
      markdown += `- Heap Total: ${this.formatBytes(report.resourceUsage.memory.heapTotal)}\n`;
      markdown += `- RSS: ${this.formatBytes(report.resourceUsage.memory.rss)}\n`;
      markdown += `- External: ${this.formatBytes(report.resourceUsage.memory.external)}\n\n`;
      
      markdown += `**System:**\n`;
      markdown += `- CPUs: ${report.resourceUsage.platform.cpus}\n`;
      markdown += `- Total Memory: ${this.formatBytes(report.resourceUsage.platform.totalMemory)}\n`;
      markdown += `- Free Memory: ${this.formatBytes(report.resourceUsage.platform.freeMemory)}\n`;
      markdown += `- Platform: ${report.resourceUsage.platform.platform} (${report.resourceUsage.platform.arch})\n\n`;
    }

    // Optimizations
    if (report.optimizations.typescript) {
      markdown += `## TypeScript Optimization\n\n`;
      const ts = report.optimizations.typescript;
      markdown += `- Incremental: ${ts.incremental ? '✅' : '❌'}\n`;
      markdown += `- Composite: ${ts.composite ? '✅' : '❌'}\n`;
      markdown += `- Build Info: ${ts.buildInfoExists ? '✅' : '❌'}\n`;
      markdown += `- Source Files: ${ts.sourceFiles}\n`;
      markdown += `- Affected Files: ${ts.affectedFiles}\n\n`;
    }

    // Warnings
    if (report.warnings.length > 0) {
      markdown += `## Warnings\n\n`;
      for (const warning of report.warnings) {
        markdown += `- ⚠️ ${warning.message}\n`;
      }
      markdown += `\n`;
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      markdown += `## Recommendations\n\n`;
      for (const recommendation of report.recommendations) {
        markdown += `- 💡 ${recommendation.message}\n`;
      }
      markdown += `\n`;
    }

    return markdown;
  }

  /**
   * Update build history
   */
  updateHistory(report) {
    let history = { builds: [] };
    
    if (fs.existsSync(this.historyFile)) {
      try {
        history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      } catch (error) {
        console.warn('Could not read build history:', error.message);
      }
    }

    // Add current build to history
    history.builds.push({
      timestamp: report.timestamp,
      commit: report.commit,
      branch: report.branch,
      totalDuration: report.totalDuration,
      phases: Object.keys(report.buildTimes).reduce((acc, phase) => {
        acc[phase] = {
          duration: report.buildTimes[phase].duration || 0,
          status: report.buildTimes[phase].status
        };
        return acc;
      }, {}),
      cacheHitRates: Object.keys(report.cacheMetrics).reduce((acc, cache) => {
        const metrics = report.cacheMetrics[cache];
        acc[cache] = metrics.hits + metrics.misses > 0 ? 
          (metrics.hits / (metrics.hits + metrics.misses)) : 0;
        return acc;
      }, {}),
      warnings: report.warnings.length,
      recommendations: report.recommendations.length
    });

    // Keep only last 100 builds
    if (history.builds.length > 100) {
      history.builds = history.builds.slice(-100);
    }

    fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(threshold = 0.2) {
    if (!fs.existsSync(this.historyFile)) {
      return [];
    }

    try {
      const history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      const builds = history.builds;
      
      if (builds.length < 2) {
        return [];
      }

      const latest = builds[builds.length - 1];
      const baseline = builds.slice(0, builds.length - 1);
      
      // Calculate baseline averages
      const baselineAvg = {
        totalDuration: baseline.reduce((sum, b) => sum + b.totalDuration, 0) / baseline.length,
        phases: {}
      };

      // Calculate phase averages
      for (const phase of Object.keys(latest.phases)) {
        const phaseDurations = baseline
          .filter(b => b.phases[phase])
          .map(b => b.phases[phase].duration);
        
        if (phaseDurations.length > 0) {
          baselineAvg.phases[phase] = phaseDurations.reduce((sum, d) => sum + d, 0) / phaseDurations.length;
        }
      }

      const regressions = [];

      // Check total duration regression
      const totalRegression = (latest.totalDuration - baselineAvg.totalDuration) / baselineAvg.totalDuration;
      if (totalRegression > threshold) {
        regressions.push({
          type: 'total',
          regression: totalRegression,
          current: latest.totalDuration,
          baseline: baselineAvg.totalDuration
        });
      }

      // Check phase regressions
      for (const [phase, duration] of Object.entries(latest.phases)) {
        if (baselineAvg.phases[phase]) {
          const phaseRegression = (duration.duration - baselineAvg.phases[phase]) / baselineAvg.phases[phase];
          if (phaseRegression > threshold) {
            regressions.push({
              type: 'phase',
              phase,
              regression: phaseRegression,
              current: duration.duration,
              baseline: baselineAvg.phases[phase]
            });
          }
        }
      }

      return regressions;
    } catch (error) {
      console.warn('Could not detect regressions:', error.message);
      return [];
    }
  }

  /**
   * Utility methods
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    
    try {
      let totalSize = 0;
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += fs.statSync(filePath).size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  countPackages(nodeModulesPath) {
    if (!fs.existsSync(nodeModulesPath)) return 0;
    
    try {
      return fs.readdirSync(nodeModulesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
        .length;
    } catch (error) {
      return 0;
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new BuildPerformanceMonitor();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      const phase = process.argv[3];
      if (!phase) {
        console.error('Usage: build-performance-monitor.js start <phase-name>');
        process.exit(1);
      }
      monitor.startPhase(phase);
      break;
      
    case 'end':
      const endPhase = process.argv[3];
      const success = process.argv[4] !== 'false';
      if (!endPhase) {
        console.error('Usage: build-performance-monitor.js end <phase-name> [success]');
        process.exit(1);
      }
      monitor.endPhase(endPhase, success);
      break;
      
    case 'cache':
      const cacheType = process.argv[3];
      const cacheKey = process.argv[4];
      const hit = process.argv[5] === 'true';
      const size = parseInt(process.argv[6]) || 0;
      if (!cacheType || !cacheKey) {
        console.error('Usage: build-performance-monitor.js cache <type> <key> <hit> [size]');
        process.exit(1);
      }
      monitor.monitorCachePerformance(cacheType, cacheKey, hit, size);
      break;
      
    case 'resource':
      monitor.monitorResourceUsage();
      break;
      
    case 'typescript':
      monitor.monitorTypeScriptBuild();
      break;
      
    case 'dependencies':
      const packageManager = process.argv[3] || 'npm';
      monitor.monitorDependencyInstallation(packageManager);
      break;
      
    case 'report':
      monitor.generateReport();
      break;
      
    case 'regressions':
      const threshold = parseFloat(process.argv[3]) || 0.2;
      const regressions = monitor.detectRegressions(threshold);
      if (regressions.length > 0) {
        console.log('Performance regressions detected:');
        regressions.forEach(r => {
          const percent = (r.regression * 100).toFixed(1);
          if (r.type === 'total') {
            console.log(`- Total build time: ${percent}% slower (${monitor.formatDuration(r.current)} vs ${monitor.formatDuration(r.baseline)})`);
          } else {
            console.log(`- ${r.phase}: ${percent}% slower (${monitor.formatDuration(r.current)} vs ${monitor.formatDuration(r.baseline)})`);
          }
        });
        process.exit(1);
      } else {
        console.log('No performance regressions detected');
      }
      break;
      
    case 'pipeline-metrics':
      // Generate pipeline metrics from the latest report
      const reportFiles = fs.readdirSync(monitor.reportDir)
        .filter(file => file.startsWith('build-report-') && file.endsWith('.json'))
        .sort()
        .reverse();
      
      if (reportFiles.length === 0) {
        console.error('No build reports found. Run "report" command first.');
        process.exit(1);
      }
      
      const latestReportPath = path.join(monitor.reportDir, reportFiles[0]);
      const latestReport = JSON.parse(fs.readFileSync(latestReportPath, 'utf8'));
      monitor.generatePipelineMetrics(latestReport);
      break;
      
    default:
      console.log('Usage: build-performance-monitor.js <command> [args...]');
      console.log('Commands:');
      console.log('  start <phase>              - Start monitoring a build phase');
      console.log('  end <phase> [success]      - End monitoring a build phase');
      console.log('  cache <type> <key> <hit>   - Record cache performance');
      console.log('  resource                   - Monitor resource usage');
      console.log('  typescript                 - Monitor TypeScript build');
      console.log('  dependencies [manager]     - Monitor dependency installation');
      console.log('  report                     - Generate performance report');
      console.log('  regressions [threshold]    - Detect performance regressions');
      console.log('  pipeline-metrics           - Generate pipeline metrics for monitoring');
      break;
  }
}

export { BuildPerformanceMonitor };