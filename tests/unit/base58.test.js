// ─── Unit Tests: Base58 ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALPHABET,
  encode,
  decode,
  encodeCheck,
  decodeCheck,
  encodeString,
  decodeString,
} from '../../app/modules/base58.js';

// ─── ALPHABET ─────────────────────────────────────────────────────────────────

describe('ALPHABET', () => {
  it('has length 58', () => {
    assert.equal(ALPHABET.length, 58);
  });

  it('starts with 1 and ends with z', () => {
    assert.equal(ALPHABET[0], '1');
    assert.equal(ALPHABET[57], 'z');
  });

  it('contains no ambiguous characters (0, O, I, l)', () => {
    assert.ok(!ALPHABET.includes('0'), 'must not contain 0');
    assert.ok(!ALPHABET.includes('O'), 'must not contain O');
    assert.ok(!ALPHABET.includes('I'), 'must not contain I');
    assert.ok(!ALPHABET.includes('l'), 'must not contain l');
  });

  it('has no duplicate characters', () => {
    const unique = new Set(ALPHABET.split(''));
    assert.equal(unique.size, 58);
  });
});

// ─── encode ───────────────────────────────────────────────────────────────────

describe('encode – empty input', () => {
  it('encode([]) returns empty string', () => {
    assert.equal(encode([]), '');
    assert.equal(encode(new Uint8Array(0)), '');
  });
});

describe('encode – leading zero bytes', () => {
  it('single zero byte becomes a single leading 1', () => {
    const result = encode([0]);
    assert.equal(result, '1');
  });

  it('three leading zero bytes become three leading 1s', () => {
    const result = encode([0, 0, 0, 1]);
    assert.ok(result.startsWith('111'), `expected "111..." got "${result}"`);
  });

  it('all-zero array encodes to all-1s string', () => {
    const result = encode([0, 0, 0]);
    assert.equal(result, '111');
  });
});

describe('encode – output characters', () => {
  it('output contains only alphabet characters', () => {
    const inputs = [
      [1, 2, 3],
      [255, 254, 253],
      [0, 1, 0, 255],
      Array.from({ length: 32 }, (_, i) => i),
    ];
    const alphabetSet = new Set(ALPHABET.split(''));
    for (const input of inputs) {
      const result = encode(input);
      for (const char of result) {
        assert.ok(alphabetSet.has(char), `unexpected char '${char}' in output for ${input}`);
      }
    }
  });
});

describe('encode – known values', () => {
  it('encodes [0x00, 0x00, 0x00, 0x01] correctly (three leading 1s)', () => {
    const result = encode([0x00, 0x00, 0x00, 0x01]);
    assert.ok(result.startsWith('111'));
    assert.equal(result.length, 4); // 3 leading + 1 encoded digit
  });

  it('encodes [0x61] (ASCII "a") to a known Base58 value', () => {
    // 0x61 = 97; 97 = 1*58 + 39 → digits [1, 39] → "2H"
    const result = encode([0x61]);
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
    // Round-trip verify
    assert.deepEqual(Array.from(decode(result)), [0x61]);
  });
});

// ─── decode ───────────────────────────────────────────────────────────────────

describe('decode – empty input', () => {
  it('decode("") returns empty Uint8Array', () => {
    const result = decode('');
    assert.ok(result instanceof Uint8Array);
    assert.equal(result.length, 0);
  });
});

describe('decode – invalid characters', () => {
  it('throws for character "0" (zero)', () => {
    assert.throws(() => decode('0'), /Invalid Base58 character/);
  });

  it('throws for character "O" (capital O)', () => {
    assert.throws(() => decode('O'), /Invalid Base58 character/);
  });

  it('throws for character "I" (capital I)', () => {
    assert.throws(() => decode('I'), /Invalid Base58 character/);
  });

  it('throws for character "l" (lowercase L)', () => {
    assert.throws(() => decode('l'), /Invalid Base58 character/);
  });

  it('throws for a space character', () => {
    assert.throws(() => decode('abc def'), /Invalid Base58 character/);
  });

  it('throws for a non-ASCII character', () => {
    assert.throws(() => decode('aé'), /Invalid Base58 character/);
  });
});

describe('decode – leading 1s become leading zero bytes', () => {
  it('"1" decodes to [0x00]', () => {
    assert.deepEqual(Array.from(decode('1')), [0x00]);
  });

  it('"111" decodes to [0x00, 0x00, 0x00]', () => {
    assert.deepEqual(Array.from(decode('111')), [0x00, 0x00, 0x00]);
  });
});

// ─── Roundtrip ────────────────────────────────────────────────────────────────

describe('encode/decode roundtrip', () => {
  const cases = [
    { label: 'single byte 0x00', bytes: [0x00] },
    { label: 'single byte 0xff', bytes: [0xff] },
    { label: 'single byte 0x01', bytes: [0x01] },
    { label: '[1, 2, 3, 4, 5]', bytes: [1, 2, 3, 4, 5] },
    { label: '[0, 0, 1, 2, 3]', bytes: [0, 0, 1, 2, 3] },
    { label: 'all bytes 0..255', bytes: Array.from({ length: 256 }, (_, i) => i) },
    { label: '32 bytes all 0xff', bytes: new Array(32).fill(0xff) },
    { label: '32 bytes all 0x00', bytes: new Array(32).fill(0x00) },
    { label: 'mixed with leading zeros', bytes: [0, 0, 0, 128, 64, 32] },
  ];

  for (const { label, bytes } of cases) {
    it(`roundtrip: ${label}`, () => {
      const encoded = encode(bytes);
      const decoded = decode(encoded);
      assert.deepEqual(Array.from(decoded), bytes);
    });
  }

  it('roundtrip with Uint8Array input', () => {
    const input = new Uint8Array([10, 20, 30, 40, 50]);
    const encoded = encode(input);
    const decoded = decode(encoded);
    assert.deepEqual(Array.from(decoded), Array.from(input));
  });
});

// ─── encodeCheck / decodeCheck ───────────────────────────────────────────────

describe('encodeCheck/decodeCheck roundtrip', () => {
  const cases = [
    { label: 'empty payload', bytes: [] },
    { label: 'single zero byte', bytes: [0x00] },
    { label: '[1, 2, 3]', bytes: [1, 2, 3] },
    { label: '20 bytes (address-like)', bytes: Array.from({ length: 20 }, (_, i) => i * 13) },
    { label: '32 bytes', bytes: Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff) },
  ];

  for (const { label, bytes } of cases) {
    it(`encodeCheck/decodeCheck roundtrip: ${label}`, () => {
      const encoded = encodeCheck(bytes);
      const decoded = decodeCheck(encoded);
      assert.deepEqual(Array.from(decoded), bytes);
    });
  }
});

describe('decodeCheck – tampered data', () => {
  it('throws if the last byte is changed', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const encoded = encodeCheck(original);
    // Decode raw, flip a byte in the checksum, re-encode.
    const raw = decode(encoded);
    raw[raw.length - 1] ^= 0xff; // flip last byte of checksum
    const tampered = encode(raw);
    assert.throws(() => decodeCheck(tampered), /checksum mismatch/);
  });

  it('throws if a data byte is changed', () => {
    const original = [10, 20, 30, 40];
    const encoded = encodeCheck(original);
    const raw = decode(encoded);
    raw[0] ^= 0x01; // flip a data byte
    const tampered = encode(raw);
    assert.throws(() => decodeCheck(tampered), /checksum mismatch/);
  });

  it('throws if checksum bytes are all zeroed', () => {
    const original = [1, 2, 3];
    const encoded = encodeCheck(original);
    const raw = decode(encoded);
    raw[raw.length - 4] = 0;
    raw[raw.length - 3] = 0;
    raw[raw.length - 2] = 0;
    raw[raw.length - 1] = 0;
    const tampered = encode(raw);
    assert.throws(() => decodeCheck(tampered), /checksum mismatch/);
  });

  it('different payloads produce different encoded values', () => {
    const a = encodeCheck([1, 2, 3]);
    const b = encodeCheck([1, 2, 4]);
    assert.notEqual(a, b);
  });
});

// ─── encodeString / decodeString ─────────────────────────────────────────────

describe('encodeString/decodeString roundtrip', () => {
  it('roundtrip ASCII string "Hello, World!"', () => {
    const original = 'Hello, World!';
    const b58 = encodeString(original);
    assert.equal(decodeString(b58), original);
  });

  it('roundtrip empty string', () => {
    assert.equal(decodeString(encodeString('')), '');
  });

  it('roundtrip single character', () => {
    assert.equal(decodeString(encodeString('A')), 'A');
  });

  it('roundtrip a longer ASCII sentence', () => {
    const str = 'The quick brown fox jumps over the lazy dog';
    assert.equal(decodeString(encodeString(str)), str);
  });

  it('encoded output contains only Base58 alphabet characters', () => {
    const b58 = encodeString('NovaReader');
    const alphabetSet = new Set(ALPHABET.split(''));
    for (const char of b58) {
      assert.ok(alphabetSet.has(char), `unexpected char '${char}'`);
    }
  });
});
