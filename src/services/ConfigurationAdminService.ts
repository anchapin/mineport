import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationService } from './ConfigurationService';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConfigurationAdminService');

/**
 * Configuration version information
 */
export interface ConfigurationVersion {
  /**
   * Version identifier
   */
  id: string;
  
  /**
   * Timestamp when the version was created
   */
  timestamp: Date;
  
  /**
   * User who created the version
   */
  user?: string;
  
  /**
   * Description of the version
   */
  description?: string;
  
  /**
   * Configuration data
   */
  config: Record<string, any>;
}

/**
 * Configuration admin service options
 */
export interface ConfigurationAdminServiceOptions {
  /**
   * Configuration service to manage
   */
  configService: ConfigurationService;
  
  /**
   * Path to store configuration versions
   */
  versionsPath?: string;
  
  /**
   * Maximum number of versions to keep
   */
  maxVersions?: number;
}

/**
 * ConfigurationAdminService provides functionality for managing configuration versions
 * and dynamic configuration updates.
 * 
 * Implements requirement 7.3: Implement dynamic configuration updates
 */
export class ConfigurationAdminService extends EventEmitter {
  private configService: ConfigurationService;
  private versionsPath: string;
  private maxVersions: number;
  private versions: ConfigurationVersion[] = [];
  
  /**
   * Creates a new instance of the ConfigurationAdminService
   * 
   * @param options Options for the configuration admin service
   */
  constructor(options: ConfigurationAdminServiceOptions) {
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
    this.configService = options.configService;
    this.versionsPath = options.versionsPath || path.resolve(__dirname, '../../config/versions');
    this.maxVersions = options.maxVersions || 10;
    
    // Ensure versions directory exists
    this.ensureVersionsDirectory();
    
    // Load existing versions
    this.loadVersions();
    
    logger.info('ConfigurationAdminService initialized', { 
      versionsPath: this.versionsPath,
      maxVersions: this.maxVersions,
      loadedVersions: this.versions.length
    });
  }
  
  /**
   * Create a new configuration version
   * 
   * @param description Description of the version
   * @param user User who created the version
   * @returns Created version
   */
  public async createVersion(description?: string, user?: string): Promise<ConfigurationVersion> {
    // Create version object
    const version: ConfigurationVersion = {
      id: this.generateVersionId(),
      timestamp: new Date(),
      user,
      description,
      config: this.configService.exportConfig(),
    };
    
    // Add to versions list
    this.versions.push(version);
    
    // Sort versions by timestamp (newest first)
    this.versions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Prune old versions if needed
    this.pruneVersions();
    
    // Save version to disk
    await this.saveVersion(version);
    
    // Emit event
    this.emit('version:created', version);
    
    logger.info('Created configuration version', { 
      id: version.id, 
      description: version.description 
    });
    
    return version;
  }
  
  /**
   * Get all configuration versions
   * 
   * @returns Array of configuration versions
   */
  public getVersions(): ConfigurationVersion[] {
    return [...this.versions];
  }
  
  /**
   * Get a specific configuration version
   * 
   * @param id Version ID
   * @returns Configuration version or undefined if not found
   */
  public getVersion(id: string): ConfigurationVersion | undefined {
    return this.versions.find(v => v.id === id);
  }
  
  /**
   * Apply a configuration version
   * 
   * @param id Version ID
   * @returns True if version was applied, false otherwise
   */
  public async applyVersion(id: string): Promise<boolean> {
    const version = this.getVersion(id);
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!version) {
      logger.warn('Version not found', { id });
      return false;
    }
    
    try {
      // Apply configuration
      await this.configService.importConfig(version.config);
      
      // Emit event
      this.emit('version:applied', version);
      
      logger.info('Applied configuration version', { id: version.id });
      return true;
    } catch (error) {
      logger.error('Failed to apply configuration version', { id: version.id, error });
      return false;
    }
  }
  
  /**
   * Delete a configuration version
   * 
   * @param id Version ID
   * @returns True if version was deleted, false otherwise
   */
  public async deleteVersion(id: string): Promise<boolean> {
    const versionIndex = this.versions.findIndex(v => v.id === id);
    if (versionIndex === -1) {
      logger.warn('Version not found', { id });
      return false;
    }
    
    const version = this.versions[versionIndex];
    
    try {
      // Remove from versions list
      this.versions.splice(versionIndex, 1);
      
      // Delete version file
      const versionPath = path.join(this.versionsPath, `${version.id}.json`);
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (fs.existsSync(versionPath)) {
        fs.unlinkSync(versionPath);
      }
      
      // Emit event
      this.emit('version:deleted', version);
      
      logger.info('Deleted configuration version', { id: version.id });
      return true;
    } catch (error) {
      logger.error('Failed to delete configuration version', { id: version.id, error });
      return false;
    }
  }
  
  /**
   * Compare two configuration versions
   * 
   * @param id1 First version ID
   * @param id2 Second version ID
   * @returns Differences between versions
   */
  public compareVersions(id1: string, id2: string): Record<string, { before: any; after: any }> {
    const version1 = this.getVersion(id1);
    const version2 = this.getVersion(id2);
    
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }
    
    return this.findDifferences(version1.config, version2.config);
  }
  
  /**
   * Find differences between two configuration objects
   * 
   * @param obj1 First object
   * @param obj2 Second object
   * @param path Current path (for recursion)
   * @returns Differences between objects
   */
  private findDifferences(
    obj1: Record<string, any>, 
    obj2: Record<string, any>, 
    path: string = ''
  ): Record<string, { before: any; after: any }> {
    const differences: Record<string, { before: any; after: any }> = {};
    
    // Get all keys from both objects
    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const key of keys) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check if key exists in both objects
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!(key in obj1)) {
        // Key only in obj2
        differences[currentPath] = { before: undefined, after: obj2[key] };
      } else if (!(key in obj2)) {
        // Key only in obj1
        differences[currentPath] = { before: obj1[key], after: undefined };
      } else if (typeof obj1[key] !== typeof obj2[key]) {
        // Different types
        differences[currentPath] = { before: obj1[key], after: obj2[key] };
      } else if (typeof obj1[key] === 'object' && obj1[key] !== null && obj2[key] !== null) {
        // Both are objects, recurse
        const nestedDifferences = this.findDifferences(obj1[key], obj2[key], currentPath);
        Object.assign(differences, nestedDifferences);
      } else if (obj1[key] !== obj2[key]) {
        // Different values
        differences[currentPath] = { before: obj1[key], after: obj2[key] };
      }
    }
    
    return differences;
  }
  
  /**
   * Ensure versions directory exists
   */
  private ensureVersionsDirectory(): void {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(this.versionsPath)) {
      fs.mkdirSync(this.versionsPath, { recursive: true });
      logger.info('Created versions directory', { path: this.versionsPath });
    }
  }
  
  /**
   * Load existing versions from disk
   */
  private loadVersions(): void {
    try {
      // Get all version files
      const files = fs.readdirSync(this.versionsPath)
        .filter(file => file.endsWith('.json'));
      
      // Load each version
      /**
       * for method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const file of files) {
        try {
          const filePath = path.join(this.versionsPath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const version = JSON.parse(content) as ConfigurationVersion;
          
          // Convert timestamp string to Date
          version.timestamp = new Date(version.timestamp);
          
          this.versions.push(version);
        } catch (error) {
          logger.warn('Failed to load version file', { file, error });
        }
      }
      
      // Sort versions by timestamp (newest first)
      this.versions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      logger.info('Loaded configuration versions', { count: this.versions.length });
    } catch (error) {
      logger.error('Failed to load configuration versions', { error });
    }
  }
  
  /**
   * Save a version to disk
   * 
   * @param version Version to save
   */
  private async saveVersion(version: ConfigurationVersion): Promise<void> {
    try {
      const filePath = path.join(this.versionsPath, `${version.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(version, null, 2));
      logger.debug('Saved configuration version', { id: version.id, path: filePath });
    } catch (error) {
      logger.error('Failed to save configuration version', { id: version.id, error });
      throw error;
    }
  }
  
  /**
   * Prune old versions if needed
   */
  private pruneVersions(): void {
    if (this.versions.length <= this.maxVersions) {
      return;
    }
    
    // Get versions to delete
    const versionsToDelete = this.versions.slice(this.maxVersions);
    
    // Delete each version
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const version of versionsToDelete) {
      try {
        const filePath = path.join(this.versionsPath, `${version.id}.json`);
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        logger.debug('Pruned old configuration version', { id: version.id });
      } catch (error) {
        logger.warn('Failed to prune old configuration version', { id: version.id, error });
      }
    }
    
    // Update versions list
    this.versions = this.versions.slice(0, this.maxVersions);
  }
  
  /**
   * Generate a unique version ID
   * 
   * @returns Version ID
   */
  private generateVersionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `v${timestamp}_${random}`;
  }
}