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
export * from './JavaParser';
export * from './MMIRGenerator';
export * from './ASTTranspiler';
export * from './APIMapping';
export * from './LLMTranslationService';
export * from './ProgramStateAlignmentValidator';
export * from './JavaScriptGenerator';
export * from './LogicTranslationEngine';

// New core logic translation components
export * from './MMIRParser';
export * from './LLMTranslator';
export * from './ProgramStateValidator';

// Re-export the main engine as default for convenience
export { LogicTranslationEngine as default } from './LogicTranslationEngine';