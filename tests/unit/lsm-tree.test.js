// ─── Unit Tests: LSMTree ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LSMTree } from '../../app/modules/lsm-tree.js';

// ─── Basic set / get / has ───────────────────────────────────────────────────

describe('LSMTree – set / get / has', () => {
  it('starts with an empty memtable', () => {
    const lsm = new LSMTree();
    assert.equal(lsm.memtableSize, 0);
    assert.equal(lsm.sstableCount, 0);
  });

  it('stores and retrieves a value from the memtable', () => {
    const lsm = new LSMTree();
    lsm.set('a', 1);
    assert.equal(lsm.get('a'), 1);
  });

  it('has() returns true for a present key', () => {
    const lsm = new LSMTree();
    lsm.set('x', 'hello');
    assert.equal(lsm.has('x'), true);
  });

  it('has() returns false for an absent key', () => {
    const lsm = new LSMTree();
    assert.equal(lsm.has('nope'), false);
  });

  it('get() returns undefined for an absent key', () => {
    const lsm = new LSMTree();
    assert.equal(lsm.get('missing'), undefined);
  });

  it('overwrites a value in the memtable', () => {
    const lsm = new LSMTree();
    lsm.set('k', 1);
    lsm.set('k', 2);
    assert.equal(lsm.get('k'), 2);
  });

  it('memtableSize increments with each unique key', () => {
    const lsm = new LSMTree({ memtableSize: 100 });
    lsm.set('a', 1);
    lsm.set('b', 2);
    assert.equal(lsm.memtableSize, 2);
  });
});

// ─── Delete / tombstone ──────────────────────────────────────────────────────

describe('LSMTree – delete / tombstone', () => {
  it('delete makes a key invisible via get()', () => {
    const lsm = new LSMTree();
    lsm.set('key', 'value');
    lsm.delete('key');
    assert.equal(lsm.get('key'), undefined);
  });

  it('delete makes has() return false', () => {
    const lsm = new LSMTree();
    lsm.set('k', 99);
    lsm.delete('k');
    assert.equal(lsm.has('k'), false);
  });

  it('deleting a nonexistent key does not throw', () => {
    const lsm = new LSMTree();
    assert.doesNotThrow(() => lsm.delete('ghost'));
  });

  it('tombstone in memtable hides a value in an SSTable', () => {
    // Write + flush so the entry ends up in an SSTable, then delete.
    const lsm = new LSMTree({ memtableSize: 1 });
    lsm.set('k', 'old'); // triggers flush
    lsm.delete('k');
    assert.equal(lsm.get('k'), undefined);
    assert.equal(lsm.has('k'), false);
  });

  it('re-setting a deleted key makes it live again', () => {
    const lsm = new LSMTree();
    lsm.set('key', 'v1');
    lsm.delete('key');
    lsm.set('key', 'v2');
    assert.equal(lsm.get('key'), 'v2');
    assert.equal(lsm.has('key'), true);
  });
});

// ─── Flush to SSTable ─────────────────────────────────────────────────────────

describe('LSMTree – flush', () => {
  it('manual flush moves memtable entries to an SSTable', () => {
    const lsm = new LSMTree({ memtableSize: 100 }); // high threshold
    lsm.set('a', 1);
    lsm.set('b', 2);
    assert.equal(lsm.memtableSize, 2);
    assert.equal(lsm.sstableCount, 0);

    lsm.flush();

    assert.equal(lsm.memtableSize, 0);
    assert.equal(lsm.sstableCount, 1);
  });

  it('values remain readable after flush', () => {
    const lsm = new LSMTree({ memtableSize: 100 });
    lsm.set('x', 42);
    lsm.flush();
    assert.equal(lsm.get('x'), 42);
    assert.equal(lsm.has('x'), true);
  });

  it('flush on empty memtable is a no-op', () => {
    const lsm = new LSMTree();
    lsm.flush();
    assert.equal(lsm.sstableCount, 0);
  });

  it('auto-flush triggers when memtableSize threshold is reached', () => {
    const lsm = new LSMTree({ memtableSize: 3 });
    lsm.set('a', 1);
    lsm.set('b', 2);
    assert.equal(lsm.sstableCount, 0);
    lsm.set('c', 3); // triggers auto-flush
    assert.equal(lsm.sstableCount, 1);
    assert.equal(lsm.memtableSize, 0);
  });

  it('auto-flushed values remain readable', () => {
    const lsm = new LSMTree({ memtableSize: 2 });
    lsm.set('p', 'P');
    lsm.set('q', 'Q'); // triggers flush
    assert.equal(lsm.get('p'), 'P');
    assert.equal(lsm.get('q'), 'Q');
  });
});

// ─── Multiple SSTables and read priority ─────────────────────────────────────

describe('LSMTree – multiple SSTables', () => {
  it('accumulates multiple SSTables before compaction', () => {
    const lsm = new LSMTree({ memtableSize: 2, levelSize: 10 });
    // Each pair of sets triggers a flush.
    for (let i = 0; i < 10; i++) {
      lsm.set(`k${i}`, i);
    }
    lsm.flush();
    assert.ok(lsm.sstableCount > 1, `expected > 1 SSTable, got ${lsm.sstableCount}`);
  });

  it('reads the newest value when a key exists in multiple SSTables', () => {
    const lsm = new LSMTree({ memtableSize: 1 });
    // Each set flushes immediately.
    lsm.set('k', 'first');
    lsm.set('k', 'second');
    assert.equal(lsm.get('k'), 'second');
  });

  it('reads across multiple SSTables at different positions', () => {
    const lsm = new LSMTree({ memtableSize: 2 });
    lsm.set('a', 1); lsm.set('b', 2); // flush
    lsm.set('c', 3); lsm.set('d', 4); // flush
    assert.equal(lsm.get('a'), 1);
    assert.equal(lsm.get('b'), 2);
    assert.equal(lsm.get('c'), 3);
    assert.equal(lsm.get('d'), 4);
  });
});

// ─── Overwrite across flush boundaries ───────────────────────────────────────

describe('LSMTree – overwrite after flush', () => {
  it('memtable value overrides flushed SSTable value', () => {
    const lsm = new LSMTree({ memtableSize: 100 });
    lsm.set('k', 'old');
    lsm.flush();
    lsm.set('k', 'new');
    assert.equal(lsm.get('k'), 'new');
  });

  it('latest flush wins over earlier flush', () => {
    const lsm = new LSMTree({ memtableSize: 1 });
    lsm.set('k', 'v1'); // flush 1
    lsm.set('k', 'v2'); // flush 2
    assert.equal(lsm.get('k'), 'v2');
  });
});

// ─── keys() ──────────────────────────────────────────────────────────────────

describe('LSMTree – keys()', () => {
  it('returns all live keys in sorted order', () => {
    const lsm = new LSMTree({ memtableSize: 100 });
    for (const k of ['c', 'a', 'b', 'e', 'd']) lsm.set(k, k);
    assert.deepEqual(lsm.keys(), ['a', 'b', 'c', 'd', 'e']);
  });

  it('excludes tombstoned keys', () => {
    const lsm = new LSMTree({ memtableSize: 100 });
    lsm.set('a', 1);
    lsm.set('b', 2);
    lsm.delete('a');
    assert.deepEqual(lsm.keys(), ['b']);
  });

  it('returns live keys that span memtable and SSTables', () => {
    const lsm = new LSMTree({ memtableSize: 2 });
    lsm.set('x', 1); lsm.set('y', 2); // flush
    lsm.set('z', 3);
    const ks = lsm.keys();
    assert.ok(ks.includes('x'));
    assert.ok(ks.includes('y'));
    assert.ok(ks.includes('z'));
  });

  it('returns empty array when no live keys exist', () => {
    const lsm = new LSMTree();
    assert.deepEqual(lsm.keys(), []);
  });

  it('tombstone in SSTable removes key that was in earlier SSTable', () => {
    const lsm = new LSMTree({ memtableSize: 1 });
    lsm.set('k', 'alive'); // flush
    lsm.delete('k');       // tombstone flush
    assert.deepEqual(lsm.keys(), []);
  });
});

// ─── Compaction ───────────────────────────────────────────────────────────────

describe('LSMTree – compaction', () => {
  it('compacts SSTables when levelSize is exceeded, data remains intact', () => {
    const lsm = new LSMTree({ memtableSize: 2, levelSize: 2 });
    // 6 pairs → 3 flushes → 3 SSTables at L0 → 1 compaction at L1
    for (let i = 0; i < 12; i++) lsm.set(`key${i}`, i);
    // All values still readable after compaction.
    for (let i = 0; i < 12; i++) assert.equal(lsm.get(`key${i}`), i);
  });

  it('compaction respects tombstones', () => {
    const lsm = new LSMTree({ memtableSize: 1, levelSize: 2 });
    lsm.set('gone', 'value'); // flush
    lsm.delete('gone');       // tombstone flush
    lsm.set('alive', 'yes');  // flush → triggers compaction
    assert.equal(lsm.get('gone'), undefined);
    assert.equal(lsm.get('alive'), 'yes');
  });
});
