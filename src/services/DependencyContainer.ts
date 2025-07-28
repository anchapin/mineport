/**
 * Dependency Injection Container
 * 
 * This service provides dependency injection capabilities for the module system.
 * It manages the lifecycle of dependencies and provides them to modules as needed.
 */

import { DependencyContainer } from '../types/modules';
import { createLogger } from '../utils/logger';

const logger = createLogger('DependencyContainer');

/**
 * Dependency factory function type
 */
type DependencyFactory<T> = () => T;

/**
 * Dependency registration entry
 */
interface DependencyEntry<T = any> {
  instance?: T;
  factory?: DependencyFactory<T>;
  singleton?: boolean;
  initialized?: boolean;
}

/**
 * Implementation of the dependency injection container
 */
export class DependencyContainerImpl implements DependencyContainer {
  private dependencies = new Map<string, DependencyEntry>();
  
  /**
   * Get a dependency by its identifier
   */
  public get<T>(identifier: string): T {
    const entry = this.dependencies.get(identifier);
    
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!entry) {
      throw new Error(`Dependency not found: ${identifier}`);
    }
    
    // Return existing instance if available
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (entry.instance) {
      return entry.instance as T;
    }
    
    // Create instance from factory
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (entry.factory) {
      const instance = entry.factory() as T;
      
      // Store instance if it's a singleton
      if (entry.singleton !== false) {
        entry.instance = instance;
        entry.initialized = true;
      }
      
      logger.debug(`Created dependency instance: ${identifier}`);
      return instance;
    }
    
    throw new Error(`No instance or factory available for dependency: ${identifier}`);
  }
  
  /**
   * Check if a dependency is available
   */
  public has(identifier: string): boolean {
    return this.dependencies.has(identifier);
  }
  
  /**
   * Register a dependency instance
   */
  public register<T>(identifier: string, instance: T): void {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.dependencies.has(identifier)) {
      logger.warn(`Overriding existing dependency: ${identifier}`);
    }
    
    this.dependencies.set(identifier, {
      instance,
      singleton: true,
      initialized: true
    });
    
    logger.debug(`Registered dependency: ${identifier}`);
  }
  
  /**
   * Register a factory function for lazy initialization
   */
  public registerFactory<T>(identifier: string, factory: DependencyFactory<T>, singleton: boolean = true): void {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.dependencies.has(identifier)) {
      logger.warn(`Overriding existing dependency: ${identifier}`);
    }
    
    this.dependencies.set(identifier, {
      factory,
      singleton,
      initialized: false
    });
    
    logger.debug(`Registered dependency factory: ${identifier}`);
  }
  
  /**
   * Register a singleton factory (default behavior)
   */
  public registerSingleton<T>(identifier: string, factory: DependencyFactory<T>): void {
    this.registerFactory(identifier, factory, true);
  }
  
  /**
   * Register a transient factory (new instance each time)
   */
  public registerTransient<T>(identifier: string, factory: DependencyFactory<T>): void {
    this.registerFactory(identifier, factory, false);
  }
  
  /**
   * Remove a dependency
   */
  public remove(identifier: string): boolean {
    const removed = this.dependencies.delete(identifier);
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (removed) {
      logger.debug(`Removed dependency: ${identifier}`);
    }
    return removed;
  }
  
  /**
   * Clear all dependencies
   */
  public clear(): void {
    this.dependencies.clear();
    logger.debug('Cleared all dependencies');
  }
  
  /**
   * Get all registered dependency identifiers
   */
  public getRegisteredIdentifiers(): string[] {
    return Array.from(this.dependencies.keys());
  }
  
  /**
   * Get dependency information for debugging
   */
  public getDependencyInfo(identifier: string): any {
    const entry = this.dependencies.get(identifier);
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!entry) {
      return null;
    }
    
    return {
      identifier,
      hasInstance: !!entry.instance,
      hasFactory: !!entry.factory,
      singleton: entry.singleton,
      initialized: entry.initialized
    };
  }
  
  /**
   * Get all dependency information for debugging
   */
  public getAllDependencyInfo(): any[] {
    return Array.from(this.dependencies.keys()).map(id => this.getDependencyInfo(id));
  }
}