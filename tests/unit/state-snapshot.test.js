// ─── Unit Tests: SnapshotManager ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SnapshotManager,
  createSnapshotManager,
} from '../../app/modules/state-snapshot.js';

// ─── capture ──────────────────────────────────────────────────────────────────

describe('SnapshotManager – capture', () => {
  it('returns a non-empty string id', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ x: 1 });
    assert.ok(typeof id === 'string' && id.length > 0);
  });

  it('each capture returns a unique id', () => {
    const mgr = new SnapshotManager();
    const id1 = mgr.capture({ x: 1 });
    const id2 = mgr.capture({ x: 2 });
    assert.notEqual(id1, id2);
  });

  it('increments size after each capture', () => {
    const mgr = new SnapshotManager();
    assert.equal(mgr.size, 0);
    mgr.capture({ a: true });
    assert.equal(mgr.size, 1);
    mgr.capture({ a: false });
    assert.equal(mgr.size, 2);
  });

  it('stores the label when provided', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ v: 42 }, 'my-label');
    const snap = mgr.list()[0];
    assert.equal(snap.id, id);
    assert.equal(snap.label, 'my-label');
  });

  it('stores no label property when omitted', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ v: 0 });
    const snap = mgr.list()[0];
    assert.equal(snap.label, undefined);
  });

  it('uses the custom clock for timestamp', () => {
    let t = 1000;
    const mgr = new SnapshotManager({ clock: () => t });
    mgr.capture({ v: 1 });
    t = 2000;
    mgr.capture({ v: 2 });
    const [newer, older] = mgr.list();
    assert.equal(older.timestamp, 1000);
    assert.equal(newer.timestamp, 2000);
  });

  it('drops oldest snapshot when maxSnapshots is exceeded', () => {
    const mgr = new SnapshotManager({ maxSnapshots: 3 });
    const first = mgr.capture({ n: 1 });
    mgr.capture({ n: 2 });
    mgr.capture({ n: 3 });
    mgr.capture({ n: 4 }); // should evict the first
    assert.equal(mgr.size, 3);
    assert.equal(mgr.has(first), false);
  });

  it('enforces maxSnapshots over repeated additions', () => {
    const mgr = new SnapshotManager({ maxSnapshots: 2 });
    for (let i = 0; i < 10; i++) mgr.capture({ i });
    assert.equal(mgr.size, 2);
  });
});

// ─── restore ──────────────────────────────────────────────────────────────────

describe('SnapshotManager – restore', () => {
  it('returns the saved state for a valid id', () => {
    const mgr = new SnapshotManager();
    const state = { color: 'red', count: 7 };
    const id = mgr.capture(state);
    assert.deepEqual(mgr.restore(id), state);
  });

  it('returns null for an unknown id', () => {
    const mgr = new SnapshotManager();
    assert.equal(mgr.restore('nonexistent'), null);
  });

  it('restores the correct snapshot among many', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ v: 1 });
    const target = mgr.capture({ v: 2 });
    mgr.capture({ v: 3 });
    assert.deepEqual(mgr.restore(target), { v: 2 });
  });

  it('returns null after the snapshot is deleted', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ x: 99 });
    mgr.delete(id);
    assert.equal(mgr.restore(id), null);
  });

  it('returns null after clear', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ x: 1 });
    mgr.clear();
    assert.equal(mgr.restore(id), null);
  });

  it('does not mutate the stored state on restore', () => {
    const mgr = new SnapshotManager();
    const original = { arr: [1, 2, 3] };
    const id = mgr.capture(original);
    const restored = mgr.restore(id);
    assert.deepEqual(restored, original);
  });

  it('restoring the same id twice returns equal states', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ v: 42 });
    assert.deepEqual(mgr.restore(id), mgr.restore(id));
  });

  it('returns null on empty manager', () => {
    const mgr = new SnapshotManager();
    assert.equal(mgr.restore('any'), null);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('SnapshotManager – delete', () => {
  it('returns true and removes an existing snapshot', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ x: 1 });
    assert.equal(mgr.delete(id), true);
    assert.equal(mgr.has(id), false);
    assert.equal(mgr.size, 0);
  });

  it('returns false for a non-existent id', () => {
    const mgr = new SnapshotManager();
    assert.equal(mgr.delete('ghost'), false);
  });

  it('does not affect other snapshots', () => {
    const mgr = new SnapshotManager();
    const id1 = mgr.capture({ a: 1 });
    const id2 = mgr.capture({ a: 2 });
    mgr.delete(id1);
    assert.equal(mgr.has(id2), true);
    assert.equal(mgr.size, 1);
  });

  it('double-delete returns false on the second call', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ v: 0 });
    mgr.delete(id);
    assert.equal(mgr.delete(id), false);
  });

  it('deleting middle snapshot preserves order of remaining snapshots', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ n: 1 });
    const mid = mgr.capture({ n: 2 });
    mgr.capture({ n: 3 });
    mgr.delete(mid);
    const states = mgr.list().map((s) => s.state.n);
    assert.deepEqual(states, [3, 1]);
  });

  it('delete on empty manager returns false', () => {
    const mgr = new SnapshotManager();
    assert.equal(mgr.delete('anything'), false);
  });

  it('size decrements after delete', () => {
    const mgr = new SnapshotManager();
    mgr.capture({});
    mgr.capture({});
    const id = mgr.capture({});
    mgr.delete(id);
    assert.equal(mgr.size, 2);
  });

  it('re-capturing after delete works normally', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ v: 1 });
    mgr.delete(id);
    const newId = mgr.capture({ v: 2 });
    assert.notEqual(newId, id);
    assert.deepEqual(mgr.restore(newId), { v: 2 });
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('SnapshotManager – clear', () => {
  it('removes all snapshots', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ a: 1 });
    mgr.capture({ b: 2 });
    mgr.clear();
    assert.equal(mgr.size, 0);
  });

  it('list returns empty array after clear', () => {
    const mgr = new SnapshotManager();
    mgr.capture({});
    mgr.clear();
    assert.deepEqual(mgr.list(), []);
  });

  it('latest returns null after clear', () => {
    const mgr = new SnapshotManager();
    mgr.capture({});
    mgr.clear();
    assert.equal(mgr.latest(), null);
  });

  it('can capture again after clear', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ x: 1 });
    mgr.clear();
    const id = mgr.capture({ x: 2 });
    assert.equal(mgr.size, 1);
    assert.deepEqual(mgr.restore(id), { x: 2 });
  });

  it('clear on empty manager is safe', () => {
    const mgr = new SnapshotManager();
    assert.doesNotThrow(() => mgr.clear());
  });

  it('has returns false for old ids after clear', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ v: 1 });
    mgr.clear();
    assert.equal(mgr.has(id), false);
  });

  it('size is 0 immediately after clear', () => {
    const mgr = new SnapshotManager();
    for (let i = 0; i < 5; i++) mgr.capture({ i });
    mgr.clear();
    assert.equal(mgr.size, 0);
  });

  it('multiple clears are safe', () => {
    const mgr = new SnapshotManager();
    mgr.capture({});
    mgr.clear();
    mgr.clear();
    assert.equal(mgr.size, 0);
  });
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe('SnapshotManager – list', () => {
  it('returns empty array when no snapshots', () => {
    const mgr = new SnapshotManager();
    assert.deepEqual(mgr.list(), []);
  });

  it('returns snapshots newest first', () => {
    let t = 0;
    const mgr = new SnapshotManager({ clock: () => ++t });
    mgr.capture({ n: 1 });
    mgr.capture({ n: 2 });
    mgr.capture({ n: 3 });
    const listed = mgr.list().map((s) => s.state.n);
    assert.deepEqual(listed, [3, 2, 1]);
  });

  it('returned list is a copy (mutation does not affect internal state)', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ v: 1 });
    const list = mgr.list();
    list.splice(0); // clear the returned array
    assert.equal(mgr.size, 1);
  });

  it('each entry has id, state, and timestamp', () => {
    const mgr = new SnapshotManager({ clock: () => 555 });
    mgr.capture({ val: 7 });
    const [snap] = mgr.list();
    assert.ok(typeof snap.id === 'string');
    assert.deepEqual(snap.state, { val: 7 });
    assert.equal(snap.timestamp, 555);
  });

  it('length of list matches size', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ a: 1 });
    mgr.capture({ b: 2 });
    assert.equal(mgr.list().length, mgr.size);
  });

  it('list reflects deletions', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ n: 1 });
    mgr.capture({ n: 2 });
    mgr.delete(id);
    assert.equal(mgr.list().length, 1);
    assert.equal(mgr.list()[0].state.n, 2);
  });

  it('list with a single snapshot returns array of one', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ only: true });
    const list = mgr.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, id);
  });

  it('snapshot ids in list match has() results', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ x: 1 });
    mgr.capture({ x: 2 });
    for (const snap of mgr.list()) {
      assert.ok(mgr.has(snap.id));
    }
  });
});

// ─── latest ───────────────────────────────────────────────────────────────────

describe('SnapshotManager – latest', () => {
  it('returns null when no snapshots exist', () => {
    const mgr = new SnapshotManager();
    assert.equal(mgr.latest(), null);
  });

  it('returns the most recently captured snapshot', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ n: 1 });
    const id2 = mgr.capture({ n: 2 });
    assert.equal(mgr.latest()?.id, id2);
    assert.deepEqual(mgr.latest()?.state, { n: 2 });
  });

  it('updates after each capture', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ n: 1 });
    assert.deepEqual(mgr.latest()?.state, { n: 1 });
    mgr.capture({ n: 2 });
    assert.deepEqual(mgr.latest()?.state, { n: 2 });
  });

  it('returns null after clear', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ v: 1 });
    mgr.clear();
    assert.equal(mgr.latest(), null);
  });

  it('returns the remaining snapshot after deleting the latest', () => {
    const mgr = new SnapshotManager();
    const id1 = mgr.capture({ n: 1 });
    const id2 = mgr.capture({ n: 2 });
    mgr.delete(id2);
    assert.equal(mgr.latest()?.id, id1);
  });

  it('after deleting all but one, latest is that one', () => {
    const mgr = new SnapshotManager();
    const id1 = mgr.capture({ n: 1 });
    const id2 = mgr.capture({ n: 2 });
    const id3 = mgr.capture({ n: 3 });
    mgr.delete(id3);
    mgr.delete(id2);
    assert.equal(mgr.latest()?.id, id1);
  });

  it('latest reflects maxSnapshots eviction', () => {
    const mgr = new SnapshotManager({ maxSnapshots: 2 });
    mgr.capture({ n: 1 });
    mgr.capture({ n: 2 });
    const id3 = mgr.capture({ n: 3 }); // evicts first
    assert.equal(mgr.latest()?.id, id3);
  });

  it('latest is consistent with list()[0]', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ n: 1 });
    mgr.capture({ n: 2 });
    assert.equal(mgr.latest()?.id, mgr.list()[0].id);
  });
});

// ─── size & has ───────────────────────────────────────────────────────────────

describe('SnapshotManager – size and has', () => {
  it('size starts at 0', () => {
    const mgr = new SnapshotManager();
    assert.equal(mgr.size, 0);
  });

  it('has returns false for any id on empty manager', () => {
    const mgr = new SnapshotManager();
    assert.equal(mgr.has('any-id'), false);
  });

  it('has returns true immediately after capture', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ v: 1 });
    assert.equal(mgr.has(id), true);
  });

  it('has returns false after delete', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ v: 1 });
    mgr.delete(id);
    assert.equal(mgr.has(id), false);
  });

  it('size correctly tracks multiple captures and deletes', () => {
    const mgr = new SnapshotManager();
    const id1 = mgr.capture({ n: 1 });
    const id2 = mgr.capture({ n: 2 });
    assert.equal(mgr.size, 2);
    mgr.delete(id1);
    assert.equal(mgr.size, 1);
    mgr.delete(id2);
    assert.equal(mgr.size, 0);
  });

  it('has is false for evicted snapshots', () => {
    const mgr = new SnapshotManager({ maxSnapshots: 1 });
    const first = mgr.capture({ n: 1 });
    mgr.capture({ n: 2 }); // evicts first
    assert.equal(mgr.has(first), false);
  });

  it('has does not accept partial ids', () => {
    const mgr = new SnapshotManager();
    const id = mgr.capture({ v: 1 });
    assert.equal(mgr.has(id.slice(0, 4)), false);
  });

  it('size equals list().length after operations', () => {
    const mgr = new SnapshotManager();
    mgr.capture({ n: 1 });
    mgr.capture({ n: 2 });
    mgr.capture({ n: 3 });
    mgr.delete(mgr.list()[0].id);
    assert.equal(mgr.size, mgr.list().length);
  });
});

// ─── createSnapshotManager ────────────────────────────────────────────────────

describe('createSnapshotManager – factory', () => {
  it('returns a SnapshotManager instance', () => {
    const mgr = createSnapshotManager();
    assert.ok(mgr instanceof SnapshotManager);
  });

  it('factory with no options creates a working manager', () => {
    const mgr = createSnapshotManager();
    const id = mgr.capture({ hello: 'world' });
    assert.deepEqual(mgr.restore(id), { hello: 'world' });
  });

  it('factory passes options through correctly', () => {
    const mgr = createSnapshotManager({ maxSnapshots: 1 });
    const first = mgr.capture({ n: 1 });
    mgr.capture({ n: 2 });
    assert.equal(mgr.has(first), false);
    assert.equal(mgr.size, 1);
  });

  it('factory passes custom clock through correctly', () => {
    const mgr = createSnapshotManager({ clock: () => 9999 });
    mgr.capture({ v: 1 });
    assert.equal(mgr.latest()?.timestamp, 9999);
  });

  it('multiple factories produce independent managers', () => {
    const a = createSnapshotManager();
    const b = createSnapshotManager();
    a.capture({ from: 'a' });
    assert.equal(b.size, 0);
  });

  it('factory works with complex generic type', () => {
    const mgr = createSnapshotManager();
    const state = { items: [1, 2, 3], meta: { done: false } };
    const id = mgr.capture(state);
    assert.deepEqual(mgr.restore(id), state);
  });

  it('factory default maxSnapshots is at least 10', () => {
    const mgr = createSnapshotManager();
    for (let i = 0; i < 10; i++) mgr.capture({ i });
    assert.equal(mgr.size, 10);
  });

  it('returns null for latest on a fresh factory instance', () => {
    const mgr = createSnapshotManager();
    assert.equal(mgr.latest(), null);
  });
});
