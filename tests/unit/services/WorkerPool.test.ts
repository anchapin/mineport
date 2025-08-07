import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerPool, WorkerTask } from '../../../src/services/WorkerPool.js';

describe('WorkerPool Unit Tests', () => {
  let workerPool: WorkerPool;

  beforeEach(() => {
    workerPool = new WorkerPool({
      maxWorkers: 2,
      idleTimeout: 1000,
    });
  });

  afterEach(async () => {
    // Clean up any running workers
    if (workerPool) {
      await workerPool.shutdown?.();
    }
  });

  describe('Basic Task Execution', () => {
    it('should execute tasks successfully', async () => {
      const task: WorkerTask<number, number> = {
        execute: async (input: number) => input * 2,
        input: 5,
      };

      const result = await workerPool.runTask(task);
      expect(result).toBe(10);
    });

    it('should handle multiple tasks', async () => {
      const tasks = [1, 2, 3, 4, 5].map((num) => ({
        execute: async (input: number) => input * 2,
        input: num,
      }));

      const results = await Promise.all(tasks.map((task) => workerPool.runTask(task)));
      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should handle task failures', async () => {
      const errorTask: WorkerTask<void, never> = {
        execute: async () => {
          throw new Error('Task failed');
        },
        input: undefined,
      };

      await expect(workerPool.runTask(errorTask)).rejects.toThrow('Task failed');
    });
  });

  describe('Configuration and Initialization', () => {
    it('should initialize with correct configuration', async () => {
      const customPool = new WorkerPool({
        maxWorkers: 4,
        minWorkers: 2,
        idleTimeout: 2000,
      });

      // Test that the pool was created with the right config
      expect(customPool).toBeDefined();

      // Give the pool time to initialize workers
      await new Promise(resolve => setTimeout(resolve, 100));

      // We can test the stats to verify configuration
      const stats = customPool.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2); // minWorkers should be created
      expect(stats.busyWorkers).toBe(0); // No tasks running yet
      expect(stats.idleWorkers).toBe(stats.totalWorkers); // All workers should be idle
      expect(stats.pendingTasks).toBe(0);

      // Clean up
      await customPool.destroy?.();
    });

    it('should provide initial statistics', () => {
      const stats = workerPool.getStats();

      expect(stats).toHaveProperty('totalWorkers');
      expect(stats).toHaveProperty('busyWorkers');
      expect(stats).toHaveProperty('idleWorkers');
      expect(stats).toHaveProperty('pendingTasks');

      expect(typeof stats.totalWorkers).toBe('number');
      expect(typeof stats.busyWorkers).toBe('number');
      expect(typeof stats.idleWorkers).toBe('number');
      expect(typeof stats.pendingTasks).toBe('number');
    });
  });

  describe('Task Interface Validation', () => {
    it('should handle tasks with different input types', async () => {
      // String input
      const stringTask: WorkerTask<string, string> = {
        execute: async (input: string) => input.toUpperCase(),
        input: 'hello',
      };
      expect(await workerPool.runTask(stringTask)).toBe('HELLO');

      // Object input
      const objectTask: WorkerTask<{ value: number }, number> = {
        execute: async (input: { value: number }) => input.value * 3,
        input: { value: 10 },
      };
      expect(await workerPool.runTask(objectTask)).toBe(30);

      // Array input
      const arrayTask: WorkerTask<number[], number> = {
        execute: async (input: number[]) => input.reduce((sum, n) => sum + n, 0),
        input: [1, 2, 3, 4, 5],
      };
      expect(await workerPool.runTask(arrayTask)).toBe(15);
    });

    it('should handle tasks with optional properties', async () => {
      // Task with ID
      const taskWithId: WorkerTask<number, number> = {
        id: 'test-task-id',
        execute: async (input: number) => input * 2,
        input: 7,
      };
      expect(await workerPool.runTask(taskWithId)).toBe(14);

      // Task with priority
      const taskWithPriority: WorkerTask<number, number> = {
        priority: 5,
        execute: async (input: number) => input + 10,
        input: 5,
      };
      expect(await workerPool.runTask(taskWithPriority)).toBe(15);

      // Task with both ID and priority
      const taskWithBoth: WorkerTask<number, number> = {
        id: 'priority-task',
        priority: 10,
        execute: async (input: number) => input * input,
        input: 4,
      };
      expect(await workerPool.runTask(taskWithBoth)).toBe(16);
    });
  });

  describe('Error Handling', () => {
    it('should handle synchronous errors in tasks', async () => {
      const syncErrorTask: WorkerTask<void, never> = {
        execute: () => {
          throw new Error('Synchronous error');
        },
        input: undefined,
      };

      await expect(workerPool.runTask(syncErrorTask)).rejects.toThrow('Synchronous error');
    });

    it('should handle async errors in tasks', async () => {
      const asyncErrorTask: WorkerTask<void, never> = {
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Asynchronous error');
        },
        input: undefined,
      };

      await expect(workerPool.runTask(asyncErrorTask)).rejects.toThrow('Asynchronous error');
    });

    it('should handle tasks that return rejected promises', async () => {
      const rejectedPromiseTask: WorkerTask<void, never> = {
        execute: async () => {
          return Promise.reject(new Error('Rejected promise'));
        },
        input: undefined,
      };

      await expect(workerPool.runTask(rejectedPromiseTask)).rejects.toThrow('Rejected promise');
    });
  });

  describe('API Methods', () => {
    it('should have cancelTask method', () => {
      expect(typeof workerPool.cancelTask).toBe('function');

      // Should not throw when cancelling non-existent task
      expect(() => workerPool.cancelTask('non-existent-task')).not.toThrow();
    });

    it('should have getStats method that returns consistent data', () => {
      const stats1 = workerPool.getStats();
      const stats2 = workerPool.getStats();

      // Stats should be consistent when called multiple times with no activity
      expect(stats1.totalWorkers).toBe(stats2.totalWorkers);
      expect(stats1.busyWorkers).toBe(stats2.busyWorkers);
      expect(stats1.idleWorkers).toBe(stats2.idleWorkers);
      expect(stats1.pendingTasks).toBe(stats2.pendingTasks);
    });

    it('should have shutdown method if available', () => {
      // Shutdown method might be optional, but if it exists it should be a function
      if ('shutdown' in workerPool) {
        expect(typeof workerPool.shutdown).toBe('function');
      }
    });
  });
});
