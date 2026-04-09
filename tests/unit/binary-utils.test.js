// ─── Unit Tests: binary-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  readUint32LE,
  writeUint32LE,
  readUint32BE,
  writeUint32BE,
  readUint16LE,
  writeUint16LE,
  readFloat32LE,
  writeFloat32LE,
  isLittleEndian,
  swapBytes,
  dataView,
  fillBytes,
  findBytes,
  xorBytes,
} from '../../app/modules/binary-utils.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compare two floats within an absolute tolerance. */
function approxEqual(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

// ─── readUint32LE / writeUint32LE ─────────────────────────────────────────────

describe('readUint32LE / writeUint32LE', () => {
  it('roundtrips a value at offset 0', () => {
    const bytes = new Uint8Array(4);
    writeUint32LE(bytes, 0, 0xdeadbeef);
    assert.equal(readUint32LE(bytes, 0), 0xdeadbeef);
  });

  it('roundtrips zero', () => {
    const bytes = new Uint8Array(4);
    writeUint32LE(bytes, 0, 0);
    assert.equal(readUint32LE(bytes, 0), 0);
  });

  it('roundtrips max uint32 (0xffffffff)', () => {
    const bytes = new Uint8Array(4);
    writeUint32LE(bytes, 0, 0xffffffff);
    assert.equal(readUint32LE(bytes, 0), 0xffffffff);
  });

  it('writes at a non-zero offset', () => {
    const bytes = new Uint8Array(8);
    writeUint32LE(bytes, 4, 0x12345678);
    assert.equal(readUint32LE(bytes, 4), 0x12345678);
  });

  it('stores bytes in little-endian order', () => {
    const bytes = new Uint8Array(4);
    writeUint32LE(bytes, 0, 0x01020304);
    // LE: least-significant byte first
    assert.equal(bytes[0], 0x04);
    assert.equal(bytes[1], 0x03);
    assert.equal(bytes[2], 0x02);
    assert.equal(bytes[3], 0x01);
  });
});

// ─── readUint32BE / writeUint32BE ─────────────────────────────────────────────

describe('readUint32BE / writeUint32BE', () => {
  it('roundtrips a value at offset 0', () => {
    const bytes = new Uint8Array(4);
    writeUint32BE(bytes, 0, 0xcafebabe);
    assert.equal(readUint32BE(bytes, 0), 0xcafebabe);
  });

  it('roundtrips zero', () => {
    const bytes = new Uint8Array(4);
    writeUint32BE(bytes, 0, 0);
    assert.equal(readUint32BE(bytes, 0), 0);
  });

  it('roundtrips max uint32 (0xffffffff)', () => {
    const bytes = new Uint8Array(4);
    writeUint32BE(bytes, 0, 0xffffffff);
    assert.equal(readUint32BE(bytes, 0), 0xffffffff);
  });

  it('stores bytes in big-endian order', () => {
    const bytes = new Uint8Array(4);
    writeUint32BE(bytes, 0, 0x01020304);
    // BE: most-significant byte first
    assert.equal(bytes[0], 0x01);
    assert.equal(bytes[1], 0x02);
    assert.equal(bytes[2], 0x03);
    assert.equal(bytes[3], 0x04);
  });

  it('LE and BE produce different byte layouts for asymmetric values', () => {
    const leBytes = new Uint8Array(4);
    const beBytes = new Uint8Array(4);
    writeUint32LE(leBytes, 0, 0x01020304);
    writeUint32BE(beBytes, 0, 0x01020304);
    assert.notDeepEqual(leBytes, beBytes);
  });
});

// ─── readUint16LE / writeUint16LE ─────────────────────────────────────────────

describe('readUint16LE / writeUint16LE', () => {
  it('roundtrips a value at offset 0', () => {
    const bytes = new Uint8Array(2);
    writeUint16LE(bytes, 0, 0xabcd);
    assert.equal(readUint16LE(bytes, 0), 0xabcd);
  });

  it('roundtrips zero', () => {
    const bytes = new Uint8Array(2);
    writeUint16LE(bytes, 0, 0);
    assert.equal(readUint16LE(bytes, 0), 0);
  });

  it('roundtrips max uint16 (0xffff)', () => {
    const bytes = new Uint8Array(2);
    writeUint16LE(bytes, 0, 0xffff);
    assert.equal(readUint16LE(bytes, 0), 0xffff);
  });

  it('stores bytes in little-endian order', () => {
    const bytes = new Uint8Array(2);
    writeUint16LE(bytes, 0, 0x0102);
    assert.equal(bytes[0], 0x02);
    assert.equal(bytes[1], 0x01);
  });

  it('roundtrips at a non-zero offset', () => {
    const bytes = new Uint8Array(6);
    writeUint16LE(bytes, 4, 0x1234);
    assert.equal(readUint16LE(bytes, 4), 0x1234);
  });
});

// ─── readFloat32LE / writeFloat32LE ──────────────────────────────────────────

describe('readFloat32LE / writeFloat32LE', () => {
  it('roundtrips a positive float', () => {
    const bytes = new Uint8Array(4);
    writeFloat32LE(bytes, 0, 3.14);
    const result = readFloat32LE(bytes, 0);
    assert.ok(approxEqual(result, 3.14, 1e-5), `Expected ~3.14, got ${result}`);
  });

  it('roundtrips zero', () => {
    const bytes = new Uint8Array(4);
    writeFloat32LE(bytes, 0, 0.0);
    assert.equal(readFloat32LE(bytes, 0), 0.0);
  });

  it('roundtrips a negative float', () => {
    const bytes = new Uint8Array(4);
    writeFloat32LE(bytes, 0, -1.5);
    const result = readFloat32LE(bytes, 0);
    assert.ok(approxEqual(result, -1.5), `Expected -1.5, got ${result}`);
  });

  it('roundtrips 1.0 exactly', () => {
    const bytes = new Uint8Array(4);
    writeFloat32LE(bytes, 0, 1.0);
    assert.equal(readFloat32LE(bytes, 0), 1.0);
  });

  it('roundtrips at a non-zero offset', () => {
    const bytes = new Uint8Array(8);
    writeFloat32LE(bytes, 4, 2.718);
    const result = readFloat32LE(bytes, 4);
    assert.ok(approxEqual(result, 2.718, 1e-5), `Expected ~2.718, got ${result}`);
  });
});

// ─── isLittleEndian ───────────────────────────────────────────────────────────

describe('isLittleEndian', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isLittleEndian(), 'boolean');
  });

  it('returns true on x86/x64 (most platforms)', () => {
    // V8 (Node.js) runs on x86/x64, which is little-endian
    assert.equal(isLittleEndian(), true);
  });
});

// ─── swapBytes ────────────────────────────────────────────────────────────────

describe('swapBytes', () => {
  it('reverses 4 bytes at offset 0', () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    swapBytes(bytes, 0, 4);
    assert.deepEqual(bytes, new Uint8Array([0x04, 0x03, 0x02, 0x01]));
  });

  it('reverses 2 bytes at a non-zero offset', () => {
    const bytes = new Uint8Array([0x00, 0xaa, 0xbb, 0x00]);
    swapBytes(bytes, 1, 2);
    assert.deepEqual(bytes, new Uint8Array([0x00, 0xbb, 0xaa, 0x00]));
  });

  it('leaves a single byte unchanged', () => {
    const bytes = new Uint8Array([0x42]);
    swapBytes(bytes, 0, 1);
    assert.deepEqual(bytes, new Uint8Array([0x42]));
  });

  it('leaves a zero-length swap unchanged', () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03]);
    swapBytes(bytes, 0, 0);
    assert.deepEqual(bytes, new Uint8Array([0x01, 0x02, 0x03]));
  });

  it('modifies only the specified range', () => {
    const bytes = new Uint8Array([0xaa, 0x01, 0x02, 0xbb]);
    swapBytes(bytes, 1, 2);
    assert.equal(bytes[0], 0xaa);
    assert.equal(bytes[1], 0x02);
    assert.equal(bytes[2], 0x01);
    assert.equal(bytes[3], 0xbb);
  });
});

// ─── dataView ────────────────────────────────────────────────────────────────

describe('dataView', () => {
  it('returns a DataView instance', () => {
    const bytes = new Uint8Array(4);
    const dv = dataView(bytes);
    assert.ok(dv instanceof DataView);
  });

  it('DataView has the same byte length as the Uint8Array', () => {
    const bytes = new Uint8Array(16);
    const dv = dataView(bytes);
    assert.equal(dv.byteLength, 16);
  });

  it('DataView reads values consistent with Uint8Array contents', () => {
    const bytes = new Uint8Array([0x01, 0x00, 0x00, 0x00]);
    const dv = dataView(bytes);
    assert.equal(dv.getUint32(0, true), 1);
  });

  it('handles an empty Uint8Array', () => {
    const bytes = new Uint8Array(0);
    const dv = dataView(bytes);
    assert.equal(dv.byteLength, 0);
  });
});

// ─── fillBytes ────────────────────────────────────────────────────────────────

describe('fillBytes', () => {
  it('fills the entire array when no range is specified', () => {
    const bytes = new Uint8Array(5);
    fillBytes(bytes, 0xff);
    assert.deepEqual(bytes, new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff]));
  });

  it('fills only the specified range', () => {
    const bytes = new Uint8Array(6);
    fillBytes(bytes, 0xab, 2, 5);
    assert.deepEqual(bytes, new Uint8Array([0, 0, 0xab, 0xab, 0xab, 0]));
  });

  it('fills with zero (clears bytes)', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    fillBytes(bytes, 0);
    assert.deepEqual(bytes, new Uint8Array(5));
  });

  it('handles an empty range without throwing', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    assert.doesNotThrow(() => fillBytes(bytes, 0xff, 1, 1));
    // Range [1, 1) is empty — bytes unchanged
    assert.equal(bytes[1], 2);
  });

  it('modifies the array in-place', () => {
    const bytes = new Uint8Array(3);
    const original = bytes;
    fillBytes(bytes, 7);
    assert.equal(bytes, original); // same reference
  });
});

// ─── findBytes ────────────────────────────────────────────────────────────────

describe('findBytes', () => {
  it('finds a pattern at the start', () => {
    const haystack = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const needle = new Uint8Array([0x01, 0x02]);
    assert.equal(findBytes(haystack, needle), 0);
  });

  it('finds a pattern in the middle', () => {
    const haystack = new Uint8Array([0x00, 0x01, 0xaa, 0xbb, 0x00]);
    const needle = new Uint8Array([0xaa, 0xbb]);
    assert.equal(findBytes(haystack, needle), 2);
  });

  it('finds a pattern at the end', () => {
    const haystack = new Uint8Array([0x00, 0x00, 0xff]);
    const needle = new Uint8Array([0xff]);
    assert.equal(findBytes(haystack, needle), 2);
  });

  it('returns -1 when the pattern is not found', () => {
    const haystack = new Uint8Array([0x01, 0x02, 0x03]);
    const needle = new Uint8Array([0x04]);
    assert.equal(findBytes(haystack, needle), -1);
  });

  it('returns -1 when needle is longer than haystack', () => {
    const haystack = new Uint8Array([0x01]);
    const needle = new Uint8Array([0x01, 0x02]);
    assert.equal(findBytes(haystack, needle), -1);
  });

  it('returns 0 for an empty needle', () => {
    const haystack = new Uint8Array([1, 2, 3]);
    const needle = new Uint8Array(0);
    assert.equal(findBytes(haystack, needle), 0);
  });

  it('finds the first occurrence when needle appears multiple times', () => {
    const haystack = new Uint8Array([0xaa, 0xbb, 0xcc, 0xaa, 0xbb]);
    const needle = new Uint8Array([0xaa, 0xbb]);
    assert.equal(findBytes(haystack, needle), 0);
  });
});

// ─── xorBytes ─────────────────────────────────────────────────────────────────

describe('xorBytes', () => {
  it('XORs two equal-length arrays', () => {
    const a = new Uint8Array([0xff, 0x00, 0xaa]);
    const b = new Uint8Array([0x0f, 0xf0, 0x55]);
    const result = xorBytes(a, b);
    assert.deepEqual(result, new Uint8Array([0xf0, 0xf0, 0xff]));
  });

  it('result length equals the shorter input', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2]);
    const result = xorBytes(a, b);
    assert.equal(result.length, 2);
  });

  it('XOR with all-zeros yields the original array', () => {
    const a = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const zeros = new Uint8Array(4);
    assert.deepEqual(xorBytes(a, zeros), a);
  });

  it('XOR with itself yields all zeros', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const result = xorBytes(a, a);
    assert.deepEqual(result, new Uint8Array(4));
  });

  it('handles empty arrays', () => {
    const result = xorBytes(new Uint8Array(0), new Uint8Array(0));
    assert.equal(result.length, 0);
  });

  it('returns a new Uint8Array, not a mutation of inputs', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5, 6]);
    const result = xorBytes(a, b);
    assert.notEqual(result, a);
    assert.notEqual(result, b);
  });
});
