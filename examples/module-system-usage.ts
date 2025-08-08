/**
 * Module System Usage Example
 *
 * This example demonstrates how to use the standardized module system
 * with dependency injection and lifecycle management.
 */

import { createBootstrap, BootstrapConfigs } from '../src/services/ModuleBootstrap';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('ModuleSystemExample');

/**
 * Example: Basic module system usage
 */
async function basicUsageExample() {
  logger.info('=== Basic Module System Usage Example ===');

  // Create bootstrap system with development configuration
  const bootstrap = createBootstrap(BootstrapConfigs.development);

  try {
    // Initialize the system
    await bootstrap.initialize();
    logger.info('✅ System initialized');

    // Start all modules
    await bootstrap.start();
    logger.info('✅ All modules started');

    // Get a module and use it
    const moduleRegistry = bootstrap.getModuleRegistry();
    const assetModule = moduleRegistry.get('assetTranslation');

    if (assetModule) {
      logger.info(`Asset module state: ${assetModule.state}`);
      logger.info(`Asset module health:`, assetModule.getHealth());
    }

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Stop the system
    await bootstrap.stop();
    logger.info('✅ System stopped');

    // Shutdown completely
    await bootstrap.shutdown();
    logger.info('✅ System shutdown complete');
  } catch (error) {
    logger.error('❌ Error in basic usage example:', error);

    // Ensure cleanup even if there's an error
    try {
      await bootstrap.shutdown();
    } catch (shutdownError) {
      logger.error('❌ Error during emergency shutdown:', shutdownError);
    }
  }
}

/**
 * Example: Custom module configuration
 */
async function customConfigurationExample() {
  logger.info('=== Custom Configuration Example ===');

  // Create bootstrap with custom configuration
  const bootstrap = createBootstrap({
    environment: 'development',
    debug: true,
    configPath: './config/custom.json',
  });

  try {
    await bootstrap.initialize();

    // Get dependency container and add custom dependencies
    const container = bootstrap.getDependencyContainer();

    // Register a custom service
    container.register('customService', {
      doSomething: () => logger.info('Custom service called!'),
    });

    await bootstrap.start();

    // Use the custom service
    const customService = container.get<any>('customService');
    customService.doSomething();

    await bootstrap.shutdown();
    logger.info('✅ Custom configuration example complete');
  } catch (error) {
    logger.error('❌ Error in custom configuration example:', error);
    await bootstrap.shutdown();
  }
}

/**
 * Example: Health monitoring
 */
async function healthMonitoringExample() {
  logger.info('=== Health Monitoring Example ===');

  const bootstrap = createBootstrap(BootstrapConfigs.development);

  try {
    await bootstrap.initialize();
    await bootstrap.start();

    // Monitor system health
    const healthStatus = bootstrap.getHealthStatus();
    logger.info('System Health Status:', JSON.stringify(healthStatus, null, 2));

    // Monitor individual module health
    const moduleRegistry = bootstrap.getModuleRegistry();
    const modules = moduleRegistry.getAll();

    for (const module of modules) {
      const health = module.getHealth();
      logger.info(`Module ${module.id} health:`, health);
    }

    await bootstrap.shutdown();
    logger.info('✅ Health monitoring example complete');
  } catch (error) {
    logger.error('❌ Error in health monitoring example:', error);
    await bootstrap.shutdown();
  }
}

/**
 * Example: Graceful shutdown handling
 */
async function gracefulShutdownExample() {
  logger.info('=== Graceful Shutdown Example ===');

  const bootstrap = createBootstrap(BootstrapConfigs.development);

  // Set up graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);

    try {
      await bootstrap.shutdown();
      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  try {
    await bootstrap.initialize();
    await bootstrap.start();

    logger.info('System running... Press Ctrl+C to test graceful shutdown');

    // Simulate running for a while
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Manual shutdown for this example
    await gracefulShutdown('MANUAL');
  } catch (error) {
    logger.error('❌ Error in graceful shutdown example:', error);
    await bootstrap.shutdown();
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  try {
    await basicUsageExample();
    await customConfigurationExample();
    await healthMonitoringExample();
    await gracefulShutdownExample();

    logger.info('🎉 All examples completed successfully!');
  } catch (error) {
    logger.error('❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}

export {
  basicUsageExample,
  customConfigurationExample,
  healthMonitoringExample,
  gracefulShutdownExample,
};
