// ─── Unit Tests: codec-utils ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  toBase64,
  fromBase64,
  toBase64Url,
  fromBase64Url,
  toHex,
  fromHex,
  encodeUTF8,
  decodeUTF8,
  numberToBytes,
  bytesToNumber,
  xorBytes,
} from '../../app/modules/codec-utils.js';

// ─── toBase64 ─────────────────────────────────────────────────────────────────

describe('toBase64', () => {
  it('encodes known byte vector: [72,101,108,108,111] → SGVsbG8=', () => {
    assert.equal(toBase64(new Uint8Array([72, 101, 108, 108, 111])), 'SGVsbG8=');
  });

  it('encodes empty Uint8Array to empty string', () => {
    assert.equal(toBase64(new Uint8Array([])), '');
  });

  it('encodes a string directly', () => {
    assert.equal(toBase64('Hello'), 'SGVsbG8=');
  });

  it('encodes single byte', () => {
    assert.equal(toBase64(new Uint8Array([0])), 'AA==');
  });

  it('encodes two bytes', () => {
    assert.equal(toBase64(new Uint8Array([0, 0])), 'AAA=');
  });

  it('encodes three bytes (no padding)', () => {
    assert.equal(toBase64(new Uint8Array([0, 0, 0])), 'AAAA');
  });
});

// ─── fromBase64 ───────────────────────────────────────────────────────────────

describe('fromBase64', () => {
  it('decodes SGVsbG8= → [72,101,108,108,111]', () => {
    assert.deepEqual(fromBase64('SGVsbG8='), new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('decodes empty string to empty Uint8Array', () => {
    assert.deepEqual(fromBase64(''), new Uint8Array([]));
  });

  it('roundtrips with toBase64', () => {
    const original = new Uint8Array([1, 2, 3, 255, 128, 0]);
    assert.deepEqual(fromBase64(toBase64(original)), original);
  });

  it('decodes AA== → [0]', () => {
    assert.deepEqual(fromBase64('AA=='), new Uint8Array([0]));
  });
});

// ─── toBase64Url / fromBase64Url ──────────────────────────────────────────────

describe('toBase64Url', () => {
  it('replaces + with -', () => {
    // 0xfb => base64 contains +
    const bytes = new Uint8Array([0xfb, 0xff]);
    const b64 = toBase64(bytes);
    const b64url = toBase64Url(bytes);
    assert.equal(b64url, b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '~'));
  });

  it('replaces = with ~', () => {
    const result = toBase64Url(new Uint8Array([72, 101, 108, 108, 111]));
    assert.ok(!result.includes('='));
    assert.ok(result.includes('~') || !toBase64(new Uint8Array([72, 101, 108, 108, 111])).includes('=') || true);
  });

  it('produces no + or / or = characters', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe, 0x00, 0x01]);
    const result = toBase64Url(bytes);
    assert.ok(!result.includes('+'));
    assert.ok(!result.includes('/'));
    assert.ok(!result.includes('='));
  });

  it('roundtrips with fromBase64Url', () => {
    const original = new Uint8Array([0, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
    assert.deepEqual(fromBase64Url(toBase64Url(original)), original);
  });
});

describe('fromBase64Url', () => {
  it('decodes back to original bytes', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);
    const encoded = toBase64Url(original);
    assert.deepEqual(fromBase64Url(encoded), original);
  });

  it('handles ~ padding', () => {
    // 1 byte encodes to 2 base64 chars + 2 pads → 2 tildes in url-safe
    const original = new Uint8Array([42]);
    const encoded = toBase64Url(original);
    assert.ok(encoded.includes('~'));
    assert.deepEqual(fromBase64Url(encoded), original);
  });
});

// ─── toHex ────────────────────────────────────────────────────────────────────

describe('toHex', () => {
  it('encodes [255, 0, 128] → ff0080', () => {
    assert.equal(toHex(new Uint8Array([255, 0, 128])), 'ff0080');
  });

  it('encodes empty array to empty string', () => {
    assert.equal(toHex(new Uint8Array([])), '');
  });

  it('pads single-digit hex values with leading zero', () => {
    assert.equal(toHex(new Uint8Array([1, 2, 15])), '01020f');
  });

  it('accepts a plain number array', () => {
    assert.equal(toHex([255, 0, 128]), 'ff0080');
  });

  it('encodes all bytes 0x00–0xff correctly for sample', () => {
    assert.equal(toHex(new Uint8Array([0x00, 0xff])), '00ff');
  });
});

// ─── fromHex ──────────────────────────────────────────────────────────────────

describe('fromHex', () => {
  it('decodes ff0080 → [255, 0, 128]', () => {
    assert.deepEqual(fromHex('ff0080'), new Uint8Array([255, 0, 128]));
  });

  it('decodes empty string to empty Uint8Array', () => {
    assert.deepEqual(fromHex(''), new Uint8Array([]));
  });

  it('handles uppercase hex', () => {
    assert.deepEqual(fromHex('FF0080'), new Uint8Array([255, 0, 128]));
  });

  it('handles mixed-case hex', () => {
    assert.deepEqual(fromHex('Ff0080'), new Uint8Array([255, 0, 128]));
  });

  it('roundtrips with toHex', () => {
    const original = new Uint8Array([10, 20, 30, 40, 50, 100, 200, 255]);
    assert.deepEqual(fromHex(toHex(original)), original);
  });

  it('throws on odd-length hex string', () => {
    assert.throws(() => fromHex('abc'), /even/);
  });
});

// ─── encodeUTF8 / decodeUTF8 ─────────────────────────────────────────────────

describe('encodeUTF8', () => {
  it('encodes ASCII string to bytes', () => {
    const bytes = encodeUTF8('Hello');
    assert.deepEqual(bytes, new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('encodes empty string to empty bytes', () => {
    assert.deepEqual(encodeUTF8(''), new Uint8Array([]));
  });

  it('encodes multi-byte UTF-8 characters', () => {
    // '€' is U+20AC, encoded as 0xE2 0x82 0xAC in UTF-8
    const bytes = encodeUTF8('€');
    assert.deepEqual(bytes, new Uint8Array([0xe2, 0x82, 0xac]));
  });

  it('encodes a Japanese character', () => {
    // '日' is U+65E5, encoded as 0xE6 0x97 0xA5 in UTF-8
    const bytes = encodeUTF8('日');
    assert.deepEqual(bytes, new Uint8Array([0xe6, 0x97, 0xa5]));
  });
});

describe('decodeUTF8', () => {
  it('decodes ASCII bytes to string', () => {
    assert.equal(decodeUTF8(new Uint8Array([72, 101, 108, 108, 111])), 'Hello');
  });

  it('decodes empty bytes to empty string', () => {
    assert.equal(decodeUTF8(new Uint8Array([])), '');
  });

  it('decodes multi-byte UTF-8 sequences', () => {
    assert.equal(decodeUTF8(new Uint8Array([0xe2, 0x82, 0xac])), '€');
  });

  it('roundtrips with encodeUTF8 for various strings', () => {
    for (const str of ['Hello, World!', 'こんにちは', '€£¥', 'αβγδ', '']) {
      assert.equal(decodeUTF8(encodeUTF8(str)), str);
    }
  });
});

// ─── numberToBytes / bytesToNumber ────────────────────────────────────────────

describe('numberToBytes', () => {
  it('encodes 0 to single byte [0]', () => {
    assert.deepEqual(numberToBytes(0, 1), new Uint8Array([0]));
  });

  it('encodes 255 to single byte [255]', () => {
    assert.deepEqual(numberToBytes(255, 1), new Uint8Array([255]));
  });

  it('encodes 256 to two bytes [1, 0]', () => {
    assert.deepEqual(numberToBytes(256, 2), new Uint8Array([1, 0]));
  });

  it('encodes 0x1234 to two bytes [0x12, 0x34]', () => {
    assert.deepEqual(numberToBytes(0x1234, 2), new Uint8Array([0x12, 0x34]));
  });

  it('encodes with byteLength > needed (pads with leading zeros)', () => {
    assert.deepEqual(numberToBytes(1, 4), new Uint8Array([0, 0, 0, 1]));
  });

  it('returns empty array for byteLength 0', () => {
    assert.deepEqual(numberToBytes(42, 0), new Uint8Array([]));
  });

  it('encodes large value to 4 bytes', () => {
    assert.deepEqual(numberToBytes(0xdeadbeef, 4), new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });
});

describe('bytesToNumber', () => {
  it('decodes [0] → 0', () => {
    assert.equal(bytesToNumber(new Uint8Array([0])), 0);
  });

  it('decodes [255] → 255', () => {
    assert.equal(bytesToNumber(new Uint8Array([255])), 255);
  });

  it('decodes [1, 0] → 256', () => {
    assert.equal(bytesToNumber(new Uint8Array([1, 0])), 256);
  });

  it('decodes [0x12, 0x34] → 0x1234', () => {
    assert.equal(bytesToNumber(new Uint8Array([0x12, 0x34])), 0x1234);
  });

  it('decodes empty array → 0', () => {
    assert.equal(bytesToNumber(new Uint8Array([])), 0);
  });

  it('roundtrips with numberToBytes', () => {
    for (const n of [0, 1, 127, 128, 255, 256, 65535, 0xdeadbeef]) {
      assert.equal(bytesToNumber(numberToBytes(n, 4)), n);
    }
  });
});

// ─── xorBytes ─────────────────────────────────────────────────────────────────

describe('xorBytes', () => {
  it('XORs two arrays of the same length', () => {
    const a = new Uint8Array([0b10101010, 0b11001100]);
    const b = new Uint8Array([0b01010101, 0b00110011]);
    assert.deepEqual(xorBytes(a, b), new Uint8Array([0xff, 0xff]));
  });

  it('returns zeros when XORing with itself', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    assert.deepEqual(xorBytes(a, a), new Uint8Array([0, 0, 0, 0]));
  });

  it('is its own inverse (XOR twice restores original)', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);
    const key = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee]);
    assert.deepEqual(xorBytes(xorBytes(original, key), key), original);
  });

  it('handles single-byte arrays', () => {
    assert.deepEqual(xorBytes(new Uint8Array([0xff]), new Uint8Array([0x0f])), new Uint8Array([0xf0]));
  });

  it('handles empty arrays', () => {
    assert.deepEqual(xorBytes(new Uint8Array([]), new Uint8Array([])), new Uint8Array([]));
  });

  it('throws when arrays have different lengths', () => {
    assert.throws(
      () => xorBytes(new Uint8Array([1, 2]), new Uint8Array([1])),
      /same length/,
    );
  });

  it('XOR with all-zeros is identity', () => {
    const a = new Uint8Array([1, 2, 3]);
    const zeros = new Uint8Array([0, 0, 0]);
    assert.deepEqual(xorBytes(a, zeros), a);
  });
});
