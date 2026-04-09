// ─── Unit Tests: ResourcePool ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ResourcePool, createPool } from '../../app/modules/resource-pool.js';

// ─── createPool factory ───────────────────────────────────────────────────────

describe('createPool()', () => {
  it('returns a ResourcePool instance', () => {
    const pool = createPool({ create: () => ({}) });
    assert.ok(pool instanceof ResourcePool);
  });
});

// ─── acquire / release ────────────────────────────────────────────────────────

describe('ResourcePool – acquire()', () => {
  it('returns a resource', async () => {
    const pool = createPool({ create: () => ({ id: 1 }) });
    const resource = await pool.acquire();
    assert.deepEqual(resource, { id: 1 });
  });

  it('returns a resource from an async create()', async () => {
    const pool = createPool({
      create: () => Promise.resolve({ async: true }),
    });
    const resource = await pool.acquire();
    assert.deepEqual(resource, { async: true });
  });
});

describe('ResourcePool – release()', () => {
  it('returns the resource to the idle pool and increments available', async () => {
    const pool = createPool({ create: () => ({ id: 42 }) });

    assert.equal(pool.available, 0);
    const resource = await pool.acquire();
    assert.equal(pool.available, 0);

    pool.release(resource);
    assert.equal(pool.available, 1);
  });

  it('releasing an unknown resource is a no-op', async () => {
    const pool = createPool({ create: () => ({}) });
    // Should not throw
    pool.release({ foreign: true });
    assert.equal(pool.available, 0);
    assert.equal(pool.total, 0);
  });
});

// ─── available / total getters ────────────────────────────────────────────────

describe('ResourcePool – available / total getters', () => {
  it('total reflects idle + in-use resources', async () => {
    const pool = createPool({ create: () => ({}), maxSize: 3 });

    assert.equal(pool.total, 0);
    assert.equal(pool.available, 0);

    const r1 = await pool.acquire();
    assert.equal(pool.total, 1);
    assert.equal(pool.available, 0);

    const r2 = await pool.acquire();
    assert.equal(pool.total, 2);
    assert.equal(pool.available, 0);

    pool.release(r1);
    assert.equal(pool.total, 2);
    assert.equal(pool.available, 1);

    pool.release(r2);
    assert.equal(pool.total, 2);
    assert.equal(pool.available, 2);
  });
});

// ─── use() ────────────────────────────────────────────────────────────────────

describe('ResourcePool – use()', () => {
  it('acquires, passes resource to fn, then releases it', async () => {
    const pool = createPool({ create: () => ({ value: 7 }) });

    const result = await pool.use((resource) => resource.value * 2);
    assert.equal(result, 14);
    assert.equal(pool.available, 1);
  });

  it('releases the resource even when fn throws', async () => {
    const pool = createPool({ create: () => ({}) });

    await assert.rejects(
      () => pool.use(() => { throw new Error('boom'); }),
      /boom/,
    );
    assert.equal(pool.available, 1);
  });

  it('releases the resource even when fn returns a rejected promise', async () => {
    const pool = createPool({ create: () => ({}) });

    await assert.rejects(
      () => pool.use(() => Promise.reject(new Error('async boom'))),
      /async boom/,
    );
    assert.equal(pool.available, 1);
  });
});

// ─── concurrency / waiting ────────────────────────────────────────────────────

describe('ResourcePool – concurrent acquire() waits when pool is exhausted', () => {
  it('second acquire resolves after first is released (maxSize=1)', async () => {
    const pool = createPool({ create: () => ({}), maxSize: 1 });
    const order = [];

    const r1 = await pool.acquire();
    order.push('acquired-1');

    // This should wait because maxSize=1 and r1 is in use
    const p2 = pool.acquire().then((r2) => {
      order.push('acquired-2');
      pool.release(r2);
    });

    // Give the microtask queue a chance to run (r1 is still held)
    await Promise.resolve();
    assert.deepEqual(order, ['acquired-1']);

    pool.release(r1);
    await p2;

    assert.deepEqual(order, ['acquired-1', 'acquired-2']);
  });

  it('multiple waiters are served in FIFO order', async () => {
    const pool = createPool({ create: () => ({}), maxSize: 1 });
    const order = [];

    const r1 = await pool.acquire();

    const p2 = pool.acquire().then((r) => { order.push(2); pool.release(r); });
    const p3 = pool.acquire().then((r) => { order.push(3); pool.release(r); });
    const p4 = pool.acquire().then((r) => { order.push(4); pool.release(r); });

    pool.release(r1);
    await Promise.all([p2, p3, p4]);

    assert.deepEqual(order, [2, 3, 4]);
  });
});

// ─── validate ────────────────────────────────────────────────────────────────

describe('ResourcePool – validate()', () => {
  it('invalid resources are destroyed and recreated', async () => {
    let created = 0;
    let destroyed = 0;

    const pool = createPool({
      create: () => ({ id: ++created, valid: true }),
      destroy: () => { destroyed++; },
      validate: (r) => r.valid,
      maxSize: 5,
    });

    const r1 = await pool.acquire();
    // Mark as invalid before releasing
    r1.valid = false;
    pool.release(r1);

    // The invalid resource should be destroyed rather than returned to idle
    assert.equal(destroyed, 1);
    assert.equal(pool.available, 0);

    // Next acquire creates a fresh resource
    const r2 = await pool.acquire();
    assert.equal(r2.id, 2);
    assert.equal(created, 2);
  });

  it('invalid idle resources are skipped and destroyed on acquire', async () => {
    let created = 0;
    const resources = [];

    const pool = createPool({
      create: () => {
        const r = { id: ++created, valid: true };
        resources.push(r);
        return r;
      },
      validate: (r) => r.valid,
      maxSize: 5,
    });

    // Fill idle pool with one valid resource
    const r1 = await pool.acquire();
    pool.release(r1);
    assert.equal(pool.available, 1);

    // Corrupt it while idle
    r1.valid = false;

    // acquire should discard r1 and create a new one
    const r2 = await pool.acquire();
    assert.equal(r2.id, 2);
    assert.equal(pool.available, 0);
  });
});

// ─── drain() ─────────────────────────────────────────────────────────────────

describe('ResourcePool – drain()', () => {
  it('resolves immediately when no resources are in use', async () => {
    const pool = createPool({ create: () => ({}) });
    await pool.drain(); // should resolve without hanging
    assert.equal(pool.available, 0);
  });

  it('destroys idle resources on drain', async () => {
    const destroyed = [];
    const pool = createPool({
      create: () => ({ id: Math.random() }),
      destroy: (r) => destroyed.push(r),
      maxSize: 3,
    });

    const r1 = await pool.acquire();
    const r2 = await pool.acquire();
    pool.release(r1);
    pool.release(r2);
    assert.equal(pool.available, 2);

    await pool.drain();
    assert.equal(destroyed.length, 2);
    assert.equal(pool.available, 0);
  });

  it('waits for in-use resources to be released', async () => {
    const pool = createPool({ create: () => ({}), maxSize: 2 });

    const r1 = await pool.acquire();
    let drained = false;

    const drainPromise = pool.drain().then(() => { drained = true; });

    await Promise.resolve();
    assert.equal(drained, false);

    pool.release(r1);
    await drainPromise;
    assert.equal(drained, true);
  });
});
