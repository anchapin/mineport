/**
 * JavaScriptGenerator.ts
 *
 * This module generates JavaScript code from AST and integrates outputs from both
 * AST transpilation and LLM translation. It also handles formatting and optimization
 * of the generated code.
 */

import { JavaScriptASTNode, TranspilationResult } from './ASTTranspiler.js';
import { LLMTranslationResult } from './LLMTranslationService.js';
import { MMIRNode } from './MMIRGenerator.js';

/**
 * Options for JavaScript code generation
 */
export interface CodeGenerationOptions {
  /**
   * Whether to include source maps
   */
  includeSourceMaps?: boolean;

  /**
   * Whether to minify the output
   */
  minify?: boolean;

  /**
   * Whether to include comments
   */
  includeComments?: boolean;

  /**
   * Indentation to use (number of spaces or 'tab')
   */
  indent?: number | 'tab';

  /**
   * Whether to use semicolons
   */
  useSemicolons?: boolean;

  /**
   * Whether to use single quotes
   */
  useSingleQuotes?: boolean;
}

/**
 * Result of JavaScript code generation
 */
export interface GeneratedJavaScript {
  /**
   * The generated JavaScript code
   */
  code: string;

  /**
   * Source map if requested
   */
  sourceMap?: string;

  /**
   * Warnings generated during code generation
   */
  warnings: string[];

  /**
   * Metadata about the generated code
   */
  metadata: {
    /**
     * Original mod ID
     */
    modId: string;

    /**
     * Original mod name
     */
    modName: string;

    /**
     * Original mod version
     */
    modVersion: string;

    /**
     * Original mod loader
     */
    originalModLoader: 'forge' | 'fabric';

    /**
     * Statistics about the generated code
     */
    stats: {
      /**
       * Number of lines of code
       */
      linesOfCode: number;

      /**
       * Number of functions
       */
      functionCount: number;

      /**
       * Number of variables
       */
      variableCount: number;
    };
  };
}

/**
 * Integrated code from AST and LLM sources
 */
export interface IntegratedCode {
  /**
   * The file path
   */
  filePath: string;

  /**
   * The generated code
   */
  code: string;

  /**
   * Source of the code ('ast' or 'llm')
   */
  source: 'ast' | 'llm' | 'integrated';

  /**
   * Warnings generated during integration
   */
  warnings: string[];
}

/**
 * Class responsible for generating JavaScript code
 */
export class JavaScriptGenerator {
  private defaultOptions: CodeGenerationOptions = {
    includeSourceMaps: false,
    minify: false,
    includeComments: true,
    indent: 2,
    useSemicolons: true,
    useSingleQuotes: false,
  };

  /**
   * Creates a new JavaScriptGenerator instance
   * @param options Options for code generation
   */
  constructor(private options: CodeGenerationOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Generate JavaScript code from AST
   * @param ast The JavaScript AST
   * @param options Options for code generation
   * @returns The generated JavaScript code
   */
  public generateFromAST(ast: JavaScriptASTNode[], options?: CodeGenerationOptions): string {
    const mergedOptions = { ...this.options, ...options };

    // In a real implementation, we would use a library like escodegen or babel-generator
    // For this implementation, we'll use a simplified approach

    let code = '';
    const indent =
      typeof mergedOptions.indent === 'number' ? ' '.repeat(mergedOptions.indent) : '\t';

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const node of ast) {
      code += this.generateNodeCode(node, 0, indent, mergedOptions) + '\n\n';
    }

    return this.formatCode(code, mergedOptions);
  }

  /**
   * Generate JavaScript code for a single AST node
   * @param node The AST node
   * @param depth Current indentation depth
   * @param indent Indentation string
   * @param options Code generation options
   * @returns Generated JavaScript code
   */
  private generateNodeCode(
    node: JavaScriptASTNode,
    depth: number,
    indent: string,
    options: CodeGenerationOptions
  ): string {
    const currentIndent = indent.repeat(depth);
    const nextIndent = indent.repeat(depth + 1);
    const semicolon = options.useSemicolons ? ';' : '';

    /**
     * switch method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    switch (node.type) {
      case 'Program':
        return (node.body || [])
          .map((bodyNode) => this.generateNodeCode(bodyNode, depth, indent, options))
          .join('\n\n');

      case 'CommentBlock':
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!options.includeComments) return '';
        return `${currentIndent}/*${node.value}*/`;

      case 'CommentLine':
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!options.includeComments) return '';
        return `${currentIndent}//${node.value}`;

      case 'VariableDeclaration': {
        const declarations = (node.declarations || [])
          .map((decl) => this.generateNodeCode(decl, 0, indent, options))
          .join(', ');
        return `${currentIndent}${node.kind || 'var'} ${declarations}${semicolon}`;
      }

      case 'VariableDeclarator': {
        const init = node.init ? ` = ${this.generateNodeCode(node.init, 0, indent, options)}` : '';
        return `${node.id ? this.generateNodeCode(node.id, 0, indent, options) : 'unknown'}${init}`;
      }

      case 'Identifier':
        return node.name || 'unknown';

      case 'Literal':
        if (typeof node.value === 'string') {
          const quote = options.useSingleQuotes ? "'" : '"';
          return `${quote}${this.escapeString(node.value, quote)}${quote}`;
        } else if (node.value === null) {
          return 'null';
        } else {
          return String(node.value);
        }

      case 'ImportDeclaration': {
        const specifiers = (node.specifiers || [])
          .map((spec) => this.generateNodeCode(spec, 0, indent, options))
          .join(', ');
        const source = node.source ? this.generateNodeCode(node.source, 0, indent, options) : '"unknown"';
        return `${currentIndent}import ${specifiers} from ${source}${semicolon}`;
      }

      case 'ImportDefaultSpecifier':
        return node.local ? this.generateNodeCode(node.local, 0, indent, options) : 'unknown';

      case 'FunctionDeclaration': {
        const params = (node.params || [])
          .map((param) => this.generateNodeCode(param, 0, indent, options))
          .join(', ');
        // Handle body properly - if it's an array, wrap in BlockStatement
        let body: string;
        if (node.body) {
          if (Array.isArray(node.body)) {
            const statements = node.body
              .map((stmt) => this.generateNodeCode(stmt, depth + 1, indent, options))
              .join('\n');
            body = `{\n${statements}\n${currentIndent}}`;
          } else {
            body = this.generateNodeCode(node.body, depth, indent, options);
          }
        } else {
          body = '{}';
        }
        const functionName = node.id ? this.generateNodeCode(node.id, 0, indent, options) : 'anonymous';
        return `${currentIndent}function ${functionName}(${params}) ${body}`;
      }

      case 'BlockStatement': {
        const statements = (node.body || [])
          .map((stmt) => this.generateNodeCode(stmt, depth + 1, indent, options))
          .join('\n');
        return `{\n${statements}\n${currentIndent}}`;
      }

      case 'ExpressionStatement':
        const expression = node.expression ? this.generateNodeCode(node.expression, 0, indent, options) : '/* empty */';
        return `${currentIndent}${expression}${semicolon}`;

      case 'CallExpression': {
        const args = (node.arguments || [])
          .map((arg) => this.generateNodeCode(arg, 0, indent, options))
          .join(', ');
        const callee = node.callee ? this.generateNodeCode(node.callee, 0, indent, options) : 'unknown';
        return `${callee}(${args})`;
      }

      case 'MemberExpression': {
        const object = node.object ? this.generateNodeCode(node.object, 0, indent, options) : 'unknown';
        const property = node.property ? 
          (node.computed
            ? `[${this.generateNodeCode(node.property, 0, indent, options)}]`
            : `.${this.generateNodeCode(node.property, 0, indent, options)}`)
          : '.unknown';
        return `${object}${property}`;
      }

      case 'ArrowFunctionExpression': {
        const arrowParams = (node.params || [])
          .map((param) => this.generateNodeCode(param, 0, indent, options))
          .join(', ');
        // Handle body properly - if it's an array, wrap in BlockStatement
        let arrowBody: string;
        if (node.body) {
          if (Array.isArray(node.body)) {
            const statements = node.body
              .map((stmt) => this.generateNodeCode(stmt, depth + 1, indent, options))
              .join('\n');
            arrowBody = `{\n${statements}\n${currentIndent}}`;
          } else {
            arrowBody = this.generateNodeCode(node.body, depth, indent, options);
          }
        } else {
          arrowBody = '{}';
        }
        return `(${arrowParams}) => ${arrowBody}`;
      }

      case 'TemplateLiteral': {
        let result = '`';
        const expressions = node.expressions || [];
        const quasis = node.quasis || [];
        for (let i = 0; i < expressions.length; i++) {
          result += quasis[i] ? quasis[i].value.raw : '';
          result += '${' + this.generateNodeCode(expressions[i], 0, indent, options) + '}';
        }
        result += quasis[quasis.length - 1] ? quasis[quasis.length - 1].value.raw : '';
        result += '`';
        return result;
      }

      case 'ObjectExpression': {
        const properties = node.properties || [];
        if (properties.length === 0) {
          return '{}';
        }

        const propertiesCode = properties
          .map((prop) => nextIndent + this.generateNodeCode(prop, depth + 1, indent, options))
          .join(',\n');

        return `{\n${propertiesCode}\n${currentIndent}}`;
      }

      case 'Property': {
        const key = node.key ? 
          (node.computed
            ? `[${this.generateNodeCode(node.key, 0, indent, options)}]`
            : this.generateNodeCode(node.key, 0, indent, options))
          : 'unknown';
        const value = node.value ? this.generateNodeCode(node.value, 0, indent, options) : 'undefined';
        return `${key}: ${value}`;
      }

      case 'ClassDeclaration': {
        const className = node.id ? this.generateNodeCode(node.id, 0, indent, options) : 'UnknownClass';
        // Handle body properly - if it's an array, wrap appropriately  
        let classBody: string;
        if (node.body) {
          if (Array.isArray(node.body)) {
            const statements = node.body
              .map((stmt) => this.generateNodeCode(stmt, depth + 1, indent, options))
              .join('\n');
            classBody = `{\n${statements}\n${currentIndent}}`;
          } else {
            classBody = this.generateNodeCode(node.body, depth, indent, options);
          }
        } else {
          classBody = '{}';
        }
        return `${currentIndent}class ${className} ${classBody}`;
      }

      case 'ClassBody': {
        const bodyMethods = node.body || [];
        if (bodyMethods.length === 0) {
          return '{}';
        }

        const methods = bodyMethods
          .map((method) => this.generateNodeCode(method, depth + 1, indent, options))
          .join('\n\n');

        return `{\n${methods}\n${currentIndent}}`;
      }

      case 'MethodDefinition': {
        const methodKey = node.key ? this.generateNodeCode(node.key, 0, indent, options) : 'unknownMethod';
        // Handle value properly - if it's an array, wrap appropriately
        let methodValue: string;
        if (node.value) {
          if (Array.isArray(node.value)) {
            const statements = node.value
              .map((stmt) => this.generateNodeCode(stmt, depth + 1, indent, options))
              .join('\n');
            methodValue = `{\n${statements}\n${currentIndent}}`;
          } else {
            methodValue = this.generateNodeCode(node.value, depth, indent, options);
          }
        } else {
          methodValue = 'function() {}';
        }
        const staticPrefix = node.static ? 'static ' : '';
        return `${currentIndent}${staticPrefix}${methodKey}${methodValue}`;
      }

      case 'FunctionExpression': {
        const funcParams = (node.params || [])
          .map((param) => this.generateNodeCode(param, 0, indent, options))
          .join(', ');
        // Handle body properly - if it's an array, wrap in BlockStatement
        let funcBody: string;
        if (node.body) {
          if (Array.isArray(node.body)) {
            const statements = node.body
              .map((stmt) => this.generateNodeCode(stmt, depth + 1, indent, options))
              .join('\n');
            funcBody = `{\n${statements}\n${currentIndent}}`;
          } else {
            funcBody = this.generateNodeCode(node.body, depth, indent, options);
          }
        } else {
          funcBody = '{}';
        }
        return `function(${funcParams}) ${funcBody}`;
      }

      default:
        return `/* Unsupported node type: ${node.type} */`;
    }
  }

  /**
   * Escape special characters in a string
   * @param str The string to escape
   * @param quote The quote character used
   * @returns The escaped string
   */
  private escapeString(str: string, quote: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(new RegExp(quote, 'g'), `\\${quote}`)
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Format the generated code
   * @param code The code to format
   * @param options Code generation options
   * @returns The formatted code
   */
  private formatCode(code: string, options: CodeGenerationOptions): string {
    // Remove extra blank lines
    code = code.replace(/\n{3,}/g, '\n\n');

    // Minify if requested
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (options.minify) {
      // Remove all comments
      code = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      // Remove all whitespace
      code = code.replace(/\s+/g, ' ');
      // Remove spaces around operators
      code = code.replace(/\s*([=+\-*/%&|^<>!?:;,{}()])\s*/g, '$1');
      // Restore spaces after keywords
      code = code.replace(/(if|for|while|switch|catch|function|return|var|let|const)\(/g, '$1 (');
    }

    return code;
  }

  /**
   * Generate JavaScript files from AST transpilation result
   * @param transpilationResult The result of AST transpilation
   * @param options Code generation options
   * @returns The generated JavaScript files
   */
  public generateFromTranspilationResult(
    transpilationResult: TranspilationResult,
    options?: CodeGenerationOptions
  ): GeneratedJavaScript {
    const code = this.generateFromAST(transpilationResult.jsAst, options);

    // Count lines, functions, and variables
    const linesOfCode = code.split('\n').length;
    const functionCount = (code.match(/function\s+\w+\s*\(/g) || []).length;
    const variableCount = (code.match(/(?:var|let|const)\s+\w+/g) || []).length;

    return {
      code,
      warnings: transpilationResult.warnings,
      metadata: {
        ...transpilationResult.metadata,
        stats: {
          linesOfCode,
          functionCount,
          variableCount,
        },
      },
    };
  }

  /**
   * Integrate code from AST transpilation and LLM translation
   * @param astCode The code generated from AST
   * @param llmTranslations Map of node IDs to LLM translation results
   * @param unmappableNodes Array of unmappable nodes
   * @returns The integrated code
   */
  public integrateASTAndLLMCode(
    astCode: string,
    llmTranslations: Map<string, LLMTranslationResult>,
    unmappableNodes: MMIRNode[]
  ): IntegratedCode[] {
    const integratedFiles: IntegratedCode[] = [];
    const warnings: string[] = [];

    // Start with the main file from AST
    const mainFile: IntegratedCode = {
      filePath: 'index.js',
      code: astCode,
      source: 'ast',
      warnings: [],
    };

    // Add imports for LLM-generated files
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (llmTranslations.size > 0) {
      const imports: string[] = [];

      // For each unmappable node that has an LLM translation, add an import
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const node of unmappableNodes) {
        const translation = llmTranslations.get(node.id);
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (translation) {
          const moduleName = this.getModuleNameForNode(node);
          imports.push(`import { ${moduleName} } from './${moduleName}.js';`);
        }
      }

      // Add imports to the top of the file
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (imports.length > 0) {
        mainFile.code = imports.join('\n') + '\n\n' + mainFile.code;
        mainFile.source = 'integrated';
      }
    }

    integratedFiles.push(mainFile);

    // Create separate files for LLM translations
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const node of unmappableNodes) {
      const translation = llmTranslations.get(node.id);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (translation) {
        const moduleName = this.getModuleNameForNode(node);
        const filePath = `${moduleName}.js`;

        // Wrap the LLM code in a module export
        const code = this.wrapLLMCodeInModule(translation.translatedCode, moduleName);

        integratedFiles.push({
          filePath,
          code,
          source: 'llm',
          warnings: translation.warnings,
        });

        // Add warnings from the translation
        warnings.push(...translation.warnings);
      }
    }

    // Update warnings in the main file
    mainFile.warnings = warnings;

    return integratedFiles;
  }

  /**
   * Get a module name for a node
   * @param node The MMIR node
   * @returns A module name
   */
  private getModuleNameForNode(node: MMIRNode): string {
    // Use the node type and properties to generate a meaningful name
    let baseName = '';

    /**
     * switch method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    switch (node.type) {
      case 'BlockDefinition':
      case 'BlockRegistration':
        baseName = `block_${node.properties.blockId || 'custom'}`;
        break;

      case 'ItemDefinition':
      case 'ItemRegistration':
        baseName = `item_${node.properties.itemId || 'custom'}`;
        break;

      case 'EntityDefinition':
      case 'EntityRegistration':
        baseName = `entity_${node.properties.entityId || 'custom'}`;
        break;

      case 'EventHandler':
        baseName = `handler_${node.properties.eventType || 'event'}`;
        break;

      case 'Function':
      case 'Method':
        baseName = `func_${node.properties.methodName || node.properties.functionName || 'custom'}`;
        break;

      default:
        baseName = `module_${node.id}`;
    }

    // Sanitize the name
    return baseName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');
  }

  /**
   * Wrap LLM-generated code in a module export
   * @param code The LLM-generated code
   * @param moduleName The module name
   * @returns The wrapped code
   */
  private wrapLLMCodeInModule(code: string, moduleName: string): string {
    // Extract imports from the code
    const importRegex = /^import\s+.*?;?\s*$/gm;
    const imports = code.match(importRegex) || [];

    // Remove imports from the code
    let codeWithoutImports = code;
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const importStatement of imports) {
      codeWithoutImports = codeWithoutImports.replace(importStatement, '');
    }

    // Clean up the code
    codeWithoutImports = codeWithoutImports.trim();

    // Create the wrapped code
    return `/**
 * ${moduleName}.js
 *
 * This file was generated by LLM translation from Java code.
 */

${imports.join('\n')}

${codeWithoutImports}

// Export the module functionality
export const ${moduleName} = {
  // Add exported functions and properties here
  init: function() {
    // Initialize the module
    console.log('Initializing ${moduleName}');
  }
};
`;
  }

  /**
   * Generate optimized JavaScript code
   * @param code The code to optimize
   * @param options Optimization options
   * @returns The optimized code
   */
  public optimizeCode(code: string, options: { minify: boolean } = { minify: false }): string {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (options.minify) {
      return this.minifyCode(code);
    }

    // Apply basic optimizations
    return this.applyBasicOptimizations(code);
  }

  /**
   * Apply basic code optimizations
   * @param code The code to optimize
   * @returns The optimized code
   */
  private applyBasicOptimizations(code: string): string {
    // Remove unused variables (simplified implementation)
    // In a real implementation, we would use a proper static analysis

    // Remove console.log statements in production
    code = code.replace(/console\.log\([^)]*\);?/g, '');

    // Remove empty functions
    code = code.replace(/function\s+\w+\s*\(\s*\)\s*{\s*}/g, '');

    return code;
  }

  /**
   * Minify JavaScript code
   * @param code The code to minify
   * @returns The minified code
   */
  private minifyCode(code: string): string {
    // This is a simplified implementation
    // In a real implementation, we would use a library like terser

    // Remove comments
    code = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    // Remove whitespace
    code = code.replace(/\s+/g, ' ');

    // Remove spaces around operators
    code = code.replace(/\s*([=+\-*/%&|^<>!?:;,{}()])\s*/g, '$1');

    // Restore spaces after keywords
    code = code.replace(/(if|for|while|switch|catch|function|return|var|let|const)\(/g, '$1 (');

    // Remove spaces between function parameters
    code = code.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

    // Remove newlines in function bodies
    code = code.replace(/\{\s*\n\s*/g, '{').replace(/\s*\n\s*\}/g, '}');

    return code;
  }
}

/**
 * Factory function to create a JavaScriptGenerator instance
 * @param options Options for code generation
 * @returns A new JavaScriptGenerator instance
 */
export function createJavaScriptGenerator(options?: CodeGenerationOptions): JavaScriptGenerator {
  return new JavaScriptGenerator(options);
}
