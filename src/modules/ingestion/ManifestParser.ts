/**
 * Manifest Parser Component
 *
 * This component provides parsing capabilities for various mod manifest formats
 * including MANIFEST.MF, mcmod.info, and mods.toml files.
 */

import logger from '../../utils/logger.js';

/**
 * Parsed manifest information
 */
export interface ParsedManifest {
  modId: string;
  modName: string;
  version: string;
  description?: string;
  author?: string;
  dependencies: ManifestDependency[];
  metadata: Record<string, any>;
}

/**
 * Dependency information from manifest
 */
export interface ManifestDependency {
  modId: string;
  version: string;
  required: boolean;
  type?: 'required' | 'optional' | 'incompatible';
}

/**
 * Manifest parsing result
 */
export interface ManifestParseResult {
  success: boolean;
  manifest?: ParsedManifest;
  error?: string;
  warnings: string[];
}

/**
 * ManifestParser class supporting multiple manifest formats
 */
export class ManifestParser {
  /**
   * Parses a MANIFEST.MF file
   * @param content Content of the MANIFEST.MF file
   * @returns ManifestParseResult containing parsed information
   */
  parseManifestMF(content: string): ManifestParseResult {
    const warnings: string[] = [];

    try {
      const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const attributes: Record<string, string> = {};

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          attributes[key] = value;
        }
      }

      // Extract mod information from manifest attributes
      const modId =
        attributes['Implementation-Title'] ||
        attributes['Specification-Title'] ||
        attributes['Bundle-SymbolicName'] ||
        'unknown';

      const modName =
        attributes['Implementation-Title'] || attributes['Specification-Title'] || modId;

      const version =
        attributes['Implementation-Version'] ||
        attributes['Specification-Version'] ||
        attributes['Bundle-Version'] ||
        '1.0.0';

      const author =
        attributes['Implementation-Vendor'] ||
        attributes['Specification-Vendor'] ||
        attributes['Bundle-Vendor'];

      if (!attributes['Implementation-Title'] && !attributes['Specification-Title']) {
        warnings.push('No standard mod identification found in MANIFEST.MF');
      }

      return {
        success: true,
        manifest: {
          modId: this.sanitizeModId(modId),
          modName,
          version,
          author,
          dependencies: [], // MANIFEST.MF typically doesn't contain dependency info
          metadata: attributes,
        },
        warnings,
      };
    } catch (error) {
      logger.error('Error parsing MANIFEST.MF', { error });
      return {
        success: false,
        error: `Failed to parse MANIFEST.MF: ${(error as Error).message}`,
        warnings,
      };
    }
  }

  /**
   * Parses a mcmod.info file (older Forge format)
   * @param content Content of the mcmod.info file
   * @returns ManifestParseResult containing parsed information
   */
  parseMcmodInfo(content: string): ManifestParseResult {
    const warnings: string[] = [];

    try {
      const modInfo = JSON.parse(content);
      const modData = Array.isArray(modInfo) ? modInfo[0] : modInfo;

      if (!modData) {
        return {
          success: false,
          error: 'Empty or invalid mcmod.info structure',
          warnings,
        };
      }

      // Parse dependencies
      const dependencies: ManifestDependency[] = [];
      if (modData.dependencies && Array.isArray(modData.dependencies)) {
        for (const dep of modData.dependencies) {
          if (typeof dep === 'string') {
            dependencies.push({
              modId: dep,
              version: '*',
              required: true,
              type: 'required',
            });
          } else if (typeof dep === 'object' && dep.modId) {
            dependencies.push({
              modId: dep.modId,
              version: dep.version || '*',
              required: dep.required !== false,
              type: dep.type || 'required',
            });
          }
        }
      }

      // Handle required dependencies
      if (modData.requiredMods && Array.isArray(modData.requiredMods)) {
        for (const reqMod of modData.requiredMods) {
          dependencies.push({
            modId: reqMod,
            version: '*',
            required: true,
            type: 'required',
          });
        }
      }

      if (!modData.modid) {
        warnings.push('Missing modid in mcmod.info');
      }

      return {
        success: true,
        manifest: {
          modId: this.sanitizeModId(modData.modid || 'unknown'),
          modName: modData.name || 'Unknown Mod',
          version: modData.version || '1.0.0',
          description: modData.description,
          author: Array.isArray(modData.authorList)
            ? modData.authorList.join(', ')
            : modData.authorList || modData.author,
          dependencies,
          metadata: modData,
        },
        warnings,
      };
    } catch (error) {
      logger.error('Error parsing mcmod.info', { error });
      return {
        success: false,
        error: `Failed to parse mcmod.info: ${(error as Error).message}`,
        warnings,
      };
    }
  }

  /**
   * Parses a mods.toml file (modern Forge format)
   * @param content Content of the mods.toml file
   * @returns ManifestParseResult containing parsed information
   */
  parseModsToml(content: string): ManifestParseResult {
    const warnings: string[] = [];

    try {
      // Simple TOML parsing for the specific fields we need
      const modIdMatch = content.match(/modId\s*=\s*["']([^"']+)["']/);
      const modNameMatch = content.match(/displayName\s*=\s*["']([^"']+)["']/);
      const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
      const descriptionMatch = content.match(/description\s*=\s*["']([^"']+)["']/);
      const authorMatch = content.match(/authors\s*=\s*["']([^"']+)["']/);
      const logoFileMatch = content.match(/logoFile\s*=\s*["']([^"']+)["']/);
      const creditsMatch = content.match(/credits\s*=\s*["']([^"']+)["']/);

      // Parse dependencies
      const dependencies: ManifestDependency[] = [];

      // Find all dependency sections
      const dependencyPattern = /\[\[dependencies\.([^\]]+)\]\]([\s\S]*?)(?=\[\[|$)/g;
      let depMatch;

      while ((depMatch = dependencyPattern.exec(content)) !== null) {
        const modId = depMatch[1];
        const depSection = depMatch[2];

        const depModIdMatch = depSection.match(/modId\s*=\s*["']([^"']+)["']/);
        const mandatoryMatch = depSection.match(/mandatory\s*=\s*(true|false)/);
        const versionRangeMatch = depSection.match(/versionRange\s*=\s*["']([^"']+)["']/);
        const orderingMatch = depSection.match(/ordering\s*=\s*["']([^"']+)["']/);
        const sideMatch = depSection.match(/side\s*=\s*["']([^"']+)["']/);

        dependencies.push({
          modId: depModIdMatch ? depModIdMatch[1] : modId,
          version: versionRangeMatch ? versionRangeMatch[1] : '*',
          required: mandatoryMatch ? mandatoryMatch[1] === 'true' : true,
          type: mandatoryMatch && mandatoryMatch[1] === 'false' ? 'optional' : 'required',
        });
      }

      if (!modIdMatch) {
        warnings.push('Missing modId in mods.toml');
      }

      // Extract additional metadata
      const metadata: Record<string, any> = {
        logoFile: logoFileMatch ? logoFileMatch[1] : undefined,
        credits: creditsMatch ? creditsMatch[1] : undefined,
      };

      return {
        success: true,
        manifest: {
          modId: this.sanitizeModId(modIdMatch ? modIdMatch[1] : 'unknown'),
          modName: modNameMatch ? modNameMatch[1] : 'Unknown Mod',
          version: versionMatch ? versionMatch[1] : '1.0.0',
          description: descriptionMatch ? descriptionMatch[1] : undefined,
          author: authorMatch ? authorMatch[1] : undefined,
          dependencies,
          metadata,
        },
        warnings,
      };
    } catch (error) {
      logger.error('Error parsing mods.toml', { error });
      return {
        success: false,
        error: `Failed to parse mods.toml: ${(error as Error).message}`,
        warnings,
      };
    }
  }

  /**
   * Parses a fabric.mod.json file (Fabric format)
   * @param content Content of the fabric.mod.json file
   * @returns ManifestParseResult containing parsed information
   */
  parseFabricModJson(content: string): ManifestParseResult {
    const warnings: string[] = [];

    try {
      const fabricMod = JSON.parse(content);

      if (!fabricMod.id) {
        warnings.push('Missing id in fabric.mod.json');
      }

      // Parse dependencies
      const dependencies: ManifestDependency[] = [];

      if (fabricMod.depends) {
        for (const [modId, version] of Object.entries(fabricMod.depends)) {
          dependencies.push({
            modId,
            version: version as string,
            required: true,
            type: 'required',
          });
        }
      }

      if (fabricMod.recommends) {
        for (const [modId, version] of Object.entries(fabricMod.recommends)) {
          dependencies.push({
            modId,
            version: version as string,
            required: false,
            type: 'optional',
          });
        }
      }

      if (fabricMod.conflicts) {
        for (const [modId, version] of Object.entries(fabricMod.conflicts)) {
          dependencies.push({
            modId,
            version: version as string,
            required: false,
            type: 'incompatible',
          });
        }
      }

      return {
        success: true,
        manifest: {
          modId: this.sanitizeModId(fabricMod.id || 'unknown'),
          modName: fabricMod.name || 'Unknown Mod',
          version: fabricMod.version || '1.0.0',
          description: fabricMod.description,
          author: Array.isArray(fabricMod.authors)
            ? fabricMod.authors.map((a: any) => (typeof a === 'string' ? a : a.name)).join(', ')
            : fabricMod.authors,
          dependencies,
          metadata: fabricMod,
        },
        warnings,
      };
    } catch (error) {
      logger.error('Error parsing fabric.mod.json', { error });
      return {
        success: false,
        error: `Failed to parse fabric.mod.json: ${(error as Error).message}`,
        warnings,
      };
    }
  }

  /**
   * Sanitizes a mod ID to ensure it follows naming conventions
   * @param modId Raw mod ID
   * @returns Sanitized mod ID
   */
  private sanitizeModId(modId: string): string {
    return (
      modId
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_') || 'unknown'
    );
  }
}
