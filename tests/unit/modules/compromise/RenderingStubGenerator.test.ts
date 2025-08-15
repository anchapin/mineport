import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RenderingStubGenerator,
  DetectedRenderingPattern,
} from '../../../../src/modules/compromise/RenderingStubGenerator.js';
import { Feature } from '../../../../src/types/compromise.js';
import { Logger } from '../../../../src/utils/logger.js';

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

describe('RenderingStubGenerator', () => {
  let generator: RenderingStubGenerator;
  let testFeature: Feature;

  beforeEach(() => {
    generator = new RenderingStubGenerator();

    testFeature = {
      id: 'custom-renderer',
      name: 'Custom Block Renderer',
      description: 'A custom block renderer with advanced effects',
      type: 'rendering',
      compatibilityTier: 3,
      sourceFiles: ['CustomBlockRenderer.java'],
      sourceLineNumbers: [[10, 50]],
    };

    vi.clearAllMocks();
  });

  it('should detect custom model renderer code', () => {
    const javaCode = `
      public class CustomModelRenderer extends ModelRenderer {
        @Override
        public void render(Entity entity, float limbSwing, float limbSwingAmount, float ageInTicks, float netHeadYaw, float headPitch, float scale) {
          // Custom rendering code
          super.render(entity, limbSwing, limbSwingAmount, ageInTicks, netHeadYaw, headPitch, scale);
        }
      }
    `;

    const detectedPatterns = generator.detectRenderingCode(javaCode);

    expect(detectedPatterns).toHaveLength(1);
    expect(detectedPatterns[0].patternId).toBe('custom-model-renderer');
    expect(detectedPatterns[0].category).toBe('model-rendering');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Detected rendering pattern: Custom Model Renderer'
    );
  });

  it('should detect shader program code', () => {
    const javaCode = `
      public class CustomShader {
        private ShaderProgram shaderProgram;

        public void init() {
          shaderProgram = new ShaderProgram();
          shaderProgram.attachShader(GL20.GL_VERTEX_SHADER, vertexSource);
          shaderProgram.attachShader(GL20.GL_FRAGMENT_SHADER, fragmentSource);
          shaderProgram.link();
        }

        public void use() {
          shaderProgram.use();
          glUniform1f(timeUniform, Minecraft.getSystemTime() / 1000.0f);
        }
      }
    `;

    const detectedPatterns = generator.detectRenderingCode(javaCode);

    expect(detectedPatterns).toHaveLength(1);
    expect(detectedPatterns[0].patternId).toBe('shader-program');
    expect(detectedPatterns[0].category).toBe('shaders');
  });

  it('should detect multiple rendering patterns in the same file', () => {
    const javaCode = `
      public class ComplexRenderer extends TileEntitySpecialRenderer {
        private ShaderProgram shaderProgram;
        private ModelRenderer modelRenderer;

        @Override
        public void render(TileEntity tileEntity, double x, double y, double z, float partialTicks, int destroyStage, float alpha) {
          // Apply shader
          shaderProgram.use();
          glUniform1f(timeUniform, Minecraft.getSystemTime() / 1000.0f);

          // Render model
          modelRenderer.render(null, 0, 0, 0, 0, 0, 1.0f);

          // Draw GUI elements
          drawRect(10, 10, 100, 100, 0xFFFFFFFF);
          drawString(Minecraft.getMinecraft().fontRenderer, "Hello", 20, 20, 0xFFFFFFFF);
        }
      }
    `;

    const detectedPatterns = generator.detectRenderingCode(javaCode);

    expect(detectedPatterns.length).toBeGreaterThan(1);

    const patternIds = detectedPatterns.map((pattern) => pattern.patternId);
    expect(patternIds).toContain('shader-program');
    expect(patternIds).toContain('tile-entity-renderer');
    expect(patternIds).toContain('gui-rendering');
  });

  it('should generate stub code for a detected pattern', () => {
    const detectedPattern: DetectedRenderingPattern = {
      patternId: 'custom-model-renderer',
      patternName: 'Custom Model Renderer',
      category: 'model-rendering',
      matches: ['extends ModelRenderer'],
    };

    const stub = generator.generateStub(testFeature, detectedPattern);

    expect(stub).toBeDefined();
    expect(stub.featureId).toBe(testFeature.id);
    expect(stub.patternId).toBe(detectedPattern.patternId);
    expect(stub.category).toBe(detectedPattern.category);
    expect(stub.recommendations).toBeDefined();
    expect(stub.recommendations.length).toBeGreaterThan(0);

    // Check that the stub code contains key elements
    expect(stub.stubCode).toContain('STUBBED RENDERING CODE: Custom Model Renderer');
    expect(stub.stubCode).toContain('export class CustomBlockRendererStub');
    expect(stub.stubCode).toContain('console.warn');
    expect(stub.stubCode).toContain('renderModel(entity, partialTicks, matrixStack)');
    expect(stub.stubCode).toContain('getStubInfo()');
    expect(stub.stubCode).toContain('createCustomBlockRendererStub()');

    // Check that recommendations are included in the stub
    stub.recommendations.forEach((recommendation) => {
      expect(stub.stubCode).toContain(recommendation);
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Generating stub for rendering pattern: Custom Model Renderer'
    );
  });

  it('should generate different method signatures based on pattern category', () => {
    const categories = [
      'model-rendering',
      'shaders',
      'particles',
      'block-models',
      'entity-rendering',
      'gui',
      'item-models',
      'tile-entity-rendering',
    ];

    const expectedMethods = [
      'renderModel(entity, partialTicks, matrixStack)',
      'applyShader(target, shader, uniforms)',
      'spawnParticles(position, count, velocity)',
      'renderBlock(block, pos, world, buffer)',
      'renderEntity(entity, x, y, z, partialTicks)',
      'drawScreen(mouseX, mouseY, partialTicks)',
      'renderItem(item, transformType)',
      'renderTileEntity(tileEntity, x, y, z, partialTicks)',
    ];

    categories.forEach((category, index) => {
      const detectedPattern: DetectedRenderingPattern = {
        patternId: `test-${category}`,
        patternName: `Test ${category}`,
        category: category,
        matches: [`test-${category}-match`],
      };

      const stub = generator.generateStub(testFeature, detectedPattern);
      expect(stub.stubCode).toContain(expectedMethods[index]);
    });
  });

  it('should not detect rendering code in unrelated Java code', () => {
    const javaCode = `
      public class SimpleClass {
        private String name;

        public SimpleClass(String name) {
          this.name = name;
        }

        public String getName() {
          return name;
        }
      }
    `;

    const detectedPatterns = generator.detectRenderingCode(javaCode);

    expect(detectedPatterns).toHaveLength(0);
  });
});
