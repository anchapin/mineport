/**
 * API-related type definitions
 * 
 * This file contains interfaces related to API mappings and services
 * that translate between Java and Bedrock APIs.
 */

import { APIMapping } from '../modules/logic/APIMapping';

/**
 * Filter for querying API mappings.
 */
export interface MappingFilter {
  conversionType?: APIMapping['conversionType'];
  version?: string;
  search?: string;
}

/**
 * Represents a failure during a bulk import operation.
 */
export interface MappingFailure {
  mapping: APIMapping;
  reason: string;
}

/**
 * The result of a bulk import operation for API mappings.
 */
export interface ImportResult {
  added: number;
  updated: number;
  failed: number;
  failures: MappingFailure[];
}

/**
 * Defines the contract for a database that stores and manages API mappings.
 * This interface supports versioned, thread-safe CRUD operations.
 */
export interface MappingDatabase {
  /**
   * Creates a new API mapping in the database.
   * @param mappingData - The mapping data to create, without id, version, createdAt, or lastUpdated.
   * @returns The newly created APIMapping with all fields.
   */
  create(mappingData: Omit<APIMapping, 'id' | 'version' | 'createdAt' | 'lastUpdated'>): Promise<APIMapping>;

  /**
   * Retrieves a single API mapping by its unique ID.
   * @param id - The unique identifier of the mapping.
   * @returns The found APIMapping or undefined.
   */
  get(id: string): Promise<APIMapping | undefined>;

  /**
   * Retrieves a single API mapping by its Java signature.
   * @param javaSignature - The Java signature to search for.
   * @returns The found APIMapping or undefined.
   */
  getBySignature(javaSignature: string): Promise<APIMapping | undefined>;

  /**
   * Retrieves a list of API mappings based on an optional filter.
   * @param filter - The filter criteria to apply.
   * @returns A list of matching API mappings.
   */
  getAll(filter?: MappingFilter): Promise<APIMapping[]>;

  /**
   * Updates an existing API mapping.
   * @param id - The ID of the mapping to update.
   * @param updates - An object with the fields to update.
   * @returns The updated APIMapping.
   */
  update(id: string, updates: Partial<Omit<APIMapping, 'id'>>): Promise<APIMapping>;

  /**
   * Deletes an API mapping from the database.
   * @param id - The ID of the mapping to delete.
   * @returns True if the mapping was deleted, false otherwise.
   */
  delete(id: string): Promise<boolean>;

  /**
   * Performs a bulk import of API mappings, creating new ones or updating existing ones.
   * @param mappings - A list of mappings to import.
   * @returns An object summarizing the import results.
   */
  bulkImport(mappings: APIMapping[]): Promise<ImportResult>;

  /**
   * Counts the total number of mappings in the database.
   * @returns The total number of mappings.
   */
  count(): Promise<number>;
}


/**
 * Service for managing and providing access to Java-to-Bedrock API mappings.
 * It integrates with a versioned database and provides caching capabilities.
 */
export interface APIMapperService {
  /**
   * Retrieves a single API mapping by its Java signature.
   * @param javaSignature - The Java signature to search for.
   * @returns The found APIMapping or undefined.
   */
  getMapping(javaSignature: string): Promise<APIMapping | undefined>;

  /**
   * Retrieves a list of API mappings based on an optional filter.
   * @param filter - The filter criteria to apply.
   * @returns A list of matching API mappings.
   */
  getMappings(filter?: MappingFilter): Promise<APIMapping[]>;

  /**
   * Adds a new API mapping to the database.
   * @param mappingData - The data for the new mapping.
   * @returns The created APIMapping.
   */
  addMapping(mappingData: Omit<APIMapping, 'id' | 'version' | 'createdAt' | 'lastUpdated'>): Promise<APIMapping>;

  /**
   * Updates an existing API mapping.
   * @param id - The ID of the mapping to update.
   * @param updates - An object with the fields to update.
   * @returns The updated APIMapping.
   */
  updateMapping(id: string, updates: Partial<Omit<APIMapping, 'id'>>): Promise<APIMapping>;

  /**
   * Deletes an API mapping.
   * @param id - The ID of the mapping to delete.
   * @returns True if deletion was successful, false otherwise.
   */
  deleteMapping(id: string): Promise<boolean>;

  /**
   * Imports a list of mappings in bulk.
   * @param mappings - The mappings to import.
   * @returns A summary of the import operation.
   */
  importMappings(mappings: APIMapping[]): Promise<ImportResult>;

  /**
   * Clears the service's internal cache.
   */
  clearCache(): void;

  /**
   * Retrieves statistics about the cache.
   */
  getCacheStats(): { size: number; maxSize: number; enabled: boolean };

  /**
   * Retrieves statistics about the database.
   */
  getDatabaseStats(): Promise<{ totalMappings: number }>;
}