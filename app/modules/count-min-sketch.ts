// @ts-check
// ─── Count-Min Sketch ────────────────────────────────────────────────────────
// A probabilistic data structure for estimating the frequency of items in a
// data stream, using sub-linear space. Estimates are always >= true count.

// ─── Public API ──────────────────────────────────────────────────────────────

export class CountMinSketch {
  #table: Int32Array[];
  #width: number;
  #depth: number;

  constructor(width: number, depth: number) {
    if (width <= 0 || !Number.isInteger(width)) {
      throw new RangeError('width must be a positive integer');
    }
    if (depth <= 0 || !Number.isInteger(depth)) {
      throw new RangeError('depth must be a positive integer');
    }

    this.#width = width;
    this.#depth = depth;
    this.#table = [];
    for (let i = 0; i < depth; i++) {
      this.#table.push(new Int32Array(width));
    }
  }

  /** Add an item with the given count (default 1). */
  add(item: string, count = 1): void {
    for (let i = 0; i < this.#depth; i++) {
      const pos = this.#hash(item, i) % this.#width;
      this.#table[i][pos] += count;
    }
  }

  /** Estimate the frequency of an item. Always >= true count. */
  estimate(item: string): number {
    let min = Infinity;
    for (let i = 0; i < this.#depth; i++) {
      const pos = this.#hash(item, i) % this.#width;
      const val = this.#table[i][pos];
      if (val < min) min = val;
    }
    return min;
  }

  /**
   * Merge this sketch with another sketch of the same dimensions.
   * Returns a new CountMinSketch containing the combined counts.
   */
  merge(other: CountMinSketch): CountMinSketch {
    if (other.#width !== this.#width || other.#depth !== this.#depth) {
      throw new Error('Cannot merge sketches with different dimensions');
    }
    const merged = new CountMinSketch(this.#width, this.#depth);
    for (let i = 0; i < this.#depth; i++) {
      for (let j = 0; j < this.#width; j++) {
        merged.#table[i][j] = this.#table[i][j] + other.#table[i][j];
      }
    }
    return merged;
  }

  /** Width of the sketch (number of columns). */
  get width(): number {
    return this.#width;
  }

  /** Depth of the sketch (number of rows / hash functions). */
  get depth(): number {
    return this.#depth;
  }

  /** Clear all counters. */
  clear(): void {
    for (let i = 0; i < this.#depth; i++) {
      this.#table[i].fill(0);
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Double hashing using djb2 and fnv1a variants seeded by index.
   * h(item, i) = (h1(item) + i * h2(item)) mod width
   */
  #hash(item: string, seed: number): number {
    let h1 = 5381;
    let h2 = 2166136261;
    for (let j = 0; j < item.length; j++) {
      const c = item.charCodeAt(j);
      // djb2
      h1 = ((h1 << 5) + h1 + c) >>> 0;
      // fnv1a
      h2 = Math.imul(h2 ^ c, 16777619) >>> 0;
    }
    return (h1 + Math.imul(seed, h2)) >>> 0;
  }
}

// ─── Factories ───────────────────────────────────────────────────────────────

/** Create a new CountMinSketch with explicit dimensions. */
export function createCountMinSketch(width: number, depth: number): CountMinSketch {
  return new CountMinSketch(width, depth);
}

/**
 * Create an optimally-sized CountMinSketch from error parameters.
 * @param epsilon - Error factor (width = ceil(e / epsilon))
 * @param delta   - Probability of exceeding error (depth = ceil(ln(1 / delta)))
 */
export function createOptimalSketch(epsilon: number, delta: number): CountMinSketch {
  if (epsilon <= 0 || epsilon >= 1) {
    throw new RangeError('epsilon must be between 0 and 1 (exclusive)');
  }
  if (delta <= 0 || delta >= 1) {
    throw new RangeError('delta must be between 0 and 1 (exclusive)');
  }
  const width = Math.ceil(Math.E / epsilon);
  const depth = Math.ceil(Math.log(1 / delta));
  return new CountMinSketch(width, depth);
}
