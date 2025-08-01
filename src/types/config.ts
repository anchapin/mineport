/**
 * Configuration interfaces for ModPorter-AI integration components
 */

export interface FileProcessorConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  enableMalwareScanning: boolean;
  tempDirectory: string;
  scanTimeout: number;
  maxCompressionRatio: number;
  maxExtractedSize: number;
}

export interface JavaAnalyzerConfig {
  extractionStrategies: string[];
  analysisTimeout: number;
  enableBytecodeAnalysis: boolean;
  maxClassFilesToAnalyze: number;
  enableMultiStrategyExtraction: boolean;
  fallbackToBasicAnalysis: boolean;
}

export interface AssetConverterConfig {
  textureOptimization: boolean;
  modelConversionQuality: 'fast' | 'balanced' | 'high';
  soundConversionFormat: 'ogg' | 'wav';
  maxTextureSize: number;
  enableParallelConversion: boolean;
  outputDirectory: string;
}

export interface ValidationPipelineConfig {
  enableStrictValidation: boolean;
  maxValidationTime: number;
  requiredStages: string[];
  enableParallelValidation: boolean;
  failFast: boolean;
  validationTimeout: number;
}

export interface SecurityScannerConfig {
  enableZipBombDetection: boolean;
  enablePathTraversalCheck: boolean;
  enableMalwarePatternScanning: boolean;
  maxScanTime: number;
  threatDatabasePath?: string;
  quarantineDirectory: string;
}

export interface MonitoringConfig {
  enableMetrics: boolean;
  metricsPort: number;
  enableTracing: boolean;
  tracingEndpoint?: string;
  enableHealthChecks: boolean;
  healthCheckInterval: number;
  alertingEnabled: boolean;
  alertingWebhookUrl?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  enableStructuredLogging: boolean;
  enableSecurityEventLogging: boolean;
  enablePerformanceLogging: boolean;
  logDirectory: string;
  maxLogFileSize: number;
  maxLogFiles: number;
}

export interface ModPorterAIConfig {
  fileProcessor: FileProcessorConfig;
  javaAnalyzer: JavaAnalyzerConfig;
  assetConverter: AssetConverterConfig;
  validationPipeline: ValidationPipelineConfig;
  securityScanner: SecurityScannerConfig;
  monitoring: MonitoringConfig;
  logging: LoggingConfig;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ConfigValidationWarning {
  field: string;
  message: string;
  value?: any;
}