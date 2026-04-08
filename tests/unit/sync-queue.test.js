// ─── Unit Tests: Background Sync Queue ──────────────────────────────────────
import './setup-dom.js';

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isSyncSupported,
  enqueueSyncOperation,
  dequeueSyncOperation,
  getPendingCount,
  getAllPending,
  removeSyncOperation,
  clearAll,
  _resetDbForTesting,
} from '../../app/modules/sync-queue.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOp(overrides = {}) {
  return {
    type: 'upload',
    providerId: 'gdrive',
    fileName: 'test.pdf',
    ...overrides,
  };
}

function deleteIdbDatabase(name) {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    if (req.onerror) req.onerror = () => resolve();
  });
}

// ── Reset DB state before each test ──────────────────────────────────────────

beforeEach(async () => {
  // Reset the module-level DB reference so a fresh DB is opened
  _resetDbForTesting();
  // Delete the in-memory IDB database so stores are recreated fresh
  await deleteIdbDatabase('novareader-sync');
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('sync-queue — isSyncSupported', () => {
  it('returns a boolean', () => {
    const result = isSyncSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns false in Node.js test environment (no SyncManager)', () => {
    // Node.js doesn't have SyncManager, so this should be false
    assert.equal(isSyncSupported(), false);
  });
});

describe('sync-queue — enqueueSyncOperation', () => {
  it('returns a string ID', async () => {
    const id = await enqueueSyncOperation(makeOp());
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });

  it('returns unique IDs for each operation', async () => {
    const id1 = await enqueueSyncOperation(makeOp({ fileName: 'a.pdf' }));
    const id2 = await enqueueSyncOperation(makeOp({ fileName: 'b.pdf' }));
    assert.notEqual(id1, id2);
  });

  it('increments pending count after enqueue', async () => {
    assert.equal(await getPendingCount(), 0);
    await enqueueSyncOperation(makeOp());
    assert.equal(await getPendingCount(), 1);
    await enqueueSyncOperation(makeOp());
    assert.equal(await getPendingCount(), 2);
  });

  it('stores all provided fields', async () => {
    const op = makeOp({ type: 'download', fileId: 'file-abc', mimeType: 'application/pdf' });
    await enqueueSyncOperation(op);

    const all = await getAllPending();
    assert.equal(all.length, 1);
    assert.equal(all[0].type, 'download');
    assert.equal(all[0].providerId, 'gdrive');
    assert.equal(all[0].fileId, 'file-abc');
    assert.equal(all[0].mimeType, 'application/pdf');
    assert.equal(typeof all[0].createdAt, 'number');
    assert.equal(all[0].retries, 0);
  });
});

describe('sync-queue — dequeueSyncOperation', () => {
  it('returns null for an empty queue', async () => {
    const op = await dequeueSyncOperation();
    assert.equal(op, null);
  });

  it('returns the oldest operation (FIFO order)', async () => {
    // Enqueue with slight time difference to guarantee ordering
    const id1 = await enqueueSyncOperation(makeOp({ fileName: 'first.pdf' }));
    // Force a timestamp difference by manipulating Date - but since mock IDB
    // uses structuredClone, createdAt will be real. Add a small delay via
    // queueMicrotask isn't enough; instead enqueue and rely on Date.now()
    // incrementing or use explicit createdAt via a direct put.
    const id2 = await enqueueSyncOperation(makeOp({ fileName: 'second.pdf' }));

    const first = await dequeueSyncOperation();
    assert.ok(first);
    assert.equal(first.id, id1);
    assert.equal(first.fileName, 'first.pdf');
  });

  it('does NOT remove the operation from the queue', async () => {
    await enqueueSyncOperation(makeOp());
    assert.equal(await getPendingCount(), 1);

    await dequeueSyncOperation();

    // Still 1 because dequeue only peeks
    assert.equal(await getPendingCount(), 1);
  });

  it('returns the same operation on repeated calls', async () => {
    const id = await enqueueSyncOperation(makeOp());
    const op1 = await dequeueSyncOperation();
    const op2 = await dequeueSyncOperation();
    assert.equal(op1.id, id);
    assert.equal(op2.id, id);
  });
});

describe('sync-queue — getPendingCount', () => {
  it('returns 0 for empty queue', async () => {
    assert.equal(await getPendingCount(), 0);
  });

  it('returns correct count after multiple enqueues', async () => {
    await enqueueSyncOperation(makeOp());
    await enqueueSyncOperation(makeOp());
    await enqueueSyncOperation(makeOp());
    assert.equal(await getPendingCount(), 3);
  });

  it('decrements after removeSyncOperation', async () => {
    const id = await enqueueSyncOperation(makeOp());
    assert.equal(await getPendingCount(), 1);
    await removeSyncOperation(id);
    assert.equal(await getPendingCount(), 0);
  });
});

describe('sync-queue — getAllPending', () => {
  it('returns empty array for empty queue', async () => {
    const all = await getAllPending();
    assert.deepEqual(all, []);
  });

  it('returns all operations sorted by createdAt ascending', async () => {
    const id1 = await enqueueSyncOperation(makeOp({ fileName: 'a.pdf' }));
    const id2 = await enqueueSyncOperation(makeOp({ fileName: 'b.pdf' }));
    const id3 = await enqueueSyncOperation(makeOp({ fileName: 'c.pdf' }));

    const all = await getAllPending();
    assert.equal(all.length, 3);

    // Verify sorted order (createdAt ascending)
    for (let i = 1; i < all.length; i++) {
      assert.ok(all[i].createdAt >= all[i - 1].createdAt);
    }

    // IDs should be present
    const ids = all.map(op => op.id);
    assert.ok(ids.includes(id1));
    assert.ok(ids.includes(id2));
    assert.ok(ids.includes(id3));
  });

  it('returns operations with all required fields', async () => {
    await enqueueSyncOperation({
      type: 'delete',
      providerId: 'dropbox',
      fileId: 'xyz',
      fileName: 'file.docx',
    });

    const all = await getAllPending();
    assert.equal(all.length, 1);
    const op = all[0];
    assert.ok(op.id);
    assert.equal(op.type, 'delete');
    assert.equal(op.providerId, 'dropbox');
    assert.equal(op.fileId, 'xyz');
    assert.equal(op.fileName, 'file.docx');
    assert.equal(typeof op.createdAt, 'number');
    assert.equal(op.retries, 0);
  });
});

describe('sync-queue — removeSyncOperation', () => {
  it('removes the operation with the given ID', async () => {
    const id1 = await enqueueSyncOperation(makeOp({ fileName: 'keep.pdf' }));
    const id2 = await enqueueSyncOperation(makeOp({ fileName: 'remove.pdf' }));

    await removeSyncOperation(id2);

    const all = await getAllPending();
    assert.equal(all.length, 1);
    assert.equal(all[0].id, id1);
  });

  it('does not throw when removing a non-existent ID', async () => {
    await assert.doesNotReject(() => removeSyncOperation('nonexistent-id'));
  });

  it('leaves other operations intact', async () => {
    const id1 = await enqueueSyncOperation(makeOp({ fileName: 'a.pdf' }));
    const id2 = await enqueueSyncOperation(makeOp({ fileName: 'b.pdf' }));
    const id3 = await enqueueSyncOperation(makeOp({ fileName: 'c.pdf' }));

    await removeSyncOperation(id2);

    const all = await getAllPending();
    const ids = all.map(op => op.id);
    assert.ok(ids.includes(id1));
    assert.ok(!ids.includes(id2));
    assert.ok(ids.includes(id3));
  });
});

describe('sync-queue — clearAll', () => {
  it('empties the queue', async () => {
    await enqueueSyncOperation(makeOp());
    await enqueueSyncOperation(makeOp());
    await clearAll();
    assert.equal(await getPendingCount(), 0);
    assert.deepEqual(await getAllPending(), []);
  });

  it('does not throw on empty queue', async () => {
    await assert.doesNotReject(() => clearAll());
  });

  it('returns null from dequeueSyncOperation after clearAll', async () => {
    await enqueueSyncOperation(makeOp());
    await clearAll();
    const op = await dequeueSyncOperation();
    assert.equal(op, null);
  });
});

describe('sync-queue — persistence across dequeue calls', () => {
  it('operations persist across multiple dequeueSyncOperation calls', async () => {
    const id1 = await enqueueSyncOperation(makeOp({ fileName: 'one.pdf' }));
    const id2 = await enqueueSyncOperation(makeOp({ fileName: 'two.pdf' }));

    // Dequeue does not remove items
    const peek1 = await dequeueSyncOperation();
    const peek2 = await dequeueSyncOperation();
    const peek3 = await dequeueSyncOperation();

    assert.equal(peek1.id, id1);
    assert.equal(peek2.id, id1); // same item still there
    assert.equal(peek3.id, id1); // still the same

    // Both items still in queue
    assert.equal(await getPendingCount(), 2);

    // Manually remove first, then dequeue should return second
    await removeSyncOperation(id1);
    const next = await dequeueSyncOperation();
    assert.equal(next.id, id2);
  });
});
