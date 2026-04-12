// ─── Unit Tests: Graph ────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Graph, createGraph } from '../../app/modules/graph.js';

// ─── constructor / basic shape ────────────────────────────────────────────────

describe('Graph – constructor', () => {
  it('creates an empty undirected graph by default', () => {
    const g = new Graph();
    assert.equal(g.vertexCount, 0);
    assert.equal(g.edgeCount, 0);
    assert.deepEqual(g.vertices(), []);
    assert.deepEqual(g.edges(), []);
  });

  it('creates an empty directed graph via options', () => {
    const g = new Graph({ directed: true });
    assert.equal(g.vertexCount, 0);
    assert.equal(g.edgeCount, 0);
  });

  it('undirected graph: adding one edge in both directions keeps edge count at 1', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    assert.equal(g.edgeCount, 1);
  });

  it('directed graph: adding one edge keeps edge count at 1', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    assert.equal(g.edgeCount, 1);
  });
});

// ─── addVertex ────────────────────────────────────────────────────────────────

describe('Graph – addVertex', () => {
  it('adds a vertex and increments vertexCount', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.equal(g.vertexCount, 1);
    assert.equal(g.hasVertex('A'), true);
  });

  it('adding the same vertex twice is idempotent', () => {
    const g = new Graph();
    g.addVertex('X');
    g.addVertex('X');
    assert.equal(g.vertexCount, 1);
  });

  it('stores optional data on the vertex (not required by API but silently accepted)', () => {
    const g = new Graph();
    g.addVertex('A', 'payload');
    assert.equal(g.hasVertex('A'), true);
  });

  it('vertices() returns all vertex IDs in insertion order', () => {
    const g = new Graph();
    g.addVertex('Z');
    g.addVertex('A');
    g.addVertex('M');
    assert.deepEqual(g.vertices(), ['Z', 'A', 'M']);
  });

  it('hasVertex returns false for unknown id', () => {
    const g = new Graph();
    assert.equal(g.hasVertex('missing'), false);
  });
});

// ─── removeVertex ─────────────────────────────────────────────────────────────

describe('Graph – removeVertex', () => {
  it('returns false for missing vertex', () => {
    const g = new Graph();
    assert.equal(g.removeVertex('X'), false);
  });

  it('returns true and decrements vertexCount', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.equal(g.removeVertex('A'), true);
    assert.equal(g.vertexCount, 0);
    assert.equal(g.hasVertex('A'), false);
  });

  it('removing a vertex removes its outgoing edges (directed)', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.removeVertex('A');
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('A', 'C'), false);
  });

  it('removing a vertex removes incoming edges (directed)', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('C', 'B');
    g.removeVertex('B');
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('C', 'B'), false);
  });

  it('removing a vertex updates edgeCount (undirected)', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    assert.equal(g.edgeCount, 2);
    g.removeVertex('A');
    assert.equal(g.edgeCount, 0);
  });

  it('removing a vertex updates edgeCount (directed)', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('C', 'A');
    assert.equal(g.edgeCount, 2);
    g.removeVertex('A');
    assert.equal(g.edgeCount, 0);
  });

  it('remaining vertices are unaffected', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.removeVertex('A');
    assert.equal(g.hasVertex('B'), true);
    assert.equal(g.hasVertex('C'), true);
    assert.equal(g.hasEdge('B', 'C'), true);
  });
});

// ─── addEdge / removeEdge ─────────────────────────────────────────────────────

describe('Graph – addEdge (undirected)', () => {
  it('auto-creates missing endpoint vertices', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 5);
    assert.equal(g.hasVertex('A'), true);
    assert.equal(g.hasVertex('B'), true);
  });

  it('creates symmetric edges in undirected mode', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 3);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), true);
  });

  it('edgeCount counts each undirected edge once', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    assert.equal(g.edgeCount, 1);
  });

  it('default weight is 1', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    assert.equal(g.getWeight('A', 'B'), 1);
    assert.equal(g.getWeight('B', 'A'), 1);
  });

  it('weight is stored correctly in both directions (undirected)', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 7);
    assert.equal(g.getWeight('A', 'B'), 7);
    assert.equal(g.getWeight('B', 'A'), 7);
  });

  it('re-adding an existing edge updates weight without changing edgeCount', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 1);
    g.addEdge('A', 'B', 9);
    assert.equal(g.edgeCount, 1);
    assert.equal(g.getWeight('A', 'B'), 9);
  });

  it('multiple edges from the same vertex each counted once', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'C');
    assert.equal(g.edgeCount, 3);
  });
});

describe('Graph – addEdge (directed)', () => {
  it('only creates edge in specified direction', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B', 4);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), false);
    assert.equal(g.edgeCount, 1);
  });

  it('two directed edges A→B and B→A are both stored', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'A', 2);
    assert.equal(g.edgeCount, 2);
    assert.equal(g.getWeight('A', 'B'), 1);
    assert.equal(g.getWeight('B', 'A'), 2);
  });
});

describe('Graph – removeEdge', () => {
  it('returns false for nonexistent edge', () => {
    const g = new Graph();
    g.addVertex('A');
    g.addVertex('B');
    assert.equal(g.removeEdge('A', 'B'), false);
  });

  it('returns true and removes undirected edge in both directions', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 7);
    assert.equal(g.removeEdge('A', 'B'), true);
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('B', 'A'), false);
    assert.equal(g.edgeCount, 0);
  });

  it('directed: only removes the specified direction', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'A', 1);
    g.removeEdge('A', 'B');
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('B', 'A'), true);
    assert.equal(g.edgeCount, 1);
  });
});

// ─── hasEdge / getWeight / getNeighbors ───────────────────────────────────────

describe('Graph – hasEdge / getWeight / getNeighbors', () => {
  it('hasEdge returns false when from vertex missing', () => {
    const g = new Graph();
    assert.equal(g.hasEdge('X', 'Y'), false);
  });

  it('getWeight returns undefined for missing edge', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.equal(g.getWeight('A', 'B'), undefined);
  });

  it('getNeighbors returns adjacent vertex ids', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B', 10);
    g.addEdge('A', 'C', 20);
    const ns = g.getNeighbors('A');
    assert.equal(ns.length, 2);
    assert.ok(ns.includes('B'));
    assert.ok(ns.includes('C'));
  });

  it('getNeighbors returns empty array for vertex with no edges', () => {
    const g = new Graph({ directed: true });
    g.addVertex('A');
    assert.deepEqual(g.getNeighbors('A'), []);
  });

  it('getNeighbors returns empty array for unknown vertex', () => {
    const g = new Graph();
    assert.deepEqual(g.getNeighbors('X'), []);
  });
});

// ─── vertices / edges ─────────────────────────────────────────────────────────

describe('Graph – vertices() and edges()', () => {
  it('edges() returns one entry per logical undirected edge', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 2);
    g.addEdge('B', 'C', 3);
    const es = g.edges();
    assert.equal(es.length, 2);
    assert.ok(es.every((e) => 'from' in e && 'to' in e && 'weight' in e));
  });

  it('edges() returns all directed edges without deduplication', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B', 2);
    g.addEdge('B', 'A', 3);
    const es = g.edges();
    assert.equal(es.length, 2);
  });

  it('vertices() reflects additions and removals', () => {
    const g = new Graph();
    g.addVertex('X');
    g.addVertex('Y');
    g.removeVertex('X');
    assert.deepEqual(g.vertices(), ['Y']);
  });
});

// ─── BFS traversal ────────────────────────────────────────────────────────────

describe('Graph – BFS', () => {
  it('bfs on isolated vertex returns just that vertex', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.deepEqual(g.bfs('A'), ['A']);
  });

  it('bfs returns empty array for unknown start vertex', () => {
    const g = new Graph();
    assert.deepEqual(g.bfs('X'), []);
  });

  it('bfs visits vertices in breadth-first order (directed)', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('C', 'D');
    const order = g.bfs('A');
    assert.equal(order[0], 'A');
    assert.ok(order.indexOf('B') < order.indexOf('D'));
    assert.ok(order.indexOf('C') < order.indexOf('D'));
    assert.equal(order.length, 4);
  });

  it('bfs does not visit unreachable vertices', () => {
    const g = new Graph({ directed: true });
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
    assert.ok(order.includes('A') && order.includes('B') && order.includes('C'));
  });

  it('bfs start vertex is always first', () => {
    const g = new Graph();
    g.addEdge('X', 'Y');
    g.addEdge('Y', 'Z');
    assert.equal(g.bfs('X')[0], 'X');
  });
});

// ─── DFS traversal ────────────────────────────────────────────────────────────

describe('Graph – DFS', () => {
  it('dfs on isolated vertex returns just that vertex', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.deepEqual(g.dfs('A'), ['A']);
  });

  it('dfs returns empty array for unknown start vertex', () => {
    const g = new Graph();
    assert.deepEqual(g.dfs('X'), []);
  });

  it('dfs visits all reachable vertices', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    const order = g.dfs('A');
    assert.equal(order.length, 4);
    assert.equal(order[0], 'A');
    for (const v of ['A', 'B', 'C', 'D']) {
      assert.ok(order.includes(v), `missing ${v}`);
    }
  });

  it('dfs does not visit unreachable vertices', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addVertex('C');
    const order = g.dfs('A');
    assert.ok(order.includes('A'));
    assert.ok(order.includes('B'));
    assert.ok(!order.includes('C'));
  });

  it('dfs handles cycles without infinite loop', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    const order = g.dfs('A');
    assert.equal(order.length, 3);
  });

  it('dfs start vertex is always first', () => {
    const g = new Graph({ directed: true });
    g.addEdge('X', 'Y');
    g.addEdge('Y', 'Z');
    const order = g.dfs('X');
    assert.equal(order[0], 'X');
  });
});

// ─── hasCycle ─────────────────────────────────────────────────────────────────

describe('Graph – hasCycle', () => {
  it('empty directed graph has no cycle', () => {
    assert.equal(new Graph({ directed: true }).hasCycle(), false);
  });

  it('empty undirected graph has no cycle', () => {
    assert.equal(new Graph().hasCycle(), false);
  });

  it('directed DAG A→B→C has no cycle', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    assert.equal(g.hasCycle(), false);
  });

  it('directed A→B→A is a cycle', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('B', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('directed A→B→C→A is a cycle', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('directed self-loop is a cycle', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('undirected tree has no cycle', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    assert.equal(g.hasCycle(), false);
  });

  it('undirected triangle A-B-C-A is a cycle', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('isolated vertices have no cycle', () => {
    const g = new Graph({ directed: true });
    g.addVertex('A');
    g.addVertex('B');
    assert.equal(g.hasCycle(), false);
  });
});

// ─── isConnected ──────────────────────────────────────────────────────────────

describe('Graph – isConnected', () => {
  it('empty graph is connected (vacuously)', () => {
    assert.equal(new Graph().isConnected(), true);
  });

  it('single isolated vertex is connected', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.equal(g.isConnected(), true);
  });

  it('fully connected graph is connected', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');
    assert.equal(g.isConnected(), true);
  });

  it('two isolated vertices are not connected', () => {
    const g = new Graph();
    g.addVertex('A');
    g.addVertex('B');
    assert.equal(g.isConnected(), false);
  });

  it('two separate subgraphs are not connected', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('C', 'D');
    assert.equal(g.isConnected(), false);
  });

  it('directed graph: weakly connected is reported as connected', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    assert.equal(g.isConnected(), true);
  });

  it('directed graph: disconnected components are not connected', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addVertex('C');
    assert.equal(g.isConnected(), false);
  });
});

// ─── shortestPath ─────────────────────────────────────────────────────────────

describe('Graph – shortestPath', () => {
  it('returns null when start vertex is missing', () => {
    const g = new Graph();
    assert.equal(g.shortestPath('X', 'Y'), null);
  });

  it('returns null when end vertex is missing', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.equal(g.shortestPath('A', 'Z'), null);
  });

  it('returns [from] when from === to', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.deepEqual(g.shortestPath('A', 'A'), ['A']);
  });

  it('finds shortest path in directed graph', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 2);
    g.addEdge('A', 'C', 10);
    const path = g.shortestPath('A', 'C');
    assert.deepEqual(path, ['A', 'B', 'C']);
  });

  it('finds shortest path in undirected graph', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 4);
    g.addEdge('A', 'C', 1);
    g.addEdge('C', 'B', 2);
    const path = g.shortestPath('A', 'B');
    assert.deepEqual(path, ['A', 'C', 'B']);
  });

  it('returns null when target is unreachable', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B', 1);
    g.addVertex('C');
    assert.equal(g.shortestPath('A', 'C'), null);
  });

  it('handles a chain of vertices', () => {
    const g = new Graph({ directed: true });
    g.addEdge('1', '2', 1);
    g.addEdge('2', '3', 1);
    g.addEdge('3', '4', 1);
    const path = g.shortestPath('1', '4');
    assert.deepEqual(path, ['1', '2', '3', '4']);
  });

  it('direct edge preferred over longer detour', () => {
    const g = new Graph({ directed: true });
    g.addEdge('S', 'T', 1);
    g.addEdge('S', 'M', 0.3);
    g.addEdge('M', 'T', 0.3);
    const path = g.shortestPath('S', 'T');
    assert.deepEqual(path, ['S', 'M', 'T']);
  });

  it('path includes all intermediate vertices in order', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 1);
    g.addEdge('C', 'D', 1);
    const path = g.shortestPath('A', 'D');
    assert.ok(path !== null);
    assert.equal(path[0], 'A');
    assert.equal(path[path.length - 1], 'D');
    assert.equal(path.length, 4);
  });
});

// ─── topologicalSort ──────────────────────────────────────────────────────────

describe('Graph – topologicalSort', () => {
  it('returns null for undirected graph', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    assert.equal(g.topologicalSort(), null);
  });

  it('returns null for undirected graph even with no edges', () => {
    const g = new Graph();
    g.addVertex('A');
    assert.equal(g.topologicalSort(), null);
  });

  it('empty directed graph returns empty array', () => {
    const g = new Graph({ directed: true });
    assert.deepEqual(g.topologicalSort(), []);
  });

  it('single vertex returns that vertex', () => {
    const g = new Graph({ directed: true });
    g.addVertex('X');
    assert.deepEqual(g.topologicalSort(), ['X']);
  });

  it('DAG A→C, B→C, C→D respects all dependencies', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'C');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');
    const order = g.topologicalSort();
    assert.ok(order !== null);
    assert.ok(order.indexOf('A') < order.indexOf('C'));
    assert.ok(order.indexOf('B') < order.indexOf('C'));
    assert.ok(order.indexOf('C') < order.indexOf('D'));
  });

  it('returns null for cyclic directed graph', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(g.topologicalSort(), null);
  });

  it('returns null for directed graph with self-loop', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'A');
    assert.equal(g.topologicalSort(), null);
  });

  it('linear chain is sorted correctly', () => {
    const g = new Graph({ directed: true });
    for (let i = 1; i < 5; i++) g.addEdge(String(i), String(i + 1));
    const order = g.topologicalSort();
    assert.ok(order !== null);
    assert.equal(order.length, 5);
    for (let i = 1; i < 5; i++) {
      assert.ok(order.indexOf(String(i)) < order.indexOf(String(i + 1)));
    }
  });

  it('result contains all vertices exactly once', () => {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addVertex('D'); // isolated
    const order = g.topologicalSort();
    assert.ok(order !== null);
    assert.equal(order.length, 4);
    assert.equal(new Set(order).size, 4);
  });
});

// ─── createGraph factory ──────────────────────────────────────────────────────

describe('createGraph factory', () => {
  it('returns a Graph instance (undirected by default)', () => {
    const g = createGraph();
    assert.ok(g instanceof Graph);
  });

  it('returned undirected graph creates symmetric edges', () => {
    const g = createGraph();
    g.addEdge('A', 'B', 5);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), true);
    assert.equal(g.getWeight('A', 'B'), 5);
  });

  it('directed option creates a directed graph', () => {
    const g = createGraph({ directed: true });
    g.addEdge('X', 'Y');
    assert.equal(g.hasEdge('X', 'Y'), true);
    assert.equal(g.hasEdge('Y', 'X'), false);
  });

  it('topological sort works on directed factory graph', () => {
    const g = createGraph({ directed: true });
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    const order = g.topologicalSort();
    assert.ok(order !== null);
    assert.ok(order.indexOf('A') < order.indexOf('B'));
    assert.ok(order.indexOf('B') < order.indexOf('C'));
  });

  it('all Graph methods are accessible on factory result', () => {
    const g = createGraph();
    g.addVertex('V1');
    g.addEdge('V1', 'V2');
    assert.equal(g.vertexCount, 2);
    assert.equal(g.edgeCount, 1);
    assert.equal(g.hasVertex('V1'), true);
    assert.equal(g.hasEdge('V1', 'V2'), true);
    assert.deepEqual(g.bfs('V1'), ['V1', 'V2']);
    assert.deepEqual(g.dfs('V1'), ['V1', 'V2']);
    assert.equal(g.hasCycle(), false);
    assert.equal(g.isConnected(), true);
    assert.deepEqual(g.shortestPath('V1', 'V2'), ['V1', 'V2']);
  });
});

// ─── Generic type parameter (runtime smoke test) ──────────────────────────────

describe('Graph – generic data (runtime smoke)', () => {
  it('addVertex accepts typed data without error', () => {
    const g = new Graph();
    g.addVertex('a', { value: 42 });
    g.addVertex('b', { value: 99 });
    assert.equal(g.vertexCount, 2);
  });

  it('vertexCount and edgeCount stay consistent through multiple ops', () => {
    const g = new Graph({ directed: true });
    g.addEdge('1', '2');
    g.addEdge('2', '3');
    g.addEdge('3', '1');
    assert.equal(g.vertexCount, 3);
    assert.equal(g.edgeCount, 3);
    g.removeEdge('3', '1');
    assert.equal(g.edgeCount, 2);
    g.removeVertex('2');
    assert.equal(g.vertexCount, 2);
    // After removing vertex 2: outgoing edge 2→3 removed (edgeCount 2→1),
    // then incoming edge 1→2 removed (edgeCount 1→0). Only vertices 1 and 3 remain with no edges.
    assert.equal(g.edgeCount, 0);
  });
});
