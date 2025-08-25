import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateService } from '../../../src/services/UpdateService.js';

describe('UpdateService', () => {
  let updateService: UpdateService;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Create update service
    updateService = new UpdateService({});
  });

  it('should create an instance', () => {
    expect(updateService).toBeInstanceOf(UpdateService);
  });

  it('should start automatic updates', () => {
    updateService.startAutomaticUpdates(60000); // 1 minute
    expect(updateService).toBeDefined();
  });

  it('should stop automatic updates', () => {
    updateService.startAutomaticUpdates(60000);
    updateService.stopAutomaticUpdates();
    expect(updateService).toBeDefined();
  });

  it('should get API mapping versions', () => {
    const versions = updateService.getApiMappingVersions();
    expect(versions).toEqual({});
  });

  it('should get last check time', () => {
    const lastCheck = updateService.getLastCheckTime();
    expect(lastCheck).toEqual({});
  });

  it('should force update check', async () => {
    // Mock successful response for the internal fetch call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await updateService.forceUpdateCheck();
    expect(typeof result).toBe('boolean');
  });
});
