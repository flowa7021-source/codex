// ─── Unit Tests: Shortest-Path Algorithms ────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Graph } from '../../app/modules/graph.js';
import {
  dijkstra,
  bellmanFord,
  floydWarshall,
  astar,
} from '../../app/modules/shortest-path.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a directed graph from an edge list. */
function buildGraph(edges, directed = true) {
  const g = new Graph(directed);
  for (const [from, to, w = 1] of edges) {
    g.addEdge(from, to, w);
  }
  return g;
}

// ─── Dijkstra ─────────────────────────────────────────────────────────────────

describe('dijkstra – basic', () => {
  it('single vertex: distance to itself is 0', () => {
    const g = new Graph(true);
    g.addVertex('A');
    const r = dijkstra(g, 'A');
    assert.equal(r.get('A')?.distance, 0);
    assert.deepEqual(r.get('A')?.path, ['A']);
  });

  it('two vertices connected by one edge', () => {
    const g = buildGraph([['A', 'B', 7]]);
    const r = dijkstra(g, 'A');
    assert.equal(r.get('B')?.distance, 7);
    assert.deepEqual(r.get('B')?.path, ['A', 'B']);
  });

  it('chooses shorter path over longer one', () => {
    // A→B = 10, A→C = 1, C→B = 2  → best A→B = 3
    const g = buildGraph([
      ['A', 'B', 10],
      ['A', 'C', 1],
      ['C', 'B', 2],
    ]);
    const r = dijkstra(g, 'A');
    assert.equal(r.get('B')?.distance, 3);
    assert.deepEqual(r.get('B')?.path, ['A', 'C', 'B']);
  });

  it('unreachable vertex is absent from result', () => {
    const g = buildGraph([['A', 'B', 1]]);
    g.addVertex('C'); // isolated
    const r = dijkstra(g, 'A');
    assert.equal(r.has('C'), false);
  });

  it('early-exit with end parameter gives same distance', () => {
    const g = buildGraph([
      ['A', 'B', 2],
      ['B', 'C', 3],
      ['A', 'D', 100],
    ]);
    const full = dijkstra(g, 'A');
    const early = dijkstra(g, 'A', 'C');
    assert.equal(early.get('C')?.distance, full.get('C')?.distance);
  });

  it('handles equal-weight edges', () => {
    const g = buildGraph([
      ['A', 'B', 1],
      ['A', 'C', 1],
      ['B', 'D', 1],
      ['C', 'D', 1],
    ]);
    const r = dijkstra(g, 'A');
    assert.equal(r.get('D')?.distance, 2);
  });

  it('start distance is 0 and path is [start]', () => {
    const g = buildGraph([['A', 'B', 5], ['B', 'C', 3]]);
    const r = dijkstra(g, 'A');
    assert.equal(r.get('A')?.distance, 0);
    assert.deepEqual(r.get('A')?.path, ['A']);
  });

  it('longer chain gives cumulative distance', () => {
    const g = buildGraph([
      ['A', 'B', 1],
      ['B', 'C', 2],
      ['C', 'D', 3],
    ]);
    const r = dijkstra(g, 'A');
    assert.equal(r.get('D')?.distance, 6);
    assert.deepEqual(r.get('D')?.path, ['A', 'B', 'C', 'D']);
  });
});

describe('dijkstra – undirected graph', () => {
  it('finds shortest path in undirected graph', () => {
    const g = new Graph(false);
    g.addEdge('A', 'B', 4);
    g.addEdge('A', 'C', 2);
    g.addEdge('C', 'B', 1);
    const r = dijkstra(g, 'A');
    assert.equal(r.get('B')?.distance, 3);
  });
});

// ─── Bellman-Ford ─────────────────────────────────────────────────────────────

describe('bellmanFord – basic', () => {
  it('distance to start is 0', () => {
    const g = buildGraph([['A', 'B', 3]]);
    const { distances } = bellmanFord(g, 'A');
    assert.equal(distances.get('A'), 0);
  });

  it('simple positive-weight path', () => {
    const g = buildGraph([['A', 'B', 5], ['B', 'C', 2]]);
    const { distances, hasNegativeCycle } = bellmanFord(g, 'A');
    assert.equal(distances.get('C'), 7);
    assert.equal(hasNegativeCycle, false);
  });

  it('unreachable vertex has Infinity distance', () => {
    const g = buildGraph([['A', 'B', 1]]);
    g.addVertex('C');
    const { distances } = bellmanFord(g, 'A');
    assert.equal(distances.get('C'), Infinity);
  });
});

describe('bellmanFord – negative weights', () => {
  it('handles negative-weight edges without cycle', () => {
    // A→B = 4, A→C = 2, C→B = -1  → best A→B = 1
    const g = buildGraph([
      ['A', 'B', 4],
      ['A', 'C', 2],
      ['C', 'B', -1],
    ]);
    const { distances, hasNegativeCycle } = bellmanFord(g, 'A');
    assert.equal(distances.get('B'), 1);
    assert.equal(hasNegativeCycle, false);
  });

  it('detects negative-weight cycle', () => {
    const g = buildGraph([
      ['A', 'B', 1],
      ['B', 'C', -3],
      ['C', 'A', 1],
    ]);
    const { hasNegativeCycle } = bellmanFord(g, 'A');
    assert.equal(hasNegativeCycle, true);
  });

  it('no negative cycle in a DAG with mixed weights', () => {
    const g = buildGraph([
      ['S', 'A', -1],
      ['A', 'B', 2],
      ['S', 'B', 5],
    ]);
    const { distances, hasNegativeCycle } = bellmanFord(g, 'S');
    assert.equal(hasNegativeCycle, false);
    assert.equal(distances.get('B'), 1);
  });
});

// ─── Floyd-Warshall ───────────────────────────────────────────────────────────

describe('floydWarshall – basic', () => {
  it('distance from a vertex to itself is 0', () => {
    const g = buildGraph([['A', 'B', 2]]);
    const m = floydWarshall(g);
    assert.equal(m.get('A')?.get('A'), 0);
    assert.equal(m.get('B')?.get('B'), 0);
  });

  it('direct edge distance', () => {
    const g = buildGraph([['A', 'B', 7]]);
    const m = floydWarshall(g);
    assert.equal(m.get('A')?.get('B'), 7);
  });

  it('transitive path through intermediate vertex', () => {
    const g = buildGraph([
      ['A', 'B', 3],
      ['B', 'C', 4],
    ]);
    const m = floydWarshall(g);
    assert.equal(m.get('A')?.get('C'), 7);
  });

  it('no path between disconnected vertices is Infinity', () => {
    const g = buildGraph([['A', 'B', 1]]);
    g.addVertex('C');
    const m = floydWarshall(g);
    assert.equal(m.get('A')?.get('C'), Infinity);
    assert.equal(m.get('C')?.get('A'), Infinity);
  });

  it('all-pairs on a 4-vertex graph', () => {
    // Diamond: A→B=1, A→C=4, B→D=2, C→D=1
    const g = buildGraph([
      ['A', 'B', 1],
      ['A', 'C', 4],
      ['B', 'D', 2],
      ['C', 'D', 1],
    ]);
    const m = floydWarshall(g);
    // A→D: best is A→B→D = 3 (not A→C→D = 5)
    assert.equal(m.get('A')?.get('D'), 3);
    // B→D = 2
    assert.equal(m.get('B')?.get('D'), 2);
    // C→D = 1
    assert.equal(m.get('C')?.get('D'), 1);
    // B→C: no direct edge and no path in directed graph from B to C
    assert.equal(m.get('B')?.get('C'), Infinity);
  });

  it('symmetric distances in undirected graph', () => {
    const g = new Graph(false);
    g.addEdge('A', 'B', 5);
    g.addEdge('B', 'C', 3);
    const m = floydWarshall(g);
    assert.equal(m.get('A')?.get('C'), 8);
    assert.equal(m.get('C')?.get('A'), 8);
  });
});

// ─── A* ───────────────────────────────────────────────────────────────────────

describe('astar – zero heuristic equals Dijkstra', () => {
  const zero = () => 0;

  it('finds direct path', () => {
    const g = buildGraph([['A', 'B', 5]]);
    const r = astar(g, 'A', 'B', zero);
    assert.ok(r !== null);
    assert.equal(r.distance, 5);
    assert.deepEqual(r.path, ['A', 'B']);
  });

  it('finds shortest path with multiple routes', () => {
    const g = buildGraph([
      ['A', 'B', 10],
      ['A', 'C', 2],
      ['C', 'B', 3],
    ]);
    const r = astar(g, 'A', 'B', zero);
    assert.ok(r !== null);
    assert.equal(r.distance, 5);
    assert.deepEqual(r.path, ['A', 'C', 'B']);
  });

  it('returns null for unreachable end', () => {
    const g = buildGraph([['A', 'B', 1]]);
    g.addVertex('C');
    const r = astar(g, 'A', 'C', zero);
    assert.equal(r, null);
  });

  it('start === end returns distance 0', () => {
    const g = buildGraph([['A', 'B', 1]]);
    const r = astar(g, 'A', 'A', zero);
    assert.ok(r !== null);
    assert.equal(r.distance, 0);
    assert.deepEqual(r.path, ['A']);
  });

  it('returns null for unknown start vertex', () => {
    const g = buildGraph([['A', 'B', 1]]);
    const r = astar(g, 'Z', 'A', zero);
    assert.equal(r, null);
  });

  it('returns null for unknown end vertex', () => {
    const g = buildGraph([['A', 'B', 1]]);
    const r = astar(g, 'A', 'Z', zero);
    assert.equal(r, null);
  });

  it('multi-hop chain', () => {
    const g = buildGraph([
      ['A', 'B', 1],
      ['B', 'C', 2],
      ['C', 'D', 3],
    ]);
    const r = astar(g, 'A', 'D', zero);
    assert.ok(r !== null);
    assert.equal(r.distance, 6);
    assert.deepEqual(r.path, ['A', 'B', 'C', 'D']);
  });
});

describe('astar – admissible heuristic', () => {
  it('heuristic that overestimates can still give correct result on simple graph', () => {
    // Use a constant heuristic of 1 — admissible if all edges ≥ 1
    const g = buildGraph([
      ['A', 'B', 2],
      ['A', 'C', 1],
      ['C', 'B', 1],
    ]);
    const r = astar(g, 'A', 'B', () => 1);
    assert.ok(r !== null);
    assert.equal(r.distance, 2); // A→C→B
  });

  it('larger graph: admissible heuristic finds optimal path', () => {
    // Grid-like graph where heuristic is Manhattan distance on simple coords
    // Vertices labelled 0..4; coord = vertex number
    const g = buildGraph([
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
      [3, 4, 1],
      [0, 4, 10], // shortcut that costs 10 — not optimal
    ]);
    const h = (from, to) => Math.abs(Number(to) - Number(from));
    const r = astar(g, 0, 4, h);
    assert.ok(r !== null);
    // Optimal is 0→1→2→3→4 with distance 4, not direct 0→4 with distance 10
    assert.equal(r.distance, 4);
  });
});
