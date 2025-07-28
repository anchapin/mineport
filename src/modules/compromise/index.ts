/**
 * Smart Compromise Framework Module
 * 
 * This module implements intelligent compromise strategies for handling features
 * that cannot be directly translated from Java mods to Bedrock addons.
 * It provides simulation, stubbing, and approximation strategies.
 * 
 * Public API:
 * - CompromiseStrategyEngine: Main engine for selecting and applying compromise strategies
 * - DimensionSimulator: Simulates Java dimension features in Bedrock
 * - RenderingStubGenerator: Generates stubs for unsupported rendering features
 * - UIFlowMapper: Maps Java UI flows to Bedrock equivalents
 * - WarningLogger: Logs warnings and compromise decisions
 */

// Export all individual components
export * from './CompromiseStrategyEngine';
export * from './DimensionSimulator';
export * from './RenderingStubGenerator';
export * from './UIFlowMapper';
export * from './WarningLogger';

// Re-export the main engine as default for convenience
export { CompromiseStrategyEngine as default } from './CompromiseStrategyEngine';