#!/usr/bin/env node

/**
 * Required Documentation Sections Validation Script
 *
 * Validates that documentation files contain all required sections according
 * to project standards. Ensures consistency and completeness across all
 * documentation files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  documentationRequirements: {
    'README.md': {
      requiredSections: [
        'title', // H1 header with project name
        'description', // Project description
        'features', // Key features
        'installation', // Installation instructions
        'usage', // Basic usage examples
        'documentation', // Links to detailed docs
        'contributing', // Contributing guidelines
        'license' // License information
      ],
      optionalSections: [
        'badges', // Status badges
        'table-of-contents', // TOC
        'examples', // Usage examples
        'api', // API reference
        'troubleshooting', // Common issues
        'changelog', // Version history
        'acknowledgments' // Credits
      ],
      patterns: {
        title: /^#\s+.+$/m,
        description: /(?:description|about|overview)/i,
        features: /(?:features|capabilities|what.*does)/i,
        installation: /(?:installation|install|setup|getting.*started)/i,
        usage: /(?:usage|how.*to.*use|quick.*start|examples)/i,
        documentation: /(?:documentation|docs|api.*reference)/i,
        contributing: /(?:contributing|contribution|development)/i,
        license: /(?:license|licensing)/i,
        badges: /!\[.*\]\(.*\.svg\)/,
        'table-of-contents': /(?:table.*of.*contents|toc)/i,
        api: /(?:api|reference)/i,
        troubleshooting: /(?:troubleshooting|faq|issues)/i,
        changelog: /(?:changelog|changes|history)/i,
        acknowledgments: /(?:acknowledgments|credits|thanks)/i
      }
    },

    'CHANGELOG.md': {
      requiredSections: [
        'title', // H1 header
        'format-info', // Keep a Changelog format info
        'unreleased', // Unreleased section
        'version-entries' // At least one version entry
      ],
      optionalSections: [
        'guiding-principles', // Changelog principles
        'types-of-changes' // Change type definitions
      ],
      patterns: {
        title: /^#\s+(?:changelog|change.*log)/im,
        'format-info': /keep.*a.*changelog/i,
        unreleased: /##\s+\[?unreleased\]?/im,
        'version-entries': /##\s+\[[0-9]+\.[0-9]+\.[0-9]+\]/im,
        'guiding-principles': /(?:principles|guidelines)/i,
        'types-of-changes': /(?:types.*of.*changes|change.*types)/i
      }
    },

    'SECURITY.md': {
      requiredSections: [
        'title', // H1 header
        'supported-versions', // Supported versions table
        'reporting', // How to report vulnerabilities
        'response-process' // Response timeline
      ],
      optionalSections: [
        'security-policy', // General security policy
        'disclosure-policy', // Responsible disclosure
        'contact-info' // Security contact
      ],
      patterns: {
        title: /^#\s+(?:security|security.*policy)/im,
        'supported-versions': /(?:supported.*versions|version.*support)/i,
        reporting: /(?:reporting|report.*vulnerability|report.*security)/i,
        'response-process': /(?:response|timeline|process)/i,
        'security-policy': /(?:policy|policies)/i,
        'disclosure-policy': /(?:disclosure|responsible)/i,
        'contact-info': /(?:contact|email|security@)/i
      }
    },

    'docs/API.md': {
      requiredSections: [
        'title', // H1 header
        'overview', // API overview
        'authentication', // Auth requirements
        'endpoints', // API endpoints
        'examples' // Usage examples
      ],
      optionalSections: [
        'rate-limiting', // Rate limits
        'errors', // Error handling
        'versioning', // API versioning
        'sdk' // SDK information
      ],
      patterns: {
        title: /^#\s+(?:api|api.*reference|api.*documentation)/im,
        overview: /(?:overview|introduction|getting.*started)/i,
        authentication: /(?:authentication|auth|authorization)/i,
        endpoints: /(?:endpoints|routes|methods)/i,
        examples: /(?:examples|usage|how.*to)/i,
        'rate-limiting': /(?:rate.*limit|throttling|limits)/i,
        errors: /(?:errors|error.*handling|error.*codes)/i,
        versioning: /(?:versioning|versions)/i,
        sdk: /(?:sdk|client.*library|libraries)/i
      }
    },

    'docs/TROUBLESHOOTING.md': {
      requiredSections: [
        'title', // H1 header
        'common-issues', // Common problems
        'debugging', // Debugging guide
        'support' // Getting help
      ],
      optionalSections: [
        'faq', // Frequently asked questions
        'known-issues', // Known limitations
        'performance' // Performance issues
      ],
      patterns: {
        title: /^#\s+(?:troubleshooting|trouble.*shooting)/im,
        'common-issues': /(?:common.*issues|common.*problems|frequent)/i,
        debugging: /(?:debugging|debug|diagnose)/i,
        support: /(?:support|help|assistance|contact)/i,
        faq: /(?:faq|frequently.*asked|questions)/i,
        'known-issues': /(?:known.*issues|limitations|caveats)/i,
        performance: /(?:performance|slow|optimization)/i
      }
    },

    'docs/EXAMPLES.md': {
      requiredSections: [
        'title', // H1 header
        'basic-usage', // Basic examples
        'advanced-usage' // Advanced examples
      ],
      optionalSections: [
        'tutorials', // Step-by-step tutorials
        'recipes', // Common patterns
        'integration' // Integration examples
      ],
      patterns: {
        title: /^#\s+(?:examples|usage.*examples)/im,
        'basic-usage': /(?:basic|simple|getting.*started|quick.*start)/i,
        'advanced-usage': /(?:advanced|complex|detailed)/i,
        tutorials: /(?:tutorials|walkthrough|step.*by.*step)/i,
        recipes: /(?:recipes|patterns|common.*use)/i,
        integration: /(?:integration|integrating|third.*party)/i
      }
    }
  }
};

// Validation results
const results = {
  totalFiles: 0,
  processedFiles: 0,
  missingSections: [],
  presentSections: [],
  warnings: [],
  errors: []
};

/**
 * Main validation function
 */
async function validateRequiredSections() {
  console.log('📋 Starting required documentation sections validation...\n');

  try {
    const filesToCheck = Object.keys(CONFIG.documentationRequirements);
    results.totalFiles = filesToCheck.length;

    for (const filePath of filesToCheck) {
      if (await fileExists(filePath)) {
        await validateDocumentationFile(filePath);
        results.processedFiles++;
      } else {
        results.warnings.push({
          file: filePath,
          message: 'File not found (skipping validation)'
        });
      }
    }

    generateReport();

    // Exit with error code if validation fails
    if (results.missingSections.length > 0 || results.errors.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Required sections validation failed:', error.message);
    process.exit(1);
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
 * Validate required sections in a documentation file
 *
 * @param {string} filePath - Path to the documentation file
 */
async function validateDocumentationFile(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    console.log(`Validating sections in: ${relativePath}`);

    const requirements = CONFIG.documentationRequirements[filePath];
    if (!requirements) {
      results.warnings.push({
        file: relativePath,
        message: 'No validation requirements defined for this file'
      });
      return;
    }

    // Check required sections
    for (const section of requirements.requiredSections) {
      const isPresent = checkSectionPresent(content, section, requirements.patterns);

      if (isPresent) {
        results.presentSections.push({
          file: relativePath,
          section,
          required: true
        });
      } else {
        results.missingSections.push({
          file: relativePath,
          section,
          required: true,
          message: `Required section "${section}" is missing`
        });
      }
    }

    // Check optional sections (for reporting)
    if (requirements.optionalSections) {
      for (const section of requirements.optionalSections) {
        const isPresent = checkSectionPresent(content, section, requirements.patterns);

        if (isPresent) {
          results.presentSections.push({
            file: relativePath,
            section,
            required: false
          });
        }
      }
    }

    // Perform file-specific validations
    performSpecificValidations(content, filePath, relativePath);

  } catch (error) {
    results.errors.push({
      file: filePath,
      message: `Failed to process file: ${error.message}`
    });
  }
}

/**
 * Check if a section is present in the content
 *
 * @param {string} content - File content
 * @param {string} section - Section name
 * @param {Object} patterns - Pattern definitions
 * @returns {boolean} True if section is present
 */
function checkSectionPresent(content, section, patterns) {
  const pattern = patterns[section];
  if (!pattern) {
    return false;
  }

  return pattern.test(content);
}

/**
 * Perform file-specific validations
 *
 * @param {string} content - File content
 * @param {string} filePath - Full file path
 * @param {string} relativePath - Relative file path for reporting
 */
function performSpecificValidations(content, filePath, relativePath) {
  switch (filePath) {
    case 'README.md':
      validateReadmeSpecifics(content, relativePath);
      break;
    case 'CHANGELOG.md':
      validateChangelogSpecifics(content, relativePath);
      break;
    case 'SECURITY.md':
      validateSecuritySpecifics(content, relativePath);
      break;
    case 'docs/API.md':
      validateApiSpecifics(content, relativePath);
      break;
    case 'docs/TROUBLESHOOTING.md':
      validateTroubleshootingSpecifics(content, relativePath);
      break;
    case 'docs/EXAMPLES.md':
      validateExamplesSpecifics(content, relativePath);
      break;
  }
}

/**
 * Validate README.md specific requirements
 *
 * @param {string} content - File content
 * @param {string} filePath - File path for reporting
 */
function validateReadmeSpecifics(content, filePath) {
  // Check for project name in title
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    if (!title.includes('minecraft') || !title.includes('mod') || !title.includes('converter')) {
      results.warnings.push({
        file: filePath,
        section: 'title',
        message: 'Title should clearly indicate this is a Minecraft mod converter'
      });
    }
  }

  // Check for installation commands
  if (!/npm\s+install/.test(content) && !/yarn\s+add/.test(content)) {
    results.warnings.push({
      file: filePath,
      section: 'installation',
      message: 'Installation section should include npm/yarn install commands'
    });
  }

  // Check for code examples
  if (!/```/.test(content)) {
    results.warnings.push({
      file: filePath,
      section: 'usage',
      message: 'Usage section should include code examples'
    });
  }
}

/**
 * Validate CHANGELOG.md specific requirements
 *
 * @param {string} content - File content
 * @param {string} filePath - File path for reporting
 */
function validateChangelogSpecifics(content, filePath) {
  // Check for proper version format
  const versionMatches = content.match(/##\s+\[([0-9]+\.[0-9]+\.[0-9]+)\]/g);
  if (versionMatches && versionMatches.length === 0) {
    results.warnings.push({
      file: filePath,
      section: 'version-entries',
      message: 'No properly formatted version entries found'
    });
  }

  // Check for change categories
  const changeCategories = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
  const hasCategories = changeCategories.some(category =>
    new RegExp(`###\\s+${category}`, 'i').test(content)
  );

  if (!hasCategories) {
    results.warnings.push({
      file: filePath,
      section: 'version-entries',
      message: 'Version entries should use standard change categories (Added, Changed, etc.)'
    });
  }
}

/**
 * Validate SECURITY.md specific requirements
 *
 * @param {string} content - File content
 * @param {string} filePath - File path for reporting
 */
function validateSecuritySpecifics(content, filePath) {
  // Check for version table
  if (!/\|.*Version.*\|.*Supported.*\|/.test(content)) {
    results.warnings.push({
      file: filePath,
      section: 'supported-versions',
      message: 'Supported versions should be presented in a table format'
    });
  }

  // Check for contact information
  if (!/security@|security\s*contact|email/.test(content)) {
    results.warnings.push({
      file: filePath,
      section: 'reporting',
      message: 'Should include security contact information'
    });
  }
}

/**
 * Validate API.md specific requirements
 *
 * @param {string} content - File content
 * @param {string} filePath - File path for reporting
 */
function validateApiSpecifics(content, filePath) {
  // Check for HTTP methods
  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const hasHttpMethods = httpMethods.some(method =>
    new RegExp(`\\b${method}\\b`, 'i').test(content)
  );

  if (!hasHttpMethods) {
    results.warnings.push({
      file: filePath,
      section: 'endpoints',
      message: 'API documentation should include HTTP methods'
    });
  }

  // Check for response examples
  if (!/response|example.*response|returns/i.test(content)) {
    results.warnings.push({
      file: filePath,
      section: 'examples',
      message: 'Should include response examples'
    });
  }
}

/**
 * Validate TROUBLESHOOTING.md specific requirements
 *
 * @param {string} content - File content
 * @param {string} filePath - File path for reporting
 */
function validateTroubleshootingSpecifics(content, filePath) {
  // Check for Q&A format or problem/solution format
  const hasQAFormat = /(?:Q:|Question:|Problem:|Issue:)/i.test(content);
  const hasSolutionFormat = /(?:A:|Answer:|Solution:|Fix:)/i.test(content);

  if (!hasQAFormat && !hasSolutionFormat) {
    results.warnings.push({
      file: filePath,
      section: 'common-issues',
      message: 'Should use Q&A or Problem/Solution format for clarity'
    });
  }
}

/**
 * Validate EXAMPLES.md specific requirements
 *
 * @param {string} content - File content
 * @param {string} filePath - File path for reporting
 */
function validateExamplesSpecifics(content, filePath) {
  // Check for code blocks
  const codeBlocks = content.match(/```/g);
  if (!codeBlocks || codeBlocks.length < 4) { // At least 2 code blocks (open/close pairs)
    results.warnings.push({
      file: filePath,
      section: 'basic-usage',
      message: 'Should include multiple code examples'
    });
  }

  // Check for different example types
  const exampleTypes = ['basic', 'advanced', 'complete', 'simple'];
  const hasVariedExamples = exampleTypes.some(type =>
    new RegExp(type, 'i').test(content)
  );

  if (!hasVariedExamples) {
    results.warnings.push({
      file: filePath,
      section: 'advanced-usage',
      message: 'Should include examples of varying complexity'
    });
  }
}

/**
 * Generate and display validation report
 */
function generateReport() {
  console.log('\n📊 Required Documentation Sections Report');
  console.log('=' .repeat(50));
  console.log(`Files checked: ${results.processedFiles}/${results.totalFiles}`);
  console.log(`Missing required sections: ${results.missingSections.filter(s => s.required).length}`);
  console.log(`Present sections: ${results.presentSections.length}`);
  console.log('');

  // Warnings
  if (results.warnings.length > 0) {
    console.log(`⚠️  Warnings (${results.warnings.length}):`);
    results.warnings.forEach(warning => {
      if (warning.section) {
        console.log(`  ${warning.file} [${warning.section}]: ${warning.message}`);
      } else {
        console.log(`  ${warning.file}: ${warning.message}`);
      }
    });
    console.log('');
  }

  // Missing required sections
  const missingRequired = results.missingSections.filter(s => s.required);
  if (missingRequired.length > 0) {
    console.log(`❌ Missing Required Sections (${missingRequired.length}):`);

    // Group by file
    const missingByFile = groupByFile(missingRequired);
    Object.entries(missingByFile).forEach(([file, sections]) => {
      console.log(`\n  ${file}:`);
      sections.forEach(section => {
        console.log(`    ❌ ${section.section} - ${section.message}`);
      });
    });
    console.log('');
  }

  // Present sections summary
  if (results.presentSections.length > 0) {
    console.log('✅ Present Sections Summary:');

    const presentByFile = groupByFile(results.presentSections);
    Object.entries(presentByFile).forEach(([file, sections]) => {
      const requiredCount = sections.filter(s => s.required).length;
      const optionalCount = sections.filter(s => !s.required).length;

      console.log(`  ${file}: ${requiredCount} required, ${optionalCount} optional`);
    });
    console.log('');
  }

  // Errors
  if (results.errors.length > 0) {
    console.log(`❌ Processing Errors (${results.errors.length}):`);
    results.errors.forEach(error => {
      console.log(`  ${error.file}: ${error.message}`);
    });
    console.log('');
  }

  // Summary
  if (missingRequired.length === 0 && results.errors.length === 0) {
    console.log('✅ All required documentation sections are present!');
  } else {
    console.log('❌ Required sections validation failed!');
    if (missingRequired.length > 0) {
      console.log(`   ${missingRequired.length} required sections are missing`);
    }
    if (results.errors.length > 0) {
      console.log(`   ${results.errors.length} processing errors occurred`);
    }
  }

  // Completion percentage
  const totalRequired = Object.values(CONFIG.documentationRequirements)
    .reduce((sum, req) => sum + req.requiredSections.length, 0);
  const presentRequired = results.presentSections.filter(s => s.required).length;
  const completionPercent = Math.round((presentRequired / totalRequired) * 100);

  console.log(`\n📈 Documentation Completion: ${completionPercent}% (${presentRequired}/${totalRequired} required sections)`);
}

/**
 * Group results by file
 *
 * @param {Array} items - Array of items with file property
 * @returns {Object} Grouped items by file
 */
function groupByFile(items) {
  return items.reduce((groups, item) => {
    const file = item.file;
    if (!groups[file]) {
      groups[file] = [];
    }
    groups[file].push(item);
    return groups;
  }, {});
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateRequiredSections().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { validateRequiredSections, CONFIG };
