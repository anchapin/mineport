/**
 * Enhanced Java Analyzer Component
 *
 * This component provides multi-strategy analysis of Java mod files to extract
 * registry names, texture paths, and manifest information using various detection methods.
 */

import fs from 'fs/promises';
import _path from 'path';
import _os from 'os';
import AdmZip from 'adm-zip';
import * as crypto from 'crypto';
import logger from '../../utils/logger.js';
import { CacheService } from '../../services/CacheService.js';
import { PerformanceMonitor } from '../../services/PerformanceMonitor.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const _execAsync = promisify(exec);

export interface ExtractedFiles {
  assets: Map<string, Buffer>;
  configs: Map<string, Buffer>;
  classFiles: Map<string, Buffer>;
  javaFiles: Map<string, string>;
  others: Map<string, Buffer>;
}

export interface DecompilationResult {
  decompiledFiles: Map<string, string>;
  failures: DecompilationFailure[];
}

export interface DecompilationFailure {
  classFile: string;
  error: string;
}

export interface SourceCodeAnalysis {
  decompilation: DecompilationResult;
  // Future analysis results can be added here
}

/**
 * Analysis result containing extracted information from Java mod
 */
export interface AnalysisResult {
  modId: string;
  registryNames: string[];
  texturePaths: string[];
  manifestInfo: ManifestInfo;
  analysisNotes: AnalysisNote[];
  extractedFiles: ExtractedFiles;
  sourceCodeAnalysis: SourceCodeAnalysis;
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
    /assets\/[^/]+\/textures\/(.+\.png)/g,
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
      if (this.cache && typeof this.cache.get === 'function') {
        try {
          // Validate jarPath to prevent path traversal
          if (!jarPath || jarPath.includes('..') || jarPath.includes('\0')) {
            throw new Error('Invalid jar path detected');
          }
          const fileBuffer = await fs.readFile(jarPath);
          const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
          const cacheKey = { type: 'java_analysis' as const, identifier: fileHash };
          const cachedResult = await this.cache.get<AnalysisResult>(cacheKey);

          if (cachedResult) {
            if (profileId) {
              this.performanceMonitor?.endProfile(profileId);
            }
            return cachedResult;
          }
        } catch (cacheError) {
          logger.warn('Cache lookup failed, proceeding without cache', { error: cacheError });
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
        extractedFiles: {
          assets: new Map(),
          configs: new Map(),
          classFiles: new Map(),
          javaFiles: new Map(),
          others: new Map(),
        },
        sourceCodeAnalysis: { decompilation: { decompiledFiles: new Map(), failures: [] } },
      };

      // Cache the result if available
      if (this.cache && typeof this.cache.set === 'function') {
        try {
          // Validate jarPath to prevent path traversal
          if (!jarPath || jarPath.includes('..') || jarPath.includes('\0')) {
            throw new Error('Invalid jar path detected');
          }
          const fileBuffer = await fs.readFile(jarPath);
          const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
          const cacheKey = { type: 'java_analysis' as const, identifier: fileHash };
          await this.cache.set(cacheKey, result, 7200000); // Cache for 2 hours
        } catch (cacheError) {
          logger.warn('Cache storage failed', { error: cacheError });
        }
      }

      if (profileId) {
        this.performanceMonitor?.endProfile(profileId);
      }
      return result;
    } catch (error) {
      logger.error('Error analyzing JAR file', { error, jarPath });

      // Check if it's a corrupted/invalid ZIP file
      const errorMessage = (error as Error).message;
      const isCorrupted =
        errorMessage.includes('Invalid or unsupported zip format') ||
        errorMessage.includes('END header') ||
        errorMessage.includes('corrupted');

      analysisNotes.push({
        type: 'error',
        message: isCorrupted
          ? `Analysis failed: JAR file appears to be corrupted - ${errorMessage}`
          : `Analysis failed: ${errorMessage}`,
        suggestion: 'Verify the JAR file is valid and accessible',
      });

      if (profileId) {
        this.performanceMonitor?.endProfile(profileId);
      }
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
        extractedFiles: {
          assets: new Map(),
          configs: new Map(),
          classFiles: new Map(),
          javaFiles: new Map(),
          others: new Map(),
        },
        sourceCodeAnalysis: { decompilation: { decompiledFiles: new Map(), failures: [] } },
      };
    }
  }

  /**
   * Full analysis of JAR file including file extraction and decompilation
   * @param jarPath Path to the JAR file to analyze
   * @returns Promise<AnalysisResult> containing complete analysis results
   */
  async analyzeJarFull(jarPath: string): Promise<AnalysisResult> {
    const profileId = this.performanceMonitor?.startProfile('java-full-analysis', { jarPath });

    try {
      // Start with MVP analysis
      const mvpResult = await this.analyzeJarForMVP(jarPath);

      // Perform full file extraction
      const extractedFiles = await this.extractAllFiles(jarPath);

      // Perform source code analysis with decompilation
      const sourceCodeAnalysis = await this.performSourceCodeAnalysis(extractedFiles);

      // Combine results
      const result: AnalysisResult = {
        ...mvpResult,
        extractedFiles,
        sourceCodeAnalysis,
      };

      if (profileId) {
        this.performanceMonitor?.endProfile(profileId);
      }

      return result;
    } catch (error) {
      if (profileId) {
        this.performanceMonitor?.endProfile(profileId);
      }

      // Fall back to MVP analysis if full analysis fails
      logger.warn('Full analysis failed, falling back to MVP analysis', { error, jarPath });
      return await this.analyzeJarForMVP(jarPath);
    }
  }

  /**
   * Extract all files from JAR with categorization
   */
  private async extractAllFiles(jarPath: string): Promise<ExtractedFiles> {
    const zip = new AdmZip(jarPath);
    const entries = zip.getEntries();

    const extractedFiles: ExtractedFiles = {
      assets: new Map(),
      configs: new Map(),
      classFiles: new Map(),
      javaFiles: new Map(),
      others: new Map(),
    };

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const entryPath = entry.entryName;
      const data = entry.getData();

      if (entryPath.startsWith('assets/')) {
        extractedFiles.assets.set(entryPath, data);
      } else if (
        entryPath.endsWith('.json') ||
        entryPath.endsWith('.toml') ||
        entryPath.endsWith('.yml')
      ) {
        extractedFiles.configs.set(entryPath, data);
      } else if (entryPath.endsWith('.class')) {
        extractedFiles.classFiles.set(entryPath, data);
      } else if (entryPath.endsWith('.java')) {
        extractedFiles.javaFiles.set(entryPath, data.toString('utf-8'));
      } else {
        extractedFiles.others.set(entryPath, data);
      }
    }

    return extractedFiles;
  }

  /**
   * Perform source code analysis including decompilation
   */
  private async performSourceCodeAnalysis(
    extractedFiles: ExtractedFiles
  ): Promise<SourceCodeAnalysis> {
    // For now, return basic structure - decompilation can be added later
    const decompilation: DecompilationResult = {
      decompiledFiles: new Map(),
      failures: [],
    };

    // If we have Java files, include them
    for (const [path, content] of extractedFiles.javaFiles) {
      decompilation.decompiledFiles.set(path, content);
    }

    // Future: Add actual decompilation logic here for .class files

    return {
      decompilation,
    };
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

      // Add warning if no registry names were found
      if (registryNames.size === 0) {
        notes.push({
          type: 'warning',
          message:
            'No registry names found - No mod content detected in the JAR file. This may indicate the file does not contain mod content or uses an unsupported format.',
        });
      }

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
        if (entry.entryName.endsWith('.class') || entry.entryName.endsWith('.java')) {
          try {
            if (entry.entryName.endsWith('.java')) {
              // Parse Java source files for registry calls
              const content = entry.getData().toString('utf8');

              // Look for Registry.register calls with Identifier
              const registryMatches = content.match(
                /Registry\.register\s*\(\s*[^,]+,\s*new\s+Identifier\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g
              );
              if (registryMatches) {
                for (const match of registryMatches) {
                  const identifierMatch = match.match(
                    /new\s+Identifier\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/
                  );
                  if (identifierMatch) {
                    const [, , registryName] = identifierMatch;
                    registryNames.push(registryName);
                  }
                }
              }

              // Also look for simple string patterns that might be registry names
              const stringMatches = content.match(
                /"([a-z_][a-z0-9_]*(?:_(?:block|item|entity))?)"/g
              );
              if (stringMatches) {
                for (const match of stringMatches) {
                  const name = match.slice(1, -1); // Remove quotes
                  if (
                    name.includes('_') &&
                    (name.includes('block') || name.includes('item') || name.includes('entity'))
                  ) {
                    registryNames.push(name);
                  }
                }
              }
            } else {
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
                  const textureMatch = texturePath.match(/([^/]+)$/);
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
              type: 'error',
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
    const textureReferences = new Set<string>();

    try {
      const entries = zip.getEntries();

      for (const entry of entries) {
        // Look for actual texture files
        if (entry.entryName.includes('textures/') && entry.entryName.endsWith('.png')) {
          texturePaths.push(entry.entryName);
        }

        // Look for texture references in JSON files
        if (entry.entryName.endsWith('.json')) {
          try {
            const content = entry.getData().toString('utf8');
            const jsonData = JSON.parse(content);

            // Extract texture references from JSON
            this.extractTextureReferencesFromJson(jsonData, textureReferences);
          } catch (error) {
            // Skip invalid JSON files
          }
        }
      }

      // Convert texture references to expected paths
      for (const reference of textureReferences) {
        if (reference.includes(':')) {
          // Format: "modid:path/to/texture"
          const [modId, texturePath] = reference.split(':', 2);
          const fullPath = `assets/${modId}/textures/${texturePath}.png`;
          texturePaths.push(fullPath);
        }
      }

      return [...new Set(texturePaths)]; // Remove duplicates
    } catch (error) {
      logger.error('Error detecting texture paths', { error });
      return [];
    }
  }

  /**
   * Recursively extracts texture references from JSON objects
   * @param obj Object to search
   * @param textureReferences Set to collect texture references
   */
  private extractTextureReferencesFromJson(obj: any, textureReferences: Set<string>): void {
    if (typeof obj === 'string') {
      // Look for texture reference patterns like "modid:path/to/texture"
      if (
        obj.includes(':') &&
        (obj.includes('block/') || obj.includes('item/') || obj.includes('entity/'))
      ) {
        textureReferences.add(obj);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item) => this.extractTextureReferencesFromJson(item, textureReferences));
    } else if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        this.extractTextureReferencesFromJson(value, textureReferences);
      }
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
      { name: 'META-INF/MANIFEST.MF', parser: this.parseManifestMF.bind(this) },
    ];

    let manifestInfo: ManifestInfo | null = null;

    for (const manifestFile of manifestFiles) {
      const entry = entries.find((e) => e.entryName === manifestFile.name);
      if (entry) {
        try {
          manifestInfo = await manifestFile.parser(entry.getData().toString('utf-8'));
          break;
        } catch (error) {
          logger.error(`Error parsing manifest file: ${entry.entryName}`, { error });
        }
      }
    }

    // If no manifest found or modId is unknown, try to extract modId from Java source files
    let extractedModId = manifestInfo?.modId || 'unknown';
    if (extractedModId === 'unknown') {
      for (const entry of entries) {
        if (entry.entryName.endsWith('.java')) {
          try {
            const content = entry.getData().toString('utf8');
            const identifierMatch = content.match(
              /new\s+Identifier\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/
            );
            if (identifierMatch) {
              extractedModId = identifierMatch[1];
              break;
            }
          } catch (error) {
            // Continue searching other files
          }
        }
      }
    }

    // Return manifest info with potentially updated modId
    if (manifestInfo) {
      return {
        ...manifestInfo,
        modId: extractedModId,
      };
    }

    // Fallback to default manifest info
    return {
      modId: extractedModId,
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
   * Parses MANIFEST.MF file
   * @param content Content of the MANIFEST.MF file
   * @returns Promise<ManifestInfo> containing parsed information
   */
  private async parseManifestMF(content: string): Promise<ManifestInfo> {
    const lines = content.split('\n');
    const manifest: Record<string, string> = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        manifest[key] = value;
      }
    }

    // Try to extract modId from various manifest fields
    let modId = 'unknown';
    if (manifest['ModId']) {
      modId = manifest['ModId'];
    } else if (manifest['Implementation-Title']) {
      modId = manifest['Implementation-Title'].toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    return {
      modId,
      modName: manifest['Implementation-Title'] || manifest['Bundle-Name'] || 'Unknown Mod',
      version: manifest['Implementation-Version'] || manifest['Bundle-Version'] || '1.0.0',
      description: manifest['Bundle-Description'],
      author: manifest['Implementation-Vendor'] || manifest['Bundle-Vendor'],
      dependencies: [],
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
      // Look for specific registry name patterns in string values
      if (location.includes('/lang/')) {
        // For lang files, extract from translation keys like "block.testmod.lang_block"
        const langMatches = obj.match(/(?:block|item|entity)\.[\w.-]+\.(.+)/g);
        if (langMatches) {
          for (const match of langMatches) {
            // Extract everything after the second dot (type.modid.registry_name)
            const parts = match.split('.');
            if (parts.length >= 3) {
              const registryName = parts.slice(2).join('.');
              if (registryName) {
                registryNames.push(registryName);
              }
            }
          }
        }
      } else {
        // For other files, look for modid:path patterns and extract the final part
        const resourceMatches = obj.match(/\w+:(block|item|entity)\/([a-z_][a-z0-9_]*)/g);
        if (resourceMatches) {
          for (const match of resourceMatches) {
            const parts = match.split('/');
            const registryName = parts[parts.length - 1];
            if (registryName) {
              registryNames.push(registryName);
            }
          }
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item) => this.extractRegistryNamesFromObject(item, registryNames, location));
    } else if (obj && typeof obj === 'object') {
      // For lang files, check keys for translation patterns
      if (location.includes('/lang/')) {
        for (const key of Object.keys(obj)) {
          const langMatch = key.match(/^(?:block|item|entity)\.[\w.-]+\.(.+)$/);
          if (langMatch) {
            // Extract everything after the second dot (type.modid.registry_name)
            const parts = key.split('.');
            if (parts.length >= 3) {
              const registryName = parts.slice(2).join('.');
              if (registryName) {
                registryNames.push(registryName);
              }
            }
          }
        }
      }

      // Recursively check values
      for (const value of Object.values(obj)) {
        this.extractRegistryNamesFromObject(value, registryNames, location);
      }
    }
  }
}
