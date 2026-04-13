// ─── Unit Tests: TopologicalSort ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TopologicalSort, createTopologicalSort } from '../../app/modules/topological-sort.js';

describe('TopologicalSort – addNode / nodeCount', () => {
  it('starts with zero nodes', () => {
    const ts = new TopologicalSort();
    assert.equal(ts.nodeCount, 0);
    assert.equal(ts.edgeCount, 0);
  });

  it('tracks added nodes', () => {
    const ts = new TopologicalSort();
    ts.addNode('a');
    ts.addNode('b');
    assert.equal(ts.nodeCount, 2);
  });

  it('ignores duplicate addNode calls', () => {
    const ts = new TopologicalSort();
    ts.addNode('x');
    ts.addNode('x');
    assert.equal(ts.nodeCount, 1);
  });
});

describe('TopologicalSort – addEdge / edgeCount', () => {
  it('adds edges and auto-creates nodes', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'b');
    assert.equal(ts.nodeCount, 2);
    assert.equal(ts.edgeCount, 1);
  });

  it('ignores duplicate edges', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'b');
    ts.addEdge('a', 'b');
    assert.equal(ts.edgeCount, 1);
  });

  it('throws on self-loops', () => {
    const ts = new TopologicalSort();
    assert.throws(() => ts.addEdge('a', 'a'), { message: /self-loop/i });
  });
});

describe('TopologicalSort – sort (Kahn\'s algorithm)', () => {
  it('returns empty array for empty graph', () => {
    const ts = new TopologicalSort();
    assert.deepEqual(ts.sort(), []);
  });

  it('returns single node', () => {
    const ts = new TopologicalSort();
    ts.addNode('a');
    assert.deepEqual(ts.sort(), ['a']);
  });

  it('returns valid topological ordering for a linear chain', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'b');
    ts.addEdge('b', 'c');
    ts.addEdge('c', 'd');
    const result = ts.sort();
    assert.deepEqual(result, ['a', 'b', 'c', 'd']);
  });

  it('returns valid ordering for a diamond DAG', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'b');
    ts.addEdge('a', 'c');
    ts.addEdge('b', 'd');
    ts.addEdge('c', 'd');
    const result = ts.sort();
    // 'a' must come first, 'd' must come last
    assert.equal(result[0], 'a');
    assert.equal(result[result.length - 1], 'd');
    assert.equal(result.indexOf('a') < result.indexOf('b'), true);
    assert.equal(result.indexOf('a') < result.indexOf('c'), true);
  });

  it('throws when graph has a cycle', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'b');
    ts.addEdge('b', 'c');
    ts.addEdge('c', 'a');
    assert.throws(() => ts.sort(), { message: /cycle/i });
  });
});

describe('TopologicalSort – hasCycle', () => {
  it('returns false for acyclic graph', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'b');
    ts.addEdge('b', 'c');
    assert.equal(ts.hasCycle(), false);
  });

  it('returns true for cyclic graph', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'b');
    ts.addEdge('b', 'a');
    assert.equal(ts.hasCycle(), true);
  });
});

describe('TopologicalSort – dependenciesOf / dependentsOf', () => {
  it('returns direct dependencies (predecessors)', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'c');
    ts.addEdge('b', 'c');
    const deps = ts.dependenciesOf('c');
    assert.deepEqual(deps.sort(), ['a', 'b']);
  });

  it('returns direct dependents (successors)', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'b');
    ts.addEdge('a', 'c');
    const dependents = ts.dependentsOf('a');
    assert.deepEqual(dependents.sort(), ['b', 'c']);
  });

  it('returns empty array when no dependencies', () => {
    const ts = new TopologicalSort();
    ts.addNode('lonely');
    assert.deepEqual(ts.dependenciesOf('lonely'), []);
    assert.deepEqual(ts.dependentsOf('lonely'), []);
  });

  it('throws for unknown node', () => {
    const ts = new TopologicalSort();
    assert.throws(() => ts.dependenciesOf('missing'), { message: /not found/i });
    assert.throws(() => ts.dependentsOf('missing'), { message: /not found/i });
  });
});

describe('TopologicalSort – layers', () => {
  it('returns empty layers for empty graph', () => {
    const ts = new TopologicalSort();
    assert.deepEqual(ts.layers(), []);
  });

  it('places independent nodes in the same layer', () => {
    const ts = new TopologicalSort();
    ts.addNode('a');
    ts.addNode('b');
    ts.addNode('c');
    const result = ts.layers();
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].sort(), ['a', 'b', 'c']);
  });

  it('produces correct layers for a multi-level DAG', () => {
    const ts = new TopologicalSort();
    // Layer 0: a, b
    // Layer 1: c (depends on a, b)
    // Layer 2: d (depends on c)
    ts.addEdge('a', 'c');
    ts.addEdge('b', 'c');
    ts.addEdge('c', 'd');
    const result = ts.layers();
    assert.equal(result.length, 3);
    assert.deepEqual(result[0].sort(), ['a', 'b']);
    assert.deepEqual(result[1], ['c']);
    assert.deepEqual(result[2], ['d']);
  });

  it('throws on cycle', () => {
    const ts = new TopologicalSort();
    ts.addEdge('a', 'b');
    ts.addEdge('b', 'a');
    assert.throws(() => ts.layers(), { message: /cycle/i });
  });
});

describe('TopologicalSort – createTopologicalSort factory', () => {
  it('creates a functional TopologicalSort instance', () => {
    const ts = createTopologicalSort();
    ts.addEdge(1, 2);
    ts.addEdge(2, 3);
    assert.deepEqual(ts.sort(), [1, 2, 3]);
    assert.equal(ts.nodeCount, 3);
    assert.equal(ts.edgeCount, 2);
  });
});
