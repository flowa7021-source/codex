// ─── Cryptographic Utilities ─────────────────────────────────────────────────
// @ts-check
// Web Crypto API helpers for NovaReader.

// ─── UUID ────────────────────────────────────────────────────────────────────

/** Generate a random UUID v4. */
export function generateUUID(): string {
  return crypto.randomUUID();
}

// ─── Random Bytes ────────────────────────────────────────────────────────────

/** Generate N random bytes as Uint8Array. */
export function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

// ─── Encoding ────────────────────────────────────────────────────────────────

/** Encode bytes to hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Decode hex string to bytes. */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return result;
}

/** Encode bytes to base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Decode base64 string to bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
}

// ─── Hashing ─────────────────────────────────────────────────────────────────

/** Hash a string using SHA-256. Returns hex string. */
export async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(hashBuf));
}

/** Hash a string using SHA-1. Returns hex string. */
export async function sha1(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-1', encoded);
  return bytesToHex(new Uint8Array(hashBuf));
}

// ─── Comparison ──────────────────────────────────────────────────────────────

/** Compare two Uint8Arrays in constant time (safe against timing attacks). */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
