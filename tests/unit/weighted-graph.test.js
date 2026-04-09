// ─── Unit Tests: weighted-graph ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { WeightedGraph, createWeightedGraph } from '../../app/modules/weighted-graph.js';

// ─── constructor / isDirected ────────────────────────────────────────────────

describe('WeightedGraph constructor', () => {
  it('defaults to undirected', () => {
    const g = new WeightedGraph();
    assert.equal(g.isDirected, false);
  });

  it('can be created as directed', () => {
    const g = new WeightedGraph(true);
    assert.equal(g.isDirected, true);
  });

  it('starts empty', () => {
    const g = new WeightedGraph();
    assert.equal(g.vertexCount, 0);
    assert.equal(g.edgeCount, 0);
  });
});

// ─── addVertex / hasVertex / vertices ────────────────────────────────────────

describe('addVertex / hasVertex', () => {
  it('adds a vertex and confirms it exists', () => {
    const g = new WeightedGraph();
    g.addVertex('A');
    assert.equal(g.hasVertex('A'), true);
    assert.equal(g.vertexCount, 1);
  });

  it('returns false for absent vertex', () => {
    const g = new WeightedGraph();
    assert.equal(g.hasVertex('Z'), false);
  });

  it('is idempotent', () => {
    const g = new WeightedGraph();
    g.addVertex('A');
    g.addVertex('A');
    assert.equal(g.vertexCount, 1);
  });

  it('vertices() returns all added vertices', () => {
    const g = new WeightedGraph();
    g.addVertex('A');
    g.addVertex('B');
    g.addVertex('C');
    assert.deepEqual(g.vertices().sort(), ['A', 'B', 'C']);
  });
});

// ─── addEdge / hasEdge / getWeight ───────────────────────────────────────────

describe('addEdge / hasEdge / getWeight', () => {
  it('adds an edge and confirms it exists', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 5);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.getWeight('A', 'B'), 5);
  });

  it('auto-adds vertices when adding an edge', () => {
    const g = new WeightedGraph();
    g.addEdge('X', 'Y', 3);
    assert.equal(g.hasVertex('X'), true);
    assert.equal(g.hasVertex('Y'), true);
  });

  it('undirected edge exists in both directions', () => {
    const g = new WeightedGraph(false);
    g.addEdge('A', 'B', 7);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), true);
    assert.equal(g.getWeight('B', 'A'), 7);
  });

  it('directed edge only exists in one direction', () => {
    const g = new WeightedGraph(true);
    g.addEdge('A', 'B', 7);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), false);
  });

  it('getWeight returns undefined for non-existent edge', () => {
    const g = new WeightedGraph();
    g.addVertex('A');
    assert.equal(g.getWeight('A', 'B'), undefined);
  });

  it('overwrites weight on duplicate edge', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 5);
    g.addEdge('A', 'B', 10);
    assert.equal(g.getWeight('A', 'B'), 10);
  });
});

// ─── edgeCount ───────────────────────────────────────────────────────────────

describe('edgeCount', () => {
  it('counts undirected edges correctly (no double-count)', () => {
    const g = new WeightedGraph(false);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 2);
    assert.equal(g.edgeCount, 2);
  });

  it('counts directed edges correctly', () => {
    const g = new WeightedGraph(true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'A', 2);
    assert.equal(g.edgeCount, 2);
  });
});

// ─── removeVertex ────────────────────────────────────────────────────────────

describe('removeVertex', () => {
  it('removes a vertex and its edges', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 1);
    g.addEdge('A', 'C', 2);
    assert.equal(g.removeVertex('A'), true);
    assert.equal(g.hasVertex('A'), false);
    assert.equal(g.hasEdge('B', 'A'), false);
    assert.equal(g.hasEdge('C', 'A'), false);
  });

  it('returns false when removing non-existent vertex', () => {
    const g = new WeightedGraph();
    assert.equal(g.removeVertex('Z'), false);
  });
});

// ─── removeEdge ──────────────────────────────────────────────────────────────

describe('removeEdge', () => {
  it('removes an undirected edge from both directions', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 1);
    assert.equal(g.removeEdge('A', 'B'), true);
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('B', 'A'), false);
  });

  it('returns false when removing non-existent edge', () => {
    const g = new WeightedGraph();
    g.addVertex('A');
    assert.equal(g.removeEdge('A', 'B'), false);
  });
});

// ─── neighbors ───────────────────────────────────────────────────────────────

describe('neighbors', () => {
  it('returns neighbors with weights', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 3);
    g.addEdge('A', 'C', 7);
    const n = g.neighbors('A');
    assert.equal(n.length, 2);
    const sorted = n.sort((a, b) => a.weight - b.weight);
    assert.deepEqual(sorted, [
      { vertex: 'B', weight: 3 },
      { vertex: 'C', weight: 7 },
    ]);
  });

  it('returns empty array for vertex with no neighbors', () => {
    const g = new WeightedGraph();
    g.addVertex('A');
    assert.deepEqual(g.neighbors('A'), []);
  });

  it('returns empty array for non-existent vertex', () => {
    const g = new WeightedGraph();
    assert.deepEqual(g.neighbors('Z'), []);
  });
});

// ─── edges ───────────────────────────────────────────────────────────────────

describe('edges', () => {
  it('returns all edges for undirected graph without duplicates', () => {
    const g = new WeightedGraph();
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 2);
    const e = g.edges();
    assert.equal(e.length, 2);
  });

  it('returns all edges for directed graph', () => {
    const g = new WeightedGraph(true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'A', 2);
    const e = g.edges();
    assert.equal(e.length, 2);
  });
});

// ─── createWeightedGraph factory ─────────────────────────────────────────────

describe('createWeightedGraph', () => {
  it('creates an undirected graph by default', () => {
    const g = createWeightedGraph();
    assert.equal(g.isDirected, false);
    assert.ok(g instanceof WeightedGraph);
  });

  it('creates a directed graph when requested', () => {
    const g = createWeightedGraph(true);
    assert.equal(g.isDirected, true);
  });
});

// ─── numeric vertex type ─────────────────────────────────────────────────────

describe('numeric vertices', () => {
  it('works with number vertices', () => {
    const g = new WeightedGraph(false);
    g.addEdge(1, 2, 10);
    g.addEdge(2, 3, 20);
    assert.equal(g.hasEdge(1, 2), true);
    assert.equal(g.getWeight(2, 3), 20);
    assert.equal(g.vertexCount, 3);
    assert.equal(g.edgeCount, 2);
  });
});
