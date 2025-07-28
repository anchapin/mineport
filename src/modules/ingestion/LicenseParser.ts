/**
 * LicenseParser Component
 * 
 * This component is responsible for parsing and validating license files in Minecraft mods.
 * It identifies common open-source licenses, extracts their terms, and enforces compliance
 * during the conversion process.
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
  compatible: boolean;
  incompatibilityReason?: string;
}

/**
 * LicenseParseResult interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface LicenseParseResult {
  found: boolean;
  licenseInfo?: LicenseInfo;
  errors?: string[];
}

/**
 * LicenseParser class.
 * 
 * TODO: Add detailed description of the class purpose and functionality.
 * 
 * @since 1.0.0
 */
export class LicenseParser {
  // Common license file names to look for
  private static readonly LICENSE_FILE_PATTERNS = [
    'LICENSE',
    'LICENSE.txt',
    'LICENSE.md',
    'license',
    'license.txt',
    'license.md',
    'COPYING',
    'COPYING.txt',
    'COPYING.md',
  ];

  // Known license types with their characteristics
  private static readonly KNOWN_LICENSES: Record<string, {
    identifier: string;
    patterns: RegExp[];
    permissions: string[];
    limitations: string[];
    conditions: string[];
  }> = {
    'MIT': {
      identifier: 'MIT',
      patterns: [
        /MIT License/i,
        /Permission is hereby granted, free of charge, to any person obtaining a copy of this software/i,
      ],
      permissions: [
        'Commercial use',
        'Modification',
        'Distribution',
        'Private use',
      ],
      limitations: [
        'Liability',
        'Warranty',
      ],
      conditions: [
        'License and copyright notice',
      ],
    },
    'Apache-2.0': {
      identifier: 'Apache-2.0',
      patterns: [
        /Apache License, Version 2\.0/i,
        /www\.apache\.org\/licenses\/LICENSE-2\.0/i,
      ],
      permissions: [
        'Commercial use',
        'Modification',
        'Distribution',
        'Patent use',
        'Private use',
      ],
      limitations: [
        'Trademark use',
        'Liability',
        'Warranty',
      ],
      conditions: [
        'License and copyright notice',
        'State changes',
      ],
    },
    'GPL-3.0': {
      identifier: 'GPL-3.0',
      patterns: [
        /GNU General Public License v3\.0/i,
        /www\.gnu\.org\/licenses\/gpl-3\.0/i,
      ],
      permissions: [
        'Commercial use',
        'Modification',
        'Distribution',
        'Patent use',
        'Private use',
      ],
      limitations: [
        'Liability',
        'Warranty',
      ],
      conditions: [
        'License and copyright notice',
        'State changes',
        'Disclose source',
        'Same license',
      ],
    },
    'GPL-2.0': {
      identifier: 'GPL-2.0',
      patterns: [
        /GNU General Public License v2\.0/i,
        /www\.gnu\.org\/licenses\/gpl-2\.0/i,
      ],
      permissions: [
        'Commercial use',
        'Modification',
        'Distribution',
        'Private use',
      ],
      limitations: [
        'Liability',
        'Warranty',
      ],
      conditions: [
        'License and copyright notice',
        'State changes',
        'Disclose source',
        'Same license',
      ],
    },
    'LGPL-3.0': {
      identifier: 'LGPL-3.0',
      patterns: [
        /GNU Lesser General Public License v3\.0/i,
        /www\.gnu\.org\/licenses\/lgpl-3\.0/i,
      ],
      permissions: [
        'Commercial use',
        'Modification',
        'Distribution',
        'Patent use',
        'Private use',
      ],
      limitations: [
        'Liability',
        'Warranty',
      ],
      conditions: [
        'License and copyright notice',
        'State changes',
        'Disclose source',
        'Library usage',
      ],
    },
    'BSD-3-Clause': {
      identifier: 'BSD-3-Clause',
      patterns: [
        /BSD 3-Clause License/i,
        /Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met/i,
      ],
      permissions: [
        'Commercial use',
        'Modification',
        'Distribution',
        'Private use',
      ],
      limitations: [
        'Liability',
        'Warranty',
      ],
      conditions: [
        'License and copyright notice',
      ],
    },
    'MPL-2.0': {
      identifier: 'MPL-2.0',
      patterns: [
        /Mozilla Public License Version 2\.0/i,
        /www\.mozilla\.org\/MPL\/2\.0/i,
      ],
      permissions: [
        'Commercial use',
        'Modification',
        'Distribution',
        'Patent use',
        'Private use',
      ],
      limitations: [
        'Liability',
        'Trademark use',
        'Warranty',
      ],
      conditions: [
        'License and copyright notice',
        'Disclose source',
        'Same license (file)',
      ],
    },
    'All Rights Reserved': {
      identifier: 'All Rights Reserved',
      patterns: [
        /All Rights Reserved/i,
        /Copyright .* All rights reserved/i,
      ],
      permissions: [
        'Private use',
      ],
      limitations: [
        'Commercial use',
        'Modification',
        'Distribution',
        'Patent use',
      ],
      conditions: [
        'License and copyright notice',
      ],
    },
    'Custom': {
      identifier: 'Custom',
      patterns: [],
      permissions: [],
      limitations: [],
      conditions: [],
    },
  };

  /**
   * Parses license files in the extracted mod directory
   * @param extractedModPath Path to the extracted mod files
   * @returns LicenseParseResult with license information
   */
  async parseLicense(extractedModPath: string): Promise<LicenseParseResult> {
    const result: LicenseParseResult = {
      found: false,
      errors: [],
    };

    try {
      // Find license files
      const licenseFiles = await this.findLicenseFiles(extractedModPath);

      if (licenseFiles.length === 0) {
        result.errors?.push('No license file found');
        return result;
      }

      // Read the first license file found
      const licenseFilePath = licenseFiles[0];
      const fileName = path.basename(licenseFilePath);
      
      let licenseInfo: LicenseInfo;
      
      // Check if this is a descriptor file or a regular license file
      if (fileName === 'mods.toml' || fileName === 'fabric.mod.json' || fileName === 'mcmod.info') {
        // This is a descriptor file, extract license info from it
        const extractedLicenseInfo = await this.extractLicenseFromDescriptor(licenseFilePath);
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!extractedLicenseInfo) {
          result.errors?.push('Failed to extract license information from descriptor file');
          return result;
        }
        licenseInfo = extractedLicenseInfo;
      } else {
        // This is a regular license file
        const licenseText = await fs.readFile(licenseFilePath, 'utf-8');
        licenseInfo = this.identifyLicense(licenseText);
      }

      // Check if the license is compatible with conversion
      const compatibilityCheck = this.checkLicenseCompatibility(licenseInfo);

      result.found = true;
      result.licenseInfo = {
        ...licenseInfo,
        ...compatibilityCheck,
      };

      return result;
    } catch (error) {
      logger.error('Error parsing license', { error });
      result.errors?.push(`License parsing error: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Finds license files in the extracted mod directory
   * @param extractedModPath Path to the extracted mod files
   * @returns Array of paths to license files
   */
  private async findLicenseFiles(extractedModPath: string): Promise<string[]> {
    const result: string[] = [];

    try {
      // Check for license files in the root directory
      /**
       * for method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const pattern of LicenseParser.LICENSE_FILE_PATTERNS) {
        const filePath = path.join(extractedModPath, pattern);
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (await this.fileExists(filePath)) {
          result.push(filePath);
        }
      }

      // If no license files found in root, check META-INF directory
      if (result.length === 0) {
        const metaInfPath = path.join(extractedModPath, 'META-INF');
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (await this.fileExists(metaInfPath)) {
          /**
           * for method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          for (const pattern of LicenseParser.LICENSE_FILE_PATTERNS) {
            const filePath = path.join(metaInfPath, pattern);
            /**
             * if method.
             * 
             * TODO: Add detailed description of the method's purpose and behavior.
             * 
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            if (await this.fileExists(filePath)) {
              result.push(filePath);
            }
          }
        }
      }

      // If still no license files found, look for license information in mod descriptor files
      if (result.length === 0) {
        // Check mods.toml
        const modsTomlPath = path.join(extractedModPath, 'META-INF', 'mods.toml');
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (await this.fileExists(modsTomlPath)) {
          const licenseInfo = await this.extractLicenseFromDescriptor(modsTomlPath);
          /**
           * if method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (licenseInfo) {
            // Create a virtual license file path for tracking
            result.push(modsTomlPath);
          }
        }

        // Check fabric.mod.json
        const fabricModJsonPath = path.join(extractedModPath, 'fabric.mod.json');
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (await this.fileExists(fabricModJsonPath)) {
          const licenseInfo = await this.extractLicenseFromDescriptor(fabricModJsonPath);
          /**
           * if method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (licenseInfo) {
            // Create a virtual license file path for tracking
            result.push(fabricModJsonPath);
          }
        }

        // Check mcmod.info
        const mcmodInfoPath = path.join(extractedModPath, 'mcmod.info');
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (await this.fileExists(mcmodInfoPath)) {
          const licenseInfo = await this.extractLicenseFromDescriptor(mcmodInfoPath);
          /**
           * if method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (licenseInfo) {
            // Create a virtual license file path for tracking
            result.push(mcmodInfoPath);
          }
        }
      }

      return result;
    } catch (error) {
      logger.error('Error finding license files', { error });
      return [];
    }
  }

  /**
   * Identifies the license type from license text
   * @param licenseText Text content of the license file
   * @returns LicenseInfo object with identified license details
   */
  private identifyLicense(licenseText: string): LicenseInfo {
    // Default to custom license if no match is found
    let licenseType = 'Custom';
    let permissions: string[] = [];
    let limitations: string[] = [];
    let conditions: string[] = [];

    // Check against known license patterns
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [type, license] of Object.entries(LicenseParser.KNOWN_LICENSES)) {
      /**
       * for method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const pattern of license.patterns) {
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (pattern.test(licenseText)) {
          licenseType = license.identifier;
          permissions = [...license.permissions];
          limitations = [...license.limitations];
          conditions = [...license.conditions];
          break;
        }
      }
      
      // If we found a match, stop checking
      if (licenseType !== 'Custom') {
        break;
      }
    }

    // If it's a custom license, try to extract some basic information
    if (licenseType === 'Custom') {
      // Look for common permissions
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (/modify|change|alter/i.test(licenseText)) {
        permissions.push('Modification');
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
      if (/distribute|share|give/i.test(licenseText)) {
        permissions.push('Distribution');
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
      if (/commercial|sell|profit/i.test(licenseText)) {
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (/not|don't|cannot|prohibited/i.test(licenseText.substring(Math.max(0, licenseText.search(/commercial|sell|profit/i) - 20), licenseText.search(/commercial|sell|profit/i)))) {
          limitations.push('Commercial use');
        } else {
          permissions.push('Commercial use');
        }
      }
      
      // Look for common limitations
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (/no warranty|as is|disclaimer of warranty/i.test(licenseText)) {
        limitations.push('Warranty');
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
      if (/no liability|not liable|disclaimer of liability/i.test(licenseText)) {
        limitations.push('Liability');
      }
      
      // Look for common conditions
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (/copyright notice|retain|include.*notice/i.test(licenseText)) {
        conditions.push('License and copyright notice');
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
      if (/same license|same.*terms/i.test(licenseText)) {
        conditions.push('Same license');
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
      if (/state changes|indicate changes|disclose changes/i.test(licenseText)) {
        conditions.push('State changes');
      }
    }

    return {
      type: licenseType,
      text: licenseText,
      permissions,
      limitations,
      conditions,
      compatible: true, // Default to compatible, will be checked separately
    };
  }

  /**
   * Checks if a file exists
   * @param filePath Path to the file
   * @returns boolean indicating if the file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if the license is compatible with conversion to Bedrock
   * @param licenseInfo License information
   * @returns Object with compatibility status and reason
   */
  private checkLicenseCompatibility(licenseInfo: LicenseInfo): { compatible: boolean; incompatibilityReason?: string } {
    // Licenses that are generally compatible with conversion
    const compatibleLicenses = [
      'MIT',
      'Apache-2.0',
      'BSD-3-Clause',
      'MPL-2.0',
    ];

    // Licenses that may require special handling
    const conditionalLicenses = [
      'GPL-3.0',
      'GPL-2.0',
      'LGPL-3.0',
    ];

    // Check if the license is in the compatible list
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (compatibleLicenses.includes(licenseInfo.type)) {
      return { compatible: true };
    }

    // Check if the license is in the conditional list
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (conditionalLicenses.includes(licenseInfo.type)) {
      return { 
        compatible: true,
        incompatibilityReason: `${licenseInfo.type} license requires that derivative works also use the same license. Ensure the converted addon includes the original license and source code availability.`
      };
    }

    // Check if it's a custom license
    if (licenseInfo.type === 'Custom') {
      // Check for restrictive terms in custom licenses
      const hasDistributionPermission = licenseInfo.permissions.includes('Distribution');
      const hasModificationPermission = licenseInfo.permissions.includes('Modification');
      
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!hasDistributionPermission || !hasModificationPermission) {
        return {
          compatible: false,
          incompatibilityReason: 'Custom license does not explicitly permit distribution or modification, which are required for conversion.'
        };
      }
      
      return {
        compatible: true,
        incompatibilityReason: 'Custom license detected. Manual review recommended to ensure compliance with all terms.'
      };
    }

    // All Rights Reserved or other restrictive licenses
    if (licenseInfo.type === 'All Rights Reserved') {
      return {
        compatible: false,
        incompatibilityReason: 'All Rights Reserved license does not permit modification or distribution, which are required for conversion.'
      };
    }

    // Default case for unknown licenses
    return {
      compatible: false,
      incompatibilityReason: 'Unknown license type. Cannot determine compatibility for conversion.'
    };
  }

  /**
   * Enforces license compliance during conversion
   * @param licenseInfo License information
   * @param outputPath Path where the converted addon will be saved
   * @returns boolean indicating if license compliance was enforced successfully
   */
  async enforceLicenseCompliance(licenseInfo: LicenseInfo, outputPath: string): Promise<boolean> {
    try {
      // If the license is not compatible, we should not proceed with conversion
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!licenseInfo.compatible) {
        logger.error('License is not compatible with conversion', { 
          licenseType: licenseInfo.type,
          reason: licenseInfo.incompatibilityReason
        });
        return false;
      }

      // Create a LICENSE file in the output directory
      const licensePath = path.join(outputPath, 'LICENSE');
      await fs.writeFile(licensePath, licenseInfo.text);

      // Create a NOTICE file with attribution information
      const noticePath = path.join(outputPath, 'NOTICE');
      const noticeContent = this.generateNoticeFile(licenseInfo);
      await fs.writeFile(noticePath, noticeContent);

      // For GPL and similar licenses, ensure source code availability notice
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (['GPL-3.0', 'GPL-2.0', 'LGPL-3.0'].includes(licenseInfo.type)) {
        const readmePath = path.join(outputPath, 'README.md');
        const readmeContent = await this.generateReadmeWithSourceNotice(licenseInfo);
        await fs.writeFile(readmePath, readmeContent);
      }

      logger.info('License compliance enforced successfully', { licenseType: licenseInfo.type });
      return true;
    } catch (error) {
      logger.error('Error enforcing license compliance', { error });
      return false;
    }
  }

  /**
   * Generates a NOTICE file with attribution information
   * @param licenseInfo License information
   * @returns Content for the NOTICE file
   */
  private generateNoticeFile(licenseInfo: LicenseInfo): string {
    const currentDate = new Date().getFullYear();
    
    return `NOTICE
======

This Minecraft Bedrock Edition addon was converted from a Java Edition mod.
The original mod is licensed under the ${licenseInfo.type} license.

License Type: ${licenseInfo.type}

Permissions:
${licenseInfo.permissions.map(p => `- ${p}`).join('\n')}

Limitations:
${licenseInfo.limitations.map(l => `- ${l}`).join('\n')}

Conditions:
${licenseInfo.conditions.map(c => `- ${c}`).join('\n')}

This conversion was performed using the Minecraft Mod Converter.
/**
 * Copyright method.
 * 
 * TODO: Add detailed description of the method's purpose and behavior.
 * 
 * @param param - TODO: Document parameters
 * @returns result - TODO: Document return value
 * @since 1.0.0
 */
Copyright (c) ${currentDate} Minecraft Mod Converter Contributors.

The original license text is included in the LICENSE file.
`;
  }

  /**
   * Generates a README file with source code availability notice
   * @param licenseInfo License information
   * @returns Content for the README file
   */
  private async generateReadmeWithSourceNotice(licenseInfo: LicenseInfo): Promise<string> {
    return `# Converted Minecraft Addon

This Minecraft Bedrock Edition addon was converted from a Java Edition mod.
The original mod is licensed under the ${licenseInfo.type} license.

## Source Code Availability

In compliance with the ${licenseInfo.type} license, the source code for this addon
is available at [INSERT SOURCE CODE REPOSITORY URL].

## License

This addon is subject to the same license as the original mod. See the LICENSE file
for the complete license text.

## Modifications

This addon is a converted version of the original Java Edition mod, adapted to work
with Minecraft Bedrock Edition. The conversion process may have introduced changes
to accommodate the differences between Java and Bedrock platforms.
`;
  }

  /**
   * Extracts license information from mod descriptor files if no dedicated license file is found
   * @param filePath Path to the mod descriptor file
   * @returns LicenseInfo object with extracted license details
   */
  async extractLicenseFromDescriptor(filePath: string): Promise<LicenseInfo | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      
      if (fileName === 'mods.toml') {
        // Extract license from mods.toml
        const licenseMatch = content.match(/license\s*=\s*["']([^"']+)["']/);
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (licenseMatch) {
          const licenseType = licenseMatch[1];
          return this.getLicenseInfoFromIdentifier(licenseType);
        }
      } else if (fileName === 'fabric.mod.json') {
        // Extract license from fabric.mod.json
        const fabricMod = JSON.parse(content);
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (fabricMod.license) {
          return this.getLicenseInfoFromIdentifier(fabricMod.license);
        }
      } else if (fileName === 'mcmod.info') {
        // Extract license from mcmod.info
        const modInfo = JSON.parse(content);
        const modData = Array.isArray(modInfo) ? modInfo[0] : modInfo;
        
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (modData.license) {
          return this.getLicenseInfoFromIdentifier(modData.license);
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting license from descriptor', { error });
      return null;
    }
  }

  /**
   * Gets license information from a license identifier
   * @param identifier License identifier (e.g., "MIT", "Apache-2.0")
   * @returns LicenseInfo object for the identified license
   */
  private getLicenseInfoFromIdentifier(identifier: string): LicenseInfo {
    // Clean up the identifier
    const cleanIdentifier = identifier.trim();
    
    // Check if it's a known license
    /**
     * for method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [type, license] of Object.entries(LicenseParser.KNOWN_LICENSES)) {
      if (cleanIdentifier.toLowerCase() === license.identifier.toLowerCase() ||
          cleanIdentifier.toLowerCase().includes(license.identifier.toLowerCase())) {
        return {
          type: license.identifier,
          text: `This project is licensed under the ${license.identifier} license.`,
          permissions: [...license.permissions],
          limitations: [...license.limitations],
          conditions: [...license.conditions],
          compatible: true, // Will be checked separately
        };
      }
    }
    
    // If not a known license, return as custom
    return {
      type: 'Custom',
      text: `This project is licensed under: ${cleanIdentifier}`,
      permissions: [],
      limitations: [],
      conditions: [],
      compatible: true, // Will be checked separately
    };
  }
}