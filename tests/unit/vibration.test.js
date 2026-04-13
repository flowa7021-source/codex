// ─── Unit Tests: Vibration API ───────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isVibrationSupported,
  vibrate,
  vibrateOnce,
  vibratePattern,
  cancelVibration,
  PATTERNS,
} from '../../app/modules/vibration.js';

// ─── Mock vibrate ─────────────────────────────────────────────────────────────

let calls = [];

beforeEach(() => {
  calls = [];
  globalThis.navigator.vibrate = (pattern) => { calls.push(pattern); return true; };
});

afterEach(() => {
  delete globalThis.navigator.vibrate;
});

// ─── isVibrationSupported ─────────────────────────────────────────────────────

describe('isVibrationSupported', () => {
  it('returns a boolean', () => {
    const result = isVibrationSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when vibrate mock is installed', () => {
    assert.equal(isVibrationSupported(), true);
  });

  it('returns false when vibrate is absent', () => {
    delete globalThis.navigator.vibrate;
    assert.equal(isVibrationSupported(), false);
  });
});

// ─── vibrate ──────────────────────────────────────────────────────────────────

describe('vibrate', () => {
  it('calls navigator.vibrate with the given pattern', () => {
    vibrate(100);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], 100);
  });

  it('returns true when navigator.vibrate returns true', () => {
    const result = vibrate(100);
    assert.equal(result, true);
  });

  it('returns false when vibrate is absent', () => {
    delete globalThis.navigator.vibrate;
    const result = vibrate(100);
    assert.equal(result, false);
  });

  it('passes an array pattern through to navigator.vibrate', () => {
    vibrate([100, 50, 200]);
    assert.deepEqual(calls[0], [100, 50, 200]);
  });

  it('returns false and does not throw when navigator.vibrate throws', () => {
    globalThis.navigator.vibrate = () => { throw new Error('vibration error'); };
    let result;
    assert.doesNotThrow(() => { result = vibrate(100); });
    assert.equal(result, false);
  });
});

// ─── vibrateOnce ─────────────────────────────────────────────────────────────

describe('vibrateOnce', () => {
  it('uses default duration of 50ms when called without arguments', () => {
    vibrateOnce();
    assert.equal(calls[0], 50);
  });

  it('uses the provided duration when given', () => {
    vibrateOnce(200);
    assert.equal(calls[0], 200);
  });

  it('returns a boolean', () => {
    const result = vibrateOnce();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when supported', () => {
    assert.equal(vibrateOnce(), true);
  });

  it('returns false when vibrate is absent', () => {
    delete globalThis.navigator.vibrate;
    assert.equal(vibrateOnce(), false);
  });
});

// ─── vibratePattern ──────────────────────────────────────────────────────────

describe('vibratePattern', () => {
  it('passes the array to navigator.vibrate', () => {
    vibratePattern([50, 100, 50]);
    assert.deepEqual(calls[0], [50, 100, 50]);
  });

  it('returns a boolean', () => {
    const result = vibratePattern([50]);
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when supported', () => {
    assert.equal(vibratePattern([50]), true);
  });

  it('returns false when vibrate is absent', () => {
    delete globalThis.navigator.vibrate;
    assert.equal(vibratePattern([50, 100]), false);
  });
});

// ─── cancelVibration ─────────────────────────────────────────────────────────

describe('cancelVibration', () => {
  it('calls navigator.vibrate with 0', () => {
    cancelVibration();
    assert.equal(calls[0], 0);
  });

  it('returns a boolean', () => {
    const result = cancelVibration();
    assert.equal(typeof result, 'boolean');
  });

  it('returns false when vibrate is absent', () => {
    delete globalThis.navigator.vibrate;
    assert.equal(cancelVibration(), false);
  });
});

// ─── PATTERNS ─────────────────────────────────────────────────────────────────

describe('PATTERNS', () => {
  it('has a success pattern', () => {
    assert.ok(Array.isArray(PATTERNS.success));
    assert.ok(PATTERNS.success.length > 0);
  });

  it('success pattern matches [50, 50, 100]', () => {
    assert.deepEqual(PATTERNS.success, [50, 50, 100]);
  });

  it('has an error pattern', () => {
    assert.ok(Array.isArray(PATTERNS.error));
    assert.ok(PATTERNS.error.length > 0);
  });

  it('error pattern matches [200, 100, 200]', () => {
    assert.deepEqual(PATTERNS.error, [200, 100, 200]);
  });

  it('has a notification pattern', () => {
    assert.ok(Array.isArray(PATTERNS.notification));
    assert.ok(PATTERNS.notification.length > 0);
  });

  it('notification pattern matches [50]', () => {
    assert.deepEqual(PATTERNS.notification, [50]);
  });

  it('all pattern values are arrays of numbers', () => {
    for (const [key, val] of Object.entries(PATTERNS)) {
      assert.ok(Array.isArray(val), `PATTERNS.${key} should be an array`);
      for (const n of val) {
        assert.equal(typeof n, 'number', `PATTERNS.${key} should contain numbers`);
      }
    }
  });
});
