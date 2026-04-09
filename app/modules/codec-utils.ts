// @ts-check
// ─── Codec Utilities ─────────────────────────────────────────────────────────
// Data encoding/decoding utilities: base64, hex, UTF-8, numeric, XOR.
// No browser APIs — uses Buffer for base64 and manual implementations.

// ─── Base64 ──────────────────────────────────────────────────────────────────

/** Encode bytes to base64. Works with Uint8Array or string. */
export function toBase64(data: Uint8Array | string): string {
  if (typeof data === 'string') {
    return Buffer.from(data, 'utf8').toString('base64');
  }
  return Buffer.from(data).toString('base64');
}

/** Decode base64 to Uint8Array. */
export function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

// ─── URL-safe Base64 ─────────────────────────────────────────────────────────

/** URL-safe base64 encoding (replaces +/= with -_~). */
export function toBase64Url(data: Uint8Array | string): string {
  return toBase64(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '~');
}

/** Decode URL-safe base64. */
export function fromBase64Url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').replace(/~/g, '=');
  return fromBase64(b64);
}

// ─── Hex ─────────────────────────────────────────────────────────────────────

/** Encode bytes to hex string. */
export function toHex(data: Uint8Array | number[]): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Decode hex string to Uint8Array. */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of characters');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ─── UTF-8 ───────────────────────────────────────────────────────────────────

/** Encode string to UTF-8 bytes. */
export function encodeUTF8(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'utf8'));
}

/** Decode UTF-8 bytes to string. */
export function decodeUTF8(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8');
}

// ─── Numeric ─────────────────────────────────────────────────────────────────

/** Encode number to big-endian bytes (byteLength bytes). */
export function numberToBytes(value: number, byteLength: number): Uint8Array {
  if (byteLength <= 0) return new Uint8Array(0);
  const bytes = new Uint8Array(byteLength);
  let v = Math.floor(value);
  for (let i = byteLength - 1; i >= 0; i--) {
    bytes[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  return bytes;
}

/** Decode big-endian bytes to number. */
export function bytesToNumber(bytes: Uint8Array): number {
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value = value * 256 + bytes[i];
  }
  return value;
}

// ─── Bitwise ─────────────────────────────────────────────────────────────────

/** XOR two byte arrays (same length). */
export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) {
    throw new Error('xorBytes: arrays must have the same length');
  }
  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}
