# Dependency Validation Report

Generated on: 2025-09-23T06:42:26.225Z

## Summary

- **Total Modules Analyzed**: 12
- **Total Dependencies**: 29
- **Circular Dependencies**: 9

## Validation Results

❌ **FAIL**: 9 circular dependencies detected

### Circular Dependencies

1. `utils → services → modules/logic → utils`
2. `modules/logic → modules/compromise → types → modules/logic`
3. `utils → services → modules/logic → modules/compromise → modules/ingestion → utils`
4. `services → modules/logic → modules/compromise → modules/ingestion → services`
5. `utils → services → modules/logic → modules/compromise → utils`
6. `utils → services → utils`
7. `modules/assets → utils → services → modules/assets`
8. `utils → services → modules/configuration → utils`
9. `utils → services → modules/packaging → utils`

### Recommendations

- Review the circular dependencies listed above
- Consider refactoring to break circular dependencies
- Move shared functionality to a common module
- Use dependency injection to reduce coupling

⚠️ **WARNING**: High coupling detected in 1 modules

### High Coupling Modules

- **services**: 8 dependencies

### Recommendations

- Consider breaking down highly coupled modules
- Use interfaces to reduce direct dependencies
- Apply the Single Responsibility Principle

## Module Dependency Details

### modules/assets
- **Dependency Count**: 2
- **Dependencies**: utils, types
- **Dependents**: services

### modules/compromise
- **Dependency Count**: 3
- **Dependencies**: types, modules/ingestion, utils
- **Dependents**: modules/logic

### modules/configuration
- **Dependency Count**: 2
- **Dependencies**: utils, types
- **Dependents**: services

### modules/conversion-agents
- **Dependency Count**: 1
- **Dependencies**: types
- **Dependents**: services

### modules/ingestion
- **Dependency Count**: 3
- **Dependencies**: utils, types, services
- **Dependents**: modules/compromise, services

### modules/logic
- **Dependency Count**: 3
- **Dependencies**: utils, modules/compromise, types
- **Dependents**: services, types

### modules/packaging
- **Dependency Count**: 2
- **Dependencies**: types, utils
- **Dependents**: services

### modules/ui
- **Dependency Count**: 2
- **Dependencies**: types, utils
- **Dependents**: None

### services
- **Dependency Count**: 8
- **Dependencies**: modules/logic, types, utils, modules/assets, modules/ingestion, modules/configuration, modules/packaging, modules/conversion-agents
- **Dependents**: modules/ingestion, utils

### types
- **Dependency Count**: 1
- **Dependencies**: modules/logic
- **Dependents**: modules/assets, modules/compromise, modules/configuration, modules/conversion-agents, modules/ingestion, modules/logic, modules/packaging, modules/ui, services, utils

### utils
- **Dependency Count**: 2
- **Dependencies**: services, types
- **Dependents**: modules/assets, modules/compromise, modules/configuration, modules/ingestion, modules/logic, modules/packaging, modules/ui, services

