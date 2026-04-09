// @ts-check
// ─── Sparse Table ──────────────────────────────────────────────────────────
// O(n log n) preprocessing, O(1) idempotent range queries (min, max, gcd).

// ─── SparseTable ────────────────────────────────────────────────────────────

export class SparseTable<T> {
  readonly #table: T[][];
  readonly #log: number[];
  readonly #size: number;
  readonly #combine: (a: T, b: T) => T;

  /**
   * Build a sparse table over `data` with the given idempotent combine function.
   * The combine function must satisfy combine(a, a) === a (idempotent).
   * Typical choices: Math.min, Math.max, gcd.
   *
   * @param data    - source array (must have at least 1 element).
   * @param combine - idempotent associative binary function.
   */
  constructor(data: T[], combine: (a: T, b: T) => T) {
    if (data.length === 0) {
      throw new RangeError('Data must not be empty');
    }
    this.#size = data.length;
    this.#combine = combine;

    // Pre-compute floor(log2) for every length up to n
    const n = data.length;
    this.#log = new Array<number>(n + 1);
    this.#log[0] = 0;
    this.#log[1] = 0;
    for (let i = 2; i <= n; i++) {
      this.#log[i] = this.#log[i >> 1] + 1;
    }

    const maxK = this.#log[n] + 1;
    this.#table = new Array<T[]>(maxK);

    // Level 0: intervals of length 1
    this.#table[0] = data.slice();

    // Build successive levels
    for (let k = 1; k < maxK; k++) {
      const prev = this.#table[k - 1];
      const half = 1 << (k - 1);
      const len = n - (1 << k) + 1;
      const level = new Array<T>(len);
      for (let i = 0; i < len; i++) {
        level[i] = combine(prev[i], prev[i + half]);
      }
      this.#table[k] = level;
    }
  }

  /** Number of elements in the table. */
  get size(): number {
    return this.#size;
  }

  /**
   * Return the combined result for the range [left, right] (inclusive).
   * Runs in O(1) thanks to overlapping intervals.
   *
   * @param left  - zero-based left bound.
   * @param right - zero-based right bound (>= left).
   */
  query(left: number, right: number): T {
    if (left > right) {
      throw new RangeError(`left (${left}) must be <= right (${right})`);
    }
    if (left < 0 || right >= this.#size) {
      throw new RangeError(`Indices [${left}, ${right}] out of bounds [0, ${this.#size - 1}]`);
    }
    const length = right - left + 1;
    const k = this.#log[length];
    return this.#combine(this.#table[k][left], this.#table[k][right - (1 << k) + 1]);
  }
}

// ─── Factories ──────────────────────────────────────────────────────────────

/** Create a SparseTable pre-configured for range minimum queries. */
export function createMinSparseTable(data: number[]): SparseTable<number> {
  return new SparseTable(data, (a, b) => Math.min(a, b));
}

/** Create a SparseTable pre-configured for range maximum queries. */
export function createMaxSparseTable(data: number[]): SparseTable<number> {
  return new SparseTable(data, (a, b) => Math.max(a, b));
}

/** Compute the greatest common divisor of two integers. */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** Create a SparseTable pre-configured for range GCD queries. */
export function createGcdSparseTable(data: number[]): SparseTable<number> {
  return new SparseTable(data, gcd);
}
