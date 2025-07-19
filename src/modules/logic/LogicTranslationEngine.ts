/**
 * Logic Translation Engine
 * 
 * This is the main class that orchestrates the entire logic translation process
 * from Java source code to JavaScript for Bedrock's Scripting API.
 */

import { JavaParser } from './JavaParser';
import { MMIRGenerator } from './MMIRGenerator';
import { ASTTranspiler } from './ASTTranspiler';
import { APIMapping } from './APIMapping';
import { LLMTranslationService } from './LLMTranslationService';
import { ProgramStateAlignmentValidator } from './ProgramStateAlignmentValidator';
import { JavaScriptGenerator } from './JavaScriptGenerator';
import { logger } from '../../utils/logger';

/**
 * Input for the logic translation process
 */
export interface LogicTranslationInput {
  javaSourceFiles: JavaSourceFile[];
  mmirContext?: MMIRContext;
  apiMappingDictionary?: APIMapping[];
}

/**
 * Output from the logic translation process
 */
export interface LogicTranslationOutput {
  javascriptFiles: JavaScriptFile[];
  stubFunctions: StubFunction[];
  conversionNotes: LogicConversionNote[];
}

/**
 * Represents a Java source file
 */
export interface JavaSourceFile {
  path: string;
  content: string;
  modLoader: 'forge' | 'fabric';
}

/**
 * Represents a JavaScript output file
 */
export interface JavaScriptFile {
  path: string;
  content: string;
  sourceMap?: string;
}

/**
 * Represents a stub function for features that couldn't be fully translated
 */
export interface StubFunction {
  name: string;
  originalJavaCode: string;
  javascriptStub: string;
  reason: string;
  suggestedAlternatives?: string[];
}

/**
 * Represents a note about the conversion process
 */
export interface LogicConversionNote {
  type: 'info' | 'warning' | 'error';
  message: string;
  sourceLocation?: {
    file: string;
    line: number;
    column: number;
  };
  code?: string;
}

/**
 * Represents the Minecraft Modding Intermediate Representation context
 */
export interface MMIRContext {
  nodes: MMIRNode[];
  relationships: MMIRRelationship[];
  metadata: MMIRMetadata;
}

/**
 * Represents a node in the MMIR
 */
export interface MMIRNode {
  id: string;
  type: string;
  sourceLocation: {
    file: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  properties: Record<string, any>;
  children: string[];
}

/**
 * Represents a relationship between MMIR nodes
 */
export interface MMIRRelationship {
  id: string;
  type: string;
  sourceNodeId: string;
  targetNodeId: string;
  properties: Record<string, any>;
}

/**
 * Represents metadata for the MMIR
 */
export interface MMIRMetadata {
  modId: string;
  modName: string;
  modVersion: string;
  modLoader: 'forge' | 'fabric';
  minecraftVersion: string;
}

/**
 * Main class for the Logic Translation Engine
 */
export class LogicTranslationEngine {
  private javaParser: JavaParser;
  private mmirGenerator: MMIRGenerator;
  private astTranspiler: ASTTranspiler;
  private apiMapping: APIMapping;
  private llmTranslationService: LLMTranslationService;
  private programStateAlignmentValidator: ProgramStateAlignmentValidator;
  private javascriptGenerator: JavaScriptGenerator;

  /**
   * Creates a new instance of the Logic Translation Engine
   */
  constructor() {
    this.javaParser = new JavaParser();
    this.mmirGenerator = new MMIRGenerator();
    this.astTranspiler = new ASTTranspiler();
    this.apiMapping = new APIMapping();
    this.llmTranslationService = new LLMTranslationService();
    this.programStateAlignmentValidator = new ProgramStateAlignmentValidator();
    this.javascriptGenerator = new JavaScriptGenerator();
  }

  /**
   * Translates Java source code to JavaScript
   * 
   * @param input The input for the translation process
   * @returns The output of the translation process
   */
  public async translate(input: LogicTranslationInput): Promise<LogicTranslationOutput> {
    logger.info('Starting logic translation process');
    
    const output: LogicTranslationOutput = {
      javascriptFiles: [],
      stubFunctions: [],
      conversionNotes: []
    };

    try {
      // Step 1: Parse Java source files into ASTs
      logger.debug('Parsing Java source files');
      const javaASTs = await Promise.all(
        input.javaSourceFiles.map(file => this.javaParser.parse(file.content, file.path))
      );

      // Step 2: Generate MMIR from Java ASTs
      logger.debug('Generating MMIR');
      const mmirContext = input.mmirContext || await this.mmirGenerator.generate(
        javaASTs, 
        input.javaSourceFiles.map(file => file.modLoader)
      );

      // Step 3: Load API mappings
      logger.debug('Loading API mappings');
      const apiMappings = input.apiMappingDictionary || await this.apiMapping.loadMappings();

      // Step 4: Transpile MMIR to JavaScript AST for directly mappable patterns
      logger.debug('Transpiling MMIR to JavaScript AST');
      const { jsASTs, unmappableNodes } = await this.astTranspiler.transpile(mmirContext, apiMappings);

      // Step 5: Use LLM for complex or unmappable code
      logger.debug('Translating complex code with LLM');
      const llmTranslations = await this.llmTranslationService.translate(
        unmappableNodes,
        mmirContext,
        input.javaSourceFiles
      );

      // Step 6: Generate JavaScript code from AST and LLM outputs
      logger.debug('Generating JavaScript code');
      const generatedFiles = await this.javascriptGenerator.generate(jsASTs, llmTranslations);

      // Step 7: Validate functional equivalence using Program State Alignment
      logger.debug('Validating functional equivalence');
      const validationResults = await this.programStateAlignmentValidator.validate(
        input.javaSourceFiles,
        generatedFiles
      );

      // Step 8: Refine translations if needed based on validation results
      if (!validationResults.allValid) {
        logger.debug('Refining translations based on validation results');
        const refinedTranslations = await this.refineTranslations(
          validationResults.invalidTranslations,
          input.javaSourceFiles,
          mmirContext
        );
        
        // Regenerate JavaScript with refined translations
        const refinedFiles = await this.javascriptGenerator.generate(jsASTs, refinedTranslations);
        
        output.javascriptFiles = refinedFiles;
      } else {
        output.javascriptFiles = generatedFiles;
      }

      // Collect stub functions and conversion notes
      output.stubFunctions = this.collectStubFunctions(llmTranslations, validationResults);
      output.conversionNotes = this.collectConversionNotes(validationResults);

      logger.info('Logic translation process completed successfully');
    } catch (error) {
      logger.error('Error during logic translation process', error);
      output.conversionNotes.push({
        type: 'error',
        message: `Logic translation failed: ${error.message}`
      });
    }

    return output;
  }

  /**
   * Refines translations based on validation results
   * 
   * @param invalidTranslations The translations that failed validation
   * @param javaSourceFiles The original Java source files
   * @param mmirContext The MMIR context
   * @returns The refined translations
   */
  private async refineTranslations(
    invalidTranslations: any[],
    javaSourceFiles: JavaSourceFile[],
    mmirContext: MMIRContext
  ): Promise<any[]> {
    logger.debug(`Refining ${invalidTranslations.length} invalid translations`);
    
    // Use the LLM service to refine the translations with feedback
    return await this.llmTranslationService.refineWithFeedback(
      invalidTranslations,
      mmirContext,
      javaSourceFiles
    );
  }

  /**
   * Collects stub functions from LLM translations and validation results
   * 
   * @param llmTranslations The LLM translations
   * @param validationResults The validation results
   * @returns The collected stub functions
   */
  private collectStubFunctions(llmTranslations: any[], validationResults: any): StubFunction[] {
    const stubFunctions: StubFunction[] = [];
    
    // Collect stub functions from LLM translations
    for (const translation of llmTranslations) {
      if (translation.isStub) {
        stubFunctions.push({
          name: translation.name,
          originalJavaCode: translation.originalCode,
          javascriptStub: translation.stubCode,
          reason: translation.stubReason,
          suggestedAlternatives: translation.alternatives
        });
      }
    }
    
    // Collect stub functions from validation results
    if (validationResults.stubFunctions) {
      stubFunctions.push(...validationResults.stubFunctions);
    }
    
    return stubFunctions;
  }

  /**
   * Collects conversion notes from validation results
   * 
   * @param validationResults The validation results
   * @returns The collected conversion notes
   */
  private collectConversionNotes(validationResults: any): LogicConversionNote[] {
    const conversionNotes: LogicConversionNote[] = [];
    
    // Collect notes from validation results
    if (validationResults.notes) {
      conversionNotes.push(...validationResults.notes);
    }
    
    return conversionNotes;
  }
}