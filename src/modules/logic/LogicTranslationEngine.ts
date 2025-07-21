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
import { CompromiseStrategyEngine, CompromiseStrategyResult } from '../compromise/CompromiseStrategyEngine';
import { Feature, FeatureType } from '../../types/compromise';
import { createLogger } from '../../utils/logger';
import { ErrorHandler, globalErrorCollector } from '../../utils/errorHandler';
import { JavaSourceFile } from '../../types/base';
import { 
  LogicConversionNote, 
  ErrorType, 
  ErrorSeverity, 
  createErrorCode,
  noteToConversionError,
  CompromiseNote
} from '../../types/errors';
import { APIMapping as APIMapType } from '../../types/api';
import { 
  LogicTranslationInput, 
  LogicTranslationOutput, 
  JavaScriptFile, 
  StubFunction, 
  MMIRContext, 
  MMIRNode, 
  MMIRRelationship, 
  MMIRMetadata,
  LogicFeature
} from '../../types/modules';

const logger = createLogger('LogicTranslationEngine');
const MODULE_ID = 'LOGIC';

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
      const conversionNotes = this.collectConversionNotes(validationResults);
      output.conversionNotes = conversionNotes;
      
      // Add conversion notes to global error collector
      conversionNotes.forEach(note => {
        globalErrorCollector.addError(
          noteToConversionError(note, MODULE_ID, ErrorType.LOGIC)
        );
      });

      logger.info('Logic translation process completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error during logic translation process: ${errorMessage}`, { error });
      
      // Create standardized error note
      const errorNote: LogicConversionNote = {
        type: ErrorSeverity.ERROR,
        message: `Logic translation failed: ${errorMessage}`,
        code: createErrorCode(MODULE_ID, 'TRANS', 1),
        details: { originalError: error }
      };
      
      // Add to local notes collection
      output.conversionNotes.push(errorNote);
      
      // Add to global error collector
      ErrorHandler.logicError(
        `Logic translation failed: ${errorMessage}`,
        MODULE_ID,
        { originalError: error },
        ErrorSeverity.ERROR,
        createErrorCode(MODULE_ID, 'TRANS', 1)
      );
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
    
    try {
      // Use the LLM service to refine the translations with feedback
      return await this.llmTranslationService.refineWithFeedback(
        invalidTranslations,
        mmirContext,
        javaSourceFiles
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error refining translations: ${errorMessage}`, { error });
      
      // Add to global error collector
      ErrorHandler.logicError(
        `Translation refinement failed: ${errorMessage}`,
        MODULE_ID,
        { originalError: error },
        ErrorSeverity.ERROR,
        createErrorCode(MODULE_ID, 'REFINE', 1)
      );
      
      // Return original translations if refinement fails
      return invalidTranslations;
    }
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
    
    try {
      // Collect stub functions from LLM translations
      for (const translation of llmTranslations) {
        if (translation.isStub) {
          const stubFunction = {
            name: translation.name,
            originalJavaCode: translation.originalCode,
            javascriptStub: translation.stubCode,
            reason: translation.stubReason,
            suggestedAlternatives: translation.alternatives
          };
          
          stubFunctions.push(stubFunction);
          
          // Add stub function as a compromise note to the global error collector
          ErrorHandler.compromiseError(
            `Function '${translation.name}' could not be fully translated: ${translation.stubReason}`,
            MODULE_ID,
            {
              originalCode: translation.originalCode,
              stubCode: translation.stubCode,
              alternatives: translation.alternatives
            },
            ErrorSeverity.WARNING,
            createErrorCode(MODULE_ID, 'STUB', stubFunctions.length)
          );
        }
      }
      
      // Collect stub functions from validation results
      if (validationResults.stubFunctions) {
        validationResults.stubFunctions.forEach((stubFunction: StubFunction, index: number) => {
          stubFunctions.push(stubFunction);
          
          // Add stub function as a compromise note to the global error collector
          ErrorHandler.compromiseError(
            `Function '${stubFunction.name}' could not be fully translated: ${stubFunction.reason}`,
            MODULE_ID,
            {
              originalCode: stubFunction.originalJavaCode,
              stubCode: stubFunction.javascriptStub,
              alternatives: stubFunction.suggestedAlternatives
            },
            ErrorSeverity.WARNING,
            createErrorCode(MODULE_ID, 'STUB', stubFunctions.length)
          );
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error collecting stub functions: ${errorMessage}`, { error });
      
      // Add to global error collector
      ErrorHandler.logicError(
        `Failed to collect stub functions: ${errorMessage}`,
        MODULE_ID,
        { originalError: error },
        ErrorSeverity.WARNING,
        createErrorCode(MODULE_ID, 'STUB_COLLECT', 1)
      );
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
    
    try {
      // Collect notes from validation results
      if (validationResults.notes) {
        validationResults.notes.forEach((note: any, index: number) => {
          const logicNote: LogicConversionNote = {
            type: note.type || ErrorSeverity.INFO,
            message: note.message,
            sourceLocation: note.sourceLocation,
            code: note.code || createErrorCode(MODULE_ID, 'NOTE', index + 1),
            details: note.details || {}
          };
          
          conversionNotes.push(logicNote);
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error collecting conversion notes: ${errorMessage}`, { error });
      
      // Add to global error collector
      ErrorHandler.logicError(
        `Failed to collect conversion notes: ${errorMessage}`,
        MODULE_ID,
        { originalError: error },
        ErrorSeverity.WARNING,
        createErrorCode(MODULE_ID, 'NOTE_COLLECT', 1)
      );
      
      // Add a note about the failure
      conversionNotes.push({
        type: ErrorSeverity.WARNING,
        message: `Failed to collect all conversion notes: ${errorMessage}`,
        code: createErrorCode(MODULE_ID, 'NOTE_COLLECT', 1)
      });
    }
    
    return conversionNotes;
  }
}