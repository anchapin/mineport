#!/usr/bin/env node

/**
 * Artifact Management Utility
 * Provides comprehensive artifact creation, versioning, and management capabilities
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class ArtifactManager {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || 'artifacts',
      packageName: options.packageName || 'minecraft-mod-converter',
      registryUrl: options.registryUrl || 'ghcr.io',
      ...options,
    };

    this.metadata = null;
    this.manifest = {
      manifest_version: '1.0',
      artifacts: [],
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Generate comprehensive artifact metadata
   */
  generateMetadata() {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const gitCommit = this.getGitCommit();
    const gitBranch = this.getGitBranch();

    this.metadata = {
      artifact: {
        name: this.options.packageName,
        version: this.generateVersion(packageJson.version, gitBranch),
        package_version: packageJson.version,
        build_number: this.generateBuildNumber(),
        is_release: this.isRelease(),
      },
      source: {
        repository: this.getRepositoryUrl(),
        commit_sha: gitCommit,
        commit_sha_short: gitCommit.substring(0, 8),
        branch: gitBranch,
        ref: process.env.GITHUB_REF || `refs/heads/${gitBranch}`,
        event: process.env.GITHUB_EVENT_NAME || 'manual',
      },
      build: {
        timestamp: new Date().toISOString(),
        runner: process.platform,
        workflow: process.env.GITHUB_WORKFLOW || 'local',
        run_id: process.env.GITHUB_RUN_ID || 'local',
        run_number: process.env.GITHUB_RUN_NUMBER || '1',
        actor: process.env.GITHUB_ACTOR || process.env.USER || 'unknown',
      },
      environment: {
        node_version: process.version,
        npm_version: this.getNpmVersion(),
        os: process.platform,
        arch: process.arch,
      },
    };

    return this.metadata;
  }

  /**
   * Generate version string based on context
   */
  generateVersion(packageVersion, branch) {
    const buildNumber = this.generateBuildNumber();

    if (this.isRelease()) {
      return process.env.GITHUB_REF_NAME || packageVersion;
    }

    if (branch === 'main') {
      return `${packageVersion}-${buildNumber}`;
    }

    return `${packageVersion}-${branch}-${buildNumber}`;
  }

  /**
   * Generate build number from timestamp
   */
  generateBuildNumber() {
    return new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .substring(0, 14);
  }

  /**
   * Check if this is a release build
   */
  isRelease() {
    return process.env.GITHUB_REF && process.env.GITHUB_REF.startsWith('refs/tags/v');
  }

  /**
   * Get Git commit hash
   */
  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      return process.env.GITHUB_SHA || 'unknown';
    }
  }

  /**
   * Get Git branch name
   */
  getGitBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      return process.env.GITHUB_REF_NAME || 'unknown';
    }
  }

  /**
   * Get repository URL
   */
  getRepositoryUrl() {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
      return remoteUrl.replace(/\.git$/, '');
    } catch (error) {
      return process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
        : 'unknown';
    }
  }

  /**
   * Get npm version
   */
  getNpmVersion() {
    try {
      return execSync('npm --version', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Create build artifacts
   */
  async createArtifacts() {
    if (!this.metadata) {
      this.generateMetadata();
    }

    // Ensure output directory exists
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    console.log('Creating build artifacts...');

    // Build the application
    console.log('Building application...');
    execSync('npm run build', { stdio: 'inherit' });

    // Create package directory
    const packageDir = path.join(this.options.outputDir, 'package');
    if (fs.existsSync(packageDir)) {
      fs.rmSync(packageDir, { recursive: true });
    }
    fs.mkdirSync(packageDir, { recursive: true });

    // Copy built application and necessary files
    this.copyFiles([
      { src: 'dist', dest: path.join(packageDir, 'dist') },
      { src: 'package.json', dest: path.join(packageDir, 'package.json') },
      { src: 'package-lock.json', dest: path.join(packageDir, 'package-lock.json') },
      { src: 'README.md', dest: path.join(packageDir, 'README.md') },
      { src: 'LICENSE', dest: path.join(packageDir, 'LICENSE') },
    ]);

    // Update package.json with build version
    const packageJsonPath = path.join(packageDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = this.metadata.artifact.version;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Create artifact files
    const artifactName = `${this.options.packageName}-${this.metadata.artifact.version}`;
    const artifacts = await this.createArtifactFiles(packageDir, artifactName);

    // Generate checksums
    this.generateChecksums(artifacts);

    // Create manifest
    this.createManifest(artifacts);

    console.log(`Created ${artifacts.length} artifacts:`);
    artifacts.forEach((artifact) => console.log(`  - ${artifact.name}`));

    return artifacts;
  }

  /**
   * Copy files and directories
   */
  copyFiles(fileMappings) {
    fileMappings.forEach(({ src, dest }) => {
      if (fs.existsSync(src)) {
        const srcStat = fs.statSync(src);

        if (srcStat.isDirectory()) {
          this.copyDirectory(src, dest);
        } else {
          const destDir = path.dirname(dest);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.copyFileSync(src, dest);
        }
      }
    });
  }

  /**
   * Recursively copy directory
   */
  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    entries.forEach((entry) => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  /**
   * Create various artifact file formats
   */
  async createArtifactFiles(packageDir, artifactName) {
    const artifacts = [];

    // Create npm package tarball
    console.log('Creating npm package...');
    const tarballPath = path.join(this.options.outputDir, `${artifactName}.tgz`);
    execSync(
      `cd ${packageDir} && npm pack --pack-destination ${path.resolve(this.options.outputDir)}`,
      { stdio: 'inherit' }
    );

    // Rename the generated tarball to our naming convention
    const generatedTarball = fs
      .readdirSync(this.options.outputDir)
      .find((file) => file.endsWith('.tgz') && file !== path.basename(tarballPath));

    if (generatedTarball) {
      fs.renameSync(path.join(this.options.outputDir, generatedTarball), tarballPath);
    }

    artifacts.push({
      name: `${artifactName}.tgz`,
      path: tarballPath,
      type: 'npm-package',
    });

    // Create tar.gz archive
    console.log('Creating tar.gz archive...');
    const tarGzPath = path.join(this.options.outputDir, `${artifactName}.tar.gz`);
    execSync(`tar -czf ${tarGzPath} -C ${packageDir} .`, { stdio: 'inherit' });

    artifacts.push({
      name: `${artifactName}.tar.gz`,
      path: tarGzPath,
      type: 'tar-archive',
    });

    // Create zip archive
    console.log('Creating zip archive...');
    const zipPath = path.join(this.options.outputDir, `${artifactName}.zip`);
    execSync(`cd ${packageDir} && zip -r ${path.resolve(zipPath)} .`, { stdio: 'inherit' });

    artifacts.push({
      name: `${artifactName}.zip`,
      path: zipPath,
      type: 'zip-archive',
    });

    return artifacts;
  }

  /**
   * Generate checksums for artifacts
   */
  generateChecksums(artifacts) {
    console.log('Generating checksums...');

    const checksumFile = path.join(this.options.outputDir, 'checksums.txt');
    const md5File = path.join(this.options.outputDir, 'checksums.md5');

    const checksums = [];
    const md5sums = [];

    artifacts.forEach((artifact) => {
      const data = fs.readFileSync(artifact.path);

      // SHA256
      const sha256 = crypto.createHash('sha256').update(data).digest('hex');
      checksums.push(`${sha256}  ${artifact.name}`);

      // MD5
      const md5 = crypto.createHash('md5').update(data).digest('hex');
      md5sums.push(`${md5}  ${artifact.name}`);

      // Add to artifact metadata
      artifact.sha256 = sha256;
      artifact.md5 = md5;
      artifact.size = data.length;
    });

    fs.writeFileSync(checksumFile, checksums.join('\n') + '\n');
    fs.writeFileSync(md5File, md5sums.join('\n') + '\n');

    console.log('Checksums generated successfully');
  }

  /**
   * Create artifact manifest
   */
  createManifest(artifacts) {
    console.log('Creating artifact manifest...');

    this.manifest.artifact = this.metadata;
    this.manifest.files = artifacts.map((artifact) => ({
      name: artifact.name,
      type: artifact.type,
      size: artifact.size,
      sha256: artifact.sha256,
      md5: artifact.md5,
      mime_type: this.getMimeType(artifact.path),
    }));

    // Add checksum files to manifest
    const checksumFiles = ['checksums.txt', 'checksums.md5'];
    checksumFiles.forEach((filename) => {
      const filePath = path.join(this.options.outputDir, filename);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        this.manifest.files.push({
          name: filename,
          type: 'checksum',
          size: data.length,
          sha256: crypto.createHash('sha256').update(data).digest('hex'),
          md5: crypto.createHash('md5').update(data).digest('hex'),
          mime_type: 'text/plain',
        });
      }
    });

    // Write manifest
    const manifestPath = path.join(this.options.outputDir, 'artifact-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));

    // Write metadata separately
    const metadataPath = path.join(this.options.outputDir, 'artifact-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(this.metadata, null, 2));

    console.log('Manifest created successfully');
  }

  /**
   * Get MIME type for file
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.tgz': 'application/gzip',
      '.tar.gz': 'application/gzip',
      '.zip': 'application/zip',
      '.json': 'application/json',
      '.txt': 'text/plain',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Upload artifacts to registry
   */
  async uploadToRegistry() {
    if (!this.metadata) {
      throw new Error('Metadata not generated. Call generateMetadata() first.');
    }

    console.log('Uploading artifacts to registry...');

    // Upload npm package
    const packageDir = path.join(this.options.outputDir, 'package');
    if (fs.existsSync(packageDir)) {
      try {
        console.log('Publishing to npm registry...');
        execSync(`cd ${packageDir} && npm publish --registry=https://npm.pkg.github.com`, {
          stdio: 'inherit',
          env: {
            ...process.env,
            NODE_AUTH_TOKEN: process.env.GITHUB_TOKEN || process.env.NPM_TOKEN,
          },
        });
        console.log('Successfully published to npm registry');
      } catch (error) {
        console.error('Failed to publish to npm registry:', error.message);
      }
    }
  }

  /**
   * Validate artifacts
   */
  validateArtifacts() {
    console.log('Validating artifacts...');

    const manifestPath = path.join(this.options.outputDir, 'artifact-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Artifact manifest not found');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    let validationErrors = [];

    manifest.files.forEach((file) => {
      const filePath = path.join(this.options.outputDir, file.name);

      if (!fs.existsSync(filePath)) {
        validationErrors.push(`File not found: ${file.name}`);
        return;
      }

      const data = fs.readFileSync(filePath);
      const actualSha256 = crypto.createHash('sha256').update(data).digest('hex');

      if (actualSha256 !== file.sha256) {
        validationErrors.push(
          `SHA256 mismatch for ${file.name}: expected ${file.sha256}, got ${actualSha256}`
        );
      }

      if (data.length !== file.size) {
        validationErrors.push(
          `Size mismatch for ${file.name}: expected ${file.size}, got ${data.length}`
        );
      }
    });

    if (validationErrors.length > 0) {
      console.error('Validation errors:');
      validationErrors.forEach((error) => console.error(`  - ${error}`));
      throw new Error(`Artifact validation failed with ${validationErrors.length} errors`);
    }

    console.log('All artifacts validated successfully');
    return true;
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const manager = new ArtifactManager();

  async function main() {
    try {
      switch (command) {
        case 'create':
          await manager.createArtifacts();
          break;

        case 'validate':
          manager.validateArtifacts();
          break;

        case 'upload':
          await manager.uploadToRegistry();
          break;

        case 'metadata':
          const metadata = manager.generateMetadata();
          console.log(JSON.stringify(metadata, null, 2));
          break;

        case 'all':
          await manager.createArtifacts();
          manager.validateArtifacts();
          if (process.env.GITHUB_TOKEN || process.env.NPM_TOKEN) {
            await manager.uploadToRegistry();
          }
          break;

        default:
          console.log('Usage: node scripts/artifact-manager.cjs <command>');
          console.log('Commands:');
          console.log('  create    - Create build artifacts');
          console.log('  validate  - Validate existing artifacts');
          console.log('  upload    - Upload artifacts to registry');
          console.log('  metadata  - Generate and display metadata');
          console.log('  all       - Run create, validate, and upload');
          process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }

  main();
}

module.exports = ArtifactManager;
