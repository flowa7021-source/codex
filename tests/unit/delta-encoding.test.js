// ─── Unit Tests: Delta Encoding ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  deltaEncode,
  deltaDecode,
  xorEncode,
  xorDecode,
  zigzagEncode,
  zigzagDecode,
  variableIntEncode,
  variableIntDecode,
  sequentialEncode,
  sequentialDecode,
} from '../../app/modules/delta-encoding.js';

// ─── deltaEncode ─────────────────────────────────────────────────────────────

describe('deltaEncode', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(deltaEncode([]), []);
  });

  it('first element is stored as-is', () => {
    assert.equal(deltaEncode([42])[0], 42);
  });

  it('encodes differences between adjacent values', () => {
    assert.deepEqual(deltaEncode([1, 3, 6, 10]), [1, 2, 3, 4]);
  });

  it('handles negative differences', () => {
    assert.deepEqual(deltaEncode([10, 7, 3, 1]), [10, -3, -4, -2]);
  });

  it('encodes identical values as zeros after the first', () => {
    assert.deepEqual(deltaEncode([5, 5, 5, 5]), [5, 0, 0, 0]);
  });
});

// ─── deltaDecode ─────────────────────────────────────────────────────────────

describe('deltaDecode', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(deltaDecode([]), []);
  });

  it('decodes a simple delta array', () => {
    assert.deepEqual(deltaDecode([1, 2, 3, 4]), [1, 3, 6, 10]);
  });

  it('handles negative deltas', () => {
    assert.deepEqual(deltaDecode([10, -3, -4, -2]), [10, 7, 3, 1]);
  });
});

// ─── deltaEncode / deltaDecode roundtrip ─────────────────────────────────────

describe('deltaEncode / deltaDecode roundtrip', () => {
  it('roundtrips a monotonically increasing sequence', () => {
    const values = [100, 200, 350, 500, 620];
    assert.deepEqual(deltaDecode(deltaEncode(values)), values);
  });

  it('roundtrips a sequence with mixed signs', () => {
    const values = [-3, 0, 5, -1, 12];
    assert.deepEqual(deltaDecode(deltaEncode(values)), values);
  });
});

// ─── xorEncode ───────────────────────────────────────────────────────────────

describe('xorEncode', () => {
  it('returns empty Uint32Array for empty input', () => {
    assert.equal(xorEncode(new Uint32Array(0)).length, 0);
  });

  it('first element is stored as-is', () => {
    const encoded = xorEncode(new Uint32Array([0xff, 0x00]));
    assert.equal(encoded[0], 0xff);
  });

  it('subsequent elements are XOR of adjacent values', () => {
    const input = new Uint32Array([0b1010, 0b1100, 0b0011]);
    const encoded = xorEncode(input);
    assert.equal(encoded[1], 0b1010 ^ 0b1100);
    assert.equal(encoded[2], 0b1100 ^ 0b0011);
  });

  it('encoding identical values produces zeros after the first', () => {
    const input = new Uint32Array([7, 7, 7, 7]);
    const encoded = xorEncode(input);
    assert.deepEqual([...encoded], [7, 0, 0, 0]);
  });
});

// ─── xorDecode ───────────────────────────────────────────────────────────────

describe('xorDecode', () => {
  it('returns empty Uint32Array for empty input', () => {
    assert.equal(xorDecode(new Uint32Array(0)).length, 0);
  });
});

// ─── xorEncode / xorDecode roundtrip ─────────────────────────────────────────

describe('xorEncode / xorDecode roundtrip', () => {
  it('roundtrips an arbitrary Uint32Array', () => {
    const input = new Uint32Array([0, 255, 65535, 4294967295, 1]);
    assert.deepEqual([...xorDecode(xorEncode(input))], [...input]);
  });

  it('roundtrips all-zero array', () => {
    const input = new Uint32Array(8);
    assert.deepEqual([...xorDecode(xorEncode(input))], [...input]);
  });
});

// ─── zigzagEncode / zigzagDecode ─────────────────────────────────────────────

describe('zigzagEncode', () => {
  it('maps 0 to 0', () => {
    assert.equal(zigzagEncode(0), 0);
  });

  it('maps -1 to 1', () => {
    assert.equal(zigzagEncode(-1), 1);
  });

  it('maps 1 to 2', () => {
    assert.equal(zigzagEncode(1), 2);
  });

  it('maps -2 to 3', () => {
    assert.equal(zigzagEncode(-2), 3);
  });

  it('maps 2 to 4', () => {
    assert.equal(zigzagEncode(2), 4);
  });

  it('always produces a non-negative result', () => {
    for (const n of [-100, -1, 0, 1, 100]) {
      assert.ok(zigzagEncode(n) >= 0, `expected >= 0 for input ${n}`);
    }
  });
});

describe('zigzagDecode', () => {
  it('maps 0 back to 0', () => {
    assert.equal(zigzagDecode(0), 0);
  });

  it('maps 1 back to -1', () => {
    assert.equal(zigzagDecode(1), -1);
  });

  it('maps 2 back to 1', () => {
    assert.equal(zigzagDecode(2), 1);
  });
});

describe('zigzagEncode / zigzagDecode roundtrip', () => {
  it('roundtrips a range of signed integers', () => {
    for (const n of [-500, -1, 0, 1, 500]) {
      assert.equal(zigzagDecode(zigzagEncode(n)), n, `roundtrip failed for ${n}`);
    }
  });
});

// ─── variableIntEncode / variableIntDecode ───────────────────────────────────

describe('variableIntEncode', () => {
  it('encodes 0 as a single zero byte', () => {
    assert.deepEqual([...variableIntEncode(0)], [0]);
  });

  it('encodes 127 (max 1-byte) as a single byte', () => {
    assert.deepEqual([...variableIntEncode(127)], [127]);
  });

  it('encodes 128 using two bytes', () => {
    // 128 = 0b10000000 → LEB128: [0x80, 0x01]
    assert.deepEqual([...variableIntEncode(128)], [0x80, 0x01]);
  });

  it('encodes 300 using two bytes', () => {
    // 300 = 0b100101100 → LEB128: [0xAC, 0x02]
    assert.deepEqual([...variableIntEncode(300)], [0xac, 0x02]);
  });

  it('throws for negative values', () => {
    assert.throws(() => variableIntEncode(-1), /RangeError|>= 0/i);
  });
});

describe('variableIntDecode', () => {
  it('decodes a single-byte value', () => {
    const result = variableIntDecode(new Uint8Array([42]));
    assert.equal(result.value, 42);
    assert.equal(result.bytesRead, 1);
  });

  it('decodes a two-byte value', () => {
    const result = variableIntDecode(new Uint8Array([0x80, 0x01]));
    assert.equal(result.value, 128);
    assert.equal(result.bytesRead, 2);
  });

  it('throws on truncated input', () => {
    assert.throws(
      () => variableIntDecode(new Uint8Array([0x80])),
      /truncated/i,
    );
  });
});

describe('variableIntEncode / variableIntDecode roundtrip', () => {
  it('roundtrips a variety of values', () => {
    for (const v of [0, 1, 127, 128, 255, 300, 16383, 16384, 2097151]) {
      const encoded = variableIntEncode(v);
      const { value, bytesRead } = variableIntDecode(encoded);
      assert.equal(value, v, `roundtrip failed for ${v}`);
      assert.equal(bytesRead, encoded.length);
    }
  });
});

// ─── sequentialEncode / sequentialDecode ─────────────────────────────────────

describe('sequentialEncode', () => {
  it('returns { min: 0, deltas: [] } for empty input', () => {
    assert.deepEqual(sequentialEncode([]), { min: 0, deltas: [] });
  });

  it('min is the minimum of the input values', () => {
    const result = sequentialEncode([10, 20, 15]);
    assert.equal(result.min, 10);
  });

  it('first delta is 0 when min is subtracted', () => {
    // After subtracting min, smallest-value element becomes 0
    const result = sequentialEncode([5, 8, 12]);
    // offsets = [0, 3, 7]; delta-encoded = [0, 3, 4]
    assert.equal(result.deltas[0], 0);
  });

  it('encodes [100, 101, 102] with min=100 and deltas [0,1,1]', () => {
    const result = sequentialEncode([100, 101, 102]);
    assert.equal(result.min, 100);
    assert.deepEqual(result.deltas, [0, 1, 1]);
  });
});

describe('sequentialDecode', () => {
  it('returns empty array for empty deltas', () => {
    assert.deepEqual(sequentialDecode({ min: 5, deltas: [] }), []);
  });
});

describe('sequentialEncode / sequentialDecode roundtrip', () => {
  it('roundtrips a sorted timestamp-like sequence', () => {
    const values = [1700000000, 1700000005, 1700000012, 1700000020];
    assert.deepEqual(sequentialDecode(sequentialEncode(values)), values);
  });

  it('roundtrips a sequence with equal values', () => {
    const values = [42, 42, 42, 42];
    assert.deepEqual(sequentialDecode(sequentialEncode(values)), values);
  });

  it('roundtrips a single-element array', () => {
    const values = [999];
    assert.deepEqual(sequentialDecode(sequentialEncode(values)), values);
  });

  it('roundtrips a non-monotonic sequence', () => {
    const values = [3, 7, 2, 9, 1];
    assert.deepEqual(sequentialDecode(sequentialEncode(values)), values);
  });
});
