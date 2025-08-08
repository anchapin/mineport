/**
 * LicenseEmbedder Component
 *
 * This component is responsible for embedding original license information in output files.
 * It implements logic to embed the original license in output files, creates attribution
 * information generators, and adds validation for license inclusion.
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger.js';

/**
 * LicenseInfo interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface LicenseInfo {
  type: string;
  text: string;
  permissions: string[];
  limitations: string[];
  conditions: string[];
  sourceFile?: string;
}

/**
 * AttributionInfo interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface AttributionInfo {
  modName: string;
  modVersion: string;
  modAuthor: string;
  licenseType: string;
  licenseUrl?: string;
}

/**
 * LicenseEmbedResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface LicenseEmbedResult {
  success: boolean;
  embeddedFiles: string[];
  errors?: string[];
  conversionNotes: LicenseEmbeddingNote[];
}

/**
 * LicenseEmbeddingNote interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface LicenseEmbeddingNote {
  type: 'info' | 'warning' | 'error';
  component: 'license';
  message: string;
  details?: string;
  file?: string;
}

/**
 * LicenseEmbedder class.
 *
 * TODO: Add detailed description of the class purpose and functionality.
 *
 * @since 1.0.0
 */
export class LicenseEmbedder {
  /**
   * Embeds license information in output files
   * @param licenseInfo License information to embed
   * @param attributionInfo Attribution information for the mod
   * @param outputDir Directory containing output files
   * @returns Promise<LicenseEmbedResult> Result of the embedding process
   */
  async embedLicense(
    licenseInfo: LicenseInfo,
    attributionInfo: AttributionInfo,
    outputDir: string
  ): Promise<LicenseEmbedResult> {
    try {
      const embeddedFiles: string[] = [];
      const conversionNotes: LicenseEmbeddingNote[] = [];
      const errors: string[] = [];

      // Create LICENSE.txt file in the output directory
      await this.createLicenseFile(licenseInfo, attributionInfo, outputDir);
      embeddedFiles.push(path.join(outputDir, 'LICENSE.txt'));

      // Create attribution.json file with structured license data
      await this.createAttributionFile(licenseInfo, attributionInfo, outputDir);
      embeddedFiles.push(path.join(outputDir, 'attribution.json'));

      // Embed license headers in JavaScript files
      const jsFiles = await this.findJavaScriptFiles(outputDir);

      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const file of jsFiles) {
        try {
          await this.embedLicenseHeader(file, licenseInfo, attributionInfo);
          embeddedFiles.push(file);
        } catch (error) {
          const errorMessage = `Failed to embed license in ${file}: ${(error as Error).message}`;
          errors.push(errorMessage);

          conversionNotes.push({
            type: 'error',
            component: 'license',
            message: errorMessage,
            file,
          });
        }
      }

      // Embed license information in manifest files
      const manifestFiles = await this.findManifestFiles(outputDir);

      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const file of manifestFiles) {
        try {
          await this.embedLicenseInManifest(file, licenseInfo, attributionInfo);
          embeddedFiles.push(file);
        } catch (error) {
          const errorMessage = `Failed to embed license in manifest ${file}: ${(error as Error).message}`;
          errors.push(errorMessage);

          conversionNotes.push({
            type: 'error',
            component: 'license',
            message: errorMessage,
            file,
          });
        }
      }

      // Add success notes
      conversionNotes.push({
        type: 'info',
        component: 'license',
        message: `Successfully embedded license information in ${embeddedFiles.length} files`,
        details: `License type: ${licenseInfo.type}`,
      });

      return {
        success: errors.length === 0,
        embeddedFiles,
        errors: errors.length > 0 ? errors : undefined,
        conversionNotes,
      };
    } catch (error) {
      logger.error('Error embedding license information', { error });
      return {
        success: false,
        embeddedFiles: [],
        errors: [`Failed to embed license information: ${(error as Error).message}`],
        conversionNotes: [
          {
            type: 'error',
            component: 'license',
            message: `Failed to embed license information: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  /**
   * Validates that license information is properly embedded in output files
   * @param outputDir Directory containing output files
   * @param licenseInfo License information to validate against
   * @returns Object with validation result and errors
   */
  async validateLicenseInclusion(
    outputDir: string,
    licenseInfo: LicenseInfo
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check for LICENSE.txt file
      const licensePath = path.join(outputDir, 'LICENSE.txt');
      try {
        await fs.access(licensePath);
      } catch {
        errors.push('LICENSE.txt file is missing from the output directory');
      }

      // Check for attribution.json file
      const attributionPath = path.join(outputDir, 'attribution.json');
      try {
        await fs.access(attributionPath);

        // Validate the content of attribution.json
        const attributionContent = await fs.readFile(attributionPath, 'utf-8');
        const attribution = JSON.parse(attributionContent);

        if (!attribution.licenseType || attribution.licenseType !== licenseInfo.type) {
          errors.push('attribution.json has incorrect license type');
        }
      } catch {
        errors.push('attribution.json file is missing or invalid');
      }

      // Check JavaScript files for license headers
      const jsFiles = await this.findJavaScriptFiles(outputDir);

      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const file of jsFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');

          // Check if the file has a license header
          /**
           * if method.
           *
           * TODO: Add detailed description of the method's purpose and behavior.
           *
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (!content.includes('License:') || !content.includes(licenseInfo.type)) {
            errors.push(`JavaScript file ${file} is missing proper license header`);
          }
        } catch (error) {
          errors.push(`Failed to check license header in ${file}: ${(error as Error).message}`);
        }
      }

      // Check manifest files for license information
      const manifestFiles = await this.findManifestFiles(outputDir);

      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const file of manifestFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const manifest = JSON.parse(content);

          // Check if the manifest has license information
          if (
            !manifest.metadata ||
            !manifest.metadata.license ||
            manifest.metadata.license !== licenseInfo.type
          ) {
            errors.push(`Manifest file ${file} is missing proper license information`);
          }
        } catch (error) {
          errors.push(
            `Failed to check license information in ${file}: ${(error as Error).message}`
          );
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      logger.error('Error validating license inclusion', { error });
      return {
        valid: false,
        errors: [`Failed to validate license inclusion: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Creates a LICENSE.txt file in the output directory
   * @param licenseInfo License information
   * @param attributionInfo Attribution information
   * @param outputDir Output directory
   * @returns Promise<void>
   */
  private async createLicenseFile(
    licenseInfo: LicenseInfo,
    attributionInfo: AttributionInfo,
    outputDir: string
  ): Promise<void> {
    try {
      // Create the license content
      const licenseContent = this.formatLicenseContent(licenseInfo, attributionInfo);

      // Write the license file
      await fs.writeFile(path.join(outputDir, 'LICENSE.txt'), licenseContent);

      logger.info('Created LICENSE.txt file');
    } catch (error) {
      logger.error('Error creating LICENSE.txt file', { error });
      throw new Error(`Failed to create LICENSE.txt file: ${(error as Error).message}`);
    }
  }

  /**
   * Creates an attribution.json file in the output directory
   * @param licenseInfo License information
   * @param attributionInfo Attribution information
   * @param outputDir Output directory
   * @returns Promise<void>
   */
  private async createAttributionFile(
    licenseInfo: LicenseInfo,
    attributionInfo: AttributionInfo,
    outputDir: string
  ): Promise<void> {
    try {
      // Create the attribution content
      const attributionContent = {
        modName: attributionInfo.modName,
        modVersion: attributionInfo.modVersion,
        modAuthor: attributionInfo.modAuthor,
        licenseType: licenseInfo.type,
        licenseUrl: attributionInfo.licenseUrl,
        permissions: licenseInfo.permissions,
        limitations: licenseInfo.limitations,
        conditions: licenseInfo.conditions,
        conversionDate: new Date().toISOString(),
      };

      // Write the attribution file
      await fs.writeFile(
        path.join(outputDir, 'attribution.json'),
        JSON.stringify(attributionContent, null, 2)
      );

      logger.info('Created attribution.json file');
    } catch (error) {
      logger.error('Error creating attribution.json file', { error });
      throw new Error(`Failed to create attribution.json file: ${(error as Error).message}`);
    }
  }

  /**
   * Embeds a license header in a JavaScript file
   * @param filePath Path to the JavaScript file
   * @param licenseInfo License information
   * @param attributionInfo Attribution information
   * @returns Promise<void>
   */
  private async embedLicenseHeader(
    filePath: string,
    licenseInfo: LicenseInfo,
    attributionInfo: AttributionInfo
  ): Promise<void> {
    try {
      // Read the file content
      const content = await fs.readFile(filePath, 'utf-8');

      // Create the license header
      const licenseHeader = this.createJavaScriptLicenseHeader(licenseInfo, attributionInfo);

      // Check if the file already has a license header
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (content.includes('License:') && content.includes(licenseInfo.type)) {
        logger.info(`File ${filePath} already has a license header`);
        return;
      }

      // Add the license header to the file content
      const updatedContent = `${licenseHeader}\n\n${content}`;

      // Write the updated content back to the file
      await fs.writeFile(filePath, updatedContent);

      logger.info(`Added license header to ${filePath}`);
    } catch (error) {
      logger.error(`Error embedding license header in ${filePath}`, { error });
      throw new Error(`Failed to embed license header in ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Embeds license information in a manifest file
   * @param filePath Path to the manifest file
   * @param licenseInfo License information
   * @param attributionInfo Attribution information
   * @returns Promise<void>
   */
  private async embedLicenseInManifest(
    filePath: string,
    licenseInfo: LicenseInfo,
    attributionInfo: AttributionInfo
  ): Promise<void> {
    try {
      // Read the manifest file
      const content = await fs.readFile(filePath, 'utf-8');
      const manifest = JSON.parse(content);

      // Add license information to the manifest
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!manifest.metadata) {
        manifest.metadata = {};
      }

      manifest.metadata.license = licenseInfo.type;
      manifest.metadata.attribution = `${attributionInfo.modName} by ${attributionInfo.modAuthor}`;
      manifest.metadata.sourceVersion = attributionInfo.modVersion;

      // Write the updated manifest back to the file
      await fs.writeFile(filePath, JSON.stringify(manifest, null, 2));

      logger.info(`Added license information to manifest ${filePath}`);
    } catch (error) {
      logger.error(`Error embedding license in manifest ${filePath}`, { error });
      throw new Error(
        `Failed to embed license in manifest ${filePath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Formats the license content for the LICENSE.txt file
   * @param licenseInfo License information
   * @param attributionInfo Attribution information
   * @returns Formatted license content
   */
  private formatLicenseContent(licenseInfo: LicenseInfo, attributionInfo: AttributionInfo): string {
    const content = [
      `${attributionInfo.modName} v${attributionInfo.modVersion}`,
      `By ${attributionInfo.modAuthor}`,
      '',
      `License: ${licenseInfo.type}`,
      '',
      licenseInfo.text,
      '',
      '---',
      '',
      'This addon was created using the Minecraft Mod Converter.',
      'The original mod code and assets are subject to the license terms above.',
      `Conversion date: ${new Date().toISOString().split('T')[0]}`,
    ];

    return content.join('\n');
  }

  /**
   * Creates a JavaScript license header
   * @param licenseInfo License information
   * @param attributionInfo Attribution information
   * @returns Formatted license header
   */
  private createJavaScriptLicenseHeader(
    licenseInfo: LicenseInfo,
    attributionInfo: AttributionInfo
  ): string {
    const header = [
      '/**',
      ` * ${attributionInfo.modName} v${attributionInfo.modVersion}`,
      ` * By ${attributionInfo.modAuthor}`,
      ` *`,
      ` * License: ${licenseInfo.type}`,
      ` * This file is part of a Bedrock addon converted from the original Java mod.`,
      ` * The original code and assets are subject to the original license terms.`,
      ` * Conversion date: ${new Date().toISOString().split('T')[0]}`,
      ' */',
    ];

    return header.join('\n');
  }

  /**
   * Finds all JavaScript files in a directory recursively
   * @param dir Directory to search
   * @returns Promise<string[]> Array of JavaScript file paths
   */
  private async findJavaScriptFiles(dir: string): Promise<string[]> {
    const jsFiles: string[] = [];

    async function scanDir(currentDir: string) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

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
          const fullPath = path.join(currentDir, entry.name);

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
            await scanDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
            jsFiles.push(fullPath);
          }
        }
      } catch (error) {
        logger.error(`Error scanning directory for JavaScript files: ${currentDir}`, { error });
      }
    }

    await scanDir(dir);
    return jsFiles;
  }

  /**
   * Finds all manifest files in a directory recursively
   * @param dir Directory to search
   * @returns Promise<string[]> Array of manifest file paths
   */
  private async findManifestFiles(dir: string): Promise<string[]> {
    const manifestFiles: string[] = [];

    async function scanDir(currentDir: string) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

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
          const fullPath = path.join(currentDir, entry.name);

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
            await scanDir(fullPath);
          } else if (entry.isFile() && entry.name === 'manifest.json') {
            manifestFiles.push(fullPath);
          }
        }
      } catch (error) {
        logger.error(`Error scanning directory for manifest files: ${currentDir}`, { error });
      }
    }

    await scanDir(dir);
    return manifestFiles;
  }
}
