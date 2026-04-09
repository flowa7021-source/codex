// ─── Unit Tests: counting-bloom-filter ────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CountingBloomFilter,
  createCountingBloomFilter,
} from '../../app/modules/counting-bloom-filter.js';

// ─── constructor ─────────────────────────────────────────────────────────────

describe('CountingBloomFilter constructor', () => {
  it('creates a filter with default false positive rate', () => {
    const cbf = new CountingBloomFilter(100);
    assert.equal(cbf.count, 0);
  });

  it('creates a filter with custom false positive rate', () => {
    const cbf = new CountingBloomFilter(500, 0.001);
    assert.equal(cbf.count, 0);
  });

  it('throws on non-positive expectedItems', () => {
    assert.throws(() => new CountingBloomFilter(0), RangeError);
    assert.throws(() => new CountingBloomFilter(-5), RangeError);
  });

  it('throws on invalid falsePositiveRate', () => {
    assert.throws(() => new CountingBloomFilter(100, 0), RangeError);
    assert.throws(() => new CountingBloomFilter(100, 1), RangeError);
    assert.throws(() => new CountingBloomFilter(100, -0.1), RangeError);
  });
});

// ─── add + has ───────────────────────────────────────────────────────────────

describe('add + has', () => {
  it('returns true for added items', () => {
    const cbf = new CountingBloomFilter(100, 0.01);
    const words = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
    for (const w of words) cbf.add(w);
    for (const w of words) {
      assert.equal(cbf.has(w), true, `Expected ${w} to be found`);
    }
  });

  it('returns false for absent items on a fresh filter', () => {
    const cbf = new CountingBloomFilter(1000, 0.001);
    assert.equal(cbf.has('never-added-xyz'), false);
  });

  it('handles duplicate adds without error', () => {
    const cbf = new CountingBloomFilter(100);
    cbf.add('repeat');
    cbf.add('repeat');
    assert.equal(cbf.has('repeat'), true);
    assert.equal(cbf.count, 2);
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('returns true and removes a previously added item', () => {
    const cbf = new CountingBloomFilter(100, 0.001);
    cbf.add('hello');
    assert.equal(cbf.has('hello'), true);
    const removed = cbf.remove('hello');
    assert.equal(removed, true);
    assert.equal(cbf.has('hello'), false);
  });

  it('returns false when removing an item not in the filter', () => {
    const cbf = new CountingBloomFilter(100, 0.001);
    const removed = cbf.remove('ghost');
    assert.equal(removed, false);
  });

  it('decrements count after successful removal', () => {
    const cbf = new CountingBloomFilter(100);
    cbf.add('a');
    cbf.add('b');
    assert.equal(cbf.count, 2);
    cbf.remove('a');
    assert.equal(cbf.count, 1);
  });

  it('does not let count go below zero', () => {
    const cbf = new CountingBloomFilter(100);
    cbf.add('x');
    cbf.remove('x');
    assert.equal(cbf.count, 0);
    // Removing again should fail and keep count at 0
    cbf.remove('x');
    assert.equal(cbf.count, 0);
  });

  it('handles add-remove-add cycle correctly', () => {
    const cbf = new CountingBloomFilter(100, 0.001);
    cbf.add('cycle');
    assert.equal(cbf.has('cycle'), true);
    cbf.remove('cycle');
    assert.equal(cbf.has('cycle'), false);
    cbf.add('cycle');
    assert.equal(cbf.has('cycle'), true);
  });
});

// ─── count getter ────────────────────────────────────────────────────────────

describe('count getter', () => {
  it('starts at 0', () => {
    const cbf = new CountingBloomFilter(50);
    assert.equal(cbf.count, 0);
  });

  it('tracks adds', () => {
    const cbf = new CountingBloomFilter(200);
    for (let i = 0; i < 25; i++) cbf.add(`item-${i}`);
    assert.equal(cbf.count, 25);
  });
});

// ─── falsePositiveRate getter ────────────────────────────────────────────────

describe('falsePositiveRate getter', () => {
  it('returns 0 for an empty filter', () => {
    const cbf = new CountingBloomFilter(100);
    assert.equal(cbf.falsePositiveRate, 0);
  });

  it('returns a positive rate after items are added', () => {
    const cbf = new CountingBloomFilter(100, 0.01);
    for (let i = 0; i < 100; i++) cbf.add(`item-${i}`);
    assert.ok(cbf.falsePositiveRate > 0);
    assert.ok(cbf.falsePositiveRate < 1);
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('resets count and membership', () => {
    const cbf = new CountingBloomFilter(100, 0.001);
    cbf.add('hello');
    cbf.add('world');
    cbf.clear();
    assert.equal(cbf.count, 0);
    assert.equal(cbf.has('hello'), false);
    assert.equal(cbf.has('world'), false);
  });

  it('allows new adds after clear', () => {
    const cbf = new CountingBloomFilter(100, 0.01);
    cbf.add('before');
    cbf.clear();
    cbf.add('after');
    assert.equal(cbf.has('after'), true);
    assert.equal(cbf.count, 1);
  });
});

// ─── createCountingBloomFilter factory ───────────────────────────────────────

describe('createCountingBloomFilter factory', () => {
  it('returns a CountingBloomFilter instance', () => {
    const cbf = createCountingBloomFilter(200);
    assert.ok(cbf instanceof CountingBloomFilter);
  });

  it('accepts a custom fpr', () => {
    const cbf = createCountingBloomFilter(200, 0.05);
    cbf.add('test');
    assert.equal(cbf.has('test'), true);
  });
});
