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
 * - ConfigurationService: Application configuration management
 * - ConfigurationAdminService: Administrative configuration management
 * - APIMapperService: API mapping dictionary service
 * - APIMappingAdminService: Administrative API mapping management
 */

// Export all services
export * from './JobQueue';
export * from './WorkerPool';
export * from './ResourceAllocator';
export * from './CacheService';
export * from './UpdateService';
export * from './ErrorCollector';
export * from './ConversionPipeline';
export * from './ConversionService';
export * from './ConfigurationService';
export * from './ConfigurationAdminService';
export * from './DependencyContainer';
export * from './ModuleRegistry';
export * from './ModuleBootstrap';
export * from './APIMapperService';
export * from './APIMappingAdminService';