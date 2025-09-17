/**
 * API Mapping Admin Service
 *
 * Service for administrative management of API mappings.
 * Provides validation, bulk operations, and admin interface support.
 */

import { APIMapping, APIMapperService, MappingFilter, ImportResult } from '../types/api.js';
import { createLogger } from '../utils/logger.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { ErrorSeverity, createErrorCode } from '../types/errors.js';

const logger = createLogger('APIMappingAdminService');
const MODULE_ID = 'API_MAPPING_ADMIN';

/**
 * Validation result for API mappings
 */
export interface MappingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  successful: number;
  failed: number;
  errors: {
    mapping: APIMapping;
    error: string;
  }[];
}

/**
 * Mapping statistics
 */
export interface MappingStatistics {
  totalMappings: number;
  byConversionType: Record<string, number>;
  byVersion: Record<string, number>;
  recentlyUpdated: APIMapping[];
  mostUsed: APIMapping[];
}

/**
 * Admin service for API mapping management
 */
export class APIMappingAdminService {
  private apiMapperService: APIMapperService;

  /**
   * constructor method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  constructor(apiMapperService: APIMapperService) {
    this.apiMapperService = apiMapperService;
    logger.info('APIMappingAdminService initialized');
  }

  /**
   * Validate an API mapping
   */
  validateMapping(mapping: APIMapping): MappingValidationResult {
    const result: MappingValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Required field validation
      if (!mapping.id || mapping.id.trim() === '') {
        result.errors.push('Mapping ID is required');
      }

      if (!mapping.javaSignature || mapping.javaSignature.trim() === '') {
        result.errors.push('Java signature is required');
      }

      if (!mapping.bedrockEquivalent || mapping.bedrockEquivalent.trim() === '') {
        result.errors.push('Bedrock equivalent is required');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!mapping.conversionType) {
        result.errors.push('Conversion type is required');
      } else if (!['direct', 'wrapper', 'complex', 'impossible'].includes(mapping.conversionType)) {
        result.errors.push(
          'Invalid conversion type. Must be: direct, wrapper, complex, or impossible'
        );
      }

      if (!mapping.version || mapping.version < 1) {
        result.errors.push('Version is required and must be a positive number');
      }

      if (!mapping.notes || mapping.notes.trim() === '') {
        result.warnings.push('Notes are recommended for better documentation');
      }

      // Format validation
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (mapping.javaSignature && !this.isValidJavaSignature(mapping.javaSignature)) {
        result.warnings.push('Java signature format may be invalid');
      }

      if (
        mapping.bedrockEquivalent &&
        mapping.bedrockEquivalent !== 'UNSUPPORTED' &&
        !this.isValidBedrockSignature(mapping.bedrockEquivalent)
      ) {
        result.warnings.push('Bedrock equivalent format may be invalid');
      }

      // Version is now numeric and validated above

      // Example usage validation
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (mapping.exampleUsage) {
        if (!mapping.exampleUsage.java || mapping.exampleUsage.java.trim() === '') {
          result.warnings.push('Java example usage is empty');
        }
        if (!mapping.exampleUsage.bedrock || mapping.exampleUsage.bedrock.trim() === '') {
          result.warnings.push('Bedrock example usage is empty');
        }
      }

      // Consistency checks
      if (mapping.conversionType === 'impossible' && mapping.bedrockEquivalent !== 'UNSUPPORTED') {
        result.warnings.push(
          'Impossible conversions should have "UNSUPPORTED" as bedrock equivalent'
        );
      }

      if (mapping.conversionType === 'direct' && mapping.bedrockEquivalent === 'UNSUPPORTED') {
        result.errors.push('Direct conversions cannot have "UNSUPPORTED" as bedrock equivalent');
      }

      result.isValid = result.errors.length === 0;

      logger.debug(`Validated mapping ${mapping.id}`, {
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error validating mapping: ${errorMessage}`, { error, mapping });

      result.errors.push(`Validation error: ${errorMessage}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate multiple mappings
   */
  validateMappings(mappings: APIMapping[]): {
    valid: APIMapping[];
    invalid: { mapping: APIMapping; validation: MappingValidationResult }[];
  } {
    const valid: APIMapping[] = [];
    const invalid: { mapping: APIMapping; validation: MappingValidationResult }[] = [];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const mapping of mappings) {
      const validation = this.validateMapping(mapping);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (validation.isValid) {
        valid.push(mapping);
      } else {
        invalid.push({ mapping, validation });
      }
    }

    logger.info(`Validated ${mappings.length} mappings`, {
      valid: valid.length,
      invalid: invalid.length,
    });

    return { valid, invalid };
  }

  /**
   * Bulk add mappings with validation
   */
  async bulkAddMappings(mappings: APIMapping[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    logger.info(`Starting bulk add of ${mappings.length} mappings`);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const mapping of mappings) {
      try {
        // Validate mapping
        const validation = this.validateMapping(mapping);
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Add mapping
        await this.apiMapperService.addMapping(mapping);
        result.successful++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed++;
        result.errors.push({
          mapping,
          error: errorMessage,
        });

        logger.warn(`Failed to add mapping ${mapping.id}: ${errorMessage}`);
      }
    }

    logger.info(`Bulk add completed`, result);
    return result;
  }

  /**
   * Bulk update mappings with validation
   */
  async bulkUpdateMappings(mappings: APIMapping[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    logger.info(`Starting bulk update of ${mappings.length} mappings`);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const mapping of mappings) {
      try {
        // Validate mapping
        const validation = this.validateMapping(mapping);
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Update mapping
        await this.apiMapperService.updateMapping(mapping.id, mapping);
        result.successful++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed++;
        result.errors.push({
          mapping,
          error: errorMessage,
        });

        logger.warn(`Failed to update mapping ${mapping.id}: ${errorMessage}`);
      }
    }

    logger.info(`Bulk update completed`, result);
    return result;
  }

  /**
   * Get mapping statistics
   */
  async getMappingStatistics(): Promise<MappingStatistics> {
    try {
      const allMappings = await this.apiMapperService.getMappings();

      const stats: MappingStatistics = {
        totalMappings: allMappings.length,
        byConversionType: {},
        byVersion: {},
        recentlyUpdated: [],
        mostUsed: [],
      };

      // Count by conversion type
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const mapping of allMappings) {
        stats.byConversionType[mapping.conversionType] =
          (stats.byConversionType[mapping.conversionType] || 0) + 1;
      }

      // Count by version
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const mapping of allMappings) {
        stats.byVersion[mapping.version] = (stats.byVersion[mapping.version] || 0) + 1;
      }

      // Recently updated (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      stats.recentlyUpdated = allMappings
        .filter((m) => m.lastUpdated >= thirtyDaysAgo)
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
        .slice(0, 10);

      // Most used (placeholder - would need usage tracking)
      stats.mostUsed = allMappings.filter((m) => m.conversionType === 'direct').slice(0, 10);

      logger.debug('Generated mapping statistics', stats);
      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error generating mapping statistics: ${errorMessage}`, { error });

      ErrorHandler.systemError(
        `Failed to generate mapping statistics: ${errorMessage}`,
        MODULE_ID,
        { originalError: error },
        ErrorSeverity.ERROR,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'STATS', 1)
      );

      // Return empty stats on error
      return {
        totalMappings: 0,
        byConversionType: {},
        byVersion: {},
        recentlyUpdated: [],
        mostUsed: [],
      };
    }
  }

  /**
   * Export mappings to JSON format
   */
  async exportMappings(filter?: MappingFilter): Promise<string> {
    try {
      const mappings = await this.apiMapperService.getMappings(filter);
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        filter,
        mappings,
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      logger.info(`Exported ${mappings.length} mappings to JSON`);
      return jsonString;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error exporting mappings: ${errorMessage}`, { error });

      ErrorHandler.systemError(
        `Failed to export mappings: ${errorMessage}`,
        MODULE_ID,
        { filter, originalError: error },
        ErrorSeverity.ERROR,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'EXPORT', 1)
      );

      throw error;
    }
  }

  /**
   * Import mappings from JSON format
   */
  async importMappingsFromJson(jsonString: string): Promise<ImportResult> {
    try {
      const importData = JSON.parse(jsonString);

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!importData.mappings || !Array.isArray(importData.mappings)) {
        throw new Error('Invalid import format: mappings array not found');
      }

      const mappings: APIMapping[] = importData.mappings;

      // Validate all mappings first
      const { valid, invalid } = this.validateMappings(mappings);

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (invalid.length > 0) {
        logger.warn(`Found ${invalid.length} invalid mappings during import`);
      }

      // Import valid mappings
      const result = await this.apiMapperService.importMappings(valid);

      // Add validation failures to the result
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const invalidMapping of invalid) {
        result.failed++;
        result.failures.push({
          mapping: invalidMapping.mapping,
          reason: invalidMapping.validation.errors.join(', '),
        });
      }

      logger.info(`Import completed`, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error importing mappings: ${errorMessage}`, { error });

      ErrorHandler.systemError(
        `Failed to import mappings: ${errorMessage}`,
        MODULE_ID,
        { originalError: error },
        ErrorSeverity.ERROR,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'IMPORT', 1)
      );

      throw error;
    }
  }

  /**
   * Validate Java signature format
   */
  private isValidJavaSignature(signature: string): boolean {
    // Basic validation for Java package.class.method format
    const javaSignaturePattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;
    return javaSignaturePattern.test(signature);
  }

  /**
   * Validate Bedrock signature format
   */
  private isValidBedrockSignature(signature: string): boolean {
    // Allow UNSUPPORTED or basic JavaScript-like signatures
    if (signature === 'UNSUPPORTED') {
      return true;
    }

    // Basic validation for JavaScript-like signatures
    const bedrockSignaturePattern =
      /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(\(\))?$/;
    return bedrockSignaturePattern.test(signature);
  }
}

/**
 * Factory function to create an APIMappingAdminService instance
 */
export function createAPIMappingAdminService(
  apiMapperService: APIMapperService
): APIMappingAdminService {
  return new APIMappingAdminService(apiMapperService);
}
