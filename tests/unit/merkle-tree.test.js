// ─── Unit Tests: MerkleTree ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MerkleTree, createMerkleTree } from '../../app/modules/merkle-tree.js';

// ─── constructor ────────────────────────────────────────────────────────────

describe('MerkleTree – constructor', () => {
  it('throws on empty leaves array', () => {
    assert.throws(() => new MerkleTree([]), /at least one leaf/);
  });

  it('creates a tree with a single leaf', () => {
    const tree = new MerkleTree(['only']);
    assert.equal(tree.leafCount, 1);
    assert.equal(tree.depth, 0);
    assert.equal(typeof tree.root, 'string');
  });

  it('creates a tree with power-of-two leaves', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    assert.equal(tree.leafCount, 4);
    assert.equal(tree.depth, 2);
  });

  it('handles non-power-of-two leaf count', () => {
    const tree = new MerkleTree(['a', 'b', 'c']);
    assert.equal(tree.leafCount, 3);
    assert.ok(tree.depth >= 1);
    assert.ok(typeof tree.root === 'string');
  });
});

// ─── root determinism ───────────────────────────────────────────────────────

describe('MerkleTree – root', () => {
  it('produces the same root for identical inputs', () => {
    const t1 = new MerkleTree(['x', 'y', 'z']);
    const t2 = new MerkleTree(['x', 'y', 'z']);
    assert.equal(t1.root, t2.root);
  });

  it('produces different roots for different inputs', () => {
    const t1 = new MerkleTree(['x', 'y']);
    const t2 = new MerkleTree(['x', 'z']);
    assert.notEqual(t1.root, t2.root);
  });
});

// ─── getLeaf ────────────────────────────────────────────────────────────────

describe('MerkleTree – getLeaf', () => {
  it('returns the correct leaf value', () => {
    const tree = new MerkleTree(['alpha', 'beta', 'gamma']);
    assert.equal(tree.getLeaf(0), 'alpha');
    assert.equal(tree.getLeaf(1), 'beta');
    assert.equal(tree.getLeaf(2), 'gamma');
  });

  it('throws on out-of-range index', () => {
    const tree = new MerkleTree(['a']);
    assert.throws(() => tree.getLeaf(1), RangeError);
    assert.throws(() => tree.getLeaf(-1), RangeError);
  });
});

// ─── getProof / verify ──────────────────────────────────────────────────────

describe('MerkleTree – getProof & verify', () => {
  it('generates a valid proof for each leaf (4 leaves)', () => {
    const leaves = ['a', 'b', 'c', 'd'];
    const tree = new MerkleTree(leaves);
    for (let i = 0; i < leaves.length; i++) {
      const proof = tree.getProof(i);
      assert.ok(Array.isArray(proof));
      assert.equal(proof.length, tree.depth);
      assert.ok(tree.verify(leaves[i], proof, tree.root));
    }
  });

  it('generates a valid proof for odd leaf count', () => {
    const leaves = ['one', 'two', 'three', 'four', 'five'];
    const tree = new MerkleTree(leaves);
    for (let i = 0; i < leaves.length; i++) {
      const proof = tree.getProof(i);
      assert.ok(tree.verify(leaves[i], proof, tree.root));
    }
  });

  it('rejects a proof with wrong leaf value', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    const proof = tree.getProof(0);
    assert.ok(!tree.verify('WRONG', proof, tree.root));
  });

  it('rejects a proof against wrong root', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    const proof = tree.getProof(1);
    assert.ok(!tree.verify('b', proof, 'badhash'));
  });

  it('throws on out-of-range proof index', () => {
    const tree = new MerkleTree(['a', 'b']);
    assert.throws(() => tree.getProof(5), RangeError);
  });
});

// ─── update ─────────────────────────────────────────────────────────────────

describe('MerkleTree – update', () => {
  it('changes the root after updating a leaf', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    const oldRoot = tree.root;
    tree.update(2, 'C');
    assert.notEqual(tree.root, oldRoot);
    assert.equal(tree.getLeaf(2), 'C');
  });

  it('produces valid proofs after update', () => {
    const tree = new MerkleTree(['w', 'x', 'y', 'z']);
    tree.update(0, 'W');
    tree.update(3, 'Z');
    for (let i = 0; i < 4; i++) {
      const proof = tree.getProof(i);
      assert.ok(tree.verify(tree.getLeaf(i), proof, tree.root));
    }
  });

  it('restores the original root when reverting a change', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    const originalRoot = tree.root;
    tree.update(1, 'CHANGED');
    assert.notEqual(tree.root, originalRoot);
    tree.update(1, 'b');
    assert.equal(tree.root, originalRoot);
  });

  it('throws on out-of-range update index', () => {
    const tree = new MerkleTree(['a', 'b']);
    assert.throws(() => tree.update(10, 'x'), RangeError);
  });
});

// ─── custom hash function ───────────────────────────────────────────────────

describe('MerkleTree – custom hash function', () => {
  it('uses the provided hash function', () => {
    const simple = (s) => `h(${s})`;
    const tree = new MerkleTree(['a', 'b'], simple);
    // root should be hash of concatenated child hashes
    assert.equal(tree.root, simple(simple('a') + simple('b')));
  });
});

// ─── factory ────────────────────────────────────────────────────────────────

describe('createMerkleTree', () => {
  it('returns a MerkleTree instance', () => {
    const tree = createMerkleTree(['a', 'b', 'c']);
    assert.ok(tree instanceof MerkleTree);
    assert.equal(tree.leafCount, 3);
  });
});
