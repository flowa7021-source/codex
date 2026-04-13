// @ts-check
// ─── Encoding / Decoding Utilities ───────────────────────────────────────────
// Base64, URL-safe Base64, hex, XOR, PKCS#7 padding, and constant-time buffer
// comparison helpers.  No external dependencies — pure Node.js built-ins.

import { timingSafeEqual } from 'node:crypto';

// ─── Base64 ───────────────────────────────────────────────────────────────────

/**
 * Encode a string or Buffer to standard Base64.
 * @param data - Input string (UTF-8) or Buffer.
 * @returns Base64-encoded string.
 */
export function base64Encode(data: string | Buffer): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  return buf.toString('base64');
}

/**
 * Decode a standard Base64 string to a Buffer.
 * @param data - Base64-encoded string.
 * @returns Decoded Buffer.
 */
export function base64Decode(data: string): Buffer {
  return Buffer.from(data, 'base64');
}

// ─── URL-safe Base64 ──────────────────────────────────────────────────────────

/**
 * Encode a string or Buffer to URL-safe Base64 (RFC 4648 §5).
 * Characters `+` and `/` are replaced with `-` and `_`, and `=` padding is
 * stripped.
 * @param data - Input string (UTF-8) or Buffer.
 * @returns URL-safe Base64-encoded string (no padding).
 */
export function base64UrlEncode(data: string | Buffer): string {
  return base64Encode(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Decode a URL-safe Base64 string (RFC 4648 §5) to a Buffer.
 * @param data - URL-safe Base64 string (padding optional).
 * @returns Decoded Buffer.
 */
export function base64UrlDecode(data: string): Buffer {
  // Re-add standard Base64 characters and padding.
  const standard = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard.padEnd(standard.length + ((4 - (standard.length % 4)) % 4), '=');
  return base64Decode(padded);
}

// ─── Hex ──────────────────────────────────────────────────────────────────────

/**
 * Hex-encode a Buffer or string.
 * @param data - Input Buffer or string (UTF-8).
 * @returns Lowercase hex string.
 */
export function hexEncode(data: Buffer | string): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  return buf.toString('hex');
}

/**
 * Decode a hex string to a Buffer.
 * @param hex - Lowercase or uppercase hex string.
 * @returns Decoded Buffer.
 */
export function hexDecode(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

// ─── XOR ──────────────────────────────────────────────────────────────────────

/**
 * XOR two Buffers together byte-by-byte.  Both buffers must have the same
 * length; throws `RangeError` otherwise.
 * @param a - First buffer.
 * @param b - Second buffer (must be same length as `a`).
 * @returns Buffer containing `a[i] ^ b[i]` for each byte position.
 */
export function xorBuffers(a: Buffer, b: Buffer): Buffer {
  if (a.length !== b.length) {
    throw new RangeError(`xorBuffers: buffers must be the same length (${a.length} vs ${b.length})`);
  }
  const result = Buffer.allocUnsafe(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

// ─── PKCS#7 Padding ───────────────────────────────────────────────────────────

/**
 * Apply PKCS#7 padding to `data` so its length is a multiple of `blockSize`.
 * Block size must be between 1 and 255 (inclusive).
 * @param data - Input Buffer to pad.
 * @param blockSize - Cipher block size in bytes (1–255).
 * @returns New Buffer with PKCS#7 padding appended.
 */
export function pkcs7Pad(data: Buffer, blockSize: number): Buffer {
  if (blockSize < 1 || blockSize > 255) {
    throw new RangeError(`pkcs7Pad: blockSize must be 1–255, got ${blockSize}`);
  }
  const padLen = blockSize - (data.length % blockSize);
  const padded = Buffer.allocUnsafe(data.length + padLen);
  data.copy(padded);
  padded.fill(padLen, data.length);
  return padded;
}

/**
 * Remove PKCS#7 padding from a Buffer.
 * Throws `RangeError` if the padding is invalid.
 * @param data - Padded Buffer.
 * @returns Buffer with padding removed.
 */
export function pkcs7Unpad(data: Buffer): Buffer {
  if (data.length === 0) {
    throw new RangeError('pkcs7Unpad: empty buffer');
  }
  const padLen = data[data.length - 1];
  if (padLen === 0 || padLen > data.length) {
    throw new RangeError(`pkcs7Unpad: invalid padding byte ${padLen}`);
  }
  // Validate that all padding bytes have the correct value.
  for (let i = data.length - padLen; i < data.length; i++) {
    if (data[i] !== padLen) {
      throw new RangeError('pkcs7Unpad: inconsistent padding bytes');
    }
  }
  return data.subarray(0, data.length - padLen);
}

// ─── Constant-time Comparison ─────────────────────────────────────────────────

/**
 * Compare two Buffers in constant time to prevent timing attacks.
 * Returns `false` immediately (without a constant-time scan) if lengths differ,
 * because the length difference is not a secret.
 * @param a - First buffer.
 * @param b - Second buffer.
 * @returns `true` if `a` and `b` have identical contents, `false` otherwise.
 */
export function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  // Node's timingSafeEqual performs the constant-time comparison.
  return timingSafeEqual(a, b);
}
