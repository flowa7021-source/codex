// ─── Unit Tests: Storage Manager API ─────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isStorageEstimateSupported,
  getStorageQuota,
  hasEnoughSpace,
  onStoragePressure,
  requestPersistentStorage,
} from '../../app/modules/storage-estimate.js';

// ─── beforeEach / afterEach ───────────────────────────────────────────────────

beforeEach(() => {
  globalThis.navigator.storage = {
    estimate: async () => ({ usage: 500_000, quota: 1_000_000 }),
    persist: async () => true,
  };
});

afterEach(() => {
  delete globalThis.navigator.storage;
});

// ─── isStorageEstimateSupported ───────────────────────────────────────────────

describe('isStorageEstimateSupported', () => {
  it('returns a boolean', () => {
    const result = isStorageEstimateSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when navigator.storage and estimate are present', () => {
    assert.equal(isStorageEstimateSupported(), true);
  });

  it('returns false when navigator.storage is absent', () => {
    delete globalThis.navigator.storage;
    assert.equal(isStorageEstimateSupported(), false);
  });
});

// ─── getStorageQuota ──────────────────────────────────────────────────────────

describe('getStorageQuota', () => {
  it('returns an object with all 4 required fields', async () => {
    const quota = await getStorageQuota();
    assert.equal(typeof quota.usage, 'number');
    assert.equal(typeof quota.quota, 'number');
    assert.equal(typeof quota.usagePercent, 'number');
    assert.equal(typeof quota.availableBytes, 'number');
  });

  it('computes usagePercent correctly', async () => {
    const quota = await getStorageQuota();
    // 500_000 / 1_000_000 * 100 = 50
    assert.equal(quota.usagePercent, 50);
  });

  it('computes availableBytes correctly', async () => {
    const quota = await getStorageQuota();
    // 1_000_000 - 500_000 = 500_000
    assert.equal(quota.availableBytes, 500_000);
  });

  it('returns usage and quota from the mock', async () => {
    const quota = await getStorageQuota();
    assert.equal(quota.usage, 500_000);
    assert.equal(quota.quota, 1_000_000);
  });

  it('returns all-zeros when the API is absent', async () => {
    delete globalThis.navigator.storage;
    const quota = await getStorageQuota();
    assert.deepEqual(quota, { usage: 0, quota: 0, usagePercent: 0, availableBytes: 0 });
  });

  it('returns all-zeros when estimate rejects', async () => {
    globalThis.navigator.storage = {
      estimate: async () => { throw new Error('storage unavailable'); },
    };
    const quota = await getStorageQuota();
    assert.deepEqual(quota, { usage: 0, quota: 0, usagePercent: 0, availableBytes: 0 });
  });
});

// ─── hasEnoughSpace ───────────────────────────────────────────────────────────

describe('hasEnoughSpace', () => {
  it('returns true when available space is sufficient', async () => {
    // available = 500_000; ask for 100_000
    const result = await hasEnoughSpace(100_000);
    assert.equal(result, true);
  });

  it('returns false when required bytes exceed available space', async () => {
    // available = 500_000; ask for 600_000
    const result = await hasEnoughSpace(600_000);
    assert.equal(result, false);
  });

  it('returns true (optimistic) when the API is absent', async () => {
    delete globalThis.navigator.storage;
    const result = await hasEnoughSpace(999_999_999);
    assert.equal(result, true);
  });

  it('returns true when required bytes exactly equal available space', async () => {
    const result = await hasEnoughSpace(500_000);
    assert.equal(result, true);
  });
});

// ─── onStoragePressure ────────────────────────────────────────────────────────

describe('onStoragePressure', () => {
  it('returns a stop function', () => {
    const stop = onStoragePressure(() => {});
    assert.equal(typeof stop, 'function');
    stop(); // clean up
  });

  it('stop function is callable without throwing', () => {
    const stop = onStoragePressure(() => {});
    assert.doesNotThrow(() => stop());
  });

  it('does not fire immediately when below threshold', () => {
    // usage=500_000, quota=1_000_000 → 50% — below default 80%
    let fired = false;
    let capturedIntervalFn = null;

    const origSetInterval = globalThis.setInterval;
    const origClearInterval = globalThis.clearInterval;

    globalThis.setInterval = (fn, _delay) => {
      capturedIntervalFn = fn;
      return 999;
    };
    globalThis.clearInterval = (_id) => {};

    const stop = onStoragePressure(() => { fired = true; });

    // Handler should NOT have fired yet (setInterval callback not called)
    assert.equal(fired, false);
    assert.equal(typeof capturedIntervalFn, 'function');

    stop();

    globalThis.setInterval = origSetInterval;
    globalThis.clearInterval = origClearInterval;
  });

  it('fires handler when usage is above threshold', async () => {
    // Override to 90% usage
    globalThis.navigator.storage = {
      estimate: async () => ({ usage: 900_000, quota: 1_000_000 }),
      persist: async () => true,
    };

    let capturedIntervalFn = null;
    const origSetInterval = globalThis.setInterval;
    const origClearInterval = globalThis.clearInterval;

    globalThis.setInterval = (fn, _delay) => {
      capturedIntervalFn = fn;
      return 998;
    };
    globalThis.clearInterval = (_id) => {};

    let firedCount = 0;
    const stop = onStoragePressure(() => { firedCount++; }, 80);

    // Manually trigger the interval callback
    assert.ok(capturedIntervalFn, 'interval callback must be registered');
    await capturedIntervalFn();

    assert.equal(firedCount, 1);
    stop();

    globalThis.setInterval = origSetInterval;
    globalThis.clearInterval = origClearInterval;
  });

  it('uses clearInterval when stop is called', () => {
    let clearedId = undefined;
    const origSetInterval = globalThis.setInterval;
    const origClearInterval = globalThis.clearInterval;

    globalThis.setInterval = (_fn, _delay) => 42;
    globalThis.clearInterval = (id) => { clearedId = id; };

    const stop = onStoragePressure(() => {});
    stop();

    assert.equal(clearedId, 42);

    globalThis.setInterval = origSetInterval;
    globalThis.clearInterval = origClearInterval;
  });
});

// ─── requestPersistentStorage ─────────────────────────────────────────────────

describe('requestPersistentStorage', () => {
  it('returns true when the mock persist resolves true', async () => {
    const result = await requestPersistentStorage();
    assert.equal(result, true);
  });

  it('returns false when navigator.storage is absent', async () => {
    delete globalThis.navigator.storage;
    const result = await requestPersistentStorage();
    assert.equal(result, false);
  });

  it('returns false when persist rejects', async () => {
    globalThis.navigator.storage = {
      estimate: async () => ({ usage: 0, quota: 0 }),
      persist: async () => { throw new Error('denied'); },
    };
    const result = await requestPersistentStorage();
    assert.equal(result, false);
  });
});
