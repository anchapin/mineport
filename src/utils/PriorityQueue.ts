/**
 * Priority Queue implementation for job scheduling
 */

export interface PriorityQueueItem<T> {
  item: T;
  priority: number;
  insertedAt: Date;
  sequence: number;
}

export class PriorityQueue<T> {
  private heap: PriorityQueueItem<T>[] = [];
  private _size = 0;
  private sequenceCounter = 0;

  constructor(private compareFn?: (a: T, b: T) => number) {}

  get size(): number {
    return this._size;
  }

  get isEmpty(): boolean {
    return this._size === 0;
  }

  enqueue(item: T, priority: number): void {
    const queueItem: PriorityQueueItem<T> = {
      item,
      priority,
      insertedAt: new Date(),
      sequence: this.sequenceCounter++
    };

    this.heap.push(queueItem);
    this._size++;
    this.heapifyUp(this._size - 1);
  }

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

  peek(): T | null {
    return this.isEmpty ? null : this.heap[0].item;
  }

  clear(): void {
    this.heap = [];
    this._size = 0;
    this.sequenceCounter = 0;
  }

  toArray(): T[] {
    return this.heap
      .sort((a, b) => this.compare(a, b))
      .map(item => item.item);
  }

  remove(predicate: (item: T) => boolean): boolean {
    const index = this.heap.findIndex(queueItem => predicate(queueItem.item));
    
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

  private heapifyDown(index: number): void {
    while (true) {
      let minIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < this._size && 
          this.compare(this.heap[leftChild], this.heap[minIndex]) < 0) {
        minIndex = leftChild;
      }

      if (rightChild < this._size && 
          this.compare(this.heap[rightChild], this.heap[minIndex]) < 0) {
        minIndex = rightChild;
      }

      if (minIndex === index) {
        break;
      }

      this.swap(index, minIndex);
      index = minIndex;
    }
  }

  private compare(a: PriorityQueueItem<T>, b: PriorityQueueItem<T>): number {
    // Higher priority (lower number) comes first
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    // If priorities are equal, use FIFO (earlier sequence number comes first)
    return a.sequence - b.sequence;
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
}