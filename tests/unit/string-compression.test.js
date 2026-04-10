// ─── Unit Tests: String Compression ─────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  lz77Encode,
  lz77Decode,
  lz78Encode,
  lz78Decode,
  compressionStats,
} from '../../app/modules/string-compression.js';

// ─── lz77Encode ──────────────────────────────────────────────────────────────

describe('lz77Encode', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(lz77Encode(''), []);
  });

  it('encodes a single character as offset=0 length=0 token', () => {
    const tokens = lz77Encode('A');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].offset, 0);
    assert.equal(tokens[0].length, 0);
    assert.equal(tokens[0].char, 'A');
  });

  it('produces tokens whose total consumed chars equals input length', () => {
    const input = 'abcabc';
    const tokens = lz77Encode(input);
    let total = 0;
    for (const t of tokens) total += t.length + (t.char === '' ? 0 : 1);
    assert.equal(total, input.length);
  });

  it('detects a back-reference in a repeated string', () => {
    const input = 'abcabc';
    const tokens = lz77Encode(input);
    // At least one token should have offset > 0 and length > 0
    const hasRef = tokens.some((t) => t.offset > 0 && t.length > 0);
    assert.ok(hasRef, 'expected at least one back-reference token');
  });

  it('accepts a custom windowSize', () => {
    const input = 'aaaaaa';
    const tokens = lz77Encode(input, 4);
    // Should still encode without errors
    assert.ok(tokens.length > 0);
  });
});

// ─── lz77Decode ──────────────────────────────────────────────────────────────

describe('lz77Decode', () => {
  it('returns empty string for empty token array', () => {
    assert.equal(lz77Decode([]), '');
  });

  it('decodes a single literal token', () => {
    assert.equal(lz77Decode([{ offset: 0, length: 0, char: 'X' }]), 'X');
  });

  it('decodes a back-reference token', () => {
    // After emitting "ab", token { offset:2, length:2, char:'c' } → "ababc"
    const decoded = lz77Decode([
      { offset: 0, length: 0, char: 'a' },
      { offset: 0, length: 0, char: 'b' },
      { offset: 2, length: 2, char: 'c' },
    ]);
    assert.equal(decoded, 'ababc');
  });

  it('handles token with empty char (end of input)', () => {
    // Emits "aa" via back-reference with no literal appended
    const decoded = lz77Decode([
      { offset: 0, length: 0, char: 'a' },
      { offset: 1, length: 1, char: '' },
    ]);
    assert.equal(decoded, 'aa');
  });
});

// ─── LZ77 roundtrip ──────────────────────────────────────────────────────────

describe('lz77Encode / lz77Decode roundtrip', () => {
  it('roundtrips a short ASCII string', () => {
    const input = 'hello world';
    assert.equal(lz77Decode(lz77Encode(input)), input);
  });

  it('roundtrips a highly repetitive string', () => {
    const input = 'abababababab';
    assert.equal(lz77Decode(lz77Encode(input)), input);
  });

  it('roundtrips all-unique characters', () => {
    const input = 'abcdefghijklmnop';
    assert.equal(lz77Decode(lz77Encode(input)), input);
  });

  it('roundtrips a longer mixed string', () => {
    const input = 'the quick brown fox jumps over the lazy dog';
    assert.equal(lz77Decode(lz77Encode(input)), input);
  });

  it('roundtrips a single character repeated many times', () => {
    const input = 'A'.repeat(50);
    assert.equal(lz77Decode(lz77Encode(input)), input);
  });
});

// ─── lz78Encode ──────────────────────────────────────────────────────────────

describe('lz78Encode', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(lz78Encode(''), []);
  });

  it('first token always has code 0 (no prior phrase)', () => {
    const tokens = lz78Encode('abc');
    assert.equal(tokens[0].code, 0);
  });

  it('encodes a repeated phrase using a non-zero code', () => {
    const tokens = lz78Encode('ababab');
    // After first 'a' and 'b' are in dictionary, 'ab' should reference them
    const hasRef = tokens.some((t) => t.code > 0);
    assert.ok(hasRef, 'expected a dictionary back-reference');
  });

  it('produces tokens covering all input characters', () => {
    const input = 'mississippi';
    const tokens = lz78Encode(input);
    // Sum of (code phrase length + literal char) must equal input length
    // Reconstruct to verify
    assert.equal(lz78Decode(tokens), input);
  });
});

// ─── lz78Decode ──────────────────────────────────────────────────────────────

describe('lz78Decode', () => {
  it('returns empty string for empty token array', () => {
    assert.equal(lz78Decode([]), '');
  });

  it('decodes simple single-char tokens', () => {
    const tokens = [
      { code: 0, char: 'a' },
      { code: 0, char: 'b' },
      { code: 0, char: 'c' },
    ];
    assert.equal(lz78Decode(tokens), 'abc');
  });

  it('decodes a back-reference token correctly', () => {
    // code=1 refers to first dictionary entry "a"; token emits "a" + "b" = "ab"
    const tokens = [
      { code: 0, char: 'a' },
      { code: 1, char: 'b' },
    ];
    assert.equal(lz78Decode(tokens), 'aab');
  });
});

// ─── LZ78 roundtrip ──────────────────────────────────────────────────────────

describe('lz78Encode / lz78Decode roundtrip', () => {
  it('roundtrips a short ASCII string', () => {
    const input = 'hello world';
    assert.equal(lz78Decode(lz78Encode(input)), input);
  });

  it('roundtrips a highly repetitive string', () => {
    const input = 'aaabbbccc';
    assert.equal(lz78Decode(lz78Encode(input)), input);
  });

  it('roundtrips all-unique characters', () => {
    const input = 'abcdefgh';
    assert.equal(lz78Decode(lz78Encode(input)), input);
  });

  it('roundtrips a longer mixed string', () => {
    const input = 'the quick brown fox jumps over the lazy dog';
    assert.equal(lz78Decode(lz78Encode(input)), input);
  });

  it('roundtrips a single character repeated many times', () => {
    const input = 'B'.repeat(30);
    assert.equal(lz78Decode(lz78Encode(input)), input);
  });
});

// ─── compressionStats ────────────────────────────────────────────────────────

describe('compressionStats', () => {
  it('returns originalSize equal to input length', () => {
    const stats = compressionStats('hello', []);
    assert.equal(stats.originalSize, 5);
  });

  it('returns Infinity ratio for empty original', () => {
    const stats = compressionStats('', []);
    assert.equal(stats.ratio, Infinity);
  });

  it('ratio is compressedSize / originalSize', () => {
    const original = 'abcd';
    const compressed = [1, 2];
    const stats = compressionStats(original, compressed);
    const expected = JSON.stringify(compressed).length / original.length;
    assert.equal(stats.ratio, expected);
  });

  it('compressedSize is JSON.stringify length of compressed data', () => {
    const compressed = { code: 1, char: 'a' };
    const stats = compressionStats('abc', compressed);
    assert.equal(stats.compressedSize, JSON.stringify(compressed).length);
  });

  it('returns numeric compressedSize and ratio', () => {
    const stats = compressionStats('test', ['x']);
    assert.equal(typeof stats.compressedSize, 'number');
    assert.equal(typeof stats.ratio, 'number');
  });
});
