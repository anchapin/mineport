/**
 * Core type definitions used throughout the application
 */

/**
 * Represents a Java mod
 */
export interface JavaMod {
  id: string;
  name: string;
  version: string;
  modLoader: 'forge' | 'fabric';
  sourceFiles: JavaSourceFile[];
  assetFiles: AssetFile[];
  configFiles: ConfigFile[];
  license: LicenseInfo;
}

/**
 * Represents a Java source file
 */
export interface JavaSourceFile {
  path: string;
  content: string;
  modLoader: 'forge' | 'fabric';
}

/**
 * Represents an asset file
 */
export interface AssetFile {
  path: string;
  content: Buffer;
  type: 'texture' | 'model' | 'sound' | 'particle' | 'other';
}

/**
 * Represents a configuration file
 */
export interface ConfigFile {
  path: string;
  content: string;
  format: 'json' | 'toml' | 'properties' | 'xml' | 'other';
}

/**
 * Represents license information
 */
export interface LicenseInfo {
  type: string;
  text: string;
  permissions: string[];
  limitations: string[];
  conditions: string[];
}

/**
 * Represents a source code location
 */
export interface SourceLocation {
  file: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Common interface for conversion notes
 */
export interface ConversionNote {
  type: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  sourceLocation?: SourceLocation;
  moduleOrigin: string;
}
