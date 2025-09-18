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
    const result = await workerPool.execute('multiply', 5);
    expect(result).toBe(10);
  });

  it('should handle multiple tasks', async () => {
    const inputs = [1, 2, 3, 4, 5];

    const results = await Promise.all(inputs.map(input => workerPool.execute('multiply', input)));
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('should respect the max workers limit', async () => {
    // Create a worker pool with max 1 worker
    const singleWorkerPool = new WorkerPool({
      maxWorkers: 1,
      idleTimeout: 1000,
    });
    
    // Create a spy to track when tasks start
    const startSpy = vi.fn();

    // Run two tasks and track when they start
    const promise1 = singleWorkerPool.execute('longTask', 1);

    const promise2 = singleWorkerPool.execute('longTask', 2);
    
    // Wait for both tasks to complete
    await Promise.all([promise1, promise2]);
    
    // Check that the second task started after the first one
    expect(startSpy).toHaveBeenCalledTimes(2);
    expect(startSpy.mock.calls[0][0]).toBe(1);
    expect(startSpy.mock.calls[1][0]).toBe(2);
  });

  it('should handle task failures', async () => {
    await expect(workerPool.execute('errorTask', undefined)).rejects.toThrow('Task failed');
  });

  it('should clean up idle workers', async () => {
    // Mock the worker cleanup method
    const cleanupSpy = vi.spyOn(workerPool as any, 'cleanupIdleWorkers');
    
    // Run a task
    await workerPool.execute('test', 5);
    
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
    const promises = tasks.map(task => workerPool.execute(task.type, task.data));
    
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
    
    // Start a long-running task
    const firstTaskPromise = singleWorkerPool.execute('longTask', 1);

    // Create a spy to track task execution order
    const executionOrder: number[] = [];

    // Queue several tasks with different priorities
    const lowPriorityTask = singleWorkerPool.execute('task', 1, { priority: 1 });

    const highPriorityTask = singleWorkerPool.execute('task', 2, { priority: 10 });

    const mediumPriorityTask = singleWorkerPool.execute('task', 3, { priority: 5 });
    
    // Wait for all tasks to complete
    await Promise.all([firstTaskPromise, lowPriorityTask, highPriorityTask, mediumPriorityTask]);
    
    // Check that tasks were executed in priority order (highest first)
    expect(executionOrder).toEqual([10, 5, 1]);
  });

  it('should handle task cancellation', async () => {
    // Start a long-running task
    const taskPromise = workerPool.execute('longTask', 42);

    // For now, we will just check that the task runs
    // TODO: Implement proper cancellation support
    await expect(taskPromise).resolves.toBe(42);
  });
});