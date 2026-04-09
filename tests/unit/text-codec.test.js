// ─── Unit Tests: text-codec ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeUTF8,
  decodeUTF8,
  encodeUTF16LE,
  decodeUTF16LE,
  encodeLatin1,
  decodeLatin1,
  detectEncoding,
  countChars,
} from '../../app/modules/text-codec.js';

// ─── encodeUTF8 / decodeUTF8 ─────────────────────────────────────────────────

describe('encodeUTF8 / decodeUTF8', () => {
  it('roundtrips ASCII text', () => {
    const text = 'Hello, World!';
    assert.equal(decodeUTF8(encodeUTF8(text)), text);
  });

  it('roundtrips multi-byte characters', () => {
    const text = 'こんにちは 🌍';
    assert.equal(decodeUTF8(encodeUTF8(text)), text);
  });

  it('roundtrips empty string', () => {
    assert.equal(decodeUTF8(encodeUTF8('')), '');
  });

  it('encodes ASCII as single bytes', () => {
    const bytes = encodeUTF8('ABC');
    assert.equal(bytes.length, 3);
    assert.equal(bytes[0], 65); // 'A'
    assert.equal(bytes[1], 66); // 'B'
    assert.equal(bytes[2], 67); // 'C'
  });

  it('encodes multi-byte chars as more than one byte each', () => {
    const bytes = encodeUTF8('é'); // U+00E9: 2 bytes in UTF-8
    assert.equal(bytes.length, 2);
  });
});

// ─── encodeUTF16LE / decodeUTF16LE ───────────────────────────────────────────

describe('encodeUTF16LE / decodeUTF16LE', () => {
  it('roundtrips ASCII text', () => {
    const text = 'Hello';
    assert.equal(decodeUTF16LE(encodeUTF16LE(text)), text);
  });

  it('roundtrips text with non-ASCII characters', () => {
    const text = 'Héllo Wörld';
    assert.equal(decodeUTF16LE(encodeUTF16LE(text)), text);
  });

  it('roundtrips empty string', () => {
    assert.equal(decodeUTF16LE(encodeUTF16LE('')), '');
  });

  it('encodes each char as 2 bytes', () => {
    const text = 'AB';
    const bytes = encodeUTF16LE(text);
    assert.equal(bytes.length, 4);
    // 'A' = 0x41 in little-endian: [0x41, 0x00]
    assert.equal(bytes[0], 0x41);
    assert.equal(bytes[1], 0x00);
    // 'B' = 0x42 in little-endian: [0x42, 0x00]
    assert.equal(bytes[2], 0x42);
    assert.equal(bytes[3], 0x00);
  });
});

// ─── encodeLatin1 / decodeLatin1 ──────────────────────────────────────────────

describe('encodeLatin1 / decodeLatin1', () => {
  it('roundtrips ASCII text', () => {
    const text = 'Hello, World!';
    assert.equal(decodeLatin1(encodeLatin1(text)), text);
  });

  it('roundtrips Latin-1 extended characters', () => {
    const text = 'café résumé naïve';
    assert.equal(decodeLatin1(encodeLatin1(text)), text);
  });

  it('encodes non-Latin-1 characters as question mark', () => {
    const bytes = encodeLatin1('A\u4e2dB'); // \u4e2d is Chinese "中", out of Latin-1
    assert.equal(bytes[0], 65);  // 'A'
    assert.equal(bytes[1], 0x3f); // '?'
    assert.equal(bytes[2], 66);  // 'B'
  });

  it('handles empty string', () => {
    assert.equal(decodeLatin1(encodeLatin1('')), '');
  });

  it('encodes each character as one byte', () => {
    const text = 'ABC';
    const bytes = encodeLatin1(text);
    assert.equal(bytes.length, 3);
  });
});

// ─── detectEncoding ──────────────────────────────────────────────────────────

describe('detectEncoding', () => {
  it('detects UTF-8 BOM (EF BB BF)', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c]);
    assert.equal(detectEncoding(bytes), 'utf-8');
  });

  it('detects UTF-16LE BOM (FF FE)', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x48, 0x00]);
    assert.equal(detectEncoding(bytes), 'utf-16le');
  });

  it('detects UTF-16BE BOM (FE FF)', () => {
    const bytes = new Uint8Array([0xfe, 0xff, 0x00, 0x48]);
    assert.equal(detectEncoding(bytes), 'utf-16be');
  });

  it('returns unknown for plain ASCII bytes (no BOM)', () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    assert.equal(detectEncoding(bytes), 'unknown');
  });

  it('returns unknown for empty bytes', () => {
    assert.equal(detectEncoding(new Uint8Array(0)), 'unknown');
  });

  it('returns unknown for single-byte array that is not a BOM', () => {
    assert.equal(detectEncoding(new Uint8Array([0x41])), 'unknown');
  });

  it('detects only full UTF-8 BOM (not partial)', () => {
    const bytes = new Uint8Array([0xef, 0xbb]); // only 2 bytes, not a full UTF-8 BOM
    assert.equal(detectEncoding(bytes), 'unknown');
  });
});

// ─── countChars ───────────────────────────────────────────────────────────────

describe('countChars', () => {
  it('counts ASCII characters (1 char = 1 byte)', () => {
    const bytes = encodeUTF8('Hello');
    assert.equal(countChars(bytes), 5);
  });

  it('counts multi-byte characters correctly', () => {
    const text = 'こんにちは'; // 5 Japanese chars, each 3 bytes in UTF-8
    const bytes = encodeUTF8(text);
    assert.equal(bytes.length, 15); // 5 * 3 bytes
    assert.equal(countChars(bytes), 5); // but 5 characters
  });

  it('counts emoji as single characters', () => {
    const text = '🎉🌍'; // 2 emoji, each 4 bytes in UTF-8
    const bytes = encodeUTF8(text);
    assert.equal(bytes.length, 8);
    assert.equal(countChars(bytes), 2);
  });

  it('returns 0 for empty bytes', () => {
    assert.equal(countChars(new Uint8Array(0)), 0);
  });

  it('handles mixed ASCII and multi-byte chars', () => {
    const text = 'Hi 日本'; // 3 ASCII + 2 Japanese = 5 chars
    const bytes = encodeUTF8(text);
    assert.equal(countChars(bytes), 5);
  });
});
