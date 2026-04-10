// @ts-check
// ─── Hashing Utilities ────────────────────────────────────────────────────────
// Cryptographic hash, HMAC, password hashing, and checksum helpers built on
// Node.js's built-in `node:crypto` module.

import { createHash, createHmac, pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_HASH_ALGORITHM = 'sha256';
const DEFAULT_HMAC_ALGORITHM = 'sha256';
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = 'sha512';
const DEFAULT_SALT_BYTES = 16;

// ─── Hash ─────────────────────────────────────────────────────────────────────

/**
 * Compute a hex-encoded hash of `data`.
 * @param data - String or Buffer to hash.
 * @param algorithm - Hash algorithm (default `'sha256'`).
 * @returns Hex-encoded digest.
 */
export function hash(data: string | Buffer, algorithm: string = DEFAULT_HASH_ALGORITHM): string {
  return createHash(algorithm).update(data).digest('hex');
}

// ─── HMAC ─────────────────────────────────────────────────────────────────────

/**
 * Compute a hex-encoded HMAC of `data` using `key`.
 * @param key - HMAC key.
 * @param data - Data to authenticate.
 * @param algorithm - HMAC algorithm (default `'sha256'`).
 * @returns Hex-encoded HMAC digest.
 */
export function hmac(
  key: string | Buffer,
  data: string | Buffer,
  algorithm: string = DEFAULT_HMAC_ALGORITHM,
): string {
  return createHmac(algorithm, key).update(data).digest('hex');
}

/**
 * Verify a hex-encoded HMAC using constant-time comparison to prevent timing
 * attacks.
 * @param key - HMAC key.
 * @param data - Data that was authenticated.
 * @param expected - Expected hex-encoded HMAC digest.
 * @param algorithm - HMAC algorithm (default `'sha256'`).
 * @returns `true` if the HMAC matches, `false` otherwise.
 */
export function verifyHmac(
  key: string | Buffer,
  data: string | Buffer,
  expected: string,
  algorithm: string = DEFAULT_HMAC_ALGORITHM,
): boolean {
  const actual = hmac(key, data, algorithm);
  const actualBuf = Buffer.from(actual, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}

// ─── Salt ─────────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random salt encoded as hex.
 * @param bytes - Number of random bytes (default `16`).
 * @returns Hex-encoded random salt.
 */
export function generateSalt(bytes: number = DEFAULT_SALT_BYTES): string {
  return randomBytes(bytes).toString('hex');
}

// ─── Password Hashing ─────────────────────────────────────────────────────────

/**
 * Hash a password using PBKDF2-SHA512.  A random salt is generated
 * automatically when `salt` is not provided.
 * @param password - Plain-text password to hash.
 * @param salt - Optional hex-encoded salt (generated if omitted).
 * @returns Object containing the hex-encoded `hash` and `salt`.
 */
export async function hashPassword(
  password: string,
  salt: string = generateSalt(),
): Promise<{ hash: string; salt: string }> {
  const derivedKey = await pbkdf2Async(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST,
  );
  return { hash: derivedKey.toString('hex'), salt };
}

/**
 * Verify a plain-text password against a stored PBKDF2 hash using
 * constant-time comparison.
 * @param password - Plain-text password to verify.
 * @param storedHash - Hex-encoded hash produced by `hashPassword`.
 * @param salt - Hex-encoded salt stored alongside the hash.
 * @returns `true` if the password matches, `false` otherwise.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
): Promise<boolean> {
  const { hash: derived } = await hashPassword(password, salt);
  const derivedBuf = Buffer.from(derived, 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (derivedBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(derivedBuf, storedBuf);
}

// ─── Checksum ─────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 checksum of a buffer or string.
 * @param data - Buffer or string to checksum.
 * @returns Hex-encoded SHA-256 digest.
 */
export function checksum(data: Buffer | string): string {
  return hash(data, 'sha256');
}
