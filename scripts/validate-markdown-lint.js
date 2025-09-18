#!/usr/bin/env node

/**
 * Markdown Linting Validation Script
 *
 * Validates markdown files for consistent formatting, structure, and style.
 * Ensures documentation follows established conventions and is properly
 * formatted for readability and maintainability.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  markdownDirectories: ['docs', '.github'],
  markdownExtensions: ['.md'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/temp/**', '**/coverage/**'],
  rules: {
    // Header rules
    headerStyle: 'atx', // Use # style headers, not underline style
    headerIncrement: true, // Headers should increment by one level
    headerStartAtH1: true, // Documents should start with H1
    noTrailingSpaces: true, // No trailing spaces on lines
    noMultipleBlankLines: true, // No multiple consecutive blank lines

    // List rules
    listMarkerStyle: '-', // Use - for unordered lists
    listIndentation: 2, // Use 2 spaces for list indentation

    // Link rules
    noEmptyLinks: true, // Links must have text
    noInvalidLinks: true, // Links must be properly formatted

    // Code rules
    fencedCodeBlocks: true, // Use ``` for code blocks, not indentation
    codeLanguageSpecified: true, // Code blocks should specify language

    // General formatting
    lineLength: 120, // Maximum line length
    noHardTabs: true, // Use spaces, not tabs
    finalNewline: true, // Files should end with newline
  },
};

// Validation results
const results = {
  totalFiles: 0,
  processedFiles: 0,
  totalIssues: 0,
  issues: [],
  warnings: [],
  errors: [],
};

/**
 * Main validation function
 */
async function validateMarkdownLinting() {
  console.log('📝 Starting markdown linting validation...\n');

  try {
    const files = await getMarkdownFiles();
    results.totalFiles = files.length;

    console.log(`Found ${files.length} markdown files to validate\n`);

    for (const file of files) {
      await validateMarkdownFile(file);
      results.processedFiles++;
    }

    generateReport();

    // Exit with error code if validation fails
    if (results.issues.length > 0 || results.errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Markdown linting validation failed:', error.message);
    process.exit(1);
  }
}

/**
 * Get all markdown files in configured directories
 *
 * @returns {Promise<string[]>} Array of markdown file paths
 */
async function getMarkdownFiles() {
  const files = [];

  for (const dir of CONFIG.markdownDirectories) {
    if (await fileExists(dir)) {
      const dirFiles = await getMarkdownFilesInDirectory(dir);
      files.push(...dirFiles);
    }
  }

  return files.filter((file) => shouldProcessFile(file));
}

/**
 * Get all markdown files in a directory recursively
 *
 * @param {string} dir - Directory to search
 * @returns {Promise<string[]>} Array of file paths
 */
async function getMarkdownFilesInDirectory(dir) {
  const files = [];

  async function traverse(currentDir) {
    try {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (
          entry.isFile() &&
          CONFIG.markdownExtensions.some((ext) => entry.name.endsWith(ext))
        ) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      results.warnings.push({
        message: `Could not read directory: ${currentDir} - ${error.message}`,
      });
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
  return !CONFIG.excludePatterns.some((pattern) => {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(filePath);
  });
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
 * Validate a single markdown file
 *
 * @param {string} filePath - Path to the markdown file
 */
async function validateMarkdownFile(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    console.log(`Linting: ${relativePath}`);

    const lines = content.split('\n');

    // Run all validation rules
    validateHeaders(lines, relativePath);
    validateLists(lines, relativePath);
    validateLinks(lines, relativePath);
    validateCodeBlocks(lines, relativePath);
    validateGeneralFormatting(lines, relativePath, content);
  } catch (error) {
    results.errors.push({
      file: filePath,
      message: `Failed to process file: ${error.message}`,
    });
  }
}

/**
 * Validate header structure and formatting
 *
 * @param {string[]} lines - File lines
 * @param {string} filePath - File path for reporting
 */
function validateHeaders(lines, filePath) {
  let previousHeaderLevel = 0;
  let hasH1 = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for ATX headers (# style)
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      const level = atxMatch[1].length;
      const text = atxMatch[2];

      if (level === 1) {
        hasH1 = true;
      }

      // Check header increment rule
      if (CONFIG.rules.headerIncrement && previousHeaderLevel > 0) {
        if (level > previousHeaderLevel + 1) {
          addIssue(
            filePath,
            lineNumber,
            'header-increment',
            `Header level ${level} follows level ${previousHeaderLevel}. Headers should increment by one level.`
          );
        }
      }

      // Check for trailing spaces in header text
      if (text.endsWith(' ')) {
        addIssue(
          filePath,
          lineNumber,
          'header-trailing-space',
          'Header text should not have trailing spaces'
        );
      }

      previousHeaderLevel = level;
    }

    // Check for setext headers (underline style) - discouraged
    if (CONFIG.rules.headerStyle === 'atx') {
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1];
        if (/^=+$/.test(nextLine) || /^-+$/.test(nextLine)) {
          addIssue(
            filePath,
            lineNumber + 1,
            'header-style',
            'Use ATX-style headers (# Header) instead of setext-style (underlined)'
          );
        }
      }
    }
  }

  // Check if document starts with H1
  if (CONFIG.rules.headerStartAtH1 && !hasH1) {
    addIssue(filePath, 1, 'no-h1', 'Document should start with an H1 header (# Title)');
  }
}

/**
 * Validate list formatting and structure
 *
 * @param {string[]} lines - File lines
 * @param {string} filePath - File path for reporting
 */
function validateLists(lines, filePath) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check unordered list markers
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    if (unorderedMatch) {
      const indent = unorderedMatch[1];
      const marker = unorderedMatch[2];
      const content = unorderedMatch[3];

      // Check list marker consistency
      if (CONFIG.rules.listMarkerStyle && marker !== CONFIG.rules.listMarkerStyle) {
        addIssue(
          filePath,
          lineNumber,
          'list-marker-style',
          `Use "${CONFIG.rules.listMarkerStyle}" for unordered lists, not "${marker}"`
        );
      }

      // Check indentation
      if (CONFIG.rules.listIndentation && indent.length > 0) {
        if (indent.length % CONFIG.rules.listIndentation !== 0) {
          addIssue(
            filePath,
            lineNumber,
            'list-indentation',
            `List indentation should be multiples of ${CONFIG.rules.listIndentation} spaces`
          );
        }
      }

      // Check for empty list items
      if (!content.trim()) {
        addIssue(filePath, lineNumber, 'empty-list-item', 'List items should not be empty');
      }
    }

    // Check ordered list formatting
    const orderedMatch = line.match(/^(\s*)(\d+)([.)]\s+)(.+)$/);
    if (orderedMatch) {
      const indent = orderedMatch[1];
      const number = orderedMatch[2];
      const separator = orderedMatch[3];
      const content = orderedMatch[4];

      // Check for consistent separator (. or ))
      if (!separator.startsWith('.') && !separator.startsWith(')')) {
        addIssue(
          filePath,
          lineNumber,
          'ordered-list-separator',
          'Use "." or ")" as ordered list separator'
        );
      }

      // Check for empty list items
      if (!content.trim()) {
        addIssue(filePath, lineNumber, 'empty-list-item', 'List items should not be empty');
      }
    }
  }
}

/**
 * Validate link formatting and structure
 *
 * @param {string[]} lines - File lines
 * @param {string} filePath - File path for reporting
 */
function validateLinks(lines, filePath) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for empty links
    if (CONFIG.rules.noEmptyLinks) {
      const emptyLinkPattern = /\[\s*\]\([^)]*\)/g;
      let match;
      while ((match = emptyLinkPattern.exec(line)) !== null) {
        addIssue(filePath, lineNumber, 'empty-link-text', 'Links should have descriptive text');
      }
    }

    // Check for malformed links
    if (CONFIG.rules.noInvalidLinks) {
      // Check for unmatched brackets
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;

      if (openBrackets !== closeBrackets) {
        addIssue(filePath, lineNumber, 'unmatched-brackets', 'Unmatched square brackets in link');
      }

      // Check for links with missing URLs
      const linkWithoutUrl = /\[[^\]]+\]\(\s*\)/g;
      if (linkWithoutUrl.test(line)) {
        addIssue(filePath, lineNumber, 'empty-link-url', 'Links must have a URL');
      }
    }
  }
}

/**
 * Validate code block formatting
 *
 * @param {string[]} lines - File lines
 * @param {string} filePath - File path for reporting
 */
function validateCodeBlocks(lines, filePath) {
  let inCodeBlock = false;
  let codeBlockStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for fenced code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStart = lineNumber;

        // Check if language is specified
        if (CONFIG.rules.codeLanguageSpecified) {
          const language = line.substring(3).trim();
          if (!language) {
            addIssue(
              filePath,
              lineNumber,
              'code-language-missing',
              'Code blocks should specify a language for syntax highlighting'
            );
          }
        }
      } else {
        inCodeBlock = false;
      }
    }

    // Check for indented code blocks (discouraged if fenced blocks are preferred)
    if (CONFIG.rules.fencedCodeBlocks && !inCodeBlock) {
      if (line.startsWith('    ') && line.trim() && i > 0 && !lines[i - 1].trim()) {
        // This might be an indented code block
        let isCodeBlock = true;
        let j = i;

        // Check if multiple consecutive lines are indented
        while (j < lines.length && (lines[j].startsWith('    ') || !lines[j].trim())) {
          if (lines[j].trim() && !lines[j].startsWith('    ')) {
            isCodeBlock = false;
            break;
          }
          j++;
        }

        if (isCodeBlock && j > i + 1) {
          addIssue(
            filePath,
            lineNumber,
            'indented-code-block',
            'Use fenced code blocks (```) instead of indented code blocks'
          );
        }
      }
    }
  }

  // Check for unclosed code blocks
  if (inCodeBlock) {
    addIssue(filePath, codeBlockStart, 'unclosed-code-block', 'Code block is not properly closed');
  }
}

/**
 * Validate general formatting rules
 *
 * @param {string[]} lines - File lines
 * @param {string} filePath - File path for reporting
 * @param {string} content - Full file content
 */
function validateGeneralFormatting(lines, filePath, content) {
  let consecutiveBlankLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for trailing spaces
    if (CONFIG.rules.noTrailingSpaces && line.endsWith(' ')) {
      addIssue(filePath, lineNumber, 'trailing-spaces', 'Lines should not have trailing spaces');
    }

    // Check for hard tabs
    if (CONFIG.rules.noHardTabs && line.includes('\t')) {
      addIssue(filePath, lineNumber, 'hard-tabs', 'Use spaces instead of tabs for indentation');
    }

    // Check line length
    if (CONFIG.rules.lineLength && line.length > CONFIG.rules.lineLength) {
      addIssue(
        filePath,
        lineNumber,
        'line-length',
        `Line exceeds maximum length of ${CONFIG.rules.lineLength} characters`
      );
    }

    // Track consecutive blank lines
    if (line.trim() === '') {
      consecutiveBlankLines++;
    } else {
      if (CONFIG.rules.noMultipleBlankLines && consecutiveBlankLines > 1) {
        addIssue(
          filePath,
          lineNumber - 1,
          'multiple-blank-lines',
          'Multiple consecutive blank lines should be avoided'
        );
      }
      consecutiveBlankLines = 0;
    }
  }

  // Check for final newline
  if (CONFIG.rules.finalNewline && !content.endsWith('\n')) {
    addIssue(filePath, lines.length, 'no-final-newline', 'File should end with a newline');
  }
}

/**
 * Add a linting issue to results
 *
 * @param {string} filePath - File path
 * @param {number} lineNumber - Line number
 * @param {string} ruleId - Rule identifier
 * @param {string} message - Issue message
 */
function addIssue(filePath, lineNumber, ruleId, message) {
  results.totalIssues++;
  results.issues.push({
    file: filePath,
    line: lineNumber,
    rule: ruleId,
    message,
  });
}

/**
 * Generate and display validation report
 */
function generateReport() {
  console.log('\n📊 Markdown Linting Validation Report');
  console.log('='.repeat(50));
  console.log(`Files processed: ${results.processedFiles}/${results.totalFiles}`);
  console.log(`Total issues: ${results.totalIssues}`);
  console.log('');

  // Warnings
  if (results.warnings.length > 0) {
    console.log(`⚠️  Warnings (${results.warnings.length}):`);
    results.warnings.forEach((warning) => {
      console.log(`  ${warning.message}`);
    });
    console.log('');
  }

  // Group issues by rule
  if (results.issues.length > 0) {
    const issuesByRule = groupIssuesByRule(results.issues);

    console.log(`❌ Linting Issues by Rule:`);
    Object.entries(issuesByRule).forEach(([rule, issues]) => {
      console.log(`\n  ${rule} (${issues.length} issues):`);
      issues.forEach((issue) => {
        console.log(`    ${issue.file}:${issue.line} - ${issue.message}`);
      });
    });
    console.log('');
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
  if (results.issues.length === 0 && results.errors.length === 0) {
    console.log('✅ All markdown files pass linting validation!');
  } else {
    console.log('❌ Markdown linting validation failed!');
    if (results.issues.length > 0) {
      console.log(`   ${results.issues.length} linting issues found`);
    }
    if (results.errors.length > 0) {
      console.log(`   ${results.errors.length} processing errors occurred`);
    }
  }

  // Top issues summary
  if (results.issues.length > 0) {
    const issuesByRule = groupIssuesByRule(results.issues);
    const sortedRules = Object.entries(issuesByRule)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5);

    console.log('\n📈 Most Common Issues:');
    sortedRules.forEach(([rule, issues]) => {
      console.log(`  ${rule}: ${issues.length} occurrences`);
    });
  }
}

/**
 * Group issues by rule ID
 *
 * @param {Array} issues - Array of issue objects
 * @returns {Object} Grouped issues by rule
 */
function groupIssuesByRule(issues) {
  return issues.reduce((groups, issue) => {
    const rule = issue.rule;
    if (!groups[rule]) {
      groups[rule] = [];
    }
    groups[rule].push(issue);
    return groups;
  }, {});
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateMarkdownLinting().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { validateMarkdownLinting, CONFIG };
