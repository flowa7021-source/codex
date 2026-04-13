// ─── Unit Tests: A* Pathfinding ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { astar, GridGraph, createGridGraph } from '../../app/modules/a-star.js';

// ─── Generic astar() ────────────────────────────────────────────────────────

describe('astar – generic graph', () => {
  /** Simple directed graph:  A --1--> B --2--> C --1--> D */
  const linearGraph = {
    neighbors(node) {
      const map = {
        A: [{ id: 'B', cost: 1 }],
        B: [{ id: 'C', cost: 2 }],
        C: [{ id: 'D', cost: 1 }],
        D: [],
      };
      return map[node] ?? [];
    },
    heuristic() {
      return 0; // trivial heuristic – degenerates to Dijkstra
    },
  };

  it('finds a straight-line path', () => {
    const result = astar(linearGraph, 'A', 'D');
    assert.ok(result);
    assert.deepEqual(result.path, ['A', 'B', 'C', 'D']);
    assert.equal(result.cost, 4);
  });

  it('returns path of length 1 when start === goal', () => {
    const result = astar(linearGraph, 'A', 'A');
    assert.ok(result);
    assert.deepEqual(result.path, ['A']);
    assert.equal(result.cost, 0);
  });

  it('returns null when goal is unreachable', () => {
    const result = astar(linearGraph, 'D', 'A'); // no reverse edges
    assert.equal(result, null);
  });

  it('chooses the cheaper of two routes', () => {
    //  S --1--> A --1--> G
    //  S --10-> G
    const graph = {
      neighbors(node) {
        if (node === 'S') return [{ id: 'A', cost: 1 }, { id: 'G', cost: 10 }];
        if (node === 'A') return [{ id: 'G', cost: 1 }];
        return [];
      },
      heuristic() { return 0; },
    };
    const result = astar(graph, 'S', 'G');
    assert.ok(result);
    assert.deepEqual(result.path, ['S', 'A', 'G']);
    assert.equal(result.cost, 2);
  });

  it('works with a heuristic that guides search', () => {
    // Triangle: S->A (1), S->B (5), A->G (1), B->G (1)
    // Heuristic says A is close to G, B is far.
    const graph = {
      neighbors(node) {
        if (node === 'S') return [{ id: 'A', cost: 1 }, { id: 'B', cost: 5 }];
        if (node === 'A') return [{ id: 'G', cost: 1 }];
        if (node === 'B') return [{ id: 'G', cost: 1 }];
        return [];
      },
      heuristic(a, b) {
        if (b !== 'G') return 0;
        const h = { S: 2, A: 1, B: 1, G: 0 };
        return h[a] ?? 0;
      },
    };
    const result = astar(graph, 'S', 'G');
    assert.ok(result);
    assert.equal(result.cost, 2);
    assert.deepEqual(result.path, ['S', 'A', 'G']);
  });
});

// ─── GridGraph ──────────────────────────────────────────────────────────────

describe('GridGraph', () => {
  it('finds a path on an open grid', () => {
    const grid = new GridGraph(5, 5);
    const path = grid.findPath(0, 0, 4, 4);
    assert.ok(path);
    assert.equal(path.length, 9); // Manhattan distance = 8 steps + 1 for start
    assert.deepEqual(path[0], [0, 0]);
    assert.deepEqual(path[path.length - 1], [4, 4]);
  });

  it('returns path of length 1 when start equals goal', () => {
    const grid = new GridGraph(3, 3);
    const path = grid.findPath(1, 1, 1, 1);
    assert.ok(path);
    assert.deepEqual(path, [[1, 1]]);
  });

  it('routes around walls', () => {
    // 3x3 grid with a wall in the middle
    const grid = new GridGraph(3, 3, [[1, 1]]);
    const path = grid.findPath(0, 0, 2, 2);
    assert.ok(path);
    // Path must not pass through (1,1)
    for (const [x, y] of path) {
      assert.ok(!(x === 1 && y === 1), 'path should not include the wall');
    }
  });

  it('returns null when path is blocked', () => {
    // 3x1 corridor fully walled in the middle
    const grid = new GridGraph(3, 1, [[1, 0]]);
    const path = grid.findPath(0, 0, 2, 0);
    assert.equal(path, null);
  });

  it('returns null when start is a wall', () => {
    const grid = new GridGraph(3, 3, [[0, 0]]);
    assert.equal(grid.findPath(0, 0, 2, 2), null);
  });

  it('returns null when goal is a wall', () => {
    const grid = new GridGraph(3, 3, [[2, 2]]);
    assert.equal(grid.findPath(0, 0, 2, 2), null);
  });

  it('setWall / removeWall / isWall work correctly', () => {
    const grid = new GridGraph(5, 5);
    assert.equal(grid.isWall(2, 3), false);
    grid.setWall(2, 3);
    assert.equal(grid.isWall(2, 3), true);
    grid.removeWall(2, 3);
    assert.equal(grid.isWall(2, 3), false);
  });

  it('dynamically added wall blocks previously valid path', () => {
    const grid = new GridGraph(3, 1); // [0,0] [1,0] [2,0]
    assert.ok(grid.findPath(0, 0, 2, 0));
    grid.setWall(1, 0);
    assert.equal(grid.findPath(0, 0, 2, 0), null);
  });
});

// ─── createGridGraph factory ────────────────────────────────────────────────

describe('createGridGraph', () => {
  it('creates a GridGraph with expected dimensions', () => {
    const grid = createGridGraph(10, 8);
    assert.equal(grid.width, 10);
    assert.equal(grid.height, 8);
  });

  it('creates a grid with no walls', () => {
    const grid = createGridGraph(4, 4);
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        assert.equal(grid.isWall(x, y), false);
      }
    }
  });
});
