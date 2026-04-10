// ─── Bloom Filter ────────────────────────────────────────────────────────────
// Probabilistic set membership data structure.
// Guarantees no false negatives; false positives are possible at a tunable rate.

// ─── Hash Functions ──────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash with a per-index seed mixed into the basis.
 * Returns a non-negative 32-bit integer.
 */
function fnv1a(str: string, seed: number): number {
  // Mix seed into the FNV-1a offset basis (2166136261).
  let h = (2166136261 ^ (seed * 0x9e3779b9)) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Return `hashCount` bit positions for `item` in a bit array of `size`. */
function hashPositions(item: string, size: number, hashCount: number): number[] {
  const positions: number[] = [];
  for (let i = 0; i < hashCount; i++) {
    positions.push(fnv1a(item, i) % size);
  }
  return positions;
}

// ─── BloomFilter ─────────────────────────────────────────────────────────────

/**
 * Classic Bloom filter backed by a compact bit array.
 *
 * Never produces false negatives; may produce false positives.
 * The false-positive rate depends on `size`, `hashCount`, and the number of
 * items added.
 *
 * @example
 *   const bf = new BloomFilter(9585, 7); // ~1% FP for 1000 items
 *   bf.add('hello');
 *   bf.has('hello'); // true (guaranteed)
 *   bf.has('world'); // probably false
 */
export class BloomFilter {
  #bits: Uint8Array;
  #size: number;
  #hashCount: number;
  #itemCount: number;

  constructor(size: number, hashCount: number) {
    if (size < 1) throw new RangeError('size must be >= 1');
    if (hashCount < 1) throw new RangeError('hashCount must be >= 1');
    this.#size = size;
    this.#hashCount = hashCount;
    this.#bits = new Uint8Array(Math.ceil(size / 8));
    this.#itemCount = 0;
  }

  /** Bit array size (number of bits). */
  get size(): number {
    return this.#size;
  }

  /** Number of hash functions used. */
  get hashCount(): number {
    return this.#hashCount;
  }

  /** Estimated number of distinct items added (incremented on every call to add). */
  get itemCount(): number {
    return this.#itemCount;
  }

  /** Add an item to the filter. */
  add(item: string): void {
    for (const pos of hashPositions(item, this.#size, this.#hashCount)) {
      this.#bits[pos >>> 3] |= 1 << (pos & 7);
    }
    this.#itemCount++;
  }

  /**
   * Test set membership.
   * `false` means definitely absent.
   * `true` means probably present (false positives are possible).
   */
  has(item: string): boolean {
    for (const pos of hashPositions(item, this.#size, this.#hashCount)) {
      if ((this.#bits[pos >>> 3] & (1 << (pos & 7))) === 0) return false;
    }
    return true;
  }

  /**
   * Estimated false-positive probability given the items added so far.
   *
   * Formula: (1 − e^(−k·n/m))^k
   * where k = hashCount, n = itemCount, m = size.
   */
  estimatedFalsePositiveRate(): number {
    if (this.#itemCount === 0) return 0;
    return Math.pow(
      1 - Math.exp((-this.#hashCount * this.#itemCount) / this.#size),
      this.#hashCount,
    );
  }
}

// ─── CountingBloomFilter ─────────────────────────────────────────────────────

/**
 * Counting Bloom filter — uses per-slot integer counters instead of a single
 * bit, allowing items to be removed after insertion.
 *
 * Only call `delete` for items that were genuinely added; decrementing
 * counters for phantom items corrupts the filter.
 *
 * @example
 *   const cbf = new CountingBloomFilter(9585, 7);
 *   cbf.add('hello');
 *   cbf.has('hello');    // true
 *   cbf.delete('hello'); // true
 *   cbf.has('hello');    // false
 */
export class CountingBloomFilter {
  #counters: Uint32Array;
  #size: number;
  #hashCount: number;
  #itemCount: number;

  constructor(size: number, hashCount: number) {
    if (size < 1) throw new RangeError('size must be >= 1');
    if (hashCount < 1) throw new RangeError('hashCount must be >= 1');
    this.#size = size;
    this.#hashCount = hashCount;
    this.#counters = new Uint32Array(size);
    this.#itemCount = 0;
  }

  /** Number of counter slots (equivalent to bit array size). */
  get size(): number {
    return this.#size;
  }

  /** Number of hash functions used. */
  get hashCount(): number {
    return this.#hashCount;
  }

  /** Estimated number of items currently in the filter. */
  get itemCount(): number {
    return this.#itemCount;
  }

  /** Add an item to the filter. */
  add(item: string): void {
    for (const pos of hashPositions(item, this.#size, this.#hashCount)) {
      this.#counters[pos]++;
    }
    this.#itemCount++;
  }

  /**
   * Test set membership.
   * `false` means definitely absent.
   * `true` means probably present.
   */
  has(item: string): boolean {
    for (const pos of hashPositions(item, this.#size, this.#hashCount)) {
      if (this.#counters[pos] === 0) return false;
    }
    return true;
  }

  /**
   * Remove a previously added item.
   * Returns `true` if the item appeared present and was removed.
   * Returns `false` if the item did not appear to be in the filter.
   */
  delete(item: string): boolean {
    if (!this.has(item)) return false;
    for (const pos of hashPositions(item, this.#size, this.#hashCount)) {
      if (this.#counters[pos] > 0) this.#counters[pos]--;
    }
    if (this.#itemCount > 0) this.#itemCount--;
    return true;
  }

  /**
   * Estimated false-positive probability given the items currently in the filter.
   */
  estimatedFalsePositiveRate(): number {
    if (this.#itemCount === 0) return 0;
    return Math.pow(
      1 - Math.exp((-this.#hashCount * this.#itemCount) / this.#size),
      this.#hashCount,
    );
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a `BloomFilter` optimally sized for `expectedItems` items and a
 * target `falsePositiveRate`.
 *
 * Optimal bit-array size:  m = −n · ln(p) / (ln 2)²
 * Optimal hash count:      k = (m / n) · ln 2
 *
 * @param expectedItems     Expected number of distinct items to store.
 * @param falsePositiveRate Desired false-positive probability, e.g. 0.01 for 1%.
 */
export function createBloomFilter(
  expectedItems: number,
  falsePositiveRate: number,
): BloomFilter {
  if (expectedItems < 1) throw new RangeError('expectedItems must be >= 1');
  if (falsePositiveRate <= 0 || falsePositiveRate >= 1) {
    throw new RangeError('falsePositiveRate must be strictly between 0 and 1');
  }
  const ln2 = Math.LN2;
  const m = Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / (ln2 * ln2));
  const k = Math.max(1, Math.round((m / expectedItems) * ln2));
  return new BloomFilter(m, k);
}
