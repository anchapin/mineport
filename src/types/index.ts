/**
 * Central export point for all type definitions
 *
 * This file exports all types from the various type definition files
 * to provide a single import point for consumers.
 */

// Base types (includes primary SourceLocation definition)
export * from './base.js';

// Error types
export * from './errors.js';

// Module types (excludes SourceLocation to avoid conflicts)
export {
  Module,
  ModuleState,
  ModuleHealth,
  DependencyContainer,
  ModuleConfig,
  ModuleRegistry,
  ModuleConstructor,
  BaseModule,
  LogicTranslationInput,
  LogicTranslationOutput,
  JavaScriptFile,
  StubFunction,
  MMIRContext,
  MMIRNode,
  MMIRRelationship,
  MMIRMetadata,
  ModuleLogicConversionNote,
  LogicFeature,
  JavaAssetCollection,
  BedrockAssetCollection,
  AssetTranslationResult,
  JavaParticleFile,
  JavaAnimationFile,
  ConversionContext,
  ModuleConversionOptions,
} from './modules.js';

// Asset types (selective exports to avoid BedrockParticleFile conflicts)
export {
  JavaTextureFile,
  JavaModelFile,
  JavaSoundFile,
  JavaParticleDefinition,
  BedrockTextureFile,
  BedrockModelFile,
  BedrockSoundFile,
  BedrockAnimationFile,
  TextureConversionResult,
  ModelConversionResult,
  SoundConversionResult,
  ParticleConversionResult,
  BedrockParticleDefinition,
} from './assets.js';

// Export BedrockParticleFile with alias to avoid conflicts
export { BedrockParticleFile as BedrockParticleAsset } from './assets.js';

// API types
export * from './api.js';

// Configuration types
export * from './config.js';

// Service types (selective exports to avoid conflicts)
export {
  ConversionJob,
  ConversionInput,
  ConversionOptions,
  ConversionStatus,
  ConversionResult,
  ConversionOrchestrator,
  ConversionService,
} from './services.js';

// Compromise types
export * from './compromise.js';

// File processing types (selective exports to avoid ValidationResult conflict)
export {
  FileValidationOptions,
  ValidationError as FileValidationError,
  ValidationWarning,
  FileMetadata,
  SecurityScanResult,
  ThreatInfo,
  ThreatDetails,
  SecurityScanOptions,
  TempFileInfo,
} from './file-processing.js';

// Export ValidationResult with alias to avoid conflict
export { ValidationResult as FileValidationResult } from './file-processing.js';

// Logic translation types (selective exports to avoid conflicts)
export {
  MMIRRepresentation,
  ASTNode,
  SourcePosition,
  NodeMetadata,
  CodeMetadata,
  ComplexityMetrics,
  Dependency,
  ImportDeclaration,
  ClassDeclaration,
  MethodDeclaration,
  FieldDeclaration,
  Parameter,
  TranslationContext,
  ModInfo,
  LogicAPIMapping,
  JavaAPISignature,
  BedrockAPISignature,
  MappingType,
  MappingExample,
  LogicCompromiseStrategy,
  CompromiseType,
  UserPreferences,
  TranslationResult,
  TranslationMetadata,
  CompromiseResult,
  UnmappableFeature,
  FeatureContext,
  UserImpactAssessment,
  TranslationWarning,
  TranslationError,
  ASTTranspilationResult,
  UnmappableCodeSegment,
  LLMTranslationResult,
  LogicValidationResult,
  FunctionalDifference,
  RefinementIteration,
  CodeChange,
} from './logic-translation.js';

// Job types
export * from './job.js';
