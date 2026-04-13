// ─── Unit Tests: graph-utils ──────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Graph } from '../../app/modules/graph-utils.js';

// ─── addNode / hasNode ────────────────────────────────────────────────────────

describe('addNode / hasNode', () => {
  it('adds a node and confirms it exists', () => {
    const g = new Graph();
    g.addNode('A');
    assert.equal(g.hasNode('A'), true);
  });

  it('returns false for a node that was not added', () => {
    const g = new Graph();
    assert.equal(g.hasNode('X'), false);
  });

  it('is idempotent: adding same node twice does not create duplicates', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('A');
    assert.equal(g.nodes().filter((n) => n === 'A').length, 1);
  });

  it('lists all added nodes', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    g.addNode('C');
    assert.equal(g.nodes().length, 3);
  });
});

// ─── addEdge / hasEdge ────────────────────────────────────────────────────────

describe('addEdge / hasEdge', () => {
  it('adds a directed edge and confirms it exists', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    assert.equal(g.hasEdge('A', 'B'), true);
  });

  it('auto-adds nodes when adding an edge', () => {
    const g = new Graph();
    g.addEdge('X', 'Y');
    assert.equal(g.hasNode('X'), true);
    assert.equal(g.hasNode('Y'), true);
  });

  it('edges are directed: A->B does not imply B->A', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), false);
  });

  it('returns false for non-existent edge', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    assert.equal(g.hasEdge('A', 'B'), false);
  });

  it('supports numeric node types', () => {
    const g = new Graph();
    g.addEdge(1, 2);
    assert.equal(g.hasEdge(1, 2), true);
    assert.equal(g.hasEdge(2, 1), false);
  });
});

// ─── removeNode ───────────────────────────────────────────────────────────────

describe('removeNode', () => {
  it('removes a node', () => {
    const g = new Graph();
    g.addNode('A');
    g.removeNode('A');
    assert.equal(g.hasNode('A'), false);
  });

  it('removes all outgoing edges from the removed node', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.removeNode('A');
    assert.equal(g.hasNode('A'), false);
    assert.equal(g.neighbors('A').length, 0);
  });

  it('removes all incoming edges pointing to the removed node', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('C', 'B');
    g.removeNode('B');
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('C', 'B'), false);
  });

  it('is a no-op for a non-existent node', () => {
    const g = new Graph();
    g.addNode('A');
    g.removeNode('Z'); // should not throw
    assert.equal(g.hasNode('A'), true);
  });
});

// ─── removeEdge ───────────────────────────────────────────────────────────────

describe('removeEdge', () => {
  it('removes a specific directed edge', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.removeEdge('A', 'B');
    assert.equal(g.hasEdge('A', 'B'), false);
  });

  it('does not remove the reverse edge', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'A');
    g.removeEdge('A', 'B');
    assert.equal(g.hasEdge('B', 'A'), true);
  });

  it('does not remove the nodes themselves', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.removeEdge('A', 'B');
    assert.equal(g.hasNode('A'), true);
    assert.equal(g.hasNode('B'), true);
  });

  it('is a no-op for a non-existent edge', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    g.removeEdge('A', 'B'); // should not throw
  });
});

// ─── neighbors ────────────────────────────────────────────────────────────────

describe('neighbors', () => {
  it('returns outgoing neighbors', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    const n = g.neighbors('A');
    assert.equal(n.length, 2);
    assert.ok(n.includes('B'));
    assert.ok(n.includes('C'));
  });

  it('does not include nodes with only incoming edges', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('C', 'A');
    const n = g.neighbors('A');
    assert.equal(n.includes('C'), false);
    assert.ok(n.includes('B'));
  });

  it('returns empty array for a node with no outgoing edges', () => {
    const g = new Graph();
    g.addNode('A');
    assert.deepEqual(g.neighbors('A'), []);
  });

  it('returns empty array for a non-existent node', () => {
    const g = new Graph();
    assert.deepEqual(g.neighbors('Z'), []);
  });
});

// ─── bfs ──────────────────────────────────────────────────────────────────────

describe('bfs', () => {
  it('visits nodes in breadth-first order', () => {
    // A -> B, A -> C, B -> D, C -> D
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('C', 'E');
    const result = g.bfs('A');
    // A first, then B and C (level 1), then D and E (level 2)
    assert.equal(result[0], 'A');
    assert.ok(result.indexOf('B') < result.indexOf('D'));
    assert.ok(result.indexOf('C') < result.indexOf('E'));
  });

  it('returns just the start node when it has no outgoing edges', () => {
    const g = new Graph();
    g.addNode('A');
    assert.deepEqual(g.bfs('A'), ['A']);
  });

  it('does not visit unreachable nodes', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addNode('C'); // isolated
    const result = g.bfs('A');
    assert.ok(result.includes('A'));
    assert.ok(result.includes('B'));
    assert.equal(result.includes('C'), false);
  });

  it('returns empty array for non-existent start node', () => {
    const g = new Graph();
    assert.deepEqual(g.bfs('Z'), []);
  });

  it('handles cycles without infinite loop', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A'); // cycle
    const result = g.bfs('A');
    assert.equal(result.length, 3);
  });
});

// ─── dfs ──────────────────────────────────────────────────────────────────────

describe('dfs', () => {
  it('visits nodes in depth-first order', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    const result = g.dfs('A');
    // A -> B -> D before C
    assert.equal(result[0], 'A');
    assert.ok(result.indexOf('B') < result.indexOf('C'));
    assert.ok(result.indexOf('D') < result.indexOf('C'));
  });

  it('returns just the start node when it has no outgoing edges', () => {
    const g = new Graph();
    g.addNode('A');
    assert.deepEqual(g.dfs('A'), ['A']);
  });

  it('does not visit unreachable nodes', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addNode('C'); // isolated
    const result = g.dfs('A');
    assert.equal(result.includes('C'), false);
  });

  it('returns empty array for non-existent start node', () => {
    const g = new Graph();
    assert.deepEqual(g.dfs('Z'), []);
  });

  it('handles cycles without infinite loop', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A'); // cycle
    const result = g.dfs('A');
    assert.equal(result.length, 3);
  });
});

// ─── topologicalSort ──────────────────────────────────────────────────────────

describe('topologicalSort', () => {
  it('returns a valid topological order for a DAG', () => {
    // A -> C, B -> C, C -> D
    const g = new Graph();
    g.addEdge('A', 'C');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');
    const order = g.topologicalSort();
    assert.notEqual(order, null);
    assert.ok(order.indexOf('A') < order.indexOf('C'));
    assert.ok(order.indexOf('B') < order.indexOf('C'));
    assert.ok(order.indexOf('C') < order.indexOf('D'));
  });

  it('returns null when the graph has a cycle', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A'); // cycle
    assert.equal(g.topologicalSort(), null);
  });

  it('returns all nodes in sorted array', () => {
    const g = new Graph();
    g.addEdge('X', 'Y');
    g.addEdge('Y', 'Z');
    const order = g.topologicalSort();
    assert.equal(order?.length, 3);
  });

  it('handles a graph with no edges (any order is valid)', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    const order = g.topologicalSort();
    assert.notEqual(order, null);
    assert.equal(order?.length, 2);
  });

  it('handles an empty graph', () => {
    const g = new Graph();
    const order = g.topologicalSort();
    assert.deepEqual(order, []);
  });
});

// ─── shortestPath ─────────────────────────────────────────────────────────────

describe('shortestPath', () => {
  it('finds the shortest path between two connected nodes', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('A', 'C'); // direct path is shorter
    const path = g.shortestPath('A', 'C');
    assert.deepEqual(path, ['A', 'C']);
  });

  it('finds a path when only one route exists', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    const path = g.shortestPath('A', 'C');
    assert.deepEqual(path, ['A', 'B', 'C']);
  });

  it('returns [from] when from equals to', () => {
    const g = new Graph();
    g.addNode('A');
    const path = g.shortestPath('A', 'A');
    assert.deepEqual(path, ['A']);
  });

  it('returns null when no path exists', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addNode('C'); // isolated
    assert.equal(g.shortestPath('A', 'C'), null);
  });

  it('returns null when start node does not exist', () => {
    const g = new Graph();
    g.addNode('B');
    assert.equal(g.shortestPath('Z', 'B'), null);
  });

  it('returns null when end node does not exist', () => {
    const g = new Graph();
    g.addNode('A');
    assert.equal(g.shortestPath('A', 'Z'), null);
  });

  it('respects edge direction — no path against direction', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    assert.equal(g.shortestPath('B', 'A'), null);
  });
});

// ─── hasCycle ─────────────────────────────────────────────────────────────────

describe('hasCycle', () => {
  it('returns true for a graph with a simple cycle', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('returns true for a self-loop', () => {
    const g = new Graph();
    g.addEdge('A', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('returns false for a DAG', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('A', 'C');
    assert.equal(g.hasCycle(), false);
  });

  it('returns false for an empty graph', () => {
    const g = new Graph();
    assert.equal(g.hasCycle(), false);
  });

  it('returns false for a graph with only isolated nodes', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    assert.equal(g.hasCycle(), false);
  });

  it('detects cycle in one component while another is acyclic', () => {
    const g = new Graph();
    // Component 1: acyclic A -> B
    g.addEdge('A', 'B');
    // Component 2: cyclic X -> Y -> X
    g.addEdge('X', 'Y');
    g.addEdge('Y', 'X');
    assert.equal(g.hasCycle(), true);
  });
});
