/**
 * Module System Types
 *
 * This file defines the interfaces and types for the standardized module system
 * including initialization, lifecycle management, and dependency injection.
 */

import { SourceLocation } from './base.js';
import {
  BedrockTextureFile,
  BedrockModelFile,
  BedrockSoundFile,
  BedrockParticleFile,
  BedrockAnimationFile,
} from './assets.js';
import { ConversionError, AssetConversionNote } from './errors.js';

/**
 * Base interface for all modules
 */
export interface Module {
  /** Unique identifier for the module */
  readonly id: string;

  /** Human-readable name of the module */
  readonly name: string;

  /** Current lifecycle state of the module */
  readonly state: ModuleState;

  /** Dependencies required by this module */
  readonly dependencies: string[];

  /** Initialize the module with its dependencies */
  initialize(dependencies: DependencyContainer): Promise<void>;

  /** Start the module (called after initialization) */
  start(): Promise<void>;

  /** Stop the module gracefully */
  stop(): Promise<void>;

  /** Clean up resources */
  destroy(): Promise<void>;

  /** Get module health status */
  getHealth(): ModuleHealth;
}

/**
 * Module lifecycle states
 */
export enum ModuleState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  DESTROYED = 'destroyed',
}

/**
 * Module health status
 */
export interface ModuleHealth {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /** Detailed health information */
  details: {
    uptime: number;
    lastError?: Error;
    metrics?: Record<string, any>;
  };
}

/**
 * Dependency container interface
 */
export interface DependencyContainer {
  /** Get a dependency by its identifier */
  get<T>(identifier: string): T;

  /** Check if a dependency is available */
  has(identifier: string): boolean;

  /** Register a dependency */
  register<T>(identifier: string, instance: T): void;

  /** Register a factory function for lazy initialization */
  registerFactory<T>(identifier: string, factory: () => T): void;
}

/**
 * Module configuration interface
 */
export interface ModuleConfig {
  /** Module identifier */
  id: string;

  /** Module name */
  name: string;

  /** Module dependencies */
  dependencies?: string[];

  /** Module-specific configuration */
  config?: Record<string, any>;

  /** Whether the module should start automatically */
  autoStart?: boolean;
}

/**
 * Module registry interface
 */
export interface ModuleRegistry {
  /** Register a module */
  register(moduleClass: ModuleConstructor, config: ModuleConfig): void;

  /** Get a module by its identifier */
  get(id: string): Module | undefined;

  /** Get all registered modules */
  getAll(): Module[];

  /** Initialize all modules */
  initializeAll(): Promise<void>;

  /** Start all modules */
  startAll(): Promise<void>;

  /** Stop all modules */
  stopAll(): Promise<void>;

  /** Destroy all modules */
  destroyAll(): Promise<void>;
}

/**
 * Module constructor type
 */
export type ModuleConstructor = new (
  config: ModuleConfig,
  dependencies: DependencyContainer
) => Module;

/**
 * Base abstract class for modules
 */
export abstract class BaseModule implements Module {
  public readonly id: string;
  public readonly name: string;
  public readonly dependencies: string[];

  protected _state: ModuleState = ModuleState.UNINITIALIZED;
  protected _config: Record<string, any>;
  protected _dependencies: DependencyContainer | null = null;
  protected _startTime: number = 0;
  protected _lastError: Error | undefined;

  /**
   * constructor method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  constructor(config: ModuleConfig, dependencies: DependencyContainer) {
    this.id = config.id;
    this.name = config.name;
    this.dependencies = config.dependencies || [];
    this._config = config.config || {};
    this._dependencies = dependencies;
  }

  public get state(): ModuleState {
    return this._state;
  }

  /**
   * initialize method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  public async initialize(dependencies: DependencyContainer): Promise<void> {
    if (this._state !== ModuleState.UNINITIALIZED) {
      throw new Error(`Module ${this.id} is already initialized`);
    }

    this._state = ModuleState.INITIALIZING;
    this._dependencies = dependencies;

    try {
      // Validate dependencies
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const dep of this.dependencies) {
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!dependencies.has(dep)) {
          throw new Error(`Missing dependency: ${dep}`);
        }
      }

      await this.onInitialize();
      this._state = ModuleState.INITIALIZED;
    } catch (error) {
      this._state = ModuleState.ERROR;
      this._lastError = error as Error;
      throw error;
    }
  }

  /**
   * start method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  public async start(): Promise<void> {
    if (this._state !== ModuleState.INITIALIZED) {
      throw new Error(`Module ${this.id} must be initialized before starting`);
    }

    this._state = ModuleState.STARTING;

    try {
      await this.onStart();
      this._state = ModuleState.RUNNING;
      this._startTime = Date.now();
    } catch (error) {
      this._state = ModuleState.ERROR;
      this._lastError = error as Error;
      throw error;
    }
  }

  /**
   * stop method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  public async stop(): Promise<void> {
    if (this._state !== ModuleState.RUNNING) {
      return; // Already stopped or not running
    }

    this._state = ModuleState.STOPPING;

    try {
      await this.onStop();
      this._state = ModuleState.STOPPED;
    } catch (error) {
      this._state = ModuleState.ERROR;
      this._lastError = error as Error;
      throw error;
    }
  }

  /**
   * destroy method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns Promise - TODO: Document return value
   * @since 1.0.0
   */
  public async destroy(): Promise<void> {
    if (this._state === ModuleState.RUNNING) {
      await this.stop();
    }

    try {
      await this.onDestroy();
      this._state = ModuleState.DESTROYED;
    } catch (error) {
      this._state = ModuleState.ERROR;
      this._lastError = error as Error;
      throw error;
    }
  }

  /**
   * getHealth method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  public getHealth(): ModuleHealth {
    const uptime = this._startTime > 0 ? Date.now() - this._startTime : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy';

    /**
     * switch method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    switch (this._state) {
      case ModuleState.RUNNING:
        status = 'healthy';
        break;
      case ModuleState.INITIALIZED:
      case ModuleState.STOPPED:
        status = 'degraded';
        break;
      default:
        status = 'unhealthy';
    }

    return {
      status,
      details: {
        uptime,
        lastError: this._lastError,
        metrics: this.getMetrics(),
      },
    };
  }

  /** Get dependency by identifier */
  protected getDependency<T>(identifier: string): T {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!this._dependencies) {
      throw new Error(`Module ${this.id} is not initialized`);
    }
    return this._dependencies.get<T>(identifier);
  }

  /** Get configuration value */
  protected getConfig<T>(key: string, defaultValue?: T): T {
    return this._config[key] ?? defaultValue;
  }

  // Abstract methods to be implemented by concrete modules
  protected abstract onInitialize(): Promise<void>;
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;
  protected abstract getMetrics(): Record<string, any>;
}

// Logic Translation Module Types
import { JavaSourceFile } from './base.js';
import { APIMapping } from './api.js';

/**
 * Input for the Logic Translation Engine
 */
export interface LogicTranslationInput {
  /** Java source files to translate */
  javaSourceFiles: JavaSourceFile[];

  /** Optional MMIR context for advanced translation */
  mmirContext?: MMIRContext;

  /** Optional API mapping dictionary (if not provided, service will be used) */
  apiMappingDictionary?: Record<string, APIMapping>;
}

/**
 * Output from the Logic Translation Engine
 */
export interface LogicTranslationOutput {
  /** Generated JavaScript files */
  javascriptFiles: JavaScriptFile[];

  /** Functions that could not be fully translated */
  stubFunctions: StubFunction[];

  /** Notes and warnings from the conversion process */
  conversionNotes: ModuleLogicConversionNote[];
}

/**
 * JavaScript file generated from Java source
 */
export interface JavaScriptFile {
  /** File path for the generated JavaScript */
  path: string;

  /** Generated JavaScript content */
  content: string;

  /** Source map for debugging */
  sourceMap?: string;

  /** Original Java file that generated this JavaScript */
  originalJavaFile: string;
}

/**
 * Function that could not be fully translated
 */
export interface StubFunction {
  /** Function name */
  name: string;

  /** Original Java code */
  originalJavaCode: string;

  /** JavaScript stub implementation */
  javascriptStub: string;

  /** Reason why full translation was not possible */
  reason: string;

  /** Suggested alternatives or workarounds */
  suggestedAlternatives?: string[];

  /** Feature ID if related to a specific feature */
  featureId?: string;

  /** Compromise strategy that was applied */
  strategyApplied?: string;
}

/**
 * MMIR (Minecraft Mod Intermediate Representation) Context
 */
export interface MMIRContext {
  /** MMIR nodes representing code structures */
  nodes: MMIRNode[];

  /** Relationships between nodes */
  relationships: MMIRRelationship[];

  /** Metadata about the MMIR */
  metadata: MMIRMetadata;
}

/**
 * MMIR Node representing a code structure
 */
export interface MMIRNode {
  /** Unique identifier for the node */
  id: string;

  /** Type of the node (class, method, field, etc.) */
  type: string;

  /** Name of the code element */
  name: string;

  /** Source location information */
  sourceLocation?: SourceLocation;

  /** Child node IDs */
  children: string[];

  /** Node-specific properties */
  properties: Record<string, any>;
}

/**
 * Relationship between MMIR nodes
 */
export interface MMIRRelationship {
  /** Source node ID */
  from: string;

  /** Target node ID */
  to: string;

  /** Type of relationship */
  type: 'extends' | 'implements' | 'calls' | 'references' | 'contains';

  /** Additional relationship properties */
  properties?: Record<string, any>;
}

/**
 * MMIR metadata
 */
export interface MMIRMetadata {
  /** Version of MMIR format */
  version: string;

  /** Timestamp when MMIR was generated */
  generatedAt: Date;

  /** Source files that contributed to this MMIR */
  sourceFiles: string[];

  /** Mod loader information */
  modLoader: 'forge' | 'fabric';

  /** Additional metadata */
  properties?: Record<string, any>;
}

// SourceLocation already imported at the top of the file

/**
 * Logic conversion note
 */
export interface ModuleLogicConversionNote {
  /** Type/severity of the note */
  type: 'info' | 'warning' | 'error' | 'critical';

  /** Note message */
  message: string;

  /** Source location if applicable */
  sourceLocation?: SourceLocation;

  /** Error/note code for categorization */
  code?: string;

  /** Additional details */
  details?: Record<string, any>;
}

/**
 * Logic feature information
 */
export interface LogicFeature {
  /** Feature identifier */
  id: string;

  /** Feature name */
  name: string;

  /** Feature description */
  description: string;

  /** Feature type */
  type: string;

  /** Compatibility tier */
  compatibilityTier: 1 | 2 | 3 | 4;

  /** Source files containing this feature */
  sourceFiles: string[];

  /** Line numbers where feature is used */
  sourceLineNumbers: number[][];
}

// Import asset interfaces from centralized location
import { JavaTextureFile, JavaModelFile, JavaSoundFile } from './assets.js';

/**
 * Java asset collection interface
 */
export interface JavaAssetCollection {
  textures: JavaTextureFile[];
  models: JavaModelFile[];
  sounds: JavaSoundFile[];
  particles: JavaParticleFile[];
  animations: JavaAnimationFile[];
}

/**
 * Bedrock asset collection interface
 */
export interface BedrockAssetCollection {
  textures: BedrockTextureFile[];
  models: BedrockModelFile[];
  sounds: BedrockSoundFile[];
  particles: BedrockParticleFile[];
  animations: BedrockAnimationFile[];
  soundsJson?: object; // Optional sounds.json configuration
}

/**
 * Asset translation result interface
 */
export interface AssetTranslationResult {
  bedrockAssets: BedrockAssetCollection;
  conversionNotes: AssetConversionNote[];
  errors: ConversionError[];
}

// Asset interfaces already imported above

/**
 * Java particle file interface
 */
export interface JavaParticleFile {
  path: string;
  data: Buffer | object;
  name: string;
  textures?: string[];
  parameters?: Record<string, any>;
}

/**
 * Java animation file interface
 */
export interface JavaAnimationFile {
  path: string;
  content: string;
  metadata?: Record<string, any>;
}

// Import Bedrock asset interfaces from centralized location
export {
  BedrockTextureFile,
  BedrockModelFile,
  BedrockSoundFile,
  BedrockParticleFile,
  BedrockAnimationFile,
} from './assets.js';

// Import AssetConversionNote and ConversionError from centralized error types
export { AssetConversionNote, ConversionError } from './errors.js';

/**
 * Conversion context interface
 */
export interface ConversionContext {
  modId: string;
  modName: string;
  modVersion: string;
  modLoader: 'forge' | 'fabric' | 'unknown';
  minecraftVersion: string;
  targetBedrockVersion: string;
  conversionOptions: ModuleConversionOptions;
}

/**
 * Module conversion options interface
 */
export interface ModuleConversionOptions {
  preserveComments: boolean;
  generateDocumentation: boolean;
  optimizeOutput: boolean;
  enableExperimentalFeatures: boolean;
}

/**
 * Bedrock configuration collection interface
 */
export interface BedrockConfigCollection {
  manifests: {
    behaviorPack: BedrockManifest;
    resourcePack: BedrockManifest;
  };
  definitions: {
    blocks: BedrockDefinitionFile[];
    items: BedrockDefinitionFile[];
  };
  recipes: BedrockRecipeFile[];
  lootTables: BedrockLootTableFile[];
}

/**
 * Bedrock manifest interface
 */
export interface BedrockManifest {
  format_version: number;
  header: {
    name: string;
    description: string;
    uuid: string;
    version: number[];
    min_engine_version: number[];
  };
  modules: BedrockModule[];
  dependencies?: BedrockDependency[];
}

/**
 * Bedrock module interface
 */
export interface BedrockModule {
  type: string;
  uuid: string;
  version: number[];
}

/**
 * Bedrock dependency interface
 */
export interface BedrockDependency {
  uuid: string;
  version: number[];
}

/**
 * Bedrock definition file interface
 */
export interface BedrockDefinitionFile {
  path: string;
  content: object;
}

/**
 * Bedrock recipe file interface
 */
export interface BedrockRecipeFile {
  path: string;
  content: object;
}

/**
 * Bedrock loot table file interface
 */
export interface BedrockLootTableFile {
  path: string;
  content: object;
}
