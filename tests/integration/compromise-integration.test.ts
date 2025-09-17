import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogicTranslationEngine } from '../../src/modules/logic/LogicTranslationEngine.js';
import { CompromiseStrategyEngine } from '../../src/modules/compromise/CompromiseStrategyEngine.js';

// Mock all the dependencies that would normally cause issues
vi.mock('../../src/modules/logic/JavaParser', () => ({
  JavaParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn().mockResolvedValue({ type: 'JavaAST' }),
  })),
}));

vi.mock('../../src/modules/logic/MMIRGenerator', () => ({
  MMIRGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      nodes: [],
      relationships: [],
      metadata: { modId: 'test-mod', modLoader: 'forge' },
    }),
  })),
}));

vi.mock('../../src/modules/logic/ASTTranspiler', () => ({
  ASTTranspiler: vi.fn().mockImplementation(() => ({
    transpile: vi.fn().mockResolvedValue({
      jsASTs: [],
      unmappableNodes: [],
    }),
  })),
}));

vi.mock('../../src/modules/logic/APIMapping', () => ({
  APIMapping: vi.fn().mockImplementation(() => ({
    loadMappings: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../src/modules/logic/LLMTranslationService', () => ({
  LLMTranslationService: vi.fn().mockImplementation(() => ({
    translate: vi.fn().mockResolvedValue([]),
    refineWithFeedback: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../src/modules/logic/ProgramStateAlignmentValidator', () => ({
  ProgramStateAlignmentValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue({
      allValid: true,
      invalidTranslations: [],
      notes: [],
    }),
  })),
}));

vi.mock('../../src/modules/logic/JavaScriptGenerator', () => ({
  JavaScriptGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../src/utils/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/utils/errorHandler', () => ({
  ErrorHandler: {
    logicError: vi.fn(),
    compromiseError: vi.fn(),
  },
  globalErrorCollector: {
    addError: vi.fn(),
  },
}));

describe('Compromise Strategy Integration', () => {
  let logicEngine: LogicTranslationEngine;
  let compromiseEngine: CompromiseStrategyEngine;

  beforeEach(() => {
    logicEngine = new LogicTranslationEngine();
    compromiseEngine = logicEngine.getCompromiseStrategyEngine();
  });

  it('should create LogicTranslationEngine with integrated CompromiseStrategyEngine', () => {
    expect(logicEngine).toBeDefined();
    expect(compromiseEngine).toBeDefined();
    expect(compromiseEngine).toBeInstanceOf(CompromiseStrategyEngine);
  });

  it('should allow registering custom compromise strategies', () => {
    const customStrategy = {
      id: 'test-strategy',
      name: 'Test Strategy',
      description: 'A test compromise strategy',
      applicabilityCheck: vi.fn().mockReturnValue(true),
      apply: vi.fn().mockReturnValue({
        type: 'simulation',
        name: 'Test Simulation',
        description: 'Test simulation result',
        implementationDetails: 'Test implementation',
        limitations: ['Test limitation'],
      }),
    };

    // This should not throw
    expect(() => {
      logicEngine.registerCompromiseStrategy('dimension', customStrategy);
    }).not.toThrow();
  });

  it('should have default compromise strategies registered', () => {
    const testFeature = {
      id: 'test-dimension',
      name: 'Test Dimension',
      description: 'A test dimension feature',
      type: 'dimension',
      compatibilityTier: 3 as const,
      sourceFiles: ['TestDimension.java'],
      sourceLineNumbers: [[10, 20]],
    };

    const strategy = compromiseEngine.selectStrategy(testFeature);
    expect(strategy).toBeDefined();
    expect(strategy?.id).toBe('teleportation-simulation');
  });
});
