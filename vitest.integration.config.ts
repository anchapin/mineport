import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['tests/unit/**', 'tests/benchmark/**', 'tests/security/**'],
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 10000,
    teardownTimeout: 10000,
    globals: true,
    environment: 'node',
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/node_modules/**',
      ],
    },
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results/integration-results.json',
    },
    retry: 2, // Retry failed integration tests
    bail: 1, // Stop on first failure in integration tests
  },
});
