/**
 * Unit tests for JavaAnalyzer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  JavaAnalyzer,
} from '../../../../src/modules/ingestion/JavaAnalyzer.js';

describe('JavaAnalyzer', () => {
  let analyzer: JavaAnalyzer;
  let tempDir: string;
  let testJarPath: string;

  beforeEach(async () => {
    analyzer = new JavaAnalyzer();
    tempDir = path.join(process.cwd(), 'temp', 'test-java-analyzer');
    await fs.mkdir(tempDir, { recursive: true });
    testJarPath = path.join(tempDir, 'test-mod.jar');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('analyzeJarForMVP', () => {
    it('should analyze a valid Forge mod JAR file', async () => {
      // Create a mock JAR file with Forge structure
      const zip = new AdmZip();

      // Add mods.toml
      const modsToml = `
modLoader="javafml"
loaderVersion="[40,)"
license="MIT"

[[mods]]
modId="testmod"
version="1.0.0"
displayName="Test Mod"
description="A test mod"
authors="Test Author"

[[dependencies.testmod]]
modId="forge"
mandatory=true
versionRange="[40,)"
ordering="NONE"
side="BOTH"
      `;
      zip.addFile('META-INF/mods.toml', Buffer.from(modsToml));

      // Add some texture files
      zip.addFile('assets/testmod/textures/block/test_block.png', Buffer.from('fake-png-data'));
      zip.addFile('assets/testmod/textures/item/test_item.png', Buffer.from('fake-png-data'));

      // Add lang file
      const langFile = JSON.stringify({
        'block.testmod.test_block': 'Test Block',
        'item.testmod.test_item': 'Test Item',
      });
      zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(langFile));

      // Add model files
      const blockModel = JSON.stringify({
        parent: 'block/cube_all',
        textures: {
          all: 'testmod:block/test_block',
        },
      });
      zip.addFile('assets/testmod/models/block/test_block.json', Buffer.from(blockModel));

      // Add some class files
      zip.addFile('com/testmod/blocks/TestBlock.class', Buffer.from('fake-class-data'));
      zip.addFile('com/testmod/items/TestItem.class', Buffer.from('fake-class-data'));

      // Write the JAR file
      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result).toBeDefined();
      expect(result.modId).toBe('testmod');
      expect(result.manifestInfo.modId).toBe('testmod');
      expect(result.manifestInfo.modName).toBe('Test Mod');
      expect(result.manifestInfo.version).toBe('1.0.0');
      expect(result.manifestInfo.author).toBe('Test Author');
      expect(result.manifestInfo.dependencies).toHaveLength(1);
      expect(result.manifestInfo.dependencies[0].modId).toBe('forge');
      expect(result.texturePaths).toContain('assets/testmod/textures/block/test_block.png');
      expect(result.texturePaths).toContain('assets/testmod/textures/item/test_item.png');
      expect(result.registryNames).toContain('test_block');
      expect(result.registryNames).toContain('test_item');
      expect(result.analysisNotes.length).toBeGreaterThan(0); // Should have analysis notes
    });

    it('should analyze a valid Fabric mod JAR file', async () => {
      // Create a mock JAR file with Fabric structure
      const zip = new AdmZip();

      // Add fabric.mod.json
      const fabricMod = {
        schemaVersion: 1,
        id: 'fabrictest',
        version: '2.0.0',
        name: 'Fabric Test Mod',
        description: 'A test fabric mod',
        authors: ['Fabric Author'],
        depends: {
          fabricloader: '>=0.14.0',
          minecraft: '~1.19.2',
        },
      };
      zip.addFile('fabric.mod.json', Buffer.from(JSON.stringify(fabricMod)));

      // Add some texture files
      zip.addFile(
        'assets/fabrictest/textures/block/fabric_block.png',
        Buffer.from('fake-png-data')
      );

      // Write the JAR file
      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result).toBeDefined();
      expect(result.modId).toBe('fabrictest');
      expect(result.manifestInfo.modId).toBe('fabrictest');
      expect(result.manifestInfo.modName).toBe('Fabric Test Mod');
      expect(result.manifestInfo.version).toBe('2.0.0');
      expect(result.manifestInfo.dependencies).toHaveLength(2);
      expect(result.texturePaths).toContain('assets/fabrictest/textures/block/fabric_block.png');
    });

    it('should handle JAR files with missing manifest gracefully', async () => {
      // Create a JAR file without any manifest files
      const zip = new AdmZip();
      zip.addFile('some/random/file.txt', Buffer.from('random content'));
      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result).toBeDefined();
      expect(result.modId).toBe('unknown'); // Should fallback to unknown
      expect(result.manifestInfo.modId).toBe('unknown');
      expect(result.manifestInfo.modName).toBe('Unknown Mod');
      expect(result.registryNames).toEqual([]);
      expect(result.texturePaths).toEqual([]);
      expect(result.analysisNotes.some((note) => note.type === 'info')).toBe(true);
    });

    it('should handle invalid JAR files gracefully', async () => {
      // Create an invalid file
      await fs.writeFile(testJarPath, 'not a jar file');

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result).toBeDefined();
      expect(result.modId).toBe('unknown');
      expect(result.analysisNotes.some((note) => note.type === 'error')).toBe(true);
    });
  });

  describe('extractFromClassFiles', () => {
    it('should extract registry names from class file names', async () => {
      const zip = new AdmZip();
      zip.addFile('com/testmod/blocks/DiamondBlock.class', Buffer.from('fake-class-data'));
      zip.addFile('com/testmod/items/GoldItem.class', Buffer.from('fake-class-data'));
      zip.addFile('com/testmod/entities/TestEntity.class', Buffer.from('fake-class-data'));
      zip.addFile('com/testmod/tiles/ChestTileEntity.class', Buffer.from('fake-class-data'));
      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result.registryNames).toContain('diamond');
      expect(result.registryNames).toContain('gold');
      expect(result.registryNames).toContain('test');
      expect(result.registryNames).toContain('chest');
    });
  });

  describe('extractFromJsonFiles', () => {
    it('should extract registry names from JSON files', async () => {
      const zip = new AdmZip();

      const jsonData = {
        blocks: {
          test_block: { hardness: 2.0 },
          another_block: { hardness: 1.5 },
        },
        items: {
          test_item: { maxStackSize: 64 },
        },
      };
      zip.addFile('data/testmod/registry.json', Buffer.from(JSON.stringify(jsonData)));
      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result.registryNames).toContain('test_block');
      expect(result.registryNames).toContain('another_block');
      expect(result.registryNames).toContain('test_item');
    });
  });

  describe('extractFromLangFiles', () => {
    it('should extract registry names from language files', async () => {
      const zip = new AdmZip();

      const langData = {
        'block.testmod.copper_block': 'Copper Block',
        'item.testmod.copper_ingot': 'Copper Ingot',
        'entity.testmod.test_entity': 'Test Entity',
        'gui.testmod.inventory': 'Inventory', // Should not be extracted
      };
      zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));
      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result.registryNames).toContain('copper_block');
      expect(result.registryNames).toContain('copper_ingot');
      expect(result.registryNames).not.toContain('inventory');
    });
  });

  describe('extractFromModelFiles', () => {
    it('should extract registry names from model files', async () => {
      const zip = new AdmZip();

      const blockModel = {
        parent: 'block/cube_all',
        textures: {
          all: 'testmod:block/iron_block',
          side: 'testmod:block/iron_side',
        },
      };
      zip.addFile(
        'assets/testmod/models/block/iron_block.json',
        Buffer.from(JSON.stringify(blockModel))
      );

      const itemModel = {
        parent: 'item/generated',
        textures: {
          layer0: 'testmod:item/iron_sword',
        },
      };
      zip.addFile(
        'assets/testmod/models/item/iron_sword.json',
        Buffer.from(JSON.stringify(itemModel))
      );
      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result.registryNames).toContain('iron_block');
      expect(result.registryNames).toContain('iron_sword');
      expect(result.registryNames).toContain('iron_side');
    });
  });

  describe('detectTexturePaths', () => {
    it('should detect all texture files in the JAR', async () => {
      const zip = new AdmZip();
      zip.addFile('assets/testmod/textures/block/stone.png', Buffer.from('fake-png'));
      zip.addFile('assets/testmod/textures/item/sword.png', Buffer.from('fake-png'));
      zip.addFile('assets/testmod/textures/entity/player.png', Buffer.from('fake-png'));
      zip.addFile('assets/testmod/models/block/stone.json', Buffer.from('{}'));
      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result.texturePaths).toHaveLength(3);
      expect(result.texturePaths).toContain('assets/testmod/textures/block/stone.png');
      expect(result.texturePaths).toContain('assets/testmod/textures/item/sword.png');
      expect(result.texturePaths).toContain('assets/testmod/textures/entity/player.png');
    });
  });

  describe('parseManifestInfo', () => {
    it('should prioritize mods.toml over other manifest files', async () => {
      const zip = new AdmZip();

      // Add multiple manifest files
      const modsToml = `
[[mods]]
modId="priority_test"
displayName="Priority Test"
version="1.0.0"
      `;
      zip.addFile('META-INF/mods.toml', Buffer.from(modsToml));

      const fabricMod = {
        id: 'fabric_test',
        name: 'Fabric Test',
        version: '2.0.0',
      };
      zip.addFile('fabric.mod.json', Buffer.from(JSON.stringify(fabricMod)));

      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      // Should use mods.toml data
      expect(result.manifestInfo.modId).toBe('priority_test');
      expect(result.manifestInfo.modName).toBe('Priority Test');
      expect(result.manifestInfo.version).toBe('1.0.0');
    });

    it('should fall back to fabric.mod.json if mods.toml is not present', async () => {
      const zip = new AdmZip();

      const fabricMod = {
        id: 'fabric_fallback',
        name: 'Fabric Fallback',
        version: '3.0.0',
      };
      zip.addFile('fabric.mod.json', Buffer.from(JSON.stringify(fabricMod)));

      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result.manifestInfo.modId).toBe('fabric_fallback');
      expect(result.manifestInfo.modName).toBe('Fabric Fallback');
      expect(result.manifestInfo.version).toBe('3.0.0');
    });

    it('should fall back to mcmod.info if other manifests are not present', async () => {
      const zip = new AdmZip();

      const mcmodInfo = [
        {
          modid: 'mcmod_fallback',
          name: 'McmodInfo Fallback',
          version: '4.0.0',
          description: 'Test description',
        },
      ];
      zip.addFile('mcmod.info', Buffer.from(JSON.stringify(mcmodInfo)));

      zip.writeZip(testJarPath);

      const result = await analyzer.analyzeJarForMVP(testJarPath);

      expect(result.manifestInfo.modId).toBe('mcmod_fallback');
      expect(result.manifestInfo.modName).toBe('McmodInfo Fallback');
      expect(result.manifestInfo.version).toBe('4.0.0');
    });
  });
});
