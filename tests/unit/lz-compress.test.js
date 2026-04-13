// ─── Unit Tests: lz-compress ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  lz77Compress,
  lz77Decompress,
  lzwCompress,
  lzwDecompress,
  LZString,
} from '../../app/modules/lz-compress.js';

// ─── lz77Compress ─────────────────────────────────────────────────────────────

describe('lz77Compress', () => {
  it('returns an empty array for empty input', () => {
    assert.deepEqual(lz77Compress(''), []);
  });

  it('returns a single token for a single character', () => {
    const tokens = lz77Compress('a');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].offset, 0);
    assert.equal(tokens[0].length, 0);
    assert.equal(tokens[0].char, 'a');
  });

  it('returns tokens with correct shape (offset, length, char)', () => {
    const tokens = lz77Compress('abcabc');
    for (const t of tokens) {
      assert.ok(typeof t.offset === 'number');
      assert.ok(typeof t.length === 'number');
      assert.ok(typeof t.char === 'string');
    }
  });

  it('detects repetition: "aaaaaa" uses fewer tokens than its length', () => {
    const tokens = lz77Compress('aaaaaa');
    // The string can be encoded with back-references, so fewer tokens.
    assert.ok(tokens.length < 6, `expected < 6 tokens, got ${tokens.length}`);
  });

  it('produces a back-reference for a repeated pattern', () => {
    // "abab" — the second "ab" should reference the first.
    const tokens = lz77Compress('abab');
    const hasBackRef = tokens.some(t => t.offset > 0 && t.length > 0);
    assert.ok(hasBackRef, 'expected at least one back-reference token');
  });

  it('produces tokens that reconstruct the original string', () => {
    const input = 'abracadabra';
    const tokens = lz77Compress(input);
    assert.equal(lz77Decompress(tokens), input);
  });
});

// ─── lz77Decompress ──────────────────────────────────────────────────────────

describe('lz77Decompress', () => {
  it('returns empty string for empty token array', () => {
    assert.equal(lz77Decompress([]), '');
  });

  it('decompresses a single literal token', () => {
    assert.equal(lz77Decompress([{ offset: 0, length: 0, char: 'x' }]), 'x');
  });

  it('decompresses overlapping back-reference (e.g. "aaa")', () => {
    // offset=1, length=2 means copy 2 chars from one position back → "aa"
    const tokens = [
      { offset: 0, length: 0, char: 'a' },
      { offset: 1, length: 2, char: '' },
    ];
    assert.equal(lz77Decompress(tokens), 'aaa');
  });

  it('roundtrips with lz77Compress for short strings', () => {
    const cases = ['', 'a', 'hello', 'abcabc', 'aaaaaa', 'the quick brown fox'];
    for (const s of cases) {
      assert.equal(lz77Decompress(lz77Compress(s)), s, `failed for: "${s}"`);
    }
  });

  it('roundtrips with lz77Compress for a longer repeated string', () => {
    const input = 'banana'.repeat(10);
    assert.equal(lz77Decompress(lz77Compress(input)), input);
  });

  it('roundtrips with lz77Compress for a string with special characters', () => {
    const input = 'hello, world! 123 \n\t foo';
    assert.equal(lz77Decompress(lz77Compress(input)), input);
  });
});

// ─── lzwCompress ─────────────────────────────────────────────────────────────

describe('lzwCompress', () => {
  it('returns an empty array for empty input', () => {
    assert.deepEqual(lzwCompress(''), []);
  });

  it('returns a single code for a single ASCII character', () => {
    const codes = lzwCompress('a');
    assert.equal(codes.length, 1);
    assert.equal(codes[0], 'a'.charCodeAt(0)); // 97
  });

  it('output codes are all integers', () => {
    const codes = lzwCompress('hello world');
    for (const c of codes) {
      assert.ok(Number.isInteger(c), `expected integer code, got ${c}`);
    }
  });

  it('encodes a repeated string with codes >= 256 for multi-char entries', () => {
    // "aa" should produce code 97 ('a') then 97 ('a') + a new dict entry for "aa".
    const codes = lzwCompress('aaa');
    // First "a" → 97. Second "aa" uses dict entry ≥256. Third "a" → 97 or another entry.
    // At minimum, repeated pattern should produce fewer codes than characters.
    assert.ok(codes.length < 'aaa'.length || codes.some(c => c >= 256),
      'expected compression or multi-char dict entries for "aaa"');
  });

  it('decompresses back to the original string', () => {
    const input = 'TOBEORNOTTOBEORTOBEORNOT';
    assert.equal(lzwDecompress(lzwCompress(input)), input);
  });
});

// ─── lzwDecompress ───────────────────────────────────────────────────────────

describe('lzwDecompress', () => {
  it('returns empty string for empty code array', () => {
    assert.equal(lzwDecompress([]), '');
  });

  it('decompresses a single character code', () => {
    assert.equal(lzwDecompress([65]), 'A');
    assert.equal(lzwDecompress([97]), 'a');
  });

  it('roundtrips with lzwCompress for short strings', () => {
    const cases = ['a', 'ab', 'abc', 'hello', 'AAAA', 'abcabc'];
    for (const s of cases) {
      assert.equal(lzwDecompress(lzwCompress(s)), s, `failed for: "${s}"`);
    }
  });

  it('roundtrips with lzwCompress for a longer repeated string', () => {
    const input = 'abcabc'.repeat(8);
    assert.equal(lzwDecompress(lzwCompress(input)), input);
  });

  it('handles the special case where next code equals dict size', () => {
    // This tests the "aab" style pattern where decoder needs to handle
    // the not-yet-added code. "aaa" compressed has this property.
    const input = 'aaaa';
    assert.equal(lzwDecompress(lzwCompress(input)), input);
  });

  it('roundtrips with lzwCompress for a string with varied characters', () => {
    const input = 'the quick brown fox jumps over the lazy dog';
    assert.equal(lzwDecompress(lzwCompress(input)), input);
  });
});

// ─── LZString.compress / LZString.decompress ─────────────────────────────────

describe('LZString.compress / LZString.decompress', () => {
  it('compress returns a string', () => {
    assert.ok(typeof LZString.compress('hello') === 'string');
  });

  it('decompress returns empty string for empty input', () => {
    assert.equal(LZString.decompress(''), '');
  });

  it('roundtrips short string', () => {
    const input = 'hello world';
    assert.equal(LZString.decompress(LZString.compress(input)), input);
  });

  it('roundtrips empty string', () => {
    assert.equal(LZString.decompress(LZString.compress('')), '');
  });

  it('roundtrips a highly repetitive string', () => {
    const input = 'a'.repeat(100);
    assert.equal(LZString.decompress(LZString.compress(input)), input);
  });

  it('roundtrips a string with varied characters', () => {
    const input = 'the quick brown fox jumps over the lazy dog';
    assert.equal(LZString.decompress(LZString.compress(input)), input);
  });

  it('compressed result is shorter for a repetitive string', () => {
    const input = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const compressed = LZString.compress(input);
    assert.ok(
      compressed.length < input.length,
      `expected compression: input=${input.length} compressed=${compressed.length}`,
    );
  });

  it('roundtrips a JSON-like string', () => {
    const input = '{"name":"NovaReader","version":"1.0","active":true}';
    assert.equal(LZString.decompress(LZString.compress(input)), input);
  });
});

// ─── LZString.compressToBase64 / LZString.decompressFromBase64 ───────────────

describe('LZString.compressToBase64 / LZString.decompressFromBase64', () => {
  it('compressToBase64 returns a string', () => {
    assert.ok(typeof LZString.compressToBase64('hello') === 'string');
  });

  it('output length is a multiple of 4 (valid base-64 padding)', () => {
    for (const s of ['a', 'ab', 'abc', 'abcd', 'hello world']) {
      const b64 = LZString.compressToBase64(s);
      assert.equal(b64.length % 4, 0, `base64 output for "${s}" length ${b64.length} not multiple of 4`);
    }
  });

  it('output only contains base-64 characters', () => {
    const validChars = /^[A-Za-z0-9+/=]*$/;
    const b64 = LZString.compressToBase64('hello world');
    assert.ok(validChars.test(b64), `invalid base64 chars in: ${b64}`);
  });

  it('decompressFromBase64 returns empty string for empty input', () => {
    assert.equal(LZString.decompressFromBase64(''), '');
  });

  it('roundtrips short string', () => {
    const input = 'hello world';
    assert.equal(LZString.decompressFromBase64(LZString.compressToBase64(input)), input);
  });

  it('roundtrips empty string', () => {
    assert.equal(LZString.decompressFromBase64(LZString.compressToBase64('')), '');
  });

  it('roundtrips a highly repetitive string', () => {
    const input = 'b'.repeat(80);
    assert.equal(LZString.decompressFromBase64(LZString.compressToBase64(input)), input);
  });

  it('roundtrips a varied ASCII string', () => {
    const input = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    assert.equal(LZString.decompressFromBase64(LZString.compressToBase64(input)), input);
  });

  it('roundtrips a string with digits and symbols', () => {
    const input = 'version=2.0&lang=en&theme=dark&size=1024';
    assert.equal(LZString.decompressFromBase64(LZString.compressToBase64(input)), input);
  });
});
