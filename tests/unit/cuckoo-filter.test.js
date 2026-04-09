// ─── Unit Tests: cuckoo-filter ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CuckooFilter, createCuckooFilter } from '../../app/modules/cuckoo-filter.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('CuckooFilter constructor', () => {
  it('creates a filter with positive capacity', () => {
    const cf = new CuckooFilter(100);
    assert.ok(cf.capacity > 0);
  });

  it('throws on capacity < 1', () => {
    assert.throws(() => new CuckooFilter(0), RangeError);
    assert.throws(() => new CuckooFilter(-5), RangeError);
  });

  it('throws on invalid fingerprint size', () => {
    assert.throws(() => new CuckooFilter(100, 0), RangeError);
    assert.throws(() => new CuckooFilter(100, 33), RangeError);
  });

  it('starts with size 0 and loadFactor 0', () => {
    const cf = new CuckooFilter(100);
    assert.equal(cf.size, 0);
    assert.equal(cf.loadFactor, 0);
  });
});

// ─── add + has ────────────────────────────────────────────────────────────────

describe('CuckooFilter add + has', () => {
  it('finds all added items', () => {
    const cf = new CuckooFilter(200);
    const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    for (const w of words) {
      assert.equal(cf.add(w), true, `Should successfully add "${w}"`);
    }
    for (const w of words) {
      assert.equal(cf.has(w), true, `Should find "${w}"`);
    }
  });

  it('returns false for items not added (low false positive rate)', () => {
    const cf = new CuckooFilter(1000);
    for (let i = 0; i < 50; i++) cf.add(`item-${i}`);
    // Test 100 items that were never added; expect very few false positives.
    let falsePositives = 0;
    for (let i = 1000; i < 1100; i++) {
      if (cf.has(`not-added-${i}`)) falsePositives++;
    }
    assert.ok(falsePositives < 15, `Too many false positives: ${falsePositives}`);
  });

  it('increments size on successful add', () => {
    const cf = new CuckooFilter(100);
    cf.add('one');
    cf.add('two');
    cf.add('three');
    assert.equal(cf.size, 3);
  });

  it('handles duplicate adds', () => {
    const cf = new CuckooFilter(100);
    cf.add('dup');
    cf.add('dup');
    assert.equal(cf.has('dup'), true);
    // Size increases because the filter doesn't deduplicate.
    assert.equal(cf.size, 2);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('CuckooFilter delete', () => {
  it('removes an existing item', () => {
    const cf = new CuckooFilter(200);
    cf.add('remove-me');
    assert.equal(cf.has('remove-me'), true);
    assert.equal(cf.delete('remove-me'), true);
    assert.equal(cf.has('remove-me'), false);
  });

  it('decrements size on successful delete', () => {
    const cf = new CuckooFilter(200);
    cf.add('a');
    cf.add('b');
    cf.delete('a');
    assert.equal(cf.size, 1);
  });

  it('returns false when deleting a non-existent item', () => {
    const cf = new CuckooFilter(200);
    cf.add('exists');
    assert.equal(cf.delete('does-not-exist'), false);
    assert.equal(cf.size, 1);
  });
});

// ─── loadFactor ───────────────────────────────────────────────────────────────

describe('CuckooFilter loadFactor', () => {
  it('increases as items are added', () => {
    const cf = new CuckooFilter(100);
    const before = cf.loadFactor;
    for (let i = 0; i < 10; i++) cf.add(`item-${i}`);
    assert.ok(cf.loadFactor > before);
  });

  it('is between 0 and 1 under normal load', () => {
    const cf = new CuckooFilter(200);
    for (let i = 0; i < 20; i++) cf.add(`item-${i}`);
    assert.ok(cf.loadFactor >= 0 && cf.loadFactor <= 1);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('CuckooFilter clear', () => {
  it('resets size to 0', () => {
    const cf = new CuckooFilter(100);
    cf.add('x');
    cf.add('y');
    cf.clear();
    assert.equal(cf.size, 0);
  });

  it('previously added items are no longer found', () => {
    const cf = new CuckooFilter(200);
    cf.add('hello');
    cf.add('world');
    cf.clear();
    assert.equal(cf.has('hello'), false);
    assert.equal(cf.has('world'), false);
  });

  it('allows adding items after clear', () => {
    const cf = new CuckooFilter(100);
    cf.add('before');
    cf.clear();
    cf.add('after');
    assert.equal(cf.has('after'), true);
    assert.equal(cf.size, 1);
  });
});

// ─── filter full behaviour ───────────────────────────────────────────────────

describe('CuckooFilter full behaviour', () => {
  it('returns false from add when the filter is full', () => {
    // Very small capacity to trigger fullness.
    const cf = new CuckooFilter(1);
    let failedAdd = false;
    for (let i = 0; i < 200; i++) {
      if (!cf.add(`overflow-${i}`)) {
        failedAdd = true;
        break;
      }
    }
    assert.ok(failedAdd, 'Expected at least one add to fail on a tiny filter');
  });
});

// ─── factory function ─────────────────────────────────────────────────────────

describe('createCuckooFilter factory', () => {
  it('returns a CuckooFilter instance', () => {
    const cf = createCuckooFilter(100);
    assert.ok(cf instanceof CuckooFilter);
  });

  it('created filter works correctly', () => {
    const cf = createCuckooFilter(200);
    cf.add('test');
    assert.equal(cf.has('test'), true);
    assert.equal(cf.size, 1);
  });
});
