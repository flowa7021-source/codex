// @ts-check
// ─── Counting Bloom Filter ───────────────────────────────────────────────────
// A Bloom filter variant that uses counters instead of single bits, allowing
// both insertion and deletion while preserving the probabilistic membership
// guarantees of a standard Bloom filter.

// ─── Public API ──────────────────────────────────────────────────────────────

export class CountingBloomFilter {
  #counters: Uint8Array;
  #size: number;
  #hashCount: number;
  #addCount = 0;
  #expectedItems: number;

  constructor(expectedItems: number, falsePositiveRate = 0.01) {
    if (expectedItems <= 0) {
      throw new RangeError('expectedItems must be positive');
    }
    if (falsePositiveRate <= 0 || falsePositiveRate >= 1) {
      throw new RangeError('falsePositiveRate must be between 0 and 1 (exclusive)');
    }

    this.#expectedItems = expectedItems;

    // Optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)
    const m = Math.ceil(-(expectedItems * Math.log(falsePositiveRate)) / (Math.LN2 * Math.LN2));
    // Optimal hash count: k = (m/n) * ln(2)
    const k = Math.max(1, Math.round((m / expectedItems) * Math.LN2));

    this.#size = m;
    this.#hashCount = k;
    // Each counter is a byte (0-255) instead of a single bit
    this.#counters = new Uint8Array(m);
  }

  /** Add an item to the filter. */
  add(item: string): void {
    for (let i = 0; i < this.#hashCount; i++) {
      const pos = this.#hash(item, i) % this.#size;
      if (this.#counters[pos] < 255) {
        this.#counters[pos]++;
      }
    }
    this.#addCount++;
  }

  /**
   * Remove an item from the filter. Returns false if the item does not appear
   * to be present (i.e. any counter is already 0). When false is returned no
   * counters are modified.
   */
  remove(item: string): boolean {
    // First verify all counters are > 0
    const positions: number[] = [];
    for (let i = 0; i < this.#hashCount; i++) {
      const pos = this.#hash(item, i) % this.#size;
      if (this.#counters[pos] === 0) {
        return false;
      }
      positions.push(pos);
    }
    // Decrement all counters
    for (const pos of positions) {
      this.#counters[pos]--;
    }
    this.#addCount = Math.max(0, this.#addCount - 1);
    return true;
  }

  /** Check if item might be in the set (may have false positives). */
  has(item: string): boolean {
    for (let i = 0; i < this.#hashCount; i++) {
      const pos = this.#hash(item, i) % this.#size;
      if (this.#counters[pos] === 0) {
        return false;
      }
    }
    return true;
  }

  /** Approximate number of items currently in the filter. */
  get count(): number {
    return this.#addCount;
  }

  /** Current estimated false positive rate based on fill ratio. */
  get falsePositiveRate(): number {
    if (this.#addCount === 0) return 0;
    // FPR ~ (1 - e^(-kn/m))^k
    const exponent = -(this.#hashCount * this.#addCount) / this.#size;
    return Math.pow(1 - Math.exp(exponent), this.#hashCount);
  }

  /** Clear the filter, resetting all counters and the count. */
  clear(): void {
    this.#counters.fill(0);
    this.#addCount = 0;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Double hashing using djb2 and fnv1a variants seeded by index.
   * h(item, i) = (h1(item) + i * h2(item)) mod size
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

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new CountingBloomFilter with the given parameters. */
export function createCountingBloomFilter(
  expectedItems: number,
  fpr = 0.01,
): CountingBloomFilter {
  return new CountingBloomFilter(expectedItems, fpr);
}
