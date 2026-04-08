// ─── Unit Tests: Web Locks ───────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isWebLocksSupported,
  withLock,
  withSharedLock,
  tryLock,
  getLockState,
  isLockHeld,
} from '../../app/modules/web-locks.js';

// ─── Fake navigator.locks implementation ─────────────────────────────────────
// Simulates the Web Locks API in-process (single-tab) for testing.

/** @typedef {{ name: string; mode: string; clientId?: string }} FakeLockInfo */

/**
 * Build a fake navigator.locks object that coordinates exclusive/shared locks
 * within a single process (sufficient for unit testing).
 */
function createFakeLocks() {
  /** @type {Map<string, { mode: string; clientId: string }[]>} held locks */
  const held = new Map();
  /** @type {Map<string, Array<{ mode: string; resolve: () => void }>>} pending queues */
  const pending = new Map();

  function canAcquire(name, mode) {
    const heldList = held.get(name) ?? [];
    if (heldList.length === 0) return true;
    if (mode === 'shared' && heldList.every(l => l.mode === 'shared')) return true;
    return false;
  }

  function tryGrant(name) {
    const queue = pending.get(name) ?? [];
    if (queue.length === 0) return;
    const next = queue[0];
    if (canAcquire(name, next.mode)) {
      queue.shift();
      if (queue.length === 0) pending.delete(name);
      next.resolve();
    }
  }

  function acquire(name, mode, clientId) {
    if (canAcquire(name, mode)) {
      if (!held.has(name)) held.set(name, []);
      held.get(name).push({ mode, clientId });
      return Promise.resolve();
    }
    // Queue the waiter
    return new Promise(resolve => {
      if (!pending.has(name)) pending.set(name, []);
      pending.get(name).push({ mode, resolve });
    });
  }

  function release(name, clientId) {
    const list = held.get(name) ?? [];
    const idx = list.findIndex(l => l.clientId === clientId);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) held.delete(name);
    tryGrant(name);
  }

  let _clientCounter = 0;

  return {
    /**
     * @param {string} name
     * @param {any} opts
     * @param {(lock: any) => Promise<any>} callback
     */
    request(name, opts, callback) {
      const mode = opts?.mode ?? 'exclusive';
      const ifAvailable = opts?.ifAvailable ?? false;
      const signal = opts?.signal ?? null;
      const clientId = `client-${++_clientCounter}`;

      if (ifAvailable) {
        if (!canAcquire(name, mode)) {
          // Pass null to callback — lock not available
          return Promise.resolve(callback(null));
        }
      }

      const acquirePromise = acquire(name, mode, clientId);

      const lockPromise = acquirePromise.then(() => {
        // Check if already aborted
        if (signal && signal.aborted) {
          release(name, clientId);
          return Promise.reject(signal.reason ?? new DOMException('AbortError', 'AbortError'));
        }
        const fakeLock = { name, mode, clientId };
        let cbResult;
        try {
          cbResult = callback(fakeLock);
        } catch (err) {
          release(name, clientId);
          return Promise.reject(err);
        }
        return Promise.resolve(cbResult).finally(() => {
          release(name, clientId);
        });
      });

      if (signal) {
        const abortLockPromise = new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(signal.reason ?? new DOMException('AbortError', 'AbortError'));
          }, { once: true });
        });
        return Promise.race([lockPromise, abortLockPromise]);
      }

      return lockPromise;
    },

    query() {
      const heldList = [];
      for (const [name, entries] of held) {
        for (const e of entries) {
          heldList.push({ name, mode: e.mode, clientId: e.clientId });
        }
      }
      const pendingList = [];
      for (const [name, entries] of pending) {
        for (const e of entries) {
          pendingList.push({ name, mode: e.mode });
        }
      }
      return Promise.resolve({ held: heldList, pending: pendingList });
    },
  };
}

// ─── Install / restore fake navigator.locks ──────────────────────────────────

let _originalLocks;

beforeEach(() => {
  _originalLocks = globalThis.navigator.locks;
  globalThis.navigator.locks = createFakeLocks();
});

afterEach(() => {
  if (_originalLocks !== undefined) {
    globalThis.navigator.locks = _originalLocks;
  } else {
    delete globalThis.navigator.locks;
  }
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('isWebLocksSupported', () => {
  it('returns a boolean', () => {
    const result = isWebLocksSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when navigator.locks is present', () => {
    assert.equal(isWebLocksSupported(), true);
  });

  it('returns false when navigator.locks is absent', () => {
    delete globalThis.navigator.locks;
    assert.equal(isWebLocksSupported(), false);
  });
});

describe('withLock() — basic behavior', () => {
  it('runs callback and resolves with its return value', async () => {
    const result = await withLock('test-basic', async () => 42);
    assert.equal(result, 42);
  });

  it('releases lock after callback completes', async () => {
    await withLock('test-release', async () => {});
    // After release, a second call should succeed immediately (not deadlock)
    const result = await withLock('test-release', async () => 'ok');
    assert.equal(result, 'ok');
  });

  it('releases lock even if callback throws', async () => {
    await assert.rejects(
      () => withLock('test-throw', async () => { throw new Error('boom'); }),
      /boom/,
    );
    // Lock must have been released — subsequent call must resolve
    const result = await withLock('test-throw', async () => 'recovered');
    assert.equal(result, 'recovered');
  });
});

describe('withSharedLock()', () => {
  it('works like withLock — runs callback and resolves with its return value', async () => {
    const result = await withSharedLock('test-shared', async () => 'shared-result');
    assert.equal(result, 'shared-result');
  });

  it('releases shared lock after callback completes', async () => {
    await withSharedLock('test-shared-release', async () => {});
    const result = await withSharedLock('test-shared-release', async () => 'ok');
    assert.equal(result, 'ok');
  });
});

describe('tryLock()', () => {
  it('runs callback when lock is available', async () => {
    const result = await tryLock('test-try-available', async () => 'tried');
    assert.equal(result, 'tried');
  });

  it('returns null when lock is not immediately available', async () => {
    // Hold the lock so tryLock cannot acquire it
    let releaseHolder;
    const holderPromise = withLock('test-try-busy', () => new Promise(resolve => {
      releaseHolder = resolve;
    }));

    // Wait a tick so the holder acquires the lock first
    await new Promise(resolve => setImmediate(resolve));

    const result = await tryLock('test-try-busy', async () => 'should-not-run');
    assert.equal(result, null);

    releaseHolder();
    await holderPromise;
  });
});

describe('getLockState()', () => {
  it('returns object with held and pending arrays', async () => {
    const state = await getLockState();
    assert.ok(Array.isArray(state.held), 'held should be an array');
    assert.ok(Array.isArray(state.pending), 'pending should be an array');
  });

  it('returns empty arrays when navigator.locks is absent', async () => {
    delete globalThis.navigator.locks;
    const state = await getLockState();
    assert.deepEqual(state, { held: [], pending: [] });
  });
});

describe('withLock() — in-memory fallback when navigator.locks absent', () => {
  it('falls back to in-memory lock and still runs callback', async () => {
    delete globalThis.navigator.locks;
    const result = await withLock('test-fallback', async () => 'fallback-result');
    assert.equal(result, 'fallback-result');
  });

  it('fallback serializes concurrent exclusive locks', async () => {
    delete globalThis.navigator.locks;

    const order = [];
    let releaseFirst;

    const p1 = withLock('test-fb-serial', () => new Promise(resolve => {
      releaseFirst = () => resolve();
      order.push('first-acquired');
    }));

    // Give the first lock time to be acquired
    await new Promise(resolve => setImmediate(resolve));

    const p2 = withLock('test-fb-serial', async () => {
      order.push('second-acquired');
    });

    // Second lock should be waiting — release the first
    releaseFirst();
    await Promise.all([p1, p2]);

    assert.deepEqual(order, ['first-acquired', 'second-acquired']);
  });
});

describe('withLock() — timeout', () => {
  it('rejects when lock takes too long', async () => {
    // Hold the lock indefinitely
    let releaseHolder;
    const holderPromise = withLock('test-timeout', () => new Promise(resolve => {
      releaseHolder = resolve;
    }));

    // Wait a tick so holder acquires first
    await new Promise(resolve => setImmediate(resolve));

    await assert.rejects(
      () => withLock('test-timeout', async () => 'never', { timeout: 30 }),
      // Error can be DOMException (AbortError) or a plain Error
      (err) => {
        assert.ok(err instanceof Error || (err && typeof err === 'object'), 'should be an error');
        return true;
      },
    );

    releaseHolder();
    await holderPromise;
  });
});

describe('isLockHeld()', () => {
  it('returns false when no lock is held with that name', async () => {
    const held = await isLockHeld('no-such-lock');
    assert.equal(held, false);
  });

  it('returns true when a lock is currently held', async () => {
    let checkResult;
    await withLock('test-isheld', async () => {
      checkResult = await isLockHeld('test-isheld');
    });
    assert.equal(checkResult, true);
  });
});

describe('Concurrent exclusive locks are serialized', () => {
  it('three concurrent callers run in FIFO order', async () => {
    const order = [];
    let releaseFirst;

    const p1 = withLock('test-concurrent', () => new Promise(resolve => {
      releaseFirst = resolve;
      order.push(1);
    }));

    // Give p1 time to acquire the lock
    await new Promise(resolve => setImmediate(resolve));

    const p2 = withLock('test-concurrent', async () => { order.push(2); });
    const p3 = withLock('test-concurrent', async () => { order.push(3); });

    releaseFirst();
    await Promise.all([p1, p2, p3]);

    assert.deepEqual(order, [1, 2, 3]);
  });
});
