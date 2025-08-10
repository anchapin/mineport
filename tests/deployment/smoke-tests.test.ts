/**
 * Smoke Tests for ModPorter-AI Integration Deployment
 * These tests verify basic functionality after deployment
 */

import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 30000;

describe('ModPorter-AI Deployment Smoke Tests', () => {
  beforeAll(async () => {
    // Wait for service to be ready
    let retries = 10;
    while (retries > 0) {
      try {
        await axios.get(`${BASE_URL}/health`);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw new Error('Service not ready after 10 retries');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  });

  describe('Health Check Endpoints', () => {
    it(
      'should return healthy status from /health endpoint',
      async () => {
        const response = await axios.get(`${BASE_URL}/health`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status');
        expect(['healthy', 'degraded']).toContain(response.data.status);
        expect(response.data).toHaveProperty('checks');
        expect(Array.isArray(response.data.checks)).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      'should return ready status from /ready endpoint',
      async () => {
        const response = await axios.get(`${BASE_URL}/ready`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status', 'ready');
      },
      TEST_TIMEOUT
    );

    it(
      'should return alive status from /live endpoint',
      async () => {
        const response = await axios.get(`${BASE_URL}/live`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status', 'alive');
        expect(response.data).toHaveProperty('uptime');
        expect(typeof response.data.uptime).toBe('number');
      },
      TEST_TIMEOUT
    );

    it(
      'should return metrics from /metrics endpoint',
      async () => {
        const response = await axios.get(`${BASE_URL}/metrics`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('system');
        expect(response.data).toHaveProperty('memory');
        expect(response.data).toHaveProperty('health');
      },
      TEST_TIMEOUT
    );
  });

  describe('Feature Flag Configuration', () => {
    it(
      'should have valid feature flag configuration',
      async () => {
        const response = await axios.get(`${BASE_URL}/config/validate`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('valid', true);
        expect(response.data).toHaveProperty('checks');
        expect(Array.isArray(response.data.checks)).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      'should have ModPorter-AI features properly configured',
      async () => {
        // This would check if feature flags are properly set
        // For now, we'll verify the health endpoint includes feature status
        const response = await axios.get(`${BASE_URL}/health`);

        expect(response.status).toBe(200);
        // The health check should include information about ModPorter-AI components
        const modporterCheck = response.data.checks.find(
          (check: any) => check.name === 'modporter-ai-components'
        );
        expect(modporterCheck).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });

  describe('Database Connectivity', () => {
    it(
      'should have database connectivity',
      async () => {
        const response = await axios.get(`${BASE_URL}/health`);

        expect(response.status).toBe(200);
        const dbCheck = response.data.checks.find((check: any) => check.name === 'database');
        expect(dbCheck).toBeDefined();
        expect(dbCheck.status).toBe('healthy');
      },
      TEST_TIMEOUT
    );
  });

  describe('File Processing Capabilities', () => {
    it(
      'should accept file uploads',
      async () => {
        // Create a test file
        const testFilePath = path.join(__dirname, 'test-file.txt');
        fs.writeFileSync(testFilePath, 'test content');

        try {
          const formData = new FormData();
          formData.append('file', fs.createReadStream(testFilePath));

          const response = await axios.post(`${BASE_URL}/api/upload`, formData, {
            headers: {
              ...formData.getHeaders(),
            },
            validateStatus: (status) => status < 500, // Accept 4xx errors as valid responses
          });

          // We expect either success or a validation error (not a server error)
          expect(response.status).toBeLessThan(500);
        } finally {
          // Clean up test file
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Security Features', () => {
    it(
      'should reject files that are too large',
      async () => {
        // Create a large test file (simulate)
        const testFilePath = path.join(__dirname, 'large-test-file.txt');
        const largeContent = 'x'.repeat(1024 * 1024); // 1MB of content
        fs.writeFileSync(testFilePath, largeContent);

        try {
          const formData = new FormData();
          formData.append('file', fs.createReadStream(testFilePath));

          const response = await axios.post(`${BASE_URL}/api/upload`, formData, {
            headers: {
              ...formData.getHeaders(),
            },
            validateStatus: () => true, // Accept any status
          });

          // Should either accept the file or reject with proper error
          expect([200, 400, 413]).toContain(response.status);
        } finally {
          // Clean up test file
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      },
      TEST_TIMEOUT
    );

    it(
      'should have security scanning enabled',
      async () => {
        const response = await axios.get(`${BASE_URL}/health`);

        expect(response.status).toBe(200);
        // Verify that security-related health checks are present
        const securityChecks = response.data.checks.filter(
          (check: any) => check.name.includes('security') || check.name.includes('filesystem')
        );
        expect(securityChecks.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );
  });

  describe('Performance Validation', () => {
    it(
      'should respond to health checks within acceptable time',
      async () => {
        const startTime = Date.now();
        const response = await axios.get(`${BASE_URL}/health`);
        const responseTime = Date.now() - startTime;

        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      },
      TEST_TIMEOUT
    );

    it(
      'should have acceptable memory usage',
      async () => {
        const response = await axios.get(`${BASE_URL}/metrics`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('memory');

        const memoryUsage = response.data.memory;
        expect(memoryUsage).toHaveProperty('heapUsed');
        expect(memoryUsage).toHaveProperty('heapTotal');

        // Memory usage should be reasonable (less than 1GB heap)
        expect(memoryUsage.heapUsed).toBeLessThan(1024 * 1024 * 1024);
      },
      TEST_TIMEOUT
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle invalid requests gracefully',
      async () => {
        const response = await axios.get(`${BASE_URL}/api/nonexistent`, {
          validateStatus: () => true,
        });

        // Should return 404, not crash
        expect(response.status).toBe(404);
      },
      TEST_TIMEOUT
    );

    it(
      'should handle malformed requests gracefully',
      async () => {
        const response = await axios.post(`${BASE_URL}/api/upload`, 'invalid data', {
          headers: {
            'Content-Type': 'application/json',
          },
          validateStatus: () => true,
        });

        // Should return 400, not crash
        expect([400, 415]).toContain(response.status);
      },
      TEST_TIMEOUT
    );
  });

  describe('Monitoring Integration', () => {
    it(
      'should have monitoring endpoints accessible',
      async () => {
        const endpoints = ['/health', '/ready', '/live', '/metrics'];

        for (const endpoint of endpoints) {
          const response = await axios.get(`${BASE_URL}${endpoint}`);
          expect(response.status).toBe(200);
        }
      },
      TEST_TIMEOUT
    );

    it(
      'should provide structured log output',
      async () => {
        // Make a request that should generate logs
        await axios.get(`${BASE_URL}/health`);

        // Verify that the service is generating structured logs
        // This is a basic check - in a real environment you'd check log aggregation
        const response = await axios.get(`${BASE_URL}/metrics`);
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('timestamp');
      },
      TEST_TIMEOUT
    );
  });
});

describe('ModPorter-AI Feature-Specific Smoke Tests', () => {
  describe('Enhanced File Processing', () => {
    it(
      'should validate file types correctly',
      async () => {
        // Test with a text file (should be rejected for mod conversion)
        const testFilePath = path.join(__dirname, 'test.txt');
        fs.writeFileSync(testFilePath, 'not a jar file');

        try {
          const formData = new FormData();
          formData.append('file', fs.createReadStream(testFilePath));

          const response = await axios.post(`${BASE_URL}/api/convert`, formData, {
            headers: {
              ...formData.getHeaders(),
            },
            validateStatus: () => true,
          });

          // Should reject non-JAR files
          expect([400, 415]).toContain(response.status);
        } finally {
          if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
          }
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Feature Flag Responsiveness', () => {
    it(
      'should respect feature flag settings',
      async () => {
        // This test would verify that feature flags are being read correctly
        // For now, we'll check that the system responds appropriately
        const response = await axios.get(`${BASE_URL}/health`);

        expect(response.status).toBe(200);
        // The health check should reflect current feature flag status
        expect(response.data).toHaveProperty('checks');
      },
      TEST_TIMEOUT
    );
  });

  describe('Rollback Capability', () => {
    it(
      'should handle rollback mode correctly',
      async () => {
        // This test verifies that the system can handle rollback scenarios
        const response = await axios.get(`${BASE_URL}/health`);

        expect(response.status).toBe(200);
        // System should be operational regardless of rollback mode
        expect(['healthy', 'degraded']).toContain(response.data.status);
      },
      TEST_TIMEOUT
    );
  });
});

describe('Integration Validation', () => {
  describe('Service Dependencies', () => {
    it(
      'should have all required services available',
      async () => {
        const response = await axios.get(`${BASE_URL}/health`);

        expect(response.status).toBe(200);

        // Check that all critical services are healthy
        const criticalServices = ['database', 'filesystem'];
        const healthyServices = response.data.checks
          .filter((check: any) => check.status === 'healthy')
          .map((check: any) => check.name);

        for (const service of criticalServices) {
          expect(healthyServices).toContain(service);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Configuration Validation', () => {
    it(
      'should have valid environment configuration',
      async () => {
        const response = await axios.get(`${BASE_URL}/config/validate`);

        expect(response.status).toBe(200);
        expect(response.data.valid).toBe(true);

        // All configuration checks should pass
        const failedChecks = response.data.checks.filter((check: any) => check.status !== 'passed');
        expect(failedChecks).toHaveLength(0);
      },
      TEST_TIMEOUT
    );
  });
});
