import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCompressionStreamsSupported,
  compress,
  decompress,
  compressString,
  decompressString,
} from '../../app/modules/compression-streams.js';

describe('isCompressionStreamsSupported', () => {
  it('returns a boolean', () => {
    const result = isCompressionStreamsSupported();
    assert.equal(typeof result, 'boolean');
  });
});

describe('compress + decompress roundtrip', () => {
  it('roundtrips with gzip (default)', async () => {
    const original = new Uint8Array([72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100]);
    const compressed = await compress(original);
    const decompressed = await decompress(compressed);
    assert.deepEqual(decompressed, original);
  });

  it('roundtrips with gzip (explicit)', async () => {
    const original = new TextEncoder().encode('The quick brown fox jumps over the lazy dog');
    const compressed = await compress(original, 'gzip');
    const decompressed = await decompress(compressed, 'gzip');
    assert.deepEqual(decompressed, original);
  });

  it('roundtrips with deflate format', async () => {
    const original = new TextEncoder().encode('Deflate format roundtrip test data 12345');
    const compressed = await compress(original, 'deflate');
    const decompressed = await decompress(compressed, 'deflate');
    assert.deepEqual(decompressed, original);
  });

  it('roundtrips with deflate-raw format', async () => {
    const original = new TextEncoder().encode('Deflate-raw format roundtrip test');
    const compressed = await compress(original, 'deflate-raw');
    const decompressed = await decompress(compressed, 'deflate-raw');
    assert.deepEqual(decompressed, original);
  });
});

describe('compressString + decompressString roundtrip', () => {
  it('roundtrips a plain ASCII string', async () => {
    const original = 'Hello, World! This is a compression test.';
    const compressed = await compressString(original);
    const result = await decompressString(compressed);
    assert.equal(result, original);
  });

  it('roundtrips a string with Unicode characters', async () => {
    const original = 'Héllo Wörld! 日本語テスト 🌍🎉';
    const compressed = await compressString(original);
    const result = await decompressString(compressed);
    assert.equal(result, original);
  });

  it('roundtrips an empty string', async () => {
    const compressed = await compressString('');
    const result = await decompressString(compressed);
    assert.equal(result, '');
  });
});

describe('compression reduces size for compressible data', () => {
  it('compressed output is smaller than input for repetitive data', async () => {
    const repetitive = 'abcdefghij'.repeat(1000);
    const original = new TextEncoder().encode(repetitive);
    const compressed = await compress(original, 'gzip');
    assert.ok(
      compressed.length < original.length,
      `Expected compressed (${compressed.length}) < original (${original.length})`,
    );
  });
});

describe('handles empty input', () => {
  it('compress handles empty Uint8Array', async () => {
    const empty = new Uint8Array(0);
    const compressed = await compress(empty);
    const decompressed = await decompress(compressed);
    assert.equal(decompressed.length, 0);
  });

  it('decompress of compressed empty data yields empty', async () => {
    const empty = new Uint8Array(0);
    const compressed = await compress(empty, 'deflate');
    const decompressed = await decompress(compressed, 'deflate');
    assert.equal(decompressed.length, 0);
  });
});

describe('error handling', () => {
  it('decompress rejects for invalid compressed data (gzip)', async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await assert.rejects(async () => {
      await decompress(garbage, 'gzip');
    });
  });

  it('decompress rejects for invalid compressed data (deflate)', async () => {
    const garbage = new Uint8Array([255, 254, 253, 252, 251, 250]);
    await assert.rejects(async () => {
      await decompress(garbage, 'deflate');
    });
  });

  it('decompress rejects for invalid compressed data (deflate-raw)', async () => {
    const garbage = new Uint8Array([255, 254, 253, 252, 251, 250]);
    await assert.rejects(async () => {
      await decompress(garbage, 'deflate-raw');
    });
  });
});
