/**
 * Feature Flag Service
 * 
 * Service for managing feature flags to enable gradual rollout of ModPorter-AI integration features.
 * Supports percentage-based rollouts, user targeting, and group targeting.
 * 
 * @since 1.0.0
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('FeatureFlagService');

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  id: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  targetUsers: string[];
  targetGroups: string[];
  metadata: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Feature flag evaluation context
 */
export interface FeatureFlagContext {
  userId?: string;
  userGroups?: string[];
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Feature flag evaluation result
 */
export interface FeatureFlagResult {
  isEnabled: boolean;
  reason: string;
  metadata?: Record<string, any>;
}

/**
 * ModPorter-AI integration feature flags
 */
export const MODPORTER_AI_FEATURES = {
  ENHANCED_FILE_PROCESSING: 'enhanced_file_processing',
  MULTI_STRATEGY_ANALYSIS: 'multi_strategy_analysis',
  SPECIALIZED_CONVERSION_AGENTS: 'specialized_conversion_agents',
  COMPREHENSIVE_VALIDATION: 'comprehensive_validation',
  SECURITY_SCANNING: 'security_scanning',
  PERFORMANCE_MONITORING: 'performance_monitoring',
  ADVANCED_LOGGING: 'advanced_logging',
  ASSET_OPTIMIZATION: 'asset_optimization',
  FULL_INTEGRATION: 'modporter_ai_full_integration'
} as const;

/**
 * Feature flag service interface
 */
export interface IFeatureFlagService {
  isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean>;
  evaluate(flagName: string, context?: FeatureFlagContext): Promise<FeatureFlagResult>;
  getFlag(flagName: string): Promise<FeatureFlag | null>;
  setFlag(flagName: string, config: Partial<FeatureFlag>): Promise<void>;
  getAllFlags(): Promise<FeatureFlag[]>;
  deleteFlag(flagName: string): Promise<boolean>;
}

/**
 * In-memory feature flag service implementation
 * In production, this would be backed by a database
 */
export class FeatureFlagService extends EventEmitter implements IFeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private cache: Map<string, { result: FeatureFlagResult; timestamp: number }> = new Map();
  private cacheTimeout: number = 60000; // 1 minute cache

  constructor() {
    super();
    this.initializeDefaultFlags();
  }

  /**
   * Check if a feature flag is enabled for the given context
   * 
   * @param flagName Name of the feature flag
   * @param context Evaluation context
   * @returns True if the feature is enabled
   */
  async isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean> {
    const result = await this.evaluate(flagName, context);
    return result.isEnabled;
  }

  /**
   * Evaluate a feature flag with detailed result
   * 
   * @param flagName Name of the feature flag
   * @param context Evaluation context
   * @returns Detailed evaluation result
   */
  async evaluate(flagName: string, context?: FeatureFlagContext): Promise<FeatureFlagResult> {
    // Check cache first
    const cacheKey = this.getCacheKey(flagName, context);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }

    const flag = this.flags.get(flagName);
    
    if (!flag) {
      const result: FeatureFlagResult = {
        isEnabled: false,
        reason: 'Flag not found'
      };
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }

    // If flag is globally disabled, return false
    if (!flag.isEnabled) {
      const result: FeatureFlagResult = {
        isEnabled: false,
        reason: 'Flag globally disabled'
      };
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }

    // Check user targeting
    if (context?.userId && flag.targetUsers.length > 0) {
      if (flag.targetUsers.includes(context.userId)) {
        const result: FeatureFlagResult = {
          isEnabled: true,
          reason: 'User targeted'
        };
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      } else {
        const result: FeatureFlagResult = {
          isEnabled: false,
          reason: 'User not in target list'
        };
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
    }

    // Check group targeting
    if (context?.userGroups && flag.targetGroups.length > 0) {
      const hasTargetGroup = context.userGroups.some(group => flag.targetGroups.includes(group));
      if (hasTargetGroup) {
        const result: FeatureFlagResult = {
          isEnabled: true,
          reason: 'Group targeted'
        };
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      } else {
        const result: FeatureFlagResult = {
          isEnabled: false,
          reason: 'User groups not in target list'
        };
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
    }

    // Percentage-based rollout
    if (flag.rolloutPercentage > 0) {
      const hash = this.hashString(flagName + (context?.userId || context?.sessionId || 'anonymous'));
      const percentage = (hash % 100) + 1;
      
      if (percentage <= flag.rolloutPercentage) {
        const result: FeatureFlagResult = {
          isEnabled: true,
          reason: `Percentage rollout (${percentage}% <= ${flag.rolloutPercentage}%)`
        };
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
    }

    const result: FeatureFlagResult = {
      isEnabled: false,
      reason: 'Not in rollout percentage'
    };
    this.cache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }

  /**
   * Get a feature flag configuration
   * 
   * @param flagName Name of the feature flag
   * @returns Feature flag configuration or null if not found
   */
  async getFlag(flagName: string): Promise<FeatureFlag | null> {
    return this.flags.get(flagName) || null;
  }

  /**
   * Set or update a feature flag configuration
   * 
   * @param flagName Name of the feature flag
   * @param config Partial configuration to update
   */
  async setFlag(flagName: string, config: Partial<FeatureFlag>): Promise<void> {
    const existingFlag = this.flags.get(flagName);
    const now = new Date();
    
    const flag: FeatureFlag = {
      id: existingFlag?.id || flagName,
      name: flagName,
      description: config.description || existingFlag?.description,
      isEnabled: config.isEnabled ?? existingFlag?.isEnabled ?? false,
      rolloutPercentage: config.rolloutPercentage ?? existingFlag?.rolloutPercentage ?? 0,
      targetUsers: config.targetUsers || existingFlag?.targetUsers || [],
      targetGroups: config.targetGroups || existingFlag?.targetGroups || [],
      metadata: { ...existingFlag?.metadata, ...config.metadata },
      createdBy: config.createdBy || existingFlag?.createdBy,
      createdAt: existingFlag?.createdAt || now,
      updatedAt: now
    };

    this.flags.set(flagName, flag);
    this.clearCache();
    
    this.emit('flag:updated', { flagName, flag });
    logger.info('Feature flag updated', { flagName, isEnabled: flag.isEnabled, rolloutPercentage: flag.rolloutPercentage });
  }

  /**
   * Get all feature flags
   * 
   * @returns Array of all feature flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values());
  }

  /**
   * Delete a feature flag
   * 
   * @param flagName Name of the feature flag to delete
   * @returns True if the flag was deleted, false if it didn't exist
   */
  async deleteFlag(flagName: string): Promise<boolean> {
    const deleted = this.flags.delete(flagName);
    if (deleted) {
      this.clearCache();
      this.emit('flag:deleted', { flagName });
      logger.info('Feature flag deleted', { flagName });
    }
    return deleted;
  }

  /**
   * Initialize default ModPorter-AI feature flags
   */
  private initializeDefaultFlags(): void {
    const defaultFlags = [
      {
        name: MODPORTER_AI_FEATURES.ENHANCED_FILE_PROCESSING,
        description: 'Enable enhanced file processing with security scanning',
        isEnabled: false,
        rolloutPercentage: 0
      },
      {
        name: MODPORTER_AI_FEATURES.MULTI_STRATEGY_ANALYSIS,
        description: 'Enable multi-strategy Java analysis for better registry extraction',
        isEnabled: false,
        rolloutPercentage: 0
      },
      {
        name: MODPORTER_AI_FEATURES.SPECIALIZED_CONVERSION_AGENTS,
        description: 'Enable specialized conversion agents for assets',
        isEnabled: false,
        rolloutPercentage: 0
      },
      {
        name: MODPORTER_AI_FEATURES.COMPREHENSIVE_VALIDATION,
        description: 'Enable comprehensive validation pipeline',
        isEnabled: false,
        rolloutPercentage: 0
      },
      {
        name: MODPORTER_AI_FEATURES.SECURITY_SCANNING,
        description: 'Enable advanced security scanning for uploaded files',
        isEnabled: false,
        rolloutPercentage: 0
      },
      {
        name: MODPORTER_AI_FEATURES.PERFORMANCE_MONITORING,
        description: 'Enable performance monitoring and metrics collection',
        isEnabled: false,
        rolloutPercentage: 0
      },
      {
        name: MODPORTER_AI_FEATURES.ADVANCED_LOGGING,
        description: 'Enable advanced structured logging with security events',
        isEnabled: false,
        rolloutPercentage: 0
      },
      {
        name: MODPORTER_AI_FEATURES.ASSET_OPTIMIZATION,
        description: 'Enable asset optimization during conversion',
        isEnabled: false,
        rolloutPercentage: 0
      },
      {
        name: MODPORTER_AI_FEATURES.FULL_INTEGRATION,
        description: 'Enable full ModPorter-AI integration',
        isEnabled: false,
        rolloutPercentage: 0
      }
    ];

    for (const flagConfig of defaultFlags) {
      this.setFlag(flagConfig.name, flagConfig);
    }

    logger.info('Default ModPorter-AI feature flags initialized', { count: defaultFlags.length });
  }

  /**
   * Generate cache key for flag evaluation
   */
  private getCacheKey(flagName: string, context?: FeatureFlagContext): string {
    const contextKey = context ? JSON.stringify({
      userId: context.userId,
      userGroups: context.userGroups?.sort(),
      sessionId: context.sessionId
    }) : 'anonymous';
    return `${flagName}:${this.hashString(contextKey)}`;
  }

  /**
   * Simple hash function for consistent percentage calculations
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Clear evaluation cache
   */
  private clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.clearCache();
    this.removeAllListeners();
    logger.info('Feature flag service disposed');
  }
}