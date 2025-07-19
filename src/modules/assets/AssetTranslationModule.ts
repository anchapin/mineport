import * as path from 'path';
import * as fs from 'fs/promises';
import { createLogger } from '../../utils/logger';
import { 
  TextureConverter, 
  JavaTextureFile, 
  BedrockTextureFile, 
  TextureConversionResult 
} from './TextureConverter';
import { 
  ModelConverter, 
  JavaModelFile, 
  BedrockModelFile, 
  ModelConversionResult 
} from './ModelConverter';
import { 
  SoundProcessor, 
  JavaSoundFile, 
  BedrockSoundFile, 
  SoundConversionResult 
} from './SoundProcessor';
import { 
  ParticleMapper, 
  JavaParticleDefinition, 
  BedrockParticleDefinition, 
  ParticleConversionResult 
} from './ParticleMapper';

const logger = createLogger('AssetTranslationModule');

/**
 * Interface for Java assets collection
 */
export interface JavaAssets {
  textures: JavaTextureFile[];
  models: JavaModelFile[];
  sounds: JavaSoundFile[];
  particles: JavaParticleDefinition[];
}

/**
 * Interface for Bedrock assets collection
 */
export interface BedrockAssets {
  textures: BedrockTextureFile[];
  models: BedrockModelFile[];
  sounds: BedrockSoundFile[];
  particles: BedrockParticleDefinition[];
  soundsJson: object;
}

/**
 * Interface for asset conversion notes
 */
export interface AssetConversionNote {
  type: 'info' | 'warning' | 'error';
  component: 'texture' | 'model' | 'sound' | 'particle';
  message: string;
  assetPath?: string;
}

/**
 * Interface for asset translation result
 */
export interface AssetTranslationResult {
  bedrockAssets: BedrockAssets;
  conversionNotes: AssetConversionNote[];
}

/**
 * Class responsible for coordinating the translation of all asset types
 * from Java Edition format to Bedrock Edition format.
 */
export class AssetTranslationModule {
  private textureConverter: TextureConverter;
  private modelConverter: ModelConverter;
  private soundProcessor: SoundProcessor;
  private particleMapper: ParticleMapper;
  
  /**
   * Creates a new instance of the AssetTranslationModule
   */
  constructor() {
    this.textureConverter = new TextureConverter();
    this.modelConverter = new ModelConverter();
    this.soundProcessor = new SoundProcessor();
    this.particleMapper = new ParticleMapper();
  }
  
  /**
   * Translates all Java assets to Bedrock format
   * 
   * @param javaAssets - Collection of Java assets to translate
   * @returns Translation result with converted assets and notes
   */
  public async translateAssets(javaAssets: JavaAssets): Promise<AssetTranslationResult> {
    logger.info('Starting asset translation process');
    
    const conversionNotes: AssetConversionNote[] = [];
    
    // Convert textures
    logger.info(`Converting ${javaAssets.textures.length} textures`);
    const textureResult = await this.textureConverter.convertTextures(javaAssets.textures);
    conversionNotes.push(...this.mapTextureNotes(textureResult.conversionNotes));
    
    // Convert models
    logger.info(`Converting ${javaAssets.models.length} models`);
    const modelResult = await this.modelConverter.convertModels(javaAssets.models);
    conversionNotes.push(...this.mapModelNotes(modelResult.conversionNotes));
    
    // Convert sounds
    logger.info(`Converting ${javaAssets.sounds.length} sounds`);
    const soundResult = await this.soundProcessor.convertSounds(javaAssets.sounds);
    conversionNotes.push(...this.mapSoundNotes(soundResult.conversionNotes));
    
    // Convert particles
    logger.info(`Converting ${javaAssets.particles.length} particles`);
    const particleResult = await this.particleMapper.convertParticles(javaAssets.particles);
    conversionNotes.push(...this.mapParticleNotes(particleResult.conversionNotes));
    
    // Assemble the result
    const bedrockAssets: BedrockAssets = {
      textures: textureResult.convertedTextures,
      models: modelResult.convertedModels,
      sounds: soundResult.convertedSounds,
      particles: particleResult.convertedParticles,
      soundsJson: soundResult.soundsJson
    };
    
    logger.info('Asset translation completed successfully');
    
    return {
      bedrockAssets,
      conversionNotes
    };
  }
  
  /**
   * Organizes all converted assets into the Bedrock resource pack structure
   * 
   * @param bedrockAssets - Collection of converted Bedrock assets
   * @param outputDir - Base output directory for the resource pack
   */
  public async organizeAssets(bedrockAssets: BedrockAssets, outputDir: string): Promise<void> {
    logger.info(`Organizing converted assets in ${outputDir}`);
    
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
  }
  
  /**
   * Maps texture conversion notes to asset conversion notes
   * 
   * @param notes - Texture-specific conversion notes
   * @returns Mapped asset conversion notes
   */
  private mapTextureNotes(notes: any[]): AssetConversionNote[] {
    return notes.map(note => ({
      type: note.type,
      component: 'texture',
      message: note.message,
      assetPath: note.texturePath
    }));
  }
  
  /**
   * Maps model conversion notes to asset conversion notes
   * 
   * @param notes - Model-specific conversion notes
   * @returns Mapped asset conversion notes
   */
  private mapModelNotes(notes: any[]): AssetConversionNote[] {
    return notes.map(note => ({
      type: note.type,
      component: 'model',
      message: note.message,
      assetPath: note.modelPath
    }));
  }
  
  /**
   * Maps sound conversion notes to asset conversion notes
   * 
   * @param notes - Sound-specific conversion notes
   * @returns Mapped asset conversion notes
   */
  private mapSoundNotes(notes: any[]): AssetConversionNote[] {
    return notes.map(note => ({
      type: note.type,
      component: 'sound',
      message: note.message,
      assetPath: note.soundPath
    }));
  }
  
  /**
   * Maps particle conversion notes to asset conversion notes
   * 
   * @param notes - Particle-specific conversion notes
   * @returns Mapped asset conversion notes
   */
  private mapParticleNotes(notes: any[]): AssetConversionNote[] {
    return notes.map(note => ({
      type: note.type,
      component: 'particle',
      message: note.message,
      assetPath: note.particleName
    }));
  }
}