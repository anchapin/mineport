# API Documentation

This document provides comprehensive API documentation for the Minecraft Mod Converter, including all public interfaces, classes, and methods available for programmatic use.

## Table of Contents

- [Overview](#overview)
- [Core Services](#core-services)
- [Conversion Modules](#conversion-modules)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [Examples](#examples)

## Overview

The Minecraft Mod Converter provides a comprehensive API for converting Java Edition mods to Bedrock Edition addons. The API is built around a modular architecture with the following key components:

- **ConversionService**: Main orchestrator for conversion operations
- **JobQueue**: Manages conversion job queuing and processing
- **ResourceAllocator**: Handles system resource management
- **Conversion Modules**: Specialized modules for different conversion aspects
- **Configuration System**: Dynamic configuration management

### Installation

```bash
npm install minecraft-mod-converter
```

### Basic Usage

```typescript
import { ConversionService, JobQueue, ResourceAllocator, WorkerPool } from 'minecraft-mod-converter';

// Set up the conversion pipeline
const jobQueue = new JobQueue({ maxConcurrent: 3 });
const workerPool = new WorkerPool({ maxWorkers: 5 });
const resourceAllocator = new ResourceAllocator({ workerPool, jobQueue });

const conversionService = new ConversionService({
  jobQueue,
  resourceAllocator
});

// Start the service and convert a mod
conversionService.start();
const job = conversionService.createConversionJob({
  modFile: './my-mod.jar',
  outputPath: './converted-addon',
  options: { targetMinecraftVersion: '1.20.0' }
});
```

## Core Services

### ConversionService

The main service for managing mod conversion operations.

```typescript
import { ConversionService } from 'minecraft-mod-converter';
```

#### Constructor

```typescript
constructor(options: ConversionServiceOptions)
```

**Parameters:**
- `options.jobQueue` - JobQueue instance for managing conversion jobs
- `options.resourceAllocator?` - Optional ResourceAllocator for resource management
- `options.errorCollector?` - Optional ErrorCollector for error tracking
- `options.configService?` - Optional ConfigurationService for dynamic configuration
- `options.statusUpdateInterval?` - Status update interval in milliseconds (default: 2000)

#### Methods

##### createConversionJob()

Creates a new conversion job and queues it for processing.

```typescript
createConversionJob(input: ConversionInput): ConversionJob
```

**Parameters:**
- `input.modFile` - Path to the mod JAR file
- `input.outputPath` - Output directory for the converted addon
- `input.options` - Conversion options

**Returns:** `ConversionJob` - Created job with ID and initial status

**Example:**
```typescript
const job = conversionService.createConversionJob({
  modFile: './my-mod.jar',
  outputPath: './converted-addon',
  options: {
    targetMinecraftVersion: '1.20.0',
    compromiseStrategy: 'balanced',
    includeDocumentation: true,
    optimizeAssets: true
  }
});
```

**Advanced Example with Full Options:**
```typescript
const job = conversionService.createConversionJob({
  modFile: './complex-mod.jar',
  outputPath: './converted-addon',
  options: {
    targetMinecraftVersion: '1.20.0',
    compromiseStrategy: 'aggressive',
    includeDocumentation: true,
    optimizeAssets: true,
    generateSourceMaps: true,
    customApiMappings: './custom-mappings.json',
    validateOutput: true,
    maxTextureSize: 1024,
    compressionQuality: 85,
    enableLLMTranslation: true,
    parallelProcessing: true,
    streamingMode: false,
    includeDebugInfo: true
  }
});

// Monitor job progress
conversionService.on('job:status', (status) => {
  if (status.jobId === job.id) {
    console.log(`Progress: ${status.progress}% - ${status.currentStage}`);
    if (status.estimatedTimeRemaining) {
      console.log(`ETA: ${Math.round(status.estimatedTimeRemaining / 1000)}s`);
    }
  }
});

// Handle completion
conversionService.on('job:completed', (data) => {
  if (data.jobId === job.id) {
    console.log('Conversion completed successfully!');
    const result = conversionService.getJobResult(job.id);
    console.log(`Files processed: ${result.stats.filesProcessed}`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Output size: ${result.stats.outputSize} bytes`);
  }
});
```

##### getJobStatus()

Retrieves the current status of a conversion job.

```typescript
getJobStatus(jobId: string): ConversionStatus | undefined
```

**Parameters:**
- `jobId` - Unique job identifier

**Returns:** `ConversionStatus` or `undefined` if job not found

**Example:**
```typescript
const status = conversionService.getJobStatus(job.id);
console.log(`Progress: ${status.progress}%, Stage: ${status.currentStage}`);
```

##### getJobs()

Retrieves all conversion jobs with optional filtering.

```typescript
getJobs(filter?: { status?: JobStatus }): ConversionJob[]
```

**Parameters:**
- `filter.status?` - Optional status filter ('queued', 'processing', 'completed', 'failed')

**Returns:** Array of `ConversionJob` objects

##### cancelJob()

Cancels a running or queued conversion job.

```typescript
cancelJob(jobId: string): boolean
```

**Parameters:**
- `jobId` - Job ID to cancel

**Returns:** `true` if job was cancelled, `false` otherwise

##### updateJobPriority()

Updates the priority of a queued job.

```typescript
updateJobPriority(jobId: string, priority: number): boolean
```

**Parameters:**
- `jobId` - Job ID to update
- `priority` - New priority (1-10, higher = more priority)

**Returns:** `true` if priority was updated, `false` otherwise

##### getJobResult()

Retrieves the result of a completed conversion job.

```typescript
getJobResult(jobId: string): ConversionResult | undefined
```

**Parameters:**
- `jobId` - Job ID

**Returns:** `ConversionResult` or `undefined` if job not completed

#### Events

The ConversionService extends EventEmitter and emits the following events:

- `job:created` - Emitted when a new job is created
- `job:status` - Emitted when job status updates
- `job:completed` - Emitted when a job completes successfully
- `job:failed` - Emitted when a job fails
- `job:cancelled` - Emitted when a job is cancelled

**Example:**
```typescript
conversionService.on('job:completed', (data) => {
  console.log(`Job ${data.jobId} completed successfully`);
  console.log('Result:', data.result);
});
```

### JobQueue

Manages the queue of conversion jobs with priority and concurrency control.

```typescript
import { JobQueue } from 'minecraft-mod-converter';
```

#### Constructor

```typescript
constructor(options: JobQueueOptions)
```

**Parameters:**
- `options.maxConcurrent` - Maximum number of concurrent jobs (default: 3)
- `options.retryAttempts?` - Number of retry attempts for failed jobs (default: 3)
- `options.retryDelay?` - Delay between retries in milliseconds (default: 5000)

#### Methods

##### addJob()

Adds a new job to the queue.

```typescript
addJob(type: string, data: any, options?: JobOptions): string
```

**Parameters:**
- `type` - Job type identifier
- `data` - Job data payload
- `options.priority?` - Job priority (1-10)
- `options.delay?` - Delay before processing in milliseconds

**Returns:** Job ID string

##### getJob()

Retrieves a job by ID.

```typescript
getJob(jobId: string): Job | undefined
```

##### getJobs()

Retrieves jobs with optional filtering.

```typescript
getJobs(filter?: JobFilter): Job[]
```

**Parameters:**
- `filter.type?` - Filter by job type
- `filter.status?` - Filter by job status
- `filter.priority?` - Filter by priority level

### ResourceAllocator

Manages system resources for conversion operations.

```typescript
import { ResourceAllocator } from 'minecraft-mod-converter';
```

#### Constructor

```typescript
constructor(options: ResourceAllocatorOptions)
```

**Parameters:**
- `options.workerPool` - WorkerPool instance
- `options.jobQueue` - JobQueue instance
- `options.minWorkers` - Minimum number of workers
- `options.maxWorkers` - Maximum number of workers

#### Methods

##### allocateWorker()

Allocates a worker for a job.

```typescript
allocateWorker(jobId: string): Promise<Worker | null>
```

##### releaseWorker()

Releases a worker back to the pool.

```typescript
releaseWorker(workerId: string): void
```

##### getResourceUsage()

Gets current resource usage statistics.

```typescript
getResourceUsage(): ResourceUsage
```

**Returns:**
```typescript
interface ResourceUsage {
  activeWorkers: number;
  availableWorkers: number;
  memoryUsage: number;
  cpuUsage: number;
}
```

## Conversion Modules

### AssetTranslationModule

Handles conversion of game assets (textures, models, sounds, particles).

```typescript
import { AssetTranslationModule } from 'minecraft-mod-converter';
```

#### Methods

##### translateAssets()

Converts Java mod assets to Bedrock format.

```typescript
translateAssets(javaAssets: JavaAssetCollection): Promise<AssetTranslationResult>
```

**Parameters:**
- `javaAssets` - Collection of Java mod assets

**Returns:** Promise resolving to `AssetTranslationResult`

**Example:**
```typescript
const assetModule = new AssetTranslationModule();
const result = await assetModule.translateAssets({
  textures: javaTextures,
  models: javaModels,
  sounds: javaSounds,
  particles: javaParticles
});

console.log(`Converted ${result.bedrockAssets.textures.length} textures`);
```

##### optimizeTextures()

Optimizes textures for better performance.

```typescript
optimizeTextures(textures: TextureAsset[]): Promise<OptimizedTextures>
```

##### generateAtlas()

Generates texture atlases from individual textures.

```typescript
generateAtlas(textures: TextureAsset[]): Promise<TextureAtlas>
```

### LogicTranslationEngine

Handles conversion of Java code to JavaScript for Bedrock addons.

```typescript
import { LogicTranslationEngine } from 'minecraft-mod-converter';
```

#### Methods

##### translateLogic()

Converts Java mod logic to JavaScript.

```typescript
translateLogic(javaCode: JavaCodeCollection): Promise<LogicTranslationResult>
```

**Parameters:**
- `javaCode` - Collection of Java source files

**Returns:** Promise resolving to `LogicTranslationResult`

**Example:**
```typescript
const logicEngine = new LogicTranslationEngine();
const result = await logicEngine.translateLogic({
  sourceFiles: javaSourceFiles,
  dependencies: modDependencies,
  apiMappings: customApiMappings
});

console.log(`Generated ${result.javascriptFiles.length} JavaScript files`);
```

##### parseJavaCode()

Parses Java source code into AST.

```typescript
parseJavaCode(sourceCode: string): Promise<JavaAST>
```

##### generateJavaScript()

Generates JavaScript from transpiled AST.

```typescript
generateJavaScript(ast: TranspiledAST): Promise<string>
```

### CompromiseStrategyEngine

Handles incompatible features with intelligent compromise strategies.

```typescript
import { CompromiseStrategyEngine } from 'minecraft-mod-converter';
```

#### Methods

##### applyStrategy()

Applies a compromise strategy to an incompatible feature.

```typescript
applyStrategy(feature: IncompatibleFeature, strategy: CompromiseStrategy): Promise<CompromiseResult>
```

**Parameters:**
- `feature` - Feature that cannot be directly converted
- `strategy` - Strategy to apply for handling the feature

**Returns:** Promise resolving to `CompromiseResult`

##### getAvailableStrategies()

Gets available strategies for a feature type.

```typescript
getAvailableStrategies(featureType: string): CompromiseStrategy[]
```

##### registerStrategy()

Registers a custom compromise strategy.

```typescript
registerStrategy(strategy: CompromiseStrategy): void
```

## Type Definitions

### Core Types

#### ConversionInput

```typescript
interface ConversionInput {
  modFile: string;           // Path to mod JAR file
  outputPath: string;        // Output directory
  options: ConversionOptions;
}
```

#### ConversionOptions

```typescript
interface ConversionOptions {
  targetMinecraftVersion?: string;     // Target Minecraft version
  compromiseStrategy?: 'conservative' | 'balanced' | 'aggressive';
  includeDocumentation?: boolean;      // Include conversion documentation
  optimizeAssets?: boolean;           // Optimize assets for performance
  generateSourceMaps?: boolean;       // Generate source maps for debugging
  customApiMappings?: string;         // Path to custom API mappings
  validateOutput?: boolean;           // Validate generated addon
}
```

#### ConversionJob

```typescript
interface ConversionJob {
  id: string;                    // Unique job identifier
  input: ConversionInput;        // Original input parameters
  status: JobStatus;             // Current job status
  progress: number;              // Progress percentage (0-100)
  result?: ConversionResult;     // Result (if completed)
  error?: string;               // Error message (if failed)
  createdAt: Date;              // Creation timestamp
  updatedAt: Date;              // Last update timestamp
  completedAt?: Date;           // Completion timestamp
}
```

#### ConversionResult

```typescript
interface ConversionResult {
  success: boolean;              // Whether conversion succeeded
  bedrockAddon: BedrockAddon;   // Generated Bedrock addon
  report: ConversionReport;      // Detailed conversion report
  warnings: ConversionWarning[]; // Non-fatal warnings
  errors: ConversionError[];     // Fatal errors
  stats: ConversionStats;        // Conversion statistics
}
```

#### ConversionStatus

```typescript
interface ConversionStatus {
  jobId: string;                 // Job identifier
  status: JobStatus;             // Current status
  progress: number;              // Progress percentage
  currentStage: string;          // Current processing stage
  estimatedTimeRemaining?: number; // ETA in milliseconds
  lastUpdate?: Date;            // Last status update
}
```

### Asset Types

#### JavaAssetCollection

```typescript
interface JavaAssetCollection {
  textures: JavaTexture[];       // Texture files
  models: JavaModel[];           // Model files
  sounds: JavaSound[];           // Sound files
  particles: JavaParticle[];     // Particle definitions
  animations: JavaAnimation[];   // Animation files
}
```

#### AssetTranslationResult

```typescript
interface AssetTranslationResult {
  bedrockAssets: BedrockAssetCollection;
  conversionNotes: AssetConversionNote[];
  optimizations: AssetOptimization[];
  errors: AssetConversionError[];
}
```

### Logic Types

#### JavaCodeCollection

```typescript
interface JavaCodeCollection {
  sourceFiles: JavaSourceFile[];    // Java source files
  dependencies: ModDependency[];     // Mod dependencies
  apiMappings: APIMapping[];         // API mapping definitions
  configuration: ModConfiguration;   // Mod configuration
}
```

#### LogicTranslationResult

```typescript
interface LogicTranslationResult {
  javascriptFiles: JavaScriptFile[];     // Generated JavaScript
  behaviorPack: BehaviorPackManifest;    // Behavior pack manifest
  apiUsage: APIUsageReport;              // API usage statistics
  compromises: CompromiseApplication[];   // Applied compromises
  errors: LogicTranslationError[];       // Translation errors
}
```

## Error Handling

### Error Types

The API uses a structured error system with the following error types:

#### ConversionError

```typescript
interface ConversionError {
  id: string;                    // Unique error identifier
  type: ErrorType;               // Error category
  severity: ErrorSeverity;       // Error severity level
  message: string;               // Human-readable message
  moduleOrigin: string;          // Module that generated the error
  timestamp: Date;               // When the error occurred
  context?: Record<string, any>; // Additional context
  stack?: string;               // Stack trace (if available)
}
```

#### ErrorType

```typescript
type ErrorType =
  | 'validation'     // Input validation errors
  | 'parsing'        // Code parsing errors
  | 'translation'    // Translation/conversion errors
  | 'asset'          // Asset processing errors
  | 'config'         // Configuration errors
  | 'system'         // System/infrastructure errors
  | 'network'        // Network-related errors
  | 'security';      // Security-related errors
```

#### ErrorSeverity

```typescript
type ErrorSeverity =
  | 'info'           // Informational messages
  | 'warning'        // Non-fatal warnings
  | 'error'          // Recoverable errors
  | 'critical';      // Fatal errors that stop processing
```

### Error Handling Patterns

#### Try-Catch with Structured Errors

```typescript
try {
  const result = await conversionService.createConversionJob(input);
  return result;
} catch (error) {
  if (error instanceof ConversionError) {
    console.error(`Conversion failed: ${error.message}`);
    console.error(`Module: ${error.moduleOrigin}, Type: ${error.type}`);
  } else {
    console.error('Unexpected error:', error);
  }
  throw error;
}
```

#### Error Collection

```typescript
const errorCollector = new ErrorCollector();

// Errors are automatically collected during processing
const result = await conversionService.createConversionJob(input);

// Retrieve collected errors
const errors = errorCollector.getErrors();
const warnings = errorCollector.getWarnings();

console.log(`Processing completed with ${errors.length} errors and ${warnings.length} warnings`);
```

## Configuration

### ConfigurationService

Manages dynamic configuration for the conversion system.

```typescript
import { ConfigurationService } from 'minecraft-mod-converter';
```

#### Methods

##### get()

Retrieves a configuration value.

```typescript
get<T>(key: string, defaultValue?: T): T
```

**Example:**
```typescript
const maxConcurrency = configService.get('conversion.maxConcurrency', 4);
const strategy = configService.get('conversion.defaultStrategy', 'balanced');
```

##### set()

Sets a configuration value.

```typescript
set(key: string, value: any): void
```

##### loadConfiguration()

Loads configuration from a file or object.

```typescript
loadConfiguration(config: ConfigurationData): Promise<void>
```

#### Configuration Schema

```typescript
interface ConversionConfig {
  conversion: {
    maxConcurrency: number;           // Max concurrent jobs
    defaultStrategy: CompromiseStrategy; // Default compromise strategy
    statusUpdateInterval: number;     // Status update frequency
    timeout: number;                  // Job timeout in milliseconds
  };

  assets: {
    optimizeTextures: boolean;        // Enable texture optimization
    generateAtlas: boolean;           // Generate texture atlases
    maxTextureSize: number;          // Maximum texture dimensions
    compressionQuality: number;       // Compression quality (0-100)
  };

  logic: {
    enableLLMTranslation: boolean;    // Use LLM for complex translations
    apiMappingSource: string;         // API mapping data source
    generateSourceMaps: boolean;      // Generate source maps
    validateOutput: boolean;          // Validate generated code
  };

  output: {
    includeDocumentation: boolean;    // Include conversion docs
    generateReport: boolean;          // Generate conversion report
    packageFormat: 'mcaddon' | 'zip'; // Output package format
    validateAddon: boolean;           // Validate final addon
  };
}
```

## Examples

### Basic Conversion

```typescript
import { ConversionService, JobQueue, ResourceAllocator, WorkerPool } from 'minecraft-mod-converter';

// Set up dependencies
const jobQueue = new JobQueue({ maxConcurrent: 3 });
const workerPool = new WorkerPool({ maxWorkers: 5 });
const resourceAllocator = new ResourceAllocator({
  workerPool,
  jobQueue,
  minWorkers: 1,
  maxWorkers: 5
});

// Create conversion service
const conversionService = new ConversionService({
  jobQueue,
  resourceAllocator,
  statusUpdateInterval: 1000
});

// Start the service
conversionService.start();

// Create a conversion job
const job = conversionService.createConversionJob({
  modFile: './mods/example-mod.jar',
  outputPath: './output/example-addon',
  options: {
    targetMinecraftVersion: '1.20.0',
    compromiseStrategy: 'balanced',
    includeDocumentation: true,
    optimizeAssets: true
  }
});

console.log(`Created job: ${job.id}`);

// Monitor progress
conversionService.on('job:status', (status) => {
  console.log(`Job ${status.jobId}: ${status.progress}% - ${status.currentStage}`);
});

// Handle completion
conversionService.on('job:completed', (data) => {
  console.log(`Job ${data.jobId} completed successfully!`);
  const result = conversionService.getJobResult(data.jobId);
  console.log(`Converted ${result.stats.filesProcessed} files`);
});
```

### Custom Module Usage

```typescript
import { AssetTranslationModule, LogicTranslationEngine } from 'minecraft-mod-converter';

// Create custom asset translator
const assetTranslator = new AssetTranslationModule({
  optimizeTextures: true,
  generateAtlas: true,
  maxTextureSize: 1024
});

// Create logic translator
const logicTranslator = new LogicTranslationEngine({
  enableLLMTranslation: true,
  generateSourceMaps: true
});

// Process assets
const assetResult = await assetTranslator.translateAssets(javaAssets);
console.log(`Converted ${assetResult.bedrockAssets.textures.length} textures`);

// Process logic
const logicResult = await logicTranslator.translateLogic(javaCode);
console.log(`Generated ${logicResult.javascriptFiles.length} JavaScript files`);
```

### Error Handling Example

```typescript
import { ConversionService, ConversionError, ErrorCollector } from 'minecraft-mod-converter';

const errorCollector = new ErrorCollector();
const conversionService = new ConversionService({
  jobQueue,
  errorCollector
});

try {
  const job = conversionService.createConversionJob(input);

  // Wait for completion
  await new Promise((resolve, reject) => {
    conversionService.on('job:completed', resolve);
    conversionService.on('job:failed', reject);
  });

  // Check for warnings and errors
  const errors = errorCollector.getErrors();
  const warnings = errorCollector.getWarnings();

  if (errors.length > 0) {
    console.log('Errors encountered:');
    errors.forEach(error => {
      console.log(`- ${error.severity}: ${error.message} (${error.moduleOrigin})`);
    });
  }

  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach(warning => {
      console.log(`- ${warning.message}`);
    });
  }

} catch (error) {
  if (error instanceof ConversionError) {
    console.error(`Conversion failed: ${error.message}`);
    console.error(`Error type: ${error.type}, Severity: ${error.severity}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Batch Processing

```typescript
import { ConversionService } from 'minecraft-mod-converter';
import { glob } from 'glob';

const conversionService = new ConversionService(serviceOptions);
conversionService.start();

// Find all mod files
const modFiles = await glob('./mods/*.jar');

// Process all mods
const jobs = modFiles.map(modFile => {
  return conversionService.createConversionJob({
    modFile,
    outputPath: `./output/${path.basename(modFile, '.jar')}-addon`,
    options: {
      targetMinecraftVersion: '1.20.0',
      compromiseStrategy: 'balanced'
    }
  });
});

console.log(`Started ${jobs.length} conversion jobs`);

// Wait for all jobs to complete
const results = await Promise.allSettled(
  jobs.map(job => new Promise((resolve, reject) => {
    const checkStatus = () => {
      const status = conversionService.getJobStatus(job.id);
      if (status?.status === 'completed') {
        resolve(conversionService.getJobResult(job.id));
      } else if (status?.status === 'failed') {
        reject(new Error(`Job ${job.id} failed`));
      } else {
        setTimeout(checkStatus, 1000);
      }
    };
    checkStatus();
  }))
);

// Report results
const successful = results.filter(r => r.status === 'fulfilled').length;
const failed = results.filter(r => r.status === 'rejected').length;

console.log(`Batch processing complete: ${successful} successful, ${failed} failed`);
```

This API documentation provides comprehensive coverage of all public interfaces and usage patterns. For additional examples and advanced usage, see the [examples directory](../examples/) and [EXAMPLES.md](EXAMPLES.md).
