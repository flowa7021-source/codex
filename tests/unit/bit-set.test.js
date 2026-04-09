// ─── Unit Tests: bit-set ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BitSet, createBitSet } from '../../app/modules/bit-set.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('BitSet constructor', () => {
  it('creates a bit set with default size 32', () => {
    const bs = new BitSet();
    assert.equal(bs.size, 32);
    assert.equal(bs.isEmpty(), true);
  });

  it('creates a bit set with custom size', () => {
    const bs = new BitSet(64);
    assert.equal(bs.size, 64);
  });
});

// ─── set / get ────────────────────────────────────────────────────────────────

describe('set and get', () => {
  it('sets and reads a bit', () => {
    const bs = new BitSet();
    bs.set(0);
    assert.equal(bs.get(0), true);
    assert.equal(bs.get(1), false);
  });

  it('sets bits at various positions', () => {
    const bs = new BitSet(64);
    bs.set(0);
    bs.set(31);
    bs.set(32);
    bs.set(63);
    assert.equal(bs.get(0), true);
    assert.equal(bs.get(31), true);
    assert.equal(bs.get(32), true);
    assert.equal(bs.get(63), true);
    assert.equal(bs.get(1), false);
  });

  it('auto-grows when setting a bit beyond current size', () => {
    const bs = new BitSet(8);
    bs.set(100);
    assert.equal(bs.get(100), true);
    assert.ok(bs.size > 100);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('clears a set bit', () => {
    const bs = new BitSet();
    bs.set(5);
    bs.clear(5);
    assert.equal(bs.get(5), false);
  });

  it('is a no-op for an unset bit', () => {
    const bs = new BitSet();
    bs.clear(5);
    assert.equal(bs.get(5), false);
  });

  it('is a no-op for a bit beyond current size', () => {
    const bs = new BitSet(8);
    bs.clear(100);  // should not throw or grow
    assert.equal(bs.size, 8);
  });
});

// ─── toggle ───────────────────────────────────────────────────────────────────

describe('toggle', () => {
  it('toggles a bit on and off', () => {
    const bs = new BitSet();
    bs.toggle(3);
    assert.equal(bs.get(3), true);
    bs.toggle(3);
    assert.equal(bs.get(3), false);
  });
});

// ─── count ────────────────────────────────────────────────────────────────────

describe('count', () => {
  it('returns 0 for empty set', () => {
    assert.equal(new BitSet().count(), 0);
  });

  it('counts set bits correctly', () => {
    const bs = new BitSet(128);
    bs.set(0);
    bs.set(1);
    bs.set(31);
    bs.set(32);
    bs.set(127);
    assert.equal(bs.count(), 5);
  });
});

// ─── and (intersection) ──────────────────────────────────────────────────────

describe('and', () => {
  it('returns intersection of two bit sets', () => {
    const a = new BitSet();
    const b = new BitSet();
    a.set(1); a.set(2); a.set(3);
    b.set(2); b.set(3); b.set(4);
    const result = a.and(b);
    assert.deepEqual(result.toArray(), [2, 3]);
  });

  it('handles different sizes', () => {
    const a = new BitSet(32);
    const b = new BitSet(64);
    a.set(0); a.set(31);
    b.set(0); b.set(50);
    const result = a.and(b);
    assert.deepEqual(result.toArray(), [0]);
  });
});

// ─── or (union) ───────────────────────────────────────────────────────────────

describe('or', () => {
  it('returns union of two bit sets', () => {
    const a = new BitSet();
    const b = new BitSet();
    a.set(0); a.set(2);
    b.set(1); b.set(2);
    const result = a.or(b);
    assert.deepEqual(result.toArray(), [0, 1, 2]);
  });
});

// ─── xor ──────────────────────────────────────────────────────────────────────

describe('xor', () => {
  it('returns symmetric difference', () => {
    const a = new BitSet();
    const b = new BitSet();
    a.set(0); a.set(1); a.set(2);
    b.set(1); b.set(2); b.set(3);
    const result = a.xor(b);
    assert.deepEqual(result.toArray(), [0, 3]);
  });
});

// ─── not ──────────────────────────────────────────────────────────────────────

describe('not', () => {
  it('flips all bits within size', () => {
    const bs = new BitSet(4);
    bs.set(0);
    bs.set(2);
    const result = bs.not();
    assert.deepEqual(result.toArray(), [1, 3]);
  });

  it('complement of empty is all bits set within size', () => {
    const bs = new BitSet(8);
    const result = bs.not();
    assert.equal(result.count(), 8);
    assert.deepEqual(result.toArray(), [0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

// ─── equals ───────────────────────────────────────────────────────────────────

describe('equals', () => {
  it('returns true for identical bit sets', () => {
    const a = new BitSet();
    const b = new BitSet();
    a.set(1); a.set(5);
    b.set(1); b.set(5);
    assert.equal(a.equals(b), true);
  });

  it('returns false for different bit sets', () => {
    const a = new BitSet();
    const b = new BitSet();
    a.set(1);
    b.set(2);
    assert.equal(a.equals(b), false);
  });

  it('handles different sizes with same content', () => {
    const a = new BitSet(32);
    const b = new BitSet(64);
    a.set(0);
    b.set(0);
    assert.equal(a.equals(b), true);
  });
});

// ─── isEmpty ──────────────────────────────────────────────────────────────────

describe('isEmpty', () => {
  it('returns true when no bits are set', () => {
    assert.equal(new BitSet().isEmpty(), true);
  });

  it('returns false when bits are set', () => {
    const bs = new BitSet();
    bs.set(0);
    assert.equal(bs.isEmpty(), false);
  });
});

// ─── toArray ──────────────────────────────────────────────────────────────────

describe('toArray', () => {
  it('returns empty array for empty bit set', () => {
    assert.deepEqual(new BitSet().toArray(), []);
  });

  it('returns sorted indices of set bits', () => {
    const bs = new BitSet(128);
    bs.set(100);
    bs.set(3);
    bs.set(50);
    assert.deepEqual(bs.toArray(), [3, 50, 100]);
  });
});

// ─── toString ─────────────────────────────────────────────────────────────────

describe('toString', () => {
  it('returns binary string representation', () => {
    const bs = new BitSet(8);
    bs.set(0);
    bs.set(2);
    bs.set(7);
    assert.equal(bs.toString(), '10100001');
  });

  it('returns all zeros for empty set', () => {
    const bs = new BitSet(4);
    assert.equal(bs.toString(), '0000');
  });
});

// ─── createBitSet factory ─────────────────────────────────────────────────────

describe('createBitSet', () => {
  it('returns a new BitSet instance', () => {
    const bs = createBitSet(16);
    assert.ok(bs instanceof BitSet);
    assert.equal(bs.size, 16);
  });

  it('uses default size when no argument provided', () => {
    const bs = createBitSet();
    assert.equal(bs.size, 32);
  });
});
