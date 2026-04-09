// @ts-check
// ─── Binary Heap ─────────────────────────────────────────────────────────────
// Low-level min-heap and max-heap implementations, plus heap sort and k-element
// selection utilities.

// ─── Internal helpers ────────────────────────────────────────────────────────

function defaultComparator<T>(a: T, b: T): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Shared heap data structure used by both MinHeap and MaxHeap. */
class BinaryHeap<T> {
  #data: T[];
  #cmp: (a: T, b: T) => number;

  constructor(cmp: (a: T, b: T) => number) {
    this.#data = [];
    this.#cmp = cmp;
  }

  get size(): number {
    return this.#data.length;
  }

  get isEmpty(): boolean {
    return this.#data.length === 0;
  }

  peek(): T | undefined {
    return this.#data[0];
  }

  push(value: T): void {
    this.#data.push(value);
    this.#bubbleUp(this.#data.length - 1);
  }

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

  clear(): void {
    this.#data = [];
  }

  /** Returns a shallow copy of the internal heap array (unsorted). */
  toArray(): T[] {
    return [...this.#data];
  }

  /** Build a heap from an existing array in O(n). */
  buildFrom(arr: T[]): void {
    this.#data = [...arr];
    // Start from the last non-leaf node and sift down
    for (let i = Math.floor(this.#data.length / 2) - 1; i >= 0; i--) {
      this.#siftDown(i);
    }
  }

  #bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.#cmp(this.#data[i], this.#data[parent]) < 0) {
        [this.#data[i], this.#data[parent]] = [this.#data[parent], this.#data[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  #siftDown(i: number): void {
    const n = this.#data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.#cmp(this.#data[left], this.#data[smallest]) < 0) {
        smallest = left;
      }
      if (right < n && this.#cmp(this.#data[right], this.#data[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.#data[i], this.#data[smallest]] = [this.#data[smallest], this.#data[i]];
      i = smallest;
    }
  }
}

// ─── MinHeap ─────────────────────────────────────────────────────────────────

/** Min-heap: parent is always <= children. */
export class MinHeap<T = number> {
  #heap: BinaryHeap<T>;

  constructor(comparator: (a: T, b: T) => number = defaultComparator) {
    this.#heap = new BinaryHeap<T>(comparator);
  }

  push(value: T): void {
    this.#heap.push(value);
  }

  pop(): T | undefined {
    return this.#heap.pop();
  }

  peek(): T | undefined {
    return this.#heap.peek();
  }

  get size(): number {
    return this.#heap.size;
  }

  get isEmpty(): boolean {
    return this.#heap.isEmpty;
  }

  clear(): void {
    this.#heap.clear();
  }

  /** Returns the internal heap array (unsorted). */
  toArray(): T[] {
    return this.#heap.toArray();
  }

  /** Heapify an array in-place. Returns a new MinHeap. */
  static heapify<T>(arr: T[], comparator: (a: T, b: T) => number = defaultComparator): MinHeap<T> {
    const h = new MinHeap<T>(comparator);
    h.#heap.buildFrom(arr);
    return h;
  }
}

// ─── MaxHeap ─────────────────────────────────────────────────────────────────

/** Max-heap: parent is always >= children. */
export class MaxHeap<T = number> {
  #heap: BinaryHeap<T>;

  constructor(comparator: (a: T, b: T) => number = defaultComparator) {
    // Invert comparator so the largest element is at the root
    this.#heap = new BinaryHeap<T>((a, b) => comparator(b, a));
  }

  push(value: T): void {
    this.#heap.push(value);
  }

  pop(): T | undefined {
    return this.#heap.pop();
  }

  peek(): T | undefined {
    return this.#heap.peek();
  }

  get size(): number {
    return this.#heap.size;
  }

  get isEmpty(): boolean {
    return this.#heap.isEmpty;
  }

  clear(): void {
    this.#heap.clear();
  }

  /** Returns the internal heap array (unsorted). */
  toArray(): T[] {
    return this.#heap.toArray();
  }

  /** Heapify an array in-place. Returns a new MaxHeap. */
  static heapify<T>(arr: T[], comparator: (a: T, b: T) => number = defaultComparator): MaxHeap<T> {
    const h = new MaxHeap<T>(comparator);
    h.#heap.buildFrom(arr);
    return h;
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Heap sort: sort an array using a min-heap. O(n log n).
 * Returns a new sorted array (ascending by default).
 */
export function heapSort<T>(arr: T[], comparator: (a: T, b: T) => number = defaultComparator): T[] {
  const h = MinHeap.heapify(arr, comparator);
  const result: T[] = [];
  while (!h.isEmpty) {
    result.push(h.pop()!);
  }
  return result;
}

/**
 * Find the K smallest elements in O(n log k).
 * Returns them in ascending order.
 */
export function kSmallest<T>(
  arr: T[],
  k: number,
  comparator: (a: T, b: T) => number = defaultComparator,
): T[] {
  if (k <= 0) return [];
  if (k >= arr.length) return heapSort(arr, comparator);

  // Use a max-heap of size k: keep the k smallest seen so far
  const maxHeap = new MaxHeap<T>(comparator);
  for (const item of arr) {
    maxHeap.push(item);
    if (maxHeap.size > k) {
      maxHeap.pop(); // evict the largest
    }
  }

  // Drain max-heap and reverse to get ascending order
  const result: T[] = [];
  while (!maxHeap.isEmpty) {
    result.push(maxHeap.pop()!);
  }
  return result.reverse();
}

/**
 * Find the K largest elements in O(n log k).
 * Returns them in descending order.
 */
export function kLargest<T>(
  arr: T[],
  k: number,
  comparator: (a: T, b: T) => number = defaultComparator,
): T[] {
  if (k <= 0) return [];
  if (k >= arr.length) return heapSort(arr, comparator).reverse();

  // Use a min-heap of size k: keep the k largest seen so far
  const minHeap = new MinHeap<T>(comparator);
  for (const item of arr) {
    minHeap.push(item);
    if (minHeap.size > k) {
      minHeap.pop(); // evict the smallest
    }
  }

  // Drain min-heap and reverse to get descending order
  const result: T[] = [];
  while (!minHeap.isEmpty) {
    result.push(minHeap.pop()!);
  }
  return result.reverse();
}
