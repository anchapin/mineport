import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationService } from '../../../src/services/ConfigurationService.js';
import { ConfigurationAdminService } from '../../../src/services/ConfigurationAdminService.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and path modules
vi.mock('fs');
vi.mock('path');

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock default config
vi.mock('../../../config/default', () => ({
  default: {
    server: {
      port: 3000,
      host: 'localhost',
    },
    database: {
      uri: 'mongodb://localhost:27017/minecraft-mod-converter',
    },
  },
}));

describe('ConfigurationAdminService', () => {
  let configService: ConfigurationService;
  let adminService: ConfigurationAdminService;
  let mockVersionsPath: string;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Mock path.resolve to return a fixed path
    mockVersionsPath = '/mock/path/to/versions';
    vi.mocked(path.resolve).mockReturnValue(mockVersionsPath);

    // Mock path.join to concatenate paths
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));

    // Mock fs.existsSync to return false for versions directory
    vi.mocked(fs.existsSync).mockImplementation((path: string) => {
      return path !== mockVersionsPath;
    });

    // Mock fs.mkdirSync
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

    // Mock fs.readdirSync to return empty array
    vi.mocked(fs.readdirSync).mockReturnValue([]);

    // Create a new instance of ConfigurationService
    configService = new ConfigurationService({
      watchForChanges: false,
    });

    // Create a new instance of ConfigurationAdminService
    adminService = new ConfigurationAdminService({
      configService,
      versionsPath: mockVersionsPath,
    });
  });

  afterEach(() => {
    configService.dispose();
  });

  it('should create a new configuration version', async () => {
    // Mock fs.writeFileSync
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

    // Create a new version
    const version = await adminService.createVersion('Test version', 'testuser');

    // Check version properties
    expect(version.id).toBeDefined();
    expect(version.timestamp).toBeInstanceOf(Date);
    expect(version.user).toBe('testuser');
    expect(version.description).toBe('Test version');
    expect(version.config).toBeDefined();

    // Check if version was saved
    expect(fs.writeFileSync).toHaveBeenCalled();

    // Check if version is in the list
    const versions = adminService.getVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0].id).toBe(version.id);
  });

  it('should get a specific version', async () => {
    // Mock fs.writeFileSync
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

    // Create a new version
    const version = await adminService.createVersion('Test version');

    // Get the version
    const retrievedVersion = adminService.getVersion(version.id);

    // Check if version was retrieved
    expect(retrievedVersion).toBeDefined();
    expect(retrievedVersion?.id).toBe(version.id);
  });

  it('should apply a configuration version', async () => {
    // Mock fs.writeFileSync
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

    // Set some configuration values
    configService.set('server.port', 4000);
    configService.set('server.host', 'example.com');

    // Create a new version
    const version = await adminService.createVersion('Test version');

    // Change configuration
    configService.set('server.port', 5000);

    // Apply the version
    const result = await adminService.applyVersion(version.id);

    // Check if version was applied
    expect(result).toBe(true);

    // Check if configuration was restored
    expect(configService.get('server.port')).toBe(4000);
    expect(configService.get('server.host')).toBe('example.com');
  });

  it('should delete a configuration version', async () => {
    // Mock fs.writeFileSync and fs.unlinkSync
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
    vi.mocked(fs.existsSync).mockImplementation(() => true);

    // Create a new version
    const version = await adminService.createVersion('Test version');

    // Delete the version
    const result = await adminService.deleteVersion(version.id);

    // Check if version was deleted
    expect(result).toBe(true);
    expect(fs.unlinkSync).toHaveBeenCalled();

    // Check if version is no longer in the list
    const versions = adminService.getVersions();
    expect(versions).toHaveLength(0);
  });

  it('should compare two configuration versions', async () => {
    // Mock fs.writeFileSync
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

    // Create first version
    configService.set('server.port', 3000);
    const version1 = await adminService.createVersion('Version 1');

    // Change configuration and create second version
    configService.set('server.port', 4000);
    configService.set('database.uri', 'mongodb://example.com/db');
    const version2 = await adminService.createVersion('Version 2');

    // Compare versions
    const differences = adminService.compareVersions(version1.id, version2.id);

    // Check differences
    expect(differences['server.port']).toBeDefined();
    expect(differences['server.port'].before).toBe(3000);
    expect(differences['server.port'].after).toBe(4000);

    expect(differences['database.uri']).toBeDefined();
    expect(differences['database.uri'].before).toBe(
      'mongodb://localhost:27017/minecraft-mod-converter'
    );
    expect(differences['database.uri'].after).toBe('mongodb://example.com/db');
  });

  it('should prune old versions when maxVersions is reached', async () => {
    // Mock fs.writeFileSync and fs.unlinkSync
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
    vi.mocked(fs.existsSync).mockImplementation(() => true);

    // Create adminService with maxVersions=2
    adminService = new ConfigurationAdminService({
      configService,
      versionsPath: mockVersionsPath,
      maxVersions: 2,
    });

    // Create three versions
    const version1 = await adminService.createVersion('Version 1');
    const version2 = await adminService.createVersion('Version 2');
    const version3 = await adminService.createVersion('Version 3');

    // Check if oldest version was pruned
    const versions = adminService.getVersions();
    expect(versions).toHaveLength(2);
    expect(versions[0].id).toBe(version3.id);
    expect(versions[1].id).toBe(version2.id);
    expect(adminService.getVersion(version1.id)).toBeUndefined();
  });

  it('should load existing versions from disk', () => {
    // Mock fs.readdirSync to return version files
    vi.mocked(fs.readdirSync).mockReturnValue(['v1.json', 'v2.json']);

    // Mock fs.readFileSync to return version content
    vi.mocked(fs.readFileSync).mockImplementation((filePath: string) => {
      if (filePath === `${mockVersionsPath}/v1.json`) {
        return JSON.stringify({
          id: 'v1',
          timestamp: new Date().toISOString(),
          description: 'Version 1',
          config: { server: { port: 3000 } },
        });
      } else if (filePath === `${mockVersionsPath}/v2.json`) {
        return JSON.stringify({
          id: 'v2',
          timestamp: new Date().toISOString(),
          description: 'Version 2',
          config: { server: { port: 4000 } },
        });
      }
      return '';
    });

    // Create adminService to load versions
    adminService = new ConfigurationAdminService({
      configService,
      versionsPath: mockVersionsPath,
    });

    // Check if versions were loaded
    const versions = adminService.getVersions();
    expect(versions).toHaveLength(2);
    expect(versions[0].id).toBe('v2');
    expect(versions[1].id).toBe('v1');
  });
});
