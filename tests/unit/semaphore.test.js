// ─── Unit Tests: Semaphore ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Semaphore, createSemaphore } from '../../app/modules/semaphore.js';

describe('Semaphore – constructor', () => {
  it('initialises with the correct number of permits', () => {
    const sem = new Semaphore(3);
    assert.equal(sem.permits, 3);
    assert.equal(sem.available, 3);
    assert.equal(sem.waiting, 0);
  });

  it('throws on non-positive permits', () => {
    assert.throws(() => new Semaphore(0), RangeError);
    assert.throws(() => new Semaphore(-1), RangeError);
    assert.throws(() => new Semaphore(1.5), RangeError);
  });
});

describe('Semaphore – acquire / release', () => {
  it('acquire resolves immediately when permits available', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    assert.equal(sem.available, 1);
    await sem.acquire();
    assert.equal(sem.available, 0);
  });

  it('release restores a permit', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();
    assert.equal(sem.available, 0);
    sem.release();
    assert.equal(sem.available, 1);
  });

  it('acquire blocks when no permits and resumes on release', async () => {
    const sem = new Semaphore(1);
    await sem.acquire(); // takes the only permit

    let acquired = false;
    const pending = sem.acquire().then(() => { acquired = true; });

    // Not yet acquired — still blocked
    assert.equal(acquired, false);
    assert.equal(sem.waiting, 1);

    sem.release();
    await pending;
    assert.equal(acquired, true);
    assert.equal(sem.waiting, 0);
  });

  it('waiters are woken in FIFO order', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    const order = [];
    const p1 = sem.acquire().then(() => order.push(1));
    const p2 = sem.acquire().then(() => order.push(2));
    const p3 = sem.acquire().then(() => order.push(3));

    assert.equal(sem.waiting, 3);

    sem.release(); // wakes p1
    await p1;
    sem.release(); // wakes p2
    await p2;
    sem.release(); // wakes p3
    await p3;

    assert.deepEqual(order, [1, 2, 3]);
  });

  it('release throws on unbalanced release', () => {
    const sem = new Semaphore(1);
    assert.throws(() => sem.release(), /release called without a matching acquire/);
  });
});

describe('Semaphore – tryAcquire', () => {
  it('returns true and decrements when permits available', () => {
    const sem = new Semaphore(2);
    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.available, 1);
    assert.equal(sem.tryAcquire(), true);
    assert.equal(sem.available, 0);
  });

  it('returns false when no permits available', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();
    assert.equal(sem.tryAcquire(), false);
    assert.equal(sem.available, 0);
  });
});

describe('Semaphore – concurrency limiting', () => {
  it('limits concurrency to the number of permits', async () => {
    const sem = new Semaphore(2);
    let running = 0;
    let maxRunning = 0;

    const task = async () => {
      await sem.acquire();
      running++;
      if (running > maxRunning) maxRunning = running;
      // Yield to let others attempt to acquire
      await new Promise(r => setTimeout(r, 5));
      running--;
      sem.release();
    };

    await Promise.all([task(), task(), task(), task(), task()]);
    assert.ok(maxRunning <= 2, `max concurrent was ${maxRunning}, expected <= 2`);
  });

  it('permits getter returns the max, not current available', async () => {
    const sem = new Semaphore(5);
    await sem.acquire();
    await sem.acquire();
    assert.equal(sem.permits, 5);
    assert.equal(sem.available, 3);
  });
});

describe('Semaphore – createSemaphore factory', () => {
  it('returns a Semaphore instance', () => {
    const sem = createSemaphore(4);
    assert.ok(sem instanceof Semaphore);
    assert.equal(sem.permits, 4);
  });
});
