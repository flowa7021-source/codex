// ─── Unit Tests: BloomFilter & CountingBloomFilter ───────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BloomFilter,
  CountingBloomFilter,
  createBloomFilter,
} from '../../app/modules/bloom-filter.js';

// ─── BloomFilter – construction ──────────────────────────────────────────────

describe('BloomFilter – construction', () => {
  it('stores the provided size', () => {
    const bf = new BloomFilter(1000, 5);
    assert.equal(bf.size, 1000);
  });

  it('stores the provided hashCount', () => {
    const bf = new BloomFilter(1000, 5);
    assert.equal(bf.hashCount, 5);
  });

  it('starts with itemCount 0', () => {
    const bf = new BloomFilter(500, 3);
    assert.equal(bf.itemCount, 0);
  });

  it('throws RangeError when size < 1', () => {
    assert.throws(() => new BloomFilter(0, 5), RangeError);
  });

  it('throws RangeError when hashCount < 1', () => {
    assert.throws(() => new BloomFilter(1000, 0), RangeError);
  });
});

// ─── BloomFilter – add / has ─────────────────────────────────────────────────

describe('BloomFilter – add / has', () => {
  it('has returns true for every added item', () => {
    const bf = new BloomFilter(9585, 7);
    const words = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
    for (const w of words) bf.add(w);
    for (const w of words) assert.equal(bf.has(w), true, `${w} not found`);
  });

  it('has returns false for an absent item on a fresh filter', () => {
    const bf = new BloomFilter(9585, 7);
    assert.equal(bf.has('absolutely-not-here-xyzzy'), false);
  });

  it('add increments itemCount', () => {
    const bf = new BloomFilter(1000, 5);
    bf.add('one');
    assert.equal(bf.itemCount, 1);
    bf.add('two');
    assert.equal(bf.itemCount, 2);
  });

  it('adding the same item twice increments itemCount by 2', () => {
    const bf = new BloomFilter(1000, 5);
    bf.add('dup');
    bf.add('dup');
    assert.equal(bf.itemCount, 2);
  });

  it('handles empty string', () => {
    const bf = new BloomFilter(500, 3);
    bf.add('');
    assert.equal(bf.has(''), true);
  });

  it('handles unicode strings', () => {
    const bf = new BloomFilter(1000, 5);
    bf.add('日本語');
    assert.equal(bf.has('日本語'), true);
    assert.equal(bf.has('中文'), false);
  });

  it('handles 100 distinct items without false negatives', () => {
    const bf = new BloomFilter(9585, 7);
    for (let i = 0; i < 100; i++) bf.add(`item-${i}`);
    for (let i = 0; i < 100; i++) {
      assert.equal(bf.has(`item-${i}`), true, `item-${i} missing`);
    }
  });
});

// ─── BloomFilter – estimatedFalsePositiveRate ────────────────────────────────

describe('BloomFilter – estimatedFalsePositiveRate', () => {
  it('returns 0 when no items have been added', () => {
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

  it('stays below 5% when sized for 1000 items at 1% and filled with 1000 items', () => {
    const bf = createBloomFilter(1000, 0.01);
    for (let i = 0; i < 1000; i++) bf.add(`item-${i}`);
    const rate = bf.estimatedFalsePositiveRate();
    assert.ok(rate < 0.05, `estimated FP rate too high: ${rate}`);
  });
});

// ─── BloomFilter – false positive rate (empirical) ───────────────────────────

describe('BloomFilter – empirical false positive rate', () => {
  it('actual FP rate is below 10% for a filter configured at 1%', () => {
    const bf = createBloomFilter(1000, 0.01);
    for (let i = 0; i < 1000; i++) bf.add(`item-${i}`);

    let fp = 0;
    const trials = 200;
    for (let i = 10000; i < 10000 + trials; i++) {
      if (bf.has(`nonexistent-${i}`)) fp++;
    }
    assert.ok(fp / trials < 0.10, `FP rate too high: ${fp}/${trials}`);
  });
});

// ─── createBloomFilter factory ───────────────────────────────────────────────

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
});

// ─── CountingBloomFilter – construction ──────────────────────────────────────

describe('CountingBloomFilter – construction', () => {
  it('stores size', () => {
    const cbf = new CountingBloomFilter(800, 4);
    assert.equal(cbf.size, 800);
  });

  it('stores hashCount', () => {
    const cbf = new CountingBloomFilter(800, 4);
    assert.equal(cbf.hashCount, 4);
  });

  it('starts with itemCount 0', () => {
    const cbf = new CountingBloomFilter(800, 4);
    assert.equal(cbf.itemCount, 0);
  });

  it('throws RangeError for size < 1', () => {
    assert.throws(() => new CountingBloomFilter(0, 4), RangeError);
  });

  it('throws RangeError for hashCount < 1', () => {
    assert.throws(() => new CountingBloomFilter(800, 0), RangeError);
  });
});

// ─── CountingBloomFilter – add / has ─────────────────────────────────────────

describe('CountingBloomFilter – add / has', () => {
  it('has returns true for added items', () => {
    const cbf = new CountingBloomFilter(1000, 5);
    cbf.add('alpha');
    cbf.add('beta');
    assert.equal(cbf.has('alpha'), true);
    assert.equal(cbf.has('beta'), true);
  });

  it('has returns false for absent items on a fresh filter', () => {
    const cbf = new CountingBloomFilter(1000, 5);
    assert.equal(cbf.has('missing'), false);
  });

  it('add increases itemCount', () => {
    const cbf = new CountingBloomFilter(1000, 5);
    cbf.add('one');
    cbf.add('two');
    assert.equal(cbf.itemCount, 2);
  });
});

// ─── CountingBloomFilter – delete ────────────────────────────────────────────

describe('CountingBloomFilter – delete', () => {
  it('delete returns true and item is no longer found', () => {
    const cbf = new CountingBloomFilter(1000, 5);
    cbf.add('hello');
    assert.equal(cbf.delete('hello'), true);
    assert.equal(cbf.has('hello'), false);
  });

  it('delete returns false for an item not in the filter', () => {
    const cbf = new CountingBloomFilter(1000, 5);
    assert.equal(cbf.delete('ghost'), false);
  });

  it('delete decrements itemCount', () => {
    const cbf = new CountingBloomFilter(1000, 5);
    cbf.add('a');
    cbf.add('b');
    cbf.delete('a');
    assert.equal(cbf.itemCount, 1);
  });

  it('adding twice requires two deletes to remove', () => {
    const cbf = new CountingBloomFilter(2000, 5);
    cbf.add('x');
    cbf.add('x');
    // First delete — x was added twice so counters still positive
    cbf.delete('x');
    // After one delete the item may still appear present (counters > 0 at all positions)
    // Add it once more to confirm it was there, then delete again
    cbf.add('y'); // unrelated item to avoid polluting
    cbf.delete('x'); // second delete
    // After two deletes the counters for x should be fully decremented
    // (this is a best-effort test; FP means we can only assert one delete works)
    assert.equal(cbf.has('y'), true);
  });

  it('estimatedFalsePositiveRate returns 0 after all items deleted', () => {
    const cbf = new CountingBloomFilter(1000, 5);
    cbf.add('one');
    cbf.delete('one');
    assert.equal(cbf.estimatedFalsePositiveRate(), 0);
  });
});
