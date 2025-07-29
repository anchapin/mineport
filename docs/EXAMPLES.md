# Usage Examples and Tutorials

This comprehensive guide provides practical examples and step-by-step tutorials for using the Minecraft Mod Converter in various scenarios, from simple conversions to complex enterprise integrations.

## Table of Contents

- [Getting Started](#getting-started)
- [Quick Start Examples](#quick-start-examples)
- [Command Line Usage](#command-line-usage)
- [Programmatic API Usage](#programmatic-api-usage)
- [Advanced Configuration](#advanced-configuration)
- [Custom Module Development](#custom-module-development)
- [Batch Processing](#batch-processing)
- [Integration Examples](#integration-examples)
- [Real-World Use Cases](#real-world-use-cases)
- [Best Practices](#best-practices)

## Getting Started

### Prerequisites

Before starting, ensure you have:

- Node.js 18.x or 20.x installed
- At least 4GB of available RAM
- Java 11+ (for mod analysis)
- A Minecraft Java Edition mod file (.jar)

### Installation Verification

```bash
# Install the converter
npm install -g minecraft-mod-converter

# Verify installation
minecraft-mod-converter --version
minecraft-mod-converter --help

# Test with a sample mod
minecraft-mod-converter validate ./sample-mod.jar
```

## Quick Start Examples

### Basic Conversion (CLI)

Convert a single mod using the command line interface:

```bash
# Simple conversion
minecraft-mod-converter convert ./mods/example-mod.jar --output ./converted/

# With specific options
minecraft-mod-converter convert ./mods/jei-1.19.2.jar \
  --output ./converted/jei-addon \
  --target-version 1.20.0 \
  --compromise-strategy balanced \
  --optimize-assets \
  --generate-report
```

### Basic Conversion (Programmatic)

Convert a mod using the JavaScript API:

```javascript
import { ConversionService, JobQueue, ResourceAllocator, WorkerPool } from 'minecraft-mod-converter';

// Set up the conversion service
const jobQueue = new JobQueue({ maxConcurrent: 3 });
const workerPool = new WorkerPool({ maxWorkers: 5 });
const resourceAllocator = new ResourceAllocator({ workerPool, jobQueue });

const conversionService = new ConversionService({
  jobQueue,
  resourceAllocator
});

// Start the service
conversionService.start();

// Convert a mod
const job = conversionService.createConversionJob({
  modFile: './mods/example-mod.jar',
  outputPath: './converted/example-addon',
  options: {
    targetMinecraftVersion: '1.20.0',
    compromiseStrategy: 'balanced',
    includeDocumentation: true
  }
});

console.log(`Conversion job created: ${job.id}`);
```

### Web Interface Usage

Using the web interface for conversion:

```bash
# Start the web server
npm start

# Open browser to http://localhost:3000
# 1. Upload your mod JAR file
# 2. Configure conversion options
# 3. Start conversion
# 4. Download the generated addon
```

## Command Line Usage

### Installation and Setup

```bash
# Global installation
npm install -g minecraft-mod-converter

# Verify installation
minecraft-mod-converter --version

# Get help
minecraft-mod-converter --help
minecraft-mod-converter convert --help
```

### Basic Commands

```bash
# Convert with default settings
minecraft-mod-converter convert input.jar

# Specify output directory
minecraft-mod-converter convert input.jar --output ./my-addon/

# Set target Minecraft version
minecraft-mod-converter convert input.jar --target-version 1.20.0

# Use different compromise strategy
minecraft-mod-converter convert input.jar --compromise-strategy aggressive
```

### Advanced Command Options

```bash
# Full feature conversion
minecraft-mod-converter convert ./mods/complex-mod.jar \
  --output ./converted/complex-addon \
  --target-version 1.20.0 \
  --compromise-strategy balanced \
  --optimize-assets \
  --generate-atlas \
  --include-source-maps \
  --validate-output \
  --generate-report \
  --custom-mappings ./my-mappings.json \
  --max-texture-size 1024 \
  --compression-quality 85 \
  --parallel-processing \
  --memory-limit 4096

# Batch conversion
minecraft-mod-converter batch ./mods/ \
  --output ./converted/ \
  --pattern "*.jar" \
  --concurrent 3 \
  --target-version 1.20.0

# Validation only
minecraft-mod-converter validate ./mods/suspicious-mod.jar

# List supported features
minecraft-mod-converter features --mod ./mods/example-mod.jar
```

### Configuration File Usage

Create a `converter.config.json` file:

```json
{
  "targetVersion": "1.20.0",
  "compromiseStrategy": "balanced",
  "optimization": {
    "textures": true,
    "sounds": true,
    "models": false,
    "maxTextureSize": 1024,
    "compressionQuality": 85
  },
  "features": {
    "includeSourceMaps": true,
    "generateReport": true,
    "validateOutput": true,
    "parallelProcessing": true
  },
  "apiMappings": {
    "customMappingsPath": "./custom-mappings.json",
    "updateMappings": true
  },
  "output": {
    "packageFormat": "mcaddon",
    "includeDocumentation": true,
    "generateManifest": true
  }
}
```

Use the configuration file:

```bash
minecraft-mod-converter convert input.jar --config converter.config.json
```

### Environment Variables

Set up environment variables for consistent configuration:

```bash
# Create .env file
cat > .env << EOF
# Minecraft Mod Converter Configuration
NODE_ENV=production
LOG_LEVEL=info
DEBUG=minecraft-mod-converter:*

# Conversion Settings
DEFAULT_TARGET_VERSION=1.20.0
DEFAULT_COMPROMISE_STRATEGY=balanced
MAX_CONCURRENT_JOBS=3
STATUS_UPDATE_INTERVAL=2000

# Resource Limits
MAX_MEMORY_MB=4096
MAX_TEXTURE_SIZE=1024
COMPRESSION_QUALITY=85

# External Services
GITHUB_TOKEN=your_github_token_here
OPENAI_API_KEY=your_openai_key_here

# Database (optional)
MONGODB_URL=mongodb://localhost:27017/minecraft-converter
REDIS_URL=redis://localhost:6379

# File Paths
TEMP_DIR=/tmp/minecraft-converter
OUTPUT_DIR=./converted-addons
CACHE_DIR=./cache
EOF

# Load environment variables
source .env

# Run conversion with environment settings
minecraft-mod-converter convert input.jar
```

## Programmatic API Usage

### Basic Service Setup

```typescript
import { 
  ConversionService, 
  JobQueue, 
  ResourceAllocator, 
  WorkerPool,
  ConfigurationService,
  ErrorCollector
} from 'minecraft-mod-converter';

// Set up configuration service
const configService = new ConfigurationService({
  conversion: {
    maxConcurrency: 4,
    defaultStrategy: 'balanced',
    statusUpdateInterval: 1000,
    timeout: 300000 // 5 minutes
  },
  assets: {
    optimizeTextures: true,
    generateAtlas: true,
    maxTextureSize: 1024,
    compressionQuality: 85
  },
  logic: {
    enableLLMTranslation: true,
    generateSourceMaps: true,
    validateOutput: true
  }
});

// Set up error collection
const errorCollector = new ErrorCollector();

// Set up job queue with configuration
const jobQueue = new JobQueue({ 
  maxConcurrent: 4,
  configService 
});

// Set up worker pool
const workerPool = new WorkerPool({ 
  maxWorkers: 6,
  minWorkers: 2 
});

// Set up resource allocator
const resourceAllocator = new ResourceAllocator({
  workerPool,
  jobQueue,
  maxWorkers: 6,
  minWorkers: 2
});

// Create conversion service
const conversionService = new ConversionService({
  jobQueue,
  resourceAllocator,
  errorCollector,
  configService,
  statusUpdateInterval: 1000
});

// Start the service
conversionService.start();

console.log('Conversion service started and ready for jobs');
```

### Advanced Job Management

```typescript
import { ConversionService } from 'minecraft-mod-converter';

class ConversionManager {
  private conversionService: ConversionService;
  private activeJobs: Map<string, any> = new Map();

  constructor(conversionService: ConversionService) {
    this.conversionService = conversionService;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Job lifecycle events
    this.conversionService.on('job:created', (job) => {
      console.log(`Job created: ${job.id}`);
      this.activeJobs.set(job.id, {
        ...job,
        startTime: Date.now(),
        lastUpdate: Date.now()
      });
    });

    this.conversionService.on('job:status', (status) => {
      const job = this.activeJobs.get(status.jobId);
      if (job) {
        job.lastUpdate = Date.now();
        job.progress = status.progress;
        job.currentStage = status.currentStage;
        
        console.log(`Job ${status.jobId}: ${status.progress}% - ${status.currentStage}`);
        
        // Estimate completion time
        if (status.progress > 0) {
          const elapsed = Date.now() - job.startTime;
          const estimated = (elapsed / status.progress) * (100 - status.progress);
          console.log(`ETA: ${Math.round(estimated / 1000)}s`);
        }
      }
    });

    this.conversionService.on('job:completed', (data) => {
      const job = this.activeJobs.get(data.jobId);
      if (job) {
        const duration = Date.now() - job.startTime;
        console.log(`Job ${data.jobId} completed in ${duration}ms`);
        
        // Get detailed results
        const result = this.conversionService.getJobResult(data.jobId);
        if (result) {
          console.log(`Success: ${result.success}`);
          console.log(`Files processed: ${result.stats?.filesProcessed || 0}`);
          console.log(`Warnings: ${result.warnings?.length || 0}`);
          console.log(`Errors: ${result.errors?.length || 0}`);
        }
        
        // Clean up after delay
        setTimeout(() => {
          this.activeJobs.delete(data.jobId);
        }, 60000); // Keep for 1 minute
      }
    });

    this.conversionService.on('job:failed', (data) => {
      const job = this.activeJobs.get(data.jobId);
      if (job) {
        console.error(`Job ${data.jobId} failed:`, data.error);
        
        // Attempt retry for certain error types
        if (this.shouldRetry(data.error)) {
          console.log(`Retrying job ${data.jobId}...`);
          this.retryJob(job);
        }
      }
    });
  }

  public async convertMod(modPath: string, outputPath: string, options: any = {}): Promise<string> {
    const job = this.conversionService.createConversionJob({
      modFile: modPath,
      outputPath,
      options: {
        targetMinecraftVersion: '1.20.0',
        compromiseStrategy: 'balanced',
        includeDocumentation: true,
        optimizeAssets: true,
        ...options
      }
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Job ${job.id} timed out`));
      }, 600000); // 10 minute timeout

      const handleCompletion = (data: any) => {
        if (data.jobId === job.id) {
          clearTimeout(timeout);
          this.conversionService.off('job:completed', handleCompletion);
          this.conversionService.off('job:failed', handleFailure);
          resolve(job.id);
        }
      };

      const handleFailure = (data: any) => {
        if (data.jobId === job.id) {
          clearTimeout(timeout);
          this.conversionService.off('job:completed', handleCompletion);
          this.conversionService.off('job:failed', handleFailure);
          reject(new Error(`Job failed: ${data.error?.message || 'Unknown error'}`));
        }
      };

      this.conversionService.on('job:completed', handleCompletion);
      this.conversionService.on('job:failed', handleFailure);
    });
  }

  public getJobProgress(jobId: string): any {
    return this.activeJobs.get(jobId);
  }

  public cancelJob(jobId: string): boolean {
    const cancelled = this.conversionService.cancelJob(jobId);
    if (cancelled) {
      this.activeJobs.delete(jobId);
    }
    return cancelled;
  }

  private shouldRetry(error: any): boolean {
    // Retry logic for transient errors
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Memory allocation failed'
    ];
    
    return retryableErrors.some(retryable => 
      error?.message?.includes(retryable)
    );
  }

  private async retryJob(job: any): Promise<void> {
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Create new job with same parameters
    this.conversionService.createConversionJob(job.input);
  }
}

// Usage
const manager = new ConversionManager(conversionService);

// Convert a mod
try {
  const jobId = await manager.convertMod(
    './mods/example-mod.jar',
    './output/example-addon',
    {
      compromiseStrategy: 'aggressive',
      optimizeAssets: true,
      generateSourceMaps: true
    }
  );
  
  console.log(`Conversion completed: ${jobId}`);
} catch (error) {
  console.error('Conversion failed:', error);
}
```
##
 Advanced Configuration

### Custom API Mappings

Create custom API mappings for specialized mod types:

```json
// custom-mappings.json
{
  "version": "1.0.0",
  "mappings": {
    "org.bukkit.entity.Player": {
      "bedrockEquivalent": "Player",
      "namespace": "@minecraft/server",
      "methods": {
        "getHealth()": {
          "bedrockMethod": "getComponent('health').currentValue",
          "returnType": "number",
          "notes": "Direct property access in Bedrock"
        },
        "setHealth(double)": {
          "bedrockMethod": "getComponent('health').setCurrentValue($1)",
          "parameters": ["number"],
          "notes": "Use health component"
        },
        "sendMessage(String)": {
          "bedrockMethod": "sendMessage($1)",
          "parameters": ["string"],
          "notes": "Direct equivalent"
        }
      }
    },
    "org.bukkit.World": {
      "bedrockEquivalent": "World",
      "namespace": "@minecraft/server",
      "methods": {
        "spawnEntity(Location, EntityType)": {
          "bedrockMethod": "spawnEntity($2, $1)",
          "parameters": ["Vector3", "string"],
          "notes": "Parameter order reversed in Bedrock"
        }
      }
    }
  },
  "compromiseStrategies": {
    "org.bukkit.inventory.Inventory": {
      "strategy": "stub_with_warning",
      "reason": "Complex inventory management not directly supported",
      "fallback": "Use container components where possible"
    }
  }
}
```

### Performance Optimization Configuration

```typescript
// performance-config.ts
export const performanceConfig = {
  // Memory management
  memory: {
    maxHeapSize: '6144m',
    gcInterval: 30000,
    enableGCLogging: true
  },
  
  // Concurrency settings
  concurrency: {
    maxConcurrentJobs: 4,
    maxWorkerThreads: 8,
    jobQueueSize: 100,
    workerIdleTimeout: 60000
  },
  
  // Asset processing
  assets: {
    textureProcessing: {
      batchSize: 50,
      maxTextureSize: 1024,
      compressionQuality: 85,
      enableAtlasing: true,
      atlasMaxSize: 2048
    },
    modelProcessing: {
      batchSize: 25,
      optimizeGeometry: true,
      reducePrecision: true,
      mergeVertices: true
    },
    soundProcessing: {
      batchSize: 20,
      compressionFormat: 'ogg',
      bitRate: 128,
      enableNormalization: true
    }
  },
  
  // Code translation
  logic: {
    enableLLMTranslation: true,
    llmBatchSize: 10,
    enableCaching: true,
    cacheSize: 1000,
    parallelTranslation: true
  },
  
  // I/O optimization
  io: {
    bufferSize: 64 * 1024,
    enableCompression: true,
    compressionLevel: 6,
    enableStreaming: true,
    streamChunkSize: 1024 * 1024
  }
};
```

## Custom Module Development

### Creating a Custom Asset Processor

```typescript
// CustomTextureProcessor.ts
import { TextureConverter, TextureAsset, BedrockTexture } from 'minecraft-mod-converter';

export class CustomTextureProcessor extends TextureConverter {
  async convertTexture(texture: TextureAsset): Promise<BedrockTexture> {
    // Custom texture processing logic
    console.log(`Processing custom texture: ${texture.name}`);
    
    // Apply custom filters
    const processedTexture = await this.applyCustomFilters(texture);
    
    // Call parent implementation
    const bedrockTexture = await super.convertTexture(processedTexture);
    
    // Add custom metadata
    bedrockTexture.metadata = {
      ...bedrockTexture.metadata,
      customProcessor: 'CustomTextureProcessor',
      processedAt: new Date().toISOString(),
      originalFormat: texture.format,
      customFiltersApplied: this.getAppliedFilters()
    };
    
    return bedrockTexture;
  }
  
  private async applyCustomFilters(texture: TextureAsset): Promise<TextureAsset> {
    // Example: Apply brightness adjustment
    if (this.shouldAdjustBrightness(texture)) {
      texture = await this.adjustBrightness(texture, 1.2);
    }
    
    // Example: Apply custom color palette
    if (this.shouldApplyCustomPalette(texture)) {
      texture = await this.applyColorPalette(texture, this.getCustomPalette());
    }
    
    return texture;
  }
  
  private shouldAdjustBrightness(texture: TextureAsset): boolean {
    // Custom logic to determine if brightness adjustment is needed
    return texture.name.includes('dark') || texture.averageBrightness < 0.3;
  }
  
  private async adjustBrightness(texture: TextureAsset, factor: number): Promise<TextureAsset> {
    // Implement brightness adjustment
    // This would use image processing libraries like Sharp or Canvas
    return texture; // Placeholder
  }
  
  private shouldApplyCustomPalette(texture: TextureAsset): boolean {
    return texture.name.includes('custom_') || texture.tags?.includes('custom-palette');
  }
  
  private getCustomPalette(): number[][] {
    // Return custom color palette
    return [
      [255, 0, 0],    // Red
      [0, 255, 0],    // Green
      [0, 0, 255],    // Blue
      [255, 255, 0]   // Yellow
    ];
  }
  
  private async applyColorPalette(texture: TextureAsset, palette: number[][]): Promise<TextureAsset> {
    // Implement color palette application
    return texture; // Placeholder
  }
  
  private getAppliedFilters(): string[] {
    return ['brightness-adjustment', 'custom-palette'];
  }
}

// Usage
import { AssetTranslationModule } from 'minecraft-mod-converter';

const customTextureProcessor = new CustomTextureProcessor({
  maxTextureSize: 1024,
  compressionQuality: 90,
  enableOptimization: true
});

const assetModule = new AssetTranslationModule({
  textureConverter: customTextureProcessor,
  enableCustomProcessing: true
});

// Use in conversion
const result = await assetModule.translateAssets(javaAssets);
```

## Batch Processing

### Processing Multiple Mods

```typescript
import { ConversionService } from 'minecraft-mod-converter';
import { glob } from 'glob';
import path from 'path';

class BatchProcessor {
  private conversionService: ConversionService;
  private results: Map<string, any> = new Map();

  constructor(conversionService: ConversionService) {
    this.conversionService = conversionService;
  }

  async processModDirectory(inputDir: string, outputDir: string): Promise<void> {
    // Find all JAR files
    const modFiles = await glob('**/*.jar', { cwd: inputDir });
    
    console.log(`Found ${modFiles.length} mod files to process`);
    
    // Process mods in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < modFiles.length; i += batchSize) {
      const batch = modFiles.slice(i, i + batchSize);
      await this.processBatch(batch, inputDir, outputDir);
    }
    
    // Generate summary report
    this.generateBatchReport();
  }

  private async processBatch(modFiles: string[], inputDir: string, outputDir: string): Promise<void> {
    const promises = modFiles.map(async (modFile) => {
      const inputPath = path.join(inputDir, modFile);
      const outputPath = path.join(outputDir, path.basename(modFile, '.jar') + '-addon');
      
      try {
        const startTime = Date.now();
        
        const job = this.conversionService.createConversionJob({
          modFile: inputPath,
          outputPath,
          options: {
            targetMinecraftVersion: '1.20.0',
            compromiseStrategy: 'balanced',
            optimizeAssets: true,
            generateReport: true
          }
        });

        // Wait for completion
        await this.waitForJobCompletion(job.id);
        
        const duration = Date.now() - startTime;
        const result = this.conversionService.getJobResult(job.id);
        
        this.results.set(modFile, {
          success: result?.success || false,
          duration,
          warnings: result?.warnings?.length || 0,
          errors: result?.errors?.length || 0,
          filesProcessed: result?.stats?.filesProcessed || 0
        });
        
        console.log(`✓ Completed: ${modFile} (${duration}ms)`);
        
      } catch (error) {
        this.results.set(modFile, {
          success: false,
          error: error.message,
          duration: 0
        });
        
        console.error(`✗ Failed: ${modFile} - ${error.message}`);
      }
    });

    await Promise.all(promises);
  }

  private async waitForJobCompletion(jobId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Job ${jobId} timed out`));
      }, 600000); // 10 minute timeout

      const handleCompletion = (data: any) => {
        if (data.jobId === jobId) {
          clearTimeout(timeout);
          this.conversionService.off('job:completed', handleCompletion);
          this.conversionService.off('job:failed', handleFailure);
          resolve();
        }
      };

      const handleFailure = (data: any) => {
        if (data.jobId === jobId) {
          clearTimeout(timeout);
          this.conversionService.off('job:completed', handleCompletion);
          this.conversionService.off('job:failed', handleFailure);
          reject(new Error(`Job failed: ${data.error?.message || 'Unknown error'}`));
        }
      };

      this.conversionService.on('job:completed', handleCompletion);
      this.conversionService.on('job:failed', handleFailure);
    });
  }

  private generateBatchReport(): void {
    const successful = Array.from(this.results.values()).filter(r => r.success).length;
    const failed = this.results.size - successful;
    const totalDuration = Array.from(this.results.values()).reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / this.results.size;

    console.log('\n=== Batch Processing Report ===');
    console.log(`Total mods processed: ${this.results.size}`);
    console.log(`Successful conversions: ${successful}`);
    console.log(`Failed conversions: ${failed}`);
    console.log(`Average processing time: ${Math.round(avgDuration)}ms`);
    console.log(`Total processing time: ${Math.round(totalDuration / 1000)}s`);
    
    // Detailed results
    console.log('\n=== Detailed Results ===');
    for (const [modFile, result] of this.results.entries()) {
      const status = result.success ? '✓' : '✗';
      console.log(`${status} ${modFile}: ${result.duration}ms`);
      if (result.warnings > 0) {
        console.log(`  Warnings: ${result.warnings}`);
      }
      if (result.errors > 0) {
        console.log(`  Errors: ${result.errors}`);
      }
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }
  }
}

// Usage
const batchProcessor = new BatchProcessor(conversionService);
await batchProcessor.processModDirectory('./input-mods', './output-addons');
```

## Integration Examples

### Express.js Web Service

```typescript
import express from 'express';
import multer from 'multer';
import { ConversionService } from 'minecraft-mod-converter';

const app = express();
const upload = multer({ dest: 'uploads/' });

// Set up conversion service
const conversionService = new ConversionService({
  jobQueue,
  resourceAllocator
});
conversionService.start();

// Upload and convert endpoint
app.post('/convert', upload.single('modFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No mod file uploaded' });
    }

    const job = conversionService.createConversionJob({
      modFile: req.file.path,
      outputPath: `./output/${req.file.filename}-addon`,
      options: {
        targetMinecraftVersion: req.body.targetVersion || '1.20.0',
        compromiseStrategy: req.body.strategy || 'balanced',
        optimizeAssets: req.body.optimize === 'true'
      }
    });

    res.json({
      jobId: job.id,
      status: 'queued',
      message: 'Conversion job created successfully'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Job status endpoint
app.get('/status/:jobId', (req, res) => {
  const status = conversionService.getJobStatus(req.params.jobId);
  
  if (!status) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(status);
});

// Download result endpoint
app.get('/download/:jobId', (req, res) => {
  const result = conversionService.getJobResult(req.params.jobId);
  
  if (!result || !result.success) {
    return res.status(404).json({ error: 'Result not available' });
  }

  // Stream the addon file
  const addonPath = result.bedrockAddon.packagePath;
  res.download(addonPath, `${req.params.jobId}-addon.mcaddon`);
});

app.listen(3000, () => {
  console.log('Conversion service running on port 3000');
});
```

### Discord Bot Integration

```typescript
import { Client, GatewayIntentBits, AttachmentBuilder } from 'discord.js';
import { ConversionService } from 'minecraft-mod-converter';

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const conversionService = new ConversionService({
  jobQueue,
  resourceAllocator
});
conversionService.start();

client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!convert') && message.attachments.size > 0) {
    const attachment = message.attachments.first();
    
    if (!attachment.name.endsWith('.jar')) {
      return message.reply('Please attach a .jar mod file');
    }

    try {
      // Download the attachment
      const response = await fetch(attachment.url);
      const buffer = await response.arrayBuffer();
      const tempPath = `./temp/${attachment.name}`;
      
      await fs.writeFile(tempPath, Buffer.from(buffer));

      // Start conversion
      const job = conversionService.createConversionJob({
        modFile: tempPath,
        outputPath: `./output/${message.id}-addon`,
        options: {
          targetMinecraftVersion: '1.20.0',
          compromiseStrategy: 'balanced'
        }
      });

      await message.reply(`🔄 Converting ${attachment.name}... (Job ID: ${job.id})`);

      // Wait for completion
      conversionService.once('job:completed', async (data) => {
        if (data.jobId === job.id) {
          const result = conversionService.getJobResult(job.id);
          
          if (result.success) {
            const addonFile = new AttachmentBuilder(result.bedrockAddon.packagePath);
            await message.reply({
              content: '✅ Conversion completed!',
              files: [addonFile]
            });
          } else {
            await message.reply(`❌ Conversion failed: ${result.errors[0]?.message}`);
          }
        }
      });

      conversionService.once('job:failed', async (data) => {
        if (data.jobId === job.id) {
          await message.reply(`❌ Conversion failed: ${data.error.message}`);
        }
      });

    } catch (error) {
      await message.reply(`❌ Error: ${error.message}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
```

## Real-World Use Cases

### Minecraft Server Network Integration

```typescript
// ServerNetworkConverter.ts
import { ConversionService } from 'minecraft-mod-converter';

export class ServerNetworkConverter {
  private conversionService: ConversionService;
  private serverConfigs: Map<string, any> = new Map();

  constructor() {
    this.conversionService = new ConversionService({
      jobQueue: new JobQueue({ maxConcurrent: 10 }),
      resourceAllocator: new ResourceAllocator({ maxWorkers: 15 })
    });
    
    this.conversionService.start();
    this.loadServerConfigurations();
  }

  async convertForServerNetwork(modPath: string, serverType: string): Promise<string> {
    const config = this.serverConfigs.get(serverType);
    
    if (!config) {
      throw new Error(`Unknown server type: ${serverType}`);
    }

    const job = this.conversionService.createConversionJob({
      modFile: modPath,
      outputPath: `./network-addons/${serverType}/${Date.now()}`,
      options: {
        targetMinecraftVersion: config.minecraftVersion,
        compromiseStrategy: config.compromiseStrategy,
        optimizeAssets: config.optimizeAssets,
        customApiMappings: config.apiMappings,
        serverSpecificOptimizations: config.optimizations
      }
    });

    return this.waitForConversion(job.id);
  }

  private loadServerConfigurations(): void {
    // Creative server configuration
    this.serverConfigs.set('creative', {
      minecraftVersion: '1.20.0',
      compromiseStrategy: 'aggressive',
      optimizeAssets: false, // Keep original quality for creative builds
      apiMappings: './configs/creative-mappings.json',
      optimizations: {
        enableWorldEdit: true,
        enableCustomBlocks: true,
        enableAdvancedRedstone: true
      }
    });

    // Survival server configuration
    this.serverConfigs.set('survival', {
      minecraftVersion: '1.20.0',
      compromiseStrategy: 'balanced',
      optimizeAssets: true, // Optimize for performance
      apiMappings: './configs/survival-mappings.json',
      optimizations: {
        enableEconomy: true,
        enablePvP: true,
        enableMobSpawning: true
      }
    });

    // Minigames server configuration
    this.serverConfigs.set('minigames', {
      minecraftVersion: '1.20.0',
      compromiseStrategy: 'conservative',
      optimizeAssets: true,
      apiMappings: './configs/minigames-mappings.json',
      optimizations: {
        enableScoreboard: true,
        enableTeams: true,
        enableCustomGameModes: true
      }
    });
  }

  private async waitForConversion(jobId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Conversion timeout'));
      }, 900000); // 15 minute timeout

      const handleCompletion = (data: any) => {
        if (data.jobId === jobId) {
          clearTimeout(timeout);
          this.conversionService.off('job:completed', handleCompletion);
          this.conversionService.off('job:failed', handleFailure);
          
          const result = this.conversionService.getJobResult(jobId);
          resolve(result.bedrockAddon.packagePath);
        }
      };

      const handleFailure = (data: any) => {
        if (data.jobId === jobId) {
          clearTimeout(timeout);
          this.conversionService.off('job:completed', handleCompletion);
          this.conversionService.off('job:failed', handleFailure);
          reject(new Error(`Conversion failed: ${data.error.message}`));
        }
      };

      this.conversionService.on('job:completed', handleCompletion);
      this.conversionService.on('job:failed', handleFailure);
    });
  }
}
```

### Educational Platform Integration

```typescript
// EducationalConverter.ts
export class EducationalConverter {
  private conversionService: ConversionService;
  private studentProjects: Map<string, any> = new Map();

  async convertStudentProject(
    studentId: string, 
    projectName: string, 
    modFile: string
  ): Promise<any> {
    
    const job = this.conversionService.createConversionJob({
      modFile,
      outputPath: `./student-projects/${studentId}/${projectName}`,
      options: {
        targetMinecraftVersion: '1.20.0',
        compromiseStrategy: 'educational', // Custom strategy for learning
        includeDocumentation: true,
        generateReport: true,
        educationalMode: true, // Add educational annotations
        simplifyComplexFeatures: true
      }
    });

    // Track student progress
    this.trackStudentProgress(studentId, job.id);

    return this.waitForEducationalConversion(job.id);
  }

  private trackStudentProgress(studentId: string, jobId: string): void {
    this.conversionService.on('job:status', (status) => {
      if (status.jobId === jobId) {
        // Update student dashboard with progress
        this.updateStudentDashboard(studentId, {
          progress: status.progress,
          currentStage: status.currentStage,
          timestamp: new Date()
        });
      }
    });
  }

  private async waitForEducationalConversion(jobId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.conversionService.once('job:completed', (data) => {
        if (data.jobId === jobId) {
          const result = this.conversionService.getJobResult(jobId);
          
          // Generate educational report
          const educationalReport = this.generateEducationalReport(result);
          
          resolve({
            addon: result.bedrockAddon,
            report: educationalReport,
            learningPoints: this.extractLearningPoints(result),
            nextSteps: this.suggestNextSteps(result)
          });
        }
      });

      this.conversionService.once('job:failed', (data) => {
        if (data.jobId === jobId) {
          // Convert failure into learning opportunity
          const learningReport = this.generateFailureLearningReport(data.error);
          reject(new Error(`Learning opportunity: ${learningReport}`));
        }
      });
    });
  }

  private generateEducationalReport(result: any): any {
    return {
      conversionSummary: {
        totalFiles: result.stats.filesProcessed,
        successfulConversions: result.stats.successfulConversions,
        compromisesApplied: result.stats.compromisesApplied
      },
      learningObjectives: [
        'Understanding Java to JavaScript conversion',
        'Learning Bedrock Edition API differences',
        'Exploring compromise strategies for incompatible features'
      ],
      keyConceptsExplored: this.extractKeyConceptsFromResult(result),
      challengesEncountered: result.warnings.map(w => ({
        challenge: w.message,
        solution: w.solution,
        learningValue: w.educationalNote
      })),
      recommendedReading: this.getRecommendedReading(result)
    };
  }

  private extractLearningPoints(result: any): string[] {
    const points = [];
    
    if (result.stats.texturesConverted > 0) {
      points.push('Learned about texture format differences between Java and Bedrock');
    }
    
    if (result.stats.modelsConverted > 0) {
      points.push('Explored 3D model conversion and optimization techniques');
    }
    
    if (result.stats.codeTranslated > 0) {
      points.push('Practiced Java to JavaScript code translation');
    }
    
    return points;
  }

  private suggestNextSteps(result: any): string[] {
    const suggestions = [];
    
    if (result.warnings.length > 0) {
      suggestions.push('Review the warnings to understand conversion limitations');
    }
    
    if (result.stats.compromisesApplied > 0) {
      suggestions.push('Study the compromise strategies used and their alternatives');
    }
    
    suggestions.push('Test the converted addon in Minecraft Bedrock Edition');
    suggestions.push('Experiment with different compromise strategies');
    
    return suggestions;
  }
}
```

## Best Practices

### Error Handling and Recovery

```typescript
import { ConversionService, ConversionError } from 'minecraft-mod-converter';

class RobustConverter {
  private conversionService: ConversionService;
  private retryAttempts = 3;
  private retryDelay = 5000;

  async convertWithRetry(input: any): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`Conversion attempt ${attempt}/${this.retryAttempts}`);
        
        const job = this.conversionService.createConversionJob(input);
        const result = await this.waitForCompletion(job.id);
        
        console.log('Conversion successful');
        return result;
        
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.retryAttempts) {
          console.log(`Retrying in ${this.retryDelay}ms...`);
          await this.delay(this.retryDelay);
          
          // Exponential backoff
          this.retryDelay *= 2;
        }
      }
    }
    
    throw new Error(`Conversion failed after ${this.retryAttempts} attempts: ${lastError.message}`);
  }

  private async waitForCompletion(jobId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Conversion timeout'));
      }, 600000);

      this.conversionService.once('job:completed', (data) => {
        if (data.jobId === jobId) {
          clearTimeout(timeout);
          resolve(this.conversionService.getJobResult(jobId));
        }
      });

      this.conversionService.once('job:failed', (data) => {
        if (data.jobId === jobId) {
          clearTimeout(timeout);
          reject(new Error(data.error.message));
        }
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Performance Monitoring

```typescript
class PerformanceMonitor {
  private metrics: Map<string, any> = new Map();

  startMonitoring(conversionService: ConversionService): void {
    // Monitor job completion times
    conversionService.on('job:completed', (data) => {
      const job = conversionService.getJob(data.jobId);
      if (job) {
        const duration = Date.now() - job.createdAt.getTime();
        this.recordMetric('job_duration', duration);
      }
    });

    // Monitor memory usage
    setInterval(() => {
      const usage = process.memoryUsage();
      this.recordMetric('memory_usage', {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external
      });
    }, 10000);

    // Monitor queue size
    setInterval(() => {
      const stats = conversionService.getQueueStats();
      this.recordMetric('queue_stats', stats);
    }, 5000);
  }

  private recordMetric(name: string, value: any): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name).push({
      timestamp: new Date(),
      value
    });

    // Keep only last 1000 entries
    const entries = this.metrics.get(name);
    if (entries.length > 1000) {
      entries.splice(0, entries.length - 1000);
    }
  }

  generateReport(): any {
    const report = {};
    
    for (const [name, entries] of this.metrics.entries()) {
      if (name === 'job_duration') {
        const durations = entries.map(e => e.value);
        report[name] = {
          average: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          count: durations.length
        };
      } else if (name === 'memory_usage') {
        const latest = entries[entries.length - 1]?.value;
        report[name] = {
          current: latest,
          trend: this.calculateTrend(entries.slice(-10).map(e => e.value.heapUsed))
        };
      }
    }
    
    return report;
  }

  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = (last - first) / first;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }
}
```

This comprehensive documentation provides developers with practical examples and best practices for using the Minecraft Mod Converter effectively in various scenarios, from simple conversions to complex enterprise integrations.