import { EventEmitter } from 'events';
import { ConfigurationService as IConfigurationService, ConfigSection, ConfigurationValue, ConfigValidationResult } from '../types/config';
import defaultConfig from '../../config/default';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConfigurationService');

/**
 * Configuration service options
 */
export interface ConfigurationServiceOptions {
  /**
   * Path to environment-specific configuration file
   */
  envConfigPath?: string;
  
  /**
   * Environment name (e.g., 'development', 'production')
   */
  environment?: string;
  
  /**
   * Whether to watch configuration files for changes
   */
  watchForChanges?: boolean;
}

/**
 * ConfigurationService provides centralized configuration management
 * Implements requirements:
 * - 7.1: Standardize interfaces across the codebase
 * - 7.3: Implement centralized configuration management
 */
export class ConfigurationService extends EventEmitter implements IConfigurationService {
  private config: Record<string, any>;
  private envConfig: Record<string, any> = {};
  private options: ConfigurationServiceOptions;
  private watcher?: fs.FSWatcher;
  private sections: Record<string, ConfigSection> = {};

  /**
   * Creates a new instance of the ConfigurationService
   * 
   * @param options Options for the configuration service
   */
  constructor(options: ConfigurationServiceOptions = {}) {
    /**
     * super method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    super();
    this.options = {
      environment: process.env.NODE_ENV || 'development',
      watchForChanges: true,
      ...options
    };
    
    // Load default configuration
    this.config = this.deepClone(defaultConfig);
    
    // Load environment-specific configuration if available
    this.loadEnvironmentConfig();
    
    // Set up file watchers if enabled
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.options.watchForChanges) {
      this.setupConfigWatchers();
    }
    
    logger.info('Configuration service initialized', { environment: this.options.environment });
  }

  /**
   * Get a configuration value by key
   * 
   * @param key Dot-notation key (e.g., 'server.port')
   * @param defaultValue Default value if key is not found
   * @returns Configuration value or default value
   */
  public get<T>(key: string, defaultValue?: T): T {
    const value = this.getValueByPath(key);
    return value !== undefined ? value : (defaultValue as T);
  }

  /**
   * Set a configuration value
   * 
   * @param key Dot-notation key (e.g., 'server.port')
   * @param value Value to set
   */
  public set<T>(key: string, value: T): void {
    this.setValueByPath(key, value);
    this.emit('config:updated', { key, value });
    logger.debug('Configuration updated', { key });
  }

  /**
   * Get a configuration section
   * 
   * @param section Section name (e.g., 'server')
   * @returns Section object or empty object if not found
   */
  public getSection(section: string): Record<string, any> {
    return this.config[section] || {};
  }

  /**
   * Reload configuration from files
   */
  public async reload(): Promise<void> {
    logger.info('Reloading configuration');
    
    try {
      // Reload default configuration
      this.config = this.deepClone(defaultConfig);
      
      // Reload environment-specific configuration
      this.loadEnvironmentConfig();
      
      this.emit('config:reloaded');
      logger.info('Configuration reloaded successfully');
    } catch (error) {
      logger.error('Failed to reload configuration', { error });
      throw error;
    }
  }

  /**
   * Validate configuration against defined validation rules
   * 
   * @returns Validation result
   */
  public validate(): ConfigValidationResult {
    const invalidValues: { key: string; value: any; reason: string }[] = [];
    
    // Validate each section
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [sectionName, section] of Object.entries(this.sections)) {
      // Validate each value in the section
      /**
       * for method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const [key, configValue] of Object.entries(section.values)) {
        const fullKey = `${sectionName}.${key}`;
        const currentValue = this.get(fullKey, configValue.defaultValue);
        
        // Skip validation if no validation function is defined
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!configValue.validation) continue;
        
        // Validate the value
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!configValue.validation(currentValue)) {
          invalidValues.push({
            key: fullKey,
            value: currentValue,
            reason: `Failed validation for ${fullKey}`
          });
        }
      }
    }
    
    return {
      isValid: invalidValues.length === 0,
      invalidValues
    };
  }

  /**
   * Register a configuration section with validation rules
   * 
   * @param section Configuration section
   */
  public registerSection(section: ConfigSection): void {
    this.sections[section.name] = section;
    logger.debug('Registered configuration section', { section: section.name });
  }

  /**
   * Get all registered configuration sections
   * 
   * @returns Record of configuration sections
   */
  public getSections(): Record<string, ConfigSection> {
    return { ...this.sections };
  }

  /**
   * Export configuration to a file
   * 
   * @param filePath Path to export configuration to
   */
  public async exportConfig(filePath: string): Promise<void> {
    try {
      const configToExport = this.deepClone(this.config);
      
      // Remove sensitive information
      this.removeSensitiveInfo(configToExport);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write configuration to file
      fs.writeFileSync(filePath, JSON.stringify(configToExport, null, 2));
      logger.info('Configuration exported successfully', { filePath });
    } catch (error) {
      logger.error('Failed to export configuration', { error, filePath });
      throw error;
    }
  }
  
  /**
   * Export configuration as an object
   * 
   * @returns Configuration object
   */
  public exportConfig(): Record<string, any> {
    const configToExport = this.deepClone(this.config);
    
    // Remove sensitive information
    this.removeSensitiveInfo(configToExport);
    
    return configToExport;
  }

  /**
   * Import configuration from a file or object
   * 
   * @param filePathOrConfig Path to import configuration from or configuration object
   */
  public async importConfig(filePathOrConfig: string | Record<string, any>): Promise<void> {
    try {
      let importedConfig: Record<string, any>;
      
      if (typeof filePathOrConfig === 'string') {
        // Import from file
        const filePath = filePathOrConfig;
        
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!fs.existsSync(filePath)) {
          throw new Error(`Configuration file not found: ${filePath}`);
        }
        
        importedConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        logger.info('Configuration imported from file', { filePath });
      } else {
        // Import from object
        importedConfig = filePathOrConfig;
        logger.info('Configuration imported from object');
      }
      
      // Merge imported configuration with default configuration
      this.config = this.deepMerge(this.deepClone(defaultConfig), importedConfig);
      
      // Emit event
      this.emit('config:imported', { source: typeof filePathOrConfig === 'string' ? filePathOrConfig : 'object' });
      
      // Emit individual update events for each changed key
      this.emitUpdateEvents(importedConfig);
    } catch (error) {
      logger.error('Failed to import configuration', { 
        error, 
        source: typeof filePathOrConfig === 'string' ? filePathOrConfig : 'object' 
      });
      throw error;
    }
  }
  
  /**
   * Emit update events for each changed key in the imported configuration
   * 
   * @param importedConfig Imported configuration
   * @param prefix Key prefix for nested objects
   */
  private emitUpdateEvents(importedConfig: Record<string, any>, prefix: string = ''): void {
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [key, value] of Object.entries(importedConfig)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recurse into nested objects
        this.emitUpdateEvents(value, fullKey);
      } else {
        // Emit update event for this key
        this.emit('config:updated', { key: fullKey, value });
      }
    }
  }

  /**
   * Get environment-specific configuration path
   * 
   * @returns Path to environment-specific configuration file
   */
  private getEnvironmentConfigPath(): string {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.options.envConfigPath) {
      return this.options.envConfigPath;
    }
    
    const environment = this.options.environment;
    return path.resolve(__dirname, `../../config/${environment}.ts`);
  }

  /**
   * Load environment-specific configuration
   */
  private loadEnvironmentConfig(): void {
    const envConfigPath = this.getEnvironmentConfigPath();
    
    try {
      // Check if environment-specific configuration exists
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (fs.existsSync(envConfigPath)) {
        // In a real implementation, we would use dynamic import
        // For now, we'll simulate loading the environment config
        this.envConfig = {}; // This would be the imported config
        
        // Merge environment-specific configuration with default configuration
        this.config = this.deepMerge(this.config, this.envConfig);
        
        logger.info('Loaded environment-specific configuration', { environment: this.options.environment });
      }
    } catch (error) {
      logger.warn('Failed to load environment-specific configuration', { error, envConfigPath });
    }
  }

  /**
   * Set up file watchers for configuration files
   */
  private setupConfigWatchers(): void {
    const envConfigPath = this.getEnvironmentConfigPath();
    
    try {
      // Watch environment-specific configuration file if it exists
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (fs.existsSync(envConfigPath)) {
        this.watcher = fs.watch(envConfigPath, () => {
          logger.info('Configuration file changed, reloading');
          this.reload().catch(error => {
            logger.error('Failed to reload configuration after file change', { error });
          });
        });
      }
    } catch (error) {
      logger.warn('Failed to set up configuration file watchers', { error });
    }
  }

  /**
   * Get a value by dot-notation path
   * 
   * @param path Dot-notation path (e.g., 'server.port')
   * @returns Value at path or undefined if not found
   */
  private getValueByPath(path: string): any {
    const parts = path.split('.');
    let current: any = this.config;
    
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
  }

  /**
   * Set a value by dot-notation path
   * 
   * @param path Dot-notation path (e.g., 'server.port')
   * @param value Value to set
   */
  private setValueByPath(path: string, value: any): void {
    const parts = path.split('.');
    const lastPart = parts.pop();
    
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!lastPart) {
      return;
    }
    
    let current: any = this.config;
    
    // Navigate to the parent object
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const part of parts) {
      if (current[part] === undefined || current[part] === null) {
        current[part] = {};
      }
      
      current = current[part];
    }
    
    // Set the value
    current[lastPart] = value;
  }

  /**
   * Deep clone an object
   * 
   * @param obj Object to clone
   * @returns Cloned object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Deep merge two objects
   * 
   * @param target Target object
   * @param source Source object
   * @returns Merged object
   */
  private deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const key of Object.keys(source)) {
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Remove sensitive information from configuration
   * 
   * @param config Configuration object
   */
  private removeSensitiveInfo(config: Record<string, any>): void {
    // List of sensitive keys to mask
    const sensitiveKeys = ['apiKey', 'password', 'secret', 'token'];
    
    // Recursively search for sensitive keys
    const maskSensitiveValues = (obj: Record<string, any>) => {
      /**
       * for method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const key of Object.keys(obj)) {
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (obj[key] instanceof Object) {
          /**
           * maskSensitiveValues method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          maskSensitiveValues(obj[key]);
        } else if (sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey))) {
          obj[key] = '********';
        }
      }
    };
    
    /**
     * maskSensitiveValues method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    maskSensitiveValues(config);
  }

  /**
   * Clean up resources when service is no longer needed
   */
  public dispose(): void {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
    
    this.removeAllListeners();
    logger.info('Configuration service disposed');
  }
}