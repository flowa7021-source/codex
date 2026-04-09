// ─── Unit Tests: graph-algorithms ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdjList,
  bfs,
  dfs,
  dijkstra,
  shortestPath,
  topologicalSort,
  hasCycle,
  connectedComponents,
  isConnected,
} from '../../app/modules/graph-algorithms.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Simple directed graph: A→B, A→C, B→D, C→D */
const simpleGraph = {
  nodes: ['A', 'B', 'C', 'D'],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'A', to: 'C' },
    { from: 'B', to: 'D' },
    { from: 'C', to: 'D' },
  ],
};

/** Weighted graph for Dijkstra */
const weightedGraph = {
  nodes: ['A', 'B', 'C', 'D', 'E'],
  edges: [
    { from: 'A', to: 'B', weight: 4 },
    { from: 'A', to: 'C', weight: 2 },
    { from: 'C', to: 'B', weight: 1 },
    { from: 'B', to: 'D', weight: 5 },
    { from: 'C', to: 'D', weight: 8 },
    { from: 'D', to: 'E', weight: 2 },
  ],
};

/** Graph with a cycle: A→B→C→A */
const cyclicGraph = {
  nodes: ['A', 'B', 'C'],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'C' },
    { from: 'C', to: 'A' },
  ],
};

/** Disconnected undirected graph: {A-B} and {C-D} */
const disconnectedGraph = {
  nodes: ['A', 'B', 'C', 'D'],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'A' },
    { from: 'C', to: 'D' },
    { from: 'D', to: 'C' },
  ],
};

// ─── buildAdjList ─────────────────────────────────────────────────────────────

describe('buildAdjList', () => {
  it('creates entries for all nodes', () => {
    const adj = buildAdjList(simpleGraph);
    assert.equal(adj.size, 4);
    for (const node of simpleGraph.nodes) {
      assert.ok(adj.has(node), `missing node ${node}`);
    }
  });

  it('stores correct neighbors with default weight 1', () => {
    const adj = buildAdjList(simpleGraph);
    const aNeighbors = adj.get('A') ?? [];
    assert.equal(aNeighbors.length, 2);
    const targets = aNeighbors.map((n) => n.node).sort();
    assert.deepEqual(targets, ['B', 'C']);
    for (const n of aNeighbors) {
      assert.equal(n.weight, 1);
    }
  });

  it('stores custom edge weights', () => {
    const adj = buildAdjList(weightedGraph);
    const aNeighbors = adj.get('A') ?? [];
    const bEntry = aNeighbors.find((n) => n.node === 'B');
    assert.ok(bEntry);
    assert.equal(bEntry.weight, 4);
  });

  it('leaf nodes have empty neighbor lists', () => {
    const adj = buildAdjList(simpleGraph);
    assert.deepEqual(adj.get('D'), []);
  });
});

// ─── bfs ──────────────────────────────────────────────────────────────────────

describe('bfs', () => {
  it('visits source first', () => {
    const order = bfs(simpleGraph, 'A');
    assert.equal(order[0], 'A');
  });

  it('visits all reachable nodes from A', () => {
    const order = bfs(simpleGraph, 'A');
    assert.equal(order.length, 4);
    assert.deepEqual([...order].sort(), ['A', 'B', 'C', 'D']);
  });

  it('respects BFS level ordering (children before grandchildren)', () => {
    const order = bfs(simpleGraph, 'A');
    // A's direct children (B, C) must appear before D
    const idxA = order.indexOf('A');
    const idxB = order.indexOf('B');
    const idxC = order.indexOf('C');
    const idxD = order.indexOf('D');
    assert.ok(idxA < idxB);
    assert.ok(idxA < idxC);
    assert.ok(idxB < idxD);
    assert.ok(idxC < idxD);
  });

  it('returns only source when it has no edges', () => {
    const order = bfs(simpleGraph, 'D');
    assert.deepEqual(order, ['D']);
  });

  it('works with a single-node graph', () => {
    const g = { nodes: ['X'], edges: [] };
    assert.deepEqual(bfs(g, 'X'), ['X']);
  });
});

// ─── dfs ──────────────────────────────────────────────────────────────────────

describe('dfs', () => {
  it('visits source first', () => {
    const order = dfs(simpleGraph, 'A');
    assert.equal(order[0], 'A');
  });

  it('visits all reachable nodes from A', () => {
    const order = dfs(simpleGraph, 'A');
    assert.equal(order.length, 4);
    assert.deepEqual([...order].sort(), ['A', 'B', 'C', 'D']);
  });

  it('visits along a branch before backtracking (depth-first property)', () => {
    // A→B, B→D means D should come right after B (before C) in left-first DFS
    const order = dfs(simpleGraph, 'A');
    const idxB = order.indexOf('B');
    const idxD = order.indexOf('D');
    const idxC = order.indexOf('C');
    // B and D are on the same branch, so D should come before C
    assert.ok(idxB < idxD);
    assert.ok(idxD < idxC);
  });

  it('returns only source when no edges', () => {
    assert.deepEqual(dfs(simpleGraph, 'D'), ['D']);
  });

  it('works with a single-node graph', () => {
    const g = { nodes: ['X'], edges: [] };
    assert.deepEqual(dfs(g, 'X'), ['X']);
  });
});

// ─── dijkstra ─────────────────────────────────────────────────────────────────

describe('dijkstra', () => {
  it('returns 0 for source node', () => {
    const dist = dijkstra(weightedGraph, 'A');
    assert.equal(dist.get('A'), 0);
  });

  it('finds correct shortest distances', () => {
    const dist = dijkstra(weightedGraph, 'A');
    // A→C = 2, A→C→B = 3 (cheaper than A→B = 4)
    assert.equal(dist.get('C'), 2);
    assert.equal(dist.get('B'), 3);
    // A→C→B→D = 8
    assert.equal(dist.get('D'), 8);
    // A→C→B→D→E = 10
    assert.equal(dist.get('E'), 10);
  });

  it('returns Infinity for unreachable nodes', () => {
    const dist = dijkstra(weightedGraph, 'E');
    assert.equal(dist.get('A'), Infinity);
    assert.equal(dist.get('B'), Infinity);
  });

  it('handles unweighted edges (default weight 1)', () => {
    const dist = dijkstra(simpleGraph, 'A');
    assert.equal(dist.get('A'), 0);
    assert.equal(dist.get('B'), 1);
    assert.equal(dist.get('C'), 1);
    assert.equal(dist.get('D'), 2);
  });
});

// ─── shortestPath ─────────────────────────────────────────────────────────────

describe('shortestPath', () => {
  it('returns a path from source to target', () => {
    const path = shortestPath(weightedGraph, 'A', 'E');
    assert.ok(path !== null);
    assert.equal(path[0], 'A');
    assert.equal(path[path.length - 1], 'E');
  });

  it('returns the optimal path (via C, not direct)', () => {
    const path = shortestPath(weightedGraph, 'A', 'B');
    assert.ok(path !== null);
    // Optimal: A→C→B (cost 3) rather than A→B (cost 4)
    assert.deepEqual(path, ['A', 'C', 'B']);
  });

  it('returns [source] when source equals target', () => {
    const path = shortestPath(weightedGraph, 'A', 'A');
    assert.ok(path !== null);
    assert.deepEqual(path, ['A']);
  });

  it('returns null when target is unreachable', () => {
    const path = shortestPath(weightedGraph, 'E', 'A');
    assert.equal(path, null);
  });

  it('returns direct path when only one route exists', () => {
    const g = {
      nodes: ['X', 'Y'],
      edges: [{ from: 'X', to: 'Y', weight: 5 }],
    };
    const path = shortestPath(g, 'X', 'Y');
    assert.deepEqual(path, ['X', 'Y']);
  });
});

// ─── topologicalSort ──────────────────────────────────────────────────────────

describe('topologicalSort', () => {
  it('returns a valid topological ordering', () => {
    const order = topologicalSort(simpleGraph);
    assert.ok(order !== null);
    assert.equal(order.length, 4);

    // For each edge, from must appear before to
    for (const edge of simpleGraph.edges) {
      const fromIdx = order.indexOf(edge.from);
      const toIdx = order.indexOf(edge.to);
      assert.ok(fromIdx < toIdx, `${edge.from} must come before ${edge.to}`);
    }
  });

  it('returns null for a cyclic graph', () => {
    const result = topologicalSort(cyclicGraph);
    assert.equal(result, null);
  });

  it('handles a graph with no edges (any order is valid)', () => {
    const g = { nodes: ['A', 'B', 'C'], edges: [] };
    const order = topologicalSort(g);
    assert.ok(order !== null);
    assert.equal(order.length, 3);
    assert.deepEqual([...order].sort(), ['A', 'B', 'C']);
  });

  it('handles a linear chain A→B→C', () => {
    const g = {
      nodes: ['A', 'B', 'C'],
      edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }],
    };
    const order = topologicalSort(g);
    assert.deepEqual(order, ['A', 'B', 'C']);
  });
});

// ─── hasCycle ─────────────────────────────────────────────────────────────────

describe('hasCycle', () => {
  it('returns true for a cyclic graph', () => {
    assert.equal(hasCycle(cyclicGraph), true);
  });

  it('returns false for an acyclic graph', () => {
    assert.equal(hasCycle(simpleGraph), false);
  });

  it('returns false for a graph with no edges', () => {
    const g = { nodes: ['A', 'B', 'C'], edges: [] };
    assert.equal(hasCycle(g), false);
  });

  it('returns false for a single-node graph', () => {
    const g = { nodes: ['A'], edges: [] };
    assert.equal(hasCycle(g), false);
  });

  it('detects a self-loop', () => {
    const g = { nodes: ['A'], edges: [{ from: 'A', to: 'A' }] };
    assert.equal(hasCycle(g), true);
  });
});

// ─── connectedComponents ──────────────────────────────────────────────────────

describe('connectedComponents', () => {
  it('finds two components in a disconnected graph', () => {
    const components = connectedComponents(disconnectedGraph);
    assert.equal(components.length, 2);
  });

  it('each node appears in exactly one component', () => {
    const components = connectedComponents(disconnectedGraph);
    const allNodes = components.flat().sort();
    assert.deepEqual(allNodes, ['A', 'B', 'C', 'D']);
  });

  it('groups connected nodes correctly', () => {
    const components = connectedComponents(disconnectedGraph);
    const sets = components.map((c) => new Set(c));
    const abComponent = sets.find((s) => s.has('A'));
    const cdComponent = sets.find((s) => s.has('C'));
    assert.ok(abComponent?.has('B'));
    assert.ok(cdComponent?.has('D'));
    assert.ok(!abComponent?.has('C'));
    assert.ok(!cdComponent?.has('A'));
  });

  it('returns one component for a fully connected graph', () => {
    const g = {
      nodes: ['A', 'B', 'C'],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ],
    };
    const components = connectedComponents(g);
    assert.equal(components.length, 1);
    assert.equal(components[0].length, 3);
  });

  it('returns each node as its own component when no edges', () => {
    const g = { nodes: ['X', 'Y', 'Z'], edges: [] };
    const components = connectedComponents(g);
    assert.equal(components.length, 3);
  });

  it('returns empty array for empty graph', () => {
    const g = { nodes: [], edges: [] };
    const components = connectedComponents(g);
    assert.deepEqual(components, []);
  });
});

// ─── isConnected ──────────────────────────────────────────────────────────────

describe('isConnected', () => {
  it('returns false for a disconnected graph', () => {
    assert.equal(isConnected(disconnectedGraph), false);
  });

  it('returns true for a connected graph', () => {
    const g = {
      nodes: ['A', 'B', 'C'],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'B' },
      ],
    };
    assert.equal(isConnected(g), true);
  });

  it('returns true for a single-node graph', () => {
    const g = { nodes: ['A'], edges: [] };
    assert.equal(isConnected(g), true);
  });

  it('returns true for an empty graph', () => {
    const g = { nodes: [], edges: [] };
    assert.equal(isConnected(g), true);
  });

  it('returns false when one node is isolated', () => {
    const g = {
      nodes: ['A', 'B', 'C'],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ],
    };
    assert.equal(isConnected(g), false);
  });
});
