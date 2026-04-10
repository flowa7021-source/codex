// ─── Unit Tests: ObjectPool & TypedArrayPool ──────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ObjectPool,
  TypedArrayPool,
} from '../../app/modules/memory-pool.js';

// ─── ObjectPool ───────────────────────────────────────────────────────────────

describe('ObjectPool – constructor / initialSize', () => {
  it('starts with zero available by default', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    assert.equal(pool.available, 0);
    assert.equal(pool.inUse, 0);
  });

  it('pre-fills pool when initialSize is given', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 4 });
    assert.equal(pool.available, 4);
    assert.equal(pool.created, 4);
  });

  it('inUse is 0 before any acquire', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 3 });
    assert.equal(pool.inUse, 0);
  });
});

describe('ObjectPool – acquire', () => {
  it('returns an object', () => {
    const pool = new ObjectPool({ create: () => ({ value: 0 }) });
    const obj = pool.acquire();
    assert.ok(typeof obj === 'object');
  });

  it('creates a new object when pool is empty', () => {
    let count = 0;
    const pool = new ObjectPool({ create: () => { count++; return {}; } });
    pool.acquire();
    assert.equal(count, 1);
    assert.equal(pool.created, 1);
  });

  it('reuses pooled object instead of creating new one', () => {
    let count = 0;
    const pool = new ObjectPool({ create: () => { count++; return {}; } });
    const obj = pool.acquire();
    pool.release(obj);
    pool.acquire(); // should reuse
    assert.equal(count, 1);
  });

  it('increments inUse on each acquire', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    pool.acquire();
    pool.acquire();
    assert.equal(pool.inUse, 2);
  });

  it('decrements available when acquiring from pre-filled pool', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 3 });
    pool.acquire();
    assert.equal(pool.available, 2);
  });
});

describe('ObjectPool – release', () => {
  it('returns object to pool — available increases', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    const obj = pool.acquire();
    assert.equal(pool.available, 0);
    pool.release(obj);
    assert.equal(pool.available, 1);
  });

  it('decrements inUse after release', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    const obj = pool.acquire();
    assert.equal(pool.inUse, 1);
    pool.release(obj);
    assert.equal(pool.inUse, 0);
  });

  it('calls reset function on release', () => {
    let resetCalled = false;
    const pool = new ObjectPool({
      create: () => ({ x: 1 }),
      reset: (obj) => { obj.x = 0; resetCalled = true; },
    });
    const obj = pool.acquire();
    obj.x = 99;
    pool.release(obj);
    assert.ok(resetCalled);
    assert.equal(pool.available, 1);
  });

  it('reset mutation is visible when object is re-acquired', () => {
    const pool = new ObjectPool({
      create: () => ({ x: 1 }),
      reset: (obj) => { obj.x = 0; },
    });
    const obj = pool.acquire();
    obj.x = 99;
    pool.release(obj);
    const obj2 = pool.acquire();
    assert.equal(obj2.x, 0);
  });

  it('discards object when pool is at maxSize', () => {
    const pool = new ObjectPool({ create: () => ({}), maxSize: 2 });
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    pool.release(a);
    pool.release(b);
    pool.release(c); // should be discarded — pool full
    assert.equal(pool.available, 2);
  });

  it('maxSize limits pool growth', () => {
    const pool = new ObjectPool({ create: () => ({}), maxSize: 1 });
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(b); // pool now has 1
    pool.release(a); // discarded
    assert.equal(pool.available, 1);
  });
});

describe('ObjectPool – created / inUse consistency', () => {
  it('created equals total objects ever created', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    pool.acquire();
    pool.acquire();
    const obj = pool.acquire();
    pool.release(obj);
    pool.acquire(); // reuses
    assert.equal(pool.created, 3);
  });

  it('inUse reflects live acquisitions', () => {
    const pool = new ObjectPool({ create: () => ({}) });
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    assert.equal(pool.inUse, 1);
    pool.release(b);
    assert.equal(pool.inUse, 0);
  });
});

describe('ObjectPool – drain', () => {
  it('empties the pool', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 5 });
    pool.drain();
    assert.equal(pool.available, 0);
  });

  it('created count is preserved after drain', () => {
    const pool = new ObjectPool({ create: () => ({}), initialSize: 3 });
    pool.drain();
    assert.equal(pool.created, 3);
  });

  it('pool is still usable after drain', () => {
    const pool = new ObjectPool({ create: () => ({ v: 0 }) });
    const a = pool.acquire();
    pool.release(a);
    pool.drain();
    const b = pool.acquire();
    assert.ok(b);
  });
});

// ─── TypedArrayPool ───────────────────────────────────────────────────────────

describe('TypedArrayPool – Float32Array', () => {
  it('returns a Float32Array of the correct size', () => {
    const pool = new TypedArrayPool(Float32Array, 16);
    const arr = pool.acquire();
    assert.ok(arr instanceof Float32Array);
    assert.equal(arr.length, 16);
  });

  it('pool is empty before any release', () => {
    const pool = new TypedArrayPool(Float32Array, 16);
    assert.equal(pool.available, 0);
  });

  it('available increases after release', () => {
    const pool = new TypedArrayPool(Float32Array, 16);
    const arr = pool.acquire();
    pool.release(arr);
    assert.equal(pool.available, 1);
  });

  it('reuses released array on next acquire', () => {
    const pool = new TypedArrayPool(Float32Array, 8);
    const arr = pool.acquire();
    arr[0] = 99;
    pool.release(arr);
    const arr2 = pool.acquire();
    assert.ok(arr2 instanceof Float32Array);
    assert.equal(pool.available, 0);
  });

  it('available decreases after acquire from pool', () => {
    const pool = new TypedArrayPool(Float32Array, 4);
    const arr = pool.acquire();
    pool.release(arr);
    pool.acquire();
    assert.equal(pool.available, 0);
  });
});

describe('TypedArrayPool – Uint8Array', () => {
  it('returns a Uint8Array of the correct size', () => {
    const pool = new TypedArrayPool(Uint8Array, 32);
    const arr = pool.acquire();
    assert.ok(arr instanceof Uint8Array);
    assert.equal(arr.length, 32);
  });

  it('pool reuse works for Uint8Array', () => {
    const pool = new TypedArrayPool(Uint8Array, 4);
    const arr = pool.acquire();
    pool.release(arr);
    assert.equal(pool.available, 1);
    const arr2 = pool.acquire();
    assert.ok(arr2 instanceof Uint8Array);
    assert.equal(pool.available, 0);
  });
});

describe('TypedArrayPool – Int32Array', () => {
  it('returns an Int32Array of the correct size', () => {
    const pool = new TypedArrayPool(Int32Array, 10);
    const arr = pool.acquire();
    assert.ok(arr instanceof Int32Array);
    assert.equal(arr.length, 10);
  });

  it('pool reuse works for Int32Array', () => {
    const pool = new TypedArrayPool(Int32Array, 6);
    const arr = pool.acquire();
    pool.release(arr);
    assert.equal(pool.available, 1);
    const arr2 = pool.acquire();
    assert.ok(arr2 instanceof Int32Array);
  });
});

describe('TypedArrayPool – multiple releases and reuse', () => {
  it('can hold multiple arrays in pool', () => {
    const pool = new TypedArrayPool(Float32Array, 4);
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    pool.release(b);
    assert.equal(pool.available, 2);
  });

  it('acquire drains pool in LIFO order', () => {
    const pool = new TypedArrayPool(Float32Array, 4);
    const a = pool.acquire();
    a[0] = 1;
    const b = pool.acquire();
    b[0] = 2;
    pool.release(a);
    pool.release(b);
    const c = pool.acquire(); // should get 'b' (last released)
    assert.equal(c[0], 2);
  });
});
