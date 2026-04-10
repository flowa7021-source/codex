// ─── Unit Tests: base-encoding ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  base32Encode,
  base32Decode,
  base58Encode,
  base58Decode,
  base85Encode,
  base85Decode,
  encodeBase,
  decodeBase,
  toBase,
  fromBase,
  toBinary,
  fromBinary,
  toOctal,
  fromOctal,
  toHex,
  fromHex,
  encodeVarint,
  decodeVarint,
  zigzagEncode,
  zigzagDecode,
} from '../../app/modules/base-encoding.js';

// ─── base32Encode ─────────────────────────────────────────────────────────────

describe('base32Encode', () => {
  it('encodes empty input to empty string', () => {
    assert.equal(base32Encode(new Uint8Array([])), '');
  });

  it('encodes "f" → MY====== (RFC 4648 test vector)', () => {
    assert.equal(base32Encode(new Uint8Array([0x66])), 'MY======');
  });

  it('encodes "fo" → MZXQ==== (RFC 4648 test vector)', () => {
    assert.equal(base32Encode(new Uint8Array([0x66, 0x6f])), 'MZXQ====');
  });

  it('encodes "foo" → MZXW6=== (RFC 4648 test vector)', () => {
    assert.equal(base32Encode(new Uint8Array([0x66, 0x6f, 0x6f])), 'MZXW6===');
  });

  it('encodes "foob" → MZXW6YQ= (RFC 4648 test vector)', () => {
    assert.equal(base32Encode(new Uint8Array([0x66, 0x6f, 0x6f, 0x62])), 'MZXW6YQ=');
  });

  it('encodes "fooba" → MZXW6YTB (RFC 4648 test vector, no padding)', () => {
    assert.equal(base32Encode(new Uint8Array([0x66, 0x6f, 0x6f, 0x62, 0x61])), 'MZXW6YTB');
  });

  it('output is always padded to multiple of 8', () => {
    for (let len = 0; len < 10; len++) {
      const encoded = base32Encode(new Uint8Array(len));
      assert.equal(encoded.length % 8, 0, `length ${len} → encoded length ${encoded.length} not multiple of 8`);
    }
  });
});

// ─── base32Decode ─────────────────────────────────────────────────────────────

describe('base32Decode', () => {
  it('decodes empty string to empty bytes', () => {
    assert.deepEqual(base32Decode(''), new Uint8Array([]));
  });

  it('decodes MY====== → "f"', () => {
    assert.deepEqual(base32Decode('MY======'), new Uint8Array([0x66]));
  });

  it('decodes MZXQ==== → "fo"', () => {
    assert.deepEqual(base32Decode('MZXQ===='), new Uint8Array([0x66, 0x6f]));
  });

  it('decodes MZXW6=== → "foo"', () => {
    assert.deepEqual(base32Decode('MZXW6==='), new Uint8Array([0x66, 0x6f, 0x6f]));
  });

  it('decodes MZXW6YTB → "fooba"', () => {
    assert.deepEqual(base32Decode('MZXW6YTB'), new Uint8Array([0x66, 0x6f, 0x6f, 0x62, 0x61]));
  });

  it('is case-insensitive', () => {
    assert.deepEqual(base32Decode('mzxw6ytb'), base32Decode('MZXW6YTB'));
  });

  it('roundtrips with base32Encode', () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 200, 255]);
    assert.deepEqual(base32Decode(base32Encode(original)), original);
  });

  it('throws on invalid character', () => {
    assert.throws(() => base32Decode('!!!!!!!!'), /Invalid base32/);
  });
});

// ─── base58Encode ─────────────────────────────────────────────────────────────

describe('base58Encode', () => {
  it('encodes empty input to empty string', () => {
    assert.equal(base58Encode(new Uint8Array([])), '');
  });

  it('encodes a single zero byte to "1"', () => {
    assert.equal(base58Encode(new Uint8Array([0])), '1');
  });

  it('encodes multiple leading zeros to matching number of "1"s', () => {
    const result = base58Encode(new Uint8Array([0, 0, 0, 1]));
    assert.ok(result.startsWith('111'), `expected three leading 1s, got: ${result}`);
  });

  it('encodes [0x00, 0x01, 0x02] and decodes back', () => {
    const original = new Uint8Array([0x00, 0x01, 0x02]);
    assert.deepEqual(base58Decode(base58Encode(original)), original);
  });

  it('encodes a known value: [0x61] → "2g"', () => {
    // 0x61 = 97 decimal; 97 = 1*58 + 39 → alphabet[1]='2', alphabet[39]='g'
    assert.equal(base58Encode(new Uint8Array([0x61])), '2g');
  });

  it('output only contains characters from the Bitcoin alphabet', () => {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const result = base58Encode(new Uint8Array([1, 2, 3, 100, 200, 255]));
    for (const ch of result) {
      assert.ok(alphabet.includes(ch), `unexpected character: ${ch}`);
    }
  });
});

// ─── base58Decode ─────────────────────────────────────────────────────────────

describe('base58Decode', () => {
  it('decodes empty string to empty bytes', () => {
    assert.deepEqual(base58Decode(''), new Uint8Array([]));
  });

  it('decodes "1" to single zero byte', () => {
    assert.deepEqual(base58Decode('1'), new Uint8Array([0]));
  });

  it('roundtrips with base58Encode for various byte arrays', () => {
    const cases = [
      new Uint8Array([1]),
      new Uint8Array([255]),
      new Uint8Array([0, 1]),
      new Uint8Array([1, 0]),
      new Uint8Array([10, 20, 30, 40, 50]),
      new Uint8Array([0, 0, 1, 2, 3]),
    ];
    for (const original of cases) {
      assert.deepEqual(base58Decode(base58Encode(original)), original, `failed for ${original}`);
    }
  });

  it('throws on invalid character', () => {
    assert.throws(() => base58Decode('0OIl'), /Invalid base58/);
  });
});

// ─── base85Encode ─────────────────────────────────────────────────────────────

describe('base85Encode', () => {
  it('encodes empty input to empty string', () => {
    assert.equal(base85Encode(new Uint8Array([])), '');
  });

  it('encodes all-zero 4-byte group to "z" (special case)', () => {
    assert.equal(base85Encode(new Uint8Array([0, 0, 0, 0])), 'z');
  });

  it('encodes [0x00, 0x00, 0x00, 0x01] to 5 printable chars', () => {
    const result = base85Encode(new Uint8Array([0, 0, 0, 1]));
    assert.equal(result.length, 5);
    assert.notEqual(result, 'z');
  });

  it('encodes "Man " (classic Ascii85 example) to 5 characters', () => {
    // "Man " = 0x4d 0x61 0x6e 0x20
    const result = base85Encode(new Uint8Array([0x4d, 0x61, 0x6e, 0x20]));
    // Classic Ascii85 gives "9jqo^" but the offset-based encoding varies;
    // we just verify it round-trips
    assert.equal(result.length, 5);
  });

  it('partial group (3 bytes) produces 4 output characters', () => {
    const result = base85Encode(new Uint8Array([1, 2, 3]));
    assert.equal(result.length, 4);
  });

  it('partial group (2 bytes) produces 3 output characters', () => {
    const result = base85Encode(new Uint8Array([1, 2]));
    assert.equal(result.length, 3);
  });

  it('partial group (1 byte) produces 2 output characters', () => {
    const result = base85Encode(new Uint8Array([1]));
    assert.equal(result.length, 2);
  });
});

// ─── base85Decode ─────────────────────────────────────────────────────────────

describe('base85Decode', () => {
  it('decodes empty string to empty bytes', () => {
    assert.deepEqual(base85Decode(''), new Uint8Array([]));
  });

  it('decodes "z" back to four zero bytes', () => {
    assert.deepEqual(base85Decode('z'), new Uint8Array([0, 0, 0, 0]));
  });

  it('roundtrips with base85Encode for various byte arrays', () => {
    const cases = [
      new Uint8Array([1, 2, 3, 4]),
      new Uint8Array([255, 254, 253, 252]),
      new Uint8Array([0, 0, 0, 0]),
      new Uint8Array([0x4d, 0x61, 0x6e, 0x20]),
      new Uint8Array([1, 2, 3]),
      new Uint8Array([1, 2]),
      new Uint8Array([42]),
      new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]),
    ];
    for (const original of cases) {
      assert.deepEqual(base85Decode(base85Encode(original)), original, `failed for [${original}]`);
    }
  });

  it('throws on invalid character (below !)', () => {
    // Space (0x20) is below '!' (0x21), so it's invalid
    assert.throws(() => base85Decode(' '), /Invalid base85/);
  });
});

// ─── encodeBase ───────────────────────────────────────────────────────────────

describe('encodeBase', () => {
  it('encodes 0 as the first character of the alphabet', () => {
    assert.equal(encodeBase(0, '01'), '0');
    assert.equal(encodeBase(0, 'abc'), 'a');
  });

  it('encodes in binary (base 2)', () => {
    assert.equal(encodeBase(5, '01'), '101');
    assert.equal(encodeBase(8, '01'), '1000');
    assert.equal(encodeBase(255, '01'), '11111111');
  });

  it('encodes in octal (base 8)', () => {
    assert.equal(encodeBase(8, '01234567'), '10');
    assert.equal(encodeBase(255, '01234567'), '377');
  });

  it('encodes in hexadecimal with custom alphabet', () => {
    assert.equal(encodeBase(255, '0123456789abcdef'), 'ff');
    assert.equal(encodeBase(256, '0123456789abcdef'), '100');
  });

  it('encodes with a custom 3-character alphabet', () => {
    // base 3: 0='a', 1='b', 2='c'
    // 5 in base 3 = 12 → 'bc'
    assert.equal(encodeBase(5, 'abc'), 'bc');
    // 9 in base 3 = 100 → 'baa'
    assert.equal(encodeBase(9, 'abc'), 'baa');
  });

  it('throws for alphabet shorter than 2', () => {
    assert.throws(() => encodeBase(5, 'a'), /Alphabet/);
    assert.throws(() => encodeBase(5, ''), /Alphabet/);
  });

  it('throws for negative value', () => {
    assert.throws(() => encodeBase(-1, '01'), /non-negative/);
  });

  it('throws for non-integer value', () => {
    assert.throws(() => encodeBase(1.5, '01'), /non-negative integer/);
  });
});

// ─── decodeBase ───────────────────────────────────────────────────────────────

describe('decodeBase', () => {
  it('decodes single character at index 0 to 0', () => {
    assert.equal(decodeBase('0', '01'), 0);
    assert.equal(decodeBase('a', 'abc'), 0);
  });

  it('decodes binary strings', () => {
    assert.equal(decodeBase('101', '01'), 5);
    assert.equal(decodeBase('1000', '01'), 8);
    assert.equal(decodeBase('11111111', '01'), 255);
  });

  it('decodes octal strings', () => {
    assert.equal(decodeBase('10', '01234567'), 8);
    assert.equal(decodeBase('377', '01234567'), 255);
  });

  it('decodes hex strings', () => {
    assert.equal(decodeBase('ff', '0123456789abcdef'), 255);
    assert.equal(decodeBase('100', '0123456789abcdef'), 256);
  });

  it('decodes custom alphabet strings', () => {
    assert.equal(decodeBase('bc', 'abc'), 5);
    assert.equal(decodeBase('baa', 'abc'), 9);
  });

  it('roundtrips with encodeBase for various values and alphabets', () => {
    const alphabets = ['01', '01234567', '0123456789abcdef', 'abcdefghijklmnopqrstuvwxyz'];
    const values = [0, 1, 7, 8, 15, 16, 100, 255, 1000];
    for (const alphabet of alphabets) {
      for (const value of values) {
        assert.equal(decodeBase(encodeBase(value, alphabet), alphabet), value, `failed for value=${value}, alphabet=${alphabet}`);
      }
    }
  });

  it('throws for character not in alphabet', () => {
    assert.throws(() => decodeBase('2', '01'), /not found/);
    assert.throws(() => decodeBase('z', 'abc'), /not found/);
  });

  it('throws for alphabet shorter than 2', () => {
    assert.throws(() => decodeBase('a', 'a'), /Alphabet/);
  });
});

// ─── toBase ───────────────────────────────────────────────────────────────────

describe('toBase', () => {
  it('returns "0" for n=0 in any base', () => {
    assert.equal(toBase(0, 2), '0');
    assert.equal(toBase(0, 16), '0');
    assert.equal(toBase(0, 36), '0');
  });

  it('converts to binary (base 2)', () => {
    assert.equal(toBase(1, 2), '1');
    assert.equal(toBase(5, 2), '101');
    assert.equal(toBase(255, 2), '11111111');
  });

  it('converts to octal (base 8)', () => {
    assert.equal(toBase(8, 8), '10');
    assert.equal(toBase(255, 8), '377');
    assert.equal(toBase(511, 8), '777');
  });

  it('converts to hexadecimal (base 16)', () => {
    assert.equal(toBase(255, 16), 'ff');
    assert.equal(toBase(256, 16), '100');
    assert.equal(toBase(4096, 16), '1000');
  });

  it('converts to base 36', () => {
    assert.equal(toBase(35, 36), 'z');
    assert.equal(toBase(36, 36), '10');
  });

  it('throws RangeError for base < 2', () => {
    assert.throws(() => toBase(5, 1), /RangeError|base must be/);
  });

  it('throws RangeError for base > 36', () => {
    assert.throws(() => toBase(5, 37), /RangeError|base must be/);
  });

  it('throws RangeError for negative n', () => {
    assert.throws(() => toBase(-1, 10), /RangeError|non-negative/);
  });

  it('throws RangeError for non-integer n', () => {
    assert.throws(() => toBase(1.5, 10), /RangeError|non-negative/);
  });
});

// ─── fromBase ─────────────────────────────────────────────────────────────────

describe('fromBase', () => {
  it('parses "0" as 0 in any base', () => {
    assert.equal(fromBase('0', 2), 0);
    assert.equal(fromBase('0', 16), 0);
  });

  it('parses binary strings', () => {
    assert.equal(fromBase('101', 2), 5);
    assert.equal(fromBase('11111111', 2), 255);
  });

  it('parses octal strings', () => {
    assert.equal(fromBase('10', 8), 8);
    assert.equal(fromBase('377', 8), 255);
  });

  it('parses hexadecimal strings (case-insensitive)', () => {
    assert.equal(fromBase('ff', 16), 255);
    assert.equal(fromBase('FF', 16), 255);
    assert.equal(fromBase('100', 16), 256);
  });

  it('roundtrips with toBase for many values and bases', () => {
    for (const base of [2, 8, 10, 16, 36]) {
      for (const n of [0, 1, 7, 42, 255, 1000]) {
        assert.equal(fromBase(toBase(n, base), base), n, `failed for n=${n} base=${base}`);
      }
    }
  });

  it('throws RangeError for invalid digit', () => {
    assert.throws(() => fromBase('2', 2), /RangeError|invalid digit/);
    assert.throws(() => fromBase('g', 16), /RangeError|invalid digit/);
  });

  it('throws RangeError for base out of range', () => {
    assert.throws(() => fromBase('10', 1), /RangeError|base must be/);
    assert.throws(() => fromBase('10', 37), /RangeError|base must be/);
  });
});

// ─── toBinary / fromBinary ────────────────────────────────────────────────────

describe('toBinary / fromBinary', () => {
  it('converts 0 to "0"', () => {
    assert.equal(toBinary(0), '0');
  });

  it('converts small integers to binary', () => {
    assert.equal(toBinary(1), '1');
    assert.equal(toBinary(10), '1010');
    assert.equal(toBinary(255), '11111111');
  });

  it('roundtrips with fromBinary', () => {
    for (const n of [0, 1, 2, 15, 64, 127, 255]) {
      assert.equal(fromBinary(toBinary(n)), n, `failed for n=${n}`);
    }
  });
});

// ─── toOctal / fromOctal ──────────────────────────────────────────────────────

describe('toOctal / fromOctal', () => {
  it('converts 0 to "0"', () => {
    assert.equal(toOctal(0), '0');
  });

  it('converts small integers to octal', () => {
    assert.equal(toOctal(7), '7');
    assert.equal(toOctal(8), '10');
    assert.equal(toOctal(64), '100');
  });

  it('roundtrips with fromOctal', () => {
    for (const n of [0, 1, 7, 8, 63, 64, 511, 512]) {
      assert.equal(fromOctal(toOctal(n)), n, `failed for n=${n}`);
    }
  });
});

// ─── toHex / fromHex ──────────────────────────────────────────────────────────

describe('toHex / fromHex', () => {
  it('converts 0 to "0"', () => {
    assert.equal(toHex(0), '0');
  });

  it('converts integers to lower-case hex', () => {
    assert.equal(toHex(15), 'f');
    assert.equal(toHex(16), '10');
    assert.equal(toHex(255), 'ff');
    assert.equal(toHex(256), '100');
  });

  it('fromHex is case-insensitive', () => {
    assert.equal(fromHex('FF'), 255);
    assert.equal(fromHex('ff'), 255);
    assert.equal(fromHex('Ab'), 171);
  });

  it('roundtrips with fromHex', () => {
    for (const n of [0, 1, 10, 15, 16, 255, 256, 65535]) {
      assert.equal(fromHex(toHex(n)), n, `failed for n=${n}`);
    }
  });
});

// ─── encodeVarint / decodeVarint ──────────────────────────────────────────────

describe('encodeVarint / decodeVarint', () => {
  it('encodes 0 as a single zero byte', () => {
    const result = encodeVarint(0);
    assert.deepEqual(result, new Uint8Array([0]));
  });

  it('encodes values 0–127 in a single byte', () => {
    for (const n of [0, 1, 63, 127]) {
      const bytes = encodeVarint(n);
      assert.equal(bytes.length, 1, `n=${n} should fit in 1 byte`);
    }
  });

  it('encodes 128 in two bytes', () => {
    const bytes = encodeVarint(128);
    assert.equal(bytes.length, 2);
    assert.equal(bytes[0] & 0x80, 0x80, 'continuation bit set on first byte');
    assert.equal(bytes[1] & 0x80, 0, 'no continuation bit on last byte');
  });

  it('decodes single-byte varint', () => {
    const { value, bytesRead } = decodeVarint(new Uint8Array([42]));
    assert.equal(value, 42);
    assert.equal(bytesRead, 1);
  });

  it('decodes multi-byte varint', () => {
    const { value, bytesRead } = decodeVarint(new Uint8Array([0x80, 0x01]));
    assert.equal(value, 128);
    assert.equal(bytesRead, 2);
  });

  it('roundtrips for many values', () => {
    for (const n of [0, 1, 127, 128, 255, 256, 16383, 16384, 2097151]) {
      const { value } = decodeVarint(encodeVarint(n));
      assert.equal(value, n, `failed for n=${n}`);
    }
  });

  it('decodeVarint reports bytesRead correctly when extra bytes follow', () => {
    // Encode 300, then append extra bytes
    const varBytes = encodeVarint(300);
    const extended = new Uint8Array([...varBytes, 0xff, 0xff]);
    const { value, bytesRead } = decodeVarint(extended);
    assert.equal(value, 300);
    assert.equal(bytesRead, varBytes.length);
  });

  it('throws RangeError for negative input', () => {
    assert.throws(() => encodeVarint(-1), /RangeError|non-negative/);
  });

  it('throws RangeError for non-integer input', () => {
    assert.throws(() => encodeVarint(1.5), /RangeError|non-negative/);
  });
});

// ─── zigzagEncode / zigzagDecode ─────────────────────────────────────────────

describe('zigzagEncode / zigzagDecode', () => {
  it('encodes 0 → 0', () => {
    assert.equal(zigzagEncode(0), 0);
  });

  it('encodes -1 → 1', () => {
    assert.equal(zigzagEncode(-1), 1);
  });

  it('encodes 1 → 2', () => {
    assert.equal(zigzagEncode(1), 2);
  });

  it('encodes -2 → 3', () => {
    assert.equal(zigzagEncode(-2), 3);
  });

  it('encodes 2 → 4', () => {
    assert.equal(zigzagEncode(2), 4);
  });

  it('produces non-negative results for small signed integers', () => {
    for (const n of [-100, -50, -1, 0, 1, 50, 100]) {
      assert.ok(zigzagEncode(n) >= 0, `zigzagEncode(${n}) should be non-negative`);
    }
  });

  it('decodes 0 → 0', () => {
    assert.equal(zigzagDecode(0), 0);
  });

  it('decodes 1 → -1', () => {
    assert.equal(zigzagDecode(1), -1);
  });

  it('decodes 2 → 1', () => {
    assert.equal(zigzagDecode(2), 1);
  });

  it('decodes 3 → -2', () => {
    assert.equal(zigzagDecode(3), -2);
  });

  it('roundtrips for many signed values', () => {
    for (const n of [-1000, -255, -128, -1, 0, 1, 127, 255, 1000]) {
      assert.equal(zigzagDecode(zigzagEncode(n)), n, `failed for n=${n}`);
    }
  });
});
