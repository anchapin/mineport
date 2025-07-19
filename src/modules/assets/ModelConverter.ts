import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ModelConverter');

/**
 * Interface representing a model file in Java format
 */
export interface JavaModelFile {
  path: string;
  data: Buffer | object;
  type: 'block' | 'item' | 'entity';
  metadata?: {
    parent?: string;
    textures?: Record<string, string>;
    elements?: any[];
    display?: Record<string, any>;
  };
}

/**
 * Interface representing a model file in Bedrock format
 */
export interface BedrockModelFile {
  path: string;
  data: Buffer | object;
  type: 'block' | 'item' | 'entity';
  metadata?: {
    textures?: Record<string, string>;
    geometry?: string;
    materials?: Record<string, any>;
  };
}

/**
 * Interface for model conversion result
 */
export interface ModelConversionResult {
  convertedModels: BedrockModelFile[];
  conversionNotes: ModelConversionNote[];
}

/**
 * Interface for model conversion notes/warnings
 */
export interface ModelConversionNote {
  type: 'info' | 'warning' | 'error';
  message: string;
  modelPath?: string;
}

/**
 * Class responsible for converting Java Edition model files to Bedrock Edition format
 * and transforming them into Bedrock's geometry format.
 */
export class ModelConverter {
  /**
   * Converts a collection of Java model files to Bedrock format
   * 
   * @param javaModels - Array of Java model files to convert
   * @returns Conversion result with converted models and notes
   */
  public async convertModels(javaModels: JavaModelFile[]): Promise<ModelConversionResult> {
    logger.info(`Converting ${javaModels.length} model files`);
    
    const convertedModels: BedrockModelFile[] = [];
    const conversionNotes: ModelConversionNote[] = [];
    
    for (const javaModel of javaModels) {
      try {
        const bedrockModel = await this.convertSingleModel(javaModel);
        convertedModels.push(bedrockModel);
      } catch (error) {
        logger.error(`Failed to convert model ${javaModel.path}: ${error}`);
        conversionNotes.push({
          type: 'error',
          message: `Failed to convert model: ${error instanceof Error ? error.message : String(error)}`,
          modelPath: javaModel.path
        });
      }
    }
    
    return {
      convertedModels,
      conversionNotes
    };
  }
  
  /**
   * Converts a single Java model file to Bedrock format
   * 
   * @param javaModel - Java model file to convert
   * @returns Converted Bedrock model file
   */
  private async convertSingleModel(javaModel: JavaModelFile): Promise<BedrockModelFile> {
    // Map the Java model path to the corresponding Bedrock path
    const bedrockPath = this.mapModelPath(javaModel.path, javaModel.type);
    
    // Convert the model data based on its type
    let modelData: any;
    let metadata: any = {};
    
    switch (javaModel.type) {
      case 'block':
        const blockResult = this.convertBlockModel(javaModel);
        modelData = blockResult.data;
        metadata = blockResult.metadata;
        break;
      case 'item':
        const itemResult = this.convertItemModel(javaModel);
        modelData = itemResult.data;
        metadata = itemResult.metadata;
        break;
      case 'entity':
        const entityResult = this.convertEntityModel(javaModel);
        modelData = entityResult.data;
        metadata = entityResult.metadata;
        break;
      default:
        throw new Error(`Unsupported model type: ${javaModel.type}`);
    }
    
    return {
      path: bedrockPath,
      data: modelData,
      type: javaModel.type,
      metadata
    };
  }
  
  /**
   * Maps a Java model path to the corresponding Bedrock path
   * 
   * @param javaPath - Original Java model path
   * @param modelType - Type of the model (block, item, entity)
   * @returns Mapped Bedrock model path
   */
  private mapModelPath(javaPath: string, modelType: 'block' | 'item' | 'entity'): string {
    // Extract the relevant parts from the Java path
    const parts = javaPath.split('/');
    const modId = parts[1]; // Extract mod ID for potential namespacing
    
    // Find the model category and file name
    let fileName = '';
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'models' && i + 1 < parts.length) {
        if (i + 2 < parts.length) {
          fileName = parts.slice(i + 2).join('/');
        }
        break;
      }
    }
    
    // Remove .json extension if present
    if (fileName.endsWith('.json')) {
      fileName = fileName.substring(0, fileName.length - 5);
    }
    
    // Map to appropriate Bedrock path based on model type
    switch (modelType) {
      case 'block':
        return `models/blocks/${modId}_${fileName}.geo.json`;
      case 'item':
        return `models/items/${modId}_${fileName}.geo.json`;
      case 'entity':
        return `models/entity/${modId}_${fileName}.geo.json`;
      default:
        return `models/${modId}_${fileName}.geo.json`;
    }
  }
  
  /**
   * Converts a Java block model to Bedrock format
   * 
   * @param javaModel - Java block model to convert
   * @returns Converted Bedrock block model data and metadata
   */
  private convertBlockModel(javaModel: JavaModelFile): { data: any; metadata: any } {
    // Parse the model data if it's a Buffer
    const modelData = typeof javaModel.data === 'object' && !(javaModel.data instanceof Buffer) 
      ? javaModel.data 
      : JSON.parse(javaModel.data.toString('utf-8'));
    
    // Create a Bedrock geometry model
    const bedrockModel = {
      format_version: '1.12.0',
      'minecraft:geometry': [
        {
          description: {
            identifier: `geometry.${this.extractModelIdentifier(javaModel.path)}`,
            texture_width: 16,
            texture_height: 16,
            visible_bounds_width: 2,
            visible_bounds_height: 2,
            visible_bounds_offset: [0, 0, 0]
          },
          bones: [
            {
              name: 'block',
              pivot: [0, 0, 0],
              cubes: this.convertBlockElements(modelData.elements || [])
            }
          ]
        }
      ]
    };
    
    // Extract texture mappings
    const textures = modelData.textures || {};
    
    return {
      data: bedrockModel,
      metadata: {
        textures,
        geometry: `geometry.${this.extractModelIdentifier(javaModel.path)}`
      }
    };
  }
  
  /**
   * Converts Java block elements to Bedrock cubes
   * 
   * @param elements - Java block model elements
   * @returns Bedrock cube definitions
   */
  private convertBlockElements(elements: any[]): any[] {
    if (!elements || elements.length === 0) {
      // Create a default cube if no elements are defined
      return [{
        origin: [-8, 0, -8],
        size: [16, 16, 16],
        uv: {
          north: { uv: [0, 0], uv_size: [16, 16] },
          east: { uv: [0, 0], uv_size: [16, 16] },
          south: { uv: [0, 0], uv_size: [16, 16] },
          west: { uv: [0, 0], uv_size: [16, 16] },
          up: { uv: [0, 0], uv_size: [16, 16] },
          down: { uv: [0, 0], uv_size: [16, 16] }
        }
      }];
    }
    
    return elements.map(element => {
      // Java models use [from, to] coordinates, Bedrock uses [origin, size]
      const from = element.from || [0, 0, 0];
      const to = element.to || [16, 16, 16];
      
      // Convert Java coordinates to Bedrock
      // Java: [0,0,0] is the bottom-left corner
      // Bedrock: [0,0,0] is the center, so we need to offset
      const origin = [
        from[0] - 8,
        from[1],
        from[2] - 8
      ];
      
      const size = [
        to[0] - from[0],
        to[1] - from[1],
        to[2] - from[2]
      ];
      
      // Convert UV mappings
      const uv: any = {};
      
      if (element.faces) {
        for (const [face, faceData] of Object.entries(element.faces)) {
          if (faceData) {
            const uvData = (faceData as any).uv || [0, 0, 16, 16];
            uv[face] = {
              uv: [uvData[0], uvData[1]],
              uv_size: [uvData[2] - uvData[0], uvData[3] - uvData[1]]
            };
          }
        }
      }
      
      return {
        origin,
        size,
        uv
      };
    });
  }
  
  /**
   * Converts a Java item model to Bedrock format
   * 
   * @param javaModel - Java item model to convert
   * @returns Converted Bedrock item model data and metadata
   */
  private convertItemModel(javaModel: JavaModelFile): { data: any; metadata: any } {
    // Parse the model data if it's a Buffer
    const modelData = typeof javaModel.data === 'object' && !(javaModel.data instanceof Buffer) 
      ? javaModel.data 
      : JSON.parse(javaModel.data.toString('utf-8'));
    
    // Create a Bedrock geometry model for the item
    const bedrockModel = {
      format_version: '1.12.0',
      'minecraft:geometry': [
        {
          description: {
            identifier: `geometry.${this.extractModelIdentifier(javaModel.path)}`,
            texture_width: 16,
            texture_height: 16,
            visible_bounds_width: 2,
            visible_bounds_height: 2,
            visible_bounds_offset: [0, 0, 0]
          },
          bones: [
            {
              name: 'item',
              pivot: [0, 0, 0],
              cubes: [
                {
                  origin: [-8, 0, 0],
                  size: [16, 16, 0.1],
                  uv: {
                    north: { uv: [0, 0], uv_size: [16, 16] }
                  }
                }
              ]
            }
          ]
        }
      ]
    };
    
    // Extract texture mappings
    const textures = modelData.textures || {};
    
    return {
      data: bedrockModel,
      metadata: {
        textures,
        geometry: `geometry.${this.extractModelIdentifier(javaModel.path)}`
      }
    };
  }
  
  /**
   * Converts a Java entity model to Bedrock format
   * 
   * @param javaModel - Java entity model to convert
   * @returns Converted Bedrock entity model data and metadata
   */
  private convertEntityModel(javaModel: JavaModelFile): { data: any; metadata: any } {
    // Entity models are more complex and often use custom formats
    // This is a simplified implementation that would need to be expanded
    // based on the specific entity model format used by the mod
    
    // Parse the model data if it's a Buffer
    const modelData = typeof javaModel.data === 'object' && !(javaModel.data instanceof Buffer) 
      ? javaModel.data 
      : JSON.parse(javaModel.data.toString('utf-8'));
    
    // Create a basic Bedrock entity model
    const bedrockModel = {
      format_version: '1.12.0',
      'minecraft:geometry': [
        {
          description: {
            identifier: `geometry.${this.extractModelIdentifier(javaModel.path)}`,
            texture_width: 64,
            texture_height: 64,
            visible_bounds_width: 2,
            visible_bounds_height: 3,
            visible_bounds_offset: [0, 1, 0]
          },
          bones: this.convertEntityBones(modelData)
        }
      ]
    };
    
    // Extract texture mappings
    const textures = modelData.textures || {};
    
    return {
      data: bedrockModel,
      metadata: {
        textures,
        geometry: `geometry.${this.extractModelIdentifier(javaModel.path)}`
      }
    };
  }
  
  /**
   * Converts Java entity model bones/parts to Bedrock format
   * 
   * @param modelData - Java entity model data
   * @returns Array of Bedrock bone definitions
   */
  private convertEntityBones(modelData: any): any[] {
    // This is a simplified implementation
    // In a real implementation, this would need to handle different entity model formats
    
    // If the model has a defined structure, try to convert it
    if (modelData.elements) {
      return [{
        name: 'body',
        pivot: [0, 0, 0],
        cubes: this.convertBlockElements(modelData.elements)
      }];
    }
    
    // If the model has bones/parts defined in a custom format
    if (modelData.bones || modelData.parts) {
      const sourceBones = modelData.bones || modelData.parts || [];
      return sourceBones.map((bone: any) => {
        return {
          name: bone.name || 'unknown',
          pivot: bone.pivot || [0, 0, 0],
          rotation: bone.rotation || [0, 0, 0],
          cubes: (bone.cubes || []).map((cube: any) => {
            return {
              origin: cube.origin || [0, 0, 0],
              size: cube.size || [1, 1, 1],
              uv: cube.uv || { north: { uv: [0, 0], uv_size: [16, 16] } }
            };
          })
        };
      });
    }
    
    // Default fallback if no recognizable structure
    return [{
      name: 'body',
      pivot: [0, 0, 0],
      cubes: [{
        origin: [-4, 0, -2],
        size: [8, 12, 4],
        uv: {
          north: { uv: [0, 0], uv_size: [8, 12] },
          east: { uv: [8, 0], uv_size: [4, 12] },
          south: { uv: [12, 0], uv_size: [8, 12] },
          west: { uv: [20, 0], uv_size: [4, 12] },
          up: { uv: [8, 0], uv_size: [8, 4] },
          down: { uv: [16, 4], uv_size: [8, 4] }
        }
      }]
    }];
  }
  
  /**
   * Extracts a model identifier from its path
   * 
   * @param modelPath - Path to the model file
   * @returns Model identifier
   */
  private extractModelIdentifier(modelPath: string): string {
    // Extract mod ID and model name from the path
    const parts = modelPath.split('/');
    const modId = parts[1]; // Extract mod ID
    
    // Find the model name
    let modelName = '';
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'models' && i + 2 < parts.length) {
        modelName = parts.slice(i + 2).join('_');
        break;
      }
    }
    
    // Remove .json extension if present
    if (modelName.endsWith('.json')) {
      modelName = modelName.substring(0, modelName.length - 5);
    }
    
    return `${modId}_${modelName}`;
  }
  
  /**
   * Validates a converted Bedrock model
   * 
   * @param model - Bedrock model to validate
   * @returns Validation result with any issues found
   */
  public validateModel(model: BedrockModelFile): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check if the model has the required format version
    if (typeof model.data === 'object' && model.data !== null) {
      const modelData = model.data as any;
      
      if (!modelData.format_version) {
        issues.push('Missing format_version');
      }
      
      if (!modelData['minecraft:geometry']) {
        issues.push('Missing minecraft:geometry section');
      } else if (!Array.isArray(modelData['minecraft:geometry']) || modelData['minecraft:geometry'].length === 0) {
        issues.push('minecraft:geometry must be a non-empty array');
      } else {
        const geometry = modelData['minecraft:geometry'][0];
        
        // Check for required geometry properties
        if (!geometry.description) {
          issues.push('Missing geometry description');
        } else {
          if (!geometry.description.identifier) {
            issues.push('Missing geometry identifier');
          }
          
          if (!geometry.description.texture_width || !geometry.description.texture_height) {
            issues.push('Missing texture dimensions');
          }
        }
        
        // Check bones structure
        if (!geometry.bones || !Array.isArray(geometry.bones) || geometry.bones.length === 0) {
          issues.push('Missing or empty bones array');
        } else {
          // Validate each bone
          geometry.bones.forEach((bone: any, index: number) => {
            if (!bone.name) {
              issues.push(`Bone at index ${index} is missing a name`);
            }
            
            if (!bone.pivot || !Array.isArray(bone.pivot) || bone.pivot.length !== 3) {
              issues.push(`Bone "${bone.name || index}" has invalid pivot point`);
            }
            
            // Check cubes if present
            if (bone.cubes && (!Array.isArray(bone.cubes) || bone.cubes.some((cube: any) => 
              !cube.origin || !cube.size || !Array.isArray(cube.origin) || !Array.isArray(cube.size)
            ))) {
              issues.push(`Bone "${bone.name || index}" has invalid cubes`);
            }
          });
        }
      }
    } else {
      issues.push('Model data is not a valid object');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  /**
   * Organizes converted models according to Bedrock's resource pack structure
   * 
   * @param convertedModels - Array of converted Bedrock models
   * @param outputDir - Output directory for the organized models
   */
  public async organizeModels(
    convertedModels: BedrockModelFile[],
    outputDir: string
  ): Promise<void> {
    logger.info(`Organizing ${convertedModels.length} models in ${outputDir}`);
    
    for (const model of convertedModels) {
      const outputPath = path.join(outputDir, model.path);
      const outputDirPath = path.dirname(outputPath);
      
      // Ensure the directory exists
      await fs.mkdir(outputDirPath, { recursive: true });
      
      // Write the model file
      if (typeof model.data === 'object') {
        await fs.writeFile(outputPath, JSON.stringify(model.data, null, 2));
      } else {
        await fs.writeFile(outputPath, model.data);
      }
      
      // Generate any additional required files (like material definitions)
      if (model.metadata && model.metadata.materials) {
        await this.createMaterialDefinition(model, outputDirPath);
      }
    }
  }
  
  /**
   * Creates material definition files for models that require them
   * 
   * @param model - Model with material definitions
   * @param outputDir - Output directory
   */
  private async createMaterialDefinition(
    model: BedrockModelFile,
    outputDir: string
  ): Promise<void> {
    if (!model.metadata?.materials) return;
    
    // Extract the base name without extension
    // Handle the case where the file might have multiple extensions (e.g., .geo.json)
    const fileName = path.basename(model.path);
    const baseNameMatch = fileName.match(/^(.+?)\.geo\.json$/);
    const baseName = baseNameMatch ? baseNameMatch[1] : path.basename(fileName, path.extname(fileName));
    
    const materialDefPath = path.join(outputDir, `${baseName}.material.json`);
    
    const materialDef = {
      materials: model.metadata.materials
    };
    
    await fs.writeFile(materialDefPath, JSON.stringify(materialDef, null, 2));
  }
}