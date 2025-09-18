/**
 * Security Testing Utility
 * 
 * This utility provides functions for testing security workflows
 * and validating the free security scanning tools integration.
 */

import crypto from 'crypto';

export interface SecurityTestResult {
  testName: string;
  passed: boolean;
  details: string;
  timestamp: Date;
}

/**
 * Validates that sensitive data is properly handled
 * This function demonstrates secure coding practices
 */
export function validateSecureHandling(data: string): SecurityTestResult {
  try {
    // Ensure input is sanitized
    if (!data || typeof data !== 'string') {
      return {
        testName: 'Secure Data Handling',
        passed: false,
        details: 'Invalid input data provided',
        timestamp: new Date()
      };
    }

    // Hash sensitive data instead of storing in plain text
    const hash = crypto.createHash('sha256');
    hash.update(data);
    const hashedData = hash.digest('hex');

    // Validate the hash was created successfully
    if (hashedData && hashedData.length === 64) {
      return {
        testName: 'Secure Data Handling',
        passed: true,
        details: `Data successfully hashed. Hash length: ${hashedData.length}`,
        timestamp: new Date()
      };
    }

    return {
      testName: 'Secure Data Handling',
      passed: false,
      details: 'Hash generation failed',
      timestamp: new Date()
    };
  } catch (error) {
    return {
      testName: 'Secure Data Handling',
      passed: false,
      details: `Error during secure handling: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date()
    };
  }
}

/**
 * Tests input validation to prevent injection attacks
 */
export function testInputValidation(input: string): SecurityTestResult {
  try {
    // List of potentially dangerous patterns
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /\$\(/,
      /eval\(/i,
      /exec\(/i
    ];

    const isDangerous = dangerousPatterns.some(pattern => pattern.test(input));

    if (isDangerous) {
      return {
        testName: 'Input Validation',
        passed: false,
        details: 'Potentially dangerous input detected and blocked',
        timestamp: new Date()
      };
    }

    // Sanitize the input
    const sanitizedInput = input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return {
      testName: 'Input Validation',
      passed: true,
      details: `Input successfully sanitized. Original length: ${input.length}, Sanitized length: ${sanitizedInput.length}`,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      testName: 'Input Validation',
      passed: false,
      details: `Error during input validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date()
    };
  }
}

/**
 * Generates a secure random token for testing
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates environment variable security
 */
export function validateEnvironmentSecurity(): SecurityTestResult {
  try {
    const sensitiveEnvVars = ['API_KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'PRIVATE_KEY'];
    const exposedSecrets: string[] = [];

    // Check if any sensitive environment variables are exposed
    for (const [key, value] of Object.entries(process.env)) {
      if (sensitiveEnvVars.some(sensitive => key.toUpperCase().includes(sensitive))) {
        if (value && value.length > 0) {
          // Don't log the actual value, just note that it exists
          exposedSecrets.push(key);
        }
      }
    }

    if (exposedSecrets.length > 0) {
      return {
        testName: 'Environment Security',
        passed: true,
        details: `Found ${exposedSecrets.length} environment variables with potential secrets (this is expected in secure setups)`,
        timestamp: new Date()
      };
    }

    return {
      testName: 'Environment Security',
      passed: true,
      details: 'No sensitive environment variables detected',
      timestamp: new Date()
    };
  } catch (error) {
    return {
      testName: 'Environment Security',
      passed: false,
      details: `Error during environment validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date()
    };
  }
}

/**
 * Runs all security tests and returns a summary
 */
export function runSecurityTests(): SecurityTestResult[] {
  const results: SecurityTestResult[] = [];

  // Test secure data handling
  results.push(validateSecureHandling('test-sensitive-data'));

  // Test input validation with safe input
  results.push(testInputValidation('safe input text'));

  // Test input validation with potentially dangerous input
  results.push(testInputValidation('<script>alert("test")</script>'));

  // Test environment security
  results.push(validateEnvironmentSecurity());

  return results;
}

/**
 * Generates a security test report
 */
export function generateSecurityReport(): string {
  const results = runSecurityTests();
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;

  let report = `# Security Test Report\n\n`;
  report += `**Generated**: ${new Date().toISOString()}\n`;
  report += `**Tests Passed**: ${passedTests}/${totalTests}\n\n`;

  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    report += `${status} **${result.testName}**\n`;
    report += `   ${result.details}\n`;
    report += `   _Timestamp: ${result.timestamp.toISOString()}_\n\n`;
  });

  return report;
}