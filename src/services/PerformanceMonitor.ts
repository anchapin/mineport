/**
 * Performance Monitor - Provides performance monitoring and profiling capabilities
 *
 * This service monitors system performance, tracks metrics, and provides
 * profiling capabilities for identifying performance bottlenecks and
 * optimization opportunities.
 */

import * as os from 'os';
import * as process from 'process';
import { EventEmitter } from 'events';
import { PerformanceObserver } from 'perf_hooks';
import logger from '../utils/logger.js';

export interface PerformanceMetrics {
  timestamp: Date;
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number; // bytes
    free: number; // bytes
    total: number; // bytes
    heapUsed: number; // bytes
    heapTotal: number; // bytes
    external: number; // bytes
    usage: number; // percentage
  };
  system: {
    uptime: number; // seconds
    platform: string;
    arch: string;
  };
  process: {
    pid: number;
    uptime: number; // seconds
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  gc?: {
    collections: number;
    duration: number; // milliseconds
    reclaimedMemory: number; // bytes
  };
}

export interface PerformanceProfile {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryStart: NodeJS.MemoryUsage;
  memoryEnd?: NodeJS.MemoryUsage;
  cpuStart: NodeJS.CpuUsage;
  cpuEnd?: NodeJS.CpuUsage;
  metadata?: Record<string, any>;
}

export interface PerformanceAlert {
  type: 'cpu' | 'memory' | 'gc' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MonitoringOptions {
  interval: number; // milliseconds
  enableGCMonitoring: boolean;
  enableProfiling: boolean;
  alertThresholds: {
    cpuUsage: number; // percentage
    memoryUsage: number; // percentage
    gcDuration: number; // milliseconds
    gcFrequency: number; // collections per minute
  };
  retentionPeriod: number; // milliseconds
  enableAlerts: boolean;
}

/**
 * Performance monitoring and profiling service
 */
export class PerformanceMonitor extends EventEmitter {
  private options: MonitoringOptions;
  private metrics: PerformanceMetrics[] = [];
  private profiles: Map<string, PerformanceProfile> = new Map();
  private alerts: PerformanceAlert[] = [];
  private monitoringTimer?: NodeJS.Timeout;
  private gcStats: { collections: number; totalDuration: number; lastCollection: number } = {
    collections: 0,
    totalDuration: 0,
    lastCollection: 0,
  };
  private lastCpuUsage?: NodeJS.CpuUsage;

  constructor(options: Partial<MonitoringOptions> = {}) {
    super();

    this.options = {
      interval: options.interval || 5000, // 5 seconds
      enableGCMonitoring: options.enableGCMonitoring ?? true,
      enableProfiling: options.enableProfiling ?? true,
      alertThresholds: {
        cpuUsage: 80, // 80%
        memoryUsage: 85, // 85%
        gcDuration: 100, // 100ms
        gcFrequency: 10, // 10 collections per minute
        ...options.alertThresholds,
      },
      retentionPeriod: options.retentionPeriod || 3600000, // 1 hour
      enableAlerts: options.enableAlerts ?? true,
    };

    this.setupGCMonitoring();
    this.startMonitoring();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.monitoringTimer) {
      return; // Already monitoring
    }

    this.monitoringTimer = setInterval(() => {
      this.collectMetrics();
    }, this.options.interval);

    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Start profiling a specific operation
   */
  startProfile(name: string, metadata?: Record<string, any>): string {
    if (!this.options.enableProfiling) {
      return name;
    }

    const profile: PerformanceProfile = {
      name,
      startTime: Date.now(),
      memoryStart: process.memoryUsage(),
      cpuStart: process.cpuUsage(),
      metadata,
    };

    this.profiles.set(name, profile);
    this.emit('profileStarted', { name, metadata });

    return name;
  }

  /**
   * End profiling and return results
   */
  endProfile(name: string): PerformanceProfile | null {
    if (!this.options.enableProfiling) {
      return null;
    }

    const profile = this.profiles.get(name);
    if (!profile) {
      return null;
    }

    profile.endTime = Date.now();
    profile.duration = profile.endTime - profile.startTime;
    profile.memoryEnd = process.memoryUsage();
    profile.cpuEnd = process.cpuUsage(profile.cpuStart);

    this.profiles.delete(name);
    this.emit('profileEnded', profile);

    return profile;
  }

  /**
   * Collect current performance metrics
   */
  private collectMetrics(): void {
    const now = new Date();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();

    // Calculate CPU usage percentage
    const cpuPercent = this.calculateCpuUsage(cpuUsage);

    // Get system memory info
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const metrics: PerformanceMetrics = {
      timestamp: now,
      cpu: {
        usage: cpuPercent,
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
      },
      memory: {
        used: usedMem,
        free: freeMem,
        total: totalMem,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        usage: (usedMem / totalMem) * 100,
      },
      system: {
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch(),
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: memUsage,
        cpuUsage: cpuUsage,
      },
    };

    // Add GC stats if available
    if (this.options.enableGCMonitoring && this.gcStats.collections > 0) {
      metrics.gc = {
        collections: this.gcStats.collections,
        duration: this.gcStats.totalDuration,
        reclaimedMemory: 0, // Would need more sophisticated tracking
      };
    }

    this.metrics.push(metrics);
    this.cleanupOldMetrics();
    this.checkAlerts(metrics);

    this.emit('metricsCollected', metrics);
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    const totalUsage = cpuUsage.user + cpuUsage.system;
    // Convert microseconds to percentage (rough approximation)
    return Math.min(100, (totalUsage / (this.options.interval * 1000)) * 100);
  }

  /**
   * Setup garbage collection monitoring
   */
  private setupGCMonitoring(): void {
    if (!this.options.enableGCMonitoring) {
      return;
    }

    // Enable GC monitoring if available
    if (typeof global.gc === 'function') {
      const originalGC = global.gc;
      global.gc = () => {
        const start = Date.now();
        originalGC();
        const duration = Date.now() - start;

        this.gcStats.collections++;
        this.gcStats.totalDuration += duration;
        this.gcStats.lastCollection = start;

        this.emit('gcCompleted', { duration, collections: this.gcStats.collections });
      };
    }

    // Monitor GC events if available (Node.js 14+)
    if (process.versions.node && parseInt(process.versions.node.split('.')[0]) >= 14) {
      try {
        const obs = new PerformanceObserver((list: any) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'gc') {
              this.gcStats.collections++;
              this.gcStats.totalDuration += entry.duration;
              this.gcStats.lastCollection = entry.startTime;

              this.emit('gcCompleted', {
                duration: entry.duration,
                kind: entry.kind,
                collections: this.gcStats.collections,
              });
            }
          }
        });
        obs.observe({ entryTypes: ['gc'] });
      } catch (error) {
        logger.debug('GC performance monitoring not available', { error });
      }
    }
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    if (!this.options.enableAlerts) {
      return;
    }

    const alerts: PerformanceAlert[] = [];

    // CPU usage alert
    if (metrics.cpu.usage > this.options.alertThresholds.cpuUsage) {
      alerts.push({
        type: 'cpu',
        severity: metrics.cpu.usage > 95 ? 'critical' : metrics.cpu.usage > 90 ? 'high' : 'medium',
        message: `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        value: metrics.cpu.usage,
        threshold: this.options.alertThresholds.cpuUsage,
        timestamp: metrics.timestamp,
      });
    }

    // Memory usage alert
    if (metrics.memory.usage > this.options.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'memory',
        severity:
          metrics.memory.usage > 95 ? 'critical' : metrics.memory.usage > 90 ? 'high' : 'medium',
        message: `High memory usage: ${metrics.memory.usage.toFixed(1)}%`,
        value: metrics.memory.usage,
        threshold: this.options.alertThresholds.memoryUsage,
        timestamp: metrics.timestamp,
      });
    }

    // GC alerts
    if (metrics.gc) {
      const avgGcDuration = metrics.gc.duration / metrics.gc.collections;
      if (avgGcDuration > this.options.alertThresholds.gcDuration) {
        alerts.push({
          type: 'gc',
          severity: avgGcDuration > 500 ? 'high' : 'medium',
          message: `Long GC duration: ${avgGcDuration.toFixed(1)}ms average`,
          value: avgGcDuration,
          threshold: this.options.alertThresholds.gcDuration,
          timestamp: metrics.timestamp,
        });
      }
    }

    // Emit alerts
    for (const alert of alerts) {
      this.alerts.push(alert);
      this.emit('alert', alert);
    }

    // Clean up old alerts
    this.cleanupOldAlerts();
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.options.retentionPeriod;
    this.metrics = this.metrics.filter((metric) => metric.timestamp.getTime() > cutoff);
  }

  /**
   * Clean up old alerts
   */
  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - this.options.retentionPeriod;
    this.alerts = this.alerts.filter((alert) => alert.timestamp.getTime() > cutoff);
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    const metrics = [...this.metrics];
    return limit ? metrics.slice(-limit) : metrics;
  }

  /**
   * Get active profiles
   */
  getActiveProfiles(): PerformanceProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit?: number): PerformanceAlert[] {
    const alerts = [...this.alerts].reverse(); // Most recent first
    return limit ? alerts.slice(0, limit) : alerts;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    current: PerformanceMetrics | null;
    averages: {
      cpuUsage: number;
      memoryUsage: number;
      gcDuration: number;
    };
    alerts: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  } {
    const current = this.getCurrentMetrics();

    // Calculate averages
    const recentMetrics = this.metrics.slice(-10); // Last 10 measurements
    const avgCpu =
      recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length || 0;
    const avgMemory =
      recentMetrics.reduce((sum, m) => sum + m.memory.usage, 0) / recentMetrics.length || 0;
    const avgGcDuration =
      recentMetrics
        .filter((m) => m.gc)
        .reduce((sum, m) => sum + m.gc!.duration / m.gc!.collections, 0) / recentMetrics.length ||
      0;

    // Count alerts by severity
    const alertCounts = this.alerts.reduce(
      (counts, alert) => {
        counts[alert.severity]++;
        counts.total++;
        return counts;
      },
      { total: 0, critical: 0, high: 0, medium: 0, low: 0 }
    );

    return {
      current,
      averages: {
        cpuUsage: avgCpu,
        memoryUsage: avgMemory,
        gcDuration: avgGcDuration,
      },
      alerts: alertCounts,
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean {
    if (typeof global.gc === 'function') {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Create a custom alert
   */
  createAlert(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    value: number,
    threshold: number,
    metadata?: Record<string, any>
  ): void {
    const alert: PerformanceAlert = {
      type: 'custom',
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      metadata: { customType: type, ...metadata },
    };

    this.alerts.push(alert);
    this.emit('alert', alert);
  }

  /**
   * Destroy the performance monitor
   */
  destroy(): void {
    this.stopMonitoring();
    this.metrics = [];
    this.profiles.clear();
    this.alerts = [];
    this.emit('destroyed');
  }
}
