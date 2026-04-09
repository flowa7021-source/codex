// ─── Unit Tests: pathfinding ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  aStar,
  bfsPath,
  isWalkable,
  getNeighbors,
  manhattan,
  euclidean,
} from '../../app/modules/pathfinding.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// 5×5 open grid (all walkable)
const openGrid = [
  [true, true, true, true, true],
  [true, true, true, true, true],
  [true, true, true, true, true],
  [true, true, true, true, true],
  [true, true, true, true, true],
];

// Grid with a wall across column 2 (rows 0–3), leaving row 4 open
//   0 1 2 3 4
// 0 . . X . .
// 1 . . X . .
// 2 . . X . .
// 3 . . X . .
// 4 . . . . .
const walledGrid = [
  [true, true, false, true, true],
  [true, true, false, true, true],
  [true, true, false, true, true],
  [true, true, false, true, true],
  [true, true, true,  true, true],
];

// Fully blocked grid
const blockedGrid = [
  [false, false],
  [false, false],
];

// Small 3×3 grid where the only path goes around a central obstacle
// . . .
// . X .
// . . .
const centreObstacle = [
  [true, true, true],
  [true, false, true],
  [true, true, true],
];

// ─── isWalkable ───────────────────────────────────────────────────────────────

describe('isWalkable', () => {
  it('returns true for a walkable cell', () => {
    assert.equal(isWalkable(openGrid, { x: 0, y: 0 }), true);
    assert.equal(isWalkable(openGrid, { x: 4, y: 4 }), true);
  });

  it('returns false for an obstacle cell', () => {
    assert.equal(isWalkable(walledGrid, { x: 2, y: 0 }), false);
    assert.equal(isWalkable(walledGrid, { x: 2, y: 3 }), false);
  });

  it('returns false for out-of-bounds x', () => {
    assert.equal(isWalkable(openGrid, { x: -1, y: 0 }), false);
    assert.equal(isWalkable(openGrid, { x: 5, y: 0 }), false);
  });

  it('returns false for out-of-bounds y', () => {
    assert.equal(isWalkable(openGrid, { x: 0, y: -1 }), false);
    assert.equal(isWalkable(openGrid, { x: 0, y: 5 }), false);
  });

  it('returns true for a walkable passage cell in walledGrid', () => {
    assert.equal(isWalkable(walledGrid, { x: 2, y: 4 }), true);
  });
});

// ─── manhattan ────────────────────────────────────────────────────────────────

describe('manhattan', () => {
  it('returns 0 for same point', () => {
    assert.equal(manhattan({ x: 3, y: 4 }, { x: 3, y: 4 }), 0);
  });

  it('returns correct distance for horizontal separation', () => {
    assert.equal(manhattan({ x: 0, y: 0 }, { x: 5, y: 0 }), 5);
  });

  it('returns correct distance for vertical separation', () => {
    assert.equal(manhattan({ x: 0, y: 0 }, { x: 0, y: 3 }), 3);
  });

  it('returns correct distance for diagonal separation', () => {
    assert.equal(manhattan({ x: 1, y: 1 }, { x: 4, y: 5 }), 7);
  });

  it('is symmetric', () => {
    const a = { x: 2, y: 7 };
    const b = { x: 5, y: 3 };
    assert.equal(manhattan(a, b), manhattan(b, a));
  });

  it('handles negative coordinates', () => {
    assert.equal(manhattan({ x: -3, y: -4 }, { x: 3, y: 4 }), 14);
  });
});

// ─── euclidean ────────────────────────────────────────────────────────────────

describe('euclidean', () => {
  it('returns 0 for same point', () => {
    assert.equal(euclidean({ x: 1, y: 2 }, { x: 1, y: 2 }), 0);
  });

  it('returns correct distance for 3-4-5 triangle', () => {
    assert.equal(euclidean({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  });

  it('returns horizontal distance', () => {
    assert.equal(euclidean({ x: 0, y: 0 }, { x: 6, y: 0 }), 6);
  });

  it('is symmetric', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };
    assert.ok(Math.abs(euclidean(a, b) - euclidean(b, a)) < 1e-10);
  });

  it('returns sqrt(2) for diagonal unit step', () => {
    assert.ok(Math.abs(euclidean({ x: 0, y: 0 }, { x: 1, y: 1 }) - Math.SQRT2) < 1e-10);
  });
});

// ─── getNeighbors ─────────────────────────────────────────────────────────────

describe('getNeighbors', () => {
  it('returns 4 cardinal neighbors for a center cell on open grid', () => {
    const neighbors = getNeighbors(openGrid, { x: 2, y: 2 });
    assert.equal(neighbors.length, 4);
  });

  it('returns fewer neighbors at a corner', () => {
    const neighbors = getNeighbors(openGrid, { x: 0, y: 0 });
    assert.equal(neighbors.length, 2); // only right and down
  });

  it('excludes obstacle cells', () => {
    // {x:1, y:0} is adjacent to the wall at {x:2, y:0}
    const neighbors = getNeighbors(walledGrid, { x: 1, y: 0 });
    const hasWall = neighbors.some((n) => n.x === 2 && n.y === 0);
    assert.equal(hasWall, false);
  });

  it('returns 8 neighbors with diagonal=true for center cell', () => {
    const neighbors = getNeighbors(openGrid, { x: 2, y: 2 }, true);
    assert.equal(neighbors.length, 8);
  });

  it('returns 3 neighbors with diagonal=true at a corner', () => {
    const neighbors = getNeighbors(openGrid, { x: 0, y: 0 }, true);
    assert.equal(neighbors.length, 3); // right, down, diagonal
  });

  it('returns empty array when all neighbors are obstacles', () => {
    // Centre of centreObstacle at {x:1,y:1} is itself an obstacle,
    // but let's use a grid where a cell is surrounded by walls
    const surrounded = [
      [false, false, false],
      [false, true,  false],
      [false, false, false],
    ];
    const neighbors = getNeighbors(surrounded, { x: 1, y: 1 });
    assert.equal(neighbors.length, 0);
  });
});

// ─── aStar ────────────────────────────────────────────────────────────────────

describe('aStar', () => {
  it('finds a path on an open grid', () => {
    const result = aStar(openGrid, { x: 0, y: 0 }, { x: 4, y: 4 });
    assert.ok(result !== null);
    assert.ok(result.path.length > 0);
    assert.deepEqual(result.path[0], { x: 0, y: 0 });
    assert.deepEqual(result.path[result.path.length - 1], { x: 4, y: 4 });
  });

  it('path cost equals number of steps for cardinal-only movement', () => {
    const result = aStar(openGrid, { x: 0, y: 0 }, { x: 3, y: 0 });
    assert.ok(result !== null);
    assert.equal(result.cost, 3);
    assert.equal(result.path.length, 4); // start + 3 steps
  });

  it('returns null when start is an obstacle', () => {
    const result = aStar(walledGrid, { x: 2, y: 0 }, { x: 4, y: 0 });
    assert.equal(result, null);
  });

  it('returns null when end is an obstacle', () => {
    const result = aStar(walledGrid, { x: 0, y: 0 }, { x: 2, y: 0 });
    assert.equal(result, null);
  });

  it('returns null when grid is fully blocked', () => {
    const g = [
      [false, false],
      [false, false],
    ];
    const result = aStar(g, { x: 0, y: 0 }, { x: 1, y: 1 });
    assert.equal(result, null);
  });

  it('navigates around a wall', () => {
    const result = aStar(walledGrid, { x: 0, y: 0 }, { x: 4, y: 0 });
    assert.ok(result !== null);
    // Path must not pass through any wall cell (x=2, y=0..3)
    for (const point of result.path) {
      assert.ok(
        !(point.x === 2 && point.y < 4),
        `path should not pass through wall at (${point.x},${point.y})`,
      );
    }
    assert.deepEqual(result.path[0], { x: 0, y: 0 });
    assert.deepEqual(result.path[result.path.length - 1], { x: 4, y: 0 });
  });

  it('returns a single-point path when start equals end', () => {
    const result = aStar(openGrid, { x: 2, y: 2 }, { x: 2, y: 2 });
    assert.ok(result !== null);
    assert.deepEqual(result.path, [{ x: 2, y: 2 }]);
    assert.equal(result.cost, 0);
  });

  it('finds a path with diagonal movement allowed', () => {
    const result = aStar(openGrid, { x: 0, y: 0 }, { x: 4, y: 4 }, true);
    assert.ok(result !== null);
    // With diagonals, cost should be 4*sqrt(2) ≈ 5.657
    assert.ok(result.cost < 8, 'diagonal path should be cheaper than cardinal-only');
    assert.deepEqual(result.path[0], { x: 0, y: 0 });
    assert.deepEqual(result.path[result.path.length - 1], { x: 4, y: 4 });
  });

  it('navigates around a centre obstacle', () => {
    const result = aStar(centreObstacle, { x: 0, y: 1 }, { x: 2, y: 1 });
    assert.ok(result !== null);
    // Must not go through (1,1)
    const throughCentre = result.path.some((p) => p.x === 1 && p.y === 1);
    assert.equal(throughCentre, false);
  });
});

// ─── bfsPath ──────────────────────────────────────────────────────────────────

describe('bfsPath', () => {
  it('finds a path on an open grid', () => {
    const result = bfsPath(openGrid, { x: 0, y: 0 }, { x: 4, y: 4 });
    assert.ok(result !== null);
    assert.deepEqual(result.path[0], { x: 0, y: 0 });
    assert.deepEqual(result.path[result.path.length - 1], { x: 4, y: 4 });
  });

  it('returns the shortest path (fewest steps)', () => {
    const result = bfsPath(openGrid, { x: 0, y: 0 }, { x: 3, y: 0 });
    assert.ok(result !== null);
    assert.equal(result.cost, 3);
    assert.equal(result.path.length, 4);
  });

  it('returns null when start is an obstacle', () => {
    const result = bfsPath(walledGrid, { x: 2, y: 0 }, { x: 4, y: 0 });
    assert.equal(result, null);
  });

  it('returns null when end is an obstacle', () => {
    const result = bfsPath(walledGrid, { x: 0, y: 0 }, { x: 2, y: 0 });
    assert.equal(result, null);
  });

  it('returns null when path is blocked', () => {
    const result = bfsPath(blockedGrid, { x: 0, y: 0 }, { x: 1, y: 1 });
    assert.equal(result, null);
  });

  it('navigates around a wall', () => {
    const result = bfsPath(walledGrid, { x: 0, y: 0 }, { x: 4, y: 0 });
    assert.ok(result !== null);
    for (const point of result.path) {
      assert.ok(
        !(point.x === 2 && point.y < 4),
        `path should not pass through wall at (${point.x},${point.y})`,
      );
    }
  });

  it('returns single-point path when start equals end', () => {
    const result = bfsPath(openGrid, { x: 1, y: 1 }, { x: 1, y: 1 });
    assert.ok(result !== null);
    assert.deepEqual(result.path, [{ x: 1, y: 1 }]);
    assert.equal(result.cost, 0);
  });

  it('navigates around a centre obstacle', () => {
    const result = bfsPath(centreObstacle, { x: 0, y: 1 }, { x: 2, y: 1 });
    assert.ok(result !== null);
    const throughCentre = result.path.some((p) => p.x === 1 && p.y === 1);
    assert.equal(throughCentre, false);
  });

  it('each consecutive step in path is adjacent (4-directional)', () => {
    const result = bfsPath(walledGrid, { x: 0, y: 0 }, { x: 4, y: 4 });
    assert.ok(result !== null);
    for (let i = 1; i < result.path.length; i++) {
      const prev = result.path[i - 1];
      const curr = result.path[i];
      const dist = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
      assert.equal(dist, 1, `step ${i} should be exactly 1 unit`);
    }
  });
});
