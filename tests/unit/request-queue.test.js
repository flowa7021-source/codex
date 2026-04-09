// ─── Unit Tests: RequestQueue ─────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { RequestQueue } from '../../app/modules/request-queue.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a promise that resolves after one microtask flush. */
function flushMicrotasks() {
  return new Promise(resolve => queueMicrotask(resolve));
}

/**
 * Returns a controllable mock fetch that can be resolved or rejected
 * per-call.  Each call pushes { resolve, reject, url, method } onto `calls`.
 */
function makeControllableFetch() {
  const calls = [];
  const fetch = (url, method) => {
    return new Promise((resolve, reject) => {
      calls.push({ url, method, resolve, reject });
    });
  };
  return { fetch, calls };
}

// ─── Constructor / defaults ───────────────────────────────────────────────────

describe('RequestQueue – constructor', () => {
  it('starts with pendingCount 0', () => {
    const q = new RequestQueue({ fetch: async () => 'ok' });
    assert.equal(q.pendingCount, 0);
  });

  it('accepts custom concurrency', async () => {
    const { fetch, calls } = makeControllableFetch();
    // concurrency=1: second enqueue should sit pending while first is running
    const q = new RequestQueue({ concurrency: 1, fetch });
    q.enqueue('http://a.com', 'GET').catch(() => {});
    q.enqueue('http://b.com', 'GET').catch(() => {});
    await flushMicrotasks();
    assert.equal(calls.length, 1);   // only one running
    assert.equal(q.pendingCount, 1); // one pending
    calls[0].resolve('a');
    await flushMicrotasks();
    await flushMicrotasks();
    calls[1].resolve('b');
  });
});

// ─── enqueue ─────────────────────────────────────────────────────────────────

describe('RequestQueue – enqueue()', () => {
  it('resolves with the fetch result', async () => {
    const q = new RequestQueue({ fetch: async () => ({ id: 1 }) });
    const result = await q.enqueue('http://example.com/api', 'GET');
    assert.deepEqual(result, { id: 1 });
  });

  it('defaults method to GET', async () => {
    const calls = [];
    const q = new RequestQueue({
      fetch: async (url, method) => { calls.push(method); return 'ok'; },
    });
    await q.enqueue('http://example.com/');
    assert.equal(calls[0], 'GET');
  });

  it('rejects when fetch rejects', async () => {
    const q = new RequestQueue({ fetch: async () => { throw new Error('network error'); } });
    await assert.rejects(
      () => q.enqueue('http://example.com/', 'GET', { dedupe: false }),
      /network error/,
    );
    await flushMicrotasks();
  });

  it('pendingCount decreases as requests complete', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ concurrency: 1, fetch });

    const p1 = q.enqueue('http://a.com').catch(() => {});
    const p2 = q.enqueue('http://b.com').catch(() => {});
    await flushMicrotasks();
    assert.equal(q.pendingCount, 1);

    calls[0].resolve('a');
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(q.pendingCount, 0);
    calls[1].resolve('b');
    await Promise.all([p1, p2]);
  });
});

// ─── deduplication ────────────────────────────────────────────────────────────

describe('RequestQueue – deduplication', () => {
  it('same URL+method returns the same promise while in-flight', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ fetch });

    const p1 = q.enqueue('http://example.com/data', 'GET');
    const p2 = q.enqueue('http://example.com/data', 'GET');
    assert.strictEqual(p1, p2);

    calls[0].resolve({ dedupe: true });
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.deepEqual(r1, { dedupe: true });
    assert.deepEqual(r2, { dedupe: true });
  });

  it('different methods are NOT deduplicated', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ fetch });

    const p1 = q.enqueue('http://example.com/x', 'GET');
    const p2 = q.enqueue('http://example.com/x', 'POST');
    assert.notStrictEqual(p1, p2);

    calls[0].resolve('get-result');
    calls[1].resolve('post-result');
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1, 'get-result');
    assert.equal(r2, 'post-result');
  });

  it('dedupe: false enqueues independent requests', async () => {
    const { fetch, calls } = makeControllableFetch();
    // concurrency: 4 so both run concurrently
    const q = new RequestQueue({ concurrency: 4, fetch });

    const p1 = q.enqueue('http://example.com/y', 'GET', { dedupe: false });
    const p2 = q.enqueue('http://example.com/y', 'GET', { dedupe: false });
    assert.notStrictEqual(p1, p2);

    calls[0].resolve('a');
    calls[1].resolve('b');
    await Promise.all([p1, p2]);
  });

  it('after completion, same URL re-enqueues a new request', async () => {
    let callCount = 0;
    const q = new RequestQueue({
      fetch: async () => { callCount++; return callCount; },
    });

    const r1 = await q.enqueue('http://example.com/z', 'GET');
    const r2 = await q.enqueue('http://example.com/z', 'GET');
    assert.equal(r1, 1);
    assert.equal(r2, 2);
    assert.equal(callCount, 2);
  });
});

// ─── priority ordering ────────────────────────────────────────────────────────

describe('RequestQueue – priority ordering', () => {
  it('higher priority requests run before lower priority', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ concurrency: 1, fetch });

    // Fill the one concurrency slot
    const blocker = q.enqueue('http://blocker.com', 'GET', { dedupe: false }).catch(() => {});
    await flushMicrotasks();

    const order = [];
    const pLow = q.enqueue('http://low.com', 'GET', { priority: 0, dedupe: false });
    const pHigh = q.enqueue('http://high.com', 'GET', { priority: 10, dedupe: false });
    const pMed = q.enqueue('http://med.com', 'GET', { priority: 5, dedupe: false });

    pLow.then(() => order.push('low')).catch(() => {});
    pHigh.then(() => order.push('high')).catch(() => {});
    pMed.then(() => order.push('med')).catch(() => {});

    // Resolve the blocker, then the remaining 3 in priority order
    calls[0].resolve('blocker');
    await flushMicrotasks(); await flushMicrotasks();
    calls[1].resolve('high');
    await flushMicrotasks(); await flushMicrotasks();
    calls[2].resolve('med');
    await flushMicrotasks(); await flushMicrotasks();
    calls[3].resolve('low');
    await Promise.all([pLow, pHigh, pMed]);

    assert.deepEqual(order, ['high', 'med', 'low']);
  });
});

// ─── cancel ───────────────────────────────────────────────────────────────────

describe('RequestQueue – cancel()', () => {
  it('returns false for unknown id', () => {
    const q = new RequestQueue({ fetch: async () => 'ok' });
    assert.equal(q.cancel('nonexistent'), false);
  });

  it('removes the pending request and rejects its promise', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ concurrency: 1, fetch });

    // Block the only slot
    q.enqueue('http://blocker.com', 'GET', { dedupe: false }).catch(() => {});
    await flushMicrotasks();

    const p = q.enqueue('http://to-cancel.com', 'GET', { dedupe: false });
    const ids = q.getAll().map(r => r.id);
    assert.equal(ids.length, 1);

    const cancelled = q.cancel(ids[0]);
    assert.equal(cancelled, true);
    assert.equal(q.pendingCount, 0);

    await assert.rejects(() => p, /cancelled/);
    calls[0].resolve('done');
  });

  it('returns false for already-running requests (not in pending list)', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ fetch });

    const p = q.enqueue('http://running.com', 'GET', { dedupe: false });
    await flushMicrotasks();
    // Request is now running, not in pending
    const allIds = q.getAll().map(r => r.id); // pending is empty
    assert.equal(allIds.length, 0);

    calls[0].resolve('done');
    await p;
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('RequestQueue – getAll()', () => {
  it('returns snapshots of all pending requests', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ concurrency: 1, fetch });

    q.enqueue('http://blocker.com', 'GET', { dedupe: false }).catch(() => {});
    await flushMicrotasks();

    q.enqueue('http://a.com', 'GET', { dedupe: false }).catch(() => {});
    q.enqueue('http://b.com', 'POST', { dedupe: false }).catch(() => {});

    const all = q.getAll();
    assert.equal(all.length, 2);
    assert.equal(all[0].url, 'http://a.com');
    assert.equal(all[1].url, 'http://b.com');
    assert.equal(all[0].status, 'pending');

    // Resolve sequentially: concurrency=1 means only one runs at a time
    calls[0].resolve('done');
    await flushMicrotasks(); await flushMicrotasks();
    // calls[1] is now the a.com request
    calls[1].resolve('a');
    await flushMicrotasks(); await flushMicrotasks();
    // calls[2] is now the b.com request
    calls[2].resolve('b');
    await flushMicrotasks();
  });
});

// ─── pendingCount ─────────────────────────────────────────────────────────────

describe('RequestQueue – pendingCount', () => {
  it('reflects the number of queued (not yet running) requests', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ concurrency: 1, fetch });

    assert.equal(q.pendingCount, 0);

    q.enqueue('http://a.com', 'GET', { dedupe: false }).catch(() => {});
    q.enqueue('http://b.com', 'GET', { dedupe: false }).catch(() => {});
    q.enqueue('http://c.com', 'GET', { dedupe: false }).catch(() => {});
    await flushMicrotasks();

    // 1 running, 2 pending
    assert.equal(q.pendingCount, 2);

    calls[0].resolve('a');
    await flushMicrotasks(); await flushMicrotasks();
    assert.equal(q.pendingCount, 1);

    calls[1].resolve('b');
    await flushMicrotasks(); await flushMicrotasks();
    assert.equal(q.pendingCount, 0);

    calls[2].resolve('c');
  });
});

// ─── clearPending ─────────────────────────────────────────────────────────────

describe('RequestQueue – clearPending()', () => {
  it('removes all pending requests and rejects their promises', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ concurrency: 1, fetch });

    // Block the slot
    q.enqueue('http://blocker.com', 'GET', { dedupe: false }).catch(() => {});
    await flushMicrotasks();

    const p1 = q.enqueue('http://a.com', 'GET', { dedupe: false });
    const p2 = q.enqueue('http://b.com', 'GET', { dedupe: false });

    assert.equal(q.pendingCount, 2);
    q.clearPending();
    assert.equal(q.pendingCount, 0);

    await assert.rejects(() => p1, /cleared/);
    await assert.rejects(() => p2, /cleared/);

    calls[0].resolve('done');
  });

  it('is safe to call when empty', () => {
    const q = new RequestQueue({ fetch: async () => 'ok' });
    assert.doesNotThrow(() => q.clearPending());
  });
});

// ─── pause / resume ───────────────────────────────────────────────────────────

describe('RequestQueue – pause() / resume()', () => {
  it('paused queue does not start new requests', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ fetch });
    q.pause();

    const p = q.enqueue('http://a.com', 'GET', { dedupe: false });
    await flushMicrotasks();

    assert.equal(calls.length, 0);  // no fetch calls while paused
    assert.equal(q.pendingCount, 1);

    q.resume();
    await flushMicrotasks();
    assert.equal(calls.length, 1);  // fetch started after resume
    calls[0].resolve('ok');
    await p;
  });

  it('in-flight requests continue while paused', async () => {
    const { fetch, calls } = makeControllableFetch();
    const q = new RequestQueue({ concurrency: 2, fetch });

    const p1 = q.enqueue('http://a.com', 'GET', { dedupe: false });
    await flushMicrotasks();

    q.pause();
    // p1 is already running — it should not be cancelled
    assert.equal(calls.length, 1);
    calls[0].resolve('a');
    const result = await p1;
    assert.equal(result, 'a');
  });

  it('resume() drains accumulated pending requests', async () => {
    const results = [];
    const q = new RequestQueue({
      fetch: async (url) => { results.push(url); return url; },
    });
    q.pause();

    const promises = [
      q.enqueue('http://a.com', 'GET', { dedupe: false }),
      q.enqueue('http://b.com', 'GET', { dedupe: false }),
      q.enqueue('http://c.com', 'GET', { dedupe: false }),
    ];

    assert.equal(q.pendingCount, 3);
    q.resume();
    await Promise.all(promises);
    assert.equal(results.length, 3);
  });
});

// ─── retries ─────────────────────────────────────────────────────────────────

describe('RequestQueue – retries', () => {
  it('retries on failure and resolves on eventual success', async () => {
    let attempt = 0;
    const q = new RequestQueue({
      fetch: async () => {
        attempt++;
        if (attempt < 3) throw new Error('transient');
        return 'success';
      },
    });
    const result = await q.enqueue('http://retry.com', 'GET', { retries: 2 });
    assert.equal(result, 'success');
    assert.equal(attempt, 3);
  });

  it('rejects after all retries are exhausted', async () => {
    let attempt = 0;
    const q = new RequestQueue({
      fetch: async () => {
        attempt++;
        throw new Error('always fails');
      },
    });
    await assert.rejects(
      () => q.enqueue('http://fail.com', 'GET', { retries: 1, dedupe: false }),
      /always fails/,
    );
    await flushMicrotasks();
    assert.equal(attempt, 2); // original + 1 retry
  });
});
