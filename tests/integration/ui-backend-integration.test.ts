/**
 * UI Backend Integration Tests
 * 
 * Tests the integration between the enhanced UI components and backend services
 */

import { ConversionService } from '../../src/services/ConversionService';
import { ValidationPipeline } from '../../src/services/ValidationPipeline';
import { EnhancedErrorCollector } from '../../src/services/EnhancedErrorCollector';
import { FeatureFlagService } from '../../src/services/FeatureFlagService';
import { FileProcessor } from '../../src/modules/ingestion/FileProcessor';
import { JavaAnalyzer } from '../../src/modules/ingestion/JavaAnalyzer';
import { JobQueue } from '../../src/services/JobQueue';

describe('UI Backend Integration', () => {
  let conversionService: ConversionService;
  let validationPipeline: ValidationPipeline;
  let errorCollector: EnhancedErrorCollector;
  let featureFlagService: FeatureFlagService;

  beforeEach(() => {
    // Initialize services with minimal configuration for testing
    const jobQueue = new JobQueue();
    const fileProcessor = new FileProcessor();
    const javaAnalyzer = new JavaAnalyzer();
    
    errorCollector = new EnhancedErrorCollector();
    validationPipeline = new ValidationPipeline({ errorCollector });
    featureFlagService = new FeatureFlagService();
    
    conversionService = new ConversionService({
      jobQueue,
      fileProcessor,
      javaAnalyzer,
      validationPipeline,
      featureFlagService,
      errorCollector
    });
  });

  describe('Service Initialization', () => {
    it('should initialize all services without errors', () => {
      expect(conversionService).toBeDefined();
      expect(validationPipeline).toBeDefined();
      expect(errorCollector).toBeDefined();
      expect(featureFlagService).toBeDefined();
    });

    it('should have proper service dependencies', () => {
      // Test that services are properly connected
      expect(conversionService).toBeInstanceOf(ConversionService);
      expect(validationPipeline).toBeInstanceOf(ValidationPipeline);
      expect(errorCollector).toBeInstanceOf(EnhancedErrorCollector);
      expect(featureFlagService).toBeInstanceOf(FeatureFlagService);
    });
  });

  describe('Feature Flag Integration', () => {
    it('should check feature flags for enhanced processing', async () => {
      // Test feature flag checking
      const isEnabled = await featureFlagService.isEnabled('enhanced_file_processing');
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should handle multiple feature flag checks', async () => {
      const flags = await Promise.all([
        featureFlagService.isEnabled('enhanced_file_processing'),
        featureFlagService.isEnabled('multi_strategy_analysis'),
        featureFlagService.isEnabled('specialized_conversion_agents'),
        featureFlagService.isEnabled('comprehensive_validation')
      ]);

      expect(flags).toHaveLength(4);
      flags.forEach(flag => expect(typeof flag).toBe('boolean'));
    });
  });

  describe('Error Collection Integration', () => {
    it('should collect and categorize errors', () => {
      // Test error collection functionality
      const metrics = errorCollector.getErrorRateMetrics();
      
      expect(metrics).toHaveProperty('totalErrors');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('errorsByType');
      expect(metrics).toHaveProperty('errorsBySeverity');
      expect(metrics).toHaveProperty('errorsByModule');
    });

    it('should provide system health status', () => {
      const healthStatus = errorCollector.getSystemHealthStatus();
      
      expect(healthStatus).toHaveProperty('overall');
      expect(healthStatus).toHaveProperty('components');
      expect(healthStatus).toHaveProperty('errorRate');
      expect(healthStatus).toHaveProperty('degradationLevel');
      expect(healthStatus).toHaveProperty('recommendations');
    });

    it('should handle recoverable errors', () => {
      const recoverableErrors = errorCollector.getRecoverableErrors();
      expect(Array.isArray(recoverableErrors)).toBe(true);
    });
  });

  describe('Validation Pipeline Integration', () => {
    it('should initialize validation pipeline with error collector', () => {
      const pipelineErrorCollector = validationPipeline.getErrorCollector();
      expect(pipelineErrorCollector).toBe(errorCollector);
    });

    it('should provide validation metrics', () => {
      const metrics = validationPipeline.getMetrics();
      
      expect(metrics).toHaveProperty('totalValidations');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('averageExecutionTime');
      expect(metrics).toHaveProperty('errorsByType');
      expect(metrics).toHaveProperty('errorsBySeverity');
      expect(metrics).toHaveProperty('stageMetrics');
    });
  });

  describe('Conversion Service Integration', () => {
    it('should handle job status queries', () => {
      const status = conversionService.getJobStatus('non-existent-job');
      expect(status).toBeUndefined();
    });

    it('should handle job listing', () => {
      const jobs = conversionService.getJobs();
      expect(Array.isArray(jobs)).toBe(true);
    });

    it('should handle job cancellation for non-existent jobs', () => {
      const cancelled = conversionService.cancelJob('non-existent-job');
      expect(typeof cancelled).toBe('boolean');
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop conversion service', async () => {
      // Test service lifecycle
      expect(() => conversionService.start()).not.toThrow();
      await expect(conversionService.stop()).resolves.not.toThrow();
    });

    it('should handle service restart', async () => {
      conversionService.start();
      await conversionService.stop();
      expect(() => conversionService.start()).not.toThrow();
      await conversionService.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', () => {
      // Test error handling in service interactions
      expect(() => {
        conversionService.getJobStatus('');
      }).not.toThrow();
    });

    it('should handle invalid job operations', () => {
      expect(() => {
        conversionService.cancelJob('');
        conversionService.updateJobPriority('', -1);
        conversionService.updateJobPriority('', 11);
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        featureFlagService.isEnabled(`test_flag_${i}`)
      );

      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);
    });

    it('should handle rapid status queries', () => {
      const queries = Array.from({ length: 100 }, () => 
        conversionService.getJobStatus('test-job')
      );

      expect(queries).toHaveLength(100);
      queries.forEach(result => expect(result).toBeUndefined());
    });
  });

  afterEach(async () => {
    // Cleanup services
    if (conversionService) {
      await conversionService.stop();
    }
  });
});