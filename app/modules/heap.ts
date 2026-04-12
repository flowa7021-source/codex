// @ts-check
// ─── Binary Heap & Priority Queue ────────────────────────────────────────────
// MinHeap, MaxHeap, and PriorityQueue implementations using private class fields.

// ─── MinHeap ─────────────────────────────────────────────────────────────────

/**
 * Binary min-heap — the smallest element (per the comparator) is always at the
 * top and returned by `pop()` / `peek()`.
 */
export class MinHeap<T> {
  #data: T[];
  #cmp: (a: T, b: T) => number;

  constructor(comparator?: (a: T, b: T) => number) {
    this.#data = [];
    this.#cmp = comparator ?? ((a, b) => (a as unknown as number) - (b as unknown as number));
  }

  /** Number of elements currently in the heap. */
  get size(): number {
    return this.#data.length;
  }

  /** Returns `true` when the heap contains no elements. */
  isEmpty(): boolean {
    return this.#data.length === 0;
  }

  /** Insert `item` into the heap. */
  push(item: T): void {
    this.#data.push(item);
    this.#bubbleUp(this.#data.length - 1);
  }

  /** Return the smallest element without removing it, or `undefined` if empty. */
  peek(): T | undefined {
    return this.#data[0];
  }

  /** Remove and return the smallest element, or `undefined` if empty. */
  pop(): T | undefined {
    if (this.#data.length === 0) return undefined;
    const top = this.#data[0];
    const last = this.#data.pop()!;
    if (this.#data.length > 0) {
      this.#data[0] = last;
      this.#siftDown(0);
    }
    return top;
  }

  /** Remove all elements. */
  clear(): void {
    this.#data = [];
  }

  /** Return a shallow copy of the internal array (heap order, not sorted). */
  toArray(): T[] {
    return this.#data.slice();
  }

  /**
   * Return all elements sorted smallest-first.  Non-destructive — the heap is
   * left intact.
   */
  toSortedArray(): T[] {
    const copy = new MinHeap<T>(this.#cmp);
    copy.#data = this.#data.slice();
    const result: T[] = [];
    while (!copy.isEmpty()) {
      result.push(copy.pop()!);
    }
    return result;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  #bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#cmp(this.#data[index], this.#data[parent]) < 0) {
        const tmp = this.#data[index];
        this.#data[index] = this.#data[parent];
        this.#data[parent] = tmp;
        index = parent;
      } else {
        break;
      }
    }
  }

  #siftDown(index: number): void {
    const n = this.#data.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < n && this.#cmp(this.#data[left], this.#data[smallest]) < 0) {
        smallest = left;
      }
      if (right < n && this.#cmp(this.#data[right], this.#data[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== index) {
        const tmp = this.#data[index];
        this.#data[index] = this.#data[smallest];
        this.#data[smallest] = tmp;
        index = smallest;
      } else {
        break;
      }
    }
  }
}

// ─── MaxHeap ─────────────────────────────────────────────────────────────────

/**
 * Binary max-heap — the largest element (per the comparator) is always at the
 * top and returned by `pop()` / `peek()`.
 */
export class MaxHeap<T> {
  #inner: MinHeap<T>;

  constructor(comparator?: (a: T, b: T) => number) {
    // Invert the comparator so the min-heap acts as a max-heap.
    const cmp = comparator ?? ((a, b) => (a as unknown as number) - (b as unknown as number));
    this.#inner = new MinHeap<T>((a, b) => cmp(b, a));
  }

  /** Number of elements currently in the heap. */
  get size(): number {
    return this.#inner.size;
  }

  /** Returns `true` when the heap contains no elements. */
  isEmpty(): boolean {
    return this.#inner.isEmpty();
  }

  /** Insert `item` into the heap. */
  push(item: T): void {
    this.#inner.push(item);
  }

  /** Return the largest element without removing it, or `undefined` if empty. */
  peek(): T | undefined {
    return this.#inner.peek();
  }

  /** Remove and return the largest element, or `undefined` if empty. */
  pop(): T | undefined {
    return this.#inner.pop();
  }

  /** Remove all elements. */
  clear(): void {
    this.#inner.clear();
  }

  /** Return a shallow copy of the internal array (heap order, not sorted). */
  toArray(): T[] {
    return this.#inner.toArray();
  }

  /**
   * Return all elements sorted largest-first.  Non-destructive — the heap is
   * left intact.
   */
  toSortedArray(): T[] {
    // The inner MinHeap uses an inverted comparator, so draining it
    // smallest-first (by the inverted ordering) yields largest-first in the
    // original ordering — which is exactly what MaxHeap.toSortedArray should do.
    return this.#inner.toSortedArray();
  }
}

// ─── PriorityQueue ───────────────────────────────────────────────────────────

interface PQEntry<T> {
  item: T;
  priority: number;
}

/**
 * Priority queue backed by a min-heap.  Lower `priority` numbers are dequeued
 * first (i.e. priority 0 comes before priority 10).
 */
export class PriorityQueue<T> {
  #heap: MinHeap<PQEntry<T>>;

  constructor() {
    this.#heap = new MinHeap<PQEntry<T>>((a, b) => a.priority - b.priority);
  }

  /** Number of items in the queue. */
  get size(): number {
    return this.#heap.size;
  }

  /** Returns `true` when the queue is empty. */
  isEmpty(): boolean {
    return this.#heap.isEmpty();
  }

  /** Add `item` with the given `priority`.  Lower numbers = higher priority. */
  enqueue(item: T, priority: number): void {
    this.#heap.push({ item, priority });
  }

  /**
   * Remove and return the highest-priority item (lowest priority number), or
   * `undefined` if the queue is empty.
   */
  dequeue(): T | undefined {
    const entry = this.#heap.pop();
    return entry?.item;
  }

  /**
   * Return the highest-priority item without removing it, or `undefined` if
   * empty.
   */
  peek(): T | undefined {
    return this.#heap.peek()?.item;
  }

  /** Remove all items. */
  clear(): void {
    this.#heap.clear();
  }

  /**
   * Return `true` if `item` is present in the queue (O(n) linear scan using
   * `===` equality).
   */
  contains(item: T): boolean {
    for (const entry of this.#heap.toArray()) {
      if (entry.item === item) return true;
    }
    return false;
  }

  /**
   * Update the priority of the first entry whose `item === item`.  If the item
   * is not found, this is a no-op.  O(n) rebuild.
   */
  changePriority(item: T, newPriority: number): void {
    const entries = this.#heap.toArray();
    let found = false;
    const updated = entries.map(e => {
      if (!found && e.item === item) {
        found = true;
        return { item: e.item, priority: newPriority };
      }
      return e;
    });
    if (!found) return;
    this.#heap.clear();
    for (const entry of updated) {
      this.#heap.push(entry);
    }
  }
}

// ─── Factory functions ────────────────────────────────────────────────────────

/** Create a new `MinHeap` with an optional comparator. */
export function createMinHeap<T>(comparator?: (a: T, b: T) => number): MinHeap<T> {
  return new MinHeap<T>(comparator);
}

/** Create a new `MaxHeap` with an optional comparator. */
export function createMaxHeap<T>(comparator?: (a: T, b: T) => number): MaxHeap<T> {
  return new MaxHeap<T>(comparator);
}

/** Create a new `PriorityQueue`. */
export function createPriorityQueue<T>(): PriorityQueue<T> {
  return new PriorityQueue<T>();
}

// ─── heapSort ────────────────────────────────────────────────────────────────

/**
 * Sort `arr` in ascending order in-place using a max-heap, then return it.
 */
export function heapSort(arr: number[]): number[] {
  const n = arr.length;

  // Build max-heap in-place.
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    siftDownInPlace(arr, n, i);
  }

  // Extract elements from the heap one at a time.
  for (let end = n - 1; end > 0; end--) {
    // Swap root (largest) with last element.
    const tmp = arr[0];
    arr[0] = arr[end];
    arr[end] = tmp;
    siftDownInPlace(arr, end, 0);
  }

  return arr;
}

function siftDownInPlace(arr: number[], heapSize: number, index: number): void {
  while (true) {
    let largest = index;
    const left = 2 * index + 1;
    const right = 2 * index + 2;

    if (left < heapSize && arr[left] > arr[largest]) {
      largest = left;
    }
    if (right < heapSize && arr[right] > arr[largest]) {
      largest = right;
    }

    if (largest !== index) {
      const tmp = arr[index];
      arr[index] = arr[largest];
      arr[largest] = tmp;
      index = largest;
    } else {
      break;
    }
  }
}
