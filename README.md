# Minecraft Mod Converter

[![Build Status](https://github.com/your-org/minecraft-mod-converter/workflows/CI/badge.svg)](https://github.com/your-org/minecraft-mod-converter/actions)
[![Coverage Status](https://codecov.io/gh/your-org/minecraft-mod-converter/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/minecraft-mod-converter)
[![npm version](https://img.shields.io/npm/v/minecraft-mod-converter.svg)](https://www.npmjs.com/package/minecraft-mod-converter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/minecraft-mod-converter.svg)](https://nodejs.org/)

A hybrid translation pipeline to convert Minecraft Java Edition mods to Bedrock Edition addons, combining automated conversion with intelligent compromise strategies for incompatible features.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [Repository Guidelines](AGENTS.md)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)
- [License](#license)
- [Support](#support)

## Features

### Core Conversion Capabilities

- **Multi-Format Asset Translation**: Converts textures, models, sounds, and particles from Java to Bedrock formats
- **Logic Translation Engine**: Transpiles Java mod logic to JavaScript with API mapping
- **Configuration Conversion**: Transforms recipes, loot tables, and block definitions
- **Intelligent Compromise Strategies**: Handles incompatible features with fallback solutions
- **Automated Packaging**: Generates complete Bedrock addon packages

### Advanced Features

- **LLM-Assisted Translation**: Uses AI for complex code translation scenarios
- **Performance Optimization**: Includes texture atlasing and resource optimization
- **Validation Pipeline**: Comprehensive testing and validation of converted addons
- **Progress Tracking**: Real-time conversion progress monitoring
- **Error Recovery**: Robust error handling with detailed reporting

### Developer Experience

- **Modular Architecture**: Extensible plugin system for custom conversion modules
- **TypeScript Support**: Full TypeScript implementation with comprehensive type definitions
- **Comprehensive Testing**: Unit, integration, and security test suites
- **Developer Tools**: CLI interface, web UI, and programmatic API

## Installation

### Prerequisites

Before installing, ensure you have:

- **Node.js** (v18.x or v20.x) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** for version control
- **MongoDB** (optional, for advanced features)
- **Redis** (optional, for caching)

### Install from npm

```bash
npm install -g minecraft-mod-converter
```

### Install from Source

```bash
# Clone the repository
git clone https://github.com/your-org/minecraft-mod-converter.git
cd minecraft-mod-converter

# Install dependencies
npm install

# Build the project
npm run build

# Run tests to verify installation
npm test
```

### Docker Installation

```bash
# Pull the Docker image
docker pull minecraft-mod-converter:latest

# Run with Docker
docker run -p 3000:3000 minecraft-mod-converter:latest
```

## Quick Start

### Command Line Usage

```bash
# Convert a mod file
minecraft-mod-converter convert ./my-mod.jar --output ./converted-addon

# Convert with specific options
minecraft-mod-converter convert ./my-mod.jar \
  --output ./converted-addon \
  --compromise-strategy aggressive \
  --include-source-maps
```

### Programmatic Usage

```typescript
import { ConversionService } from 'minecraft-mod-converter';

const converter = new ConversionService({
  compromiseStrategy: 'balanced',
  includeSourceMaps: true
});

const result = await converter.convertMod({
  inputPath: './my-mod.jar',
  outputPath: './converted-addon'
});

console.log(`Conversion completed: ${result.success ? 'Success' : 'Failed'}`);
console.log(`Converted ${result.stats.filesProcessed} files`);
```

### Web Interface

```bash
# Start the web server
npm start

# Open browser to http://localhost:3000
# Upload your mod file and follow the conversion wizard
```

## Usage

### Basic Conversion

The simplest way to convert a mod:

```bash
minecraft-mod-converter convert input.jar --output output-addon/
```

### Advanced Options

```bash
minecraft-mod-converter convert input.jar \
  --output output-addon/ \
  --compromise-strategy balanced \
  --target-version 1.20.0 \
  --include-source-maps \
  --optimize-textures \
  --generate-report
```

### Configuration File

Create a `converter.config.json` file for complex setups:

```json
{
  "compromiseStrategy": "balanced",
  "targetVersion": "1.20.0",
  "optimization": {
    "textures": true,
    "sounds": true,
    "models": false
  },
  "features": {
    "includeSourceMaps": true,
    "generateReport": true,
    "validateOutput": true
  },
  "apiMappings": {
    "customMappingsPath": "./custom-mappings.json"
  }
}
```

### Programmatic API

```typescript
import {
  ConversionService,
  AssetTranslationModule,
  LogicTranslationEngine
} from 'minecraft-mod-converter';

// Initialize the conversion service
const service = new ConversionService({
  modules: {
    assets: new AssetTranslationModule(),
    logic: new LogicTranslationEngine()
  }
});

// Convert a mod
const result = await service.convertMod({
  inputPath: './forge-mod.jar',
  outputPath: './bedrock-addon/',
  options: {
    compromiseStrategy: 'aggressive',
    includeDebugInfo: true
  }
});

// Handle results
if (result.success) {
  console.log('Conversion successful!');
  console.log(`Files converted: ${result.stats.filesProcessed}`);
  console.log(`Warnings: ${result.warnings.length}`);
} else {
  console.error('Conversion failed:', result.errors);
}
```

## Architecture

The Minecraft Mod Converter uses a modular pipeline architecture:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Ingestion     │───▶│   Translation    │───▶│   Packaging     │
│   Pipeline      │    │   Pipeline       │    │   Pipeline      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ • Mod Detection │    │ • Asset Convert  │    │ • Manifest Gen  │
│ • License Parse │    │ • Logic Transpile│    │ • Validation    │
│ • Feature Scan  │    │ • Config Convert │    │ • Report Gen    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core Modules

- **Ingestion**: Mod parsing, validation, and feature detection
- **Assets**: Texture, model, sound, and particle conversion
- **Logic**: Java-to-JavaScript transpilation with API mapping
- **Configuration**: Recipe, loot table, and definition conversion
- **Compromise**: Intelligent handling of incompatible features
- **Packaging**: Addon generation and validation

## API Documentation

### ConversionService

Main service for mod conversion operations.

```typescript
class ConversionService {
  async convertMod(options: ConversionOptions): Promise<ConversionResult>
  async validateMod(path: string): Promise<ValidationResult>
  async getConversionProgress(jobId: string): Promise<ProgressInfo>
}
```

### AssetTranslationModule

Handles conversion of game assets.

```typescript
class AssetTranslationModule {
  async translateAssets(assets: JavaAssetCollection): Promise<AssetTranslationResult>
  async optimizeTextures(textures: TextureAsset[]): Promise<OptimizedTextures>
  async generateAtlas(textures: TextureAsset[]): Promise<TextureAtlas>
}
```

For complete API documentation, see [docs/API.md](docs/API.md).

## Development

### Setting Up Development Environment

```bash
# Clone and install
git clone https://github.com/your-org/minecraft-mod-converter.git
cd minecraft-mod-converter
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Development Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Check code style
npm run lint:fix     # Fix code style issues
npm run format       # Format code with Prettier
```

### Project Structure

```
src/
├── modules/           # Conversion modules
│   ├── assets/       # Asset conversion
│   ├── compromise/   # Compromise strategies
│   ├── configuration/# Config conversion
│   ├── ingestion/    # Mod ingestion
│   ├── logic/        # Logic translation
│   ├── packaging/    # Addon packaging
│   └── ui/           # User interface
├── services/         # Core services
├── types/            # TypeScript definitions
└── utils/            # Utility functions
```

For detailed setup instructions, see [docs/developer-setup-guide.md](docs/developer-setup-guide.md).

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:security       # Security tests only

# Run with coverage
npm run test:coverage

# Run performance benchmarks
npm run benchmark
```

### Test Coverage

The project maintains high test coverage:

- **Unit Tests**: Individual module and function testing
- **Integration Tests**: Module interaction testing  
- **Security Tests**: Input validation and security testing
- **Performance Tests**: Benchmark and performance regression testing

Current coverage: ![Coverage](https://codecov.io/gh/your-org/minecraft-mod-converter/branch/main/graph/badge.svg)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes following our coding standards
4. **Add** tests for your changes
5. **Run** tests: `npm test`
6. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
7. **Push** to your branch: `git push origin feature/amazing-feature`
8. **Create** a Pull Request

### Development Guidelines

- Follow [TypeScript best practices](https://typescript-eslint.io/rules/)
- Write comprehensive tests for new features
- Update documentation for API changes
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
- Ensure all CI checks pass before submitting PR

## Troubleshooting

### Common Issues

**Installation Problems**
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Conversion Failures**
```bash
# Enable debug logging
DEBUG=minecraft-mod-converter:* npm start

# Check mod compatibility
minecraft-mod-converter validate ./my-mod.jar
```

**Performance Issues**
```bash
# Run with memory profiling
node --max-old-space-size=4096 dist/src/index.js

# Use streaming mode for large mods
minecraft-mod-converter convert ./large-mod.jar --streaming
```

For more troubleshooting help, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Examples

### Basic Conversion Example

```typescript
import { ConversionService } from 'minecraft-mod-converter';

const converter = new ConversionService();
const result = await converter.convertMod({
  inputPath: './JEI-1.19.2-forge.jar',
  outputPath: './jei-bedrock-addon/'
});
```

### Custom Module Example

```typescript
import { AssetTranslationModule } from 'minecraft-mod-converter';

class CustomAssetModule extends AssetTranslationModule {
  async translateTextures(textures: JavaTexture[]): Promise<BedrockTexture[]> {
    // Custom texture conversion logic
    return super.translateTextures(textures);
  }
}
```

### Batch Conversion Example

```typescript
const mods = ['mod1.jar', 'mod2.jar', 'mod3.jar'];
const results = await Promise.all(
  mods.map(mod => converter.convertMod({
    inputPath: mod,
    outputPath: `./converted/${mod.replace('.jar', '-addon')}/`
  }))
);
```

For more examples, see [docs/EXAMPLES.md](docs/EXAMPLES.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This project includes code from several open-source projects:
- Java Parser library (Apache 2.0)
- Texture processing utilities (MIT)
- Asset optimization tools (BSD-3-Clause)

For complete third-party license information, see the individual package licenses in the node_modules directory.

## Support

### Getting Help

- **Documentation**: Check the [docs/](docs/) directory for detailed guides
- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/your-org/minecraft-mod-converter/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/your-org/minecraft-mod-converter/discussions)
- **Security**: Report security issues to [security@your-org.com](mailto:security@your-org.com)

### Community

- **Discord**: Join our [Discord server](https://discord.gg/minecraft-mod-converter) for real-time help
- **Reddit**: Visit [r/MinecraftModConverter](https://reddit.com/r/MinecraftModConverter) for community discussions
- **Twitter**: Follow [@ModConverter](https://twitter.com/ModConverter) for updates

### Commercial Support

For commercial support, training, or custom development:
- Email: [support@your-org.com](mailto:support@your-org.com)
- Website: [https://your-org.com/minecraft-mod-converter](https://your-org.com/minecraft-mod-converter)

---

**Made with ❤️ by the Minecraft Mod Converter team**

*Converting the impossible, one mod at a time.*

