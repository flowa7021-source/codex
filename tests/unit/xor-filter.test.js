// ─── Unit Tests: xor-filter ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { XorFilter, createXorFilter } from '../../app/modules/xor-filter.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('XorFilter constructor', () => {
  it('builds from an array of items', () => {
    const xf = new XorFilter(['a', 'b', 'c']);
    assert.equal(xf.size, 3);
  });

  it('handles empty input', () => {
    const xf = new XorFilter([]);
    assert.equal(xf.size, 0);
  });

  it('deduplicates input items', () => {
    const xf = new XorFilter(['x', 'x', 'y', 'y', 'z']);
    assert.equal(xf.size, 3);
  });

  it('handles a single item', () => {
    const xf = new XorFilter(['solo']);
    assert.equal(xf.size, 1);
    assert.equal(xf.has('solo'), true);
  });
});

// ─── has ──────────────────────────────────────────────────────────────────────

describe('XorFilter has', () => {
  it('returns true for all inserted items', () => {
    const items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    const xf = new XorFilter(items);
    for (const item of items) {
      assert.equal(xf.has(item), true, `Should find "${item}"`);
    }
  });

  it('returns false for items not inserted (low false positive rate)', () => {
    const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
    const xf = new XorFilter(items);
    let falsePositives = 0;
    for (let i = 1000; i < 1200; i++) {
      if (xf.has(`not-in-filter-${i}`)) falsePositives++;
    }
    // 8-bit fingerprint -> ~1/256 ~ 0.4% false positive rate.
    // Allow up to 5% for safety margin.
    assert.ok(falsePositives < 10, `Too many false positives: ${falsePositives}/200`);
  });

  it('returns false on an empty filter', () => {
    const xf = new XorFilter([]);
    assert.equal(xf.has('anything'), false);
  });

  it('works with a large set', () => {
    const items = Array.from({ length: 1000 }, (_, i) => `large-set-${i}`);
    const xf = new XorFilter(items);
    // Verify all items are found.
    for (const item of items) {
      assert.equal(xf.has(item), true);
    }
  });
});

// ─── size ─────────────────────────────────────────────────────────────────────

describe('XorFilter size', () => {
  it('matches unique item count', () => {
    const xf = new XorFilter(['a', 'b', 'c', 'd']);
    assert.equal(xf.size, 4);
  });

  it('is 0 for empty input', () => {
    const xf = new XorFilter([]);
    assert.equal(xf.size, 0);
  });
});

// ─── bitsPerItem ──────────────────────────────────────────────────────────────

describe('XorFilter bitsPerItem', () => {
  it('returns a positive number for non-empty filters', () => {
    const xf = new XorFilter(['a', 'b', 'c']);
    assert.ok(xf.bitsPerItem > 0);
  });

  it('is approximately 8 * 1.23 = ~9.84 for 8-bit fingerprints', () => {
    // XOR filters with 8-bit fingerprints use ~9.84 bits per item.
    const items = Array.from({ length: 500 }, (_, i) => `item-${i}`);
    const xf = new XorFilter(items);
    // Allow generous range: 8 to 13 bits per item.
    assert.ok(xf.bitsPerItem >= 8, `bitsPerItem too low: ${xf.bitsPerItem}`);
    assert.ok(xf.bitsPerItem <= 13, `bitsPerItem too high: ${xf.bitsPerItem}`);
  });

  it('returns 0 for empty filter', () => {
    const xf = new XorFilter([]);
    assert.equal(xf.bitsPerItem, 0);
  });
});

// ─── factory function ─────────────────────────────────────────────────────────

describe('createXorFilter factory', () => {
  it('returns an XorFilter instance', () => {
    const xf = createXorFilter(['a', 'b']);
    assert.ok(xf instanceof XorFilter);
  });

  it('created filter correctly identifies members', () => {
    const xf = createXorFilter(['hello', 'world']);
    assert.equal(xf.has('hello'), true);
    assert.equal(xf.has('world'), true);
    assert.equal(xf.size, 2);
  });
});

// ─── unicode / special strings ────────────────────────────────────────────────

describe('XorFilter special strings', () => {
  it('handles unicode strings', () => {
    const items = ['\u00e9\u00e8\u00ea', '\u00fc\u00f6\u00e4', '\u4f60\u597d', '\ud83d\ude00'];
    const xf = new XorFilter(items);
    for (const item of items) {
      assert.equal(xf.has(item), true, `Should find "${item}"`);
    }
  });

  it('handles empty string as an item', () => {
    const xf = new XorFilter(['', 'notempty']);
    assert.equal(xf.has(''), true);
    assert.equal(xf.has('notempty'), true);
  });
});
