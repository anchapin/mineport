import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JavaAnalyzer } from '@modules/ingestion/JavaAnalyzer';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';

describe('JavaAnalyzer - Enhanced Tests', () => {
  let javaAnalyzer: JavaAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    javaAnalyzer = new JavaAnalyzer();
    tempDir = path.join(process.cwd(), 'temp', `analyzer-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Multi-Strategy Registry Extraction', () => {
    it('should extract registry names from class files', async () => {
      const zip = new AdmZip();

      // Mock Java class content with registry calls
      const classContent = `
        public class TestBlock extends Block {
          public static final Block TEST_BLOCK = Registry.register(
            Registry.BLOCK,
            new Identifier("testmod", "test_block"),
            new TestBlock()
          );
        }
      `;

      zip.addFile('TestBlock.java', Buffer.from(classContent));
      zip.addFile('META-INF/MANIFEST.MF', Buffer.from('Manifest-Version: 1.0\n'));

      const jarPath = path.join(tempDir, 'test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.registryNames).toContain('test_block');
      expect(result.modId).toBe('testmod');
    });

    it('should extract registry names from JSON files', async () => {
      const zip = new AdmZip();

      const blockstatesJson = {
        variants: {
          '': {
            model: 'testmod:block/custom_block',
          },
        },
      };

      const modelsJson = {
        parent: 'block/cube_all',
        textures: {
          all: 'testmod:block/custom_block',
        },
      };

      zip.addFile(
        'assets/testmod/blockstates/custom_block.json',
        Buffer.from(JSON.stringify(blockstatesJson))
      );
      zip.addFile(
        'assets/testmod/models/block/custom_block.json',
        Buffer.from(JSON.stringify(modelsJson))
      );

      const jarPath = path.join(tempDir, 'json-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.registryNames).toContain('custom_block');
      expect(result.texturePaths).toContain('assets/testmod/textures/block/custom_block.png');
    });

    it('should extract registry names from lang files', async () => {
      const zip = new AdmZip();

      const langData = {
        'block.testmod.magic_block': 'Magic Block',
        'item.testmod.magic_wand': 'Magic Wand',
        'itemGroup.testmod.general': 'Test Mod Items',
      };

      zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

      const jarPath = path.join(tempDir, 'lang-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.registryNames).toContain('magic_block');
      expect(result.registryNames).toContain('magic_wand');
    });

    it('should extract registry names from model files', async () => {
      const zip = new AdmZip();

      const itemModel = {
        parent: 'item/generated',
        textures: {
          layer0: 'testmod:item/special_item',
        },
      };

      const blockModel = {
        parent: 'block/cube_all',
        textures: {
          all: 'testmod:block/special_block',
        },
      };

      zip.addFile(
        'assets/testmod/models/item/special_item.json',
        Buffer.from(JSON.stringify(itemModel))
      );
      zip.addFile(
        'assets/testmod/models/block/special_block.json',
        Buffer.from(JSON.stringify(blockModel))
      );

      const jarPath = path.join(tempDir, 'model-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.registryNames).toContain('special_item');
      expect(result.registryNames).toContain('special_block');
    });

    it('should combine results from all strategies', async () => {
      const zip = new AdmZip();

      // Add content for all strategies
      const classContent =
        'Registry.register(Registry.BLOCK, new Identifier("testmod", "class_block"), new Block())';
      const langData = { 'block.testmod.lang_block': 'Lang Block' };
      const modelData = { parent: 'block/cube', textures: { all: 'testmod:block/model_block' } };

      zip.addFile('TestClass.java', Buffer.from(classContent));
      zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));
      zip.addFile(
        'assets/testmod/models/block/model_block.json',
        Buffer.from(JSON.stringify(modelData))
      );

      const jarPath = path.join(tempDir, 'combined-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.registryNames).toContain('class_block');
      expect(result.registryNames).toContain('lang_block');
      expect(result.registryNames).toContain('model_block');
      expect(result.registryNames).toHaveLength(3);
    });
  });

  describe('Texture Path Detection', () => {
    it('should detect texture paths from various sources', async () => {
      const zip = new AdmZip();

      // Add actual texture files
      zip.addFile('assets/testmod/textures/block/stone.png', Buffer.from('fake png'));
      zip.addFile('assets/testmod/textures/item/sword.png', Buffer.from('fake png'));
      zip.addFile('assets/testmod/textures/entity/player.png', Buffer.from('fake png'));

      // Add model files that reference textures
      const blockModel = {
        textures: {
          all: 'testmod:block/referenced_texture',
        },
      };
      zip.addFile('assets/testmod/models/block/test.json', Buffer.from(JSON.stringify(blockModel)));

      const jarPath = path.join(tempDir, 'texture-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.texturePaths).toContain('assets/testmod/textures/block/stone.png');
      expect(result.texturePaths).toContain('assets/testmod/textures/item/sword.png');
      expect(result.texturePaths).toContain('assets/testmod/textures/entity/player.png');
      expect(result.texturePaths).toContain('assets/testmod/textures/block/referenced_texture.png');
    });

    it('should handle nested texture directories', async () => {
      const zip = new AdmZip();

      zip.addFile(
        'assets/testmod/textures/block/variants/stone_variant.png',
        Buffer.from('fake png')
      );
      zip.addFile('assets/testmod/textures/item/tools/sword_diamond.png', Buffer.from('fake png'));

      const jarPath = path.join(tempDir, 'nested-texture-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.texturePaths).toContain(
        'assets/testmod/textures/block/variants/stone_variant.png'
      );
      expect(result.texturePaths).toContain('assets/testmod/textures/item/tools/sword_diamond.png');
    });
  });

  describe('Manifest Parsing', () => {
    it('should parse mcmod.info format', async () => {
      const zip = new AdmZip();

      const mcmodInfo = [
        {
          modid: 'testmod',
          name: 'Test Mod',
          description: 'A test mod for unit testing',
          version: '1.0.0',
          authorList: ['TestAuthor'],
          dependencies: ['forge@[14.23.5.2847,)'],
        },
      ];

      zip.addFile('mcmod.info', Buffer.from(JSON.stringify(mcmodInfo)));

      const jarPath = path.join(tempDir, 'mcmod-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.manifestInfo.modId).toBe('testmod');
      expect(result.manifestInfo.modName).toBe('Test Mod');
      expect(result.manifestInfo.version).toBe('1.0.0');
      expect(result.manifestInfo.description).toBe('A test mod for unit testing');
      expect(result.manifestInfo.author).toBe('TestAuthor');
    });

    it('should parse mods.toml format', async () => {
      const zip = new AdmZip();

      const modsToml = `
        modLoader="javafml"
        loaderVersion="[36,)"
        license="MIT"

        [[mods]]
        modId="testmod"
        version="2.0.0"
        displayName="Test Mod TOML"
        description="A test mod using TOML format"
        authors="TOMLAuthor"
      `;

      zip.addFile('META-INF/mods.toml', Buffer.from(modsToml));

      const jarPath = path.join(tempDir, 'toml-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.manifestInfo.modId).toBe('testmod');
      expect(result.manifestInfo.modName).toBe('Test Mod TOML');
      expect(result.manifestInfo.version).toBe('2.0.0');
      expect(result.manifestInfo.author).toBe('TOMLAuthor');
    });

    it('should parse MANIFEST.MF format', async () => {
      const zip = new AdmZip();

      const manifest = `
        Manifest-Version: 1.0
        Implementation-Title: testmod
        Implementation-Version: 3.0.0
        Implementation-Vendor: ManifestAuthor
        Specification-Title: Test Mod Manifest
      `;

      zip.addFile('META-INF/MANIFEST.MF', Buffer.from(manifest));

      const jarPath = path.join(tempDir, 'manifest-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.manifestInfo.modId).toBe('testmod');
      expect(result.manifestInfo.version).toBe('3.0.0');
      expect(result.manifestInfo.author).toBe('ManifestAuthor');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle corrupted JAR files gracefully', async () => {
      const corruptedJar = Buffer.from('This is not a valid JAR file');
      const jarPath = path.join(tempDir, 'corrupted.jar');
      await fs.writeFile(jarPath, corruptedJar);

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.analysisNotes).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('corrupted'),
        })
      );
    });

    it('should continue analysis when one strategy fails', async () => {
      const zip = new AdmZip();

      // Add valid lang file
      const langData = { 'block.testmod.working_block': 'Working Block' };
      zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

      // Add corrupted model file
      zip.addFile('assets/testmod/models/block/broken.json', Buffer.from('invalid json {'));

      const jarPath = path.join(tempDir, 'partial-fail-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      // Should still extract from working lang file
      expect(result.registryNames).toContain('working_block');

      // Should have error note about broken model
      expect(result.analysisNotes).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('model'),
        })
      );
    });

    it('should provide helpful analysis notes', async () => {
      const zip = new AdmZip();

      // Empty JAR with just manifest
      zip.addFile('META-INF/MANIFEST.MF', Buffer.from('Manifest-Version: 1.0\n'));

      const jarPath = path.join(tempDir, 'empty-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.analysisNotes).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          message: expect.stringContaining('No registry names found'),
        })
      );
    });
  });

  describe('Performance Tests', () => {
    it('should analyze large JARs efficiently', async () => {
      const zip = new AdmZip();

      // Add many files to simulate a large mod
      for (let i = 0; i < 500; i++) {
        zip.addFile(`assets/testmod/textures/block/texture${i}.png`, Buffer.from('fake png'));

        if (i % 10 === 0) {
          const langData = { [`block.testmod.block${i}`]: `Block ${i}` };
          zip.addFile(`assets/testmod/lang/lang${i}.json`, Buffer.from(JSON.stringify(langData)));
        }
      }

      const jarPath = path.join(tempDir, 'large-test.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const startTime = Date.now();
      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);
      const analysisTime = Date.now() - startTime;

      expect(analysisTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(result.texturePaths.length).toBeGreaterThan(400);
      expect(result.registryNames.length).toBeGreaterThan(40);
    });

    it('should handle concurrent analysis requests', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        const zip = new AdmZip();
        const langData = { [`block.testmod.concurrent${i}`]: `Concurrent Block ${i}` };
        zip.addFile(`assets/testmod/lang/en_us.json`, Buffer.from(JSON.stringify(langData)));

        const jarPath = path.join(tempDir, `concurrent${i}.jar`);
        await fs.writeFile(jarPath, zip.toBuffer());

        promises.push(javaAnalyzer.analyzeJarForMVP(jarPath));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.registryNames).toContain(`concurrent${index}`);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle JARs with no mod content', async () => {
      const zip = new AdmZip();
      zip.addFile('random/file.txt', Buffer.from('not mod content'));

      const jarPath = path.join(tempDir, 'no-mod-content.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.registryNames).toHaveLength(0);
      expect(result.texturePaths).toHaveLength(0);
      expect(result.analysisNotes).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          message: expect.stringContaining('No mod content detected'),
        })
      );
    });

    it('should handle special characters in registry names', async () => {
      const zip = new AdmZip();

      const langData = {
        'block.testmod.special_block-name': 'Special Block',
        'item.testmod.item_with_numbers123': 'Numbered Item',
        'block.testmod.block.with.dots': 'Dotted Block',
      };

      zip.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify(langData)));

      const jarPath = path.join(tempDir, 'special-chars.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.registryNames).toContain('special_block-name');
      expect(result.registryNames).toContain('item_with_numbers123');
      expect(result.registryNames).toContain('block.with.dots');
    });

    it('should handle multiple mod IDs in same JAR', async () => {
      const zip = new AdmZip();

      const langData = {
        'block.mod1.block1': 'Mod 1 Block',
        'block.mod2.block2': 'Mod 2 Block',
        'item.mod1.item1': 'Mod 1 Item',
      };

      zip.addFile('assets/mod1/lang/en_us.json', Buffer.from(JSON.stringify(langData)));
      zip.addFile('assets/mod2/textures/block/block2.png', Buffer.from('fake png'));

      const jarPath = path.join(tempDir, 'multi-mod.jar');
      await fs.writeFile(jarPath, zip.toBuffer());

      const result = await javaAnalyzer.analyzeJarForMVP(jarPath);

      expect(result.registryNames).toContain('block1');
      expect(result.registryNames).toContain('block2');
      expect(result.registryNames).toContain('item1');
      expect(result.texturePaths).toContain('assets/mod2/textures/block/block2.png');
    });
  });
});
