// ─── Unit Tests: Multiset ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Multiset } from '../../app/modules/multiset.js';

// ─── Construction ─────────────────────────────────────────────────────────────

describe('Multiset – construction', () => {
  it('empty constructor gives size 0', () => {
    const ms = new Multiset();
    assert.equal(ms.size, 0);
    assert.equal(ms.distinctSize, 0);
  });

  it('initialises from iterable', () => {
    const ms = new Multiset(['a', 'b', 'a', 'c', 'a']);
    assert.equal(ms.count('a'), 3);
    assert.equal(ms.count('b'), 1);
    assert.equal(ms.size, 5);
  });
});

// ─── add / delete / deleteAll ─────────────────────────────────────────────────

describe('Multiset – add', () => {
  it('adds a single occurrence', () => {
    const ms = new Multiset();
    ms.add('x');
    assert.equal(ms.count('x'), 1);
  });

  it('adds multiple occurrences at once', () => {
    const ms = new Multiset();
    ms.add('x', 5);
    assert.equal(ms.count('x'), 5);
  });

  it('throws on non-positive count', () => {
    const ms = new Multiset();
    assert.throws(() => ms.add('x', 0), RangeError);
    assert.throws(() => ms.add('x', -1), RangeError);
  });

  it('accumulates counts', () => {
    const ms = new Multiset();
    ms.add('y', 3);
    ms.add('y', 2);
    assert.equal(ms.count('y'), 5);
  });
});

describe('Multiset – delete', () => {
  it('removes one occurrence', () => {
    const ms = new Multiset(['a', 'a', 'a']);
    assert.equal(ms.delete('a'), true);
    assert.equal(ms.count('a'), 2);
  });

  it('returns false when item absent', () => {
    const ms = new Multiset();
    assert.equal(ms.delete('z'), false);
  });

  it('removes all when count >= current', () => {
    const ms = new Multiset(['a', 'a']);
    ms.delete('a', 5);
    assert.equal(ms.has('a'), false);
    assert.equal(ms.size, 0);
  });

  it('throws on non-positive count', () => {
    const ms = new Multiset(['a']);
    assert.throws(() => ms.delete('a', 0), RangeError);
  });
});

describe('Multiset – deleteAll', () => {
  it('removes all occurrences', () => {
    const ms = new Multiset(['b', 'b', 'b']);
    assert.equal(ms.deleteAll('b'), true);
    assert.equal(ms.size, 0);
  });

  it('returns false when item absent', () => {
    const ms = new Multiset();
    assert.equal(ms.deleteAll('x'), false);
  });
});

// ─── Query ────────────────────────────────────────────────────────────────────

describe('Multiset – query', () => {
  it('has() returns true for present items', () => {
    const ms = new Multiset(['a']);
    assert.equal(ms.has('a'), true);
    assert.equal(ms.has('b'), false);
  });

  it('size counts duplicates', () => {
    const ms = new Multiset(['a', 'a', 'b']);
    assert.equal(ms.size, 3);
  });

  it('distinctSize counts unique items', () => {
    const ms = new Multiset(['a', 'a', 'b']);
    assert.equal(ms.distinctSize, 2);
  });
});

// ─── Iteration ───────────────────────────────────────────────────────────────

describe('Multiset – iteration', () => {
  it('keys() returns distinct items', () => {
    const ms = new Multiset(['x', 'x', 'y']);
    assert.deepEqual(ms.keys().sort(), ['x', 'y']);
  });

  it('values() repeats items by count', () => {
    const ms = new Multiset(['a', 'a', 'b']);
    assert.deepEqual(ms.values().sort(), ['a', 'a', 'b']);
  });

  it('entries() returns [item, count] pairs', () => {
    const ms = new Multiset(['c', 'c', 'c']);
    assert.deepEqual(ms.entries(), [['c', 3]]);
  });
});

// ─── Set-like Operations ──────────────────────────────────────────────────────

describe('Multiset – union', () => {
  it('takes max count per element', () => {
    const a = new Multiset(['x', 'x', 'y']);
    const b = new Multiset(['x', 'y', 'y', 'z']);
    const u = a.union(b);
    assert.equal(u.count('x'), 2);
    assert.equal(u.count('y'), 2);
    assert.equal(u.count('z'), 1);
  });
});

describe('Multiset – intersect', () => {
  it('takes min count per element', () => {
    const a = new Multiset(['a', 'a', 'b', 'c']);
    const b = new Multiset(['a', 'b', 'b']);
    const i = a.intersect(b);
    assert.equal(i.count('a'), 1);
    assert.equal(i.count('b'), 1);
    assert.equal(i.has('c'), false);
  });
});

describe('Multiset – difference', () => {
  it('subtracts counts, floors at 0', () => {
    const a = new Multiset(['a', 'a', 'a', 'b']);
    const b = new Multiset(['a', 'b', 'b']);
    const d = a.difference(b);
    assert.equal(d.count('a'), 2);
    assert.equal(d.has('b'), false);
  });
});

describe('Multiset – sum', () => {
  it('adds counts from both', () => {
    const a = new Multiset(['x', 'x']);
    const b = new Multiset(['x', 'y']);
    const s = a.sum(b);
    assert.equal(s.count('x'), 3);
    assert.equal(s.count('y'), 1);
  });
});
