// ─── Unit Tests: DisjointSet ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DisjointSet, createDisjointSet } from '../../app/modules/disjoint-set.js';

describe('DisjointSet – makeSet / size', () => {
  it('starts empty with size 0', () => {
    const ds = new DisjointSet();
    assert.equal(ds.size, 0);
    assert.equal(ds.setCount, 0);
  });

  it('adds elements and tracks size', () => {
    const ds = new DisjointSet();
    ds.makeSet('a');
    ds.makeSet('b');
    ds.makeSet('c');
    assert.equal(ds.size, 3);
    assert.equal(ds.setCount, 3);
  });

  it('ignores duplicate makeSet calls', () => {
    const ds = new DisjointSet();
    ds.makeSet(1);
    ds.makeSet(1);
    assert.equal(ds.size, 1);
    assert.equal(ds.setCount, 1);
  });
});

describe('DisjointSet – find', () => {
  it('returns the item itself for a singleton set', () => {
    const ds = new DisjointSet();
    ds.makeSet(42);
    assert.equal(ds.find(42), 42);
  });

  it('throws for an item that was never added', () => {
    const ds = new DisjointSet();
    assert.throws(() => ds.find('missing'), { message: /not found/i });
  });
});

describe('DisjointSet – union', () => {
  it('returns true when merging two distinct sets', () => {
    const ds = new DisjointSet();
    ds.makeSet(1);
    ds.makeSet(2);
    assert.equal(ds.union(1, 2), true);
    assert.equal(ds.setCount, 1);
  });

  it('returns false when items are already in the same set', () => {
    const ds = new DisjointSet();
    ds.makeSet(1);
    ds.makeSet(2);
    ds.union(1, 2);
    assert.equal(ds.union(1, 2), false);
  });

  it('merges multiple sets via chained unions', () => {
    const ds = new DisjointSet();
    for (let i = 0; i < 5; i++) ds.makeSet(i);
    ds.union(0, 1);
    ds.union(2, 3);
    ds.union(0, 3);
    // {0,1,2,3} and {4}
    assert.equal(ds.setCount, 2);
    assert.equal(ds.connected(0, 2), true);
    assert.equal(ds.connected(1, 3), true);
    assert.equal(ds.connected(0, 4), false);
  });
});

describe('DisjointSet – connected', () => {
  it('returns false for items in different sets', () => {
    const ds = new DisjointSet();
    ds.makeSet('x');
    ds.makeSet('y');
    assert.equal(ds.connected('x', 'y'), false);
  });

  it('returns true after union', () => {
    const ds = new DisjointSet();
    ds.makeSet('x');
    ds.makeSet('y');
    ds.union('x', 'y');
    assert.equal(ds.connected('x', 'y'), true);
  });

  it('returns true for an item connected to itself', () => {
    const ds = new DisjointSet();
    ds.makeSet(7);
    assert.equal(ds.connected(7, 7), true);
  });
});

describe('DisjointSet – setSize', () => {
  it('returns 1 for a singleton set', () => {
    const ds = new DisjointSet();
    ds.makeSet('a');
    assert.equal(ds.setSize('a'), 1);
  });

  it('grows after unions', () => {
    const ds = new DisjointSet();
    ds.makeSet(1);
    ds.makeSet(2);
    ds.makeSet(3);
    ds.union(1, 2);
    assert.equal(ds.setSize(1), 2);
    assert.equal(ds.setSize(2), 2);
    ds.union(2, 3);
    assert.equal(ds.setSize(3), 3);
  });
});

describe('DisjointSet – sets', () => {
  it('returns empty array for empty disjoint set', () => {
    const ds = new DisjointSet();
    assert.deepEqual(ds.sets(), []);
  });

  it('returns singleton sets when nothing is unioned', () => {
    const ds = new DisjointSet();
    ds.makeSet(1);
    ds.makeSet(2);
    const result = ds.sets();
    assert.equal(result.length, 2);
    // Each set should have exactly one element
    const flat = result.flat().sort();
    assert.deepEqual(flat, [1, 2]);
  });

  it('groups elements correctly after unions', () => {
    const ds = new DisjointSet();
    ds.makeSet('a');
    ds.makeSet('b');
    ds.makeSet('c');
    ds.makeSet('d');
    ds.union('a', 'b');
    ds.union('c', 'd');
    const result = ds.sets();
    assert.equal(result.length, 2);
    // Sort each set and the outer array for deterministic comparison
    const sorted = result.map(s => s.sort()).sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(sorted, [['a', 'b'], ['c', 'd']]);
  });
});

describe('DisjointSet – path compression', () => {
  it('compresses long chains so find returns the root directly', () => {
    const ds = new DisjointSet();
    // Build a chain: 0 -> 1 -> 2 -> 3 -> 4
    for (let i = 0; i < 5; i++) ds.makeSet(i);
    ds.union(0, 1);
    ds.union(1, 2);
    ds.union(2, 3);
    ds.union(3, 4);
    // All should share the same root
    const root = ds.find(4);
    assert.equal(ds.find(0), root);
    assert.equal(ds.find(1), root);
    assert.equal(ds.find(2), root);
    assert.equal(ds.find(3), root);
  });
});

describe('DisjointSet – createDisjointSet factory', () => {
  it('creates a functional DisjointSet instance', () => {
    const ds = createDisjointSet();
    ds.makeSet('hello');
    ds.makeSet('world');
    ds.union('hello', 'world');
    assert.equal(ds.connected('hello', 'world'), true);
    assert.equal(ds.size, 2);
    assert.equal(ds.setCount, 1);
  });
});
