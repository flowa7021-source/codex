// @ts-check
// ─── Priority Queue ──────────────────────────────────────────────────────────
// High-level priority queue backed by a binary min-heap. Supports custom
// comparators, arbitrary item types, and O(log n) enqueue / dequeue.

// ─── Internal heap helpers ───────────────────────────────────────────────────

function defaultComparator<T>(a: T, b: T): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function bubbleUp<T>(data: T[], cmp: (a: T, b: T) => number, i: number): void {
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (cmp(data[i], data[parent]) < 0) {
      [data[i], data[parent]] = [data[parent], data[i]];
      i = parent;
    } else {
      break;
    }
  }
}

function siftDown<T>(data: T[], cmp: (a: T, b: T) => number, i: number): void {
  const n = data.length;
  while (true) {
    let top = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < n && cmp(data[left], data[top]) < 0) top = left;
    if (right < n && cmp(data[right], data[top]) < 0) top = right;
    if (top === i) break;
    [data[i], data[top]] = [data[top], data[i]];
    i = top;
  }
}

// ─── PriorityQueue ───────────────────────────────────────────────────────────

/**
 * Generic priority queue backed by a binary min-heap.
 *
 * @example
 *   const pq = new PriorityQueue<number>();
 *   pq.enqueue(5); pq.enqueue(1); pq.enqueue(3);
 *   pq.dequeue(); // 1
 */
export class PriorityQueue<T> {
  #data: T[];
  #cmp: (a: T, b: T) => number;

  /**
   * @param comparator - Returns negative if a has higher priority than b.
   *   Default: min-heap (lower numbers = higher priority).
   */
  constructor(comparator: (a: T, b: T) => number = defaultComparator) {
    this.#data = [];
    this.#cmp = comparator;
  }

  /** Add an item. O(log n). */
  enqueue(item: T): void {
    this.#data.push(item);
    bubbleUp(this.#data, this.#cmp, this.#data.length - 1);
  }

  /** Remove and return highest-priority item. O(log n). */
  dequeue(): T | undefined {
    if (this.#data.length === 0) return undefined;
    const top = this.#data[0];
    const last = this.#data.pop()!;
    if (this.#data.length > 0) {
      this.#data[0] = last;
      siftDown(this.#data, this.#cmp, 0);
    }
    return top;
  }

  /** Peek at highest-priority item without removing. O(1). */
  peek(): T | undefined {
    return this.#data[0];
  }

  /** Number of items. */
  get size(): number {
    return this.#data.length;
  }

  /** Check if empty. */
  get isEmpty(): boolean {
    return this.#data.length === 0;
  }

  /**
   * Convert to sorted array (does not modify queue).
   * Items are returned in priority order (highest-priority first).
   */
  toArray(): T[] {
    // Drain a copy so we don't mutate this queue
    const copy = new PriorityQueue<T>(this.#cmp);
    copy.#data = [...this.#data];
    const result: T[] = [];
    while (!copy.isEmpty) {
      result.push(copy.dequeue()!);
    }
    return result;
  }

  /** Clear all items. */
  clear(): void {
    this.#data = [];
  }

  /** Check if an item exists (uses === equality). */
  has(item: T): boolean {
    return this.#data.includes(item);
  }

  /**
   * Remove a specific item. O(n) scan + O(log n) heap repair.
   * Returns true if the item was found and removed.
   */
  remove(item: T): boolean {
    const idx = this.#data.indexOf(item);
    if (idx === -1) return false;

    const last = this.#data.pop()!;
    if (idx < this.#data.length) {
      this.#data[idx] = last;
      // The replacement could be either smaller or larger — try both directions
      bubbleUp(this.#data, this.#cmp, idx);
      siftDown(this.#data, this.#cmp, idx);
    }
    return true;
  }

  /** Build a PriorityQueue from an array. O(n). */
  static from<T>(
    items: T[],
    comparator: (a: T, b: T) => number = defaultComparator,
  ): PriorityQueue<T> {
    const pq = new PriorityQueue<T>(comparator);
    pq.#data = [...items];
    // Heapify: start from last non-leaf and sift down
    for (let i = Math.floor(pq.#data.length / 2) - 1; i >= 0; i--) {
      siftDown(pq.#data, pq.#cmp, i);
    }
    return pq;
  }
}

// ─── Convenience subclasses ──────────────────────────────────────────────────

/** Max-heap wrapper: higher numbers (or lexicographically later strings) come out first. */
export class MaxPriorityQueue<T extends number | string> extends PriorityQueue<T> {
  constructor() {
    super((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }
}

/** Min-heap (default): lower numbers (or lexicographically earlier strings) come out first. */
export class MinPriorityQueue<T extends number | string> extends PriorityQueue<T> {
  constructor() {
    super();
  }
}
