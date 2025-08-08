import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateService, UpdateType } from '../../../src/services/UpdateService.js';

describe('UpdateService', () => {
  let updateService: UpdateService;
  let mockFetch: any;

  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Create update service
    updateService = new UpdateService({
      apiMappingEndpoint: 'https://api.example.com/mappings',
      updateCheckInterval: 86400000, // 24 hours
    });
  });

  it('should check for updates', async () => {
    // Mock successful response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        apiMappings: {
          version: '1.2.0',
          updateAvailable: true,
          lastUpdated: '2023-01-01T00:00:00Z',
        },
      }),
    });

    const updates = await updateService.checkForUpdates();

    expect(updates).toEqual({
      apiMappings: {
        version: '1.2.0',
        updateAvailable: true,
        lastUpdated: '2023-01-01T00:00:00Z',
      },
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/mappings', expect.any(Object));
  });

  it('should handle update check failures', async () => {
    // Mock failed response
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(updateService.checkForUpdates()).rejects.toThrow('Network error');
  });

  it('should apply API mapping updates', async () => {
    // Mock the database service
    const mockDb = {
      updateApiMappings: vi.fn().mockResolvedValue(true),
    };

    // Create update service with mock db
    updateService = new UpdateService({
      apiMappingEndpoint: 'https://api.example.com/mappings',
      updateCheckInterval: 86400000,
      db: mockDb as any,
    });

    // Mock successful response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mappings: [{ javaSignature: 'test.Class', bedrockEquivalent: 'test.BedrockClass' }],
        version: '1.2.0',
      }),
    });

    const result = await updateService.applyUpdate(UpdateType.API_MAPPINGS);

    expect(result).toBe(true);
    expect(mockDb.updateApiMappings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          javaSignature: 'test.Class',
          bedrockEquivalent: 'test.BedrockClass',
        }),
      ]),
      '1.2.0'
    );
  });

  it('should schedule automatic update checks', () => {
    // Mock setInterval
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    // Create update service with automatic checks
    updateService = new UpdateService({
      apiMappingEndpoint: 'https://api.example.com/mappings',
      updateCheckInterval: 86400000,
      autoCheckUpdates: true,
    });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 86400000);
  });

  it('should notify subscribers of updates', async () => {
    // Create a subscriber
    const subscriber = vi.fn();

    // Subscribe to updates
    updateService.subscribe(UpdateType.API_MAPPINGS, subscriber);

    // Mock successful response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        apiMappings: {
          version: '1.2.0',
          updateAvailable: true,
          lastUpdated: '2023-01-01T00:00:00Z',
        },
      }),
    });

    // Check for updates
    await updateService.checkForUpdates();

    // Subscriber should be notified
    expect(subscriber).toHaveBeenCalledWith({
      version: '1.2.0',
      updateAvailable: true,
      lastUpdated: '2023-01-01T00:00:00Z',
    });
  });

  it('should unsubscribe from updates', async () => {
    // Create a subscriber
    const subscriber = vi.fn();

    // Subscribe to updates
    const unsubscribe = updateService.subscribe(UpdateType.API_MAPPINGS, subscriber);

    // Unsubscribe
    unsubscribe();

    // Mock successful response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        apiMappings: {
          version: '1.2.0',
          updateAvailable: true,
          lastUpdated: '2023-01-01T00:00:00Z',
        },
      }),
    });

    // Check for updates
    await updateService.checkForUpdates();

    // Subscriber should not be notified
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('should get update history', async () => {
    // Mock the database service
    const mockDb = {
      getUpdateHistory: vi.fn().mockResolvedValue([
        {
          type: UpdateType.API_MAPPINGS,
          version: '1.1.0',
          timestamp: new Date('2023-01-01T00:00:00Z'),
          success: true,
        },
        {
          type: UpdateType.API_MAPPINGS,
          version: '1.2.0',
          timestamp: new Date('2023-02-01T00:00:00Z'),
          success: true,
        },
      ]),
    };

    // Create update service with mock db
    updateService = new UpdateService({
      apiMappingEndpoint: 'https://api.example.com/mappings',
      updateCheckInterval: 86400000,
      db: mockDb as any,
    });

    const history = await updateService.getUpdateHistory(UpdateType.API_MAPPINGS);

    expect(history).toHaveLength(2);
    expect(history[0].version).toBe('1.1.0');
    expect(history[1].version).toBe('1.2.0');
    expect(mockDb.getUpdateHistory).toHaveBeenCalledWith(UpdateType.API_MAPPINGS);
  });
});
