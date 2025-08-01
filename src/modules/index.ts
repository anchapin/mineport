/**
 * Minecraft Mod Converter Modules
 * 
 * This is the main entry point for all conversion modules in the Minecraft Mod Converter.
 * Each module is responsible for a specific aspect of the conversion process.
 * 
 * Module Architecture:
 * - ingestion: Validates and analyzes input Java mods
 * - assets: Converts textures, models, sounds, and particles
 * - configuration: Converts manifests, recipes, and definitions
 * - logic: Transpiles Java code to JavaScript
 * - compromise: Handles features that cannot be directly converted
 * - packaging: Packages and validates the final addon
 * - ui: Provides the user interface for the conversion process
 * 
 * Public API:
 * Each module exports its components and a default main class for orchestration.
 */

// Export all modules
export * as ingestion from './ingestion';
export * as assets from './assets';
export * as configuration from './configuration';
export * as logic from './logic';
export * as compromise from './compromise';
export * as packaging from './packaging';
export * as ui from './ui';
export * as conversionAgents from './conversion-agents';

// Re-export main module classes for convenience
export { IngestionModule } from './ingestion';
export { AssetTranslationModule } from './assets';
export { ConfigurationModule } from './configuration';
export { LogicTranslationEngine } from './logic';
export { CompromiseStrategyEngine } from './compromise';
export { AddonPackager } from './packaging';
export { AssetConverter, BedrockArchitect, BlockItemGenerator } from './conversion-agents';