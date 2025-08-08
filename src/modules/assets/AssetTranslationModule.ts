// import * as path from 'path';
import * as fs from 'fs/promises';
import { createLogger } from '../../utils/logger.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import { globalErrorCollector } from '../../utils/errorHandler.js';
import { TextureConverter } from './TextureConverter.js';
import { ModelConverter } from './ModelConverter.js';
import { SoundProcessor } from './SoundProcessor.js';
import { ParticleMapper } from './ParticleMapper.js';
import {
  AssetConversionNote,
  ErrorType,
  ErrorSeverity,
  createErrorCode,
  noteToConversionError,
} from '../../types/errors.js';
import {
  JavaAssetCollection,
  BedrockAssetCollection,
  AssetTranslationResult,
} from '../../types/modules.js';

const logger = createLogger('AssetTranslationModule');
const MODULE_ID = 'ASSET';

/**
 * Asset Translation Module
 *
 * Coordinates the translation of all asset types from Java Edition format
 * to Bedrock Edition format. This module handles textures, models, sounds,
 * and particles, orchestrating their conversion through specialized converters
 * and organizing the results into the proper Bedrock resource pack structure.
 *
 * The module integrates with the global error collection system to track
 * conversion issues and provides detailed notes about the translation process.
 *
 * Implements requirements:
 * - Asset format conversion from Java to Bedrock
 * - Error tracking and reporting
 * - Resource pack organization
 *
 * @example
 * ```typescript
 * const module = new AssetTranslationModule();
 * const result = await module.translateAssets(javaAssets);
 * await module.organizeAssets(result.bedrockAssets, outputDir);
 * ```
 *
 * @since 1.0.0
 */
export class AssetTranslationModule {
  private textureConverter: TextureConverter;
  private modelConverter: ModelConverter;
  private soundProcessor: SoundProcessor;
  private particleMapper: ParticleMapper;

  /**
   * Creates a new instance of the AssetTranslationModule.
   *
   * Initializes all specialized converters (texture, model, sound, particle)
   * that will be used for the asset translation process.
   *
   * @since 1.0.0
   */
  constructor() {
    this.textureConverter = new TextureConverter();
    this.modelConverter = new ModelConverter();
    this.soundProcessor = new SoundProcessor();
    this.particleMapper = new ParticleMapper();
  }

  /**
   * Translates all Java assets to Bedrock format.
   *
   * Processes all asset types (textures, models, sounds, particles) through
   * their respective converters, collects conversion notes, and integrates
   * with the global error collection system for comprehensive error tracking.
   *
   * @param javaAssets - Collection of Java assets to translate
   * @returns Promise resolving to translation result with converted assets and notes
   * @throws {Error} When asset translation fails catastrophically
   *
   * @example
   * ```typescript
   * const result = await module.translateAssets({
   *   textures: [textureFile1, textureFile2],
   *   models: [modelFile1],
   *   sounds: [soundFile1],
   *   particles: [particleFile1]
   * });
   * console.log(`Converted ${result.bedrockAssets.textures.length} textures`);
   * ```
   *
   * @since 1.0.0
   */
  public async translateAssets(javaAssets: JavaAssetCollection): Promise<AssetTranslationResult> {
    logger.info('Starting asset translation process');

    const conversionNotes: AssetConversionNote[] = [];

    try {
      // Convert textures
      logger.info(`Converting ${javaAssets.textures.length} textures`);
      const textureResult = await this.textureConverter.convertTextures(javaAssets.textures);
      const textureNotes = this.mapTextureNotes(textureResult.conversionNotes);
      conversionNotes.push(...textureNotes);

      // Add texture notes to global error collector
      textureNotes.forEach((note) => {
        globalErrorCollector.addError(
          /**
           * noteToConversionError method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          noteToConversionError(note, MODULE_ID, ErrorType.ASSET)
        );
      });

      // Convert models
      logger.info(`Converting ${javaAssets.models.length} models`);
      const modelResult = await this.modelConverter.convertModels(javaAssets.models);
      const modelNotes = this.mapModelNotes(modelResult.conversionNotes);
      conversionNotes.push(...modelNotes);

      // Add model notes to global error collector
      modelNotes.forEach((note) => {
        globalErrorCollector.addError(
          /**
           * noteToConversionError method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          noteToConversionError(note, MODULE_ID, ErrorType.ASSET)
        );
      });

      // Convert sounds
      logger.info(`Converting ${javaAssets.sounds.length} sounds`);
      const soundResult = await this.soundProcessor.convertSounds(javaAssets.sounds);
      const soundNotes = this.mapSoundNotes(soundResult.conversionNotes);
      conversionNotes.push(...soundNotes);

      // Add sound notes to global error collector
      soundNotes.forEach((note) => {
        globalErrorCollector.addError(
          /**
           * noteToConversionError method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          noteToConversionError(note, MODULE_ID, ErrorType.ASSET)
        );
      });

      // Convert particles
      logger.info(`Converting ${javaAssets.particles.length} particles`);
      const particleResult = await this.particleMapper.convertParticles(javaAssets.particles);
      const particleNotes = this.mapParticleNotes(particleResult.conversionNotes);
      conversionNotes.push(...particleNotes);

      // Add particle notes to global error collector
      particleNotes.forEach((note) => {
        globalErrorCollector.addError(
          /**
           * noteToConversionError method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          noteToConversionError(note, MODULE_ID, ErrorType.ASSET)
        );
      });

      // Assemble the result
      const bedrockAssets: BedrockAssetCollection = {
        textures: textureResult.convertedTextures,
        models: modelResult.convertedModels,
        sounds: soundResult.convertedSounds,
        particles: particleResult.convertedParticles,
        soundsJson: soundResult.soundsJson,
      };

      logger.info('Asset translation completed successfully');

      return {
        bedrockAssets,
        conversionNotes,
      };
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Asset translation failed: ${errorMessage}`, { error });

      // Create and add error to global collector
      ErrorHandler.assetError(
        `Asset translation failed: ${errorMessage}`,
        MODULE_ID,
        { originalError: error },
        ErrorSeverity.ERROR,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'TRANS', 1)
      );

      // Add error note to local collection
      conversionNotes.push({
        type: ErrorSeverity.ERROR,
        component: 'texture', // Default component
        message: `Asset translation failed: ${errorMessage}`,
        code: createErrorCode(MODULE_ID, 'TRANS', 1),
      });

      // Return empty result with error
      return {
        bedrockAssets: {
          textures: [],
          models: [],
          sounds: [],
          particles: [],
          soundsJson: {},
        },
        conversionNotes,
      };
    }
  }

  /**
   * Organizes all converted assets into the Bedrock resource pack structure.
   *
   * Takes the converted Bedrock assets and organizes them into the proper
   * directory structure expected by Minecraft Bedrock Edition, including
   * writing necessary metadata files like sounds.json.
   *
   * @param bedrockAssets - Collection of converted Bedrock assets
   * @param outputDir - Base output directory for the resource pack
   * @returns Promise that resolves when organization is complete
   * @throws {Error} When asset organization fails
   *
   * @example
   * ```typescript
   * await module.organizeAssets(bedrockAssets, '/output/resource_pack');
   * // Assets are now organized in proper Bedrock structure
   * ```
   *
   * @since 1.0.0
   */
  public async organizeAssets(
    bedrockAssets: BedrockAssetCollection,
    outputDir: string
  ): Promise<void> {
    logger.info(`Organizing converted assets in ${outputDir}`);

    try {
      // Ensure the output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Organize textures
      await this.textureConverter.organizeTextures(bedrockAssets.textures, outputDir);

      // Organize models
      await this.modelConverter.organizeModels(bedrockAssets.models, outputDir);

      // Organize sounds and write sounds.json
      await this.soundProcessor.organizeSounds(
        bedrockAssets.sounds,
        bedrockAssets.soundsJson,
        outputDir
      );

      // Organize particles
      await this.particleMapper.organizeParticles(bedrockAssets.particles, outputDir);

      logger.info('Asset organization completed successfully');
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Asset organization failed: ${errorMessage}`, { error });

      // Create and add error to global collector
      ErrorHandler.assetError(
        `Asset organization failed: ${errorMessage}`,
        MODULE_ID,
        { originalError: error, outputDir },
        ErrorSeverity.ERROR,
        /**
         * createErrorCode method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createErrorCode(MODULE_ID, 'ORG', 1)
      );

      // Re-throw the error for the caller to handle
      throw error;
    }
  }

  /**
   * Maps texture conversion notes to asset conversion notes
   *
   * @param notes - Texture-specific conversion notes
   * @returns Mapped asset conversion notes
   */
  private mapTextureNotes(notes: any[]): AssetConversionNote[] {
    return notes.map((note, index) => ({
      type: note.type as ErrorSeverity,
      component: 'texture',
      message: note.message,
      assetPath: note.texturePath,
      code: createErrorCode(MODULE_ID, 'TEX', index + 1),
      details: note.details || {},
    }));
  }

  /**
   * Maps model conversion notes to asset conversion notes
   *
   * @param notes - Model-specific conversion notes
   * @returns Mapped asset conversion notes
   */
  private mapModelNotes(notes: any[]): AssetConversionNote[] {
    return notes.map((note, index) => ({
      type: note.type as ErrorSeverity,
      component: 'model',
      message: note.message,
      assetPath: note.modelPath,
      code: createErrorCode(MODULE_ID, 'MDL', index + 1),
      details: note.details || {},
    }));
  }

  /**
   * Maps sound conversion notes to asset conversion notes
   *
   * @param notes - Sound-specific conversion notes
   * @returns Mapped asset conversion notes
   */
  private mapSoundNotes(notes: any[]): AssetConversionNote[] {
    return notes.map((note, index) => ({
      type: note.type as ErrorSeverity,
      component: 'sound',
      message: note.message,
      assetPath: note.soundPath,
      code: createErrorCode(MODULE_ID, 'SND', index + 1),
      details: note.details || {},
    }));
  }

  /**
   * Maps particle conversion notes to asset conversion notes
   *
   * @param notes - Particle-specific conversion notes
   * @returns Mapped asset conversion notes
   */
  private mapParticleNotes(notes: any[]): AssetConversionNote[] {
    return notes.map((note, index) => ({
      type: note.type as ErrorSeverity,
      component: 'particle',
      message: note.message,
      assetPath: note.particleName,
      code: createErrorCode(MODULE_ID, 'PRT', index + 1),
      details: note.details || {},
    }));
  }
}
