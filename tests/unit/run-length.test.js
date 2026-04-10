// ─── Unit Tests: Run-Length Encoding ──────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  rleEncode,
  rleDecode,
  rleEncodeArray,
  rleDecodeArray,
  bwt,
  ibwt,
  mtfEncode,
  mtfDecode,
} from '../../app/modules/run-length.js';

// ─── rleEncode ────────────────────────────────────────────────────────────────

describe('rleEncode', () => {
  it('encodes a simple repeated run', () => {
    assert.equal(rleEncode('AAABBC'), '3A2BC');
  });

  it('encodes a single character', () => {
    assert.equal(rleEncode('X'), 'X');
  });

  it('encodes an empty string', () => {
    assert.equal(rleEncode(''), '');
  });

  it('encodes a string with no runs', () => {
    assert.equal(rleEncode('ABC'), 'ABC');
  });

  it('encodes a run at the end', () => {
    assert.equal(rleEncode('ABCCC'), 'AB3C');
  });

  it('encodes a string of a single character repeated', () => {
    assert.equal(rleEncode('AAAAA'), '5A');
  });

  it('encodes multiple separate runs', () => {
    assert.equal(rleEncode('AABBCC'), '2A2B2C');
  });
});

// ─── rleDecode ────────────────────────────────────────────────────────────────

describe('rleDecode', () => {
  it('decodes a simple encoded string', () => {
    assert.equal(rleDecode('3A2BC'), 'AAABBC');
  });

  it('decodes an empty string', () => {
    assert.equal(rleDecode(''), '');
  });

  it('decodes a string with no counts', () => {
    assert.equal(rleDecode('ABC'), 'ABC');
  });

  it('decodes a single character with count', () => {
    assert.equal(rleDecode('5A'), 'AAAAA');
  });

  it('decodes multiple runs', () => {
    assert.equal(rleDecode('2A2B2C'), 'AABBCC');
  });
});

// ─── rleEncode / rleDecode round-trip ─────────────────────────────────────────

describe('rleEncode / rleDecode – round-trip', () => {
  const cases = [
    'AAABBC',
    'hello world',
    'AABBAABB',
    'ABC',
    'ZZZZZZZZZZ',
    'a',
  ];

  for (const text of cases) {
    it(`round-trips "${text}"`, () => {
      assert.equal(rleDecode(rleEncode(text)), text);
    });
  }
});

// ─── rleEncodeArray ───────────────────────────────────────────────────────────

describe('rleEncodeArray', () => {
  it('encodes a simple number array', () => {
    const result = rleEncodeArray([1, 1, 2, 3, 3, 3]);
    assert.deepEqual(result, [
      { value: 1, count: 2 },
      { value: 2, count: 1 },
      { value: 3, count: 3 },
    ]);
  });

  it('encodes an empty array', () => {
    assert.deepEqual(rleEncodeArray([]), []);
  });

  it('encodes an array with no runs', () => {
    const result = rleEncodeArray([1, 2, 3]);
    assert.deepEqual(result, [
      { value: 1, count: 1 },
      { value: 2, count: 1 },
      { value: 3, count: 1 },
    ]);
  });

  it('encodes a single-element array', () => {
    assert.deepEqual(rleEncodeArray(['x']), [{ value: 'x', count: 1 }]);
  });

  it('encodes a uniform array', () => {
    const result = rleEncodeArray([true, true, true]);
    assert.deepEqual(result, [{ value: true, count: 3 }]);
  });
});

// ─── rleDecodeArray ───────────────────────────────────────────────────────────

describe('rleDecodeArray', () => {
  it('decodes a simple encoded array', () => {
    const decoded = rleDecodeArray([
      { value: 1, count: 2 },
      { value: 2, count: 1 },
      { value: 3, count: 3 },
    ]);
    assert.deepEqual(decoded, [1, 1, 2, 3, 3, 3]);
  });

  it('decodes an empty array', () => {
    assert.deepEqual(rleDecodeArray([]), []);
  });
});

// ─── rleEncodeArray / rleDecodeArray round-trip ────────────────────────────────

describe('rleEncodeArray / rleDecodeArray – round-trip', () => {
  it('round-trips a number array', () => {
    const data = [1, 1, 2, 3, 3, 3, 4];
    assert.deepEqual(rleDecodeArray(rleEncodeArray(data)), data);
  });

  it('round-trips a string array', () => {
    const data = ['a', 'a', 'b', 'c', 'c'];
    assert.deepEqual(rleDecodeArray(rleEncodeArray(data)), data);
  });

  it('round-trips an empty array', () => {
    assert.deepEqual(rleDecodeArray(rleEncodeArray([])), []);
  });
});

// ─── BWT ──────────────────────────────────────────────────────────────────────

describe('bwt', () => {
  it('transforms a known string', () => {
    // "banana\0" is the classic BWT example
    const { transformed, index } = bwt('banana');
    // Last column of sorted rotations of "banana\0"
    assert.equal(typeof transformed, 'string');
    assert.equal(transformed.length, 'banana'.length + 1); // +1 for sentinel
    assert.equal(typeof index, 'number');
  });

  it('returns a non-negative index', () => {
    const { index } = bwt('abracadabra');
    assert.ok(index >= 0);
  });

  it('transformed output contains same characters as input + sentinel', () => {
    const text = 'mississippi';
    const { transformed } = bwt(text);
    const sortedInput = (text + '\0').split('').sort().join('');
    const sortedTransformed = transformed.split('').sort().join('');
    assert.equal(sortedInput, sortedTransformed);
  });
});

// ─── BWT / ibwt round-trip ─────────────────────────────────────────────────────

describe('bwt / ibwt – round-trip', () => {
  const cases = [
    'banana',
    'abracadabra',
    'mississippi',
    'hello',
    'aaabbbccc',
    'a',
  ];

  for (const text of cases) {
    it(`round-trips "${text}"`, () => {
      const { transformed, index } = bwt(text);
      const recovered = ibwt(transformed, index);
      assert.equal(recovered, text);
    });
  }
});

// ─── MTF ──────────────────────────────────────────────────────────────────────

describe('mtfEncode', () => {
  it('first character always has index from sorted alphabet', () => {
    // alphabet is sorted unique chars of 'bac' = ['a','b','c']
    // 'b' is at index 1
    const codes = mtfEncode('bac');
    assert.equal(codes[0], 1);
  });

  it('encodes an empty string to empty array', () => {
    assert.deepEqual(mtfEncode(''), []);
  });

  it('a repeated character produces 0 for every occurrence after the first', () => {
    const codes = mtfEncode('aaa');
    // First 'a' is moved to front; subsequent 'a's are already at index 0
    assert.equal(codes[0], 0); // only char in alphabet
    assert.equal(codes[1], 0);
    assert.equal(codes[2], 0);
  });
});

describe('mtfDecode', () => {
  it('decodes an empty array', () => {
    assert.equal(mtfDecode([], 'abc'), '');
  });

  it('throws when no alphabetSource is provided', () => {
    assert.throws(() => mtfDecode([0, 1]), /alphabet/i);
  });
});

// ─── MTF encode / decode round-trip ───────────────────────────────────────────

describe('mtfEncode / mtfDecode – round-trip', () => {
  const cases = [
    'banana',
    'abracadabra',
    'hello',
    'aabbcc',
    'z',
  ];

  for (const text of cases) {
    it(`round-trips "${text}"`, () => {
      const codes = mtfEncode(text);
      const recovered = mtfDecode(codes, text);
      assert.equal(recovered, text);
    });
  }
});
