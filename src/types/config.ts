/**
 * Configuration-related type definitions
 * 
 * This file contains interfaces related to application configuration,
 * settings management, and validation.
 */

/**
 * Represents a configuration value
 */
export interface ConfigurationValue<T> {
  key: string;
  value: T;
  defaultValue: T;
  description?: string;
  validation?: (value: T) => boolean;
}

/**
 * Represents a configuration section
 */
export interface ConfigSection {
  name: string;
  description?: string;
  values: Record<string, ConfigurationValue<any>>;
}

/**
 * Represents a configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  invalidValues: {
    key: string;
    value: any;
    reason: string;
  }[];
}

/**
 * Interface for configuration service
 * 
 * This interface aligns with the design document's ConfigurationService specification.
 */
export interface ConfigurationService {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  /**
   * getSection method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getSection(section: string): Record<string, any>;
  /**
   * reload method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  reload(): Promise<void>;
  /**
   * validate method.
   * 
   * TODO: Add detailed description of the method's purpose and behavior.
   * 
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  validate(): ConfigValidationResult;
}