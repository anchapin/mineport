/**
 * Enhanced Java Analyzer Component
 *
 * This component provides multi-strategy analysis of Java mod files to extract
 * registry names, texture paths, and manifest information using various detection methods.
 */

import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import * as crypto from 'crypto';
import logger from '../../utils/logger.js';
import { CacheService } from '../../services/CacheService.js';
import { PerformanceMonitor } from '../../services/PerformanceMonitor.js';

/**
 * Analysis result containing extracted information from Java mod
 */
export interface AnalysisResult {
  modId: string;
  registryNames: string[];
  texturePaths: string[];
  manifestInfo: ManifestInfo;
  analysisNotes: AnalysisNote[];
}

/**
 * Manifest information extracted from mod descriptor files
 */
export interface ManifestInfo {
  modId: string;
  modName: string;
  version: string;
  description?: string;
  author?: string;
  dependencies: Dependency[];
}

/**
 * Dependency information
 */
export interface Dependency {
  modId: string;
  version: string;
  required: boolean;
}

/**
 * Analysis note for tracking extraction process
 */
export interface AnalysisNote {
  type: 'info' | 'warning' | 'error';
  message: string;
  location?: string;
  suggestion?: string;
}

/**
 * Registry extraction strategy result
 */
export interface ExtractionResult {
  registryNames: string[];
  notes: AnalysisNote[];
}

/**
 * Enhanced JavaAnalyzer class with multi-strategy registry extraction
 */
export class JavaAnalyzer {
  private cache?: CacheService;
  private performanceMonitor?: PerformanceMonitor;

  constructor(cache?: CacheService, performanceMonitor?: PerformanceMonitor) {
    this.cache = cache;
    this.performanceMonitor = performanceMonitor;
  }

  private static readonly REGISTRY_PATTERNS = [
    // Common Forge registry patterns
    /Registry\.register\([^,]+,\s*new\s+ResourceLocation\([^,]+,\s*["']([^"']+)["']\)/g,
    /new\s+ResourceLocation\([^,]+,\s*["']([^"']+)["']\)/g,
    /registerBlock\([^,]+,\s*["']([^"']+)["']/g,
    /registerItem\([^,]+,\s*["']([^"']+)["']/g,
    // Fabric registry patterns
    /Registry\.register\([^,]+,\s*new\s+Identifier\([^,]+,\s*["']([^"']+)["']\)/g,
    /new\s+Identifier\([^,]+,\s*["']([^"']+)["']\)/g,
  ];

  private static readonly TEXTURE_PATTERNS = [
    /assets\/[^\/]+\/textures\/(.+\.png)/g,
    /textures\/(.+\.png)/g,
    /\.png$/,
  ];

  /**
   * Analyzes a JAR file for MVP purposes using multi-strategy extraction
   * @param jarPath Path to the JAR file to analyze
   * @returns Promise<AnalysisResult> containing extracted information
   */
  async analyzeJarForMVP(jarPath: string): Promise<AnalysisResult> {
    const profileId = this.performanceMonitor?.startProfile('java-analysis', { jarPath });
    const analysisNotes: AnalysisNote[] = [];

    try {
      // Check cache first if available
      if (this.cache) {
        const fileBuffer = await fs.readFile(jarPath);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const cacheKey = { type: 'java_analysis' as const, identifier: fileHash };
        const cachedResult = await this.cache.get<AnalysisResult>(cacheKey);

        if (cachedResult) {
          this.performanceMonitor?.endProfile(profileId);
          return cachedResult;
        }
      }
      // Load the JAR file
      const zip = new AdmZip(jarPath);

      // Extract manifest information first
      const manifestInfo = await this.parseManifestInfo(zip);
      analysisNotes.push({
        type: 'info',
        message: `Extracted manifest info for mod: ${manifestInfo.modId}`,
      });

      // Apply multi-strategy registry extraction
      const registryResult = await this.extractRegistryNamesMultiStrategy(zip);
      analysisNotes.push(...registryResult.notes);

      // Detect texture paths
      const texturePaths = await this.detectTexturePaths(zip);
      analysisNotes.push({
        type: 'info',
        message: `Found ${texturePaths.length} texture files`,
      });

      const result: AnalysisResult = {
        modId: manifestInfo.modId,
        registryNames: registryResult.registryNames,
        texturePaths,
        manifestInfo,
        analysisNotes,
      };

      // Cache the result if available
      if (this.cache) {
        const fileBuffer = await fs.readFile(jarPath);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const cacheKey = { type: 'java_analysis' as const, identifier: fileHash };
        await this.cache.set(cacheKey, result, 7200000); // Cache for 2 hours
      }

      this.performanceMonitor?.endProfile(profileId);
      return result;
    } catch (error) {
      logger.error('Error analyzing JAR file', { error, jarPath });
      analysisNotes.push({
        type: 'error',
        message: `Analysis failed: ${(error as Error).message}`,
        suggestion: 'Verify the JAR file is valid and accessible',
      });

      this.performanceMonitor?.endProfile(profileId);
      // Return minimal result on error
      return {
        modId: 'unknown',
        registryNames: [],
        texturePaths: [],
        manifestInfo: {
          modId: 'unknown',
          modName: 'Unknown',
          version: '1.0.0',
          dependencies: [],
        },
        analysisNotes,
      };
    }
  }

  /**
   * Extracts registry names using multiple detection strategies
   * @param zip AdmZip instance of the JAR file
   * @returns Promise<ExtractionResult> containing registry names and notes
   */
  private async extractRegistryNamesMultiStrategy(zip: AdmZip): Promise<ExtractionResult> {
    const registryNames = new Set<string>();
    const notes: AnalysisNote[] = [];

    try {
      // Strategy 1: Parse Java class files for registry calls
      const classResult = await this.extractFromClassFiles(zip);
      classResult.registryNames.forEach((name) => registryNames.add(name));
      notes.push(...classResult.notes);

      // Strategy 2: Parse JSON data files
      const jsonResult = await this.extractFromJsonFiles(zip);
      jsonResult.registryNames.forEach((name) => registryNames.add(name));
      notes.push(...jsonResult.notes);

      // Strategy 3: Parse lang files for translation keys
      const langResult = await this.extractFromLangFiles(zip);
      langResult.registryNames.forEach((name) => registryNames.add(name));
      notes.push(...langResult.notes);

      // Strategy 4: Parse model files for block/item references
      const modelResult = await this.extractFromModelFiles(zip);
      modelResult.registryNames.forEach((name) => registryNames.add(name));
      notes.push(...modelResult.notes);

      notes.push({
        type: 'info',
        message: `Multi-strategy extraction found ${registryNames.size} unique registry names`,
      });

      return {
        registryNames: Array.from(registryNames),
        notes,
      };
    } catch (error) {
      notes.push({
        type: 'error',
        message: `Multi-strategy extraction failed: ${(error as Error).message}`,
      });
      return { registryNames: [], notes };
    }
  } /*
   *
   * Extracts registry names from Java class files using bytecode analysis
   * @param zip AdmZip instance of the JAR file
   * @returns Promise<ExtractionResult> containing registry names from class files
   */
  private async extractFromClassFiles(zip: AdmZip): Promise<ExtractionResult> {
    const registryNames: string[] = [];
    const notes: AnalysisNote[] = [];

    try {
      const entries = zip.getEntries();
      let classFilesProcessed = 0;

      for (const entry of entries) {
        if (entry.entryName.endsWith('.class')) {
          try {
            // For MVP, we'll skip actual bytecode analysis and focus on filename patterns
            // This is a simplified approach that looks for common naming patterns
            const className = entry.entryName.replace(/\.class$/, '').replace(/\//g, '.');
            const simpleClassName = className.split('.').pop() || '';

            // Look for common block/item class naming patterns
            if (simpleClassName.match(/Block$|Item$|Entity$|TileEntity$/)) {
              const registryName = simpleClassName
                .replace(/Block$|Item$|Entity$|TileEntity$/, '')
                .toLowerCase()
                .replace(/([A-Z])/g, '_$1')
                .replace(/^_/, '');

              if (registryName && registryName.length > 0) {
                registryNames.push(registryName);
              }
            }

            classFilesProcessed++;
          } catch (error) {
            notes.push({
              type: 'warning',
              message: `Failed to analyze class file: ${entry.entryName}`,
              location: entry.entryName,
            });
          }
        }
      }

      notes.push({
        type: 'info',
        message: `Processed ${classFilesProcessed} class files, found ${registryNames.length} potential registry names`,
      });

      return { registryNames, notes };
    } catch (error) {
      notes.push({
        type: 'error',
        message: `Class file extraction failed: ${(error as Error).message}`,
      });
      return { registryNames: [], notes };
    }
  }

  /**
   * Extracts registry names from JSON data files
   * @param zip AdmZip instance of the JAR file
   * @returns Promise<ExtractionResult> containing registry names from JSON files
   */
  private async extractFromJsonFiles(zip: AdmZip): Promise<ExtractionResult> {
    const registryNames: string[] = [];
    const notes: AnalysisNote[] = [];

    try {
      const entries = zip.getEntries();
      let jsonFilesProcessed = 0;

      for (const entry of entries) {
        if (entry.entryName.endsWith('.json') && !entry.isDirectory) {
          try {
            const jsonContent = entry.getData().toString('utf-8');
            const data = JSON.parse(jsonContent);

            // Look for registry names in various JSON structures
            this.extractRegistryNamesFromObject(data, registryNames, entry.entryName);
            jsonFilesProcessed++;
          } catch (error) {
            notes.push({
              type: 'warning',
              message: `Failed to parse JSON file: ${entry.entryName}`,
              location: entry.entryName,
            });
          }
        }
      }

      notes.push({
        type: 'info',
        message: `Processed ${jsonFilesProcessed} JSON files, found ${registryNames.length} registry names`,
      });

      return { registryNames, notes };
    } catch (error) {
      notes.push({
        type: 'error',
        message: `JSON file extraction failed: ${(error as Error).message}`,
      });
      return { registryNames: [], notes };
    }
  }

  /**
   * Extracts registry names from lang files for translation key extraction
   * @param zip AdmZip instance of the JAR file
   * @returns Promise<ExtractionResult> containing registry names from lang files
   */
  private async extractFromLangFiles(zip: AdmZip): Promise<ExtractionResult> {
    const registryNames: string[] = [];
    const notes: AnalysisNote[] = [];

    try {
      const entries = zip.getEntries();
      let langFilesProcessed = 0;

      for (const entry of entries) {
        if (entry.entryName.includes('lang/') && entry.entryName.endsWith('.json')) {
          try {
            const langContent = entry.getData().toString('utf-8');
            const data = JSON.parse(langContent);

            // Extract registry names from translation keys
            for (const key of Object.keys(data)) {
              // Pattern: block.modid.blockname or item.modid.itemname
              const match = key.match(/^(block|item)\.[\w]+\.([\w_]+)$/);
              if (match) {
                registryNames.push(match[2]);
              }
            }

            langFilesProcessed++;
          } catch (error) {
            notes.push({
              type: 'warning',
              message: `Failed to parse lang file: ${entry.entryName}`,
              location: entry.entryName,
            });
          }
        }
      }

      notes.push({
        type: 'info',
        message: `Processed ${langFilesProcessed} lang files, found ${registryNames.length} registry names`,
      });

      return { registryNames, notes };
    } catch (error) {
      notes.push({
        type: 'error',
        message: `Lang file extraction failed: ${(error as Error).message}`,
      });
      return { registryNames: [], notes };
    }
  }

  /**
   * Extracts registry names from model files for block/item references
   * @param zip AdmZip instance of the JAR file
   * @returns Promise<ExtractionResult> containing registry names from model files
   */
  private async extractFromModelFiles(zip: AdmZip): Promise<ExtractionResult> {
    const registryNames: string[] = [];
    const notes: AnalysisNote[] = [];

    try {
      const entries = zip.getEntries();
      let modelFilesProcessed = 0;

      for (const entry of entries) {
        if (entry.entryName.includes('models/') && entry.entryName.endsWith('.json')) {
          try {
            const modelContent = entry.getData().toString('utf-8');
            const data = JSON.parse(modelContent);

            // Extract registry name from model file path
            const pathParts = entry.entryName.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const registryName = fileName.replace('.json', '');

            if (registryName && registryName.length > 0) {
              registryNames.push(registryName);
            }

            // Also look for texture references that might indicate registry names
            if (data.textures) {
              for (const textureKey of Object.keys(data.textures)) {
                const texturePath = data.textures[textureKey];
                if (typeof texturePath === 'string') {
                  const textureMatch = texturePath.match(/([^\/]+)$/);
                  if (textureMatch) {
                    const textureName = textureMatch[1].replace('.png', '');
                    registryNames.push(textureName);
                  }
                }
              }
            }

            modelFilesProcessed++;
          } catch (error) {
            notes.push({
              type: 'warning',
              message: `Failed to parse model file: ${entry.entryName}`,
              location: entry.entryName,
            });
          }
        }
      }

      notes.push({
        type: 'info',
        message: `Processed ${modelFilesProcessed} model files, found ${registryNames.length} registry names`,
      });

      return { registryNames, notes };
    } catch (error) {
      notes.push({
        type: 'error',
        message: `Model file extraction failed: ${(error as Error).message}`,
      });
      return { registryNames: [], notes };
    }
  } /**
  
 * Detects texture paths from the JAR file
   * @param zip AdmZip instance of the JAR file
   * @returns Promise<string[]> containing texture file paths
   */
  private async detectTexturePaths(zip: AdmZip): Promise<string[]> {
    const texturePaths: string[] = [];

    try {
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.entryName.includes('textures/') && entry.entryName.endsWith('.png')) {
          texturePaths.push(entry.entryName);
        }
      }

      return texturePaths;
    } catch (error) {
      logger.error('Error detecting texture paths', { error });
      return [];
    }
  }

  /**
   * Parses manifest information from various mod descriptor files
   * @param zip AdmZip instance of the JAR file
   * @returns Promise<ManifestInfo> containing manifest information
   */
  private async parseManifestInfo(zip: AdmZip): Promise<ManifestInfo> {
    const entries = zip.getEntries();

    // Try different manifest file types in order of preference
    const manifestFiles = [
      { name: 'META-INF/mods.toml', parser: this.parseModsToml.bind(this) },
      { name: 'fabric.mod.json', parser: this.parseFabricModJson.bind(this) },
      { name: 'mcmod.info', parser: this.parseMcmodInfo.bind(this) },
    ];

    for (const manifestFile of manifestFiles) {
      const entry = entries.find((e) => e.entryName === manifestFile.name);
      if (entry) {
        try {
          return await manifestFile.parser(entry.getData().toString('utf-8'));
        } catch (error) {
          logger.error(`Error parsing manifest file: ${entry.entryName}`, { error });
        }
      }
    }

    // Fallback to default manifest info
    return {
      modId: 'unknown',
      modName: 'Unknown Mod',
      version: '1.0.0',
      dependencies: [],
    };
  }

  /**
   * Parses mods.toml file (Forge)
   * @param content Content of the mods.toml file
   * @returns Promise<ManifestInfo> containing parsed information
   */
  private async parseModsToml(content: string): Promise<ManifestInfo> {
    const modIdMatch = content.match(/modId\s*=\s*["']([^"']+)["']/);
    const modNameMatch = content.match(/displayName\s*=\s*["']([^"']+)["']/);
    const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
    const descriptionMatch = content.match(/description\s*=\s*["']([^"']+)["']/);
    const authorMatch = content.match(/authors\s*=\s*["']([^"']+)["']/);

    // Parse dependencies - improved regex to capture the full dependency section
    const dependencies: Dependency[] = [];
    const dependencyPattern = /\[\[dependencies\.([^\]]+)\]\]([\s\S]*?)(?=\[\[|$)/g;
    let depMatch;

    while ((depMatch = dependencyPattern.exec(content)) !== null) {
      const modId = depMatch[1];
      const depSection = depMatch[2];

      const depModIdMatch = depSection.match(/modId\s*=\s*["']([^"']+)["']/);
      const mandatoryMatch = depSection.match(/mandatory\s*=\s*(true|false)/);
      const versionRangeMatch = depSection.match(/versionRange\s*=\s*["']([^"']+)["']/);

      dependencies.push({
        modId: depModIdMatch ? depModIdMatch[1] : modId,
        version: versionRangeMatch ? versionRangeMatch[1] : '*',
        required: mandatoryMatch ? mandatoryMatch[1] === 'true' : true,
      });
    }

    return {
      modId: modIdMatch ? modIdMatch[1] : 'unknown',
      modName: modNameMatch ? modNameMatch[1] : 'Unknown Mod',
      version: versionMatch ? versionMatch[1] : '1.0.0',
      description: descriptionMatch ? descriptionMatch[1] : undefined,
      author: authorMatch ? authorMatch[1] : undefined,
      dependencies,
    };
  }

  /**
   * Parses fabric.mod.json file (Fabric)
   * @param content Content of the fabric.mod.json file
   * @returns Promise<ManifestInfo> containing parsed information
   */
  private async parseFabricModJson(content: string): Promise<ManifestInfo> {
    const fabricMod = JSON.parse(content);

    const dependencies: Dependency[] = [];
    if (fabricMod.depends) {
      for (const [modId, version] of Object.entries(fabricMod.depends)) {
        dependencies.push({
          modId,
          version: version as string,
          required: true,
        });
      }
    }

    return {
      modId: fabricMod.id || 'unknown',
      modName: fabricMod.name || 'Unknown Mod',
      version: fabricMod.version || '1.0.0',
      description: fabricMod.description,
      author: Array.isArray(fabricMod.authors) ? fabricMod.authors.join(', ') : fabricMod.authors,
      dependencies,
    };
  }

  /**
   * Parses mcmod.info file (older Forge)
   * @param content Content of the mcmod.info file
   * @returns Promise<ManifestInfo> containing parsed information
   */
  private async parseMcmodInfo(content: string): Promise<ManifestInfo> {
    const modInfo = JSON.parse(content);
    const modData = Array.isArray(modInfo) ? modInfo[0] : modInfo;

    const dependencies: Dependency[] = [];
    if (modData.dependencies) {
      for (const dep of modData.dependencies) {
        dependencies.push({
          modId: dep,
          version: '*',
          required: true,
        });
      }
    }

    return {
      modId: modData.modid || 'unknown',
      modName: modData.name || 'Unknown Mod',
      version: modData.version || '1.0.0',
      description: modData.description,
      author: Array.isArray(modData.authorList)
        ? modData.authorList.join(', ')
        : modData.authorList,
      dependencies,
    };
  }

  /**
   * Recursively extracts registry names from JSON objects
   * @param obj Object to search
   * @param registryNames Array to collect registry names
   * @param location Current location for error reporting
   */
  private extractRegistryNamesFromObject(
    obj: any,
    registryNames: string[],
    location: string
  ): void {
    if (typeof obj === 'string') {
      // Look for registry name patterns in string values
      const matches = obj.match(/[a-z_][a-z0-9_]*/g);
      if (matches) {
        registryNames.push(...matches);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item) => this.extractRegistryNamesFromObject(item, registryNames, location));
    } else if (obj && typeof obj === 'object') {
      // Check object keys for registry names
      for (const key of Object.keys(obj)) {
        if (key.match(/^[a-z_][a-z0-9_]*$/)) {
          registryNames.push(key);
        }
        this.extractRegistryNamesFromObject(obj[key], registryNames, location);
      }
    }
  }
}
