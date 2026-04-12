// ─── Unit Tests: BloomFilter ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BloomFilter, createBloomFilter } from '../../app/modules/bloom-filter.js';

// ─── Constructor defaults ─────────────────────────────────────────────────────

describe('BloomFilter – constructor defaults', () => {
  it('uses default size of 1024', () => {
    const bf = new BloomFilter();
    assert.equal(bf.size, 1024);
  });

  it('uses default hashCount of 3', () => {
    const bf = new BloomFilter();
    assert.equal(bf.hashCount, 3);
  });

  it('starts with bitCount 0', () => {
    const bf = new BloomFilter();
    assert.equal(bf.bitCount, 0);
  });

  it('starts with fillRatio 0', () => {
    const bf = new BloomFilter();
    assert.equal(bf.fillRatio, 0);
  });

  it('accepts an empty options object', () => {
    const bf = new BloomFilter({});
    assert.equal(bf.size, 1024);
    assert.equal(bf.hashCount, 3);
  });
});

// ─── Constructor custom options ───────────────────────────────────────────────

describe('BloomFilter – constructor custom options', () => {
  it('stores custom size', () => {
    const bf = new BloomFilter({ size: 512 });
    assert.equal(bf.size, 512);
  });

  it('stores custom hashFunctions', () => {
    const bf = new BloomFilter({ hashFunctions: 7 });
    assert.equal(bf.hashCount, 7);
  });

  it('stores both size and hashFunctions', () => {
    const bf = new BloomFilter({ size: 2048, hashFunctions: 5 });
    assert.equal(bf.size, 2048);
    assert.equal(bf.hashCount, 5);
  });

  it('throws RangeError when size < 1', () => {
    assert.throws(() => new BloomFilter({ size: 0 }), RangeError);
  });

  it('throws RangeError when hashFunctions < 1', () => {
    assert.throws(() => new BloomFilter({ hashFunctions: 0 }), RangeError);
  });
});

// ─── add() / has() – basic ───────────────────────────────────────────────────

describe('BloomFilter – add() / has()', () => {
  it('has() returns true for a single added item', () => {
    const bf = new BloomFilter({ size: 500, hashFunctions: 3 });
    bf.add('hello');
    assert.equal(bf.has('hello'), true);
  });

  it('has() returns false for an absent item on a fresh filter', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    assert.equal(bf.has('not-here-xyzzy'), false);
  });

  it('has() returns true for every item in a small set', () => {
    const bf = new BloomFilter({ size: 500, hashFunctions: 3 });
    const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
    for (const w of items) bf.add(w);
    for (const w of items) assert.equal(bf.has(w), true, `${w} not found`);
  });

  it('handles empty string', () => {
    const bf = new BloomFilter({ size: 512, hashFunctions: 3 });
    bf.add('');
    assert.equal(bf.has(''), true);
  });

  it('handles unicode strings', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf.add('日本語');
    assert.equal(bf.has('日本語'), true);
  });

  it('has() returns false for a similar but different string', () => {
    const bf = new BloomFilter({ size: 2048, hashFunctions: 5 });
    bf.add('hello');
    // "Hello" with capital H is a different key
    assert.equal(bf.has('Hello'), false);
  });

  it('adding the same item twice does not duplicate bitCount', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf.add('dup');
    const first = bf.bitCount;
    bf.add('dup');
    assert.equal(bf.bitCount, first);
  });
});

// ─── No false negatives ───────────────────────────────────────────────────────

describe('BloomFilter – no false negatives', () => {
  it('100 distinct items are always found', () => {
    const bf = new BloomFilter({ size: 9585, hashFunctions: 7 });
    for (let i = 0; i < 100; i++) bf.add(`item-${i}`);
    for (let i = 0; i < 100; i++) {
      assert.equal(bf.has(`item-${i}`), true, `item-${i} missing`);
    }
  });

  it('500 items from createBloomFilter have no false negatives', () => {
    const bf = createBloomFilter(500, 0.01);
    for (let i = 0; i < 500; i++) bf.add(`w-${i}`);
    for (let i = 0; i < 500; i++) {
      assert.equal(bf.has(`w-${i}`), true, `w-${i} should be present`);
    }
  });

  it('long strings are always found', () => {
    const bf = new BloomFilter({ size: 2048, hashFunctions: 4 });
    const longStr = 'a'.repeat(1000);
    bf.add(longStr);
    assert.equal(bf.has(longStr), true);
  });

  it('numeric-looking strings are always found', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    for (let i = 0; i < 50; i++) bf.add(String(i));
    for (let i = 0; i < 50; i++) assert.equal(bf.has(String(i)), true);
  });
});

// ─── False positives ──────────────────────────────────────────────────────────

describe('BloomFilter – false positives', () => {
  it('empirical FP rate < 10% for a 1%-configured filter', () => {
    const bf = createBloomFilter(1000, 0.01);
    for (let i = 0; i < 1000; i++) bf.add(`item-${i}`);

    let fp = 0;
    const trials = 200;
    for (let i = 10000; i < 10000 + trials; i++) {
      if (bf.has(`nonexistent-${i}`)) fp++;
    }
    assert.ok(fp / trials < 0.10, `FP rate too high: ${fp}/${trials}`);
  });

  it('fresh large filter has very few false positives', () => {
    const bf = new BloomFilter({ size: 100000, hashFunctions: 7 });
    let fp = 0;
    for (let i = 0; i < 100; i++) {
      if (bf.has(`absent-${i}`)) fp++;
    }
    assert.ok(fp === 0, `Expected 0 FPs on empty large filter, got ${fp}`);
  });
});

// ─── bitCount / fillRatio ─────────────────────────────────────────────────────

describe('BloomFilter – bitCount / fillRatio', () => {
  it('bitCount increases when new items are added', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf.add('a');
    assert.ok(bf.bitCount > 0);
  });

  it('fillRatio is between 0 and 1', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    for (let i = 0; i < 50; i++) bf.add(`item-${i}`);
    assert.ok(bf.fillRatio >= 0 && bf.fillRatio <= 1);
  });

  it('fillRatio equals bitCount / size', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    for (let i = 0; i < 20; i++) bf.add(`x-${i}`);
    assert.equal(bf.fillRatio, bf.bitCount / bf.size);
  });

  it('fillRatio is 0 on a fresh filter', () => {
    const bf = new BloomFilter({ size: 512, hashFunctions: 3 });
    assert.equal(bf.fillRatio, 0);
  });

  it('bitCount never exceeds size', () => {
    const bf = new BloomFilter({ size: 100, hashFunctions: 3 });
    for (let i = 0; i < 200; i++) bf.add(`overflow-${i}`);
    assert.ok(bf.bitCount <= bf.size);
  });
});

// ─── clear() ─────────────────────────────────────────────────────────────────

describe('BloomFilter – clear()', () => {
  it('bitCount returns to 0 after clear', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    for (let i = 0; i < 10; i++) bf.add(`item-${i}`);
    bf.clear();
    assert.equal(bf.bitCount, 0);
  });

  it('fillRatio is 0 after clear', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf.add('something');
    bf.clear();
    assert.equal(bf.fillRatio, 0);
  });

  it('has() returns false for all previously added items after clear', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf.add('hello');
    bf.add('world');
    bf.clear();
    assert.equal(bf.has('hello'), false);
    assert.equal(bf.has('world'), false);
  });

  it('filter works normally after clear', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf.add('before');
    bf.clear();
    bf.add('after');
    assert.equal(bf.has('after'), true);
    assert.equal(bf.has('before'), false);
  });

  it('size and hashCount are unchanged by clear', () => {
    const bf = new BloomFilter({ size: 512, hashFunctions: 5 });
    bf.add('x');
    bf.clear();
    assert.equal(bf.size, 512);
    assert.equal(bf.hashCount, 5);
  });
});

// ─── estimateFalsePositiveRate() ─────────────────────────────────────────────

describe('BloomFilter – estimateFalsePositiveRate()', () => {
  it('returns 0 when no items have been added', () => {
    const bf = new BloomFilter({ size: 9585, hashFunctions: 7 });
    assert.equal(bf.estimateFalsePositiveRate(), 0);
  });

  it('returns a value between 0 and 1 after items are added', () => {
    const bf = new BloomFilter({ size: 9585, hashFunctions: 7 });
    for (let i = 0; i < 100; i++) bf.add(`x-${i}`);
    const rate = bf.estimateFalsePositiveRate();
    assert.ok(rate >= 0 && rate <= 1, `rate out of range: ${rate}`);
  });

  it('rate increases as more items are added', () => {
    const bf = new BloomFilter({ size: 9585, hashFunctions: 7 });
    bf.add('first');
    const r1 = bf.estimateFalsePositiveRate();
    for (let i = 0; i < 500; i++) bf.add(`item-${i}`);
    const r2 = bf.estimateFalsePositiveRate();
    assert.ok(r2 > r1, `r2 (${r2}) should be > r1 (${r1})`);
  });

  it('stays below 5% for a 1%-configured filter filled with expected items', () => {
    const bf = createBloomFilter(1000, 0.01);
    for (let i = 0; i < 1000; i++) bf.add(`item-${i}`);
    const rate = bf.estimateFalsePositiveRate();
    assert.ok(rate < 0.05, `estimated FP rate too high: ${rate}`);
  });

  it('returns 0 after clear', () => {
    const bf = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf.add('hello');
    bf.clear();
    assert.equal(bf.estimateFalsePositiveRate(), 0);
  });
});

// ─── merge() ─────────────────────────────────────────────────────────────────

describe('BloomFilter – merge()', () => {
  it('merged filter contains items from both filters', () => {
    const bf1 = new BloomFilter({ size: 1024, hashFunctions: 3 });
    const bf2 = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf1.add('from-one');
    bf2.add('from-two');
    bf1.merge(bf2);
    assert.equal(bf1.has('from-one'), true);
    assert.equal(bf1.has('from-two'), true);
  });

  it('merge increases bitCount by at least the new unique bits', () => {
    const bf1 = new BloomFilter({ size: 1024, hashFunctions: 3 });
    const bf2 = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf2.add('unique-item-xyz');
    const before = bf1.bitCount;
    bf1.merge(bf2);
    assert.ok(bf1.bitCount >= before);
  });

  it('merging an empty filter changes nothing', () => {
    const bf1 = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf1.add('hello');
    const before = bf1.bitCount;
    const empty = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf1.merge(empty);
    assert.equal(bf1.bitCount, before);
    assert.equal(bf1.has('hello'), true);
  });

  it('merging into empty filter mirrors the source', () => {
    const src = new BloomFilter({ size: 512, hashFunctions: 4 });
    src.add('alpha');
    src.add('beta');
    const dest = new BloomFilter({ size: 512, hashFunctions: 4 });
    dest.merge(src);
    assert.equal(dest.has('alpha'), true);
    assert.equal(dest.has('beta'), true);
  });

  it('throws RangeError when sizes differ', () => {
    const bf1 = new BloomFilter({ size: 512, hashFunctions: 3 });
    const bf2 = new BloomFilter({ size: 1024, hashFunctions: 3 });
    assert.throws(() => bf1.merge(bf2), RangeError);
  });

  it('throws RangeError when hashCounts differ', () => {
    const bf1 = new BloomFilter({ size: 1024, hashFunctions: 3 });
    const bf2 = new BloomFilter({ size: 1024, hashFunctions: 5 });
    assert.throws(() => bf1.merge(bf2), RangeError);
  });

  it('merge is idempotent when source is subset of dest', () => {
    const bf1 = new BloomFilter({ size: 1024, hashFunctions: 3 });
    const bf2 = new BloomFilter({ size: 1024, hashFunctions: 3 });
    bf1.add('shared');
    bf2.add('shared');
    const before = bf1.bitCount;
    bf1.merge(bf2);
    assert.equal(bf1.bitCount, before);
  });
});

// ─── toBitArray() / fromBitArray() ───────────────────────────────────────────

describe('BloomFilter – toBitArray() / fromBitArray()', () => {
  it('toBitArray returns an array of the same length as size', () => {
    const bf = new BloomFilter({ size: 256, hashFunctions: 3 });
    assert.equal(bf.toBitArray().length, 256);
  });

  it('toBitArray returns only 0 and 1 values', () => {
    const bf = new BloomFilter({ size: 256, hashFunctions: 3 });
    bf.add('hello');
    bf.add('world');
    const arr = bf.toBitArray();
    for (const bit of arr) {
      assert.ok(bit === 0 || bit === 1, `unexpected value: ${bit}`);
    }
  });

  it('fromBitArray restores the same has() results', () => {
    const bf = new BloomFilter({ size: 512, hashFunctions: 4 });
    bf.add('foo');
    bf.add('bar');
    const arr = bf.toBitArray();
    const restored = BloomFilter.fromBitArray(arr, 4);
    assert.equal(restored.has('foo'), true);
    assert.equal(restored.has('bar'), true);
  });

  it('fromBitArray restores size', () => {
    const bf = new BloomFilter({ size: 300, hashFunctions: 3 });
    const restored = BloomFilter.fromBitArray(bf.toBitArray(), 3);
    assert.equal(restored.size, 300);
  });

  it('fromBitArray restores bitCount', () => {
    const bf = new BloomFilter({ size: 512, hashFunctions: 3 });
    bf.add('test');
    const arr = bf.toBitArray();
    const restored = BloomFilter.fromBitArray(arr, 3);
    assert.equal(restored.bitCount, bf.bitCount);
  });

  it('fromBitArray with default hashFunctions uses 3', () => {
    const bf = new BloomFilter({ size: 128, hashFunctions: 3 });
    const restored = BloomFilter.fromBitArray(bf.toBitArray());
    assert.equal(restored.hashCount, 3);
  });

  it('round-trip preserves all bits', () => {
    const bf = new BloomFilter({ size: 256, hashFunctions: 3 });
    for (let i = 0; i < 20; i++) bf.add(`item-${i}`);
    const arr = bf.toBitArray();
    const restored = BloomFilter.fromBitArray(arr, 3);
    for (let i = 0; i < arr.length; i++) {
      assert.equal(restored.toBitArray()[i], arr[i]);
    }
  });

  it('fromBitArray all-zeros is an empty filter', () => {
    const zeros = new Array(128).fill(0);
    const bf = BloomFilter.fromBitArray(zeros, 3);
    assert.equal(bf.bitCount, 0);
    assert.equal(bf.has('anything'), false);
  });
});

// ─── createBloomFilter factory ────────────────────────────────────────────────

describe('createBloomFilter factory', () => {
  it('returns a BloomFilter instance', () => {
    const bf = createBloomFilter(1000, 0.01);
    assert.ok(bf instanceof BloomFilter);
  });

  it('larger expected items yields larger size', () => {
    const small = createBloomFilter(100, 0.01);
    const large = createBloomFilter(10000, 0.01);
    assert.ok(large.size > small.size, 'larger n → larger m');
  });

  it('lower false-positive rate yields larger size', () => {
    const loose = createBloomFilter(1000, 0.1);
    const tight = createBloomFilter(1000, 0.001);
    assert.ok(tight.size > loose.size, 'lower fp → larger m');
  });

  it('uses default expectedItems of 100 when called with no args', () => {
    const bf = createBloomFilter();
    assert.ok(bf instanceof BloomFilter);
    assert.ok(bf.size > 0);
    assert.ok(bf.hashCount > 0);
  });

  it('uses default falsePositiveRate of 0.01 when only expectedItems given', () => {
    const bf = createBloomFilter(200);
    assert.ok(bf instanceof BloomFilter);
    assert.ok(bf.size > 0);
  });

  it('throws RangeError for expectedItems < 1', () => {
    assert.throws(() => createBloomFilter(0, 0.01), RangeError);
  });

  it('throws RangeError for falsePositiveRate <= 0', () => {
    assert.throws(() => createBloomFilter(1000, 0), RangeError);
  });

  it('throws RangeError for falsePositiveRate >= 1', () => {
    assert.throws(() => createBloomFilter(1000, 1), RangeError);
  });

  it('created filter has no false negatives for expected item count', () => {
    const bf = createBloomFilter(500, 0.01);
    for (let i = 0; i < 500; i++) bf.add(`w-${i}`);
    for (let i = 0; i < 500; i++) {
      assert.equal(bf.has(`w-${i}`), true, `w-${i} should be present`);
    }
  });

  it('computes a hashCount > 0', () => {
    const bf = createBloomFilter(1000, 0.01);
    assert.ok(bf.hashCount > 0);
  });
});
