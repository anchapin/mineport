import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationService } from '../../../src/services/ConfigurationService';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and path modules
vi.mock('fs');
vi.mock('path');

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
    logging: {
      level: 'info',
      file: 'logs/app.log',
    },
    processing: {
      maxConcurrent: 5,
    },
  },
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ConfigurationService', () => {
  let configService: ConfigurationService;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Mock fs.existsSync to return false for environment config
    vi.mocked(fs.existsSync).mockImplementation((filePath: string) => {
      return false;
    });
    
    // Create a new instance of ConfigurationService
    configService = new ConfigurationService({
      watchForChanges: false,
    });
  });

  afterEach(() => {
    configService.dispose();
  });

  it('should initialize with default configuration', () => {
    expect(configService.get('server.port')).toBe(3000);
    expect(configService.get('server.host')).toBe('localhost');
    expect(configService.get('database.uri')).toBe('mongodb://localhost:27017/minecraft-mod-converter');
  });

  it('should return default value when key is not found', () => {
    expect(configService.get('nonexistent.key', 'default')).toBe('default');
  });

  it('should set and get configuration values', () => {
    configService.set('server.port', 4000);
    expect(configService.get('server.port')).toBe(4000);
    
    configService.set('newSection.newKey', 'value');
    expect(configService.get('newSection.newKey')).toBe('value');
  });

  it('should get a configuration section', () => {
    const serverSection = configService.getSection('server');
    expect(serverSection).toEqual({
      port: 3000,
      host: 'localhost',
    });
  });

  it('should return an empty object for non-existent section', () => {
    const nonExistentSection = configService.getSection('nonexistent');
    expect(nonExistentSection).toEqual({});
  });

  it('should validate configuration', () => {
    // Register a section with validation
    configService.registerSection({
      name: 'server',
      description: 'Server configuration',
      values: {
        port: {
          key: 'port',
          value: 3000,
          defaultValue: 3000,
          description: 'Server port',
          validation: (value: number) => value >= 1000 && value <= 65535,
        },
        host: {
          key: 'host',
          value: 'localhost',
          defaultValue: 'localhost',
          description: 'Server host',
        },
      },
    });
    
    // Valid configuration
    let result = configService.validate();
    expect(result.isValid).toBe(true);
    expect(result.invalidValues).toHaveLength(0);
    
    // Invalid configuration
    configService.set('server.port', 80);
    result = configService.validate();
    expect(result.isValid).toBe(false);
    expect(result.invalidValues).toHaveLength(1);
    expect(result.invalidValues[0].key).toBe('server.port');
  });

  it('should emit events when configuration is updated', () => {
    const listener = vi.fn();
    configService.on('config:updated', listener);
    
    configService.set('server.port', 4000);
    
    expect(listener).toHaveBeenCalledWith({
      key: 'server.port',
      value: 4000,
    });
  });

  it('should reload configuration', async () => {
    // Set a custom value
    configService.set('server.port', 4000);
    expect(configService.get('server.port')).toBe(4000);
    
    // Reload configuration
    await configService.reload();
    
    // Value should be reset to default
    expect(configService.get('server.port')).toBe(3000);
  });

  it('should export configuration to a file', async () => {
    // Mock fs.writeFileSync
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    
    // Mock path.dirname
    vi.mocked(path.dirname).mockReturnValue('/path/to');
    
    // Export configuration
    await configService.exportConfig('/path/to/config.json');
    
    // Check if writeFileSync was called
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should import configuration from a file', async () => {
    // Mock fs.existsSync to return true for import file
    vi.mocked(fs.existsSync).mockImplementation((filePath: string) => {
      return filePath === '/path/to/config.json';
    });
    
    // Mock fs.readFileSync
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return JSON.stringify({
        server: {
          port: 5000,
        },
      });
    });
    
    // Import configuration
    await configService.importConfig('/path/to/config.json');
    
    // Check if configuration was updated
    expect(configService.get('server.port')).toBe(5000);
  });

  it('should mask sensitive information when exporting', async () => {
    // Set sensitive information
    configService.set('llm.apiKey', 'secret-api-key');
    configService.set('github.token', 'github-token');
    
    // Mock fs.writeFileSync to capture exported config
    let exportedConfig: string = '';
    vi.mocked(fs.writeFileSync).mockImplementation((path, data) => {
      exportedConfig = data as string;
    });
    
    // Mock path.dirname
    vi.mocked(path.dirname).mockReturnValue('/path/to');
    
    // Export configuration
    await configService.exportConfig('/path/to/config.json');
    
    // Parse exported config
    const parsedConfig = JSON.parse(exportedConfig);
    
    // Check if sensitive information was masked
    expect(parsedConfig.llm.apiKey).toBe('********');
    expect(parsedConfig.github.token).toBe('********');
  });
});