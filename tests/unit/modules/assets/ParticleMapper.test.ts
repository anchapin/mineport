import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ParticleMapper,
  JavaParticleDefinition,
  BedrockParticleDefinition,
  FallbackStrategyType,
} from '../../../../src/modules/assets/ParticleMapper.js';
import * as fs from 'fs/promises';

// Mock the fs module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock the logger
vi.mock('../../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('ParticleMapper', () => {
  let particleMapper: ParticleMapper;

  beforeEach(() => {
    particleMapper = new ParticleMapper();
    vi.clearAllMocks();
  });

  describe('convertParticles', () => {
    it('should convert particles with direct mappings', async () => {
      // Create test Java particles with known mappings
      const javaParticles: JavaParticleDefinition[] = [
        {
          path: 'assets/minecraft/particles/flame.json',
          name: 'minecraft:flame',
          data: JSON.stringify({
            textures: ['particle/flame'],
            age: 20,
            speed: 0.01,
          }),
        },
        {
          path: 'assets/minecraft/particles/smoke.json',
          name: 'minecraft:smoke',
          data: JSON.stringify({
            textures: ['particle/smoke'],
            age: 30,
            speed: 0.005,
          }),
        },
      ];

      const result = await particleMapper.convertParticles(javaParticles);

      // Verify the conversion results
      expect(result.convertedParticles).toHaveLength(2);
      expect(result.convertedParticles[0].name).toBe('minecraft:flame');
      expect(result.convertedParticles[1].name).toBe('minecraft:smoke');
      expect(result.conversionNotes).toHaveLength(2);
      expect(result.conversionNotes[0].type).toBe('info');
      expect(result.conversionNotes[1].type).toBe('info');
    });

    it('should apply fallback strategies for unmappable particles', async () => {
      // Create test Java particles without direct mappings
      const javaParticles: JavaParticleDefinition[] = [
        {
          path: 'assets/custommod/particles/fire_burst.json',
          name: 'custommod:fire_burst',
          data: JSON.stringify({
            textures: ['particle/fire_burst'],
            age: 15,
            speed: 0.02,
          }),
        },
        {
          path: 'assets/custommod/particles/magic_sparkle.json',
          name: 'custommod:magic_sparkle',
          data: JSON.stringify({
            textures: ['particle/magic_sparkle'],
            age: 25,
            speed: 0.01,
          }),
        },
        {
          path: 'assets/custommod/particles/unknown_effect.json',
          name: 'custommod:unknown_effect',
          data: JSON.stringify({
            textures: ['particle/unknown'],
            age: 10,
            speed: 0.005,
          }),
        },
      ];

      const result = await particleMapper.convertParticles(javaParticles);

      // Verify the conversion results
      expect(result.convertedParticles).toHaveLength(3);

      // First particle should use fire fallback
      expect(result.conversionNotes[0].fallbackApplied).toBe(true);
      expect(result.conversionNotes[0].type).toBe('warning');

      // Second particle should use magic fallback
      expect(result.conversionNotes[1].fallbackApplied).toBe(true);
      expect(result.conversionNotes[1].type).toBe('warning');

      // Third particle should use default fallback
      expect(result.conversionNotes[2].fallbackApplied).toBe(true);
      expect(result.conversionNotes[2].type).toBe('warning');
    });

    it('should handle errors during conversion', async () => {
      // Create a test Java particle with invalid data
      const javaParticles: JavaParticleDefinition[] = [
        {
          path: 'assets/minecraft/particles/invalid.json',
          name: 'minecraft:invalid',
          data: 'invalid-json' as any,
        },
      ];

      const result = await particleMapper.convertParticles(javaParticles);

      // Verify the conversion results
      expect(result.convertedParticles).toHaveLength(0);
      expect(result.conversionNotes).toHaveLength(1);
      expect(result.conversionNotes[0].type).toBe('error');
    });
  });

  describe('organizeParticles', () => {
    it('should organize converted particles correctly', async () => {
      // Create test Bedrock particles
      const bedrockParticles: BedrockParticleDefinition[] = [
        {
          path: 'particles/minecraft_flame.json',
          name: 'minecraft:flame',
          data: {
            format_version: '1.10.0',
            particle_effect: {
              description: {
                identifier: 'minecraft_flame',
                basic_render_parameters: {
                  material: 'particles_alpha',
                  texture: 'textures/particle/flame',
                },
              },
              components: {},
            },
          },
        },
        {
          path: 'particles/custommod_magic_sparkle.json',
          name: 'minecraft:enchanting_table_particle',
          data: {
            format_version: '1.10.0',
            particle_effect: {
              description: {
                identifier: 'custommod_magic_sparkle',
                basic_render_parameters: {
                  material: 'particles_alpha',
                  texture: 'textures/particle/enchanting_table_particle',
                },
              },
              components: {},
            },
          },
          textures: ['textures/particle/magic_sparkle'],
        },
      ];

      await particleMapper.organizeParticles(bedrockParticles, 'output/dir');

      // Verify the fs calls
      expect(fs.mkdir).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);

      // Check that the first particle file was written correctly
      expect(fs.writeFile).toHaveBeenCalledWith(
        'output/dir/particles/minecraft_flame.json',
        JSON.stringify(bedrockParticles[0].data, null, 2)
      );

      // Check that the second particle file was written correctly
      expect(fs.writeFile).toHaveBeenCalledWith(
        'output/dir/particles/custommod_magic_sparkle.json',
        JSON.stringify(bedrockParticles[1].data, null, 2)
      );
    });
  });

  describe('generateBedrockParticleData', () => {
    it('should generate correct Bedrock particle data structure', async () => {
      // Create a test Java particle
      const javaParticle: JavaParticleDefinition = {
        path: 'assets/minecraft/particles/flame.json',
        name: 'minecraft:flame',
        data: JSON.stringify({
          textures: ['particle/flame'],
          age: 20,
          speed: 0.01,
          count: 5,
          width: 0.2,
          height: 0.2,
        }),
      };

      // Use the private method through a public method
      const result = await particleMapper.convertParticles([javaParticle]);
      const bedrockData = result.convertedParticles[0].data as any;

      // Verify the structure
      expect(bedrockData.format_version).toBe('1.10.0');
      expect(bedrockData.particle_effect).toBeDefined();
      expect(bedrockData.particle_effect.description).toBeDefined();
      expect(bedrockData.particle_effect.description.identifier).toBe('minecraft_flame');
      expect(bedrockData.particle_effect.components).toBeDefined();
      expect(
        bedrockData.particle_effect.components['minecraft:emitter_rate_instant']
      ).toBeDefined();
      expect(
        bedrockData.particle_effect.components['minecraft:emitter_rate_instant'].num_particles
      ).toBe(5);
    });
  });
});
