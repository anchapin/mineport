import { vi } from 'vitest';
// Removed unused imports

/**
 * Creates a mock file buffer for testing
 */
export function createMockFileBuffer(content: string): Buffer {
  return Buffer.from(content);
}

/**
 * Creates a mock JAR file structure for testing
 */
export function createMockJarStructure(
  modId: string,
  modLoader: 'forge' | 'fabric'
): Record<string, string> {
  const structure: Record<string, string> = {
    'META-INF/MANIFEST.MF': `Manifest-Version: 1.0\nModId: ${modId}\nVersion: 1.0.0`,
    LICENSE: 'MIT License\n\nCopyright (c) 2023 Test Author\n',
  };

  if (modLoader === 'forge') {
    structure['META-INF/mods.toml'] = `modId="${modId}"\nversion="1.0.0"\ndisplayName="Test Mod"`;
    structure['net/minecraft/test/TestMod.class'] = 'mock class file content';
  } else {
    structure['fabric.mod.json'] = `{"id": "${modId}", "version": "1.0.0", "name": "Test Mod"}`;
    structure['net/minecraft/test/TestMod.class'] = 'mock class file content';
  }

  return structure;
}

/**
 * Creates a mock GitHub API response
 */
export function createMockGitHubResponse(repoName: string, files: string[]): any {
  return {
    data: {
      name: repoName,
      default_branch: 'main',
      contents_url: 'https://api.github.com/repos/owner/{repoName}/contents/{+path}',
      trees_url: 'https://api.github.com/repos/owner/{repoName}/git/trees/{/sha}',
      tree: files.map((file) => ({
        path: file,
        type: file.endsWith('/') ? 'tree' : 'blob',
        sha: `mock-sha-${file.replace(/[^a-z0-9]/g, '')}`,
        url: `https://api.github.com/repos/owner/${repoName}/git/blobs/mock-sha`,
      })),
    },
  };
}

/**
 * Creates a mock file system for testing
 */
export function createMockFileSystem(files: Record<string, string>): void {
  // Mock the fs module
  vi.mock('fs', async () => {
    const actualFs = (await vi.importActual('fs')) as any;
    return {
      ...actualFs,
      promises: {
        ...actualFs.promises,
        readFile: vi.fn((filePath: string) => {
          const normalizedPath = filePath.replace(/\\/g, '/');
          if (files[normalizedPath]) {
            return Promise.resolve(Buffer.from(files[normalizedPath]));
          }
          return Promise.reject(new Error(`ENOENT: no such file or directory, open '${filePath}'`));
        }),
        writeFile: vi.fn((filePath: string, content: string) => {
          const normalizedPath = filePath.replace(/\\/g, '/');
          files[normalizedPath] = content;
          return Promise.resolve();
        }),
        mkdir: vi.fn((_dirPath: string, _options: any) => {
          return Promise.resolve();
        }),
        stat: vi.fn((filePath: string) => {
          const normalizedPath = filePath.replace(/\\/g, '/');
          if (files[normalizedPath]) {
            return Promise.resolve({
              isFile: () => true,
              isDirectory: () => false,
              size: files[normalizedPath].length,
            });
          }
          return Promise.reject(new Error(`ENOENT: no such file or directory, stat '${filePath}'`));
        }),
        access: vi.fn((filePath: string) => {
          const normalizedPath = filePath.replace(/\\/g, '/');
          if (files[normalizedPath]) {
            return Promise.resolve();
          }
          return Promise.reject(
            new Error(`ENOENT: no such file or directory, access '${filePath}'`)
          );
        }),
      },
      existsSync: vi.fn((filePath: string) => {
        const normalizedPath = filePath.replace(/\\/g, '/');
        return !!files[normalizedPath];
      }),
      readFileSync: vi.fn((filePath: string) => {
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (files[normalizedPath]) {
          return Buffer.from(files[normalizedPath]);
        }
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      }),
      writeFileSync: vi.fn((filePath: string, content: string) => {
        const normalizedPath = filePath.replace(/\\/g, '/');
        files[normalizedPath] = content;
      }),
      mkdirSync: vi.fn((_dirPath: string, _options: any) => {
        return;
      }),
    };
  });
}

/**
 * Creates a mock for the unzipper library
 */
export function mockUnzipper(fileStructure: Record<string, string>): void {
  vi.mock('unzipper', () => {
    return {
      Open: {
        buffer: vi.fn(async (_buffer: Buffer) => {
          return {
            files: Object.keys(fileStructure).map((filePath) => ({
              path: filePath,
              type: 'File',
              buffer: async () => Buffer.from(fileStructure[filePath]),
            })),
            extract: vi.fn(async (_options: any) => {
              // Mock extraction logic
              return Promise.resolve();
            }),
          };
        }),
      },
    };
  });
}

/**
 * Creates a mock for the LLM API client
 */
export function mockLLMClient(responses: Record<string, any>): void {
  vi.mock('../../../src/services/LLMClient', () => {
    return {
      LLMClient: vi.fn().mockImplementation(() => {
        return {
          translate: vi.fn((input: string, _context: any) => {
            const key = input.substring(0, 50); // Use first 50 chars as key
            if (responses[key]) {
              return Promise.resolve(responses[key]);
            }
            return Promise.resolve({ translation: 'Mock translation result' });
          }),
        };
      }),
    };
  });
}

/**
 * Resets all mocks
 */
export function resetAllMocks(): void {
  vi.resetAllMocks();
  vi.resetModules();
}
