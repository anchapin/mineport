#!/usr/bin/env node

/**
 * JSDoc Addition Script
 *
 * Automatically adds basic JSDoc comments to TypeScript files that are missing them.
 * This script analyzes the codebase and adds template JSDoc comments based on the
 * established standards and templates.
 */

import fs from 'fs';
import path from 'path';
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
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose')
};

/**
 * Main function to add JSDoc comments
 */
async function addJSDoc() {
  console.log('🔧 Adding JSDoc comments to codebase...\n');

  if (CONFIG.dryRun) {
    console.log('🔍 Running in dry-run mode (no files will be modified)\n');
  }

  try {
    const files = await getTypeScriptFiles(CONFIG.sourceDir);
    let processedFiles = 0;
    let modifiedFiles = 0;

    for (const file of files) {
      if (shouldProcessFile(file)) {
        const modified = await processFile(file);
        processedFiles++;
        if (modified) modifiedFiles++;
      }
    }

    console.log(`\n✅ Processed ${processedFiles} files`);
    console.log(`📝 Modified ${modifiedFiles} files`);

    if (CONFIG.dryRun) {
      console.log('\n💡 Run without --dry-run to apply changes');
    }

  } catch (error) {
    console.error('❌ Failed to add JSDoc comments:', error.message);
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
 * Process a single file to add JSDoc comments
 *
 * @param {string} filePath - Path to the file to process
 * @returns {Promise<boolean>} True if file was modified
 */
async function processFile(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const newLines = [];
    let modified = false;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check if this line starts a construct that needs JSDoc
      const construct = identifyConstruct(trimmedLine, lines, i);

      if (construct && !hasJSDocAbove(lines, i)) {
        // Add JSDoc comment
        const jsdocComment = generateJSDocComment(construct, line);
        const indent = getIndentation(line);

        // Add the JSDoc comment with proper indentation
        jsdocComment.split('\n').forEach(commentLine => {
          newLines.push(indent + commentLine);
        });

        modified = true;

        if (CONFIG.verbose) {
          console.log(`  Added JSDoc for ${construct.type} ${construct.name} in ${path.relative(process.cwd(), filePath)}`);
        }
      }

      newLines.push(line);
      i++;
    }

    if (modified && !CONFIG.dryRun) {
      await fs.promises.writeFile(filePath, newLines.join('\n'));
    }

    if (modified) {
      console.log(`📝 ${CONFIG.dryRun ? 'Would modify' : 'Modified'}: ${path.relative(process.cwd(), filePath)}`);
    }

    return modified;

  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Identify what type of construct a line represents
 *
 * @param {string} line - Line to analyze
 * @param {string[]} lines - All lines in the file
 * @param {number} index - Current line index
 * @returns {Object|null} Construct information or null
 */
function identifyConstruct(line, lines, index) {
  // Skip if line is empty or a comment
  if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
    return null;
  }

  // Class declaration
  const classMatch = line.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
  if (classMatch) {
    return {
      type: 'class',
      name: classMatch[1],
      isPublic: line.includes('export')
    };
  }

  // Interface declaration
  const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
  if (interfaceMatch) {
    return {
      type: 'interface',
      name: interfaceMatch[1],
      isPublic: true
    };
  }

  // Function declaration
  const functionMatch = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
  if (functionMatch) {
    return {
      type: 'function',
      name: functionMatch[1],
      isPublic: true
    };
  }

  // Method declaration (inside class)
  const methodMatch = line.match(/^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\(/);
  if (methodMatch && !line.includes('=') && !line.includes('=>')) {
    const isPublic = line.includes('public') || (!line.includes('private') && !line.includes('protected'));
    return {
      type: 'method',
      name: methodMatch[1],
      isPublic
    };
  }

  // Constructor
  if (line.match(/^\s*constructor\s*\(/)) {
    return {
      type: 'constructor',
      name: 'constructor',
      isPublic: true
    };
  }

  // Type declaration
  const typeMatch = line.match(/^export\s+type\s+(\w+)/);
  if (typeMatch) {
    return {
      type: 'type',
      name: typeMatch[1],
      isPublic: true
    };
  }

  return null;
}

/**
 * Check if there's already a JSDoc comment above the given line
 *
 * @param {string[]} lines - All lines in the file
 * @param {number} index - Current line index
 * @returns {boolean} True if JSDoc exists above
 */
function hasJSDocAbove(lines, index) {
  // Look backwards for JSDoc comment
  for (let i = index - 1; i >= 0; i--) {
    const line = lines[i].trim();

    if (!line) continue; // Skip empty lines

    if (line.startsWith('/**')) {
      return true; // Found JSDoc comment
    }

    if (line && !line.startsWith('*') && !line.startsWith('//')) {
      return false; // Found non-comment content
    }
  }

  return false;
}

/**
 * Get the indentation of a line
 *
 * @param {string} line - Line to analyze
 * @returns {string} Indentation string
 */
function getIndentation(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

/**
 * Generate JSDoc comment for a construct
 *
 * @param {Object} construct - Construct information
 * @param {string} originalLine - Original line of code
 * @returns {string} JSDoc comment
 */
function generateJSDocComment(construct, originalLine) {
  const { type, name } = construct;

  switch (type) {
    case 'class':
      return generateClassJSDoc(name);
    case 'interface':
      return generateInterfaceJSDoc(name);
    case 'function':
      return generateFunctionJSDoc(name, originalLine);
    case 'method':
      return generateMethodJSDoc(name, originalLine);
    case 'constructor':
      return generateConstructorJSDoc();
    case 'type':
      return generateTypeJSDoc(name);
    default:
      return generateGenericJSDoc(name, type);
  }
}

/**
 * Generate JSDoc for class
 *
 * @param {string} name - Class name
 * @returns {string} JSDoc comment
 */
function generateClassJSDoc(name) {
  return `/**
 * ${name} class.
 *
 * TODO: Add detailed description of the class purpose and functionality.
 *
 * @since 1.0.0
 */`;
}

/**
 * Generate JSDoc for interface
 *
 * @param {string} name - Interface name
 * @returns {string} JSDoc comment
 */
function generateInterfaceJSDoc(name) {
  return `/**
 * ${name} interface.
 *
 * TODO: Add detailed description of what this interface represents.
 *
 * @since 1.0.0
 */`;
}

/**
 * Generate JSDoc for function
 *
 * @param {string} name - Function name
 * @param {string} line - Original line
 * @returns {string} JSDoc comment
 */
function generateFunctionJSDoc(name, line) {
  const hasAsync = line.includes('async');
  const returnType = hasAsync ? 'Promise' : 'result';

  return `/**
 * ${name} function.
 *
 * TODO: Add detailed description of the function's purpose and behavior.
 *
 * @param param - TODO: Document parameters
 * @returns ${returnType} - TODO: Document return value
 * @since 1.0.0
 */`;
}

/**
 * Generate JSDoc for method
 *
 * @param {string} name - Method name
 * @param {string} line - Original line
 * @returns {string} JSDoc comment
 */
function generateMethodJSDoc(name, line) {
  const hasAsync = line.includes('async');
  const returnType = hasAsync ? 'Promise' : 'result';

  return `/**
 * ${name} method.
 *
 * TODO: Add detailed description of the method's purpose and behavior.
 *
 * @param param - TODO: Document parameters
 * @returns ${returnType} - TODO: Document return value
 * @since 1.0.0
 */`;
}

/**
 * Generate JSDoc for constructor
 *
 * @returns {string} JSDoc comment
 */
function generateConstructorJSDoc() {
  return `/**
 * Creates a new instance.
 *
 * TODO: Add detailed description of constructor behavior.
 *
 * @param param - TODO: Document parameters
 * @since 1.0.0
 */`;
}

/**
 * Generate JSDoc for type
 *
 * @param {string} name - Type name
 * @returns {string} JSDoc comment
 */
function generateTypeJSDoc(name) {
  return `/**
 * ${name} type definition.
 *
 * TODO: Add detailed description of what this type represents.
 *
 * @since 1.0.0
 */`;
}

/**
 * Generate generic JSDoc
 *
 * @param {string} name - Construct name
 * @param {string} type - Construct type
 * @returns {string} JSDoc comment
 */
function generateGenericJSDoc(name, type) {
  return `/**
 * ${name} ${type}.
 *
 * TODO: Add detailed description.
 *
 * @since 1.0.0
 */`;
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addJSDoc().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { addJSDoc };
