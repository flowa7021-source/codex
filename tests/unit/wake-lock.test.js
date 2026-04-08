// ─── Unit Tests: Wake Lock ──────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// We need working document.addEventListener/removeEventListener for
// the visibilitychange handler. The setup-dom mock has no-ops, so we
// patch document with a real listener registry before importing the module.
const _docListeners = {};
document.addEventListener = (type, fn) => {
  if (!_docListeners[type]) _docListeners[type] = [];
  _docListeners[type].push(fn);
};
document.removeEventListener = (type, fn) => {
  if (_docListeners[type]) {
    _docListeners[type] = _docListeners[type].filter(f => f !== fn);
  }
};

function dispatchVisibilityChange() {
  const fns = (_docListeners['visibilitychange'] || []).slice();
  for (const fn of fns) fn();
}

// ── Mock WakeLockSentinel & navigator.wakeLock ──────────────────────────────
let mockSentinel;
let requestCallCount;

function resetMock() {
  mockSentinel = {
    released: false,
    release: async () => { mockSentinel.released = true; },
  };
  requestCallCount = 0;

  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async () => {
        requestCallCount++;
        mockSentinel.released = false;
        return mockSentinel;
      },
    },
  });
}

function removeWakeLockFromNavigator() {
  // Remove wakeLock property so isWakeLockSupported returns false
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: undefined,
  });
  // Actually delete it if possible
  delete /** @type {any} */ (navigator).wakeLock;
}

// Dynamic import so we can control navigator state before module loads.
// Since ES modules cache, we import once and reset state between tests.
const {
  isWakeLockSupported,
  requestWakeLock,
  releaseWakeLock,
  isWakeLockActive,
  withWakeLock,
} = await import('../../app/modules/wake-lock.js');

describe('wake-lock – isWakeLockSupported', () => {
  afterEach(() => {
    resetMock();
  });

  it('returns true when navigator.wakeLock exists', () => {
    resetMock();
    assert.equal(isWakeLockSupported(), true);
  });

  it('returns false when navigator.wakeLock is missing', () => {
    removeWakeLockFromNavigator();
    assert.equal(isWakeLockSupported(), false);
  });
});

describe('wake-lock – requestWakeLock / releaseWakeLock', () => {
  beforeEach(() => {
    resetMock();
  });

  afterEach(async () => {
    // Ensure clean state
    await releaseWakeLock();
    // Clear any leftover listeners
    _docListeners['visibilitychange'] = [];
  });

  it('acquires lock and isWakeLockActive returns true', async () => {
    const result = await requestWakeLock();
    assert.equal(result, true);
    assert.equal(isWakeLockActive(), true);
  });

  it('releaseWakeLock releases lock and isWakeLockActive returns false', async () => {
    await requestWakeLock();
    assert.equal(isWakeLockActive(), true);

    await releaseWakeLock();
    assert.equal(isWakeLockActive(), false);
  });

  it('returns false gracefully if API throws', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => { throw new Error('Permission denied'); },
      },
    });

    const result = await requestWakeLock();
    assert.equal(result, false);
    assert.equal(isWakeLockActive(), false);
  });

  it('double requestWakeLock does not error and returns true', async () => {
    await requestWakeLock();
    requestCallCount = 0;

    const result = await requestWakeLock();
    assert.equal(result, true);
    // Should not have called request again since lock is already active
    assert.equal(requestCallCount, 0);
  });

  it('releaseWakeLock when no lock is held is a no-op', async () => {
    // Should not throw
    await releaseWakeLock();
    assert.equal(isWakeLockActive(), false);
  });
});

describe('wake-lock – withWakeLock', () => {
  beforeEach(() => {
    resetMock();
  });

  afterEach(async () => {
    await releaseWakeLock();
    _docListeners['visibilitychange'] = [];
  });

  it('acquires and releases around a successful async function', async () => {
    let lockDuringFn = false;

    const result = await withWakeLock(async () => {
      lockDuringFn = isWakeLockActive();
      return 42;
    });

    assert.equal(lockDuringFn, true);
    assert.equal(result, 42);
    assert.equal(isWakeLockActive(), false);
  });

  it('releases lock even when async function throws', async () => {
    const err = new Error('boom');

    await assert.rejects(
      () => withWakeLock(async () => { throw err; }),
      (thrown) => thrown === err,
    );

    assert.equal(isWakeLockActive(), false);
  });
});

describe('wake-lock – visibilitychange re-acquisition', () => {
  beforeEach(() => {
    resetMock();
  });

  afterEach(async () => {
    await releaseWakeLock();
    _docListeners['visibilitychange'] = [];
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('re-acquires lock when page becomes visible after sentinel was released', async () => {
    await requestWakeLock();

    // Simulate browser releasing the sentinel on tab switch
    mockSentinel.released = true;
    assert.equal(isWakeLockActive(), false);

    // Simulate returning to the tab
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    dispatchVisibilityChange();
    // Allow the async re-acquisition to complete
    await new Promise(r => setTimeout(r, 10));

    assert.equal(isWakeLockActive(), true);
  });
});
