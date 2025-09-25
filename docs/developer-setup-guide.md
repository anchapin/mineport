# Developer Setup Guide

This guide will help you set up your development environment for the Minecraft Mod Converter project.

## Prerequisites

### Required Software

1. **Node.js** (v18.x or v20.x)
    - Download from [nodejs.org](https://nodejs.org/)
    - Verify installation: `node --version` and `npm --version`

2. **Git**
    - Download from [git-scm.com](https://git-scm.com/)
    - Verify installation: `git --version`

3. **Code Editor**
    - Recommended: [Visual Studio Code](https://code.visualstudio.com/)
    - Alternative: WebStorm, Sublime Text, or any TypeScript-compatible editor

### Optional but Recommended

1. **Docker** (for containerized development)
    - Download from [docker.com](https://www.docker.com/)
    - Useful for running databases and external services locally

2. **MongoDB** (for local database development)
    - Download from [mongodb.com](https://www.mongodb.com/)
    - Alternative: Use MongoDB Atlas for cloud database

3. **Redis** (for caching during development)
    - Download from [redis.io](https://redis.io/)
    - Alternative: Use Redis Cloud or disable caching in development

## Project Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/minecraft-mod-converter.git
cd minecraft-mod-converter
```

### 2. Install Dependencies

```bash
npm install
```

This will install all project dependencies including:
- TypeScript and build tools
- Testing frameworks (Vitest)
- Linting and formatting tools (ESLint, Prettier)
- Development utilities

### 3. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit the `.env` file with your local configuration:

```env
# Application Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/minecraft-mod-converter
REDIS_URL=redis://localhost:6379

# External API Configuration
GITHUB_TOKEN=your_github_token_here
LLM_API_KEY=your_llm_api_key_here
LLM_API_URL=https://api.your-llm-provider.com

# File Storage Configuration
UPLOAD_DIR=./temp/uploads
OUTPUT_DIR=./temp/output
MAX_FILE_SIZE=100MB

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL=3600

# Development Configuration
HOT_RELOAD=true
DEBUG_MODE=true
```

### 4. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 5. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security
```

### 6. Start Development Server

```bash
# Start with hot reload
npm run dev

# Or start the built application
npm start
```

The application will be available at `http://localhost:3000`.

## Development Workflow

### Code Style and Formatting

The project uses ESLint and Prettier for code quality and formatting:

```bash
# Check for linting errors
npm run lint

# Fix linting errors automatically
npm run lint:fix

# Format code with Prettier
npm run format
```

### Git Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards

3. **Run tests and linting**:
   ```bash
   npm run lint
   npm test
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create a pull request**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```json
<type>optional scope: <description>

optional body

optional footer(s)
```

**Types**:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

**Examples**:
```text
feat(assets): add texture atlas generation
fix(logic): resolve API mapping cache invalidation
docs: update developer setup guide
test(integration): add conversion pipeline tests
```

## Project Structure

```text
minecraft-mod-converter/
├── src/                          # Source code
│   ├── index.ts                  # Application entry point
│   ├── modules/                  # Conversion modules
│   │   ├── assets/              # Asset conversion modules
│   │   ├── compromise/          # Compromise strategy modules
│   │   ├── configuration/       # Configuration conversion modules
│   │   ├── ingestion/          # Mod ingestion modules
│   │   ├── logic/              # Logic translation modules
│   │   ├── packaging/          # Addon packaging modules
│   │   └── ui/                 # UI components and services
│   ├── services/               # Core services
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Utility functions
├── tests/                      # Test files
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   ├── security/               # Security tests
│   ├── benchmark/              # Performance benchmarks
│   └── fixtures/               # Test data and fixtures
├── docs/                       # Documentation
├── scripts/                    # Build and utility scripts
├── config/                     # Configuration files
└── dist/                       # Compiled JavaScript (generated)
```

## Development Tools and Scripts

### Available NPM Scripts

```bash
# Development
npm run dev                     # Start development server with hot reload
npm run build                   # Build the project
npm start                       # Start the built application

# Testing
npm test                        # Run all tests
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Run tests with coverage report
npm run test:unit              # Run unit tests only
npm run test:integration       # Run integration tests only
npm run test:security          # Run security tests only

# Code Quality
npm run lint                    # Check for linting errors
npm run lint:fix               # Fix linting errors automatically
npm run format                 # Format code with Prettier

# Documentation
npm run docs:validate          # Validate JSDoc coverage
npm run docs:add               # Add missing JSDoc comments
npm run docs:add:dry-run       # Preview JSDoc additions

# Analysis and Benchmarking
npm run deps:analyze           # Analyze module dependencies
npm run deps:validate          # Validate dependency structure
npm run benchmark              # Run performance benchmarks
npm run benchmark:report       # Generate benchmark report

# Security
npm run security:audit         # Run npm security audit
npm run security:scan          # Run comprehensive security scan
```

### VS Code Extensions

Recommended extensions for optimal development experience:

1. **TypeScript and JavaScript**:
    - TypeScript Importer
    - Auto Rename Tag
    - Bracket Pair Colorizer

2. **Code Quality**:
    - ESLint
    - Prettier - Code formatter
    - SonarLint

3. **Testing**:
    - Jest Runner
    - Test Explorer UI

4. **Git**:
    - GitLens
    - Git Graph

5. **Documentation**:
    - Auto Comment Blocks
    - Document This

### VS Code Settings

Create `.vscode/settings.json` for project-specific settings:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

## Debugging

### VS Code Debugging

Create `.vscode/launch.json` for debugging configuration:

```json
{
  "version": "0.2.0",
  "configurations":
    {
      "name": "Debug Application",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js",
      "runtimeArgs": "-r", "ts-node/register",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": "run", "--reporter=verbose",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Logging

The application uses Winston for logging. Log levels in development:

- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Debug-level messages (enabled in development)

Example usage:
```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('ModuleName');

logger.info('Processing started');
logger.debug('Debug information', { data });
logger.error('Error occurred', { error });
```

## Database Setup

### MongoDB (Local)

1. **Install MongoDB**:
   ```bash
   # macOS with Homebrew
   brew install mongodb-community

   # Ubuntu
   sudo apt-get install mongodb

   # Windows - Download from mongodb.com
   ```

2. **Start MongoDB**:
   ```bash
   # macOS/Linux
   mongod

   # Or as a service
   brew services start mongodb-community
   ```

3. **Create database and user**:
   ```javascript
   // Connect to MongoDB shell
   mongo

   // Create database
   use minecraft-mod-converter

   // Create user (optional)
   db.createUser({
     user: "dev-user",
     pwd: "dev-password",
     roles: "readWrite"
   })
   ```

### Redis (Local)

1. **Install Redis**:
   ```bash
   # macOS with Homebrew
   brew install redis

   # Ubuntu
   sudo apt-get install redis-server

   # Windows - Download from redis.io
   ```

2. **Start Redis**:
   ```bash
   # Start Redis server
   redis-server

   # Or as a service
   brew services start redis
   ```

3. **Test Redis connection**:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

## External Services Setup

### GitHub API

1. **Create a Personal Access Token**:
    - Go to GitHub Settings > Developer settings > Personal access tokens
    - Generate a new token with `repo` and `user` scopes
    - Add to your `.env` file as `GITHUB_TOKEN`

### LLM API (Optional)

1. **Choose an LLM provider** (OpenAI, Anthropic, etc.)
2. **Get API credentials** from your provider
3. **Add to `.env` file**:
   ```env
   LLM_API_KEY=your-llm-key-placeholder
   LLM_API_URL=https://api.your-provider.com
   ```

## Common Development Tasks

### Adding a New Module

1. **Create module directory**:
   ```bash
   mkdir src/modules/your-module
   ```

2. **Create module files**:
   ```typescript
   // src/modules/your-module/YourModule.ts
   export class YourModule {
     // Implementation
   }

   // src/modules/your-module/index.ts
   export { YourModule } from './YourModule';
   ```

3. **Add tests**:
   ```bash
   mkdir tests/unit/modules/your-module
   # Create test files
   ```

4. **Update module registry**:
   ```typescript
   // src/modules/index.ts
   export { YourModule } from './your-module';
   ```

### Adding a New Service

1. **Create service file**:
   ```typescript
   // src/services/YourService.ts
   export class YourService {
     // Implementation
   }
   ```

2. **Add service interface**:
   ```typescript
   // src/types/services.ts
   export interface YourService {
     // Interface definition
   }
   ```

3. **Register in dependency container**:
   ```typescript
   // src/services/DependencyContainer.ts
   container.register('YourService', YourService);
   ```

### Running Specific Tests

```bash
# Run tests for a specific module
npm test -- tests/unit/modules/assets

# Run tests matching a pattern
npm test -- --grep "AssetTranslationModule"

# Run tests in watch mode for a specific file
npm run test:watch -- tests/unit/services/ConversionService.test.ts
```

## Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Find process using port 3000
   lsof -i :3000
   # Kill the process
   kill -9 <PID>
   ```

2. **Node modules issues**:
   ```bash
   # Clear npm cache
   npm cache clean --force
   # Remove node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **TypeScript compilation errors**:
   ```bash
   # Clean build directory
   rm -rf dist
   # Rebuild
   npm run build
   ```

4. **Database connection issues**:
    - Check if MongoDB/Redis services are running
    - Verify connection strings in `.env`
    - Check firewall settings

### Getting Help

1. **Check existing documentation** in the `docs/` directory
2. **Search existing issues** on GitHub
3. **Ask in team chat** or create a new issue
4. **Review architectural decisions** in `docs/architectural-decisions.md`

## Performance Optimization

### Development Performance

1. **Use TypeScript incremental compilation**:
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "incremental": true,
       "tsBuildInfoFile": ".tsbuildinfo"
     }
   }
   ```

2. **Enable source maps** for better debugging:
   ```json
   {
     "compilerOptions": {
       "sourceMap": true
     }
   }
   ```

3. **Use test filtering** to run only relevant tests during development

### Production Considerations

1. **Environment variables** for production configuration
2. **Build optimization** with proper TypeScript settings
3. **Monitoring and logging** configuration
4. **Security hardening** checklist

## Next Steps

After completing the setup:

1. **Read the architectural documentation** in `docs/`
2. **Review the codebase structure** and existing modules
3. **Run the test suite** to ensure everything works
4. **Try making a small change** and running tests
5. **Review open issues** and consider contributing

Welcome to the Minecraft Mod Converter development team!
