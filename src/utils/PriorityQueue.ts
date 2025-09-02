/**
 * Priority Queue implementation for job scheduling
 * 
 * A min-heap based priority queue where lower priority numbers indicate higher priority.
 * Items with the same priority are processed in FIFO order.
 */

export interface PriorityQueueItem<T> {
  item: T;
  priority: number;
  insertedAt: Date;
  sequence: number;
}

/**
 * Priority queue implementation using a binary heap for efficient priority-based operations
 */
export class PriorityQueue<T> {
  private heap: PriorityQueueItem<T>[] = [];
  private _size = 0;
  private sequenceCounter = 0;

  /**
   * Create a new priority queue
   * @param compareFn - Optional custom comparison function for items (currently unused)
   */
  constructor(private compareFn?: (a: T, b: T) => number) {}

  /**
   * Get the current number of items in the queue
   * @returns Number of items in the queue
   */
  get size(): number {
    return this._size;
  }

  /**
   * Check if the queue is empty
   * @returns True if the queue has no items, false otherwise
   */
  get isEmpty(): boolean {
    return this._size === 0;
  }

  /**
   * Add an item to the priority queue with the specified priority
   * @param item - The item to add to the queue
   * @param priority - Priority value (lower numbers = higher priority)
   * @returns void
   * @example
   * ```typescript
   * queue.enqueue('high priority task', 1);
   * queue.enqueue('low priority task', 10);
   * ```
   */
  enqueue(item: T, priority: number): void {
    const queueItem: PriorityQueueItem<T> = {
      item,
      priority,
      insertedAt: new Date(),
      sequence: this.sequenceCounter++,
    };

    this.heap.push(queueItem);
    this._size++;
    this.heapifyUp(this._size - 1);
  }

  /**
   * Remove and return the highest priority item from the queue
   * @returns The highest priority item, or null if queue is empty
   * @example
   * ```typescript
   * const nextTask = queue.dequeue();
   * if (nextTask) {
   *   console.log('Processing:', nextTask);
   * }
   * ```
   */
  dequeue(): T | null {
    if (this.isEmpty) {
      return null;
    }

    const root = this.heap[0];
    const last = this.heap.pop()!;
    this._size--;

    if (this._size > 0) {
      this.heap[0] = last;
      this.heapifyDown(0);
    }

    return root.item;
  }

  /**
   * Get the highest priority item without removing it from the queue
   * @returns The highest priority item, or null if queue is empty
   * @example
   * ```typescript
   * const nextTask = queue.peek();
   * console.log('Next task to process:', nextTask);
   * ```
   */
  peek(): T | null {
    return this.isEmpty ? null : this.heap[0].item;
  }

  /**
   * Remove all items from the queue
   * @returns void
   * @example
   * ```typescript
   * queue.clear();
   * console.log('Queue size:', queue.size); // 0
   * ```
   */
  clear(): void {
    this.heap = [];
    this._size = 0;
    this.sequenceCounter = 0;
  }

  /**
   * Convert the queue to an array sorted by priority
   * @returns Array of items sorted by priority (highest priority first)
   * @example
   * ```typescript
   * const allTasks = queue.toArray();
   * console.log('All tasks in priority order:', allTasks);
   * ```
   */
  toArray(): T[] {
    return this.heap.sort((a, b) => this.compare(a, b)).map((item) => item.item);
  }

  /**
   * Remove the first item that matches the predicate function
   * @param predicate - Function to test each item for removal
   * @returns True if an item was removed, false if no matching item found
   * @example
   * ```typescript
   * const removed = queue.remove(task => task.id === 'task-123');
   * console.log('Task removed:', removed);
   * ```
   */
  remove(predicate: (item: T) => boolean): boolean {
    const index = this.heap.findIndex((queueItem) => predicate(queueItem.item));

    if (index === -1) {
      return false;
    }

    const last = this.heap.pop()!;
    this._size--;

    if (index < this._size) {
      this.heap[index] = last;
      this.heapifyUp(index);
      this.heapifyDown(index);
    }

    return true;
  }

  /**
   * Restore heap property by moving an item up the heap
   * @param index - Index of the item to move up
   * @returns void
   */
  private heapifyUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) {
        break;
      }

      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  /**
   * Restore heap property by moving an item down the heap
   * @param index - Index of the item to move down
   * @returns void
   */
  private heapifyDown(index: number): void {
    let currentIndex = index;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let minIndex = currentIndex;
      const leftChild = 2 * currentIndex + 1;
      const rightChild = 2 * currentIndex + 2;

      if (leftChild < this._size && this.compare(this.heap[leftChild], this.heap[minIndex]) < 0) {
        minIndex = leftChild;
      }

      if (rightChild < this._size && this.compare(this.heap[rightChild], this.heap[minIndex]) < 0) {
        minIndex = rightChild;
      }

      if (minIndex === currentIndex) {
        break;
      }

      this.swap(currentIndex, minIndex);
      currentIndex = minIndex;
    }
  }

  /**
   * Compare two priority queue items for ordering
   * @param a - First item to compare
   * @param b - Second item to compare
   * @returns Negative if a has higher priority, positive if b has higher priority, 0 if equal
   */
  private compare(a: PriorityQueueItem<T>, b: PriorityQueueItem<T>): number {
    // Higher priority (lower number) comes first
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    // If priorities are equal, use FIFO (earlier sequence number comes first)
    return a.sequence - b.sequence;
  }

  /**
   * Swap two items in the heap array
   * @param i - Index of first item
   * @param j - Index of second item
   * @returns void
   */
  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
}
