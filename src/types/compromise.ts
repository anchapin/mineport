/**
 * Represents a feature in a Minecraft Java mod that may need a compromise strategy.
 */
export interface Feature {
  id: string;
  name: string;
  description: string;
  type: string;
  compatibilityTier: 1 | 2 | 3 | 4;
  sourceFiles: string[];
  sourceLineNumbers: number[][];
}

/**
 * Types of features that may require compromise strategies.
 */
export type FeatureType =
  | 'dimension'
  | 'rendering'
  | 'ui'
  | 'entity'
  | 'block'
  | 'item'
  | 'world'
  | 'other';

/**
 * Compromise levels indicating the severity of the compromise needed.
 */
export enum CompromiseLevel {
  NONE = 0,
  MINOR = 1,
  MODERATE = 2,
  MAJOR = 3,
  SEVERE = 4,
}

/**
 * Represents a strategy for compromising on features that cannot be directly translated.
 */
export interface CompromiseStrategy {
  id: string;
  name: string;
  description: string;
  applicabilityCheck: (feature: Feature) => boolean;
  apply: (feature: Feature) => CompromiseStrategyResult;
}

/**
 * Result of applying a compromise strategy to a feature.
 */
export interface CompromiseStrategyResult {
  type: 'simulation' | 'stubbing' | 'approximation';
  name: string;
  description: string;
  implementationDetails: string;
  limitations: string[];
}

/**
 * Configuration for a compromise strategy.
 */
export interface CompromiseStrategyConfig {
  enabled: boolean;
  priority: number;
  customParameters?: Record<string, any>;
}

/**
 * Report of applied compromise strategies.
 */
export interface CompromiseReport {
  totalCompromisesApplied: number;
  appliedStrategies: AppliedCompromiseStrategy[];
}

/**
 * Information about a compromise strategy that was applied to a feature.
 */
export interface AppliedCompromiseStrategy {
  featureId: string;
  strategyId: string;
  strategyName: string;
  strategyDescription: string;
}
