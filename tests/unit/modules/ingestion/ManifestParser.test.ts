/**
 * Unit tests for ManifestParser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ManifestParser,
} from '../../../../src/modules/ingestion/ManifestParser.js';

describe('ManifestParser', () => {
  let parser: ManifestParser;

  beforeEach(() => {
    parser = new ManifestParser();
  });

  describe('parseManifestMF', () => {
    it('should parse a valid MANIFEST.MF file', () => {
      const manifestContent = `Manifest-Version: 1.0
Implementation-Title: TestMod
Implementation-Version: 1.2.3
Implementation-Vendor: Test Author
Specification-Title: TestMod
Specification-Version: 1.2.3
Specification-Vendor: Test Author
Main-Class: com.testmod.TestMod
`;

      const result = parser.parseManifestMF(manifestContent);

      expect(result.success).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.manifest!.modId).toBe('testmod');
      expect(result.manifest!.modName).toBe('TestMod');
      expect(result.manifest!.version).toBe('1.2.3');
      expect(result.manifest!.author).toBe('Test Author');
      expect(result.manifest!.dependencies).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should handle MANIFEST.MF with minimal information', () => {
      const manifestContent = `Manifest-Version: 1.0
Bundle-SymbolicName: minimal.mod
Bundle-Version: 0.1.0
`;

      const result = parser.parseManifestMF(manifestContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('minimal_mod');
      expect(result.manifest!.modName).toBe('minimal.mod');
      expect(result.manifest!.version).toBe('0.1.0');
      expect(result.warnings).toHaveLength(1);
    });

    it('should handle malformed MANIFEST.MF gracefully', () => {
      const manifestContent = `This is not a valid manifest file
No colons here
`;

      const result = parser.parseManifestMF(manifestContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('unknown');
      expect(result.manifest!.version).toBe('1.0.0');
    });
  });

  describe('parseMcmodInfo', () => {
    it('should parse a valid mcmod.info file with array format', () => {
      const mcmodContent = JSON.stringify([
        {
          modid: 'testmod',
          name: 'Test Mod',
          version: '1.0.0',
          description: 'A test mod for unit testing',
          authorList: ['Test Author', 'Another Author'],
          dependencies: ['forge', 'jei'],
          requiredMods: ['minecraft'],
        },
      ]);

      const result = parser.parseMcmodInfo(mcmodContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('testmod');
      expect(result.manifest!.modName).toBe('Test Mod');
      expect(result.manifest!.version).toBe('1.0.0');
      expect(result.manifest!.description).toBe('A test mod for unit testing');
      expect(result.manifest!.author).toBe('Test Author, Another Author');
      expect(result.manifest!.dependencies).toHaveLength(3);
      expect(result.manifest!.dependencies[0].modId).toBe('forge');
      expect(result.manifest!.dependencies[1].modId).toBe('jei');
      expect(result.manifest!.dependencies[2].modId).toBe('minecraft');
    });

    it('should parse a valid mcmod.info file with object format', () => {
      const mcmodContent = JSON.stringify({
        modid: 'singlemod',
        name: 'Single Mod',
        version: '2.0.0',
        author: 'Single Author',
      });

      const result = parser.parseMcmodInfo(mcmodContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('singlemod');
      expect(result.manifest!.modName).toBe('Single Mod');
      expect(result.manifest!.version).toBe('2.0.0');
      expect(result.manifest!.author).toBe('Single Author');
    });

    it('should handle mcmod.info with complex dependencies', () => {
      const mcmodContent = JSON.stringify([
        {
          modid: 'complexmod',
          name: 'Complex Mod',
          version: '1.0.0',
          dependencies: [
            { modId: 'forge', version: '[40,)', required: true, type: 'required' },
            { modId: 'jei', version: '*', required: false, type: 'optional' },
          ],
        },
      ]);

      const result = parser.parseMcmodInfo(mcmodContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.dependencies).toHaveLength(2);
      expect(result.manifest!.dependencies[0].modId).toBe('forge');
      expect(result.manifest!.dependencies[0].version).toBe('[40,)');
      expect(result.manifest!.dependencies[0].required).toBe(true);
      expect(result.manifest!.dependencies[1].modId).toBe('jei');
      expect(result.manifest!.dependencies[1].required).toBe(false);
    });

    it('should handle invalid JSON gracefully', () => {
      const mcmodContent = 'invalid json content';

      const result = parser.parseMcmodInfo(mcmodContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse mcmod.info');
    });

    it('should handle empty mcmod.info', () => {
      const mcmodContent = JSON.stringify([]);

      const result = parser.parseMcmodInfo(mcmodContent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty or invalid mcmod.info structure');
    });
  });

  describe('parseModsToml', () => {
    it('should parse a valid mods.toml file', () => {
      const tomlContent = `
modLoader="javafml"
loaderVersion="[40,)"
license="MIT"

[[mods]]
modId="testmod"
version="1.0.0"
displayName="Test Mod"
description="A test mod for unit testing"
authors="Test Author"
logoFile="logo.png"
credits="Thanks to everyone"

[[dependencies.testmod]]
modId="forge"
mandatory=true
versionRange="[40,)"
ordering="NONE"
side="BOTH"

[[dependencies.testmod]]
modId="jei"
mandatory=false
versionRange="*"
ordering="AFTER"
side="CLIENT"
`;

      const result = parser.parseModsToml(tomlContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('testmod');
      expect(result.manifest!.modName).toBe('Test Mod');
      expect(result.manifest!.version).toBe('1.0.0');
      expect(result.manifest!.description).toBe('A test mod for unit testing');
      expect(result.manifest!.author).toBe('Test Author');
      expect(result.manifest!.dependencies).toHaveLength(2);
      expect(result.manifest!.dependencies[0].modId).toBe('forge');
      expect(result.manifest!.dependencies[0].required).toBe(true);
      expect(result.manifest!.dependencies[1].modId).toBe('jei');
      expect(result.manifest!.dependencies[1].required).toBe(false);
      expect(result.manifest!.metadata.logoFile).toBe('logo.png');
      expect(result.manifest!.metadata.credits).toBe('Thanks to everyone');
    });

    it('should handle mods.toml with minimal information', () => {
      const tomlContent = `
[[mods]]
modId="minimal"
`;

      const result = parser.parseModsToml(tomlContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('minimal');
      expect(result.manifest!.modName).toBe('Unknown Mod');
      expect(result.manifest!.version).toBe('1.0.0');
      expect(result.manifest!.dependencies).toEqual([]);
    });

    it('should handle mods.toml without modId', () => {
      const tomlContent = `
[[mods]]
displayName="No ID Mod"
version="1.0.0"
`;

      const result = parser.parseModsToml(tomlContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('unknown');
      expect(result.warnings).toContain('Missing modId in mods.toml');
    });
  });

  describe('parseFabricModJson', () => {
    it('should parse a valid fabric.mod.json file', () => {
      const fabricContent = JSON.stringify({
        schemaVersion: 1,
        id: 'fabricmod',
        version: '1.0.0',
        name: 'Fabric Mod',
        description: 'A test fabric mod',
        authors: [
          { name: 'Fabric Author', contact: { email: 'author@example.com' } },
          'Another Author',
        ],
        depends: {
          fabricloader: '>=0.14.0',
          minecraft: '~1.19.2',
          java: '>=17',
        },
        recommends: {
          modmenu: '*',
        },
        conflicts: {
          badmod: '*',
        },
      });

      const result = parser.parseFabricModJson(fabricContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('fabricmod');
      expect(result.manifest!.modName).toBe('Fabric Mod');
      expect(result.manifest!.version).toBe('1.0.0');
      expect(result.manifest!.description).toBe('A test fabric mod');
      expect(result.manifest!.author).toBe('Fabric Author, Another Author');
      expect(result.manifest!.dependencies).toHaveLength(5);

      // Check required dependencies
      const requiredDeps = result.manifest!.dependencies.filter((d) => d.required);
      expect(requiredDeps).toHaveLength(3);
      expect(requiredDeps.map((d) => d.modId)).toContain('fabricloader');
      expect(requiredDeps.map((d) => d.modId)).toContain('minecraft');
      expect(requiredDeps.map((d) => d.modId)).toContain('java');

      // Check optional dependencies
      const optionalDeps = result.manifest!.dependencies.filter((d) => !d.required);
      expect(optionalDeps).toHaveLength(2);
      expect(optionalDeps.map((d) => d.modId)).toContain('modmenu');
      expect(optionalDeps.map((d) => d.modId)).toContain('badmod');

      // Check dependency types
      const incompatibleDeps = result.manifest!.dependencies.filter(
        (d) => d.type === 'incompatible'
      );
      expect(incompatibleDeps).toHaveLength(1);
      expect(incompatibleDeps[0].modId).toBe('badmod');
    });

    it('should handle fabric.mod.json with minimal information', () => {
      const fabricContent = JSON.stringify({
        schemaVersion: 1,
        id: 'minimal_fabric',
      });

      const result = parser.parseFabricModJson(fabricContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('minimal_fabric');
      expect(result.manifest!.modName).toBe('Unknown Mod');
      expect(result.manifest!.version).toBe('1.0.0');
      expect(result.manifest!.dependencies).toEqual([]);
    });

    it('should handle fabric.mod.json without id', () => {
      const fabricContent = JSON.stringify({
        schemaVersion: 1,
        name: 'No ID Fabric Mod',
      });

      const result = parser.parseFabricModJson(fabricContent);

      expect(result.success).toBe(true);
      expect(result.manifest!.modId).toBe('unknown');
      expect(result.warnings).toContain('Missing id in fabric.mod.json');
    });

    it('should handle invalid JSON gracefully', () => {
      const fabricContent = 'invalid json';

      const result = parser.parseFabricModJson(fabricContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse fabric.mod.json');
    });
  });

  describe('sanitizeModId', () => {
    it('should sanitize mod IDs correctly', () => {
      // Test through parseManifestMF since sanitizeModId is private
      const manifestContent = `Implementation-Title: Test-Mod With Spaces!@#$%`;
      const result = parser.parseManifestMF(manifestContent);

      expect(result.manifest!.modId).toBe('test_mod_with_spaces');
    });

    it('should handle empty or invalid mod IDs', () => {
      const manifestContent = `Implementation-Title: !!!@@@###`;
      const result = parser.parseManifestMF(manifestContent);

      expect(result.manifest!.modId).toBe('unknown');
    });
  });
});
