// ─── Unit Tests: persistent-list ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PersistentList, list } from '../../app/modules/persistent-list.js';

// ─── constructor / factory / introspection ────────────────────────────────────

describe('PersistentList – constructor, factory, and introspection', () => {
  it('creates an empty list with no arguments', () => {
    const l = new PersistentList();
    assert.equal(l.size, 0);
    assert.ok(l.isEmpty);
  });

  it('creates a list from an initial array', () => {
    const l = new PersistentList([1, 2, 3]);
    assert.equal(l.size, 3);
    assert.equal(l.isEmpty, false);
  });

  it('factory list() spreads items into a PersistentList', () => {
    const l = list(10, 20, 30);
    assert.ok(l instanceof PersistentList);
    assert.equal(l.size, 3);
  });

  it('factory list() with no args creates an empty list', () => {
    const l = list();
    assert.ok(l.isEmpty);
  });

  it('get returns the item at a given index', () => {
    const l = list('a', 'b', 'c');
    assert.equal(l.get(0), 'a');
    assert.equal(l.get(2), 'c');
  });

  it('get returns undefined for out-of-range index', () => {
    const l = list(1, 2, 3);
    assert.equal(l.get(99), undefined);
    assert.equal(l.get(-1), undefined);
  });

  it('toArray returns a mutable copy of the items', () => {
    const l = list(1, 2, 3);
    const arr = l.toArray();
    arr.push(99);
    assert.equal(l.size, 3, 'push to the copy must not affect the list');
  });

  it('constructor does not retain a reference to the source array', () => {
    const src = [1, 2, 3];
    const l = new PersistentList(src);
    src.push(99);
    assert.equal(l.size, 3, 'mutating the source array must not affect the list');
  });
});

// ─── push / pop ───────────────────────────────────────────────────────────────

describe('PersistentList – push and pop', () => {
  it('push returns a new list with the item appended', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.push(4);
    assert.deepEqual(l2.toArray(), [1, 2, 3, 4]);
  });

  it('push does not mutate the original list', () => {
    const l1 = list(1, 2, 3);
    l1.push(99);
    assert.equal(l1.size, 3, 'original must remain unchanged after push');
  });

  it('push on an empty list creates a single-element list', () => {
    const l = list().push(42);
    assert.equal(l.size, 1);
    assert.equal(l.get(0), 42);
  });

  it('pop returns the last item and a shorter list', () => {
    const l1 = list(1, 2, 3);
    const { list: l2, item } = l1.pop();
    assert.equal(item, 3);
    assert.deepEqual(l2.toArray(), [1, 2]);
  });

  it('pop on an empty list returns undefined item and empty list', () => {
    const l = list();
    const { list: l2, item } = l.pop();
    assert.equal(item, undefined);
    assert.ok(l2.isEmpty);
  });

  it('pop does not mutate the original list', () => {
    const l1 = list(1, 2, 3);
    l1.pop();
    assert.equal(l1.size, 3, 'original must remain unchanged after pop');
  });

  it('chained pushes are independent from each other', () => {
    const base = list(1);
    const l2 = base.push(2);
    const l3 = base.push(3);
    assert.deepEqual(base.toArray(), [1]);
    assert.deepEqual(l2.toArray(), [1, 2]);
    assert.deepEqual(l3.toArray(), [1, 3]);
  });

  it('push then pop restores to original content', () => {
    const l1 = list(1, 2, 3);
    const { list: l2, item } = l1.push(4).pop();
    assert.equal(item, 4);
    assert.deepEqual(l2.toArray(), [1, 2, 3]);
  });
});

// ─── unshift / shift ──────────────────────────────────────────────────────────

describe('PersistentList – unshift and shift', () => {
  it('unshift returns a new list with the item at the front', () => {
    const l1 = list(2, 3, 4);
    const l2 = l1.unshift(1);
    assert.deepEqual(l2.toArray(), [1, 2, 3, 4]);
  });

  it('unshift does not mutate the original list', () => {
    const l1 = list(1, 2, 3);
    l1.unshift(0);
    assert.deepEqual(l1.toArray(), [1, 2, 3], 'original must remain unchanged after unshift');
  });

  it('unshift on an empty list creates a single-element list', () => {
    const l = list().unshift('first');
    assert.equal(l.size, 1);
    assert.equal(l.get(0), 'first');
  });

  it('shift returns the first item and a shorter list', () => {
    const l1 = list(10, 20, 30);
    const { list: l2, item } = l1.shift();
    assert.equal(item, 10);
    assert.deepEqual(l2.toArray(), [20, 30]);
  });

  it('shift on an empty list returns undefined item and empty list', () => {
    const l = list();
    const { list: l2, item } = l.shift();
    assert.equal(item, undefined);
    assert.ok(l2.isEmpty);
  });

  it('shift does not mutate the original list', () => {
    const l1 = list(1, 2, 3);
    l1.shift();
    assert.deepEqual(l1.toArray(), [1, 2, 3], 'original must remain unchanged after shift');
  });

  it('unshift then shift restores to original content', () => {
    const l1 = list(2, 3, 4);
    const { list: l2, item } = l1.unshift(1).shift();
    assert.equal(item, 1);
    assert.deepEqual(l2.toArray(), [2, 3, 4]);
  });

  it('multiple unshifts from the same base are independent', () => {
    const base = list(3);
    const l1 = base.unshift(2);
    const l2 = base.unshift(0);
    assert.deepEqual(base.toArray(), [3]);
    assert.deepEqual(l1.toArray(), [2, 3]);
    assert.deepEqual(l2.toArray(), [0, 3]);
  });
});

// ─── set ─────────────────────────────────────────────────────────────────────

describe('PersistentList – set', () => {
  it('returns a new list with the item at index replaced', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.set(1, 99);
    assert.deepEqual(l2.toArray(), [1, 99, 3]);
  });

  it('does not mutate the original list', () => {
    const l1 = list(1, 2, 3);
    l1.set(0, 99);
    assert.deepEqual(l1.toArray(), [1, 2, 3], 'original must remain unchanged after set');
  });

  it('set returns a new PersistentList instance', () => {
    const l1 = list(1, 2);
    const l2 = l1.set(0, 5);
    assert.ok(l2 instanceof PersistentList);
    assert.notEqual(l1, l2);
  });

  it('set with out-of-range index returns a copy without change', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.set(100, 42);
    assert.deepEqual(l2.toArray(), [1, 2, 3]);
  });

  it('set at index 0 replaces the first element', () => {
    const l1 = list('a', 'b', 'c');
    const l2 = l1.set(0, 'z');
    assert.equal(l2.get(0), 'z');
    assert.equal(l1.get(0), 'a');
  });

  it('chained sets from the same base are independent', () => {
    const base = list(0, 0, 0);
    const l1 = base.set(0, 1);
    const l2 = base.set(1, 2);
    assert.deepEqual(base.toArray(), [0, 0, 0]);
    assert.deepEqual(l1.toArray(), [1, 0, 0]);
    assert.deepEqual(l2.toArray(), [0, 2, 0]);
  });

  it('set at last valid index works correctly', () => {
    const l1 = list(10, 20, 30);
    const l2 = l1.set(2, 300);
    assert.equal(l2.get(2), 300);
    assert.equal(l1.get(2), 30);
  });

  it('set with negative index returns copy unchanged', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.set(-1, 99);
    assert.deepEqual(l2.toArray(), [1, 2, 3]);
  });
});

// ─── map / filter ─────────────────────────────────────────────────────────────

describe('PersistentList – map and filter', () => {
  it('map applies the function to each item', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.map((x) => x * 2);
    assert.deepEqual(l2.toArray(), [2, 4, 6]);
  });

  it('map does not mutate the original list', () => {
    const l1 = list(1, 2, 3);
    l1.map((x) => x + 100);
    assert.deepEqual(l1.toArray(), [1, 2, 3]);
  });

  it('map can change the element type', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.map((x) => String(x));
    assert.deepEqual(l2.toArray(), ['1', '2', '3']);
  });

  it('map passes the index as the second argument', () => {
    const l = list('a', 'b', 'c');
    const indices = [];
    l.map((_, i) => { indices.push(i); return i; });
    assert.deepEqual(indices, [0, 1, 2]);
  });

  it('filter returns only items matching the predicate', () => {
    const l1 = list(1, 2, 3, 4, 5, 6);
    const l2 = l1.filter((x) => x % 2 === 0);
    assert.deepEqual(l2.toArray(), [2, 4, 6]);
  });

  it('filter does not mutate the original list', () => {
    const l1 = list(1, 2, 3, 4, 5);
    l1.filter((x) => x > 3);
    assert.deepEqual(l1.toArray(), [1, 2, 3, 4, 5]);
  });

  it('filter returns an empty list when no items match', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.filter(() => false);
    assert.ok(l2.isEmpty);
  });

  it('filter passes the index as the second argument', () => {
    const l = list('a', 'b', 'c', 'd');
    const l2 = l.filter((_, i) => i % 2 === 0);
    assert.deepEqual(l2.toArray(), ['a', 'c']);
  });

  it('map on an empty list returns an empty list', () => {
    const l = list();
    assert.ok(l.map((x) => x).isEmpty);
  });

  it('filter on an empty list returns an empty list', () => {
    const l = list();
    assert.ok(l.filter(() => true).isEmpty);
  });
});

// ─── slice / concat ───────────────────────────────────────────────────────────

describe('PersistentList – slice and concat', () => {
  it('slice extracts the specified range', () => {
    const l1 = list(0, 1, 2, 3, 4);
    const l2 = l1.slice(1, 4);
    assert.deepEqual(l2.toArray(), [1, 2, 3]);
  });

  it('slice does not mutate the original list', () => {
    const l1 = list(1, 2, 3, 4, 5);
    l1.slice(1, 3);
    assert.deepEqual(l1.toArray(), [1, 2, 3, 4, 5]);
  });

  it('slice with no arguments returns a full copy', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.slice();
    assert.deepEqual(l2.toArray(), [1, 2, 3]);
    assert.notEqual(l1, l2, 'must be a distinct instance');
  });

  it('slice with only start returns from start to end', () => {
    const l1 = list(10, 20, 30, 40);
    const l2 = l1.slice(2);
    assert.deepEqual(l2.toArray(), [30, 40]);
  });

  it('slice beyond array bounds returns up to the last element', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.slice(1, 100);
    assert.deepEqual(l2.toArray(), [2, 3]);
  });

  it('concat combines two lists into a new list', () => {
    const l1 = list(1, 2, 3);
    const l2 = list(4, 5, 6);
    const l3 = l1.concat(l2);
    assert.deepEqual(l3.toArray(), [1, 2, 3, 4, 5, 6]);
  });

  it('concat does not mutate either original list', () => {
    const l1 = list(1, 2);
    const l2 = list(3, 4);
    l1.concat(l2);
    assert.deepEqual(l1.toArray(), [1, 2], 'l1 must remain unchanged');
    assert.deepEqual(l2.toArray(), [3, 4], 'l2 must remain unchanged');
  });

  it('concat with an empty list returns equivalent content', () => {
    const l1 = list(1, 2, 3);
    const l2 = l1.concat(list());
    assert.deepEqual(l2.toArray(), [1, 2, 3]);
  });

  it('concat of two empty lists returns an empty list', () => {
    const l = list().concat(list());
    assert.ok(l.isEmpty);
  });

  it('slice returns a PersistentList instance', () => {
    const l = list(1, 2, 3).slice(0, 2);
    assert.ok(l instanceof PersistentList);
  });

  it('concat returns a PersistentList instance', () => {
    const l = list(1).concat(list(2));
    assert.ok(l instanceof PersistentList);
  });
});
