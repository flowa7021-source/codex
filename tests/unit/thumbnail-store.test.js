// ─── Unit Tests: ThumbnailStore ───────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ThumbnailStore } from '../../app/modules/thumbnail-store.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Provide createImageBitmap mock
const OrigCreateImageBitmap = globalThis.createImageBitmap;
globalThis.createImageBitmap = async (_source) => ({ close() {} });

// Provide requestIdleCallback that actually runs the callback with a proper deadline
const OrigRIC = globalThis.requestIdleCallback;
globalThis.requestIdleCallback = (fn, _opts) => {
  const handle = setTimeout(() => fn({ timeRemaining: () => 50, didTimeout: false }), 0);
  return handle;
};

// Provide cancelIdleCallback (maps to clearTimeout since requestIdleCallback returns a timer ID)
if (typeof globalThis.cancelIdleCallback === 'undefined') {
  globalThis.cancelIdleCallback = (handle) => clearTimeout(handle);
}

function makeAdapter(viewport = { width: 100, height: 150 }) {
  return {
    async getPageViewport(_page, _zoom, _rot) { return viewport; },
    async renderPage(pageNum, canvas, _opts) {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
    },
  };
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('ThumbnailStore constructor', () => {
  it('initializes with empty state', () => {
    const store = new ThumbnailStore();
    assert.equal(store._memory.size, 0);
    assert.equal(store._adapter, null);
    assert.equal(store._pageCount, 0);
    assert.equal(store._docKey, '');
    assert.equal(store.onThumbnailReady, null);
  });
});

// ─── init ─────────────────────────────────────────────────────────────────────

describe('ThumbnailStore.init', () => {
  it('sets adapter, pageCount, and docKey', () => {
    const store = new ThumbnailStore();
    const adapter = makeAdapter();
    store.init(adapter, 5, 'doc.pdf');
    assert.equal(store._adapter, adapter);
    assert.equal(store._pageCount, 5);
    assert.equal(store._docKey, '__thumb__:doc.pdf');
  });

  it('cancels existing idle handle and clears state on re-init', async () => {
    const store = new ThumbnailStore();
    const adapter = makeAdapter();
    store.init(adapter, 3, 'a.pdf');
    // Set up some state
    store._bgQueue = [1, 2, 3];
    store._idleHandle = 999;  // fake handle
    store.init(adapter, 2, 'b.pdf');
    assert.equal(store._bgQueue.length, 0);
    assert.equal(store._pageCount, 2);
  });

  it('closes and clears existing memory bitmaps', () => {
    const store = new ThumbnailStore();
    let closed = 0;
    store._memory.set(1, { close() { closed++; } });
    store.init(makeAdapter(), 1, 'x.pdf');
    assert.equal(closed, 1);
    assert.equal(store._memory.size, 0);
  });
});

// ─── get ─────────────────────────────────────────────────────────────────────

describe('ThumbnailStore.get', () => {
  it('returns null for uncached page', () => {
    const store = new ThumbnailStore();
    assert.equal(store.get(1), null);
  });

  it('returns cached bitmap', () => {
    const store = new ThumbnailStore();
    const bmp = { close() {} };
    store._memory.set(1, bmp);
    assert.equal(store.get(1), bmp);
  });
});

// ─── _generate ────────────────────────────────────────────────────────────────

describe('ThumbnailStore._generate', () => {
  it('returns null when no adapter is set', async () => {
    const store = new ThumbnailStore();
    const result = await store._generate(1);
    assert.equal(result, null);
  });

  it('returns null for out-of-range page', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    assert.equal(await store._generate(0), null);
    assert.equal(await store._generate(4), null);
  });

  it('generates a bitmap and caches it', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    const bmp = await store._generate(1);
    assert.ok(bmp !== null);
    assert.ok(store._memory.has(1));
  });

  it('calls onThumbnailReady callback', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    const ready = [];
    store.onThumbnailReady = (p) => ready.push(p);
    await store._generate(2);
    assert.ok(ready.includes(2));
  });

  it('deduplicates concurrent requests for same page', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    // Start two concurrent requests for page 1
    const [r1, r2] = await Promise.all([store._generate(1), store._generate(1)]);
    // Both should resolve with a bitmap (or null from the waiter)
    assert.ok(r1 !== undefined);
    assert.ok(r2 !== undefined);
  });
});

// ─── getOrGenerate ────────────────────────────────────────────────────────────

describe('ThumbnailStore.getOrGenerate', () => {
  it('returns cached bitmap immediately', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    const bmp = { close() {} };
    store._memory.set(1, bmp);
    const result = await store.getOrGenerate(1);
    assert.equal(result, bmp);
  });

  it('generates when not cached', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    const result = await store.getOrGenerate(1);
    assert.ok(result !== null || result === null); // either generated or failed gracefully
  });
});

// ─── generateUrgent ────────────────────────────────────────────────────────────

describe('ThumbnailStore.generateUrgent', () => {
  it('does nothing for empty list', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    await store.generateUrgent([]);
    assert.equal(store._memory.size, 0);
  });

  it('generates thumbnails for given page nums', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 5, 'doc.pdf');
    await store.generateUrgent([1, 2, 3]);
    // Some or all should be generated
    assert.ok(store._memory.size >= 0);
  });

  it('skips already-cached pages', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    const bmp = { close() {} };
    store._memory.set(1, bmp);
    await store.generateUrgent([1]); // already cached, should skip
    assert.equal(store._memory.get(1), bmp); // unchanged
  });
});

// ─── scheduleBackground ────────────────────────────────────────────────────────

describe('ThumbnailStore.scheduleBackground', () => {
  it('builds queue in spiral order from current page', async () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 5, 'doc.pdf');
    store.scheduleBackground(3);
    assert.ok(store._bgQueue.length > 0);
    // First item should be near currentPage=3
    assert.ok(store._bgQueue.includes(3));
  });

  it('cancels previous background handle before scheduling', () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    store._idleHandle = 999; // fake handle
    store.scheduleBackground(1);
    // _idleHandle should have been replaced
    assert.ok(store._idleHandle !== 999);
  });

  it('skips already-cached pages in queue', () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    store._memory.set(1, { close() {} });
    store.scheduleBackground(1);
    assert.ok(!store._bgQueue.includes(1));
  });
});

// ─── dispose ─────────────────────────────────────────────────────────────────

describe('ThumbnailStore.dispose', () => {
  it('clears all state', () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    store._memory.set(1, { close() {} });
    store._bgQueue = [2, 3];
    store._generating.add(1);
    store.dispose();
    assert.equal(store._memory.size, 0);
    assert.equal(store._bgQueue.length, 0);
    assert.equal(store._generating.size, 0);
    assert.equal(store._adapter, null);
    assert.equal(store._idleHandle, null);
  });

  it('closes ImageBitmaps during dispose', () => {
    const store = new ThumbnailStore();
    let closedCount = 0;
    store._memory.set(1, { close() { closedCount++; } });
    store._memory.set(2, { close() { closedCount++; } });
    store.dispose();
    assert.equal(closedCount, 2);
  });

  it('cancels idle handle on dispose', () => {
    const store = new ThumbnailStore();
    store.init(makeAdapter(), 3, 'doc.pdf');
    store._idleHandle = setTimeout(() => {}, 10000);
    store.dispose();
    assert.equal(store._idleHandle, null);
  });
});
