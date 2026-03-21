// ─── Unit Tests: AsyncLock ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AsyncLock } from '../../app/modules/async-lock.js';

describe('AsyncLock – basic acquire/release', () => {
  it('starts unlocked', () => {
    const lock = new AsyncLock();
    assert.equal(lock.isLocked, false);
    assert.equal(lock.queueLength, 0);
  });

  it('acquire locks and release unlocks', async () => {
    const lock = new AsyncLock();
    const release = await lock.acquire();
    assert.equal(lock.isLocked, true);
    release();
    assert.equal(lock.isLocked, false);
  });

  it('double release is safe (no-op)', async () => {
    const lock = new AsyncLock();
    const release = await lock.acquire();
    release();
    release(); // should not throw
    assert.equal(lock.isLocked, false);
  });
});

describe('AsyncLock – queue behavior', () => {
  it('second acquire waits until first releases', async () => {
    const lock = new AsyncLock();
    const order = [];

    const release1 = await lock.acquire();
    order.push('acquired-1');

    const p2 = lock.acquire().then((release2) => {
      order.push('acquired-2');
      release2();
    });

    // At this point, second acquire should be queued
    assert.equal(lock.queueLength, 1);

    release1();
    await p2;

    assert.deepEqual(order, ['acquired-1', 'acquired-2']);
    assert.equal(lock.isLocked, false);
  });

  it('concurrent acquires resolve in FIFO order', async () => {
    const lock = new AsyncLock();
    const order = [];

    const release1 = await lock.acquire();

    const p2 = lock.acquire().then((rel) => {
      order.push(2);
      rel();
    });
    const p3 = lock.acquire().then((rel) => {
      order.push(3);
      rel();
    });
    const p4 = lock.acquire().then((rel) => {
      order.push(4);
      rel();
    });

    assert.equal(lock.queueLength, 3);

    release1();
    await Promise.all([p2, p3, p4]);

    assert.deepEqual(order, [2, 3, 4]);
    assert.equal(lock.isLocked, false);
    assert.equal(lock.queueLength, 0);
  });
});

describe('AsyncLock – release unblocks next', () => {
  it('releasing unblocks the next waiter immediately', async () => {
    const lock = new AsyncLock();
    let secondAcquired = false;

    const release1 = await lock.acquire();

    const p2 = lock.acquire().then((rel) => {
      secondAcquired = true;
      rel();
    });

    assert.equal(secondAcquired, false);
    release1();
    await p2;
    assert.equal(secondAcquired, true);
  });
});
