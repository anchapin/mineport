# Naming Convention Guidelines

This document outlines the naming conventions to be used throughout the Minecraft Mod Converter codebase to ensure consistency and readability.

## Interface Naming Conventions

1. **Interface Names**
   - Use PascalCase for interface names
   - Use descriptive names that clearly indicate the purpose of the interface
   - Avoid abbreviations unless they are widely understood
   - For interfaces representing services, use the suffix `Service` (e.g., `ConfigurationService`)
   - For interfaces representing data models, use a noun that describes the data (e.g., `JavaMod`)
   - For interfaces representing results, use the suffix `Result` (e.g., `ConversionResult`)
   - For interfaces representing options or configurations, use the suffix `Options` or `Config` (e.g., `ConversionOptions`)

2. **Property Names**
   - Use camelCase for property names
   - Use descriptive names that clearly indicate the purpose of the property
   - Use consistent terminology across related interfaces
   - For boolean properties, use prefixes like `is`, `has`, `should`, or `can` (e.g., `isValid`, `hasErrors`)
   - For collections, use plural names (e.g., `errors`, `warnings`)
   - For dates, use suffixes like `At`, `Date`, or `Time` (e.g., `createdAt`, `completionTime`)

3. **Method Names**
   - Use camelCase for method names
   - Use verbs or verb phrases that clearly indicate the action (e.g., `convertTextures`, `getErrors`)
   - For getters, use the prefix `get` (e.g., `getConfig`)
   - For setters, use the prefix `set` (e.g., `setConfig`)
   - For boolean methods, use prefixes like `is`, `has`, `should`, or `can` (e.g., `isValid`, `hasErrors`)
   - For methods that return a new instance, use prefixes like `create` or `build` (e.g., `createInstance`)
   - For methods that modify the instance, use prefixes like `update` or `modify` (e.g., `updateConfig`)

## Enum Naming Conventions

1. **Enum Names**
   - Use PascalCase for enum names
   - Use singular nouns for enum names (e.g., `ConversionType`, `Severity`)

2. **Enum Values**
   - Use lowercase for enum values (e.g., `'info'`, `'warning'`, `'error'`)
   - For complex enum values, use snake_case (e.g., `'not_found'`, `'permission_denied'`)

## Type Naming Conventions

1. **Type Names**
   - Use PascalCase for type names
   - For union types, use descriptive names that indicate the purpose (e.g., `ConversionType`)
   - For type aliases, use names that clearly indicate the purpose (e.g., `JobStatus`)

## File Naming Conventions

1. **Type Definition Files**
   - Use lowercase for file names
   - Use kebab-case for multi-word file names (e.g., `api-types.ts`)
   - Group related types in a single file with a descriptive name (e.g., `assets.ts` for asset-related types)

## Import Conventions

1. **Import Statements**
   - Group imports by source (e.g., external libraries, internal modules, local files)
   - Sort imports alphabetically within each group
   - Use named imports for specific types (e.g., `import { ConversionError } from './errors'`)
   - Use namespace imports sparingly and only when importing many types from a single source (e.g., `import * as Types from './types'`)

## Documentation Conventions

1. **Interface Documentation**
   - Document all interfaces with a clear description of their purpose
   - Use JSDoc format for documentation
   - Include `@interface` tag for interfaces
   - Include `@property` tags for each property with descriptions
   - Include `@example` tags where appropriate

2. **Method Documentation**
   - Document all methods with a clear description of their purpose
   - Use JSDoc format for documentation
   - Include `@param` tags for each parameter with descriptions
   - Include `@returns` tag with description of the return value
   - Include `@throws` tags for any exceptions that may be thrown
   - Include `@example` tags where appropriate

## Consistency Rules

1. **Terminology Consistency**
   - Use consistent terminology across the codebase
   - Maintain a glossary of terms to ensure consistency
   - Avoid synonyms for the same concept (e.g., use either `error` or `issue`, not both)

2. **Abbreviation Consistency**
   - Use consistent abbreviations across the codebase
   - Maintain a list of approved abbreviations
   - Avoid creating new abbreviations unless necessary

3. **Prefix/Suffix Consistency**
   - Use consistent prefixes and suffixes across the codebase
   - For related interfaces, use consistent prefixes (e.g., `Java*` and `Bedrock*` for asset types)
   - For related methods, use consistent prefixes (e.g., `convert*` for conversion methods)

By following these naming conventions, we ensure that the codebase remains consistent, readable, and maintainable as it grows and evolves.