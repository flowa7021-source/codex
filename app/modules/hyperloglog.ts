// @ts-check
// ─── HyperLogLog ──────────────────────────────────────────────────────────────
// Probabilistic cardinality estimator using the HyperLogLog algorithm.
// Reference: Flajolet et al. "HyperLogLog: the analysis of a near-optimal
// cardinality estimation algorithm" (2007).

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_PRECISION = 4;
const MAX_PRECISION = 16;
const DEFAULT_PRECISION = 10;

// ─── Public API ───────────────────────────────────────────────────────────────

export class HyperLogLog {
  #precision: number;
  #m: number;        // number of registers (2^precision)
  #registers: Uint8Array;
  #alphaMM: number;  // bias-correction constant * m^2

  constructor(precision: number = DEFAULT_PRECISION) {
    if (precision < MIN_PRECISION || precision > MAX_PRECISION) {
      throw new RangeError(
        `HyperLogLog precision must be between ${MIN_PRECISION} and ${MAX_PRECISION}, got ${precision}`,
      );
    }
    this.#precision = precision;
    this.#m = 1 << precision; // 2^precision
    this.#registers = new Uint8Array(this.#m);
    this.#alphaMM = computeAlphaMM(this.#m);
  }

  /** Precision (number of index bits, determines register count = 2^precision). */
  get precision(): number {
    return this.#precision;
  }

  /** Add an item to the estimator. */
  add(item: string): void {
    // Hash the item into two 32-bit values for independent index and rho.
    // h1 (well-mixed) → register index via top bits
    // h2 (seeded differently) → rho (leading zeros + 1)
    const h1 = murmur32Mix(fnv1a32(item));
    const h2 = murmur32Mix(h1 ^ 0xdeadbeef);
    // Top precision bits of h1 → register index
    const idx = h1 >>> (32 - this.#precision);
    // Full 32-bit h2 → leading zeros + 1
    const lz = clz32(h2) + 1;
    if (lz > this.#registers[idx]) {
      this.#registers[idx] = lz;
    }
  }

  /** Estimate the number of distinct items added. */
  count(): number {
    const m = this.#m;

    // Raw HyperLogLog estimate
    let sum = 0;
    let zeroRegisters = 0;
    for (let j = 0; j < m; j++) {
      sum += Math.pow(2, -this.#registers[j]);
      if (this.#registers[j] === 0) {
        zeroRegisters++;
      }
    }
    const estimate = this.#alphaMM / sum;

    // Small range correction: use linear counting when estimate < 2.5 * m
    if (estimate < 2.5 * m) {
      if (zeroRegisters > 0) {
        // Linear counting
        return Math.round(m * Math.log(m / zeroRegisters));
      }
    }

    // Large range correction (beyond 2^32 / 30)
    const largeThreshold = Math.pow(2, 32) / 30;
    if (estimate > largeThreshold) {
      return Math.round(-Math.pow(2, 32) * Math.log(1 - estimate / Math.pow(2, 32)));
    }

    return Math.round(estimate);
  }

  /**
   * Merge another HyperLogLog into a new instance.
   * Both must have the same precision.
   */
  merge(other: HyperLogLog): HyperLogLog {
    if (other.#precision !== this.#precision) {
      throw new Error(
        `Cannot merge HyperLogLog instances with different precisions: ${this.#precision} vs ${other.#precision}`,
      );
    }
    const merged = new HyperLogLog(this.#precision);
    for (let j = 0; j < this.#m; j++) {
      merged.#registers[j] = Math.max(this.#registers[j], other.#registers[j]);
    }
    return merged;
  }

  /** Reset all registers to zero. */
  clear(): void {
    this.#registers.fill(0);
  }
}

// ─── Factory & One-Shot ───────────────────────────────────────────────────────

/** Create a HyperLogLog estimator with the given precision (default 10). */
export function createHyperLogLog(precision: number = DEFAULT_PRECISION): HyperLogLog {
  return new HyperLogLog(precision);
}

/** Estimate the number of distinct strings in `items` using a fresh HyperLogLog. */
export function estimateCardinality(items: string[]): number {
  const hll = new HyperLogLog(DEFAULT_PRECISION);
  for (const item of items) {
    hll.add(item);
  }
  return hll.count();
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash.
 * Produces a well-distributed 32-bit unsigned integer for any string.
 */
function fnv1a32(str: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0; // FNV prime, keep unsigned
  }
  return hash >>> 0;
}

/**
 * Count leading zeros of a 32-bit integer.
 * Math.clz32 is built-in in modern JS engines.
 */
function clz32(n: number): number {
  return Math.clz32(n >>> 0);
}

/**
 * Murmur-inspired 32-bit finalizer mix.
 * Produces a well-avalanched second hash from an existing hash value,
 * so that the index bits and the rho bits are statistically independent.
 */
function murmur32Mix(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Compute alpha_m * m^2 (the bias-correction factor).
 * alpha_m is approximated as per Flajolet et al.
 */
function computeAlphaMM(m: number): number {
  let alpha: number;
  if (m === 16) {
    alpha = 0.673;
  } else if (m === 32) {
    alpha = 0.697;
  } else if (m === 64) {
    alpha = 0.709;
  } else {
    // General formula for m >= 128
    alpha = 0.7213 / (1 + 1.079 / m);
  }
  return alpha * m * m;
}
