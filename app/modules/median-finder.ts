// ─── Median Finder ──────────────────────────────────────────────────────────
// @ts-check
// Streaming median and order-statistics utilities for NovaReader.

// ─── Heap helpers (min-heap by default) ─────────────────────────────────────

type Comparator = (a: number, b: number) => number;

function heapPush(heap: number[], value: number, cmp: Comparator): void {
  heap.push(value);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (cmp(heap[i], heap[parent]) < 0) {
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    } else {
      break;
    }
  }
}

function heapPop(heap: number[], cmp: Comparator): number {
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < heap.length && cmp(heap[left], heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < heap.length && cmp(heap[right], heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest !== i) {
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      } else {
        break;
      }
    }
  }
  return top;
}

function heapPeek(heap: number[]): number {
  return heap[0];
}

// ─── MedianFinder class ─────────────────────────────────────────────────────

const minCmp: Comparator = (a, b) => a - b;
const maxCmp: Comparator = (a, b) => b - a;

/**
 * Streaming median finder backed by two heaps.
 *
 * - `lo` is a max-heap holding the smaller half of elements.
 * - `hi` is a min-heap holding the larger half.
 *
 * Invariant: lo.length === hi.length  OR  lo.length === hi.length + 1
 */
export class MedianFinder {
  /** @internal */ private lo: number[] = []; // max-heap
  /** @internal */ private hi: number[] = []; // min-heap
  /** @internal */ private _min: number | null = null;
  /** @internal */ private _max: number | null = null;

  /**
   * Insert a number into the data structure.
   *
   * @param value - The number to add
   */
  add(value: number): void {
    // Update running min / max
    if (this._min === null || value < this._min) this._min = value;
    if (this._max === null || value > this._max) this._max = value;

    // Push into lo (max-heap) first, then rebalance
    heapPush(this.lo, value, maxCmp);

    // Move lo's top to hi so hi always has >= lo's max
    heapPush(this.hi, heapPop(this.lo, maxCmp), minCmp);

    // Keep sizes balanced: lo.length >= hi.length
    if (this.hi.length > this.lo.length) {
      heapPush(this.lo, heapPop(this.hi, minCmp), maxCmp);
    }
  }

  /**
   * Current median of all added values, or null if empty.
   */
  get median(): number | null {
    if (this.lo.length === 0) return null;
    if (this.lo.length > this.hi.length) {
      return heapPeek(this.lo);
    }
    return (heapPeek(this.lo) + heapPeek(this.hi)) / 2;
  }

  /** Number of elements currently stored. */
  get size(): number {
    return this.lo.length + this.hi.length;
  }

  /** Minimum value seen, or null if empty. */
  get min(): number | null {
    return this._min;
  }

  /** Maximum value seen, or null if empty. */
  get max(): number | null {
    return this._max;
  }

  /** Remove all elements. */
  clear(): void {
    this.lo = [];
    this.hi = [];
    this._min = null;
    this._max = null;
  }
}

// ─── One-shot median ────────────────────────────────────────────────────────

/**
 * Compute the median of an array of numbers in one shot.
 * Returns null for an empty array. Does not mutate the input.
 *
 * @param values - Array of numbers
 */
export function findMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

// ─── Quick-select (kth smallest, 1-based) ───────────────────────────────────

/**
 * Find the kth smallest element (1-based) using the quickselect algorithm.
 * Average O(n), worst-case O(n^2). Does not mutate the input.
 *
 * @param values - Array of numbers (must be non-empty)
 * @param k      - 1-based rank (1 = smallest)
 * @throws {RangeError} If k is out of bounds or the array is empty
 */
export function findKth(values: number[], k: number): number {
  if (values.length === 0) {
    throw new RangeError('Cannot select from an empty array');
  }
  if (k < 1 || k > values.length) {
    throw new RangeError(`k=${k} is out of bounds for length ${values.length}`);
  }

  const arr = [...values]; // avoid mutation
  return quickselect(arr, 0, arr.length - 1, k - 1);
}

function quickselect(arr: number[], lo: number, hi: number, k: number): number {
  if (lo === hi) return arr[lo];

  // Use median-of-three pivot for better average behaviour
  const mid = (lo + hi) >> 1;
  if (arr[mid] < arr[lo]) [arr[lo], arr[mid]] = [arr[mid], arr[lo]];
  if (arr[hi] < arr[lo]) [arr[lo], arr[hi]] = [arr[hi], arr[lo]];
  if (arr[mid] < arr[hi]) [arr[mid], arr[hi]] = [arr[hi], arr[mid]];
  const pivot = arr[hi];

  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (arr[j] <= pivot) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      i++;
    }
  }
  [arr[i], arr[hi]] = [arr[hi], arr[i]];

  if (k === i) return arr[i];
  if (k < i) return quickselect(arr, lo, i - 1, k);
  return quickselect(arr, i + 1, hi, k);
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a new MedianFinder instance.
 */
export function createMedianFinder(): MedianFinder {
  return new MedianFinder();
}
