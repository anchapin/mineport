import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeatureCompatibilityAnalyzer, CompatibilityTier, FeatureType } from '../../../../src/modules/ingestion/FeatureCompatibilityAnalyzer';
import { createMockFileSystem, resetAllMocks } from '../../../utils/testHelpers';
import fs from 'fs';
import path from 'path';

describe('FeatureCompatibilityAnalyzer', () => {
  let featureCompatibilityAnalyzer: FeatureCompatibilityAnalyzer;
  let mockModFiles: Record<string, string>;

  beforeEach(() => {
    // Create mock mod files
    mockModFiles = {
      // Basic mod structure
      '/tmp/mod/src/main/java/com/example/testmod/TestMod.java': 'package com.example.testmod;\n\nimport net.minecraftforge.fml.common.Mod;\n\n@Mod("test-mod")\npublic class TestMod {}',
      
      // Fully translatable features
      '/tmp/mod/src/main/java/com/example/testmod/blocks/SimpleBlock.java': 'package com.example.testmod.blocks;\n\nimport net.minecraft.world.level.block.Block;\n\npublic class SimpleBlock extends Block {\n  public SimpleBlock(Properties properties) {\n    super(properties);\n  }\n}',
      '/tmp/mod/src/main/java/com/example/testmod/items/SimpleItem.java': 'package com.example.testmod.items;\n\nimport net.minecraft.world.item.Item;\n\npublic class SimpleItem extends Item {\n  public SimpleItem(Properties properties) {\n    super(properties);\n  }\n}',
      
      // Approximation possible features
      '/tmp/mod/src/main/java/com/example/testmod/entities/CustomEntity.java': 'package com.example.testmod.entities;\n\nimport net.minecraft.world.entity.EntityType;\nimport net.minecraft.world.entity.Mob;\n\npublic class CustomEntity extends Mob {\n  public CustomEntity(EntityType<? extends Mob> entityType, Level level) {\n    super(entityType, level);\n  }\n}',
      
      // Natively impossible features
      '/tmp/mod/src/main/java/com/example/testmod/dimension/CustomDimension.java': 'package com.example.testmod.dimension;\n\nimport net.minecraft.world.level.dimension.DimensionType;\n\npublic class CustomDimension {\n  public static void register() {\n    // Custom dimension registration\n  }\n}',
      '/tmp/mod/src/main/java/com/example/testmod/rendering/CustomRenderer.java': 'package com.example.testmod.rendering;\n\nimport com.mojang.blaze3d.vertex.PoseStack;\nimport net.minecraft.client.renderer.MultiBufferSource;\n\npublic class CustomRenderer {\n  public void render(PoseStack poseStack, MultiBufferSource buffer) {\n    // Custom rendering code\n  }\n}',
      
      // Assets
      '/tmp/mod/src/main/resources/assets/testmod/textures/block/simple_block.png': 'BINARY_DATA',
      '/tmp/mod/src/main/resources/assets/testmod/models/block/simple_block.json': '{\n  "parent": "block/cube_all",\n  "textures": {\n    "all": "testmod:block/simple_block"\n  }\n}',
      '/tmp/mod/src/main/resources/assets/testmod/sounds.json': '{\n  "simple_sound": {\n    "category": "block",\n    "sounds": [\n      "testmod:simple_sound"\n    ]\n  }\n}',
      
      // Configuration
      '/tmp/mod/src/main/resources/data/testmod/recipes/simple_recipe.json': '{\n  "type": "minecraft:crafting_shaped",\n  "pattern": [\n    "###",\n    "# #",\n    "###"\n  ],\n  "key": {\n    "#": {\n      "item": "minecraft:stone"\n    }\n  },\n  "result": {\n    "item": "testmod:simple_block"\n  }\n}',
      '/tmp/mod/src/main/resources/data/testmod/loot_tables/blocks/simple_block.json': '{\n  "type": "minecraft:block",\n  "pools": [\n    {\n      "rolls": 1,\n      "entries": [\n        {\n          "type": "minecraft:item",\n          "name": "testmod:simple_block"\n        }\n      ]\n    }\n  ]\n}',
    };
    
    // Create analyzer
    featureCompatibilityAnalyzer = new FeatureCompatibilityAnalyzer();
  });

  afterEach(() => {
    resetAllMocks();
  });

  it('should analyze mod features and categorize them correctly', async () => {
    // Mock file system
    createMockFileSystem(mockModFiles);
    
    // Analyze mod
    const result = await featureCompatibilityAnalyzer.analyze('/tmp/mod');
    
    // Check result structure
    expect(result.features).toBeDefined();
    expect(result.summary).toBeDefined();
    
    // Check tier counts
    expect(result.summary.tier1Count).toBeGreaterThan(0); // Fully translatable
    expect(result.summary.tier2Count).toBeGreaterThan(0); // Approximation possible
    expect(result.summary.tier3Count).toBeGreaterThan(0); // Natively impossible
    
    // Check feature categorization
    const tier1Features = result.features.filter(f => f.compatibilityTier === CompatibilityTier.FULLY_TRANSLATABLE);
    const tier2Features = result.features.filter(f => f.compatibilityTier === CompatibilityTier.APPROXIMATION_POSSIBLE);
    const tier3Features = result.features.filter(f => f.compatibilityTier === CompatibilityTier.NATIVELY_IMPOSSIBLE);
    
    // Check specific features
    expect(tier1Features.some(f => f.name.includes('SimpleBlock'))).toBe(true);
    expect(tier1Features.some(f => f.name.includes('SimpleItem'))).toBe(true);
    expect(tier2Features.some(f => f.name.includes('CustomEntity'))).toBe(true);
    expect(tier3Features.some(f => f.name.includes('CustomDimension'))).toBe(true);
    expect(tier3Features.some(f => f.name.includes('CustomRenderer'))).toBe(true);
  });

  it('should detect assets and categorize them correctly', async () => {
    // Mock file system
    createMockFileSystem(mockModFiles);
    
    // Analyze mod
    const result = await featureCompatibilityAnalyzer.analyze('/tmp/mod');
    
    // Check asset features
    const assetFeatures = result.features.filter(f => f.type === FeatureType.ASSET);
    
    expect(assetFeatures.length).toBeGreaterThan(0);
    expect(assetFeatures.some(f => f.name.includes('Texture'))).toBe(true);
    expect(assetFeatures.some(f => f.name.includes('Model'))).toBe(true);
    expect(assetFeatures.some(f => f.name.includes('Sound'))).toBe(true);
    
    // Assets should be fully translatable
    expect(assetFeatures.every(f => f.compatibilityTier === CompatibilityTier.FULLY_TRANSLATABLE)).toBe(true);
  });

  it('should detect configuration files and categorize them correctly', async () => {
    // Mock file system
    createMockFileSystem(mockModFiles);
    
    // Analyze mod
    const result = await featureCompatibilityAnalyzer.analyze('/tmp/mod');
    
    // Check configuration features
    const configFeatures = result.features.filter(f => f.type === FeatureType.CONFIGURATION);
    
    expect(configFeatures.length).toBeGreaterThan(0);
    expect(configFeatures.some(f => f.name.includes('Recipe'))).toBe(true);
    expect(configFeatures.some(f => f.name.includes('Loot Table'))).toBe(true);
    
    // Configuration should be fully translatable
    expect(configFeatures.every(f => f.compatibilityTier === CompatibilityTier.FULLY_TRANSLATABLE)).toBe(true);
  });

  it('should analyze Java code for API usage', async () => {
    // Mock file system with code using various APIs
    const mockApiFiles = {
      '/tmp/mod/src/main/java/com/example/testmod/api/VanillaApi.java': 'package com.example.testmod.api;\n\nimport net.minecraft.world.item.Item;\nimport net.minecraft.world.level.block.Block;\n\npublic class VanillaApi {\n  public void useVanillaApi() {\n    Item item = new Item(new Item.Properties());\n    Block block = new Block(Block.Properties.of(Material.STONE));\n  }\n}',
      '/tmp/mod/src/main/java/com/example/testmod/api/ForgeApi.java': 'package com.example.testmod.api;\n\nimport net.minecraftforge.common.MinecraftForge;\nimport net.minecraftforge.event.entity.player.PlayerEvent;\n\npublic class ForgeApi {\n  public void useForgeApi() {\n    MinecraftForge.EVENT_BUS.register(this);\n  }\n  \n  public void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event) {\n    // Handle event\n  }\n}',
      '/tmp/mod/src/main/java/com/example/testmod/api/MixedApi.java': 'package com.example.testmod.api;\n\nimport net.minecraft.world.entity.player.Player;\nimport net.minecraftforge.common.capabilities.Capability;\n\npublic class MixedApi {\n  public void useMixedApi(Player player) {\n    // Use both vanilla and Forge APIs\n  }\n}',
    };
    
    // Mock file system
    createMockFileSystem({...mockModFiles, ...mockApiFiles});
    
    // Analyze mod
    const result = await featureCompatibilityAnalyzer.analyze('/tmp/mod');
    
    // Check API usage features
    const apiFeatures = result.features.filter(f => f.type === FeatureType.API);
    
    expect(apiFeatures.length).toBeGreaterThan(0);
    
    // Vanilla API should be fully translatable
    const vanillaApiFeature = apiFeatures.find(f => f.name.includes('Vanilla API'));
    expect(vanillaApiFeature).toBeDefined();
    expect(vanillaApiFeature?.compatibilityTier).toBe(CompatibilityTier.FULLY_TRANSLATABLE);
    
    // Forge-specific API should be approximation possible or natively impossible
    const forgeApiFeature = apiFeatures.find(f => f.name.includes('Forge API'));
    expect(forgeApiFeature).toBeDefined();
    expect(forgeApiFeature?.compatibilityTier).toBeGreaterThanOrEqual(CompatibilityTier.APPROXIMATION_POSSIBLE);
  });

  it('should provide detailed feature information', async () => {
    // Mock file system
    createMockFileSystem(mockModFiles);
    
    // Analyze mod
    const result = await featureCompatibilityAnalyzer.analyze('/tmp/mod');
    
    // Check feature details
    const feature = result.features[0];
    
    expect(feature.id).toBeDefined();
    expect(feature.name).toBeDefined();
    expect(feature.description).toBeDefined();
    expect(feature.type).toBeDefined();
    expect(feature.compatibilityTier).toBeDefined();
    expect(feature.sourceFiles).toBeDefined();
    expect(feature.sourceFiles.length).toBeGreaterThan(0);
    expect(feature.compromiseStrategy).toBeDefined();
  });

  it('should handle errors during analysis', async () => {
    // Mock fs.promises.readdir to throw an error
    vi.spyOn(fs.promises, 'readdir').mockRejectedValue(new Error('Access denied'));
    
    // Analyze mod
    const result = await featureCompatibilityAnalyzer.analyze('/tmp/mod');
    
    // Check result
    expect(result.error).toBeDefined();
    expect(result.features).toHaveLength(0);
  });

  it('should suggest compromise strategies for natively impossible features', async () => {
    // Mock file system
    createMockFileSystem(mockModFiles);
    
    // Analyze mod
    const result = await featureCompatibilityAnalyzer.analyze('/tmp/mod');
    
    // Check compromise strategies
    const tier3Features = result.features.filter(f => f.compatibilityTier === CompatibilityTier.NATIVELY_IMPOSSIBLE);
    
    // Each Tier 3 feature should have a compromise strategy
    expect(tier3Features.length).toBeGreaterThan(0);
    expect(tier3Features.every(f => f.compromiseStrategy !== undefined)).toBe(true);
    
    // Check specific compromise strategies
    const dimensionFeature = tier3Features.find(f => f.name.includes('Dimension'));
    expect(dimensionFeature?.compromiseStrategy?.type).toBe('simulation');
    
    const rendererFeature = tier3Features.find(f => f.name.includes('Renderer'));
    expect(rendererFeature?.compromiseStrategy?.type).toBe('stubbing');
  });

  it('should calculate overall compatibility score', async () => {
    // Mock file system
    createMockFileSystem(mockModFiles);
    
    // Analyze mod
    const result = await featureCompatibilityAnalyzer.analyze('/tmp/mod');
    
    // Check compatibility score
    expect(result.summary.compatibilityScore).toBeGreaterThanOrEqual(0);
    expect(result.summary.compatibilityScore).toBeLessThanOrEqual(100);
    
    // Score should reflect the feature distribution
    const tier1Percentage = (result.summary.tier1Count / result.summary.totalFeatures) * 100;
    const tier2Percentage = (result.summary.tier2Count / result.summary.totalFeatures) * 50;
    const expectedScore = Math.round(tier1Percentage + tier2Percentage);
    
    expect(result.summary.compatibilityScore).toBe(expectedScore);
  });
});