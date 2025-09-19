---
description: Repository Information Overview
alwaysApply: true
---

# Minecraft Mod Converter Information

## Summary
A hybrid translation pipeline to convert Minecraft Java Edition mods to Bedrock Edition addons, combining automated conversion with intelligent compromise strategies for incompatible features. The project handles asset translation, logic transpilation, and configuration conversion with a modular architecture.

## Structure
- **src/**: Core TypeScript code organized into modules, services, and utilities
  - **modules/**: Conversion modules (assets, ingestion, logic, packaging, etc.)
  - **services/**: Core services (ConversionService, ValidationPipeline, etc.)
  - **api/**: Express endpoints for web interface
  - **types/**: TypeScript type definitions
  - **utils/**: Shared utility functions
- **tests/**: Comprehensive test suites
  - **unit/**: Unit tests for individual components
  - **integration/**: Tests for module interactions
  - **security/**: Security and validation tests
  - **benchmark/**: Performance testing
- **scripts/**: Automation scripts for deployment, docs, and migrations
- **config/**: Configuration templates
- **dist/**: Compiled JavaScript output

## Language & Runtime
**Language**: TypeScript
**Version**: ES2022 target with ESNext modules
**Node.js**: v20.x (specified in .nvmrc)
**Python**: v3.12.2 (for auxiliary scripts)
**Build System**: TypeScript compiler (tsc)
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- Express (^4.18.2) - Web server framework
- Java-parser (^2.0.4) - Java code parsing
- Babel tools - JavaScript/TypeScript parsing
- JSZip/adm-zip (^3.10.1/^0.5.16) - Archive handling
- MongoDB (^6.1.0) - Database integration
- React (^19.1.1) - UI components
- Winston (^3.11.0) - Logging
- Zod (^3.22.4) - Schema validation

**Development Dependencies**:
- Vitest (^3.2.4) - Testing framework
- ESLint (^8.52.0) - Code linting
- Prettier (^3.0.3) - Code formatting
- TypeScript (^5.2.2) - TypeScript compiler
- ts-node-dev (^2.0.0) - Development server

## Build & Installation
```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Testing
**Framework**: Vitest
**Test Location**: tests/ directory with specialized subdirectories
**Naming Convention**: *.test.ts
**Configuration**: vitest.config.ts, vitest.integration.config.ts
**Run Command**:
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security
npm run test:coverage
```