/**
 * ASTTranspiler.ts
 * 
 * This module transforms Minecraft Modding Intermediate Representation (MMIR) into JavaScript AST.
 * It implements direct mapping for convertible patterns and generates code for mapped API calls.
 */

import { MMIRContext, MMIRNode, MMIRNodeType, MMIRRelationship, MMIRRelationshipType } from './MMIRGenerator';

/**
 * Represents a node in the JavaScript Abstract Syntax Tree
 */
export interface JavaScriptASTNode {
  type: string;
  [key: string]: any; // Additional properties specific to node types
}

/**
 * Represents an API mapping between Java and Bedrock
 */
export interface APIMapping {
  javaSignature: string;
  bedrockEquivalent: string;
  conversionType: 'direct' | 'wrapper' | 'complex' | 'impossible';
  notes: string;
  exampleUsage?: {
    java: string;
    bedrock: string;
  };
}

/**
 * Result of the transpilation process
 */
export interface TranspilationResult {
  jsAst: JavaScriptASTNode[];
  metadata: {
    modId: string;
    modName: string;
    modVersion: string;
    originalModLoader: 'forge' | 'fabric';
  };
  unmappableNodes: MMIRNode[];
  warnings: string[];
}

/**
 * Class responsible for transpiling MMIR to JavaScript AST
 */
export class ASTTranspiler {
  private apiMappings: Map<string, APIMapping> = new Map();
  
  /**
   * Creates a new ASTTranspiler instance
   */
  constructor() {
    this.initializeDefaultMappings();
  }
  
  /**
   * Initialize default API mappings
   */
  private initializeDefaultMappings(): void {
    // Add some basic mappings for common Minecraft APIs
    this.addApiMapping({
      javaSignature: 'Registry.register',
      bedrockEquivalent: 'MinecraftServer.register',
      conversionType: 'direct',
      notes: 'Basic registration mapping'
    });
    
    this.addApiMapping({
      javaSignature: 'Registry.registerBlock',
      bedrockEquivalent: 'MinecraftServer.registerBlock',
      conversionType: 'direct',
      notes: 'Block registration mapping'
    });
    
    this.addApiMapping({
      javaSignature: 'PlayerEvent.PlayerLoggedInEvent',
      bedrockEquivalent: 'system.events.playerJoin',
      conversionType: 'direct',
      notes: 'Player join event mapping'
    });
    
    this.addApiMapping({
      javaSignature: 'PlayerEvent.PlayerLoggedOutEvent',
      bedrockEquivalent: 'system.events.playerLeave',
      conversionType: 'direct',
      notes: 'Player leave event mapping'
    });
    
    this.addApiMapping({
      javaSignature: 'BlockEvent.BreakEvent',
      bedrockEquivalent: 'system.events.blockBreak',
      conversionType: 'direct',
      notes: 'Block break event mapping'
    });
    
    this.addApiMapping({
      javaSignature: 'ItemRegistry.register',
      bedrockEquivalent: 'system.registerItem',
      conversionType: 'wrapper',
      notes: 'Item registration with parameter transformation'
    });
    
    this.addApiMapping({
      javaSignature: 'BlockRegistry.register',
      bedrockEquivalent: 'system.registerBlock',
      conversionType: 'wrapper',
      notes: 'Block registration with parameter transformation'
    });
  }
  
  /**
   * Add an API mapping
   * @param mapping The API mapping to add
   */
  public addApiMapping(mapping: APIMapping): void {
    this.apiMappings.set(mapping.javaSignature, mapping);
  }
  
  /**
   * Get an API mapping by Java signature
   * @param javaSignature The Java signature to look up
   * @returns The API mapping if found, undefined otherwise
   */
  public getApiMapping(javaSignature: string): APIMapping | undefined {
    return this.apiMappings.get(javaSignature);
  }
  
  /**
   * Transpile MMIR to JavaScript AST
   * @param mmirContext The MMIR context to transpile
   * @returns The transpilation result
   */
  public transpile(mmirContext: MMIRContext): TranspilationResult {
    const jsAst: JavaScriptASTNode[] = [];
    const unmappableNodes: MMIRNode[] = [];
    const warnings: string[] = [];
    
    // Create the module structure
    const moduleNode = this.createModuleNode(mmirContext);
    jsAst.push(moduleNode);
    
    // Process each MMIR node
    for (const node of mmirContext.nodes) {
      try {
        const jsNodes = this.transpileNode(node, mmirContext);
        if (jsNodes.length > 0) {
          jsAst.push(...jsNodes);
        } else {
          unmappableNodes.push(node);
          warnings.push(`Unable to transpile node of type ${node.type}: ${node.id}`);
        }
      } catch (error) {
        unmappableNodes.push(node);
        warnings.push(`Error transpiling node ${node.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return {
      jsAst,
      metadata: {
        modId: mmirContext.metadata.modId,
        modName: mmirContext.metadata.modName,
        modVersion: mmirContext.metadata.modVersion,
        originalModLoader: mmirContext.metadata.modLoader
      },
      unmappableNodes,
      warnings
    };
  }
  
  /**
   * Create the module node for the JavaScript AST
   * @param mmirContext The MMIR context
   * @returns The module node
   */
  private createModuleNode(mmirContext: MMIRContext): JavaScriptASTNode {
    // Ensure we have a valid mod ID
    const modId = mmirContext.metadata.modId || 'examplemod';
    
    // Create a Program node (root of JavaScript AST)
    return {
      type: 'Program',
      sourceType: 'module',
      body: [
        // Add module metadata as a comment
        {
          type: 'CommentBlock',
          value: `
 * Mod: ${mmirContext.metadata.modName}
 * ID: ${modId}
 * Version: ${mmirContext.metadata.modVersion}
 * Original Mod Loader: ${mmirContext.metadata.modLoader}
 * Authors: ${mmirContext.metadata.authors.join(', ')}
 * License: ${mmirContext.metadata.license}
 * Description: ${mmirContext.metadata.description}
 * 
 * This file was automatically generated by the Minecraft Mod Converter.
 * Original Java code has been transpiled to JavaScript for Bedrock Edition.
 `
        },
        
        // Add module initialization
        {
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: {
                type: 'Identifier',
                name: 'MOD_ID'
              },
              init: {
                type: 'Literal',
                value: modId
              }
            }
          ]
        },
        
        // Add system import for Bedrock scripting
        {
          type: 'ImportDeclaration',
          specifiers: [
            {
              type: 'ImportDefaultSpecifier',
              local: {
                type: 'Identifier',
                name: 'system'
              }
            }
          ],
          source: {
            type: 'Literal',
            value: '@minecraft/server'
          }
        }
      ]
    };
  }
  
  /**
   * Transpile an MMIR node to JavaScript AST nodes
   * @param node The MMIR node to transpile
   * @param mmirContext The full MMIR context
   * @returns Array of JavaScript AST nodes
   */
  private transpileNode(node: MMIRNode, mmirContext: MMIRContext): JavaScriptASTNode[] {
    switch (node.type) {
      case MMIRNodeType.ModDeclaration:
        return this.transpileModDeclaration(node, mmirContext);
      
      case MMIRNodeType.EventHandler:
        return this.transpileEventHandler(node, mmirContext);
      
      case MMIRNodeType.BlockRegistration:
        return this.transpileBlockRegistration(node, mmirContext);
      
      case MMIRNodeType.ItemRegistration:
        return this.transpileItemRegistration(node, mmirContext);
      
      case MMIRNodeType.Function:
      case MMIRNodeType.Method:
        return this.transpileFunction(node, mmirContext);
      
      case MMIRNodeType.Field:
      case MMIRNodeType.Property:
        return this.transpileField(node, mmirContext);
      
      default:
        // Return empty array for unmappable nodes
        return [];
    }
  }
  
  /**
   * Transpile a mod declaration node
   * @param node The mod declaration node
   * @param mmirContext The full MMIR context
   * @returns JavaScript AST nodes
   */
  private transpileModDeclaration(node: MMIRNode, mmirContext: MMIRContext): JavaScriptASTNode[] {
    const modId = node.properties.modId || mmirContext.metadata.modId;
    
    // Create a module initialization function
    return [
      {
        type: 'FunctionDeclaration',
        id: {
          type: 'Identifier',
          name: 'initializeMod'
        },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'CallExpression',
                callee: {
                  type: 'MemberExpression',
                  object: {
                    type: 'Identifier',
                    name: 'console'
                  },
                  property: {
                    type: 'Identifier',
                    name: 'log'
                  },
                  computed: false
                },
                arguments: [
                  {
                    type: 'Literal',
                    value: `Initializing mod: ${modId}`
                  }
                ]
              }
            }
          ]
        }
      },
      
      // Call the initialization function
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'initializeMod'
          },
          arguments: []
        }
      }
    ];
  }
  
  /**
   * Transpile an event handler node
   * @param node The event handler node
   * @param mmirContext The full MMIR context
   * @returns JavaScript AST nodes
   */
  private transpileEventHandler(node: MMIRNode, mmirContext: MMIRContext): JavaScriptASTNode[] {
    const methodName = node.properties.methodName || 'handleEvent';
    const eventType = node.properties.eventType || 'UnknownEvent';
    
    // Look up the event type in API mappings
    const mapping = this.findEventMapping(eventType);
    const bedrockEvent = mapping ? mapping.bedrockEquivalent : 'system.events.beforeChat'; // Default fallback
    
    // Create an event handler registration
    return [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: {
              type: 'MemberExpression',
              object: {
                type: 'Identifier',
                name: bedrockEvent.split('.')[0]
              },
              property: {
                type: 'Identifier',
                name: bedrockEvent.split('.')[1]
              },
              computed: false
            },
            property: {
              type: 'Identifier',
              name: 'subscribe'
            },
            computed: false
          },
          arguments: [
            {
              type: 'ArrowFunctionExpression',
              params: [
                {
                  type: 'Identifier',
                  name: 'event'
                }
              ],
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ExpressionStatement',
                    expression: {
                      type: 'CallExpression',
                      callee: {
                        type: 'MemberExpression',
                        object: {
                          type: 'Identifier',
                          name: 'console'
                        },
                        property: {
                          type: 'Identifier',
                          name: 'log'
                        },
                        computed: false
                      },
                      arguments: [
                        {
                          type: 'TemplateLiteral',
                          quasis: [
                            {
                              type: 'TemplateElement',
                              value: {
                                raw: 'Event handler ',
                                cooked: 'Event handler '
                              },
                              tail: false
                            },
                            {
                              type: 'TemplateElement',
                              value: {
                                raw: ' called',
                                cooked: ' called'
                              },
                              tail: true
                            }
                          ],
                          expressions: [
                            {
                              type: 'Literal',
                              value: methodName
                            }
                          ]
                        }
                      ]
                    }
                  }
                ]
              },
              expression: false
            }
          ]
        }
      }
    ];
  }
  
  /**
   * Find an event mapping in the API mappings
   * @param eventType The Java event type
   * @returns The API mapping if found, undefined otherwise
   */
  private findEventMapping(eventType: string): APIMapping | undefined {
    // Try exact match first
    let mapping = this.apiMappings.get(eventType);
    
    // If not found, try partial matches
    if (!mapping) {
      for (const [key, value] of this.apiMappings.entries()) {
        if (eventType.includes(key)) {
          mapping = value;
          break;
        }
      }
    }
    
    return mapping;
  }
  
  /**
   * Transpile a block registration node
   * @param node The block registration node
   * @param mmirContext The full MMIR context
   * @returns JavaScript AST nodes
   */
  private transpileBlockRegistration(node: MMIRNode, mmirContext: MMIRContext): JavaScriptASTNode[] {
    const blockId = node.properties.blockId || 'unknown_block';
    
    // Look up the registration method in API mappings
    const mapping = this.apiMappings.get('BlockRegistry.register');
    const bedrockMethod = mapping ? mapping.bedrockEquivalent : 'system.registerBlock';
    
    // Create a block registration call
    return [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: {
              type: 'Identifier',
              name: bedrockMethod.split('.')[0]
            },
            property: {
              type: 'Identifier',
              name: bedrockMethod.split('.')[1]
            },
            computed: false
          },
          arguments: [
            {
              type: 'ObjectExpression',
              properties: [
                {
                  type: 'Property',
                  key: {
                    type: 'Identifier',
                    name: 'identifier'
                  },
                  value: {
                    type: 'Literal',
                    value: `${mmirContext.metadata.modId}:${blockId}`
                  },
                  kind: 'init',
                  computed: false,
                  method: false,
                  shorthand: false
                }
              ]
            }
          ]
        }
      }
    ];
  }
  
  /**
   * Transpile an item registration node
   * @param node The item registration node
   * @param mmirContext The full MMIR context
   * @returns JavaScript AST nodes
   */
  private transpileItemRegistration(node: MMIRNode, mmirContext: MMIRContext): JavaScriptASTNode[] {
    const itemId = node.properties.itemId || 'unknown_item';
    
    // Look up the registration method in API mappings
    const mapping = this.apiMappings.get('ItemRegistry.register');
    const bedrockMethod = mapping ? mapping.bedrockEquivalent : 'system.registerItem';
    
    // Create an item registration call
    return [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: {
              type: 'Identifier',
              name: bedrockMethod.split('.')[0]
            },
            property: {
              type: 'Identifier',
              name: bedrockMethod.split('.')[1]
            },
            computed: false
          },
          arguments: [
            {
              type: 'ObjectExpression',
              properties: [
                {
                  type: 'Property',
                  key: {
                    type: 'Identifier',
                    name: 'identifier'
                  },
                  value: {
                    type: 'Literal',
                    value: `${mmirContext.metadata.modId}:${itemId}`
                  },
                  kind: 'init',
                  computed: false,
                  method: false,
                  shorthand: false
                }
              ]
            }
          ]
        }
      }
    ];
  }
  
  /**
   * Transpile a function or method node
   * @param node The function or method node
   * @param mmirContext The full MMIR context
   * @returns JavaScript AST nodes
   */
  private transpileFunction(node: MMIRNode, mmirContext: MMIRContext): JavaScriptASTNode[] {
    const functionName = node.properties.methodName || node.properties.functionName || 'unknownFunction';
    const className = node.properties.className || '';
    const javaSignature = `${className}.${functionName}`;
    
    // Look up the method in API mappings
    const mapping = this.apiMappings.get(javaSignature);
    
    if (mapping) {
      // Create a mapped method call
      const [objectName, methodName] = mapping.bedrockEquivalent.split('.');
      
      return [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: {
                type: 'Identifier',
                name: objectName
              },
              property: {
                type: 'Identifier',
                name: methodName
              },
              computed: false
            },
            arguments: this.createMethodArguments(node)
          }
        }
      ];
    }
    
    // If no mapping found, create a function declaration
    return [
      {
        type: 'FunctionDeclaration',
        id: {
          type: 'Identifier',
          name: functionName
        },
        params: this.createFunctionParams(node),
        body: {
          type: 'BlockStatement',
          body: this.createFunctionBody(node, mmirContext)
        }
      }
    ];
  }
  
  /**
   * Create method arguments from an MMIR node
   * @param node The MMIR node
   * @returns Array of argument nodes
   */
  private createMethodArguments(node: MMIRNode): JavaScriptASTNode[] {
    const args: JavaScriptASTNode[] = [];
    
    // Add parameters if defined in the node
    if (node.properties.parameters && Array.isArray(node.properties.parameters)) {
      for (const param of node.properties.parameters) {
        if (param.type === 'Identifier') {
          args.push({
            type: 'Identifier',
            name: param.name || 'param'
          });
        } else if (param.type === 'NewExpression') {
          args.push({
            type: 'NewExpression',
            callee: {
              type: 'Identifier',
              name: param.className || 'Object'
            },
            arguments: []
          });
        } else {
          args.push({
            type: 'Identifier',
            name: 'param'
          });
        }
      }
    }
    
    return args;
  }
  
  /**
   * Create function parameters from an MMIR node
   * @param node The MMIR node
   * @returns Array of parameter nodes
   */
  private createFunctionParams(node: MMIRNode): JavaScriptASTNode[] {
    const params: JavaScriptASTNode[] = [];
    
    // Add parameters if defined in the node
    if (node.properties.parameters && Array.isArray(node.properties.parameters)) {
      for (const param of node.properties.parameters) {
        params.push({
          type: 'Identifier',
          name: param.name || 'param'
        });
      }
    }
    
    return params;
  }
  
  /**
   * Create function body statements from an MMIR node
   * @param node The MMIR node
   * @param mmirContext The full MMIR context
   * @returns Array of statement nodes
   */
  private createFunctionBody(node: MMIRNode, mmirContext: MMIRContext): JavaScriptASTNode[] {
    const body: JavaScriptASTNode[] = [];
    
    // Add a placeholder comment if no body is defined
    body.push({
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: {
            type: 'Identifier',
            name: 'console'
          },
          property: {
            type: 'Identifier',
            name: 'log'
          },
          computed: false
        },
        arguments: [
          {
            type: 'Literal',
            value: `Function ${node.properties.methodName || node.properties.functionName || 'unknown'} called`
          }
        ]
      }
    });
    
    return body;
  }
  
  /**
   * Transpile a field or property node
   * @param node The field or property node
   * @param mmirContext The full MMIR context
   * @returns JavaScript AST nodes
   */
  private transpileField(node: MMIRNode, mmirContext: MMIRContext): JavaScriptASTNode[] {
    const fieldName = node.properties.fieldName || node.properties.propertyName || 'unknownField';
    const isStatic = node.properties.isStatic || false;
    
    // Create a variable declaration
    return [
      {
        type: 'VariableDeclaration',
        kind: isStatic ? 'const' : 'let',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: {
              type: 'Identifier',
              name: fieldName
            },
            init: this.createFieldInitializer(node)
          }
        ]
      }
    ];
  }
  
  /**
   * Create a field initializer expression
   * @param node The MMIR node
   * @returns The initializer expression node
   */
  private createFieldInitializer(node: MMIRNode): JavaScriptASTNode {
    // Use the initialValue if provided, otherwise use null
    if (node.properties.initialValue !== undefined) {
      if (typeof node.properties.initialValue === 'string') {
        return {
          type: 'Literal',
          value: node.properties.initialValue
        };
      } else if (typeof node.properties.initialValue === 'number') {
        return {
          type: 'Literal',
          value: node.properties.initialValue
        };
      } else if (typeof node.properties.initialValue === 'boolean') {
        return {
          type: 'Literal',
          value: node.properties.initialValue
        };
      }
    }
    
    // Default to null
    return {
      type: 'Literal',
      value: null
    };
  }
  
  /**
   * Generate JavaScript code from AST
   * @param ast The JavaScript AST
   * @returns Generated JavaScript code
   */
  public generateJavaScript(ast: JavaScriptASTNode[]): string {
    // This is a simplified implementation
    // In a real implementation, we would use a library like escodegen
    
    let code = '';
    
    for (const node of ast) {
      code += this.generateNodeCode(node) + '\n\n';
    }
    
    return code;
  }
  
  /**
   * Generate JavaScript code for a single AST node
   * @param node The AST node
   * @returns Generated JavaScript code
   */
  private generateNodeCode(node: JavaScriptASTNode): string {
    switch (node.type) {
      case 'Program':
        return node.body.map(bodyNode => this.generateNodeCode(bodyNode)).join('\n\n');
      
      case 'CommentBlock':
        return `/*${node.value}*/`;
      
      case 'VariableDeclaration':
        const declarations = node.declarations.map(decl => this.generateNodeCode(decl)).join(', ');
        return `${node.kind} ${declarations};`;
      
      case 'VariableDeclarator':
        const init = node.init ? ` = ${this.generateNodeCode(node.init)}` : '';
        return `${this.generateNodeCode(node.id)}${init}`;
      
      case 'Identifier':
        return node.name;
      
      case 'Literal':
        if (typeof node.value === 'string') {
          return `"${node.value}"`;
        } else if (node.value === null) {
          return 'null';
        } else {
          return String(node.value);
        }
      
      case 'ImportDeclaration':
        const specifiers = node.specifiers.map(spec => this.generateNodeCode(spec)).join(', ');
        return `import ${specifiers} from ${this.generateNodeCode(node.source)};`;
      
      case 'ImportDefaultSpecifier':
        return this.generateNodeCode(node.local);
      
      case 'FunctionDeclaration':
        const params = node.params.map(param => this.generateNodeCode(param)).join(', ');
        const body = this.generateNodeCode(node.body);
        return `function ${this.generateNodeCode(node.id)}(${params}) ${body}`;
      
      case 'BlockStatement':
        const statements = node.body.map(stmt => this.generateNodeCode(stmt)).join('\n  ');
        return `{\n  ${statements}\n}`;
      
      case 'ExpressionStatement':
        return `${this.generateNodeCode(node.expression)};`;
      
      case 'CallExpression':
        const args = node.arguments.map(arg => this.generateNodeCode(arg)).join(', ');
        return `${this.generateNodeCode(node.callee)}(${args})`;
      
      case 'MemberExpression':
        const object = this.generateNodeCode(node.object);
        const property = node.computed 
          ? `[${this.generateNodeCode(node.property)}]` 
          : `.${this.generateNodeCode(node.property)}`;
        return `${object}${property}`;
      
      case 'ArrowFunctionExpression':
        const arrowParams = node.params.map(param => this.generateNodeCode(param)).join(', ');
        const arrowBody = this.generateNodeCode(node.body);
        return `(${arrowParams}) => ${arrowBody}`;
      
      case 'TemplateLiteral':
        let result = '`';
        for (let i = 0; i < node.expressions.length; i++) {
          result += node.quasis[i].value.raw;
          result += '${' + this.generateNodeCode(node.expressions[i]) + '}';
        }
        result += node.quasis[node.quasis.length - 1].value.raw;
        result += '`';
        return result;
      
      case 'ObjectExpression':
        const properties = node.properties.map(prop => this.generateNodeCode(prop)).join(', ');
        return `{ ${properties} }`;
      
      case 'Property':
        const key = node.computed 
          ? `[${this.generateNodeCode(node.key)}]` 
          : this.generateNodeCode(node.key);
        const value = this.generateNodeCode(node.value);
        return `${key}: ${value}`;
      
      default:
        return `/* Unsupported node type: ${node.type} */`;
    }
  }
}

/**
 * Factory function to create an ASTTranspiler instance
 * @returns A new ASTTranspiler instance
 */
export function createASTTranspiler(): ASTTranspiler {
  return new ASTTranspiler();
}