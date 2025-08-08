import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for validation error
 */
interface ValidationError {
  type: 'structure' | 'manifest' | 'script' | 'resource' | 'definition';
  message: string;
  severity: 'warning' | 'error';
  path?: string;
  autoFixable: boolean;
}

/**
 * Interface for validation result
 */
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Interface for addon paths
 */
interface AddonPaths {
  behaviorPackPath: string;
  resourcePackPath: string;
}

/**
 * Interface for auto-fix result
 */
interface AutoFixResult {
  fixed: boolean;
  fixedErrors: ValidationError[];
  remainingErrors: ValidationError[];
}

/**
 * AddonValidator class responsible for validating Bedrock addons against specifications,
 * detecting errors, and automatically fixing common issues.
 *
 * This class handles:
 * 1. Validating addon structure against Bedrock specifications
 * 2. Detecting errors in manifests, scripts, and resources
 * 3. Automatically fixing common issues when possible
 */
export class AddonValidator {
  // Bedrock specification constants
  private readonly REQUIRED_MANIFEST_FIELDS = [
    'format_version',
    'header.name',
    'header.description',
    'header.uuid',
    'header.version',
    'header.min_engine_version',
    'modules',
  ];

  private readonly VALID_MODULE_TYPES = [
    'resources',
    'data',
    'client_data',
    'interface',
    'world_template',
    'script',
    'javascript',
  ];

  private readonly REQUIRED_DIRECTORIES = {
    behaviorPack: ['scripts'],
    resourcePack: ['textures'],
  };

  /**
   * Validates an addon against Bedrock specifications
   * @param addonPaths The paths to the behavior and resource packs
   * @returns A validation result with any errors found
   */
  public async validateAddon(addonPaths: AddonPaths): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Validate behavior pack
    const behaviorPackErrors = await this.validateBehaviorPack(addonPaths.behaviorPackPath);
    errors.push(...behaviorPackErrors);

    // Validate resource pack
    const resourcePackErrors = await this.validateResourcePack(addonPaths.resourcePackPath);
    errors.push(...resourcePackErrors);

    // Validate relationships between packs
    const relationshipErrors = await this.validatePackRelationships(addonPaths);
    errors.push(...relationshipErrors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Attempts to automatically fix common issues in an addon
   * @param addonPaths The paths to the behavior and resource packs
   * @param errors The validation errors to fix
   * @returns An auto-fix result with information about fixed and remaining errors
   */
  public async autoFixIssues(
    addonPaths: AddonPaths,
    errors: ValidationError[]
  ): Promise<AutoFixResult> {
    const fixedErrors: ValidationError[] = [];
    const remainingErrors: ValidationError[] = [];

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const error of errors) {
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (error.autoFixable) {
        const fixed = await this.fixError(addonPaths, error);
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (fixed) {
          fixedErrors.push(error);
        } else {
          remainingErrors.push(error);
        }
      } else {
        remainingErrors.push(error);
      }
    }

    return {
      fixed: fixedErrors.length > 0,
      fixedErrors,
      remainingErrors,
    };
  }

  /**
   * Validates a behavior pack
   * @param behaviorPackPath The path to the behavior pack
   * @returns An array of validation errors
   */
  private async validateBehaviorPack(behaviorPackPath: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check if behavior pack exists
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(behaviorPackPath)) {
      errors.push({
        type: 'structure',
        message: 'Behavior pack directory does not exist',
        severity: 'error',
        path: behaviorPackPath,
        autoFixable: false,
      });
      return errors;
    }

    // Validate manifest.json
    const manifestPath = path.join(behaviorPackPath, 'manifest.json');
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(manifestPath)) {
      errors.push({
        type: 'manifest',
        message: 'manifest.json is missing in behavior pack',
        severity: 'error',
        path: manifestPath,
        autoFixable: false,
      });
    } else {
      try {
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);

        // Validate required fields
        const manifestErrors = this.validateManifest(manifest, 'behavior');
        errors.push(
          ...manifestErrors.map((err) => ({
            ...err,
            path: manifestPath,
          }))
        );
      } catch (error) {
        errors.push({
          type: 'manifest',
          message: `Failed to parse manifest.json: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
          path: manifestPath,
          autoFixable: false,
        });
      }
    }

    // Validate required directories
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const dir of this.REQUIRED_DIRECTORIES.behaviorPack) {
      const dirPath = path.join(behaviorPackPath, dir);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!fs.existsSync(dirPath)) {
        errors.push({
          type: 'structure',
          message: `Required directory '${dir}' is missing in behavior pack`,
          severity: 'warning',
          path: dirPath,
          autoFixable: true,
        });
      }
    }

    // Validate scripts
    const scriptsDir = path.join(behaviorPackPath, 'scripts');
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (fs.existsSync(scriptsDir)) {
      const scriptErrors = await this.validateScripts(scriptsDir);
      errors.push(...scriptErrors);
    }

    // Validate block definitions
    const blocksDir = path.join(behaviorPackPath, 'blocks');
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (fs.existsSync(blocksDir)) {
      const blockErrors = await this.validateBlockDefinitions(blocksDir);
      errors.push(...blockErrors);
    }

    // Validate item definitions
    const itemsDir = path.join(behaviorPackPath, 'items');
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (fs.existsSync(itemsDir)) {
      const itemErrors = await this.validateItemDefinitions(itemsDir);
      errors.push(...itemErrors);
    }

    return errors;
  }

  /**
   * Validates a resource pack
   * @param resourcePackPath The path to the resource pack
   * @returns An array of validation errors
   */
  private async validateResourcePack(resourcePackPath: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check if resource pack exists
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(resourcePackPath)) {
      errors.push({
        type: 'structure',
        message: 'Resource pack directory does not exist',
        severity: 'error',
        path: resourcePackPath,
        autoFixable: false,
      });
      return errors;
    }

    // Validate manifest.json
    const manifestPath = path.join(resourcePackPath, 'manifest.json');
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(manifestPath)) {
      errors.push({
        type: 'manifest',
        message: 'manifest.json is missing in resource pack',
        severity: 'error',
        path: manifestPath,
        autoFixable: false,
      });
    } else {
      try {
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);

        // Validate required fields
        const manifestErrors = this.validateManifest(manifest, 'resource');
        errors.push(
          ...manifestErrors.map((err) => ({
            ...err,
            path: manifestPath,
          }))
        );
      } catch (error) {
        errors.push({
          type: 'manifest',
          message: `Failed to parse manifest.json: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
          path: manifestPath,
          autoFixable: false,
        });
      }
    }

    // Validate required directories
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const dir of this.REQUIRED_DIRECTORIES.resourcePack) {
      const dirPath = path.join(resourcePackPath, dir);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!fs.existsSync(dirPath)) {
        errors.push({
          type: 'structure',
          message: `Required directory '${dir}' is missing in resource pack`,
          severity: 'warning',
          path: dirPath,
          autoFixable: true,
        });
      }
    }

    // Validate textures
    const texturesDir = path.join(resourcePackPath, 'textures');
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (fs.existsSync(texturesDir)) {
      const textureErrors = await this.validateTextures(texturesDir);
      errors.push(...textureErrors);
    }

    // Validate models
    const modelsDir = path.join(resourcePackPath, 'models');
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (fs.existsSync(modelsDir)) {
      const modelErrors = await this.validateModels(modelsDir);
      errors.push(...modelErrors);
    }

    return errors;
  }

  /**
   * Validates the relationships between behavior and resource packs
   * @param addonPaths The paths to the behavior and resource packs
   * @returns An array of validation errors
   */
  private async validatePackRelationships(addonPaths: AddonPaths): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check if both packs exist
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
      !fs.existsSync(addonPaths.behaviorPackPath) ||
      !fs.existsSync(addonPaths.resourcePackPath)
    ) {
      return errors; // Skip relationship validation if either pack doesn't exist
    }

    // Read manifests
    const behaviorManifestPath = path.join(addonPaths.behaviorPackPath, 'manifest.json');
    const resourceManifestPath = path.join(addonPaths.resourcePackPath, 'manifest.json');

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(behaviorManifestPath) || !fs.existsSync(resourceManifestPath)) {
      return errors; // Skip relationship validation if either manifest doesn't exist
    }

    try {
      const behaviorManifest = JSON.parse(fs.readFileSync(behaviorManifestPath, 'utf8'));
      const resourceManifest = JSON.parse(fs.readFileSync(resourceManifestPath, 'utf8'));

      // Check if behavior pack has dependency on resource pack
      const hasDependency = behaviorManifest.dependencies?.some(
        (dep: any) => dep.uuid === resourceManifest.header?.uuid
      );

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!hasDependency && behaviorManifest.dependencies) {
        errors.push({
          type: 'manifest',
          message: 'Behavior pack should have a dependency on the resource pack',
          severity: 'warning',
          path: behaviorManifestPath,
          autoFixable: true,
        });
      }

      // Check if pack versions match
      const behaviorVersion = behaviorManifest.header?.version;
      const resourceVersion = resourceManifest.header?.version;

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (behaviorVersion && resourceVersion) {
        const behaviorVersionStr = behaviorVersion.join('.');
        const resourceVersionStr = resourceVersion.join('.');

        if (behaviorVersionStr !== resourceVersionStr) {
          errors.push({
            type: 'manifest',
            message: `Behavior pack version (${behaviorVersionStr}) does not match resource pack version (${resourceVersionStr})`,
            severity: 'warning',
            path: behaviorManifestPath,
            autoFixable: true,
          });
        }
      }
    } catch (error) {
      // Error already reported in validateBehaviorPack and validateResourcePack
    }

    return errors;
  }

  /**
   * Validates a manifest object
   * @param manifest The manifest object to validate
   * @param packType The type of pack ('behavior' or 'resource')
   * @returns An array of validation errors
   */
  private validateManifest(manifest: any, packType: 'behavior' | 'resource'): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check required fields
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const field of this.REQUIRED_MANIFEST_FIELDS) {
      const fieldParts = field.split('.');
      let value = manifest;

      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const part of fieldParts) {
        value = value?.[part];
        if (value === undefined) {
          errors.push({
            type: 'manifest',
            message: `Required field '${field}' is missing in ${packType} pack manifest`,
            severity: 'error',
            autoFixable: false,
          });
          break;
        }
      }
    }

    // Check format version
    if (manifest.format_version && typeof manifest.format_version !== 'number') {
      errors.push({
        type: 'manifest',
        message: `format_version should be a number in ${packType} pack manifest`,
        severity: 'warning',
        autoFixable: true,
      });
    }

    // Check UUID format
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (manifest.header?.uuid) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!uuidRegex.test(manifest.header.uuid)) {
        errors.push({
          type: 'manifest',
          message: `Invalid UUID format in ${packType} pack manifest`,
          severity: 'error',
          autoFixable: false,
        });
      }
    }

    // Check version format
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (manifest.header?.version) {
      if (!Array.isArray(manifest.header.version) || manifest.header.version.length !== 3) {
        errors.push({
          type: 'manifest',
          message: `Version should be an array of 3 numbers in ${packType} pack manifest`,
          severity: 'warning',
          autoFixable: true,
        });
      } else {
        /**
         * for method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const v of manifest.header.version) {
          if (typeof v !== 'number') {
            errors.push({
              type: 'manifest',
              message: `Version array should contain only numbers in ${packType} pack manifest`,
              severity: 'warning',
              autoFixable: true,
            });
            break;
          }
        }
      }
    }

    // Check module types
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (manifest.modules) {
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const module of manifest.modules) {
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!this.VALID_MODULE_TYPES.includes(module.type)) {
          errors.push({
            type: 'manifest',
            message: `Invalid module type '${module.type}' in ${packType} pack manifest`,
            severity: 'error',
            autoFixable: false,
          });
        }

        // Check module UUID format
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (module.uuid) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (!uuidRegex.test(module.uuid)) {
            errors.push({
              type: 'manifest',
              message: `Invalid module UUID format in ${packType} pack manifest`,
              severity: 'error',
              autoFixable: false,
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validates JavaScript scripts in the scripts directory
   * @param scriptsDir The path to the scripts directory
   * @returns An array of validation errors
   */
  private async validateScripts(scriptsDir: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check if scripts directory is empty
    const files = this.getFilesRecursively(scriptsDir, '.js');
    if (files.length === 0) {
      errors.push({
        type: 'script',
        message: 'Scripts directory is empty',
        severity: 'warning',
        path: scriptsDir,
        autoFixable: false,
      });
      return errors;
    }

    // Validate each script file
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        // Check for common script errors
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (content.includes('import ') || content.includes('export ')) {
          errors.push({
            type: 'script',
            message: `Script file '${path.relative(scriptsDir, file)}' contains ES6 import/export statements which are not supported in Bedrock`,
            severity: 'error',
            path: file,
            autoFixable: false,
          });
        }

        // Check for empty scripts
        if (content.trim() === '') {
          errors.push({
            type: 'script',
            message: `Script file '${path.relative(scriptsDir, file)}' is empty`,
            severity: 'warning',
            path: file,
            autoFixable: true,
          });
        }

        // Check for missing semicolons (simple check)
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
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
            line &&
            !line.endsWith(';') &&
            !line.endsWith('{') &&
            !line.endsWith('}') &&
            !line.endsWith(':') &&
            !line.startsWith('//') &&
            !line.startsWith('/*') &&
            !line.endsWith('*/') &&
            !line.startsWith('import') &&
            !line.startsWith('export')
          ) {
            errors.push({
              type: 'script',
              message: `Script file '${path.relative(scriptsDir, file)}' may be missing semicolons on line ${i + 1}`,
              severity: 'warning',
              path: file,
              autoFixable: false,
            });
          }
        }
      } catch (error) {
        errors.push({
          type: 'script',
          message: `Failed to read script file '${path.relative(scriptsDir, file)}': ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
          path: file,
          autoFixable: false,
        });
      }
    }

    return errors;
  }

  /**
   * Validates block definitions in the blocks directory
   * @param blocksDir The path to the blocks directory
   * @returns An array of validation errors
   */
  private async validateBlockDefinitions(blocksDir: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Get all JSON files in the blocks directory
    const files = this.getFilesRecursively(blocksDir, '.json');

    // Validate each block definition file
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const blockDef = JSON.parse(content);

        // Check for required fields in block definitions
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!blockDef.format_version) {
          errors.push({
            type: 'definition',
            message: `Block definition '${path.relative(blocksDir, file)}' is missing 'format_version'`,
            severity: 'error',
            path: file,
            autoFixable: true,
          });
        }

        // Check for description field
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!blockDef.description) {
          errors.push({
            type: 'definition',
            message: `Block definition '${path.relative(blocksDir, file)}' is missing 'description'`,
            severity: 'warning',
            path: file,
            autoFixable: true,
          });
        }
      } catch (error) {
        errors.push({
          type: 'definition',
          message: `Failed to parse block definition '${path.relative(blocksDir, file)}': ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
          path: file,
          autoFixable: false,
        });
      }
    }

    return errors;
  }

  /**
   * Validates item definitions in the items directory
   * @param itemsDir The path to the items directory
   * @returns An array of validation errors
   */
  private async validateItemDefinitions(itemsDir: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Get all JSON files in the items directory
    const files = this.getFilesRecursively(itemsDir, '.json');

    // Validate each item definition file
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const itemDef = JSON.parse(content);

        // Check for required fields in item definitions
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!itemDef.format_version) {
          errors.push({
            type: 'definition',
            message: `Item definition '${path.relative(itemsDir, file)}' is missing 'format_version'`,
            severity: 'error',
            path: file,
            autoFixable: true,
          });
        }

        // Check for description field
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!itemDef.description) {
          errors.push({
            type: 'definition',
            message: `Item definition '${path.relative(itemsDir, file)}' is missing 'description'`,
            severity: 'warning',
            path: file,
            autoFixable: true,
          });
        }
      } catch (error) {
        errors.push({
          type: 'definition',
          message: `Failed to parse item definition '${path.relative(itemsDir, file)}': ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
          path: file,
          autoFixable: false,
        });
      }
    }

    return errors;
  }

  /**
   * Validates textures in the textures directory
   * @param texturesDir The path to the textures directory
   * @returns An array of validation errors
   */
  private async validateTextures(texturesDir: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check if textures directory is empty
    const files = this.getFilesRecursively(texturesDir, '.png');
    if (files.length === 0) {
      errors.push({
        type: 'resource',
        message: 'Textures directory is empty',
        severity: 'warning',
        path: texturesDir,
        autoFixable: false,
      });
    }

    // Check for terrain_texture.json
    const terrainTexturePath = path.join(texturesDir, 'terrain_texture.json');
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(terrainTexturePath)) {
      errors.push({
        type: 'resource',
        message: 'terrain_texture.json is missing',
        severity: 'warning',
        path: terrainTexturePath,
        autoFixable: true,
      });
    } else {
      try {
        const content = fs.readFileSync(terrainTexturePath, 'utf8');
        JSON.parse(content); // Just check if it's valid JSON
      } catch (error) {
        errors.push({
          type: 'resource',
          message: `Failed to parse terrain_texture.json: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
          path: terrainTexturePath,
          autoFixable: false,
        });
      }
    }

    // Check for item_texture.json
    const itemTexturePath = path.join(texturesDir, 'item_texture.json');
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(itemTexturePath)) {
      errors.push({
        type: 'resource',
        message: 'item_texture.json is missing',
        severity: 'warning',
        path: itemTexturePath,
        autoFixable: true,
      });
    } else {
      try {
        const content = fs.readFileSync(itemTexturePath, 'utf8');
        JSON.parse(content); // Just check if it's valid JSON
      } catch (error) {
        errors.push({
          type: 'resource',
          message: `Failed to parse item_texture.json: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
          path: itemTexturePath,
          autoFixable: false,
        });
      }
    }

    return errors;
  }

  /**
   * Validates models in the models directory
   * @param modelsDir The path to the models directory
   * @returns An array of validation errors
   */
  private async validateModels(modelsDir: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Get all JSON files in the models directory
    const files = this.getFilesRecursively(modelsDir, '.json');

    // Validate each model file
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const model = JSON.parse(content);

        // Check for format_version in geometry files
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (file.includes('geometry') && !model.format_version) {
          errors.push({
            type: 'resource',
            message: `Model file '${path.relative(modelsDir, file)}' is missing 'format_version'`,
            severity: 'error',
            path: file,
            autoFixable: true,
          });
        }
      } catch (error) {
        errors.push({
          type: 'resource',
          message: `Failed to parse model file '${path.relative(modelsDir, file)}': ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
          path: file,
          autoFixable: false,
        });
      }
    }

    return errors;
  }

  /**
   * Attempts to fix a validation error
   * @param addonPaths The paths to the behavior and resource packs
   * @param error The validation error to fix
   * @returns A boolean indicating whether the error was fixed
   */
  private async fixError(addonPaths: AddonPaths, error: ValidationError): Promise<boolean> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!error.path) {
      return false;
    }

    /**
     * switch method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    switch (error.type) {
      case 'structure':
        return this.fixStructureError(error);

      case 'manifest':
        return this.fixManifestError(addonPaths, error);

      case 'script':
        return this.fixScriptError(error);

      case 'resource':
        return this.fixResourceError(error);

      case 'definition':
        return this.fixDefinitionError(error);

      default:
        return false;
    }
  }

  /**
   * Fixes a structure error
   * @param error The structure error to fix
   * @returns A boolean indicating whether the error was fixed
   */
  private async fixStructureError(error: ValidationError): Promise<boolean> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!error.path) {
      return false;
    }

    // Create missing directories
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes('directory') && error.message.includes('missing')) {
      try {
        fs.mkdirSync(error.path, { recursive: true });
        return true;
      } catch (err) {
        return false;
      }
    }

    return false;
  }

  /**
   * Fixes a manifest error
   * @param addonPaths The paths to the behavior and resource packs
   * @param error The manifest error to fix
   * @returns A boolean indicating whether the error was fixed
   */
  private async fixManifestError(addonPaths: AddonPaths, error: ValidationError): Promise<boolean> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!error.path) {
      return false;
    }

    // Fix dependency between behavior and resource packs
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes('dependency on the resource pack')) {
      try {
        const behaviorManifestPath = path.join(addonPaths.behaviorPackPath, 'manifest.json');
        const resourceManifestPath = path.join(addonPaths.resourcePackPath, 'manifest.json');

        const behaviorManifest = JSON.parse(fs.readFileSync(behaviorManifestPath, 'utf8'));
        const resourceManifest = JSON.parse(fs.readFileSync(resourceManifestPath, 'utf8'));

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!behaviorManifest.dependencies) {
          behaviorManifest.dependencies = [];
        }

        behaviorManifest.dependencies.push({
          uuid: resourceManifest.header.uuid,
          version: resourceManifest.header.version,
        });

        fs.writeFileSync(behaviorManifestPath, JSON.stringify(behaviorManifest, null, 2));
        return true;
      } catch (err) {
        return false;
      }
    }

    // Fix version mismatch between behavior and resource packs
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes('version') && error.message.includes('does not match')) {
      try {
        const behaviorManifestPath = path.join(addonPaths.behaviorPackPath, 'manifest.json');
        const resourceManifestPath = path.join(addonPaths.resourcePackPath, 'manifest.json');

        const behaviorManifest = JSON.parse(fs.readFileSync(behaviorManifestPath, 'utf8'));
        const resourceManifest = JSON.parse(fs.readFileSync(resourceManifestPath, 'utf8'));

        // Use behavior pack version for both
        resourceManifest.header.version = [...behaviorManifest.header.version];

        fs.writeFileSync(resourceManifestPath, JSON.stringify(resourceManifest, null, 2));
        return true;
      } catch (err) {
        return false;
      }
    }

    // Fix format_version type
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes('format_version should be a number')) {
      try {
        const manifest = JSON.parse(fs.readFileSync(error.path, 'utf8'));

        if (typeof manifest.format_version === 'string') {
          manifest.format_version = parseFloat(manifest.format_version) || 2;
        } else {
          manifest.format_version = 2; // Default to version 2
        }

        fs.writeFileSync(error.path, JSON.stringify(manifest, null, 2));
        return true;
      } catch (err) {
        return false;
      }
    }

    // Fix version array format
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes('Version should be an array')) {
      try {
        const manifest = JSON.parse(fs.readFileSync(error.path, 'utf8'));

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!Array.isArray(manifest.header.version)) {
          manifest.header.version = [1, 0, 0]; // Default version
        } else if (manifest.header.version.length !== 3) {
          // Pad or truncate to 3 elements
          const version = [...manifest.header.version];
          /**
           * while method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          while (version.length < 3) version.push(0);
          manifest.header.version = version.slice(0, 3);
        }

        fs.writeFileSync(error.path, JSON.stringify(manifest, null, 2));
        return true;
      } catch (err) {
        return false;
      }
    }

    // Fix version array element types
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes('Version array should contain only numbers')) {
      try {
        const manifest = JSON.parse(fs.readFileSync(error.path, 'utf8'));

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (Array.isArray(manifest.header.version)) {
          manifest.header.version = manifest.header.version.map((v) => {
            const num = parseInt(v);
            return isNaN(num) ? 0 : num;
          });
        }

        fs.writeFileSync(error.path, JSON.stringify(manifest, null, 2));
        return true;
      } catch (err) {
        return false;
      }
    }

    return false;
  }

  /**
   * Fixes a script error
   * @param error The script error to fix
   * @returns A boolean indicating whether the error was fixed
   */
  private async fixScriptError(error: ValidationError): Promise<boolean> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!error.path) {
      return false;
    }

    // Fix empty script files
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes('is empty')) {
      try {
        const defaultScript =
          '// This file was auto-generated by the AddonValidator\n' +
          '// Add your code here\n\n' +
          'console.log("Hello from Minecraft!");\n';

        fs.writeFileSync(error.path, defaultScript);
        return true;
      } catch (err) {
        return false;
      }
    }

    return false;
  }

  /**
   * Fixes a resource error
   * @param error The resource error to fix
   * @returns A boolean indicating whether the error was fixed
   */
  private async fixResourceError(error: ValidationError): Promise<boolean> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!error.path) {
      return false;
    }

    // Create missing terrain_texture.json
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes('terrain_texture.json is missing')) {
      try {
        const defaultTerrainTexture = {
          resource_pack_name: 'vanilla',
          texture_name: 'atlas.terrain',
          texture_data: {},
        };

        fs.writeFileSync(error.path, JSON.stringify(defaultTerrainTexture, null, 2));
        return true;
      } catch (err) {
        return false;
      }
    }

    // Create missing item_texture.json
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes('item_texture.json is missing')) {
      try {
        const defaultItemTexture = {
          resource_pack_name: 'vanilla',
          texture_name: 'atlas.items',
          texture_data: {},
        };

        fs.writeFileSync(error.path, JSON.stringify(defaultItemTexture, null, 2));
        return true;
      } catch (err) {
        return false;
      }
    }

    // Fix missing format_version in model files
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (error.message.includes("missing 'format_version'")) {
      try {
        const model = JSON.parse(fs.readFileSync(error.path, 'utf8'));

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!model.format_version) {
          model.format_version = '1.16.0';
          fs.writeFileSync(error.path, JSON.stringify(model, null, 2));
          return true;
        }
      } catch (err) {
        return false;
      }
    }

    return false;
  }

  /**
   * Fixes a definition error
   * @param error The definition error to fix
   * @returns A boolean indicating whether the error was fixed
   */
  private async fixDefinitionError(error: ValidationError): Promise<boolean> {
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!error.path) {
      return false;
    }

    try {
      const definition = JSON.parse(fs.readFileSync(error.path, 'utf8'));
      let modified = false;

      // Fix missing format_version
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (error.message.includes("missing 'format_version'")) {
        definition.format_version = '1.16.0';
        modified = true;
      }

      // Fix missing description
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (error.message.includes("missing 'description'")) {
        const fileName = path.basename(error.path, '.json');
        definition.description = `Auto-generated description for ${fileName}`;
        modified = true;
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
      if (modified) {
        fs.writeFileSync(error.path, JSON.stringify(definition, null, 2));
        return true;
      }
    } catch (err) {
      return false;
    }

    return false;
  }

  /**
   * Gets all files recursively in a directory with a specific extension
   * @param directory The directory to search in
   * @param extension The file extension to filter by
   * @returns An array of file paths
   */
  private getFilesRecursively(directory: string, extension: string): string[] {
    const files: string[] = [];

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!fs.existsSync(directory)) {
      return files;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (entry.isDirectory()) {
        files.push(...this.getFilesRecursively(fullPath, extension));
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(fullPath);
      }
    }

    return files;
  }
}
