// ─── Unit Tests: CRC Checksums ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  crc8,
  crc16,
  crc32,
  crc32String,
  verifyCrc32,
  buildCrc32Table,
} from '../../app/modules/crc.js';

// ─── crc8 ────────────────────────────────────────────────────────────────────

describe('crc8', () => {
  it('returns 0 for an empty array', () => {
    assert.equal(crc8([]), 0);
  });

  it('returns 0 for an empty Uint8Array', () => {
    assert.equal(crc8(new Uint8Array(0)), 0);
  });

  it('matches the CRC-8/SMBUS known value for 0x31 ("1")', () => {
    // CRC-8/SMBUS (poly 0x07, init 0x00) of [0x31] = 0x97
    assert.equal(crc8([0x31]), 0x97);
  });

  it('matches the CRC-8/SMBUS check value for ASCII "123456789"', () => {
    // Standard check value for CRC-8/SMBUS = 0xF4
    const data = [0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39];
    assert.equal(crc8(data), 0xf4);
  });

  it('accepts a Uint8Array', () => {
    assert.equal(crc8(new Uint8Array([0x31])), 0x97);
  });

  it('returns a value in the range [0, 255]', () => {
    const result = crc8([0xde, 0xad, 0xbe, 0xef]);
    assert.ok(result >= 0 && result <= 0xff);
  });

  it('is consistent: same input yields same output', () => {
    const a = crc8([1, 2, 3, 4, 5]);
    const b = crc8([1, 2, 3, 4, 5]);
    assert.equal(a, b);
  });

  it('different inputs produce different CRCs', () => {
    assert.notEqual(crc8([0x00]), crc8([0x01]));
  });
});

// ─── crc16 ───────────────────────────────────────────────────────────────────

describe('crc16', () => {
  it('returns 0xFFFF for an empty array (initial register value)', () => {
    assert.equal(crc16([]), 0xffff);
  });

  it('returns 0xFFFF for an empty Uint8Array', () => {
    assert.equal(crc16(new Uint8Array(0)), 0xffff);
  });

  it('returns a value in the range [0, 0xFFFF]', () => {
    const result = crc16([0x31, 0x32, 0x33]);
    assert.ok(result >= 0 && result <= 0xffff);
  });

  it('accepts a Uint8Array', () => {
    const arr = crc16(new Uint8Array([0x31, 0x32, 0x33]));
    const num = crc16([0x31, 0x32, 0x33]);
    assert.equal(arr, num);
  });

  it('is consistent: same input yields same output', () => {
    const a = crc16([0xde, 0xad, 0xbe, 0xef]);
    const b = crc16([0xde, 0xad, 0xbe, 0xef]);
    assert.equal(a, b);
  });

  it('different inputs produce different CRCs', () => {
    assert.notEqual(crc16([0x00, 0x00]), crc16([0x00, 0x01]));
  });
});

// ─── crc32 ───────────────────────────────────────────────────────────────────

describe('crc32', () => {
  it('returns 0 for an empty array', () => {
    assert.equal(crc32([]), 0);
  });

  it('returns 0 for an empty Uint8Array', () => {
    assert.equal(crc32(new Uint8Array(0)), 0);
  });

  it('returns a valid 32-bit unsigned integer for [0]', () => {
    const result = crc32([0]);
    assert.ok(result >= 0 && result <= 0xffffffff);
  });

  it('matches the IEEE 802.3 known value for ASCII "123456789"', () => {
    // Standard check value for CRC-32/ISO-HDLC = 0xCBF43926
    const data = [0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39];
    assert.equal(crc32(data), 0xcbf43926);
  });

  it('accepts a Uint8Array and matches number array result', () => {
    const data = [0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39];
    assert.equal(crc32(new Uint8Array(data)), crc32(data));
  });

  it('is consistent: same input yields same output', () => {
    const input = [10, 20, 30, 40, 50];
    assert.equal(crc32(input), crc32(input));
  });

  it('different inputs produce different CRCs', () => {
    assert.notEqual(crc32([0x01, 0x02]), crc32([0x02, 0x01]));
  });
});

// ─── crc32String ─────────────────────────────────────────────────────────────

describe('crc32String', () => {
  it('returns the same value as crc32 on UTF-8 encoded bytes', () => {
    const str = 'hello';
    const bytes = new TextEncoder().encode(str);
    assert.equal(crc32String(str), crc32(bytes));
  });

  it('roundtrip: verifyCrc32 confirms checksum of encoded string', () => {
    const str = 'NovaReader CRC-32 roundtrip test';
    const bytes = new TextEncoder().encode(str);
    const checksum = crc32String(str);
    assert.ok(verifyCrc32(bytes, checksum));
  });

  it('is consistent for the same string', () => {
    assert.equal(crc32String('abc'), crc32String('abc'));
  });

  it('differs for different strings', () => {
    assert.notEqual(crc32String('foo'), crc32String('bar'));
  });

  it('handles the empty string', () => {
    assert.equal(crc32String(''), 0);
  });

  it('handles multi-byte UTF-8 characters', () => {
    const str = '\u00e9'; // é — encoded as 2 bytes in UTF-8
    const bytes = new TextEncoder().encode(str);
    assert.equal(crc32String(str), crc32(bytes));
  });
});

// ─── verifyCrc32 ─────────────────────────────────────────────────────────────

describe('verifyCrc32', () => {
  it('returns true when the checksum matches', () => {
    const data = [0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39];
    assert.equal(verifyCrc32(data, 0xcbf43926), true);
  });

  it('returns false when the checksum does not match', () => {
    const data = [0x31, 0x32, 0x33];
    assert.equal(verifyCrc32(data, 0xcbf43926), false);
  });

  it('returns false when expected is 0 but actual is non-zero', () => {
    assert.equal(verifyCrc32([0x01], 0), false);
  });

  it('returns true for an empty array with expected 0', () => {
    assert.equal(verifyCrc32([], 0), true);
  });

  it('accepts Uint8Array input', () => {
    const data = new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]);
    assert.equal(verifyCrc32(data, 0xcbf43926), true);
  });
});

// ─── buildCrc32Table ─────────────────────────────────────────────────────────

describe('buildCrc32Table', () => {
  it('returns a Uint32Array', () => {
    assert.ok(buildCrc32Table() instanceof Uint32Array);
  });

  it('has exactly 256 entries', () => {
    assert.equal(buildCrc32Table().length, 256);
  });

  it('first entry is 0 (table[0] for reflected CRC-32)', () => {
    assert.equal(buildCrc32Table()[0], 0);
  });

  it('entry at index 1 matches the IEEE 802.3 polynomial', () => {
    // table[1] for reflected 0xEDB88320 polynomial is 0x77073096
    assert.equal(buildCrc32Table()[1], 0x77073096);
  });

  it('all entries are 32-bit unsigned integers', () => {
    const table = buildCrc32Table();
    for (let i = 0; i < 256; i++) {
      assert.ok(table[i] >= 0 && table[i] <= 0xffffffff);
    }
  });

  it('returns a distinct copy each call (mutations do not affect crc32)', () => {
    const table = buildCrc32Table();
    table[1] = 0xdeadbeef; // mutate the copy
    // crc32 of '123456789' should still be correct
    const data = [0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39];
    assert.equal(crc32(data), 0xcbf43926);
  });
});
