// ─── Unit Tests: Fixed-Grid Spatial Index ─────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GridIndex, createGridIndex } from '../../app/modules/grid-index.js';

// ─── Constructor ───────────────────────────────────────────────────────────

describe('GridIndex – constructor', () => {
  it('stores width, height, and cellSize', () => {
    const gi = new GridIndex(200, 100, 50);
    assert.equal(gi.width, 200);
    assert.equal(gi.height, 100);
    assert.equal(gi.cellSize, 50);
  });

  it('throws on non-positive cellSize', () => {
    assert.throws(() => new GridIndex(100, 100, 0), RangeError);
    assert.throws(() => new GridIndex(100, 100, -5), RangeError);
  });

  it('throws on non-positive dimensions', () => {
    assert.throws(() => new GridIndex(0, 100, 10), RangeError);
    assert.throws(() => new GridIndex(100, 0, 10), RangeError);
  });

  it('starts empty', () => {
    const gi = new GridIndex(100, 100, 10);
    assert.equal(gi.size, 0);
  });
});

// ─── Insert / remove ──────────────────────────────────────────────────────

describe('GridIndex – insert and remove', () => {
  it('insert returns true for in-bounds point', () => {
    const gi = new GridIndex(100, 100, 50);
    assert.equal(gi.insert('a', 10, 10), true);
    assert.equal(gi.size, 1);
  });

  it('insert returns false for out-of-bounds point', () => {
    const gi = new GridIndex(100, 100, 50);
    assert.equal(gi.insert('a', -1, 50), false);
    assert.equal(gi.insert('b', 50, -1), false);
    assert.equal(gi.insert('c', 100, 50), false);
    assert.equal(gi.insert('d', 50, 100), false);
    assert.equal(gi.size, 0);
  });

  it('re-inserting moves item to new position', () => {
    const gi = new GridIndex(200, 200, 50);
    gi.insert('a', 10, 10);
    gi.insert('a', 150, 150);
    assert.equal(gi.size, 1);
    // Should no longer appear in the old cell
    assert.equal(gi.queryCell(0, 0).length, 0);
    assert.ok(gi.queryCell(3, 3).includes('a'));
  });

  it('remove returns true for existing item', () => {
    const gi = new GridIndex(100, 100, 50);
    gi.insert('x', 25, 25);
    assert.equal(gi.remove('x'), true);
    assert.equal(gi.size, 0);
  });

  it('remove returns false for unknown item', () => {
    const gi = new GridIndex(100, 100, 50);
    assert.equal(gi.remove('ghost'), false);
  });
});

// ─── queryCell ─────────────────────────────────────────────────────────────

describe('GridIndex – queryCell', () => {
  it('returns items in the specified cell', () => {
    const gi = new GridIndex(200, 200, 100);
    gi.insert('a', 50, 50);
    gi.insert('b', 150, 50);
    const cellItems = gi.queryCell(0, 0);
    assert.ok(cellItems.includes('a'));
    assert.ok(!cellItems.includes('b'));
  });

  it('returns empty array for out-of-bounds cell', () => {
    const gi = new GridIndex(100, 100, 50);
    assert.deepEqual(gi.queryCell(-1, 0), []);
    assert.deepEqual(gi.queryCell(0, 99), []);
  });
});

// ─── queryRadius ───────────────────────────────────────────────────────────

describe('GridIndex – queryRadius', () => {
  it('finds items within the radius', () => {
    const gi = new GridIndex(500, 500, 100);
    gi.insert('near', 50, 50);
    gi.insert('far', 400, 400);

    const hits = gi.queryRadius(55, 55, 20);
    assert.ok(hits.includes('near'));
    assert.ok(!hits.includes('far'));
  });

  it('returns empty array when nothing is in range', () => {
    const gi = new GridIndex(500, 500, 100);
    gi.insert('a', 0, 0);
    assert.equal(gi.queryRadius(400, 400, 10).length, 0);
  });

  it('includes items exactly on the boundary', () => {
    const gi = new GridIndex(500, 500, 100);
    gi.insert('edge', 60, 0);
    // Distance from (0,0) to (60,0) is exactly 60
    const hits = gi.queryRadius(0, 0, 60);
    assert.ok(hits.includes('edge'));
  });
});

// ─── queryRect ─────────────────────────────────────────────────────────────

describe('GridIndex – queryRect', () => {
  it('returns items within the rectangle', () => {
    const gi = new GridIndex(500, 500, 100);
    gi.insert('inside', 50, 50);
    gi.insert('outside', 300, 300);

    const hits = gi.queryRect(0, 0, 100, 100);
    assert.ok(hits.includes('inside'));
    assert.ok(!hits.includes('outside'));
  });

  it('includes items exactly on the boundary', () => {
    const gi = new GridIndex(500, 500, 100);
    gi.insert('corner', 100, 100);
    const hits = gi.queryRect(0, 0, 100, 100);
    assert.ok(hits.includes('corner'));
  });
});

// ─── nearest ───────────────────────────────────────────────────────────────

describe('GridIndex – nearest', () => {
  it('returns the closest item', () => {
    const gi = new GridIndex(500, 500, 100);
    gi.insert('close', 10, 10);
    gi.insert('far', 200, 200);

    assert.equal(gi.nearest(0, 0), 'close');
  });

  it('returns null when the grid is empty', () => {
    const gi = new GridIndex(500, 500, 100);
    assert.equal(gi.nearest(50, 50), null);
  });

  it('respects maxDistance', () => {
    const gi = new GridIndex(500, 500, 100);
    gi.insert('a', 200, 200);
    // Item at distance ~283 from origin, maxDistance = 50
    assert.equal(gi.nearest(0, 0, 50), null);
  });

  it('finds nearest among many items', () => {
    const gi = new GridIndex(1000, 1000, 100);
    gi.insert('d100', 100, 0);
    gi.insert('d200', 200, 0);
    gi.insert('d50', 50, 0);
    gi.insert('d300', 300, 0);

    assert.equal(gi.nearest(0, 0), 'd50');
  });
});

// ─── clear ─────────────────────────────────────────────────────────────────

describe('GridIndex – clear', () => {
  it('removes all items', () => {
    const gi = new GridIndex(200, 200, 50);
    gi.insert('a', 10, 10);
    gi.insert('b', 100, 100);
    gi.clear();
    assert.equal(gi.size, 0);
    assert.equal(gi.queryCell(0, 0).length, 0);
  });
});

// ─── createGridIndex factory ───────────────────────────────────────────────

describe('createGridIndex', () => {
  it('returns a GridIndex instance', () => {
    const gi = createGridIndex(400, 300, 50);
    assert.ok(gi instanceof GridIndex);
    assert.equal(gi.width, 400);
    assert.equal(gi.height, 300);
    assert.equal(gi.cellSize, 50);
  });

  it('works with object items', () => {
    const gi = createGridIndex(100, 100, 50);
    const obj = { name: 'entity' };
    gi.insert(obj, 25, 25);
    assert.equal(gi.size, 1);
    assert.ok(gi.queryCell(0, 0).includes(obj));
  });
});
