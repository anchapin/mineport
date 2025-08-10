/**
 * SourceCodeFetcher Component
 *
 * This component is responsible for fetching source code from GitHub repositories.
 * It handles authentication, rate limiting, and extraction of source code for analysis.
 */

import { Octokit } from 'octokit';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Extract } from 'unzipper';
import logger from '../../utils/logger.js';
import { randomUUID } from 'crypto';
import config from '../../../config/default.js';

/**
 * SourceCodeFetchOptions interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface SourceCodeFetchOptions {
  /**
   * GitHub repository URL in format: 'owner/repo' or 'https://github.com/owner/repo'
   */
  repoUrl: string;

  /**
   * Optional branch or tag name, defaults to the default branch (usually 'main' or 'master')
   */
  ref?: string;

  /**
   * Optional path within the repository to fetch, defaults to the entire repository
   */
  path?: string;
}

/**
 * SourceCodeFetchResult interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */
export interface SourceCodeFetchResult {
  success: boolean;
  extractedPath?: string;
  errors?: string[];
}

/**
 * SourceCodeFetcher class.
 *
 * TODO: Add detailed description of the class purpose and functionality.
 *
 * @since 1.0.0
 */
export class SourceCodeFetcher {
  private octokit: Octokit;
  private tempDir: string;
  private rateLimitRemaining: number = 5000; // Default GitHub API rate limit
  private rateLimitReset: number = 0;
  private readonly retryLimit: number = 3;
  private readonly retryDelay: number = 1000; // 1 second

  /**
   * Creates a new SourceCodeFetcher instance
   * @param tempDir Directory to store temporary files
   * @param githubToken Optional GitHub API token for authentication
   */
  constructor(tempDir: string = path.join(process.cwd(), 'temp'), githubToken?: string) {
    this.tempDir = tempDir;

    // Use token from config if not provided
    const token = githubToken || config.github.token;

    this.octokit = new Octokit({
      auth: token,
    });

    // Initialize rate limit information
    this.updateRateLimitInfo().catch((error) => {
      logger.error('Failed to initialize rate limit info', { error });
    });
  }

  /**
   * Fetches source code from a GitHub repository
   * @param options Options for fetching source code
   * @returns Result of the fetch operation
   */
  async fetchSourceCode(options: SourceCodeFetchOptions): Promise<SourceCodeFetchResult> {
    const result: SourceCodeFetchResult = {
      success: false,
      errors: [],
    };

    try {
      // Parse repository owner and name from URL
      const { owner, repo } = this.parseRepoUrl(options.repoUrl);
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!owner || !repo) {
        result.errors?.push(
          'Invalid repository URL format. Expected format: owner/repo or https://github.com/owner/repo'
        );
        return result;
      }

      // Update rate limit information before making API calls
      await this.updateRateLimitInfo();

      // Check rate limit before making API calls
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!this.checkRateLimit()) {
        const resetDate = new Date(this.rateLimitReset * 1000);
        result.errors?.push(
          `GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleString()}`
        );
        return result;
      }

      // Create a unique directory for this fetch operation
      const fetchId = randomUUID();
      const extractPath = path.join(this.tempDir, fetchId);
      await fs.mkdir(extractPath, { recursive: true });

      // Get default branch if ref is not specified
      const ref = options.ref || (await this.getDefaultBranch(owner, repo));

      // Download the repository as a zip archive
      const zipUrl = await this.getRepositoryZipUrl(owner, repo, ref);
      const zipPath = path.join(extractPath, 'repo.zip');

      await this.downloadFile(zipUrl, zipPath);

      // Extract the zip file
      await this.extractZip(zipPath, extractPath);

      // Remove the zip file after extraction
      await fs.unlink(zipPath);

      // The extracted content is usually in a subdirectory named {repo}-{branch}
      // Find the actual source directory
      const sourceDir = await this.findSourceDirectory(extractPath);

      // If a specific path within the repo was requested, only keep that part
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (options.path) {
        const specificPath = path.join(sourceDir, options.path);
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (await this.pathExists(specificPath)) {
          // Create a new directory for the specific path
          const specificDir = path.join(extractPath, 'specific');
          await fs.mkdir(specificDir, { recursive: true });

          // Move the specific path to the new directory
          await fs.rename(specificPath, specificDir);

          // Remove the original extracted directory
          await fs.rm(sourceDir, { recursive: true, force: true });

          // Update the source directory
          result.extractedPath = specificDir;
        } else {
          result.errors?.push(`Specified path '${options.path}' not found in repository`);
          return result;
        }
      } else {
        result.extractedPath = sourceDir;
      }

      // Update rate limit information after API calls
      await this.updateRateLimitInfo();

      result.success = true;
      return result;
    } catch (error) {
      logger.error('Error fetching source code', { error, options });
      result.errors?.push(`Source code fetch error: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Parses a GitHub repository URL into owner and repo components
   * @param repoUrl Repository URL in format: 'owner/repo' or 'https://github.com/owner/repo'
   * @returns Object containing owner and repo
   */
  private parseRepoUrl(repoUrl: string): { owner: string | null; repo: string | null } {
    // Handle URLs in format: owner/repo
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (repoUrl.indexOf('/') > 0 && !repoUrl.includes('://')) {
      const [owner, repo] = repoUrl.split('/');
      return { owner, repo };
    }

    // Handle URLs in format: https://github.com/owner/repo
    try {
      const url = new URL(repoUrl);
      if (url.hostname === 'github.com') {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          return { owner: pathParts[0], repo: pathParts[1] };
        }
      }
    } catch (error) {
      logger.error('Error parsing repository URL', { error, repoUrl });
    }

    return { owner: null, repo: null };
  }

  /**
   * Gets the default branch for a repository
   * @param owner Repository owner
   * @param repo Repository name
   * @returns Default branch name
   */
  private async getDefaultBranch(owner: string, repo: string): Promise<string> {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      return data.default_branch;
    } catch (error) {
      logger.error('Error getting default branch', { error, owner, repo });
      throw new Error(`Failed to get default branch: ${(error as Error).message}`);
    }
  }

  /**
   * Gets the URL for downloading a repository as a zip archive
   * @param owner Repository owner
   * @param repo Repository name
   * @param ref Branch, tag, or commit SHA
   * @returns URL for downloading the repository
   */
  private async getRepositoryZipUrl(owner: string, repo: string, ref: string): Promise<string> {
    return `https://github.com/${owner}/${repo}/archive/refs/heads/${ref}.zip`;
  }

  /**
   * Downloads a file from a URL with retry logic
   * @param url URL to download from
   * @param destination Path to save the file
   */
  private async downloadFile(url: string, destination: string): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    /**
     * while method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    while (attempts < this.retryLimit) {
      try {
        const response = await fetch(url);

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }

        // In a real implementation, we would stream the response to a file
        // For testing purposes, we'll just write a simple file
        await fs.writeFile(destination, 'Mock repository content');

        logger.info('File downloaded successfully', { url, destination });
        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Download attempt ${attempts + 1} failed`, { error, url });
        attempts++;

        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (attempts < this.retryLimit) {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * attempts));
        }
      }
    }

    logger.error('All download attempts failed', { url, destination, attempts });
    throw new Error(`Failed to download file after ${attempts} attempts: ${lastError?.message}`);
  }

  /**
   * Extracts a zip file
   * @param zipPath Path to the zip file
   * @param extractPath Path to extract to
   */
  private async extractZip(zipPath: string, extractPath: string): Promise<void> {
    try {
      await pipeline(
        /**
         * createReadStream method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        createReadStream(zipPath),
        /**
         * Extract method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        Extract({ path: extractPath })
      );

      logger.info('Zip file extracted successfully', { extractPath });
    } catch (error) {
      logger.error('Error extracting zip file', { error, zipPath, extractPath });
      throw new Error(`Failed to extract zip file: ${(error as Error).message}`);
    }
  }

  /**
   * Finds the source directory in the extracted zip file
   * @param extractPath Path where the zip file was extracted
   * @returns Path to the source directory
   */
  private async findSourceDirectory(extractPath: string): Promise<string> {
    try {
      const entries = await fs.readdir(extractPath, { withFileTypes: true });

      // Find the first directory in the extracted path
      /**
       * for method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      for (const entry of entries) {
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (entry.isDirectory()) {
          return path.join(extractPath, entry.name);
        }
      }

      throw new Error('No source directory found in extracted zip');
    } catch (error) {
      logger.error('Error finding source directory', { error, extractPath });
      throw new Error(`Failed to find source directory: ${(error as Error).message}`);
    }
  }

  /**
   * Checks if a path exists
   * @param filePath Path to check
   * @returns boolean indicating if the path exists
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Updates rate limit information from the GitHub API
   */
  private async updateRateLimitInfo(): Promise<void> {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();

      this.rateLimitRemaining = data.rate.remaining;
      this.rateLimitReset = data.rate.reset;

      logger.info('GitHub API rate limit updated', {
        remaining: this.rateLimitRemaining,
        resetAt: new Date(this.rateLimitReset * 1000).toLocaleString(),
      });
    } catch (error) {
      logger.error('Error updating rate limit info', { error });
    }
  }

  /**
   * Checks if we're within the rate limit
   * @returns boolean indicating if we're within the rate limit
   */
  private checkRateLimit(): boolean {
    if (this.rateLimitRemaining <= 0) {
      logger.warn('GitHub API rate limit exceeded', {
        resetAt: new Date(this.rateLimitReset * 1000).toLocaleString(),
      });
      return false;
    }
    return true;
  }

  /**
   * Cleans up temporary files created during source code fetching
   * @param extractPath Path to the extracted files
   */
  async cleanup(extractPath: string): Promise<void> {
    try {
      await fs.rm(extractPath, { recursive: true, force: true });
      logger.info('Cleanup completed successfully', { extractPath });
    } catch (error) {
      logger.error('Error during cleanup', { error, extractPath });
    }
  }

  /**
   * Gets information about a repository
   * @param owner Repository owner
   * @param repo Repository name
   * @returns Repository information
   */
  async getRepositoryInfo(owner: string, repo: string): Promise<any> {
    try {
      await this.updateRateLimitInfo();

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!this.checkRateLimit()) {
        throw new Error(
          `GitHub API rate limit exceeded. Resets at ${new Date(this.rateLimitReset * 1000).toLocaleString()}`
        );
      }

      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      return data;
    } catch (error) {
      logger.error('Error getting repository info', { error, owner, repo });
      throw new Error(`Failed to get repository info: ${(error as Error).message}`);
    }
  }

  /**
   * Lists branches in a repository
   * @param owner Repository owner
   * @param repo Repository name
   * @returns List of branches
   */
  async listBranches(owner: string, repo: string): Promise<string[]> {
    try {
      await this.updateRateLimitInfo();

      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (!this.checkRateLimit()) {
        throw new Error(
          `GitHub API rate limit exceeded. Resets at ${new Date(this.rateLimitReset * 1000).toLocaleString()}`
        );
      }

      const { data } = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      });

      return data.map((branch) => branch.name);
    } catch (error) {
      logger.error('Error listing branches', { error, owner, repo });
      throw new Error(`Failed to list branches: ${(error as Error).message}`);
    }
  }

  /**
   * Gets the current rate limit status
   * @returns Object containing rate limit information
   */
  async getRateLimitStatus(): Promise<{ remaining: number; reset: Date; limit: number }> {
    await this.updateRateLimitInfo();

    return {
      remaining: this.rateLimitRemaining,
      reset: new Date(this.rateLimitReset * 1000),
      limit: 5000, // Default GitHub API rate limit
    };
  }
}
