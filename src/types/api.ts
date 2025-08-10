/**
 * API-related type definitions
 *
 * This file contains interfaces related to API mappings and services
 * that translate between Java and Bedrock APIs.
 */

/**
 * Represents an API mapping between Java and Bedrock
 *
 * This interface aligns with the design document's API Mapping Models specification.
 */
export interface APIMapping {
  id: string;
  javaSignature: string;
  bedrockEquivalent: string;
  conversionType: 'direct' | 'wrapper' | 'complex' | 'impossible';
  notes: string;
  exampleUsage?: {
    java: string;
    bedrock: string;
  };
  version: string;
  lastUpdated: Date;
}

/**
 * Interface for API mapping service
 *
 * This interface aligns with the design document's APIMapperService specification.
 */
export interface APIMapperService {
  /**
   * getMapping method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getMapping(javaSignature: string): APIMapping | undefined;
  /**
   * getMappings method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  getMappings(filter?: MappingFilter): APIMapping[];
  /**
   * addMapping method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  addMapping(mapping: APIMapping): Promise<void>;
  /**
   * updateMapping method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  updateMapping(mapping: APIMapping): Promise<void>;
  /**
   * importMappings method.
   *
   * TODO: Add detailed description of the method's purpose and behavior.
   *
   * @param param - TODO: Document parameters
   * @returns result - TODO: Document return value
   * @since 1.0.0
   */
  importMappings(mappings: APIMapping[]): Promise<ImportResult>;
}

/**
 * Filter for API mappings
 */
export interface MappingFilter {
  conversionType?: APIMapping['conversionType'];
  version?: string;
  search?: string;
}

/**
 * Result of importing API mappings
 */
export interface ImportResult {
  added: number;
  updated: number;
  failed: number;
  failures: {
    mapping: APIMapping;
    reason: string;
  }[];
}
