// ─── Unit Tests: Component Pool ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ComponentPool,
  createComponentPool,
} from '../../app/modules/component-pool.js';

// ─── Factory ────────────────────────────────────────────────────────────────

describe('createComponentPool', () => {
  it('returns a ComponentPool instance', () => {
    const pool = createComponentPool(() => ({}));
    assert.ok(pool instanceof ComponentPool);
  });
});

// ─── Acquire / Release ──────────────────────────────────────────────────────

describe('ComponentPool – acquire / release', () => {
  it('acquire creates a new component for an entity', () => {
    const pool = createComponentPool(() => ({ x: 0, y: 0 }));
    const c = pool.acquire(1);
    assert.deepEqual(c, { x: 0, y: 0 });
    assert.equal(pool.activeCount, 1);
  });

  it('acquire is idempotent — returns same instance for same entity', () => {
    const pool = createComponentPool(() => ({ v: 0 }));
    const a = pool.acquire(5);
    a.v = 42;
    const b = pool.acquire(5);
    assert.equal(a, b);
    assert.equal(b.v, 42);
    assert.equal(pool.activeCount, 1);
  });

  it('release returns component to the pool', () => {
    const pool = createComponentPool(() => ({ v: 0 }));
    pool.acquire(1);
    assert.equal(pool.activeCount, 1);
    assert.equal(pool.pooledCount, 0);

    pool.release(1);
    assert.equal(pool.activeCount, 0);
    assert.equal(pool.pooledCount, 1);
  });

  it('release is safe when entity has no component', () => {
    const pool = createComponentPool(() => ({}));
    pool.release(999); // should not throw
    assert.equal(pool.activeCount, 0);
    assert.equal(pool.pooledCount, 0);
  });

  it('recycled component is reused on next acquire', () => {
    let created = 0;
    const pool = createComponentPool(() => {
      created++;
      return { v: 0 };
    });

    const first = pool.acquire(1);
    first.v = 99;
    pool.release(1);

    const second = pool.acquire(2);
    // Same object reused — only 1 creation call total
    assert.equal(created, 1);
    assert.equal(first, second);
  });

  it('reset function is called when releasing', () => {
    const pool = createComponentPool(
      () => ({ hp: 100 }),
      (item) => { item.hp = 100; },
    );

    const c = pool.acquire(1);
    c.hp = 0;
    pool.release(1);

    const reused = pool.acquire(2);
    assert.equal(reused.hp, 100); // reset was applied
  });
});

// ─── Get / Has ──────────────────────────────────────────────────────────────

describe('ComponentPool – get / has', () => {
  it('get returns the active component', () => {
    const pool = createComponentPool(() => ({ n: 7 }));
    pool.acquire(3);
    assert.deepEqual(pool.get(3), { n: 7 });
  });

  it('get returns undefined for inactive entity', () => {
    const pool = createComponentPool(() => ({}));
    assert.equal(pool.get(99), undefined);
  });

  it('has returns true for active, false otherwise', () => {
    const pool = createComponentPool(() => ({}));
    assert.equal(pool.has(1), false);
    pool.acquire(1);
    assert.equal(pool.has(1), true);
    pool.release(1);
    assert.equal(pool.has(1), false);
  });
});

// ─── Entities ───────────────────────────────────────────────────────────────

describe('ComponentPool – entities', () => {
  it('returns all active entity IDs', () => {
    const pool = createComponentPool(() => ({}));
    pool.acquire(10);
    pool.acquire(20);
    pool.acquire(30);
    const ids = pool.entities();
    assert.deepEqual(ids.sort(), [10, 20, 30]);
  });

  it('excludes released entities', () => {
    const pool = createComponentPool(() => ({}));
    pool.acquire(1);
    pool.acquire(2);
    pool.release(1);
    assert.deepEqual(pool.entities(), [2]);
  });
});

// ─── Clear ──────────────────────────────────────────────────────────────────

describe('ComponentPool – clear', () => {
  it('removes all active and pooled components', () => {
    const pool = createComponentPool(() => ({}));
    pool.acquire(1);
    pool.acquire(2);
    pool.release(2);
    assert.equal(pool.activeCount, 1);
    assert.equal(pool.pooledCount, 1);

    pool.clear();
    assert.equal(pool.activeCount, 0);
    assert.equal(pool.pooledCount, 0);
    assert.deepEqual(pool.entities(), []);
  });
});

// ─── Multiple pools are independent ─────────────────────────────────────────

describe('ComponentPool – independence', () => {
  it('two pools do not interfere with each other', () => {
    const posPool = createComponentPool(() => ({ x: 0, y: 0 }));
    const velPool = createComponentPool(() => ({ dx: 0, dy: 0 }));

    posPool.acquire(1);
    velPool.acquire(1);
    velPool.acquire(2);

    assert.equal(posPool.activeCount, 1);
    assert.equal(velPool.activeCount, 2);

    posPool.release(1);
    assert.equal(posPool.has(1), false);
    assert.equal(velPool.has(1), true); // unaffected
  });
});
