// ─── Unit Tests: djvu-page-cache.js ──────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Stub ImageData for Node.js (no DOM)
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}

import { DjVuPageCache } from '../../app/modules/djvu-page-cache.js';

/** Helper: create a fake ImageData of given pixel dimensions */
function makeImg(w, h) {
  return new globalThis.ImageData(w, h);
}

/** Helper: compute expected byte size for a w×h image */
function imgBytes(w, h) { return w * h * 4; }

// ─── Constructor / properties ────────────────────────────────────────────────

describe('DjVuPageCache constructor', () => {
  it('defaults to 200 MB limit', () => {
    const c = new DjVuPageCache();
    assert.equal(c.maxBytes, 200 * 1024 * 1024);
  });

  it('respects custom maxMb', () => {
    const c = new DjVuPageCache(50);
    assert.equal(c.maxBytes, 50 * 1024 * 1024);
  });

  it('starts empty', () => {
    const c = new DjVuPageCache();
    assert.equal(c.size, 0);
    assert.equal(c.usedBytes, 0);
  });
});

// ─── get() / put() ───────────────────────────────────────────────────────────

describe('get/put basics', () => {
  it('returns null for a missing entry', () => {
    const c = new DjVuPageCache();
    assert.equal(c.get(1, false), null);
  });

  it('stores and retrieves an entry', () => {
    const c = new DjVuPageCache();
    const img = makeImg(10, 10);
    c.put(1, false, img);
    assert.strictEqual(c.get(1, false), img);
  });

  it('treats lowRes=true and lowRes=false as distinct keys', () => {
    const c = new DjVuPageCache();
    const hi = makeImg(100, 100);
    const lo = makeImg(10, 10);
    c.put(1, false, hi);
    c.put(1, true, lo);
    assert.strictEqual(c.get(1, false), hi);
    assert.strictEqual(c.get(1, true), lo);
  });

  it('size and usedBytes reflect stored entries', () => {
    const c = new DjVuPageCache();
    c.put(1, false, makeImg(10, 10));
    c.put(2, false, makeImg(5, 5));
    assert.equal(c.size, 2);
    assert.equal(c.usedBytes, imgBytes(10, 10) + imgBytes(5, 5));
  });

  it('overwrites an existing entry (same key)', () => {
    const c = new DjVuPageCache();
    const img1 = makeImg(10, 10);
    const img2 = makeImg(10, 10);
    c.put(1, false, img1);
    c.put(1, false, img2);
    assert.strictEqual(c.get(1, false), img2);
    assert.equal(c.size, 1);
    assert.equal(c.usedBytes, imgBytes(10, 10));
  });
});

// ─── LRU eviction ────────────────────────────────────────────────────────────

describe('LRU eviction', () => {
  it('evicts the least-recently-used entry when limit is exceeded', () => {
    // 3 entries of 1×1×4=4 bytes each; limit = 8 bytes (fits 2)
    const c = new DjVuPageCache(8 / 1024 / 1024); // 8 bytes limit
    const a = makeImg(1, 1); // 4 bytes
    const b = makeImg(1, 1);
    const d = makeImg(1, 1);
    c.put(1, false, a);
    c.put(2, false, b);
    // Now full (8 bytes). Adding a third should evict page 1 (LRU).
    c.put(3, false, d);
    assert.equal(c.get(1, false), null, 'page 1 should be evicted');
    assert.strictEqual(c.get(2, false), b);
    assert.strictEqual(c.get(3, false), d);
    assert.equal(c.size, 2);
  });

  it('get() refreshes entry to MRU position', () => {
    const c = new DjVuPageCache(8 / 1024 / 1024); // 8 bytes
    const a = makeImg(1, 1);
    const b = makeImg(1, 1);
    const d = makeImg(1, 1);
    c.put(1, false, a);
    c.put(2, false, b);
    // Access page 1 → it becomes MRU; page 2 becomes LRU
    c.get(1, false);
    // Adding third entry must evict page 2 (LRU), not page 1
    c.put(3, false, d);
    assert.strictEqual(c.get(1, false), a, 'page 1 should survive (was MRU)');
    assert.equal(c.get(2, false), null, 'page 2 should be evicted (LRU)');
  });

  it('skips caching a single entry that exceeds the entire limit', () => {
    const c = new DjVuPageCache(1 / 1024 / 1024); // 1 byte limit
    const big = makeImg(100, 100); // 40 000 bytes
    c.put(1, false, big);
    assert.equal(c.size, 0, 'oversized entry must not be cached');
    assert.equal(c.usedBytes, 0);
  });

  it('evicts multiple LRU entries to make room', () => {
    // 4-byte limit, three 4-byte entries — each put should evict everything first
    const c = new DjVuPageCache(4 / 1024 / 1024);
    const a = makeImg(1, 1);
    const b = makeImg(1, 1);
    c.put(1, false, a);
    c.put(2, false, b); // evicts page 1
    assert.equal(c.size, 1);
    assert.equal(c.get(1, false), null);
    assert.strictEqual(c.get(2, false), b);
  });
});

// ─── clear() ─────────────────────────────────────────────────────────────────

describe('clear()', () => {
  it('removes all entries and resets usedBytes', () => {
    const c = new DjVuPageCache();
    c.put(1, false, makeImg(50, 50));
    c.put(2, true,  makeImg(10, 10));
    c.clear();
    assert.equal(c.size, 0);
    assert.equal(c.usedBytes, 0);
  });

  it('returns null for entries after clear()', () => {
    const c = new DjVuPageCache();
    c.put(1, false, makeImg(10, 10));
    c.clear();
    assert.equal(c.get(1, false), null);
  });

  it('allows new entries after clear()', () => {
    const c = new DjVuPageCache();
    c.put(1, false, makeImg(10, 10));
    c.clear();
    const img = makeImg(5, 5);
    c.put(1, false, img);
    assert.strictEqual(c.get(1, false), img);
  });
});
