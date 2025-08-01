/**
 * BedrockArchitect - Addon structure generation agent
 * 
 * Handles generation of proper Bedrock addon structure with manifests and organization
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { 
  AddonStructure, 
  PackStructure, 
  OutputFile,
  ConversionResult,
  ConversionMetadata
} from './types';
import { ConversionError, AssetConversionNote, createConversionError, ErrorType, ErrorSeverity, createErrorCode } from '../../types/errors';

/**
 * Information about the mod being converted
 */
export interface ModInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  minEngineVersion?: [number, number, number];
}

/**
 * Information about assets to be organized
 */
export interface AssetInfo {
  path: string;
  type: 'texture' | 'model' | 'sound' | 'animation' | 'particle' | 'other';
  content: Buffer | string;
  category?: string;
}

/**
 * Manifest pair for behavior and resource packs
 */
export interface ManifestPair {
  behaviorPack: any;
  resourcePack: any;
}

/**
 * Bedrock addon structure generation agent
 */
export class BedrockArchitect {
  private static readonly MODULE_NAME = 'BedrockArchitect';
  
  // Bedrock format constants
  private static readonly MANIFEST_FORMAT_VERSION = 2;
  private static readonly DEFAULT_MIN_ENGINE_VERSION = [1, 20, 0];
  private static readonly PACK_TYPE_BEHAVIOR = 'data';
  private static readonly PACK_TYPE_RESOURCE = 'resources';

  /**
   * Generate complete addon structure for a mod
   */
  async generateAddonStructure(modInfo: ModInfo): Promise<AddonStructure> {
    const behaviorPackId = uuidv4();
    const resourcePackId = uuidv4();
    
    // Create manifests
    const manifests = await this.createManifests(modInfo, behaviorPackId, resourcePackId);
    
    // Define directory structures
    const behaviorPack: PackStructure = {
      manifest: manifests.behaviorPack,
      directories: {
        'blocks': [],
        'items': [],
        'recipes': [],
        'loot_tables': [],
        'functions': [],
        'structures': [],
        'feature_rules': [],
        'features': [],
        'biomes': [],
        'entities': [],
        'spawn_rules': [],
        'trading': [],
        'dialogue': []
      },
      files: {}
    };

    const resourcePack: PackStructure = {
      manifest: manifests.resourcePack,
      directories: {
        'textures/blocks': [],
        'textures/items': [],
        'textures/entity': [],
        'textures/environment': [],
        'textures/gui': [],
        'textures/particle': [],
        'models/blocks': [],
        'models/items': [],
        'models/entity': [],
        'animations': [],
        'animation_controllers': [],
        'attachables': [],
        'entity': [],
        'fogs': [],
        'materials': [],
        'particles': [],
        'render_controllers': [],
        'sounds': [],
        'ui': []
      },
      files: {}
    };

    const sharedFiles = [
      'pack_icon.png',
      'README.md',
      'CHANGELOG.md'
    ];

    return {
      behaviorPack,
      resourcePack,
      sharedFiles
    };
  }

  /**
   * Create manifests for both behavior and resource packs
   */
  async createManifests(modInfo: ModInfo, behaviorPackId?: string, resourcePackId?: string): Promise<ManifestPair> {
    const bpId = behaviorPackId || uuidv4();
    const rpId = resourcePackId || uuidv4();
    
    const minEngineVersion = modInfo.minEngineVersion || BedrockArchitect.DEFAULT_MIN_ENGINE_VERSION;
    
    const behaviorPack = {
      format_version: BedrockArchitect.MANIFEST_FORMAT_VERSION,
      header: {
        name: `${modInfo.name} Behavior Pack`,
        description: modInfo.description || `Behavior pack for ${modInfo.name}`,
        uuid: bpId,
        version: this.parseVersion(modInfo.version),
        min_engine_version: minEngineVersion
      },
      modules: [
        {
          type: BedrockArchitect.PACK_TYPE_BEHAVIOR,
          uuid: uuidv4(),
          version: this.parseVersion(modInfo.version)
        }
      ],
      dependencies: [
        {
          uuid: rpId,
          version: this.parseVersion(modInfo.version)
        }
      ],
      metadata: {
        authors: modInfo.author ? [modInfo.author] : [],
        license: 'MIT',
        generated_with: {
          tool: 'minecraft-mod-converter',
          version: '0.1.0'
        }
      }
    };

    const resourcePack = {
      format_version: BedrockArchitect.MANIFEST_FORMAT_VERSION,
      header: {
        name: `${modInfo.name} Resource Pack`,
        description: modInfo.description || `Resource pack for ${modInfo.name}`,
        uuid: rpId,
        version: this.parseVersion(modInfo.version),
        min_engine_version: minEngineVersion
      },
      modules: [
        {
          type: BedrockArchitect.PACK_TYPE_RESOURCE,
          uuid: uuidv4(),
          version: this.parseVersion(modInfo.version)
        }
      ],
      metadata: {
        authors: modInfo.author ? [modInfo.author] : [],
        license: 'MIT',
        generated_with: {
          tool: 'minecraft-mod-converter',
          version: '0.1.0'
        }
      }
    };

    return {
      behaviorPack,
      resourcePack
    };
  }

  /**
   * Organize assets into the proper addon structure
   */
  async organizeAssets(assets: AssetInfo[], structure: AddonStructure): Promise<ConversionResult> {
    const startTime = Date.now();
    const outputFiles: OutputFile[] = [];
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];
    let successCount = 0;
    let totalSize = 0;

    // Add manifests to output
    outputFiles.push({
      path: 'behavior_pack/manifest.json',
      content: JSON.stringify(structure.behaviorPack.manifest, null, 2),
      type: 'manifest'
    });

    outputFiles.push({
      path: 'resource_pack/manifest.json',
      content: JSON.stringify(structure.resourcePack.manifest, null, 2),
      type: 'manifest'
    });

    // Organize assets by type and pack
    for (const asset of assets) {
      try {
        // Check for invalid content
        if (asset.content === null || asset.content === undefined) {
          throw new Error('Asset content is null or undefined');
        }
        
        const organizedPath = this.getOrganizedPath(asset);
        const packType = this.determinePackType(asset.type);
        const fullPath = `${packType}/${organizedPath}`;
        
        outputFiles.push({
          path: fullPath,
          content: asset.content,
          type: asset.type,
          originalPath: asset.path
        });

        // Update structure tracking
        this.updateStructureTracking(structure, asset, organizedPath, packType);
        
        successCount++;
        totalSize += typeof asset.content === 'string' ? 
          Buffer.byteLength(asset.content, 'utf8') : 
          asset.content.length;
          
      } catch (error) {
        const conversionError = createConversionError({
          code: createErrorCode('ARCH', 'ORG', 1),
          type: ErrorType.ASSET,
          severity: ErrorSeverity.ERROR,
          message: `Failed to organize asset ${asset.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          moduleOrigin: BedrockArchitect.MODULE_NAME,
          details: { assetPath: asset.path, assetType: asset.type }
        });
        errors.push(conversionError);
      }
    }

    // Generate additional structure files
    await this.generateStructureFiles(structure, outputFiles);

    const metadata: ConversionMetadata = {
      processedCount: assets.length,
      successCount,
      failureCount: assets.length - successCount,
      processingTime: Date.now() - startTime,
      totalSize
    };

    return {
      success: errors.length === 0,
      outputFiles,
      errors,
      warnings,
      metadata
    };
  }

  /**
   * Validate structure compliance with Bedrock standards
   */
  validateStructureCompliance(structure: AddonStructure): ConversionResult {
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];

    // Validate behavior pack manifest
    const bpValidation = this.validateManifest(structure.behaviorPack.manifest, 'behavior');
    errors.push(...bpValidation.errors);
    warnings.push(...bpValidation.warnings);

    // Validate resource pack manifest
    const rpValidation = this.validateManifest(structure.resourcePack.manifest, 'resource');
    errors.push(...rpValidation.errors);
    warnings.push(...rpValidation.warnings);

    // Validate directory structure
    const structureValidation = this.validateDirectoryStructure(structure);
    errors.push(...structureValidation.errors);
    warnings.push(...structureValidation.warnings);

    return {
      success: errors.length === 0,
      outputFiles: [],
      errors,
      warnings,
      metadata: {
        processedCount: 1,
        successCount: errors.length === 0 ? 1 : 0,
        failureCount: errors.length > 0 ? 1 : 0,
        processingTime: 0,
        totalSize: 0
      }
    };
  }

  /**
   * Parse version string to Bedrock format [major, minor, patch]
   */
  private parseVersion(version: string): [number, number, number] {
    const parts = version.split('.').map(part => {
      const num = parseInt(part.replace(/[^\d]/g, ''), 10);
      return isNaN(num) ? 0 : num;
    });
    
    return [
      parts[0] || 1,
      parts[1] || 0,
      parts[2] || 0
    ];
  }

  /**
   * Get organized path for an asset
   */
  private getOrganizedPath(asset: AssetInfo): string {
    const baseName = path.basename(asset.path);
    const category = asset.category || '';
    
    switch (asset.type) {
      case 'texture':
        return category ? `textures/${category}/${baseName}` : `textures/${baseName}`;
      case 'model':
        return category ? `models/${category}/${baseName}` : `models/${baseName}`;
      case 'sound':
        return `sounds/${baseName}`;
      case 'animation':
        return `animations/${baseName}`;
      case 'particle':
        return `particles/${baseName}`;
      default:
        return baseName;
    }
  }

  /**
   * Determine which pack type an asset belongs to
   */
  private determinePackType(assetType: string): string {
    switch (assetType) {
      case 'texture':
      case 'model':
      case 'sound':
      case 'animation':
      case 'particle':
        return 'resource_pack';
      default:
        return 'behavior_pack';
    }
  }

  /**
   * Update structure tracking with organized asset
   */
  private updateStructureTracking(
    structure: AddonStructure, 
    asset: AssetInfo, 
    organizedPath: string, 
    packType: string
  ): void {
    const pack = packType === 'resource_pack' ? structure.resourcePack : structure.behaviorPack;
    const directory = path.dirname(organizedPath);
    
    if (pack.directories[directory]) {
      pack.directories[directory].push(path.basename(organizedPath));
    } else {
      // Create new directory entry
      pack.directories[directory] = [path.basename(organizedPath)];
    }
  }

  /**
   * Generate additional structure files
   */
  private async generateStructureFiles(structure: AddonStructure, outputFiles: OutputFile[]): Promise<void> {
    // Generate pack icons (placeholder)
    const iconContent = this.generatePackIcon();
    outputFiles.push({
      path: 'behavior_pack/pack_icon.png',
      content: iconContent,
      type: 'texture'
    });
    outputFiles.push({
      path: 'resource_pack/pack_icon.png',
      content: iconContent,
      type: 'texture'
    });

    // Generate README
    const readmeContent = this.generateReadme(structure);
    outputFiles.push({
      path: 'README.md',
      content: readmeContent,
      type: 'other'
    });

    // Generate directory structure documentation
    const structureDoc = this.generateStructureDocumentation(structure);
    outputFiles.push({
      path: 'STRUCTURE.md',
      content: structureDoc,
      type: 'other'
    });
  }

  /**
   * Validate manifest structure
   */
  private validateManifest(manifest: any, packType: string): { errors: ConversionError[], warnings: AssetConversionNote[] } {
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];

    // Required fields validation
    if (!manifest.header) {
      errors.push(createConversionError({
        code: createErrorCode('ARCH', 'MAN', 1),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: `Missing header in ${packType} pack manifest`,
        moduleOrigin: BedrockArchitect.MODULE_NAME
      }));
    } else {
      if (!manifest.header.uuid) {
        errors.push(createConversionError({
          code: createErrorCode('ARCH', 'MAN', 2),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: `Missing UUID in ${packType} pack manifest header`,
          moduleOrigin: BedrockArchitect.MODULE_NAME
        }));
      }
      
      if (!manifest.header.version) {
        errors.push(createConversionError({
          code: createErrorCode('ARCH', 'MAN', 3),
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: `Missing version in ${packType} pack manifest header`,
          moduleOrigin: BedrockArchitect.MODULE_NAME
        }));
      }
    }

    if (!manifest.modules || !Array.isArray(manifest.modules) || manifest.modules.length === 0) {
      errors.push(createConversionError({
        code: createErrorCode('ARCH', 'MAN', 4),
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: `Missing or empty modules array in ${packType} pack manifest`,
        moduleOrigin: BedrockArchitect.MODULE_NAME
      }));
    }

    // Warnings for optional but recommended fields
    if (!manifest.header?.description) {
      warnings.push({
        type: 'warning',
        message: `Missing description in ${packType} pack manifest`,
        component: 'model',
        details: { packType }
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate directory structure
   */
  private validateDirectoryStructure(structure: AddonStructure): { errors: ConversionError[], warnings: AssetConversionNote[] } {
    const errors: ConversionError[] = [];
    const warnings: AssetConversionNote[] = [];

    // Check for required directories
    const requiredBehaviorDirs = ['blocks', 'items'];
    const requiredResourceDirs = ['textures', 'models'];

    for (const dir of requiredBehaviorDirs) {
      if (!structure.behaviorPack.directories[dir]) {
        warnings.push({
          type: 'warning',
          message: `Missing recommended directory: ${dir} in behavior pack`,
          component: 'model',
          details: { directory: dir, packType: 'behavior' }
        });
      }
    }

    for (const dir of requiredResourceDirs) {
      if (!structure.resourcePack.directories[dir]) {
        warnings.push({
          type: 'warning',
          message: `Missing recommended directory: ${dir} in resource pack`,
          component: 'model',
          details: { directory: dir, packType: 'resource' }
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Generate a placeholder pack icon
   */
  private generatePackIcon(): Buffer {
    // This would generate a simple PNG icon
    // For now, return a minimal PNG buffer
    return Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, // 16x16 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68, // Color type, etc.
      0x36, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk start
      0x54, 0x08, 0x99, 0x01, 0x01, 0x01, 0x00, 0x01, // Minimal image data
      0x00, 0xFE, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 
      0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82 // IEND chunk
    ]);
  }

  /**
   * Generate README content
   */
  private generateReadme(structure: AddonStructure): string {
    const bpManifest = structure.behaviorPack.manifest;
    const rpManifest = structure.resourcePack.manifest;
    
    return `# ${bpManifest.header.name}

${bpManifest.header.description}

## Installation

1. Copy the \`behavior_pack\` folder to your Minecraft Bedrock \`behavior_packs\` directory
2. Copy the \`resource_pack\` folder to your Minecraft Bedrock \`resource_packs\` directory
3. Enable both packs in your world settings

## Pack Information

- **Behavior Pack**: ${bpManifest.header.name} v${bpManifest.header.version.join('.')}
- **Resource Pack**: ${rpManifest.header.name} v${rpManifest.header.version.join('.')}
- **Min Engine Version**: ${bpManifest.header.min_engine_version.join('.')}

## Generated by

This addon was generated using minecraft-mod-converter v0.1.0

## License

${bpManifest.metadata?.license || 'MIT'}
`;
  }

  /**
   * Generate structure documentation
   */
  private generateStructureDocumentation(structure: AddonStructure): string {
    let doc = '# Addon Structure\n\n';
    
    doc += '## Behavior Pack\n\n';
    doc += '```\nbehavior_pack/\n';
    doc += '├── manifest.json\n';
    for (const [dir, files] of Object.entries(structure.behaviorPack.directories)) {
      if (files.length > 0) {
        doc += `├── ${dir}/\n`;
        files.forEach(file => {
          doc += `│   ├── ${file}\n`;
        });
      }
    }
    doc += '```\n\n';
    
    doc += '## Resource Pack\n\n';
    doc += '```\nresource_pack/\n';
    doc += '├── manifest.json\n';
    for (const [dir, files] of Object.entries(structure.resourcePack.directories)) {
      if (files.length > 0) {
        doc += `├── ${dir}/\n`;
        files.forEach(file => {
          doc += `│   ├── ${file}\n`;
        });
      }
    }
    doc += '```\n';
    
    return doc;
  }
}