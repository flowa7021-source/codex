// ─── Unit Tests: LazyLoader ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Lazy, AsyncLazy, LazyMap, AsyncLazyMap } from '../../app/modules/lazy-loader.js';

// ─── Lazy ─────────────────────────────────────────────────────────────────────

describe('Lazy – initialization', () => {
  it('starts uninitialized', () => {
    const lazy = new Lazy(() => 42);
    assert.equal(lazy.initialized, false);
  });

  it('computes value on first access', () => {
    let calls = 0;
    const lazy = new Lazy(() => { calls += 1; return 'hello'; });
    assert.equal(lazy.value, 'hello');
    assert.equal(calls, 1);
  });

  it('is initialized after first access', () => {
    const lazy = new Lazy(() => 99);
    lazy.value;
    assert.equal(lazy.initialized, true);
  });

  it('calls factory exactly once for multiple accesses', () => {
    let calls = 0;
    const lazy = new Lazy(() => { calls += 1; return { x: 1 }; });
    const v1 = lazy.value;
    const v2 = lazy.value;
    const v3 = lazy.value;
    assert.equal(calls, 1);
    assert.equal(v1, v2);
    assert.equal(v2, v3);
  });

  it('works with falsy values (0)', () => {
    const lazy = new Lazy(() => 0);
    assert.equal(lazy.value, 0);
    assert.equal(lazy.initialized, true);
  });

  it('works with falsy values (false)', () => {
    const lazy = new Lazy(() => false);
    assert.equal(lazy.value, false);
    assert.equal(lazy.initialized, true);
  });

  it('works with falsy values (empty string)', () => {
    const lazy = new Lazy(() => '');
    assert.equal(lazy.value, '');
    assert.equal(lazy.initialized, true);
  });

  it('works with null', () => {
    const lazy = new Lazy(() => null);
    assert.equal(lazy.value, null);
    assert.equal(lazy.initialized, true);
  });
});

describe('Lazy – reset', () => {
  it('reset clears initialized state', () => {
    const lazy = new Lazy(() => 1);
    lazy.value;
    assert.equal(lazy.initialized, true);
    lazy.reset();
    assert.equal(lazy.initialized, false);
  });

  it('reset forces recomputation on next access', () => {
    let counter = 0;
    const lazy = new Lazy(() => { counter += 1; return counter; });
    assert.equal(lazy.value, 1);
    lazy.reset();
    assert.equal(lazy.value, 2);
    assert.equal(counter, 2);
  });

  it('reset before any access is safe', () => {
    const lazy = new Lazy(() => 'value');
    assert.doesNotThrow(() => lazy.reset());
    assert.equal(lazy.initialized, false);
    assert.equal(lazy.value, 'value');
  });

  it('multiple resets work correctly', () => {
    let n = 0;
    const lazy = new Lazy(() => ++n);
    lazy.value; // 1
    lazy.reset();
    lazy.value; // 2
    lazy.reset();
    lazy.value; // 3
    assert.equal(lazy.value, 3);
    assert.equal(n, 3);
  });
});

// ─── AsyncLazy ────────────────────────────────────────────────────────────────

describe('AsyncLazy – initialization', () => {
  it('starts uninitialized', () => {
    const lazy = new AsyncLazy(async () => 42);
    assert.equal(lazy.initialized, false);
  });

  it('resolves with the computed value', async () => {
    const lazy = new AsyncLazy(async () => 'result');
    const value = await lazy.get();
    assert.equal(value, 'result');
  });

  it('is initialized after first await', async () => {
    const lazy = new AsyncLazy(async () => 99);
    await lazy.get();
    assert.equal(lazy.initialized, true);
  });

  it('calls factory exactly once for sequential calls', async () => {
    let calls = 0;
    const lazy = new AsyncLazy(async () => { calls += 1; return 'data'; });
    await lazy.get();
    await lazy.get();
    await lazy.get();
    assert.equal(calls, 1);
  });

  it('concurrent calls share the same promise (factory called once)', async () => {
    let calls = 0;
    const lazy = new AsyncLazy(async () => {
      calls += 1;
      return new Promise((resolve) => setTimeout(() => resolve('concurrent'), 0));
    });

    const [a, b, c] = await Promise.all([lazy.get(), lazy.get(), lazy.get()]);
    assert.equal(calls, 1);
    assert.equal(a, 'concurrent');
    assert.equal(b, 'concurrent');
    assert.equal(c, 'concurrent');
  });

  it('works with falsy resolved value (0)', async () => {
    const lazy = new AsyncLazy(async () => 0);
    assert.equal(await lazy.get(), 0);
    assert.equal(lazy.initialized, true);
  });

  it('works with falsy resolved value (false)', async () => {
    const lazy = new AsyncLazy(async () => false);
    assert.equal(await lazy.get(), false);
    assert.equal(lazy.initialized, true);
  });
});

describe('AsyncLazy – reset', () => {
  it('reset clears initialized state', async () => {
    const lazy = new AsyncLazy(async () => 1);
    await lazy.get();
    assert.equal(lazy.initialized, true);
    lazy.reset();
    assert.equal(lazy.initialized, false);
  });

  it('reset forces recomputation on next get()', async () => {
    let counter = 0;
    const lazy = new AsyncLazy(async () => { counter += 1; return counter; });
    assert.equal(await lazy.get(), 1);
    lazy.reset();
    assert.equal(await lazy.get(), 2);
    assert.equal(counter, 2);
  });

  it('reset before any call is safe', async () => {
    const lazy = new AsyncLazy(async () => 'value');
    assert.doesNotThrow(() => lazy.reset());
    assert.equal(lazy.initialized, false);
    assert.equal(await lazy.get(), 'value');
  });

  it('multiple resets work correctly', async () => {
    let n = 0;
    const lazy = new AsyncLazy(async () => ++n);
    await lazy.get(); // 1
    lazy.reset();
    await lazy.get(); // 2
    lazy.reset();
    const result = await lazy.get(); // 3
    assert.equal(result, 3);
    assert.equal(n, 3);
  });
});

// ─── LazyMap ──────────────────────────────────────────────────────────────────

describe('LazyMap – get', () => {
  it('computes value for a key on first access', () => {
    const map = new LazyMap((key) => key.toUpperCase());
    assert.equal(map.get('hello'), 'HELLO');
  });

  it('caches value and does not recompute', () => {
    let calls = 0;
    const map = new LazyMap((key) => { calls += 1; return key + '_computed'; });
    map.get('a');
    map.get('a');
    assert.equal(calls, 1);
  });

  it('computes independently per key', () => {
    let calls = 0;
    const map = new LazyMap((key) => { calls += 1; return key * 2; });
    assert.equal(map.get(3), 6);
    assert.equal(map.get(5), 10);
    assert.equal(calls, 2);
  });

  it('returns same object reference on repeated access', () => {
    const map = new LazyMap((key) => ({ value: key }));
    const first = map.get('k');
    const second = map.get('k');
    assert.equal(first, second);
  });
});

describe('LazyMap – has', () => {
  it('returns false for keys not yet computed', () => {
    const map = new LazyMap((key) => key);
    assert.equal(map.has('x'), false);
  });

  it('returns true after key is computed', () => {
    const map = new LazyMap((key) => key);
    map.get('x');
    assert.equal(map.has('x'), true);
  });

  it('returns false after key is invalidated', () => {
    const map = new LazyMap((key) => key);
    map.get('x');
    map.invalidate('x');
    assert.equal(map.has('x'), false);
  });
});

describe('LazyMap – invalidate', () => {
  it('forces recomputation on next access', () => {
    let counter = 0;
    const map = new LazyMap(() => { counter += 1; return counter; });
    map.get('k'); // 1
    map.invalidate('k');
    map.get('k'); // 2
    assert.equal(counter, 2);
    assert.equal(map.get('k'), 2);
  });

  it('invalidating a key that was never computed is safe', () => {
    const map = new LazyMap((key) => key);
    assert.doesNotThrow(() => map.invalidate('nonexistent'));
    assert.equal(map.has('nonexistent'), false);
  });

  it('invalidating one key does not affect others', () => {
    let calls = 0;
    const map = new LazyMap((key) => { calls += 1; return key; });
    map.get('a');
    map.get('b');
    map.invalidate('a');
    assert.equal(map.has('b'), true);
    assert.equal(calls, 2);
    map.get('a'); // recompute 'a'
    assert.equal(calls, 3);
  });
});

describe('LazyMap – invalidateAll', () => {
  it('clears all cached values', () => {
    const map = new LazyMap((key) => key + '_v');
    map.get('a');
    map.get('b');
    map.get('c');
    assert.equal(map.size(), 3);
    map.invalidateAll();
    assert.equal(map.size(), 0);
  });

  it('forces recomputation of all keys after invalidateAll', () => {
    let calls = 0;
    const map = new LazyMap((key) => { calls += 1; return key; });
    map.get('x');
    map.get('y');
    assert.equal(calls, 2);
    map.invalidateAll();
    map.get('x');
    map.get('y');
    assert.equal(calls, 4);
  });
});

describe('LazyMap – size', () => {
  it('starts at 0', () => {
    const map = new LazyMap((key) => key);
    assert.equal(map.size(), 0);
  });

  it('increments as keys are computed', () => {
    const map = new LazyMap((key) => key);
    map.get('a');
    assert.equal(map.size(), 1);
    map.get('b');
    assert.equal(map.size(), 2);
  });

  it('decrements after invalidate', () => {
    const map = new LazyMap((key) => key);
    map.get('a');
    map.get('b');
    map.invalidate('a');
    assert.equal(map.size(), 1);
  });

  it('does not increment for repeated access to same key', () => {
    const map = new LazyMap((key) => key);
    map.get('a');
    map.get('a');
    map.get('a');
    assert.equal(map.size(), 1);
  });
});

// ─── AsyncLazyMap ─────────────────────────────────────────────────────────────

describe('AsyncLazyMap – get', () => {
  it('computes value for a key on first access', async () => {
    const map = new AsyncLazyMap(async (key) => key.toUpperCase());
    assert.equal(await map.get('hello'), 'HELLO');
  });

  it('caches value and does not recompute', async () => {
    let calls = 0;
    const map = new AsyncLazyMap(async (key) => { calls += 1; return key; });
    await map.get('k');
    await map.get('k');
    assert.equal(calls, 1);
  });

  it('computes independently per key', async () => {
    let calls = 0;
    const map = new AsyncLazyMap(async (key) => { calls += 1; return key * 10; });
    const [a, b] = await Promise.all([map.get(2), map.get(5)]);
    assert.equal(a, 20);
    assert.equal(b, 50);
    assert.equal(calls, 2);
  });

  it('concurrent calls for the same key share one in-flight promise', async () => {
    let calls = 0;
    const map = new AsyncLazyMap(async (key) => {
      calls += 1;
      return new Promise((resolve) => setTimeout(() => resolve(key + '_done'), 0));
    });
    const [a, b, c] = await Promise.all([map.get('x'), map.get('x'), map.get('x')]);
    assert.equal(calls, 1);
    assert.equal(a, 'x_done');
    assert.equal(b, 'x_done');
    assert.equal(c, 'x_done');
  });
});

describe('AsyncLazyMap – has', () => {
  it('returns false before key is computed', () => {
    const map = new AsyncLazyMap(async (key) => key);
    assert.equal(map.has('x'), false);
  });

  it('returns true after key is resolved', async () => {
    const map = new AsyncLazyMap(async (key) => key);
    await map.get('x');
    assert.equal(map.has('x'), true);
  });

  it('returns false while key is in-flight (only cached, not pending)', async () => {
    let resolve;
    const map = new AsyncLazyMap(() => new Promise((r) => { resolve = r; }));
    const pending = map.get('k');
    // key is in-flight, not yet cached
    assert.equal(map.has('k'), false);
    resolve('done');
    await pending;
    assert.equal(map.has('k'), true);
  });
});

describe('AsyncLazyMap – invalidate', () => {
  it('forces recomputation on next access', async () => {
    let counter = 0;
    const map = new AsyncLazyMap(async () => { counter += 1; return counter; });
    assert.equal(await map.get('k'), 1);
    map.invalidate('k');
    assert.equal(await map.get('k'), 2);
    assert.equal(counter, 2);
  });

  it('invalidating a key that was never computed is safe', () => {
    const map = new AsyncLazyMap(async (key) => key);
    assert.doesNotThrow(() => map.invalidate('ghost'));
  });

  it('invalidating one key does not affect others', async () => {
    let calls = 0;
    const map = new AsyncLazyMap(async (key) => { calls += 1; return key; });
    await map.get('a');
    await map.get('b');
    map.invalidate('a');
    assert.equal(map.has('b'), true);
    assert.equal(map.has('a'), false);
  });
});

describe('AsyncLazyMap – invalidateAll', () => {
  it('clears all cached values', async () => {
    const map = new AsyncLazyMap(async (key) => key);
    await map.get('a');
    await map.get('b');
    assert.equal(map.has('a'), true);
    assert.equal(map.has('b'), true);
    map.invalidateAll();
    assert.equal(map.has('a'), false);
    assert.equal(map.has('b'), false);
  });

  it('forces recomputation after invalidateAll', async () => {
    let calls = 0;
    const map = new AsyncLazyMap(async (key) => { calls += 1; return key; });
    await map.get('x');
    await map.get('y');
    assert.equal(calls, 2);
    map.invalidateAll();
    await map.get('x');
    await map.get('y');
    assert.equal(calls, 4);
  });
});
