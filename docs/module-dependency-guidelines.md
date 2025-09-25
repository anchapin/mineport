# Module Dependency Guidelines

This document provides guidelines for managing module dependencies in the Minecraft Mod Converter.

## Dependency Principles

### 1. Avoid Circular Dependencies

Circular dependencies create tight coupling and make the codebase harder to maintain and test.

**❌ Bad Example:**
```text
ModuleA → ModuleB → ModuleC → ModuleA
```

**✅ Good Example:**
```text
ModuleA → SharedModule ← ModuleB
ModuleC → SharedModule
```

### 2. Follow the Dependency Inversion Principle

High-level modules should not depend on low-level modules. Both should depend on abstractions.

**❌ Bad Example:**
```typescript
// High-level module depending on concrete implementation
import { MySQLDatabase } from './mysql-database';

class UserService {
  constructor(private db: MySQLDatabase) {}
}
```

**✅ Good Example:**
```typescript
// High-level module depending on abstraction
import { Database } from './interfaces/database';

class UserService {
  constructor(private db: Database) {}
}
```

### 3. Minimize Dependencies

Each module should have the minimum number of dependencies necessary to fulfill its responsibilities.

### 4. Use Layered Architecture

Organize modules into layers where each layer only depends on layers below it:

```text
┌─────────────────┐
│   UI Layer      │ ← User Interface Components
├─────────────────┤
│ Service Layer   │ ← Business Logic Services  
├─────────────────┤
│ Module Layer    │ ← Domain-Specific Modules
├─────────────────┤
│ Utility Layer   │ ← Shared Utilities
└─────────────────┘
```

## Current Module Architecture

### Core Modules

1. **ingestion** - Entry point for mod processing
2. **assets** - Asset conversion (textures, models, sounds)
3. **configuration** - Configuration file conversion
4. **logic** - Code translation and transpilation
5. **compromise** - Smart compromise strategies
6. **packaging** - Final addon packaging
7. **ui** - User interface components

### Support Modules

1. **services** - Core application services
2. **utils** - Utility functions and helpers
3. **types** - TypeScript type definitions

## Dependency Rules

### Allowed Dependencies

| Module | Can Depend On |
|--------|---------------|
| ui | services, types, utils, compromise |
| services | types, utils, all core modules |
| ingestion | types, utils |
| assets | types, utils |
| configuration | types, utils |
| logic | types, utils, compromise |
| compromise | types, utils |
| packaging | types, utils |
| utils | types |
| types | (no dependencies) |

### Forbidden Dependencies

- **types** → Any other module (types should be pure)
- **utils** → services (creates circular dependency)
- **Core modules** → services (services orchestrate modules, not vice versa)
- **Any module** → ui (UI is the top layer)

## Breaking Circular Dependencies

### Strategy 1: Extract Common Interface

When two modules depend on each other, extract a common interface:

```typescript
// Before (circular)
// ModuleA imports ModuleB
// ModuleB imports ModuleA

// After (no circular dependency)
// Create shared interface
interface SharedInterface {
  commonMethod(): void;
}

// ModuleA implements interface
class ModuleA implements SharedInterface {
  commonMethod(): void { /* implementation */ }
}

// ModuleB depends on interface
class ModuleB {
  constructor(private shared: SharedInterface) {}
}
```

### Strategy 2: Move Shared Code

Move shared functionality to a common module:

```typescript
// Before (circular)
// utils → services → utils

// After (no circular dependency)
// Create shared-types module
// utils → shared-types
// services → shared-types, utils
```

### Strategy 3: Use Dependency Injection

Instead of direct imports, use dependency injection:

```typescript
// Before (direct dependency)
import { ServiceA } from './service-a';

class ServiceB {
  private serviceA = new ServiceA();
}

// After (dependency injection)
interface ServiceAInterface {
  doSomething(): void;
}

class ServiceB {
  constructor(private serviceA: ServiceAInterface) {}
}
```

## Validation and Monitoring

### Automated Validation

Run dependency validation as part of your build process:

```bash
# Analyze dependencies
npm run deps:analyze

# Validate dependencies (fails on circular dependencies)
npm run deps:validate
```

### CI/CD Integration

Add dependency validation to your CI/CD pipeline:

```yaml
# .github/workflows/ci.yml
- name: Validate Dependencies
  run: npm run deps:validate
```

### Regular Reviews

- Review dependency graphs monthly
- Monitor for new circular dependencies
- Refactor high-coupling modules
- Update documentation when architecture changes

## Best Practices

### 1. Keep Modules Focused

Each module should have a single, well-defined responsibility.

### 2. Use Interfaces

Define interfaces for module boundaries to reduce coupling.

### 3. Avoid Deep Dependency Chains

Long dependency chains make the system fragile. Aim for shallow hierarchies.

### 4. Document Dependencies

Always document why a dependency exists and what it provides.

### 5. Regular Refactoring

Regularly review and refactor dependencies to maintain clean architecture.

## Tools and Scripts

### Dependency Analysis

```bash
# Generate dependency graphs and documentation
npm run deps:analyze
```

This generates:
- `docs/module-dependencies.md` - Visual dependency graph
- `docs/module-interactions.md` - Detailed interaction documentation
- `docs/dependency-validation.md` - Validation report

### Dependency Validation

```bash
# Validate dependencies (CI-friendly)
npm run deps:validate
```

This script:
- Detects circular dependencies
- Identifies high coupling
- Fails build if issues are found
- Provides actionable recommendations

## Troubleshooting

### Common Issues

1. **Circular Dependencies**: Use the strategies above to break cycles
2. **High Coupling**: Break large modules into smaller, focused modules
3. **Deep Hierarchies**: Flatten dependency chains where possible
4. **Unclear Dependencies**: Add documentation explaining why dependencies exist

### Getting Help

1. Run `npm run deps:analyze` to understand current dependencies
2. Check the generated documentation in `docs/`
3. Review this guide for refactoring strategies
4. Consider architectural patterns like dependency injection
