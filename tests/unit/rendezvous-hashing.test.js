// ─── Unit Tests: Rendezvous (HRW) Hashing ─────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RendezvousHash,
  createRendezvousHash,
} from '../../app/modules/rendezvous-hashing.js';

// ─── RendezvousHash ────────────────────────────────────────────────────────

describe('RendezvousHash', () => {
  it('returns undefined when no nodes exist', () => {
    const rh = new RendezvousHash();
    assert.equal(rh.getNode('key'), undefined);
  });

  it('maps every key to the only node when one node exists', () => {
    const rh = new RendezvousHash();
    rh.addNode('server-a');
    assert.equal(rh.getNode('k1'), 'server-a');
    assert.equal(rh.getNode('k2'), 'server-a');
    assert.equal(rh.getNode('k3'), 'server-a');
  });

  it('returns a deterministic node for a given key', () => {
    const rh = new RendezvousHash();
    rh.addNode('s1');
    rh.addNode('s2');
    rh.addNode('s3');

    const node = rh.getNode('my-key');
    assert.equal(rh.getNode('my-key'), node);
    assert.equal(rh.getNode('my-key'), node);
  });

  it('distributes keys across multiple nodes', () => {
    const rh = new RendezvousHash();
    rh.addNode('A');
    rh.addNode('B');
    rh.addNode('C');

    const counts = { A: 0, B: 0, C: 0 };
    for (let i = 0; i < 3000; i++) {
      counts[rh.getNode(`key-${i}`)]++;
    }

    // Each node should get a meaningful share (at least 15%).
    assert.ok(counts.A > 450, `A got ${counts.A}`);
    assert.ok(counts.B > 450, `B got ${counts.B}`);
    assert.ok(counts.C > 450, `C got ${counts.C}`);
  });

  it('addNode is idempotent for duplicate nodes', () => {
    const rh = new RendezvousHash();
    rh.addNode('x');
    rh.addNode('x');
    assert.equal(rh.nodeCount, 1);
  });

  it('removeNode drops the node', () => {
    const rh = new RendezvousHash();
    rh.addNode('s1');
    rh.addNode('s2');
    rh.removeNode('s1');

    assert.equal(rh.nodeCount, 1);
    for (let i = 0; i < 100; i++) {
      assert.equal(rh.getNode(`k-${i}`), 's2');
    }
  });

  it('removeNode is a no-op for unknown nodes', () => {
    const rh = new RendezvousHash();
    rh.addNode('a');
    rh.removeNode('b');
    assert.equal(rh.nodeCount, 1);
  });

  it('minimises key movement when a node is removed', () => {
    const rh = new RendezvousHash();
    rh.addNode('A');
    rh.addNode('B');
    rh.addNode('C');

    const before = new Map();
    for (let i = 0; i < 1000; i++) {
      before.set(`k${i}`, rh.getNode(`k${i}`));
    }

    rh.removeNode('C');

    let moved = 0;
    for (let i = 0; i < 1000; i++) {
      if (rh.getNode(`k${i}`) !== before.get(`k${i}`)) moved++;
    }

    // Only keys that were on C should move; allow a generous upper bound.
    assert.ok(moved < 500, `too many keys moved: ${moved}/1000`);
  });

  it('getNodes returns multiple nodes ordered by weight', () => {
    const rh = new RendezvousHash();
    rh.addNode('A');
    rh.addNode('B');
    rh.addNode('C');

    const nodes = rh.getNodes('key', 2);
    assert.equal(nodes.length, 2);
    assert.notEqual(nodes[0], nodes[1]);
  });

  it('getNodes returns at most the available nodes', () => {
    const rh = new RendezvousHash();
    rh.addNode('A');
    rh.addNode('B');

    const nodes = rh.getNodes('key', 10);
    assert.equal(nodes.length, 2);
  });

  it('getNodes returns empty array when no nodes', () => {
    const rh = new RendezvousHash();
    assert.deepEqual(rh.getNodes('key', 3), []);
  });

  it('nodeCount and nodes() reflect current state', () => {
    const rh = new RendezvousHash();
    assert.equal(rh.nodeCount, 0);
    assert.deepEqual(rh.nodes(), []);

    rh.addNode('A');
    rh.addNode('B');
    assert.equal(rh.nodeCount, 2);
    assert.deepEqual(rh.nodes().sort(), ['A', 'B']);

    rh.removeNode('A');
    assert.equal(rh.nodeCount, 1);
    assert.deepEqual(rh.nodes(), ['B']);
  });

  it('accepts a custom hash function', () => {
    const customHash = (node, key) => {
      const combined = `${node}:${key}`;
      let sum = 0;
      for (let i = 0; i < combined.length; i++) sum += combined.charCodeAt(i);
      return sum;
    };

    const rh = new RendezvousHash(customHash);
    rh.addNode('X');
    rh.addNode('Y');
    assert.ok(rh.getNode('hello') !== undefined);
  });

  it('getNodes first element matches getNode', () => {
    const rh = new RendezvousHash();
    rh.addNode('A');
    rh.addNode('B');
    rh.addNode('C');

    for (let i = 0; i < 50; i++) {
      const key = `test-key-${i}`;
      const single = rh.getNode(key);
      const multi = rh.getNodes(key, 3);
      assert.equal(multi[0], single, `mismatch for ${key}`);
    }
  });
});

// ─── createRendezvousHash factory ──────────────────────────────────────────

describe('createRendezvousHash', () => {
  it('creates a usable RendezvousHash instance', () => {
    const rh = createRendezvousHash();
    rh.addNode('node1');
    assert.equal(rh.getNode('foo'), 'node1');
  });
});
