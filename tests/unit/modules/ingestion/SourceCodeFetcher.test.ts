import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SourceCodeFetcher,
  SourceCodeFetchOptions,
} from '../../../../src/modules/ingestion/SourceCodeFetcher.js';
import {
  createMockGitHubResponse,
  mockOctokit,
  resetAllMocks,
} from '../../../utils/testHelpers.js';
import * as fs from 'fs';

describe('SourceCodeFetcher', () => {
  let sourceCodeFetcher: SourceCodeFetcher;
  let mockGitHubResponses: Record<string, any>;

  beforeEach(() => {
    // Create mock GitHub responses
    mockGitHubResponses = {
      'owner/repo/': createMockGitHubResponse('repo', [
        'src/main/java/com/example/mod/ModMain.java',
        'src/main/java/com/example/mod/blocks/CustomBlock.java',
        'src/main/resources/assets/mod/textures/block/custom_block.png',
        'build.gradle',
        'LICENSE',
      ]),
      'owner/repo/commit/main': {
        data: {
          sha: 'abc123',
          commit: {
            message: 'Initial commit',
          },
        },
      },
      'owner/repo/tree/abc123': {
        data: {
          tree: [
            {
              path: 'src/main/java/com/example/mod/ModMain.java',
              type: 'blob',
              sha: 'file1-sha',
              url: 'https://api.github.com/repos/owner/repo/git/blobs/file1-sha',
            },
            {
              path: 'src/main/java/com/example/mod/blocks/CustomBlock.java',
              type: 'blob',
              sha: 'file2-sha',
              url: 'https://api.github.com/repos/owner/repo/git/blobs/file2-sha',
            },
            {
              path: 'src/main/resources/assets/mod/textures/block/custom_block.png',
              type: 'blob',
              sha: 'file3-sha',
              url: 'https://api.github.com/repos/owner/repo/git/blobs/file3-sha',
            },
          ],
        },
      },
      'owner/repo/blob/file1-sha': {
        data: {
          content: Buffer.from('public class ModMain {}').toString('base64'),
          encoding: 'base64',
        },
      },
      'owner/repo/blob/file2-sha': {
        data: {
          content: Buffer.from('public class CustomBlock {}').toString('base64'),
          encoding: 'base64',
        },
      },
    };

    // Mock Octokit
    mockOctokit(mockGitHubResponses);

    // Create fetcher
    sourceCodeFetcher = new SourceCodeFetcher('/tmp/test', 'mock-token');
  });

  afterEach(() => {
    resetAllMocks();
  });

  it('should parse GitHub repository URL correctly', () => {
    // Test HTTPS URL
    let repoInfo = (sourceCodeFetcher as any).parseRepoUrl('https://github.com/owner/repo');
    expect(repoInfo).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
    });

    // Test SSH URL
    repoInfo = (sourceCodeFetcher as any).parseRepoUrl('git@github.com:owner/repo.git');
    expect(repoInfo).toEqual({
      owner: 'owner',
      repo: 'repo',
    });

    // Test URL with branch
    repoInfo = (sourceCodeFetcher as any).parseRepoUrl(
      'https://github.com/owner/repo/tree/develop'
    );
    expect(repoInfo).toEqual({
      owner: 'owner',
      repo: 'repo',
    });

    // Test invalid URL
    expect(() => {
      (sourceCodeFetcher as any).parseRepoUrl('https://example.com/not-github');
    }).toThrow();
  });

  it('should fetch repository metadata', async () => {
    // Test getting repository info
    const repoInfo = await sourceCodeFetcher.getRepositoryInfo('owner', 'repo');

    // Check metadata
    expect(repoInfo).toBeDefined();
    expect(repoInfo.name).toBe('repo');
    expect(repoInfo.owner.login).toBe('owner');
  });

  it('should fetch source code files', async () => {
    // Mock fs.promises.mkdir
    const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

    // Mock fs.promises.writeFile
    const writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

    // Fetch source code
    const options: SourceCodeFetchOptions = {
      repoUrl: 'https://github.com/owner/repo',
      ref: 'main',
    };
    const result = await sourceCodeFetcher.fetchSourceCode(options);

    // Check that directories were created
    expect(mkdirSpy).toHaveBeenCalled();

    // Check that files were written
    expect(writeFileSpy).toHaveBeenCalled();

    // Check result
    expect(result.success).toBe(true);
    expect(result.extractedPath).toBeDefined();
    expect(result.errors).toEqual([]);
  });

  it('should filter source code files by pattern', async () => {
    // Mock fs.promises.mkdir
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

    // Mock fs.promises.writeFile
    const writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

    // Fetch source code with filter
    const options: SourceCodeFetchOptions = {
      repoUrl: 'https://github.com/owner/repo',
      ref: 'main',
      path: '**/*.java', // Use path parameter for filtering
    };

    await sourceCodeFetcher.fetchSourceCode(options);

    // Check that only matching files were written
    const writeFileCalls = writeFileSpy.mock.calls;

    // Should include ModMain.java but not CustomBlock.java
    const writtenFiles = writeFileCalls.map((call) => call[0]);
    expect(writtenFiles.some((file) => file.includes('ModMain.java'))).toBe(true);
    expect(writtenFiles.some((file) => file.includes('CustomBlock.java'))).toBe(false);
  });

  it('should handle API rate limiting', async () => {
    // Mock rate limit error
    const rateLimitError = new Error('API rate limit exceeded');
    rateLimitError.name = 'HttpError';
    (rateLimitError as any).status = 403;
    (rateLimitError as any).response = {
      headers: {
        'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 60, // 1 minute from now
      },
    };

    // Override mock response to throw rate limit error
    mockGitHubResponses['owner/repo/'] = () => {
      throw rateLimitError;
    };

    // Mock setTimeout
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    // Fetch source code (should handle rate limiting)
    const options: SourceCodeFetchOptions = {
      repoUrl: 'https://github.com/owner/repo',
      ref: 'main',
    };

    // This should fail because we're not actually waiting for the timeout
    await expect(sourceCodeFetcher.fetchSourceCode(options)).rejects.toThrow();

    // Check that setTimeout was called with a delay
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(setTimeoutSpy.mock.calls[0][1]).toBeGreaterThan(0);
  });

  it('should handle authentication errors', async () => {
    // Create fetcher with invalid token
    const invalidFetcher = new SourceCodeFetcher('/tmp/test', 'invalid-token');

    // Mock authentication error
    const authError = new Error('Bad credentials');
    authError.name = 'HttpError';
    (authError as any).status = 401;

    // Override mock response to throw authentication error
    mockGitHubResponses['owner/repo/'] = () => {
      throw authError;
    };

    // Fetch source code (should fail with authentication error)
    const options: SourceCodeFetchOptions = {
      repoUrl: 'https://github.com/owner/repo',
      ref: 'main',
    };

    await expect(invalidFetcher.fetchSourceCode(options)).rejects.toThrow(/Authentication failed/);
  });

  it('should handle repository not found errors', async () => {
    // Override mock response to throw not found error
    const notFoundError = new Error('Not Found');
    notFoundError.name = 'HttpError';
    (notFoundError as any).status = 404;

    mockGitHubResponses['owner/repo/'] = () => {
      throw notFoundError;
    };

    // Fetch source code (should fail with not found error)
    const options: SourceCodeFetchOptions = {
      repoUrl: 'https://github.com/owner/repo',
      ref: 'main',
    };

    await expect(sourceCodeFetcher.fetchSourceCode(options)).rejects.toThrow(
      /Repository not found/
    );
  });
});
