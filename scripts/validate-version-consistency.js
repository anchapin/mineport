#!/usr/bin/env node

/**
 * Version Consistency Validation Script
 *
 * Validates that version numbers are consistent across package.json and all
 * documentation files. Ensures that version references in documentation
 * stay synchronized with the actual package version.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  packageJsonPath: 'package.json',
  documentationFiles: [
    'README.md',
    'CHANGELOG.md',
    'docs/API.md',
    'docs/EXAMPLES.md',
    'docs/TROUBLESHOOTING.md',
  ],
  versionPatterns: [
    // NPM version badges
    /https:\/\/img\.shields\.io\/npm\/v\/([^\/]+)\.svg/g,
    // Version references in text
    /version\s+([0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?)/gi,
    // Package installation examples
    /npm\s+install\s+([^@\s]+)@([0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?)/gi,
    // Changelog version headers
    /^##\s+\[([0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?)\]/gm,
    // GitHub release links
    /\/releases\/tag\/v?([0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?)/g,
  ],
  excludePatterns: [
    // Node.js version requirements
    /node.*>=?\s*([0-9]+\.[0-9]+\.[0-9]+)/gi,
    // NPM version requirements
    /npm.*>=?\s*([0-9]+\.[0-9]+\.[0-9]+)/gi,
    // Dependency versions (these should not match package version)
    /"[^"]+"\s*:\s*"[^"]*([0-9]+\.[0-9]+\.[0-9]+)/g,
  ],
};

// Validation results
const results = {
  packageVersion: null,
  packageName: null,
  filesChecked: 0,
  versionReferences: [],
  inconsistencies: [],
  warnings: [],
  errors: [],
};

/**
 * Main validation function
 */
async function validateVersionConsistency() {
  console.log('🔢 Starting version consistency validation...\n');

  try {
    // Load package.json
    await loadPackageInfo();

    console.log(`Package: ${results.packageName}`);
    console.log(`Current version: ${results.packageVersion}\n`);

    // Check each documentation file
    for (const filePath of CONFIG.documentationFiles) {
      if (await fileExists(filePath)) {
        await validateFileVersions(filePath);
        results.filesChecked++;
      } else {
        results.warnings.push({
          file: filePath,
          message: 'File not found (skipping)',
        });
      }
    }

    generateReport();

    // Exit with error code if validation fails
    if (results.inconsistencies.length > 0 || results.errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Version consistency validation failed:', error.message);
    process.exit(1);
  }
}

/**
 * Load package information from package.json
 */
async function loadPackageInfo() {
  try {
    const packageContent = await fs.promises.readFile(CONFIG.packageJsonPath, 'utf8');
    const packageData = JSON.parse(packageContent);

    results.packageVersion = packageData.version;
    results.packageName = packageData.name;

    if (!results.packageVersion) {
      throw new Error('No version found in package.json');
    }

    if (!results.packageName) {
      throw new Error('No name found in package.json');
    }
  } catch (error) {
    throw new Error(`Failed to load package.json: ${error.message}`);
  }
}

/**
 * Check if a file exists
 *
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate version references in a single file
 *
 * @param {string} filePath - Path to the file to validate
 */
async function validateFileVersions(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    console.log(`Checking versions in: ${relativePath}`);

    // Ignore fenced code blocks (``` ... ```) when scanning for versions
    const contentNoFences = content.replace(/```[\s\S]*?```/g, '');
    const versionRefs = extractVersionReferences(contentNoFences, filePath);

    for (const ref of versionRefs) {
      validateVersionReference(ref, relativePath);
    }
  } catch (error) {
    results.errors.push({
      file: filePath,
      message: `Failed to process file: ${error.message}`,
    });
  }
}

/**
 * Extract version references from file content
 *
 * @param {string} content - File content
 * @param {string} filePath - File path for context
 * @returns {Array} Array of version reference objects
 */
function extractVersionReferences(content, filePath) {
  const references = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;

    // Check each version pattern
    for (const pattern of CONFIG.versionPatterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state

      while ((match = pattern.exec(line)) !== null) {
        const fullMatch = match[0];
        const versionMatch = match[1] || match[2]; // Different patterns capture version in different groups

        if (versionMatch && isValidVersion(versionMatch)) {
          // Check if this should be excluded
          const shouldExclude = CONFIG.excludePatterns.some((excludePattern) => {
            excludePattern.lastIndex = 0;
            return excludePattern.test(fullMatch);
          });

          if (!shouldExclude) {
            references.push({
              version: versionMatch,
              context: fullMatch,
              line: lineNumber,
              column: match.index + 1,
              file: filePath,
            });
          }
        }
      }
    }
  }

  return references;
}

/**
 * Check if a string is a valid semantic version
 *
 * @param {string} version - Version string to validate
 * @returns {boolean} True if valid version
 */
function isValidVersion(version) {
  const semverPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/;
  return semverPattern.test(version);
}

/**
 * Validate a single version reference
 *
 * @param {Object} ref - Version reference object
 * @param {string} relativePath - Relative file path for reporting
 */
function validateVersionReference(ref, relativePath) {
  results.versionReferences.push(ref);

  const { version, context, line, column } = ref;

  // Check if version matches package version
  if (version !== results.packageVersion) {
    // Special handling for changelog files - they may contain historical versions
    if (relativePath.includes('CHANGELOG') || relativePath.includes('changelog')) {
      // Only flag if this appears to be referencing the current/latest version
      if (isCurrentVersionReference(context)) {
        results.inconsistencies.push({
          file: relativePath,
          line,
          column,
          expected: results.packageVersion,
          found: version,
          context,
          type: 'version_mismatch',
          message: `Version mismatch: expected ${results.packageVersion}, found ${version}`,
        });
      }
    } else {
      results.inconsistencies.push({
        file: relativePath,
        line,
        column,
        expected: results.packageVersion,
        found: version,
        context,
        type: 'version_mismatch',
        message: `Version mismatch: expected ${results.packageVersion}, found ${version}`,
      });
    }
  }
}

/**
 * Check if a context suggests this is referencing the current version
 *
 * @param {string} context - The context string containing the version
 * @returns {boolean} True if this appears to be a current version reference
 */
function isCurrentVersionReference(context) {
  const currentVersionIndicators = [
    /latest/i,
    /current/i,
    /unreleased/i,
    /^##\s+\[/, // Changelog header
    /badge/i,
    /install/i,
  ];

  return currentVersionIndicators.some((indicator) => indicator.test(context));
}

/**
 * Generate and display validation report
 */
function generateReport() {
  console.log('\n📊 Version Consistency Validation Report');
  console.log('='.repeat(50));
  console.log(`Package: ${results.packageName}`);
  console.log(`Current version: ${results.packageVersion}`);
  console.log(`Files checked: ${results.filesChecked}`);
  console.log(`Version references found: ${results.versionReferences.length}`);
  console.log(`Inconsistencies: ${results.inconsistencies.length}`);
  console.log('');

  // Warnings
  if (results.warnings.length > 0) {
    console.log(`⚠️  Warnings (${results.warnings.length}):`);
    results.warnings.forEach((warning) => {
      console.log(`  ${warning.file}: ${warning.message}`);
    });
    console.log('');
  }

  // Version references summary
  if (results.versionReferences.length > 0) {
    console.log('📋 Version References Found:');
    const groupedRefs = groupVersionReferences(results.versionReferences);

    Object.entries(groupedRefs).forEach(([version, refs]) => {
      const status = version === results.packageVersion ? '✅' : '❌';
      console.log(`  ${status} ${version} (${refs.length} references)`);

      refs.forEach((ref) => {
        const relativePath = path.relative(process.cwd(), ref.file);
        console.log(
          `    ${relativePath}:${ref.line} - ${ref.context.substring(0, 60)}${ref.context.length > 60 ? '...' : ''}`
        );
      });
    });
    console.log('');
  }

  // Inconsistencies
  if (results.inconsistencies.length > 0) {
    console.log(`❌ Version Inconsistencies (${results.inconsistencies.length}):`);
    results.inconsistencies.forEach((inconsistency) => {
      console.log(`  ${inconsistency.file}:${inconsistency.line}:${inconsistency.column}`);
      console.log(`    Expected: ${inconsistency.expected}`);
      console.log(`    Found: ${inconsistency.found}`);
      console.log(`    Context: ${inconsistency.context}`);
      console.log('');
    });
  }

  // Errors
  if (results.errors.length > 0) {
    console.log(`❌ Processing Errors (${results.errors.length}):`);
    results.errors.forEach((error) => {
      console.log(`  ${error.file}: ${error.message}`);
    });
    console.log('');
  }

  // Summary
  if (results.inconsistencies.length === 0 && results.errors.length === 0) {
    console.log('✅ All version references are consistent!');
  } else {
    console.log('❌ Version consistency validation failed!');
    if (results.inconsistencies.length > 0) {
      console.log(`   ${results.inconsistencies.length} version inconsistencies found`);
    }
    if (results.errors.length > 0) {
      console.log(`   ${results.errors.length} processing errors occurred`);
    }
  }

  // Recommendations
  if (results.inconsistencies.length > 0) {
    console.log('\n💡 Recommendations:');
    console.log('  1. Update version references to match package.json');
    console.log('  2. Consider using automated version bumping tools');
    console.log('  3. Add version consistency checks to CI/CD pipeline');
  }
}

/**
 * Group version references by version number
 *
 * @param {Array} references - Array of version reference objects
 * @returns {Object} Grouped references by version
 */
function groupVersionReferences(references) {
  return references.reduce((groups, ref) => {
    const version = ref.version;
    if (!groups[version]) {
      groups[version] = [];
    }
    groups[version].push(ref);
    return groups;
  }, {});
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateVersionConsistency().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { validateVersionConsistency, CONFIG };
