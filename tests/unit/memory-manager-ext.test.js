// ─── Extended Unit Tests: Memory Manager Module ─────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTrackedUrl,
  revokeTrackedUrl,
  revokeAllUrls,
  cleanupStaleUrls,
  acquireCanvas,
  releaseCanvas,
  getMemoryStats,
  forceCleanup,
  initMemoryManager,
  destroyMemoryManager,
} from '../../app/modules/memory-manager.js';

describe('createTrackedUrl', () => {
  afterEach(() => revokeAllUrls());

  it('creates a tracked URL', () => {
    const url = createTrackedUrl(new Blob(['test']), 'test');
    assert.ok(typeof url === 'string');
  });

  it('shows up in memory stats', () => {
    createTrackedUrl(new Blob(['hello']), 'stat-test');
    const stats = getMemoryStats();
    assert.ok(stats.trackedUrls >= 1);
  });
});

describe('revokeTrackedUrl', () => {
  afterEach(() => revokeAllUrls());

  it('revokes a tracked URL', () => {
    const url = createTrackedUrl(new Blob(['test']), 'revoke');
    revokeTrackedUrl(url);
    const stats = getMemoryStats();
    assert.ok(!stats.urlDetails.some(d => d.context === 'revoke'));
  });

  it('is safe for untracked URL', () => {
    assert.doesNotThrow(() => revokeTrackedUrl('blob:nonexistent'));
  });
});

describe('revokeAllUrls', () => {
  it('clears all tracked URLs', () => {
    createTrackedUrl(new Blob(['a']), 'a');
    createTrackedUrl(new Blob(['b']), 'b');
    revokeAllUrls();
    const stats = getMemoryStats();
    assert.equal(stats.trackedUrls, 0);
  });
});

describe('cleanupStaleUrls', () => {
  afterEach(() => revokeAllUrls());

  it('removes URLs older than maxAgeMs', async () => {
    createTrackedUrl(new Blob(['old']), 'old');
    await new Promise(r => setTimeout(r, 15));
    cleanupStaleUrls(5);
    const stats = getMemoryStats();
    assert.equal(stats.trackedUrls, 0);
  });

  it('keeps URLs newer than maxAgeMs', () => {
    createTrackedUrl(new Blob(['new']), 'new');
    cleanupStaleUrls(999999999);
    const stats = getMemoryStats();
    assert.ok(stats.trackedUrls >= 1);
  });
});

describe('acquireCanvas / releaseCanvas', () => {
  it('acquireCanvas creates a canvas with specified dimensions', () => {
    const canvas = acquireCanvas(200, 300);
    assert.ok(canvas);
    assert.equal(canvas.width, 200);
    assert.equal(canvas.height, 300);
  });

  it('releaseCanvas resets canvas dimensions', () => {
    const canvas = acquireCanvas(200, 300);
    releaseCanvas(canvas);
    assert.equal(canvas.width, 1);
    assert.equal(canvas.height, 1);
  });

  it('releaseCanvas ignores null', () => {
    assert.doesNotThrow(() => releaseCanvas(null));
  });
});

describe('getMemoryStats', () => {
  afterEach(() => revokeAllUrls());

  it('returns expected shape', () => {
    const stats = getMemoryStats();
    assert.ok(typeof stats.trackedUrls === 'number');
    assert.ok(typeof stats.canvasPoolSize === 'number');
    assert.ok(Array.isArray(stats.urlDetails));
  });
});

describe('forceCleanup', () => {
  it('clears all URLs and canvas pool', () => {
    createTrackedUrl(new Blob(['test']), 'cleanup');
    forceCleanup();
    const stats = getMemoryStats();
    assert.equal(stats.trackedUrls, 0);
    assert.equal(stats.canvasPoolSize, 0);
  });
});

describe('initMemoryManager / destroyMemoryManager', () => {
  it('init and destroy do not throw', () => {
    assert.doesNotThrow(() => initMemoryManager());
    assert.doesNotThrow(() => destroyMemoryManager());
  });

  it('destroyMemoryManager clears state', () => {
    initMemoryManager();
    createTrackedUrl(new Blob(['x']), 'destroy');
    destroyMemoryManager();
    assert.equal(getMemoryStats().trackedUrls, 0);
  });
});
