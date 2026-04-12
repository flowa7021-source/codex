// ─── Unit Tests: Graph ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Graph, createGraph, createDirectedGraph } from '../../app/modules/graph.js';

// ─── Node operations ──────────────────────────────────────────────────────────

describe('Graph – node operations', () => {
  it('creates an empty undirected graph by default', () => {
    const g = new Graph();
    assert.equal(g.nodeCount, 0);
    assert.equal(g.edgeCount, 0);
    assert.equal(g.isDirected, false);
    assert.deepEqual(g.nodes(), []);
    assert.deepEqual(g.edges(), []);
  });

  it('creates an empty directed graph when passed true', () => {
    const g = new Graph(true);
    assert.equal(g.nodeCount, 0);
    assert.equal(g.edgeCount, 0);
    assert.equal(g.isDirected, true);
  });

  it('addNode adds a node', () => {
    const g = new Graph();
    g.addNode('A');
    assert.equal(g.nodeCount, 1);
    assert.equal(g.hasNode('A'), true);
    assert.equal(g.hasNode('B'), false);
  });

  it('addNode is idempotent – duplicate add does not increase count', () => {
    const g = new Graph();
    g.addNode('X');
    g.addNode('X');
    assert.equal(g.nodeCount, 1);
  });

  it('addNode stores optional data', () => {
    const g = new Graph();
    g.addNode('A', { label: 'start', value: 42 });
    const node = g.getNode('A');
    assert.ok(node);
    assert.equal(node.id, 'A');
    assert.deepEqual(node.data, { label: 'start', value: 42 });
  });

  it('addNode defaults data to empty object', () => {
    const g = new Graph();
    g.addNode('A');
    const node = g.getNode('A');
    assert.ok(node);
    assert.deepEqual(node.data, {});
  });

  it('getNode returns undefined for unknown id', () => {
    const g = new Graph();
    assert.equal(g.getNode('missing'), undefined);
  });

  it('nodes() returns all node ids in insertion order', () => {
    const g = new Graph();
    g.addNode('Z');
    g.addNode('A');
    g.addNode('M');
    assert.deepEqual(g.nodes(), ['Z', 'A', 'M']);
  });

  it('removeNode returns false for missing node', () => {
    const g = new Graph();
    assert.equal(g.removeNode('X'), false);
  });

  it('removeNode returns true and removes existing node', () => {
    const g = new Graph();
    g.addNode('A');
    assert.equal(g.removeNode('A'), true);
    assert.equal(g.hasNode('A'), false);
    assert.equal(g.nodeCount, 0);
  });

  it('removeNode also removes all incident edges', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 2);
    g.removeNode('B');
    assert.equal(g.hasNode('B'), false);
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('B', 'C'), false);
    assert.equal(g.nodeCount, 2); // A and C remain
  });

  it('removeNode corrects edgeCount (undirected)', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    assert.equal(g.edgeCount, 2);
    g.removeNode('A');
    assert.equal(g.edgeCount, 0);
  });

  it('removeNode corrects edgeCount (directed)', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('C', 'A');
    assert.equal(g.edgeCount, 2);
    g.removeNode('A');
    assert.equal(g.edgeCount, 0);
  });
});

// ─── Edge operations ──────────────────────────────────────────────────────────

describe('Graph – undirected edge operations', () => {
  it('addEdge auto-creates both endpoint nodes', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 5);
    assert.equal(g.hasNode('A'), true);
    assert.equal(g.hasNode('B'), true);
  });

  it('undirected addEdge creates edges in both directions', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 3);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), true);
  });

  it('undirected edgeCount counts each edge once', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 3);
    assert.equal(g.edgeCount, 1);
  });

  it('default edge weight is 1', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    assert.equal(g.getEdgeWeight('A', 'B'), 1);
  });

  it('getEdgeWeight returns the correct weight', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 7);
    assert.equal(g.getEdgeWeight('A', 'B'), 7);
    assert.equal(g.getEdgeWeight('B', 'A'), 7);
  });

  it('getEdgeWeight returns undefined for missing edge', () => {
    const g = new Graph();
    g.addNode('A');
    assert.equal(g.getEdgeWeight('A', 'B'), undefined);
  });

  it('removeEdge removes edge in both directions', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 7);
    assert.equal(g.removeEdge('A', 'B'), true);
    assert.equal(g.hasEdge('A', 'B'), false);
    assert.equal(g.hasEdge('B', 'A'), false);
    assert.equal(g.edgeCount, 0);
  });

  it('removeEdge returns false for missing edge', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    assert.equal(g.removeEdge('A', 'B'), false);
  });

  it('edges() returns one entry per logical undirected edge', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 2);
    g.addEdge('B', 'C', 3);
    const es = g.edges();
    assert.equal(es.length, 2);
    // Entries should have from, to, weight
    assert.ok(es.every((e) => 'from' in e && 'to' in e && 'weight' in e));
  });

  it('duplicate addEdge updates weight without adding duplicate', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 1);
    g.addEdge('A', 'B', 9);
    assert.equal(g.edgeCount, 1);
    assert.equal(g.getEdgeWeight('A', 'B'), 9);
  });
});

describe('Graph – directed edge operations', () => {
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
    assert.equal(g.edgeCount, 1);
  });

  it('edges() returns all directed edges', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 2);
    g.addEdge('B', 'A', 3);
    const es = g.edges();
    assert.equal(es.length, 2);
  });
});

describe('Graph – neighbors', () => {
  it('neighbors returns adjacent node ids', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 10);
    g.addEdge('A', 'C', 20);
    const ns = g.neighbors('A');
    assert.equal(ns.length, 2);
    assert.ok(ns.includes('B'));
    assert.ok(ns.includes('C'));
  });

  it('neighbors returns [] for node with no outgoing edges', () => {
    const g = new Graph(true);
    g.addNode('A');
    assert.deepEqual(g.neighbors('A'), []);
  });

  it('neighbors returns [] for unknown node', () => {
    const g = new Graph();
    assert.deepEqual(g.neighbors('X'), []);
  });
});

// ─── BFS traversal ────────────────────────────────────────────────────────────

describe('Graph – BFS', () => {
  it('bfs on isolated node returns just that node', () => {
    const g = new Graph();
    g.addNode('A');
    assert.deepEqual(g.bfs('A'), ['A']);
  });

  it('bfs throws for unknown start node', () => {
    const g = new Graph();
    assert.throws(() => g.bfs('X'), /bfs/);
  });

  it('bfs visits nodes in breadth-first order (directed)', () => {
    const g = new Graph(true);
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

  it('bfs does not visit unreachable nodes', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addNode('C'); // isolated
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

  it('bfs works on undirected graph', () => {
    const g = new Graph();
    g.addEdge('1', '2');
    g.addEdge('1', '3');
    g.addEdge('2', '4');
    const order = g.bfs('1');
    assert.equal(order[0], '1');
    assert.equal(order.length, 4);
  });
});

// ─── DFS traversal ────────────────────────────────────────────────────────────

describe('Graph – DFS', () => {
  it('dfs on isolated node returns just that node', () => {
    const g = new Graph();
    g.addNode('A');
    assert.deepEqual(g.dfs('A'), ['A']);
  });

  it('dfs throws for unknown start node', () => {
    const g = new Graph();
    assert.throws(() => g.dfs('X'), /dfs/);
  });

  it('dfs visits all reachable nodes', () => {
    const g = new Graph(true);
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

  it('dfs does not visit unreachable nodes', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addNode('C');
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

  it('dfs start node is always first', () => {
    const g = new Graph(true);
    g.addEdge('X', 'Y');
    g.addEdge('Y', 'Z');
    const order = g.dfs('X');
    assert.equal(order[0], 'X');
  });
});

// ─── Dijkstra shortest path ───────────────────────────────────────────────────

describe('Graph – Dijkstra', () => {
  it('throws for unknown start node', () => {
    const g = new Graph();
    assert.throws(() => g.dijkstra('X'), /dijkstra/);
  });

  it('distance from start to itself is 0', () => {
    const g = new Graph(true);
    g.addNode('A');
    const dist = g.dijkstra('A');
    assert.equal(dist.get('A'), 0);
  });

  it('finds shortest path in a directed graph', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 2);
    g.addEdge('A', 'C', 10);
    const dist = g.dijkstra('A');
    assert.equal(dist.get('A'), 0);
    assert.equal(dist.get('B'), 1);
    assert.equal(dist.get('C'), 3); // A→B→C = 3, not A→C = 10
  });

  it('disconnected nodes have distance Infinity', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 1);
    g.addNode('C'); // isolated
    const dist = g.dijkstra('A');
    assert.equal(dist.get('C'), Infinity);
  });

  it('finds shortest path in an undirected graph', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 4);
    g.addEdge('A', 'C', 1);
    g.addEdge('C', 'B', 2);
    const dist = g.dijkstra('A');
    assert.equal(dist.get('B'), 3); // A→C→B = 3
    assert.equal(dist.get('C'), 1);
  });

  it('returns a Map with entries for every node', () => {
    const g = new Graph(true);
    g.addEdge('X', 'Y', 5);
    g.addNode('Z');
    const dist = g.dijkstra('X');
    assert.ok(dist.has('X'));
    assert.ok(dist.has('Y'));
    assert.ok(dist.has('Z'));
  });

  it('handles a chain of nodes correctly', () => {
    const g = new Graph(true);
    g.addEdge('1', '2', 1);
    g.addEdge('2', '3', 1);
    g.addEdge('3', '4', 1);
    const dist = g.dijkstra('1');
    assert.equal(dist.get('4'), 3);
  });
});

// ─── Cycle detection ──────────────────────────────────────────────────────────

describe('Graph – hasCycle', () => {
  it('empty directed graph has no cycle', () => {
    assert.equal(new Graph(true).hasCycle(), false);
  });

  it('empty undirected graph has no cycle', () => {
    assert.equal(new Graph().hasCycle(), false);
  });

  it('directed: DAG A→B→C has no cycle', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    assert.equal(g.hasCycle(), false);
  });

  it('directed: A→B→A is a cycle', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('directed: A→B→C→A is a cycle', () => {
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

  it('undirected: tree has no cycle', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    assert.equal(g.hasCycle(), false);
  });

  it('undirected: triangle A-B-C-A is a cycle', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('directed: isolated nodes have no cycle', () => {
    const g = new Graph(true);
    g.addNode('A');
    g.addNode('B');
    assert.equal(g.hasCycle(), false);
  });
});

// ─── Topological sort ─────────────────────────────────────────────────────────

describe('Graph – topologicalSort', () => {
  it('empty directed graph returns empty array', () => {
    const g = new Graph(true);
    assert.deepEqual(g.topologicalSort(), []);
  });

  it('single node returns that node', () => {
    const g = new Graph(true);
    g.addNode('X');
    assert.deepEqual(g.topologicalSort(), ['X']);
  });

  it('valid DAG: A→C, B→C, C→D respects dependencies', () => {
    const g = new Graph(true);
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
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(g.topologicalSort(), null);
  });

  it('returns null for directed graph with self-loop', () => {
    const g = new Graph(true);
    g.addEdge('A', 'A');
    assert.equal(g.topologicalSort(), null);
  });

  it('chain 1→2→3→4→5 is sorted correctly', () => {
    const g = new Graph(true);
    for (let i = 1; i < 5; i++) g.addEdge(String(i), String(i + 1));
    const order = g.topologicalSort();
    assert.ok(order !== null);
    assert.equal(order.length, 5);
    for (let i = 1; i < 5; i++) {
      assert.ok(order.indexOf(String(i)) < order.indexOf(String(i + 1)));
    }
  });

  it('undirected graph with edges returns null', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    assert.equal(g.topologicalSort(), null);
  });

  it('undirected graph with no edges returns node list', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    const order = g.topologicalSort();
    assert.ok(order !== null);
    assert.equal(order.length, 2);
  });
});

// ─── Connected components ─────────────────────────────────────────────────────

describe('Graph – connectedComponents', () => {
  it('empty graph has zero components', () => {
    const g = new Graph();
    assert.deepEqual(g.connectedComponents(), []);
  });

  it('three isolated nodes yield three components', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    g.addNode('C');
    const comps = g.connectedComponents();
    assert.equal(comps.length, 3);
    for (const c of comps) assert.equal(c.length, 1);
  });

  it('fully connected graph is one component', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');
    const comps = g.connectedComponents();
    assert.equal(comps.length, 1);
    assert.equal(comps[0].length, 4);
  });

  it('two separate subgraphs yield two components', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('C', 'D');
    const comps = g.connectedComponents();
    assert.equal(comps.length, 2);
    const sizes = comps.map((c) => c.length).sort();
    assert.deepEqual(sizes, [2, 2]);
  });

  it('all nodes appear exactly once across all components', () => {
    const g = new Graph();
    g.addEdge('X', 'Y');
    g.addNode('Z');
    const comps = g.connectedComponents();
    assert.equal(comps.length, 2);
    const flat = comps.flat().sort();
    assert.deepEqual(flat, ['X', 'Y', 'Z']);
  });

  it('directed graph uses weak connectivity (treats edges as undirected)', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addNode('D');
    const comps = g.connectedComponents();
    // A, B, C in one component; D isolated
    assert.equal(comps.length, 2);
    const large = comps.find((c) => c.length === 3);
    assert.ok(large);
  });
});

// ─── Factory functions ────────────────────────────────────────────────────────

describe('createGraph factory', () => {
  it('creates an undirected graph by default', () => {
    const g = createGraph();
    assert.equal(g.isDirected, false);
    assert.ok(g instanceof Graph);
  });

  it('creates a directed graph when passed true', () => {
    const g = createGraph(true);
    assert.equal(g.isDirected, true);
  });

  it('returned graph is fully functional', () => {
    const g = createGraph();
    g.addEdge('A', 'B', 5);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.getEdgeWeight('A', 'B'), 5);
  });
});

describe('createDirectedGraph factory', () => {
  it('creates a directed graph', () => {
    const g = createDirectedGraph();
    assert.equal(g.isDirected, true);
    assert.ok(g instanceof Graph);
  });

  it('returned directed graph only creates one-way edges', () => {
    const g = createDirectedGraph();
    g.addEdge('X', 'Y');
    assert.equal(g.hasEdge('X', 'Y'), true);
    assert.equal(g.hasEdge('Y', 'X'), false);
  });

  it('topological sort works on returned graph', () => {
    const g = createDirectedGraph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    const order = g.topologicalSort();
    assert.ok(order !== null);
    assert.deepEqual(order, ['A', 'B', 'C']);
  });
});
