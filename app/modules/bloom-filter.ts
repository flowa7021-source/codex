// @ts-check
// ─── Bloom Filter Probabilistic Data Structure ───────────────────────────────
// A space-efficient probabilistic data structure for membership testing.
// May return false positives, but never false negatives.

// ─── Hash Helper ─────────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash with a seed mixed into the offset basis so each value of
 * `seed` produces an independent hash function. Returns a non-negative integer.
 */
function fnv1a(str: string, seed: number): number {
  // Mix seed into FNV offset basis (2166136261 = 0x811c9dc5).
  let h = (2166136261 ^ (seed * 0x9e3779b9)) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0; // FNV prime
  }
  return h >>> 0;
}

/**
 * Return `hashCount` bit-positions for `item` in a bit array of `size` bits.
 */
function positions(item: string, size: number, hashCount: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < hashCount; i++) {
    result.push(fnv1a(item, i) % size);
  }
  return result;
}

// ─── BloomFilter ─────────────────────────────────────────────────────────────

/**
 * Classic Bloom filter backed by a packed Uint8Array bit vector.
 *
 * - Never produces false negatives.
 * - May produce false positives at a rate that depends on size, hashCount, and
 *   the number of items added.
 */
export class BloomFilter {
  /** Packed bit vector: bit `pos` lives in byte `pos >>> 3`, bit `pos & 7`. */
  #bits: Uint8Array;
  /** Number of logical bits in the filter. */
  #size: number;
  /** Number of independent hash functions. */
  #hashCount: number;
  /** Total number of `add()` calls (used for FPR estimation). */
  #itemCount: number;

  /**
   * @param size      Bit-array size (default 1024).
   * @param hashCount Number of hash functions (default 3).
   */
  constructor(size: number = 1024, hashCount: number = 3) {
    if (size < 1) throw new RangeError('size must be >= 1');
    if (hashCount < 1) throw new RangeError('hashCount must be >= 1');
    this.#size = size;
    this.#hashCount = hashCount;
    this.#bits = new Uint8Array(Math.ceil(size / 8));
    this.#itemCount = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Insert `item` into the filter. */
  add(item: string): void {
    for (const pos of positions(item, this.#size, this.#hashCount)) {
      this.#bits[pos >>> 3] |= 1 << (pos & 7);
    }
    this.#itemCount++;
  }

  /**
   * Test membership.
   * Returns `false` → item is definitely NOT in the filter.
   * Returns `true`  → item is probably in the filter (false positive possible).
   */
  has(item: string): boolean {
    for (const pos of positions(item, this.#size, this.#hashCount)) {
      if ((this.#bits[pos >>> 3] & (1 << (pos & 7))) === 0) return false;
    }
    return true;
  }

  /** The bit-array size. */
  get size(): number {
    return this.#size;
  }

  /** The number of hash functions. */
  get hashCount(): number {
    return this.#hashCount;
  }

  /** Fraction of bits that are set (0..1). */
  get fillRatio(): number {
    let setBits = 0;
    for (const byte of this.#bits) {
      let b = byte;
      while (b > 0) {
        b &= b - 1; // Kernighan's bit-count trick
        setBits++;
      }
    }
    return setBits / this.#size;
  }

  /** Reset the filter to an empty state. */
  clear(): void {
    this.#bits.fill(0);
    this.#itemCount = 0;
  }

  /**
   * Estimate the current false-positive probability using the standard formula:
   *   FPR = (1 - e^(-k * n / m))^k
   * where k = hashCount, n = items added, m = size.
   */
  estimatedFalsePositiveRate(): number {
    if (this.#itemCount === 0) return 0;
    const k = this.#hashCount;
    const n = this.#itemCount;
    const m = this.#size;
    return Math.pow(1 - Math.exp((-k * n) / m), k);
  }
}

// ─── CountingBloomFilter ──────────────────────────────────────────────────────

/**
 * Counting Bloom filter: each slot holds a small counter instead of a single
 * bit, which allows element removal (best-effort).
 *
 * Counters saturate at 255 to avoid overflow; removal of items added more than
 * 255 times may be silently skipped.
 */
export class CountingBloomFilter {
  /** One byte per slot (counter, saturates at 255). */
  #counters: Uint8Array;
  /** Number of counter slots. */
  #size: number;
  /** Number of independent hash functions. */
  #hashCount: number;

  /**
   * @param size      Number of counter slots (default 1024).
   * @param hashCount Number of hash functions (default 3).
   */
  constructor(size: number = 1024, hashCount: number = 3) {
    if (size < 1) throw new RangeError('size must be >= 1');
    if (hashCount < 1) throw new RangeError('hashCount must be >= 1');
    this.#size = size;
    this.#hashCount = hashCount;
    this.#counters = new Uint8Array(size);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Insert `item`, incrementing each relevant counter. */
  add(item: string): void {
    for (const pos of positions(item, this.#size, this.#hashCount)) {
      if (this.#counters[pos] < 255) {
        this.#counters[pos]++;
      }
    }
  }

  /**
   * Test membership.
   * Returns `false` → item is definitely NOT in the filter.
   * Returns `true`  → item is probably in the filter (false positive possible).
   */
  has(item: string): boolean {
    for (const pos of positions(item, this.#size, this.#hashCount)) {
      if (this.#counters[pos] === 0) return false;
    }
    return true;
  }

  /**
   * Remove `item` from the filter by decrementing its counters.
   * Returns `false` (best-effort) if the item does not appear to be present.
   */
  remove(item: string): boolean {
    const slots = positions(item, this.#size, this.#hashCount);
    // Check first: if any counter is 0 the item is definitely not here.
    for (const pos of slots) {
      if (this.#counters[pos] === 0) return false;
    }
    for (const pos of slots) {
      this.#counters[pos]--;
    }
    return true;
  }

  /** The number of counter slots. */
  get size(): number {
    return this.#size;
  }

  /** The number of hash functions. */
  get hashCount(): number {
    return this.#hashCount;
  }

  /** Reset the filter to an empty state. */
  clear(): void {
    this.#counters.fill(0);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a `BloomFilter` sized to satisfy the given expected item count and
 * target false-positive rate.
 *
 * Optimal bit count:  m = -n · ln(p) / (ln 2)²
 * Optimal hash count: k = (m / n) · ln 2
 *
 * @param expectedItems     Number of items to be inserted.
 * @param falsePositiveRate Target false-positive rate (default 0.01 = 1 %).
 */
export function createBloomFilter(
  expectedItems: number,
  falsePositiveRate: number = 0.01,
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
