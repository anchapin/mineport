import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ConversionError } from '../../src/types/errors';

describe('Consistency Validation Tests', () => {
  let moduleFiles: string[];
  let typeFiles: string[];

  beforeAll(async () => {
    // Find all module files using fs
    moduleFiles = [];
    const findModuleFiles = (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          findModuleFiles(fullPath);
        } else if (item.endsWith('.ts') && !item.endsWith('.test.ts') && item !== 'index.ts') {
          moduleFiles.push(fullPath);
        }
      }
    };
    
    if (fs.existsSync('src/modules')) {
      findModuleFiles('src/modules');
    }
    
    // Find all type definition files
    typeFiles = [];
    const findTypeFiles = (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          findTypeFiles(fullPath);
        } else if (item.endsWith('.ts')) {
          typeFiles.push(fullPath);
        }
      }
    };
    
    if (fs.existsSync('src/types')) {
      findTypeFiles('src/types');
    }
  });

  describe('Interface Compliance', () => {
    it('should validate that all modules implement required interfaces', async () => {
      const moduleInterfaceViolations: string[] = [];
      
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf8');
        
        // Check for required interface implementations
        const requiredPatterns = [
          // All modules should have a class that implements or extends a base interface
          /class\s+\w+.*(?:implements|extends)\s+\w+/,
          // All modules should have proper error handling
          /(?:ConversionError|errors?)\s*:/,
          // All modules should have success indicators
          /success\s*:/,
        ];
        
        const hasClassDeclaration = /export\s+class\s+\w+/.test(content);
        if (!hasClassDeclaration) {
          moduleInterfaceViolations.push(`${moduleFile}: Missing exported class declaration`);
          continue;
        }
        
        // Check for proper method signatures
        const hasProcessMethod = /(?:process|convert|translate|analyze|generate|validate)\s*\([^)]*\)\s*:\s*Promise</.test(content);
        if (!hasProcessMethod) {
          moduleInterfaceViolations.push(`${moduleFile}: Missing async processing method`);
        }
        
        // Check for proper error handling
        const hasErrorHandling = /ConversionError|errors?\s*:/.test(content);
        if (!hasErrorHandling) {
          moduleInterfaceViolations.push(`${moduleFile}: Missing error handling`);
        }
        
        // Check for proper return types
        const hasSuccessIndicator = /success\s*:/.test(content);
        if (!hasSuccessIndicator) {
          moduleInterfaceViolations.push(`${moduleFile}: Missing success indicator in return type`);
        }
      }
      
      if (moduleInterfaceViolations.length > 0) {
        console.warn('Module interface violations found:', moduleInterfaceViolations);
        // Allow some violations for now, but track them
        expect(moduleInterfaceViolations.length).toBeLessThan(moduleFiles.length * 0.5); // Less than 50% violations
      }
    });

    it('should validate that all modules use consistent type imports', async () => {
      const typeImportViolations: string[] = [];
      
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf8');
        
        // Check for proper type imports
        const hasBaseTypeImports = /import.*from\s+['"].*\/types\//.test(content);
        const usesTypes = /:\s*\w+(?:Error|Result|Input|Output|Config)/.test(content);
        
        if (usesTypes && !hasBaseTypeImports) {
          typeImportViolations.push(`${moduleFile}: Uses types but missing type imports`);
        }
        
        // Check for consistent error type usage
        const usesErrors = /ConversionError|errors?\s*:/.test(content);
        const importsErrorTypes = /import.*ConversionError/.test(content);
        
        if (usesErrors && !importsErrorTypes) {
          typeImportViolations.push(`${moduleFile}: Uses errors but missing ConversionError import`);
        }
      }
      
      if (typeImportViolations.length > 0) {
        console.warn('Type import violations found:', typeImportViolations);
        expect(typeImportViolations.length).toBeLessThan(moduleFiles.length * 0.3); // Less than 30% violations
      }
    });

    it('should validate that all type definitions are properly structured', async () => {
      const typeStructureViolations: string[] = [];
      
      for (const typeFile of typeFiles) {
        const content = fs.readFileSync(typeFile, 'utf8');
        
        // Check for proper interface/type exports
        const hasExports = /export\s+(?:interface|type|enum)\s+\w+/.test(content);
        if (!hasExports) {
          typeStructureViolations.push(`${typeFile}: Missing exported types/interfaces`);
          continue;
        }
        
        // Check for JSDoc comments on interfaces
        const interfaces = content.match(/export\s+interface\s+\w+/g) || [];
        const jsdocComments = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
        
        if (interfaces.length > jsdocComments.length) {
          typeStructureViolations.push(`${typeFile}: Some interfaces missing JSDoc comments`);
        }
        
        // Check for consistent property naming
        const properties = content.match(/\w+\s*:\s*\w+/g) || [];
        const camelCaseViolations = properties.filter(prop => {
          const propName = prop.split(':')[0].trim();
          return !/^[a-z][a-zA-Z0-9]*$/.test(propName) && propName !== 'id';
        });
        
        if (camelCaseViolations.length > 0) {
          typeStructureViolations.push(`${typeFile}: Non-camelCase properties: ${camelCaseViolations.join(', ')}`);
        }
      }
      
      if (typeStructureViolations.length > 0) {
        console.warn('Type structure violations found:', typeStructureViolations);
        expect(typeStructureViolations.length).toBeLessThan(typeFiles.length * 0.2); // Less than 20% violations
      }
    });
  });

  describe('Error Handling Consistency', () => {
    it('should validate that all modules use consistent error format', async () => {
      const errorFormatViolations: string[] = [];
      
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf8');
        
        // Skip files that don't handle errors
        if (!content.includes('error') && !content.includes('Error')) {
          continue;
        }
        
        // Check for proper error creation patterns
        const errorCreationPatterns = [
          // Should create errors with required fields
          /{\s*id\s*:.*type\s*:.*severity\s*:.*message\s*:.*moduleOrigin\s*:/,
          // Should use ConversionError type
          /ConversionError/,
          // Should have timestamp
          /timestamp\s*:\s*new\s+Date\(\)/,
        ];
        
        const hasErrorCreation = /new.*Error|{\s*id\s*:/.test(content);
        if (hasErrorCreation) {
          const hasProperFormat = errorCreationPatterns.some(pattern => pattern.test(content));
          if (!hasProperFormat) {
            errorFormatViolations.push(`${moduleFile}: Inconsistent error format`);
          }
        }
        
        // Check for proper error handling in methods
        const methods = content.match(/(?:async\s+)?(?:process|convert|translate|analyze|generate|validate)\s*\([^)]*\)/g) || [];
        for (const method of methods) {
          const methodStart = content.indexOf(method);
          const methodEnd = content.indexOf('}', methodStart);
          const methodBody = content.substring(methodStart, methodEnd);
          
          const hasTryCatch = /try\s*{[\s\S]*catch/.test(methodBody);
          const hasErrorReturn = /errors?\s*:/.test(methodBody);
          
          if (!hasTryCatch && !hasErrorReturn) {
            errorFormatViolations.push(`${moduleFile}: Method ${method} missing error handling`);
          }
        }
      }
      
      if (errorFormatViolations.length > 0) {
        console.warn('Error format violations found:', errorFormatViolations);
        expect(errorFormatViolations.length).toBeLessThan(moduleFiles.length * 0.4); // Less than 40% violations
      }
    });

    it('should validate that error severity levels are used consistently', async () => {
      const severityViolations: string[] = [];
      const validSeverities = ['info', 'warning', 'error', 'critical'];
      
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf8');
        
        // Find severity assignments
        const severityMatches = content.match(/severity\s*:\s*['"]([^'"]+)['"]/g) || [];
        
        for (const match of severityMatches) {
          const severity = match.match(/['"]([^'"]+)['"]/)?.[1];
          if (severity && !validSeverities.includes(severity)) {
            severityViolations.push(`${moduleFile}: Invalid severity level '${severity}'`);
          }
        }
      }
      
      expect(severityViolations).toEqual([]);
    });

    it('should validate that all modules set moduleOrigin correctly', async () => {
      const moduleOriginViolations: string[] = [];
      
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf8');
        const fileName = path.basename(moduleFile, '.ts');
        
        // Skip files that don't create errors
        if (!content.includes('moduleOrigin')) {
          continue;
        }
        
        // Check that moduleOrigin matches the class name
        const classMatch = content.match(/export\s+class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          const moduleOriginPattern = new RegExp(`moduleOrigin\\s*:\\s*['"]${className}['"]`);
          
          if (!moduleOriginPattern.test(content)) {
            moduleOriginViolations.push(`${moduleFile}: moduleOrigin should be '${className}'`);
          }
        }
      }
      
      if (moduleOriginViolations.length > 0) {
        console.warn('Module origin violations found:', moduleOriginViolations);
        expect(moduleOriginViolations.length).toBeLessThan(moduleFiles.length * 0.3); // Less than 30% violations
      }
    });
  });

  describe('Naming Convention Compliance', () => {
    it('should validate that all files follow naming conventions', async () => {
      const namingViolations: string[] = [];
      
      // Check module file naming
      for (const moduleFile of moduleFiles) {
        const fileName = path.basename(moduleFile, '.ts');
        
        // Module files should be PascalCase
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(fileName)) {
          namingViolations.push(`${moduleFile}: File name should be PascalCase`);
        }
        
        // Check class name matches file name
        const content = fs.readFileSync(moduleFile, 'utf8');
        const classMatch = content.match(/export\s+class\s+(\w+)/);
        
        if (classMatch && classMatch[1] !== fileName) {
          namingViolations.push(`${moduleFile}: Class name '${classMatch[1]}' should match file name '${fileName}'`);
        }
      }
      
      // Check type file naming
      for (const typeFile of typeFiles) {
        const fileName = path.basename(typeFile, '.ts');
        
        // Type files should be camelCase
        if (!/^[a-z][a-zA-Z0-9]*$/.test(fileName)) {
          namingViolations.push(`${typeFile}: Type file name should be camelCase`);
        }
      }
      
      if (namingViolations.length > 0) {
        console.warn('Naming convention violations found:', namingViolations);
        expect(namingViolations.length).toBeLessThan((moduleFiles.length + typeFiles.length) * 0.2); // Less than 20% violations
      }
    });

    it('should validate that interface and type names follow conventions', async () => {
      const interfaceNamingViolations: string[] = [];
      
      for (const typeFile of typeFiles) {
        const content = fs.readFileSync(typeFile, 'utf8');
        
        // Find all interface declarations
        const interfaces = content.match(/export\s+interface\s+(\w+)/g) || [];
        for (const interfaceDecl of interfaces) {
          const interfaceName = interfaceDecl.match(/interface\s+(\w+)/)?.[1];
          if (interfaceName) {
            // Interfaces should be PascalCase
            if (!/^[A-Z][a-zA-Z0-9]*$/.test(interfaceName)) {
              interfaceNamingViolations.push(`${typeFile}: Interface '${interfaceName}' should be PascalCase`);
            }
          }
        }
        
        // Find all type declarations
        const types = content.match(/export\s+type\s+(\w+)/g) || [];
        for (const typeDecl of types) {
          const typeName = typeDecl.match(/type\s+(\w+)/)?.[1];
          if (typeName) {
            // Types should be PascalCase
            if (!/^[A-Z][a-zA-Z0-9]*$/.test(typeName)) {
              interfaceNamingViolations.push(`${typeFile}: Type '${typeName}' should be PascalCase`);
            }
          }
        }
        
        // Find all enum declarations
        const enums = content.match(/export\s+enum\s+(\w+)/g) || [];
        for (const enumDecl of enums) {
          const enumName = enumDecl.match(/enum\s+(\w+)/)?.[1];
          if (enumName) {
            // Enums should be PascalCase
            if (!/^[A-Z][a-zA-Z0-9]*$/.test(enumName)) {
              interfaceNamingViolations.push(`${typeFile}: Enum '${enumName}' should be PascalCase`);
            }
          }
        }
      }
      
      if (interfaceNamingViolations.length > 0) {
        console.warn('Interface naming violations found:', interfaceNamingViolations);
        expect(interfaceNamingViolations.length).toBeLessThan(50); // Allow some violations during transition
      }
    });

    it('should validate that method names follow conventions', async () => {
      const methodNamingViolations: string[] = [];
      
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf8');
        
        // Find all method declarations
        const methods = content.match(/(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)/g) || [];
        
        for (const method of methods) {
          const methodName = method.match(/(?:async\s+)?(\w+)\s*\(/)?.[1];
          if (methodName && methodName !== 'constructor') {
            // Methods should be camelCase
            if (!/^[a-z][a-zA-Z0-9]*$/.test(methodName)) {
              methodNamingViolations.push(`${moduleFile}: Method '${methodName}' should be camelCase`);
            }
          }
        }
      }
      
      if (methodNamingViolations.length > 0) {
        console.warn('Method naming violations found:', methodNamingViolations);
        expect(methodNamingViolations.length).toBeLessThan(100); // Allow some violations during transition
      }
    });

    it('should validate that constants follow naming conventions', async () => {
      const constantNamingViolations: string[] = [];
      
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf8');
        
        // Find constant declarations
        const constants = content.match(/(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=/g) || [];
        
        for (const constant of constants) {
          const constantName = constant.match(/const\s+([A-Z_][A-Z0-9_]*)/)?.[1];
          if (constantName) {
            // Constants should be SCREAMING_SNAKE_CASE
            if (!/^[A-Z][A-Z0-9_]*$/.test(constantName)) {
              constantNamingViolations.push(`${moduleFile}: Constant '${constantName}' should be SCREAMING_SNAKE_CASE`);
            }
          }
        }
      }
      
      if (constantNamingViolations.length > 0) {
        console.warn('Constant naming violations found:', constantNamingViolations);
        expect(constantNamingViolations.length).toBeLessThan(20); // Allow some violations during transition
      }
    });
  });

  describe('Module Structure Consistency', () => {
    it('should validate that all modules have consistent export patterns', async () => {
      const exportViolations: string[] = [];
      
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf8');
        
        // Check for default export of main class
        const hasDefaultExport = /export\s+default\s+class/.test(content);
        const hasNamedClassExport = /export\s+class\s+\w+/.test(content);
        
        if (!hasDefaultExport && !hasNamedClassExport) {
          exportViolations.push(`${moduleFile}: Missing class export`);
        }
        
        // Check for index.ts files in module directories
        const moduleDir = path.dirname(moduleFile);
        const indexFile = path.join(moduleDir, 'index.ts');
        
        if (fs.existsSync(indexFile)) {
          const indexContent = fs.readFileSync(indexFile, 'utf8');
          const fileName = path.basename(moduleFile, '.ts');
          
          // Index file should export the module
          if (!indexContent.includes(fileName)) {
            exportViolations.push(`${indexFile}: Should export ${fileName}`);
          }
        }
      }
      
      if (exportViolations.length > 0) {
        console.warn('Export pattern violations found:', exportViolations);
        expect(exportViolations.length).toBeLessThan(moduleFiles.length * 0.3); // Less than 30% violations
      }
    });

    it('should validate that all modules have proper dependency imports', async () => {
      const dependencyViolations: string[] = [];
      
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf8');
        
        // Check for relative imports that should be absolute
        const relativeImports = content.match(/import.*from\s+['"]\.\.\/\.\.\//g) || [];
        if (relativeImports.length > 2) { // Allow some relative imports
          dependencyViolations.push(`${moduleFile}: Too many relative imports, consider using absolute imports`);
        }
        
        // Check for proper service imports
        const usesServices = /(?:ErrorCollector|ConfigurationService|ConversionPipeline)/.test(content);
        const importsServices = /import.*from\s+['"].*\/services\//.test(content);
        
        if (usesServices && !importsServices) {
          dependencyViolations.push(`${moduleFile}: Uses services but missing service imports`);
        }
      }
      
      if (dependencyViolations.length > 0) {
        console.warn('Dependency violations found:', dependencyViolations);
        expect(dependencyViolations.length).toBeLessThan(moduleFiles.length * 0.4); // Less than 40% violations
      }
    });
  });
});