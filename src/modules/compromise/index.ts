// Core compromise framework
export { CompromiseStrategy, CompromiseResult, CompromiseOptions, CompromiseStrategyRegistry } from './CompromiseStrategy.js';
export { CompromiseStrategySelector, StrategySelectionResult, SelectionCriteria, DEFAULT_SELECTION_CRITERIA } from './CompromiseStrategySelector.js';
export { CompromiseEngine, CompromiseEngineConfig, CompromiseEngineResult, BatchCompromiseResult, DEFAULT_COMPROMISE_ENGINE_CONFIG } from './CompromiseEngine.js';

// Reporting and documentation
export { CompromiseReporter, CompromiseReport, CompromiseReportConfig, DEFAULT_REPORT_CONFIG } from './CompromiseReporter.js';
export type { CompromiseDetail, FailedFeatureDetail, ManualImplementationStep, AlternativeApproach, ResourceRequirement } from './CompromiseReporter.js';

// Specific compromise strategies
export { DimensionCompromiseStrategy } from './strategies/DimensionCompromiseStrategy.js';
export { RenderingCompromiseStrategy } from './strategies/RenderingCompromiseStrategy.js';
export { UICompromiseStrategy } from './strategies/UICompromiseStrategy.js';

// Re-export types from compromise types
export type { Feature, FeatureType, CompromiseLevel } from '../../types/compromise.js';