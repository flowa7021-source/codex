// @ts-check
// ─── Hash Utilities ───────────────────────────────────────────────────────────
// Hashing helpers using Node.js built-in `crypto` plus pure-JS non-crypto
// hash algorithms (CRC32, FNV-1a, MurmurHash3, consistent hash).

import { createHash, createReadStream } from 'node:crypto';
import type { PathLike } from 'node:fs';

// ─── Crypto hashes ───────────────────────────────────────────────────────────

/**
 * Compute MD5 hex digest. Suitable for checksums — NOT security-sensitive use.
 * @param {string | Buffer} data
 * @returns {string} Lowercase 32-character hex string.
 */
export function md5(data: string | Buffer): string {
  return createHash('md5').update(data).digest('hex');
}

/**
 * Compute SHA-1 hex digest.
 * @param {string | Buffer} data
 * @returns {string} Lowercase 40-character hex string.
 */
export function sha1(data: string | Buffer): string {
  return createHash('sha1').update(data).digest('hex');
}

/**
 * Compute SHA-256 hex digest.
 * @param {string | Buffer} data
 * @returns {string} Lowercase 64-character hex string.
 */
export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Compute SHA-512 hex digest.
 * @param {string | Buffer} data
 * @returns {string} Lowercase 128-character hex string.
 */
export function sha512(data: string | Buffer): string {
  return createHash('sha512').update(data).digest('hex');
}

// ─── hashFile ────────────────────────────────────────────────────────────────

/**
 * Hash the entire contents of a file.
 * @param {string} filePath - Absolute or relative path to the file.
 * @param {string} [algorithm='sha256']
 * @returns {Promise<string>} Hex digest.
 */
export function hashFile(filePath: string, algorithm: string = 'sha256'): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(filePath as PathLike);
    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ─── checksum ────────────────────────────────────────────────────────────────

/**
 * Generic checksum — delegates to the named algorithm.
 * @param {string} data
 * @param {string} [algorithm='sha256']
 * @returns {string} Hex digest.
 */
export function checksum(data: string, algorithm: string = 'sha256'): string {
  return createHash(algorithm).update(data, 'utf8').digest('hex');
}

// ─── CRC32 ───────────────────────────────────────────────────────────────────

// Pre-compute the CRC32 lookup table (IEEE 802.3 polynomial 0xEDB88320).
const _crc32Table: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

/**
 * Compute CRC32 checksum (IEEE 802.3 polynomial).
 * @param {string | Buffer} data
 * @returns {number} Unsigned 32-bit CRC32 value.
 */
export function crc32(data: string | Buffer): number {
  const buf: Buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = _crc32Table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0; // convert to unsigned
}

// ─── FNV-1a ──────────────────────────────────────────────────────────────────

const FNV_PRIME_32 = 0x01000193;
const FNV_OFFSET_BASIS_32 = 0x811c9dc5;

/**
 * FNV-1a 32-bit hash.
 * @param {string} data - UTF-8 string to hash.
 * @returns {number} Unsigned 32-bit hash value.
 */
export function fnv1a(data: string): number {
  const buf = Buffer.from(data, 'utf8');
  let hash = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < buf.length; i++) {
    hash ^= buf[i];
    // Multiply by FNV prime using 32-bit arithmetic via Math.imul.
    hash = Math.imul(hash, FNV_PRIME_32) >>> 0;
  }
  return hash >>> 0;
}

// ─── MurmurHash3 (32-bit) ────────────────────────────────────────────────────

/**
 * MurmurHash3 32-bit hash.
 * @param {string} data - UTF-8 string to hash.
 * @param {number} [seed=0]
 * @returns {number} Unsigned 32-bit hash value.
 */
export function murmurhash3(data: string, seed: number = 0): number {
  const buf = Buffer.from(data, 'utf8');
  const len = buf.length;
  const nblocks = len >>> 2; // number of 4-byte blocks

  let h1 = seed >>> 0;

  const C1 = 0xcc9e2d51;
  const C2 = 0x1b873593;

  // Process 4-byte blocks
  for (let i = 0; i < nblocks; i++) {
    let k1 = buf.readUInt32LE(i * 4);
    k1 = Math.imul(k1, C1) >>> 0;
    k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0; // ROTL32(k1, 15)
    k1 = Math.imul(k1, C2) >>> 0;

    h1 ^= k1;
    h1 = ((h1 << 13) | (h1 >>> 19)) >>> 0; // ROTL32(h1, 13)
    h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
  }

  // Process remaining bytes (tail)
  const tailStart = nblocks * 4;
  let k1 = 0;
  const remaining = len & 3;
  if (remaining >= 3) k1 ^= buf[tailStart + 2] << 16;
  if (remaining >= 2) k1 ^= buf[tailStart + 1] << 8;
  if (remaining >= 1) {
    k1 ^= buf[tailStart];
    k1 = Math.imul(k1, C1) >>> 0;
    k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0;
    k1 = Math.imul(k1, C2) >>> 0;
    h1 ^= k1;
  }

  // Finalization mix
  h1 ^= len;
  // fmix32
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b) >>> 0;
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35) >>> 0;
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

// ─── consistentHash ──────────────────────────────────────────────────────────

/**
 * Map a string key to a bucket index in [0, buckets) using jump consistent
 * hashing seeded by FNV-1a.
 * @param {string} key
 * @param {number} buckets - Total number of buckets (must be >= 1).
 * @returns {number} Bucket index in [0, buckets).
 */
export function consistentHash(key: string, buckets: number): number {
  if (!Number.isInteger(buckets) || buckets < 1) {
    throw new RangeError(
      `consistentHash: buckets must be a positive integer, got ${buckets}`,
    );
  }
  // Use FNV-1a as the seed for jump consistent hashing.
  // Jump consistent hash (Lamping & Veach 2014) — integer arithmetic version.
  let h = BigInt(fnv1a(key));
  let b = -1n;
  let j = 0n;
  const numBuckets = BigInt(buckets);
  while (j < numBuckets) {
    b = j;
    h = (h * 2862933555777941757n + 1n) & 0xffffffffffffffffn;
    j = BigInt(Math.floor(Number((b + 1n) * (2n ** 31n)) / Number((h >> 33n) + 1n)));
  }
  return Number(b);
}
