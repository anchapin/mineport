/**
 * Analysis Validation Stage
 *
 * This validation stage validates the results of Java analysis to ensure
 * completeness, accuracy, and quality of extracted information.
 */

import { createLogger } from '../../utils/logger.js';
import { ValidationStage, ValidationInput, ValidationStageResult } from '../ValidationPipeline.js';
import {
  ConversionError,
  ErrorType,
  ErrorSeverity,
  createErrorCode,
  createConversionError,
} from '../../types/errors.js';

const logger = createLogger('AnalysisValidationStage');
const MODULE_ID = 'ANALYSIS_VAL';

/**
 * Analysis validation stage implementation
 */
export class AnalysisValidationStage implements ValidationStage {
  public readonly name = 'analysis';
  public readonly required = false;
  public readonly timeout = 15000; // 15 seconds

  /**
   * Execute analysis validation
   *
   * @param input Validation input data
   * @param config Stage configuration
   * @returns Validation stage result
   */
  public async validate(
    input: ValidationInput,
    config?: Record<string, any>
  ): Promise<ValidationStageResult> {
    const startTime = process.hrtime.bigint();
    const errors: ConversionError[] = [];
    const warnings: ConversionError[] = [];

    logger.debug('Starting analysis validation', { filePath: input.filePath });

    try {
      // Validate analysis results exist
      if (!input.analysisResults) {
        warnings.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'MISSING', 1),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: 'No analysis results provided for validation',
            moduleOrigin: MODULE_ID,
          })
        );

        return {
          stageName: this.name,
          passed: true,
          errors,
          warnings,
          executionTime: Number(process.hrtime.bigint() - startTime) / 1000000,
          metadata: { skipped: true, reason: 'No analysis results' },
        };
      }

      // Validate mod ID
      await this.validateModId(input.analysisResults, errors, warnings);

      // Validate registry names
      await this.validateRegistryNames(input.analysisResults, errors, warnings);

      // Validate texture paths
      await this.validateTexturePaths(input.analysisResults, errors, warnings);

      // Validate manifest information
      await this.validateManifestInfo(input.analysisResults, errors, warnings);

      // Validate analysis notes
      await this.validateAnalysisNotes(input.analysisResults, errors, warnings);

      // Validate extraction completeness
      await this.validateExtractionCompleteness(input.analysisResults, errors, warnings, config);

      const executionTime = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds
      const passed = errors.length === 0;

      logger.debug('Analysis validation completed', {
        passed,
        errorCount: errors.length,
        warningCount: warnings.length,
        executionTime,
      });

      return {
        stageName: this.name,
        passed,
        errors,
        warnings,
        executionTime,
        metadata: {
          checksPerformed: [
            'mod_id',
            'registry_names',
            'texture_paths',
            'manifest_info',
            'analysis_notes',
            'extraction_completeness',
          ],
        },
      };
    } catch (error) {
      const executionTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Analysis validation failed', { error: errorMessage });

      const validationError = createConversionError({
        code: createErrorCode(MODULE_ID, 'EXEC', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: `Analysis validation execution failed: ${errorMessage}`,
        moduleOrigin: MODULE_ID,
        details: { originalError: error },
      });

      return {
        stageName: this.name,
        passed: false,
        errors: [validationError],
        warnings,
        executionTime,
        metadata: { error: errorMessage },
      };
    }
  }

  /**
   * Validate mod ID
   *
   * @param analysisResults Analysis results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateModId(
    analysisResults: any,
    errors: ConversionError[],
    warnings: ConversionError[]
  ): Promise<void> {
    if (analysisResults.modId === undefined || analysisResults.modId === null) {
      errors.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'MODID', 1),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Mod ID is missing from analysis results',
          moduleOrigin: MODULE_ID,
        })
      );
      return;
    }

    const modId = analysisResults.modId;

    // Validate mod ID format
    if (typeof modId !== 'string' || modId.trim().length === 0) {
      errors.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'MODID', 2),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Mod ID must be a non-empty string',
          moduleOrigin: MODULE_ID,
          details: { modId },
        })
      );
      return;
    }

    // Validate mod ID naming conventions
    if (!/^[a-z][a-z0-9_]*$/.test(modId)) {
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'MODID', 3),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: 'Mod ID should follow naming conventions (lowercase, alphanumeric, underscores)',
          moduleOrigin: MODULE_ID,
          details: { modId },
        })
      );
    }

    // Check for reasonable length
    if (modId.length > 64) {
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'MODID', 4),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: 'Mod ID is unusually long (>64 characters)',
          moduleOrigin: MODULE_ID,
          details: { modId, length: modId.length },
        })
      );
    }
  }

  /**
   * Validate registry names
   *
   * @param analysisResults Analysis results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateRegistryNames(
    analysisResults: any,
    errors: ConversionError[],
    warnings: ConversionError[]
  ): Promise<void> {
    if (!analysisResults.registryNames) {
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'REGISTRY', 1),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: 'No registry names found in analysis results',
          moduleOrigin: MODULE_ID,
        })
      );
      return;
    }

    const registryNames = analysisResults.registryNames;

    if (!Array.isArray(registryNames)) {
      errors.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'REGISTRY', 2),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Registry names must be an array',
          moduleOrigin: MODULE_ID,
          details: { type: typeof registryNames },
        })
      );
      return;
    }

    if (registryNames.length === 0) {
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'REGISTRY', 3),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: 'No registry names extracted - mod may not have registerable content',
          moduleOrigin: MODULE_ID,
        })
      );
      return;
    }

    // Validate individual registry names
    registryNames.forEach((name: any, index: number) => {
      if (typeof name !== 'string' || name.trim().length === 0) {
        errors.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'REGISTRY', 4),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Registry name at index ${index} is invalid`,
            moduleOrigin: MODULE_ID,
            details: { index, name, type: typeof name },
          })
        );
      } else if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        warnings.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'REGISTRY', 5),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: `Registry name '${name}' doesn't follow naming conventions`,
            moduleOrigin: MODULE_ID,
            details: { name, index },
          })
        );
      }
    });

    // Check for duplicates
    const uniqueNames = new Set(registryNames);
    if (uniqueNames.size !== registryNames.length) {
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'REGISTRY', 6),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: 'Duplicate registry names detected',
          moduleOrigin: MODULE_ID,
          details: {
            total: registryNames.length,
            unique: uniqueNames.size,
            duplicates: registryNames.length - uniqueNames.size,
          },
        })
      );
    }
  }

  /**
   * Validate texture paths
   *
   * @param analysisResults Analysis results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateTexturePaths(
    analysisResults: any,
    errors: ConversionError[],
    warnings: ConversionError[]
  ): Promise<void> {
    if (!analysisResults.texturePaths) {
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'TEXTURE', 1),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: 'No texture paths found in analysis results',
          moduleOrigin: MODULE_ID,
        })
      );
      return;
    }

    const texturePaths = analysisResults.texturePaths;

    if (!Array.isArray(texturePaths)) {
      errors.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'TEXTURE', 2),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Texture paths must be an array',
          moduleOrigin: MODULE_ID,
          details: { type: typeof texturePaths },
        })
      );
      return;
    }

    // Validate individual texture paths
    texturePaths.forEach((path: any, index: number) => {
      if (typeof path !== 'string' || path.trim().length === 0) {
        errors.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'TEXTURE', 3),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Texture path at index ${index} is invalid`,
            moduleOrigin: MODULE_ID,
            details: { index, path, type: typeof path },
          })
        );
      } else {
        // Check for valid texture file extensions
        const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
        const hasValidExtension = validExtensions.some((ext) => path.toLowerCase().endsWith(ext));

        if (!hasValidExtension) {
          warnings.push(
            createConversionError({
              code: createErrorCode(MODULE_ID, 'TEXTURE', 4),
              type: ErrorType.VALIDATION,
              severity: ErrorSeverity.WARNING,
              message: `Texture path '${path}' doesn't have a recognized image extension`,
              moduleOrigin: MODULE_ID,
              details: { path, validExtensions },
            })
          );
        }

        // Check for reasonable path structure
        if (!path.includes('/') && !path.includes('\\')) {
          warnings.push(
            createConversionError({
              code: createErrorCode(MODULE_ID, 'TEXTURE', 5),
              type: ErrorType.VALIDATION,
              severity: ErrorSeverity.WARNING,
              message: `Texture path '${path}' appears to be missing directory structure`,
              moduleOrigin: MODULE_ID,
              details: { path },
            })
          );
        }
      }
    });
  }

  /**
   * Validate manifest information
   *
   * @param analysisResults Analysis results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateManifestInfo(
    analysisResults: any,
    errors: ConversionError[],
    warnings: ConversionError[]
  ): Promise<void> {
    if (!analysisResults.manifestInfo) {
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'MANIFEST', 1),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: 'No manifest information found in analysis results',
          moduleOrigin: MODULE_ID,
        })
      );
      return;
    }

    const manifest = analysisResults.manifestInfo;

    // Validate required fields
    const requiredFields = ['modId', 'modName', 'version'];
    requiredFields.forEach((field) => {
      if (
        !manifest[field] ||
        (typeof manifest[field] === 'string' && manifest[field].trim().length === 0)
      ) {
        errors.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'MANIFEST', 2),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Required manifest field '${field}' is missing or empty`,
            moduleOrigin: MODULE_ID,
            details: { field, value: manifest[field] },
          })
        );
      }
    });

    // Validate version format
    if (manifest.version && typeof manifest.version === 'string') {
      const versionPattern = /^\d+\.\d+(\.\d+)?(-\w+)?$/;
      if (!versionPattern.test(manifest.version)) {
        warnings.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'MANIFEST', 3),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: `Version '${manifest.version}' doesn't follow semantic versioning`,
            moduleOrigin: MODULE_ID,
            details: { version: manifest.version },
          })
        );
      }
    }

    // Validate dependencies if present
    if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
      manifest.dependencies.forEach((dep: any, index: number) => {
        if (!dep.modId || !dep.version) {
          errors.push(
            createConversionError({
              code: createErrorCode(MODULE_ID, 'MANIFEST', 4),
              type: ErrorType.VALIDATION,
              severity: ErrorSeverity.ERROR,
              message: `Dependency at index ${index} is missing required fields`,
              moduleOrigin: MODULE_ID,
              details: { index, dependency: dep },
            })
          );
        }
      });
    }
  }

  /**
   * Validate analysis notes
   *
   * @param analysisResults Analysis results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   */
  private async validateAnalysisNotes(
    analysisResults: any,
    errors: ConversionError[],
    warnings: ConversionError[]
  ): Promise<void> {
    if (!analysisResults.analysisNotes) {
      // Analysis notes are optional
      return;
    }

    const notes = analysisResults.analysisNotes;

    if (!Array.isArray(notes)) {
      errors.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'NOTES', 1),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Analysis notes must be an array',
          moduleOrigin: MODULE_ID,
          details: { type: typeof notes },
        })
      );
      return;
    }

    // Validate individual notes
    notes.forEach((note: any, index: number) => {
      if (!note.type || !note.message) {
        errors.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'NOTES', 2),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.ERROR,
            message: `Analysis note at index ${index} is missing required fields`,
            moduleOrigin: MODULE_ID,
            details: { index, note },
          })
        );
      }

      const validTypes = ['info', 'warning', 'error'];
      if (note.type && !validTypes.includes(note.type)) {
        warnings.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'NOTES', 3),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: `Analysis note at index ${index} has invalid type '${note.type}'`,
            moduleOrigin: MODULE_ID,
            details: { index, type: note.type, validTypes },
          })
        );
      }
    });
  }

  /**
   * Validate extraction completeness
   *
   * @param analysisResults Analysis results to validate
   * @param errors Error collection
   * @param warnings Warning collection
   * @param config Stage configuration
   */
  private async validateExtractionCompleteness(
    analysisResults: any,
    errors: ConversionError[],
    warnings: ConversionError[],
    config?: Record<string, any>
  ): Promise<void> {
    const minRegistryNames = config?.minRegistryNames ?? 1;
    const minTexturePaths = config?.minTexturePaths ?? 0;

    // Check if we have minimum expected content
    const registryCount = analysisResults.registryNames?.length ?? 0;
    const textureCount = analysisResults.texturePaths?.length ?? 0;

    if (registryCount < minRegistryNames) {
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'COMPLETE', 1),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: `Low registry name count (${registryCount}) - extraction may be incomplete`,
          moduleOrigin: MODULE_ID,
          details: {
            found: registryCount,
            expected: minRegistryNames,
          },
        })
      );
    }

    if (textureCount < minTexturePaths) {
      warnings.push(
        createConversionError({
          code: createErrorCode(MODULE_ID, 'COMPLETE', 2),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: `Low texture path count (${textureCount}) - extraction may be incomplete`,
          moduleOrigin: MODULE_ID,
          details: {
            found: textureCount,
            expected: minTexturePaths,
          },
        })
      );
    }

    // Check for consistency between mod ID and registry names
    if (
      analysisResults.modId &&
      analysisResults.registryNames &&
      Array.isArray(analysisResults.registryNames)
    ) {
      const modId = analysisResults.modId;
      const matchingNames = analysisResults.registryNames.filter(
        (name: any) => typeof name === 'string' && (name.startsWith(modId) || name.includes(modId))
      );

      if (matchingNames.length === 0 && analysisResults.registryNames.length > 0) {
        warnings.push(
          createConversionError({
            code: createErrorCode(MODULE_ID, 'COMPLETE', 3),
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARNING,
            message: 'No registry names match the mod ID - extraction may be incomplete',
            moduleOrigin: MODULE_ID,
            details: {
              modId,
              registryNames: analysisResults.registryNames,
            },
          })
        );
      }
    }
  }
}
