// @ts-check
// ─── Priority Queues ──────────────────────────────────────────────────────────
// Min-heap and max-heap priority queues backed by binary heaps, plus a generic
// configurable variant. All classes maintain the heap invariant via sift-up
// and sift-down operations running in O(log n).

// ─── Internal node type ───────────────────────────────────────────────────────

interface HeapNode<T> {
  value: T;
  priority: number;
}

// ─── MinHeap ─────────────────────────────────────────────────────────────────

/**
 * Min-heap priority queue.
 * The item with the *smallest* priority number is returned first by `pop`.
 */
export class MinHeap<T> {
  #heap: HeapNode<T>[];

  constructor() {
    this.#heap = [];
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Add `value` with the given `priority`. O(log n). */
  push(value: T, priority: number): void {
    this.#heap.push({ value, priority });
    this.#siftUp(this.#heap.length - 1);
  }

  /**
   * Remove and return the item with the smallest priority.
   * Returns `undefined` when the heap is empty. O(log n).
   */
  pop(): T | undefined {
    if (this.#heap.length === 0) return undefined;
    const top = this.#heap[0];
    const last = this.#heap.pop()!;
    if (this.#heap.length > 0) {
      this.#heap[0] = last;
      this.#siftDown(0);
    }
    return top.value;
  }

  /**
   * Return the item with the smallest priority without removing it.
   * Returns `undefined` when the heap is empty. O(1).
   */
  peek(): T | undefined {
    return this.#heap.length > 0 ? this.#heap[0].value : undefined;
  }

  /** Number of items currently in the heap. */
  get size(): number {
    return this.#heap.length;
  }

  /** `true` when the heap contains no items. */
  get isEmpty(): boolean {
    return this.#heap.length === 0;
  }

  /**
   * Return all stored values in internal heap order (NOT sorted).
   * The first element is always the current minimum.
   */
  toArray(): T[] {
    return this.#heap.map((n) => n.value);
  }

  // ── Heap maintenance ────────────────────────────────────────────────────────

  #siftUp(index: number): void {
    const heap = this.#heap;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (heap[parent].priority <= heap[index].priority) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  }

  #siftDown(index: number): void {
    const heap = this.#heap;
    const length = heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < length && heap[left].priority < heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && heap[right].priority < heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) break;

      [heap[smallest], heap[index]] = [heap[index], heap[smallest]];
      index = smallest;
    }
  }
}

// ─── MaxHeap ─────────────────────────────────────────────────────────────────

/**
 * Max-heap priority queue.
 * The item with the *largest* priority number is returned first by `pop`.
 */
export class MaxHeap<T> {
  #heap: HeapNode<T>[];

  constructor() {
    this.#heap = [];
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Add `value` with the given `priority`. O(log n). */
  push(value: T, priority: number): void {
    this.#heap.push({ value, priority });
    this.#siftUp(this.#heap.length - 1);
  }

  /**
   * Remove and return the item with the largest priority.
   * Returns `undefined` when the heap is empty. O(log n).
   */
  pop(): T | undefined {
    if (this.#heap.length === 0) return undefined;
    const top = this.#heap[0];
    const last = this.#heap.pop()!;
    if (this.#heap.length > 0) {
      this.#heap[0] = last;
      this.#siftDown(0);
    }
    return top.value;
  }

  /**
   * Return the item with the largest priority without removing it.
   * Returns `undefined` when the heap is empty. O(1).
   */
  peek(): T | undefined {
    return this.#heap.length > 0 ? this.#heap[0].value : undefined;
  }

  /** Number of items currently in the heap. */
  get size(): number {
    return this.#heap.length;
  }

  /** `true` when the heap contains no items. */
  get isEmpty(): boolean {
    return this.#heap.length === 0;
  }

  /**
   * Return all stored values in internal heap order (NOT sorted).
   * The first element is always the current maximum.
   */
  toArray(): T[] {
    return this.#heap.map((n) => n.value);
  }

  // ── Heap maintenance ────────────────────────────────────────────────────────

  #siftUp(index: number): void {
    const heap = this.#heap;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (heap[parent].priority >= heap[index].priority) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  }

  #siftDown(index: number): void {
    const heap = this.#heap;
    const length = heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let largest = index;

      if (left < length && heap[left].priority > heap[largest].priority) {
        largest = left;
      }
      if (right < length && heap[right].priority > heap[largest].priority) {
        largest = right;
      }
      if (largest === index) break;

      [heap[largest], heap[index]] = [heap[index], heap[largest]];
      index = largest;
    }
  }
}

// ─── PriorityQueue ───────────────────────────────────────────────────────────

/**
 * Generic priority queue backed by a min-heap.
 *
 * Items are enqueued with an optional explicit `priority` number.  When no
 * priority is supplied the item itself is cast to a number and used directly.
 *
 * A custom `compareFn` overrides the default numeric priority comparison as a
 * tiebreaker when two items share the same numeric priority: return a negative
 * number when `a` should be dequeued *before* `b`.
 *
 * @example
 *   const pq = new PriorityQueue<string>();
 *   pq.enqueue('urgent', 1);
 *   pq.enqueue('normal', 5);
 *   pq.dequeue(); // 'urgent'
 */
export class PriorityQueue<T> {
  #heap: HeapNode<T>[];
  #compareFn: (a: T, b: T) => number;

  constructor(compareFn?: (a: T, b: T) => number) {
    this.#heap = [];
    this.#compareFn = compareFn ?? ((a, b) => (a as unknown as number) - (b as unknown as number));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Add `item` to the queue with an optional `priority`.
   * When `priority` is omitted the item itself is coerced to a number. O(log n).
   */
  enqueue(item: T, priority?: number): void {
    const p = priority ?? (item as unknown as number);
    this.#heap.push({ value: item, priority: p });
    this.#siftUp(this.#heap.length - 1);
  }

  /**
   * Remove and return the highest-priority item (smallest numeric priority).
   * Returns `undefined` when the queue is empty. O(log n).
   */
  dequeue(): T | undefined {
    if (this.#heap.length === 0) return undefined;
    const top = this.#heap[0];
    const last = this.#heap.pop()!;
    if (this.#heap.length > 0) {
      this.#heap[0] = last;
      this.#siftDown(0);
    }
    return top.value;
  }

  /**
   * Return the highest-priority item without removing it.
   * Returns `undefined` when the queue is empty. O(1).
   */
  peek(): T | undefined {
    return this.#heap.length > 0 ? this.#heap[0].value : undefined;
  }

  /** Number of items in the queue. */
  get size(): number {
    return this.#heap.length;
  }

  /** `true` when the queue is empty. */
  get isEmpty(): boolean {
    return this.#heap.length === 0;
  }

  /**
   * Drain the queue and return all items in priority order (highest priority first).
   * **Destructive** — the queue will be empty after this call. O(n log n).
   */
  toSortedArray(): T[] {
    const result: T[] = [];
    while (!this.isEmpty) {
      result.push(this.dequeue()!);
    }
    return result;
  }

  // ── Heap maintenance ────────────────────────────────────────────────────────

  /** Returns true when heap[a] should sit above heap[b] (i.e. a has higher priority). */
  #less(
    a: HeapNode<T>,
    b: HeapNode<T>,
  ): boolean {
    const diff = a.priority - b.priority;
    if (diff !== 0) return diff < 0;
    return this.#compareFn(a.value, b.value) < 0;
  }

  #siftUp(index: number): void {
    const heap = this.#heap;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.#less(heap[index], heap[parent])) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  }

  #siftDown(index: number): void {
    const heap = this.#heap;
    const length = heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let best = index;

      if (left < length && this.#less(heap[left], heap[best])) {
        best = left;
      }
      if (right < length && this.#less(heap[right], heap[best])) {
        best = right;
      }
      if (best === index) break;

      [heap[best], heap[index]] = [heap[index], heap[best]];
      index = best;
    }
  }
}

// ─── Factories ───────────────────────────────────────────────────────────────

/** Create a new empty `MinHeap`. */
export function createMinHeap<T>(): MinHeap<T> {
  return new MinHeap<T>();
}

/** Create a new empty `MaxHeap`. */
export function createMaxHeap<T>(): MaxHeap<T> {
  return new MaxHeap<T>();
}
