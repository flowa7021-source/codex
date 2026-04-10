// @ts-check
// ─── UUID ─────────────────────────────────────────────────────────────────────
// UUID v3 (MD5), v4 (random), v5 (SHA-1) generation, validation, and parsing.
// Uses Node.js crypto module exclusively.

import { createHash, randomBytes } from 'node:crypto';

// ─── Standard Namespace UUIDs ─────────────────────────────────────────────────

/** Standard DNS namespace UUID. */
export const UUID_NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/** Standard URL namespace UUID. */
export const UUID_NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

/** Standard OID namespace UUID. */
export const UUID_NAMESPACE_OID = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse a UUID string into a 16-byte Uint8Array.
 * Returns null if the string is not a valid UUID.
 */
function uuidToBytes(uuid: string): Uint8Array | null {
  if (!UUID_PATTERN.test(uuid)) return null;
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Format 16 bytes into a UUID string (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
 */
function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Core of named UUID generation (v3 / v5).
 * @param hashAlgorithm - 'md5' for v3, 'sha1' for v5
 * @param version       - 3 or 5
 */
function namedUUID(
  hashAlgorithm: 'md5' | 'sha1',
  version: 3 | 5,
  namespace: string,
  name: string,
): string {
  const nsBytes = uuidToBytes(namespace);
  if (!nsBytes) {
    throw new TypeError(`Invalid namespace UUID: "${namespace}"`);
  }
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = createHash(hashAlgorithm)
    .update(nsBytes)
    .update(nameBytes)
    .digest();

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = hash[i];

  // Set version nibble (bits 76-79 of octet 6)
  bytes[6] = (bytes[6] & 0x0f) | (version << 4);
  // Set variant: RFC 4122 variant bits 10xx (bits 6-7 of octet 8)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuid(bytes);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a random UUID v4.
 * Uses 122 random bits; version and variant bits are set per RFC 4122.
 */
export function uuidV4(): string {
  const bytes = new Uint8Array(randomBytes(16));
  // Version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // RFC 4122 variant
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

/**
 * Generate a deterministic UUID v5 (SHA-1 based) for a given namespace + name.
 * @param namespace - A valid UUID string (use UUID_NAMESPACE_* constants)
 * @param name      - Arbitrary string to hash
 */
export function uuidV5(namespace: string, name: string): string {
  return namedUUID('sha1', 5, namespace, name);
}

/**
 * Generate a deterministic UUID v3 (MD5 based) for a given namespace + name.
 * @param namespace - A valid UUID string (use UUID_NAMESPACE_* constants)
 * @param name      - Arbitrary string to hash
 */
export function uuidV3(namespace: string, name: string): string {
  return namedUUID('md5', 3, namespace, name);
}

/**
 * Return true if `str` is a well-formed UUID (any version/variant).
 */
export function isValidUUID(str: string): boolean {
  return UUID_PATTERN.test(str);
}

/**
 * Parse a UUID string and return its version, variant, and raw bytes.
 * Returns null if `str` is not a valid UUID.
 */
export function parseUUID(
  str: string,
): { version: number; variant: number; bytes: Uint8Array } | null {
  const bytes = uuidToBytes(str);
  if (!bytes) return null;

  // Version is the high nibble of byte 6
  const version = (bytes[6] >>> 4) & 0x0f;

  // Variant is encoded in the high bits of byte 8
  // RFC 4122: 10xx -> variant 1 (standard); 110x -> variant 2 (Microsoft)
  const highBits = bytes[8] >>> 5;
  let variant: number;
  if ((highBits & 0b100) === 0) {
    variant = 0; // NCS backward compatibility (0xx)
  } else if ((highBits & 0b110) === 0b100) {
    variant = 1; // RFC 4122 (10x)
  } else if ((highBits & 0b111) === 0b110) {
    variant = 2; // Microsoft (110)
  } else {
    variant = 3; // Reserved (111)
  }

  return { version, variant, bytes };
}
