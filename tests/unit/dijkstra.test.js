// ─── Unit Tests: Dijkstra's Shortest Path ─────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { dijkstra, shortestPath, allShortestPaths } from '../../app/modules/dijkstra.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a simple undirected graph from an adjacency list. */
function makeGraph(edges) {
  const adj = new Map();
  for (const [u, v, w] of edges) {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u).push({ vertex: v, weight: w });
    adj.get(v).push({ vertex: u, weight: w });
  }
  return {
    vertices: () => [...adj.keys()],
    neighbors: (v) => adj.get(v) ?? [],
  };
}

/** Build a directed graph from an edge list. */
function makeDirectedGraph(edges, allVerts) {
  const adj = new Map();
  for (const v of allVerts) adj.set(v, []);
  for (const [u, v, w] of edges) {
    adj.get(u).push({ vertex: v, weight: w });
  }
  return {
    vertices: () => [...adj.keys()],
    neighbors: (v) => adj.get(v) ?? [],
  };
}

// ─── dijkstra() core ────────────────────────────────────────────────────────

describe('dijkstra – core', () => {
  it('computes distances for a simple triangle', () => {
    const g = makeGraph([
      ['A', 'B', 1],
      ['B', 'C', 2],
      ['A', 'C', 10],
    ]);
    const { distances } = dijkstra(g, 'A');
    assert.equal(distances.get('A'), 0);
    assert.equal(distances.get('B'), 1);
    assert.equal(distances.get('C'), 3); // A->B->C cheaper than A->C
  });

  it('returns Infinity for unreachable vertex', () => {
    const g = makeDirectedGraph([['A', 'B', 1]], ['A', 'B', 'C']);
    const { distances } = dijkstra(g, 'A');
    assert.equal(distances.get('C'), Infinity);
  });

  it('sets predecessor of source to null', () => {
    const g = makeGraph([['X', 'Y', 5]]);
    const { predecessors } = dijkstra(g, 'X');
    assert.equal(predecessors.get('X'), null);
  });

  it('records correct predecessors', () => {
    const g = makeGraph([
      ['A', 'B', 1],
      ['B', 'C', 1],
      ['A', 'C', 10],
    ]);
    const { predecessors } = dijkstra(g, 'A');
    assert.equal(predecessors.get('B'), 'A');
    assert.equal(predecessors.get('C'), 'B');
  });

  it('supports early termination with target', () => {
    // D is far away – with target=B the algorithm should still work correctly.
    const g = makeGraph([
      ['A', 'B', 1],
      ['A', 'D', 100],
    ]);
    const { distances } = dijkstra(g, 'A', 'B');
    assert.equal(distances.get('B'), 1);
  });
});

// ─── shortestPath() ────────────────────────────────────────────────────────

describe('shortestPath', () => {
  it('returns the shortest path between two vertices', () => {
    const g = makeGraph([
      ['A', 'B', 1],
      ['B', 'C', 2],
      ['A', 'C', 10],
    ]);
    const result = shortestPath(g, 'A', 'C');
    assert.ok(result);
    assert.deepEqual(result.path, ['A', 'B', 'C']);
    assert.equal(result.distance, 3);
  });

  it('returns a single-vertex path when source === target', () => {
    const g = makeGraph([['A', 'B', 5]]);
    const result = shortestPath(g, 'A', 'A');
    assert.ok(result);
    assert.deepEqual(result.path, ['A']);
    assert.equal(result.distance, 0);
  });

  it('returns null when target is unreachable', () => {
    const g = makeDirectedGraph([['A', 'B', 1]], ['A', 'B', 'C']);
    assert.equal(shortestPath(g, 'A', 'C'), null);
  });

  it('handles a longer chain correctly', () => {
    const g = makeDirectedGraph(
      [['A', 'B', 2], ['B', 'C', 3], ['C', 'D', 4], ['D', 'E', 5]],
      ['A', 'B', 'C', 'D', 'E'],
    );
    const result = shortestPath(g, 'A', 'E');
    assert.ok(result);
    assert.deepEqual(result.path, ['A', 'B', 'C', 'D', 'E']);
    assert.equal(result.distance, 14);
  });
});

// ─── allShortestPaths() ─────────────────────────────────────────────────────

describe('allShortestPaths', () => {
  it('returns paths to all reachable vertices', () => {
    const g = makeGraph([
      ['A', 'B', 1],
      ['B', 'C', 2],
    ]);
    const all = allShortestPaths(g, 'A');
    assert.equal(all.size, 3); // A, B, C all reachable
    assert.deepEqual(all.get('A').path, ['A']);
    assert.deepEqual(all.get('B').path, ['A', 'B']);
    assert.deepEqual(all.get('C').path, ['A', 'B', 'C']);
    assert.equal(all.get('C').distance, 3);
  });

  it('omits unreachable vertices from the result', () => {
    const g = makeDirectedGraph([['A', 'B', 1]], ['A', 'B', 'C']);
    const all = allShortestPaths(g, 'A');
    assert.ok(all.has('A'));
    assert.ok(all.has('B'));
    assert.ok(!all.has('C'));
  });

  it('works with numeric vertex types', () => {
    const adj = new Map([
      [1, [{ vertex: 2, weight: 10 }, { vertex: 3, weight: 3 }]],
      [2, [{ vertex: 3, weight: 1 }]],
      [3, [{ vertex: 2, weight: 4 }]],
    ]);
    const g = {
      vertices: () => [1, 2, 3],
      neighbors: (v) => adj.get(v) ?? [],
    };
    const all = allShortestPaths(g, 1);
    assert.equal(all.get(2).distance, 7); // 1->3->2 = 3+4 = 7 < 10
    assert.deepEqual(all.get(2).path, [1, 3, 2]);
  });
});
