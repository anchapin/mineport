/**
 * Tests for mock factory functions to ensure they generate compliant data structures
 */

import { describe, it, expect } from 'vitest';
import {
  createMockJobData,
  createMockJob,
  createMockWorkerTask,
  createMockConversionResult,
} from '../../utils/testHelpers.js';

describe('Mock Factory Functions', () => {
  describe('createMockJobData', () => {
    it('should create valid JobData with default values', () => {
      const jobData = createMockJobData();

      expect(jobData.type).toBe('conversion');
      expect(jobData.priority).toBe('normal');
      expect(jobData.payload).toBeDefined();
      expect(jobData.options).toBeDefined();
      expect(jobData.options.timeout).toBe(30000);
      expect(jobData.options.maxRetries).toBe(3);
      expect(jobData.options.retryCount).toBe(0);
      expect(jobData.options.priority).toBe('normal');
      expect(jobData.options.resourceRequirements).toBeDefined();
      expect(jobData.options.resourceRequirements.memory).toBe(1024);
      expect(jobData.options.resourceRequirements.cpu).toBe(1);
      expect(jobData.options.resourceRequirements.disk).toBe(512);
    });

    it('should create valid JobData with custom values', () => {
      const jobData = createMockJobData('validation', 'high');

      expect(jobData.type).toBe('validation');
      expect(jobData.priority).toBe('high');
      expect(jobData.options.priority).toBe('high');
    });

    it('should include all required properties', () => {
      const jobData = createMockJobData();

      // Verify all required properties exist
      expect(jobData).toHaveProperty('type');
      expect(jobData).toHaveProperty('priority');
      expect(jobData).toHaveProperty('payload');
      expect(jobData).toHaveProperty('options');
      expect(jobData.options).toHaveProperty('timeout');
      expect(jobData.options).toHaveProperty('maxRetries');
      expect(jobData.options).toHaveProperty('retryCount');
      expect(jobData.options).toHaveProperty('priority');
      expect(jobData.options).toHaveProperty('resourceRequirements');
    });
  });

  describe('createMockJob', () => {
    it('should create valid Job with default values', () => {
      const job = createMockJob();

      expect(job.id).toBe('test-job-1');
      expect(job.type).toBe('conversion');
      expect(job.status).toBe('pending');
      expect(job.priority).toBe('normal');
      expect(job.payload).toBeDefined();
      expect(job.progress).toBeDefined();
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);
    });

    it('should create valid Job with custom values', () => {
      const job = createMockJob('custom-job', 'validation', 'running');

      expect(job.id).toBe('custom-job');
      expect(job.type).toBe('validation');
      expect(job.status).toBe('running');
    });

    it('should include all required properties', () => {
      const job = createMockJob();

      // Verify all required properties exist
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('type');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('priority');
      expect(job).toHaveProperty('payload');
      expect(job).toHaveProperty('progress');
      expect(job).toHaveProperty('createdAt');
      expect(job).toHaveProperty('retryCount');
      expect(job).toHaveProperty('maxRetries');
      expect(job.payload).toHaveProperty('type');
      expect(job.payload).toHaveProperty('data');
      expect(job.payload).toHaveProperty('options');
      expect(job.progress).toHaveProperty('stage');
      expect(job.progress).toHaveProperty('percentage');
      expect(job.progress).toHaveProperty('details');
    });
  });

  describe('createMockWorkerTask', () => {
    it('should create valid WorkerTask', () => {
      const input = { test: 'data' };
      const task = createMockWorkerTask(input);

      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^task-[a-z0-9]+$/);
      expect(task.execute).toBeInstanceOf(Function);
      expect(task.input).toBe(input);
      expect(task.priority).toBe(1);
    });

    it('should use custom execute function', async () => {
      const input = 5;
      const customExecute = async (n: number) => n * 2;
      const task = createMockWorkerTask(input, customExecute);

      const result = await task.execute(input);
      expect(result).toBe(10);
    });

    it('should include all required properties', () => {
      const task = createMockWorkerTask({ test: 'data' });

      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('execute');
      expect(task).toHaveProperty('input');
      expect(task).toHaveProperty('priority');
    });
  });

  describe('createMockConversionResult', () => {
    it('should create valid successful ConversionResult', () => {
      const result = createMockConversionResult('test-mod', true);

      expect(result.jobId).toBeDefined();
      expect(result.jobId).toMatch(/^job-[a-z0-9]+$/);
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.modId).toBe('test-mod');
      expect(result.result.manifestInfo).toBeDefined();
      expect(result.result.registryNames).toEqual(['test_block', 'test_item']);
      expect(result.result.texturePaths).toEqual([`assets/test-mod/textures/block/test_block.png`]);
      expect(result.result.analysisNotes).toBeDefined();
      expect(result.result.bedrockAddon).toBeDefined();
      expect(result.result.report).toBeDefined();
      expect(result.bedrockAddon).toBeDefined();
      expect(result.validation).toBeDefined();
      expect(result.validation.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should create valid failed ConversionResult', () => {
      const result = createMockConversionResult('test-mod', false);

      expect(result.success).toBe(false);
      expect(result.result).toBeUndefined();
      expect(result.bedrockAddon).toBeUndefined();
      expect(result.validation.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Test error');
    });

    it('should include all required properties', () => {
      const result = createMockConversionResult();

      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');

      if (result.success) {
        expect(result).toHaveProperty('result');
        expect(result).toHaveProperty('bedrockAddon');
        expect(result.result).toHaveProperty('modId');
        expect(result.result).toHaveProperty('manifestInfo');
        expect(result.result).toHaveProperty('registryNames');
        expect(result.result).toHaveProperty('texturePaths');
        expect(result.result).toHaveProperty('analysisNotes');
        expect(result.result).toHaveProperty('bedrockAddon');
        expect(result.result).toHaveProperty('report');
      }
    });
  });

  describe('Data Structure Compliance', () => {
    it('should generate JobData compatible with JobQueueService', () => {
      const jobData = createMockJobData();

      // Test that the structure matches what JobQueueService expects
      expect(typeof jobData.type).toBe('string');
      expect(['conversion', 'validation', 'analysis', 'packaging']).toContain(jobData.type);
      expect(typeof jobData.priority).toBe('string');
      expect(['low', 'normal', 'high', 'urgent']).toContain(jobData.priority);
      expect(typeof jobData.options.timeout).toBe('number');
      expect(typeof jobData.options.maxRetries).toBe('number');
      expect(typeof jobData.options.retryCount).toBe('number');
      expect(jobData.options.retryCount).toBeGreaterThanOrEqual(0);
      expect(jobData.options.retryCount).toBeLessThanOrEqual(jobData.options.maxRetries);
    });

    it('should generate Job compatible with JobStatusStore', () => {
      const job = createMockJob();

      // Test that the structure matches what JobStatusStore expects
      expect(typeof job.id).toBe('string');
      expect(job.id.length).toBeGreaterThan(0);
      expect(['conversion', 'validation', 'analysis', 'packaging']).toContain(job.type);
      expect(['pending', 'running', 'completed', 'failed', 'cancelled']).toContain(job.status);
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(typeof job.progress.percentage).toBe('number');
      expect(job.progress.percentage).toBeGreaterThanOrEqual(0);
      expect(job.progress.percentage).toBeLessThanOrEqual(100);
    });

    it('should generate WorkerTask compatible with WorkerPool', () => {
      const task = createMockWorkerTask({ test: 'data' });

      // Test that the structure matches what WorkerPool expects
      expect(typeof task.id).toBe('string');
      expect(task.execute).toBeInstanceOf(Function);
      expect(task.input).toBeDefined();
      expect(typeof task.priority).toBe('number');
    });

    it('should generate ConversionResult compatible with ConversionService', () => {
      const result = createMockConversionResult();

      // Test that the structure matches what ConversionService expects
      expect(typeof result.jobId).toBe('string');
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.validation).toBeDefined();
      expect(typeof result.validation.isValid).toBe('boolean');
      expect(Array.isArray(result.validation.errors)).toBe(true);
      expect(Array.isArray(result.validation.warnings)).toBe(true);

      if (result.success && result.result) {
        expect(typeof result.result.modId).toBe('string');
        expect(Array.isArray(result.result.registryNames)).toBe(true);
        expect(Array.isArray(result.result.texturePaths)).toBe(true);
        expect(Array.isArray(result.result.analysisNotes)).toBe(true);
      }
    });
  });
});
