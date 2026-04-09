// @ts-check
// ─── XOR Filter ──────────────────────────────────────────────────────────────
// Static probabilistic set membership filter. Very space-efficient once built.
// Items must be known at construction time; the filter is immutable afterward.

// ─── Constants ───────────────────────────────────────────────────────────────

/** Number of hash functions (XOR filter always uses 3). */
const NUM_HASHES = 3;

/** Maximum construction attempts before giving up. */
const MAX_CONSTRUCT_ATTEMPTS = 100;

// ─── Public API ──────────────────────────────────────────────────────────────

export class XorFilter {
  #fingerprints: Uint8Array;
  #tableSize: number;
  #seed: number;
  #itemCount: number;

  /**
   * Build an XOR filter from a set of items.
   * @param items - Array of strings to include in the filter.
   */
  constructor(items: string[]) {
    // Deduplicate
    const unique = [...new Set(items)];
    this.#itemCount = unique.length;

    if (unique.length === 0) {
      this.#fingerprints = new Uint8Array(0);
      this.#tableSize = 0;
      this.#seed = 0;
      return;
    }

    // Table size must be ~1.23x the number of items, split across 3 segments.
    const segmentLength = Math.max(1, Math.ceil(unique.length * 1.23 / NUM_HASHES));
    this.#tableSize = segmentLength * NUM_HASHES;

    // Try different seeds until construction succeeds.
    let seed = 1;
    let fingerprints: Uint8Array | null = null;
    for (let attempt = 0; attempt < MAX_CONSTRUCT_ATTEMPTS; attempt++) {
      seed = (attempt + 1) * 0x9e3779b9;
      fingerprints = this.#tryBuild(unique, seed, segmentLength);
      if (fingerprints) break;
    }
    if (!fingerprints) {
      throw new Error('XOR filter construction failed after maximum attempts');
    }
    this.#fingerprints = fingerprints;
    this.#seed = seed;
  }

  /** Check if an item might be in the filter. */
  has(item: string): boolean {
    if (this.#tableSize === 0) return false;
    const segmentLength = this.#tableSize / NUM_HASHES;
    const h = hash64(item, this.#seed);
    const fp = fingerprint8(h);
    const h0 = reduce(hash64(item, this.#seed ^ 0), segmentLength);
    const h1 = reduce(hash64(item, this.#seed ^ 1), segmentLength) + segmentLength;
    const h2 = reduce(hash64(item, this.#seed ^ 2), segmentLength) + 2 * segmentLength;
    return (this.#fingerprints[h0] ^ this.#fingerprints[h1] ^ this.#fingerprints[h2]) === fp;
  }

  /** Number of items in the filter. */
  get size(): number {
    return this.#itemCount;
  }

  /** Average bits used per item (space efficiency metric). */
  get bitsPerItem(): number {
    if (this.#itemCount === 0) return 0;
    return (this.#fingerprints.length * 8) / this.#itemCount;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Attempt to build the fingerprint array using the "peeling" algorithm.
   * Returns the fingerprint array on success, null on failure.
   */
  #tryBuild(items: string[], seed: number, segmentLength: number): Uint8Array | null {
    const tableSize = segmentLength * NUM_HASHES;

    // H holds (h0, h1, h2) per item.
    const itemHashes: Array<{ fp: number; h0: number; h1: number; h2: number }> = [];
    for (const item of items) {
      const h = hash64(item, seed);
      const fp = fingerprint8(h);
      const h0 = reduce(hash64(item, seed ^ 0), segmentLength);
      const h1 = reduce(hash64(item, seed ^ 1), segmentLength) + segmentLength;
      const h2 = reduce(hash64(item, seed ^ 2), segmentLength) + 2 * segmentLength;
      itemHashes.push({ fp, h0, h1, h2 });
    }

    // Count array: how many items map to each slot.
    const count = new Int32Array(tableSize);
    // XOR-accumulated hash index per slot (to identify the single remaining item).
    const xorSet = new Int32Array(tableSize);

    for (let i = 0; i < itemHashes.length; i++) {
      const { h0, h1, h2 } = itemHashes[i];
      count[h0]++;
      count[h1]++;
      count[h2]++;
      xorSet[h0] ^= i;
      xorSet[h1] ^= i;
      xorSet[h2] ^= i;
    }

    // Peeling: find slots with count == 1, remove them, repeat.
    const queue: number[] = [];
    for (let i = 0; i < tableSize; i++) {
      if (count[i] === 1) queue.push(i);
    }

    const order: Array<{ itemIdx: number; slot: number }> = [];
    while (queue.length > 0) {
      const slot = queue.pop()!;
      if (count[slot] !== 1) continue;
      const itemIdx = xorSet[slot];
      if (itemIdx < 0 || itemIdx >= itemHashes.length) continue;
      order.push({ itemIdx, slot });
      const { h0, h1, h2 } = itemHashes[itemIdx];
      for (const s of [h0, h1, h2]) {
        count[s]--;
        xorSet[s] ^= itemIdx;
        if (count[s] === 1) queue.push(s);
      }
    }

    // If we couldn't peel all items, construction failed with this seed.
    if (order.length !== items.length) return null;

    // Assign fingerprints in reverse peeling order.
    const fingerprints = new Uint8Array(tableSize);
    for (let i = order.length - 1; i >= 0; i--) {
      const { itemIdx, slot } = order[i];
      const { fp, h0, h1, h2 } = itemHashes[itemIdx];
      fingerprints[slot] = fp ^ fingerprints[h0] ^ fingerprints[h1] ^ fingerprints[h2];
    }

    return fingerprints;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new XorFilter from an array of items. */
export function createXorFilter(items: string[]): XorFilter {
  return new XorFilter(items);
}

// ─── Hashing Utilities ───────────────────────────────────────────────────────

/**
 * A 32-bit hash function using a murmur-inspired mix with a seed.
 * Returns a 32-bit unsigned integer.
 */
function hash64(item: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < item.length; i++) {
    h = Math.imul(h ^ item.charCodeAt(i), 0xcc9e2d51) >>> 0;
    h = ((h << 15) | (h >>> 17)) >>> 0;
    h = Math.imul(h, 0x1b873593) >>> 0;
  }
  // Finalization mix.
  h = (h ^ item.length) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/** Extract an 8-bit fingerprint from a hash, ensuring it is non-zero. */
function fingerprint8(hash: number): number {
  return (hash & 0xff) || 1;
}

/** Map a hash value into [0, range) without modulo bias (uses multiply-shift). */
function reduce(hash: number, range: number): number {
  // (hash * range) >> 32, approximated in 32-bit JS
  return ((Math.imul(hash >>> 16, range) >>> 0) >>> 16) % range;
}
