/**
 * Conversion Validation Stage
 * 
 * This validation stage validates the results of mod conversion to ensure
 * structural integrity, completeness, and quality of generated Bedrock addons.
 */

import { createLogger } from '../../utils/logger';
import { 
  ValidationStage, 
  ValidationInput, 
  ValidationStageResult 
} from '../ValidationPipeline';
import { 
  ConversionError, 
  ErrorType, 
  ErrorSeverity, 
  createErrorCode, 
  createConversionError 
} from '../../types/errors';

const logger = createLogger('ConversionValidationStage');
const MODULE_ID = 'CONV_VAL';

/**
 * Conversion validation stage implementation
 */
export class ConversionValidationStage implements ValidationStage {
  public readonly name = 'conversion';
  public readonly required = false;
  public readonly timeout = 20000; // 20 seconds
  
  /**
   * Execute conversion validation
   * 
   * @param input Validation input data
   * @param config Stage configuration
   * @returns Validation stage result
   */
  public async validate(
    input: ValidationInput, 
    config?: Record<string, any>
  ): Promise<ValidationStageResult> {
    const startTime = Date.now();
    const errors: ConversionError[] = [];
    const warnings: ConversionError[] = [];
    
    logger.debug('Starting conversion validation', { filePath: input.filePath });
    
    try {
      // Validate conversion results exist
      if (!input.conversionResults) {
        warnings.push(createConversionError({
          code: createErrorCode(MODULE_ID, 'MISSING', 1),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: 'No conversion results provided for validation',
          moduleOrigin: MODULE_ID
        }));
        
        return {
          stageName: this.name,
          passed: true,
          errors,
          warnings,
          executionTime: Date.now() - startTime,
          metadata: { skipped: true, reason: 'No conversion results' }
        };
      }
      
      // Validate addon structure
      await this.validateAddonStructure(input.conversionResults, errors, warnings);
      
      // Validate manifest files
      await this.validateManifestFiles(input.conversionResults, errors, warnings);
      
      // Validate asset conversion
      await this.validateAssetConversion(input.conversionResults, errors, warnings);
      
      // Validate behavior pack content
      await this.validateBehaviorPackContent(input.conversionResults, errors, warnings);
      
      // Validate resource pack content
      await this.validateResourcePackContent(input.conversionResults, errors, warnings);
      
      // Validate conversion completeness
      await this.validateConversionCompleteness(input.conversionResults, errors, warnings, config);
      
      // Validate output file integrity
      await this.validateOutputFileIntegrity(input.conversionResults, errors, warnings);
      
      const executionTime = Date.now() - startTime;
      const passed = errors.length === 0;
      
      logger.debug('Conversion validation completed', { 
        passed, 
        errorCount: errors.length, 
        warningCount: warnings.length,
        executionTime
      });
      
      return {
        stageName: this.name,
        passed,
        errors,
        warnings,
        executionTime,
        metadata: {
          checksPerformed: [
            'addon_structure',
            'manifest_files',
            'asset_conversion',
            'behavior_pack_content',
            'resource_pack_content',
            'conversion_completeness',
            'output_file_integrity'
          ]
        }
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Conversion validation failed', { error: errorMessage });
      
      const validationError = createConversionError({
        code: createErrorCode(MODULE_ID, 'EXEC', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: `Conversion validation execution failed: ${errorMessage}`,
        moduleOrigin: MODULE_ID,
        details: { originalError: error }
      });
      
      return {
        stageName: this.name,
        passed: false,
        errors: [validationError],
        warnings,
        executionTime,
        metadata: { error: errorMessage }
      };
    }
  }
  
  /**
   * Validate addon structure
   * 
   * @param conversionResults Conversion results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateAddonStructure(
    conversionResults: any, 
    errors: ConversionError[], 
    warnings: ConversionError[]
  ): Promise<void> {
    if (!conversionResults.addonStructure) {
      errors.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'STRUCT', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'Addon structure is missing from conversion results',
        moduleOrigin: MODULE_ID
      }));
      return;
    }
    
    const structure = conversionResults.addonStructure;
    
    // Validate required pack structures
    if (!structure.behaviorPack) {
      errors.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'STRUCT', 2),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'Behavior pack structure is missing',
        moduleOrigin: MODULE_ID
      }));
    }
    
    if (!structure.resourcePack) {
      errors.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'STRUCT', 3),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'Resource pack structure is missing',
        moduleOrigin: MODULE_ID
      }));
    }
    
    // Validate pack structure completeness
    if (structure.behaviorPack) {
      const requiredBehaviorDirs = ['scripts', 'entities', 'items', 'blocks'];
      const missingDirs = requiredBehaviorDirs.filter(dir => 
        !structure.behaviorPack.directories?.includes(dir)
      );
      
      if (missingDirs.length > 0) {
        warnings.push(createConversionError({
          code: createErrorCode(MODULE_ID, 'STRUCT', 4),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: `Behavior pack missing expected directories: ${missingDirs.join(', ')}`,
          moduleOrigin: MODULE_ID,
          details: { missingDirs }
        }));
      }
    }
    
    if (structure.resourcePack) {
      const requiredResourceDirs = ['textures', 'models', 'sounds'];
      const missingDirs = requiredResourceDirs.filter(dir => 
        !structure.resourcePack.directories?.includes(dir)
      );
      
      if (missingDirs.length > 0) {
        warnings.push(createConversionError({
          code: createErrorCode(MODULE_ID, 'STRUCT', 5),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: `Resource pack missing expected directories: ${missingDirs.join(', ')}`,
          moduleOrigin: MODULE_ID,
          details: { missingDirs }
        }));
      }
    }
  }
  
  /**
   * Validate manifest files
   * 
   * @param conversionResults Conversion results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateManifestFiles(
    conversionResults: any, 
    errors: ConversionError[], 
    warnings: ConversionError[]
  ): Promise<void> {
    const manifests = conversionResults.manifests;
    
    if (!manifests) {
      errors.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'MANIFEST', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'Manifest files are missing from conversion results',
        moduleOrigin: MODULE_ID
      }));
      return;
    }
    
    // Validate behavior pack manifest
    if (!manifests.behaviorPack) {
      errors.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'MANIFEST', 2),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'Behavior pack manifest is missing',
        moduleOrigin: MODULE_ID
      }));
    } else {
      await this.validateManifestContent(manifests.behaviorPack, 'behavior', errors, warnings);
    }
    
    // Validate resource pack manifest
    if (!manifests.resourcePack) {
      errors.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'MANIFEST', 3),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: 'Resource pack manifest is missing',
        moduleOrigin: MODULE_ID
      }));
    } else {
      await this.validateManifestContent(manifests.resourcePack, 'resource', errors, warnings);
    }
  }
  
  /**
   * Validate individual manifest content
   * 
   * @param manifest Manifest object to validate
   * @param packType Pack type (behavior or resource)
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateManifestContent(
    manifest: any,
    packType: string,
    errors: ConversionError[], 
    warnings: ConversionError[]
  ): Promise<void> {
    // Validate required fields
    const requiredFields = ['format_version', 'header', 'modules'];
    requiredFields.forEach(field => {
      if (!manifest[field]) {
        errors.push(createConversionError({
          code: createErrorCode(MODULE_ID, 'MANIFEST', 4),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: `${packType} pack manifest missing required field: ${field}`,
          moduleOrigin: MODULE_ID,
          details: { packType, field }
        }));
      }
    });
    
    // Validate header
    if (manifest.header) {
      const requiredHeaderFields = ['name', 'description', 'uuid', 'version'];
      requiredHeaderFields.forEach(field => {
        if (!manifest.header[field]) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'MANIFEST', 5),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `${packType} pack manifest header missing required field: ${field}`,
            moduleOrigin: MODULE_ID,
            details: { packType, field }
          }));
        }
      });
      
      // Validate UUID format
      if (manifest.header.uuid) {
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(manifest.header.uuid)) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'MANIFEST', 6),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `${packType} pack manifest has invalid UUID format`,
            moduleOrigin: MODULE_ID,
            details: { packType, uuid: manifest.header.uuid }
          }));
        }
      }
      
      // Validate version format
      if (manifest.header.version && Array.isArray(manifest.header.version)) {
        if (manifest.header.version.length !== 3 || 
            !manifest.header.version.every((v: any) => typeof v === 'number')) {
          warnings.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'MANIFEST', 7),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: `${packType} pack manifest version should be [major, minor, patch] format`,
            moduleOrigin: MODULE_ID,
            details: { packType, version: manifest.header.version }
          }));
        }
      }
    }
    
    // Validate modules
    if (manifest.modules && Array.isArray(manifest.modules)) {
      if (manifest.modules.length === 0) {
        warnings.push(createConversionError({
          code: createErrorCode(MODULE_ID, 'MANIFEST', 8),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: `${packType} pack manifest has no modules defined`,
          moduleOrigin: MODULE_ID,
          details: { packType }
        }));
      }
      
      manifest.modules.forEach((module: any, index: number) => {
        const requiredModuleFields = ['type', 'uuid', 'version'];
        requiredModuleFields.forEach(field => {
          if (!module[field]) {
            errors.push(createConversionError({
              code: createErrorCode(MODULE_ID, 'MANIFEST', 9),
              type: ErrorType.VALIDATION,
              severity: ErrorSeverity.ERROR,
              message: `${packType} pack module ${index} missing required field: ${field}`,
              moduleOrigin: MODULE_ID,
              details: { packType, moduleIndex: index, field }
            }));
          }
        });
      });
    }
  }
  
  /**
   * Validate asset conversion
   * 
   * @param conversionResults Conversion results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateAssetConversion(
    conversionResults: any, 
    errors: ConversionError[], 
    warnings: ConversionError[]
  ): Promise<void> {
    if (!conversionResults.convertedAssets) {
      warnings.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'ASSETS', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'No converted assets found in conversion results',
        moduleOrigin: MODULE_ID
      }));
      return;
    }
    
    const assets = conversionResults.convertedAssets;
    
    // Validate textures
    if (assets.textures && Array.isArray(assets.textures)) {
      assets.textures.forEach((texture: any, index: number) => {
        if (!texture.originalPath || !texture.convertedPath) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'ASSETS', 2),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Texture ${index} missing required path information`,
            moduleOrigin: MODULE_ID,
            details: { index, texture }
          }));
        }
        
        // Validate converted texture format
        if (texture.convertedPath && !texture.convertedPath.toLowerCase().endsWith('.png')) {
          warnings.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'ASSETS', 3),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: `Texture ${index} not converted to PNG format`,
            moduleOrigin: MODULE_ID,
            details: { index, path: texture.convertedPath }
          }));
        }
      });
    }
    
    // Validate models
    if (assets.models && Array.isArray(assets.models)) {
      assets.models.forEach((model: any, index: number) => {
        if (!model.originalPath || !model.convertedPath) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'ASSETS', 4),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Model ${index} missing required path information`,
            moduleOrigin: MODULE_ID,
            details: { index, model }
          }));
        }
        
        // Validate converted model format
        if (model.convertedPath && !model.convertedPath.toLowerCase().endsWith('.geo.json')) {
          warnings.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'ASSETS', 5),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: `Model ${index} not converted to Bedrock geometry format`,
            moduleOrigin: MODULE_ID,
            details: { index, path: model.convertedPath }
          }));
        }
      });
    }
    
    // Validate sounds
    if (assets.sounds && Array.isArray(assets.sounds)) {
      assets.sounds.forEach((sound: any, index: number) => {
        if (!sound.originalPath || !sound.convertedPath) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'ASSETS', 6),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Sound ${index} missing required path information`,
            moduleOrigin: MODULE_ID,
            details: { index, sound }
          }));
        }
        
        // Validate converted sound format
        const validSoundFormats = ['.ogg', '.wav'];
        const hasValidFormat = validSoundFormats.some(format => 
          sound.convertedPath?.toLowerCase().endsWith(format)
        );
        
        if (sound.convertedPath && !hasValidFormat) {
          warnings.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'ASSETS', 7),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: `Sound ${index} not converted to supported format (OGG/WAV)`,
            moduleOrigin: MODULE_ID,
            details: { index, path: sound.convertedPath, validFormats: validSoundFormats }
          }));
        }
      });
    }
  }
  
  /**
   * Validate behavior pack content
   * 
   * @param conversionResults Conversion results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateBehaviorPackContent(
    conversionResults: any, 
    errors: ConversionError[], 
    warnings: ConversionError[]
  ): Promise<void> {
    const behaviorPack = conversionResults.behaviorPack;
    
    if (!behaviorPack) {
      warnings.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'BEHAVIOR', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'No behavior pack content found in conversion results',
        moduleOrigin: MODULE_ID
      }));
      return;
    }
    
    // Validate scripts
    if (behaviorPack.scripts && Array.isArray(behaviorPack.scripts)) {
      behaviorPack.scripts.forEach((script: any, index: number) => {
        if (!script.path || !script.content) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'BEHAVIOR', 2),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Script ${index} missing required path or content`,
            moduleOrigin: MODULE_ID,
            details: { index, script }
          }));
        }
        
        // Validate script syntax (basic check)
        if (script.content && typeof script.content === 'string') {
          try {
            // Basic syntax validation - check for balanced braces
            const openBraces = (script.content.match(/{/g) || []).length;
            const closeBraces = (script.content.match(/}/g) || []).length;
            
            if (openBraces !== closeBraces) {
              warnings.push(createConversionError({
                code: createErrorCode(MODULE_ID, 'BEHAVIOR', 3),
                type: ErrorType.VALIDATION,
                severity: ErrorSeverity.WARNING,
                message: `Script ${index} may have syntax errors (unbalanced braces)`,
                moduleOrigin: MODULE_ID,
                details: { index, openBraces, closeBraces }
              }));
            }
          } catch (error) {
            warnings.push(createConversionError({
              code: createErrorCode(MODULE_ID, 'BEHAVIOR', 4),
              type: ErrorType.VALIDATION,
              severity: ErrorSeverity.WARNING,
              message: `Script ${index} syntax validation failed`,
              moduleOrigin: MODULE_ID,
              details: { index, error: error instanceof Error ? error.message : String(error) }
            }));
          }
        }
      });
    }
    
    // Validate block definitions
    if (behaviorPack.blocks && Array.isArray(behaviorPack.blocks)) {
      behaviorPack.blocks.forEach((block: any, index: number) => {
        if (!block.identifier || !block.definition) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'BEHAVIOR', 5),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Block ${index} missing required identifier or definition`,
            moduleOrigin: MODULE_ID,
            details: { index, block }
          }));
        }
      });
    }
    
    // Validate item definitions
    if (behaviorPack.items && Array.isArray(behaviorPack.items)) {
      behaviorPack.items.forEach((item: any, index: number) => {
        if (!item.identifier || !item.definition) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'BEHAVIOR', 6),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Item ${index} missing required identifier or definition`,
            moduleOrigin: MODULE_ID,
            details: { index, item }
          }));
        }
      });
    }
  }
  
  /**
   * Validate resource pack content
   * 
   * @param conversionResults Conversion results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateResourcePackContent(
    conversionResults: any, 
    errors: ConversionError[], 
    warnings: ConversionError[]
  ): Promise<void> {
    const resourcePack = conversionResults.resourcePack;
    
    if (!resourcePack) {
      warnings.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'RESOURCE', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'No resource pack content found in conversion results',
        moduleOrigin: MODULE_ID
      }));
      return;
    }
    
    // Validate texture definitions
    if (resourcePack.textureDefinitions && Array.isArray(resourcePack.textureDefinitions)) {
      resourcePack.textureDefinitions.forEach((texDef: any, index: number) => {
        if (!texDef.identifier || !texDef.texturePath) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'RESOURCE', 2),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Texture definition ${index} missing required identifier or texture path`,
            moduleOrigin: MODULE_ID,
            details: { index, textureDefinition: texDef }
          }));
        }
      });
    }
    
    // Validate model definitions
    if (resourcePack.modelDefinitions && Array.isArray(resourcePack.modelDefinitions)) {
      resourcePack.modelDefinitions.forEach((modelDef: any, index: number) => {
        if (!modelDef.identifier || !modelDef.modelPath) {
          errors.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'RESOURCE', 3),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Model definition ${index} missing required identifier or model path`,
            moduleOrigin: MODULE_ID,
            details: { index, modelDefinition: modelDef }
          }));
        }
      });
    }
  }
  
  /**
   * Validate conversion completeness
   * 
   * @param conversionResults Conversion results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   * @param config Stage configuration
   */
  private async validateConversionCompleteness(
    conversionResults: any, 
    errors: ConversionError[], 
    warnings: ConversionError[],
    config?: Record<string, any>
  ): Promise<void> {
    const minAssets = config?.minAssets ?? 1;
    const minScripts = config?.minScripts ?? 0;
    
    // Count converted assets
    let assetCount = 0;
    if (conversionResults.convertedAssets) {
      assetCount += (conversionResults.convertedAssets.textures?.length ?? 0);
      assetCount += (conversionResults.convertedAssets.models?.length ?? 0);
      assetCount += (conversionResults.convertedAssets.sounds?.length ?? 0);
    }
    
    if (assetCount < minAssets) {
      warnings.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'COMPLETE', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: `Low asset conversion count (${assetCount}) - conversion may be incomplete`,
        moduleOrigin: MODULE_ID,
        details: { found: assetCount, expected: minAssets }
      }));
    }
    
    // Count converted scripts
    const scriptCount = conversionResults.behaviorPack?.scripts?.length ?? 0;
    if (scriptCount < minScripts) {
      warnings.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'COMPLETE', 2),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: `Low script conversion count (${scriptCount}) - conversion may be incomplete`,
        moduleOrigin: MODULE_ID,
        details: { found: scriptCount, expected: minScripts }
      }));
    }
  }
  
  /**
   * Validate output file integrity
   * 
   * @param conversionResults Conversion results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateOutputFileIntegrity(
    conversionResults: any, 
    errors: ConversionError[], 
    warnings: ConversionError[]
  ): Promise<void> {
    if (!conversionResults.outputFiles || !Array.isArray(conversionResults.outputFiles)) {
      warnings.push(createConversionError({
        code: createErrorCode(MODULE_ID, 'INTEGRITY', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.WARNING,
        message: 'No output files list found in conversion results',
        moduleOrigin: MODULE_ID
      }));
      return;
    }
    
    const outputFiles = conversionResults.outputFiles;
    
    // Validate each output file
    outputFiles.forEach((file: any, index: number) => {
      if (!file.path) {
        errors.push(createConversionError({
          code: createErrorCode(MODULE_ID, 'INTEGRITY', 2),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: `Output file ${index} missing path`,
          moduleOrigin: MODULE_ID,
          details: { index, file }
        }));
      }
      
      if (!file.content && file.size === undefined) {
        warnings.push(createConversionError({
          code: createErrorCode(MODULE_ID, 'INTEGRITY', 3),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: `Output file ${index} missing content or size information`,
          moduleOrigin: MODULE_ID,
          details: { index, path: file.path }
        }));
      }
      
      // Check for reasonable file sizes
      if (file.size !== undefined) {
        if (file.size === 0) {
          warnings.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'INTEGRITY', 4),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: `Output file ${index} is empty`,
            moduleOrigin: MODULE_ID,
            details: { index, path: file.path }
          }));
        } else if (file.size > 100 * 1024 * 1024) { // 100MB
          warnings.push(createConversionError({
            code: createErrorCode(MODULE_ID, 'INTEGRITY', 5),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: `Output file ${index} is unusually large (${file.size} bytes)`,
            moduleOrigin: MODULE_ID,
            details: { index, path: file.path, size: file.size }
          }));
        }
      }
    });
  }
}