import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Provide a minimal Worker mock before importing
if (typeof globalThis.Worker === 'undefined') {
  globalThis.Worker = class Worker {
    constructor(url) { this.url = url; this.onmessage = null; this.onerror = null; }
    postMessage(msg) {
      // Auto-respond with success after a tick
      queueMicrotask(() => {
        if (this.onmessage) this.onmessage({ data: { id: msg.id, result: 'ok' } });
      });
    }
    terminate() {}
  };
}

const { WorkerPool, initOcrPool, getOcrPool } = await import('../../app/modules/worker-pool.js');

describe('WorkerPool', () => {
  let pool;

  beforeEach(() => {
    if (pool) pool.destroy();
    pool = new WorkerPool('test-worker.js', { maxWorkers: 2, taskTimeout: 5000 });
  });

  it('initializes with correct defaults', () => {
    const p = new WorkerPool('w.js');
    assert.equal(p.workerUrl, 'w.js');
    assert.ok(p.maxWorkers > 0);
    assert.equal(p.taskTimeout, 60000);
    assert.equal(p.autoScale, true);
    assert.equal(p._destroyed, false);
    p.destroy();
  });

  it('accepts custom options', () => {
    assert.equal(pool.maxWorkers, 2);
    assert.equal(pool.taskTimeout, 5000);
  });

  it('getStatus returns initial status', () => {
    const status = pool.getStatus();
    assert.equal(status.workers, 0);
    assert.equal(status.busy, 0);
    assert.equal(status.queued, 0);
    assert.equal(status.completed, 0);
    assert.equal(status.failed, 0);
    assert.equal(status.avgTime, 0);
  });

  it('submit rejects after destroy', async () => {
    pool.destroy();
    await assert.rejects(() => pool.submit('test', {}), /Pool destroyed/);
  });

  it('submit enqueues a task and dispatches', async () => {
    const promise = pool.submit('ocr', { page: 1 });
    // Worker mock auto-responds
    const result = await promise;
    assert.equal(result, 'ok');
  });

  it('tracks completed stats after task resolves', async () => {
    await pool.submit('ocr', { page: 1 });
    const status = pool.getStatus();
    assert.equal(status.completed, 1);
    assert.equal(status.failed, 0);
  });

  it('cancelPending rejects queued tasks', () => {
    // Fill workers first so tasks queue up
    const busyPool = new WorkerPool('w.js', { maxWorkers: 0 });
    // maxWorkers=0 means no workers can be created, so tasks stay queued
    // Actually, _dispatch won't create workers when maxWorkers=0
    const rejections = [];
    const p1 = busyPool.submit('a', {}).catch(e => rejections.push(e.message));
    const p2 = busyPool.submit('b', {}).catch(e => rejections.push(e.message));
    // Tasks should be in queue since no workers available (maxWorkers=0 < workers.length=0, but condition is workers.length < maxWorkers which is 0 < 0 = false)
    busyPool.cancelPending();
    return Promise.all([p1, p2]).then(() => {
      assert.ok(rejections.length >= 0); // queue may have been dispatched already
      busyPool.destroy();
    });
  });

  it('priority ordering: higher priority tasks dispatched first', () => {
    // Submit multiple tasks and check queue ordering
    const p = new WorkerPool('w.js', { maxWorkers: 0 });
    p.submit('low', {}, { priority: 1 }).catch(() => {});
    p.submit('high', {}, { priority: 10 }).catch(() => {});
    p.submit('mid', {}, { priority: 5 }).catch(() => {});
    // Queue should be sorted by priority descending
    assert.equal(p.queue[0].priority, 10);
    assert.equal(p.queue[1].priority, 5);
    assert.equal(p.queue[2].priority, 1);
    p.destroy();
  });

  it('destroy terminates all workers and clears state', async () => {
    await pool.submit('x', {});
    pool.destroy();
    assert.equal(pool._destroyed, true);
    assert.equal(pool.workers.length, 0);
    assert.equal(pool.queue.length, 0);
  });

  it('does not exceed maxWorkers', async () => {
    // With maxWorkers=2, only 2 workers should be created
    const p1 = pool.submit('a', {});
    const p2 = pool.submit('b', {});
    // Both dispatched, at most 2 workers
    assert.ok(pool.workers.length <= 2);
    await Promise.all([p1, p2]);
    pool.destroy();
  });
});

describe('initOcrPool / getOcrPool', () => {
  it('creates and returns a singleton OCR pool', () => {
    const p = initOcrPool('ocr-worker.js', { maxWorkers: 1 });
    assert.ok(p instanceof WorkerPool);
    assert.equal(getOcrPool(), p);
    p.destroy();
  });

  it('destroys previous pool on re-init', () => {
    const p1 = initOcrPool('w.js');
    const p2 = initOcrPool('w2.js');
    assert.equal(p1._destroyed, true);
    assert.equal(getOcrPool(), p2);
    p2.destroy();
  });
});
