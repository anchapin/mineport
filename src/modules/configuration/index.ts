/**
 * Configuration Mapping Module
 * 
 * This module is responsible for translating static definition files and metadata
 * from Java mods to Bedrock addon format. It includes components for manifest generation,
 * block/item definition conversion, recipe conversion, loot table conversion, and license embedding.
 */

import { ManifestGenerator, JavaModMetadata, BedrockManifest, ManifestGenerationResult } from './ManifestGenerator';
import { 
  BlockItemDefinitionConverter, 
  JavaRegistrationCode, 
  BedrockBlockDefinition, 
  BedrockItemDefinition,
  BlockItemConversionResult,
  BlockItemConversionNote
} from './BlockItemDefinitionConverter';
import {
  LootTableConverter,
  JavaLootTable,
  BedrockLootTable,
  LootTableConversionResult,
  LootTableConversionNote
} from './LootTableConverter';
import {
  RecipeConverter,
  JavaRecipe,
  BedrockRecipe,
  RecipeConversionResult,
  RecipeConversionNote
} from './RecipeConverter';
import {
  LicenseEmbedder,
  LicenseInfo,
  AttributionInfo,
  LicenseEmbedResult,
  LicenseEmbeddingNote
} from './LicenseEmbedder';

export interface ConfigMappingInput {
  javaManifest: JavaModMetadata;
  javaRegistrations?: JavaRegistrationCode[];
  javaRecipes?: JavaRecipe[];
  javaLootTables?: JavaLootTable[];
  licenseInfo?: LicenseInfo;
  attributionInfo?: AttributionInfo;
}

export interface ConfigMappingOutput {
  bedrockManifests: {
    behaviorPack: BedrockManifest;
    resourcePack: BedrockManifest;
  };
  bedrockDefinitions?: {
    blocks: BedrockBlockDefinition[];
    items: BedrockItemDefinition[];
  };
  bedrockRecipes?: BedrockRecipe[];
  bedrockLootTables?: Record<string, BedrockLootTable>;
  licensedFiles?: string[];
  conversionNotes: ConfigConversionNote[];
}

export interface ConfigConversionNote {
  type: 'info' | 'warning' | 'error';
  component: 'manifest' | 'block' | 'item' | 'recipe' | 'loot_table' | 'license';
  message: string;
  details?: string;
}

// Export the classes and interfaces
export { 
  ManifestGenerator, 
  JavaModMetadata, 
  BedrockManifest, 
  ManifestGenerationResult,
  BlockItemDefinitionConverter,
  JavaRegistrationCode,
  BedrockBlockDefinition,
  BedrockItemDefinition,
  BlockItemConversionResult,
  BlockItemConversionNote,
  LootTableConverter,
  JavaLootTable,
  BedrockLootTable,
  LootTableConversionResult,
  LootTableConversionNote,
  RecipeConverter,
  JavaRecipe,
  BedrockRecipe,
  RecipeConversionResult,
  RecipeConversionNote,
  LicenseEmbedder,
  LicenseInfo,
  AttributionInfo,
  LicenseEmbedResult,
  LicenseEmbeddingNote
};

export class ConfigurationModule {
  private manifestGenerator: ManifestGenerator;
  private blockItemConverter: BlockItemDefinitionConverter;
  private recipeConverter: RecipeConverter;
  private lootTableConverter: LootTableConverter;
  private licenseEmbedder: LicenseEmbedder;
  
  constructor() {
    this.manifestGenerator = new ManifestGenerator();
    this.blockItemConverter = new BlockItemDefinitionConverter();
    this.recipeConverter = new RecipeConverter();
    this.lootTableConverter = new LootTableConverter();
    this.licenseEmbedder = new LicenseEmbedder();
  }
  
  async processConfigMapping(input: ConfigMappingInput, outputPath: string): Promise<ConfigMappingOutput> {
    const conversionNotes: ConfigConversionNote[] = [];
    
    // Generate manifests
    const manifestResult = this.manifestGenerator.generateManifests(input.javaManifest);
    
    if (!manifestResult.success || !manifestResult.behaviorPackManifest || !manifestResult.resourcePackManifest) {
      const errors = manifestResult.errors || ['Unknown error generating manifests'];
      errors.forEach(error => {
        conversionNotes.push({
          type: 'error',
          component: 'manifest',
          message: `Failed to generate manifest: ${error}`
        });
      });
      
      throw new Error(`Manifest generation failed: ${errors.join(', ')}`);
    }
    
    // Write manifests to output directories
    const behaviorPackDir = `${outputPath}/behavior_pack`;
    const resourcePackDir = `${outputPath}/resource_pack`;
    
    const writeResult = await this.manifestGenerator.writeManifests(
      manifestResult,
      behaviorPackDir,
      resourcePackDir
    );
    
    if (!writeResult) {
      conversionNotes.push({
        type: 'error',
        component: 'manifest',
        message: 'Failed to write manifests to output directories'
      });
      
      throw new Error('Failed to write manifests to output directories');
    }
    
    conversionNotes.push({
      type: 'info',
      component: 'manifest',
      message: 'Successfully generated and wrote manifests',
      details: `Behavior pack UUID: ${manifestResult.behaviorPackManifest.header.uuid}, Resource pack UUID: ${manifestResult.resourcePackManifest.header.uuid}`
    });
    
    // Process block and item definitions if registrations are provided
    let bedrockDefinitions = undefined;
    
    if (input.javaRegistrations && input.javaRegistrations.length > 0) {
      try {
        // Convert the registrations to Bedrock format
        const registrationResult = this.blockItemConverter.processRegistrations(
          input.javaRegistrations
        );
        
        if (registrationResult.success) {
          // Write the definitions to the output directory
          const writeDefResult = await this.blockItemConverter.writeDefinitions(
            registrationResult,
            behaviorPackDir
          );
          
          if (writeDefResult) {
            bedrockDefinitions = {
              blocks: registrationResult.blocks,
              items: registrationResult.items
            };
            
            // Add conversion notes
            registrationResult.conversionNotes.forEach(note => {
              conversionNotes.push({
                type: note.type,
                component: note.component,
                message: note.message,
                details: note.details
              });
            });
            
            conversionNotes.push({
              type: 'info',
              component: 'block',
              message: `Successfully converted ${registrationResult.blocks.length} blocks and ${registrationResult.items.length} items`,
              details: 'Block and item definitions written to behavior pack'
            });
          } else {
            conversionNotes.push({
              type: 'error',
              component: 'block',
              message: 'Failed to write block/item definitions to output directory'
            });
          }
        } else if (registrationResult.errors) {
          registrationResult.errors.forEach(error => {
            conversionNotes.push({
              type: 'error',
              component: 'block',
              message: `Failed to process block/item registrations: ${error}`
            });
          });
        }
      } catch (error) {
        conversionNotes.push({
          type: 'error',
          component: 'block',
          message: `Error processing block/item registrations: ${(error as Error).message}`
        });
      }
    }
    
    // Process recipes if provided
    let bedrockRecipes = undefined;
    
    if (input.javaRecipes && input.javaRecipes.length > 0) {
      try {
        // Convert the recipes to Bedrock format
        const recipeResult = this.recipeConverter.convertRecipes(
          input.javaRecipes,
          input.javaManifest.id
        );
        
        if (recipeResult.success) {
          // Write the recipes to the output directory
          const writeRecipeResult = await this.recipeConverter.writeRecipes(
            recipeResult,
            behaviorPackDir
          );
          
          if (writeRecipeResult) {
            bedrockRecipes = recipeResult.recipes;
            
            // Add conversion notes
            recipeResult.conversionNotes.forEach(note => {
              conversionNotes.push({
                type: note.type,
                component: note.component,
                message: note.message,
                details: note.details
              });
            });
            
            conversionNotes.push({
              type: 'info',
              component: 'recipe',
              message: `Successfully converted ${recipeResult.recipes.length} recipes`,
              details: 'Recipes written to behavior pack'
            });
          } else {
            conversionNotes.push({
              type: 'error',
              component: 'recipe',
              message: 'Failed to write recipes to output directory'
            });
          }
        } else if (recipeResult.errors) {
          recipeResult.errors.forEach(error => {
            conversionNotes.push({
              type: 'error',
              component: 'recipe',
              message: `Failed to process recipes: ${error}`
            });
          });
        }
      } catch (error) {
        conversionNotes.push({
          type: 'error',
          component: 'recipe',
          message: `Error processing recipes: ${(error as Error).message}`
        });
      }
    }
    
    // Process loot tables if provided
    let bedrockLootTables = undefined;
    
    if (input.javaLootTables && input.javaLootTables.length > 0) {
      try {
        // Convert the loot tables to Bedrock format
        const lootTableResult = this.lootTableConverter.convertLootTables(
          input.javaLootTables,
          input.javaManifest.id
        );
        
        if (lootTableResult.success) {
          // Write the loot tables to the output directory
          const writeLootTableResult = await this.lootTableConverter.writeLootTables(
            lootTableResult,
            behaviorPackDir
          );
          
          if (writeLootTableResult) {
            bedrockLootTables = lootTableResult.lootTables;
            
            // Add conversion notes
            lootTableResult.conversionNotes.forEach(note => {
              conversionNotes.push({
                type: note.type,
                component: note.component,
                message: note.message,
                details: note.details
              });
            });
            
            conversionNotes.push({
              type: 'info',
              component: 'loot_table',
              message: `Successfully converted ${Object.keys(lootTableResult.lootTables).length} loot tables`,
              details: 'Loot tables written to behavior pack'
            });
          } else {
            conversionNotes.push({
              type: 'error',
              component: 'loot_table',
              message: 'Failed to write loot tables to output directory'
            });
          }
        } else if (lootTableResult.errors) {
          lootTableResult.errors.forEach(error => {
            conversionNotes.push({
              type: 'error',
              component: 'loot_table',
              message: `Failed to process loot tables: ${error}`
            });
          });
        }
      } catch (error) {
        conversionNotes.push({
          type: 'error',
          component: 'loot_table',
          message: `Error processing loot tables: ${(error as Error).message}`
        });
      }
    }
    
    // Embed license information if provided
    let licensedFiles = undefined;
    
    if (input.licenseInfo && input.attributionInfo) {
      try {
        // Embed license information in output files
        const licenseResult = await this.licenseEmbedder.embedLicense(
          input.licenseInfo,
          input.attributionInfo,
          outputPath
        );
        
        if (licenseResult.success) {
          licensedFiles = licenseResult.embeddedFiles;
          
          // Add conversion notes
          licenseResult.conversionNotes.forEach(note => {
            conversionNotes.push({
              type: note.type,
              component: note.component,
              message: note.message,
              details: note.details
            });
          });
          
          // Validate license inclusion
          const validationResult = await this.licenseEmbedder.validateLicenseInclusion(
            outputPath,
            input.licenseInfo
          );
          
          if (!validationResult.valid) {
            validationResult.errors.forEach(error => {
              conversionNotes.push({
                type: 'warning',
                component: 'license',
                message: `License validation warning: ${error}`
              });
            });
          } else {
            conversionNotes.push({
              type: 'info',
              component: 'license',
              message: 'License validation passed',
              details: 'All required license information is properly included'
            });
          }
        } else if (licenseResult.errors) {
          licenseResult.errors.forEach(error => {
            conversionNotes.push({
              type: 'error',
              component: 'license',
              message: `Failed to embed license information: ${error}`
            });
          });
        }
      } catch (error) {
        conversionNotes.push({
          type: 'error',
          component: 'license',
          message: `Error embedding license information: ${(error as Error).message}`
        });
      }
    }
    
    // Return the configuration mapping output
    return {
      bedrockManifests: {
        behaviorPack: manifestResult.behaviorPackManifest,
        resourcePack: manifestResult.resourcePackManifest
      },
      bedrockDefinitions,
      bedrockRecipes,
      bedrockLootTables,
      licensedFiles,
      conversionNotes
    };
  }
}