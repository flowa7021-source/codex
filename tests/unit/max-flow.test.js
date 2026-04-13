// ─── Unit Tests: Max Flow ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FlowNetwork,
  edmondsKarp,
  minCut,
} from '../../app/modules/max-flow.js';

// ─── FlowNetwork basics ─────────────────────────────────────────────────────

describe('FlowNetwork – construction', () => {
  it('starts empty', () => {
    const n = new FlowNetwork();
    assert.equal(n.vertexCount, 0);
    assert.deepEqual(n.vertices(), []);
  });

  it('addVertex creates a vertex', () => {
    const n = new FlowNetwork();
    n.addVertex('s');
    assert.equal(n.vertexCount, 1);
  });

  it('addEdge creates both vertices', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 't', 10);
    assert.equal(n.vertexCount, 2);
  });

  it('addVertex is idempotent', () => {
    const n = new FlowNetwork();
    n.addVertex('s');
    n.addVertex('s');
    assert.equal(n.vertexCount, 1);
  });
});

// ─── edmondsKarp ─────────────────────────────────────────────────────────────

describe('edmondsKarp', () => {
  it('single edge: max flow equals edge capacity', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 't', 5);
    const { maxFlow } = edmondsKarp(n, 's', 't');
    assert.equal(maxFlow, 5);
  });

  it('two parallel paths', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 'a', 3);
    n.addEdge('s', 'b', 2);
    n.addEdge('a', 't', 3);
    n.addEdge('b', 't', 2);
    const { maxFlow } = edmondsKarp(n, 's', 't');
    assert.equal(maxFlow, 5);
  });

  it('bottleneck in the middle', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 'a', 10);
    n.addEdge('a', 't', 1);
    const { maxFlow } = edmondsKarp(n, 's', 't');
    assert.equal(maxFlow, 1);
  });

  it('classic diamond network', () => {
    // s→a(10), s→b(10), a→b(1), a→t(10), b→t(10)
    const n = new FlowNetwork();
    n.addEdge('s', 'a', 10);
    n.addEdge('s', 'b', 10);
    n.addEdge('a', 'b', 1);
    n.addEdge('a', 't', 10);
    n.addEdge('b', 't', 10);
    const { maxFlow } = edmondsKarp(n, 's', 't');
    assert.equal(maxFlow, 20);
  });

  it('no path from source to sink yields 0', () => {
    const n = new FlowNetwork();
    n.addVertex('s');
    n.addVertex('t');
    const { maxFlow } = edmondsKarp(n, 's', 't');
    assert.equal(maxFlow, 0);
  });

  it('flow map entries are non-negative', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 'a', 4);
    n.addEdge('a', 't', 3);
    const { flow } = edmondsKarp(n, 's', 't');
    for (const [, neighbors] of flow) {
      for (const [, f] of neighbors) {
        assert.ok(f >= 0);
      }
    }
  });

  it('flow conservation at intermediate vertices', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 'a', 5);
    n.addEdge('s', 'b', 5);
    n.addEdge('a', 'c', 3);
    n.addEdge('b', 'c', 4);
    n.addEdge('c', 't', 6);
    const { flow } = edmondsKarp(n, 's', 't');

    // For vertex 'c': inflow = outflow
    const inflow = (flow.get('a')?.get('c') ?? 0) + (flow.get('b')?.get('c') ?? 0);
    const outflow = flow.get('c')?.get('t') ?? 0;
    assert.equal(inflow, outflow);
  });

  it('complex 6-vertex network', () => {
    // Classic CLRS example-style network
    const n = new FlowNetwork();
    n.addEdge('s', 'a', 16);
    n.addEdge('s', 'b', 13);
    n.addEdge('a', 'b', 4);
    n.addEdge('a', 'c', 12);
    n.addEdge('b', 'a', 10);
    n.addEdge('b', 'd', 14);
    n.addEdge('c', 'b', 9);
    n.addEdge('c', 't', 20);
    n.addEdge('d', 'c', 7);
    n.addEdge('d', 't', 4);
    const { maxFlow } = edmondsKarp(n, 's', 't');
    assert.equal(maxFlow, 23);
  });
});

// ─── minCut ──────────────────────────────────────────────────────────────────

describe('minCut', () => {
  it('min-cut capacity equals max flow', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 'a', 3);
    n.addEdge('s', 'b', 2);
    n.addEdge('a', 't', 3);
    n.addEdge('b', 't', 2);
    const { capacity } = minCut(n, 's', 't');
    assert.equal(capacity, 5);
  });

  it('source is in S partition, sink is in T partition', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 't', 7);
    const { cut } = minCut(n, 's', 't');
    const [sPartition, tPartition] = cut;
    assert.ok(sPartition.includes('s'));
    assert.ok(tPartition.includes('t'));
  });

  it('all vertices are partitioned', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 'a', 10);
    n.addEdge('a', 'b', 1);
    n.addEdge('b', 't', 10);
    const { cut } = minCut(n, 's', 't');
    const [sPartition, tPartition] = cut;
    const all = [...sPartition, ...tPartition].sort();
    assert.deepEqual(all, ['a', 'b', 's', 't']);
  });

  it('bottleneck edge determines the cut', () => {
    const n = new FlowNetwork();
    n.addEdge('s', 'a', 100);
    n.addEdge('a', 't', 1);
    const { capacity } = minCut(n, 's', 't');
    assert.equal(capacity, 1);
  });
});
