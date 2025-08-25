/**
 * ModValidator Component
 *
 * Enhanced component responsible for validating Java mod (.jar) files and extracting their contents.
 * Now leverages the enhanced JavaAnalyzer and FileProcessor for improved validation and analysis.
 * It checks if the uploaded file is a valid Minecraft Java mod and extracts its structure.
 */

import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Extract } from 'unzipper';
import logger from '../../utils/logger.js';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import { FileProcessor } from './FileProcessor.js';
import { JavaAnalyzer } from './JavaAnalyzer.js';
import { SecurityScanner } from './SecurityScanner.js';

const execAsync = promisify(exec);

/**
 * Enhanced ModValidationResult interface with security and analysis information.
 *
 * @since 1.0.0
 */
export interface ModValidationResult {
  isValid: boolean;
  modInfo?: {
    modId?: string;
    modName?: string;
    modVersion?: string;
    modDescription?: string;
    modAuthor?: string;
    registryNames?: string[];
    texturePaths?: string[];
  };
  extractedPath?: string;
  errors?: string[];
  warnings?: string[];
  securityScanResult?: {
    isSafe: boolean;
    threats: any[];
    scanTime: number;
  };
  analysisNotes?: any[];
}

/**
 * Enhanced ModValidator class with integrated security scanning and analysis.
 *
 * @since 1.0.0
 */
export class ModValidator {
  private tempDir: string;
  private fileProcessor: FileProcessor;
  private javaAnalyzer: JavaAnalyzer;
  private securityScanner: SecurityScanner;

  /**
   * Creates a new instance with enhanced components.
   *
   * @param tempDir - Temporary directory for file processing
   * @param fileProcessor - Enhanced file processor for validation
   * @param javaAnalyzer - Enhanced Java analyzer for mod analysis
   * @param securityScanner - Security scanner for threat detection
   * @since 1.0.0
   */
  constructor(
    tempDir: string = path.join(process.cwd(), 'temp'),
    fileProcessor?: FileProcessor,
    javaAnalyzer?: JavaAnalyzer,
    securityScanner?: SecurityScanner
  ) {
    this.tempDir = tempDir;
    this.fileProcessor = fileProcessor || new FileProcessor();
    this.javaAnalyzer = javaAnalyzer || new JavaAnalyzer();
    this.securityScanner = securityScanner || new SecurityScanner();
  }

  /**
   * Enhanced validation of a .jar file with security scanning and detailed analysis
   * @param jarFile Buffer containing the .jar file
   * @param filename Original filename for context
   * @returns Enhanced ModValidationResult with security and analysis information
   */
  async validateMod(jarFile: Buffer, filename?: string): Promise<ModValidationResult> {
    const result: ModValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
    };

    try {
      // Step 1: Enhanced file validation and security scanning
      const fileValidationResult = await this.fileProcessor.validateUpload(
        jarFile,
        filename || 'mod.jar'
      );

      if (!fileValidationResult.isValid) {
        result.errors?.push(...(fileValidationResult.errors?.map((e) => e.message) || []));
        result.warnings?.push(...(fileValidationResult.warnings?.map((w) => w.message) || []));
        return result;
      }

      // Step 2: Security scanning
      const securityScanResult = await this.securityScanner.scanBuffer(
        jarFile,
        filename || 'mod.jar'
      );
      result.securityScanResult = securityScanResult;

      if (!securityScanResult.isSafe) {
        result.errors?.push(
          `Security threats detected: ${securityScanResult.threats.map((t) => t.description).join(', ')}`
        );
        return result;
      }

      // Create a unique directory for this validation
      const validationId = randomUUID();
      const extractPath = path.join(this.tempDir, validationId);

      // Ensure temp directory exists
      await fs.mkdir(extractPath, { recursive: true });

      // Write the jar file to disk temporarily
      const jarPath = path.join(extractPath, 'mod.jar');
      await fs.writeFile(jarPath, jarFile);

      // Step 3: Enhanced Java analysis
      const analysisResult = await this.javaAnalyzer.analyzeJarForMVP(jarPath);

      // Check if analysis was successful by verifying we got a valid modId
      if (!analysisResult.modId || analysisResult.modId === 'unknown') {
        result.errors?.push('Java analysis failed: Could not extract mod information');
        return result;
      }

      // Step 4: Legacy structure validation (for compatibility)
      const modStructureResult = await this.validateModStructure(extractPath);

      if (!modStructureResult.isValid) {
        result.warnings?.push(...(modStructureResult.errors || []));
        // Don't fail validation if enhanced analysis succeeded
      }

      // Combine results from enhanced analysis and legacy validation
      result.isValid = true;
      result.extractedPath = extractPath;
      result.modInfo = {
        modId: analysisResult.modId || modStructureResult.modInfo?.modId,
        modName: analysisResult.manifestInfo?.modName || modStructureResult.modInfo?.modName,
        modVersion: analysisResult.manifestInfo?.version || modStructureResult.modInfo?.modVersion,
        modDescription: analysisResult.manifestInfo?.description,
        modAuthor: analysisResult.manifestInfo?.author,
        registryNames: analysisResult.registryNames,
        texturePaths: analysisResult.texturePaths,
      };
      result.analysisNotes = analysisResult.analysisNotes;

      logger.info('Enhanced mod validation completed successfully', {
        modId: result.modInfo?.modId,
        registryNames: result.modInfo?.registryNames?.length || 0,
        texturePaths: result.modInfo?.texturePaths?.length || 0,
        securityThreats: securityScanResult.threats.length,
        analysisNotes: result.analysisNotes?.length || 0,
      });

      return result;
    } catch (error) {
      logger.error('Error in enhanced mod validation', { error });
      result.errors?.push(`Enhanced validation error: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Alias for validateMod for test compatibility
   * @param jarFile Buffer containing the .jar file
   * @param filename Original filename for context
   * @returns Enhanced ModValidationResult with security and analysis information
   */
  async validate(jarFile: Buffer, filename?: string): Promise<ModValidationResult> {
    return this.validateMod(jarFile, filename);
  }

  /**
   * Extract and validate a mod file
   * @param jarFile Buffer containing the .jar file
   * @param modName Optional mod name for context
   * @returns Promise resolving to extracted mod path
   */
  async extractMod(jarFile: Buffer, modName?: string): Promise<string> {
    const result = await this.validateMod(jarFile, modName);
    if (!result.isValid || !result.extractedPath) {
      throw new Error(`Mod extraction failed: ${result.errors?.join(', ')}`);
    }
    return result.extractedPath;
  }

  /**
   * Checks if the file is a valid JAR archive
   * @param jarPath Path to the JAR file
   * @returns boolean indicating if it's a valid JAR
   */
  private async isValidJarFile(jarPath: string): Promise<boolean> {
    try {
      // Check file signature (JAR files are ZIP files with specific structure)
      const buffer = Buffer.alloc(4);
      const fileHandle = await fs.open(jarPath, 'r');
      await fileHandle.read(buffer, 0, 4, 0);
      await fileHandle.close();

      // ZIP file signature is PK\x03\x04
      const isZip =
        buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!isZip) {
        return false;
      }

      // Try to list the contents to verify it's a valid ZIP/JAR
      try {
        await execAsync(`jar tf "${jarPath}"`);
        return true;
      } catch (error) {
        logger.error('Error verifying JAR structure', { error });
        return false;
      }
    } catch (error) {
      logger.error('Error checking JAR file validity', { error });
      return false;
    }
  }

  /**
   * Extracts the JAR file to the specified directory
   * @param jarPath Path to the JAR file
   * @param extractPath Path where contents should be extracted
   */
  private async extractJar(jarPath: string, extractPath: string): Promise<void> {
    try {
      await pipeline(
        /**
         * createReadStream method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createReadStream(jarPath),
        /**
         * Extract method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        Extract({ path: extractPath })
      );

      logger.info('JAR file extracted successfully', { extractPath });
    } catch (error) {
      logger.error('Error extracting JAR file', { error });
      throw new Error(`Failed to extract JAR file: ${(error as Error).message}`);
    }
  }

  /**
   * Validates the structure of the extracted mod to ensure it's a Minecraft mod
   * @param extractPath Path to the extracted JAR contents
   * @returns ModValidationResult with structure validation results
   */
  private async validateModStructure(extractPath: string): Promise<ModValidationResult> {
    const result: ModValidationResult = {
      isValid: false,
      modInfo: {},
      errors: [],
    };

    try {
      // Check for common mod descriptor files
      const hasModToml = await this.fileExists(path.join(extractPath, 'META-INF', 'mods.toml'));
      const hasFabricMod = await this.fileExists(path.join(extractPath, 'fabric.mod.json'));
      const hasModInfo = await this.fileExists(path.join(extractPath, 'mcmod.info'));

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!hasModToml && !hasFabricMod && !hasModInfo) {
        result.errors?.push(
          'Missing mod descriptor file (mods.toml, fabric.mod.json, or mcmod.info)'
        );
        return result;
      }

      // Extract mod information based on the descriptor file found
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (hasModToml) {
        const modTomlInfo = await this.extractModTomlInfo(
          path.join(extractPath, 'META-INF', 'mods.toml')
        );
        result.modInfo = { ...result.modInfo, ...modTomlInfo };
      } else if (hasFabricMod) {
        const fabricModInfo = await this.extractFabricModInfo(
          path.join(extractPath, 'fabric.mod.json')
        );
        result.modInfo = { ...result.modInfo, ...fabricModInfo };
      } else if (hasModInfo) {
        const modInfoData = await this.extractModInfoData(path.join(extractPath, 'mcmod.info'));
        result.modInfo = { ...result.modInfo, ...modInfoData };
      }

      // Check if we have at least a mod ID
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!result.modInfo?.modId) {
        result.errors?.push('Could not determine mod ID from descriptor files');
        return result;
      }

      // The mod is considered valid if we've reached this point
      result.isValid = true;
      return result;
    } catch (error) {
      logger.error('Error validating mod structure', { error });
      result.errors?.push(`Structure validation error: ${(error as Error).message}`);
      return result;
    }
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
   * Extracts mod information from mods.toml (Forge)
   * @param filePath Path to the mods.toml file
   * @returns Object containing extracted mod information
   */
  private async extractModTomlInfo(
    filePath: string
  ): Promise<{ modId?: string; modName?: string; modVersion?: string }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Simple TOML parsing for the specific fields we need
      const modIdMatch = content.match(/modId\s*=\s*["']([^"']+)["']/);
      const modNameMatch = content.match(/displayName\s*=\s*["']([^"']+)["']/);
      const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);

      return {
        modId: modIdMatch ? modIdMatch[1] : undefined,
        modName: modNameMatch ? modNameMatch[1] : undefined,
        modVersion: versionMatch ? versionMatch[1] : undefined,
      };
    } catch (error) {
      logger.error('Error extracting info from mods.toml', { error });
      return {};
    }
  }

  /**
   * Extracts mod information from fabric.mod.json (Fabric)
   * @param filePath Path to the fabric.mod.json file
   * @returns Object containing extracted mod information
   */
  private async extractFabricModInfo(
    filePath: string
  ): Promise<{ modId?: string; modName?: string; modVersion?: string }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fabricMod = JSON.parse(content);

      return {
        modId: fabricMod.id,
        modName: fabricMod.name,
        modVersion: fabricMod.version,
      };
    } catch (error) {
      logger.error('Error extracting info from fabric.mod.json', { error });
      return {};
    }
  }

  /**
   * Extracts mod information from mcmod.info (older Forge)
   * @param filePath Path to the mcmod.info file
   * @returns Object containing extracted mod information
   */
  private async extractModInfoData(
    filePath: string
  ): Promise<{ modId?: string; modName?: string; modVersion?: string }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const modInfo = JSON.parse(content);

      // mcmod.info can be an array or a direct object
      const modData = Array.isArray(modInfo) ? modInfo[0] : modInfo;

      return {
        modId: modData.modid,
        modName: modData.name,
        modVersion: modData.version,
      };
    } catch (error) {
      logger.error('Error extracting info from mcmod.info', { error });
      return {};
    }
  }

  /**
   * Cleans up temporary files created during validation
   * @param extractPath Path to the extracted files
   */
  async cleanup(extractPath: string): Promise<void> {
    try {
      await fs.rm(extractPath, { recursive: true, force: true });
      logger.info('Cleanup completed successfully', { extractPath });
    } catch (error) {
      logger.error('Error during cleanup', { error, extractPath });
    }
  }
}
