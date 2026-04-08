// ─── File Integrity (Web Crypto SHA-256) ─────────────────────────────────────
// Computes and verifies SHA-256 checksums of document files using the Web
// Crypto API, providing tamper detection for cached files.

// @ts-check

const STORAGE_KEY = 'nr4_file_hashes';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface FileHash {
  algorithm: 'SHA-256';
  hash: string;       // hex-encoded
  size: number;       // file size in bytes
  computedAt: number; // timestamp
}

export interface IntegrityStore {
  [fileName: string]: FileHash;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert an ArrayBuffer to a lowercase hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Normalise input to ArrayBuffer so SubtleCrypto.digest() can accept it.
 */
function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  // Uint8Array — slice out underlying buffer region
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

// ─── Core Hash Functions ─────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash of the given data, returning a 64-char hex string.
 */
export async function computeHash(data: ArrayBuffer | Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(data));
  return bufferToHex(hashBuffer);
}

/**
 * Compute a SHA-256 hash and return a full FileHash descriptor.
 */
export async function computeFileHash(data: ArrayBuffer | Uint8Array): Promise<FileHash> {
  const hash = await computeHash(data);
  const size = data instanceof ArrayBuffer ? data.byteLength : data.byteLength;
  return {
    algorithm: 'SHA-256',
    hash,
    size,
    computedAt: Date.now(),
  };
}

/**
 * Compute the SHA-256 hash of the given data and compare it to an expected
 * hex string. Returns true when the hashes match exactly.
 */
export async function verifyHash(
  data: ArrayBuffer | Uint8Array,
  expectedHash: string,
): Promise<boolean> {
  const actual = await computeHash(data);
  return actual === expectedHash.toLowerCase();
}

// ─── Streaming Hash (large files) ────────────────────────────────────────────

/**
 * Incrementally hash a ReadableStream using SubtleCrypto.
 * Collects all chunks, then digests the concatenated bytes.
 * Returns a 64-char hex string identical to computeHash() for the same data.
 */
export async function computeHashChunked(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.byteLength;
  }

  // Concatenate all chunks into a single buffer
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return computeHash(combined);
}

// ─── LocalStorage Persistence ────────────────────────────────────────────────

/**
 * Load the entire integrity store from localStorage. Returns an empty object
 * when nothing has been stored yet or parsing fails.
 */
function loadStore(): IntegrityStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    return JSON.parse(raw) as IntegrityStore;
  } catch {
    return {};
  }
}

/**
 * Persist the integrity store to localStorage.
 */
function saveStore(store: IntegrityStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('[file-integrity] failed to save hash store:', (err as Error)?.message);
  }
}

/**
 * Persist a FileHash entry for the given file name.
 */
export function storeHash(fileName: string, hash: FileHash): void {
  const store = loadStore();
  store[fileName] = hash;
  saveStore(store);
}

/**
 * Retrieve the stored FileHash for the given file name, or null if none exists.
 */
export function getStoredHash(fileName: string): FileHash | null {
  const store = loadStore();
  return store[fileName] ?? null;
}

/**
 * Remove the stored hash entry for the given file name.
 */
export function removeStoredHash(fileName: string): void {
  const store = loadStore();
  delete store[fileName];
  saveStore(store);
}

/**
 * Return a copy of all stored hashes.
 */
export function getAllStoredHashes(): IntegrityStore {
  return loadStore();
}

// ─── High-Level Verification ─────────────────────────────────────────────────

/**
 * Verify file data against the hash stored under the given file name.
 *
 * - 'match'    — hash was found and data matches
 * - 'mismatch' — hash was found but data differs
 * - 'unknown'  — no hash has been stored for this file name
 */
export async function verifyStoredFile(
  fileName: string,
  data: ArrayBuffer | Uint8Array,
): Promise<'match' | 'mismatch' | 'unknown'> {
  const stored = getStoredHash(fileName);
  if (stored === null) return 'unknown';

  const matches = await verifyHash(data, stored.hash);
  return matches ? 'match' : 'mismatch';
}
