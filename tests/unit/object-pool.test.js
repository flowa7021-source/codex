// ─── Unit Tests: ObjectPool ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ObjectPool, createObjectPool } from '../../app/modules/object-pool.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Counter-based factory so we can track how many objects are created. */
function makeCounter() {
  let count = 0;
  return {
    create: () => ({ id: ++count, data: [] }),
    reset: (obj) => { obj.data = []; },
    get callCount() { return count; },
  };
}

// ─── constructor ──────────────────────────────────────────────────────────────

describe('ObjectPool – constructor', () => {
  it('creates pool with zero objects by default', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    assert.equal(pool.size, 0);
    assert.equal(pool.available, 0);
  });

  it('pre-creates objects when initialSize is set', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 3 });
    assert.equal(pool.size, 3);
    assert.equal(pool.available, 3);
  });

  it('respects maxSize during initial pre-warming', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 10, maxSize: 4 });
    assert.equal(pool.size, 4);
    assert.equal(pool.available, 4);
  });

  it('does not call reset during construction', () => {
    let resetCalls = 0;
    new ObjectPool({ create: () => ({}), reset: () => { resetCalls++; }, initialSize: 3 });
    assert.equal(resetCalls, 0);
  });

  it('works without optional fields', () => {
    const pool = new ObjectPool({ create: () => 'hello' });
    assert.equal(pool.size, 0);
    assert.equal(pool.available, 0);
  });
});

// ─── acquire ──────────────────────────────────────────────────────────────────

describe('ObjectPool – acquire', () => {
  it('returns a PooledObject with value and release', () => {
    const pool = new ObjectPool({ create: () => ({ x: 1 }) });
    const item = pool.acquire();
    assert.ok(typeof item.value === 'object');
    assert.ok(typeof item.release === 'function');
  });

  it('creates a new object when pool is empty', () => {
    const c = makeCounter();
    const pool = new ObjectPool({ create: c.create });
    const item = pool.acquire();
    assert.equal(c.callCount, 1);
    assert.equal(item.value.id, 1);
  });

  it('reuses a pooled object before creating a new one', () => {
    const c = makeCounter();
    const pool = new ObjectPool({ create: c.create, initialSize: 1 });
    const item1 = pool.acquire();
    item1.release();
    const item2 = pool.acquire();
    assert.equal(pool.size, 1); // no new object created
    assert.equal(item2.value.id, 1);
  });

  it('increments size for each newly created object', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    pool.acquire();
    pool.acquire();
    pool.acquire();
    assert.equal(pool.size, 3);
  });

  it('decrements available after acquire', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 3 });
    pool.acquire();
    assert.equal(pool.available, 2);
  });

  it('release() is idempotent — calling twice does not double-return', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 2 });
    const item = pool.acquire();
    item.release();
    item.release(); // second call is a no-op
    assert.equal(pool.available, 2); // still 2, not 3
  });

  it('returned value is unchanged (reset not called on acquire)', () => {
    const pool = new ObjectPool({
      create: () => ({ counter: 0 }),
      reset: (obj) => { obj.counter = 0; },
      initialSize: 1,
    });
    const item = pool.acquire();
    item.value.counter = 42;
    item.release();
    const item2 = pool.acquire();
    // reset should have zeroed it back
    assert.equal(item2.value.counter, 0);
  });

  it('creates a fresh object when acquire is called after drain', () => {
    const c = makeCounter();
    const pool = new ObjectPool({ create: c.create, initialSize: 2 });
    pool.drain();
    const item = pool.acquire();
    assert.equal(item.value.id, 3); // objects 1 and 2 were drained
  });
});

// ─── release ──────────────────────────────────────────────────────────────────

describe('ObjectPool – release', () => {
  it('returns object to the pool', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    const item = pool.acquire();
    pool.release(item.value);
    assert.equal(pool.available, 1);
  });

  it('calls reset when provided', () => {
    let resetCalls = 0;
    const pool = new ObjectPool({
      create: () => ({ data: [1, 2, 3] }),
      reset: (obj) => { resetCalls++; obj.data = []; },
    });
    const item = pool.acquire();
    pool.release(item.value);
    assert.equal(resetCalls, 1);
    assert.deepEqual(item.value.data, []);
  });

  it('discards object when pool is at maxSize', () => {
    const pool = new ObjectPool({ create: () => ({}), maxSize: 2, initialSize: 2 });
    const extra = {};
    pool.release(extra);
    assert.equal(pool.available, 2); // still 2, extra was dropped
  });

  it('does not call reset when discarding due to maxSize', () => {
    let resetCalls = 0;
    const pool = new ObjectPool({
      create: () => ({}),
      reset: () => { resetCalls++; },
      maxSize: 1,
      initialSize: 1,
    });
    pool.release({}); // pool is full — should be discarded without reset
    assert.equal(resetCalls, 0);
  });

  it('released object can be re-acquired', () => {
    const pool = new ObjectPool({ create: () => ({ v: 99 }) });
    const item = pool.acquire();
    pool.release(item.value);
    const item2 = pool.acquire();
    assert.equal(item2.value.v, 99);
  });

  it('multiple releases stack up available count', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 3 });
    const [a, b, c] = [pool.acquire(), pool.acquire(), pool.acquire()];
    assert.equal(pool.available, 0);
    pool.release(a.value);
    pool.release(b.value);
    pool.release(c.value);
    assert.equal(pool.available, 3);
  });
});

// ─── drain ────────────────────────────────────────────────────────────────────

describe('ObjectPool – drain', () => {
  it('sets available to 0', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 5 });
    pool.drain();
    assert.equal(pool.available, 0);
  });

  it('does not reset size counter', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 3 });
    pool.drain();
    assert.equal(pool.size, 3); // objects were created, just no longer pooled
  });

  it('pool is functional after drain', () => {
    const pool = new ObjectPool({ create: () => ({ fresh: true }), initialSize: 2 });
    pool.drain();
    const item = pool.acquire();
    assert.ok(item.value.fresh);
    assert.equal(pool.size, 3); // one new object was created
  });

  it('drain on empty pool is a no-op', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    assert.doesNotThrow(() => pool.drain());
    assert.equal(pool.available, 0);
  });

  it('released objects after drain go back to pool', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 2 });
    const item = pool.acquire();
    pool.drain();
    pool.release(item.value);
    assert.equal(pool.available, 1);
  });
});

// ─── prewarm ──────────────────────────────────────────────────────────────────

describe('ObjectPool – prewarm', () => {
  it('adds n objects to the pool', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    pool.prewarm(4);
    assert.equal(pool.size, 4);
    assert.equal(pool.available, 4);
  });

  it('respects maxSize when prewarming', () => {
    const pool = new ObjectPool({ create: () => ({}), maxSize: 3 });
    pool.prewarm(10);
    assert.equal(pool.size, 3);
    assert.equal(pool.available, 3);
  });

  it('prewarm(0) is a no-op', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    pool.prewarm(0);
    assert.equal(pool.size, 0);
  });

  it('prewarmed objects are immediately acquirable', () => {
    const pool = new ObjectPool({ create: () => ({ ready: true }) });
    pool.prewarm(2);
    const item = pool.acquire();
    assert.ok(item.value.ready);
  });

  it('successive prewarm calls accumulate up to maxSize', () => {
    const pool = new ObjectPool({ create: () => ({}), maxSize: 5 });
    pool.prewarm(3);
    pool.prewarm(4); // should only add 2 more (cap at 5)
    assert.equal(pool.size, 5);
    assert.equal(pool.available, 5);
  });

  it('prewarm after drain creates fresh objects', () => {
    const c = makeCounter();
    const pool = new ObjectPool({ create: c.create, initialSize: 2 });
    pool.drain();
    pool.prewarm(3);
    assert.equal(pool.size, 5);
    assert.equal(pool.available, 3);
  });
});

// ─── size / available getters ─────────────────────────────────────────────────

describe('ObjectPool – size / available', () => {
  it('size starts at 0', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    assert.equal(pool.size, 0);
  });

  it('size only grows, never shrinks', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 3 });
    pool.drain();
    assert.equal(pool.size, 3);
  });

  it('available reflects current pool depth', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 4 });
    pool.acquire();
    pool.acquire();
    assert.equal(pool.available, 2);
  });

  it('available is 0 after all objects are checked out', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 2 });
    pool.acquire();
    pool.acquire();
    assert.equal(pool.available, 0);
  });

  it('available recovers after release', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 1 });
    const item = pool.acquire();
    assert.equal(pool.available, 0);
    pool.release(item.value);
    assert.equal(pool.available, 1);
  });
});

// ─── createObjectPool factory ─────────────────────────────────────────────────

describe('createObjectPool', () => {
  it('returns an ObjectPool instance', () => {
    const pool = createObjectPool({ create: () => ({}) });
    assert.ok(pool instanceof ObjectPool);
  });

  it('passes options through correctly', () => {
    const pool = createObjectPool({ create: () => ({ v: 1 }), initialSize: 3, maxSize: 10 });
    assert.equal(pool.size, 3);
    assert.equal(pool.available, 3);
  });

  it('acquire / release cycle works via factory', () => {
    const pool = createObjectPool({ create: () => ({ n: 0 }) });
    const item = pool.acquire();
    assert.equal(item.value.n, 0);
    item.release();
    assert.equal(pool.available, 1);
  });

  it('respects maxSize via factory', () => {
    const pool = createObjectPool({ create: () => ({}), maxSize: 2, initialSize: 2 });
    pool.release({});
    assert.equal(pool.available, 2); // extra object discarded
  });

  it('reset callback is invoked on release via factory', () => {
    let called = false;
    const pool = createObjectPool({
      create: () => ({ flag: true }),
      reset: (obj) => { called = true; obj.flag = false; },
    });
    const item = pool.acquire();
    item.release();
    assert.ok(called);
  });
});
