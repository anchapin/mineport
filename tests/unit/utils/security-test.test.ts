/**
 * Tests for the security testing utility
 */

import { describe, it, expect } from 'vitest';
import {
  validateSecureHandling,
  testInputValidation,
  generateSecureToken,
  validateEnvironmentSecurity,
  runSecurityTests,
  generateSecurityReport
} from '../../../src/utils/security-test';

describe('Security Testing Utility', () => {
  describe('validateSecureHandling', () => {
    it('should hash valid data successfully', () => {
      const result = validateSecureHandling('test-data');
      
      expect(result.testName).toBe('Secure Data Handling');
      expect(result.passed).toBe(true);
      expect(result.details).toContain('Data successfully hashed');
      expect(result.details).toContain('Hash length: 64');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should fail with invalid input', () => {
      const result = validateSecureHandling('');
      
      expect(result.testName).toBe('Secure Data Handling');
      expect(result.passed).toBe(false);
      expect(result.details).toBe('Invalid input data provided');
    });
  });

  describe('testInputValidation', () => {
    it('should pass safe input validation', () => {
      const result = testInputValidation('safe input text');
      
      expect(result.testName).toBe('Input Validation');
      expect(result.passed).toBe(true);
      expect(result.details).toContain('Input successfully sanitized');
    });

    it('should detect dangerous input patterns', () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        'onclick="malicious()"',
        '$(document).ready()',
        'eval("malicious code")'
      ];

      dangerousInputs.forEach(input => {
        const result = testInputValidation(input);
        expect(result.testName).toBe('Input Validation');
        expect(result.passed).toBe(false);
        expect(result.details).toBe('Potentially dangerous input detected and blocked');
      });
    });

    it('should sanitize HTML entities', () => {
      const result = testInputValidation('<div class="test">content</div>');
      
      expect(result.testName).toBe('Input Validation');
      expect(result.passed).toBe(true);
      expect(result.details).toContain('Input successfully sanitized');
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a secure token', () => {
      const token = generateSecureToken();
      
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 (hex)
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateEnvironmentSecurity', () => {
    it('should validate environment security', () => {
      const result = validateEnvironmentSecurity();
      
      expect(result.testName).toBe('Environment Security');
      expect(result.passed).toBe(true);
      expect(result.details).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('runSecurityTests', () => {
    it('should run all security tests', () => {
      const results = runSecurityTests();
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      // Check that all results have required properties
      results.forEach(result => {
        expect(result).toHaveProperty('testName');
        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('details');
        expect(result).toHaveProperty('timestamp');
        expect(result.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should include expected test types', () => {
      const results = runSecurityTests();
      const testNames = results.map(r => r.testName);
      
      expect(testNames).toContain('Secure Data Handling');
      expect(testNames).toContain('Input Validation');
      expect(testNames).toContain('Environment Security');
    });
  });

  describe('generateSecurityReport', () => {
    it('should generate a formatted security report', () => {
      const report = generateSecurityReport();
      
      expect(typeof report).toBe('string');
      expect(report).toContain('# Security Test Report');
      expect(report).toContain('**Generated**:');
      expect(report).toContain('**Tests Passed**:');
      expect(report).toContain('✅');
    });

    it('should include all test results in report', () => {
      const report = generateSecurityReport();
      
      expect(report).toContain('Secure Data Handling');
      expect(report).toContain('Input Validation');
      expect(report).toContain('Environment Security');
    });
  });
});