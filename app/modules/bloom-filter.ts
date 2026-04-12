// @ts-check
// ─── Bloom Filter ────────────────────────────────────────────────────────────
// A probabilistic data structure for membership testing.
// May return false positives, but never false negatives.

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash variant with a seed offset mixed into the basis.
 * Returns a non-negative 32-bit integer.
 */
function fnv1a(str: string, seed: number): number {
  // Mix seed into the FNV-1a offset basis (2166136261 = 0x811c9dc5).
  let h = (2166136261 ^ (seed * 0x9e3779b9)) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Compute optimal bit-array size from expected item count and desired FP rate.
 * Formula: m = -n * ln(p) / (ln 2)^2
 */
function optimalSize(expectedItems: number, falsePositiveRate: number): number {
  const ln2 = Math.LN2;
  return Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / (ln2 * ln2));
}

/**
 * Compute optimal number of hash functions.
 * Formula: k = (m / n) * ln 2
 */
function optimalHashCount(size: number, expectedItems: number): number {
  return Math.max(1, Math.round((size / expectedItems) * Math.LN2));
}

// ─── BloomFilter ──────────────────────────────────────────────────────────────

/**
 * Classic Bloom filter backed by a flat Uint8Array of 0/1 entries.
 *
 * Never produces false negatives; may produce false positives.
 * The false-positive rate depends on `size`, `hashCount`, and the number of
 * items added.
 */
export class BloomFilter {
  /** Flat bit array (one byte per logical bit for easy serialization). */
  #bits: Uint8Array;
  /** Number of logical bits in the filter. */
  #size: number;
  /** Number of independent hash functions. */
  #hashCount: number;
  /** Number of bits currently set to 1. */
  #bitCount: number;

  constructor(options?: { size?: number; hashFunctions?: number }) {
    this.#size = options?.size ?? 1024;
    this.#hashCount = options?.hashFunctions ?? 3;
    if (this.#size < 1) throw new RangeError('size must be >= 1');
    if (this.#hashCount < 1) throw new RangeError('hashFunctions must be >= 1');
    this.#bits = new Uint8Array(this.#size);
    this.#bitCount = 0;
  }

  // ── Public getters ──────────────────────────────────────────────────────────

  /** Bit array size. */
  get size(): number {
    return this.#size;
  }

  /** Number of hash functions. */
  get hashCount(): number {
    return this.#hashCount;
  }

  /** Number of bits currently set to 1. */
  get bitCount(): number {
    return this.#bitCount;
  }

  /** Approximate fill ratio: bitCount / size. */
  get fillRatio(): number {
    return this.#bitCount / this.#size;
  }

  // ── Core operations ─────────────────────────────────────────────────────────

  /** Add an item to the filter. */
  add(item: string): void {
    for (let i = 0; i < this.#hashCount; i++) {
      const index = fnv1a(item, i) % this.#size;
      if (this.#bits[index] === 0) {
        this.#bits[index] = 1;
        this.#bitCount++;
      }
    }
  }

  /**
   * Test whether an item may be in the filter.
   * Returns `false`  → item is definitely NOT in the filter.
   * Returns `true`   → item is probably in the filter (false positive possible).
   */
  has(item: string): boolean {
    for (let i = 0; i < this.#hashCount; i++) {
      const index = fnv1a(item, i) % this.#size;
      if (this.#bits[index] === 0) return false;
    }
    return true;
  }

  /** Reset the filter to an empty state. */
  clear(): void {
    this.#bits.fill(0);
    this.#bitCount = 0;
  }

  // ── Estimation ──────────────────────────────────────────────────────────────

  /**
   * Estimate the current false-positive probability.
   *
   * We first estimate the number of inserted items from the observed fill
   * ratio using the formula:  n̂ ≈ -(m / k) · ln(1 - bitCount / m)
   * then plug n̂ back into the standard FP formula: (1 - e^(-k·n̂/m))^k
   */
  estimateFalsePositiveRate(): number {
    if (this.#bitCount === 0) return 0;
    const k = this.#hashCount;
    const m = this.#size;
    const ratio = this.#bitCount / m;
    if (ratio >= 1) return 1;
    const estimatedN = (-m / k) * Math.log(1 - ratio);
    const inner = 1 - Math.exp((-k * estimatedN) / m);
    return Math.pow(inner, k);
  }

  // ── Merge ────────────────────────────────────────────────────────────────────

  /**
   * Merge another BloomFilter into this one via bitwise OR.
   * Both filters must have identical size and hashCount.
   * Throws a `RangeError` if the parameters differ.
   */
  merge(other: BloomFilter): void {
    if (other.#size !== this.#size || other.#hashCount !== this.#hashCount) {
      throw new RangeError(
        `Cannot merge filters with different parameters: ` +
          `this(size=${this.#size}, hashCount=${this.#hashCount}) vs ` +
          `other(size=${other.#size}, hashCount=${other.#hashCount})`,
      );
    }
    for (let i = 0; i < this.#size; i++) {
      if (other.#bits[i] === 1 && this.#bits[i] === 0) {
        this.#bits[i] = 1;
        this.#bitCount++;
      }
    }
  }

  // ── Serialization ────────────────────────────────────────────────────────────

  /** Serialize the filter to a plain array of 0/1 numbers. */
  toBitArray(): number[] {
    return Array.from(this.#bits);
  }

  /**
   * Restore a BloomFilter from a serialized bit array.
   * The array length becomes the filter's `size`.
   *
   * @param bits          Array of 0/1 values (non-zero treated as 1).
   * @param hashFunctions Number of hash functions to use (default 3).
   */
  static fromBitArray(bits: number[], hashFunctions?: number): BloomFilter {
    const filter = new BloomFilter({ size: bits.length, hashFunctions });
    let count = 0;
    for (let i = 0; i < bits.length; i++) {
      const bit = bits[i] ? 1 : 0;
      filter.#bits[i] = bit;
      if (bit === 1) count++;
    }
    filter.#bitCount = count;
    return filter;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a BloomFilter with size and hashCount computed to satisfy the given
 * `expectedItems` count and `falsePositiveRate` target.
 *
 * Optimal size:       m = -n · ln(p) / (ln 2)²
 * Optimal hash count: k = (m / n) · ln 2
 *
 * @param expectedItems     Expected number of distinct items to store (default 100).
 * @param falsePositiveRate Desired false-positive probability, e.g. 0.01 (default).
 */
export function createBloomFilter(
  expectedItems: number = 100,
  falsePositiveRate: number = 0.01,
): BloomFilter {
  if (expectedItems < 1) throw new RangeError('expectedItems must be >= 1');
  if (falsePositiveRate <= 0 || falsePositiveRate >= 1) {
    throw new RangeError('falsePositiveRate must be strictly between 0 and 1');
  }
  const size = optimalSize(expectedItems, falsePositiveRate);
  const hashFunctions = optimalHashCount(size, expectedItems);
  return new BloomFilter({ size, hashFunctions });
}
