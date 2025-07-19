import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDirectory, cleanupTempDirectory, loadMockMod } from '../helpers';
import { ModValidator } from '../../../src/modules/ingestion/ModValidator';
import { FeatureCompatibilityAnalyzer } from '../../../src/modules/ingestion/FeatureCompatibilityAnalyzer';
import { TextureConverter } from '../../../src/modules/assets/TextureConverter';
import { ModelConverter } from '../../../src/modules/assets/ModelConverter';
import { SoundProcessor } from '../../../src/modules/assets/SoundProcessor';
import { BlockItemDefinitionConverter } from '../../../src/modules/configuration/BlockItemDefinitionConverter';
import { RecipeConverter } from '../../../src/modules/configuration/RecipeConverter';
import { LootTableConverter } from '../../../src/modules/configuration/LootTableConverter';
import { ManifestGenerator } from '../../../src/modules/configuration/ManifestGenerator';
import { JavaParser } from '../../../src/modules/logic/JavaParser';
import { MMIRGenerator } from '../../../src/modules/logic/MMIRGenerator';
import { ASTTranspiler } from '../../../src/modules/logic/ASTTranspiler';
import { JavaScriptGenerator } from '../../../src/modules/logic/JavaScriptGenerator';
import fs from 'fs';
import path from 'path';

describe('Conversion Pipeline Integration', () => {
  let tempDir: string;
  let mockMod: any;
  let extractPath: string;
  
  beforeAll(async () => {
    // Create temporary directory
    tempDir = createTempDirectory();
    
    // Load mock mod from fixtures
    mockMod = loadMockMod('mock-forge-mod');
    
    // Create mod directory structure
    extractPath = path.join(tempDir, 'mock-forge-mod');
    fs.mkdirSync(extractPath, { recursive: true });
    
    // Create files from mock mod
    for (const [filePath, content] of Object.entries(mockMod.files)) {
      const fullPath = path.join(extractPath, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
    
    // Create source code directory
    const sourceCodePath = path.join(tempDir, 'source-code');
    fs.mkdirSync(sourceCodePath, { recursive: true });
    
    // Create source files from mock mod
    for (const [filePath, content] of Object.entries(mockMod.sourceCode)) {
      const fullPath = path.join(sourceCodePath, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  });
  
  afterAll(() => {
    // Clean up
    cleanupTempDirectory(tempDir);
  });
  
  it('should convert assets correctly', async () => {
    // Create output directory for assets
    const outputDir = path.join(tempDir, 'output/assets');
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Convert textures
    const textureConverter = new TextureConverter();
    const textureResult = await textureConverter.convert(
      extractPath,
      outputDir,
      { modId: 'mock-forge-mod' }
    );
    
    expect(textureResult.success).toBe(true);
    expect(textureResult.convertedFiles.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(outputDir, 'textures'))).toBe(true);
    
    // Convert models
    const modelConverter = new ModelConverter();
    const modelResult = await modelConverter.convert(
      extractPath,
      outputDir,
      { modId: 'mock-forge-mod' }
    );
    
    expect(modelResult.success).toBe(true);
    expect(modelResult.convertedFiles.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(outputDir, 'models'))).toBe(true);
    
    // Convert sounds
    const soundProcessor = new SoundProcessor();
    const soundResult = await soundProcessor.convert(
      extractPath,
      outputDir,
      { modId: 'mock-forge-mod' }
    );
    
    expect(soundResult.success).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'sounds.json'))).toBe(true);
  });
  
  it('should convert configuration files correctly', async () => {
    // Create output directory for configuration
    const outputDir = path.join(tempDir, 'output/config');
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Generate manifest
    const manifestGenerator = new ManifestGenerator();
    const manifestResult = await manifestGenerator.generate({
      modId: 'mock-forge-mod',
      name: 'Mock Forge Mod',
      version: '1.0.0',
      description: 'A mock Forge mod for testing',
      author: 'Test Author',
    });
    
    expect(manifestResult.behaviorPack).toBeDefined();
    expect(manifestResult.resourcePack).toBeDefined();
    
    // Write manifests to output directory
    fs.writeFileSync(
      path.join(outputDir, 'behavior_pack/manifest.json'),
      JSON.stringify(manifestResult.behaviorPack, null, 2)
    );
    fs.writeFileSync(
      path.join(outputDir, 'resource_pack/manifest.json'),
      JSON.stringify(manifestResult.resourcePack, null, 2)
    );
    
    // Convert block/item definitions
    const definitionConverter = new BlockItemDefinitionConverter();
    const definitionResult = await definitionConverter.convert(
      extractPath,
      path.join(outputDir, 'behavior_pack'),
      { modId: 'mock-forge-mod' }
    );
    
    expect(definitionResult.success).toBe(true);
    expect(definitionResult.blocks.length + definitionResult.items.length).toBeGreaterThan(0);
    
    // Convert recipes
    const recipeConverter = new RecipeConverter();
    const recipeResult = await recipeConverter.convert(
      extractPath,
      path.join(outputDir, 'behavior_pack'),
      { modId: 'mock-forge-mod' }
    );
    
    expect(recipeResult.success).toBe(true);
    expect(recipeResult.convertedFiles.length).toBeGreaterThan(0);
    
    // Convert loot tables
    const lootTableConverter = new LootTableConverter();
    const lootTableResult = await lootTableConverter.convert(
      extractPath,
      path.join(outputDir, 'behavior_pack'),
      { modId: 'mock-forge-mod' }
    );
    
    expect(lootTableResult.success).toBe(true);
    expect(lootTableResult.convertedFiles.length).toBeGreaterThan(0);
  });
  
  it('should convert Java code to JavaScript', async () => {
    // Create output directory for scripts
    const outputDir = path.join(tempDir, 'output/scripts');
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Get source code files
    const sourceCodeDir = path.join(tempDir, 'source-code');
    const javaFiles = Object.entries(mockMod.sourceCode)
      .filter(([filePath]) => filePath.endsWith('.java'))
      .map(([filePath, content]) => ({
        path: filePath,
        content: content as string,
      }));
    
    // Parse Java code
    const javaParser = new JavaParser();
    const parseResults = await Promise.all(
      javaFiles.map(file => javaParser.parse(file.content, file.path))
    );
    
    expect(parseResults.every(result => result.success)).toBe(true);
    
    // Generate MMIR
    const mmirGenerator = new MMIRGenerator();
    const mmirContext = await mmirGenerator.generate(
      parseResults.map(result => result.ast),
      { modId: 'mock-forge-mod', modLoader: 'forge' }
    );
    
    expect(mmirContext.nodes.length).toBeGreaterThan(0);
    
    // Transpile to JavaScript AST
    const astTranspiler = new ASTTranspiler();
    const jsAst = await astTranspiler.transpile(mmirContext, {
      modId: 'mock-forge-mod',
      apiMappings: [],
    });
    
    expect(jsAst).toBeDefined();
    
    // Generate JavaScript code
    const jsGenerator = new JavaScriptGenerator();
    const jsCode = jsGenerator.generate(jsAst);
    
    expect(jsCode).toBeDefined();
    expect(typeof jsCode).toBe('string');
    expect(jsCode.length).toBeGreaterThan(0);
    
    // Write JavaScript code to output directory
    fs.writeFileSync(path.join(outputDir, 'main.js'), jsCode);
    
    // Verify the JavaScript file exists
    expect(fs.existsSync(path.join(outputDir, 'main.js'))).toBe(true);
  });
});