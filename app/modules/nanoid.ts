// @ts-check
// ─── Nanoid ───────────────────────────────────────────────────────────────────
// Cryptographically-secure compact ID generation, Nanoid-style.
// Uses Node.js crypto.randomFillSync for all randomness.

import { randomFillSync } from 'node:crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default Nanoid alphabet: A-Za-z0-9_- (64 characters, URL-safe). */
export const DEFAULT_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

const DEFAULT_SIZE = 21;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a bitmask large enough to cover `alphabetSize` values uniformly.
 * This avoids modulo bias by rejecting values outside the mask range.
 */
function buildMask(alphabetSize: number): number {
  // Find the smallest 2^n - 1 that is >= alphabetSize - 1
  return (2 << (31 - Math.clz32((alphabetSize - 1) | 1))) - 1;
}

/**
 * Core ID generator. Uses rejection sampling to avoid modulo bias.
 */
function generate(alphabet: string, size: number): string {
  const alphabetSize = alphabet.length;
  if (alphabetSize === 0) throw new RangeError('Alphabet must not be empty');
  if (size <= 0) throw new RangeError('Size must be a positive integer');

  const mask = buildMask(alphabetSize);
  // Over-allocate the random buffer to reduce refill frequency
  const step = Math.ceil((1.6 * mask * size) / alphabetSize);

  let id = '';
  const bytes = new Uint8Array(step);

  while (id.length < size) {
    randomFillSync(bytes);
    for (let i = 0; i < step && id.length < size; i++) {
      const byte = bytes[i] & mask;
      if (byte < alphabetSize) {
        id += alphabet[byte];
      }
    }
  }

  return id;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a Nanoid-style compact random ID using the default alphabet.
 * @param size - Number of characters (default: 21)
 */
export function nanoid(size: number = DEFAULT_SIZE): string {
  return generate(DEFAULT_ALPHABET, size);
}

/**
 * Create a reusable ID generator bound to a custom alphabet and optional size.
 *
 * @example
 *   const hex = customNanoid('0123456789abcdef', 32);
 *   hex(); // "3f9a1c8d..."
 *
 * @param alphabet - Character set to draw from
 * @param size     - Fixed length of generated IDs (default: 21)
 */
export function customNanoid(alphabet: string, size: number = DEFAULT_SIZE): () => string {
  if (alphabet.length === 0) throw new RangeError('Alphabet must not be empty');
  if (size <= 0) throw new RangeError('Size must be a positive integer');
  return () => generate(alphabet, size);
}

/**
 * Generate a URL-safe ID using only unreserved URI characters: A-Za-z0-9~_-.
 * @param size - Number of characters (default: 21)
 */
export function urlFriendlyId(size: number = DEFAULT_SIZE): string {
  const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~_-.';
  return generate(URL_SAFE, size);
}

/**
 * Generate a purely numeric ID.
 * @param digits - Number of digits (default: 21)
 */
export function numericId(digits: number = DEFAULT_SIZE): string {
  return generate('0123456789', digits);
}

/**
 * Generate an alphanumeric ID (A-Za-z0-9 only, no symbols).
 * @param size - Number of characters (default: 21)
 */
export function alphanumericId(size: number = DEFAULT_SIZE): string {
  const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return generate(ALPHANUM, size);
}

/**
 * Validate an ID string against an expected alphabet and optional size.
 *
 * @param id       - The string to validate
 * @param alphabet - Expected character set (default: DEFAULT_ALPHABET)
 * @param size     - Expected length; omit or pass undefined to skip length check
 */
export function isValidNanoid(
  id: string,
  alphabet: string = DEFAULT_ALPHABET,
  size?: number,
): boolean {
  if (typeof id !== 'string' || id.length === 0) return false;
  if (size !== undefined && id.length !== size) return false;
  const allowed = new Set(alphabet);
  for (const ch of id) {
    if (!allowed.has(ch)) return false;
  }
  return true;
}
