// ─── Unit Tests: IntervalTree ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { IntervalTree, createIntervalTree } from '../../app/modules/interval-tree.js';

// ─── createIntervalTree / constructor ─────────────────────────────────────────

describe('createIntervalTree – factory', () => {
  it('returns an IntervalTree instance', () => {
    const tree = createIntervalTree();
    assert.ok(tree instanceof IntervalTree);
  });

  it('starts with size 0', () => {
    const tree = createIntervalTree();
    assert.equal(tree.size, 0);
  });

  it('toArray returns empty array on new tree', () => {
    const tree = createIntervalTree();
    assert.deepEqual(tree.toArray(), []);
  });

  it('search returns empty array on empty tree', () => {
    const tree = createIntervalTree();
    assert.deepEqual(tree.search(5), []);
  });

  it('overlap returns empty array on empty tree', () => {
    const tree = createIntervalTree();
    assert.deepEqual(tree.overlap(0, 10), []);
  });

  it('new IntervalTree() also starts empty', () => {
    const tree = new IntervalTree();
    assert.equal(tree.size, 0);
    assert.deepEqual(tree.toArray(), []);
  });

  it('two factory calls produce independent trees', () => {
    const a = createIntervalTree();
    const b = createIntervalTree();
    a.insert({ low: 1, high: 5 });
    assert.equal(a.size, 1);
    assert.equal(b.size, 0);
  });

  it('size getter is 0 before any inserts', () => {
    assert.equal(new IntervalTree().size, 0);
  });
});

// ─── insert ───────────────────────────────────────────────────────────────────

describe('IntervalTree – insert', () => {
  it('increments size on each insert', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 0, high: 5 });
    assert.equal(tree.size, 1);
    tree.insert({ low: 2, high: 8 });
    assert.equal(tree.size, 2);
    tree.insert({ low: 10, high: 15 });
    assert.equal(tree.size, 3);
  });

  it('stores the interval intact (including data)', () => {
    const tree = createIntervalTree();
    const iv = { low: 1, high: 4, data: 'hello' };
    tree.insert(iv);
    const all = tree.toArray();
    assert.equal(all.length, 1);
    assert.deepEqual(all[0], iv);
  });

  it('allows duplicate intervals', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 1, high: 5 });
    tree.insert({ low: 1, high: 5 });
    assert.equal(tree.size, 2);
  });

  it('allows inserting intervals in reverse order', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 10, high: 20 });
    tree.insert({ low: 5, high: 15 });
    tree.insert({ low: 1, high: 3 });
    assert.equal(tree.size, 3);
  });

  it('allows intervals with equal low and high (point intervals)', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 5, high: 5 });
    assert.equal(tree.size, 1);
    const found = tree.search(5);
    assert.equal(found.length, 1);
  });

  it('allows intervals with negative values', () => {
    const tree = createIntervalTree();
    tree.insert({ low: -10, high: -2 });
    assert.equal(tree.size, 1);
    assert.equal(tree.search(-5).length, 1);
  });

  it('allows intervals with data field set to any value', () => {
    const tree = createIntervalTree();
    const obj = { x: 42 };
    tree.insert({ low: 0, high: 1, data: obj });
    const found = tree.search(0);
    assert.equal(found[0].data, obj);
  });

  it('toArray length matches size after many inserts', () => {
    const tree = createIntervalTree();
    for (let i = 0; i < 20; i++) {
      tree.insert({ low: i, high: i + 5 });
    }
    assert.equal(tree.toArray().length, tree.size);
    assert.equal(tree.size, 20);
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('IntervalTree – remove', () => {
  it('returns false when removing from empty tree', () => {
    const tree = createIntervalTree();
    assert.equal(tree.remove({ low: 0, high: 5 }), false);
  });

  it('returns false when interval is not found', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 1, high: 4 });
    assert.equal(tree.remove({ low: 5, high: 8 }), false);
  });

  it('returns true and decrements size when interval is found', () => {
    const tree = createIntervalTree();
    const iv = { low: 2, high: 7 };
    tree.insert(iv);
    assert.equal(tree.size, 1);
    assert.equal(tree.remove(iv), true);
    assert.equal(tree.size, 0);
  });

  it('removed interval is no longer returned by search', () => {
    const tree = createIntervalTree();
    const iv = { low: 0, high: 10 };
    tree.insert(iv);
    tree.remove(iv);
    assert.deepEqual(tree.search(5), []);
  });

  it('only removes one of two duplicate intervals', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 1, high: 5 });
    tree.insert({ low: 1, high: 5 });
    assert.equal(tree.remove({ low: 1, high: 5 }), true);
    assert.equal(tree.size, 1);
  });

  it('tree remains consistent after removing the root interval', () => {
    const tree = createIntervalTree();
    const iv1 = { low: 5, high: 10 };
    const iv2 = { low: 1, high: 3 };
    const iv3 = { low: 8, high: 12 };
    tree.insert(iv1);
    tree.insert(iv2);
    tree.insert(iv3);
    tree.remove(iv1);
    assert.equal(tree.size, 2);
    assert.equal(tree.search(7).length, 0);
    assert.equal(tree.search(2).length, 1);
    assert.equal(tree.search(9).length, 1);
  });

  it('can remove all intervals one by one', () => {
    const tree = createIntervalTree();
    const intervals = [
      { low: 0, high: 4 },
      { low: 2, high: 6 },
      { low: 5, high: 9 },
    ];
    for (const iv of intervals) tree.insert(iv);
    for (const iv of intervals) assert.equal(tree.remove(iv), true);
    assert.equal(tree.size, 0);
    assert.deepEqual(tree.toArray(), []);
  });

  it('matches by data reference for intervals with data', () => {
    const tree = createIntervalTree();
    const data1 = { id: 1 };
    const data2 = { id: 2 };
    tree.insert({ low: 0, high: 5, data: data1 });
    tree.insert({ low: 0, high: 5, data: data2 });
    // Remove using data1 reference
    assert.equal(tree.remove({ low: 0, high: 5, data: data1 }), true);
    assert.equal(tree.size, 1);
    assert.equal(tree.toArray()[0].data, data2);
  });
});

// ─── search (point stabbing) ──────────────────────────────────────────────────

describe('IntervalTree – search (point stabbing)', () => {
  it('finds a single interval containing the point', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 1, high: 5 });
    const found = tree.search(3);
    assert.equal(found.length, 1);
    assert.equal(found[0].low, 1);
    assert.equal(found[0].high, 5);
  });

  it('returns empty for a point outside all intervals', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 1, high: 5 });
    tree.insert({ low: 7, high: 10 });
    assert.deepEqual(tree.search(6), []);
  });

  it('includes interval when point equals low (closed boundary)', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 3, high: 8 });
    assert.equal(tree.search(3).length, 1);
  });

  it('includes interval when point equals high (closed boundary)', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 3, high: 8 });
    assert.equal(tree.search(8).length, 1);
  });

  it('returns all intervals that contain the point', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 0, high: 10 });
    tree.insert({ low: 2, high: 6 });
    tree.insert({ low: 4, high: 12 });
    tree.insert({ low: 7, high: 9 });
    const found = tree.search(5);
    assert.equal(found.length, 3);
  });

  it('does not include intervals where point is just outside', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 0, high: 4 });
    tree.insert({ low: 6, high: 10 });
    assert.deepEqual(tree.search(5), []);
  });

  it('works with negative point values', () => {
    const tree = createIntervalTree();
    tree.insert({ low: -8, high: -2 });
    tree.insert({ low: 0, high: 5 });
    const found = tree.search(-5);
    assert.equal(found.length, 1);
    assert.equal(found[0].low, -8);
  });

  it('handles many intervals efficiently and returns correct count', () => {
    const tree = createIntervalTree();
    // Insert 50 intervals, half containing point 25
    for (let i = 0; i < 50; i++) {
      tree.insert({ low: i, high: i + 10 });
    }
    // Point 25 is in intervals where low <= 25 <= low+10, i.e., 15..25
    const found = tree.search(25);
    assert.equal(found.length, 11); // i=15..25 inclusive
  });
});

// ─── overlap ──────────────────────────────────────────────────────────────────

describe('IntervalTree – overlap', () => {
  it('returns all intervals overlapping the query range', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 0, high: 3 });
    tree.insert({ low: 2, high: 6 });
    tree.insert({ low: 5, high: 9 });
    tree.insert({ low: 8, high: 12 });
    const found = tree.overlap(4, 7);
    assert.equal(found.length, 2);
  });

  it('returns empty when query range does not overlap any interval', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 0, high: 3 });
    tree.insert({ low: 7, high: 10 });
    assert.deepEqual(tree.overlap(4, 6), []);
  });

  it('detects overlap when query range is fully inside an interval', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 0, high: 20 });
    const found = tree.overlap(5, 15);
    assert.equal(found.length, 1);
  });

  it('detects overlap when an interval is fully inside the query range', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 4, high: 6 });
    const found = tree.overlap(0, 10);
    assert.equal(found.length, 1);
  });

  it('detects overlap for touching boundaries (closed intervals)', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 0, high: 5 });
    const found = tree.overlap(5, 10);
    assert.equal(found.length, 1);
  });

  it('works with a point query (low === high)', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 2, high: 8 });
    tree.insert({ low: 10, high: 15 });
    const found = tree.overlap(5, 5);
    assert.equal(found.length, 1);
    assert.equal(found[0].low, 2);
  });

  it('returns all intervals when query spans entire space', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 1, high: 3 });
    tree.insert({ low: 5, high: 7 });
    tree.insert({ low: 9, high: 11 });
    const found = tree.overlap(-100, 100);
    assert.equal(found.length, 3);
  });

  it('works with negative query range', () => {
    const tree = createIntervalTree();
    tree.insert({ low: -10, high: -5 });
    tree.insert({ low: -3, high: 0 });
    tree.insert({ low: 1, high: 5 });
    const found = tree.overlap(-6, -2);
    assert.equal(found.length, 2);
  });
});

// ─── toArray ──────────────────────────────────────────────────────────────────

describe('IntervalTree – toArray', () => {
  it('returns empty array for empty tree', () => {
    assert.deepEqual(createIntervalTree().toArray(), []);
  });

  it('returns all inserted intervals', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 3, high: 7 });
    tree.insert({ low: 1, high: 4 });
    tree.insert({ low: 6, high: 9 });
    const all = tree.toArray();
    assert.equal(all.length, 3);
  });

  it('length matches size', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 0, high: 2 });
    tree.insert({ low: 5, high: 8 });
    assert.equal(tree.toArray().length, tree.size);
  });

  it('contains all inserted data values', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 0, high: 1, data: 'a' });
    tree.insert({ low: 2, high: 3, data: 'b' });
    tree.insert({ low: 4, high: 5, data: 'c' });
    const datas = tree.toArray().map((iv) => iv.data).sort();
    assert.deepEqual(datas, ['a', 'b', 'c']);
  });

  it('returns sorted order by low endpoint', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 10, high: 15 });
    tree.insert({ low: 2, high: 8 });
    tree.insert({ low: 5, high: 12 });
    const lows = tree.toArray().map((iv) => iv.low);
    assert.deepEqual(lows, [...lows].sort((a, b) => a - b));
  });

  it('reflects removals', () => {
    const tree = createIntervalTree();
    const iv = { low: 3, high: 6 };
    tree.insert({ low: 1, high: 2 });
    tree.insert(iv);
    tree.insert({ low: 7, high: 9 });
    tree.remove(iv);
    const all = tree.toArray();
    assert.equal(all.length, 2);
    assert.ok(!all.some((x) => x.low === 3 && x.high === 6));
  });

  it('handles 100 inserts correctly', () => {
    const tree = createIntervalTree();
    for (let i = 0; i < 100; i++) {
      tree.insert({ low: i, high: i + 1 });
    }
    assert.equal(tree.toArray().length, 100);
  });

  it('each element in toArray is the same object reference as inserted', () => {
    const tree = createIntervalTree();
    const iv = { low: 0, high: 1, data: { tag: 'x' } };
    tree.insert(iv);
    assert.equal(tree.toArray()[0], iv);
  });
});

// ─── size getter ──────────────────────────────────────────────────────────────

describe('IntervalTree – size getter', () => {
  it('is 0 for a fresh tree', () => {
    assert.equal(createIntervalTree().size, 0);
  });

  it('increments by 1 for each insert', () => {
    const tree = createIntervalTree();
    for (let i = 0; i < 5; i++) {
      assert.equal(tree.size, i);
      tree.insert({ low: i, high: i + 1 });
    }
    assert.equal(tree.size, 5);
  });

  it('decrements by 1 after a successful remove', () => {
    const tree = createIntervalTree();
    const iv = { low: 1, high: 5 };
    tree.insert(iv);
    assert.equal(tree.size, 1);
    tree.remove(iv);
    assert.equal(tree.size, 0);
  });

  it('stays the same after a failed remove', () => {
    const tree = createIntervalTree();
    tree.insert({ low: 1, high: 5 });
    tree.remove({ low: 99, high: 100 });
    assert.equal(tree.size, 1);
  });

  it('returns 0 after inserting and removing the same interval', () => {
    const tree = createIntervalTree();
    const iv = { low: 0, high: 10 };
    tree.insert(iv);
    tree.remove(iv);
    assert.equal(tree.size, 0);
  });

  it('tracks size correctly through a mixed sequence of inserts and removes', () => {
    const tree = createIntervalTree();
    const a = { low: 0, high: 2 };
    const b = { low: 3, high: 5 };
    const c = { low: 6, high: 8 };
    tree.insert(a);
    tree.insert(b);
    tree.insert(c);
    assert.equal(tree.size, 3);
    tree.remove(b);
    assert.equal(tree.size, 2);
    tree.insert(b);
    assert.equal(tree.size, 3);
    tree.remove(a);
    tree.remove(b);
    tree.remove(c);
    assert.equal(tree.size, 0);
  });

  it('size matches toArray().length at all times', () => {
    const tree = createIntervalTree();
    const ivs = [
      { low: 0, high: 1 },
      { low: 2, high: 3 },
      { low: 4, high: 5 },
    ];
    for (const iv of ivs) {
      tree.insert(iv);
      assert.equal(tree.size, tree.toArray().length);
    }
    for (const iv of ivs) {
      tree.remove(iv);
      assert.equal(tree.size, tree.toArray().length);
    }
  });
});
