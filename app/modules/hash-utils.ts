// @ts-check
// ─── Hash Utilities ───────────────────────────────────────────────────────────
// Non-cryptographic and simple hash functions for strings and byte arrays.
// All functions return non-negative integers.

// ─── DJB2 (string) ────────────────────────────────────────────────────────────

/**
 * DJB2 hash for strings (operates on UTF-16 code units).
 * Classic Bernstein hash: hash = hash * 33 ^ char, seeded at 5381.
 */
export function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (((hash << 5) + hash) ^ str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

// ─── SDBM (string) ────────────────────────────────────────────────────────────

/**
 * SDBM hash for strings (operates on UTF-16 code units).
 * hash = char + (hash << 6) + (hash << 16) - hash
 */
export function sdbm(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (str.charCodeAt(i) + (hash << 6) + (hash << 16) - hash) >>> 0;
  }
  return hash >>> 0;
}

// ─── FNV-1a 32-bit (string) ───────────────────────────────────────────────────

const FNV_PRIME_32 = 0x01000193;
const FNV_OFFSET_32 = 0x811c9dc5;

/**
 * FNV-1a 32-bit hash for strings (operates on UTF-16 code units).
 */
export function fnv1a32(str: string): number {
  let hash = FNV_OFFSET_32;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME_32);
  }
  return hash >>> 0;
}

// ─── MurmurHash3 32-bit (string) ─────────────────────────────────────────────

/**
 * MurmurHash3 32-bit hash for strings via UTF-16 code units.
 * Processes characters in pairs (2 chars = 32 bits) when possible.
 */
export function murmur3(str: string, seed: number = 0): number {
  const C1 = 0xcc9e2d51;
  const C2 = 0x1b873593;
  let h = seed >>> 0;
  const len = str.length;

  // Process 2 characters at a time (each char is 16-bit, pair = 32-bit block)
  const chunkCount = Math.floor(len / 2);
  for (let i = 0; i < chunkCount; i++) {
    let k = (str.charCodeAt(i * 2) | (str.charCodeAt(i * 2 + 1) << 16)) >>> 0;
    k = Math.imul(k, C1);
    k = ((k << 15) | (k >>> 17)) >>> 0;
    k = Math.imul(k, C2);
    h ^= k;
    h = ((h << 13) | (h >>> 19)) >>> 0;
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  }

  // Remaining character (odd length)
  if (len & 1) {
    let k = str.charCodeAt(len - 1) >>> 0;
    k = Math.imul(k, C1);
    k = ((k << 15) | (k >>> 17)) >>> 0;
    k = Math.imul(k, C2);
    h ^= k;
  }

  // Finalization mix (fmix32)
  h ^= len;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;

  return h >>> 0;
}

// ─── DJB2 (byte array) ────────────────────────────────────────────────────────

/**
 * DJB2 hash for Uint8Array byte data.
 */
export function djb2Bytes(data: Uint8Array): number {
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = (((hash << 5) + hash) ^ data[i]) >>> 0;
  }
  return hash >>> 0;
}

// ─── FNV-1a 32-bit (byte array) ───────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash for Uint8Array byte data.
 */
export function fnv1a32Bytes(data: Uint8Array): number {
  let hash = FNV_OFFSET_32;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, FNV_PRIME_32);
  }
  return hash >>> 0;
}

// ─── Adler-32 ─────────────────────────────────────────────────────────────────

/**
 * Adler-32 checksum for Uint8Array or string.
 * Returns a 32-bit unsigned integer.
 */
export function adler32(data: Uint8Array | string): number {
  const MOD_ADLER = 65521;
  let a = 1;
  let b = 0;

  if (typeof data === 'string') {
    for (let i = 0; i < data.length; i++) {
      a = (a + data.charCodeAt(i)) % MOD_ADLER;
      b = (b + a) % MOD_ADLER;
    }
  } else {
    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]) % MOD_ADLER;
      b = (b + a) % MOD_ADLER;
    }
  }

  return ((b << 16) | a) >>> 0;
}

// ─── Fletcher-16 ──────────────────────────────────────────────────────────────

/**
 * Fletcher-16 checksum for Uint8Array or number[].
 * Returns a 16-bit value as a non-negative integer.
 */
export function fletcher16(data: Uint8Array | number[]): number {
  let sum1 = 0;
  let sum2 = 0;
  for (let i = 0; i < data.length; i++) {
    sum1 = (sum1 + data[i]) % 255;
    sum2 = (sum2 + sum1) % 255;
  }
  return (sum2 << 8) | sum1;
}

// ─── Java-style hashCode ──────────────────────────────────────────────────────

/**
 * Java-style hashCode: s[0]*31^(n-1) + s[1]*31^(n-2) + ... + s[n-1].
 * Returns a non-negative 32-bit integer.
 */
export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// ─── Simple hex hash ──────────────────────────────────────────────────────────

/**
 * Returns an 8-character lowercase hex string derived from fnv1a32.
 */
export function simpleHash(str: string): string {
  return fnv1a32(str).toString(16).padStart(8, '0');
}

// ─── Consistent hash ──────────────────────────────────────────────────────────

/**
 * Maps a string key to a bucket index in [0, buckets) using murmur3.
 * Distributes keys relatively evenly across buckets.
 */
export function consistentHash(key: string, buckets: number): number {
  if (buckets <= 0) return 0;
  return murmur3(key) % buckets;
}

// ─── Rolling Hash ─────────────────────────────────────────────────────────────

/**
 * Polynomial rolling hash for substring search (Rabin–Karp style).
 * Maintains a running hash that can be updated one character at a time.
 */
export class RollingHash {
  private _base: number;
  private _mod: number;
  private _current: number;

  constructor(base: number = 31, mod: number = 1_000_000_007) {
    this._base = base;
    this._mod = mod;
    this._current = 0;
  }

  /**
   * Computes the polynomial hash of the entire string from scratch
   * and sets the internal state to that hash value.
   */
  hash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * this._base + str.charCodeAt(i)) % this._mod;
    }
    this._current = h;
    return h;
  }

  /**
   * Rolling update: removes outChar (leaving window), adds inChar (entering window).
   * windowSize is the length of the current window (before the update).
   * Returns the new hash value.
   */
  update(outChar: string, inChar: string, windowSize: number): number {
    const base = this._base;
    const mod = this._mod;
    // Compute base^(windowSize-1) mod mod
    let power = 1;
    for (let i = 0; i < windowSize - 1; i++) {
      power = (power * base) % mod;
    }
    const outVal = outChar.charCodeAt(0);
    const inVal = inChar.charCodeAt(0);
    let h = (this._current - (outVal * power) % mod + mod) % mod;
    h = (h * base + inVal) % mod;
    this._current = h;
    return h;
  }
}

// ─── Multi-hash (Bloom-filter style) ─────────────────────────────────────────

/**
 * Returns `count` hash positions in [0, size) derived from the input string.
 * Uses a double-hashing scheme (FNV-1a and DJB2 as independent hashes).
 */
export function multiHash(str: string, count: number, size: number): number[] {
  const h1 = fnv1a32(str);
  const h2 = djb2(str);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(((h1 + i * h2) >>> 0) % size);
  }
  return result;
}
