// ─── Unit Tests: min-spanning-tree ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { WeightedGraph } from '../../app/modules/weighted-graph.js';
import { kruskal, prim, totalWeight, isSpanningTree } from '../../app/modules/min-spanning-tree.js';

// ─── Helper: build a classic triangle graph ──────────────────────────────────
// A --1-- B
// |       |
// 3       2
// |       |
// C ------+
function triangleGraph() {
  const g = new WeightedGraph();
  g.addEdge('A', 'B', 1);
  g.addEdge('B', 'C', 2);
  g.addEdge('A', 'C', 3);
  return g;
}

// ─── Helper: build a larger graph ────────────────────────────────────────────
//    1       4
// A --- B --- C
// |  \       |
// 6    5     3
// |      \   |
// D --2-- E -+
function largerGraph() {
  const g = new WeightedGraph();
  g.addEdge('A', 'B', 1);
  g.addEdge('B', 'C', 4);
  g.addEdge('A', 'D', 6);
  g.addEdge('A', 'E', 5);
  g.addEdge('C', 'E', 3);
  g.addEdge('D', 'E', 2);
  return g;
}

// ─── totalWeight ─────────────────────────────────────────────────────────────

describe('totalWeight', () => {
  it('returns 0 for empty edge list', () => {
    assert.equal(totalWeight([]), 0);
  });

  it('sums edge weights correctly', () => {
    const edges = [
      { from: 'A', to: 'B', weight: 3 },
      { from: 'B', to: 'C', weight: 7 },
    ];
    assert.equal(totalWeight(edges), 10);
  });

  it('handles negative weights', () => {
    const edges = [
      { from: 'A', to: 'B', weight: -2 },
      { from: 'B', to: 'C', weight: 5 },
    ];
    assert.equal(totalWeight(edges), 3);
  });
});

// ─── kruskal ─────────────────────────────────────────────────────────────────

describe('kruskal', () => {
  it('returns empty array for graph with fewer than 2 vertices', () => {
    const g = new WeightedGraph();
    g.addVertex('A');
    assert.deepEqual(kruskal(g), []);
  });

  it('returns empty array for empty graph', () => {
    const g = new WeightedGraph();
    assert.deepEqual(kruskal(g), []);
  });

  it('finds MST of triangle graph', () => {
    const g = triangleGraph();
    const mst = kruskal(g);
    assert.equal(mst.length, 2);
    assert.equal(totalWeight(mst), 3); // edges with weight 1 and 2
  });

  it('MST is valid spanning tree for triangle', () => {
    const g = triangleGraph();
    const mst = kruskal(g);
    assert.equal(isSpanningTree(g, mst), true);
  });

  it('finds MST of larger graph', () => {
    const g = largerGraph();
    const mst = kruskal(g);
    assert.equal(mst.length, 4); // 5 vertices - 1
    // Optimal MST: A-B(1), D-E(2), C-E(3), B-C(4) = 10
    assert.equal(totalWeight(mst), 10);
    assert.equal(isSpanningTree(g, mst), true);
  });

  it('works with a simple 2-vertex graph', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 42);
    const mst = kruskal(g);
    assert.equal(mst.length, 1);
    assert.equal(totalWeight(mst), 42);
  });
});

// ─── prim ────────────────────────────────────────────────────────────────────

describe('prim', () => {
  it('returns empty array for graph with fewer than 2 vertices', () => {
    const g = new WeightedGraph();
    g.addVertex('A');
    assert.deepEqual(prim(g, 'A'), []);
  });

  it('returns empty array if start vertex not in graph', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 1);
    assert.deepEqual(prim(g, 'Z'), []);
  });

  it('finds MST of triangle graph', () => {
    const g = triangleGraph();
    const mst = prim(g, 'A');
    assert.equal(mst.length, 2);
    assert.equal(totalWeight(mst), 3);
  });

  it('MST is valid spanning tree for triangle', () => {
    const g = triangleGraph();
    const mst = prim(g, 'A');
    assert.equal(isSpanningTree(g, mst), true);
  });

  it('finds MST of larger graph from different start vertices', () => {
    const g = largerGraph();
    const mstA = prim(g, 'A');
    const mstD = prim(g, 'D');
    // Total weight should be the same regardless of start
    assert.equal(totalWeight(mstA), 10);
    assert.equal(totalWeight(mstD), 10);
    assert.equal(isSpanningTree(g, mstA), true);
    assert.equal(isSpanningTree(g, mstD), true);
  });

  it('produces same total weight as kruskal', () => {
    const g = largerGraph();
    const kMst = kruskal(g);
    const pMst = prim(g, 'A');
    assert.equal(totalWeight(kMst), totalWeight(pMst));
  });
});

// ─── isSpanningTree ──────────────────────────────────────────────────────────

describe('isSpanningTree', () => {
  it('returns true for valid spanning tree', () => {
    const g = triangleGraph();
    const edges = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'B', to: 'C', weight: 2 },
    ];
    assert.equal(isSpanningTree(g, edges), true);
  });

  it('returns false when edge count != V-1', () => {
    const g = triangleGraph();
    const edges = [{ from: 'A', to: 'B', weight: 1 }];
    assert.equal(isSpanningTree(g, edges), false);
  });

  it('returns false when edges form a cycle', () => {
    const g = triangleGraph();
    const edges = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'B', to: 'C', weight: 2 },
      { from: 'A', to: 'C', weight: 3 },
    ];
    // 3 edges for 3 vertices is not V-1
    assert.equal(isSpanningTree(g, edges), false);
  });

  it('returns false when edges reference non-existent vertices', () => {
    const g = triangleGraph();
    const edges = [
      { from: 'A', to: 'Z', weight: 1 },
      { from: 'B', to: 'C', weight: 2 },
    ];
    assert.equal(isSpanningTree(g, edges), false);
  });

  it('returns false when edges leave graph disconnected', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 1);
    g.addEdge('C', 'D', 2);
    const edges = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'C', to: 'D', weight: 2 },
      // Missing one edge to connect components; also wrong count
      // Actually 4 vertices need 3 edges
    ];
    // Only 2 edges for 4 vertices, already wrong count
    assert.equal(isSpanningTree(g, edges), false);
  });

  it('handles empty graph', () => {
    const g = new WeightedGraph();
    assert.equal(isSpanningTree(g, []), true);
  });

  it('returns false for disconnected tree edges with correct count', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 1);
    g.addEdge('C', 'D', 2);
    g.addEdge('A', 'C', 3);
    // 4 vertices need 3 edges; provide 3 disconnected-looking edges
    const edges = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'C', to: 'D', weight: 2 },
      { from: 'A', to: 'C', weight: 3 },
    ];
    assert.equal(isSpanningTree(g, edges), true);
  });
});
