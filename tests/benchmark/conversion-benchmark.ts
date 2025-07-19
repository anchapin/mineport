import { runBenchmarkSuite, saveBenchmarkResults, updateBenchmarkHistory } from './benchmark-utils';
import { createTempDirectory, cleanupTempDirectory, createMockModFile, loadMockMod } from '../integration/helpers';
import { ModValidator } from '../../src/modules/ingestion/ModValidator';
import { FeatureCompatibilityAnalyzer } from '../../src/modules/ingestion/FeatureCompatibilityAnalyzer';
import { TextureConverter } from '../../src/modules/assets/TextureConverter';
import { ModelConverter } from '../../src/modules/assets/ModelConverter';
import { BlockItemDefinitionConverter } from '../../src/modules/configuration/BlockItemDefinitionConverter';
import { RecipeConverter } from '../../src/modules/configuration/RecipeConverter';
import { JavaParser } from '../../src/modules/logic/JavaParser';
import { MMIRGenerator } from '../../src/modules/logic/MMIRGenerator';
import { ASTTranspiler } from '../../src/modules/logic/ASTTranspiler';
import { JavaScriptGenerator } from '../../src/modules/logic/JavaScriptGenerator';
import { AddonPackager } from '../../src/modules/packaging/AddonPackager';
import fs from 'fs';
import path from 'path';

/**
 * Runs the conversion pipeline benchmark
 */
async function runConversionBenchmark() {
  // Create temporary directory
  const tempDir = createTempDirectory();
  
  try {
    // Load mock mod from fixtures
    const mockMod = loadMockMod('mock-forge-mod');
    
    // Create mod directory structure
    const extractPath = path.join(tempDir, 'mock-forge-mod');
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
    
    // Create output directories
    const outputDir = path.join(tempDir, 'output');
    const assetsOutputDir = path.join(outputDir, 'assets');
    const configOutputDir = path.join(outputDir, 'config');
    const scriptsOutputDir = path.join(outputDir, 'scripts');
    const behaviorPackDir = path.join(outputDir, 'behavior_pack');
    const resourcePackDir = path.join(outputDir, 'resource_pack');
    
    fs.mkdirSync(assetsOutputDir, { recursive: true });
    fs.mkdirSync(configOutputDir, { recursive: true });
    fs.mkdirSync(scriptsOutputDir, { recursive: true });
    fs.mkdirSync(behaviorPackDir, { recursive: true });
    fs.mkdirSync(resourcePackDir, { recursive: true });
    
    // Run benchmark suite
    const benchmarkSuite = await runBenchmarkSuite('Conversion Pipeline', [
      {
        name: 'ModValidator',
        fn: async () => {
          const modValidator = new ModValidator();
          const modBuffer = fs.readFileSync(path.join(__dirname, '../fixtures/mock-forge-mod.json'));
          await modValidator.validate(modBuffer);
        },
      },
      {
        name: 'FeatureCompatibilityAnalyzer',
        fn: async () => {
          const featureAnalyzer = new FeatureCompatibilityAnalyzer();
          await featureAnalyzer.analyze(extractPath);
        },
      },
      {
        name: 'TextureConverter',
        fn: async () => {
          const textureConverter = new TextureConverter();
          await textureConverter.convert(
            extractPath,
            assetsOutputDir,
            { modId: 'mock-forge-mod' }
          );
        },
      },
      {
        name: 'ModelConverter',
        fn: async () => {
          const modelConverter = new ModelConverter();
          await modelConverter.convert(
            extractPath,
            assetsOutputDir,
            { modId: 'mock-forge-mod' }
          );
        },
      },
      {
        name: 'BlockItemDefinitionConverter',
        fn: async () => {
          const definitionConverter = new BlockItemDefinitionConverter();
          await definitionConverter.convert(
            extractPath,
            behaviorPackDir,
            { modId: 'mock-forge-mod' }
          );
        },
      },
      {
        name: 'RecipeConverter',
        fn: async () => {
          const recipeConverter = new RecipeConverter();
          await recipeConverter.convert(
            extractPath,
            behaviorPackDir,
            { modId: 'mock-forge-mod' }
          );
        },
      },
      {
        name: 'JavaCodeTranspilation',
        fn: async () => {
          // Get source code files
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
          
          // Generate MMIR
          const mmirGenerator = new MMIRGenerator();
          const mmirContext = await mmirGenerator.generate(
            parseResults.map(result => result.ast),
            { modId: 'mock-forge-mod', modLoader: 'forge' }
          );
          
          // Transpile to JavaScript AST
          const astTranspiler = new ASTTranspiler();
          const jsAst = await astTranspiler.transpile(mmirContext, {
            modId: 'mock-forge-mod',
            apiMappings: [],
          });
          
          // Generate JavaScript code
          const jsGenerator = new JavaScriptGenerator();
          const jsCode = jsGenerator.generate(jsAst);
          
          // Write JavaScript code to output directory
          fs.writeFileSync(path.join(scriptsOutputDir, 'main.js'), jsCode);
        },
      },
      {
        name: 'AddonPackaging',
        fn: async () => {
          // Create basic manifest files for packaging
          fs.writeFileSync(
            path.join(behaviorPackDir, 'manifest.json'),
            JSON.stringify({
              format_version: 2,
              header: {
                name: 'Mock Forge Mod',
                description: 'A mock Forge mod for testing',
                uuid: '00000000-0000-0000-0000-000000000001',
                version: [1, 0, 0],
                min_engine_version: [1, 19, 0]
              },
              modules: [
                {
                  type: 'data',
                  uuid: '00000000-0000-0000-0000-000000000002',
                  version: [1, 0, 0]
                }
              ]
            }, null, 2)
          );
          
          fs.writeFileSync(
            path.join(resourcePackDir, 'manifest.json'),
            JSON.stringify({
              format_version: 2,
              header: {
                name: 'Mock Forge Mod Resources',
                description: 'Resources for Mock Forge Mod',
                uuid: '00000000-0000-0000-0000-000000000003',
                version: [1, 0, 0],
                min_engine_version: [1, 19, 0]
              },
              modules: [
                {
                  type: 'resources',
                  uuid: '00000000-0000-0000-0000-000000000004',
                  version: [1, 0, 0]
                }
              ]
            }, null, 2)
          );
          
          // Create pack icons
          fs.writeFileSync(
            path.join(behaviorPackDir, 'pack_icon.png'),
            Buffer.from([0x89, 0x50, 0x4E, 0x47]) // PNG header
          );
          fs.writeFileSync(
            path.join(resourcePackDir, 'pack_icon.png'),
            Buffer.from([0x89, 0x50, 0x4E, 0x47]) // PNG header
          );
          
          // Package the addon
          const addonPackager = new AddonPackager();
          await addonPackager.package({
            behaviorPackDir,
            resourcePackDir,
            outputDir,
            modId: 'mock-forge-mod',
            modName: 'Mock Forge Mod',
            includeSource: true,
          });
        },
      },
    ]);
    
    // Save benchmark results
    const resultsPath = path.join(__dirname, '../../benchmark-results');
    fs.mkdirSync(resultsPath, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    saveBenchmarkResults(
      benchmarkSuite,
      path.join(resultsPath, `conversion-benchmark-${timestamp}.json`)
    );
    
    // Update benchmark history
    updateBenchmarkHistory(
      benchmarkSuite,
      path.join(resultsPath, 'benchmark-history.json')
    );
    
    // Print results
    console.log('Benchmark results:');
    console.log(`Total duration: ${benchmarkSuite.totalDuration.toFixed(2)}ms`);
    console.log(`Average duration: ${benchmarkSuite.averageDuration.toFixed(2)}ms`);
    console.log('\nIndividual benchmarks:');
    
    benchmarkSuite.results.forEach(result => {
      console.log(`- ${result.name}: ${result.duration.toFixed(2)}ms`);
    });
    
    return benchmarkSuite;
  } finally {
    // Clean up
    cleanupTempDirectory(tempDir);
  }
}

// Run the benchmark if this file is executed directly
if (require.main === module) {
  runConversionBenchmark().catch(error => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
}

export { runConversionBenchmark };