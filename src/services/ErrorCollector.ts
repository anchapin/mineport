/**
 * Error Collector Service
 * 
 * This service is responsible for collecting, aggregating, and managing errors
 * from all modules during the conversion process.
 */

import { 
  ConversionError, 
  ErrorCollector as IErrorCollector, 
  ErrorCollectorOptions, 
  ErrorFilter, 
  ErrorSummary,
  ErrorSeverity,
  ErrorType
} from '../types/errors';

/**
 * Implementation of the ErrorCollector service
 */
export class ErrorCollector implements IErrorCollector {
  private errors: ConversionError[] = [];
  private options: Required<ErrorCollectorOptions>;
  
  /**
   * Creates a new instance of the ErrorCollector
   * 
   * @param options Configuration options for the collector
   */
  constructor(options: ErrorCollectorOptions = {}) {
    this.options = {
      maxErrors: options.maxErrors ?? 1000,
      groupSimilarErrors: options.groupSimilarErrors ?? true,
      filterDuplicates: options.filterDuplicates ?? true,
      categorizeByModule: options.categorizeByModule ?? true
    };
  }
  
  /**
   * Add a single error to the collection
   * 
   * @param error The error to add
   */
  public addError(error: ConversionError): void {
    // Check if we should filter out duplicates
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.options.filterDuplicates && this.isDuplicate(error)) {
      return;
    }
    
    // Check if we've reached the maximum number of errors
    if (this.errors.length >= this.options.maxErrors) {
      // Replace the least severe error if the new one is more severe
      const leastSevereIndex = this.findLeastSevereErrorIndex();
      if (leastSevereIndex !== -1 && this.compareSeverity(error.severity, this.errors[leastSevereIndex].severity) > 0) {
        this.errors[leastSevereIndex] = error;
      }
    } else {
      this.errors.push(error);
    }
  }
  
  /**
   * Add multiple errors to the collection
   * 
   * @param errors The errors to add
   */
  public addErrors(errors: ConversionError[]): void {
    errors.forEach(error => this.addError(error));
  }
  
  /**
   * Get errors based on optional filter criteria
   * 
   * @param filter Optional filter criteria
   * @returns Filtered errors
   */
  public getErrors(filter?: ErrorFilter): ConversionError[] {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!filter) {
      return [...this.errors];
    }
    
    return this.errors.filter(error => {
      // Filter by types
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter.types && filter.types.length > 0) {
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!filter.types.includes(error.type as ErrorType)) {
          return false;
        }
      }
      
      // Filter by severities
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter.severities && filter.severities.length > 0) {
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!filter.severities.includes(error.severity as ErrorSeverity)) {
          return false;
        }
      }
      
      // Filter by modules
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter.modules && filter.modules.length > 0) {
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!filter.modules.includes(error.moduleOrigin)) {
          return false;
        }
      }
      
      // Filter by codes
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter.codes && filter.codes.length > 0) {
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!filter.codes.includes(error.code)) {
          return false;
        }
      }
      
      // Filter by search term
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase();
        /**
         * return method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        return (
          error.message.toLowerCase().includes(searchTerm) ||
          error.moduleOrigin.toLowerCase().includes(searchTerm) ||
          error.code.toLowerCase().includes(searchTerm) ||
          (error.recommendedFix && error.recommendedFix.toLowerCase().includes(searchTerm))
        );
      }
      
      return true;
    });
  }
  
  /**
   * Get a summary of all collected errors
   * 
   * @returns Error summary
   */
  public getErrorSummary(): ErrorSummary {
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byModule: Record<string, number> = {};
    
    // Initialize counters
    Object.values(ErrorSeverity).forEach(severity => {
      bySeverity[severity] = 0;
    });
    
    Object.values(ErrorType).forEach(type => {
      byType[type] = 0;
    });
    
    // Count errors by severity, type, and module
    this.errors.forEach(error => {
      const severity = error.severity.toString();
      const type = error.type.toString();
      const module = error.moduleOrigin;
      
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
      byModule[module] = (byModule[module] || 0) + 1;
    });
    
    // Get the most critical errors (critical and error severity)
    const mostCritical = this.errors
      .filter(error => 
        error.severity === ErrorSeverity.CRITICAL || 
        error.severity === ErrorSeverity.ERROR
      )
      .sort((a, b) => this.compareSeverity(b.severity, a.severity))
      .slice(0, 10);
    
    return {
      totalErrors: this.errors.length,
      bySeverity,
      byType,
      byModule,
      mostCritical
    };
  }
  
  /**
   * Get errors from a specific module
   * 
   * @param moduleId Module identifier
   * @returns Errors from the specified module
   */
  public getErrorsByModule(moduleId: string): ConversionError[] {
    return this.errors.filter(error => error.moduleOrigin === moduleId);
  }
  
  /**
   * Get errors of a specific type
   * 
   * @param type Error type
   * @returns Errors of the specified type
   */
  public getErrorsByType(type: ErrorType | string): ConversionError[] {
    return this.errors.filter(error => error.type.toString() === type.toString());
  }
  
  /**
   * Get errors of a specific severity
   * 
   * @param severity Error severity
   * @returns Errors of the specified severity
   */
  public getErrorsBySeverity(severity: ErrorSeverity | string): ConversionError[] {
    return this.errors.filter(error => error.severity.toString() === severity.toString());
  }
  
  /**
   * Check if there are any errors, optionally of a specific severity
   * 
   * @param severity Optional severity to check for
   * @returns True if there are errors of the specified severity
   */
  public hasErrors(severity?: ErrorSeverity | string): boolean {
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!severity) {
      return this.errors.length > 0;
    }
    
    return this.errors.some(error => error.severity.toString() === severity.toString());
  }
  
  /**
   * Clear all collected errors
   */
  public clear(): void {
    this.errors = [];
  }
  
  /**
   * Check if an error is a duplicate of an existing error
   * 
   * @param error Error to check
   * @returns True if the error is a duplicate
   */
  private isDuplicate(error: ConversionError): boolean {
    return this.errors.some(existingError => 
      existingError.code === error.code &&
      existingError.message === error.message &&
      existingError.moduleOrigin === error.moduleOrigin &&
      JSON.stringify(existingError.sourceLocation) === JSON.stringify(error.sourceLocation)
    );
  }
  
  /**
   * Find the index of the least severe error in the collection
   * 
   * @returns Index of the least severe error, or -1 if the collection is empty
   */
  private findLeastSevereErrorIndex(): number {
    if (this.errors.length === 0) {
      return -1;
    }
    
    let leastSevereIndex = 0;
    let leastSeverity = this.errors[0].severity;
    
    for (let i = 1; i < this.errors.length; i++) {
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (this.compareSeverity(leastSeverity, this.errors[i].severity) > 0) {
        leastSevereIndex = i;
        leastSeverity = this.errors[i].severity;
      }
    }
    
    return leastSevereIndex;
  }
  
  /**
   * Compare two severity levels
   * 
   * @param a First severity
   * @param b Second severity
   * @returns Positive if a is more severe, negative if b is more severe, 0 if equal
   */
  private compareSeverity(a: ErrorSeverity | string, b: ErrorSeverity | string): number {
    const severityOrder: Record<string, number> = {
      [ErrorSeverity.CRITICAL]: 4,
      [ErrorSeverity.ERROR]: 3,
      [ErrorSeverity.WARNING]: 2,
      [ErrorSeverity.INFO]: 1
    };
    
    return severityOrder[a.toString()] - severityOrder[b.toString()];
  }
}