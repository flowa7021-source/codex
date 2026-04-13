// ─── Unit Tests: Spatial Hash Grid ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SpatialHash, createSpatialHash } from '../../app/modules/spatial-hash.js';

// ─── Constructor ───────────────────────────────────────────────────────────

describe('SpatialHash – constructor', () => {
  it('stores the cell size', () => {
    const sh = new SpatialHash(50);
    assert.equal(sh.cellSize, 50);
  });

  it('throws on non-positive cell size', () => {
    assert.throws(() => new SpatialHash(0), RangeError);
    assert.throws(() => new SpatialHash(-10), RangeError);
  });

  it('starts empty', () => {
    const sh = new SpatialHash(100);
    assert.equal(sh.size, 0);
  });
});

// ─── Insert / remove / size ────────────────────────────────────────────────

describe('SpatialHash – insert and remove', () => {
  it('insert increments size', () => {
    const sh = new SpatialHash(100);
    sh.insert('a', 0, 0, 10, 10);
    assert.equal(sh.size, 1);
    sh.insert('b', 50, 50, 20, 20);
    assert.equal(sh.size, 2);
  });

  it('re-inserting the same item does not duplicate it', () => {
    const sh = new SpatialHash(100);
    sh.insert('a', 0, 0, 10, 10);
    sh.insert('a', 50, 50, 5, 5);
    assert.equal(sh.size, 1);
  });

  it('remove returns true for existing item', () => {
    const sh = new SpatialHash(100);
    sh.insert('x', 0, 0, 5, 5);
    assert.equal(sh.remove('x'), true);
    assert.equal(sh.size, 0);
  });

  it('remove returns false for unknown item', () => {
    const sh = new SpatialHash(100);
    assert.equal(sh.remove('ghost'), false);
  });
});

// ─── Query ─────────────────────────────────────────────────────────────────

describe('SpatialHash – query', () => {
  it('returns items overlapping the query rect', () => {
    const sh = new SpatialHash(50);
    sh.insert('a', 10, 10, 20, 20);
    sh.insert('b', 200, 200, 10, 10);

    const hits = sh.query(0, 0, 60, 60);
    assert.ok(hits.includes('a'));
    assert.ok(!hits.includes('b'));
  });

  it('returns items spanning multiple cells', () => {
    const sh = new SpatialHash(50);
    // Item spanning cells (0,0) and (1,0)
    sh.insert('wide', 40, 0, 20, 10);
    // Query only in cell (1,0)
    const hits = sh.query(50, 0, 10, 10);
    assert.ok(hits.includes('wide'));
  });

  it('does not return duplicates when an item spans multiple queried cells', () => {
    const sh = new SpatialHash(50);
    sh.insert('big', 0, 0, 200, 200);
    const hits = sh.query(0, 0, 200, 200);
    const count = hits.filter((h) => h === 'big').length;
    assert.equal(count, 1);
  });

  it('returns empty array when nothing matches', () => {
    const sh = new SpatialHash(50);
    sh.insert('a', 0, 0, 5, 5);
    const hits = sh.query(500, 500, 10, 10);
    assert.equal(hits.length, 0);
  });
});

// ─── queryPoint ────────────────────────────────────────────────────────────

describe('SpatialHash – queryPoint', () => {
  it('finds items in the cell containing the point', () => {
    const sh = new SpatialHash(100);
    sh.insert('a', 10, 10, 30, 30);
    const hits = sh.queryPoint(15, 15);
    assert.ok(hits.includes('a'));
  });

  it('returns empty array for vacant cell', () => {
    const sh = new SpatialHash(100);
    const hits = sh.queryPoint(999, 999);
    assert.equal(hits.length, 0);
  });
});

// ─── Update ────────────────────────────────────────────────────────────────

describe('SpatialHash – update', () => {
  it('moves an item to a new position', () => {
    const sh = new SpatialHash(50);
    sh.insert('mover', 10, 10, 5, 5);
    assert.ok(sh.queryPoint(10, 10).includes('mover'));

    sh.update('mover', 200, 200, 5, 5);
    assert.equal(sh.size, 1);
    assert.ok(!sh.queryPoint(10, 10).includes('mover'));
    assert.ok(sh.queryPoint(200, 200).includes('mover'));
  });
});

// ─── Clear ─────────────────────────────────────────────────────────────────

describe('SpatialHash – clear', () => {
  it('removes all items', () => {
    const sh = new SpatialHash(50);
    sh.insert('a', 0, 0, 10, 10);
    sh.insert('b', 100, 100, 10, 10);
    sh.clear();
    assert.equal(sh.size, 0);
    assert.equal(sh.query(0, 0, 1000, 1000).length, 0);
  });
});

// ─── createSpatialHash factory ─────────────────────────────────────────────

describe('createSpatialHash', () => {
  it('returns a SpatialHash instance', () => {
    const sh = createSpatialHash(64);
    assert.ok(sh instanceof SpatialHash);
    assert.equal(sh.cellSize, 64);
  });

  it('works with object items', () => {
    const sh = createSpatialHash(100);
    const obj = { id: 1 };
    sh.insert(obj, 0, 0, 10, 10);
    assert.equal(sh.size, 1);
    assert.ok(sh.query(0, 0, 50, 50).includes(obj));
  });
});
