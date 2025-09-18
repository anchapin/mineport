/**
 * ManifestGenerator Component
 *
 * This component is responsible for extracting mod metadata from Java files
 * and generating valid Bedrock manifest.json files with UUID creation.
 * It also validates the generated manifests against Bedrock specifications.
 */

import { v5 as uuidv5 } from 'uuid';
import * as fs from 'fs';
import path from 'path';
import logger from '../../utils/logger.js';

// UUID namespace for consistent generation based on mod ID
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * JavaModMetadata interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface JavaModMetadata {
  modId: string;
  modName: string;
  modVersion: string;
  description?: string;
  authors?: string[];
  website?: string;
  logoFile?: string;
}

/**
 * BedrockManifest interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface BedrockManifest {
  format_version: number;
  header: {
    name: string;
    description: string;
    uuid: string;
    version: number[];
    min_engine_version: number[];
  };
  modules: {
    type: string;
    uuid: string;
    version: number[];
    description?: string;
  }[];
  dependencies?: {
    uuid: string;
    version: number[];
  }[];
  metadata?: {
    authors?: string[];
    url?: string;
    license?: string;
  };
}

/**
 * ManifestGenerationResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface ManifestGenerationResult {
  success: boolean;
  behaviorPackManifest?: BedrockManifest;
  resourcePackManifest?: BedrockManifest;
  errors?: string[];
}

/**
 * ManifestGenerator class.
 *
 * TODO: Add detailed description of the class purpose and functionality.
 *
 * @since 1.0.0
 */
export class ManifestGenerator {
  /**
   * Extracts metadata from Java mod files
   * @param modPath Path to the extracted mod files
   * @returns JavaModMetadata object with extracted information
   */
  async extractModMetadata(modPath: string): Promise<JavaModMetadata> {
    try {
      // Check for common mod descriptor files
      const modTomlPath = path.join(modPath, 'META-INF', 'mods.toml');
      const fabricModPath = path.join(modPath, 'fabric.mod.json');
      const modInfoPath = path.join(modPath, 'mcmod.info');

      let metadata: JavaModMetadata = {
        modId: '',
        modName: '',
        modVersion: '1.0.0',
      };

      // Try to extract from mods.toml (Forge)
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (await this.fileExists(modTomlPath)) {
        const tomlData = await this.extractModTomlMetadata(modTomlPath);
        metadata = { ...metadata, ...tomlData };
      }
      // Try to extract from fabric.mod.json (Fabric)
      else if (await this.fileExists(fabricModPath)) {
        const fabricData = await this.extractFabricModMetadata(fabricModPath);
        metadata = { ...metadata, ...fabricData };
      }
      // Try to extract from mcmod.info (older Forge)
      else if (await this.fileExists(modInfoPath)) {
        const modInfoData = await this.extractModInfoMetadata(modInfoPath);
        metadata = { ...metadata, ...modInfoData };
      }

      // If we still don't have a mod ID, try to infer from directory structure
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!metadata.modId) {
        metadata.modId = this.inferModIdFromPath(modPath);
      }

      // If we still don't have a mod name, use the mod ID
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!metadata.modName) {
        metadata.modName = metadata.modId;
      }

      logger.info('Extracted mod metadata', { metadata });
      return metadata;
    } catch (error) {
      logger.error('Error extracting mod metadata', { error });
      throw new Error(`Failed to extract mod metadata: ${(error as Error).message}`);
    }
  }

  /**
   * Generates Bedrock manifest.json files for both behavior and resource packs
   * @param metadata Java mod metadata
   * @returns ManifestGenerationResult with generated manifests
   */
  generateManifests(metadata: JavaModMetadata): ManifestGenerationResult {
    try {
      const result: ManifestGenerationResult = {
        success: false,
        errors: [],
      };

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!metadata.modId) {
        result.errors?.push('Missing mod ID in metadata');
        return result;
      }

      // Generate consistent UUIDs based on mod ID
      const behaviorPackUuid = uuidv5(`${metadata.modId}.behavior`, UUID_NAMESPACE);
      const resourcePackUuid = uuidv5(`${metadata.modId}.resource`, UUID_NAMESPACE);
      const behaviorModuleUuid = uuidv5(`${metadata.modId}.behavior.module`, UUID_NAMESPACE);
      const resourceModuleUuid = uuidv5(`${metadata.modId}.resource.module`, UUID_NAMESPACE);

      // Parse version into components (e.g., "1.2.3" -> [1, 2, 3])
      const versionComponents = this.parseVersionString(metadata.modVersion);

      // Generate behavior pack manifest
      const behaviorPackManifest: BedrockManifest = {
        format_version: 2,
        header: {
          name: `${metadata.modName} Behavior`,
          description: metadata.description || `Converted from Java mod: ${metadata.modName}`,
          uuid: behaviorPackUuid,
          version: versionComponents,
          min_engine_version: [1, 19, 0], // Minimum supported Bedrock version
        },
        modules: [
          {
            type: 'data',
            uuid: behaviorModuleUuid,
            version: versionComponents,
            description: `Behavior module for ${metadata.modName}`,
          },
          {
            type: 'script',
            uuid: uuidv5(`${metadata.modId}.behavior.script`, UUID_NAMESPACE),
            version: versionComponents,
            description: `Script module for ${metadata.modName}`,
          },
        ],
        dependencies: [
          {
            uuid: resourcePackUuid,
            version: versionComponents,
          },
        ],
        metadata: {},
      };

      // Add optional metadata if available
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (metadata.authors && metadata.authors.length > 0) {
        behaviorPackManifest.metadata!.authors = metadata.authors;
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (metadata.website) {
        behaviorPackManifest.metadata!.url = metadata.website;
      }

      // Generate resource pack manifest
      const resourcePackManifest: BedrockManifest = {
        format_version: 2,
        header: {
          name: `${metadata.modName} Resources`,
          description: metadata.description || `Resources for ${metadata.modName}`,
          uuid: resourcePackUuid,
          version: versionComponents,
          min_engine_version: [1, 19, 0], // Minimum supported Bedrock version
        },
        modules: [
          {
            type: 'resources',
            uuid: resourceModuleUuid,
            version: versionComponents,
            description: `Resource module for ${metadata.modName}`,
          },
        ],
        metadata: behaviorPackManifest.metadata,
      };

      // Validate the generated manifests
      const behaviorValidation = this.validateManifest(behaviorPackManifest);
      const resourceValidation = this.validateManifest(resourcePackManifest);

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!behaviorValidation.valid) {
        result.errors?.push(...behaviorValidation.errors);
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!resourceValidation.valid) {
        result.errors?.push(...resourceValidation.errors);
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (result.errors && result.errors.length > 0) {
        return result;
      }

      // Set the result properties
      result.success = true;
      result.behaviorPackManifest = behaviorPackManifest;
      result.resourcePackManifest = resourcePackManifest;

      logger.info('Generated Bedrock manifests successfully', {
        behaviorUuid: behaviorPackUuid,
        resourceUuid: resourcePackUuid,
      });

      return result;
    } catch (error) {
      logger.error('Error generating manifests', { error });
      return {
        success: false,
        errors: [`Failed to generate manifests: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Writes the generated manifests to the specified output directories
   * @param result ManifestGenerationResult containing the manifests
   * @param behaviorPackDir Directory for the behavior pack
   * @param resourcePackDir Directory for the resource pack
   * @returns Promise<boolean> indicating success
   */
  async writeManifests(
    result: ManifestGenerationResult,
    behaviorPackDir: string,
    resourcePackDir: string
  ): Promise<boolean> {
    try {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!result.success || !result.behaviorPackManifest || !result.resourcePackManifest) {
        logger.error('Cannot write invalid manifests', { result });
        return false;
      }

      // Ensure directories exist
      await fs.promises.mkdir(behaviorPackDir, { recursive: true });
      await fs.promises.mkdir(resourcePackDir, { recursive: true });

      // Write behavior pack manifest
      await fs.promises.writeFile(
        path.join(behaviorPackDir, 'manifest.json'),
        JSON.stringify(result.behaviorPackManifest, null, 2)
      );

      // Write resource pack manifest
      await fs.promises.writeFile(
        path.join(resourcePackDir, 'manifest.json'),
        JSON.stringify(result.resourcePackManifest, null, 2)
      );

      logger.info('Manifests written successfully', { behaviorPackDir, resourcePackDir });
      return true;
    } catch (error) {
      logger.error('Error writing manifests', { error });
      return false;
    }
  }

  /**
   * Extracts metadata from mods.toml file (Forge)
   * @param filePath Path to the mods.toml file
   * @returns JavaModMetadata with extracted information
   */
  private async extractModTomlMetadata(filePath: string): Promise<Partial<JavaModMetadata>> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');

      // Simple TOML parsing for the specific fields we need
      const modIdMatch = content.match(/modId\s*=\s*["']([^"']+)["']/);
      const modNameMatch = content.match(/displayName\s*=\s*["']([^"']+)["']/);
      const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
      const descriptionMatch = content.match(/description\s*=\s*["']([^"']+)["']/);
      const authorsMatch = content.match(/authors\s*=\s*["']([^"']+)["']/);
      const websiteMatch = content.match(/displayURL\s*=\s*["']([^"']+)["']/);
      const logoFileMatch = content.match(/logoFile\s*=\s*["']([^"']+)["']/);

      return {
        modId: modIdMatch ? modIdMatch[1] : undefined,
        modName: modNameMatch ? modNameMatch[1] : undefined,
        modVersion: versionMatch ? versionMatch[1] : undefined,
        description: descriptionMatch ? descriptionMatch[1] : undefined,
        authors: authorsMatch ? authorsMatch[1].split(',').map((a) => a.trim()) : undefined,
        website: websiteMatch ? websiteMatch[1] : undefined,
        logoFile: logoFileMatch ? logoFileMatch[1] : undefined,
      };
    } catch (error) {
      logger.error('Error extracting metadata from mods.toml', { error });
      return {};
    }
  }

  /**
   * Extracts metadata from fabric.mod.json file (Fabric)
   * @param filePath Path to the fabric.mod.json file
   * @returns JavaModMetadata with extracted information
   */
  private async extractFabricModMetadata(filePath: string): Promise<Partial<JavaModMetadata>> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const fabricMod = JSON.parse(content);

      return {
        modId: fabricMod.id,
        modName: fabricMod.name,
        modVersion: fabricMod.version,
        description: fabricMod.description,
        authors: Array.isArray(fabricMod.authors)
          ? fabricMod.authors
          : fabricMod.authors
            ? [fabricMod.authors]
            : undefined,
        website: fabricMod.contact?.homepage || fabricMod.contact?.sources,
        logoFile: fabricMod.icon,
      };
    } catch (error) {
      logger.error('Error extracting metadata from fabric.mod.json', { error });
      return {};
    }
  }

  /**
   * Extracts metadata from mcmod.info file (older Forge)
   * @param filePath Path to the mcmod.info file
   * @returns JavaModMetadata with extracted information
   */
  private async extractModInfoMetadata(filePath: string): Promise<Partial<JavaModMetadata>> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const modInfo = JSON.parse(content);

      // mcmod.info can be an array or a direct object
      const modData = Array.isArray(modInfo) ? modInfo[0] : modInfo;

      return {
        modId: modData.modid,
        modName: modData.name,
        modVersion: modData.version,
        description: modData.description,
        authors: Array.isArray(modData.authorList)
          ? modData.authorList
          : modData.authorList
            ? [modData.authorList]
            : undefined,
        website: modData.url,
        logoFile: modData.logoFile,
      };
    } catch (error) {
      logger.error('Error extracting metadata from mcmod.info', { error });
      return {};
    }
  }

  /**
   * Attempts to infer a mod ID from the directory structure
   * @param modPath Path to the mod files
   * @returns Inferred mod ID or 'unknown'
   */
  private inferModIdFromPath(modPath: string): string {
    try {
      // Look for common package patterns in Java source files
      const srcDir = path.join(modPath, 'src', 'main', 'java');

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (fs.existsSync(srcDir)) {
        // This is a simplified approach - in a real implementation,
        // we would scan Java files for package declarations
        return path
          .basename(modPath)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
      }

      return 'unknown';
    } catch (error) {
      logger.error('Error inferring mod ID', { error });
      return 'unknown';
    }
  }

  /**
   * Parses a version string into components
   * @param version Version string (e.g., "1.2.3")
   * @returns Array of version components [1, 2, 3]
   */
  private parseVersionString(version: string): number[] {
    try {
      // Handle common version formats
      const components = version
        .split(/[.-]/)
        .map((part) => parseInt(part.replace(/[^0-9]/g, ''), 10))
        .filter((num) => !isNaN(num));

      // Ensure we have at least three components
      /**
       * while method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      while (components.length < 3) {
        components.push(0);
      }

      // Limit to three components for Bedrock compatibility
      return components.slice(0, 3);
    } catch (error) {
      logger.error('Error parsing version string', { error, version });
      return [1, 0, 0]; // Default version
    }
  }

  /**
   * Validates a Bedrock manifest against specifications
   * @param manifest BedrockManifest to validate
   * @returns Object with validation result and errors
   */
  private validateManifest(manifest: BedrockManifest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!manifest.format_version) {
      errors.push('Missing format_version');
    }

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!manifest.header) {
      errors.push('Missing header section');
    } else {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!manifest.header.name) {
        errors.push('Missing header.name');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!manifest.header.description) {
        errors.push('Missing header.description');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!manifest.header.uuid) {
        errors.push('Missing header.uuid');
      } else if (!this.isValidUuid(manifest.header.uuid)) {
        errors.push('Invalid header.uuid format');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!manifest.header.version || !Array.isArray(manifest.header.version)) {
        errors.push('Missing or invalid header.version');
      }

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (
        !manifest.header.min_engine_version ||
        !Array.isArray(manifest.header.min_engine_version)
      ) {
        errors.push('Missing or invalid header.min_engine_version');
      }
    }

    if (!manifest.modules || !Array.isArray(manifest.modules) || manifest.modules.length === 0) {
      errors.push('Missing or empty modules array');
    } else {
      manifest.modules.forEach((module, index) => {
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!module.type) {
          errors.push(`Missing type in module at index ${index}`);
        }

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!module.uuid) {
          errors.push(`Missing uuid in module at index ${index}`);
        } else if (!this.isValidUuid(module.uuid)) {
          errors.push(`Invalid uuid format in module at index ${index}`);
        }

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!module.version || !Array.isArray(module.version)) {
          errors.push(`Missing or invalid version in module at index ${index}`);
        }
      });
    }

    // Check dependencies if present
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (manifest.dependencies) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!Array.isArray(manifest.dependencies)) {
        errors.push('dependencies must be an array');
      } else {
        manifest.dependencies.forEach((dependency, index) => {
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (!dependency.uuid) {
            errors.push(`Missing uuid in dependency at index ${index}`);
          } else if (!this.isValidUuid(dependency.uuid)) {
            errors.push(`Invalid uuid format in dependency at index ${index}`);
          }

          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (!dependency.version || !Array.isArray(dependency.version)) {
            errors.push(`Missing or invalid version in dependency at index ${index}`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Checks if a string is a valid UUID
   * @param uuid String to check
   * @returns boolean indicating if it's a valid UUID
   */
  private isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Checks if a file exists
   * @param filePath Path to the file
   * @returns boolean indicating if the file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
