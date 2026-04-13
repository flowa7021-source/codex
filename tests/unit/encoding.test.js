// ─── Unit Tests: Encoding / Decoding Utilities ───────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  base64Encode,
  base64Decode,
  base64UrlEncode,
  base64UrlDecode,
  hexEncode,
  hexDecode,
  xorBuffers,
  pkcs7Pad,
  pkcs7Unpad,
  constantTimeEqual,
} from '../../app/modules/encoding.js';

// ─── base64Encode / base64Decode ─────────────────────────────────────────────

describe('base64Encode() + base64Decode()', () => {
  it('round-trips a UTF-8 string', () => {
    const original = 'Hello, World!';
    const encoded = base64Encode(original);
    assert.equal(encoded, Buffer.from(original, 'utf8').toString('base64'));
    const decoded = base64Decode(encoded);
    assert.equal(decoded.toString('utf8'), original);
  });

  it('round-trips a Buffer', () => {
    const buf = Buffer.from([0x00, 0xff, 0x80, 0x7f]);
    const encoded = base64Encode(buf);
    const decoded = base64Decode(encoded);
    assert.deepEqual(decoded, buf);
  });

  it('encodes empty string to empty string', () => {
    assert.equal(base64Encode(''), '');
    assert.deepEqual(base64Decode(''), Buffer.alloc(0));
  });

  it('encodes the string "Man" to the known value', () => {
    assert.equal(base64Encode('Man'), 'TWFu');
  });
});

// ─── base64UrlEncode / base64UrlDecode ────────────────────────────────────────

describe('base64UrlEncode() + base64UrlDecode()', () => {
  it('round-trips a UTF-8 string', () => {
    const original = 'Hello, World!';
    const encoded = base64UrlEncode(original);
    const decoded = base64UrlDecode(encoded);
    assert.equal(decoded.toString('utf8'), original);
  });

  it('contains no +, /, or = characters', () => {
    // Use bytes that produce + and / in standard Base64.
    const tricky = Buffer.from([0xfb, 0xff, 0xfe]);
    const encoded = base64UrlEncode(tricky);
    assert.doesNotMatch(encoded, /[+/=]/);
  });

  it('round-trips arbitrary binary data', () => {
    const buf = Buffer.from([0x00, 0xfb, 0xff, 0xfe, 0x01, 0x80]);
    const encoded = base64UrlEncode(buf);
    const decoded = base64UrlDecode(encoded);
    assert.deepEqual(decoded, buf);
  });

  it('handles padding correctly (no padding in encoded form)', () => {
    // 'a' → standard Base64 'YQ==' → URL-safe 'YQ'
    const encoded = base64UrlEncode('a');
    assert.equal(encoded, 'YQ');
    const decoded = base64UrlDecode('YQ');
    assert.equal(decoded.toString('utf8'), 'a');
  });
});

// ─── hexEncode / hexDecode ────────────────────────────────────────────────────

describe('hexEncode() + hexDecode()', () => {
  it('round-trips a Buffer', () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const hex = hexEncode(buf);
    assert.equal(hex, 'deadbeef');
    const decoded = hexDecode(hex);
    assert.deepEqual(decoded, buf);
  });

  it('encodes a UTF-8 string to hex', () => {
    const hex = hexEncode('AB');
    assert.equal(hex, '4142');
  });

  it('hex round-trips UTF-8 text', () => {
    const text = 'hello';
    const decoded = hexDecode(hexEncode(text));
    assert.equal(decoded.toString('utf8'), text);
  });

  it('produces lowercase hex', () => {
    const hex = hexEncode(Buffer.from([0xab, 0xcd, 0xef]));
    assert.equal(hex, 'abcdef');
  });

  it('round-trips empty buffer', () => {
    assert.equal(hexEncode(Buffer.alloc(0)), '');
    assert.deepEqual(hexDecode(''), Buffer.alloc(0));
  });
});

// ─── xorBuffers() ─────────────────────────────────────────────────────────────

describe('xorBuffers()', () => {
  it('XORs two buffers of equal length', () => {
    const a = Buffer.from([0b10101010, 0b11001100]);
    const b = Buffer.from([0b01010101, 0b00110011]);
    const result = xorBuffers(a, b);
    assert.deepEqual(result, Buffer.from([0xff, 0xff]));
  });

  it('XOR of a buffer with itself is all zeros', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5]);
    const result = xorBuffers(buf, buf);
    assert.deepEqual(result, Buffer.alloc(5, 0));
  });

  it('XOR with all-zeros is identity', () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const zeros = Buffer.alloc(4, 0);
    assert.deepEqual(xorBuffers(buf, zeros), buf);
  });

  it('throws RangeError for buffers of different lengths', () => {
    assert.throws(
      () => xorBuffers(Buffer.from([1, 2]), Buffer.from([1])),
      RangeError,
    );
  });
});

// ─── pkcs7Pad() + pkcs7Unpad() ────────────────────────────────────────────────

describe('pkcs7Pad() + pkcs7Unpad()', () => {
  it('pads to the next full block', () => {
    const data = Buffer.from([1, 2, 3]);
    const padded = pkcs7Pad(data, 8);
    assert.equal(padded.length, 8);
    // Last 5 bytes should all be 0x05
    for (let i = 3; i < 8; i++) {
      assert.equal(padded[i], 5);
    }
  });

  it('adds a full block of padding when data is already block-aligned', () => {
    const data = Buffer.alloc(8, 0xaa);
    const padded = pkcs7Pad(data, 8);
    assert.equal(padded.length, 16);
    assert.equal(padded[8], 8);
  });

  it('round-trips pad → unpad', () => {
    const data = Buffer.from('Hello, PKCS7!', 'utf8');
    const padded = pkcs7Pad(data, 16);
    const unpadded = pkcs7Unpad(padded);
    assert.deepEqual(unpadded, data);
  });

  it('unpad reverses a single-byte pad', () => {
    // A block whose last byte is 0x01 should have 1 byte of padding removed.
    const padded = Buffer.from([0xaa, 0xbb, 0x01]);
    const unpadded = pkcs7Unpad(padded);
    assert.deepEqual(unpadded, Buffer.from([0xaa, 0xbb]));
  });

  it('throws on empty buffer', () => {
    assert.throws(() => pkcs7Unpad(Buffer.alloc(0)), RangeError);
  });

  it('throws on invalid (zero) padding byte', () => {
    assert.throws(() => pkcs7Unpad(Buffer.from([0xaa, 0x00])), RangeError);
  });

  it('throws on inconsistent padding bytes', () => {
    // Claims 2 bytes of padding but they aren't both 0x02
    assert.throws(() => pkcs7Unpad(Buffer.from([0xaa, 0x01, 0x02])), RangeError);
  });

  it('throws for blockSize outside 1–255', () => {
    assert.throws(() => pkcs7Pad(Buffer.from([1]), 0), RangeError);
    assert.throws(() => pkcs7Pad(Buffer.from([1]), 256), RangeError);
  });
});

// ─── constantTimeEqual() ──────────────────────────────────────────────────────

describe('constantTimeEqual()', () => {
  it('returns true for identical buffers', () => {
    const a = Buffer.from('secret');
    const b = Buffer.from('secret');
    assert.equal(constantTimeEqual(a, b), true);
  });

  it('returns false for different content', () => {
    const a = Buffer.from('secret1');
    const b = Buffer.from('secret2');
    assert.equal(constantTimeEqual(a, b), false);
  });

  it('returns false for different lengths', () => {
    const a = Buffer.from('short');
    const b = Buffer.from('longer buffer');
    assert.equal(constantTimeEqual(a, b), false);
  });

  it('returns true for empty buffers', () => {
    assert.equal(constantTimeEqual(Buffer.alloc(0), Buffer.alloc(0)), true);
  });

  it('returns false when only one byte differs', () => {
    const a = Buffer.from([0x01, 0x02, 0x03]);
    const b = Buffer.from([0x01, 0x02, 0x04]);
    assert.equal(constantTimeEqual(a, b), false);
  });
});
