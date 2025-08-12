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
 * License types enum
 */
export enum LicenseType {
  MIT = 'MIT',
  APACHE_2 = 'Apache-2.0',
  GPL_3 = 'GPL-3.0',
  GPL_2 = 'GPL-2.0',
  LGPL_3 = 'LGPL-3.0',
  BSD_3_CLAUSE = 'BSD-3-Clause',
  MPL_2 = 'MPL-2.0',
  UNKNOWN = 'Unknown',
  NONE = 'None',
  AGPL_3 = 'AGPL-3.0',
}

/**
 * License terms interface
 */
export interface LicenseTerms {
  attribution: boolean;
  modification: boolean;
  distribution: boolean;
  privateUse: boolean;
  patentGrant: boolean;
}

/**
 * LicenseInfo interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface LicenseInfo {
  type: LicenseType;
  text: string;
  author?: string;
  year?: string;
  permissions: string[];
  limitations: string[];
  conditions: string[];
  restrictions?: string[];
  compatible: boolean;
  incompatibilityReason?: string;
  error?: string;
  terms?: LicenseTerms;
  additionalLicenses?: LicenseInfo[];
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
    'COPYING.LESSER',
  ];

  // Known license types with their characteristics
  private static readonly KNOWN_LICENSES: Record<
    string,
    {
      identifier: string;
      patterns: RegExp[];
      permissions: string[];
      limitations: string[];
      conditions: string[];
    }
  > = {
    MIT: {
      identifier: 'MIT',
      patterns: [
        /MIT License/i,
        /Permission is hereby granted, free of charge, to any person obtaining a copy of this software/i,
      ],
      permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'],
      limitations: ['Liability', 'Warranty'],
      conditions: ['License and copyright notice'],
    },
    'Apache-2.0': {
      identifier: 'Apache-2.0',
      patterns: [/Apache License, Version 2\.0/i, /www\.apache\.org\/licenses\/LICENSE-2\.0/i],
      permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'],
      limitations: ['Trademark use', 'Liability', 'Warranty'],
      conditions: ['License and copyright notice', 'State changes'],
    },
    'GPL-3.0': {
      identifier: 'GPL-3.0',
      patterns: [
        /GNU GENERAL PUBLIC LICENSE[\s\S]*Version 3/i,
        /GNU General Public License v3\.0/i,
        /www\.gnu\.org\/licenses\/gpl-3\.0/i,
      ],
      permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'],
      limitations: ['Liability', 'Warranty'],
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
        /GNU GENERAL PUBLIC LICENSE[\s\S]*Version 2/i,
        /GNU General Public License v2\.0/i,
        /www\.gnu\.org\/licenses\/gpl-2\.0/i,
      ],
      permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'],
      limitations: ['Liability', 'Warranty'],
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
        /GNU LESSER GENERAL PUBLIC LICENSE[\s\S]*Version 3/i,
        /GNU Lesser General Public License v3\.0/i,
        /www\.gnu\.org\/licenses\/lgpl-3\.0/i,
      ],
      permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'],
      limitations: ['Liability', 'Warranty'],
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
      permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'],
      limitations: ['Liability', 'Warranty'],
      conditions: ['License and copyright notice'],
    },
    'MPL-2.0': {
      identifier: 'MPL-2.0',
      patterns: [/Mozilla Public License Version 2\.0/i, /www\.mozilla\.org\/MPL\/2\.0/i],
      permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'],
      limitations: ['Liability', 'Trademark use', 'Warranty'],
      conditions: ['License and copyright notice', 'Disclose source', 'Same license (file)'],
    },
    'All Rights Reserved': {
      identifier: 'All Rights Reserved',
      patterns: [/All Rights Reserved/i, /Copyright .* All rights reserved/i],
      permissions: ['Private use'],
      limitations: ['Commercial use', 'Modification', 'Distribution', 'Patent use'],
      conditions: ['License and copyright notice'],
    },
    Custom: {
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
   * @returns LicenseInfo with license information
   */
  async parse(extractedModPath: string): Promise<LicenseInfo> {
    try {
      // Find license files
      const licenseFiles = await this.findLicenseFiles(extractedModPath);

      if (licenseFiles.length === 0) {
        return {
          type: LicenseType.NONE,
          text: '',
          permissions: [],
          limitations: [],
          conditions: [],
          compatible: false,
          error: 'No license file found',
        };
      }

      // Read the first license file found
      const licenseFilePath = licenseFiles[0];
      const fileName = path.basename(licenseFilePath);

      let licenseInfo: LicenseInfo;

      // Check if this is a descriptor file or a regular license file
      if (
        fileName === 'mods.toml' ||
        fileName === 'fabric.mod.json' ||
        fileName === 'mcmod.info' ||
        fileName === 'package.json'
      ) {
        // This is a descriptor file, extract license info from it
        const extractedLicenseInfo = await this.extractLicenseFromDescriptor(licenseFilePath);
        if (!extractedLicenseInfo) {
          return {
            type: LicenseType.UNKNOWN,
            text: '',
            permissions: [],
            limitations: [],
            conditions: [],
            compatible: false,
            error: 'Failed to extract license information from descriptor file',
          };
        }
        licenseInfo = extractedLicenseInfo;
      } else {
        // This is a regular license file
        const licenseText = await fs.readFile(licenseFilePath, 'utf-8');
        licenseInfo = this.identifyLicense(licenseText);
      }

      // Check if the license is compatible with conversion
      const compatibilityCheck = this.checkLicenseCompatibility(licenseInfo);

      return {
        ...licenseInfo,
        ...compatibilityCheck,
      };
    } catch (error) {
      logger.error('Error parsing license', { error });
      return {
        type: LicenseType.UNKNOWN,
        text: '',
        permissions: [],
        limitations: [],
        conditions: [],
        compatible: false,
        error: `License parsing error: ${(error as Error).message}`,
      };
    }
  }

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
        if (await this.fileExists(mcmodInfoPath)) {
          const licenseInfo = await this.extractLicenseFromDescriptor(mcmodInfoPath);
          if (licenseInfo) {
            // Create a virtual license file path for tracking
            result.push(mcmodInfoPath);
          }
        }

        // Check package.json
        const packageJsonPath = path.join(extractedModPath, 'package.json');
        if (await this.fileExists(packageJsonPath)) {
          const licenseInfo = await this.extractLicenseFromDescriptor(packageJsonPath);
          if (licenseInfo) {
            // Create a virtual license file path for tracking
            result.push(packageJsonPath);
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
    // Default to unknown license if no match is found
    let licenseType: LicenseType = LicenseType.UNKNOWN;
    let permissions: string[] = [];
    let limitations: string[] = [];
    let conditions: string[] = [];
    let restrictions: string[] = [];

    // Extract author and year from copyright notice
    const authorMatch = licenseText.match(/Copyright\s*\(c\)\s*(\d{4})\s+([^.\n]+)/i);
    const author = authorMatch ? authorMatch[2].trim() : undefined;
    const year = authorMatch ? authorMatch[1] : undefined;

    // Check against known license patterns
    for (const [, license] of Object.entries(LicenseParser.KNOWN_LICENSES)) {
      for (const pattern of license.patterns) {
        if (pattern.test(licenseText)) {
          // Map string identifiers to enum values
          switch (license.identifier) {
            case 'MIT':
              licenseType = LicenseType.MIT;
              break;
            case 'Apache-2.0':
              licenseType = LicenseType.APACHE_2;
              restrictions = ['patent-grant'];
              break;
            case 'GPL-3.0':
              licenseType = LicenseType.GPL_3;
              restrictions = ['source-available'];
              break;
            case 'GPL-2.0':
              licenseType = LicenseType.GPL_2;
              restrictions = ['source-available'];
              break;
            case 'LGPL-3.0':
              licenseType = LicenseType.LGPL_3;
              restrictions = ['library-copyleft'];
              break;
            case 'BSD-3-Clause':
              licenseType = LicenseType.BSD_3_CLAUSE;
              break;
            case 'MPL-2.0':
              licenseType = LicenseType.MPL_2;
              break;
            default:
              licenseType = LicenseType.UNKNOWN;
          }
          permissions = [...license.permissions];
          limitations = [...license.limitations];
          conditions = [...license.conditions];
          break;
        }
      }

      // If we found a match, stop checking
      if (licenseType !== LicenseType.UNKNOWN) {
        break;
      }
    }

    // If it's an unknown license, try to extract some basic information
    if (licenseType === LicenseType.UNKNOWN) {
      // Look for common permissions
      if (/modify|change|alter/i.test(licenseText)) {
        permissions.push('Modification');
      }
      if (/distribute|share|give/i.test(licenseText)) {
        permissions.push('Distribution');
      }
      if (/commercial|sell|profit/i.test(licenseText)) {
        if (
          /not|don't|cannot|prohibited/i.test(
            licenseText.substring(
              Math.max(0, licenseText.search(/commercial|sell|profit/i) - 20),
              licenseText.search(/commercial|sell|profit/i)
            )
          )
        ) {
          limitations.push('Commercial use');
        } else {
          permissions.push('Commercial use');
        }
      }

      // Look for common limitations
      if (/no warranty|as is|disclaimer of warranty/i.test(licenseText)) {
        limitations.push('Warranty');
      }
      if (/no liability|not liable|disclaimer of liability/i.test(licenseText)) {
        limitations.push('Liability');
      }

      // Look for common conditions
      if (/copyright notice|retain|include.*notice/i.test(licenseText)) {
        conditions.push('License and copyright notice');
      }
      if (/same license|same.*terms/i.test(licenseText)) {
        conditions.push('Same license');
      }
      if (/state changes|indicate changes|disclose changes/i.test(licenseText)) {
        conditions.push('State changes');
      }
    }

    // Generate license terms
    const terms: LicenseTerms = {
      attribution: conditions.includes('License and copyright notice'),
      modification: permissions.includes('Modification'),
      distribution: permissions.includes('Distribution'),
      privateUse: permissions.includes('Private use'),
      patentGrant: permissions.includes('Patent use') || licenseType === LicenseType.APACHE_2,
    };

    return {
      type: licenseType,
      text: licenseText,
      author,
      year,
      permissions,
      limitations,
      conditions,
      restrictions,
      compatible: true, // Default to compatible, will be checked separately
      terms,
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
  private checkLicenseCompatibility(licenseInfo: LicenseInfo): {
    compatible: boolean;
    incompatibilityReason?: string;
  } {
    // Licenses that are generally compatible with conversion
    const compatibleLicenses = [
      LicenseType.MIT,
      LicenseType.APACHE_2,
      LicenseType.BSD_3_CLAUSE,
      LicenseType.MPL_2,
    ];

    // Licenses that may require special handling but are still compatible
    const conditionalLicenses = [LicenseType.LGPL_3];

    // Licenses that are not compatible
    const incompatibleLicenses = [LicenseType.GPL_3, LicenseType.GPL_2, LicenseType.AGPL_3];

    // Check if the license is in the compatible list
    if (compatibleLicenses.includes(licenseInfo.type)) {
      return { compatible: true };
    }

    // Check if the license is in the conditional list
    if (conditionalLicenses.includes(licenseInfo.type)) {
      return {
        compatible: true,
        incompatibilityReason: `${licenseInfo.type} license requires that derivative works also use the same license. Ensure the converted addon includes the original license and source code availability.`,
      };
    }

    // Check if the license is incompatible
    if (incompatibleLicenses.includes(licenseInfo.type)) {
      return {
        compatible: false,
        incompatibilityReason: `${licenseInfo.type} license requires that derivative works also use the same license, which is not compatible with closed-source distribution.`,
      };
    }

    // Check if it's an unknown license
    if (licenseInfo.type === LicenseType.UNKNOWN) {
      // Check for restrictive terms in unknown licenses
      const hasDistributionPermission = licenseInfo.permissions.includes('Distribution');
      const hasModificationPermission = licenseInfo.permissions.includes('Modification');

      if (!hasDistributionPermission || !hasModificationPermission) {
        return {
          compatible: false,
          incompatibilityReason:
            'Unknown license does not explicitly permit distribution or modification, which are required for conversion.',
        };
      }

      return {
        compatible: false,
        incompatibilityReason:
          'Unknown license detected. Manual review recommended to ensure compliance with all terms.',
      };
    }

    // No license found
    if (licenseInfo.type === LicenseType.NONE) {
      return {
        compatible: false,
        incompatibilityReason: 'No license found. Cannot determine compatibility for conversion.',
      };
    }

    // Default case for unknown licenses
    return {
      compatible: false,
      incompatibilityReason: 'Unknown license type. Cannot determine compatibility for conversion.',
    };
  }

  /**
   * Checks if a license type is compatible
   * @param licenseType License type to check
   * @returns boolean indicating compatibility
   */
  isCompatible(licenseType: LicenseType): boolean {
    const compatibleLicenses = [
      LicenseType.MIT,
      LicenseType.APACHE_2,
      LicenseType.BSD_3_CLAUSE,
      LicenseType.MPL_2,
      LicenseType.LGPL_3,
    ];

    return compatibleLicenses.includes(licenseType);
  }

  /**
   * Generates attribution text for a license
   * @param licenseInfo License information
   * @param modName Name of the mod
   * @returns Attribution text
   */
  generateAttribution(licenseInfo: LicenseInfo, modName: string): string {
    const parts = [modName];

    if (licenseInfo.author) {
      parts.push(`by ${licenseInfo.author}`);
    }

    if (licenseInfo.year) {
      parts.push(`(${licenseInfo.year})`);
    }

    parts.push(`is licensed under ${licenseInfo.type}`);

    return parts.join(' ');
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
          reason: licenseInfo.incompatibilityReason,
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
${licenseInfo.permissions.map((p) => `- ${p}`).join('\n')}

Limitations:
${licenseInfo.limitations.map((l) => `- ${l}`).join('\n')}

Conditions:
${licenseInfo.conditions.map((c) => `- ${c}`).join('\n')}

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
        if (licenseMatch) {
          const licenseType = licenseMatch[1];
          return this.getLicenseInfoFromIdentifier(licenseType);
        }
      } else if (fileName === 'fabric.mod.json') {
        // Extract license from fabric.mod.json
        const fabricMod = JSON.parse(content);
        if (fabricMod.license) {
          return this.getLicenseInfoFromIdentifier(fabricMod.license);
        }
      } else if (fileName === 'mcmod.info') {
        // Extract license from mcmod.info
        const modInfo = JSON.parse(content);
        const modData = Array.isArray(modInfo) ? modInfo[0] : modInfo;

        if (modData.license) {
          return this.getLicenseInfoFromIdentifier(modData.license);
        }
      } else if (fileName === 'package.json') {
        // Extract license from package.json
        const packageData = JSON.parse(content);
        if (packageData.license) {
          return this.getLicenseInfoFromIdentifier(packageData.license);
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

    // Map common license identifiers to enum values
    const licenseMap: Record<string, LicenseType> = {
      mit: LicenseType.MIT,
      'apache-2.0': LicenseType.APACHE_2,
      'apache 2.0': LicenseType.APACHE_2,
      'gpl-3.0': LicenseType.GPL_3,
      'gpl-2.0': LicenseType.GPL_2,
      'lgpl-3.0': LicenseType.LGPL_3,
      'bsd-3-clause': LicenseType.BSD_3_CLAUSE,
      'mpl-2.0': LicenseType.MPL_2,
      'agpl-3.0': LicenseType.AGPL_3,
    };

    const normalizedIdentifier = cleanIdentifier.toLowerCase();
    const licenseType = licenseMap[normalizedIdentifier];

    // If we have a direct mapping, use it
    if (licenseType) {
      // Find the corresponding license in KNOWN_LICENSES
      for (const [, license] of Object.entries(LicenseParser.KNOWN_LICENSES)) {
        if (
          license.identifier === cleanIdentifier ||
          license.identifier.toLowerCase() === normalizedIdentifier
        ) {
          // Add restrictions based on license type
          let restrictions: string[] = [];
          if (licenseType === LicenseType.APACHE_2) {
            restrictions = ['patent-grant'];
          } else if (licenseType === LicenseType.GPL_3 || licenseType === LicenseType.GPL_2) {
            restrictions = ['source-available'];
          } else if (licenseType === LicenseType.LGPL_3) {
            restrictions = ['library-copyleft'];
          }

          return {
            type: licenseType,
            text: `This project is licensed under the ${license.identifier} license.`,
            permissions: [...license.permissions],
            limitations: [...license.limitations],
            conditions: [...license.conditions],
            restrictions,
            compatible: true, // Will be checked separately
          };
        }
      }

      // If not found in KNOWN_LICENSES but we have a mapping, create a basic response
      let restrictions: string[] = [];
      if (licenseType === LicenseType.APACHE_2) {
        restrictions = ['patent-grant'];
      } else if (licenseType === LicenseType.GPL_3 || licenseType === LicenseType.GPL_2) {
        restrictions = ['source-available'];
      } else if (licenseType === LicenseType.LGPL_3) {
        restrictions = ['library-copyleft'];
      }

      return {
        type: licenseType,
        text: `This project is licensed under the ${cleanIdentifier} license.`,
        permissions: [],
        limitations: [],
        conditions: [],
        restrictions,
        compatible: true, // Will be checked separately
      };
    }

    // Check if it's a known license by pattern matching
    for (const [, license] of Object.entries(LicenseParser.KNOWN_LICENSES)) {
      if (
        cleanIdentifier.toLowerCase() === license.identifier.toLowerCase() ||
        cleanIdentifier.toLowerCase().includes(license.identifier.toLowerCase())
      ) {
        // Map the identifier to the enum
        let mappedType = LicenseType.UNKNOWN;
        switch (license.identifier) {
          case 'MIT':
            mappedType = LicenseType.MIT;
            break;
          case 'Apache-2.0':
            mappedType = LicenseType.APACHE_2;
            break;
          case 'GPL-3.0':
            mappedType = LicenseType.GPL_3;
            break;
          case 'GPL-2.0':
            mappedType = LicenseType.GPL_2;
            break;
          case 'LGPL-3.0':
            mappedType = LicenseType.LGPL_3;
            break;
          case 'BSD-3-Clause':
            mappedType = LicenseType.BSD_3_CLAUSE;
            break;
          case 'MPL-2.0':
            mappedType = LicenseType.MPL_2;
            break;
        }

        return {
          type: mappedType,
          text: `This project is licensed under the ${license.identifier} license.`,
          permissions: [...license.permissions],
          limitations: [...license.limitations],
          conditions: [...license.conditions],
          compatible: true, // Will be checked separately
        };
      }
    }

    // If not a known license, return as unknown
    return {
      type: LicenseType.UNKNOWN,
      text: `This project is licensed under: ${cleanIdentifier}`,
      permissions: [],
      limitations: [],
      conditions: [],
      compatible: false, // Unknown licenses are not compatible by default
    };
  }
}
