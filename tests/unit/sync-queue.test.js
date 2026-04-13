// ─── Unit Tests: SyncQueue ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SyncQueue } from '../../app/modules/sync-queue.js';

// ─── enqueue ──────────────────────────────────────────────────────────────────

describe('SyncQueue – enqueue', () => {
  it('adds item with pending status', () => {
    const queue = new SyncQueue();
    const item = queue.enqueue('create', { id: 1 });
    assert.equal(item.status, 'pending');
    assert.equal(item.operation, 'create');
    assert.deepEqual(item.payload, { id: 1 });
    assert.equal(item.attempts, 0);
  });

  it('assigns a unique id to each item', () => {
    const queue = new SyncQueue();
    const a = queue.enqueue('op', {});
    const b = queue.enqueue('op', {});
    assert.notEqual(a.id, b.id);
  });

  it('sets createdAt timestamp', () => {
    const before = Date.now();
    const queue = new SyncQueue();
    const item = queue.enqueue('op', null);
    const after = Date.now();
    assert.ok(item.createdAt >= before && item.createdAt <= after);
  });

  it('uses queue maxAttempts for the item', () => {
    const queue = new SyncQueue({ maxAttempts: 5 });
    const item = queue.enqueue('op', {});
    assert.equal(item.maxAttempts, 5);
  });
});

// ─── process ──────────────────────────────────────────────────────────────────

describe('SyncQueue – process', () => {
  it('calls syncFn for pending items and marks them synced', async () => {
    const queue = new SyncQueue();
    queue.enqueue('save', { data: 'abc' });

    const called = [];
    await queue.process(async (item) => {
      called.push(item.operation);
    });

    assert.deepEqual(called, ['save']);
    assert.equal(queue.syncedCount, 1);
    assert.equal(queue.pendingCount, 0);
  });

  it('does not call syncFn for already-synced items', async () => {
    const queue = new SyncQueue();
    queue.enqueue('op1', {});

    // First process — syncs the item
    await queue.process(async () => {});

    const called = [];
    // Second process — should not re-process
    await queue.process(async (item) => {
      called.push(item.id);
    });

    assert.equal(called.length, 0);
  });

  it('sets lastAttemptAt on each processed item', async () => {
    const queue = new SyncQueue();
    queue.enqueue('op', {});

    const before = Date.now();
    await queue.process(async () => {});
    const after = Date.now();

    const [item] = queue.getAll();
    assert.ok(item.lastAttemptAt !== undefined);
    assert.ok(item.lastAttemptAt >= before && item.lastAttemptAt <= after);
  });
});

// ─── failed item ──────────────────────────────────────────────────────────────

describe('SyncQueue – failed item', () => {
  it('marks item as failed after maxAttempts exhausted', async () => {
    const queue = new SyncQueue({ maxAttempts: 1 });
    queue.enqueue('op', {});

    await queue.process(async () => {
      throw new Error('network error');
    });

    const [item] = queue.getAll();
    assert.equal(item.status, 'failed');
    assert.equal(item.attempts, 1);
  });

  it('stores the error message on the failed item', async () => {
    const queue = new SyncQueue({ maxAttempts: 1 });
    queue.enqueue('op', {});

    await queue.process(async () => {
      throw new Error('timeout');
    });

    const [item] = queue.getAll();
    assert.equal(item.error, 'timeout');
  });

  it('stores non-Error thrown values as strings', async () => {
    const queue = new SyncQueue({ maxAttempts: 1 });
    queue.enqueue('op', {});

    await queue.process(async () => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });

    const [item] = queue.getAll();
    assert.equal(item.error, 'string error');
  });
});

// ─── retry ────────────────────────────────────────────────────────────────────

describe('SyncQueue – retry', () => {
  it('failed item is retried on next process call if attempts < maxAttempts', async () => {
    const queue = new SyncQueue({ maxAttempts: 3, retryDelayMs: 0 });
    queue.enqueue('op', {});

    let calls = 0;

    // First process — fail
    await queue.process(async () => {
      calls++;
      throw new Error('fail');
    });

    assert.equal(calls, 1);

    const [item] = queue.getAll();
    assert.equal(item.status, 'failed');
    assert.equal(item.attempts, 1);

    // Second process — retry
    await queue.process(async () => {
      calls++;
      throw new Error('fail again');
    });

    assert.equal(calls, 2);
    assert.equal(item.attempts, 2);
  });

  it('eventually syncs on successful retry', async () => {
    const queue = new SyncQueue({ maxAttempts: 3, retryDelayMs: 0 });
    queue.enqueue('op', {});

    let calls = 0;
    const tryProcess = () =>
      queue.process(async () => {
        calls++;
        if (calls < 3) throw new Error('not yet');
      });

    await tryProcess(); // fail (attempt 1)
    await tryProcess(); // fail (attempt 2)
    await tryProcess(); // succeed (attempt 3)

    const [item] = queue.getAll();
    assert.equal(item.status, 'synced');
    assert.equal(item.attempts, 3);
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('SyncQueue – getAll', () => {
  it('returns all items regardless of status', async () => {
    const queue = new SyncQueue({ maxAttempts: 1 });
    queue.enqueue('op1', {});
    queue.enqueue('op2', {});

    let first = true;
    await queue.process(async () => {
      if (first) { first = false; throw new Error('fail'); }
    });

    const all = queue.getAll();
    assert.equal(all.length, 2);
  });

  it('returns a copy — mutations do not affect the queue', () => {
    const queue = new SyncQueue();
    queue.enqueue('op', {});
    const all = queue.getAll();
    all.pop();
    assert.equal(queue.getAll().length, 1);
  });
});

// ─── getByStatus ──────────────────────────────────────────────────────────────

describe('SyncQueue – getByStatus', () => {
  it('filters by status correctly', async () => {
    const queue = new SyncQueue({ maxAttempts: 1 });
    queue.enqueue('op1', {});
    queue.enqueue('op2', {});

    let first = true;
    await queue.process(async () => {
      if (first) { first = false; throw new Error('fail'); }
    });

    assert.equal(queue.getByStatus('failed').length, 1);
    assert.equal(queue.getByStatus('synced').length, 1);
    assert.equal(queue.getByStatus('pending').length, 0);
  });
});

// ─── clearSynced ──────────────────────────────────────────────────────────────

describe('SyncQueue – clearSynced', () => {
  it('removes only synced items', async () => {
    const queue = new SyncQueue({ maxAttempts: 1 });
    queue.enqueue('synced-op', {});
    queue.enqueue('pending-op', {});

    // Process both items — fail the second one
    let first = true;
    await queue.process(async () => {
      if (!first) throw new Error('keep failed');
      first = false;
    });

    // At this point: one synced, one failed
    queue.clearSynced();

    const all = queue.getAll();
    assert.equal(all.length, 1);
    assert.equal(all[0].status, 'failed');
  });

  it('does not remove pending or failed items', () => {
    const queue = new SyncQueue();
    queue.enqueue('p', {});
    queue.clearSynced();
    assert.equal(queue.getAll().length, 1);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('SyncQueue – clear', () => {
  it('removes all items', async () => {
    const queue = new SyncQueue();
    queue.enqueue('op1', {});
    queue.enqueue('op2', {});
    await queue.process(async () => {});
    queue.clear();
    assert.equal(queue.getAll().length, 0);
  });
});

// ─── counts ───────────────────────────────────────────────────────────────────

describe('SyncQueue – pendingCount/syncedCount/failedCount', () => {
  it('returns correct counts', async () => {
    const queue = new SyncQueue({ maxAttempts: 1 });

    queue.enqueue('a', {});
    queue.enqueue('b', {});
    queue.enqueue('c', {});

    assert.equal(queue.pendingCount, 3);
    assert.equal(queue.syncedCount, 0);
    assert.equal(queue.failedCount, 0);

    let calls = 0;
    await queue.process(async () => {
      calls++;
      if (calls === 2) throw new Error('fail b');
    });

    // After: a=synced, b=failed, c=synced
    assert.equal(queue.pendingCount, 0);
    assert.equal(queue.syncedCount, 2);
    assert.equal(queue.failedCount, 1);
  });
});
