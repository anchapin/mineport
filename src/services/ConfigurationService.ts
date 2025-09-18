import { 
  ModPorterAIConfig, 
  ConfigValidationResult, 
  ConfigValidationError, 
  ConfigValidationWarning,
  SecurityConfig
} from '../types/config.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityConfigSchema } from '../types/config.zod.js';

/**
 * Configuration service for ModPorter-AI integration components
 * Handles environment-based configuration loading and validation
 */
export class ConfigurationService {
  private config: ModPorterAIConfig;
  private static instance: ConfigurationService;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
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
   * Reload configuration from environment
   */
  public reloadConfiguration(): void {
    const newConfig = this.loadConfiguration();
    const validation = this.validateConfigurationObject(newConfig);
    
    if (!validation.isValid) {
      logger.error('Configuration reload failed validation', { 
        errors: validation.errors 
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
    // Load base security config from JSON
    const securityConfigPath = path.resolve(process.cwd(), 'config', 'security.json');
    let securityConfig: SecurityConfig;
    try {
        const securityConfigFile = fs.readFileSync(securityConfigPath, 'utf-8');
        securityConfig = JSON.parse(securityConfigFile);
    } catch (error) {
        logger.error('Failed to load security.json, using default values.', { error });
        // Provide a default structure if the file is missing or invalid
        securityConfig = {
            fileValidation: {
                maxFileSize: 524288000,
                allowedMimeTypes: ["application/java-archive", "application/zip"],
                enableMagicNumberValidation: true,
                cacheValidationResults: true,
                cacheTTL: 3600000
            },
            securityScanning: {
                enableZipBombDetection: true,
                maxCompressionRatio: 100,
                maxExtractedSize: 1073741824,
                enablePathTraversalDetection: true,
                enableMalwarePatternDetection: true,
                scanTimeout: 30000
            }
        };
    }

    // Override with environment variables
    securityConfig.fileValidation.maxFileSize = this.getEnvNumber('MAX_FILE_SIZE', securityConfig.fileValidation.maxFileSize);
    securityConfig.securityScanning.scanTimeout = this.getEnvNumber('SECURITY_SCAN_TIMEOUT', securityConfig.securityScanning.scanTimeout);
    securityConfig.securityScanning.enableMalwarePatternDetection = this.getEnvBoolean('ENABLE_MALWARE_SCANNING', securityConfig.securityScanning.enableMalwarePatternDetection);
    securityConfig.securityScanning.maxCompressionRatio = this.getEnvNumber('MAX_COMPRESSION_RATIO', securityConfig.securityScanning.maxCompressionRatio);

    const fullConfig: ModPorterAIConfig = {
      security: securityConfig,
      fileProcessor: {
        maxFileSize: this.getEnvNumber('MODPORTER_FILE_MAX_SIZE', 500 * 1024 * 1024), // 500MB
        allowedMimeTypes: this.getEnvArray('MODPORTER_ALLOWED_MIME_TYPES', [
          'application/java-archive',
          'application/zip',
          'application/x-zip-compressed'
        ]),
        enableMalwareScanning: this.getEnvBoolean('MODPORTER_ENABLE_MALWARE_SCAN', true),
        tempDirectory: this.getEnvString('MODPORTER_TEMP_DIR', './temp'),
        scanTimeout: this.getEnvNumber('MODPORTER_SCAN_TIMEOUT', 30000),
        maxCompressionRatio: this.getEnvNumber('MODPORTER_MAX_COMPRESSION_RATIO', 100),
        maxExtractedSize: this.getEnvNumber('MODPORTER_MAX_EXTRACTED_SIZE', 1024 * 1024 * 1024) // 1GB
      },
      javaAnalyzer: {
        extractionStrategies: this.getEnvArray('MODPORTER_EXTRACTION_STRATEGIES', [
          'classFiles', 'jsonFiles', 'langFiles', 'modelFiles'
        ]),
        analysisTimeout: this.getEnvNumber('MODPORTER_ANALYSIS_TIMEOUT', 60000),
        enableBytecodeAnalysis: this.getEnvBoolean('MODPORTER_ENABLE_BYTECODE_ANALYSIS', true),
        maxClassFilesToAnalyze: this.getEnvNumber('MODPORTER_MAX_CLASS_FILES', 1000),
        enableMultiStrategyExtraction: this.getEnvBoolean('MODPORTER_MULTI_STRATEGY', true),
        fallbackToBasicAnalysis: this.getEnvBoolean('MODPORTER_FALLBACK_BASIC', true)
      },
      assetConverter: {
        textureOptimization: this.getEnvBoolean('MODPORTER_TEXTURE_OPTIMIZATION', true),
        modelConversionQuality: this.getEnvString('MODPORTER_MODEL_QUALITY', 'balanced') as 'fast' | 'balanced' | 'high',
        soundConversionFormat: this.getEnvString('MODPORTER_SOUND_FORMAT', 'ogg') as 'ogg' | 'wav',
        maxTextureSize: this.getEnvNumber('MODPORTER_MAX_TEXTURE_SIZE', 1024),
        enableParallelConversion: this.getEnvBoolean('MODPORTER_PARALLEL_CONVERSION', true),
        outputDirectory: this.getEnvString('MODPORTER_OUTPUT_DIR', './output')
      },
      validationPipeline: {
        enableStrictValidation: this.getEnvBoolean('MODPORTER_STRICT_VALIDATION', false),
        maxValidationTime: this.getEnvNumber('MODPORTER_MAX_VALIDATION_TIME', 120000),
        requiredStages: this.getEnvArray('MODPORTER_REQUIRED_STAGES', [
          'security', 'analysis', 'conversion'
        ]),
        enableParallelValidation: this.getEnvBoolean('MODPORTER_PARALLEL_VALIDATION', true),
        failFast: this.getEnvBoolean('MODPORTER_FAIL_FAST', false),
        validationTimeout: this.getEnvNumber('MODPORTER_VALIDATION_TIMEOUT', 30000)
      },
      securityScanner: {
        enableZipBombDetection: this.getEnvBoolean('MODPORTER_ZIP_BOMB_DETECTION', true),
        enablePathTraversalCheck: this.getEnvBoolean('MODPORTER_PATH_TRAVERSAL_CHECK', true),
        enableMalwarePatternScanning: this.getEnvBoolean('MODPORTER_MALWARE_PATTERN_SCAN', true),
        maxScanTime: this.getEnvNumber('MODPORTER_MAX_SCAN_TIME', 30000),
        threatDatabasePath: this.getEnvString('MODPORTER_THREAT_DB_PATH'),
        quarantineDirectory: this.getEnvString('MODPORTER_QUARANTINE_DIR', './quarantine')
      },
      monitoring: {
        enableMetrics: this.getEnvBoolean('MODPORTER_ENABLE_METRICS', true),
        metricsPort: this.getEnvNumber('MODPORTER_METRICS_PORT', 9090),
        enableTracing: this.getEnvBoolean('MODPORTER_ENABLE_TRACING', false),
        tracingEndpoint: this.getEnvString('MODPORTER_TRACING_ENDPOINT'),
        enableHealthChecks: this.getEnvBoolean('MODPORTER_ENABLE_HEALTH_CHECKS', true),
        healthCheckInterval: this.getEnvNumber('MODPORTER_HEALTH_CHECK_INTERVAL', 30000),
        alertingEnabled: this.getEnvBoolean('MODPORTER_ALERTING_ENABLED', false),
        alertingWebhookUrl: this.getEnvString('MODPORTER_ALERTING_WEBHOOK_URL')
      },
      logging: {
        level: this.getEnvString('MODPORTER_LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
        format: this.getEnvString('MODPORTER_LOG_FORMAT', 'json') as 'json' | 'text',
        enableStructuredLogging: this.getEnvBoolean('MODPORTER_STRUCTURED_LOGGING', true),
        enableSecurityEventLogging: this.getEnvBoolean('MODPORTER_SECURITY_EVENT_LOGGING', true),
        enablePerformanceLogging: this.getEnvBoolean('MODPORTER_PERFORMANCE_LOGGING', true),
        logDirectory: this.getEnvString('MODPORTER_LOG_DIR', './logs'),
        maxLogFileSize: this.getEnvNumber('MODPORTER_MAX_LOG_FILE_SIZE', 10 * 1024 * 1024), // 10MB
        maxLogFiles: this.getEnvNumber('MODPORTER_MAX_LOG_FILES', 5)
      }
    };
    return fullConfig;
  }

  /**
   * Validate the current configuration
   */
  private validateConfiguration(): void {
    const validation = this.validateConfigurationObject(this.config);
    
    if (!validation.isValid) {
      logger.error('Configuration validation failed', { 
        errors: validation.errors 
      });
      throw new Error('Invalid configuration');
    }

    if (validation.warnings.length > 0) {
      logger.warn('Configuration validation warnings', { 
        warnings: validation.warnings 
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

    // Validate security config with Zod
    const securityValidationResult = SecurityConfigSchema.safeParse(config.security);
    if (!securityValidationResult.success) {
        securityValidationResult.error.issues.forEach(issue => {
            errors.push({
                field: `security.${issue.path.join('.')}`,
                message: issue.message,
                value: issue.path.reduce((obj, key) => obj?.[key], config.security)
            });
        });
    }

    // Keep existing manual validation for other parts of the config
    // Validate file processor config
    if (config.fileProcessor.maxFileSize <= 0) {
      errors.push({
        field: 'fileProcessor.maxFileSize',
        message: 'Max file size must be greater than 0',
        value: config.fileProcessor.maxFileSize
      });
    }

    if (config.fileProcessor.maxFileSize > 1024 * 1024 * 1024) { // 1GB
      warnings.push({
        field: 'fileProcessor.maxFileSize',
        message: 'Max file size is very large, consider reducing for performance',
        value: config.fileProcessor.maxFileSize
      });
    }

    if (config.fileProcessor.allowedMimeTypes.length === 0) {
      errors.push({
        field: 'fileProcessor.allowedMimeTypes',
        message: 'At least one MIME type must be allowed',
        value: config.fileProcessor.allowedMimeTypes
      });
    }

    // Validate Java analyzer config
    if (config.javaAnalyzer.analysisTimeout <= 0) {
      errors.push({
        field: 'javaAnalyzer.analysisTimeout',
        message: 'Analysis timeout must be greater than 0',
        value: config.javaAnalyzer.analysisTimeout
      });
    }

    if (config.javaAnalyzer.maxClassFilesToAnalyze <= 0) {
      errors.push({
        field: 'javaAnalyzer.maxClassFilesToAnalyze',
        message: 'Max class files to analyze must be greater than 0',
        value: config.javaAnalyzer.maxClassFilesToAnalyze
      });
    }

    // Validate asset converter config
    const validQualities = ['fast', 'balanced', 'high'];
    if (!validQualities.includes(config.assetConverter.modelConversionQuality)) {
      errors.push({
        field: 'assetConverter.modelConversionQuality',
        message: `Model conversion quality must be one of: ${validQualities.join(', ')}`,
        value: config.assetConverter.modelConversionQuality
      });
    }

    const validFormats = ['ogg', 'wav'];
    if (!validFormats.includes(config.assetConverter.soundConversionFormat)) {
      errors.push({
        field: 'assetConverter.soundConversionFormat',
        message: `Sound conversion format must be one of: ${validFormats.join(', ')}`,
        value: config.assetConverter.soundConversionFormat
      });
    }

    // Validate validation pipeline config
    if (config.validationPipeline.maxValidationTime <= 0) {
      errors.push({
        field: 'validationPipeline.maxValidationTime',
        message: 'Max validation time must be greater than 0',
        value: config.validationPipeline.maxValidationTime
      });
    }

    // Validate monitoring config
    if (config.monitoring.enableMetrics && (config.monitoring.metricsPort <= 0 || config.monitoring.metricsPort > 65535)) {
      errors.push({
        field: 'monitoring.metricsPort',
        message: 'Metrics port must be between 1 and 65535',
        value: config.monitoring.metricsPort
      });
    }

    // Validate logging config
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(config.logging.level)) {
      errors.push({
        field: 'logging.level',
        message: `Log level must be one of: ${validLogLevels.join(', ')}`,
        value: config.logging.level
      });
    }

    const validLogFormats = ['json', 'text'];
    if (!validLogFormats.includes(config.logging.format)) {
      errors.push({
        field: 'logging.format',
        message: `Log format must be one of: ${validLogFormats.join(', ')}`,
        value: config.logging.format
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Helper methods for environment variable parsing
  private getEnvString(key: string, defaultValue?: string): string | undefined {
    const value = process.env[key];
    return value !== undefined ? value : defaultValue;
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
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
}