import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import {
  BedrockAssetCollection,
  BedrockConfigCollection,
  JavaScriptFile,
} from '../../types/modules.js';
import { ConversionNote, LicenseInfo } from '../../types/errors.js';

/**
 * Interface for the input to the AddonPackager
 */
interface PackagingInput {
  bedrockAssets: BedrockAssetCollection;
  bedrockConfigs: BedrockConfigCollection;
  bedrockScripts: JavaScriptFile[];
  conversionNotes: ConversionNote[];
  licenseInfo: LicenseInfo;
  outputPath: string;
}

/**
 * Interface for the output from the AddonPackager
 */
interface PackagingOutput {
  mcaddonFilePath: string;
  behaviorPackPath: string;
  resourcePackPath: string;
}

// BedrockAssetCollection is imported from types/modules.js

// BedrockConfigCollection is imported from types/modules.js

// JavaScriptFile is imported from types/modules.js

// ConversionNote is imported from types/errors.js

/**
 * Interface for Bedrock manifest
 */
interface BedrockManifest {
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
  }[];
  dependencies?: {
    uuid: string;
    version: number[];
  }[];
}

/**
 * Interfaces for Bedrock file types
 */
interface BedrockTextureFile {
  path: string;
  content: Buffer;
}

interface BedrockModelFile {
  path: string;
  content: string;
}

interface BedrockSoundFile {
  path: string;
  content: Buffer;
}

// BedrockParticleFile is imported from types/assets.js

interface BedrockBlockDefinition {
  path: string;
  content: string;
}

interface BedrockItemDefinition {
  path: string;
  content: string;
}

interface BedrockRecipe {
  path: string;
  content: string;
}

interface BedrockLootTable {
  path: string;
  content: string;
}

/**
 * AddonPackager class responsible for generating .mcaddon file structure,
 * assembling components, and including metadata in the package.
 *
 * This class handles:
 * 1. Creating the proper directory structure for Bedrock addons
 * 2. Assembling all components (assets, configs, scripts) into the correct locations
 * 3. Including metadata and documentation in the package
 * 4. Creating the final .mcaddon archive
 */
export class AddonPackager {
  /**
   * Creates a .mcaddon package from the provided components
   * @param input The packaging input containing all components to be packaged
   * @returns A promise that resolves to the packaging output
   */
  public async createAddon(input: PackagingInput): Promise<PackagingOutput> {
    // Create temporary directories for behavior and resource packs
    const tempDir = path.join(input.outputPath, 'temp');
    const behaviorPackDir = path.join(tempDir, 'behavior_pack');
    const resourcePackDir = path.join(tempDir, 'resource_pack');
    const docsDir = path.join(tempDir, 'documentation');

    // Ensure directories exist
    await this.ensureDirectoryExists(tempDir);
    await this.ensureDirectoryExists(behaviorPackDir);
    await this.ensureDirectoryExists(resourcePackDir);
    await this.ensureDirectoryExists(docsDir);

    // Generate pack names with version for better identification
    const packName = input.bedrockConfigs.manifests.behaviorPack.header.name;
    const packVersion = input.bedrockConfigs.manifests.behaviorPack.header.version.join('.');
    const sanitizedName = packName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Assemble behavior pack
    await this.assembleBehaviorPack(behaviorPackDir, input);

    // Assemble resource pack
    await this.assembleResourcePack(resourcePackDir, input);

    // Create documentation
    await this.createDocumentation(docsDir, input);

    // Embed license information
    await this.embedLicenseInfo(tempDir, input.licenseInfo);

    // Create metadata files
    await this.createMetadataFiles(tempDir, input);

    // Create .mcaddon archive
    const mcaddonPath = path.join(input.outputPath, `${sanitizedName}_v${packVersion}.mcaddon`);

    await this.createMcaddonArchive(mcaddonPath, tempDir);

    return {
      mcaddonFilePath: mcaddonPath,
      behaviorPackPath: behaviorPackDir,
      resourcePackPath: resourcePackDir,
    };
  }

  /**
   * Ensures that a directory exists, creating it if necessary
   * @param directory The directory path to ensure
   */
  private async ensureDirectoryExists(directory: string): Promise<void> {
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
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  /**
   * Assembles the behavior pack components
   * @param directory The directory to assemble the behavior pack in
   * @param input The packaging input
   */
  private async assembleBehaviorPack(directory: string, input: PackagingInput): Promise<void> {
    // Write manifest.json
    await this.writeJsonFile(
      path.join(directory, 'manifest.json'),
      input.bedrockConfigs.manifests.behaviorPack
    );

    // Create scripts directory and write JavaScript files
    const scriptsDir = path.join(directory, 'scripts');
    await this.ensureDirectoryExists(scriptsDir);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const script of input.bedrockScripts) {
      const scriptPath = path.join(scriptsDir, script.path);
      await this.ensureDirectoryExists(path.dirname(scriptPath));
      fs.writeFileSync(scriptPath, script.content);
    }

    // Write block definitions
    const blocksDir = path.join(directory, 'blocks');
    await this.ensureDirectoryExists(blocksDir);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const block of input.bedrockConfigs.definitions.blocks) {
      const blockPath = path.join(blocksDir, block.path);
      await this.ensureDirectoryExists(path.dirname(blockPath));
      fs.writeFileSync(blockPath, JSON.stringify(block.content));
    }

    // Write item definitions
    const itemsDir = path.join(directory, 'items');
    await this.ensureDirectoryExists(itemsDir);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const item of input.bedrockConfigs.definitions.items) {
      const itemPath = path.join(itemsDir, item.path);
      await this.ensureDirectoryExists(path.dirname(itemPath));
      fs.writeFileSync(itemPath, JSON.stringify(item.content));
    }

    // Write recipes
    const recipesDir = path.join(directory, 'recipes');
    await this.ensureDirectoryExists(recipesDir);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const recipe of input.bedrockConfigs.recipes) {
      const recipePath = path.join(recipesDir, recipe.path);
      await this.ensureDirectoryExists(path.dirname(recipePath));
      fs.writeFileSync(recipePath, JSON.stringify(recipe.content));
    }

    // Write loot tables
    const lootTablesDir = path.join(directory, 'loot_tables');
    await this.ensureDirectoryExists(lootTablesDir);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const lootTable of input.bedrockConfigs.lootTables) {
      const lootTablePath = path.join(lootTablesDir, lootTable.path);
      await this.ensureDirectoryExists(path.dirname(lootTablePath));
      fs.writeFileSync(lootTablePath, JSON.stringify(lootTable.content));
    }
  }

  /**
   * Assembles the resource pack components
   * @param directory The directory to assemble the resource pack in
   * @param input The packaging input
   */
  private async assembleResourcePack(directory: string, input: PackagingInput): Promise<void> {
    // Write manifest.json
    await this.writeJsonFile(
      path.join(directory, 'manifest.json'),
      input.bedrockConfigs.manifests.resourcePack
    );

    // Write textures
    const texturesDir = path.join(directory, 'textures');
    await this.ensureDirectoryExists(texturesDir);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const texture of input.bedrockAssets.textures) {
      const texturePath = path.join(texturesDir, texture.path);
      await this.ensureDirectoryExists(path.dirname(texturePath));
      fs.writeFileSync(texturePath, texture.data);
    }

    // Write models
    const modelsDir = path.join(directory, 'models');
    await this.ensureDirectoryExists(modelsDir);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const model of input.bedrockAssets.models) {
      const modelPath = path.join(modelsDir, model.path);
      await this.ensureDirectoryExists(path.dirname(modelPath));
      fs.writeFileSync(
        modelPath,
        typeof model.data === 'string' ? model.data : JSON.stringify(model.data)
      );
    }

    // Write sounds
    const soundsDir = path.join(directory, 'sounds');
    await this.ensureDirectoryExists(soundsDir);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const sound of input.bedrockAssets.sounds) {
      const soundPath = path.join(soundsDir, sound.path);
      await this.ensureDirectoryExists(path.dirname(soundPath));
      fs.writeFileSync(soundPath, sound.data);
    }

    // Write particles
    const particlesDir = path.join(directory, 'particles');
    await this.ensureDirectoryExists(particlesDir);

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const particle of input.bedrockAssets.particles) {
      const particlePath = path.join(particlesDir, particle.path);
      await this.ensureDirectoryExists(path.dirname(particlePath));
      fs.writeFileSync(particlePath, particle.content);
    }
  }

  /**
   * Creates a .mcaddon archive from the temporary directory
   * @param mcaddonPath The path to create the .mcaddon file at
   * @param tempDir The temporary directory containing the behavior and resource packs
   */
  private async createMcaddonArchive(mcaddonPath: string, tempDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(mcaddonPath);

      // Dynamically import archiver to avoid ESM/CommonJS issues
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const archiver = require('archiver');
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Maximum compression
      });

      output.on('close', () => {
        /**
         * resolve method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        resolve();
      });

      archive.on('error', (err: Error) => {
        /**
         * reject method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        reject(err);
      });

      archive.pipe(output);

      // Add the behavior and resource packs to the archive
      archive.directory(path.join(tempDir, 'behavior_pack'), 'behavior_pack');
      archive.directory(path.join(tempDir, 'resource_pack'), 'resource_pack');

      // Add documentation directory
      archive.directory(path.join(tempDir, 'documentation'), 'documentation');

      // Add metadata.json to the root of the archive
      const metadataPath = path.join(tempDir, 'metadata.json');
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (fs.existsSync(metadataPath)) {
        archive.file(metadataPath, { name: 'metadata.json' });
      }

      // Add a README.txt to the root of the archive with basic installation instructions
      const readmeTxt =
        'INSTALLATION INSTRUCTIONS\n' +
        '=======================\n\n' +
        '1. Make sure you have Minecraft Bedrock Edition installed\n' +
        '2. Double-click the .mcaddon file to import it into Minecraft\n' +
        '3. Enable the addon in your world settings\n\n' +
        'For more detailed information, see the documentation folder.\n';

      archive.append(readmeTxt, { name: 'README.txt' });

      archive.finalize();
    });
  }

  /**
   * Embeds license information in the package
   * @param directory The directory to embed the license in
   * @param licenseInfo The license information to embed
   */
  private async embedLicenseInfo(directory: string, licenseInfo: LicenseInfo): Promise<void> {
    // Create LICENSE file in both behavior and resource packs
    const behaviorPackLicensePath = path.join(directory, 'behavior_pack', 'LICENSE');
    const resourcePackLicensePath = path.join(directory, 'resource_pack', 'LICENSE');
    const docsLicensePath = path.join(directory, 'documentation', 'LICENSE');

    // Construct license content with attributions
    let licenseContent = `${licenseInfo.text}\n\n`;
    licenseContent += 'Attributions:\n';
    licenseInfo.attributions?.forEach((attribution) => {
      licenseContent += `- ${attribution}\n`;
    });

    // Write license files
    fs.writeFileSync(behaviorPackLicensePath, licenseContent);
    fs.writeFileSync(resourcePackLicensePath, licenseContent);
    fs.writeFileSync(docsLicensePath, licenseContent);
  }

  /**
   * Creates documentation files for the addon
   * @param directory The directory to create documentation in
   * @param input The packaging input
   */
  private async createDocumentation(directory: string, input: PackagingInput): Promise<void> {
    // Create README.md with basic information about the addon
    const readmePath = path.join(directory, 'README.md');
    const packName = input.bedrockConfigs.manifests.behaviorPack.header.name;
    const packDesc = input.bedrockConfigs.manifests.behaviorPack.header.description;
    const packVersion = input.bedrockConfigs.manifests.behaviorPack.header.version.join('.');

    let readmeContent = `# ${packName} v${packVersion}\n\n`;
    readmeContent += `${packDesc}\n\n`;
    readmeContent += `This addon was automatically converted from a Minecraft Java Edition mod using the Minecraft Mod Converter.\n\n`;

    // Add conversion notes to README
    readmeContent += `## Conversion Notes\n\n`;
    const infoNotes = input.conversionNotes.filter((note) => note.type === 'info');
    const warningNotes = input.conversionNotes.filter((note) => note.type === 'warning');
    const errorNotes = input.conversionNotes.filter((note) => note.type === 'error');

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (infoNotes.length > 0) {
      readmeContent += `### Information\n\n`;
      infoNotes.forEach((note) => {
        readmeContent += `- ${note.message}\n`;
      });
      readmeContent += `\n`;
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
    if (warningNotes.length > 0) {
      readmeContent += `### Warnings\n\n`;
      warningNotes.forEach((note) => {
        readmeContent += `- ${note.message}\n`;
      });
      readmeContent += `\n`;
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
    if (errorNotes.length > 0) {
      readmeContent += `### Errors\n\n`;
      errorNotes.forEach((note) => {
        readmeContent += `- ${note.message}\n`;
      });
      readmeContent += `\n`;
    }

    // Write README file
    fs.writeFileSync(readmePath, readmeContent);

    // Create STRUCTURE.md with information about the addon structure
    const structurePath = path.join(directory, 'STRUCTURE.md');
    let structureContent = `# Addon Structure\n\n`;
    structureContent += `## Behavior Pack\n\n`;
    structureContent += `- \`manifest.json\`: Contains metadata about the behavior pack\n`;
    structureContent += `- \`scripts/\`: Contains JavaScript files that implement the mod's functionality\n`;
    structureContent += `- \`blocks/\`: Contains block definitions\n`;
    structureContent += `- \`items/\`: Contains item definitions\n`;
    structureContent += `- \`recipes/\`: Contains crafting recipes\n`;
    structureContent += `- \`loot_tables/\`: Contains loot tables\n\n`;

    structureContent += `## Resource Pack\n\n`;
    structureContent += `- \`manifest.json\`: Contains metadata about the resource pack\n`;
    structureContent += `- \`textures/\`: Contains texture files\n`;
    structureContent += `- \`models/\`: Contains model files\n`;
    structureContent += `- \`sounds/\`: Contains sound files\n`;
    structureContent += `- \`particles/\`: Contains particle definitions\n`;

    // Write STRUCTURE file
    fs.writeFileSync(structurePath, structureContent);
  }

  /**
   * Creates metadata files for the addon
   * @param directory The directory to create metadata in
   * @param input The packaging input
   */
  private async createMetadataFiles(directory: string, input: PackagingInput): Promise<void> {
    // Create pack_icon.png for both packs if not already present
    // For this example, we'll just check if they exist and create placeholders if not
    // const _behaviorPackIconPath = path.join(directory, 'behavior_pack', 'pack_icon.png');
    // const _resourcePackIconPath = path.join(directory, 'resource_pack', 'pack_icon.png');

    // Create a simple metadata.json file with information about the conversion
    const metadataPath = path.join(directory, 'metadata.json');
    const metadata = {
      originalMod: {
        name: input.bedrockConfigs.manifests.behaviorPack.header.name,
        version: input.bedrockConfigs.manifests.behaviorPack.header.version.join('.'),
      },
      conversionDate: new Date().toISOString(),
      converterVersion: '1.0.0', // This should be dynamically determined in a real implementation
      conversionStats: {
        totalAssets:
          input.bedrockAssets.textures.length +
          input.bedrockAssets.models.length +
          input.bedrockAssets.sounds.length +
          input.bedrockAssets.particles.length,
        totalScripts: input.bedrockScripts.length,
        totalDefinitions:
          input.bedrockConfigs.definitions.blocks.length +
          input.bedrockConfigs.definitions.items.length,
        totalRecipes: input.bedrockConfigs.recipes.length,
        totalLootTables: input.bedrockConfigs.lootTables.length,
        conversionNotes: {
          info: input.conversionNotes.filter((note) => note.type === 'info').length,
          warning: input.conversionNotes.filter((note) => note.type === 'warning').length,
          error: input.conversionNotes.filter((note) => note.type === 'error').length,
        },
      },
    };

    // Write metadata file
    await this.writeJsonFile(metadataPath, metadata);
  }

  /**
   * Writes a JSON file with proper formatting
   * @param filePath The path to write the file to
   * @param data The data to write
   */
  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}
