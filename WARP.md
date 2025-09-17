# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

The Minecraft Mod Converter is a hybrid translation pipeline that converts
Java Edition mods to Bedrock Edition addons. The system uses a modular
architecture combining AST transpilation, LLM translation, and intelligent
compromise strategies to handle complex mod conversions.

## Architecture

The system follows a **modular pipeline architecture** with the following key components:

```text
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

- **Ingestion** (`src/modules/ingestion/`): Mod parsing, validation, and
  feature detection
- **Assets** (`src/modules/assets/`): Texture, model, sound, and particle
  conversion
- **Logic** (`src/modules/logic/`): Java-to-JavaScript transpilation with API
  mapping
- **Configuration** (`src/modules/configuration/`): Recipe, loot table, and
  definition conversion
- **Compromise** (`src/modules/compromise/`): Intelligent handling of
  incompatible features
- **Packaging** (`src/modules/packaging/`): Addon generation and validation

### Core Services

- **ConversionService**: Orchestrates the entire conversion process
- **JobQueue**: Manages conversion requests with priority and resource allocation
- **ErrorCollector**: Centralized error handling and reporting
- **ConfigurationService**: Manages application configuration
- **APIMapperService**: Handles Java-to-Bedrock API mappings

## Development Commands

**⚠️ Note: This project is in active development with some failing tests and
TypeScript compilation errors. Some commands may not work as expected.**

| Task | Command | Description | Status |
|------|---------|-------------|---------|
| Install | `npm install` | Install all dependencies | ✅ Works |
| Dev Server | `npm run dev` | Start development server with hot reload | ⚠️ May fail |
| Build | `npm run build` | Build for production | ❌ Has TS errors |
| Test All | `npm test` | Run all tests | ⚠️ Some tests fail |
| Test Watch | `npm run test:watch` | Run tests in watch mode | ⚠️ Some tests fail |
| Test Unit | `npm run test:unit` | Run unit tests only | ⚠️ Many failing |
| Test Integration | `npm run test:integration` | Run integration tests | ❌ Likely to fail |
| Test Security | `npm run test:security` | Run security tests | ⚠️ Unknown |
| Test Coverage | `npm run test:coverage` | Run tests with coverage report | ⚠️ Some tests fail |
| Lint | `npm run lint` | Check code style | ✅ Works (with warnings) |
| Lint Fix | `npm run lint:fix` | Fix code style issues | ✅ Works |
| Format | `npm run format` | Format code with Prettier | ✅ Works |

## Testing Strategy

The project uses **Vitest** for testing with comprehensive coverage:

- **Unit Tests** (`tests/unit/`): Individual module and service testing
- **Integration Tests** (`tests/integration/`): Module interaction testing
- **Security Tests** (`tests/security/`): Input validation and security testing
- **Benchmark Tests** (`tests/benchmark/`): Performance testing

### Running Specific Tests

```bash
# Test a specific service
npm test -- tests/unit/services/ConversionService.test.ts

# Test with specific pattern
npm test -- --grep "ConversionPipeline"

# Integration tests with staging environment
npm run test:integration:staging
```

### Current Test Issues

**Common test failures include:**
- File system path issues on Windows (`/tmp/mod` vs `C:\tmp\mod`)
- Missing mock implementations for some services
- TypeScript compilation errors affecting test runs
- Integration tests expecting services that aren't fully implemented

## Environment Configuration

The application requires these environment variables:

```bash
# Core Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (optional)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mineport

# Cache Configuration (optional)
REDIS_URL=redis://localhost:6379

# External APIs (optional)
LLM_API_KEY=your-llm-api-key-here
GITHUB_TOKEN=your-github-token-here

# OpenStack Configuration (for deployment)
OS_AUTH_URL=your-openstack-url
OS_PROJECT_NAME=your-project
OS_USERNAME=your-username
OS_PASSWORD=your-password
OS_REGION_NAME=RegionOne
OS_IDENTITY_API_VERSION=3
```

## Running a Conversion

### Command Line Usage

**⚠️ CLI is not yet fully functional due to compilation errors.**

```bash
# Install CLI globally (will fail due to build errors)
npm install -g .

# Convert a mod (theoretical usage)
minecraft-mod-converter convert ./my-mod.jar --output ./converted-addon

# Convert with options (theoretical usage)
minecraft-mod-converter convert ./my-mod.jar \
  --output ./converted-addon \
  --compromise-strategy aggressive \
  --include-source-maps
```

### Programmatic Usage

**⚠️ Note: This shows the intended API, but requires fixing TypeScript errors
first.**

```typescript
import { ConversionService } from './src/services/ConversionService.js';

const service = new ConversionService({
  jobQueue: mockJobQueue,
  resourceAllocator: mockResourceAllocator
});

// This method exists but has some interface issues
const result = await service.processModFile(
  Buffer.from(modFileData), 
  'example-mod.jar'
);
```

## Development Workflow

### Branch Strategy

- `main` - Production ready code
- `feature/feature-name` - New features
- `fix/issue-description` - Bug fixes
- `docs/update-description` - Documentation updates

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat(logic): implement AST transpilation for basic patterns
fix(assets): resolve texture conversion memory leak
docs(api): update ConversionService documentation
refactor(pipeline): simplify error handling flow
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with comprehensive tests
3. Ensure all CI checks pass:

   ```bash
   npm run test:comprehensive
   npm run lint
   npm run security:audit
   ```

4. Update documentation if needed
5. Create PR with detailed description

## Key Configuration Files

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration with path aliases
- `vitest.config.ts` - Test configuration
- `vitest.integration.config.ts` - Integration test configuration
- `.eslintrc.json` - ESLint rules
- `.prettierrc` - Code formatting rules
- `.pre-commit-config.yaml` - Pre-commit hooks including Gitleaks

## Debugging and Troubleshooting

### Common Issues

**Build Failures:**

```bash
# Clear cache and reinstall (PowerShell)
Remove-Item -Recurse -Force node_modules, package-lock.json, dist -ErrorAction SilentlyContinue
npm install
npm run build  # Will still have TypeScript errors
```

**Test Failures:**

```bash
# Run tests with verbose output
npm run test -- --reporter=verbose

# Run specific failing test
npm test -- tests/path/to/failing.test.ts

# Many tests fail due to Windows path issues and missing mocks
```

**Memory Issues (Large Mods):**

```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 dist/src/index.js

# Streaming mode not yet implemented
# minecraft-mod-converter convert ./large-mod.jar --streaming
```

**Windows-Specific Issues:**
- Many tests expect Unix paths (`/tmp/mod`) but get Windows paths (`C:\tmp\mod`)
- File system operations may fail due to path separator differences
- Some shell commands in package.json use Unix syntax

### Debug Logging

Enable debug logging for detailed output:

```bash
# Enable all debug logs
DEBUG=minecraft-mod-converter:* npm start

# Enable specific module logs
DEBUG=minecraft-mod-converter:conversion npm start
```

## Architecture Patterns

### Error Handling

All modules use centralized error collection:

```typescript
import { ErrorCollector } from '../services/ErrorCollector.js';

const errorCollector = new ErrorCollector();
errorCollector.addError({
  type: 'validation',
  severity: 'error',
  message: 'Invalid mod file format',
  moduleOrigin: 'IngestionModule'
});
```

### Module Communication

Modules communicate through well-defined interfaces:

```typescript
interface ConversionResult {
  success: boolean;
  outputPath?: string;
  errorSummary: ErrorSummary;
  reportPath?: string;
  addonPath?: string;
}
```

### Configuration Management

Use ConfigurationService for all settings:

```typescript
import config from '../config/default.js';

const serverPort = config.server.port;
const dbConfig = config.database;
```

## Security Considerations

- File upload validation is implemented but has some test failures
- Code execution safety is designed but not fully tested
- External API rate limiting is planned but not fully implemented
- Environment variable management is configured
- Input validation exists but may have gaps

## Performance Guidelines

- Streaming support is designed but not fully implemented
- Caching infrastructure exists (CacheService)
- Parallel processing is architected but needs testing
- ResourceAllocator exists but has some test failures
- Benchmark tests exist in `tests/benchmark/` directory

## Documentation Standards

- All public APIs require JSDoc comments
- Include examples in complex function documentation
- Update architectural decision records for major changes
- Maintain up-to-date README and API documentation
- Follow the project's JSDoc template patterns

## Related Documentation

- [README.md](README.md) - Project overview and installation
- [CONTRIBUTING.md](CONTRIBUTING.md) - Detailed contribution guidelines
- [docs/PROJECT-GUIDE.md](docs/PROJECT-GUIDE.md) - Development setup guide
- [docs/architectural-decisions.md](docs/architectural-decisions.md) - ADRs for
  major decisions
- [docs/module-interactions.md](docs/module-interactions.md) - Detailed module documentation
- [docs/API.md](docs/API.md) - Complete API documentation
