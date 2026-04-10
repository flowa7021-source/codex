// ─── Unit Tests: Graph ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Graph } from '../../app/modules/graph.js';

// ─── Construction ─────────────────────────────────────────────────────────────

describe('Graph – construction', () => {
  it('creates an empty undirected graph by default', () => {
    const g = new Graph();
    assert.equal(g.vertexCount, 0);
    assert.equal(g.edgeCount, 0);
    assert.deepEqual(g.vertices(), []);
    assert.deepEqual(g.edges(), []);
  });

  it('creates an empty directed graph', () => {
    const g = new Graph(true);
    assert.equal(g.vertexCount, 0);
    assert.equal(g.edgeCount, 0);
  });
});

// ─── Vertices ─────────────────────────────────────────────────────────────────

describe('Graph – vertices', () => {
  it('addVertex adds a vertex', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.equal(g.vertexCount, 1);
    assert.equal(g.hasVertex('A'), true);
    assert.equal(g.hasVertex('B'), false);
  });

  it('addVertex is idempotent', () => {
    const g = new Graph();
    g.addVertex('X');
    g.addVertex('X');
    assert.equal(g.vertexCount, 1);
  });

  it('removeVertex removes it and all incident edges', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 2);
    g.removeVertex('B');
    assert.equal(g.hasVertex('B'), false);
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('B', 'C'), false);
    assert.equal(g.vertexCount, 2); // A, C remain
  });

  it('vertices() returns all added vertices in insertion order', () => {
    const g = new Graph();
    g.addVertex('Z');
    g.addVertex('A');
    g.addVertex('M');
    assert.deepEqual(g.vertices(), ['Z', 'A', 'M']);
  });
});

// ─── Edges ────────────────────────────────────────────────────────────────────

describe('Graph – undirected edges', () => {
  it('addEdge implicitly creates both endpoints', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 5);
    assert.equal(g.hasVertex('A'), true);
    assert.equal(g.hasVertex('B'), true);
  });

  it('undirected addEdge creates edges in both directions', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 3);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), true);
    assert.equal(g.edgeCount, 1); // counted once for undirected
  });

  it('default weight is 1', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    const n = g.neighbors('A');
    assert.equal(n.length, 1);
    assert.equal(n[0].weight, 1);
  });

  it('removeEdge removes edge in both directions (undirected)', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 7);
    g.removeEdge('A', 'B');
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('B', 'A'), false);
    assert.equal(g.edgeCount, 0);
  });

  it('edges() returns all edges', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 2);
    g.addEdge('B', 'C', 3);
    // Each undirected edge appears twice in the adjacency list
    const es = g.edges();
    assert.equal(es.length, 4); // A→B, B→A, B→C, C→B
  });
});

describe('Graph – directed edges', () => {
  it('directed addEdge only creates edge in one direction', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 4);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), false);
    assert.equal(g.edgeCount, 1);
  });

  it('removeEdge in directed graph only removes specified direction', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'A', 1);
    g.removeEdge('A', 'B');
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('B', 'A'), true);
  });
});

// ─── Neighbors ────────────────────────────────────────────────────────────────

describe('Graph – neighbors', () => {
  it('neighbors returns edges with correct to and weight', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 10);
    g.addEdge('A', 'C', 20);
    const ns = g.neighbors('A');
    assert.equal(ns.length, 2);
    const toB = ns.find((e) => e.to === 'B');
    assert.ok(toB);
    assert.equal(toB.weight, 10);
  });

  it('neighbors returns [] for unknown vertex', () => {
    const g = new Graph();
    assert.deepEqual(g.neighbors('X'), []);
  });
});

// ─── BFS ──────────────────────────────────────────────────────────────────────

describe('Graph – BFS', () => {
  it('bfs visits start vertex only in isolated graph', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.deepEqual(g.bfs('A'), ['A']);
  });

  it('bfs returns [] for unknown start vertex', () => {
    const g = new Graph();
    assert.deepEqual(g.bfs('X'), []);
  });

  it('bfs visits vertices in breadth-first order', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('C', 'D');
    const order = g.bfs('A');
    // A must come first, B and C before D
    assert.equal(order[0], 'A');
    assert.ok(order.indexOf('B') < order.indexOf('D'));
    assert.ok(order.indexOf('C') < order.indexOf('D'));
    assert.equal(order.length, 4);
  });

  it('bfs does not visit unreachable vertices', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addVertex('C'); // isolated
    const order = g.bfs('A');
    assert.deepEqual(order, ['A', 'B']);
  });

  it('bfs handles cycles without infinite loop', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    const order = g.bfs('A');
    assert.equal(order.length, 3);
  });
});

// ─── DFS ──────────────────────────────────────────────────────────────────────

describe('Graph – DFS', () => {
  it('dfs visits start vertex only in isolated graph', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.deepEqual(g.dfs('A'), ['A']);
  });

  it('dfs returns [] for unknown start vertex', () => {
    const g = new Graph();
    assert.deepEqual(g.dfs('X'), []);
  });

  it('dfs visits all reachable vertices', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    const order = g.dfs('A');
    assert.equal(order.length, 4);
    assert.equal(order[0], 'A');
    // All four vertices present
    for (const v of ['A', 'B', 'C', 'D']) {
      assert.ok(order.includes(v), `missing ${v}`);
    }
  });

  it('dfs does not visit unreachable vertices', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addVertex('C');
    const order = g.dfs('A');
    assert.deepEqual(order, ['A', 'B']);
  });

  it('dfs handles cycles without infinite loop', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    const order = g.dfs('A');
    assert.equal(order.length, 3);
  });
});

// ─── Topological Sort ─────────────────────────────────────────────────────────

describe('Graph – topological sort', () => {
  it('returns valid order for a simple DAG', () => {
    const g = new Graph(true);
    g.addEdge('A', 'C');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');
    const order = g.topologicalSort();
    assert.ok(order !== null);
    // A and B must come before C, C before D
    assert.ok(order.indexOf('A') < order.indexOf('C'));
    assert.ok(order.indexOf('B') < order.indexOf('C'));
    assert.ok(order.indexOf('C') < order.indexOf('D'));
  });

  it('returns null when cycle is present', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(g.topologicalSort(), null);
  });

  it('handles single vertex', () => {
    const g = new Graph(true);
    g.addVertex('X');
    assert.deepEqual(g.topologicalSort(), ['X']);
  });

  it('handles empty graph', () => {
    const g = new Graph(true);
    assert.deepEqual(g.topologicalSort(), []);
  });

  it('returns all vertices for a larger DAG', () => {
    const g = new Graph(true);
    // Build chain: 1 → 2 → 3 → 4 → 5
    for (let i = 1; i < 5; i++) g.addEdge(String(i), String(i + 1));
    const order = g.topologicalSort();
    assert.ok(order !== null);
    assert.equal(order.length, 5);
    for (let i = 1; i < 5; i++) {
      assert.ok(order.indexOf(String(i)) < order.indexOf(String(i + 1)));
    }
  });
});

// ─── Cycle Detection ──────────────────────────────────────────────────────────

describe('Graph – cycle detection', () => {
  it('directed: no cycle in a DAG', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    assert.equal(g.hasCycle(), false);
  });

  it('directed: detects a direct cycle', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('directed: detects a longer cycle', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('directed: self-loop is a cycle', () => {
    const g = new Graph(true);
    g.addEdge('A', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('undirected: no cycle in a tree', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    assert.equal(g.hasCycle(), false);
  });

  it('undirected: detects a cycle', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('empty graph has no cycle', () => {
    const g = new Graph(true);
    assert.equal(g.hasCycle(), false);
  });
});

// ─── Connected Components ─────────────────────────────────────────────────────

describe('Graph – connected components', () => {
  it('empty graph has no components', () => {
    const g = new Graph();
    assert.deepEqual(g.components(), []);
  });

  it('isolated vertices each form their own component', () => {
    const g = new Graph();
    g.addVertex('A');
    g.addVertex('B');
    g.addVertex('C');
    const comps = g.components();
    assert.equal(comps.length, 3);
    for (const c of comps) assert.equal(c.length, 1);
  });

  it('connected graph is one component', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');
    const comps = g.components();
    assert.equal(comps.length, 1);
    assert.equal(comps[0].length, 4);
  });

  it('two separate subgraphs yield two components', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('C', 'D');
    const comps = g.components();
    assert.equal(comps.length, 2);
    // Each component has 2 vertices
    const sizes = comps.map((c) => c.length).sort();
    assert.deepEqual(sizes, [2, 2]);
  });

  it('components contain correct vertices', () => {
    const g = new Graph();
    g.addEdge('X', 'Y');
    g.addVertex('Z');
    const comps = g.components();
    assert.equal(comps.length, 2);
    const flat = comps.flat().sort();
    assert.deepEqual(flat, ['X', 'Y', 'Z']);
  });
});

// ─── Numeric-vertex graph ─────────────────────────────────────────────────────

describe('Graph – numeric vertices', () => {
  it('supports number keys', () => {
    const g = new Graph(true);
    g.addEdge(1, 2, 5);
    g.addEdge(2, 3, 3);
    assert.equal(g.hasEdge(1, 2), true);
    assert.equal(g.hasEdge(2, 3), true);
    assert.equal(g.vertexCount, 3);
  });
});
