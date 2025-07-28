# Module Dependency Graph

This document shows the dependencies between modules in the Minecraft Mod Converter.

## Dependency Graph

```mermaid
graph TD
    assets[modules/assets]
    compromise[modules/compromise]
    configuration[modules/configuration]
    index.ts[modules/index.ts]
    ingestion[modules/ingestion]
    logic[modules/logic]
    packaging[modules/packaging]
    ui[modules/ui]
    services[services]
    types[types]
    utils[utils]

    assets --> utils
    compromise --> types
    compromise --> utils
    configuration --> utils
    ingestion --> utils
    logic --> compromise
    logic --> types
    logic --> utils
    packaging --> utils
    packaging --> types
    ui --> services
    ui --> compromise
    ui --> types
    ui --> utils
    services --> utils
    services --> types
    services --> assets
    services --> logic
    services --> ingestion
    services --> configuration
    services --> packaging
    utils --> services
    utils --> types
```


## Module Descriptions

- **modules/assets**: Handles conversion of textures, models, sounds, and particles
- **modules/compromise**: Implements smart compromise strategies for unsupported features
- **modules/configuration**: Converts manifests, recipes, and configuration files
- **modules/index.ts**: Module description not available
- **modules/ingestion**: Validates and analyzes input Java mods
- **modules/logic**: Transpiles Java code to JavaScript
- **modules/packaging**: Packages and validates the final addon
- **modules/ui**: Provides the React-based user interface
- **services**: Core application services and infrastructure
- **types**: TypeScript type definitions
- **utils**: Utility functions and helpers

## Dependency Analysis

- **Total Modules**: 11
- **Total Dependencies**: 23
- **Circular Dependencies**: 7


## ⚠️ Circular Dependencies Detected


### Circular Dependency 1
`utils → services → utils`

### Circular Dependency 2
`modules/assets → utils → services → modules/assets`

### Circular Dependency 3
`utils → services → modules/logic → modules/compromise → utils`

### Circular Dependency 4
`utils → services → modules/logic → utils`

### Circular Dependency 5
`utils → services → modules/ingestion → utils`

### Circular Dependency 6
`utils → services → modules/configuration → utils`

### Circular Dependency 7
`utils → services → modules/packaging → utils`


