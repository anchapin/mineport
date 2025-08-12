#!/usr/bin/env node

/**
 * JSDoc Validation Script
 *
 * Validates JSDoc coverage and compliance across the codebase.
 * Ensures all public APIs have proper documentation according to
 * the established templates and standards.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourceDir: 'src',
  excludePatterns: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/*.d.ts'
  ],
  requiredTags: ['param', 'returns', 'since'],
  conditionalTags: {
    'deprecated': 'deprecated functionality',
    'throws': 'methods that can throw exceptions',
    'example': 'complex or important methods'
  },
  minCoveragePercent: 55
};

// Validation results
const results = {
  totalFiles: 0,
  processedFiles: 0,
  totalFunctions: 0,
  documentedFunctions: 0,
  totalClasses: 0,
  documentedClasses: 0,
  totalInterfaces: 0,
  documentedInterfaces: 0,
  errors: [],
  warnings: []
};

/**
 * Main validation function
 */
async function validateJSDoc() {
  console.log('🔍 Starting JSDoc validation...\n');

  try {
    const files = await getTypeScriptFiles(CONFIG.sourceDir);
    results.totalFiles = files.length;

    for (const file of files) {
      if (shouldProcessFile(file)) {
        await validateFile(file);
        results.processedFiles++;
      }
    }

    generateReport();

    // Exit with error code if validation fails
    const coveragePercent = calculateCoverage();
    if (coveragePercent < CONFIG.minCoveragePercent || results.errors.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ JSDoc validation failed:', error.message);
    process.exit(1);
  }
}

/**
 * Get all TypeScript files in a directory recursively
 *
 * @param {string} dir - Directory to search
 * @returns {Promise<string[]>} Array of file paths
 */
async function getTypeScriptFiles(dir) {
  const files = [];

  async function traverse(currentDir) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile() && fullPath.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  await traverse(dir);
  return files;
}

/**
 * Check if a file should be processed based on exclude patterns
 *
 * @param {string} filePath - File path to check
 * @returns {boolean} True if file should be processed
 */
function shouldProcessFile(filePath) {
  return !CONFIG.excludePatterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(filePath);
  });
}

/**
 * Validate JSDoc in a single file
 *
 * @param {string} filePath - Path to the file to validate
 */
async function validateFile(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    // Parse TypeScript constructs
    const constructs = parseTypeScriptConstructs(content, relativePath);

    // Validate each construct
    for (const construct of constructs) {
      validateConstruct(construct, relativePath);
    }

  } catch (error) {
    results.errors.push({
      file: filePath,
      message: `Failed to process file: ${error.message}`
    });
  }
}

/**
 * Parse TypeScript constructs from file content
 *
 * @param {string} content - File content
 * @param {string} filePath - File path for error reporting
 * @returns {Array} Array of parsed constructs
 */
function parseTypeScriptConstructs(content, filePath) {
  const constructs = [];
  const lines = content.split('\n');

  // Regular expressions for different constructs
  const patterns = {
    class: /^export\s+(?:abstract\s+)?class\s+(\w+)/,
    interface: /^export\s+interface\s+(\w+)/,
    function: /^export\s+(?:async\s+)?function\s+(\w+)/,
    method: /^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\(/,
    constructor: /^\s*constructor\s*\(/
  };

  let currentClass = null;
  let inComment = false;
  let commentBlock = [];
  let commentStartLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    // Track comment blocks
    if (line.startsWith('/**')) {
      inComment = true;
      commentBlock = [line];
      commentStartLine = lineNumber;
      continue;
    }

    if (inComment) {
      commentBlock.push(line);
      if (line.endsWith('*/')) {
        inComment = false;
      }
      continue;
    }

    // Check for class declarations
    const classMatch = line.match(patterns.class);
    if (classMatch) {
      currentClass = classMatch[1];
      constructs.push({
        type: 'class',
        name: classMatch[1],
        line: lineNumber,
        comment: commentBlock.length > 0 ? commentBlock.join('\n') : null,
        commentLine: commentStartLine,
        isPublic: line.includes('export')
      });
      commentBlock = [];
      commentStartLine = -1;
      continue;
    }

    // Check for interface declarations
    const interfaceMatch = line.match(patterns.interface);
    if (interfaceMatch) {
      constructs.push({
        type: 'interface',
        name: interfaceMatch[1],
        line: lineNumber,
        comment: commentBlock.length > 0 ? commentBlock.join('\n') : null,
        commentLine: commentStartLine,
        isPublic: line.includes('export')
      });
      commentBlock = [];
      commentStartLine = -1;
      continue;
    }

    // Check for function declarations
    const functionMatch = line.match(patterns.function);
    if (functionMatch) {
      constructs.push({
        type: 'function',
        name: functionMatch[1],
        line: lineNumber,
        comment: commentBlock.length > 0 ? commentBlock.join('\n') : null,
        commentLine: commentStartLine,
        isPublic: line.includes('export'),
        className: currentClass
      });
      commentBlock = [];
      commentStartLine = -1;
      continue;
    }

    // Check for method declarations
    const methodMatch = line.match(patterns.method);
    if (methodMatch && currentClass) {
      const isPublic = line.includes('public') || (!line.includes('private') && !line.includes('protected'));
      constructs.push({
        type: 'method',
        name: methodMatch[1],
        line: lineNumber,
        comment: commentBlock.length > 0 ? commentBlock.join('\n') : null,
        commentLine: commentStartLine,
        isPublic,
        className: currentClass
      });
      commentBlock = [];
      commentStartLine = -1;
      continue;
    }

    // Check for constructor
    const constructorMatch = line.match(patterns.constructor);
    if (constructorMatch && currentClass) {
      constructs.push({
        type: 'constructor',
        name: 'constructor',
        line: lineNumber,
        comment: commentBlock.length > 0 ? commentBlock.join('\n') : null,
        commentLine: commentStartLine,
        isPublic: true,
        className: currentClass
      });
      commentBlock = [];
      commentStartLine = -1;
      continue;
    }

    // Reset comment block if we hit a non-comment, non-construct line
    if (line && !line.startsWith('*') && !line.startsWith('//')) {
      commentBlock = [];
      commentStartLine = -1;
    }
  }

  return constructs;
}

/**
 * Validate a single construct's JSDoc
 *
 * @param {Object} construct - Parsed construct object
 * @param {string} filePath - File path for error reporting
 */
function validateConstruct(construct, filePath) {
  // Update counters
  switch (construct.type) {
    case 'class':
      results.totalClasses++;
      if (construct.comment) results.documentedClasses++;
      break;
    case 'interface':
      results.totalInterfaces++;
      if (construct.comment) results.documentedInterfaces++;
      break;
    case 'function':
    case 'method':
    case 'constructor':
      results.totalFunctions++;
      if (construct.comment) results.documentedFunctions++;
      break;
  }

  // Only validate public APIs
  if (!construct.isPublic) {
    return;
  }

  // Check if construct has JSDoc comment
  if (!construct.comment) {
    results.errors.push({
      file: filePath,
      line: construct.line,
      construct: `${construct.type} ${construct.name}`,
      message: `Missing JSDoc comment for public ${construct.type}`
    });
    return;
  }

  // Validate JSDoc content
  validateJSDocContent(construct, filePath);
}

/**
 * Validate JSDoc comment content
 *
 * @param {Object} construct - Construct with JSDoc comment
 * @param {string} filePath - File path for error reporting
 */
function validateJSDocContent(construct, filePath) {
  const comment = construct.comment;
  const constructId = `${construct.type} ${construct.name}`;

  // Check for required tags
  for (const tag of CONFIG.requiredTags) {
    if (tag === 'returns' && (construct.type === 'constructor' || construct.name === 'constructor')) {
      continue; // Constructors don't need @returns
    }

    if (tag === 'param') {
      // Check if function/method has parameters
      const hasParams = comment.includes('@param') || !needsParamTag(construct);
      if (!hasParams) {
        results.warnings.push({
          file: filePath,
          line: construct.commentLine,
          construct: constructId,
          message: `Missing @param tags (if method has parameters)`
        });
      }
    } else if (!comment.includes(`@${tag}`)) {
      results.errors.push({
        file: filePath,
        line: construct.commentLine,
        construct: constructId,
        message: `Missing required @${tag} tag`
      });
    }
  }

  // Check for description
  const lines = comment.split('\n');
  const descriptionLines = lines.filter(line =>
    !line.trim().startsWith('/**') &&
    !line.trim().startsWith('*/') &&
    !line.trim().startsWith('*') &&
    !line.trim().startsWith('@') &&
    line.trim().length > 0
  );

  if (descriptionLines.length === 0) {
    results.errors.push({
      file: filePath,
      line: construct.commentLine,
      construct: constructId,
      message: 'Missing description in JSDoc comment'
    });
  }

  // Check for example in complex methods
  if ((construct.type === 'method' || construct.type === 'function') &&
      construct.name.length > 15 &&
      !comment.includes('@example')) {
    results.warnings.push({
      file: filePath,
      line: construct.commentLine,
      construct: constructId,
      message: 'Consider adding @example for complex method'
    });
  }
}

/**
 * Check if a construct needs @param tags
 *
 * @param {Object} construct - Construct to check
 * @returns {boolean} True if @param tags are needed
 */
function needsParamTag(construct) {
  // This is a simplified check - in a real implementation,
  // we would parse the actual method signature
  return construct.type === 'function' ||
         construct.type === 'method' ||
         construct.type === 'constructor';
}

/**
 * Calculate overall documentation coverage percentage
 *
 * @returns {number} Coverage percentage
 */
function calculateCoverage() {
  const totalItems = results.totalClasses + results.totalInterfaces + results.totalFunctions;
  const documentedItems = results.documentedClasses + results.documentedInterfaces + results.documentedFunctions;

  return totalItems > 0 ? Math.round((documentedItems / totalItems) * 100) : 100;
}

/**
 * Generate and display validation report
 */
function generateReport() {
  const coveragePercent = calculateCoverage();

  console.log('📊 JSDoc Validation Report');
  console.log('=' .repeat(50));
  console.log(`Files processed: ${results.processedFiles}/${results.totalFiles}`);
  console.log(`Overall coverage: ${coveragePercent}% (minimum: ${CONFIG.minCoveragePercent}%)`);
  console.log('');

  // Coverage breakdown
  console.log('Coverage Breakdown:');
  console.log(`  Classes: ${results.documentedClasses}/${results.totalClasses} (${Math.round((results.documentedClasses/results.totalClasses)*100) || 0}%)`);
  console.log(`  Interfaces: ${results.documentedInterfaces}/${results.totalInterfaces} (${Math.round((results.documentedInterfaces/results.totalInterfaces)*100) || 0}%)`);
  console.log(`  Functions/Methods: ${results.documentedFunctions}/${results.totalFunctions} (${Math.round((results.documentedFunctions/results.totalFunctions)*100) || 0}%)`);
  console.log('');

  // Errors
  if (results.errors.length > 0) {
    console.log(`❌ Errors (${results.errors.length}):`);
    results.errors.forEach(error => {
      console.log(`  ${error.file}:${error.line} - ${error.construct}: ${error.message}`);
    });
    console.log('');
  }

  // Warnings
  if (results.warnings.length > 0) {
    console.log(`⚠️  Warnings (${results.warnings.length}):`);
    results.warnings.forEach(warning => {
      console.log(`  ${warning.file}:${warning.line} - ${warning.construct}: ${warning.message}`);
    });
    console.log('');
  }

  // Summary
  if (results.errors.length === 0 && coveragePercent >= CONFIG.minCoveragePercent) {
    console.log('✅ JSDoc validation passed!');
  } else {
    console.log('❌ JSDoc validation failed!');
    if (coveragePercent < CONFIG.minCoveragePercent) {
      console.log(`   Coverage ${coveragePercent}% is below minimum ${CONFIG.minCoveragePercent}%`);
    }
    if (results.errors.length > 0) {
      console.log(`   ${results.errors.length} errors must be fixed`);
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateJSDoc().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { validateJSDoc, CONFIG };
