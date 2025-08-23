/**
 * AssetConverter - Specialized asset conversion agent
 *
 * Handles conversion of textures, models, and sounds from Java to Bedrock format
 */

import sharp from 'sharp';
import path from 'path';
import {
  TextureInfo,
  SoundInfo,
  ModelInfo,
  ConversionResult,
  ConversionMetadata,
  OptimizedTexture,
  BedrockModel,
  BedrockGeometry,
  BedrockBone,
  BedrockCube,
  OutputFile,
} from './types.js';
import {
  ConversionError,
  AssetConversionNote,
  createConversionError,
  ErrorType,
  ErrorSeverity,
  createErrorCode,
} from '../../types/errors.js';

/**
 * Asset conversion agent for textures, models, and sounds
 */
export class AssetConverter {
  private static readonly MODULE_NAME = 'AssetConverter';

  // Texture conversion constants
  private static readonly BEDROCK_TEXTURE_SIZE = 16;
  private static readonly SUPPORTED_TEXTURE_FORMATS = ['png', 'jpg', 'jpeg', 'tga'];
  private static readonly OUTPUT_FORMAT = 'png';

  // Model conversion constants
  private static readonly BEDROCK_FORMAT_VERSION = '1.12.0';
  private static readonly JAVA_TO_BEDROCK_SCALE = 1;

  // Sound conversion constants
  private static readonly SUPPORTED_SOUND_FORMATS = ['ogg', 'wav', 'mp3'];
  private static readonly BEDROCK_SOUND_FORMAT = 'ogg';

  /**
   * Convert multiple textures from Java to Bedrock format
   */
  async convertTextures(textures: TextureInfo[]): Promise<ConversionResult> {
    const startTime = Date.now();
    const outputFiles: OutputFile[] = [];
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];
    let successCount = 0;
    let totalSize = 0;

    for (const texture of textures) {
      try {
        const optimized = await this.optimizeTexture(texture);
        const outputPath = this.getBedrockTexturePath(texture);

        outputFiles.push({
          path: outputPath,
          content: optimized.buffer,
          type: 'texture',
          originalPath: texture.path,
        });

        successCount++;
        totalSize += optimized.buffer.length;

        // Add info note for successful conversion
        if (optimized.compressionRatio > 1.5) {
          warnings.push({
            type: ErrorSeverity.INFO,
            message: `Texture ${texture.name} compressed by ${optimized.compressionRatio.toFixed(2)}x`,
            component: 'texture',
            assetPath: texture.path,
            details: { compressionRatio: optimized.compressionRatio },
          });
        }
      } catch (error) {
        const conversionError = createConversionError({
          code: createErrorCode('ASSET', 'TEX', 1),
          type: ErrorType.ASSET,
          severity: ErrorSeverity.ERROR,
          message: `Failed to convert texture ${texture.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          moduleOrigin: AssetConverter.MODULE_NAME,
          details: { texturePath: texture.path, textureType: texture.type },
        });
        errors.push(conversionError);
      }
    }

    const metadata: ConversionMetadata = {
      processedCount: textures.length,
      successCount,
      failureCount: textures.length - successCount,
      processingTime: Date.now() - startTime,
      totalSize,
    };

    return {
      success: errors.length === 0,
      outputFiles,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Convert multiple sounds from Java to Bedrock format
   */
  async convertSounds(sounds: SoundInfo[]): Promise<ConversionResult> {
    const startTime = Date.now();
    const outputFiles: OutputFile[] = [];
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];
    let successCount = 0;
    let totalSize = 0;

    // Generate sounds.json for Bedrock
    const soundsJson = this.generateSoundsJson(sounds);
    outputFiles.push({
      path: 'sounds.json',
      content: JSON.stringify(soundsJson, null, 2),
      type: 'json',
    });

    for (const sound of sounds) {
      try {
        const result = await this.convertSound(sound);
        outputFiles.push(result);
        successCount++;
        totalSize += result.content.length;
      } catch (error) {
        const conversionError = createConversionError({
          code: createErrorCode('ASSET', 'SND', 1),
          type: ErrorType.ASSET,
          severity: ErrorSeverity.ERROR,
          message: `Failed to convert sound ${sound.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          moduleOrigin: AssetConverter.MODULE_NAME,
          details: { soundPath: sound.path, soundCategory: sound.category },
        });
        errors.push(conversionError);
      }
    }

    const metadata: ConversionMetadata = {
      processedCount: sounds.length,
      successCount,
      failureCount: sounds.length - successCount,
      processingTime: Date.now() - startTime,
      totalSize,
    };

    return {
      success: errors.length === 0,
      outputFiles,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Convert multiple models from Java to Bedrock format
   */
  async convertModels(models: ModelInfo[]): Promise<ConversionResult> {
    const startTime = Date.now();
    const outputFiles: OutputFile[] = [];
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];
    let successCount = 0;
    let totalSize = 0;

    for (const model of models) {
      try {
        const bedrockModel = this.convertModelFormat(model);
        const outputPath = this.getBedrockModelPath(model);
        const content = JSON.stringify(bedrockModel, null, 2);

        outputFiles.push({
          path: outputPath,
          content,
          type: 'model',
          originalPath: model.path,
        });

        successCount++;
        totalSize += content.length;

        // Add warning if model has complex features that might not convert perfectly
        if (this.hasComplexFeatures(model.content)) {
          warnings.push({
            type: ErrorSeverity.WARNING,
            message: `Model ${model.name} contains complex features that may not convert perfectly`,
            component: 'model',
            assetPath: model.path,
            details: { modelType: model.type },
          });
        }
      } catch (error) {
        const conversionError = createConversionError({
          code: createErrorCode('ASSET', 'MDL', 1),
          type: ErrorType.ASSET,
          severity: ErrorSeverity.ERROR,
          message: `Failed to convert model ${model.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          moduleOrigin: AssetConverter.MODULE_NAME,
          details: { modelPath: model.path, modelType: model.type },
        });
        errors.push(conversionError);
      }
    }

    const metadata: ConversionMetadata = {
      processedCount: models.length,
      successCount,
      failureCount: models.length - successCount,
      processingTime: Date.now() - startTime,
      totalSize,
    };

    return {
      success: errors.length === 0,
      outputFiles,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Optimize a texture for Bedrock format
   */
  private async optimizeTexture(texture: TextureInfo): Promise<OptimizedTexture> {
    const originalSize = texture.buffer.length;

    let image = sharp(texture.buffer);
    const metadata = await image.metadata();

    // Ensure RGBA format
    if (metadata.channels !== 4) {
      image = image.ensureAlpha();
    }

    // Resize if necessary (Bedrock typically uses 16x16 for blocks/items)
    let targetWidth = metadata.width || AssetConverter.BEDROCK_TEXTURE_SIZE;
    let targetHeight = metadata.height || AssetConverter.BEDROCK_TEXTURE_SIZE;

    if (texture.type === 'block' || texture.type === 'item') {
      // Standard block/item textures should be 16x16
      if (
        targetWidth !== AssetConverter.BEDROCK_TEXTURE_SIZE ||
        targetHeight !== AssetConverter.BEDROCK_TEXTURE_SIZE
      ) {
        targetWidth = AssetConverter.BEDROCK_TEXTURE_SIZE;
        targetHeight = AssetConverter.BEDROCK_TEXTURE_SIZE;
        image = image.resize(targetWidth, targetHeight, { kernel: 'nearest' });
      }
    }

    // Convert to PNG format
    const buffer = await image.png({ compressionLevel: 9 }).toBuffer();
    const compressionRatio = originalSize / buffer.length;

    return {
      buffer,
      width: targetWidth,
      height: targetHeight,
      format: AssetConverter.OUTPUT_FORMAT,
      compressionRatio,
    };
  }

  /**
   * Convert a single sound file
   */
  private async convertSound(sound: SoundInfo): Promise<OutputFile> {
    // For now, we'll copy the sound file as-is since we don't have audio conversion libraries
    // In a full implementation, you would use libraries like ffmpeg-node to convert formats
    const outputPath = this.getBedrockSoundPath(sound);

    return {
      path: outputPath,
      content: sound.buffer,
      type: 'sound',
      originalPath: sound.path,
    };
  }

  /**
   * Convert Java model format to Bedrock format
   */
  private convertModelFormat(model: ModelInfo): BedrockModel {
    const javaModel = model.content;

    const geometry: BedrockGeometry = {
      description: {
        identifier: `geometry.${model.name}`,
        texture_width: javaModel.texture_width || 16,
        texture_height: javaModel.texture_height || 16,
      },
      bones: [],
    };

    // Convert Java elements to Bedrock bones
    if (javaModel.elements && Array.isArray(javaModel.elements)) {
      for (let i = 0; i < javaModel.elements.length; i++) {
        const element = javaModel.elements[i];
        const bone = this.convertElementToBone(element, `bone_${i}`);
        geometry.bones.push(bone);
      }
    } else {
      // Create a default bone if no elements exist
      geometry.bones.push({
        name: 'main',
        pivot: [0, 0, 0],
        cubes: [
          {
            origin: [0, 0, 0],
            size: [16, 16, 16],
            uv: [0, 0],
          },
        ],
      });
    }

    return {
      format_version: AssetConverter.BEDROCK_FORMAT_VERSION,
      'minecraft:geometry': [geometry],
    };
  }

  /**
   * Convert a Java model element to a Bedrock bone
   */
  private convertElementToBone(element: any, boneName: string): BedrockBone {
    const bone: BedrockBone = {
      name: boneName,
      pivot: [0, 0, 0],
      cubes: [],
    };

    if (element.from && element.to) {
      const cube: BedrockCube = {
        origin: [
          element.from[0] - 8, // Convert to Bedrock coordinate system
          element.from[1] - 8,
          element.from[2] - 8,
        ],
        size: [
          element.to[0] - element.from[0],
          element.to[1] - element.from[1],
          element.to[2] - element.from[2],
        ],
      };

      // Convert UV mapping if present
      if (element.faces) {
        const faces = element.faces;
        if (faces.north && faces.north.uv) {
          cube.uv = faces.north.uv;
        } else {
          cube.uv = [0, 0];
        }
      } else {
        cube.uv = [0, 0];
      }

      // Handle rotation if present
      if (element.rotation) {
        cube.rotation = [element.rotation.angle || 0, 0, 0];
        if (element.rotation.axis === 'y') {
          cube.rotation = [0, element.rotation.angle || 0, 0];
        } else if (element.rotation.axis === 'z') {
          cube.rotation = [0, 0, element.rotation.angle || 0];
        }
      }

      bone.cubes!.push(cube);
    }

    return bone;
  }

  /**
   * Generate sounds.json for Bedrock
   */
  private generateSoundsJson(sounds: SoundInfo[]): any {
    const soundsJson: any = {};

    for (const sound of sounds) {
      const soundName = sound.name.replace(/\.[^/.]+$/, ''); // Remove extension
      soundsJson[soundName] = {
        category: sound.category,
        sounds: [
          {
            name: `sounds/${soundName}`,
            volume: 1.0,
            pitch: 1.0,
          },
        ],
      };
    }

    return soundsJson;
  }

  /**
   * Get Bedrock texture path
   */
  private getBedrockTexturePath(texture: TextureInfo): string {
    const baseName = path.basename(texture.name, path.extname(texture.name));

    switch (texture.type) {
      case 'block':
        return `textures/blocks/${baseName}.png`;
      case 'item':
        return `textures/items/${baseName}.png`;
      case 'entity':
        return `textures/entity/${baseName}.png`;
      case 'gui':
        return `textures/gui/${baseName}.png`;
      default:
        return `textures/${baseName}.png`;
    }
  }

  /**
   * Get Bedrock model path
   */
  private getBedrockModelPath(model: ModelInfo): string {
    const baseName = path.basename(model.name, path.extname(model.name));

    switch (model.type) {
      case 'block':
        return `models/blocks/${baseName}.json`;
      case 'item':
        return `models/items/${baseName}.json`;
      case 'entity':
        return `models/entity/${baseName}.json`;
      default:
        return `models/${baseName}.json`;
    }
  }

  /**
   * Get Bedrock sound path
   */
  private getBedrockSoundPath(sound: SoundInfo): string {
    const baseName = path.basename(sound.name, path.extname(sound.name));
    return `sounds/${baseName}.ogg`;
  }

  /**
   * Check if model has complex features that might not convert perfectly
   */
  private hasComplexFeatures(javaModel: any): boolean {
    // Check for complex features like animations, complex rotations, etc.
    if (javaModel.animation || javaModel.animations) return true;
    if (javaModel.display && Object.keys(javaModel.display).length > 3) return true;

    if (javaModel.elements) {
      for (const element of javaModel.elements) {
        if (element.rotation && element.rotation.angle % 22.5 !== 0) return true;
        if (element.faces && Object.keys(element.faces).length > 6) return true;
      }
    }

    return false;
  }

  /**
   * Validate asset integrity
   */
  private validateAssetIntegrity(buffer: Buffer, expectedType: string): boolean {
    if (buffer.length === 0) return false;

    // Basic file signature validation
    const signature = buffer.subarray(0, 8);

    switch (expectedType) {
      case 'png':
        return signature.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      case 'jpg':
      case 'jpeg':
        return signature.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]));
      case 'ogg':
        return signature.subarray(0, 4).equals(Buffer.from('OggS'));
      case 'wav':
        return signature.subarray(0, 4).equals(Buffer.from('RIFF'));
      default:
        return true; // Unknown type, assume valid
    }
  }
}
