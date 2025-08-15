import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DimensionSimulator,
  DimensionProperties,
} from '../../../../src/modules/compromise/DimensionSimulator.js';
import { Feature } from '../../../../src/types/compromise.js';
import { Logger } from '../../../../src/utils/logger.js';

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

describe('DimensionSimulator', () => {
  let simulator: DimensionSimulator;
  let testFeature: Feature;
  let testProperties: DimensionProperties;

  beforeEach(() => {
    simulator = new DimensionSimulator();

    testFeature = {
      id: 'test-dimension',
      name: 'Test Dimension',
      description: 'A test dimension',
      type: 'dimension',
      compatibilityTier: 3,
      sourceFiles: ['TestDimension.java'],
      sourceLineNumbers: [[10, 20]],
    };

    testProperties = {
      teleportationCoordinates: {
        x: 10000,
        y: 100,
        z: 10000,
      },
      boundaryRadius: 150,
      visualEffects: ['fog', 'particles', 'skybox', 'sound'],
      structures: [
        {
          name: 'Main Portal',
          structureIdentifier: 'test_dimension:main_portal',
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0,
        },
        {
          name: 'Central Tower',
          structureIdentifier: 'test_dimension:central_tower',
          offsetX: 10,
          offsetY: 0,
          offsetZ: 10,
        },
      ],
    };

    vi.clearAllMocks();
  });

  it('should generate dimension simulation code', () => {
    const result = simulator.generateDimensionSimulation(
      testFeature,
      'TestDimension',
      testProperties
    );

    // Check that the result contains the expected properties
    expect(result).toBeDefined();
    expect(result.dimensionName).toBe('TestDimension');
    expect(result.teleportationCoordinates).toEqual(testProperties.teleportationCoordinates);
    expect(result.visualEffects).toEqual(testProperties.visualEffects);
    expect(result.structures).toEqual(testProperties.structures);

    // Check that the generated code contains key elements
    expect(result.simulationCode).toContain('TestDimension Dimension Simulation');
    expect(result.simulationCode).toContain("import { world, system } from '@minecraft/server'");
    expect(result.simulationCode).toContain('initializeTestDimensionDimension');
    expect(result.simulationCode).toContain('teleportPlayer');
    expect(result.simulationCode).toContain('applyDimensionEffects');
    expect(result.simulationCode).toContain('removeDimensionEffects');
    expect(result.simulationCode).toContain('generateStructures');
    expect(result.simulationCode).toContain('setupDimensionBoundaries');
    expect(result.simulationCode).toContain('isPlayerInTestDimensionDimension');

    // Check that the logger was called
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Generating dimension simulation for: TestDimension'
    );
  });

  it('should generate teleportation code with correct coordinates', () => {
    const result = simulator.generateDimensionSimulation(
      testFeature,
      'TestDimension',
      testProperties
    );

    // Check that the teleportation coordinates are included in the code
    expect(result.simulationCode).toContain(`x: ${testProperties.teleportationCoordinates.x}`);
    expect(result.simulationCode).toContain(`y: ${testProperties.teleportationCoordinates.y}`);
    expect(result.simulationCode).toContain(`z: ${testProperties.teleportationCoordinates.z}`);
  });

  it('should generate visual effects code for all specified effects', () => {
    const result = simulator.generateDimensionSimulation(
      testFeature,
      'TestDimension',
      testProperties
    );

    // Check that all visual effects are included
    expect(result.simulationCode).toContain('fog @s push TestDimension_fog');
    expect(result.simulationCode).toContain('TestDimension_ambient');
    expect(result.simulationCode).toContain('skybox TestDimension_sky');
    expect(result.simulationCode).toContain('TestDimension.ambient');

    // Check that removal code is also included
    expect(result.simulationCode).toContain('fog @s pop TestDimension_fog');
    expect(result.simulationCode).toContain('system.clearInterval(particleInterval)');
    expect(result.simulationCode).toContain('skybox reset');
    expect(result.simulationCode).toContain('system.clearInterval(soundInterval)');
  });

  it('should generate structure code for all specified structures', () => {
    const result = simulator.generateDimensionSimulation(
      testFeature,
      'TestDimension',
      testProperties
    );

    // Check that all structures are included
    testProperties.structures!.forEach((structure) => {
      expect(result.simulationCode).toContain(`// Generate ${structure.name}`);
      expect(result.simulationCode).toContain(`structure load ${structure.structureIdentifier}`);
    });
  });

  it('should handle dimensions with no structures', () => {
    // Create properties with no structures
    const propertiesWithoutStructures: DimensionProperties = {
      ...testProperties,
      structures: undefined,
    };

    const result = simulator.generateDimensionSimulation(
      testFeature,
      'TestDimension',
      propertiesWithoutStructures
    );

    // Check that the code handles the lack of structures gracefully
    expect(result.simulationCode).toContain('No structures defined for this dimension');
    expect(result.simulationCode).toContain('return false');
  });

  it('should generate dimension boundary detection code', () => {
    const result = simulator.generateDimensionSimulation(
      testFeature,
      'TestDimension',
      testProperties
    );

    // Check that boundary detection code is included
    expect(result.simulationCode).toContain(
      `const boundaryRadius = ${testProperties.boundaryRadius}`
    );
    expect(result.simulationCode).toContain('system.runInterval');
    expect(result.simulationCode).toContain('Math.sqrt');
    expect(result.simulationCode).toContain('teleportPlayer(player, false)');
  });
});
