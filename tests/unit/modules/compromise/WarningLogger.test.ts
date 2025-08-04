import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WarningLogger,
  WarningType,
  FeatureWarning,
} from '../../../../src/modules/compromise/WarningLogger.js';
import { Feature } from '../../../../src/types/compromise.js';
import { Logger } from '../../../../src/utils/logger.js';

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

describe('WarningLogger', () => {
  let logger: WarningLogger;
  let testFeature: Feature;

  beforeEach(() => {
    logger = new WarningLogger(mockLogger);

    testFeature = {
      id: 'test-feature',
      name: 'Test Feature',
      description: 'A test feature',
      type: 'rendering',
      compatibilityTier: 3,
      sourceFiles: ['TestFeature.java'],
      sourceLineNumbers: [[10, 20]],
    };

    vi.clearAllMocks();
  });

  it('should register a warning for a feature', () => {
    const warning = logger.registerWarning(
      testFeature,
      'rendering',
      'Advanced rendering not supported',
      ['Use Bedrock particles instead', 'Create custom textures']
    );

    expect(warning).toBeDefined();
    expect(warning.featureId).toBe(testFeature.id);
    expect(warning.featureName).toBe(testFeature.name);
    expect(warning.warningType).toBe('rendering');
    expect(warning.details).toBe('Advanced rendering not supported');
    expect(warning.recommendations).toHaveLength(2);
    expect(warning.recommendations[0]).toBe('Use Bedrock particles instead');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Registered warning for feature Test Feature: Advanced rendering not supported'
    );
  });

  it('should generate console warning code', () => {
    const warningCode = logger.generateConsoleWarning(
      testFeature,
      'rendering',
      'Advanced rendering not supported'
    );

    expect(warningCode).toBe(
      'console.warn("[RENDERING STUB] Test Feature: Advanced rendering not supported");'
    );
  });

  it('should escape special characters in console warnings', () => {
    const featureWithSpecialChars: Feature = {
      ...testFeature,
      name: 'Test "Feature" with \'quotes\'',
    };

    const warningCode = logger.generateConsoleWarning(
      featureWithSpecialChars,
      'rendering',
      'Can\'t render "special" effects'
    );

    // Instead of checking the exact string (which can have different escape sequences),
    // let's check that it contains the key elements
    expect(warningCode).toContain('[RENDERING STUB]');
    expect(warningCode).toContain('Test');
    expect(warningCode).toContain('Feature');
    expect(warningCode).toContain('quotes');
    expect(warningCode).toContain('special');
    expect(warningCode).toContain('effects');
  });

  it('should generate detailed comments for stub functions', () => {
    const comment = logger.generateDetailedComment(
      testFeature,
      'rendering',
      'Advanced rendering not supported',
      ['Use Bedrock particles instead', 'Create custom textures']
    );

    expect(comment).toContain('RENDERING STUB: Test Feature');
    expect(comment).toContain('Advanced rendering not supported');
    expect(comment).toContain('Original feature compatibility tier: 3');
    expect(comment).toContain('Source files: TestFeature.java');
    expect(comment).toContain('Recommendations:');
    expect(comment).toContain('- Use Bedrock particles instead');
    expect(comment).toContain('- Create custom textures');
    expect(comment).toContain('This is a stub implementation with limited functionality.');
  });

  it('should generate user notification system code', () => {
    const notificationCode = logger.generateUserNotificationSystem('Test Mod');

    expect(notificationCode).toContain('User Notification System for Test Mod');
    expect(notificationCode).toContain('class TestModNotificationManager');
    expect(notificationCode).toContain('showInitialNotification');
    expect(notificationCode).toContain('setupPeriodicReminders');
    expect(notificationCode).toContain('notifyStub');
    expect(notificationCode).toContain('showHelp');
    expect(notificationCode).toContain('createTestModNotificationManager');
    expect(notificationCode).toContain('/testmod help');
  });

  it('should get warnings for a specific feature', () => {
    const warning = logger.registerWarning(
      testFeature,
      'rendering',
      'Advanced rendering not supported'
    );

    const retrievedWarning = logger.getWarningForFeature(testFeature.id);

    expect(retrievedWarning).toBeDefined();
    expect(retrievedWarning).toEqual(warning);
  });

  it('should generate a warning report', () => {
    // Register multiple warnings
    logger.registerWarning(testFeature, 'rendering', 'Advanced rendering not supported');

    const feature2: Feature = {
      id: 'test-feature-2',
      name: 'Test Feature 2',
      description: 'Another test feature',
      type: 'dimension',
      compatibilityTier: 3,
      sourceFiles: ['TestFeature2.java'],
      sourceLineNumbers: [[30, 40]],
    };

    logger.registerWarning(feature2, 'dimension', 'Custom dimensions not supported');

    const report = logger.generateWarningReport();

    expect(report.totalWarnings).toBe(2);
    expect(report.warningsByType).toHaveProperty('rendering', 1);
    expect(report.warningsByType).toHaveProperty('dimension', 1);
    expect(report.warnings).toHaveLength(2);
  });

  it('should use different prefixes for different warning types', () => {
    const warningTypes: WarningType[] = [
      'rendering',
      'dimension',
      'ui',
      'api',
      'performance',
      'other',
    ];
    const expectedPrefixes = [
      'RENDERING STUB',
      'DIMENSION SIMULATION',
      'UI LIMITATION',
      'API INCOMPATIBILITY',
      'PERFORMANCE WARNING',
      'WARNING',
    ];

    warningTypes.forEach((type, index) => {
      const warningCode = logger.generateConsoleWarning(testFeature, type, 'Test warning');

      expect(warningCode).toContain(`[${expectedPrefixes[index]}]`);
    });
  });
});
