import { EventEmitter } from 'events';
import {
  ModPorterAIConfig,
  ConfigValidationResult,
  ConfigValidationError,
  ConfigValidationWarning,
} from '../types/config.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConfigurationService');

export interface ConfigurationServiceOptions {
  watchForChanges?: boolean;
}

/**
 * Configuration service for ModPorter-AI integration components
 * Handles environment-based configuration loading and validation
 */
export class ConfigurationService extends EventEmitter {
  private config: ModPorterAIConfig;
  private static instance: ConfigurationService;
  private options: ConfigurationServiceOptions;
  private dynamicConfig: Map<string, any> = new Map();

  constructor(options: ConfigurationServiceOptions = {}) {
    super();
    this.options = options;
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  private static createSingleton() {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  public static getInstance(): ConfigurationService {
    return ConfigurationService.createSingleton();
  }

  /**
   * Get the complete configuration
   */
  public getConfig(): ModPorterAIConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Get file processor configuration
   */
  public getFileProcessorConfig() {
    return JSON.parse(JSON.stringify(this.config.fileProcessor));
  }

  /**
   * Get Java analyzer configuration
   */
  public getJavaAnalyzerConfig() {
    return JSON.parse(JSON.stringify(this.config.javaAnalyzer));
  }

  /**
   * Get asset converter configuration
   */
  public getAssetConverterConfig() {
    return JSON.parse(JSON.stringify(this.config.assetConverter));
  }

  /**
   * Get validation pipeline configuration
   */
  public getValidationPipelineConfig() {
    return JSON.parse(JSON.stringify(this.config.validationPipeline));
  }

  /**
   * Get security scanner configuration
   */
  public getSecurityScannerConfig() {
    return JSON.parse(JSON.stringify(this.config.securityScanner));
  }

  /**
   * Get monitoring configuration
   */
  public getMonitoringConfig() {
    return JSON.parse(JSON.stringify(this.config.monitoring));
  }

  /**
   * Get logging configuration
   */
  public getLoggingConfig() {
    return JSON.parse(JSON.stringify(this.config.logging));
  }

  /**
   * Set a configuration value dynamically
   */
  public set(key: string, value: any): void {
    this.dynamicConfig.set(key, value);
    this.emit('config:updated', { key, value });
    this.emit('configChanged', key, value);
  }

  /**
   * Get a configuration value by key path with optional default value
   * This method provides compatibility with services expecting a generic get method
   * Also checks dynamic config first, then static config
   */
  public get<T = any>(keyPath: string, defaultValue?: T): T {
    try {
      // Check dynamic config first
      if (this.dynamicConfig.has(keyPath)) {
        return this.dynamicConfig.get(keyPath) as T;
      }

      // Navigate through nested config object
      const keys = keyPath.split('.');
      let value: any = this.config;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return defaultValue as T;
        }
      }

      return value !== undefined ? value : (defaultValue as T);
    } catch (error) {
      return defaultValue as T;
    }
  }

  /**
   * Export current configuration (including dynamic config)
   */
  public exportConfig(): Record<string, any> {
    const exported = JSON.parse(JSON.stringify(this.config));

    // Apply dynamic config overrides
    for (const [key, value] of this.dynamicConfig.entries()) {
      this.setNestedValue(exported, key, value);
    }

    return exported;
  }

  /**
   * Import configuration from object
   */
  public async importConfig(config: Record<string, any>): Promise<void> {
    // Clear dynamic config
    this.dynamicConfig.clear();

    // Set all values from imported config
    this.setConfigFromObject(config);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, key: string, value: any): void {
    const keys = key.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Set configuration from object recursively
   */
  private setConfigFromObject(obj: Record<string, any>, prefix: string = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.setConfigFromObject(value, fullKey);
      } else {
        this.dynamicConfig.set(fullKey, value);
      }
    }
  }

  /**
   * Dispose of the configuration service
   */
  public dispose(): void {
    this.dynamicConfig.clear();
    // Additional cleanup if needed
  }

  /**
>>>>>>> origin/main
   * Reload configuration from environment
   */
  public reloadConfiguration(): void {
    const newConfig = this.loadConfiguration();
    const validation = this.validateConfigurationObject(newConfig);

    if (!validation.isValid) {
      logger.error('Configuration reload failed validation', {
        errors: validation.errors,
      });
      throw new Error('Invalid configuration');
    }

    this.config = newConfig;
    logger.info('Configuration reloaded successfully');
  }

  /**
   * Load configuration from environment variables with defaults
   */
  private loadConfiguration(): ModPorterAIConfig {
    return {
      security: {
        fileValidation: {
          maxFileSize: this.getEnvNumber('MODPORTER_SECURITY_FILE_MAX_SIZE', 500 * 1024 * 1024), // 500MB
          allowedMimeTypes: this.getEnvArray('MODPORTER_SECURITY_ALLOWED_MIME_TYPES', [
            'application/java-archive',
            'application/zip',
            'application/x-zip-compressed',
          ]),
          enableMagicNumberValidation: this.getEnvBoolean(
            'MODPORTER_MAGIC_NUMBER_VALIDATION',
            true
          ),
          cacheValidationResults: this.getEnvBoolean('MODPORTER_CACHE_VALIDATION_RESULTS', true),
          cacheTTL: this.getEnvNumber('MODPORTER_CACHE_TTL', 3600000), // 1 hour
        },
        securityScanning: {
          enableZipBombDetection: this.getEnvBoolean('MODPORTER_ZIP_BOMB_DETECTION', true),
          maxCompressionRatio: this.getEnvNumber('MODPORTER_MAX_COMPRESSION_RATIO', 100),
          maxExtractedSize: this.getEnvNumber('MODPORTER_MAX_EXTRACTED_SIZE', 1024 * 1024 * 1024), // 1GB
          enablePathTraversalDetection: this.getEnvBoolean(
            'MODPORTER_PATH_TRAVERSAL_DETECTION',
            true
          ),
          enableMalwarePatternDetection: this.getEnvBoolean(
            'MODPORTER_MALWARE_PATTERN_DETECTION',
            true
          ),
          scanTimeout: this.getEnvNumber('MODPORTER_SECURITY_SCAN_TIMEOUT', 30000),
        },
      },
      fileProcessor: {
        maxFileSize: this.getEnvNumber('MODPORTER_FILE_MAX_SIZE', 500 * 1024 * 1024), // 500MB
        allowedMimeTypes: this.getEnvArray('MODPORTER_ALLOWED_MIME_TYPES', [
          'application/java-archive',
          'application/zip',
          'application/x-zip-compressed',
        ]),
        enableMalwareScanning: this.getEnvBoolean('MODPORTER_ENABLE_MALWARE_SCAN', true),
        tempDirectory: this.getEnvString('MODPORTER_TEMP_DIR', './temp'),
        scanTimeout: this.getEnvNumber('MODPORTER_SCAN_TIMEOUT', 30000),
        maxCompressionRatio: this.getEnvNumber('MODPORTER_MAX_COMPRESSION_RATIO', 100),
        maxExtractedSize: this.getEnvNumber('MODPORTER_MAX_EXTRACTED_SIZE', 1024 * 1024 * 1024), // 1GB
      },
      javaAnalyzer: {
        extractionStrategies: this.getEnvArray('MODPORTER_EXTRACTION_STRATEGIES', [
          'classFiles',
          'jsonFiles',
          'langFiles',
          'modelFiles',
        ]),
        analysisTimeout: this.getEnvNumber('MODPORTER_ANALYSIS_TIMEOUT', 60000),
        enableBytecodeAnalysis: this.getEnvBoolean('MODPORTER_ENABLE_BYTECODE_ANALYSIS', true),
        maxClassFilesToAnalyze: this.getEnvNumber('MODPORTER_MAX_CLASS_FILES', 1000),
        enableMultiStrategyExtraction: this.getEnvBoolean('MODPORTER_MULTI_STRATEGY', true),
        fallbackToBasicAnalysis: this.getEnvBoolean('MODPORTER_FALLBACK_BASIC', true),
      },
      assetConverter: {
        textureOptimization: this.getEnvBoolean('MODPORTER_TEXTURE_OPTIMIZATION', true),
        modelConversionQuality: this.getEnvString('MODPORTER_MODEL_QUALITY', 'balanced') as
          | 'fast'
          | 'balanced'
          | 'high',
        soundConversionFormat: this.getEnvString('MODPORTER_SOUND_FORMAT', 'ogg') as 'ogg' | 'wav',
        maxTextureSize: this.getEnvNumber('MODPORTER_MAX_TEXTURE_SIZE', 1024),
        enableParallelConversion: this.getEnvBoolean('MODPORTER_PARALLEL_CONVERSION', true),
        outputDirectory: this.getEnvString('MODPORTER_OUTPUT_DIR', './output'),
      },
      validationPipeline: {
        enableStrictValidation: this.getEnvBoolean('MODPORTER_STRICT_VALIDATION', false),
        maxValidationTime: this.getEnvNumber('MODPORTER_MAX_VALIDATION_TIME', 120000),
        requiredStages: this.getEnvArray('MODPORTER_REQUIRED_STAGES', [
          'security',
          'analysis',
          'conversion',
        ]),
        enableParallelValidation: this.getEnvBoolean('MODPORTER_PARALLEL_VALIDATION', true),
        failFast: this.getEnvBoolean('MODPORTER_FAIL_FAST', false),
        validationTimeout: this.getEnvNumber('MODPORTER_VALIDATION_TIMEOUT', 30000),
      },
      securityScanner: {
        enableZipBombDetection: this.getEnvBoolean('MODPORTER_ZIP_BOMB_DETECTION', true),
        enablePathTraversalCheck: this.getEnvBoolean('MODPORTER_PATH_TRAVERSAL_CHECK', true),
        enableMalwarePatternScanning: this.getEnvBoolean('MODPORTER_MALWARE_PATTERN_SCAN', true),
        maxScanTime: this.getEnvNumber('MODPORTER_MAX_SCAN_TIME', 30000),
        threatDatabasePath: this.getEnvString('MODPORTER_THREAT_DB_PATH', ''),
        quarantineDirectory: this.getEnvString('MODPORTER_QUARANTINE_DIR', './quarantine'),
      },
      monitoring: {
        enableMetrics: this.getEnvBoolean('MODPORTER_ENABLE_METRICS', true),
        metricsPort: this.getEnvNumber('MODPORTER_METRICS_PORT', 9090),
        enableTracing: this.getEnvBoolean('MODPORTER_ENABLE_TRACING', false),
        tracingEndpoint: this.getEnvString('MODPORTER_TRACING_ENDPOINT', ''),
        enableHealthChecks: this.getEnvBoolean('MODPORTER_ENABLE_HEALTH_CHECKS', true),
        healthCheckInterval: this.getEnvNumber('MODPORTER_HEALTH_CHECK_INTERVAL', 30000),
        alertingEnabled: this.getEnvBoolean('MODPORTER_ALERTING_ENABLED', false),
        alertingWebhookUrl: this.getEnvString('MODPORTER_ALERTING_WEBHOOK_URL', ''),
      },
      logging: {
        level: this.getEnvString('MODPORTER_LOG_LEVEL', 'info') as
          | 'debug'
          | 'info'
          | 'warn'
          | 'error',
        format: this.getEnvString('MODPORTER_LOG_FORMAT', 'json') as 'json' | 'text',
        enableStructuredLogging: this.getEnvBoolean('MODPORTER_STRUCTURED_LOGGING', true),
        enableSecurityEventLogging: this.getEnvBoolean('MODPORTER_SECURITY_EVENT_LOGGING', true),
        enablePerformanceLogging: this.getEnvBoolean('MODPORTER_PERFORMANCE_LOGGING', true),
        logDirectory: this.getEnvString('MODPORTER_LOG_DIR', './logs'),
        maxLogFileSize: this.getEnvNumber('MODPORTER_MAX_LOG_FILE_SIZE', 10 * 1024 * 1024), // 10MB
        maxLogFiles: this.getEnvNumber('MODPORTER_MAX_LOG_FILES', 5),
      },
    };
  }

  /**
   * Validate the current configuration
   */
  private validateConfiguration(): void {
    const validation = this.validateConfigurationObject(this.config);

    if (!validation.isValid) {
      logger.error('Configuration validation failed', {
        errors: validation.errors,
      });
      throw new Error('Invalid configuration');
    }

    if (validation.warnings.length > 0) {
      logger.warn('Configuration validation warnings', {
        warnings: validation.warnings,
      });
    }

    logger.info('Configuration validation passed');
  }

  /**
   * Validate a configuration object
   */
  public validateConfigurationObject(config: ModPorterAIConfig): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Validate file processor config
    if (config.fileProcessor.maxFileSize <= 0) {
      errors.push({
        field: 'fileProcessor.maxFileSize',
        message: 'Max file size must be greater than 0',
        value: config.fileProcessor.maxFileSize,
      });
    }

    if (config.fileProcessor.maxFileSize > 1024 * 1024 * 1024) {
      // 1GB
      warnings.push({
        field: 'fileProcessor.maxFileSize',
        message: 'Max file size is very large, consider reducing for performance',
        value: config.fileProcessor.maxFileSize,
      });
    }

    if (config.fileProcessor.allowedMimeTypes.length === 0) {
      errors.push({
        field: 'fileProcessor.allowedMimeTypes',
        message: 'At least one MIME type must be allowed',
        value: config.fileProcessor.allowedMimeTypes,
      });
    }

    // Validate Java analyzer config
    if (config.javaAnalyzer.analysisTimeout <= 0) {
      errors.push({
        field: 'javaAnalyzer.analysisTimeout',
        message: 'Analysis timeout must be greater than 0',
        value: config.javaAnalyzer.analysisTimeout,
      });
    }

    if (config.javaAnalyzer.maxClassFilesToAnalyze <= 0) {
      errors.push({
        field: 'javaAnalyzer.maxClassFilesToAnalyze',
        message: 'Max class files to analyze must be greater than 0',
        value: config.javaAnalyzer.maxClassFilesToAnalyze,
      });
    }

    // Validate asset converter config
    const validQualities = ['fast', 'balanced', 'high'];
    if (!validQualities.includes(config.assetConverter.modelConversionQuality)) {
      errors.push({
        field: 'assetConverter.modelConversionQuality',
        message: `Model conversion quality must be one of: ${validQualities.join(', ')}`,
        value: config.assetConverter.modelConversionQuality,
      });
    }

    const validFormats = ['ogg', 'wav'];
    if (!validFormats.includes(config.assetConverter.soundConversionFormat)) {
      errors.push({
        field: 'assetConverter.soundConversionFormat',
        message: `Sound conversion format must be one of: ${validFormats.join(', ')}`,
        value: config.assetConverter.soundConversionFormat,
      });
    }

    // Validate validation pipeline config
    if (config.validationPipeline.maxValidationTime <= 0) {
      errors.push({
        field: 'validationPipeline.maxValidationTime',
        message: 'Max validation time must be greater than 0',
        value: config.validationPipeline.maxValidationTime,
      });
    }

    // Validate monitoring config
    if (
      config.monitoring.enableMetrics &&
      (config.monitoring.metricsPort <= 0 || config.monitoring.metricsPort > 65535)
    ) {
      errors.push({
        field: 'monitoring.metricsPort',
        message: 'Metrics port must be between 1 and 65535',
        value: config.monitoring.metricsPort,
      });
    }

    // Validate logging config
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(config.logging.level)) {
      errors.push({
        field: 'logging.level',
        message: `Log level must be one of: ${validLogLevels.join(', ')}`,
        value: config.logging.level,
      });
    }

    const validLogFormats = ['json', 'text'];
    if (!validLogFormats.includes(config.logging.format)) {
      errors.push({
        field: 'logging.format',
        message: `Log format must be one of: ${validLogFormats.join(', ')}`,
        value: config.logging.format,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Helper methods for environment variable parsing
  private getEnvString(key: string, defaultValue?: string): string {
    const value = process.env[key];
    return value !== undefined ? value : defaultValue || '';
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  private getEnvArray(key: string, defaultValue: string[]): string[] {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}
