/**
 * AST Transpiler for direct Java-to-JavaScript pattern mapping
 * Handles mappable code patterns using AST-based transformation
 */

import {
  MMIRRepresentation,
  TranslationContext,
  ASTTranspilationResult,
  ASTNode,
  UnmappableCodeSegment,
  APIMapping,
  TranslationWarning,
  SourcePosition
} from '../../types/logic-translation.js';
import { logger } from '../../utils/logger.js';

export interface TranspilationRule {
  name: string;
  pattern: ASTPattern;
  transform: (node: ASTNode, context: TranslationContext) => string;
  confidence: number;
}

export interface ASTPattern {
  nodeType: string;
  conditions?: PatternCondition[];
  childPatterns?: ASTPattern[];
}

export interface PatternCondition {
  property: string;
  operator: 'equals' | 'contains' | 'matches' | 'exists';
  value?: any;
}

export class ASTTranspiler {
  private transpilationRules: TranspilationRule[];
  private apiMappingService: any; // Would be injected

  constructor(apiMappingService?: any) {
    this.apiMappingService = apiMappingService;
    this.transpilationRules = this.initializeTranspilationRules();
  }

  /**
   * Transpile MMIR to JavaScript using AST-based pattern matching
   */
  async transpile(
    mmir: MMIRRepresentation,
    context: TranslationContext
  ): Promise<ASTTranspilationResult> {
    logger.debug('Starting AST-based transpilation');
    
    try {
      const transpilationResult = await this.transpileNodes(mmir.ast, context);
      
      const result: ASTTranspilationResult = {
        code: transpilationResult.code,
        unmappableCode: transpilationResult.unmappableSegments,
        mappedAPIs: transpilationResult.mappedAPIs,
        confidence: transpilationResult.confidence,
        warnings: transpilationResult.warnings
      };
      
      logger.debug('AST transpilation completed', {
        codeLength: result.code.length,
        unmappableSegments: result.unmappableCode.length,
        confidence: result.confidence
      });
      
      return result;
      
    } catch (error) {
      logger.error('AST transpilation failed', { error });
      throw new Error(`AST transpilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transpile a collection of AST nodes
   */
  private async transpileNodes(
    nodes: ASTNode[],
    context: TranslationContext
  ): Promise<{
    code: string;
    unmappableSegments: UnmappableCodeSegment[];
    mappedAPIs: APIMapping[];
    confidence: number;
    warnings: TranslationWarning[];
  }> {
    const codeSegments: string[] = [];
    const unmappableSegments: UnmappableCodeSegment[] = [];
    const mappedAPIs: APIMapping[] = [];
    const warnings: TranslationWarning[] = [];
    let totalConfidence = 0;
    let processedNodes = 0;

    for (const node of nodes) {
      try {
        const nodeResult = await this.transpileNode(node, context);
        
        if (nodeResult.success) {
          codeSegments.push(nodeResult.code);
          mappedAPIs.push(...nodeResult.mappedAPIs);
          totalConfidence += nodeResult.confidence;
          warnings.push(...nodeResult.warnings);
        } else {
          unmappableSegments.push({
            originalCode: this.nodeToString(node),
            reason: nodeResult.reason || 'No matching transpilation rule found',
            context: {
              className: context.modInfo.name,
              methodName: this.extractMethodName(node),
              lineNumber: node.position.line,
              dependencies: context.modInfo.dependencies
            },
            suggestedApproach: nodeResult.suggestedApproach || 'Use LLM-based translation'
          });
        }
        
        processedNodes++;
        
      } catch (error) {
        logger.warn('Failed to transpile node', { 
          nodeType: node.type,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        unmappableSegments.push({
          originalCode: this.nodeToString(node),
          reason: `Transpilation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          context: {
            className: context.modInfo.name,
            methodName: this.extractMethodName(node),
            lineNumber: node.position.line,
            dependencies: context.modInfo.dependencies
          },
          suggestedApproach: 'Manual review required'
        });
      }
    }

    const averageConfidence = processedNodes > 0 ? totalConfidence / processedNodes : 0;
    const code = codeSegments.join('\n');

    return {
      code,
      unmappableSegments,
      mappedAPIs,
      confidence: averageConfidence,
      warnings
    };
  }

  /**
   * Transpile a single AST node
   */
  private async transpileNode(
    node: ASTNode,
    context: TranslationContext
  ): Promise<{
    success: boolean;
    code: string;
    mappedAPIs: APIMapping[];
    confidence: number;
    warnings: TranslationWarning[];
    reason?: string;
    suggestedApproach?: string;
  }> {
    // Find matching transpilation rule
    const matchingRule = this.findMatchingRule(node);
    
    if (!matchingRule) {
      return {
        success: false,
        code: '',
        mappedAPIs: [],
        confidence: 0,
        warnings: [],
        reason: `No transpilation rule found for node type: ${node.type}`,
        suggestedApproach: 'Use LLM-based semantic translation'
      };
    }

    try {
      // Apply the transpilation rule
      const transpiledCode = matchingRule.transform(node, context);
      
      // Extract any API mappings used
      const mappedAPIs = await this.extractAPIMappings(node, transpiledCode, context);
      
      // Generate warnings if needed
      const warnings = this.generateWarnings(node, matchingRule, context);
      
      // Recursively transpile child nodes if needed
      const childResults = await this.transpileChildNodes(node, context);
      
      const finalCode = this.combineCodeSegments(transpiledCode, childResults.code);
      
      return {
        success: true,
        code: finalCode,
        mappedAPIs: [...mappedAPIs, ...childResults.mappedAPIs],
        confidence: (matchingRule.confidence + childResults.confidence) / 2,
        warnings: [...warnings, ...childResults.warnings]
      };
      
    } catch (error) {
      return {
        success: false,
        code: '',
        mappedAPIs: [],
        confidence: 0,
        warnings: [],
        reason: `Transpilation rule execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestedApproach: 'Manual review and custom implementation required'
      };
    }
  }

  /**
   * Transpile child nodes recursively
   */
  private async transpileChildNodes(
    node: ASTNode,
    context: TranslationContext
  ): Promise<{
    code: string;
    mappedAPIs: APIMapping[];
    confidence: number;
    warnings: TranslationWarning[];
  }> {
    if (node.children.length === 0) {
      return {
        code: '',
        mappedAPIs: [],
        confidence: 1.0,
        warnings: []
      };
    }

    const childResult = await this.transpileNodes(node.children, context);
    
    return {
      code: childResult.code,
      mappedAPIs: childResult.mappedAPIs,
      confidence: childResult.confidence,
      warnings: childResult.warnings
    };
  }

  /**
   * Find matching transpilation rule for a node
   */
  private findMatchingRule(node: ASTNode): TranspilationRule | null {
    for (const rule of this.transpilationRules) {
      if (this.matchesPattern(node, rule.pattern)) {
        return rule;
      }
    }
    return null;
  }

  /**
   * Check if a node matches a pattern
   */
  private matchesPattern(node: ASTNode, pattern: ASTPattern): boolean {
    // Check node type
    if (node.type !== pattern.nodeType) {
      return false;
    }

    // Check conditions
    if (pattern.conditions) {
      for (const condition of pattern.conditions) {
        if (!this.evaluateCondition(node, condition)) {
          return false;
        }
      }
    }

    // Check child patterns
    if (pattern.childPatterns) {
      if (node.children.length < pattern.childPatterns.length) {
        return false;
      }

      for (let i = 0; i < pattern.childPatterns.length; i++) {
        if (!this.matchesPattern(node.children[i], pattern.childPatterns[i])) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate a pattern condition
   */
  private evaluateCondition(node: ASTNode, condition: PatternCondition): boolean {
    const propertyValue = this.getNodeProperty(node, condition.property);

    switch (condition.operator) {
      case 'equals':
        return propertyValue === condition.value;
      case 'contains':
        return typeof propertyValue === 'string' && 
               typeof condition.value === 'string' &&
               propertyValue.includes(condition.value);
      case 'matches':
        return typeof propertyValue === 'string' && 
               typeof condition.value === 'string' &&
               new RegExp(condition.value).test(propertyValue);
      case 'exists':
        return propertyValue !== undefined && propertyValue !== null;
      default:
        return false;
    }
  }

  /**
   * Get a property value from a node
   */
  private getNodeProperty(node: ASTNode, property: string): any {
    switch (property) {
      case 'type':
        return node.type;
      case 'value':
        return node.value;
      case 'childCount':
        return node.children.length;
      case 'javaType':
        return node.metadata?.javaType;
      case 'mappable':
        return node.metadata?.mappable;
      default:
        return undefined;
    }
  }

  /**
   * Extract API mappings used in transpilation
   */
  private async extractAPIMappings(
    node: ASTNode,
    transpiledCode: string,
    context: TranslationContext
  ): Promise<APIMapping[]> {
    const mappings: APIMapping[] = [];
    
    // This would analyze the transpiled code and identify which API mappings were used
    // For now, return empty array as this requires integration with API mapping service
    
    return mappings;
  }

  /**
   * Generate warnings for transpilation
   */
  private generateWarnings(
    node: ASTNode,
    rule: TranspilationRule,
    context: TranslationContext
  ): TranslationWarning[] {
    const warnings: TranslationWarning[] = [];

    // Check for low confidence transpilation
    if (rule.confidence < 0.7) {
      warnings.push({
        type: 'low_confidence_transpilation',
        message: `Transpilation rule '${rule.name}' has low confidence (${rule.confidence})`,
        severity: 'warning',
        location: node.position,
        suggestion: 'Consider manual review of the generated code'
      });
    }

    // Check for complex node structures
    if (node.children.length > 10) {
      warnings.push({
        type: 'complex_node_structure',
        message: `Node has many children (${node.children.length}), transpilation may be incomplete`,
        severity: 'warning',
        location: node.position,
        suggestion: 'Verify that all child elements are properly transpiled'
      });
    }

    return warnings;
  }

  /**
   * Combine code segments
   */
  private combineCodeSegments(parentCode: string, childCode: string): string {
    if (!childCode.trim()) {
      return parentCode;
    }
    
    if (!parentCode.trim()) {
      return childCode;
    }
    
    return `${parentCode}\n${childCode}`;
  }

  /**
   * Convert AST node to string representation
   */
  private nodeToString(node: ASTNode): string {
    // This would generate a string representation of the original Java code
    // For now, return a simplified representation
    let result = node.value || node.type;
    
    if (node.children.length > 0) {
      const childStrings = node.children.map(child => this.nodeToString(child));
      result += ` { ${childStrings.join('; ')} }`;
    }
    
    return result;
  }

  /**
   * Extract method name from node context
   */
  private extractMethodName(node: ASTNode): string {
    if (node.type === 'MethodDeclaration') {
      return node.value || 'unknownMethod';
    }
    
    // Look for method declaration in parent context
    // This is simplified - in practice, we'd maintain a context stack
    return 'unknownMethod';
  }

  /**
   * Initialize transpilation rules
   */
  private initializeTranspilationRules(): TranspilationRule[] {
    return [
      // Class Declaration Rule
      {
        name: 'ClassDeclaration',
        pattern: {
          nodeType: 'ClassDeclaration'
        },
        transform: (node: ASTNode, context: TranslationContext) => {
          const className = node.value || 'UnknownClass';
          return `// Transpiled class: ${className}\nclass ${className} {\n  constructor() {\n    // Class initialization\n  }\n}`;
        },
        confidence: 0.9
      },

      // Method Declaration Rule
      {
        name: 'MethodDeclaration',
        pattern: {
          nodeType: 'MethodDeclaration'
        },
        transform: (node: ASTNode, context: TranslationContext) => {
          const methodName = node.value || 'unknownMethod';
          return `  ${methodName}() {\n    // Method implementation\n  }`;
        },
        confidence: 0.8
      },

      // If Statement Rule
      {
        name: 'IfStatement',
        pattern: {
          nodeType: 'IfStatement'
        },
        transform: (node: ASTNode, context: TranslationContext) => {
          return `if (condition) {\n  // If body\n}`;
        },
        confidence: 0.95
      },

      // For Loop Rule
      {
        name: 'ForLoop',
        pattern: {
          nodeType: 'ForLoop'
        },
        transform: (node: ASTNode, context: TranslationContext) => {
          return `for (let i = 0; i < length; i++) {\n  // Loop body\n}`;
        },
        confidence: 0.9
      },

      // While Loop Rule
      {
        name: 'WhileLoop',
        pattern: {
          nodeType: 'WhileLoop'
        },
        transform: (node: ASTNode, context: TranslationContext) => {
          return `while (condition) {\n  // Loop body\n}`;
        },
        confidence: 0.9
      },

      // Method Call Rule
      {
        name: 'MethodCall',
        pattern: {
          nodeType: 'MethodCall'
        },
        transform: (node: ASTNode, context: TranslationContext) => {
          const methodName = node.value || 'unknownMethod';
          return `${methodName}();`;
        },
        confidence: 0.7
      },

      // Assignment Rule
      {
        name: 'Assignment',
        pattern: {
          nodeType: 'Assignment'
        },
        transform: (node: ASTNode, context: TranslationContext) => {
          const variableName = node.value || 'variable';
          return `let ${variableName} = value;`;
        },
        confidence: 0.85
      },

      // Field Declaration Rule
      {
        name: 'FieldDeclaration',
        pattern: {
          nodeType: 'FieldDeclaration'
        },
        transform: (node: ASTNode, context: TranslationContext) => {
          const fieldName = node.value || 'field';
          return `  ${fieldName} = null;`;
        },
        confidence: 0.8
      },

      // Comment Rule
      {
        name: 'Comment',
        pattern: {
          nodeType: 'Comment'
        },
        transform: (node: ASTNode, context: TranslationContext) => {
          const comment = node.value || '';
          if (comment.startsWith('//')) {
            return comment;
          } else if (comment.startsWith('/*')) {
            return comment;
          }
          return `// ${comment}`;
        },
        confidence: 1.0
      }
    ];
  }
}