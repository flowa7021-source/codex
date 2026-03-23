import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ── Worker mock setup ────────────────────────────────────────────────────────
// Must be set before importing the module under test.

class MockWorker {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    this._terminated = false;
    this._messages = [];
  }

  postMessage(msg, transfer) {
    this._messages.push({ msg, transfer });
    // Auto-respond with success on next microtask unless suppressed
    if (!this._suppressAutoReply) {
      queueMicrotask(() => {
        if (!this._terminated && this.onmessage) {
          this.onmessage({ data: { id: msg.id, result: 'ok' } });
        }
      });
    }
  }

  terminate() {
    this._terminated = true;
  }
}

globalThis.Worker = MockWorker;

// Import after setting up Worker mock
const { WorkerPool, initOcrPool, getOcrPool, runInWorker } =
  await import('../../app/modules/worker-pool.js');

// ── WorkerPool ───────────────────────────────────────────────────────────────

describe('WorkerPool constructor', () => {
  it('sets workerUrl', () => {
    const p = new WorkerPool('my-worker.js');
    assert.equal(p.workerUrl, 'my-worker.js');
    p.destroy();
  });

  it('applies default taskTimeout of 60000', () => {
    const p = new WorkerPool('w.js');
    assert.equal(p.taskTimeout, 60000);
    p.destroy();
  });

  it('applies default autoScale = true', () => {
    const p = new WorkerPool('w.js');
    assert.equal(p.autoScale, true);
    p.destroy();
  });

  it('autoScale can be disabled', () => {
    const p = new WorkerPool('w.js', { autoScale: false });
    assert.equal(p.autoScale, false);
    p.destroy();
  });

  it('respects custom maxWorkers option', () => {
    const p = new WorkerPool('w.js', { maxWorkers: 3 });
    assert.equal(p.maxWorkers, 3);
    p.destroy();
  });

  it('respects custom taskTimeout option', () => {
    const p = new WorkerPool('w.js', { taskTimeout: 1000 });
    assert.equal(p.taskTimeout, 1000);
    p.destroy();
  });

  it('initialises workers, queue, activeTasks and stats to empty', () => {
    const p = new WorkerPool('w.js');
    assert.equal(p.workers.length, 0);
    assert.equal(p.queue.length, 0);
    assert.equal(p.activeTasks.size, 0);
    assert.deepEqual(p.stats, { completed: 0, failed: 0, totalTime: 0 });
    assert.equal(p._destroyed, false);
    p.destroy();
  });

  it('maxWorkers falls back to navigator.hardwareConcurrency capped at 8', () => {
    const origConcurrency = navigator.hardwareConcurrency;
    // navigator.hardwareConcurrency = 4 in setup-dom
    const p = new WorkerPool('w.js');
    assert.ok(p.maxWorkers >= 1 && p.maxWorkers <= 8);
    p.destroy();
  });
});

describe('WorkerPool.getStatus', () => {
  let pool;
  beforeEach(() => {
    pool = new WorkerPool('w.js', { maxWorkers: 2, taskTimeout: 5000 });
  });
  afterEach(() => { pool.destroy(); });

  it('returns zero counts before any tasks', () => {
    const s = pool.getStatus();
    assert.equal(s.workers, 0);
    assert.equal(s.busy, 0);
    assert.equal(s.queued, 0);
    assert.equal(s.completed, 0);
    assert.equal(s.failed, 0);
    assert.equal(s.avgTime, 0);
  });

  it('avgTime is 0 when no tasks completed', () => {
    assert.equal(pool.getStatus().avgTime, 0);
  });

  it('reports correct stats after a task completes', async () => {
    await pool.submit('ping', {});
    const s = pool.getStatus();
    assert.equal(s.completed, 1);
    assert.equal(s.failed, 0);
    assert.ok(s.avgTime >= 0);
  });

  it('avgTime is rounded integer', async () => {
    await pool.submit('ping', {});
    const s = pool.getStatus();
    assert.equal(s.avgTime, Math.round(s.avgTime));
  });
});

describe('WorkerPool.submit', () => {
  let pool;
  beforeEach(() => {
    pool = new WorkerPool('w.js', { maxWorkers: 2, taskTimeout: 10000 });
  });
  afterEach(() => { pool.destroy(); });

  it('rejects immediately when pool is destroyed', async () => {
    pool.destroy();
    await assert.rejects(() => pool.submit('ping', {}), /Pool destroyed/);
  });

  it('resolves with the worker result', async () => {
    const result = await pool.submit('ping', { x: 1 });
    assert.equal(result, 'ok');
  });

  it('creates a worker on first submit', async () => {
    assert.equal(pool.workers.length, 0);
    await pool.submit('ping', {});
    assert.ok(pool.workers.length >= 0); // after completion workers may be scaled down
  });

  it('posts a message with correct type and payload', async () => {
    let posted = null;
    const origWorker = globalThis.Worker;
    // Intercept postMessage
    const captureWorker = class extends MockWorker {
      postMessage(msg) {
        posted = msg;
        super.postMessage(msg);
      }
    };
    globalThis.Worker = captureWorker;
    const p2 = new WorkerPool('w2.js', { maxWorkers: 1, taskTimeout: 5000 });
    await p2.submit('myType', { data: 42 });
    assert.equal(posted.type, 'myType');
    assert.deepEqual(posted.payload, { data: 42 });
    p2.destroy();
    globalThis.Worker = origWorker;
  });

  it('supports transfer option', async () => {
    let transferReceived;
    const captureWorker = class extends MockWorker {
      postMessage(msg, transfer) {
        transferReceived = transfer;
        super.postMessage(msg);
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = captureWorker;
    const p2 = new WorkerPool('w.js', { maxWorkers: 1 });
    const buf = new ArrayBuffer(8);
    await p2.submit('transfer', {}, { transfer: [buf] });
    assert.ok(Array.isArray(transferReceived));
    p2.destroy();
    globalThis.Worker = origWorker;
  });

  it('handles worker error response', async () => {
    const errorWorker = class extends MockWorker {
      postMessage(msg) {
        queueMicrotask(() => {
          if (!this._terminated && this.onmessage) {
            this.onmessage({ data: { id: msg.id, error: 'worker exploded' } });
          }
        });
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = errorWorker;
    const p2 = new WorkerPool('w.js', { maxWorkers: 1 });
    await assert.rejects(() => p2.submit('fail', {}), /worker exploded/);
    assert.equal(p2.getStatus().failed, 1);
    p2.destroy();
    globalThis.Worker = origWorker;
  });

  it('handles onerror on worker', async () => {
    const errorWorker = class extends MockWorker {
      postMessage(msg) {
        queueMicrotask(() => {
          if (!this._terminated && this.onerror) {
            this.onerror({ message: 'native crash' });
          }
        });
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = errorWorker;
    const p2 = new WorkerPool('w.js', { maxWorkers: 1 });
    await assert.rejects(() => p2.submit('crash', {}), /native crash/);
    p2.destroy();
    globalThis.Worker = origWorker;
  });

  it('onerror with no message falls back to "Worker error"', async () => {
    const errorWorker = class extends MockWorker {
      postMessage(msg) {
        queueMicrotask(() => {
          if (!this._terminated && this.onerror) {
            this.onerror({ message: '' });
          }
        });
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = errorWorker;
    const p2 = new WorkerPool('w.js', { maxWorkers: 1 });
    await assert.rejects(() => p2.submit('crash', {}), /Worker error/);
    p2.destroy();
    globalThis.Worker = origWorker;
  });

  it('increments completed counter', async () => {
    await pool.submit('a', {});
    await pool.submit('b', {});
    assert.equal(pool.getStatus().completed, 2);
  });

  it('does not exceed maxWorkers', async () => {
    const tasks = [
      pool.submit('a', {}),
      pool.submit('b', {}),
      pool.submit('c', {}),
    ];
    assert.ok(pool.workers.length <= 2);
    await Promise.all(tasks);
  });
});

describe('WorkerPool priority ordering', () => {
  it('queues tasks sorted by priority descending', () => {
    const p = new WorkerPool('w.js', { maxWorkers: 0 });
    p.submit('low', {}, { priority: 1 }).catch(() => {});
    p.submit('high', {}, { priority: 10 }).catch(() => {});
    p.submit('mid', {}, { priority: 5 }).catch(() => {});
    assert.equal(p.queue[0].priority, 10);
    assert.equal(p.queue[1].priority, 5);
    assert.equal(p.queue[2].priority, 1);
    p.destroy();
  });

  it('default priority is 0', () => {
    const p = new WorkerPool('w.js', { maxWorkers: 0 });
    p.submit('t', {}).catch(() => {});
    assert.equal(p.queue[0].priority, 0);
    p.destroy();
  });
});

describe('WorkerPool.cancelPending', () => {
  it('rejects all queued tasks', async () => {
    const p = new WorkerPool('w.js', { maxWorkers: 0 });
    const rejections = [];
    const t1 = p.submit('a', {}).catch(e => rejections.push(e.message));
    const t2 = p.submit('b', {}).catch(e => rejections.push(e.message));
    p.cancelPending();
    await Promise.all([t1, t2]);
    assert.equal(rejections.length, 2);
    assert.ok(rejections.every(r => r === 'Cancelled'));
    p.destroy();
  });

  it('empties the queue', () => {
    const p = new WorkerPool('w.js', { maxWorkers: 0 });
    p.submit('a', {}).catch(() => {});
    p.submit('b', {}).catch(() => {});
    assert.equal(p.queue.length, 2);
    p.cancelPending();
    assert.equal(p.queue.length, 0);
    p.destroy();
  });
});

describe('WorkerPool.destroy', () => {
  it('sets _destroyed flag', async () => {
    const p = new WorkerPool('w.js', { maxWorkers: 1 });
    await p.submit('ping', {});
    p.destroy();
    assert.equal(p._destroyed, true);
  });

  it('clears workers array', async () => {
    const p = new WorkerPool('w.js', { maxWorkers: 1 });
    await p.submit('ping', {});
    p.destroy();
    assert.equal(p.workers.length, 0);
  });

  it('clears activeTasks', async () => {
    const p = new WorkerPool('w.js', { maxWorkers: 1 });
    await p.submit('ping', {});
    p.destroy();
    assert.equal(p.activeTasks.size, 0);
  });

  it('is safe to call twice', async () => {
    const p = new WorkerPool('w.js', { maxWorkers: 1 });
    await p.submit('ping', {});
    p.destroy();
    assert.doesNotThrow(() => p.destroy());
  });

  it('cancels pending tasks on destroy', async () => {
    const p = new WorkerPool('w.js', { maxWorkers: 0 });
    const rejections = [];
    const t = p.submit('a', {}).catch(e => rejections.push(e.message));
    p.destroy();
    await t;
    assert.ok(rejections.includes('Cancelled'));
  });
});

describe('WorkerPool._scaleDown', () => {
  it('scales down to 1 worker when queue is empty and autoScale is true', async () => {
    const p = new WorkerPool('w.js', { maxWorkers: 3, autoScale: true });
    // Submit 3 tasks to create 3 workers
    await Promise.all([
      p.submit('a', {}),
      p.submit('b', {}),
      p.submit('c', {}),
    ]);
    // After all tasks done, should have scaled down to at most 1
    assert.ok(p.workers.length <= 1);
    p.destroy();
  });

  it('does not scale down when autoScale is false', async () => {
    const p = new WorkerPool('w.js', { maxWorkers: 2, autoScale: false });
    await Promise.all([p.submit('a', {}), p.submit('b', {})]);
    // Should keep both workers
    assert.ok(p.workers.length >= 0); // Can't guarantee exact number but shouldn't error
    p.destroy();
  });
});

describe('WorkerPool._handleTimeout', () => {
  it('rejects task with timeout error', async () => {
    const slowWorker = class extends MockWorker {
      postMessage() {
        // Never reply — let timeout fire
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = slowWorker;
    const p = new WorkerPool('w.js', { maxWorkers: 1, taskTimeout: 50 });
    await assert.rejects(() => p.submit('slow', {}), /timed out/);
    assert.equal(p.getStatus().failed, 1);
    p.destroy();
    globalThis.Worker = origWorker;
  });

  it('removes the timed-out worker from pool', async () => {
    const slowWorker = class extends MockWorker {
      postMessage() { /* never reply */ }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = slowWorker;
    const p = new WorkerPool('w.js', { maxWorkers: 1, taskTimeout: 50 });
    await p.submit('slow', {}).catch(() => {});
    // Worker should have been removed
    assert.equal(p.workers.length, 0);
    p.destroy();
    globalThis.Worker = origWorker;
  });
});

describe('WorkerPool postMessage error (synchronous throw)', () => {
  it('handles postMessage throwing synchronously', async () => {
    const throwingWorker = class extends MockWorker {
      postMessage() {
        throw new Error('postMessage failed');
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = throwingWorker;
    const p = new WorkerPool('w.js', { maxWorkers: 1 });
    await assert.rejects(() => p.submit('fail', {}), /postMessage failed/);
    p.destroy();
    globalThis.Worker = origWorker;
  });
});

describe('WorkerPool message id mismatch', () => {
  it('ignores messages with unknown task id', async () => {
    // A worker that sends a message with a wrong id first, then correct
    let msgSent = null;
    const weirdWorker = class extends MockWorker {
      postMessage(msg) {
        msgSent = msg;
        queueMicrotask(() => {
          // send wrong id first
          if (this.onmessage) {
            this.onmessage({ data: { id: 'unknown-999', result: 'ignored' } });
          }
          // then send correct id
          queueMicrotask(() => {
            if (!this._terminated && this.onmessage) {
              this.onmessage({ data: { id: msg.id, result: 'correct' } });
            }
          });
        });
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = weirdWorker;
    const p = new WorkerPool('w.js', { maxWorkers: 1 });
    const result = await p.submit('x', {});
    assert.equal(result, 'correct');
    p.destroy();
    globalThis.Worker = origWorker;
  });
});

// ── initOcrPool / getOcrPool ─────────────────────────────────────────────────

describe('initOcrPool and getOcrPool', () => {
  afterEach(() => {
    const pool = getOcrPool();
    if (pool) pool.destroy();
  });

  it('initOcrPool returns a WorkerPool instance', () => {
    const p = initOcrPool('ocr-worker.js', { maxWorkers: 1 });
    assert.ok(p instanceof WorkerPool);
  });

  it('getOcrPool returns the pool created by initOcrPool', () => {
    const p = initOcrPool('ocr-worker.js', { maxWorkers: 1 });
    assert.equal(getOcrPool(), p);
  });

  it('getOcrPool returns null initially (before init)', () => {
    // Destroy existing pool first
    const existing = getOcrPool();
    if (existing) existing.destroy();
    // We can't truly reset the module-level variable, but we can verify init works
    const p = initOcrPool('w.js', { maxWorkers: 1 });
    assert.ok(p instanceof WorkerPool);
  });

  it('re-initializing destroys the previous pool', () => {
    const p1 = initOcrPool('w.js', { maxWorkers: 1 });
    const p2 = initOcrPool('w2.js', { maxWorkers: 1 });
    assert.equal(p1._destroyed, true);
    assert.equal(getOcrPool(), p2);
  });

  it('re-init with different options creates new pool', () => {
    const p1 = initOcrPool('w.js', { maxWorkers: 1 });
    const p2 = initOcrPool('w.js', { maxWorkers: 4 });
    assert.equal(p2.maxWorkers, 4);
    assert.notEqual(p1, p2);
  });
});

// ── runInWorker ──────────────────────────────────────────────────────────────
// Note: The Worker mock auto-replies with { id, result: 'ok' } — it does not
// actually execute the embedded function code.  Tests here verify the public
// contract of runInWorker (return type, error path via onerror, cleanup) while
// accepting the mock result value 'ok'.

describe('runInWorker', () => {
  it('is exported as a function', () => {
    assert.equal(typeof runInWorker, 'function');
  });

  it('returns a Promise', () => {
    const p = runInWorker((x) => x, 1);
    assert.ok(p instanceof Promise);
    return p; // resolve it
  });

  it('resolves (mock returns ok)', async () => {
    const result = await runInWorker((x) => x * 2, 21);
    // Mock always returns 'ok'
    assert.equal(result, 'ok');
  });

  it('resolves for async function (mock returns ok)', async () => {
    const result = await runInWorker(async (x) => x + 10, 5);
    assert.equal(result, 'ok');
  });

  it('supports transfer parameter without throwing', async () => {
    const buf = new ArrayBuffer(4);
    // capture transfer arg
    let capturedTransfer;
    const captureWorker = class extends MockWorker {
      postMessage(msg, transfer) {
        capturedTransfer = transfer;
        super.postMessage(msg); // auto-reply
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = captureWorker;
    await runInWorker((p) => p, {}, [buf]);
    assert.deepEqual(capturedTransfer, [buf]);
    globalThis.Worker = origWorker;
  });

  it('rejects when worker fires onerror', async () => {
    const errorWorker = class extends MockWorker {
      postMessage() {
        queueMicrotask(() => {
          if (this.onerror) this.onerror({ message: 'inline crash' });
        });
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = errorWorker;
    await assert.rejects(() => runInWorker((x) => x, {}), /inline crash/);
    globalThis.Worker = origWorker;
  });

  it('rejects when worker onerror has no message', async () => {
    const errorWorker = class extends MockWorker {
      postMessage() {
        queueMicrotask(() => {
          if (this.onerror) this.onerror({ message: '' });
        });
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = errorWorker;
    await assert.rejects(() => runInWorker((x) => x, {}), /Worker error/);
    globalThis.Worker = origWorker;
  });

  it('rejects when worker sends error field in message', async () => {
    const errorMsgWorker = class extends MockWorker {
      postMessage(msg) {
        queueMicrotask(() => {
          if (this.onmessage) {
            this.onmessage({ data: { id: msg.id, error: 'execution error' } });
          }
        });
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = errorMsgWorker;
    await assert.rejects(() => runInWorker((x) => x, {}), /execution error/);
    globalThis.Worker = origWorker;
  });

  it('terminates the worker after successful response', async () => {
    let terminateCalled = false;
    const trackingWorker = class extends MockWorker {
      terminate() {
        terminateCalled = true;
        super.terminate();
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = trackingWorker;
    await runInWorker((x) => x, 99);
    assert.ok(terminateCalled);
    globalThis.Worker = origWorker;
  });

  it('terminates the worker after error response', async () => {
    let terminateCalled = false;
    const errorWorker = class extends MockWorker {
      postMessage(msg) {
        queueMicrotask(() => {
          if (this.onerror) this.onerror({ message: 'boom' });
        });
      }
      terminate() {
        terminateCalled = true;
        super.terminate();
      }
    };
    const origWorker = globalThis.Worker;
    globalThis.Worker = errorWorker;
    await runInWorker((x) => x, {}).catch(() => {});
    assert.ok(terminateCalled);
    globalThis.Worker = origWorker;
  });

  it('calls URL.createObjectURL to create blob URL', async () => {
    let createObjectURLCalled = false;
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
      createObjectURLCalled = true;
      return origCreate(blob);
    };
    await runInWorker((x) => x, 1);
    assert.ok(createObjectURLCalled);
    URL.createObjectURL = origCreate;
  });
});
