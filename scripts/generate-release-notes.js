#!/usr/bin/env node

/**
 * Automated Release Notes Generator
 * Generates comprehensive release notes from git history, pull requests, and commits
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

class ReleaseNotesGenerator {
  constructor(options = {}) {
    this.options = {
      fromTag: options.fromTag,
      toTag: options.toTag || 'HEAD',
      outputFile: options.outputFile || 'RELEASE_NOTES.md',
      includeCommits: options.includeCommits !== false,
      includePRs: options.includePRs !== false,
      includeContributors: options.includeContributors !== false,
      includeBreakingChanges: options.includeBreakingChanges !== false,
      groupByType: options.groupByType !== false,
      ...options,
    };

    this.releaseData = {
      version: this.options.toTag,
      date: new Date().toISOString().split('T')[0],
      commits: [],
      pullRequests: [],
      contributors: new Set(),
      breakingChanges: [],
      features: [],
      fixes: [],
      improvements: [],
      other: [],
    };
  }

  /**
   * Generate comprehensive release notes
   */
  async generateReleaseNotes() {
    console.log('Generating release notes...');

    try {
      // Collect data
      await this.collectCommitData();
      await this.collectPullRequestData();
      await this.categorizeChanges();

      // Generate notes
      const releaseNotes = this.formatReleaseNotes();

      // Write to file
      fs.writeFileSync(this.options.outputFile, releaseNotes);

      console.log(`Release notes generated: ${this.options.outputFile}`);
      return releaseNotes;
    } catch (error) {
      console.error('Error generating release notes:', error.message);
      throw error;
    }
  }

  /**
   * Collect commit data from git history
   */
  async collectCommitData() {
    console.log('Collecting commit data...');

    try {
      // Determine commit range
      let commitRange;
      if (this.options.fromTag) {
        commitRange = `${this.options.fromTag}..${this.options.toTag}`;
      } else {
        // Get the previous tag automatically
        try {
          const previousTag = execSync('git describe --tags --abbrev=0 HEAD^', {
            encoding: 'utf8',
          }).trim();
          commitRange = `${previousTag}..${this.options.toTag}`;
          this.options.fromTag = previousTag;
        } catch (error) {
          // No previous tag, use all commits
          commitRange = this.options.toTag;
        }
      }

      console.log(`Analyzing commits in range: ${commitRange}`);

      // Get commit data with detailed format
      const gitLogFormat = [
        '%H', // commit hash
        '%h', // abbreviated commit hash
        '%an', // author name
        '%ae', // author email
        '%ad', // author date
        '%s', // subject
        '%b', // body
      ].join('%x09'); // tab separator

      const gitLogCommand = `git log --pretty=format:"${gitLogFormat}" --date=short "${commitRange}"`;
      const gitOutput = execSync(gitLogCommand, { encoding: 'utf8' });

      if (gitOutput.trim()) {
        const commitLines = gitOutput.trim().split('\n');

        commitLines.forEach((line) => {
          const parts = line.split('\t');
          if (parts.length >= 6) {
            const commit = {
              hash: parts[0],
              shortHash: parts[1],
              author: parts[2],
              email: parts[3],
              date: parts[4],
              subject: parts[5],
              body: parts[6] || '',
            };

            this.releaseData.commits.push(commit);
            this.releaseData.contributors.add(commit.author);
          }
        });
      }

      console.log(`Found ${this.releaseData.commits.length} commits`);
    } catch (error) {
      console.warn('Error collecting commit data:', error.message);
    }
  }

  /**
   * Collect pull request data from git history
   */
  async collectPullRequestData() {
    console.log('Collecting pull request data...');

    try {
      // Find merge commits that indicate pull requests
      const mergeCommits = this.releaseData.commits.filter(
        (commit) =>
          commit.subject.includes('Merge pull request') ||
          commit.subject.includes('Merge branch') ||
          commit.body.includes('Merged-By:')
      );

      mergeCommits.forEach((commit) => {
        const prMatch = commit.subject.match(/Merge pull request #(\d+) from (.+)/);
        if (prMatch) {
          const pr = {
            number: parseInt(prMatch[1]),
            branch: prMatch[2],
            title: this.extractPRTitle(commit),
            author: commit.author,
            hash: commit.shortHash,
          };

          this.releaseData.pullRequests.push(pr);
        }
      });

      console.log(`Found ${this.releaseData.pullRequests.length} pull requests`);
    } catch (error) {
      console.warn('Error collecting pull request data:', error.message);
    }
  }

  /**
   * Extract PR title from merge commit
   */
  extractPRTitle(commit) {
    // Try to extract title from commit body
    const lines = commit.body.split('\n');
    const titleLine = lines.find((line) => line.trim() && !line.startsWith('*'));
    return titleLine ? titleLine.trim() : commit.subject;
  }

  /**
   * Categorize changes by type
   */
  categorizeChanges() {
    console.log('Categorizing changes...');

    this.releaseData.commits.forEach((commit) => {
      const subject = commit.subject.toLowerCase();
      const body = commit.body.toLowerCase();
      const fullMessage = `${subject} ${body}`;

      // Check for breaking changes
      if (this.isBreakingChange(commit)) {
        this.releaseData.breakingChanges.push(commit);
      }

      // Categorize by conventional commit types or keywords
      if (this.isFeature(subject)) {
        this.releaseData.features.push(commit);
      } else if (this.isFix(subject)) {
        this.releaseData.fixes.push(commit);
      } else if (this.isImprovement(subject)) {
        this.releaseData.improvements.push(commit);
      } else {
        this.releaseData.other.push(commit);
      }
    });

    console.log('Changes categorized:');
    console.log(`  Features: ${this.releaseData.features.length}`);
    console.log(`  Fixes: ${this.releaseData.fixes.length}`);
    console.log(`  Improvements: ${this.releaseData.improvements.length}`);
    console.log(`  Breaking Changes: ${this.releaseData.breakingChanges.length}`);
    console.log(`  Other: ${this.releaseData.other.length}`);
  }

  /**
   * Check if commit represents a breaking change
   */
  isBreakingChange(commit) {
    const indicators = [
      'breaking change',
      'breaking:',
      'BREAKING CHANGE',
      'BREAKING:',
      '!:',
      'major:',
    ];

    const fullMessage = `${commit.subject} ${commit.body}`.toLowerCase();
    return indicators.some((indicator) => fullMessage.includes(indicator.toLowerCase()));
  }

  /**
   * Check if commit is a feature
   */
  isFeature(subject) {
    const featureKeywords = ['feat:', 'feature:', 'add:', 'implement:', 'new:', 'create:'];

    return featureKeywords.some((keyword) => subject.startsWith(keyword));
  }

  /**
   * Check if commit is a fix
   */
  isFix(subject) {
    const fixKeywords = ['fix:', 'bugfix:', 'hotfix:', 'patch:', 'resolve:', 'correct:'];

    return fixKeywords.some((keyword) => subject.startsWith(keyword));
  }

  /**
   * Check if commit is an improvement
   */
  isImprovement(subject) {
    const improvementKeywords = [
      'improve:',
      'enhancement:',
      'optimize:',
      'refactor:',
      'perf:',
      'style:',
      'docs:',
      'test:',
    ];

    return improvementKeywords.some((keyword) => subject.startsWith(keyword));
  }

  /**
   * Format the complete release notes
   */
  formatReleaseNotes() {
    let notes = '';

    // Header
    notes += `# Release ${this.releaseData.version}\n\n`;
    notes += `**Release Date:** ${this.releaseData.date}\n\n`;

    if (this.options.fromTag) {
      notes += `**Changes since:** ${this.options.fromTag}\n\n`;
    }

    // Breaking Changes (if any)
    if (this.releaseData.breakingChanges.length > 0) {
      notes += '## ⚠️ Breaking Changes\n\n';
      this.releaseData.breakingChanges.forEach((commit) => {
        notes += `- ${this.formatCommitMessage(commit)}\n`;
      });
      notes += '\n';
    }

    // Features
    if (this.releaseData.features.length > 0) {
      notes += '## ✨ New Features\n\n';
      this.releaseData.features.forEach((commit) => {
        notes += `- ${this.formatCommitMessage(commit)}\n`;
      });
      notes += '\n';
    }

    // Bug Fixes
    if (this.releaseData.fixes.length > 0) {
      notes += '## 🐛 Bug Fixes\n\n';
      this.releaseData.fixes.forEach((commit) => {
        notes += `- ${this.formatCommitMessage(commit)}\n`;
      });
      notes += '\n';
    }

    // Improvements
    if (this.releaseData.improvements.length > 0) {
      notes += '## 🚀 Improvements\n\n';
      this.releaseData.improvements.forEach((commit) => {
        notes += `- ${this.formatCommitMessage(commit)}\n`;
      });
      notes += '\n';
    }

    // Pull Requests
    if (this.options.includePRs && this.releaseData.pullRequests.length > 0) {
      notes += '## 🔀 Pull Requests\n\n';
      this.releaseData.pullRequests.forEach((pr) => {
        notes += `- #${pr.number}: ${pr.title} (@${pr.author})\n`;
      });
      notes += '\n';
    }

    // All Changes (if not grouped by type)
    if (!this.options.groupByType && this.options.includeCommits) {
      notes += '## 📝 All Changes\n\n';
      this.releaseData.commits.forEach((commit) => {
        notes += `- ${this.formatCommitMessage(commit)}\n`;
      });
      notes += '\n';
    }

    // Contributors
    if (this.options.includeContributors && this.releaseData.contributors.size > 0) {
      notes += '## 👥 Contributors\n\n';
      const contributors = Array.from(this.releaseData.contributors).sort();
      contributors.forEach((contributor) => {
        notes += `- @${contributor}\n`;
      });
      notes += '\n';
    }

    // Installation Instructions
    notes += this.generateInstallationInstructions();

    // Verification Instructions
    notes += this.generateVerificationInstructions();

    return notes;
  }

  /**
   * Format commit message for display
   */
  formatCommitMessage(commit) {
    let message = commit.subject;

    // Remove conventional commit prefixes for cleaner display
    message = message.replace(
      /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\(.+\))?:\s*/,
      ''
    );

    // Capitalize first letter
    message = message.charAt(0).toUpperCase() + message.slice(1);

    // Add commit hash
    message += ` (${commit.shortHash})`;

    return message;
  }

  /**
   * Generate installation instructions
   */
  generateInstallationInstructions() {
    const packageJson = this.getPackageInfo();

    let instructions = '## 📦 Installation\n\n';

    // NPM installation
    instructions += '### NPM Package\n';
    instructions += '```bash\n';
    instructions += `npm install ${packageJson.name}@${this.releaseData.version}\n`;
    instructions += '```\n\n';

    // Container installation
    instructions += '### Container Image\n';
    instructions += '```bash\n';
    instructions += `docker pull ghcr.io/${this.getRepositoryName()}:${this.releaseData.version}\n`;
    instructions += '```\n\n';

    // Source download
    instructions += '### Source Code\n';
    instructions += `Download the source code from the [releases page](${this.getRepositoryUrl()}/releases/tag/${this.releaseData.version}).\n\n`;

    return instructions;
  }

  /**
   * Generate verification instructions
   */
  generateVerificationInstructions() {
    let instructions = '## 🔐 Verification\n\n';

    instructions += 'All release artifacts are signed and include checksums for verification:\n\n';
    instructions += '```bash\n';
    instructions += '# Verify checksums\n';
    instructions += 'sha256sum -c checksums.txt\n';
    instructions += 'md5sum -c checksums.md5\n';
    instructions += '```\n\n';

    instructions += 'Container images are signed with cosign:\n\n';
    instructions += '```bash\n';
    instructions += '# Verify container signature (if cosign is available)\n';
    instructions += `cosign verify ghcr.io/${this.getRepositoryName()}:${this.releaseData.version}\n`;
    instructions += '```\n\n';

    return instructions;
  }

  /**
   * Get package information from package.json
   */
  getPackageInfo() {
    try {
      return JSON.parse(fs.readFileSync('package.json', 'utf8'));
    } catch (error) {
      return { name: 'unknown-package' };
    }
  }

  /**
   * Get repository name from git or environment
   */
  getRepositoryName() {
    if (process.env.GITHUB_REPOSITORY) {
      return process.env.GITHUB_REPOSITORY;
    }

    try {
      const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
      const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
      return match ? match[1] : 'unknown/repository';
    } catch (error) {
      return 'unknown/repository';
    }
  }

  /**
   * Get repository URL
   */
  getRepositoryUrl() {
    const repoName = this.getRepositoryName();
    return `https://github.com/${repoName}`;
  }

  /**
   * Generate changelog for multiple versions
   */
  async generateChangelog(versions) {
    console.log('Generating changelog for multiple versions...');

    let changelog = '# Changelog\n\n';
    changelog += 'All notable changes to this project will be documented in this file.\n\n';
    changelog +=
      'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\n';
    changelog +=
      'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n';

    for (let i = 0; i < versions.length; i++) {
      const currentVersion = versions[i];
      const previousVersion = versions[i + 1];

      console.log(`Processing version ${currentVersion}...`);

      // Create generator for this version
      const generator = new ReleaseNotesGenerator({
        fromTag: previousVersion,
        toTag: currentVersion,
        groupByType: true,
        includeContributors: false,
        includePRs: false,
      });

      await generator.collectCommitData();
      await generator.categorizeChanges();

      // Add version section to changelog
      changelog += `## [${currentVersion}]`;
      if (previousVersion) {
        changelog += `(${generator.getRepositoryUrl()}/compare/${previousVersion}...${currentVersion})`;
      }
      changelog += ` - ${generator.releaseData.date}\n\n`;

      // Add categorized changes
      if (generator.releaseData.breakingChanges.length > 0) {
        changelog += '### ⚠️ Breaking Changes\n';
        generator.releaseData.breakingChanges.forEach((commit) => {
          changelog += `- ${generator.formatCommitMessage(commit)}\n`;
        });
        changelog += '\n';
      }

      if (generator.releaseData.features.length > 0) {
        changelog += '### Added\n';
        generator.releaseData.features.forEach((commit) => {
          changelog += `- ${generator.formatCommitMessage(commit)}\n`;
        });
        changelog += '\n';
      }

      if (generator.releaseData.fixes.length > 0) {
        changelog += '### Fixed\n';
        generator.releaseData.fixes.forEach((commit) => {
          changelog += `- ${generator.formatCommitMessage(commit)}\n`;
        });
        changelog += '\n';
      }

      if (generator.releaseData.improvements.length > 0) {
        changelog += '### Changed\n';
        generator.releaseData.improvements.forEach((commit) => {
          changelog += `- ${generator.formatCommitMessage(commit)}\n`;
        });
        changelog += '\n';
      }
    }

    // Write changelog
    fs.writeFileSync('CHANGELOG.md', changelog);
    console.log('Changelog generated: CHANGELOG.md');

    return changelog;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  async function main() {
    try {
      switch (command) {
        case 'generate':
          const fromTag = args.find((arg) => arg.startsWith('--from='))?.split('=')[1];
          const toTag = args.find((arg) => arg.startsWith('--to='))?.split('=')[1] || 'HEAD';
          const outputFile = args.find((arg) => arg.startsWith('--output='))?.split('=')[1];

          const generator = new ReleaseNotesGenerator({
            fromTag,
            toTag,
            outputFile,
            groupByType: !args.includes('--no-group'),
            includeContributors: !args.includes('--no-contributors'),
            includePRs: !args.includes('--no-prs'),
          });

          await generator.generateReleaseNotes();
          break;

        case 'changelog':
          // Get all tags for changelog generation
          const allTags = execSync('git tag --sort=-version:refname', { encoding: 'utf8' })
            .trim()
            .split('\n')
            .filter((tag) => tag.match(/^v?\d+\.\d+\.\d+/));

          const generator2 = new ReleaseNotesGenerator();
          await generator2.generateChangelog(allTags.slice(0, 10)); // Last 10 versions
          break;

        default:
          console.log('Usage: node generate-release-notes.js <command> [options]');
          console.log('');
          console.log('Commands:');
          console.log('  generate    Generate release notes for a version');
          console.log('  changelog   Generate full changelog');
          console.log('');
          console.log('Options for generate:');
          console.log('  --from=TAG      Start from this tag');
          console.log('  --to=TAG        End at this tag (default: HEAD)');
          console.log('  --output=FILE   Output file (default: RELEASE_NOTES.md)');
          console.log("  --no-group      Don't group changes by type");
          console.log("  --no-contributors  Don't include contributors");
          console.log("  --no-prs        Don't include pull requests");
          console.log('');
          console.log('Examples:');
          console.log('  node generate-release-notes.js generate --from=v1.0.0 --to=v1.1.0');
          console.log('  node generate-release-notes.js changelog');
          process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }

  main();
}

module.exports = ReleaseNotesGenerator;
