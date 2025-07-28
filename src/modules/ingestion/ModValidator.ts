/**
 * ModValidator Component
 * 
 * This component is responsible for validating Java mod (.jar) files and extracting their contents.
 * It checks if the uploaded file is a valid Minecraft Java mod and extracts its structure.
 */

import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createUnzip } from 'zlib';
import { Extract } from 'unzipper';
import logger from '../../utils/logger';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * ModValidationResult interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface ModValidationResult {
  isValid: boolean;
  modInfo?: {
    modId?: string;
    modName?: string;
    modVersion?: string;
  };
  extractedPath?: string;
  errors?: string[];
}

/**
 * ModValidator class.
 * 
 * TODO: Add detailed description of the class purpose and functionality.
 * 
 * @since 1.0.0
 */
export class ModValidator {
  private tempDir: string;
  
  /**
   * Creates a new instance.
   * 
   * TODO: Add detailed description of constructor behavior.
   * 
   * @param param - TODO: Document parameters
   * @since 1.0.0
   */
  constructor(tempDir: string = path.join(process.cwd(), 'temp')) {
    this.tempDir = tempDir;
  }
  
  /**
   * Validates a .jar file to ensure it's a valid Minecraft Java mod
   * @param jarFile Buffer containing the .jar file
   * @returns ModValidationResult with validation status and extracted information
   */
  async validateMod(jarFile: Buffer): Promise<ModValidationResult> {
    const result: ModValidationResult = {
      isValid: false,
      errors: [],
    };
    
    try {
      // Create a unique directory for this validation
      const validationId = randomUUID();
      const extractPath = path.join(this.tempDir, validationId);
      
      // Ensure temp directory exists
      await fs.mkdir(extractPath, { recursive: true });
      
      // Write the jar file to disk temporarily
      const jarPath = path.join(extractPath, 'mod.jar');
      await fs.writeFile(jarPath, jarFile);
      
      // Check if it's a valid JAR file
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!await this.isValidJarFile(jarPath)) {
        result.errors?.push('Invalid JAR file format');
        return result;
      }
      
      // Extract the JAR contents
      await this.extractJar(jarPath, extractPath);
      
      // Check for mod structure validity
      const modStructureResult = await this.validateModStructure(extractPath);
      
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!modStructureResult.isValid) {
        result.errors?.push(...(modStructureResult.errors || []));
        return result;
      }
      
      // Set the result properties
      result.isValid = true;
      result.extractedPath = extractPath;
      result.modInfo = modStructureResult.modInfo;
      
      return result;
    } catch (error) {
      logger.error('Error validating mod file', { error });
      result.errors?.push(`Validation error: ${(error as Error).message}`);
      return result;
    }
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
      const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && 
                    buffer[2] === 0x03 && buffer[3] === 0x04;
      
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
        result.errors?.push('Missing mod descriptor file (mods.toml, fabric.mod.json, or mcmod.info)');
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
        const modTomlInfo = await this.extractModTomlInfo(path.join(extractPath, 'META-INF', 'mods.toml'));
        result.modInfo = { ...result.modInfo, ...modTomlInfo };
      } else if (hasFabricMod) {
        const fabricModInfo = await this.extractFabricModInfo(path.join(extractPath, 'fabric.mod.json'));
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
  private async extractModTomlInfo(filePath: string): Promise<{ modId?: string; modName?: string; modVersion?: string }> {
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
  private async extractFabricModInfo(filePath: string): Promise<{ modId?: string; modName?: string; modVersion?: string }> {
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
  private async extractModInfoData(filePath: string): Promise<{ modId?: string; modName?: string; modVersion?: string }> {
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