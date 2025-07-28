# Dependency Validation Report

Generated on: 2025-07-27T12:34:25.369Z

## Summary

- **Total Modules Analyzed**: 11
- **Total Dependencies**: 23
- **Circular Dependencies**: 7

## Validation Results

❌ **FAIL**: 7 circular dependencies detected

### Circular Dependencies

1. `utils → services → utils`
2. `modules/assets → utils → services → modules/assets`
3. `utils → services → modules/logic → modules/compromise → utils`
4. `utils → services → modules/logic → utils`
5. `utils → services → modules/ingestion → utils`
6. `utils → services → modules/configuration → utils`
7. `utils → services → modules/packaging → utils`

### Recommendations

- Review the circular dependencies listed above
- Consider refactoring to break circular dependencies
- Move shared functionality to a common module
- Use dependency injection to reduce coupling

⚠️ **WARNING**: High coupling detected in 1 modules

### High Coupling Modules

- **services**: 7 dependencies

### Recommendations

- Consider breaking down highly coupled modules
- Use interfaces to reduce direct dependencies
- Apply the Single Responsibility Principle

## Module Dependency Details

### modules/assets
- **Dependency Count**: 1
- **Dependencies**: utils
- **Dependents**: services

### modules/compromise
- **Dependency Count**: 2
- **Dependencies**: types, utils
- **Dependents**: modules/logic, modules/ui

### modules/configuration
- **Dependency Count**: 1
- **Dependencies**: utils
- **Dependents**: services

### modules/ingestion
- **Dependency Count**: 1
- **Dependencies**: utils
- **Dependents**: services

### modules/logic
- **Dependency Count**: 3
- **Dependencies**: modules/compromise, types, utils
- **Dependents**: services

### modules/packaging
- **Dependency Count**: 2
- **Dependencies**: utils, types
- **Dependents**: services

### modules/ui
- **Dependency Count**: 4
- **Dependencies**: services, modules/compromise, types, utils
- **Dependents**: None

### services
- **Dependency Count**: 7
- **Dependencies**: utils, types, modules/assets, modules/logic, modules/ingestion, modules/configuration, modules/packaging
- **Dependents**: modules/ui, utils

### utils
- **Dependency Count**: 2
- **Dependencies**: services, types
- **Dependents**: modules/assets, modules/compromise, modules/configuration, modules/ingestion, modules/logic, modules/packaging, modules/ui, services

