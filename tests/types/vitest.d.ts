/**
 * Vitest type declarations for global test utilities
 */

import 'vitest/globals';

declare global {
  namespace jest {
    interface Mock<T = any, Y extends any[] = any[]> {
      (...args: Y): T;
      mock: {
        calls: Y[];
        results: Array<{ type: 'return' | 'throw'; value: T }>;
      };
    }
  }
}
