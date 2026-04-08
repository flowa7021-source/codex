// ─── Unit Tests: Screen Orientation ─────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isScreenOrientationSupported,
  getOrientationStatus,
  onOrientationChange,
  lockOrientation,
  unlockOrientation,
  getSuggestedViewMode,
} from '../../app/modules/screen-orientation.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Install a fake screen.orientation with event-listener support.
 * @param {string} type - e.g. 'portrait-primary'
 * @param {number} angle - e.g. 0
 * @returns {{ trigger: () => void }} helper to simulate a change event
 */
function installFakeOrientation(type, angle) {
  const listeners = { change: [] };
  const fake = {
    type,
    angle,
    addEventListener(eventType, fn) {
      if (!listeners[eventType]) listeners[eventType] = [];
      listeners[eventType].push(fn);
    },
    removeEventListener(eventType, fn) {
      if (listeners[eventType]) {
        listeners[eventType] = listeners[eventType].filter((f) => f !== fn);
      }
    },
    lock: (orientationType) => Promise.resolve(orientationType),
    unlock: () => {},
  };

  // Ensure globalThis.screen exists and has orientation
  if (typeof globalThis.screen === 'undefined') {
    globalThis.screen = {};
  }
  globalThis.screen.orientation = fake;

  return {
    trigger() {
      for (const fn of (listeners.change || [])) fn();
    },
    getListeners() {
      return (listeners.change || []).length;
    },
  };
}

/** Remove the fake orientation from globalThis.screen. */
function removeFakeOrientation() {
  if (typeof globalThis.screen !== 'undefined') {
    delete globalThis.screen.orientation;
  }
}

// ─── Save/restore originals ───────────────────────────────────────────────────

let _originalScreen;

beforeEach(() => {
  _originalScreen = globalThis.screen;
});

afterEach(() => {
  if (_originalScreen === undefined) {
    delete globalThis.screen;
  } else {
    globalThis.screen = _originalScreen;
  }
});

// ─── isScreenOrientationSupported ────────────────────────────────────────────

describe('isScreenOrientationSupported', () => {
  it('returns a boolean', () => {
    const result = isScreenOrientationSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when screen.orientation is present', () => {
    installFakeOrientation('portrait-primary', 0);
    assert.equal(isScreenOrientationSupported(), true);
  });

  it('returns false when screen.orientation is absent', () => {
    removeFakeOrientation();
    assert.equal(isScreenOrientationSupported(), false);
  });

  it('returns false when screen itself is absent', () => {
    delete globalThis.screen;
    assert.equal(isScreenOrientationSupported(), false);
  });
});

// ─── getOrientationStatus ────────────────────────────────────────────────────

describe('getOrientationStatus', () => {
  it('always returns an object with the required fields', () => {
    const status = getOrientationStatus();
    assert.equal(typeof status, 'object');
    assert.ok(status !== null);
    assert.ok('type' in status);
    assert.ok('angle' in status);
    assert.ok('isPortrait' in status);
    assert.ok('isLandscape' in status);
  });

  it('isPortrait and isLandscape are booleans', () => {
    const status = getOrientationStatus();
    assert.equal(typeof status.isPortrait, 'boolean');
    assert.equal(typeof status.isLandscape, 'boolean');
  });

  it('isPortrait and isLandscape are mutually exclusive', () => {
    const status = getOrientationStatus();
    assert.notEqual(status.isPortrait, status.isLandscape);
  });

  it('returns correct values for portrait-primary (angle 0)', () => {
    installFakeOrientation('portrait-primary', 0);
    const status = getOrientationStatus();
    assert.equal(status.type, 'portrait-primary');
    assert.equal(status.angle, 0);
    assert.equal(status.isPortrait, true);
    assert.equal(status.isLandscape, false);
  });

  it('returns correct values for landscape-primary (angle 90)', () => {
    installFakeOrientation('landscape-primary', 90);
    const status = getOrientationStatus();
    assert.equal(status.type, 'landscape-primary');
    assert.equal(status.angle, 90);
    assert.equal(status.isPortrait, false);
    assert.equal(status.isLandscape, true);
  });

  it('returns correct values for landscape-secondary (angle 270)', () => {
    installFakeOrientation('landscape-secondary', 270);
    const status = getOrientationStatus();
    assert.equal(status.type, 'landscape-secondary');
    assert.equal(status.angle, 270);
    assert.equal(status.isPortrait, false);
    assert.equal(status.isLandscape, true);
  });

  it('returns correct values for portrait-secondary (angle 180)', () => {
    installFakeOrientation('portrait-secondary', 180);
    const status = getOrientationStatus();
    assert.equal(status.type, 'portrait-secondary');
    assert.equal(status.angle, 180);
    assert.equal(status.isPortrait, true);
    assert.equal(status.isLandscape, false);
  });

  it('falls back gracefully when screen.orientation is absent', () => {
    removeFakeOrientation();
    // setup-dom sets window.innerWidth = 1920, innerHeight = 1080 → landscape
    const status = getOrientationStatus();
    assert.equal(status.type, 'unknown');
    assert.equal(status.isLandscape, true);
    assert.equal(status.isPortrait, false);
  });
});

// ─── getSuggestedViewMode ─────────────────────────────────────────────────────

describe('getSuggestedViewMode', () => {
  it('returns "spread" for landscape-primary', () => {
    const mode = getSuggestedViewMode({ type: 'landscape-primary', angle: 90, isPortrait: false, isLandscape: true });
    assert.equal(mode, 'spread');
  });

  it('returns "spread" for landscape-secondary', () => {
    const mode = getSuggestedViewMode({ type: 'landscape-secondary', angle: 270, isPortrait: false, isLandscape: true });
    assert.equal(mode, 'spread');
  });

  it('returns "single" for portrait-primary', () => {
    const mode = getSuggestedViewMode({ type: 'portrait-primary', angle: 0, isPortrait: true, isLandscape: false });
    assert.equal(mode, 'single');
  });

  it('returns "single" for portrait-secondary', () => {
    const mode = getSuggestedViewMode({ type: 'portrait-secondary', angle: 180, isPortrait: true, isLandscape: false });
    assert.equal(mode, 'single');
  });

  it('uses live orientation when no status is passed', () => {
    installFakeOrientation('landscape-primary', 90);
    assert.equal(getSuggestedViewMode(), 'spread');
  });

  it('returns "single" when live orientation is portrait', () => {
    installFakeOrientation('portrait-primary', 0);
    assert.equal(getSuggestedViewMode(), 'single');
  });
});

// ─── onOrientationChange ─────────────────────────────────────────────────────

describe('onOrientationChange', () => {
  it('returns a function (unsubscribe)', () => {
    installFakeOrientation('portrait-primary', 0);
    const unsub = onOrientationChange(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('fires handler when orientation changes', () => {
    const helper = installFakeOrientation('portrait-primary', 0);
    const received = [];

    onOrientationChange((status) => received.push(status));

    // Simulate change: update fake orientation then fire
    globalThis.screen.orientation.type = 'landscape-primary';
    globalThis.screen.orientation.angle = 90;
    helper.trigger();

    assert.equal(received.length, 1);
    assert.equal(received[0].isLandscape, true);
  });

  it('unsubscribe prevents further handler calls', () => {
    const helper = installFakeOrientation('portrait-primary', 0);
    const received = [];
    const unsub = onOrientationChange((status) => received.push(status));

    // First change — received
    helper.trigger();
    assert.equal(received.length, 1);

    // Unsubscribe
    unsub();

    // Second change — should be ignored
    helper.trigger();
    assert.equal(received.length, 1);
  });

  it('falls back to window orientationchange event when API absent', () => {
    removeFakeOrientation();
    const received = [];
    const unsub = onOrientationChange((status) => received.push(status));

    // Trigger via window event
    globalThis.window.dispatchEvent({ type: 'orientationchange' });

    assert.equal(received.length, 1);
    unsub();
  });

  it('fallback unsubscribe removes window listener', () => {
    removeFakeOrientation();
    const received = [];
    const unsub = onOrientationChange((status) => received.push(status));

    globalThis.window.dispatchEvent({ type: 'orientationchange' });
    assert.equal(received.length, 1);

    unsub();
    globalThis.window.dispatchEvent({ type: 'orientationchange' });
    assert.equal(received.length, 1, 'handler should not fire after unsubscribe');
  });
});

// ─── lockOrientation ──────────────────────────────────────────────────────────

describe('lockOrientation', () => {
  it('resolves without throwing when API is absent', async () => {
    removeFakeOrientation();
    await assert.doesNotReject(async () => {
      await lockOrientation('portrait-primary');
    });
  });

  it('resolves without throwing when API is present', async () => {
    installFakeOrientation('portrait-primary', 0);
    await assert.doesNotReject(async () => {
      await lockOrientation('landscape-primary');
    });
  });

  it('returns a Promise', () => {
    removeFakeOrientation();
    const result = lockOrientation('portrait-primary');
    assert.ok(result instanceof Promise);
  });
});

// ─── unlockOrientation ────────────────────────────────────────────────────────

describe('unlockOrientation', () => {
  it('does not throw when API is absent', () => {
    removeFakeOrientation();
    assert.doesNotThrow(() => unlockOrientation());
  });

  it('does not throw when API is present', () => {
    installFakeOrientation('portrait-primary', 0);
    assert.doesNotThrow(() => unlockOrientation());
  });
});
