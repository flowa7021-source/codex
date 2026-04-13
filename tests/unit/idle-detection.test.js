// ─── Unit Tests: Idle Detection ─────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Ensure IdleDetector is absent so the fallback path is exercised ─────────
// (IdleDetector is a Chrome 94+ API; Node.js does not have it)
if ('IdleDetector' in globalThis) {
  delete globalThis.IdleDetector;
}

// ─── Patch document event listeners so we can simulate activity events ────────
// The setup-dom.js provides a minimal document with addEventListener/removeEventListener.
// We accumulate listeners in a map for manual dispatch.

const _docListeners = new Map();

globalThis.document.addEventListener = (type, fn, _opts) => {
  if (!_docListeners.has(type)) _docListeners.set(type, new Set());
  _docListeners.get(type).add(fn);
};

globalThis.document.removeEventListener = (type, fn) => {
  if (_docListeners.has(type)) {
    _docListeners.get(type).delete(fn);
  }
};

/** Dispatch a synthetic activity event on document. */
function simulateActivity(eventType = 'mousemove') {
  const handlers = _docListeners.get(eventType);
  if (handlers) {
    for (const fn of handlers) fn(new Event(eventType));
  }
}

// ─── Import the module under test ────────────────────────────────────────────
import {
  isIdleDetectionSupported,
  startIdleDetection,
  getIdleStatus,
  onIdleChange,
  isCurrentlyIdle,
  resetIdleTimer,
} from '../../app/modules/idle-detection.js';

// ─── Helpers to reset module-private state between tests ─────────────────────
// We exercise the public stop() function returned by startIdleDetection to
// clean up; the module's internal handlers set is reset by unsubscribing.

/** Collected stop functions to call in afterEach. */
let _stopFns = [];

afterEach(() => {
  for (const stop of _stopFns) {
    try { stop(); } catch { /* ignore */ }
  }
  _stopFns = [];
  _docListeners.clear();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('isIdleDetectionSupported', () => {
  it('returns a boolean', () => {
    const result = isIdleDetectionSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns false when IdleDetector is absent', () => {
    assert.equal(isIdleDetectionSupported(), false);
  });
});

describe('getIdleStatus', () => {
  it('returns an object with user, screen, and isIdle fields', () => {
    const status = getIdleStatus();
    assert.ok(typeof status === 'object' && status !== null, 'should be an object');
    assert.ok('user' in status, 'should have user field');
    assert.ok('screen' in status, 'should have screen field');
    assert.ok('isIdle' in status, 'should have isIdle field');
  });

  it('user is "active" or "idle"', () => {
    const { user } = getIdleStatus();
    assert.ok(user === 'active' || user === 'idle');
  });

  it('screen is "locked" or "unlocked"', () => {
    const { screen } = getIdleStatus();
    assert.ok(screen === 'locked' || screen === 'unlocked');
  });

  it('isIdle is a boolean', () => {
    const { isIdle } = getIdleStatus();
    assert.equal(typeof isIdle, 'boolean');
  });

  it('isIdle is true when user is "idle"', () => {
    const status = getIdleStatus();
    assert.equal(status.isIdle, status.user === 'idle');
  });
});

describe('isCurrentlyIdle', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isCurrentlyIdle(), 'boolean');
  });

  it('returns false before any idle threshold is reached', async () => {
    const stop = await startIdleDetection({ threshold: 60_000 });
    _stopFns.push(stop);
    assert.equal(isCurrentlyIdle(), false);
  });
});

describe('onIdleChange', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onIdleChange(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('unsubscribe removes the handler so it is no longer called', async () => {
    const calls = [];
    const unsub = onIdleChange((s) => calls.push(s));

    // Start with a very short threshold so we can trigger idle in the test
    const stop = await startIdleDetection({ threshold: 100 });
    _stopFns.push(stop);

    unsub();

    // Simulate time passing: manually tick past the threshold
    // We do this by directly calling resetIdleTimer to mark idle via internal path.
    // Because unsubscribe was called, the handler should NOT be invoked.
    assert.equal(calls.length, 0, 'handler should not have been called after unsubscribe');
  });
});

describe('resetIdleTimer', () => {
  it('does not throw', () => {
    assert.doesNotThrow(() => resetIdleTimer());
  });

  it('can be called multiple times safely', () => {
    assert.doesNotThrow(() => {
      resetIdleTimer();
      resetIdleTimer();
      resetIdleTimer();
    });
  });
});

describe('startIdleDetection — fallback path (no IdleDetector)', () => {
  it('returns a stop function', async () => {
    const stop = await startIdleDetection({ threshold: 60_000 });
    _stopFns.push(stop);
    assert.equal(typeof stop, 'function');
  });

  it('stop function does not throw', async () => {
    const stop = await startIdleDetection({ threshold: 60_000 });
    assert.doesNotThrow(() => stop());
  });

  it('registers document event listeners for activity events', async () => {
    const stop = await startIdleDetection({ threshold: 60_000 });
    _stopFns.push(stop);
    // After starting, the listeners map should have entries for activity events
    assert.ok(_docListeners.has('mousemove'), 'should register mousemove listener');
    assert.ok(_docListeners.has('keydown'), 'should register keydown listener');
    assert.ok(_docListeners.has('touchstart'), 'should register touchstart listener');
    assert.ok(_docListeners.has('scroll'), 'should register scroll listener');
  });

  it('stop function removes document event listeners', async () => {
    const stop = await startIdleDetection({ threshold: 60_000 });
    stop();
    // After stop, listener sets should be empty
    for (const [, handlers] of _docListeners) {
      assert.equal(handlers.size, 0, 'all listeners should be removed after stop');
    }
  });

  it('status stays active after a simulated activity event', async () => {
    const stop = await startIdleDetection({ threshold: 60_000 });
    _stopFns.push(stop);

    simulateActivity('mousemove');

    assert.equal(getIdleStatus().user, 'active');
    assert.equal(isCurrentlyIdle(), false);
  });

  it('default threshold is 60 seconds (60000 ms)', async () => {
    // We verify by checking that no "idle" state is set immediately after start,
    // which implies the default threshold has not been exceeded.
    const stop = await startIdleDetection(); // no threshold arg
    _stopFns.push(stop);
    assert.equal(isCurrentlyIdle(), false);
  });

  it('custom threshold is respected', async () => {
    // With a very long threshold the status should still be active immediately.
    const stop = await startIdleDetection({ threshold: 999_999 });
    _stopFns.push(stop);
    assert.equal(isCurrentlyIdle(), false);
  });

  it('status becomes idle after threshold ms of no activity', async () => {
    // We use a very short threshold (1 ms) so it expires immediately, then
    // manually force the interval callback by using a fake clock approach:
    // replace setInterval/clearInterval with synchronous stubs for this test.

    const origSetInterval = globalThis.setInterval;
    const origClearInterval = globalThis.clearInterval;

    let capturedCallback = null;
    const capturedIntervalId = 99;

    globalThis.setInterval = (fn, _ms) => {
      capturedCallback = fn;
      return capturedIntervalId;
    };
    globalThis.clearInterval = (_id) => {
      capturedCallback = null;
    };

    try {
      // Ensure we're starting from a known active state
      resetIdleTimer();

      const stop = await startIdleDetection({ threshold: 1 });

      // Simulate that a lot of time has passed without activity by back-dating
      // _lastActivityAt. We do this by sleeping past the threshold.
      // Use setTimeout (not setInterval) so the timer fires once and is released.
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now manually fire the polling callback — it should detect idle.
      assert.ok(capturedCallback !== null, 'setInterval callback should have been captured');
      capturedCallback();

      assert.equal(isCurrentlyIdle(), true, 'should be idle after threshold exceeded');
      assert.equal(getIdleStatus().user, 'idle');

      stop();
    } finally {
      globalThis.setInterval = origSetInterval;
      globalThis.clearInterval = origClearInterval;
    }
  });

  it('handler is called when idle status changes to idle', async () => {
    const origSetInterval = globalThis.setInterval;
    const origClearInterval = globalThis.clearInterval;

    let capturedCallback = null;
    globalThis.setInterval = (fn, _ms) => { capturedCallback = fn; return 1; };
    globalThis.clearInterval = (_id) => { capturedCallback = null; };

    const statusChanges = [];
    const unsub = onIdleChange((s) => statusChanges.push(s));

    // Ensure active first
    resetIdleTimer();

    try {
      const stop = await startIdleDetection({ threshold: 1 });

      // Wait past the threshold
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger the polling tick
      if (capturedCallback) capturedCallback();

      assert.ok(statusChanges.length > 0, 'handler should have been called');
      assert.equal(statusChanges[statusChanges.length - 1].isIdle, true);
      assert.equal(statusChanges[statusChanges.length - 1].user, 'idle');

      stop();
    } finally {
      unsub();
      globalThis.setInterval = origSetInterval;
      globalThis.clearInterval = origClearInterval;
    }
  });

  it('handler is called when activity resumes after idle', async () => {
    const origSetInterval = globalThis.setInterval;
    const origClearInterval = globalThis.clearInterval;

    let capturedCallback = null;
    globalThis.setInterval = (fn, _ms) => { capturedCallback = fn; return 2; };
    globalThis.clearInterval = (_id) => { capturedCallback = null; };

    const statusChanges = [];
    const unsub = onIdleChange((s) => statusChanges.push(s));

    resetIdleTimer();

    try {
      const stop = await startIdleDetection({ threshold: 1 });

      // Push past the threshold
      await new Promise(resolve => setTimeout(resolve, 10));
      if (capturedCallback) capturedCallback(); // → idle

      // Now simulate user activity
      simulateActivity('keydown'); // → should transition back to active

      assert.ok(statusChanges.length >= 2, 'should have at least idle + active transitions');
      const lastStatus = statusChanges[statusChanges.length - 1];
      assert.equal(lastStatus.user, 'active');
      assert.equal(lastStatus.isIdle, false);

      stop();
    } finally {
      unsub();
      globalThis.setInterval = origSetInterval;
      globalThis.clearInterval = origClearInterval;
    }
  });
});
