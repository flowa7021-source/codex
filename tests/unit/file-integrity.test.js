// ─── Unit Tests: File Integrity ──────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeHash,
  computeFileHash,
  verifyHash,
  storeHash,
  getStoredHash,
  removeStoredHash,
  verifyStoredFile,
  computeHashChunked,
  getAllStoredHashes,
} from '../../app/modules/file-integrity.js';

// Known SHA-256 values (verified against Node.js crypto.subtle)
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
// SHA-256 of the 3-byte sequence [0x61, 0x62, 0x63] = "abc"
const ABC_SHA256   = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
// "abc" as bytes
const ABC_BYTES = new Uint8Array([0x61, 0x62, 0x63]);

// ─── computeHash ─────────────────────────────────────────────────────────────

describe('computeHash()', () => {
  it('returns a 64-character hex string for known input', async () => {
    const hash = await computeHash(ABC_BYTES);
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('returns the correct SHA-256 of "abc"', async () => {
    const hash = await computeHash(ABC_BYTES);
    assert.equal(hash, ABC_SHA256);
  });

  it('returns the known SHA-256 of empty data', async () => {
    const hash = await computeHash(new ArrayBuffer(0));
    assert.equal(hash, EMPTY_SHA256);
  });

  it('returns the known SHA-256 of empty Uint8Array', async () => {
    const hash = await computeHash(new Uint8Array(0));
    assert.equal(hash, EMPTY_SHA256);
  });

  it('is deterministic — same input yields same output', async () => {
    const input = new TextEncoder().encode('determinism test 12345');
    const hash1 = await computeHash(input);
    const hash2 = await computeHash(input);
    assert.equal(hash1, hash2);
  });

  it('accepts ArrayBuffer directly', async () => {
    const buf = ABC_BYTES.buffer.slice(ABC_BYTES.byteOffset, ABC_BYTES.byteOffset + ABC_BYTES.byteLength);
    const hash = await computeHash(buf);
    assert.equal(hash, ABC_SHA256);
  });
});

// ─── computeFileHash ─────────────────────────────────────────────────────────

describe('computeFileHash()', () => {
  it('returns an object with the correct shape', async () => {
    const result = await computeFileHash(ABC_BYTES);
    assert.equal(result.algorithm, 'SHA-256');
    assert.equal(typeof result.hash, 'string');
    assert.equal(result.hash.length, 64);
    assert.equal(typeof result.size, 'number');
    assert.equal(typeof result.computedAt, 'number');
  });

  it('hash field matches computeHash()', async () => {
    const result = await computeFileHash(ABC_BYTES);
    const direct = await computeHash(ABC_BYTES);
    assert.equal(result.hash, direct);
  });

  it('size field reflects byte length of input', async () => {
    const data = new Uint8Array(128);
    const result = await computeFileHash(data);
    assert.equal(result.size, 128);
  });

  it('computedAt is a recent timestamp', async () => {
    const before = Date.now();
    const result = await computeFileHash(ABC_BYTES);
    const after  = Date.now();
    assert.ok(result.computedAt >= before, 'computedAt should be >= before');
    assert.ok(result.computedAt <= after,  'computedAt should be <= after');
  });
});

// ─── verifyHash ──────────────────────────────────────────────────────────────

describe('verifyHash()', () => {
  it('returns true for the correct hash', async () => {
    const ok = await verifyHash(ABC_BYTES, ABC_SHA256);
    assert.equal(ok, true);
  });

  it('returns false for an incorrect hash', async () => {
    const ok = await verifyHash(ABC_BYTES, 'deadbeef'.repeat(8));
    assert.equal(ok, false);
  });

  it('is case-insensitive for the expected hash', async () => {
    const upper = ABC_SHA256.toUpperCase();
    const ok = await verifyHash(ABC_BYTES, upper);
    assert.equal(ok, true);
  });

  it('returns false when data is modified', async () => {
    const modified = new Uint8Array([0x61, 0x62, 0x64]); // "abd" not "abc"
    const ok = await verifyHash(modified, ABC_SHA256);
    assert.equal(ok, false);
  });
});

// ─── storeHash / getStoredHash round-trip ────────────────────────────────────

describe('storeHash() / getStoredHash()', () => {
  beforeEach(() => {
    // Clear relevant key before each test
    localStorage.removeItem('nr4_file_hashes');
  });

  it('round-trip stores and retrieves a FileHash', async () => {
    const fh = await computeFileHash(ABC_BYTES);
    storeHash('doc.pdf', fh);
    const retrieved = getStoredHash('doc.pdf');
    assert.deepEqual(retrieved, fh);
  });

  it('returns null for a file name that was never stored', () => {
    const result = getStoredHash('nonexistent.djvu');
    assert.equal(result, null);
  });

  it('overwrites a previous entry for the same file name', async () => {
    const fh1 = await computeFileHash(ABC_BYTES);
    storeHash('doc.pdf', fh1);

    const newData = new TextEncoder().encode('updated content');
    const fh2 = await computeFileHash(newData);
    storeHash('doc.pdf', fh2);

    const retrieved = getStoredHash('doc.pdf');
    assert.deepEqual(retrieved, fh2);
  });
});

// ─── removeStoredHash ────────────────────────────────────────────────────────

describe('removeStoredHash()', () => {
  beforeEach(() => {
    localStorage.removeItem('nr4_file_hashes');
  });

  it('removes a stored hash entry', async () => {
    const fh = await computeFileHash(ABC_BYTES);
    storeHash('remove-me.pdf', fh);
    assert.notEqual(getStoredHash('remove-me.pdf'), null);

    removeStoredHash('remove-me.pdf');
    assert.equal(getStoredHash('remove-me.pdf'), null);
  });

  it('is a no-op for a file name that does not exist', () => {
    // Should not throw
    assert.doesNotThrow(() => removeStoredHash('ghost.pdf'));
  });
});

// ─── verifyStoredFile ────────────────────────────────────────────────────────

describe('verifyStoredFile()', () => {
  beforeEach(() => {
    localStorage.removeItem('nr4_file_hashes');
  });

  it('returns "unknown" when no hash is stored', async () => {
    const result = await verifyStoredFile('unknown.pdf', ABC_BYTES);
    assert.equal(result, 'unknown');
  });

  it('returns "match" after storing the hash of the same data', async () => {
    const fh = await computeFileHash(ABC_BYTES);
    storeHash('test.pdf', fh);
    const result = await verifyStoredFile('test.pdf', ABC_BYTES);
    assert.equal(result, 'match');
  });

  it('returns "mismatch" when data differs from stored hash', async () => {
    const fh = await computeFileHash(ABC_BYTES);
    storeHash('test.pdf', fh);

    const different = new TextEncoder().encode('completely different content');
    const result = await verifyStoredFile('test.pdf', different);
    assert.equal(result, 'mismatch');
  });
});

// ─── getAllStoredHashes ───────────────────────────────────────────────────────

describe('getAllStoredHashes()', () => {
  beforeEach(() => {
    localStorage.removeItem('nr4_file_hashes');
  });

  it('returns an empty object when nothing is stored', () => {
    const all = getAllStoredHashes();
    assert.deepEqual(all, {});
  });

  it('returns all stored entries', async () => {
    const fh1 = await computeFileHash(ABC_BYTES);
    const fh2 = await computeFileHash(new TextEncoder().encode('another doc'));
    storeHash('a.pdf', fh1);
    storeHash('b.djvu', fh2);

    const all = getAllStoredHashes();
    assert.deepEqual(all['a.pdf'],  fh1);
    assert.deepEqual(all['b.djvu'], fh2);
    assert.equal(Object.keys(all).length, 2);
  });
});

// ─── computeHashChunked ──────────────────────────────────────────────────────

describe('computeHashChunked()', () => {
  /**
   * Build a ReadableStream that emits the provided Uint8Array as a single chunk.
   */
  function makeStream(data) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
  }

  /**
   * Build a ReadableStream that emits data split across multiple chunks.
   */
  function makeChunkedStream(data, chunkSize) {
    return new ReadableStream({
      start(controller) {
        let offset = 0;
        while (offset < data.length) {
          controller.enqueue(data.slice(offset, offset + chunkSize));
          offset += chunkSize;
        }
        controller.close();
      },
    });
  }

  it('produces the same result as computeHash() for identical data', async () => {
    const data = new TextEncoder().encode('Hello, chunked world!');
    const direct  = await computeHash(data);
    const chunked = await computeHashChunked(makeStream(data));
    assert.equal(chunked, direct);
  });

  it('produces the correct hash for empty stream', async () => {
    const chunked = await computeHashChunked(makeStream(new Uint8Array(0)));
    assert.equal(chunked, EMPTY_SHA256);
  });

  it('produces the same hash regardless of chunk boundaries', async () => {
    const data = new TextEncoder().encode('The quick brown fox jumps over the lazy dog');
    const direct       = await computeHash(data);
    const chunked4     = await computeHashChunked(makeChunkedStream(data, 4));
    const chunked1     = await computeHashChunked(makeChunkedStream(data, 1));
    const chunkEntire  = await computeHashChunked(makeStream(data));

    assert.equal(chunked4, direct);
    assert.equal(chunked1, direct);
    assert.equal(chunkEntire, direct);
  });
});
