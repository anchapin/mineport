/**
 * Core Services
 *
 * Core application services for the Minecraft Mod Converter backend.
 * These services provide infrastructure, orchestration, and business logic.
 *
 * Public API:
 * - JobQueue: Queue management for conversion jobs
 * - WorkerPool: Worker thread pool for parallel processing
 * - ResourceAllocator: Resource allocation and management
 * - CacheService: Caching service for performance optimization
 * - UpdateService: Service for updating application components
 * - ErrorCollector: Centralized error collection and reporting
 * - ConversionPipeline: Main conversion pipeline orchestration
 * - ConversionService: High-level conversion service interface
 * - ValidationPipeline: Comprehensive validation pipeline with configurable stages
 * - ConfigurationService: Application configuration management
 * - ConfigurationAdminService: Administrative configuration management
 * - APIMapperService: API mapping dictionary service
 * - APIMappingAdminService: Administrative API mapping management
 */

// Export all services
export * from './JobQueue.js';
export * from './WorkerPool.js';
export * from './ResourceAllocator.js';
export * from './CacheService.js';
export * from './UpdateService.js';
export * from './ErrorCollector.js';
export * from './ConversionPipeline.js';
export * from './ConversionService.js';
export * from './ValidationPipeline.js';
export * from './ConfigurationService.js';
export * from './ConfigurationAdminService.js';
export * from './DependencyContainer.js';
export * from './ModuleRegistry.js';
export * from './ModuleBootstrap.js';
export * from './APIMapperService.js';
export * from './APIMappingAdminService.js';
export * from './FeatureFlagService.js';

// Export validation stages
export * from './validation-stages.js';
