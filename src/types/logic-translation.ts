/**
 * Types and interfaces for the Logic Translation Engine
 */

export interface MMIRRepresentation {
  ast: ASTNode[];
  metadata: CodeMetadata;
  dependencies: Dependency[];
  complexity: ComplexityMetrics;
}

export interface ASTNode {
  type: string;
  value?: any;
  children: ASTNode[];
  position: SourcePosition;
  metadata?: NodeMetadata;
}

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface NodeMetadata {
  javaType?: string;
  bedrockEquivalent?: string;
  complexity: number;
  mappable: boolean;
}

export interface CodeMetadata {
  originalLinesOfCode: number;
  complexity: ComplexityMetrics;
  imports: ImportDeclaration[];
  classes: ClassDeclaration[];
  methods: MethodDeclaration[];
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  nestingDepth: number;
}

export interface Dependency {
  name: string;
  version?: string;
  type: 'minecraft' | 'forge' | 'fabric' | 'external';
  required: boolean;
}

export interface ImportDeclaration {
  packageName: string;
  className: string;
  isStatic: boolean;
  isWildcard: boolean;
}

export interface ClassDeclaration {
  name: string;
  superClass?: string;
  interfaces: string[];
  methods: MethodDeclaration[];
  fields: FieldDeclaration[];
}

export interface MethodDeclaration {
  name: string;
  returnType: string;
  parameters: Parameter[];
  modifiers: string[];
  body: ASTNode[];
}

export interface FieldDeclaration {
  name: string;
  type: string;
  modifiers: string[];
  initializer?: ASTNode;
}

export interface Parameter {
  name: string;
  type: string;
  annotations: string[];
}

export interface TranslationContext {
  modInfo: ModInfo;
  apiMappings: APIMapping[];
  targetVersion: string;
  compromiseStrategy: CompromiseStrategy;
  userPreferences: UserPreferences;
}

export interface ModInfo {
  name: string;
  version: string;
  modLoader: 'forge' | 'fabric';
  minecraftVersion: string;
  dependencies: string[];
}

export interface APIMapping {
  javaAPI: JavaAPISignature;
  bedrockAPI: BedrockAPISignature;
  mappingType: MappingType;
  confidence: number;
  notes?: string;
  examples?: MappingExample[];
}

export interface JavaAPISignature {
  className: string;
  methodName: string;
  parameters: Parameter[];
  returnType: string;
  modLoader: 'forge' | 'fabric';
}

export interface BedrockAPISignature {
  namespace: string;
  functionName: string;
  parameters: Parameter[];
  returnType: string;
  apiVersion: string;
}

export type MappingType = 'direct' | 'approximate' | 'compromise' | 'unsupported';

export interface MappingExample {
  javaCode: string;
  bedrockCode: string;
  description: string;
}

export interface CompromiseStrategy {
  name: string;
  type: CompromiseType;
  description: string;
  implementation: string;
}

export type CompromiseType = 'stub' | 'simulation' | 'alternative' | 'removal';

export interface UserPreferences {
  compromiseLevel: 'minimal' | 'moderate' | 'aggressive';
  preserveComments: boolean;
  generateDocumentation: boolean;
  optimizePerformance: boolean;
}

export interface TranslationResult {
  success: boolean;
  code: string;
  metadata: TranslationMetadata;
  compromises: CompromiseResult[];
  warnings: TranslationWarning[];
  errors: TranslationError[];
}

export interface TranslationMetadata {
  originalLinesOfCode: number;
  translatedLinesOfCode: number;
  astTranslationPercentage: number;
  llmTranslationPercentage: number;
  complexityScore: number;
  confidenceScore: number;
  processingTime: number;
}

export interface CompromiseResult {
  originalFeature: UnmappableFeature;
  strategy: CompromiseStrategy;
  implementation: string;
  documentation: string;
  userImpact: UserImpactAssessment;
}

export interface UnmappableFeature {
  type: string;
  description: string;
  javaCode: string;
  context: FeatureContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FeatureContext {
  className: string;
  methodName: string;
  lineNumber: number;
  dependencies: string[];
}

export interface UserImpactAssessment {
  functionalityLoss: 'none' | 'minimal' | 'moderate' | 'significant';
  performanceImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  userExperienceImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  description: string;
}

export interface TranslationWarning {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  location: SourcePosition;
  suggestion?: string;
}

export interface TranslationError {
  type: string;
  message: string;
  location: SourcePosition;
  stack?: string;
  recoverable: boolean;
}

export interface ASTTranspilationResult {
  code: string;
  unmappableCode: UnmappableCodeSegment[];
  mappedAPIs: APIMapping[];
  confidence: number;
  warnings: TranslationWarning[];
}

export interface UnmappableCodeSegment {
  originalCode: string;
  reason: string;
  context: FeatureContext;
  suggestedApproach: string;
}

export interface LLMTranslationResult {
  code: string;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  warnings: TranslationWarning[];
}

export interface ValidationResult {
  isEquivalent: boolean;
  confidence: number;
  differences: FunctionalDifference[];
  recommendations: string[];
}

export interface FunctionalDifference {
  type: 'behavior' | 'performance' | 'api' | 'logic';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: SourcePosition;
  suggestion?: string;
}

export interface RefinementIteration {
  iteration: number;
  changes: CodeChange[];
  validationResult: ValidationResult;
  improvement: number;
}

export interface CodeChange {
  type: 'addition' | 'modification' | 'removal';
  location: SourcePosition;
  originalCode: string;
  newCode: string;
  reason: string;
}
