import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a temporary directory for integration tests
 */
export function createTempDirectory(): string {
  const tempDir = path.join(os.tmpdir(), `minecraft-mod-converter-test-${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Cleans up a temporary directory
 */
export function cleanupTempDirectory(directory: string): void {
  if (fs.existsSync(directory)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Creates a mock mod file for testing
 */
export function createMockModFile(directory: string, modId: string, modLoader: 'forge' | 'fabric'): string {
  const modFile = path.join(directory, `${modId}.jar`);
  
  // Create a simple ZIP file structure
  const JSZip = require('jszip');
  const zip = new JSZip();
  
  // Add manifest
  zip.file('META-INF/MANIFEST.MF', `Manifest-Version: 1.0\nModId: ${modId}\nVersion: 1.0.0`);
  
  // Add mod-specific files
  if (modLoader === 'forge') {
    zip.file('META-INF/mods.toml', `modId="${modId}"\nversion="1.0.0"\ndisplayName="Test Forge Mod"`);
    zip.file('com/example/testmod/TestMod.class', 'mock class file content');
  } else {
    zip.file('fabric.mod.json', `{"id": "${modId}", "version": "1.0.0", "name": "Test Fabric Mod"}`);
    zip.file('com/example/testmod/TestMod.class', 'mock class file content');
  }
  
  // Add license
  zip.file('LICENSE', 'MIT License\n\nCopyright (c) 2023 Test Author\n');
  
  // Add assets
  zip.file(`assets/${modId}/textures/block/test_block.png`, Buffer.from([0x89, 0x50, 0x4E, 0x47])); // PNG header
  zip.file(`assets/${modId}/models/block/test_block.json`, `{"parent": "block/cube_all", "textures": {"all": "${modId}:block/test_block"}}`);
  
  // Add data
  zip.file(`data/${modId}/recipes/test_recipe.json`, `{"type": "minecraft:crafting_shaped", "pattern": ["###", "# #", "###"], "key": {"#": {"item": "minecraft:stone"}}, "result": {"item": "${modId}:test_block"}}`);
  
  // Generate the ZIP file
  const zipBuffer = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
  const writeStream = fs.createWriteStream(modFile);
  zipBuffer.pipe(writeStream);
  
  return new Promise<string>((resolve, reject) => {
    writeStream.on('finish', () => resolve(modFile));
    writeStream.on('error', reject);
  });
}

/**
 * Loads a mock mod from fixtures
 */
export function loadMockMod(modName: string): any {
  const fixturePath = path.join(__dirname, '../fixtures', `${modName}.json`);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

/**
 * Creates a mock GitHub repository structure
 */
export function createMockGitHubRepo(directory: string, modId: string, modLoader: 'forge' | 'fabric'): string {
  const repoDir = path.join(directory, `${modId}-repo`);
  fs.mkdirSync(repoDir, { recursive: true });
  
  // Create source directory structure
  const srcDir = path.join(repoDir, 'src/main/java/com/example/testmod');
  fs.mkdirSync(srcDir, { recursive: true });
  
  // Create resource directory structure
  const resourceDir = path.join(repoDir, `src/main/resources/assets/${modId}`);
  fs.mkdirSync(path.join(resourceDir, 'textures/block'), { recursive: true });
  fs.mkdirSync(path.join(resourceDir, 'models/block'), { recursive: true });
  
  // Create data directory structure
  const dataDir = path.join(repoDir, `src/main/resources/data/${modId}`);
  fs.mkdirSync(path.join(dataDir, 'recipes'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'loot_tables/blocks'), { recursive: true });
  
  // Create main mod file
  const mainModContent = modLoader === 'forge'
    ? `package com.example.testmod;

import net.minecraftforge.fml.common.Mod;

@Mod("${modId}")
public class TestMod {
    public TestMod() {
        // Mod initialization
    }
}`
    : `package com.example.testmod;

import net.fabricmc.api.ModInitializer;

public class TestMod implements ModInitializer {
    @Override
    public void onInitialize() {
        // Mod initialization
    }
}`;
  
  fs.writeFileSync(path.join(srcDir, 'TestMod.java'), mainModContent);
  
  // Create block class
  const blockClassContent = `package com.example.testmod.blocks;

import net.minecraft.world.level.block.Block;

public class TestBlock extends Block {
    public TestBlock(Properties properties) {
        super(properties);
    }
}`;
  
  fs.mkdirSync(path.join(srcDir, 'blocks'), { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'blocks/TestBlock.java'), blockClassContent);
  
  // Create item class
  const itemClassContent = `package com.example.testmod.items;

import net.minecraft.world.item.Item;

public class TestItem extends Item {
    public TestItem(Properties properties) {
        super(properties);
    }
}`;
  
  fs.mkdirSync(path.join(srcDir, 'items'), { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'items/TestItem.java'), itemClassContent);
  
  // Create texture file (simple PNG header)
  fs.writeFileSync(path.join(resourceDir, 'textures/block/test_block.png'), Buffer.from([0x89, 0x50, 0x4E, 0x47]));
  
  // Create model file
  const modelContent = `{
  "parent": "block/cube_all",
  "textures": {
    "all": "${modId}:block/test_block"
  }
}`;
  
  fs.writeFileSync(path.join(resourceDir, 'models/block/test_block.json'), modelContent);
  
  // Create recipe file
  const recipeContent = `{
  "type": "minecraft:crafting_shaped",
  "pattern": [
    "###",
    "# #",
    "###"
  ],
  "key": {
    "#": {
      "item": "minecraft:stone"
    }
  },
  "result": {
    "item": "${modId}:test_block"
  }
}`;
  
  fs.writeFileSync(path.join(dataDir, 'recipes/test_recipe.json'), recipeContent);
  
  // Create loot table file
  const lootTableContent = `{
  "type": "minecraft:block",
  "pools": [
    {
      "rolls": 1,
      "entries": [
        {
          "type": "minecraft:item",
          "name": "${modId}:test_block"
        }
      ]
    }
  ]
}`;
  
  fs.writeFileSync(path.join(dataDir, 'loot_tables/blocks/test_block.json'), lootTableContent);
  
  // Create build file
  const buildFileContent = modLoader === 'forge'
    ? `plugins {
    id 'net.minecraftforge.gradle' version '5.1.+'
}

group = 'com.example'
version = '1.0.0'

minecraft {
    mappings channel: 'official', version: '1.19.2'
}

dependencies {
    minecraft 'net.minecraftforge:forge:1.19.2-43.1.7'
}`
    : `plugins {
    id 'fabric-loom' version '0.12.+'
}

group = 'com.example'
version = '1.0.0'

dependencies {
    minecraft "com.mojang:minecraft:1.19.2"
    mappings "net.fabricmc:yarn:1.19.2+build.1"
    modImplementation "net.fabricmc:fabric-loader:0.14.9"
}`;
  
  fs.writeFileSync(path.join(repoDir, 'build.gradle'), buildFileContent);
  
  // Create license file
  fs.writeFileSync(path.join(repoDir, 'LICENSE'), 'MIT License\n\nCopyright (c) 2023 Test Author\n');
  
  return repoDir;
}

/**
 * Verifies the structure of a generated Bedrock addon
 */
export function verifyAddonStructure(addonPath: string): boolean {
  try {
    // Check if the addon file exists
    if (!fs.existsSync(addonPath)) {
      console.error(`Addon file not found: ${addonPath}`);
      return false;
    }
    
    // Extract the addon to a temporary directory
    const extractDir = path.join(path.dirname(addonPath), 'extract');
    fs.mkdirSync(extractDir, { recursive: true });
    
    // Use JSZip to extract the addon
    const JSZip = require('jszip');
    const addonData = fs.readFileSync(addonPath);
    const zip = await JSZip.loadAsync(addonData);
    
    // Extract all files
    for (const [filename, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const content = await file.async('nodebuffer');
        const filePath = path.join(extractDir, filename);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
      }
    }
    
    // Check for required files
    const requiredFiles = [
      'manifest.json',
      'pack_icon.png',
      'scripts/main.js',
    ];
    
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(extractDir, file))) {
        console.error(`Required file not found in addon: ${file}`);
        return false;
      }
    }
    
    // Clean up
    cleanupTempDirectory(extractDir);
    
    return true;
  } catch (error) {
    console.error('Error verifying addon structure:', error);
    return false;
  }
}