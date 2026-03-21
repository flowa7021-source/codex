// ─── Unit Tests: Memory Manager ─────────────────────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock browser globals needed by memory-manager
globalThis.window = globalThis.window || { addEventListener: () => {}, dispatchEvent: () => {} };
globalThis.performance = globalThis.performance || { now: Date.now };

// Mock URL.createObjectURL / revokeObjectURL
const revokedUrls = [];
let urlCounter = 0;
globalThis.URL = globalThis.URL || {};
globalThis.URL.createObjectURL = (source) => {
  urlCounter++;
  return `blob:mock-url-${urlCounter}`;
};
globalThis.URL.revokeObjectURL = (url) => {
  revokedUrls.push(url);
};

// Mock document.createElement for canvas pooling
globalThis.document = globalThis.document || {
  getElementById: () => null,
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          clearRect: () => {},
        }),
      };
    }
    return {};
  },
};

import {
  createTrackedUrl,
  revokeTrackedUrl,
  revokeAllUrls,
  cleanupStaleUrls,
  acquireCanvas,
  releaseCanvas,
  getMemoryStats,
  destroyMemoryManager,
  forceCleanup,
} from '../../app/modules/memory-manager.js';

beforeEach(() => {
  // Clean slate
  forceCleanup();
  revokedUrls.length = 0;
});

afterEach(() => {
  destroyMemoryManager();
});

describe('createTrackedUrl / revokeTrackedUrl', () => {
  it('creates a tracked URL', () => {
    const url = createTrackedUrl(new Uint8Array(0), 'test');
    assert.ok(url.startsWith('blob:'));
    assert.equal(getMemoryStats().trackedUrls, 1);
  });

  it('revokes a tracked URL', () => {
    const url = createTrackedUrl(new Uint8Array(0), 'test');
    revokeTrackedUrl(url);
    assert.equal(getMemoryStats().trackedUrls, 0);
    assert.ok(revokedUrls.includes(url));
  });

  it('revoking unknown URL is a no-op', () => {
    const before = revokedUrls.length;
    revokeTrackedUrl('blob:not-tracked');
    assert.equal(revokedUrls.length, before);
  });
});

describe('revokeAllUrls', () => {
  it('revokes all tracked URLs', () => {
    createTrackedUrl(new Uint8Array(0), 'a');
    createTrackedUrl(new Uint8Array(0), 'b');
    createTrackedUrl(new Uint8Array(0), 'c');
    assert.equal(getMemoryStats().trackedUrls, 3);
    revokeAllUrls();
    assert.equal(getMemoryStats().trackedUrls, 0);
  });
});

describe('acquireCanvas / releaseCanvas', () => {
  it('acquireCanvas returns a canvas-like object with correct dimensions', () => {
    const c = acquireCanvas(800, 600);
    assert.equal(c.width, 800);
    assert.equal(c.height, 600);
  });

  it('releaseCanvas returns canvas to pool', () => {
    const c = acquireCanvas(100, 100);
    releaseCanvas(c);
    assert.equal(getMemoryStats().canvasPoolSize, 1);
  });

  it('releaseCanvas with null is a no-op', () => {
    releaseCanvas(null);
    // should not throw
    assert.ok(true);
  });
});

describe('getMemoryStats', () => {
  it('returns stats object with expected fields', () => {
    const stats = getMemoryStats();
    assert.equal(typeof stats.trackedUrls, 'number');
    assert.equal(typeof stats.canvasPoolSize, 'number');
    assert.ok(Array.isArray(stats.urlDetails));
  });

  it('urlDetails includes context for tracked URLs', () => {
    createTrackedUrl(new Uint8Array(0), 'my-context');
    const stats = getMemoryStats();
    assert.equal(stats.urlDetails.length, 1);
    assert.equal(stats.urlDetails[0].context, 'my-context');
  });
});

describe('destroyMemoryManager', () => {
  it('cleans up all tracked URLs and canvas pool', () => {
    createTrackedUrl(new Uint8Array(0), 'x');
    const c = acquireCanvas(10, 10);
    releaseCanvas(c);
    destroyMemoryManager();
    assert.equal(getMemoryStats().trackedUrls, 0);
    assert.equal(getMemoryStats().canvasPoolSize, 0);
  });
});

describe('forceCleanup', () => {
  it('revokes URLs and empties canvas pool', () => {
    createTrackedUrl(new Uint8Array(0), 'fc');
    const c = acquireCanvas(10, 10);
    releaseCanvas(c);
    forceCleanup();
    assert.equal(getMemoryStats().trackedUrls, 0);
    assert.equal(getMemoryStats().canvasPoolSize, 0);
  });
});
