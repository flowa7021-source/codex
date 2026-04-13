// @ts-check
// ─── XOR Filter ──────────────────────────────────────────────────────────────
// Static probabilistic set membership filter. Very space-efficient once built.
// Items must be known at construction time; the filter is immutable afterward.

// ─── Constants ───────────────────────────────────────────────────────────────

/** Number of hash functions (XOR filter always uses 3). */
const NUM_HASHES = 3;

/** Maximum construction attempts before giving up. */
const MAX_CONSTRUCT_ATTEMPTS = 256;

/** Minimum segment length to avoid degenerate cases with very small sets. */
const MIN_SEGMENT_LENGTH = 4;

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
    const segmentLength = Math.max(
      MIN_SEGMENT_LENGTH,
      Math.ceil((unique.length * 1.23) / NUM_HASHES) + 1,
    );
    this.#tableSize = segmentLength * NUM_HASHES;

    // Try different seeds until construction succeeds.
    let seed = 0;
    let fingerprints: Uint8Array | null = null;
    for (let attempt = 0; attempt < MAX_CONSTRUCT_ATTEMPTS; attempt++) {
      seed = splitmix32(attempt);
      fingerprints = tryBuild(unique, seed, segmentLength);
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
    const fp = itemFingerprint(item, this.#seed);
    const h0 = itemHash(item, this.#seed, 0) % segmentLength;
    const h1 = itemHash(item, this.#seed, 1) % segmentLength + segmentLength;
    const h2 = itemHash(item, this.#seed, 2) % segmentLength + 2 * segmentLength;
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
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new XorFilter from an array of items. */
export function createXorFilter(items: string[]): XorFilter {
  return new XorFilter(items);
}

// ─── Private Build Logic ─────────────────────────────────────────────────────

/**
 * Attempt to build the fingerprint array using the "peeling" algorithm.
 * Returns the fingerprint array on success, null on failure.
 */
function tryBuild(items: string[], seed: number, segmentLength: number): Uint8Array | null {
  const tableSize = segmentLength * NUM_HASHES;
  const n = items.length;

  // Compute (h0, h1, h2, fp) per item.
  const h0s = new Uint32Array(n);
  const h1s = new Uint32Array(n);
  const h2s = new Uint32Array(n);
  const fps = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    fps[i] = itemFingerprint(items[i], seed);
    h0s[i] = itemHash(items[i], seed, 0) % segmentLength;
    h1s[i] = itemHash(items[i], seed, 1) % segmentLength + segmentLength;
    h2s[i] = itemHash(items[i], seed, 2) % segmentLength + 2 * segmentLength;
  }

  // Count array: how many items map to each slot.
  const count = new Int32Array(tableSize);
  // XOR-accumulated item index per slot.
  const xorSet = new Int32Array(tableSize);

  for (let i = 0; i < n; i++) {
    count[h0s[i]]++;
    count[h1s[i]]++;
    count[h2s[i]]++;
    xorSet[h0s[i]] ^= i;
    xorSet[h1s[i]] ^= i;
    xorSet[h2s[i]] ^= i;
  }

  // Peeling: find slots with count == 1, remove them, repeat.
  const queue: number[] = [];
  for (let i = 0; i < tableSize; i++) {
    if (count[i] === 1) queue.push(i);
  }

  const orderSlots = new Uint32Array(n);
  const orderItems = new Uint32Array(n);
  let orderLen = 0;

  while (queue.length > 0) {
    const slot = queue.pop()!;
    if (count[slot] !== 1) continue;
    const idx = xorSet[slot];
    if (idx < 0 || idx >= n) continue;
    orderSlots[orderLen] = slot;
    orderItems[orderLen] = idx;
    orderLen++;
    const a = h0s[idx];
    const b = h1s[idx];
    const c = h2s[idx];
    count[a]--;
    count[b]--;
    count[c]--;
    xorSet[a] ^= idx;
    xorSet[b] ^= idx;
    xorSet[c] ^= idx;
    if (count[a] === 1) queue.push(a);
    if (count[b] === 1) queue.push(b);
    if (count[c] === 1) queue.push(c);
  }

  // If we couldn't peel all items, construction failed with this seed.
  if (orderLen !== n) return null;

  // Assign fingerprints in reverse peeling order.
  const fingerprints = new Uint8Array(tableSize);
  for (let i = orderLen - 1; i >= 0; i--) {
    const idx = orderItems[i];
    const slot = orderSlots[i];
    fingerprints[slot] = fps[idx] ^ fingerprints[h0s[idx]] ^ fingerprints[h1s[idx]] ^ fingerprints[h2s[idx]];
  }

  return fingerprints;
}

// ─── Hashing Utilities ───────────────────────────────────────────────────────

/**
 * A murmur-inspired 32-bit hash with seed.
 * The seed is mixed in at the start and the string length is folded in for
 * robustness (especially for the empty-string case).
 */
function murmurMix(item: string, seed: number): number {
  let h = (seed ^ (item.length * 0x9e3779b9)) >>> 0;
  for (let i = 0; i < item.length; i++) {
    let k = item.charCodeAt(i);
    k = Math.imul(k, 0xcc9e2d51) >>> 0;
    k = ((k << 15) | (k >>> 17)) >>> 0;
    k = Math.imul(k, 0x1b873593) >>> 0;
    h = (h ^ k) >>> 0;
    h = ((h << 13) | (h >>> 19)) >>> 0;
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  }
  // Finalization
  h = (h ^ item.length) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/** Hash an item to a bucket index for a given segment index. */
function itemHash(item: string, seed: number, segIndex: number): number {
  return murmurMix(item, seed * 3 + segIndex + 1);
}

/** Generate an 8-bit fingerprint for an item (always non-zero). */
function itemFingerprint(item: string, seed: number): number {
  const h = murmurMix(item, seed * 7 + 0x12345);
  return (h & 0xff) || 1;
}

/** SplitMix32 PRNG for generating deterministic seeds. */
function splitmix32(index: number): number {
  let z = (index + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}
