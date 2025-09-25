# Module Interactions Documentation

This document describes how modules interact with each other in the Minecraft Mod Converter.

## Module Dependency Matrix

| Module | Dependencies | Dependents |
|--------|-------------|------------|
| modules/assets | utils, types | services |
| modules/compromise | types, modules/ingestion, utils | modules/logic |
| modules/configuration | utils, types | services |
| modules/conversion-agents | types | services |
| modules/index.ts | None | None |
| modules/ingestion | utils, types, services | modules/compromise, services |
| modules/logic | utils, modules/compromise, types | services, types |
| modules/packaging | types, utils | services |
| modules/ui | types, utils | None |
| services | modules/logic, types, utils, modules/assets, modules/ingestion, modules/configuration, modules/packaging, modules/conversion-agents | modules/ingestion, utils |
| types | modules/logic | modules/assets, modules/compromise, modules/configuration, modules/conversion-agents, modules/ingestion, modules/logic, modules/packaging, modules/ui, services, utils |
| utils | services, types | modules/assets, modules/compromise, modules/configuration, modules/ingestion, modules/logic, modules/packaging, modules/ui, services |

## Detailed Module Interactions

### modules/assets

**Dependencies**: utils, types

**Interaction Details**:
- Uses **utils** for shared functionality
- Uses **types** for shared functionality

### modules/compromise

**Dependencies**: types, modules/ingestion, utils

**Interaction Details**:
- Uses **types** for shared functionality
- Uses **modules/ingestion** for shared functionality
- Uses **utils** for shared functionality

### modules/configuration

**Dependencies**: utils, types

**Interaction Details**:
- Uses **utils** for shared functionality
- Uses **types** for shared functionality

### modules/conversion-agents

**Dependencies**: types

**Interaction Details**:
- Uses **types** for shared functionality

### modules/ingestion

**Dependencies**: utils, types, services

**Interaction Details**:
- Uses **utils** for shared functionality
- Uses **types** for shared functionality
- Uses **services** for shared functionality

### modules/logic

**Dependencies**: utils, modules/compromise, types

**Interaction Details**:
- Uses **utils** for shared functionality
- Uses **modules/compromise** for shared functionality
- Uses **types** for shared functionality

### modules/packaging

**Dependencies**: types, utils

**Interaction Details**:
- Uses **types** for shared functionality
- Uses **utils** for shared functionality

### modules/ui

**Dependencies**: types, utils

**Interaction Details**:
- Uses **types** for type definitions
- Uses **utils** for shared functionality

### services

**Dependencies**: modules/logic, types, utils, modules/assets, modules/ingestion, modules/configuration, modules/packaging, modules/conversion-agents

**Interaction Details**:
- Uses **modules/logic** for code translation
- Uses **types** for type definitions
- Uses **utils** for utility functions and logging
- Uses **modules/assets** for asset conversion orchestration
- Uses **modules/ingestion** for mod validation and analysis
- Uses **modules/configuration** for configuration processing
- Uses **modules/packaging** for addon packaging and validation
- Uses **modules/conversion-agents** for shared functionality

### types

**Dependencies**: modules/logic

**Interaction Details**:
- Uses **modules/logic** for shared functionality

### utils

**Dependencies**: services, types

**Interaction Details**:
- Uses **services** for shared functionality
- Uses **types** for shared functionality

