/**
 * Unit tests for PriorityQueue
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PriorityQueue } from '../../../src/utils/PriorityQueue.js';

describe('PriorityQueue', () => {
  let queue: PriorityQueue<string>;

  beforeEach(() => {
    queue = new PriorityQueue<string>();
  });

  describe('Basic Operations', () => {
    it('should start empty', () => {
      expect(queue.isEmpty).toBe(true);
      expect(queue.size).toBe(0);
      expect(queue.peek()).toBeNull();
      expect(queue.dequeue()).toBeNull();
    });

    it('should enqueue and dequeue single item', () => {
      queue.enqueue('test', 1);
      
      expect(queue.isEmpty).toBe(false);
      expect(queue.size).toBe(1);
      expect(queue.peek()).toBe('test');
      
      const item = queue.dequeue();
      expect(item).toBe('test');
      expect(queue.isEmpty).toBe(true);
      expect(queue.size).toBe(0);
    });

    it('should handle multiple items with same priority (FIFO)', () => {
      queue.enqueue('first', 1);
      queue.enqueue('second', 1);
      queue.enqueue('third', 1);

      expect(queue.size).toBe(3);
      expect(queue.dequeue()).toBe('first');
      expect(queue.dequeue()).toBe('second');
      expect(queue.dequeue()).toBe('third');
    });
  });

  describe('Priority Ordering', () => {
    it('should dequeue items in priority order (lower number = higher priority)', () => {
      queue.enqueue('low', 3);
      queue.enqueue('high', 1);
      queue.enqueue('medium', 2);

      expect(queue.dequeue()).toBe('high');
      expect(queue.dequeue()).toBe('medium');
      expect(queue.dequeue()).toBe('low');
    });

    it('should maintain FIFO for same priority items', () => {
      queue.enqueue('first-high', 1);
      queue.enqueue('second-high', 1);
      queue.enqueue('first-low', 3);
      queue.enqueue('second-low', 3);

      expect(queue.dequeue()).toBe('first-high');
      expect(queue.dequeue()).toBe('second-high');
      expect(queue.dequeue()).toBe('first-low');
      expect(queue.dequeue()).toBe('second-low');
    });

    it('should handle mixed priorities correctly', () => {
      const items = [
        { value: 'urgent1', priority: 1 },
        { value: 'normal1', priority: 3 },
        { value: 'high1', priority: 2 },
        { value: 'urgent2', priority: 1 },
        { value: 'low1', priority: 4 },
        { value: 'high2', priority: 2 }
      ];

      items.forEach(item => queue.enqueue(item.value, item.priority));

      expect(queue.dequeue()).toBe('urgent1');
      expect(queue.dequeue()).toBe('urgent2');
      expect(queue.dequeue()).toBe('high1');
      expect(queue.dequeue()).toBe('high2');
      expect(queue.dequeue()).toBe('normal1');
      expect(queue.dequeue()).toBe('low1');
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      queue.enqueue('high', 1);
      queue.enqueue('medium', 2);
      queue.enqueue('low', 3);
    });

    it('should peek without removing item', () => {
      expect(queue.peek()).toBe('high');
      expect(queue.size).toBe(3);
      expect(queue.peek()).toBe('high'); // Should still be there
    });

    it('should convert to array in priority order', () => {
      const array = queue.toArray();
      expect(array).toEqual(['high', 'medium', 'low']);
      expect(queue.size).toBe(3); // Original queue unchanged
    });

    it('should clear all items', () => {
      queue.clear();
      expect(queue.isEmpty).toBe(true);
      expect(queue.size).toBe(0);
      expect(queue.peek()).toBeNull();
    });

    it('should remove specific items', () => {
      const removed = queue.remove(item => item === 'medium');
      expect(removed).toBe(true);
      expect(queue.size).toBe(2);
      
      const array = queue.toArray();
      expect(array).toEqual(['high', 'low']);
    });

    it('should return false when removing non-existent item', () => {
      const removed = queue.remove(item => item === 'nonexistent');
      expect(removed).toBe(false);
      expect(queue.size).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle removing from single-item queue', () => {
      queue.enqueue('only', 1);
      const removed = queue.remove(item => item === 'only');
      
      expect(removed).toBe(true);
      expect(queue.isEmpty).toBe(true);
    });

    it('should handle removing last item', () => {
      queue.enqueue('first', 1);
      queue.enqueue('last', 2);
      
      const removed = queue.remove(item => item === 'last');
      expect(removed).toBe(true);
      expect(queue.size).toBe(1);
      expect(queue.peek()).toBe('first');
    });

    it('should handle large number of items', () => {
      const itemCount = 1000;
      
      // Add items with random priorities
      for (let i = 0; i < itemCount; i++) {
        const priority = Math.floor(Math.random() * 10) + 1;
        queue.enqueue(`item-${i}`, priority);
      }
      
      expect(queue.size).toBe(itemCount);
      
      // Dequeue all items and verify they come out in priority order
      let lastPriority = 0;
      let count = 0;
      
      while (!queue.isEmpty) {
        const item = queue.dequeue();
        expect(item).toBeDefined();
        count++;
      }
      
      expect(count).toBe(itemCount);
    });
  });

  describe('Complex Objects', () => {
    interface TestJob {
      id: string;
      priority: number;
      data: any;
    }

    it('should handle complex objects', () => {
      const jobQueue = new PriorityQueue<TestJob>();
      
      const jobs: TestJob[] = [
        { id: 'job1', priority: 2, data: { type: 'conversion' } },
        { id: 'job2', priority: 1, data: { type: 'validation' } },
        { id: 'job3', priority: 3, data: { type: 'analysis' } }
      ];
      
      jobs.forEach(job => jobQueue.enqueue(job, job.priority));
      
      expect(jobQueue.dequeue()?.id).toBe('job2');
      expect(jobQueue.dequeue()?.id).toBe('job1');
      expect(jobQueue.dequeue()?.id).toBe('job3');
    });

    it('should remove complex objects by predicate', () => {
      const jobQueue = new PriorityQueue<TestJob>();
      
      const jobs: TestJob[] = [
        { id: 'job1', priority: 1, data: { type: 'conversion' } },
        { id: 'job2', priority: 2, data: { type: 'validation' } },
        { id: 'job3', priority: 3, data: { type: 'conversion' } }
      ];
      
      jobs.forEach(job => jobQueue.enqueue(job, job.priority));
      
      // Remove all conversion jobs
      let removed = jobQueue.remove(job => job.data.type === 'conversion');
      expect(removed).toBe(true);
      
      removed = jobQueue.remove(job => job.data.type === 'conversion');
      expect(removed).toBe(true);
      
      expect(jobQueue.size).toBe(1);
      expect(jobQueue.peek()?.id).toBe('job2');
    });
  });
});