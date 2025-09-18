/**
 * Module Bootstrap System
 *
 * This service handles the bootstrapping of all modules in the Minecraft Mod Converter.
 * It sets up dependency injection, registers modules, and manages their lifecycle.
 */

import { ModuleRegistryImpl } from './ModuleRegistry.js';
import { DependencyContainerImpl } from './DependencyContainer.js';
import { StandardizedAssetTranslationModule } from '../modules/assets/StandardizedAssetTranslationModule.js';
import { ConfigurationService } from './ConfigurationService.js';
import { ErrorCollector } from './ErrorCollector.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ModuleBootstrap');

/**
 * Application bootstrap configuration
 */
export interface BootstrapConfig {
  /** Configuration file path */
  configPath?: string;

  /** Environment (development, production, test) */
  environment?: string;

  /** Modules to load */
  modules?: string[];

  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Module Bootstrap System
 *
 * Responsible for setting up the entire module system including dependency injection,
 * module registration, and lifecycle management.
 */
export class ModuleBootstrap {
  private moduleRegistry: ModuleRegistryImpl;
  private dependencyContainer: DependencyContainerImpl;
  private configurationService: ConfigurationService;
  private isInitialized = false;
  private isStarted = false;

  /**
   * Creates a new instance.
   *
   * TODO: Add detailed description of constructor behavior.
   *
   * @param param - TODO: Document parameters
   * @since 1.0.0
   */
  constructor(private config: BootstrapConfig = {}) {
    this.dependencyContainer = new DependencyContainerImpl();
    this.moduleRegistry = new ModuleRegistryImpl(this.dependencyContainer);
    this.configurationService = new ConfigurationService();
  }

  /**
   * Initialize the bootstrap system
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} When bootstrap system is already initialized
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Bootstrap system is already initialized');
    }

    logger.info('Initializing Module Bootstrap System...');

    try {
      // Initialize configuration service
      await this.initializeConfiguration();

      // Register core dependencies
      await this.registerCoreDependencies();

      // Register modules
      await this.registerModules();

      // Initialize all modules
      await this.moduleRegistry.initializeAll();

      this.isInitialized = true;
      logger.info('Module Bootstrap System initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Module Bootstrap System:', error);
      throw error;
    }
  }

  /**
   * Start all modules
   * @returns Promise that resolves when all modules are started
   * @throws {Error} When bootstrap system is not initialized or already started
   */
  public async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Bootstrap system must be initialized before starting');
    }

    if (this.isStarted) {
      throw new Error('Bootstrap system is already started');
    }

    logger.info('Starting all modules...');

    try {
      await this.moduleRegistry.startAll();
      this.isStarted = true;
      logger.info('All modules started successfully');
    } catch (error) {
      logger.error('Failed to start modules:', error);
      throw error;
    }
  }

  /**
   * Stop all modules
   * @returns Promise that resolves when all modules are stopped
   */
  public async stop(): Promise<void> {
    if (!this.isStarted) {
      return; // Not started, nothing to stop
    }

    logger.info('Stopping all modules...');

    try {
      await this.moduleRegistry.stopAll();
      this.isStarted = false;
      logger.info('All modules stopped successfully');
    } catch (error) {
      logger.error('Failed to stop modules:', error);
      throw error;
    }
  }

  /**
   * Shutdown the entire system
   * @returns Promise that resolves when shutdown is complete
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down Module Bootstrap System...');

    try {
      if (this.isStarted) {
        await this.stop();
      }

      if (this.isInitialized) {
        await this.moduleRegistry.destroyAll();
        this.dependencyContainer.clear();
        this.isInitialized = false;
      }

      logger.info('Module Bootstrap System shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Get module registry
   * @returns The module registry instance
   */
  public getModuleRegistry(): ModuleRegistryImpl {
    return this.moduleRegistry;
  }

  /**
   * Get dependency container
   * @returns The dependency container instance
   */
  public getDependencyContainer(): DependencyContainerImpl {
    return this.dependencyContainer;
  }

  /**
   * Get system health status
   * @returns Object containing health status of bootstrap, modules, and dependencies
   */
  public getHealthStatus(): any {
    return {
      bootstrap: {
        initialized: this.isInitialized,
        started: this.isStarted,
      },
      modules: this.moduleRegistry.getHealthStatus(),
      dependencies: this.dependencyContainer.getAllDependencyInfo(),
    };
  }

  /**
   * Initialize configuration service
   * @returns Promise that resolves when configuration is initialized
   */
  private async initializeConfiguration(): Promise<void> {
    logger.debug('Initializing configuration service...');

    // Load configuration from file if specified
    if (this.config.configPath) {
      // In a real implementation, this would load from the specified path
      logger.debug(`Loading configuration from: ${this.config.configPath}`);
    }

    // Set environment-specific configuration
    if (this.config.environment) {
      logger.debug(`Setting environment: ${this.config.environment}`);
    }

    logger.debug('Configuration service initialized');
  }

  /**
   * Register core dependencies
   * @returns Promise that resolves when core dependencies are registered
   */
  private async registerCoreDependencies(): Promise<void> {
    logger.debug('Registering core dependencies...');

    // Register configuration service
    this.dependencyContainer.register('configurationService', this.configurationService);

    // Register error collector
    this.dependencyContainer.registerSingleton('errorCollector', () => new ErrorCollector());

    // Register logger factory
    this.dependencyContainer.registerFactory('logger', () => createLogger('Module'), false);

    // Register other core services as needed
    // this.dependencyContainer.registerSingleton('cacheService', () => new CacheService());
    // this.dependencyContainer.registerSingleton('jobQueue', () => new JobQueue());

    logger.debug('Core dependencies registered');
  }

  /**
   * Register all modules
   * @returns Promise that resolves when all modules are registered
   */
  private async registerModules(): Promise<void> {
    logger.debug('Registering modules...');

    // Register Asset Translation Module
    this.moduleRegistry.register(StandardizedAssetTranslationModule, {
      id: 'assetTranslation',
      name: 'Asset Translation Module',
      dependencies: ['configurationService', 'errorCollector'],
      config: {
        assetTranslation: {
          outputDir: './output/assets',
          maxConcurrency: 4,
          debug: this.config.debug || false,
          conversionOptions: {
            textureFormat: 'png',
            modelFormat: 'json',
            soundFormat: 'ogg',
            particleFormat: 'json',
          },
        },
      },
      autoStart: true,
    });

    // Register other modules as they are converted to the standardized pattern
    // this.moduleRegistry.register(StandardizedLogicTranslationModule, { ... });
    // this.moduleRegistry.register(StandardizedIngestionModule, { ... });
    // etc.

    logger.debug('Modules registered');
  }
}

/**
 * Create and configure the bootstrap system
 * @param config - Bootstrap configuration options
 * @returns Configured ModuleBootstrap instance
 */
export function createBootstrap(config: BootstrapConfig = {}): ModuleBootstrap {
  return new ModuleBootstrap(config);
}

/**
 * Default bootstrap configuration for different environments
 */
export const BootstrapConfigs = {
  development: {
    environment: 'development',
    debug: true,
    modules: ['assetTranslation', 'logic', 'ingestion', 'configuration', 'compromise', 'packaging'],
  },

  production: {
    environment: 'production',
    debug: false,
    modules: ['assetTranslation', 'logic', 'ingestion', 'configuration', 'compromise', 'packaging'],
  },

  test: {
    environment: 'test',
    debug: true,
    modules: ['assetTranslation'], // Minimal set for testing
  },
};
