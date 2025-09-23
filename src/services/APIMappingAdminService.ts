/**
 * API Mapping Admin Service
 *
 * Service for administrative management of API mappings.
 * Provides validation, bulk operations, and admin interface support.
 */

import {
  APIMapping,
  validateAPIMapping,
  validateJavaSignature,
  validateBedrockEquivalent,
} from '../modules/logic/APIMapping.js';
import { APIMapperService, MappingFilter, ImportResult } from '../types/api.js';
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
   * Validate an API mapping with consistency checks
   */
  async validateMapping(
    mapping: Partial<APIMapping>,
    checkConsistency = true
  ): Promise<MappingValidationResult> {
    const result: MappingValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Perform structural validation first
      validateAPIMapping(mapping);

      // Detailed validation for specific fields
      const javaValidation = validateJavaSignature(mapping.javaSignature!);
      if (!javaValidation.isValid) {
        result.errors.push(...javaValidation.errors);
      }

      const bedrockValidation = validateBedrockEquivalent(mapping.bedrockEquivalent!);
      if (!bedrockValidation.isValid) {
        result.errors.push(...bedrockValidation.errors);
      }

      if (!mapping.notes || mapping.notes.trim() === '') {
        result.warnings.push('Notes are recommended for better documentation.');
      }

      // Consistency checks
      if (checkConsistency && mapping.javaSignature) {
        const existingBySig = await this.apiMapperService.getMapping(mapping.javaSignature);
        if (existingBySig && existingBySig.id !== mapping.id) {
          result.errors.push(
            `A mapping with the signature "${mapping.javaSignature}" already exists (ID: ${existingBySig.id}).`
          );
        }
      }
    } catch (error: any) {
      result.errors.push(error.message);
    }

    result.isValid = result.errors.length === 0;
    logger.debug(`Validated mapping`, {
      isValid: result.isValid,
      errors: result.errors,
      warnings: result.warnings,
    });

    return result;
  }

  /**
   * Validate multiple mappings, including checks for internal consistency.
   */
  async validateMappings(mappings: APIMapping[]): Promise<{
    valid: APIMapping[];
    invalid: { mapping: APIMapping; validation: MappingValidationResult }[];
  }> {
    const valid: APIMapping[] = [];
    const invalid: { mapping: APIMapping; validation: MappingValidationResult }[] = [];
    const seenSignatures = new Set<string>();

    for (const mapping of mappings) {
      const validation = await this.validateMapping(mapping);

      // Check for duplicate signatures within the batch
      if (seenSignatures.has(mapping.javaSignature)) {
        validation.isValid = false;
        validation.errors.push(
          `Duplicate Java signature "${mapping.javaSignature}" found in the import batch.`
        );
      } else {
        seenSignatures.add(mapping.javaSignature);
      }

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

    for (const mapping of mappings) {
      try {
        // Validate mapping
          const validation = await this.validateMapping(mapping);
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

      if (!importData.mappings || !Array.isArray(importData.mappings)) {
        throw new Error('Invalid import format: mappings array not found');
      }

      const mappings: APIMapping[] = importData.mappings;

      // Validate all mappings first
      const { valid, invalid } = await this.validateMappings(mappings);

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

}

/**
 * Factory function to create an APIMappingAdminService instance
 */
export function createAPIMappingAdminService(
  apiMapperService: APIMapperService
): APIMappingAdminService {
  return new APIMappingAdminService(apiMapperService);
}
