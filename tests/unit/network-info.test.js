// ─── Unit Tests: Network Info ─────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isNetworkInfoSupported,
  getNetworkStatus,
  getQualityHints,
  onNetworkChange,
} from '../../app/modules/network-info.js';

// ─── Helpers to install / remove a fake navigator.connection ─────────────────

/** @param {object} overrides */
function installFakeConnection(overrides = {}) {
  const fake = {
    type: 'unknown',
    effectiveType: 'unknown',
    downlink: undefined,
    rtt: undefined,
    saveData: false,
    _listeners: {},
    addEventListener(type, fn) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (this._listeners[type]) {
        this._listeners[type] = this._listeners[type].filter(f => f !== fn);
      }
    },
    dispatchEvent(evt) {
      const fns = this._listeners[evt.type] || [];
      for (const fn of fns) fn(evt);
    },
    ...overrides,
  };
  // Expose dispatchChange helper
  fake.dispatchChange = () => {
    const fns = fake._listeners['change'] || [];
    for (const fn of fns) fn({});
  };
  globalThis.navigator.connection = fake;
  return fake;
}

function removeFakeConnection() {
  delete globalThis.navigator.connection;
}

// ─── Reset between tests ──────────────────────────────────────────────────────

beforeEach(() => {
  removeFakeConnection();
  globalThis.navigator.onLine = true;
});

afterEach(() => {
  removeFakeConnection();
  globalThis.navigator.onLine = true;
});

// ─── isNetworkInfoSupported ───────────────────────────────────────────────────

describe('isNetworkInfoSupported', () => {
  it('returns a boolean', () => {
    const result = isNetworkInfoSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns false when navigator.connection is absent', () => {
    assert.equal(isNetworkInfoSupported(), false);
  });

  it('returns true when navigator.connection is present', () => {
    installFakeConnection();
    assert.equal(isNetworkInfoSupported(), true);
  });
});

// ─── getNetworkStatus — no connection API ────────────────────────────────────

describe('getNetworkStatus — no connection API', () => {
  it('returns an object with all 5 required fields', () => {
    const status = getNetworkStatus();
    assert.ok('isOnline' in status);
    assert.ok('type' in status);
    assert.ok('effectiveType' in status);
    assert.ok('downlink' in status);
    assert.ok('rtt' in status);
    assert.ok('saveData' in status);
  });

  it('isOnline is a boolean', () => {
    const status = getNetworkStatus();
    assert.equal(typeof status.isOnline, 'boolean');
  });

  it('effectiveType is a string', () => {
    const status = getNetworkStatus();
    assert.equal(typeof status.effectiveType, 'string');
  });

  it('returns unknown type and effectiveType when connection API is absent', () => {
    const status = getNetworkStatus();
    assert.equal(status.type, 'unknown');
    assert.equal(status.effectiveType, 'unknown');
  });

  it('returns null for downlink and rtt when connection API is absent', () => {
    const status = getNetworkStatus();
    assert.equal(status.downlink, null);
    assert.equal(status.rtt, null);
  });

  it('returns saveData=false when connection API is absent', () => {
    const status = getNetworkStatus();
    assert.equal(status.saveData, false);
  });

  it('reflects navigator.onLine when offline', () => {
    globalThis.navigator.onLine = false;
    const status = getNetworkStatus();
    assert.equal(status.isOnline, false);
  });
});

// ─── getNetworkStatus — with mocked navigator.connection ─────────────────────

describe('getNetworkStatus — with mocked navigator.connection', () => {
  it('reads effectiveType from connection', () => {
    installFakeConnection({ effectiveType: '3g' });
    const status = getNetworkStatus();
    assert.equal(status.effectiveType, '3g');
  });

  it('reads downlink from connection', () => {
    installFakeConnection({ downlink: 5.5 });
    const status = getNetworkStatus();
    assert.equal(status.downlink, 5.5);
  });

  it('reads rtt from connection', () => {
    installFakeConnection({ rtt: 120 });
    const status = getNetworkStatus();
    assert.equal(status.rtt, 120);
  });

  it('reads saveData from connection', () => {
    installFakeConnection({ saveData: true });
    const status = getNetworkStatus();
    assert.equal(status.saveData, true);
  });

  it('returns null for downlink when undefined in connection', () => {
    installFakeConnection({ downlink: undefined });
    const status = getNetworkStatus();
    assert.equal(status.downlink, null);
  });

  it('reads type from connection', () => {
    installFakeConnection({ type: 'wifi' });
    const status = getNetworkStatus();
    assert.equal(status.type, 'wifi');
  });
});

// ─── getQualityHints ─────────────────────────────────────────────────────────

describe('getQualityHints', () => {
  it('returns correct hints for slow-2g', () => {
    const hints = getQualityHints({ isOnline: true, type: 'unknown', effectiveType: 'slow-2g', downlink: null, rtt: null, saveData: false });
    assert.equal(hints.renderDpi, 72);
    assert.equal(hints.thumbnailSize, 'small');
    assert.equal(hints.prefetchPages, 1);
    assert.equal(hints.enableAnimations, false);
  });

  it('returns correct hints for 2g', () => {
    const hints = getQualityHints({ isOnline: true, type: 'unknown', effectiveType: '2g', downlink: null, rtt: null, saveData: false });
    assert.equal(hints.renderDpi, 72);
    assert.equal(hints.thumbnailSize, 'small');
    assert.equal(hints.prefetchPages, 1);
    assert.equal(hints.enableAnimations, false);
  });

  it('returns correct hints for 3g', () => {
    const hints = getQualityHints({ isOnline: true, type: 'unknown', effectiveType: '3g', downlink: null, rtt: null, saveData: false });
    assert.equal(hints.renderDpi, 96);
    assert.equal(hints.thumbnailSize, 'medium');
    assert.equal(hints.prefetchPages, 2);
    assert.equal(hints.enableAnimations, true);
  });

  it('returns correct hints for cellular type', () => {
    const hints = getQualityHints({ isOnline: true, type: 'cellular', effectiveType: 'unknown', downlink: null, rtt: null, saveData: false });
    assert.equal(hints.renderDpi, 96);
    assert.equal(hints.thumbnailSize, 'medium');
    assert.equal(hints.prefetchPages, 2);
    assert.equal(hints.enableAnimations, true);
  });

  it('returns correct hints for 4g', () => {
    const hints = getQualityHints({ isOnline: true, type: 'unknown', effectiveType: '4g', downlink: null, rtt: null, saveData: false });
    assert.equal(hints.renderDpi, 150);
    assert.equal(hints.thumbnailSize, 'large');
    assert.equal(hints.prefetchPages, 5);
    assert.equal(hints.enableAnimations, true);
  });

  it('returns correct hints for wifi type', () => {
    const hints = getQualityHints({ isOnline: true, type: 'wifi', effectiveType: 'unknown', downlink: null, rtt: null, saveData: false });
    assert.equal(hints.renderDpi, 150);
    assert.equal(hints.thumbnailSize, 'large');
    assert.equal(hints.prefetchPages, 5);
    assert.equal(hints.enableAnimations, true);
  });

  it('returns correct hints for ethernet type', () => {
    const hints = getQualityHints({ isOnline: true, type: 'ethernet', effectiveType: 'unknown', downlink: null, rtt: null, saveData: false });
    assert.equal(hints.renderDpi, 150);
    assert.equal(hints.thumbnailSize, 'large');
    assert.equal(hints.prefetchPages, 5);
    assert.equal(hints.enableAnimations, true);
  });

  it('returns offline hints when isOnline=false', () => {
    const hints = getQualityHints({ isOnline: false, type: 'none', effectiveType: 'unknown', downlink: null, rtt: null, saveData: false });
    assert.equal(hints.renderDpi, 72);
    assert.equal(hints.thumbnailSize, 'small');
    assert.equal(hints.prefetchPages, 0);
    assert.equal(hints.enableAnimations, false);
  });

  it('returns low-quality hints when saveData=true', () => {
    const hints = getQualityHints({ isOnline: true, type: 'wifi', effectiveType: '4g', downlink: 10, rtt: 20, saveData: true });
    assert.equal(hints.renderDpi, 72);
    assert.equal(hints.thumbnailSize, 'small');
    assert.equal(hints.prefetchPages, 1);
    assert.equal(hints.enableAnimations, false);
  });

  it('uses current status when no argument is passed', () => {
    // Without connection API, defaults to unknown — large hints
    const hints = getQualityHints();
    assert.ok(typeof hints.renderDpi === 'number');
    assert.ok(['small', 'medium', 'large'].includes(hints.thumbnailSize));
    assert.ok(typeof hints.prefetchPages === 'number');
    assert.ok(typeof hints.enableAnimations === 'boolean');
  });
});

// ─── onNetworkChange ──────────────────────────────────────────────────────────

describe('onNetworkChange', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onNetworkChange(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('handler fires on window "online" event', () => {
    const received = [];
    const unsub = onNetworkChange(status => received.push(status));

    globalThis.navigator.onLine = true;
    globalThis.window.dispatchEvent(new Event('online'));

    assert.equal(received.length, 1);
    assert.equal(typeof received[0].isOnline, 'boolean');
    unsub();
  });

  it('handler fires on window "offline" event', () => {
    const received = [];
    const unsub = onNetworkChange(status => received.push(status));

    globalThis.navigator.onLine = false;
    globalThis.window.dispatchEvent(new Event('offline'));

    assert.equal(received.length, 1);
    assert.equal(received[0].isOnline, false);
    unsub();
  });

  it('handler fires on navigator.connection "change" event', () => {
    const fake = installFakeConnection({ effectiveType: '4g' });
    const received = [];
    const unsub = onNetworkChange(status => received.push(status));

    fake.effectiveType = '2g';
    fake.dispatchChange();

    assert.equal(received.length, 1);
    assert.equal(received[0].effectiveType, '2g');
    unsub();
  });

  it('unsubscribe prevents further handler calls from online event', () => {
    const received = [];
    const unsub = onNetworkChange(status => received.push(status));

    globalThis.window.dispatchEvent(new Event('online'));
    assert.equal(received.length, 1);

    unsub();
    globalThis.window.dispatchEvent(new Event('online'));
    assert.equal(received.length, 1, 'handler should not fire after unsubscribe');
  });

  it('unsubscribe prevents further handler calls from connection change event', () => {
    const fake = installFakeConnection({ effectiveType: '4g' });
    const received = [];
    const unsub = onNetworkChange(status => received.push(status));

    fake.dispatchChange();
    assert.equal(received.length, 1);

    unsub();
    fake.dispatchChange();
    assert.equal(received.length, 1, 'handler should not fire after unsubscribe');
  });

  it('status passed to handler contains all required fields', () => {
    installFakeConnection({ effectiveType: '3g', downlink: 2.0, rtt: 250, saveData: false });
    let captured = null;
    const unsub = onNetworkChange(status => { captured = status; });

    globalThis.window.dispatchEvent(new Event('online'));

    assert.ok(captured !== null);
    assert.ok('isOnline' in captured);
    assert.ok('type' in captured);
    assert.ok('effectiveType' in captured);
    assert.ok('downlink' in captured);
    assert.ok('rtt' in captured);
    assert.ok('saveData' in captured);
    unsub();
  });
});
