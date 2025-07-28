# Usage Examples and Tutorials

This document provides comprehensive examples and tutorials for using the Minecraft Mod Converter in various scenarios.

## Table of Contents

- [Quick Start Examples](#quick-start-examples)
- [Command Line Usage](#command-line-usage)
- [Programmatic API Usage](#programmatic-api-usage)
- [Advanced Configuration](#advanced-configuration)
- [Custom Module Development](#custom-module-development)
- [Batch Processing](#batch-processing)
- [Integration Examples](#integration-examples)
- [Real-World Use Cases](#real-world-use-cases)

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