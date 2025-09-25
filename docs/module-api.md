# Module Public API Documentation

This document describes the public API for each module in the Minecraft Mod Converter.

## Module Structure

Each module follows a consistent structure:
- `index.ts` - Main entry point with documentation and exports
- Individual component files - Specific functionality implementations
- Default export - Main orchestrator class for the module

## Ingestion Module (`src/modules/ingestion`)

**Purpose**: Validates and analyzes input Java mods

**Main Class**: `IngestionModule`

**Public Components**:
- `ModValidator` - Validates mod file structure and content
- `SourceCodeFetcher` - Fetches source code from repositories
- `ModLoaderDetector` - Detects mod loader type (Forge/Fabric)
- `LicenseParser` - Parses license information
- `FeatureCompatibilityAnalyzer` - Analyzes feature compatibility

**Key Interfaces**:
- `ModInput` - Input structure for mod processing
- `AnalysisResult` - Complete analysis output
- `FeatureCompatibilityReport` - Feature compatibility analysis

## Assets Module (`src/modules/assets`)

**Purpose**: Converts textures, models, sounds, and particles

**Main Class**: `AssetTranslationModule`

**Public Components**:
- `TextureConverter` - Converts Java mod textures to Bedrock format
- `ModelConverter` - Converts Java mod models to Bedrock format
- `SoundProcessor` - Processes and converts sound files
- `ParticleMapper` - Maps Java particle effects to Bedrock equivalents

## Configuration Module (`src/modules/configuration`)

**Purpose**: Converts manifests, recipes, and definitions

**Main Class**: `ConfigurationModule`

**Public Components**:
- `ManifestGenerator` - Generates Bedrock addon manifests
- `BlockItemDefinitionConverter` - Converts block/item definitions
- `RecipeConverter` - Converts crafting recipes
- `LootTableConverter` - Converts loot tables
- `LicenseEmbedder` - Embeds license information

**Key Interfaces**:
- `ConfigMappingInput` - Input structure for configuration mapping
- `ConfigMappingOutput` - Complete configuration output

## Logic Module (`src/modules/logic`)

**Purpose**: Transpiles Java code to JavaScript

**Main Class**: `LogicTranslationEngine`

**Public Components**:
- `JavaParser` - Parses Java source code into AST
- `MMIRGenerator` - Generates Minecraft Mod Intermediate Representation
- `ASTTranspiler` - Transpiles Java AST to JavaScript AST
- `APIMapping` - Maps Java APIs to Bedrock equivalents
- `LLMTranslationService` - Uses LLM for complex code translation
- `ProgramStateAlignmentValidator` - Validates program state consistency
- `JavaScriptGenerator` - Generates final JavaScript code

## Compromise Module (`src/modules/compromise`)

**Purpose**: Handles features that cannot be directly converted

**Main Class**: `CompromiseStrategyEngine`

**Public Components**:
- `DimensionSimulator` - Simulates Java dimension features in Bedrock
- `RenderingStubGenerator` - Generates stubs for unsupported rendering features
- `UIFlowMapper` - Maps Java UI flows to Bedrock equivalents
- `WarningLogger` - Logs warnings and compromise decisions

## Packaging Module (`src/modules/packaging`)

**Purpose**: Packages and validates the final addon

**Main Class**: `AddonPackager`

**Public Components**:
- `AddonValidator` - Validates the generated addon for correctness
- `ConversionReportGenerator` - Generates detailed conversion reports
- `ManualPostProcessingGuide` - Provides guidance for manual post-processing steps

## UI Module (`src/modules/ui`)

**Purpose**: Provides the React-based user interface

**Submodules**:
- `components` - React components for UI elements
- `pages` - Main application pages
- `hooks` - Custom React hooks for state management
- `services` - Frontend services for API communication
- `types` - TypeScript type definitions for UI
- `context` - React context providers for global state

## Usage Examples

### Basic Module Usage

```typescript
import { IngestionModule } from '@/modules/ingestion';
import { AssetTranslationModule } from '@/modules/assets';

// Initialize modules
const ingestion = new IngestionModule();
const assets = new AssetTranslationModule();

// Process a mod
const analysisResult = await ingestion.processModInput({
  jarFile: modBuffer,
  sourceCodeRepo: 'https://github.com/example/mod'
});

// Convert assets
const assetResult = await assets.translateAssets(analysisResult);
```

### Importing Specific Components

```typescript
import { ModValidator, FeatureCompatibilityAnalyzer } from '@/modules/ingestion';
import { TextureConverter, ModelConverter } from '@/modules/assets';

// Use individual components
const validator = new ModValidator();
const textureConverter = new TextureConverter();
```

### Namespace Imports

```typescript
import * as ingestion from '@/modules/ingestion';
import * as assets from '@/modules/assets';

// Access components through namespace
const validator = new ingestion.ModValidator();
const converter = new assets.TextureConverter();
```
