// ─── Unit Tests: Consistent Hashing ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ConsistentHash,
  createConsistentHash,
} from '../../app/modules/consistent-hashing.js';

// ─── ConsistentHash ────────────────────────────────────────────────────────

describe('ConsistentHash', () => {
  it('returns undefined when the ring is empty', () => {
    const ch = new ConsistentHash();
    assert.equal(ch.getNode('any-key'), undefined);
  });

  it('maps every key to the only node when one node exists', () => {
    const ch = new ConsistentHash();
    ch.addNode('server-a');
    assert.equal(ch.getNode('key1'), 'server-a');
    assert.equal(ch.getNode('key2'), 'server-a');
    assert.equal(ch.getNode('key3'), 'server-a');
  });

  it('returns a deterministic node for a given key', () => {
    const ch = new ConsistentHash();
    ch.addNode('s1');
    ch.addNode('s2');
    ch.addNode('s3');

    const node = ch.getNode('my-key');
    // Same key must always resolve to the same node.
    assert.equal(ch.getNode('my-key'), node);
    assert.equal(ch.getNode('my-key'), node);
  });

  it('distributes keys across multiple nodes', () => {
    const ch = new ConsistentHash();
    ch.addNode('A');
    ch.addNode('B');
    ch.addNode('C');

    const counts = { A: 0, B: 0, C: 0 };
    for (let i = 0; i < 3000; i++) {
      const node = ch.getNode(`key-${i}`);
      counts[node]++;
    }

    // Each node should get a meaningful share (at least 15%).
    assert.ok(counts.A > 450, `A got ${counts.A}`);
    assert.ok(counts.B > 450, `B got ${counts.B}`);
    assert.ok(counts.C > 450, `C got ${counts.C}`);
  });

  it('addNode is idempotent', () => {
    const ch = new ConsistentHash();
    ch.addNode('x');
    ch.addNode('x');
    assert.equal(ch.nodeCount, 1);
  });

  it('removeNode drops the node from the ring', () => {
    const ch = new ConsistentHash();
    ch.addNode('s1');
    ch.addNode('s2');
    ch.removeNode('s1');

    assert.equal(ch.nodeCount, 1);
    // All keys should now go to s2.
    for (let i = 0; i < 100; i++) {
      assert.equal(ch.getNode(`k-${i}`), 's2');
    }
  });

  it('removeNode is a no-op for unknown nodes', () => {
    const ch = new ConsistentHash();
    ch.addNode('a');
    ch.removeNode('b'); // should not throw
    assert.equal(ch.nodeCount, 1);
  });

  it('minimises key movement on node addition', () => {
    const ch = new ConsistentHash();
    ch.addNode('A');
    ch.addNode('B');

    const before = new Map();
    for (let i = 0; i < 1000; i++) {
      before.set(`k${i}`, ch.getNode(`k${i}`));
    }

    ch.addNode('C');

    let moved = 0;
    for (let i = 0; i < 1000; i++) {
      if (ch.getNode(`k${i}`) !== before.get(`k${i}`)) moved++;
    }

    // Ideally ~1/3 move; allow up to 50%.
    assert.ok(moved < 500, `too many keys moved: ${moved}/1000`);
  });

  it('getNodes returns multiple unique nodes', () => {
    const ch = new ConsistentHash();
    ch.addNode('A');
    ch.addNode('B');
    ch.addNode('C');

    const nodes = ch.getNodes('key', 2);
    assert.equal(nodes.length, 2);
    assert.notEqual(nodes[0], nodes[1]);
  });

  it('getNodes returns at most the available nodes', () => {
    const ch = new ConsistentHash();
    ch.addNode('A');
    ch.addNode('B');

    const nodes = ch.getNodes('key', 5);
    assert.equal(nodes.length, 2);
  });

  it('getNodes returns empty array on empty ring', () => {
    const ch = new ConsistentHash();
    assert.deepEqual(ch.getNodes('key', 3), []);
  });

  it('nodeCount and nodes() reflect current state', () => {
    const ch = new ConsistentHash();
    assert.equal(ch.nodeCount, 0);
    assert.deepEqual(ch.nodes(), []);

    ch.addNode('A');
    ch.addNode('B');
    assert.equal(ch.nodeCount, 2);
    assert.deepEqual(ch.nodes().sort(), ['A', 'B']);

    ch.removeNode('A');
    assert.equal(ch.nodeCount, 1);
    assert.deepEqual(ch.nodes(), ['B']);
  });

  it('accepts a custom hash function', () => {
    // Trivial hash that always returns the char-code sum.
    const customHash = (key) => {
      let sum = 0;
      for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
      return sum;
    };

    const ch = new ConsistentHash(10, customHash);
    ch.addNode('X');
    ch.addNode('Y');
    assert.ok(ch.getNode('hello') !== undefined);
  });
});

// ─── createConsistentHash factory ──────────────────────────────────────────

describe('createConsistentHash', () => {
  it('creates a usable ConsistentHash instance', () => {
    const ch = createConsistentHash();
    ch.addNode('node1');
    assert.equal(ch.getNode('foo'), 'node1');
  });

  it('accepts a custom replica count', () => {
    const ch = createConsistentHash(50);
    ch.addNode('a');
    ch.addNode('b');
    assert.equal(ch.nodeCount, 2);
    assert.ok(ch.getNode('test') !== undefined);
  });
});
