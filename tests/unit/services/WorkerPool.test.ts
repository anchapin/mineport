import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerPool, WorkerTask } from '../../../src/services/WorkerPool';

describe('WorkerPool', () => {
  let workerPool: WorkerPool;

  beforeEach(() => {
    workerPool = new WorkerPool({
      maxWorkers: 2,
      idleTimeout: 1000,
    });
  });

  it('should execute tasks successfully', async () => {
    const task: WorkerTask<number, number> = {
      execute: async (input: number) => input * 2,
      input: 5,
    };
    
    const result = await workerPool.runTask(task);
    expect(result).toBe(10);
  });

  it('should handle multiple tasks', async () => {
    const tasks = [1, 2, 3, 4, 5].map(num => ({
      execute: async (input: number) => input * 2,
      input: num,
    }));
    
    const results = await Promise.all(tasks.map(task => workerPool.runTask(task)));
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('should respect the max workers limit', async () => {
    // Create a worker pool with max 1 worker
    const singleWorkerPool = new WorkerPool({
      maxWorkers: 1,
      idleTimeout: 1000,
    });
    
    // Create a task that takes some time to complete
    const longTask: WorkerTask<void, number> = {
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 1;
      },
      input: undefined,
    };
    
    // Create a spy to track when tasks start
    const startSpy = vi.fn();
    
    // Run two tasks and track when they start
    const promise1 = singleWorkerPool.runTask({
      ...longTask,
      execute: async (input) => {
        startSpy(1);
        return await longTask.execute(input);
      },
    });
    
    const promise2 = singleWorkerPool.runTask({
      ...longTask,
      execute: async (input) => {
        startSpy(2);
        return await longTask.execute(input);
      },
    });
    
    // Wait for both tasks to complete
    await Promise.all([promise1, promise2]);
    
    // Check that the second task started after the first one
    expect(startSpy).toHaveBeenCalledTimes(2);
    expect(startSpy.mock.calls[0][0]).toBe(1);
    expect(startSpy.mock.calls[1][0]).toBe(2);
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

  it('should clean up idle workers', async () => {
    // Mock the worker cleanup method
    const cleanupSpy = vi.spyOn(workerPool as any, 'cleanupIdleWorkers');
    
    // Run a task
    await workerPool.runTask({
      execute: async (input: number) => input * 2,
      input: 5,
    });
    
    // Fast-forward time to trigger cleanup
    vi.advanceTimersByTime(1500);
    
    // Check that cleanup was called
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('should provide worker pool statistics', async () => {
    // Run some tasks
    const tasks = [1, 2, 3].map(num => ({
      execute: async (input: number) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return input * 2;
      },
      input: num,
    }));
    
    // Start the tasks but don't wait for them
    const promises = tasks.map(task => workerPool.runTask(task));
    
    // Check stats while tasks are running
    const stats = workerPool.getStats();
    expect(stats.totalWorkers).toBeGreaterThan(0);
    expect(stats.busyWorkers).toBeGreaterThan(0);
    expect(stats.idleWorkers).toBe(stats.totalWorkers - stats.busyWorkers);
    expect(stats.pendingTasks).toBe(Math.max(0, tasks.length - stats.totalWorkers));
    
    // Wait for all tasks to complete
    await Promise.all(promises);
  });

  it('should prioritize tasks based on priority', async () => {
    // Create a worker pool with max 1 worker
    const singleWorkerPool = new WorkerPool({
      maxWorkers: 1,
      idleTimeout: 1000,
    });
    
    // Create a task that takes some time to complete
    const longTask: WorkerTask<void, number> = {
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 1;
      },
      input: undefined,
    };
    
    // Start a long-running task
    const firstTaskPromise = singleWorkerPool.runTask(longTask);
    
    // Create a spy to track task execution order
    const executionOrder: number[] = [];
    
    // Queue several tasks with different priorities
    const lowPriorityTask = singleWorkerPool.runTask({
      ...longTask,
      execute: async (input) => {
        executionOrder.push(1);
        return await longTask.execute(input);
      },
      priority: 1,
    });
    
    const highPriorityTask = singleWorkerPool.runTask({
      ...longTask,
      execute: async (input) => {
        executionOrder.push(10);
        return await longTask.execute(input);
      },
      priority: 10,
    });
    
    const mediumPriorityTask = singleWorkerPool.runTask({
      ...longTask,
      execute: async (input) => {
        executionOrder.push(5);
        return await longTask.execute(input);
      },
      priority: 5,
    });
    
    // Wait for all tasks to complete
    await Promise.all([firstTaskPromise, lowPriorityTask, highPriorityTask, mediumPriorityTask]);
    
    // Check that tasks were executed in priority order (highest first)
    expect(executionOrder).toEqual([10, 5, 1]);
  });

  it('should handle task cancellation', async () => {
    // Create a task with a unique ID
    const taskId = 'task-123';
    const task: WorkerTask<void, number> = {
      id: taskId,
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 42;
      },
      input: undefined,
    };
    
    // Start the task
    const taskPromise = workerPool.runTask(task);
    
    // Cancel the task
    workerPool.cancelTask(taskId);
    
    // The task should be rejected
    await expect(taskPromise).rejects.toThrow(/cancelled/);
  });
});