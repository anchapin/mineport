import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CacheService,
  CacheKeyGenerator,
  CacheInvalidationStrategy,
} from '../../../src/services/CacheService.js';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService({ enabled: true });
    cacheService.resetMetrics();
  });

  it('should store and retrieve values', async () => {
    const key = 'test:key';
    const value = { data: 'test value' };

    await cacheService.set(key, value);
    const retrieved = await cacheService.get(key);

    expect(retrieved).toEqual(value);
  });

  it('should handle cache misses', async () => {
    const key = 'nonexistent:key';
    const value = await cacheService.get(key);

    expect(value).toBeNull();
  });

  it('should delete values', async () => {
    const key = 'test:key';
    const value = { data: 'test value' };

    await cacheService.set(key, value);
    await cacheService.delete(key);
    const retrieved = await cacheService.get(key);

    expect(retrieved).toBeNull();
  });

  it('should track metrics', async () => {
    const key1 = 'test:key1';
    const key2 = 'test:key2';
    const value = { data: 'test value' };

    // Set two values
    await cacheService.set(key1, value);
    await cacheService.set(key2, value);

    // Get one existing and one non-existing value
    await cacheService.get(key1);
    await cacheService.get('nonexistent');

    // Delete one value
    await cacheService.delete(key2);

    const metrics = cacheService.getMetrics();

    expect(metrics.sets).toBe(2);
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(1);
    expect(metrics.invalidations).toBe(1);
  });

  it('should respect the enabled flag', async () => {
    const key = 'test:key';
    const value = { data: 'test value' };

    // Set with cache enabled
    await cacheService.set(key, value);
    let retrieved = await cacheService.get(key);
    expect(retrieved).toEqual(value);

    // Disable cache
    cacheService.setEnabled(false);

    // Should return null even though value exists
    retrieved = await cacheService.get(key);
    expect(retrieved).toBeNull();

    // Should not store new values
    await cacheService.set('new:key', { data: 'new value' });

    // Re-enable cache
    cacheService.setEnabled(true);

    // Original value should still exist
    retrieved = await cacheService.get(key);
    expect(retrieved).toEqual(value);

    // New value should not exist
    retrieved = await cacheService.get('new:key');
    expect(retrieved).toBeNull();
  });
});

describe('CacheKeyGenerator', () => {
  it('should generate consistent keys for mod analysis', () => {
    const key = CacheKeyGenerator.modAnalysis('test-mod', '1.0.0');
    expect(key).toBe('mod_analysis:test-mod:1.0.0');
  });

  it('should generate consistent keys for asset conversion', () => {
    const key = CacheKeyGenerator.assetConversion('test-mod', 'texture', 'dirt');
    expect(key).toBe('asset_conversion:test-mod:texture:dirt');
  });

  it('should generate consistent keys for API mapping', () => {
    const key = CacheKeyGenerator.apiMapping('net.minecraft.world.level.block.Block', '1.19');
    expect(key).toBe('api_mapping:1.19:net.minecraft.world.level.block.Block');
  });

  it('should generate consistent keys for code translation', () => {
    const key = CacheKeyGenerator.codeTranslation('abc123');
    expect(key).toBe('code_translation:abc123');
  });
});

describe('CacheInvalidationStrategy', () => {
  let cacheService: CacheService;
  let invalidationStrategy: CacheInvalidationStrategy;

  beforeEach(() => {
    cacheService = new CacheService({ enabled: true });
    invalidationStrategy = new CacheInvalidationStrategy(cacheService);

    // Set up some test data
    vi.spyOn(cacheService, 'clearByPrefix');
  });

  it('should invalidate mod cache', async () => {
    await invalidationStrategy.invalidateModCache('test-mod');
    expect(cacheService.clearByPrefix).toHaveBeenCalledWith('mod_analysis:test-mod');
  });

  it('should invalidate asset cache', async () => {
    await invalidationStrategy.invalidateAssetCache('test-mod');
    expect(cacheService.clearByPrefix).toHaveBeenCalledWith('asset_conversion:test-mod');
  });

  it('should invalidate API mapping cache', async () => {
    await invalidationStrategy.invalidateApiMappingCache('1.19');
    expect(cacheService.clearByPrefix).toHaveBeenCalledWith('api_mapping:1.19');
  });

  it('should invalidate all caches', async () => {
    await invalidationStrategy.invalidateAllCaches();
    expect(cacheService.clearByPrefix).toHaveBeenCalledWith('mod_analysis:');
    expect(cacheService.clearByPrefix).toHaveBeenCalledWith('asset_conversion:');
    expect(cacheService.clearByPrefix).toHaveBeenCalledWith('api_mapping:');
    expect(cacheService.clearByPrefix).toHaveBeenCalledWith('code_translation:');
  });
});
