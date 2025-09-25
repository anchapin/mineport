# JSDoc Templates and Standards

This document provides standardized JSDoc templates for different component types in the Minecraft Mod Converter codebase.

## General Guidelines

- All public classes, methods, and interfaces must have JSDoc comments
- Use consistent terminology and formatting
- Include parameter types, return types, and descriptions
- Document exceptions that may be thrown
- Include examples for complex methods
- Use `@since` tags for version tracking
- Use `@deprecated` tags for deprecated functionality

## Template: Service Classes

```typescript
/**
 * Brief description of the service's purpose and responsibility.
 *
 * Longer description explaining the service's role in the system,
 * key features, and how it integrates with other components.
 *
 * @example
 * ```typescript
 * const service = new ExampleService(options);
 * const result = await service.performOperation(input);
 * ```
 *
 * @since 1.0.0
 */
export class ExampleService {
  /**
   * Creates a new instance of the service.
   *
   * @param options - Configuration options for the service
   * @throws {Error} When required options are missing
   * @since 1.0.0
   */
  constructor(options: ServiceOptions) {
    // Implementation
  }

  /**
   * Brief description of what the method does.
   *
   * Detailed description of the method's behavior, side effects,
   * and any important implementation details.
   *
   * @param input - Description of the input parameter
   * @param options - Optional configuration for the operation
   * @returns Promise resolving to the operation result
   * @throws {ValidationError} When input validation fails
   * @throws {ProcessingError} When processing encounters an error
   *
   * @example
   * ```typescript
   * const result = await service.performOperation(input, { timeout: 5000 });
   * console.log(result.status);
   * ```
   *
   * @since 1.0.0
   */
  public async performOperation(
    input: InputType,
    options?: OperationOptions
  ): Promise<OperationResult> {
    // Implementation
  }
}
```

## Template: Module Classes

```typescript
/**
 * Brief description of the module's conversion responsibility.
 *
 * Detailed description of what type of conversion this module handles,
 * input/output formats, and integration with the conversion pipeline.
 *
 * Implements requirements:
 * - Requirement ID: Brief description
 * - Requirement ID: Brief description
 *
 * @example
 * ```typescript
 * const module = new ConversionModule();
 * const result = await module.convert(input);
 * ```
 *
 * @since 1.0.0
 */
export class ConversionModule {
  /**
   * Converts input from Java format to Bedrock format.
   *
   * Detailed description of the conversion process, including
   * any transformations, validations, or error handling.
   *
   * @param input - Java format input to convert
   * @returns Promise resolving to conversion result with Bedrock output and notes
   * @throws {ConversionError} When conversion fails
   *
   * @example
   * ```typescript
   * const result = await module.convert(javaInput);
   * console.log(result.bedrockOutput);
   * console.log(result.conversionNotes);
   * ```
   *
   * @since 1.0.0
   */
  public async convert(input: JavaInput): Promise<ConversionResult> {
    // Implementation
  }
}
```

## Template: Utility Functions

```typescript
/**
 * Brief description of the utility function's purpose.
 *
 * Detailed description of the function's behavior, use cases,
 * and any important considerations.
 *
 * @param param1 - Description of first parameter
 * @param param2 - Description of second parameter
 * @returns Description of return value
 * @throws {Error} When specific error conditions occur
 *
 * @example
 * ```typescript
 * const result = utilityFunction(value1, value2);
 * console.log(result);
 * ```
 *
 * @since 1.0.0
 */
export function utilityFunction(param1: Type1, param2: Type2): ReturnType {
  // Implementation
}
```

## Template: Interface Definitions

```typescript
/**
 * Brief description of what the interface represents.
 *
 * Detailed description of the interface's purpose, when it's used,
 * and how it fits into the system architecture.
 *
 * @since 1.0.0
 */
export interface ExampleInterface {
  /**
   * Brief description of the property.
   *
   * @since 1.0.0
   */
  property: PropertyType;

  /**
   * Brief description of the method.
   *
   * @param param - Description of parameter
   * @returns Description of return value
   * @since 1.0.0
   */
  method(param: ParamType): ReturnType;
}
```

## Template: Type Definitions

```typescript
/**
 * Brief description of the type and its purpose.
 *
 * Detailed description of when this type is used and
 * what each possible value represents.
 *
 * @since 1.0.0
 */
export type ExampleType = 'value1' | 'value2' | 'value3';

/**
 * Brief description of the complex type.
 *
 * @since 1.0.0
 */
export type ComplexType = {
  /** Description of property */
  property: PropertyType;
  /** Description of optional property */
  optionalProperty?: OptionalType;
};
```

## Template: Error Classes

```typescript
/**
 * Brief description of when this error is thrown.
 *
 * Detailed description of the error conditions and
 * how it should be handled by calling code.
 *
 * @since 1.0.0
 */
export class CustomError extends Error {
  /**
   * Creates a new instance of the error.
   *
   * @param message - Error message
   * @param code - Error code for categorization
   * @param details - Additional error details
   * @since 1.0.0
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CustomError';
  }
}
```

## Template: Configuration Objects

```typescript
/**
 * Configuration options for [ComponentName].
 *
 * Detailed description of how the configuration is used
 * and what each option controls.
 *
 * @since 1.0.0
 */
export interface ComponentOptions {
  /**
   * Brief description of the option.
   *
   * @default defaultValue
   * @since 1.0.0
   */
  option1: OptionType;

  /**
   * Brief description of the optional setting.
   *
   * @default undefined
   * @since 1.0.0
   */
  option2?: OptionalType;
}
```

## Required Tags

### Mandatory Tags
- `@param` - For all parameters
- `@returns` - For all non-void return types
- `@since` - Version when added
- `@throws` - For all possible exceptions

### Conditional Tags
- `@deprecated` - For deprecated functionality
- `@example` - For complex or important methods
- `@default` - For optional parameters with defaults
- `@override` - For overridden methods
- `@readonly` - For readonly properties

### Custom Tags
- `@requirements` - Link to requirements this code implements
- `@module` - Module identifier for error tracking
- `@pipeline` - Pipeline stage this component belongs to

## Validation Rules

1. All public APIs must have complete JSDoc
2. All parameters must be documented
3. All return types must be documented
4. All thrown exceptions must be documented
5. Examples required for complex methods
6. Version tags required for all new additions
7. Deprecated functionality must be marked
8. Requirements traceability must be maintained
