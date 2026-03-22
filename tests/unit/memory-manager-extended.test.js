import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTrackedUrl, revokeTrackedUrl, revokeAllUrls, cleanupStaleUrls, acquireCanvas, releaseCanvas, getMemoryStats, forceCleanup, destroyMemoryManager, initMemoryManager } from '../../app/modules/memory-manager.js';

beforeEach(() => { forceCleanup(); });

describe('cleanupStaleUrls', () => {
  it('keeps young URLs', () => { createTrackedUrl(new Blob(['t']), 'ctx'); cleanupStaleUrls(300000); assert.equal(getMemoryStats().trackedUrls, 1); });
  it('removes old URLs', async () => { createTrackedUrl(new Blob(['t']), 'old'); await new Promise(r => setTimeout(r, 5)); cleanupStaleUrls(1); assert.equal(getMemoryStats().trackedUrls, 0); });
  it('handles empty registry', () => { assert.doesNotThrow(() => cleanupStaleUrls(0)); });
});

describe('getMemoryStats', () => {
  it('returns expected properties', () => { const s = getMemoryStats(); assert.equal(typeof s.trackedUrls, 'number'); assert.ok(Array.isArray(s.urlDetails)); });
  it('includes url details', () => { createTrackedUrl(new Blob(['t']), 'my-ctx'); const s = getMemoryStats(); assert.equal(s.urlDetails[0].context, 'my-ctx'); });
});

describe('forceCleanup', () => {
  it('clears all tracked URLs', () => { createTrackedUrl(new Blob(['a']), 'a'); createTrackedUrl(new Blob(['b']), 'b'); forceCleanup(); assert.equal(getMemoryStats().trackedUrls, 0); });
  it('clears canvas pool', () => { const c = acquireCanvas(100, 100); releaseCanvas(c); assert.ok(getMemoryStats().canvasPoolSize > 0); forceCleanup(); assert.equal(getMemoryStats().canvasPoolSize, 0); });
});

describe('destroyMemoryManager', () => {
  it('clears all resources', () => { createTrackedUrl(new Blob(['x']), 'x'); destroyMemoryManager(); assert.equal(getMemoryStats().trackedUrls, 0); });
  it('safe to call twice', () => { assert.doesNotThrow(() => { destroyMemoryManager(); destroyMemoryManager(); }); });
});

describe('initMemoryManager', () => {
  it('does not throw', () => { assert.doesNotThrow(() => initMemoryManager()); destroyMemoryManager(); });
});

describe('canvas pool limits', () => {
  it('does not exceed max', () => { const cs = []; for (let i = 0; i < 15; i++) cs.push(acquireCanvas(10, 10)); for (const c of cs) releaseCanvas(c); assert.ok(getMemoryStats().canvasPoolSize <= 10); });
});

describe('revokeTrackedUrl', () => {
  it('removes tracked URL', () => { const url = createTrackedUrl(new Blob(['t']), 'c'); revokeTrackedUrl(url); assert.equal(getMemoryStats().trackedUrls, 0); });
  it('ignores untracked', () => { assert.doesNotThrow(() => revokeTrackedUrl('blob:unknown')); });
});

describe('revokeAllUrls', () => {
  it('clears all', () => { createTrackedUrl(new Blob(['a']), 'a'); createTrackedUrl(new Blob(['b']), 'b'); revokeAllUrls(); assert.equal(getMemoryStats().trackedUrls, 0); });
});

describe('releaseCanvas null', () => {
  it('handles null', () => { assert.doesNotThrow(() => releaseCanvas(null)); });
});
