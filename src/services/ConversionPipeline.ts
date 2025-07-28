/**
 * Conversion Pipeline Service
 * 
 * This service orchestrates the entire conversion process and integrates
 * the error collection system to provide a comprehensive error report.
 * 
 * Refactored to use JobQueue for processing conversion requests.
 * Implements requirements:
 * - 7.2: Process multiple conversion requests in parallel
 * - 7.4: Provide real-time status updates for conversion jobs
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { createLogger } from '../utils/logger';
import { ErrorHandler, globalErrorCollector } from '../utils/errorHandler';
import { ErrorCollector } from './ErrorCollector';
import { ErrorType, ErrorSeverity, createErrorCode } from '../types/errors';
import { JobQueue, Job } from './JobQueue';
import { ResourceAllocator } from './ResourceAllocator';
import { AssetTranslationModule } from '../modules/assets/AssetTranslationModule';
import { LogicTranslationEngine } from '../modules/logic/LogicTranslationEngine';
import { ModValidator } from '../modules/ingestion/ModValidator';
import { FeatureCompatibilityAnalyzer } from '../modules/ingestion/FeatureCompatibilityAnalyzer';
import { ManifestGenerator } from '../modules/configuration/ManifestGenerator';
import { BlockItemDefinitionConverter } from '../modules/configuration/BlockItemDefinitionConverter';
import { RecipeConverter } from '../modules/configuration/RecipeConverter';
import { LootTableConverter } from '../modules/configuration/LootTableConverter';
import { LicenseEmbedder } from '../modules/configuration/LicenseEmbedder';
import { AddonPackager } from '../modules/packaging/AddonPackager';
import { AddonValidator } from '../modules/packaging/AddonValidator';
import { ConversionReportGenerator } from '../modules/packaging/ConversionReportGenerator';

const logger = createLogger('ConversionPipeline');
const MODULE_ID = 'PIPELINE';

/**
 * Input for the conversion pipeline
 */
export interface ConversionPipelineInput {
  /**
   * Path to the Java mod file or directory
   */
  inputPath: string;
  
  /**
   * Path to the output directory
   */
  outputPath: string;
  
  /**
   * Mod ID
   */
  modId: string;
  
  /**
   * Mod name
   */
  modName: string;
  
  /**
   * Mod version
   */
  modVersion: string;
  
  /**
   * Mod description
   */
  modDescription?: string;
  
  /**
   * Mod author
   */
  modAuthor?: string;
  
  /**
   * Whether to generate a report
   */
  generateReport?: boolean;
  
  /**
   * Whether to package the output as an addon
   */
  packageAddon?: boolean;
  
  /**
   * Custom error collector to use
   */
  errorCollector?: ErrorCollector;
}

/**
 * Result of the conversion pipeline
 */
export interface ConversionPipelineResult {
  /**
   * Whether the conversion was successful
   */
  success: boolean;
  
  /**
   * Path to the output directory
   */
  outputPath: string;
  
  /**
   * Path to the report file, if generated
   */
  reportPath?: string;
  
  /**
   * Path to the addon file, if packaged
   */
  addonPath?: string;
  
  /**
   * Error summary
   */
  errorSummary: {
    totalErrors: number;
    criticalErrors: number;
    errors: number;
    warnings: number;
    info: number;
  };
}

/**
 * Conversion pipeline service
 * 
 * Refactored to use JobQueue for processing conversion requests.
 */
export class ConversionPipeline {
  private errorCollector: ErrorCollector;
  private jobQueue?: JobQueue;
  private resourceAllocator?: ResourceAllocator;
  private isProcessingJobs: boolean = false;
  
  /**
   * Creates a new instance of the conversion pipeline
   * 
   * @param options Options for the conversion pipeline
   */
  constructor(options?: { 
    errorCollector?: ErrorCollector;
    jobQueue?: JobQueue;
    resourceAllocator?: ResourceAllocator;
    configService?: ConfigurationService;
  }) {
    this.errorCollector = options?.errorCollector || globalErrorCollector;
    this.jobQueue = options?.jobQueue;
    this.resourceAllocator = options?.resourceAllocator;
    
    // Apply configuration if provided
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (options?.configService) {
      this.applyConfiguration(options.configService);
    }
  }
  
  /**
   * Apply configuration from ConfigurationService
   * 
   * @param configService Configuration service
   */
  private applyConfiguration(configService: ConfigurationService): void {
    // Register for configuration updates
    configService.on('config:updated', (update: { key: string; value: any }) => {
      // Handle configuration updates as needed
      logger.debug('Received configuration update', { key: update.key });
    });
    
    logger.info('Applied configuration to ConversionPipeline');
  }
  
  /**
   * Runs the conversion pipeline
   * 
   * @param input Input for the conversion pipeline
   * @returns Result of the conversion pipeline
   */
  public async convert(input: ConversionPipelineInput): Promise<ConversionPipelineResult> {
    logger.info('Starting conversion pipeline');
    
    // Use custom error collector if provided
    const errorCollector = input.errorCollector || this.errorCollector;
    
    // Clear any previous errors
    errorCollector.clear();
    
    try {
      // Step 1: Validate the input mod
      logger.info('Validating input mod');
      const modValidator = new ModValidator();
      const validationResult = await modValidator.validate(input.inputPath);
      
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!validationResult.valid) {
        logger.error('Mod validation failed', { errors: validationResult.errors });
        
        // Add validation errors to the collector
        validationResult.errors.forEach(error => {
          ErrorHandler.validationError(
            error.message,
            'ModValidator',
            error.details,
            /**
             * createErrorCode method.
             * 
             * TODO: Add detailed description of the method's purpose and behavior.
             * 
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            createErrorCode('INGEST', 'VAL', validationResult.errors.indexOf(error) + 1)
          );
        });
        
        return this.createFailureResult(input.outputPath, errorCollector);
      }
      
      // Step 2: Analyze feature compatibility
      logger.info('Analyzing feature compatibility');
      const featureAnalyzer = new FeatureCompatibilityAnalyzer();
      const compatibilityResult = await featureAnalyzer.analyze(validationResult.modInfo);
      
      // Add compatibility notes to the collector
      compatibilityResult.notes.forEach((note, index) => {
        const severity = note.type === 'incompatible' ? ErrorSeverity.ERROR :
                        note.type === 'partial' ? ErrorSeverity.WARNING :
                        ErrorSeverity.INFO;
        
        ErrorHandler.systemError(
          note.message,
          'FeatureAnalyzer',
          { feature: note.feature, compatibility: note.type },
          severity,
          /**
           * createErrorCode method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          createErrorCode('INGEST', 'COMPAT', index + 1)
        );
      });
      
      // Create output directories
      const behaviorPackPath = path.join(input.outputPath, 'behavior_pack');
      const resourcePackPath = path.join(input.outputPath, 'resource_pack');
      
      await fs.mkdir(behaviorPackPath, { recursive: true });
      await fs.mkdir(resourcePackPath, { recursive: true });
      
      // Step 3: Generate manifests
      logger.info('Generating manifests');
      const manifestGenerator = new ManifestGenerator();
      const manifestResult = await manifestGenerator.generate({
        modId: input.modId,
        name: input.modName,
        version: input.modVersion,
        description: input.modDescription || '',
        author: input.modAuthor || '',
      });
      
      // Write manifests
      await fs.writeFile(
        path.join(behaviorPackPath, 'manifest.json'),
        JSON.stringify(manifestResult.behaviorPack, null, 2)
      );
      
      await fs.writeFile(
        path.join(resourcePackPath, 'manifest.json'),
        JSON.stringify(manifestResult.resourcePack, null, 2)
      );
      
      // Step 4: Convert assets
      logger.info('Converting assets');
      const assetModule = new AssetTranslationModule();
      const assetResult = await assetModule.translateAssets(validationResult.modInfo.assets);
      
      // Organize assets
      await assetModule.organizeAssets(assetResult.bedrockAssets, resourcePackPath);
      
      // Step 5: Convert configuration
      logger.info('Converting configuration');
      
      // Convert block/item definitions
      const definitionConverter = new BlockItemDefinitionConverter();
      const definitionResult = await definitionConverter.convert(
        validationResult.modInfo.config,
        behaviorPackPath,
        { modId: input.modId }
      );
      
      // Convert recipes
      const recipeConverter = new RecipeConverter();
      const recipeResult = await recipeConverter.convert(
        validationResult.modInfo.config,
        behaviorPackPath,
        { modId: input.modId }
      );
      
      // Convert loot tables
      const lootTableConverter = new LootTableConverter();
      const lootTableResult = await lootTableConverter.convert(
        validationResult.modInfo.config,
        behaviorPackPath,
        { modId: input.modId }
      );
      
      // Embed license
      const licenseEmbedder = new LicenseEmbedder();
      await licenseEmbedder.embed(
        validationResult.modInfo.license,
        behaviorPackPath,
        resourcePackPath
      );
      
      // Step 6: Convert logic
      logger.info('Converting logic');
      const logicEngine = new LogicTranslationEngine();
      const logicResult = await logicEngine.translate({
        javaSourceFiles: validationResult.modInfo.sourceCode,
        modId: input.modId,
      });
      
      // Write JavaScript files
      const scriptsPath = path.join(behaviorPackPath, 'scripts');
      await fs.mkdir(scriptsPath, { recursive: true });
      
      /**
       * for method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const jsFile of logicResult.javascriptFiles) {
        const filePath = path.join(scriptsPath, jsFile.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, jsFile.content);
      }
      
      // Step 7: Validate the addon
      logger.info('Validating addon');
      const addonValidator = new AddonValidator();
      const addonValidationResult = await addonValidator.validate(input.outputPath);
      
      // Add validation errors to the collector
      addonValidationResult.errors.forEach(error => {
        ErrorHandler.validationError(
          error.message,
          'AddonValidator',
          error.details,
          /**
           * createErrorCode method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          createErrorCode('PKG', 'VAL', addonValidationResult.errors.indexOf(error) + 1)
        );
      });
      
      // Step 8: Generate report if requested
      let reportPath: string | undefined;
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (input.generateReport) {
        logger.info('Generating conversion report');
        const reportGenerator = new ConversionReportGenerator();
        const reportResult = await reportGenerator.generate({
          modInfo: validationResult.modInfo,
          outputPath: input.outputPath,
          errors: errorCollector.getErrors(),
          compatibilityNotes: compatibilityResult.notes,
          assetNotes: assetResult.conversionNotes,
          logicNotes: logicResult.conversionNotes,
          stubFunctions: logicResult.stubFunctions,
        });
        
        reportPath = reportResult.reportPath;
      }
      
      // Step 9: Package addon if requested
      let addonPath: string | undefined;
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (input.packageAddon) {
        logger.info('Packaging addon');
        const addonPackager = new AddonPackager();
        const packagingResult = await addonPackager.package({
          inputPath: input.outputPath,
          outputPath: path.join(input.outputPath, '..'),
          name: input.modName,
          version: input.modVersion,
        });
        
        addonPath = packagingResult.addonPath;
      }
      
      // Create success result
      const result: ConversionPipelineResult = {
        success: !errorCollector.hasErrors(ErrorSeverity.CRITICAL) && !errorCollector.hasErrors(ErrorSeverity.ERROR),
        outputPath: input.outputPath,
        reportPath,
        addonPath,
        errorSummary: this.createErrorSummary(errorCollector)
      };
      
      logger.info('Conversion pipeline completed', { success: result.success });
      return result;
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Conversion pipeline failed: ${errorMessage}`, { error });
      
      // Add error to collector
      ErrorHandler.systemError(
        `Conversion pipeline failed: ${errorMessage}`,
        MODULE_ID,
        { originalError: error },
        ErrorSeverity.CRITICAL,
        /**
         * createErrorCode method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'FAIL', 1)
      );
      
      return this.createFailureResult(input.outputPath, errorCollector);
    }
  }
  
  /**
   * Creates a failure result
   * 
   * @param outputPath Output path
   * @param errorCollector Error collector
   * @returns Failure result
   */
  private createFailureResult(outputPath: string, errorCollector: ErrorCollector): ConversionPipelineResult {
    return {
      success: false,
      outputPath,
      errorSummary: this.createErrorSummary(errorCollector)
    };
  }
  
  /**
   * Creates an error summary from the error collector
   * 
   * @param errorCollector Error collector
   * @returns Error summary
   */
  private createErrorSummary(errorCollector: ErrorCollector): ConversionPipelineResult['errorSummary'] {
    const summary = errorCollector.getErrorSummary();
    
    return {
      totalErrors: summary.totalErrors,
      criticalErrors: summary.bySeverity[ErrorSeverity.CRITICAL] || 0,
      errors: summary.bySeverity[ErrorSeverity.ERROR] || 0,
      warnings: summary.bySeverity[ErrorSeverity.WARNING] || 0,
      info: summary.bySeverity[ErrorSeverity.INFO] || 0
    };
  }
  
  /**
   * Set the job queue to use for processing conversion requests
   * 
   * @param jobQueue Job queue to use
   */
  public setJobQueue(jobQueue: JobQueue): void {
    this.jobQueue = jobQueue;
    
    // Set up job queue event listeners
    this.setupJobQueueListeners();
  }
  
  /**
   * Set the resource allocator to use for managing resources
   * 
   * @param resourceAllocator Resource allocator to use
   */
  public setResourceAllocator(resourceAllocator: ResourceAllocator): void {
    this.resourceAllocator = resourceAllocator;
  }
  
  /**
   * Set up job queue event listeners
   */
  private setupJobQueueListeners(): void {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!this.jobQueue) return;
    
    // Listen for job processing events
    this.jobQueue.on('job:process', async (job: Job) => {
      if (job.type !== 'conversion') return;
      
      try {
        logger.info(`Processing conversion job ${job.id}`);
        
        // Create a dedicated error collector for this job
        const jobErrorCollector = new ErrorCollector();
        
        // Process the job
        const result = await this.convert({
          ...job.data,
          errorCollector: jobErrorCollector
        });
        
        // Complete the job with the result
        this.jobQueue?.completeJob(job.id, result);
        
        logger.info(`Completed conversion job ${job.id}`);
      } catch (error) {
        logger.error(`Error processing conversion job ${job.id}`, { error });
        
        // Fail the job with the error
        this.jobQueue?.failJob(job.id, error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
  
  /**
   * Start processing jobs from the queue
   * 
   * @returns True if started processing, false if already processing or no queue
   */
  public startProcessingJobs(): boolean {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!this.jobQueue || this.isProcessingJobs) {
      return false;
    }
    
    this.isProcessingJobs = true;
    logger.info('Started processing jobs from queue');
    
    return true;
  }
  
  /**
   * Stop processing jobs from the queue
   * 
   * @returns True if stopped processing, false if not processing or no queue
   */
  public stopProcessingJobs(): boolean {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!this.jobQueue || !this.isProcessingJobs) {
      return false;
    }
    
    this.isProcessingJobs = false;
    logger.info('Stopped processing jobs from queue');
    
    return true;
  }
  
  /**
   * Queue a conversion job
   * 
   * @param input Conversion pipeline input
   * @param priority Job priority (higher number = higher priority)
   * @returns Job ID if queued, undefined if no queue
   */
  public queueConversion(input: ConversionPipelineInput, priority?: number): string | undefined {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!this.jobQueue) {
      logger.warn('Cannot queue conversion: no job queue set');
      return undefined;
    }
    
    logger.info('Queueing conversion job', { 
      inputPath: input.inputPath,
      outputPath: input.outputPath,
      modId: input.modId
    });
    
    // Add job to queue
    const job = this.jobQueue.addJob('conversion', input, priority);
    
    return job.id;
  }
  
  /**
   * Get the status of a conversion job
   * 
   * @param jobId Job ID
   * @returns Job status or undefined if job not found or no queue
   */
  public getJobStatus(jobId: string): { status: string; progress?: number } | undefined {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!this.jobQueue) {
      return undefined;
    }
    
    const job = this.jobQueue.getJob(jobId);
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!job) {
      return undefined;
    }
    
    return {
      status: job.status,
      progress: job.status === 'completed' ? 100 : undefined
    };
  }
  
  /**
   * Cancel a conversion job
   * 
   * @param jobId Job ID
   * @returns True if job was cancelled, false otherwise
   */
  public cancelJob(jobId: string): boolean {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!this.jobQueue) {
      return false;
    }
    
    const job = this.jobQueue.getJob(jobId);
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!job) {
      return false;
    }
    
    // Use the JobQueue's cancelJob method which handles both pending and processing jobs
    return this.jobQueue.cancelJob(jobId);
  }
}