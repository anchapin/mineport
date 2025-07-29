#!/usr/bin/env node

/**
 * Documentation Link Validation Script
 * 
 * Validates all internal links in documentation files to ensure they point to
 * existing files and sections. Helps maintain documentation integrity as the
 * project evolves.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  docsDirectories: ['docs', '.github', '.'],
  markdownExtensions: ['.md'],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/temp/**',
    '**/coverage/**',
    'node_modules/**'
  ],
  externalLinkPatterns: [
    /^https?:\/\//,
    /^mailto:/,
    /^ftp:/
  ]
};

// Validation results
const results = {
  totalFiles: 0,
  totalLinks: 0,
  validLinks: 0,
  brokenLinks: [],
  warnings: [],
  errors: []
};

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
}/**
 * Ge
t all markdown files in a directory recursively
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
        } else if (entry.isFile() && CONFIG.markdownExtensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      results.warnings.push({
        message: `Could not read directory: ${currentDir} - ${error.message}`
      });
    }
  }
  
  await traverse(dir);
  return files;
}

/**
 * Get all markdown files in configured directories
 * 
 * @returns {Promise<string[]>} Array of markdown file paths
 */
async function getMarkdownFiles() {
  const files = [];
  
  for (const dir of CONFIG.docsDirectories) {
    if (await fileExists(dir)) {
      const dirFiles = await getMarkdownFilesInDirectory(dir);
      files.push(...dirFiles);
    }
  }
  
  return files.filter(file => shouldProcessFile(file));
}

/**
 * Extract all links from markdown content
 * 
 * @param {string} content - Markdown content
 * @returns {Array} Array of link objects
 */
function extractLinks(content) {
  const links = [];
  
  // Regular expressions for different link types
  const patterns = [
    // Markdown links: [text](url)
    /\[([^\]]*)\]\(([^)]+)\)/g,
    // Reference links: [text][ref]
    /\[([^\]]*)\]\[([^\]]+)\]/g,
    // Reference definitions: [ref]: url
    /^\[([^\]]+)\]:\s*(.+)$/gm,
    // HTML links: <a href="url">
    /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi,
    // Auto links: <url>
    /<(https?:\/\/[^>]+)>/g
  ];
  
  const lines = content.split('\n');
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;
    
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      
      while ((match = pattern.exec(line)) !== null) {
        const linkText = match[1] || '';
        const linkUrl = match[2] || match[1]; // For auto links, URL is in first group
        
        if (linkUrl && linkUrl.trim()) {
          links.push({
            text: linkText,
            url: linkUrl.trim(),
            line: lineNumber,
            column: match.index + 1
          });
        }
      }
    }
  }
  
  return links;
}/**
 * Chec
k if a URL is external
 * 
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is external
 */
function isExternalLink(url) {
  return CONFIG.externalLinkPatterns.some(pattern => pattern.test(url));
}

/**
 * Resolve relative path from a file
 * 
 * @param {string} url - Relative URL
 * @param {string} fromFile - File path the URL is relative to
 * @returns {string} Resolved absolute path
 */
function resolveRelativePath(url, fromFile) {
  const fromDir = path.dirname(fromFile);
  return path.resolve(fromDir, url);
}

/**
 * Escape special regex characters
 * 
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate an anchor link exists in a file
 * 
 * @param {string} anchor - Anchor link (e.g., "#section-name")
 * @param {string} filePath - Path to the file to check
 * @returns {Promise<boolean>} True if anchor exists
 */
async function validateAnchorLink(anchor, filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const anchorName = anchor.substring(1); // Remove #
    
    // Check for markdown headers that would create this anchor
    const headerPatterns = [
      new RegExp(`^#+\\s+.*${escapeRegex(anchorName)}.*$`, 'im'),
      new RegExp(`^#+\\s+${escapeRegex(anchorName)}\\s*$`, 'im'),
      // GitHub-style anchor generation (lowercase, spaces to hyphens)
      new RegExp(`^#+\\s+${escapeRegex(anchorName.replace(/-/g, ' '))}\\s*$`, 'im')
    ];
    
    // Also check for HTML anchors
    const htmlAnchorPattern = new RegExp(`<a\\s+[^>]*(?:name|id)\\s*=\\s*["']${escapeRegex(anchorName)}["'][^>]*>`, 'i');
    
    return headerPatterns.some(pattern => pattern.test(content)) || 
           htmlAnchorPattern.test(content) ||
           content.includes(`id="${anchorName}"`) ||
           content.includes(`name="${anchorName}"`);
           
  } catch (error) {
    return false;
  }
}

/**
 * Validate a single link
 * 
 * @param {Object} link - Link object with url, text, line, column
 * @param {string} filePath - Path to the file containing the link
 * @param {string} relativePath - Relative path for reporting
 */
async function validateLink(link, filePath, relativePath) {
  results.totalLinks++;
  
  const { url, text, line, column } = link;
  
  // Skip external links
  if (isExternalLink(url)) {
    results.validLinks++;
    return;
  }
  
  // Skip mailto and other special protocols
  if (CONFIG.externalLinkPatterns.some(pattern => pattern.test(url))) {
    results.validLinks++;
    return;
  }
  
  // Handle anchor links within the same file
  if (url.startsWith('#')) {
    const isValid = await validateAnchorLink(url, filePath);
    if (isValid) {
      results.validLinks++;
    } else {
      results.brokenLinks.push({
        file: relativePath,
        line,
        column,
        url,
        text,
        type: 'anchor',
        message: `Anchor "${url}" not found in file`
      });
    }
    return;
  }
  
  // Handle relative file links
  const targetPath = resolveRelativePath(url, filePath);
  const [filePart, anchorPart] = targetPath.split('#');
  
  // Check if target file exists
  const targetFileExists = await fileExists(filePart);
  if (!targetFileExists) {
    results.brokenLinks.push({
      file: relativePath,
      line,
      column,
      url,
      text,
      type: 'file',
      message: `File not found: ${path.relative(process.cwd(), filePart)}`
    });
    return;
  }
  
  // If there's an anchor, validate it exists in the target file
  if (anchorPart) {
    const isValidAnchor = await validateAnchorLink(`#${anchorPart}`, filePart);
    if (!isValidAnchor) {
      results.brokenLinks.push({
        file: relativePath,
        line,
        column,
        url,
        text,
        type: 'anchor',
        message: `Anchor "#${anchorPart}" not found in ${path.relative(process.cwd(), filePart)}`
      });
      return;
    }
  }
  
  results.validLinks++;
}/**

 * Validate all links in a single markdown file
 * 
 * @param {string} filePath - Path to the markdown file
 */
async function validateFileLinks(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);
    
    console.log(`Validating links in: ${relativePath}`);
    
    const links = extractLinks(content);
    
    for (const link of links) {
      await validateLink(link, filePath, relativePath);
    }
    
  } catch (error) {
    results.errors.push({
      file: filePath,
      message: `Failed to process file: ${error.message}`
    });
  }
}

/**
 * Generate and display validation report
 */
function generateReport() {
  console.log('\n📊 Documentation Link Validation Report');
  console.log('=' .repeat(50));
  console.log(`Files processed: ${results.totalFiles}`);
  console.log(`Total links checked: ${results.totalLinks}`);
  console.log(`Valid links: ${results.validLinks}`);
  console.log(`Broken links: ${results.brokenLinks.length}`);
  console.log('');
  
  // Warnings
  if (results.warnings.length > 0) {
    console.log(`⚠️  Warnings (${results.warnings.length}):`);
    results.warnings.forEach(warning => {
      console.log(`  ${warning.message}`);
    });
    console.log('');
  }
  
  // Broken links
  if (results.brokenLinks.length > 0) {
    console.log(`❌ Broken Links (${results.brokenLinks.length}):`);
    results.brokenLinks.forEach(link => {
      console.log(`  ${link.file}:${link.line}:${link.column}`);
      console.log(`    Link: ${link.url}`);
      console.log(`    Text: "${link.text}"`);
      console.log(`    Error: ${link.message}`);
      console.log('');
    });
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
  if (results.brokenLinks.length === 0 && results.errors.length === 0) {
    console.log('✅ All documentation links are valid!');
  } else {
    console.log('❌ Documentation link validation failed!');
    if (results.brokenLinks.length > 0) {
      console.log(`   ${results.brokenLinks.length} broken links found`);
    }
    if (results.errors.length > 0) {
      console.log(`   ${results.errors.length} processing errors occurred`);
    }
  }
}

/**
 * Main validation function
 */
async function validateDocumentationLinks() {
  console.log('🔗 Starting documentation link validation...\n');
  
  try {
    const files = await getMarkdownFiles();
    results.totalFiles = files.length;
    
    console.log(`Found ${files.length} markdown files to validate\n`);
    
    for (const file of files) {
      await validateFileLinks(file);
    }
    
    generateReport();
    
    // Exit with error code if validation fails
    if (results.brokenLinks.length > 0 || results.errors.length > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Link validation failed:', error.message);
    process.exit(1);
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateDocumentationLinks().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { validateDocumentationLinks, CONFIG };