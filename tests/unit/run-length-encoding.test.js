// ─── Unit Tests: Run-Length Encoding ────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  rleEncode,
  rleDecode,
  rleEncodeBytes,
  rleDecodeBytes,
  compressionRatio,
  rleToRuns,
  runsToString,
} from '../../app/modules/run-length-encoding.js';

// ─── rleEncode ─────────────────────────────────────────────────────────────

describe('rleEncode', () => {
  it('encodes repeated characters', () => {
    assert.equal(rleEncode('AAABBC'), '3A2B1C');
  });

  it('encodes single characters with count 1', () => {
    assert.equal(rleEncode('ABC'), '1A1B1C');
  });

  it('returns empty string for empty input', () => {
    assert.equal(rleEncode(''), '');
  });

  it('handles a single character', () => {
    assert.equal(rleEncode('X'), '1X');
  });

  it('handles long runs', () => {
    assert.equal(rleEncode('A'.repeat(100)), '100A');
  });
});

// ─── rleDecode ─────────────────────────────────────────────────────────────

describe('rleDecode', () => {
  it('decodes basic RLE string', () => {
    assert.equal(rleDecode('3A2B1C'), 'AAABBC');
  });

  it('decodes single-char runs', () => {
    assert.equal(rleDecode('1A1B1C'), 'ABC');
  });

  it('returns empty string for empty input', () => {
    assert.equal(rleDecode(''), '');
  });

  it('decodes multi-digit counts', () => {
    assert.equal(rleDecode('12X'), 'X'.repeat(12));
  });

  it('throws on invalid input (no count)', () => {
    assert.throws(() => rleDecode('A'), /invalid/i);
  });
});

// ─── roundtrip string ──────────────────────────────────────────────────────

describe('rleEncode / rleDecode roundtrip', () => {
  it('roundtrips a typical string', () => {
    const input = 'WWWWBBBWWRR';
    assert.equal(rleDecode(rleEncode(input)), input);
  });

  it('roundtrips all unique characters', () => {
    const input = 'abcdefg';
    assert.equal(rleDecode(rleEncode(input)), input);
  });
});

// ─── rleEncodeBytes / rleDecodeBytes ───────────────────────────────────────

describe('rleEncodeBytes', () => {
  it('encodes a simple byte array', () => {
    const data = new Uint8Array([1, 1, 1, 2, 2, 3]);
    const encoded = rleEncodeBytes(data);
    // Expected: [3, 1, 2, 2, 1, 3]
    assert.deepEqual([...encoded], [3, 1, 2, 2, 1, 3]);
  });

  it('returns empty array for empty input', () => {
    assert.equal(rleEncodeBytes(new Uint8Array(0)).length, 0);
  });

  it('splits runs longer than 255', () => {
    const data = new Uint8Array(300).fill(42);
    const encoded = rleEncodeBytes(data);
    // Should be [255, 42, 45, 42]
    assert.deepEqual([...encoded], [255, 42, 45, 42]);
  });
});

describe('rleDecodeBytes', () => {
  it('decodes a simple encoded byte array', () => {
    const encoded = new Uint8Array([3, 1, 2, 2, 1, 3]);
    const decoded = rleDecodeBytes(encoded);
    assert.deepEqual([...decoded], [1, 1, 1, 2, 2, 3]);
  });

  it('returns empty array for empty input', () => {
    assert.equal(rleDecodeBytes(new Uint8Array(0)).length, 0);
  });

  it('throws on odd-length input', () => {
    assert.throws(() => rleDecodeBytes(new Uint8Array([1])), /even/i);
  });
});

describe('byte RLE roundtrip', () => {
  it('roundtrips arbitrary byte data', () => {
    const data = new Uint8Array([0, 0, 255, 255, 255, 128, 1, 1]);
    assert.deepEqual([...rleDecodeBytes(rleEncodeBytes(data))], [...data]);
  });
});

// ─── compressionRatio ──────────────────────────────────────────────────────

describe('compressionRatio', () => {
  it('returns < 1 for compressible data', () => {
    const original = 'AAAAAAAAAA'; // 10 chars
    const encoded = rleEncode(original); // "10A" = 3 chars
    assert.ok(compressionRatio(original, encoded) < 1);
  });

  it('returns > 1 for data that expands', () => {
    const original = 'ABCD'; // 4 chars
    const encoded = rleEncode(original); // "1A1B1C1D" = 8 chars
    assert.ok(compressionRatio(original, encoded) > 1);
  });

  it('returns Infinity for empty original', () => {
    assert.equal(compressionRatio('', 'x'), Infinity);
  });
});

// ─── rleToRuns / runsToString ──────────────────────────────────────────────

describe('rleToRuns', () => {
  it('breaks string into runs', () => {
    const runs = rleToRuns('AAABBC');
    assert.deepEqual(runs, [
      { char: 'A', count: 3 },
      { char: 'B', count: 2 },
      { char: 'C', count: 1 },
    ]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(rleToRuns(''), []);
  });
});

describe('runsToString', () => {
  it('reconstructs the original string from runs', () => {
    const runs = [
      { char: 'A', count: 3 },
      { char: 'B', count: 2 },
      { char: 'C', count: 1 },
    ];
    assert.equal(runsToString(runs), 'AAABBC');
  });

  it('returns empty string for empty runs', () => {
    assert.equal(runsToString([]), '');
  });

  it('roundtrips with rleToRuns', () => {
    const input = 'XXXYYYZZZ';
    assert.equal(runsToString(rleToRuns(input)), input);
  });
});
