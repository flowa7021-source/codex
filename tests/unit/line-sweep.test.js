// ─── Unit Tests: line-sweep ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  findIntersections,
  closestPair,
  rectangleUnionArea,
} from '../../app/modules/line-sweep.js';

// ─── findIntersections ───────────────────────────────────────────────────────

describe('findIntersections', () => {
  it('returns empty for no segments', () => {
    assert.deepEqual(findIntersections([]), []);
  });

  it('returns empty for a single segment', () => {
    assert.deepEqual(findIntersections([{ x1: 0, y1: 0, x2: 1, y2: 1 }]), []);
  });

  it('finds intersection of two crossing segments', () => {
    const segs = [
      { x1: 0, y1: 0, x2: 4, y2: 4 },
      { x1: 0, y1: 4, x2: 4, y2: 0 },
    ];
    const result = findIntersections(segs);
    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0].point.x - 2) < 1e-9);
    assert.ok(Math.abs(result[0].point.y - 2) < 1e-9);
    assert.deepEqual(result[0].segments, [0, 1]);
  });

  it('returns empty for parallel non-intersecting segments', () => {
    const segs = [
      { x1: 0, y1: 0, x2: 4, y2: 0 },
      { x1: 0, y1: 2, x2: 4, y2: 2 },
    ];
    assert.deepEqual(findIntersections(segs), []);
  });

  it('detects endpoint intersection', () => {
    const segs = [
      { x1: 0, y1: 0, x2: 2, y2: 2 },
      { x1: 2, y1: 2, x2: 4, y2: 0 },
    ];
    const result = findIntersections(segs);
    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0].point.x - 2) < 1e-9);
    assert.ok(Math.abs(result[0].point.y - 2) < 1e-9);
  });

  it('finds multiple intersections', () => {
    const segs = [
      { x1: 0, y1: 0, x2: 6, y2: 6 },
      { x1: 0, y1: 6, x2: 6, y2: 0 },
      { x1: 0, y1: 3, x2: 6, y2: 3 },
    ];
    const result = findIntersections(segs);
    // seg0 x seg1, seg0 x seg2, seg1 x seg2 = 3 intersections
    assert.equal(result.length, 3);
  });

  it('handles non-intersecting segments that share x-range', () => {
    const segs = [
      { x1: 0, y1: 0, x2: 4, y2: 0 },
      { x1: 1, y1: 2, x2: 3, y2: 2 },
    ];
    assert.deepEqual(findIntersections(segs), []);
  });
});

// ─── closestPair ─────────────────────────────────────────────────────────────

describe('closestPair', () => {
  it('throws for fewer than 2 points', () => {
    assert.throws(() => closestPair([]), /Need at least 2 points/);
    assert.throws(() => closestPair([{ x: 0, y: 0 }]), /Need at least 2 points/);
  });

  it('finds closest pair of two points', () => {
    const result = closestPair([{ x: 0, y: 0 }, { x: 3, y: 4 }]);
    assert.ok(Math.abs(result.distance - 5) < 1e-9);
  });

  it('finds closest pair among several points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 1, y: 0 },
      { x: 20, y: 20 },
    ];
    const result = closestPair(pts);
    assert.ok(Math.abs(result.distance - 1) < 1e-9);
    // The pair should be (0,0) and (1,0)
    const pair = [result.p1, result.p2].sort((a, b) => a.x - b.x);
    assert.deepEqual(pair, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  });

  it('handles identical points (distance 0)', () => {
    const pts = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 100, y: 100 },
    ];
    const result = closestPair(pts);
    assert.equal(result.distance, 0);
  });

  it('finds closest pair in a large spread', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 300, y: 0 },
      { x: 400, y: 0 },
      { x: 50, y: 0.5 },  // closest to (50, 0)? No, closest pair is this to (0,0): dist ~50
    ];
    // Actually closest is (0,0)-(50,0.5) = sqrt(2500.25) vs (50,0.5)-(100,0) = sqrt(2500.25)
    // vs (0,0)-(100,0)=100, etc. All gaps are 100 apart except (50,0.5).
    // dist(0,0 -> 50,0.5) = sqrt(2500+0.25) ≈ 50.005
    // dist(50,0.5 -> 100,0) = sqrt(2500+0.25) ≈ 50.005
    // All others are >= 100
    const result = closestPair(pts);
    assert.ok(result.distance < 51);
  });
});

// ─── rectangleUnionArea ──────────────────────────────────────────────────────

describe('rectangleUnionArea', () => {
  it('returns 0 for no rectangles', () => {
    assert.equal(rectangleUnionArea([]), 0);
  });

  it('computes area of a single rectangle', () => {
    const area = rectangleUnionArea([{ x1: 0, y1: 0, x2: 4, y2: 3 }]);
    assert.equal(area, 12);
  });

  it('computes area of non-overlapping rectangles', () => {
    const area = rectangleUnionArea([
      { x1: 0, y1: 0, x2: 2, y2: 2 },
      { x1: 5, y1: 5, x2: 8, y2: 8 },
    ]);
    assert.equal(area, 4 + 9);
  });

  it('computes area of fully overlapping rectangles', () => {
    const area = rectangleUnionArea([
      { x1: 0, y1: 0, x2: 4, y2: 4 },
      { x1: 0, y1: 0, x2: 4, y2: 4 },
    ]);
    assert.equal(area, 16);
  });

  it('computes area of partially overlapping rectangles', () => {
    const area = rectangleUnionArea([
      { x1: 0, y1: 0, x2: 3, y2: 3 },
      { x1: 2, y1: 2, x2: 5, y2: 5 },
    ]);
    // Total = 9 + 9 - 1 (overlap is 1x1) = 17
    assert.equal(area, 17);
  });

  it('handles rectangle contained within another', () => {
    const area = rectangleUnionArea([
      { x1: 0, y1: 0, x2: 10, y2: 10 },
      { x1: 2, y1: 2, x2: 5, y2: 5 },
    ]);
    assert.equal(area, 100);
  });

  it('handles three overlapping rectangles', () => {
    const area = rectangleUnionArea([
      { x1: 0, y1: 0, x2: 4, y2: 4 },
      { x1: 2, y1: 0, x2: 6, y2: 4 },
      { x1: 4, y1: 0, x2: 8, y2: 4 },
    ]);
    // Union covers x=[0,8], y=[0,4] = 32
    assert.equal(area, 32);
  });
});
