// @ts-check
// ─── Bloom Filter ─────────────────────────────────────────────────────────────
// Probabilistic set membership data structure with configurable false-positive rate.

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface BloomFilterOptions {
  /** Expected number of items. Default 1000. */
  expectedItems?: number;
  /** Desired false positive rate (0-1). Default 0.01 (1%). */
  falsePositiveRate?: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class BloomFilter {
  #bits: Uint8Array;
  #bitSize: number;
  #hashCount: number;
  #addCount = 0;

  constructor(options?: BloomFilterOptions) {
    const expectedItems = options?.expectedItems ?? 1000;
    const fpRate = options?.falsePositiveRate ?? 0.01;

    // Optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)
    const m = Math.ceil(-(expectedItems * Math.log(fpRate)) / (Math.LN2 * Math.LN2));
    // Optimal hash count: k = (m/n) * ln(2)
    const k = Math.max(1, Math.round((m / expectedItems) * Math.LN2));

    this.#bitSize = m;
    this.#hashCount = k;
    this.#bits = new Uint8Array(Math.ceil(m / 8));
  }

  /** Add an item to the filter. */
  add(item: string): void {
    for (let i = 0; i < this.#hashCount; i++) {
      const pos = this.#hash(item, i) % this.#bitSize;
      this.#bits[Math.floor(pos / 8)] |= 1 << (pos % 8);
    }
    this.#addCount++;
  }

  /** Check if item might be in the set (may have false positives). */
  mightContain(item: string): boolean {
    for (let i = 0; i < this.#hashCount; i++) {
      const pos = this.#hash(item, i) % this.#bitSize;
      if ((this.#bits[Math.floor(pos / 8)] & (1 << (pos % 8))) === 0) {
        return false;
      }
    }
    return true;
  }

  /** Approximate number of items added. */
  get approximateCount(): number {
    return this.#addCount;
  }

  /** Size of the bit array. */
  get bitArraySize(): number {
    return this.#bitSize;
  }

  /** Number of hash functions used. */
  get hashCount(): number {
    return this.#hashCount;
  }

  /** Clear the filter. */
  clear(): void {
    this.#bits.fill(0);
    this.#addCount = 0;
  }

  /** Export filter state as base64 string. */
  export(): string {
    // Prefix with metadata: bitSize (4 bytes), hashCount (2 bytes), addCount (4 bytes)
    const meta = new Uint8Array(10);
    const view = new DataView(meta.buffer);
    view.setUint32(0, this.#bitSize, false);
    view.setUint16(4, this.#hashCount, false);
    view.setUint32(6, this.#addCount, false);
    const combined = new Uint8Array(meta.length + this.#bits.length);
    combined.set(meta, 0);
    combined.set(this.#bits, meta.length);
    return btoa(String.fromCharCode(...combined));
  }

  /** Import filter state from base64 string. */
  import(data: string): void {
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    this.#bitSize = view.getUint32(0, false);
    this.#hashCount = view.getUint16(4, false);
    this.#addCount = view.getUint32(6, false);
    this.#bits = bytes.slice(10);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Double hashing using djb2 and fnv1a variants seeded by index.
   * h(item, i) = (h1(item) + i * h2(item)) mod bitSize
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
