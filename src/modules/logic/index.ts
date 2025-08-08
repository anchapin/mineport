/**
 * Logic Translation Module
 *
 * This module is responsible for parsing, analyzing, and transforming Java code
 * into JavaScript for Bedrock addons. It includes components for Java parsing,
 * AST transformation, API mapping, and JavaScript generation.
 *
 * Public API:
 * - JavaParser: Parses Java source code into AST
 * - MMIRGenerator: Generates Minecraft Mod Intermediate Representation
 * - ASTTranspiler: Transpiles Java AST to JavaScript AST
 * - APIMapping: Maps Java APIs to Bedrock equivalents
 * - LLMTranslationService: Uses LLM for complex code translation
 * - ProgramStateAlignmentValidator: Validates program state consistency
 * - JavaScriptGenerator: Generates final JavaScript code
 * - LogicTranslationEngine: Main orchestrator for logic translation
 */

// Export all individual components
export * from './JavaParser.js';
export * from './MMIRGenerator.js';
export * from './ASTTranspiler.js';
export * from './APIMapping.js';
export * from './LLMTranslationService.js';
export * from './ProgramStateAlignmentValidator.js';
export * from './JavaScriptGenerator.js';
export * from './LogicTranslationEngine.js';

// New core logic translation components
export * from './MMIRParser.js';
export * from './LLMTranslator.js';
export * from './ProgramStateValidator.js';

// Re-export the main engine as default for convenience
export { LogicTranslationEngine as default } from './LogicTranslationEngine.js';
