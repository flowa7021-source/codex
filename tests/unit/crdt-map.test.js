// ─── Unit Tests: CRDT Map & OR-Set ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LWWMap, ORSet } from '../../app/modules/crdt-map.js';

// ─── LWWMap ───────────────────────────────────────────────────────────────────

describe('LWWMap – basic operations', () => {
  it('set and get a value', () => {
    const m = new LWWMap('node-A');
    m.set('foo', 42);
    assert.equal(m.get('foo'), 42);
  });

  it('returns undefined for missing key', () => {
    const m = new LWWMap('node-A');
    assert.equal(m.get('missing'), undefined);
  });

  it('has() returns true for live key', () => {
    const m = new LWWMap('node-A');
    m.set('x', 'hello');
    assert.equal(m.has('x'), true);
  });

  it('has() returns false for missing key', () => {
    const m = new LWWMap('node-A');
    assert.equal(m.has('nope'), false);
  });

  it('overwrite updates the value', () => {
    const m = new LWWMap('node-A');
    m.set('k', 'first');
    m.set('k', 'second');
    assert.equal(m.get('k'), 'second');
  });

  it('size counts only live entries', () => {
    const m = new LWWMap('node-A');
    m.set('a', 1);
    m.set('b', 2);
    assert.equal(m.size, 2);
  });

  it('entries() returns live key-value pairs', () => {
    const m = new LWWMap('node-A');
    m.set('a', 1);
    m.set('b', 2);
    const entries = m.entries();
    entries.sort((x, y) => x[0].localeCompare(y[0]));
    assert.deepEqual(entries, [['a', 1], ['b', 2]]);
  });
});

describe('LWWMap – delete (tombstone)', () => {
  it('delete removes the key from get()', () => {
    const m = new LWWMap('node-A');
    m.set('k', 'val');
    m.delete('k');
    assert.equal(m.get('k'), undefined);
  });

  it('has() returns false after delete', () => {
    const m = new LWWMap('node-A');
    m.set('k', 'val');
    m.delete('k');
    assert.equal(m.has('k'), false);
  });

  it('size decreases after delete', () => {
    const m = new LWWMap('node-A');
    m.set('a', 1);
    m.set('b', 2);
    m.delete('a');
    assert.equal(m.size, 1);
  });

  it('entries() omits tombstoned keys', () => {
    const m = new LWWMap('node-A');
    m.set('a', 1);
    m.set('b', 2);
    m.delete('a');
    assert.deepEqual(m.entries(), [['b', 2]]);
  });

  it('deleting a non-existent key does not error', () => {
    const m = new LWWMap('node-A');
    assert.doesNotThrow(() => m.delete('ghost'));
  });

  it('re-set after delete restores the key', () => {
    let ts = 100;
    const m = new LWWMap('node-A', () => ts++);
    m.set('k', 'alive');   // ts=100
    m.delete('k');         // ts=101
    m.set('k', 'reborn'); // ts=102
    assert.equal(m.get('k'), 'reborn');
    assert.equal(m.has('k'), true);
  });
});

describe('LWWMap – state / applyState', () => {
  it('state() returns all entries including tombstones', () => {
    const m = new LWWMap('node-A');
    m.set('a', 1);
    m.delete('b'); // tombstone on never-written key
    const st = m.state();
    assert.ok('a' in st);
    assert.ok('b' in st);
    assert.equal(st['a'].tombstone, false);
    assert.equal(st['b'].tombstone, true);
  });

  it('applyState merges entries with higher timestamps', () => {
    let tsA = 10;
    const m = new LWWMap('node-A', () => tsA++);
    m.set('x', 'local');  // ts=10

    const remote = { x: { value: 'remote', timestamp: 20, tombstone: false } };
    m.applyState(remote);
    assert.equal(m.get('x'), 'remote');
  });

  it('applyState ignores entries with lower timestamps', () => {
    let tsA = 100;
    const m = new LWWMap('node-A', () => tsA++);
    m.set('x', 'local');  // ts=100

    const remote = { x: { value: 'stale', timestamp: 5, tombstone: false } };
    m.applyState(remote);
    assert.equal(m.get('x'), 'local');
  });
});

describe('LWWMap – merge (LWW)', () => {
  it('merge adopts higher-timestamp remote value', () => {
    let tsA = 1;
    let tsB = 100;

    const a = new LWWMap('node-A', () => tsA++);
    const b = new LWWMap('node-B', () => tsB++);

    a.set('k', 'from-A');  // ts=1
    b.set('k', 'from-B');  // ts=100

    a.merge(b);
    assert.equal(a.get('k'), 'from-B');
  });

  it('merge keeps local value when local timestamp is higher', () => {
    let tsA = 200;
    let tsB = 1;

    const a = new LWWMap('node-A', () => tsA++);
    const b = new LWWMap('node-B', () => tsB++);

    a.set('k', 'from-A');  // ts=200
    b.set('k', 'from-B');  // ts=1

    a.merge(b);
    assert.equal(a.get('k'), 'from-A');
  });

  it('merge adds remote keys that do not exist locally', () => {
    const a = new LWWMap('node-A');
    const b = new LWWMap('node-B');

    b.set('new-key', 'hello');
    a.merge(b);
    assert.equal(a.get('new-key'), 'hello');
  });

  it('concurrent remote delete wins over older local set (LWW)', () => {
    let tsA = 1;
    let tsB = 100;

    const a = new LWWMap('node-A', () => tsA++);
    const b = new LWWMap('node-B', () => tsB++);

    a.set('k', 'alive');   // ts=1
    b.delete('k');          // ts=100 (tombstone)

    a.merge(b);
    assert.equal(a.get('k'), undefined);
    assert.equal(a.has('k'), false);
  });

  it('concurrent local delete wins over older remote set (LWW)', () => {
    let tsA = 100;
    let tsB = 1;

    const a = new LWWMap('node-A', () => tsA++);
    const b = new LWWMap('node-B', () => tsB++);

    a.delete('k');          // ts=100 (tombstone)
    b.set('k', 'from-B');  // ts=1

    a.merge(b);
    assert.equal(a.get('k'), undefined);
  });

  it('merge is idempotent', () => {
    const a = new LWWMap('node-A');
    const b = new LWWMap('node-B');

    b.set('x', 42);
    a.merge(b);
    a.merge(b); // second merge should be a no-op
    assert.equal(a.get('x'), 42);
    assert.equal(a.size, 1);
  });

  it('concurrent updates across three nodes resolve correctly', () => {
    let t1 = 1, t2 = 2, t3 = 3;
    const a = new LWWMap('node-A', () => t1);
    const b = new LWWMap('node-B', () => t2);
    const c = new LWWMap('node-C', () => t3);

    a.set('vote', 'A-value'); // ts=1
    b.set('vote', 'B-value'); // ts=2
    c.set('vote', 'C-value'); // ts=3 — wins

    a.merge(b);
    a.merge(c);
    assert.equal(a.get('vote'), 'C-value');
  });
});

// ─── ORSet ────────────────────────────────────────────────────────────────────

describe('ORSet – basic operations', () => {
  it('add and has', () => {
    const s = new ORSet('node-A');
    s.add('apple');
    assert.equal(s.has('apple'), true);
  });

  it('has() returns false before add', () => {
    const s = new ORSet('node-A');
    assert.equal(s.has('banana'), false);
  });

  it('remove clears the element', () => {
    const s = new ORSet('node-A');
    s.add('apple');
    s.remove('apple');
    assert.equal(s.has('apple'), false);
  });

  it('values() returns all present elements', () => {
    const s = new ORSet('node-A');
    s.add('a');
    s.add('b');
    s.add('c');
    assert.deepEqual(s.values().sort(), ['a', 'b', 'c']);
  });

  it('size reflects live elements', () => {
    const s = new ORSet('node-A');
    s.add('x');
    s.add('y');
    assert.equal(s.size, 2);
    s.remove('x');
    assert.equal(s.size, 1);
  });

  it('removing absent element does not throw', () => {
    const s = new ORSet('node-A');
    assert.doesNotThrow(() => s.remove('ghost'));
  });

  it('re-add after remove restores element', () => {
    const s = new ORSet('node-A');
    s.add('item');
    s.remove('item');
    s.add('item');
    assert.equal(s.has('item'), true);
  });
});

describe('ORSet – merge', () => {
  it('merge unions elements from both sets', () => {
    const a = new ORSet('node-A');
    const b = new ORSet('node-B');

    a.add('x');
    b.add('y');

    a.merge(b);
    assert.equal(a.has('x'), true);
    assert.equal(a.has('y'), true);
  });

  it('merge preserves observed additions (add wins over concurrent remove)', () => {
    // Scenario: A adds "item"; B removes "item"; but B never saw A's add token.
    // After merge, A's token survives → element is still present.
    const a = new ORSet('node-A');
    const b = new ORSet('node-B');

    a.add('item'); // token: node-A:1

    // B never received A's add, so B's remove only clears B's own tokens (none).
    b.remove('item'); // no tokens in B → no-op

    // Now merge B into A.
    a.merge(b);

    // A's token is still there — element survives.
    assert.equal(a.has('item'), true);
  });

  it('concurrent add+remove: add from other node survives', () => {
    const a = new ORSet('node-A');
    const b = new ORSet('node-B');

    // Both start with "shared"
    a.add('shared'); // A's token
    b.add('shared'); // B's token

    // Sync B → A so A knows both tokens
    a.merge(b);

    // Now B removes "shared" (knows both tokens at this point)
    b.merge(a); // make sure b also knows a's tokens
    b.remove('shared'); // clears all known tokens on B

    // Meanwhile A adds "shared" again with a fresh token.
    a.add('shared'); // fresh token in A

    // Merge B's remove into A — B's remove only clears the old tokens.
    a.merge(b);

    // A's new token survives.
    assert.equal(a.has('shared'), true);
  });

  it('merge is idempotent', () => {
    const a = new ORSet('node-A');
    const b = new ORSet('node-B');

    b.add('z');
    a.merge(b);
    a.merge(b); // second merge is a no-op
    assert.equal(a.size, 1);
  });

  it('element removed on both sides stays removed after merge', () => {
    const a = new ORSet('node-A');
    const b = new ORSet('node-B');

    a.add('gone');
    b.merge(a); // b sees a's token

    a.remove('gone');
    b.remove('gone');

    a.merge(b);
    assert.equal(a.has('gone'), false);
  });
});
