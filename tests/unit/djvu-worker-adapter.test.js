// ─── Unit Tests: djvu-worker-adapter.js ──────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Provide navigator.hardwareConcurrency for perf-utils
if (typeof navigator === 'undefined') {
  globalThis.navigator = { hardwareConcurrency: 4 };
}

import { DjVuWorkerAdapter } from '../../app/modules/djvu-worker-adapter.js';

// ─── Mock DjVu library ────────────────────────────────────────────────────────

function makeMockPage(opts = {}) {
  return {
    getImageData: () => ({
      run: () => Promise.resolve(opts.imageData ?? makeImgData(100, 120)),
    }),
    getText: () => ({
      run: () => Promise.resolve(opts.text ?? 'hello world'),
    }),
    getPageTextZone: () => ({
      run: () => Promise.resolve(opts.zone ?? { words: [] }),
    }),
  };
}

function makeImgData(w, h) {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}

function makeMockDoc(opts = {}) {
  const pageCount = opts.pageCount ?? 3;
  return {
    getPagesQuantity: () => ({ run: () => Promise.resolve(pageCount) }),
    getPage: (page0) => makeMockPage(opts.pages?.[page0] ?? {}),
    getContents: () => ({ run: () => Promise.resolve(opts.outline ?? []) }),
  };
}

function makeMockDjVu(opts = {}) {
  const doc = makeMockDoc(opts);
  return {
    Worker: class {
      constructor() { this.doc = doc; this._terminated = false; }
      createDocument(_buf) { return Promise.resolve(); }
      terminate() { this._terminated = true; }
    },
  };
}

// ─── open() factory ───────────────────────────────────────────────────────────

describe('DjVuWorkerAdapter.open()', () => {
  it('returns a DjVuWorkerAdapter instance', async () => {
    const djvu = makeMockDjVu({ pageCount: 5 });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    assert.ok(adapter instanceof DjVuWorkerAdapter);
  });

  it('sets type and mode correctly', async () => {
    const djvu = makeMockDjVu({ pageCount: 2 });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    assert.equal(adapter.type, 'djvu');
    assert.equal(adapter.mode, 'native-worker');
  });

  it('sets fileName', async () => {
    const djvu = makeMockDjVu({ pageCount: 1 });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'my-doc.djvu');
    assert.equal(adapter.fileName, 'my-doc.djvu');
  });

  it('sets page count from document', async () => {
    const djvu = makeMockDjVu({ pageCount: 7 });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    assert.equal(adapter.getPageCount(), 7);
  });

  it('throws when document has no pages', async () => {
    const djvu = makeMockDjVu({ pageCount: 0 });
    await assert.rejects(
      () => DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'empty.djvu'),
      /no pages/,
    );
  });

  it('propagates worker creation errors', async () => {
    const failDjvu = {
      Worker: class {
        get doc() { return null; }
        createDocument() { return Promise.reject(new Error('worker failed')); }
        terminate() {}
      },
    };
    await assert.rejects(
      () => DjVuWorkerAdapter.open(failDjvu, new ArrayBuffer(8), 'fail.djvu'),
    );
  });
});

// ─── getPageCount() ──────────────────────────────────────────────────────────

describe('getPageCount()', () => {
  it('returns the correct page count', async () => {
    const djvu = makeMockDjVu({ pageCount: 12 });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    assert.equal(adapter.getPageCount(), 12);
  });
});

// ─── resolveDestToPage() ─────────────────────────────────────────────────────

describe('resolveDestToPage()', () => {
  /** @type {DjVuWorkerAdapter} */
  let adapter;
  beforeEach(async () => {
    const djvu = makeMockDjVu({ pageCount: 10 });
    adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
  });

  it('returns a valid 1-based page number', async () => {
    assert.equal(await adapter.resolveDestToPage(5), 5);
  });

  it('returns null for 0', async () => {
    assert.equal(await adapter.resolveDestToPage(0), null);
  });

  it('returns null for negative numbers', async () => {
    assert.equal(await adapter.resolveDestToPage(-1), null);
  });

  it('returns null for page > pageCount', async () => {
    assert.equal(await adapter.resolveDestToPage(11), null);
  });

  it('returns null for non-integer strings', async () => {
    assert.equal(await adapter.resolveDestToPage('abc'), null);
  });

  it('accepts string representations of valid integers', async () => {
    assert.equal(await adapter.resolveDestToPage('3'), 3);
  });
});

// ─── getText() ───────────────────────────────────────────────────────────────

describe('getText()', () => {
  it('returns text from page', async () => {
    const djvu = makeMockDjVu({ pages: [null, { text: 'page one' }, null] });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    const text = await adapter.getText(2); // 1-based → page0=1 → pages[1]
    assert.equal(text, 'page one');
  });

  it('returns empty string on error', async () => {
    const djvu = makeMockDjVu();
    // Patch the worker to throw
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    adapter._worker.doc.getPage = () => { throw new Error('bad page'); };
    const text = await adapter.getText(1);
    assert.equal(text, '');
  });

  it('returns empty string when result is not a string', async () => {
    const djvu = {
      Worker: class {
        get doc() {
          return {
            getPagesQuantity: () => ({ run: () => Promise.resolve(1) }),
            getPage: () => ({
              getText: () => ({ run: () => Promise.resolve(null) }),
            }),
          };
        }
        createDocument() { return Promise.resolve(); }
        terminate() {}
      },
    };
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    assert.equal(await adapter.getText(1), '');
  });
});

// ─── getTextZones() ──────────────────────────────────────────────────────────

describe('getTextZones()', () => {
  it('returns zone data', async () => {
    const zone = { words: [{ text: 'hello' }] };
    const djvu = makeMockDjVu({ pages: [{ zone }] });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    const result = await adapter.getTextZones(1);
    assert.deepEqual(result, zone);
  });

  it('returns null on error', async () => {
    const djvu = makeMockDjVu();
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    adapter._worker.doc.getPage = () => { throw new Error('crash'); };
    assert.equal(await adapter.getTextZones(1), null);
  });
});

// ─── getOutline() ────────────────────────────────────────────────────────────

describe('getOutline()', () => {
  it('returns empty array when no outline', async () => {
    const djvu = makeMockDjVu({ outline: [] });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    assert.deepEqual(await adapter.getOutline(), []);
  });

  it('maps outline items correctly', async () => {
    const djvu = makeMockDjVu({
      outline: [
        { description: 'Chapter 1', url: 1, children: [] },
        { description: 'Chapter 2', url: 3, children: [
          { description: 'Section 2.1', url: 4, children: [] },
        ]},
      ],
    });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    const outline = await adapter.getOutline();
    assert.equal(outline.length, 2);
    assert.equal(outline[0].title, 'Chapter 1');
    assert.equal(outline[0].dest, 1);
    assert.equal(outline[1].title, 'Chapter 2');
    assert.equal(outline[1].items.length, 1);
    assert.equal(outline[1].items[0].title, 'Section 2.1');
  });

  it('uses fallback title for items with no description', async () => {
    const djvu = makeMockDjVu({ outline: [{ url: 2, children: [] }] });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    const outline = await adapter.getOutline();
    assert.ok(outline[0].title.length > 0); // fallback string, not empty
  });

  it('returns null dest for non-integer url', async () => {
    const djvu = makeMockDjVu({ outline: [{ description: 'Link', url: 'http://example.com', children: [] }] });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    const outline = await adapter.getOutline();
    assert.equal(outline[0].dest, null);
  });

  it('returns empty array on error', async () => {
    const djvu = makeMockDjVu();
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    adapter._worker.doc.getContents = () => { throw new Error('crash'); };
    assert.deepEqual(await adapter.getOutline(), []);
  });
});

// ─── destroy() ───────────────────────────────────────────────────────────────

describe('destroy()', () => {
  it('terminates the worker', async () => {
    const djvu = makeMockDjVu({ pageCount: 1 });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    const worker = adapter._worker;
    adapter.destroy();
    assert.equal(worker._terminated, true);
  });

  it('clears the cache', async () => {
    const djvu = makeMockDjVu({ pageCount: 1 });
    const adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    // Manually put something in cache
    const fakeImg = { width: 10, height: 10, data: new Uint8ClampedArray(400) };
    adapter._cache.put(1, false, fakeImg);
    assert.equal(adapter._cache.size, 1);
    adapter.destroy();
    assert.equal(adapter._cache.size, 0);
  });
});

// ─── Semaphore ────────────────────────────────────────────────────────────────

describe('_acquireSemaphore / _releaseSemaphore', () => {
  /** @type {DjVuWorkerAdapter} */
  let adapter;
  beforeEach(async () => {
    const djvu = makeMockDjVu({ pageCount: 1 });
    adapter = await DjVuWorkerAdapter.open(djvu, new ArrayBuffer(8), 'test.djvu');
    // Reset semaphore state
    adapter._active = 0;
    adapter._waiters = [];
  });

  it('allows up to MAX_CONCURRENT (2) acquisitions immediately', async () => {
    const p1 = adapter._acquireSemaphore();
    const p2 = adapter._acquireSemaphore();
    // Both should resolve without waiting
    await p1;
    await p2;
    assert.equal(adapter._active, 2);
  });

  it('queues a third acquisition until one is released', async () => {
    await adapter._acquireSemaphore();
    await adapter._acquireSemaphore();
    let resolved = false;
    const p3 = adapter._acquireSemaphore().then(() => { resolved = true; });
    // Not yet resolved (queue full)
    assert.equal(resolved, false);
    // Release one slot
    adapter._releaseSemaphore();
    await p3;
    assert.equal(resolved, true);
  });

  it('release decrements active when no waiters', async () => {
    await adapter._acquireSemaphore();
    assert.equal(adapter._active, 1);
    adapter._releaseSemaphore();
    assert.equal(adapter._active, 0);
  });

  it('release does not go below 0', () => {
    adapter._active = 0;
    adapter._releaseSemaphore();
    assert.equal(adapter._active, 0);
  });
});
