// ─── Unit Tests: environment-utils ────────────────────────────────────────────
// These tests run in Node.js, so browser-specific functions return false/null.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isBrowser,
  isNode,
  isWebWorker,
  isServiceWorker,
  getPlatform,
  isTouchDevice,
  prefersDarkMode,
  isMobile,
  getMemoryInfo,
  supports,
} from '../../app/modules/environment-utils.js';

// ─── isNode ───────────────────────────────────────────────────────────────────

describe('isNode', () => {
  it('returns true when running in Node.js', () => {
    assert.equal(isNode(), true);
  });
});

// ─── isBrowser ────────────────────────────────────────────────────────────────

describe('isBrowser', () => {
  it('returns false when running in Node.js (no window/document)', () => {
    assert.equal(isBrowser(), false);
  });
});

// ─── isWebWorker ──────────────────────────────────────────────────────────────

describe('isWebWorker', () => {
  it('returns false in Node.js (no WorkerGlobalScope)', () => {
    assert.equal(isWebWorker(), false);
  });
});

// ─── isServiceWorker ──────────────────────────────────────────────────────────

describe('isServiceWorker', () => {
  it('returns false in Node.js (no ServiceWorkerGlobalScope)', () => {
    assert.equal(isServiceWorker(), false);
  });
});

// ─── getPlatform ──────────────────────────────────────────────────────────────

describe('getPlatform', () => {
  it('returns "node" when running in Node.js', () => {
    assert.equal(getPlatform(), 'node');
  });

  it('returns a known platform string', () => {
    const valid = ['browser', 'node', 'webworker', 'serviceworker', 'unknown'];
    assert.ok(valid.includes(getPlatform()));
  });
});

// ─── isTouchDevice ────────────────────────────────────────────────────────────

describe('isTouchDevice', () => {
  it('returns false in Node.js (no navigator)', () => {
    assert.equal(isTouchDevice(), false);
  });
});

// ─── prefersDarkMode ──────────────────────────────────────────────────────────

describe('prefersDarkMode', () => {
  it('returns false in Node.js (no window.matchMedia)', () => {
    assert.equal(prefersDarkMode(), false);
  });
});

// ─── isMobile ─────────────────────────────────────────────────────────────────

describe('isMobile', () => {
  it('returns false in Node.js (no navigator.userAgent)', () => {
    assert.equal(isMobile(), false);
  });
});

// ─── getMemoryInfo ────────────────────────────────────────────────────────────

describe('getMemoryInfo', () => {
  it('returns null or an object with the expected shape', () => {
    const info = getMemoryInfo();
    if (info === null) {
      // Node.js / environments without performance.memory
      assert.equal(info, null);
    } else {
      assert.ok(typeof info.usedJSHeapSize === 'number');
      assert.ok(typeof info.totalJSHeapSize === 'number');
      assert.ok(typeof info.jsHeapSizeLimit === 'number');
    }
  });

  it('does not throw', () => {
    assert.doesNotThrow(() => getMemoryInfo());
  });
});

// ─── supports ─────────────────────────────────────────────────────────────────

describe('supports', () => {
  it('returns true for "process" (available in Node.js via globalThis)', () => {
    assert.equal(supports('process'), true);
  });

  it('returns true for "Buffer" (available in Node.js)', () => {
    assert.equal(supports('Buffer'), true);
  });

  it('returns false for a clearly non-existent API', () => {
    assert.equal(supports('__nonExistentAPI__xyzzy__'), false);
  });

  it('does not throw for any string input', () => {
    assert.doesNotThrow(() => supports('window'));
    assert.doesNotThrow(() => supports(''));
    assert.doesNotThrow(() => supports('fetch'));
  });

  it('returns true for "setTimeout" (available in Node.js)', () => {
    assert.equal(supports('setTimeout'), true);
  });
});
