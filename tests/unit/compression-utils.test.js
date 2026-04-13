// ─── Unit Tests: compression-utils ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isCompressionSupported,
  compress,
  decompress,
  compressText,
  decompressText,
  compressToBase64,
  decompressFromBase64,
} from '../../app/modules/compression-utils.js';

// ─── isCompressionSupported ───────────────────────────────────────────────────

describe('isCompressionSupported', () => {
  it('returns a boolean', () => {
    const result = isCompressionSupported();
    assert.equal(typeof result, 'boolean');
  });
});

// ─── Compression tests (skipped when CompressionStream unavailable) ───────────

if (!isCompressionSupported()) {
  // Just verify the support check works — no further tests possible
  describe('compression (skipped — CompressionStream unavailable)', () => {
    it('isCompressionSupported returns false', () => {
      assert.equal(isCompressionSupported(), false);
    });
  });
} else {
  // ─── compress / decompress ──────────────────────────────────────────────────

  describe('compress / decompress roundtrip', () => {
    it('restores original bytes after gzip compress+decompress', async () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 100, 200, 255]);
      const compressed = await compress(original);
      const restored = await decompress(compressed);
      assert.deepEqual(restored, original);
    });

    it('restores original bytes using deflate format', async () => {
      const original = new Uint8Array([10, 20, 30, 40, 50]);
      const compressed = await compress(original, 'deflate');
      const restored = await decompress(compressed, 'deflate');
      assert.deepEqual(restored, original);
    });

    it('restores original bytes using deflate-raw format', async () => {
      const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const compressed = await compress(original, 'deflate-raw');
      const restored = await decompress(compressed, 'deflate-raw');
      assert.deepEqual(restored, original);
    });

    it('handles an empty Uint8Array', async () => {
      const original = new Uint8Array(0);
      const compressed = await compress(original);
      const restored = await decompress(compressed);
      assert.deepEqual(restored, original);
    });

    it('handles a single-byte array', async () => {
      const original = new Uint8Array([42]);
      const compressed = await compress(original);
      const restored = await decompress(compressed);
      assert.deepEqual(restored, original);
    });
  });

  // ─── compressText / decompressText ─────────────────────────────────────────

  describe('compressText / decompressText roundtrip', () => {
    it('restores an ASCII string', async () => {
      const text = 'Hello, World!';
      const compressed = await compressText(text);
      const restored = await decompressText(compressed);
      assert.equal(restored, text);
    });

    it('restores a Unicode string with emoji', async () => {
      const text = 'NovaReader \u{1F4D6} \u00e9\u00e0\u00fc';
      const compressed = await compressText(text);
      const restored = await decompressText(compressed);
      assert.equal(restored, text);
    });

    it('restores an empty string', async () => {
      const compressed = await compressText('');
      const restored = await decompressText(compressed);
      assert.equal(restored, '');
    });

    it('returns a Uint8Array from compressText', async () => {
      const result = await compressText('test');
      assert.ok(result instanceof Uint8Array);
    });
  });

  // ─── compressToBase64 / decompressFromBase64 ───────────────────────────────

  describe('compressToBase64 / decompressFromBase64 roundtrip', () => {
    it('returns a string from compressToBase64', async () => {
      const data = new Uint8Array([1, 2, 3]);
      const result = await compressToBase64(data);
      assert.equal(typeof result, 'string');
    });

    it('restores original bytes after base64 roundtrip', async () => {
      const original = new Uint8Array([10, 20, 30, 40, 50, 60]);
      const b64 = await compressToBase64(original);
      const restored = await decompressFromBase64(b64);
      assert.deepEqual(restored, original);
    });

    it('base64 string contains only valid base64 characters', async () => {
      const data = new Uint8Array(64).fill(0xab);
      const b64 = await compressToBase64(data);
      assert.match(b64, /^[A-Za-z0-9+/]+=*$/);
    });

    it('handles empty array in base64 roundtrip', async () => {
      const original = new Uint8Array(0);
      const b64 = await compressToBase64(original);
      const restored = await decompressFromBase64(b64);
      assert.deepEqual(restored, original);
    });
  });

  // ─── compressed size ───────────────────────────────────────────────────────

  describe('compressed size', () => {
    it('produces smaller output for highly repetitive data', async () => {
      // 1000 bytes of the same value compresses very well
      const repetitive = new Uint8Array(1000).fill(0xaa);
      const compressed = await compress(repetitive);
      assert.ok(
        compressed.length < repetitive.length,
        `Compressed size (${compressed.length}) should be less than original (${repetitive.length})`,
      );
    });
  });
}
