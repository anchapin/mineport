/**
 * Module Registry
 *
 * This service manages the registration, initialization, and lifecycle of all modules
 * in the Minecraft Mod Converter application.
 */

import {
  Module,
  ModuleRegistry,
  ModuleConfig,
  ModuleConstructor,
  ModuleState,
  DependencyContainer,
} from '../types/modules.js';
import { DependencyContainerImpl } from './DependencyContainer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ModuleRegistry');

/**
 * Module registration entry
 */
interface ModuleEntry {
  moduleClass: ModuleConstructor;
  config: ModuleConfig;
  instance?: Module;
}

/**
 * Implementation of the module registry
 */
export class ModuleRegistryImpl implements ModuleRegistry {
  private modules = new Map<string, ModuleEntry>();
  private dependencyContainer: DependencyContainer;
  private initializationOrder: string[] = [];

  /**
   * constructor method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  constructor(dependencyContainer?: DependencyContainer) {
    this.dependencyContainer = dependencyContainer || new DependencyContainerImpl();
  }

  /**
   * Register a module
   * @param moduleClass - The module constructor class
   * @param config - Module configuration including ID, name, and dependencies
   * @returns void
   * @throws {Error} When module is already registered
   */
  public register(moduleClass: ModuleConstructor, config: ModuleConfig): void {
    if (this.modules.has(config.id)) {
      throw new Error(`Module already registered: ${config.id}`);
    }

    this.modules.set(config.id, {
      moduleClass,
      config,
    });

    logger.info(`Registered module: ${config.id} (${config.name})`);
  }

  /**
   * Get a module by its identifier
   * @param id - Module identifier
   * @returns The module instance if found, undefined otherwise
   */
  public get(id: string): Module | undefined {
    const entry = this.modules.get(id);
    return entry?.instance;
  }

  /**
   * Get all registered modules
   * @returns Array of all initialized module instances
   */
  public getAll(): Module[] {
    return Array.from(this.modules.values())
      .map((entry) => entry.instance)
      .filter((module): module is Module => module !== undefined);
  }

  /**
   * Initialize all modules in dependency order
   * @returns Promise that resolves when all modules are initialized
   */
  public async initializeAll(): Promise<void> {
    logger.info('Initializing all modules...');

    // Calculate initialization order based on dependencies
    this.calculateInitializationOrder();

    // Initialize modules in order
    for (const moduleId of this.initializationOrder) {
      await this.initializeModule(moduleId);
    }

    logger.info('All modules initialized successfully');
  }

  /**
   * Start all modules
   * @returns Promise that resolves when all modules are started
   */
  public async startAll(): Promise<void> {
    logger.info('Starting all modules...');

    const modules = this.getAll();

    for (const module of modules) {
      if (module.state === ModuleState.INITIALIZED) {
        try {
          await module.start();
          logger.info(`Started module: ${module.id}`);
        } catch (error) {
          logger.error(`Failed to start module ${module.id}:`, error);
          throw error;
        }
      }
    }

    logger.info('All modules started successfully');
  }

  /**
   * Stop all modules in reverse order
   * @returns Promise that resolves when all modules are stopped
   */
  public async stopAll(): Promise<void> {
    logger.info('Stopping all modules...');

    const reverseOrder = [...this.initializationOrder].reverse();

    for (const moduleId of reverseOrder) {
      const module = this.get(moduleId);
      if (module && module.state === ModuleState.RUNNING) {
        try {
          await module.stop();
          logger.info(`Stopped module: ${module.id}`);
        } catch (error) {
          logger.error(`Failed to stop module ${module.id}:`, error);
          // Continue stopping other modules even if one fails
        }
      }
    }

    logger.info('All modules stopped');
  }

  /**
   * Destroy all modules
   * @returns Promise that resolves when all modules are destroyed
   */
  public async destroyAll(): Promise<void> {
    logger.info('Destroying all modules...');

    const reverseOrder = [...this.initializationOrder].reverse();

    for (const moduleId of reverseOrder) {
      const module = this.get(moduleId);
      if (module) {
        try {
          await module.destroy();
          logger.info(`Destroyed module: ${module.id}`);
        } catch (error) {
          logger.error(`Failed to destroy module ${module.id}:`, error);
          // Continue destroying other modules even if one fails
        }
      }
    }

    // Clear the registry
    this.modules.clear();
    this.initializationOrder = [];

    logger.info('All modules destroyed');
  }

  /**
   * Get module health status for all modules
   * @returns Object containing health status for each module
   */
  public getHealthStatus(): Record<string, any> {
    const modules = this.getAll();
    const status: Record<string, any> = {};

    for (const module of modules) {
      status[module.id] = module.getHealth();
    }

    return status;
  }

  /**
   * Get dependency container
   * @returns The dependency container instance
   */
  public getDependencyContainer(): DependencyContainer {
    return this.dependencyContainer;
  }

  /**
   * Initialize a specific module
   * @param moduleId - ID of the module to initialize
   * @returns Promise that resolves when module is initialized
   * @throws {Error} When module is not found
   */
  private async initializeModule(moduleId: string): Promise<void> {
    const entry = this.modules.get(moduleId);
    if (!entry) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    if (entry.instance) {
      return; // Already initialized
    }

    logger.info(`Initializing module: ${moduleId}`);

    try {
      // Create module instance
      const instance = new entry.moduleClass(entry.config, this.dependencyContainer);
      entry.instance = instance;

      // Initialize the module
      await instance.initialize(this.dependencyContainer);

      logger.info(`Module initialized: ${moduleId}`);
    } catch (error) {
      logger.error(`Failed to initialize module ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate the order in which modules should be initialized based on dependencies
   * @returns void
   * @throws {Error} When circular dependencies are detected
   */
  private calculateInitializationOrder(): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (moduleId: string) => {
      if (visited.has(moduleId)) {
        return;
      }

      if (visiting.has(moduleId)) {
        throw new Error(`Circular dependency detected involving module: ${moduleId}`);
      }

      const entry = this.modules.get(moduleId);
      if (!entry) {
        throw new Error(`Module not found: ${moduleId}`);
      }

      visiting.add(moduleId);

      // Visit dependencies first
      for (const depId of entry.config.dependencies || []) {
        // Check if dependency is a module (not a service dependency)
        if (this.modules.has(depId)) {
          visit(depId);
        }
      }

      visiting.delete(moduleId);
      visited.add(moduleId);
      order.push(moduleId);
    };

    // Visit all modules
    for (const moduleId of this.modules.keys()) {
      visit(moduleId);
    }

    this.initializationOrder = order;
    logger.debug(`Module initialization order: ${order.join(' → ')}`);
  }
}
