import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/benchmark/**/*.test.ts'],
    exclude: [],
    testTimeout: 300000, // 5 minutes for performance tests
    hookTimeout: 60000,
    teardownTimeout: 60000,
    isolate: false, // Performance tests can share context
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run performance tests in single process
      },
    },
    reporters: ['verbose'],
    outputFile: {
      json: './test-results/performance-results.json',
    },
  },
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, './src/modules'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@config': path.resolve(__dirname, './config'),
    },
  },
});
