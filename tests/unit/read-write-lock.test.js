// ─── Unit Tests: ReadWriteLock ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ReadWriteLock,
  withReadLock,
  withWriteLock,
  createReadWriteLock,
} from '../../app/modules/read-write-lock.js';

describe('ReadWriteLock – initial state', () => {
  it('starts with no readers and no writer', () => {
    const rw = new ReadWriteLock();
    assert.equal(rw.readers, 0);
    assert.equal(rw.isWriteLocked, false);
    assert.equal(rw.waitingReaders, 0);
    assert.equal(rw.waitingWriters, 0);
  });
});

describe('ReadWriteLock – read locking', () => {
  it('multiple readers can hold simultaneously', async () => {
    const rw = new ReadWriteLock();
    await rw.acquireRead();
    await rw.acquireRead();
    await rw.acquireRead();
    assert.equal(rw.readers, 3);
    assert.equal(rw.isWriteLocked, false);
  });

  it('releaseRead decrements reader count', async () => {
    const rw = new ReadWriteLock();
    await rw.acquireRead();
    await rw.acquireRead();
    rw.releaseRead();
    assert.equal(rw.readers, 1);
  });

  it('releaseRead throws when no readers', () => {
    const rw = new ReadWriteLock();
    assert.throws(() => rw.releaseRead(), /releaseRead called without/);
  });
});

describe('ReadWriteLock – write locking', () => {
  it('acquireWrite blocks when readers hold the lock', async () => {
    const rw = new ReadWriteLock();
    await rw.acquireRead();

    let writeLocked = false;
    const pending = rw.acquireWrite().then(() => { writeLocked = true; });

    assert.equal(writeLocked, false);
    assert.equal(rw.waitingWriters, 1);

    rw.releaseRead(); // should wake the writer
    await pending;
    assert.equal(writeLocked, true);
    assert.equal(rw.isWriteLocked, true);
    rw.releaseWrite();
  });

  it('acquireWrite blocks when another writer holds the lock', async () => {
    const rw = new ReadWriteLock();
    await rw.acquireWrite();

    let secondWriter = false;
    const pending = rw.acquireWrite().then(() => { secondWriter = true; });

    assert.equal(secondWriter, false);
    assert.equal(rw.waitingWriters, 1);

    rw.releaseWrite();
    await pending;
    assert.equal(secondWriter, true);
    rw.releaseWrite();
  });

  it('releaseWrite throws when no writer', () => {
    const rw = new ReadWriteLock();
    assert.throws(() => rw.releaseWrite(), /releaseWrite called without/);
  });
});

describe('ReadWriteLock – writer priority', () => {
  it('new readers wait when writers are queued', async () => {
    const rw = new ReadWriteLock();
    await rw.acquireRead();

    // Queue a writer
    let writerDone = false;
    const writerP = rw.acquireWrite().then(() => { writerDone = true; });

    // Queue a reader after the writer
    let readerDone = false;
    const readerP = rw.acquireRead().then(() => { readerDone = true; });

    assert.equal(rw.waitingWriters, 1);
    assert.equal(rw.waitingReaders, 1);

    // Release the initial read lock — writer should get priority
    rw.releaseRead();
    await writerP;
    assert.equal(writerDone, true);
    // Reader should still be waiting because writer is active
    assert.equal(readerDone, false);

    rw.releaseWrite();
    await readerP;
    assert.equal(readerDone, true);
    rw.releaseRead();
  });

  it('releaseWrite wakes all waiting readers when no writers queued', async () => {
    const rw = new ReadWriteLock();
    await rw.acquireWrite();

    const results = [];
    const p1 = rw.acquireRead().then(() => results.push('r1'));
    const p2 = rw.acquireRead().then(() => results.push('r2'));

    assert.equal(rw.waitingReaders, 2);

    rw.releaseWrite();
    await Promise.all([p1, p2]);
    assert.equal(results.length, 2);
    assert.equal(rw.readers, 2);

    rw.releaseRead();
    rw.releaseRead();
  });
});

describe('ReadWriteLock – withReadLock / withWriteLock helpers', () => {
  it('withReadLock acquires and releases around fn', async () => {
    const rw = new ReadWriteLock();
    const result = await withReadLock(rw, () => {
      assert.equal(rw.readers, 1);
      return 42;
    });
    assert.equal(result, 42);
    assert.equal(rw.readers, 0);
  });

  it('withReadLock releases even on error', async () => {
    const rw = new ReadWriteLock();
    await assert.rejects(
      () => withReadLock(rw, () => { throw new Error('boom'); }),
      { message: 'boom' },
    );
    assert.equal(rw.readers, 0);
  });

  it('withWriteLock acquires and releases around fn', async () => {
    const rw = new ReadWriteLock();
    const result = await withWriteLock(rw, async () => {
      assert.equal(rw.isWriteLocked, true);
      return 'done';
    });
    assert.equal(result, 'done');
    assert.equal(rw.isWriteLocked, false);
  });

  it('withWriteLock releases even on error', async () => {
    const rw = new ReadWriteLock();
    await assert.rejects(
      () => withWriteLock(rw, () => { throw new Error('fail'); }),
      { message: 'fail' },
    );
    assert.equal(rw.isWriteLocked, false);
  });
});

describe('ReadWriteLock – createReadWriteLock factory', () => {
  it('returns a ReadWriteLock instance', () => {
    const rw = createReadWriteLock();
    assert.ok(rw instanceof ReadWriteLock);
    assert.equal(rw.readers, 0);
    assert.equal(rw.isWriteLocked, false);
  });
});
