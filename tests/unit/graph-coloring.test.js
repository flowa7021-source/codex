// ─── Unit Tests: Graph Coloring ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ColoringGraph,
  greedyColoring,
  chromaticNumberUpperBound,
  isValidColoring,
  colorCount,
} from '../../app/modules/graph-coloring.js';

// ─── ColoringGraph basics ────────────────────────────────────────────────────

describe('ColoringGraph – construction', () => {
  it('starts empty', () => {
    const g = new ColoringGraph();
    assert.equal(g.vertexCount, 0);
    assert.equal(g.edgeCount, 0);
    assert.deepEqual(g.vertices(), []);
  });

  it('addVertex creates a vertex with no neighbors', () => {
    const g = new ColoringGraph();
    g.addVertex('a');
    assert.equal(g.vertexCount, 1);
    assert.deepEqual(g.neighbors('a'), []);
  });

  it('addVertex is idempotent', () => {
    const g = new ColoringGraph();
    g.addVertex('a');
    g.addVertex('a');
    assert.equal(g.vertexCount, 1);
  });

  it('addEdge creates both vertices and the edge', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'b');
    assert.equal(g.vertexCount, 2);
    assert.equal(g.edgeCount, 1);
    assert.deepEqual(g.neighbors('a'), ['b']);
    assert.deepEqual(g.neighbors('b'), ['a']);
  });

  it('duplicate edges are ignored', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'b');
    g.addEdge('a', 'b');
    assert.equal(g.edgeCount, 1);
  });

  it('self-loops are ignored', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'a');
    assert.equal(g.edgeCount, 0);
    assert.deepEqual(g.neighbors('a'), []);
  });

  it('neighbors returns empty array for unknown vertex', () => {
    const g = new ColoringGraph();
    assert.deepEqual(g.neighbors('z'), []);
  });
});

// ─── greedyColoring ──────────────────────────────────────────────────────────

describe('greedyColoring', () => {
  it('colors a single vertex with color 0', () => {
    const g = new ColoringGraph();
    g.addVertex('a');
    const c = greedyColoring(g);
    assert.equal(c.get('a'), 0);
  });

  it('colors two adjacent vertices with different colors', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'b');
    const c = greedyColoring(g);
    assert.notEqual(c.get('a'), c.get('b'));
  });

  it('colors a triangle with exactly 3 colors', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('a', 'c');
    const c = greedyColoring(g);
    assert.equal(colorCount(c), 3);
  });

  it('produces a valid coloring for a bipartite graph', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'x');
    g.addEdge('a', 'y');
    g.addEdge('b', 'x');
    g.addEdge('b', 'y');
    const c = greedyColoring(g);
    assert.ok(isValidColoring(g, c));
    assert.ok(colorCount(c) <= 2);
  });

  it('returns empty map for empty graph', () => {
    const g = new ColoringGraph();
    const c = greedyColoring(g);
    assert.equal(c.size, 0);
  });

  it('colors isolated vertices all with 0', () => {
    const g = new ColoringGraph();
    g.addVertex('a');
    g.addVertex('b');
    g.addVertex('c');
    const c = greedyColoring(g);
    assert.equal(c.get('a'), 0);
    assert.equal(c.get('b'), 0);
    assert.equal(c.get('c'), 0);
  });
});

// ─── chromaticNumberUpperBound ───────────────────────────────────────────────

describe('chromaticNumberUpperBound', () => {
  it('returns 0 for an empty graph', () => {
    const g = new ColoringGraph();
    assert.equal(chromaticNumberUpperBound(g), 0);
  });

  it('returns 1 for isolated vertices', () => {
    const g = new ColoringGraph();
    g.addVertex('a');
    g.addVertex('b');
    assert.equal(chromaticNumberUpperBound(g), 1);
  });

  it('returns at most 3 for a triangle', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('a', 'c');
    assert.equal(chromaticNumberUpperBound(g), 3);
  });
});

// ─── isValidColoring ─────────────────────────────────────────────────────────

describe('isValidColoring', () => {
  it('accepts a correct coloring', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'b');
    const c = new Map([['a', 0], ['b', 1]]);
    assert.ok(isValidColoring(g, c));
  });

  it('rejects a coloring where adjacent vertices share a color', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'b');
    const c = new Map([['a', 0], ['b', 0]]);
    assert.equal(isValidColoring(g, c), false);
  });

  it('rejects a coloring with missing vertex', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'b');
    const c = new Map([['a', 0]]);
    assert.equal(isValidColoring(g, c), false);
  });

  it('greedy coloring is always valid', () => {
    const g = new ColoringGraph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('c', 'd');
    g.addEdge('d', 'a');
    g.addEdge('a', 'c');
    const c = greedyColoring(g);
    assert.ok(isValidColoring(g, c));
  });
});

// ─── colorCount ──────────────────────────────────────────────────────────────

describe('colorCount', () => {
  it('counts distinct colors', () => {
    const c = new Map([['a', 0], ['b', 1], ['c', 0], ['d', 2]]);
    assert.equal(colorCount(c), 3);
  });

  it('returns 0 for empty map', () => {
    assert.equal(colorCount(new Map()), 0);
  });
});
