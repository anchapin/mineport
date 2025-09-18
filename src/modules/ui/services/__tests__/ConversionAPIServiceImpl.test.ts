/**
 * Tests for ConversionAPIServiceImpl
 */

import { ConversionAPIServiceImpl, APIError } from '../ConversionAPIServiceImpl';

import { vi } from 'vitest';
// Mock fetch
global.fetch = vi.fn();
global.AbortController = vi.fn().mockImplementation(() => ({
  signal: {},
  abort: vi.fn()
}));

describe('ConversionAPIServiceImpl', () => {
  let service: ConversionAPIServiceImpl;
  
  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConversionAPIServiceImpl({
      baseUrl: 'https://api.example.com',
      timeout: 5000
    });
  });
  
  describe('startConversion', () => {
    it('should make a POST request to the correct endpoint', async () => {
      // Mock successful response
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'test-job-id' })
      });
      
      // Create mock file
      const file = new File(['test'], 'test.jar', { type: 'application/java-archive' });
      
      // Call the method
      const result = await service.startConversion({
        modFile: file,
        sourceRepo: 'https://github.com/example/mod'
      });
      
      // Verify the result
      expect(result).toEqual({ jobId: 'test-job-id' });
      
      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/conversions',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
          signal: expect.anything()
        })
      );
    });
    
    it('should handle API errors', async () => {
      // Mock error response
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid file format', code: 'INVALID_FILE' })
      });
      
      // Create mock file
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      // Call the method and expect it to throw
      await expect(service.startConversion({ modFile: file }))
        .rejects
        .toThrow(new APIError('Invalid file format', 400, 'INVALID_FILE'));
    });
    
    it('should handle network errors', async () => {
      // Mock network error
      (global.fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      // Create mock file
      const file = new File(['test'], 'test.jar', { type: 'application/java-archive' });
      
      // Call the method and expect it to throw
      await expect(service.startConversion({ modFile: file }))
        .rejects
        .toThrow(new APIError('Network error', 0, 'NETWORK_ERROR'));
    });
  });
  
  describe('getConversionStatus', () => {
    it('should make a GET request to the correct endpoint', async () => {
      // Mock successful response
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'test-job-id',
          status: 'processing',
          progress: {
            stage: 'analyzing',
            percentage: 50,
            currentTask: 'Analyzing mod structure'
          },
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:01:00.000Z'
        })
      });
      
      // Call the method
      const result = await service.getConversionStatus('test-job-id');
      
      // Verify the result
      expect(result).toEqual({
        jobId: 'test-job-id',
        status: 'processing',
        progress: {
          stage: 'analyzing',
          percentage: 50,
          currentTask: 'Analyzing mod structure'
        },
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:01:00.000Z'
      });
      
      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/conversions/test-job-id/status',
        expect.objectContaining({
          method: 'GET',
          signal: expect.anything()
        })
      );
    });
  });
  
  describe('cancelConversion', () => {
    it('should make a POST request to the correct endpoint', async () => {
      // Mock successful response
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });
      
      // Call the method
      const result = await service.cancelConversion('test-job-id');
      
      // Verify the result
      expect(result).toBe(true);
      
      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/conversions/test-job-id/cancel',
        expect.objectContaining({
          method: 'POST',
          signal: expect.anything()
        })
      );
    });
  });
  
  describe('getConversionResult', () => {
    it('should make a GET request to the correct endpoint', async () => {
      // Mock successful response
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'test-job-id',
          success: true,
          downloadUrl: '/api/downloads/test-addon.mcaddon',
          reportUrl: '/api/reports/test-report.html',
          errorSummary: {
            totalErrors: 0,
            criticalErrors: 0,
            errors: 0,
            warnings: 0,
            info: 0
          }
        })
      });
      
      // Call the method
      const result = await service.getConversionResult('test-job-id');
      
      // Verify the result
      expect(result).toEqual({
        jobId: 'test-job-id',
        success: true,
        downloadUrl: '/api/downloads/test-addon.mcaddon',
        reportUrl: '/api/reports/test-report.html',
        errorSummary: {
          totalErrors: 0,
          criticalErrors: 0,
          errors: 0,
          warnings: 0,
          info: 0
        }
      });
      
      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/conversions/test-job-id/result',
        expect.objectContaining({
          method: 'GET',
          signal: expect.anything()
        })
      );
    });
  });
  
  describe('mock mode', () => {
    beforeEach(() => {
      service = new ConversionAPIServiceImpl({
        baseUrl: 'https://api.example.com',
        useMockData: true
      });
    });
    
    it('should return mock data for startConversion', async () => {
      const file = new File(['test'], 'test.jar', { type: 'application/java-archive' });
      const result = await service.startConversion({ modFile: file });
      
      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('estimatedTimeSeconds');
      expect(result).toHaveProperty('queuePosition');
      
      // Verify fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
    });
    
    it('should return mock data for getConversionStatus', async () => {
      const result = await service.getConversionStatus('test-job-id');
      
      expect(result).toHaveProperty('jobId', 'test-job-id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('progress');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
      
      // Verify fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});