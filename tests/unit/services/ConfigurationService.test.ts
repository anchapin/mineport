import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationService } from '../../../src/services/ConfigurationService.js';
import { ModPorterAIConfig } from '../../../src/types/config.js';

describe('ConfigurationService', () => {
  let configService: ConfigurationService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('MODPORTER_')) {
        delete process.env[key];
      }
    });

    // Reset singleton instance
    (ConfigurationService as any).instance = undefined;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConfigurationService.getInstance();
      const instance2 = ConfigurationService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('configuration loading', () => {
    it('should load default configuration when no environment variables are set', () => {
      configService = ConfigurationService.getInstance();
      const config = configService.getConfig();

      expect(config.fileProcessor.maxFileSize).toBe(500 * 1024 * 1024); // 500MB
      expect(config.fileProcessor.allowedMimeTypes).toEqual([
        'application/java-archive',
        'application/zip',
        'application/x-zip-compressed'
      ]);
      expect(config.fileProcessor.enableMalwareScanning).toBe(true);
      expect(config.javaAnalyzer.analysisTimeout).toBe(60000);
      expect(config.assetConverter.modelConversionQuality).toBe('balanced');
    });

    it('should load configuration from environment variables', () => {
      process.env.MODPORTER_FILE_MAX_SIZE = '1000000000'; // 1GB
      process.env.MODPORTER_ENABLE_MALWARE_SCAN = 'false';
      process.env.MODPORTER_ANALYSIS_TIMEOUT = '30000';
      process.env.MODPORTER_MODEL_QUALITY = 'high';
      process.env.MODPORTER_SOUND_FORMAT = 'wav';

      configService = ConfigurationService.getInstance();
      const config = configService.getConfig();

      expect(config.fileProcessor.maxFileSize).toBe(1000000000);
      expect(config.fileProcessor.enableMalwareScanning).toBe(false);
      expect(config.javaAnalyzer.analysisTimeout).toBe(30000);
      expect(config.assetConverter.modelConversionQuality).toBe('high');
      expect(config.assetConverter.soundConversionFormat).toBe('wav');
    });

    it('should parse array environment variables correctly', () => {
      process.env.MODPORTER_ALLOWED_MIME_TYPES = 'application/zip,application/x-zip';
      process.env.MODPORTER_EXTRACTION_STRATEGIES = 'classFiles,jsonFiles';
      process.env.MODPORTER_REQUIRED_STAGES = 'security,analysis';

      configService = ConfigurationService.getInstance();
      const config = configService.getConfig();

      expect(config.fileProcessor.allowedMimeTypes).toEqual([
        'application/zip',
        'application/x-zip'
      ]);
      expect(config.javaAnalyzer.extractionStrategies).toEqual([
        'classFiles',
        'jsonFiles'
      ]);
      expect(config.validationPipeline.requiredStages).toEqual([
        'security',
        'analysis'
      ]);
    });

    it('should handle boolean environment variables correctly', () => {
      process.env.MODPORTER_ENABLE_MALWARE_SCAN = 'true';
      process.env.MODPORTER_ENABLE_BYTECODE_ANALYSIS = 'false';
      process.env.MODPORTER_TEXTURE_OPTIMIZATION = 'TRUE';
      process.env.MODPORTER_PARALLEL_CONVERSION = 'FALSE';

      configService = ConfigurationService.getInstance();
      const config = configService.getConfig();

      expect(config.fileProcessor.enableMalwareScanning).toBe(true);
      expect(config.javaAnalyzer.enableBytecodeAnalysis).toBe(false);
      expect(config.assetConverter.textureOptimization).toBe(true);
      expect(config.assetConverter.enableParallelConversion).toBe(false);
    });
  });

  describe('configuration validation', () => {
    beforeEach(() => {
      configService = ConfigurationService.getInstance();
    });

    it('should validate valid configuration', () => {
      const validConfig: ModPorterAIConfig = {
        fileProcessor: {
          maxFileSize: 100 * 1024 * 1024,
          allowedMimeTypes: ['application/zip'],
          enableMalwareScanning: true,
          tempDirectory: './temp',
          scanTimeout: 30000,
          maxCompressionRatio: 100,
          maxExtractedSize: 1024 * 1024 * 1024
        },
        javaAnalyzer: {
          extractionStrategies: ['classFiles'],
          analysisTimeout: 60000,
          enableBytecodeAnalysis: true,
          maxClassFilesToAnalyze: 1000,
          enableMultiStrategyExtraction: true,
          fallbackToBasicAnalysis: true
        },
        assetConverter: {
          textureOptimization: true,
          modelConversionQuality: 'balanced',
          soundConversionFormat: 'ogg',
          maxTextureSize: 1024,
          enableParallelConversion: true,
          outputDirectory: './output'
        },
        validationPipeline: {
          enableStrictValidation: false,
          maxValidationTime: 120000,
          requiredStages: ['security'],
          enableParallelValidation: true,
          failFast: false,
          validationTimeout: 30000
        },
        securityScanner: {
          enableZipBombDetection: true,
          enablePathTraversalCheck: true,
          enableMalwarePatternScanning: true,
          maxScanTime: 30000,
          quarantineDirectory: './quarantine'
        },
        monitoring: {
          enableMetrics: true,
          metricsPort: 9090,
          enableTracing: false,
          enableHealthChecks: true,
          healthCheckInterval: 30000,
          alertingEnabled: false
        },
        logging: {
          level: 'info',
          format: 'json',
          enableStructuredLogging: true,
          enableSecurityEventLogging: true,
          enablePerformanceLogging: true,
          logDirectory: './logs',
          maxLogFileSize: 10 * 1024 * 1024,
          maxLogFiles: 5
        }
      };

      const result = configService.validateConfigurationObject(validConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid file processor configuration', () => {
      const invalidConfig = configService.getConfig();
      invalidConfig.fileProcessor.maxFileSize = -1;
      invalidConfig.fileProcessor.allowedMimeTypes = [];

      const result = configService.validateConfigurationObject(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe('fileProcessor.maxFileSize');
      expect(result.errors[1].field).toBe('fileProcessor.allowedMimeTypes');
    });

    it('should detect invalid Java analyzer configuration', () => {
      const invalidConfig = configService.getConfig();
      invalidConfig.javaAnalyzer.analysisTimeout = -1;
      invalidConfig.javaAnalyzer.maxClassFilesToAnalyze = 0;

      const result = configService.validateConfigurationObject(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe('javaAnalyzer.analysisTimeout');
      expect(result.errors[1].field).toBe('javaAnalyzer.maxClassFilesToAnalyze');
    });

    it('should detect invalid asset converter configuration', () => {
      const invalidConfig = configService.getConfig();
      invalidConfig.assetConverter.modelConversionQuality = 'invalid' as any;
      invalidConfig.assetConverter.soundConversionFormat = 'mp3' as any;

      const result = configService.validateConfigurationObject(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe('assetConverter.modelConversionQuality');
      expect(result.errors[1].field).toBe('assetConverter.soundConversionFormat');
    });

    it('should detect invalid validation pipeline configuration', () => {
      const invalidConfig = configService.getConfig();
      invalidConfig.validationPipeline.maxValidationTime = -1;

      const result = configService.validateConfigurationObject(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('validationPipeline.maxValidationTime');
    });

    it('should detect invalid monitoring configuration', () => {
      const invalidConfig = configService.getConfig();
      invalidConfig.monitoring.metricsPort = 70000; // Invalid port

      const result = configService.validateConfigurationObject(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('monitoring.metricsPort');
    });

    it('should detect invalid logging configuration', () => {
      const invalidConfig = configService.getConfig();
      invalidConfig.logging.level = 'invalid' as any;
      invalidConfig.logging.format = 'xml' as any;

      const result = configService.validateConfigurationObject(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe('logging.level');
      expect(result.errors[1].field).toBe('logging.format');
    });

    it('should generate warnings for potentially problematic values', () => {
      const configWithWarnings = configService.getConfig();
      configWithWarnings.fileProcessor.maxFileSize = 2 * 1024 * 1024 * 1024; // 2GB - very large

      const result = configService.validateConfigurationObject(configWithWarnings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].field).toBe('fileProcessor.maxFileSize');
    });
  });

  describe('configuration getters', () => {
    beforeEach(() => {
      configService = ConfigurationService.getInstance();
    });

    it('should return file processor configuration', () => {
      const config = configService.getFileProcessorConfig();
      
      expect(config).toHaveProperty('maxFileSize');
      expect(config).toHaveProperty('allowedMimeTypes');
      expect(config).toHaveProperty('enableMalwareScanning');
    });

    it('should return Java analyzer configuration', () => {
      const config = configService.getJavaAnalyzerConfig();
      
      expect(config).toHaveProperty('extractionStrategies');
      expect(config).toHaveProperty('analysisTimeout');
      expect(config).toHaveProperty('enableBytecodeAnalysis');
    });

    it('should return asset converter configuration', () => {
      const config = configService.getAssetConverterConfig();
      
      expect(config).toHaveProperty('textureOptimization');
      expect(config).toHaveProperty('modelConversionQuality');
      expect(config).toHaveProperty('soundConversionFormat');
    });

    it('should return validation pipeline configuration', () => {
      const config = configService.getValidationPipelineConfig();
      
      expect(config).toHaveProperty('enableStrictValidation');
      expect(config).toHaveProperty('maxValidationTime');
      expect(config).toHaveProperty('requiredStages');
    });

    it('should return security scanner configuration', () => {
      const config = configService.getSecurityScannerConfig();
      
      expect(config).toHaveProperty('enableZipBombDetection');
      expect(config).toHaveProperty('enablePathTraversalCheck');
      expect(config).toHaveProperty('enableMalwarePatternScanning');
    });

    it('should return monitoring configuration', () => {
      const config = configService.getMonitoringConfig();
      
      expect(config).toHaveProperty('enableMetrics');
      expect(config).toHaveProperty('metricsPort');
      expect(config).toHaveProperty('enableHealthChecks');
    });

    it('should return logging configuration', () => {
      const config = configService.getLoggingConfig();
      
      expect(config).toHaveProperty('level');
      expect(config).toHaveProperty('format');
      expect(config).toHaveProperty('enableStructuredLogging');
    });
  });

  describe('configuration reload', () => {
    beforeEach(() => {
      configService = ConfigurationService.getInstance();
    });

    it('should reload configuration from environment', () => {
      const originalMaxSize = configService.getFileProcessorConfig().maxFileSize;
      
      // Change environment variable
      process.env.MODPORTER_FILE_MAX_SIZE = '200000000'; // 200MB
      
      configService.reloadConfiguration();
      
      const newMaxSize = configService.getFileProcessorConfig().maxFileSize;
      expect(newMaxSize).toBe(200000000);
      expect(newMaxSize).not.toBe(originalMaxSize);
    });

    it('should throw error when reloading invalid configuration', () => {
      // Set invalid environment variable
      process.env.MODPORTER_FILE_MAX_SIZE = '-1';
      
      expect(() => {
        configService.reloadConfiguration();
      }).toThrow('Invalid configuration');
    });
  });

  describe('configuration immutability', () => {
    beforeEach(() => {
      configService = ConfigurationService.getInstance();
    });

    it('should return copies of configuration objects', () => {
      const config1 = configService.getConfig();
      const config2 = configService.getConfig();
      
      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same content
      
      // Modifying one should not affect the other
      config1.fileProcessor.maxFileSize = 999;
      expect(config2.fileProcessor.maxFileSize).not.toBe(999);
    });

    it('should return copies of specific configuration sections', () => {
      const fileConfig1 = configService.getFileProcessorConfig();
      const fileConfig2 = configService.getFileProcessorConfig();
      
      expect(fileConfig1).not.toBe(fileConfig2);
      expect(fileConfig1).toEqual(fileConfig2);
      
      fileConfig1.maxFileSize = 999;
      expect(fileConfig2.maxFileSize).not.toBe(999);
    });
  });
});