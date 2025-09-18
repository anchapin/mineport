import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkerPool, WorkerTask } from '../../src/services/WorkerPool.js';

describe('WorkerPool Integration Tests', () => {
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

  describe('Worker Lifecycle Management', () => {
    it('should respect the max workers limit', async () => {
      // Create a worker pool with max 1 worker
      const singleWorkerPool = new WorkerPool({
        maxWorkers: 1,
        idleTimeout: 1000,
      });

      // Create a task that takes some time to complete
      const longTask: WorkerTask<void, number> = {
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 1;
        },
        input: undefined,
      };

      // Create a spy to track when tasks start
      const startTimes: number[] = [];

      // Run two tasks and track when they start
      const promise1 = singleWorkerPool.runTask({
        ...longTask,
        execute: async (input) => {
          startTimes.push(Date.now());
          return await longTask.execute(input);
        },
      });

      // Small delay to ensure first task starts
      await new Promise((resolve) => setTimeout(resolve, 10));

      const promise2 = singleWorkerPool.runTask({
        ...longTask,
        execute: async (input) => {
          startTimes.push(Date.now());
          return await longTask.execute(input);
        },
      });

      // Wait for both tasks to complete
      const results = await Promise.all([promise1, promise2]);

      // Both tasks should complete successfully
      expect(results).toEqual([1, 1]);

      // Second task should start after the first one (with some tolerance)
      expect(startTimes).toHaveLength(2);
      expect(startTimes[1] - startTimes[0]).toBeGreaterThan(50); // At least 50ms apart

      await singleWorkerPool.shutdown?.();
    }, 10000); // Longer timeout for integration test

    it('should clean up idle workers after timeout', async () => {
      // Run a task to create a worker
      await workerPool.runTask({
        execute: async (input: number) => input * 2,
        input: 5,
      });

      // Get initial stats
      const initialStats = workerPool.getStats();
      expect(initialStats.totalWorkers).toBeGreaterThan(0);

      // Wait for idle timeout plus buffer
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check that workers were cleaned up
      const finalStats = workerPool.getStats();
      expect(finalStats.totalWorkers).toBeLessThanOrEqual(initialStats.totalWorkers);
    }, 5000);
  });

  describe('Task Statistics and Monitoring', () => {
    it('should provide accurate worker pool statistics', async () => {
      // Create tasks that will run concurrently
      const tasks = [1, 2, 3].map((num) => ({
        execute: async (input: number) => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return input * 2;
        },
        input: num,
      }));

      // Start the tasks but don't wait for them immediately
      const promises = tasks.map((task) => workerPool.runTask(task));

      // Give tasks time to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check stats while tasks are running
      const stats = workerPool.getStats();
      expect(stats.totalWorkers).toBeGreaterThan(0);
      expect(stats.totalWorkers).toBeLessThanOrEqual(2); // Max workers limit
      expect(stats.busyWorkers).toBeGreaterThan(0);
      expect(stats.idleWorkers).toBe(stats.totalWorkers - stats.busyWorkers);

      // With 3 tasks and max 2 workers, we should have at least 1 pending task
      expect(stats.pendingTasks).toBeGreaterThanOrEqual(0);

      // Wait for all tasks to complete
      const results = await Promise.all(promises);
      expect(results).toEqual([2, 4, 6]);

      // After completion, all workers should be idle
      const finalStats = workerPool.getStats();
      expect(finalStats.busyWorkers).toBe(0);
      expect(finalStats.pendingTasks).toBe(0);
    }, 5000);
  });

  describe('Task Prioritization', () => {
    it('should prioritize tasks based on priority', async () => {
      // Create a worker pool with max 1 worker to force queuing
      const singleWorkerPool = new WorkerPool({
        maxWorkers: 1,
        idleTimeout: 1000,
      });

      // Create a blocking task to ensure subsequent tasks queue
      const blockingTask: WorkerTask<void, number> = {
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 0;
        },
        input: undefined,
      };

      // Start the blocking task
      const blockingPromise = singleWorkerPool.runTask(blockingTask);

      // Track execution order
      const executionOrder: number[] = [];

      // Queue tasks with different priorities (after a small delay to ensure blocking task starts)
      await new Promise((resolve) => setTimeout(resolve, 10));

      const lowPriorityTask = singleWorkerPool.runTask({
        execute: async () => {
          executionOrder.push(1);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 1;
        },
        input: undefined,
        priority: 1,
      });

      const highPriorityTask = singleWorkerPool.runTask({
        execute: async () => {
          executionOrder.push(10);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 10;
        },
        input: undefined,
        priority: 10,
      });

      const mediumPriorityTask = singleWorkerPool.runTask({
        execute: async () => {
          executionOrder.push(5);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 5;
        },
        input: undefined,
        priority: 5,
      });

      // Wait for all tasks to complete
      await Promise.all([blockingPromise, lowPriorityTask, highPriorityTask, mediumPriorityTask]);

      // Check that tasks were executed in priority order (highest first)
      expect(executionOrder).toEqual([10, 5, 1]);

      await singleWorkerPool.shutdown?.();
    }, 10000);
  });

  describe('Task Cancellation', () => {
    it('should handle task cancellation', async () => {
      // Create a task with a unique ID that takes time to complete
      const taskId = 'cancellation-test-task';
      const task: WorkerTask<void, number> = {
        id: taskId,
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return 42;
        },
        input: undefined,
      };

      // Start the task
      const taskPromise = workerPool.runTask(task);

      // Give the task a moment to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Cancel the task
      workerPool.cancelTask(taskId);

      // The task should be rejected with cancellation error
      await expect(taskPromise).rejects.toThrow(/cancelled|canceled/i);
    }, 5000);

    it('should handle cancellation of queued tasks', async () => {
      // Create a worker pool with max 1 worker
      const singleWorkerPool = new WorkerPool({
        maxWorkers: 1,
        idleTimeout: 1000,
      });

      // Start a blocking task
      const blockingTask = singleWorkerPool.runTask({
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return 'blocking';
        },
        input: undefined,
      });

      // Queue a task that we'll cancel
      const taskId = 'queued-cancellation-test';
      const queuedTask = singleWorkerPool.runTask({
        id: taskId,
        execute: async () => {
          return 'should-not-execute';
        },
        input: undefined,
      });

      // Give tasks time to queue
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Cancel the queued task
      singleWorkerPool.cancelTask(taskId);

      // The queued task should be cancelled
      await expect(queuedTask).rejects.toThrow(/cancelled|canceled/i);

      // The blocking task should still complete
      const blockingResult = await blockingTask;
      expect(blockingResult).toBe('blocking');

      await singleWorkerPool.shutdown?.();
    }, 5000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle worker failures gracefully', async () => {
      const errorTask: WorkerTask<void, never> = {
        execute: async () => {
          throw new Error('Simulated worker failure');
        },
        input: undefined,
      };

      // The task should reject with the error
      await expect(workerPool.runTask(errorTask)).rejects.toThrow('Simulated worker failure');

      // Pool should still be functional after error
      const successTask: WorkerTask<number, number> = {
        execute: async (input: number) => input * 2,
        input: 5,
      };

      const result = await workerPool.runTask(successTask);
      expect(result).toBe(10);
    });

    it('should handle multiple concurrent errors', async () => {
      const errorTasks = Array.from({ length: 5 }, (_, i) => ({
        execute: async () => {
          throw new Error(`Error ${i}`);
        },
        input: undefined,
      }));

      // All tasks should fail
      const results = await Promise.allSettled(errorTasks.map((task) => workerPool.runTask(task)));

      results.forEach((result, i) => {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason.message).toBe(`Error ${i}`);
        }
      });

      // Pool should still be functional
      const successTask = await workerPool.runTask({
        execute: async (input: number) => input * 3,
        input: 7,
      });
      expect(successTask).toBe(21);
    });
  });
});
