# Common Development Workflows

This document provides step-by-step examples for common development tasks in the Minecraft Mod Converter project.

## Table of Contents

- [Adding a New Conversion Module](#adding-a-new-conversion-module)
- [Implementing a New Service](#implementing-a-new-service)
- [Adding API Mappings](#adding-api-mappings)
- [Creating Compromise Strategies](#creating-compromise-strategies)
- [Adding Configuration Options](#adding-configuration-options)
- [Implementing Error Handling](#implementing-error-handling)
- [Writing Integration Tests](#writing-integration-tests)
- [Performance Optimization](#performance-optimization)

## Adding a New Conversion Module

This workflow shows how to add a new module to the conversion pipeline.

### Example: Adding a Recipe Conversion Module

#### Step 1: Create Module Structure

```bash
# Create module directory
mkdir -p src/modules/recipes

# Create main module file
touch src/modules/recipes/RecipeConverter.ts
touch src/modules/recipes/index.ts

# Create test directory
mkdir -p tests/unit/modules/recipes
touch tests/unit/modules/recipes/RecipeConverter.test.ts
```

#### Step 2: Define Types

```typescript
// src/types/recipes.ts
export interface JavaRecipe {
  id: string;
  type: 'crafting' | 'smelting' | 'brewing';
  ingredients: JavaIngredient[];
  result: JavaItem;
  pattern?: string[];
}

export interface BedrockRecipe {
  format_version: string;
  'minecraft:recipe_shaped'?: BedrockShapedRecipe;
  'minecraft:recipe_shapeless'?: BedrockShapelessRecipe;
}

export interface RecipeConversionResult {
  bedrockRecipes: BedrockRecipe[];
  conversionNotes: RecipeConversionNote[];
}
```

#### Step 3: Implement the Module

```typescript
// src/modules/recipes/RecipeConverter.ts
import { createLogger } from '../../utils/logger';
import { ErrorCollector } from '../../services/ErrorCollector';
import { JavaRecipe, BedrockRecipe, RecipeConversionResult } from '../../types/recipes';

const logger = createLogger('RecipeConverter');

/**
 * Recipe Converter Module
 * 
 * Converts Java Edition recipes to Bedrock Edition format.
 * Handles crafting, smelting, and brewing recipes with appropriate
 * format transformations and compatibility checks.
 * 
 * @since 1.0.0
 */
export class RecipeConverter {
  private errorCollector: ErrorCollector;

  /**
   * Creates a new instance of the RecipeConverter.
   * 
   * @param errorCollector - Error collector for tracking conversion issues
   * @since 1.0.0
   */
  constructor(errorCollector?: ErrorCollector) {
    this.errorCollector = errorCollector || new ErrorCollector();
  }

  /**
   * Converts Java recipes to Bedrock format.
   * 
   * @param javaRecipes - Array of Java recipes to convert
   * @returns Promise resolving to conversion result
   * @throws {ConversionError} When recipe conversion fails
   * 
   * @example
   * ```typescript
   * const converter = new RecipeConverter();
   * const result = await converter.convertRecipes(javaRecipes);
   * console.log(`Converted ${result.bedrockRecipes.length} recipes`);
   * ```
   * 
   * @since 1.0.0
   */
  public async convertRecipes(javaRecipes: JavaRecipe[]): Promise<RecipeConversionResult> {
    logger.info(`Converting ${javaRecipes.length} recipes`);
    
    const bedrockRecipes: BedrockRecipe[] = [];
    const conversionNotes: RecipeConversionNote[] = [];

    for (const javaRecipe of javaRecipes) {
      try {
        const converted = await this.convertSingleRecipe(javaRecipe);
        bedrockRecipes.push(converted.recipe);
        conversionNotes.push(...converted.notes);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to convert recipe ${javaRecipe.id}: ${errorMessage}`);
        
        this.errorCollector.addError({
          id: `recipe-${javaRecipe.id}`,
          type: 'config',
          severity: 'error',
          message: `Recipe conversion failed: ${errorMessage}`,
          moduleOrigin: 'RecipeConverter',
          timestamp: new Date()
        });
      }
    }

    return { bedrockRecipes, conversionNotes };
  }

  /**
   * Converts a single Java recipe to Bedrock format.
   * 
   * @param javaRecipe - Java recipe to convert
   * @returns Conversion result with recipe and notes
   * @since 1.0.0
   */
  private async convertSingleRecipe(javaRecipe: JavaRecipe): Promise<{
    recipe: BedrockRecipe;
    notes: RecipeConversionNote[];
  }> {
    switch (javaRecipe.type) {
      case 'crafting':
        return this.convertCraftingRecipe(javaRecipe);
      case 'smelting':
        return this.convertSmeltingRecipe(javaRecipe);
      case 'brewing':
        return this.convertBrewingRecipe(javaRecipe);
      default:
        throw new Error(`Unsupported recipe type: ${javaRecipe.type}`);
    }
  }

  // Additional conversion methods...
}
```

#### Step 4: Create Module Index

```typescript
// src/modules/recipes/index.ts
export { RecipeConverter } from './RecipeConverter';
export * from '../../types/recipes';
```

#### Step 5: Write Tests

```typescript
// tests/unit/modules/recipes/RecipeConverter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RecipeConverter } from '../../../../src/modules/recipes/RecipeConverter';
import { JavaRecipe } from '../../../../src/types/recipes';

describe('RecipeConverter', () => {
  let converter: RecipeConverter;

  beforeEach(() => {
    converter = new RecipeConverter();
  });

  describe('convertRecipes', () => {
    it('should convert crafting recipes successfully', async () => {
      // Arrange
      const javaRecipes: JavaRecipe[] = [
        {
          id: 'test_recipe',
          type: 'crafting',
          ingredients: [/* test ingredients */],
          result: { id: 'test_item', count: 1 }
        }
      ];

      // Act
      const result = await converter.convertRecipes(javaRecipes);

      // Assert
      expect(result.bedrockRecipes).toHaveLength(1);
      expect(result.conversionNotes).toHaveLength(0);
    });
  });
});
```

#### Step 6: Integrate with Pipeline

```typescript
// src/services/ConversionPipeline.ts
import { RecipeConverter } from '../modules/recipes';

export class ConversionPipeline {
  private recipeConverter: RecipeConverter;

  constructor() {
    this.recipeConverter = new RecipeConverter(this.errorCollector);
  }

  private async processRecipes(javaRecipes: JavaRecipe[]): Promise<BedrockRecipe[]> {
    const result = await this.recipeConverter.convertRecipes(javaRecipes);
    return result.bedrockRecipes;
  }
}
```

## Implementing a New Service

This workflow shows how to create a new service with proper dependency injection.

### Example: Creating a Notification Service

#### Step 1: Define Service Interface

```typescript
// src/types/services.ts
export interface NotificationService {
  sendNotification(userId: string, message: string, type: NotificationType): Promise<void>;
  subscribeToUpdates(userId: string, callback: NotificationCallback): void;
  unsubscribe(userId: string): void;
}

export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationCallback = (notification: Notification) => void;
```

#### Step 2: Implement the Service

```typescript
// src/services/NotificationService.ts
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { NotificationService as INotificationService, NotificationType } from '../types/services';

const logger = createLogger('NotificationService');

/**
 * Notification Service
 * 
 * Handles user notifications and real-time updates throughout the system.
 * Supports multiple notification types and subscription-based updates.
 * 
 * @since 1.0.0
 */
export class NotificationService extends EventEmitter implements INotificationService {
  private subscribers: Map<string, NotificationCallback> = new Map();

  /**
   * Creates a new instance of the NotificationService.
   * 
   * @since 1.0.0
   */
  constructor() {
    super();
    logger.info('NotificationService initialized');
  }

  /**
   * Sends a notification to a specific user.
   * 
   * @param userId - Target user ID
   * @param message - Notification message
   * @param type - Notification type
   * @returns Promise that resolves when notification is sent
   * 
   * @example
   * ```typescript
   * await notificationService.sendNotification('user123', 'Conversion completed', 'success');
   * ```
   * 
   * @since 1.0.0
   */
  public async sendNotification(
    userId: string, 
    message: string, 
    type: NotificationType
  ): Promise<void> {
    const notification = {
      id: `notif-${Date.now()}`,
      userId,
      message,
      type,
      timestamp: new Date()
    };

    logger.debug(`Sending notification to user ${userId}`, { notification });

    // Send to subscriber if exists
    const callback = this.subscribers.get(userId);
    if (callback) {
      callback(notification);
    }

    // Emit event for other listeners
    this.emit('notification', notification);
  }

  /**
   * Subscribe to notifications for a user.
   * 
   * @param userId - User ID to subscribe to
   * @param callback - Callback function for notifications
   * @since 1.0.0
   */
  public subscribeToUpdates(userId: string, callback: NotificationCallback): void {
    this.subscribers.set(userId, callback);
    logger.debug(`User ${userId} subscribed to notifications`);
  }

  /**
   * Unsubscribe from notifications.
   * 
   * @param userId - User ID to unsubscribe
   * @since 1.0.0
   */
  public unsubscribe(userId: string): void {
    this.subscribers.delete(userId);
    logger.debug(`User ${userId} unsubscribed from notifications`);
  }
}
```

#### Step 3: Register in Dependency Container

```typescript
// src/services/DependencyContainer.ts
import { NotificationService } from './NotificationService';

export class DependencyContainer {
  constructor() {
    // Register the service
    this.register<NotificationService>('NotificationService', NotificationService);
  }
}
```

#### Step 4: Use in Other Services

```typescript
// src/services/ConversionService.ts
export class ConversionService {
  private notificationService: NotificationService;

  constructor(dependencies: DependencyContainer) {
    this.notificationService = dependencies.get<NotificationService>('NotificationService');
  }

  private async notifyJobCompletion(userId: string, jobId: string): Promise<void> {
    await this.notificationService.sendNotification(
      userId,
      `Conversion job ${jobId} completed successfully`,
      'success'
    );
  }
}
```

## Adding API Mappings

This workflow shows how to add new API mappings to the system.

### Step 1: Define Mapping Structure

```typescript
// Add to existing types or create new mapping file
export interface CustomAPIMapping extends APIMapping {
  customProperties?: {
    complexity: 'simple' | 'moderate' | 'complex';
    testCases: string[];
    documentation: string;
  };
}
```

### Step 2: Add Mappings to Database

```typescript
// scripts/add-api-mappings.ts
import { APIMapperService } from '../src/services/APIMapperService';

const newMappings: APIMapping[] = [
  {
    id: 'block-settype-mapping',
    javaSignature: 'org.bukkit.block.Block.setType(Material)',
    bedrockEquivalent: 'world.setBlock(location, blockType)',
    conversionType: 'direct',
    notes: 'Direct mapping with coordinate transformation',
    version: '1.20.0',
    lastUpdated: new Date(),
    exampleUsage: {
      java: 'block.setType(Material.STONE);',
      bedrock: 'world.setBlock(location, MinecraftBlockTypes.stone);'
    }
  }
];

async function addMappings() {
  const apiMapper = new APIMapperService();
  
  for (const mapping of newMappings) {
    await apiMapper.addMapping(mapping);
    console.log(`Added mapping: ${mapping.javaSignature}`);
  }
}

addMappings().catch(console.error);
```

### Step 3: Test the Mappings

```typescript
// tests/integration/api-mappings.test.ts
import { describe, it, expect } from 'vitest';
import { APIMapperService } from '../../src/services/APIMapperService';

describe('API Mappings Integration', () => {
  it('should retrieve block setType mapping', async () => {
    const apiMapper = new APIMapperService();
    
    const mapping = await apiMapper.getMapping('org.bukkit.block.Block.setType(Material)');
    
    expect(mapping).toBeDefined();
    expect(mapping?.bedrockEquivalent).toBe('world.setBlock(location, blockType)');
    expect(mapping?.conversionType).toBe('direct');
  });
});
```

## Creating Compromise Strategies

This workflow shows how to implement new compromise strategies.

### Step 1: Define Strategy Interface

```typescript
// src/types/compromise.ts
export interface CustomDimensionStrategy extends CompromiseStrategy {
  name: 'custom-dimension-simulation';
  applicableFeatures: ['dimension'];
  implementation: {
    simulationType: 'portal' | 'teleport' | 'world-switch';
    fallbackBehavior: string;
  };
}
```

### Step 2: Implement Strategy

```typescript
// src/modules/compromise/strategies/CustomDimensionStrategy.ts
import { CompromiseStrategy, CompromiseStrategyResult } from '../../../types/compromise';

/**
 * Custom Dimension Strategy
 * 
 * Handles Java custom dimensions by creating portal-based simulation
 * in Bedrock Edition using behavior packs and scripting.
 * 
 * @since 1.0.0
 */
export class CustomDimensionStrategy implements CompromiseStrategy {
  public readonly name = 'custom-dimension-simulation';
  public readonly applicableFeatures = ['dimension'];

  /**
   * Applies the custom dimension strategy to a feature.
   * 
   * @param feature - Feature requiring compromise
   * @returns Strategy result with implementation details
   * @since 1.0.0
   */
  public apply(feature: Feature): CompromiseStrategyResult {
    return {
      name: this.name,
      type: 'simulation',
      description: 'Simulates custom dimension using portal mechanics',
      implementationDetails: this.generatePortalSimulation(feature),
      limitations: [
        'No true dimension separation',
        'Limited world height',
        'Requires behavior pack'
      ],
      userGuidance: 'Players use portals to access simulated dimension areas'
    };
  }

  /**
   * Generates portal-based simulation code.
   * 
   * @param feature - Dimension feature to simulate
   * @returns Generated simulation code
   * @since 1.0.0
   */
  private generatePortalSimulation(feature: Feature): string {
    return `
// Portal-based dimension simulation
import { world, system } from '@minecraft/server';

export class DimensionSimulator {
  private portalLocations = new Map();
  
  public createPortal(location, targetDimension) {
    // Implementation for portal creation
    this.portalLocations.set(location, targetDimension);
  }
  
  public handlePortalUse(player, location) {
    // Teleport player to simulated dimension area
    const target = this.portalLocations.get(location);
    if (target) {
      player.teleport(target.spawnLocation);
      this.applyDimensionEffects(player, target);
    }
  }
}`;
  }
}
```

### Step 3: Register Strategy

```typescript
// src/modules/compromise/CompromiseStrategyEngine.ts
import { CustomDimensionStrategy } from './strategies/CustomDimensionStrategy';

export class CompromiseStrategyEngine {
  constructor() {
    // Register the new strategy
    this.registerStrategy(new CustomDimensionStrategy());
  }
}
```

## Adding Configuration Options

This workflow shows how to add new configuration options.

### Step 1: Define Configuration Schema

```typescript
// src/types/config.ts
export interface ConversionConfig {
  // Existing config...
  
  newFeature: {
    enabled: boolean;
    maxConcurrency: number;
    timeout: number;
    customOptions: {
      strategy: 'fast' | 'quality' | 'balanced';
      cacheResults: boolean;
    };
  };
}
```

### Step 2: Add Default Configuration

```typescript
// config/default.ts
export default {
  // Existing config...
  
  newFeature: {
    enabled: true,
    maxConcurrency: 4,
    timeout: 30000,
    customOptions: {
      strategy: 'balanced',
      cacheResults: true
    }
  }
};
```

### Step 3: Add Configuration Validation

```typescript
// src/services/ConfigurationService.ts
import { z } from 'zod';

const configSchema = z.object({
  // Existing schema...
  
  newFeature: z.object({
    enabled: z.boolean(),
    maxConcurrency: z.number().min(1).max(16),
    timeout: z.number().min(1000).max(300000),
    customOptions: z.object({
      strategy: z.enum(['fast', 'quality', 'balanced']),
      cacheResults: z.boolean()
    })
  })
});
```

### Step 4: Use Configuration in Code

```typescript
// src/services/NewFeatureService.ts
export class NewFeatureService {
  private config: ConversionConfig['newFeature'];

  constructor(configService: ConfigurationService) {
    this.config = configService.get('newFeature');
    
    // Listen for configuration changes
    configService.on('config:updated', (update) => {
      if (update.key.startsWith('newFeature')) {
        this.updateConfiguration();
      }
    });
  }

  private updateConfiguration(): void {
    this.config = this.configService.get('newFeature');
    logger.info('Configuration updated', { config: this.config });
  }
}
```

## Implementing Error Handling

This workflow shows how to implement comprehensive error handling.

### Step 1: Define Custom Error Types

```typescript
// src/types/errors.ts
export class ModuleSpecificError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly moduleId: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ModuleSpecificError';
  }
}
```

### Step 2: Implement Error Handling in Module

```typescript
// src/modules/example/ExampleModule.ts
export class ExampleModule {
  private errorCollector: ErrorCollector;

  public async processData(input: any): Promise<any> {
    try {
      // Processing logic
      return await this.performProcessing(input);
    } catch (error) {
      return this.handleError(error, input);
    }
  }

  private handleError(error: unknown, context: any): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Create standardized error
    const conversionError = {
      id: `example-${Date.now()}`,
      type: 'processing' as const,
      severity: 'error' as const,
      message: `Processing failed: ${errorMessage}`,
      moduleOrigin: 'ExampleModule',
      timestamp: new Date(),
      context
    };

    // Add to error collector
    this.errorCollector.addError(conversionError);

    // Log error
    logger.error('Processing failed', { error, context });

    // Throw custom error
    throw new ModuleSpecificError(
      errorMessage,
      'PROCESSING_FAILED',
      'ExampleModule',
      context
    );
  }
}
```

### Step 3: Handle Errors at Service Level

```typescript
// src/services/ExampleService.ts
export class ExampleService {
  public async handleRequest(request: any): Promise<ServiceResponse> {
    try {
      const result = await this.exampleModule.processData(request);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ModuleSpecificError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            module: error.moduleId
          }
        };
      }
      
      // Handle unexpected errors
      logger.error('Unexpected error in service', { error });
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      };
    }
  }
}
```

## Writing Integration Tests

This workflow shows how to write comprehensive integration tests.

### Step 1: Set Up Test Environment

```typescript
// tests/integration/helpers/testSetup.ts
import { DependencyContainer } from '../../../src/services/DependencyContainer';
import { ConfigurationService } from '../../../src/services/ConfigurationService';

export async function setupTestEnvironment() {
  const container = new DependencyContainer();
  
  // Configure test services
  const configService = container.get<ConfigurationService>('ConfigurationService');
  await configService.loadConfiguration({
    // Test configuration
    database: { url: 'mongodb://localhost:27017/test' },
    cache: { enabled: false },
    logging: { level: 'error' }
  });

  return container;
}

export async function cleanupTestEnvironment(container: DependencyContainer) {
  // Cleanup test data
  await container.get('DatabaseService').clearTestData();
  await container.shutdown();
}
```

### Step 2: Write Integration Test

```typescript
// tests/integration/conversion-pipeline.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestEnvironment, cleanupTestEnvironment } from './helpers/testSetup';
import { ConversionPipeline } from '../../src/services/ConversionPipeline';

describe('Conversion Pipeline Integration', () => {
  let container: DependencyContainer;
  let pipeline: ConversionPipeline;

  beforeAll(async () => {
    container = await setupTestEnvironment();
    pipeline = container.get<ConversionPipeline>('ConversionPipeline');
  });

  afterAll(async () => {
    await cleanupTestEnvironment(container);
  });

  it('should process a complete mod conversion', async () => {
    // Arrange
    const testModPath = 'tests/fixtures/test-mod.jar';
    const outputPath = 'tests/temp/output';

    // Act
    const result = await pipeline.processConversion({
      inputPath: testModPath,
      outputPath,
      modId: 'test-mod',
      modName: 'Test Mod',
      modVersion: '1.0.0',
      generateReport: true,
      packageAddon: true
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.bedrockAddon).toBeDefined();
    expect(result.report).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });
});
```

## Performance Optimization

This workflow shows how to identify and fix performance issues.

### Step 1: Add Performance Monitoring

```typescript
// src/utils/performance.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  public startTimer(operation: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
    };
  }

  public recordMetric(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
  }

  public getMetrics(operation: string): {
    count: number;
    average: number;
    min: number;
    max: number;
  } {
    const durations = this.metrics.get(operation) || [];
    return {
      count: durations.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations)
    };
  }
}
```

### Step 2: Instrument Code

```typescript
// src/modules/assets/AssetTranslationModule.ts
export class AssetTranslationModule {
  private performanceMonitor = new PerformanceMonitor();

  public async translateAssets(javaAssets: JavaAssetCollection): Promise<AssetTranslationResult> {
    const endTimer = this.performanceMonitor.startTimer('asset-translation');
    
    try {
      // Existing implementation
      const result = await this.performTranslation(javaAssets);
      return result;
    } finally {
      endTimer();
      
      // Log performance metrics
      const metrics = this.performanceMonitor.getMetrics('asset-translation');
      logger.debug('Asset translation performance', metrics);
    }
  }
}
```

### Step 3: Write Performance Tests

```typescript
// tests/benchmark/asset-translation.benchmark.ts
import { describe, it, expect } from 'vitest';
import { AssetTranslationModule } from '../../src/modules/assets/AssetTranslationModule';

describe('Asset Translation Performance', () => {
  it('should process 100 textures within 5 seconds', async () => {
    const module = new AssetTranslationModule();
    const testAssets = generateTestAssets(100);
    
    const start = performance.now();
    const result = await module.translateAssets(testAssets);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(5000); // 5 seconds
    expect(result.bedrockAssets.textures).toHaveLength(100);
  });
});
```

### Step 4: Optimize Based on Metrics

```typescript
// Example optimization: Parallel processing
export class OptimizedAssetTranslationModule {
  public async translateAssets(javaAssets: JavaAssetCollection): Promise<AssetTranslationResult> {
    // Process different asset types in parallel
    const [textureResult, modelResult, soundResult, particleResult] = await Promise.all([
      this.textureConverter.convertTextures(javaAssets.textures),
      this.modelConverter.convertModels(javaAssets.models),
      this.soundProcessor.convertSounds(javaAssets.sounds),
      this.particleMapper.convertParticles(javaAssets.particles)
    ]);

    // Combine results
    return this.combineResults(textureResult, modelResult, soundResult, particleResult);
  }
}
```

These workflows provide practical examples for common development tasks. Each workflow includes complete code examples, testing strategies, and best practices to help developers contribute effectively to the project.