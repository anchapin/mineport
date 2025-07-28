/**
 * FeatureCompatibilityAnalyzer Component
 * 
 * This component is responsible for analyzing Java mod features and classifying them into
 * four tiers of conversion feasibility:
 * - Tier 1: Fully Translatable
 * - Tier 2: Approximation Possible
 * - Tier 3: Natively Impossible
 * - Tier 4: Unanalyzable
 * 
 * It performs static analysis on the mod's source code and structure to determine
 * which features can be directly translated, which require approximation, which are
 * impossible to translate natively, and which cannot be analyzed.
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger';
import { Feature, FeatureCompatibilityReport, CompromiseStrategy } from './index';

/**
 * FeatureAnalysisResult interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface FeatureAnalysisResult {
  compatibilityReport: FeatureCompatibilityReport;
  errors?: string[];
}

/**
 * FeatureDefinition interface.
 * 
 * TODO: Add detailed description of what this interface represents.
 * 
 * @since 1.0.0
 */
export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  detectionPatterns: {
    filePatterns?: string[];
    codePatterns?: string[];
    importPatterns?: string[];
  };
  compatibilityTier: 1 | 2 | 3 | 4;
  defaultCompromiseStrategy?: CompromiseStrategy;
}

/**
 * FeatureCompatibilityAnalyzer class.
 * 
 * TODO: Add detailed description of the class purpose and functionality.
 * 
 * @since 1.0.0
 */
export class FeatureCompatibilityAnalyzer {
  // Known feature definitions with their compatibility tiers
  private featureDefinitions: FeatureDefinition[] = [
    // Tier 1: Fully Translatable Features
    {
      id: 'basic_blocks',
      name: 'Basic Block Registration',
      description: 'Simple block registration with standard properties',
      detectionPatterns: {
        codePatterns: [
          'new Block\\(',
          'Block\\s+\\w+\\s*=',
          'Registry\\.register\\(\\s*Registry\\.BLOCK',
          'registerBlock\\(',
          'BLOCKS\\.register\\(',
        ],
        importPatterns: [
          'net\\.minecraft\\.block\\.Block',
          'net\\.minecraft\\.block\\.material\\.Material',
        ],
      },
      compatibilityTier: 1,
    },
    {
      id: 'basic_items',
      name: 'Basic Item Registration',
      description: 'Simple item registration with standard properties',
      detectionPatterns: {
        codePatterns: [
          'new Item\\(',
          'Item\\s+\\w+\\s*=',
          'Registry\\.register\\(\\s*Registry\\.ITEM',
          'registerItem\\(',
          'ITEMS\\.register\\(',
        ],
        importPatterns: [
          'net\\.minecraft\\.item\\.Item',
        ],
      },
      compatibilityTier: 1,
    },
    {
      id: 'crafting_recipes',
      name: 'Crafting Recipes',
      description: 'Standard crafting recipe registration',
      detectionPatterns: {
        filePatterns: [
          'data/.+/recipes/.+\\.json',
        ],
        codePatterns: [
          'ShapedRecipe',
          'ShapelessRecipe',
        ],
      },
      compatibilityTier: 1,
    },
    {
      id: 'loot_tables',
      name: 'Loot Tables',
      description: 'Standard loot table definitions',
      detectionPatterns: {
        filePatterns: [
          'data/.+/loot_tables/.+\\.json',
        ],
      },
      compatibilityTier: 1,
    },
    {
      id: 'block_models',
      name: 'Block Models',
      description: 'Standard block model definitions',
      detectionPatterns: {
        filePatterns: [
          'assets/.+/models/block/.+\\.json',
        ],
      },
      compatibilityTier: 1,
    },
    {
      id: 'item_models',
      name: 'Item Models',
      description: 'Standard item model definitions',
      detectionPatterns: {
        filePatterns: [
          'assets/.+/models/item/.+\\.json',
        ],
      },
      compatibilityTier: 1,
    },
    {
      id: 'textures',
      name: 'Textures',
      description: 'Texture files for blocks and items',
      detectionPatterns: {
        filePatterns: [
          'assets/.+/textures/.+\\.png',
        ],
      },
      compatibilityTier: 1,
    },
    {
      id: 'sounds',
      name: 'Sound Resources',
      description: 'Sound files and sound definitions',
      detectionPatterns: {
        filePatterns: [
          'assets/.+/sounds/.+\\.ogg',
          'assets/.+/sounds\\.json',
        ],
      },
      compatibilityTier: 1,
    },
    {
      id: 'language_files',
      name: 'Language Files',
      description: 'Localization and translation files',
      detectionPatterns: {
        filePatterns: [
          'assets/.+/lang/.+\\.json',
          'assets/.+/lang/.+\\.lang',
        ],
      },
      compatibilityTier: 1,
    },
    
    // Tier 2: Approximation Possible Features
    {
      id: 'custom_block_entities',
      name: 'Custom Block Entities',
      description: 'Block entities with custom data and behavior',
      detectionPatterns: {
        codePatterns: [
          'extends\\s+BlockEntity',
          'implements\\s+BlockEntityProvider',
        ],
        importPatterns: [
          'net\\.minecraft\\.block\\.entity\\.BlockEntity',
          'net\\.minecraft\\.tileentity\\.TileEntity',
        ],
      },
      compatibilityTier: 2,
      defaultCompromiseStrategy: {
        type: 'approximation',
        description: 'Convert to Bedrock block with attached JavaScript behavior',
        implementationDetails: 'Use block component system with JavaScript runtime behavior',
        limitations: [
          'Some complex block entity behaviors may not be perfectly replicated',
          'Performance may differ from Java implementation',
        ],
      },
    },
    {
      id: 'custom_entities',
      name: 'Custom Entities',
      description: 'Custom entity types and behaviors',
      detectionPatterns: {
        codePatterns: [
          'extends\\s+Entity',
          'extends\\s+LivingEntity',
          'extends\\s+MobEntity',
        ],
        importPatterns: [
          'net\\.minecraft\\.entity\\.Entity',
          'net\\.minecraft\\.entity\\.LivingEntity',
          'net\\.minecraft\\.entity\\.mob\\.MobEntity',
        ],
      },
      compatibilityTier: 2,
      defaultCompromiseStrategy: {
        type: 'approximation',
        description: 'Convert to Bedrock entity with behavior pack definition',
        implementationDetails: 'Use entity definition JSON with JavaScript for complex behaviors',
        limitations: [
          'Advanced AI behaviors may require simplification',
          'Some entity capabilities may be limited by Bedrock API',
        ],
      },
    },
    {
      id: 'custom_particles',
      name: 'Custom Particles',
      description: 'Custom particle effects and behaviors',
      detectionPatterns: {
        codePatterns: [
          'extends\\s+ParticleType',
          'extends\\s+Particle',
        ],
        importPatterns: [
          'net\\.minecraft\\.particle\\.ParticleType',
          'net\\.minecraft\\.client\\.particle\\.Particle',
        ],
      },
      compatibilityTier: 2,
      defaultCompromiseStrategy: {
        type: 'approximation',
        description: 'Map to closest Bedrock particle or create approximation',
        implementationDetails: 'Use available Bedrock particles with parameter adjustments',
        limitations: [
          'Custom particle rendering effects may be simplified',
          'Some unique particle behaviors may not be possible',
        ],
      },
    },
    {
      id: 'basic_guis',
      name: 'Basic GUIs',
      description: 'Simple inventory and container screens',
      detectionPatterns: {
        codePatterns: [
          'extends\\s+Screen',
          'extends\\s+ContainerScreen',
        ],
        importPatterns: [
          'net\\.minecraft\\.client\\.gui\\.screen\\.Screen',
          'net\\.minecraft\\.client\\.gui\\.screen\\.ingame\\.ContainerScreen',
        ],
      },
      compatibilityTier: 2,
      defaultCompromiseStrategy: {
        type: 'approximation',
        description: 'Convert to Bedrock UI using form system',
        implementationDetails: 'Use Bedrock form API with JavaScript event handling',
        limitations: [
          'Custom rendering and animations will be simplified',
          'Complex UI layouts may require adjustment',
        ],
      },
    },
    {
      id: 'basic_world_gen',
      name: 'Basic World Generation',
      description: 'Simple world generation features like ores and structures',
      detectionPatterns: {
        filePatterns: [
          'data/.+/worldgen/.+\\.json',
        ],
        codePatterns: [
          'Feature\\.',
          'ConfiguredFeature',
          'Structure',
        ],
      },
      compatibilityTier: 2,
      defaultCompromiseStrategy: {
        type: 'approximation',
        description: 'Convert to Bedrock feature rules and structure files',
        implementationDetails: 'Use feature_rules system with JavaScript for complex generation',
        limitations: [
          'Complex generation algorithms may be simplified',
          'Some advanced features may not have direct equivalents',
        ],
      },
    },
    
    // Tier 3: Natively Impossible Features
    {
      id: 'custom_dimensions',
      name: 'Custom Dimensions',
      description: 'Custom dimension types and generation',
      detectionPatterns: {
        codePatterns: [
          'DimensionType',
          'registerDimension',
          'createDimension',
        ],
        importPatterns: [
          'net\\.minecraft\\.world\\.dimension',
        ],
      },
      compatibilityTier: 3,
      defaultCompromiseStrategy: {
        type: 'simulation',
        description: 'Simulate dimensions using teleportation and visual effects',
        implementationDetails: 'Create separate areas in existing dimensions with teleportation between them',
        limitations: [
          'Not a true separate dimension',
          'Limited sky and environment customization',
          'May affect gameplay mechanics that rely on dimension properties',
        ],
      },
    },
    {
      id: 'advanced_rendering',
      name: 'Advanced Rendering',
      description: 'Custom rendering pipelines and shaders',
      detectionPatterns: {
        codePatterns: [
          'RenderType',
          'ShaderInstance',
          'RenderLayer',
          'VertexFormat',
        ],
        importPatterns: [
          'net\\.minecraft\\.client\\.renderer',
          'net\\.minecraft\\.client\\.shader',
        ],
      },
      compatibilityTier: 3,
      defaultCompromiseStrategy: {
        type: 'stubbing',
        description: 'Stub out advanced rendering code with visual approximations',
        implementationDetails: 'Use standard Bedrock rendering with simplified visuals',
        limitations: [
          'Custom shaders and rendering effects will be lost',
          'Visual fidelity may be significantly reduced',
        ],
      },
    },
    {
      id: 'custom_models',
      name: 'Custom Model Rendering',
      description: 'Custom model loading and rendering systems',
      detectionPatterns: {
        codePatterns: [
          'BakedModel',
          'ModelLoader',
          'IModelLoader',
        ],
        importPatterns: [
          'net\\.minecraft\\.client\\.render\\.model',
          'net\\.minecraftforge\\.client\\.model',
        ],
      },
      compatibilityTier: 3,
      defaultCompromiseStrategy: {
        type: 'stubbing',
        description: 'Convert to standard Bedrock models with limitations',
        implementationDetails: 'Use Bedrock model format with simplified geometry',
        limitations: [
          'Dynamic model transformations will be lost',
          'Advanced model features like conditional parts may be simplified',
        ],
      },
    },
    {
      id: 'complex_guis',
      name: 'Complex GUI Systems',
      description: 'Advanced UI systems with custom rendering',
      detectionPatterns: {
        codePatterns: [
          'RenderSystem',
          'GuiGraphics',
          'PoseStack',
          'MatrixStack',
        ],
        importPatterns: [
          'com\\.mojang\\.blaze3d',
        ],
      },
      compatibilityTier: 3,
      defaultCompromiseStrategy: {
        type: 'approximation',
        description: 'Recreate UI flow with Bedrock form system',
        implementationDetails: 'Use multiple forms and JavaScript to simulate complex UI',
        limitations: [
          'Custom rendering and animations will be lost',
          'Complex interactions may be simplified',
        ],
      },
    },
    {
      id: 'mixins',
      name: 'Mixin-based Modifications',
      description: 'Deep game modifications using Mixin framework',
      detectionPatterns: {
        filePatterns: [
          '.*\\.mixins\\.json',
        ],
        codePatterns: [
          '@Mixin',
          '@Inject',
          '@Redirect',
          '@Shadow',
        ],
        importPatterns: [
          'org\\.spongepowered\\.asm\\.mixin',
        ],
      },
      compatibilityTier: 4,
      defaultCompromiseStrategy: {
        type: 'stubbing',
        description: 'Implement alternative approaches for core functionality',
        implementationDetails: 'Analyze mixin purpose and implement alternative solutions',
        limitations: [
          'Deep engine modifications cannot be replicated',
          'Some functionality may be impossible to recreate',
        ],
      },
    },
    
    // Tier 4: Unanalyzable Features
    {
      id: 'obfuscated_code',
      name: 'Obfuscated Code',
      description: 'Code that has been obfuscated and cannot be analyzed',
      detectionPatterns: {
        codePatterns: [
          // Patterns that suggest obfuscation
          '\\w{1,2}\\s*\\(\\s*\\w{1,2}\\s*\\)',
          '\\w{1,2}\\s*\\(\\s*\\w{1,2}\\s*,\\s*\\w{1,2}\\s*\\)',
          '\\w{1,2}\\s*\\(\\s*\\w{1,2}\\s*,\\s*\\w{1,2}\\s*,\\s*\\w{1,2}\\s*\\)',
        ],
      },
      compatibilityTier: 4,
    },
    {
      id: 'native_code',
      name: 'Native Code Integration',
      description: 'Integration with native code libraries (JNI)',
      detectionPatterns: {
        codePatterns: [
          'System\\.loadLibrary',
          'native\\s+\\w+\\s*\\(',
        ],
        importPatterns: [
          'java\\.lang\\.native',
        ],
      },
      compatibilityTier: 4,
    },
    {
      id: 'reflection_heavy',
      name: 'Heavy Reflection Usage',
      description: 'Extensive use of Java reflection for accessing internal game elements',
      detectionPatterns: {
        codePatterns: [
          'Class\\.forName',
          '\\.getDeclaredMethod',
          '\\.getDeclaredField',
          '\\.setAccessible\\(true\\)',
        ],
        importPatterns: [
          'java\\.lang\\.reflect',
        ],
      },
      compatibilityTier: 4,
    },
    {
      id: 'asm_manipulation',
      name: 'ASM Bytecode Manipulation',
      description: 'Direct manipulation of Java bytecode',
      detectionPatterns: {
        codePatterns: [
          'ClassWriter',
          'ClassVisitor',
          'MethodVisitor',
        ],
        importPatterns: [
          'org\\.objectweb\\.asm',
        ],
      },
      compatibilityTier: 4,
    },
  ];

  /**
   * Analyzes a mod's features and classifies them into compatibility tiers
   * @param extractedModPath Path to the extracted mod files
   * @param modLoader The detected mod loader type ('forge' or 'fabric')
   * @returns FeatureAnalysisResult with compatibility report
   */
  async analyzeFeatures(extractedModPath: string, modLoader: 'forge' | 'fabric' | 'unknown'): Promise<FeatureAnalysisResult> {
    const result: FeatureAnalysisResult = {
      compatibilityReport: {
        tier1Features: [],
        tier2Features: [],
        tier3Features: [],
        tier4Features: [],
      },
      errors: [],
    };

    try {
      logger.info('Starting feature compatibility analysis', { extractedModPath, modLoader });

      // Find all relevant files for analysis
      const javaFiles = await this.findFiles(extractedModPath, ['.java']);
      const jsonFiles = await this.findFiles(extractedModPath, ['.json']);
      const assetFiles = await this.findFiles(extractedModPath, ['.png', '.ogg', '.lang']);

      // Analyze each feature definition against the mod files
      /**
       * for method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const featureDef of this.featureDefinitions) {
        const detectedFeature = await this.detectFeature(
          featureDef,
          extractedModPath,
          javaFiles,
          jsonFiles,
          assetFiles,
          modLoader
        );

        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (detectedFeature) {
          // Add the feature to the appropriate tier list
          /**
           * switch method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          switch (detectedFeature.compatibilityTier) {
            case 1:
              result.compatibilityReport.tier1Features.push(detectedFeature);
              break;
            case 2:
              result.compatibilityReport.tier2Features.push(detectedFeature);
              break;
            case 3:
              result.compatibilityReport.tier3Features.push(detectedFeature);
              break;
            case 4:
              result.compatibilityReport.tier4Features.push(detectedFeature);
              break;
          }
        }
      }

      // Log summary of analysis
      logger.info('Feature compatibility analysis completed', {
        tier1Count: result.compatibilityReport.tier1Features.length,
        tier2Count: result.compatibilityReport.tier2Features.length,
        tier3Count: result.compatibilityReport.tier3Features.length,
        tier4Count: result.compatibilityReport.tier4Features.length,
      });

      return result;
    } catch (error) {
      logger.error('Error during feature compatibility analysis', { error });
      result.errors?.push(`Analysis error: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Detects if a specific feature is present in the mod
   * @param featureDef The feature definition to check for
   * @param extractedModPath Path to the extracted mod files
   * @param javaFiles List of Java source files
   * @param jsonFiles List of JSON configuration files
   * @param assetFiles List of asset files
   * @param modLoader The detected mod loader type
   * @returns Feature object if detected, null otherwise
   */
  private async detectFeature(
    featureDef: FeatureDefinition,
    extractedModPath: string,
    javaFiles: string[],
    jsonFiles: string[],
    assetFiles: string[],
    modLoader: 'forge' | 'fabric' | 'unknown'
  ): Promise<Feature | null> {
    try {
      const { detectionPatterns } = featureDef;
      const sourceFiles: string[] = [];
      const sourceLineNumbers: number[][] = [];
      let isDetected = false;

      // Check file patterns (against all files)
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (detectionPatterns.filePatterns && detectionPatterns.filePatterns.length > 0) {
        const allFiles = [...javaFiles, ...jsonFiles, ...assetFiles];
        
        /**
         * for method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const pattern of detectionPatterns.filePatterns) {
          const regex = new RegExp(pattern);
          
          /**
           * for method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          for (const file of allFiles) {
            const relativePath = path.relative(extractedModPath, file);
            /**
             * if method.
             * 
             * TODO: Add detailed description of the method's purpose and behavior.
             * 
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            if (regex.test(relativePath)) {
              sourceFiles.push(relativePath);
              sourceLineNumbers.push([0]); // For file pattern matches, we don't have specific line numbers
              isDetected = true;
            }
          }
        }
      }

      // Check code patterns and import patterns (against Java files only)
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if ((detectionPatterns.codePatterns && detectionPatterns.codePatterns.length > 0) ||
          (detectionPatterns.importPatterns && detectionPatterns.importPatterns.length > 0)) {
        
        // Only check a reasonable number of files to avoid excessive processing
        const filesToCheck = javaFiles.slice(0, 50);
        
        /**
         * for method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        for (const file of filesToCheck) {
          try {
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');
            const matchedLines: number[] = [];
            
            // Check code patterns
            /**
             * if method.
             * 
             * TODO: Add detailed description of the method's purpose and behavior.
             * 
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            if (detectionPatterns.codePatterns) {
              /**
               * for method.
               * 
               * TODO: Add detailed description of the method's purpose and behavior.
               * 
               * @param param - TODO: Document parameters
               * @returns result - TODO: Document return value
               * @since 1.0.0
               */
              for (const pattern of detectionPatterns.codePatterns) {
                const regex = new RegExp(pattern);
                
                for (let i = 0; i < lines.length; i++) {
                  /**
                   * if method.
                   * 
                   * TODO: Add detailed description of the method's purpose and behavior.
                   * 
                   * @param param - TODO: Document parameters
                   * @returns result - TODO: Document return value
                   * @since 1.0.0
                   */
                  if (regex.test(lines[i])) {
                    matchedLines.push(i + 1); // Line numbers are 1-based
                  }
                }
              }
            }
            
            // Check import patterns
            /**
             * if method.
             * 
             * TODO: Add detailed description of the method's purpose and behavior.
             * 
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            if (detectionPatterns.importPatterns) {
              /**
               * for method.
               * 
               * TODO: Add detailed description of the method's purpose and behavior.
               * 
               * @param param - TODO: Document parameters
               * @returns result - TODO: Document return value
               * @since 1.0.0
               */
              for (const pattern of detectionPatterns.importPatterns) {
                const regex = new RegExp(`import\\s+${pattern}`);
                
                for (let i = 0; i < lines.length; i++) {
                  /**
                   * if method.
                   * 
                   * TODO: Add detailed description of the method's purpose and behavior.
                   * 
                   * @param param - TODO: Document parameters
                   * @returns result - TODO: Document return value
                   * @since 1.0.0
                   */
                  if (regex.test(lines[i])) {
                    matchedLines.push(i + 1); // Line numbers are 1-based
                  }
                }
              }
            }
            
            // If we found matches in this file, add it to the sources
            /**
             * if method.
             * 
             * TODO: Add detailed description of the method's purpose and behavior.
             * 
             * @param param - TODO: Document parameters
             * @returns result - TODO: Document return value
             * @since 1.0.0
             */
            if (matchedLines.length > 0) {
              const relativePath = path.relative(extractedModPath, file);
              sourceFiles.push(relativePath);
              sourceLineNumbers.push(matchedLines);
              isDetected = true;
            }
          } catch (error) {
            // Skip files that can't be read
            logger.warn(`Could not read file for feature detection: ${file}`, { error });
            continue;
          }
        }
      }

      // If the feature was detected, create a Feature object
      /**
       * if method.
       * 
       * TODO: Add detailed description of the method's purpose and behavior.
       * 
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (isDetected) {
        const feature: Feature = {
          id: featureDef.id,
          name: featureDef.name,
          description: featureDef.description,
          compatibilityTier: featureDef.compatibilityTier,
          sourceFiles,
          sourceLineNumbers,
        };

        // Add compromise strategy if available
        /**
         * if method.
         * 
         * TODO: Add detailed description of the method's purpose and behavior.
         * 
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (featureDef.defaultCompromiseStrategy) {
          feature.compromiseStrategy = featureDef.defaultCompromiseStrategy;
        }

        return feature;
      }

      return null;
    } catch (error) {
      logger.error(`Error detecting feature ${featureDef.id}`, { error });
      return null;
    }
  }

  /**
   * Recursively finds files with specified extensions
   * @param dirPath Directory to search in
   * @param extensions Array of file extensions to look for (e.g., ['.java', '.json'])
   * @returns Array of file paths
   */
  private async findFiles(dirPath: string, extensions: string[]): Promise<string[]> {
    const result: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
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
        const fullPath = path.join(dirPath, entry.name);
        
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
          // Skip certain directories that are unlikely to contain relevant files
          if (entry.name === 'node_modules' || 
              entry.name === '.git' || 
              entry.name === 'build' || 
              entry.name === 'target') {
            continue;
          }
          
          // Recursively search subdirectories
          const subDirFiles = await this.findFiles(fullPath, extensions);
          result.push(...subDirFiles);
        } else if (entry.isFile()) {
          // Check if the file has one of the specified extensions
          const ext = path.extname(entry.name).toLowerCase();
          /**
           * if method.
           * 
           * TODO: Add detailed description of the method's purpose and behavior.
           * 
           * @param param - TODO: Document parameters
           * @returns result - TODO: Document return value
           * @since 1.0.0
           */
          if (extensions.includes(ext)) {
            result.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.error('Error finding files', { error, dirPath });
    }
    
    return result;
  }

  /**
   * Generates a summary report of the feature compatibility analysis
   * @param report The feature compatibility report
   * @returns A formatted summary string
   */
  generateSummaryReport(report: FeatureCompatibilityReport): string {
    const totalFeatures = 
      report.tier1Features.length + 
      report.tier2Features.length + 
      report.tier3Features.length + 
      report.tier4Features.length;
    
    if (totalFeatures === 0) {
      return 'No features were detected in the mod.';
    }
    
    const tier1Percent = Math.round((report.tier1Features.length / totalFeatures) * 100);
    const tier2Percent = Math.round((report.tier2Features.length / totalFeatures) * 100);
    const tier3Percent = Math.round((report.tier3Features.length / totalFeatures) * 100);
    const tier4Percent = Math.round((report.tier4Features.length / totalFeatures) * 100);
    
    let summary = `Feature Compatibility Summary:\n\n`;
    summary += `Total Features Detected: ${totalFeatures}\n\n`;
    summary += `Tier 1 (Fully Translatable): ${report.tier1Features.length} (${tier1Percent}%)\n`;
    summary += `Tier 2 (Approximation Possible): ${report.tier2Features.length} (${tier2Percent}%)\n`;
    summary += `Tier 3 (Natively Impossible): ${report.tier3Features.length} (${tier3Percent}%)\n`;
    summary += `Tier 4 (Unanalyzable): ${report.tier4Features.length} (${tier4Percent}%)\n\n`;
    
    // Calculate overall conversion feasibility
    let feasibilityScore = 0;
    /**
     * if method.
     * 
     * TODO: Add detailed description of the method's purpose and behavior.
     * 
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (totalFeatures > 0) {
      feasibilityScore = Math.round(
        ((report.tier1Features.length * 1.0) + 
         (report.tier2Features.length * 0.6) + 
         (report.tier3Features.length * 0.3)) / 
        totalFeatures * 100
      );
    }
    
    let feasibilityRating = '';
    if (feasibilityScore >= 80) {
      feasibilityRating = 'Excellent';
    } else if (feasibilityScore >= 60) {
      feasibilityRating = 'Good';
    } else if (feasibilityScore >= 40) {
      feasibilityRating = 'Moderate';
    } else if (feasibilityScore >= 20) {
      feasibilityRating = 'Poor';
    } else {
      feasibilityRating = 'Very Poor';
    }
    
    summary += `Overall Conversion Feasibility: ${feasibilityRating} (${feasibilityScore}%)\n`;
    
    return summary;
  }
}