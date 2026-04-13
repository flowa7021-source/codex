// ─── Unit Tests: CRDT Sets ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  GSet,
  ORSet,
  createGSet,
  createORSet,
} from '../../app/modules/crdt-set.js';

// ─── GSet ────────────────────────────────────────────────────────────────────

describe('GSet – basics', () => {
  it('starts empty', () => {
    const s = new GSet();
    assert.equal(s.size, 0);
    assert.deepEqual(s.values(), []);
  });

  it('adds elements', () => {
    const s = new GSet();
    s.add('a');
    s.add('b');
    assert.equal(s.size, 2);
    assert.ok(s.has('a'));
    assert.ok(s.has('b'));
  });

  it('adding duplicates does not increase size', () => {
    const s = new GSet();
    s.add('x');
    s.add('x');
    assert.equal(s.size, 1);
  });

  it('has returns false for missing elements', () => {
    const s = new GSet();
    s.add('a');
    assert.equal(s.has('b'), false);
  });

  it('values returns all elements', () => {
    const s = new GSet();
    s.add(1);
    s.add(2);
    s.add(3);
    const vals = s.values().sort();
    assert.deepEqual(vals, [1, 2, 3]);
  });
});

describe('GSet – merge', () => {
  it('merges two disjoint sets', () => {
    const a = new GSet();
    const b = new GSet();
    a.add('x');
    b.add('y');
    const merged = a.merge(b);
    assert.equal(merged.size, 2);
    assert.ok(merged.has('x'));
    assert.ok(merged.has('y'));
  });

  it('merges overlapping sets without duplicates', () => {
    const a = new GSet();
    const b = new GSet();
    a.add('x');
    a.add('y');
    b.add('y');
    b.add('z');
    const merged = a.merge(b);
    assert.equal(merged.size, 3);
  });

  it('merge is commutative', () => {
    const a = new GSet();
    const b = new GSet();
    a.add(1);
    a.add(2);
    b.add(2);
    b.add(3);
    const m1 = a.merge(b).values().sort();
    const m2 = b.merge(a).values().sort();
    assert.deepEqual(m1, m2);
  });

  it('merge is idempotent', () => {
    const a = new GSet();
    a.add('p');
    a.add('q');
    const m1 = a.merge(a);
    assert.equal(m1.size, 2);
  });

  it('merge does not mutate originals', () => {
    const a = new GSet();
    const b = new GSet();
    a.add(1);
    b.add(2);
    a.merge(b);
    assert.equal(a.size, 1);
    assert.equal(b.size, 1);
  });
});

// ─── ORSet ───────────────────────────────────────────────────────────────────

describe('ORSet – basics', () => {
  it('starts empty', () => {
    const s = new ORSet('a');
    assert.equal(s.size, 0);
  });

  it('adds and retrieves elements', () => {
    const s = new ORSet('a');
    s.add('x');
    s.add('y');
    assert.ok(s.has('x'));
    assert.ok(s.has('y'));
    assert.equal(s.size, 2);
  });

  it('remove deletes an element', () => {
    const s = new ORSet('a');
    s.add('x');
    s.remove('x');
    assert.equal(s.has('x'), false);
    assert.equal(s.size, 0);
  });

  it('removing a non-existent element is a no-op', () => {
    const s = new ORSet('a');
    s.add('x');
    s.remove('y');
    assert.equal(s.size, 1);
  });

  it('values returns unique elements', () => {
    const s = new ORSet('a');
    s.add('x');
    s.add('x'); // second add with different tag
    assert.equal(s.values().length, 1);
    assert.deepEqual(s.values(), ['x']);
  });
});

describe('ORSet – merge (add-wins)', () => {
  it('merges two disjoint sets', () => {
    const a = new ORSet('a');
    const b = new ORSet('b');
    a.add('x');
    b.add('y');
    const merged = a.merge(b);
    assert.ok(merged.has('x'));
    assert.ok(merged.has('y'));
    assert.equal(merged.size, 2);
  });

  it('concurrent add wins over concurrent remove', () => {
    // Node A and B both start by seeing 'x' from A
    const a = new ORSet('a');
    a.add('x');

    // Simulate: B merges A so it sees x, then removes it
    const b = new ORSet('b');
    const synced = b.merge(a); // B now sees x with A's tag

    // B removes x (tombstones A's tag)
    const bAfterRemove = new ORSet('b');
    // Reconstruct: merge synced, then remove
    const bMerged = bAfterRemove.merge(synced);
    bMerged.remove('x');

    // Meanwhile A concurrently adds x again (new tag)
    a.add('x');

    // Final merge: A's new tag should survive B's tombstone
    const final = a.merge(bMerged);
    assert.ok(final.has('x'), 'concurrent add should win over concurrent remove');
  });

  it('merge is commutative', () => {
    const a = new ORSet('a');
    const b = new ORSet('b');
    a.add('p');
    a.add('q');
    b.add('q');
    b.add('r');
    const m1 = a.merge(b).values().sort();
    const m2 = b.merge(a).values().sort();
    assert.deepEqual(m1, m2);
  });

  it('merge does not mutate originals', () => {
    const a = new ORSet('a');
    const b = new ORSet('b');
    a.add('x');
    b.add('y');
    a.merge(b);
    assert.equal(a.size, 1);
    assert.equal(b.size, 1);
  });

  it('removed elements stay removed after merge with empty set', () => {
    const a = new ORSet('a');
    a.add('x');
    a.remove('x');
    const b = new ORSet('b');
    const merged = a.merge(b);
    assert.equal(merged.has('x'), false);
  });
});

// ─── Factories ───────────────────────────────────────────────────────────────

describe('CRDT set factories', () => {
  it('createGSet returns a GSet', () => {
    const s = createGSet();
    s.add('hello');
    assert.ok(s.has('hello'));
    assert.equal(s.size, 1);
  });

  it('createORSet returns an ORSet', () => {
    const s = createORSet('node-1');
    s.add(42);
    assert.ok(s.has(42));
    s.remove(42);
    assert.equal(s.has(42), false);
  });
});
