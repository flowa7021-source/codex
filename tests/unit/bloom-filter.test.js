// ─── Unit Tests: BloomFilter ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BloomFilter,
  CountingBloomFilter,
  createBloomFilter,
} from '../../app/modules/bloom-filter.js';

// ─── BloomFilter constructor – defaults ──────────────────────────────────────

describe('BloomFilter – constructor defaults', () => {
  it('uses default size 1024', () => {
    const bf = new BloomFilter();
    assert.equal(bf.size, 1024);
  });

  it('uses default hashCount 3', () => {
    const bf = new BloomFilter();
    assert.equal(bf.hashCount, 3);
  });

  it('starts with fillRatio 0', () => {
    const bf = new BloomFilter();
    assert.equal(bf.fillRatio, 0);
  });

  it('estimatedFalsePositiveRate is 0 on an empty filter', () => {
    const bf = new BloomFilter();
    assert.equal(bf.estimatedFalsePositiveRate(), 0);
  });
});

// ─── BloomFilter constructor – custom params ──────────────────────────────────

describe('BloomFilter – constructor custom params', () => {
  it('stores custom size', () => {
    const bf = new BloomFilter(512);
    assert.equal(bf.size, 512);
  });

  it('stores custom hashCount', () => {
    const bf = new BloomFilter(1024, 7);
    assert.equal(bf.hashCount, 7);
  });

  it('stores both size and hashCount', () => {
    const bf = new BloomFilter(2048, 5);
    assert.equal(bf.size, 2048);
    assert.equal(bf.hashCount, 5);
  });

  it('throws RangeError when size < 1', () => {
    assert.throws(() => new BloomFilter(0), RangeError);
  });

  it('throws RangeError when hashCount < 1', () => {
    assert.throws(() => new BloomFilter(1024, 0), RangeError);
  });
});

// ─── BloomFilter add / has – basic ───────────────────────────────────────────

describe('BloomFilter – add() / has() basic', () => {
  it('has() returns true for a single added item', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add('hello');
    assert.equal(bf.has('hello'), true);
  });

  it('has() returns false for an item not added (fresh filter)', () => {
    const bf = new BloomFilter(1024, 3);
    assert.equal(bf.has('definitely-not-here-xyzzy'), false);
  });

  it('has() returns true for every item in a small set', () => {
    const bf = new BloomFilter(1024, 3);
    const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
    for (const w of items) bf.add(w);
    for (const w of items) assert.equal(bf.has(w), true, `${w} not found`);
  });

  it('handles empty string', () => {
    const bf = new BloomFilter(512, 3);
    bf.add('');
    assert.equal(bf.has(''), true);
  });

  it('handles unicode strings', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add('日本語');
    assert.equal(bf.has('日本語'), true);
  });

  it('different casing treated as different item', () => {
    const bf = new BloomFilter(4096, 5);
    bf.add('hello');
    assert.equal(bf.has('Hello'), false);
  });

  it('adding an item does not affect unrelated items', () => {
    const bf = new BloomFilter(8192, 4);
    bf.add('foo');
    assert.equal(bf.has('bar'), false);
  });

  it('adding 50 numeric strings – all found', () => {
    const bf = new BloomFilter(4096, 4);
    for (let i = 0; i < 50; i++) bf.add(String(i));
    for (let i = 0; i < 50; i++) assert.equal(bf.has(String(i)), true);
  });
});

// ─── BloomFilter – no false negatives (statistical) ──────────────────────────

describe('BloomFilter – no false negatives', () => {
  it('100 distinct items always found (large filter)', () => {
    // Size chosen so FPR < 0.001 — negligible chance of test flake.
    const bf = new BloomFilter(20000, 7);
    for (let i = 0; i < 100; i++) bf.add(`item-${i}`);
    for (let i = 0; i < 100; i++) {
      assert.equal(bf.has(`item-${i}`), true, `item-${i} missing`);
    }
  });

  it('500 items from createBloomFilter have no false negatives', () => {
    const bf = createBloomFilter(500, 0.001);
    for (let i = 0; i < 500; i++) bf.add(`w-${i}`);
    for (let i = 0; i < 500; i++) {
      assert.equal(bf.has(`w-${i}`), true, `w-${i} should be present`);
    }
  });

  it('long strings always found', () => {
    const bf = new BloomFilter(4096, 4);
    const longStr = 'z'.repeat(1000);
    bf.add(longStr);
    assert.equal(bf.has(longStr), true);
  });

  it('1000 items in an oversized filter — all found', () => {
    const bf = new BloomFilter(100000, 7);
    for (let i = 0; i < 1000; i++) bf.add(`entry-${i}`);
    for (let i = 0; i < 1000; i++) {
      assert.equal(bf.has(`entry-${i}`), true, `entry-${i} missing`);
    }
  });
});

// ─── BloomFilter – fillRatio increases with adds ──────────────────────────────

describe('BloomFilter – fillRatio', () => {
  it('fillRatio is 0 on a fresh filter', () => {
    const bf = new BloomFilter(512, 3);
    assert.equal(bf.fillRatio, 0);
  });

  it('fillRatio > 0 after one add', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add('a');
    assert.ok(bf.fillRatio > 0);
  });

  it('fillRatio is between 0 and 1 after many adds', () => {
    const bf = new BloomFilter(1024, 3);
    for (let i = 0; i < 50; i++) bf.add(`item-${i}`);
    assert.ok(bf.fillRatio >= 0 && bf.fillRatio <= 1);
  });

  it('fillRatio increases monotonically as new items are added', () => {
    const bf = new BloomFilter(2048, 3);
    let prev = 0;
    for (let i = 0; i < 20; i++) {
      bf.add(`distinct-item-${i}`);
      assert.ok(bf.fillRatio >= prev, `fillRatio decreased at step ${i}`);
      prev = bf.fillRatio;
    }
  });

  it('fillRatio never exceeds 1', () => {
    const bf = new BloomFilter(100, 3);
    for (let i = 0; i < 300; i++) bf.add(`overflow-${i}`);
    assert.ok(bf.fillRatio <= 1);
  });
});

// ─── BloomFilter – clear ──────────────────────────────────────────────────────

describe('BloomFilter – clear()', () => {
  it('fillRatio is 0 after clear', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add('something');
    bf.clear();
    assert.equal(bf.fillRatio, 0);
  });

  it('has() returns false for previously added items after clear', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add('hello');
    bf.add('world');
    bf.clear();
    assert.equal(bf.has('hello'), false);
    assert.equal(bf.has('world'), false);
  });

  it('filter works normally after clear', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add('before');
    bf.clear();
    bf.add('after');
    assert.equal(bf.has('after'), true);
    assert.equal(bf.has('before'), false);
  });

  it('size and hashCount are unchanged by clear', () => {
    const bf = new BloomFilter(512, 5);
    bf.add('x');
    bf.clear();
    assert.equal(bf.size, 512);
    assert.equal(bf.hashCount, 5);
  });

  it('estimatedFalsePositiveRate is 0 after clear', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add('hello');
    bf.clear();
    assert.equal(bf.estimatedFalsePositiveRate(), 0);
  });
});

// ─── BloomFilter – estimatedFalsePositiveRate ────────────────────────────────

describe('BloomFilter – estimatedFalsePositiveRate()', () => {
  it('returns 0 when no items added', () => {
    const bf = new BloomFilter(9585, 7);
    assert.equal(bf.estimatedFalsePositiveRate(), 0);
  });

  it('returns a value between 0 and 1 after items are added', () => {
    const bf = new BloomFilter(9585, 7);
    for (let i = 0; i < 100; i++) bf.add(`x-${i}`);
    const rate = bf.estimatedFalsePositiveRate();
    assert.ok(rate >= 0 && rate <= 1, `rate out of range: ${rate}`);
  });

  it('rate increases as more items are added', () => {
    const bf = new BloomFilter(9585, 7);
    bf.add('first');
    const r1 = bf.estimatedFalsePositiveRate();
    for (let i = 0; i < 500; i++) bf.add(`item-${i}`);
    const r2 = bf.estimatedFalsePositiveRate();
    assert.ok(r2 > r1, `r2 (${r2}) should be > r1 (${r1})`);
  });

  it('stays below 5% for a 1%-configured filter filled with expected items', () => {
    const bf = createBloomFilter(1000, 0.01);
    for (let i = 0; i < 1000; i++) bf.add(`item-${i}`);
    const rate = bf.estimatedFalsePositiveRate();
    assert.ok(rate < 0.05, `estimated FP rate too high: ${rate}`);
  });

  it('is a number (not NaN or Infinity)', () => {
    const bf = new BloomFilter(256, 3);
    for (let i = 0; i < 30; i++) bf.add(`z-${i}`);
    const rate = bf.estimatedFalsePositiveRate();
    assert.ok(Number.isFinite(rate), `expected finite number, got ${rate}`);
  });
});

// ─── CountingBloomFilter – constructor ───────────────────────────────────────

describe('CountingBloomFilter – constructor', () => {
  it('uses default size 1024', () => {
    const cbf = new CountingBloomFilter();
    assert.equal(cbf.size, 1024);
  });

  it('uses default hashCount 3', () => {
    const cbf = new CountingBloomFilter();
    assert.equal(cbf.hashCount, 3);
  });

  it('stores custom size', () => {
    const cbf = new CountingBloomFilter(512, 4);
    assert.equal(cbf.size, 512);
  });

  it('stores custom hashCount', () => {
    const cbf = new CountingBloomFilter(1024, 7);
    assert.equal(cbf.hashCount, 7);
  });

  it('throws RangeError when size < 1', () => {
    assert.throws(() => new CountingBloomFilter(0), RangeError);
  });

  it('throws RangeError when hashCount < 1', () => {
    assert.throws(() => new CountingBloomFilter(1024, 0), RangeError);
  });
});

// ─── CountingBloomFilter – add / has ─────────────────────────────────────────

describe('CountingBloomFilter – add() / has()', () => {
  it('has() returns true after add()', () => {
    const cbf = new CountingBloomFilter(1024, 3);
    cbf.add('hello');
    assert.equal(cbf.has('hello'), true);
  });

  it('has() returns false for absent item on fresh filter', () => {
    const cbf = new CountingBloomFilter(1024, 3);
    assert.equal(cbf.has('not-here'), false);
  });

  it('has() returns true for all items in a small set', () => {
    const cbf = new CountingBloomFilter(2048, 4);
    const items = ['alpha', 'beta', 'gamma', 'delta'];
    for (const w of items) cbf.add(w);
    for (const w of items) assert.equal(cbf.has(w), true, `${w} not found`);
  });

  it('handles empty string', () => {
    const cbf = new CountingBloomFilter(512, 3);
    cbf.add('');
    assert.equal(cbf.has(''), true);
  });

  it('adding same item multiple times still found', () => {
    const cbf = new CountingBloomFilter(1024, 3);
    cbf.add('dup');
    cbf.add('dup');
    assert.equal(cbf.has('dup'), true);
  });
});

// ─── CountingBloomFilter – remove ────────────────────────────────────────────

describe('CountingBloomFilter – remove()', () => {
  it('remove() returns true for an item that was added', () => {
    const cbf = new CountingBloomFilter(1024, 3);
    cbf.add('removeMe');
    assert.equal(cbf.remove('removeMe'), true);
  });

  it('has() returns false after adding and removing once', () => {
    const cbf = new CountingBloomFilter(2048, 4);
    cbf.add('temporary');
    cbf.remove('temporary');
    assert.equal(cbf.has('temporary'), false);
  });

  it('remove() returns false for an item never added (fresh filter)', () => {
    const cbf = new CountingBloomFilter(1024, 3);
    assert.equal(cbf.remove('ghost'), false);
  });

  it('item can be re-added after removal', () => {
    const cbf = new CountingBloomFilter(1024, 3);
    cbf.add('item');
    cbf.remove('item');
    cbf.add('item');
    assert.equal(cbf.has('item'), true);
  });

  it('removing one item does not affect another item', () => {
    const cbf = new CountingBloomFilter(4096, 4);
    cbf.add('keep');
    cbf.add('drop');
    cbf.remove('drop');
    assert.equal(cbf.has('keep'), true);
  });

  it('add twice, remove twice — item gone', () => {
    const cbf = new CountingBloomFilter(2048, 3);
    cbf.add('twice');
    cbf.add('twice');
    cbf.remove('twice');
    cbf.remove('twice');
    assert.equal(cbf.has('twice'), false);
  });

  it('add twice, remove once — item still present', () => {
    const cbf = new CountingBloomFilter(2048, 3);
    cbf.add('twice');
    cbf.add('twice');
    cbf.remove('twice');
    assert.equal(cbf.has('twice'), true);
  });
});

// ─── CountingBloomFilter – clear ─────────────────────────────────────────────

describe('CountingBloomFilter – clear()', () => {
  it('has() returns false for all items after clear', () => {
    const cbf = new CountingBloomFilter(1024, 3);
    cbf.add('a');
    cbf.add('b');
    cbf.clear();
    assert.equal(cbf.has('a'), false);
    assert.equal(cbf.has('b'), false);
  });

  it('remove() returns false after clear', () => {
    const cbf = new CountingBloomFilter(1024, 3);
    cbf.add('x');
    cbf.clear();
    assert.equal(cbf.remove('x'), false);
  });

  it('size and hashCount unchanged after clear', () => {
    const cbf = new CountingBloomFilter(512, 5);
    cbf.add('y');
    cbf.clear();
    assert.equal(cbf.size, 512);
    assert.equal(cbf.hashCount, 5);
  });

  it('filter works normally after clear', () => {
    const cbf = new CountingBloomFilter(1024, 3);
    cbf.add('before');
    cbf.clear();
    cbf.add('after');
    assert.equal(cbf.has('after'), true);
    assert.equal(cbf.has('before'), false);
  });
});

// ─── createBloomFilter factory ────────────────────────────────────────────────

describe('createBloomFilter factory', () => {
  it('returns a BloomFilter instance', () => {
    const bf = createBloomFilter(1000, 0.01);
    assert.ok(bf instanceof BloomFilter);
  });

  it('uses default falsePositiveRate 0.01 when omitted', () => {
    const bf = createBloomFilter(200);
    assert.ok(bf instanceof BloomFilter);
    assert.ok(bf.size > 0);
    assert.ok(bf.hashCount > 0);
  });

  it('larger expectedItems yields larger size', () => {
    const small = createBloomFilter(100, 0.01);
    const large = createBloomFilter(10000, 0.01);
    assert.ok(large.size > small.size, 'larger n → larger m');
  });

  it('lower falsePositiveRate yields larger size', () => {
    const loose = createBloomFilter(1000, 0.1);
    const tight = createBloomFilter(1000, 0.001);
    assert.ok(tight.size > loose.size, 'lower fp → larger m');
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
    const bf = createBloomFilter(200, 0.01);
    for (let i = 0; i < 200; i++) bf.add(`item-${i}`);
    for (let i = 0; i < 200; i++) {
      assert.equal(bf.has(`item-${i}`), true, `item-${i} should be present`);
    }
  });

  it('computes hashCount > 0', () => {
    const bf = createBloomFilter(1000, 0.01);
    assert.ok(bf.hashCount > 0);
  });

  it('estimated FPR is near target after filling to capacity', () => {
    const bf = createBloomFilter(300, 0.01);
    for (let i = 0; i < 300; i++) bf.add(`entry-${i}`);
    // The formula-based FPR should stay in a reasonable range
    assert.ok(bf.estimatedFalsePositiveRate() < 0.1);
  });
});
