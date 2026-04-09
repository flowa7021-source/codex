// @ts-check
// ─── Cuckoo Filter ───────────────────────────────────────────────────────────
// Space-efficient probabilistic set membership with support for deletion.
// Uses cuckoo hashing with fingerprints stored in a bucket array.

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum number of relocations before declaring the filter full. */
const MAX_KICKS = 500;

/** Number of entries per bucket. */
const BUCKET_SIZE = 4;

// ─── Public API ──────────────────────────────────────────────────────────────

export class CuckooFilter {
  #bucketCount: number;
  #fingerprintSize: number;
  #fingerprintMask: number;
  #buckets: Uint8Array[];
  #count = 0;

  /**
   * @param capacity - Approximate number of items the filter should hold.
   * @param fingerprintSize - Fingerprint size in bits (default 8). Capped at 32.
   */
  constructor(capacity: number, fingerprintSize = 8) {
    if (capacity < 1) throw new RangeError('Capacity must be at least 1');
    if (fingerprintSize < 1 || fingerprintSize > 32) {
      throw new RangeError('Fingerprint size must be between 1 and 32');
    }
    this.#fingerprintSize = fingerprintSize;
    this.#fingerprintMask = (1 << fingerprintSize) - 1;
    // Round bucket count up to next power of 2 for fast modulo via bitmask.
    this.#bucketCount = nextPow2(Math.ceil(capacity / BUCKET_SIZE));
    this.#buckets = Array.from(
      { length: this.#bucketCount },
      () => new Uint8Array(BUCKET_SIZE),
    );
  }

  /** Attempt to add an item. Returns false if the filter is full. */
  add(item: string): boolean {
    const fp = this.#fingerprint(item);
    const i1 = this.#indexHash(item);
    const i2 = this.#altIndex(i1, fp);

    // Try primary bucket.
    if (this.#insertIntoBucket(i1, fp)) {
      this.#count++;
      return true;
    }
    // Try alternate bucket.
    if (this.#insertIntoBucket(i2, fp)) {
      this.#count++;
      return true;
    }

    // Both full — kick an existing entry.
    let idx = Math.random() < 0.5 ? i1 : i2;
    for (let n = 0; n < MAX_KICKS; n++) {
      const slot = Math.floor(Math.random() * BUCKET_SIZE);
      const evicted = this.#buckets[idx][slot];
      this.#buckets[idx][slot] = fp;
      // Find the evicted fingerprint a new home.
      const newFp = evicted;
      idx = this.#altIndex(idx, newFp);
      if (this.#insertIntoBucket(idx, newFp)) {
        this.#count++;
        return true;
      }
    }
    // Filter is considered full.
    return false;
  }

  /** Check whether an item might be in the filter. */
  has(item: string): boolean {
    const fp = this.#fingerprint(item);
    const i1 = this.#indexHash(item);
    const i2 = this.#altIndex(i1, fp);
    return this.#bucketContains(i1, fp) || this.#bucketContains(i2, fp);
  }

  /** Delete an item from the filter. Returns false if not found. */
  delete(item: string): boolean {
    const fp = this.#fingerprint(item);
    const i1 = this.#indexHash(item);
    const i2 = this.#altIndex(i1, fp);
    if (this.#removeFromBucket(i1, fp)) {
      this.#count--;
      return true;
    }
    if (this.#removeFromBucket(i2, fp)) {
      this.#count--;
      return true;
    }
    return false;
  }

  /** Number of items currently stored. */
  get size(): number {
    return this.#count;
  }

  /** Total capacity (bucket count * bucket size). */
  get capacity(): number {
    return this.#bucketCount * BUCKET_SIZE;
  }

  /** Fraction of capacity that is occupied (0-1). */
  get loadFactor(): number {
    return this.#count / this.capacity;
  }

  /** Remove all items from the filter. */
  clear(): void {
    for (const bucket of this.#buckets) {
      bucket.fill(0);
    }
    this.#count = 0;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /** Generate a non-zero fingerprint for the item. */
  #fingerprint(item: string): number {
    let h = 2166136261;
    for (let i = 0; i < item.length; i++) {
      h = Math.imul(h ^ item.charCodeAt(i), 16777619) >>> 0;
    }
    // Ensure non-zero (0 is the empty sentinel).
    const fp = (h & this.#fingerprintMask) || 1;
    return fp;
  }

  /** Hash the item to a bucket index. */
  #indexHash(item: string): number {
    let h = 5381;
    for (let i = 0; i < item.length; i++) {
      h = ((h << 5) + h + item.charCodeAt(i)) >>> 0;
    }
    return h & (this.#bucketCount - 1);
  }

  /** Compute the alternate index using the fingerprint. */
  #altIndex(index: number, fp: number): number {
    // hash(fp) via mixing
    let h = Math.imul(fp, 0x5bd1e995) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
    return (index ^ h) & (this.#bucketCount - 1);
  }

  /** Try to insert a fingerprint into the given bucket. */
  #insertIntoBucket(bucketIdx: number, fp: number): boolean {
    const bucket = this.#buckets[bucketIdx];
    for (let i = 0; i < BUCKET_SIZE; i++) {
      if (bucket[i] === 0) {
        bucket[i] = fp;
        return true;
      }
    }
    return false;
  }

  /** Check if a bucket contains the given fingerprint. */
  #bucketContains(bucketIdx: number, fp: number): boolean {
    const bucket = this.#buckets[bucketIdx];
    for (let i = 0; i < BUCKET_SIZE; i++) {
      if (bucket[i] === fp) return true;
    }
    return false;
  }

  /** Remove one copy of a fingerprint from a bucket. */
  #removeFromBucket(bucketIdx: number, fp: number): boolean {
    const bucket = this.#buckets[bucketIdx];
    for (let i = 0; i < BUCKET_SIZE; i++) {
      if (bucket[i] === fp) {
        bucket[i] = 0;
        return true;
      }
    }
    return false;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new CuckooFilter with the given capacity. */
export function createCuckooFilter(capacity: number): CuckooFilter {
  return new CuckooFilter(capacity);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Round up to the next power of 2 (minimum 1). */
function nextPow2(n: number): number {
  let v = Math.max(1, Math.ceil(n));
  v--;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v + 1;
}
