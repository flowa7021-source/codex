// @ts-check
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PDFAdapter, ImageAdapter, DjVuAdapter, DjVuNativeAdapter, UnsupportedAdapter } from '../../app/modules/adapters.js';

// ─── PDFAdapter ──────────────────────────────────────────────────────────────

describe('PDFAdapter – constructor', () => {
  it('sets type and creates empty caches', () => {
    const adapter = new PDFAdapter({ numPages: 5 });
    assert.equal(adapter.type, 'pdf');
    assert.equal(adapter.pageTextCache.size, 0);
    assert.equal(adapter.pageTextPromises.size, 0);
    assert.equal(adapter._currentRenderTask, null);
  });
});

describe('PDFAdapter – getPageCount', () => {
  it('returns numPages from underlying pdfDoc', () => {
    const adapter = new PDFAdapter({ numPages: 42 });
    assert.equal(adapter.getPageCount(), 42);
  });
});

describe('PDFAdapter – cancelMainRender', () => {
  it('calls cancel on current render task and clears it', () => {
    let cancelled = false;
    const adapter = new PDFAdapter({ numPages: 1 });
    adapter._currentRenderTask = { cancel() { cancelled = true; } };
    adapter.cancelMainRender();
    assert.ok(cancelled);
    assert.equal(adapter._currentRenderTask, null);
  });

  it('handles already-finished render task gracefully', () => {
    const adapter = new PDFAdapter({ numPages: 1 });
    adapter._currentRenderTask = { cancel() { throw new Error('already done'); } };
    // Should not throw
    adapter.cancelMainRender();
    assert.equal(adapter._currentRenderTask, null);
  });

  it('does nothing when no render task', () => {
    const adapter = new PDFAdapter({ numPages: 1 });
    adapter.cancelMainRender();
    assert.equal(adapter._currentRenderTask, null);
  });
});

describe('PDFAdapter – _evictTextCache', () => {
  it('evicts oldest entries when cache exceeds TEXT_CACHE_MAX', () => {
    const adapter = new PDFAdapter({ numPages: 100 });
    // Fill cache beyond limit
    for (let i = 1; i <= PDFAdapter.TEXT_CACHE_MAX + 5; i++) {
      adapter.pageTextCache.set(i, `text-${i}`);
      adapter.pageTextPromises.set(i, Promise.resolve(`text-${i}`));
    }
    adapter._evictTextCache();
    assert.equal(adapter.pageTextCache.size, PDFAdapter.TEXT_CACHE_MAX);
    // Oldest entries should be gone
    assert.ok(!adapter.pageTextCache.has(1));
    assert.ok(!adapter.pageTextCache.has(5));
    // Newest should remain
    assert.ok(adapter.pageTextCache.has(PDFAdapter.TEXT_CACHE_MAX + 5));
  });

  it('does not evict when under limit', () => {
    const adapter = new PDFAdapter({ numPages: 100 });
    adapter.pageTextCache.set(1, 'text');
    adapter._evictTextCache();
    assert.equal(adapter.pageTextCache.size, 1);
  });
});

describe('PDFAdapter – getPageViewport', () => {
  it('delegates to pdfDoc.getPage().getViewport()', async () => {
    const mockViewport = { width: 800, height: 600 };
    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: (opts) => {
          assert.equal(opts.scale, 1.5);
          assert.equal(opts.rotation, 90);
          return mockViewport;
        },
      }),
    });
    const vp = await adapter.getPageViewport(1, 1.5, 90);
    assert.deepEqual(vp, mockViewport);
  });
});

describe('PDFAdapter – buildTextFromItems', () => {
  const adapter = new PDFAdapter({ numPages: 1 });

  it('returns empty string for null/empty items', () => {
    assert.equal(adapter.buildTextFromItems(null), '');
    assert.equal(adapter.buildTextFromItems([]), '');
  });

  it('builds text from single item', () => {
    const items = [{ str: 'Hello', transform: [1, 0, 0, 1, 10, 100], height: 12, width: 30 }];
    assert.equal(adapter.buildTextFromItems(items), 'Hello');
  });

  it('joins items on same line', () => {
    const items = [
      { str: 'Hello', transform: [1, 0, 0, 1, 10, 100], height: 12, width: 30 },
      { str: 'World', transform: [1, 0, 0, 1, 50, 100], height: 12, width: 30 },
    ];
    const text = adapter.buildTextFromItems(items);
    assert.ok(text.includes('Hello'));
    assert.ok(text.includes('World'));
  });

  it('breaks lines when Y changes significantly', () => {
    const items = [
      { str: 'Line1', transform: [1, 0, 0, 1, 10, 100], height: 12, width: 30 },
      { str: 'Line2', transform: [1, 0, 0, 1, 10, 80], height: 12, width: 30 },
    ];
    const text = adapter.buildTextFromItems(items);
    assert.ok(text.includes('\n'), 'should contain newline between lines');
  });

  it('collapses excessive whitespace', () => {
    const items = [
      { str: 'Hello   World', transform: [1, 0, 0, 1, 10, 100], height: 12, width: 80 },
    ];
    const text = adapter.buildTextFromItems(items);
    assert.equal(text, 'Hello World');
  });

  it('handles items with empty str gracefully', () => {
    const items = [
      { str: '', transform: [1, 0, 0, 1, 10, 100], height: 12 },
      { str: 'Real', transform: [1, 0, 0, 1, 10, 100], height: 12, width: 20 },
    ];
    assert.equal(adapter.buildTextFromItems(items), 'Real');
  });

  it('handles missing transform', () => {
    const items = [{ str: 'NoTransform', height: 12 }];
    assert.equal(adapter.buildTextFromItems(items), 'NoTransform');
  });
});

describe('PDFAdapter – getText', () => {
  it('caches text after first call', async () => {
    let getPageCalls = 0;
    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => {
        getPageCalls++;
        return {
          getTextContent: async () => ({
            items: [{ str: 'Cached', transform: [1, 0, 0, 1, 0, 0], height: 12, width: 40 }],
          }),
        };
      },
    });

    const t1 = await adapter.getText(1);
    const t2 = await adapter.getText(1);
    assert.equal(t1, 'Cached');
    assert.equal(t2, 'Cached');
    assert.equal(getPageCalls, 1, 'should only call getPage once due to cache');
  });

  it('deduplicates concurrent calls', async () => {
    let getPageCalls = 0;
    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => {
        getPageCalls++;
        return {
          getTextContent: async () => ({
            items: [{ str: 'Text', transform: [1, 0, 0, 1, 0, 0], height: 12, width: 20 }],
          }),
        };
      },
    });

    const [a, b] = await Promise.all([adapter.getText(1), adapter.getText(1)]);
    assert.equal(a, 'Text');
    assert.equal(b, 'Text');
    assert.equal(getPageCalls, 1);
  });
});

describe('PDFAdapter – renderPage', () => {
  it('renders page and sets canvas dimensions', async () => {
    const mockCanvas = document.createElement('canvas');
    const mockViewport = { width: 800, height: 600 };
    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => mockViewport,
        render: () => ({
          promise: Promise.resolve(),
        }),
      }),
    });

    await adapter.renderPage(1, mockCanvas, { zoom: 1, rotation: 0, dpr: 1 });
    assert.equal(mockCanvas.width, 800);
    assert.equal(mockCanvas.height, 600);
  });

  it('handles RenderingCancelledException without throwing', async () => {
    const cancelErr = new Error('render cancelled');
    cancelErr.name = 'RenderingCancelledException';
    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.reject(cancelErr) }),
      }),
    });

    // Should not throw
    await adapter.renderPage(1, document.createElement('canvas'), { zoom: 1, rotation: 0, dpr: 1 });
  });

  it('handles unknown pattern warning without throwing', async () => {
    const patternErr = new Error('Unknown pattern type');
    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.reject(patternErr) }),
      }),
    });

    await adapter.renderPage(1, document.createElement('canvas'), { zoom: 1, rotation: 0, dpr: 1 });
  });

  it('rethrows non-pattern, non-cancel errors', async () => {
    const realErr = new Error('GPU exploded');
    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.reject(realErr) }),
      }),
    });

    await assert.rejects(
      adapter.renderPage(1, document.createElement('canvas'), { zoom: 1, rotation: 0, dpr: 1 }),
      { message: 'GPU exploded' },
    );
  });
});

describe('PDFAdapter – getOutline', () => {
  it('delegates to pdfDoc.getOutline', async () => {
    const outline = [{ title: 'Chapter 1' }];
    const adapter = new PDFAdapter({ numPages: 1, getOutline: async () => outline });
    assert.deepEqual(await adapter.getOutline(), outline);
  });
});

describe('PDFAdapter – resolveDestToPage', () => {
  it('resolves array dest to page number', async () => {
    const adapter = new PDFAdapter({
      numPages: 10,
      getPageIndex: async () => 4,
      getDestination: async () => [{ ref: true }, 'Fit'],
    });
    const page = await adapter.resolveDestToPage('named-dest');
    assert.equal(page, 5); // 0-based index + 1
  });

  it('resolves direct array dest', async () => {
    const adapter = new PDFAdapter({
      numPages: 10,
      getPageIndex: async () => 0,
    });
    const page = await adapter.resolveDestToPage([{ ref: true }, 'Fit']);
    assert.equal(page, 1);
  });

  it('returns null for empty dest', async () => {
    const adapter = new PDFAdapter({
      numPages: 10,
      getDestination: async () => null,
    });
    const page = await adapter.resolveDestToPage('missing');
    assert.equal(page, null);
  });
});

// ─── ImageAdapter ────────────────────────────────────────────────────────────

describe('ImageAdapter – constructor', () => {
  it('sets type and meta', () => {
    const adapter = new ImageAdapter('blob:url', { width: 1920, height: 1080 });
    assert.equal(adapter.type, 'image');
    assert.equal(adapter.imageUrl, 'blob:url');
    assert.equal(adapter.imageMeta.width, 1920);
  });
});

describe('ImageAdapter – getPageCount', () => {
  it('always returns 1', () => {
    const adapter = new ImageAdapter('x', { width: 1, height: 1 });
    assert.equal(adapter.getPageCount(), 1);
  });
});

describe('ImageAdapter – getPageViewport', () => {
  it('returns scaled dimensions for 0 rotation', async () => {
    const adapter = new ImageAdapter('x', { width: 800, height: 600 });
    const vp = await adapter.getPageViewport(1, 2, 0);
    assert.equal(vp.width, 1600);
    assert.equal(vp.height, 1200);
  });

  it('swaps dimensions for 90 rotation', async () => {
    const adapter = new ImageAdapter('x', { width: 800, height: 600 });
    const vp = await adapter.getPageViewport(1, 1, 90);
    assert.equal(vp.width, 600);
    assert.equal(vp.height, 800);
  });

  it('keeps dimensions for 180 rotation', async () => {
    const adapter = new ImageAdapter('x', { width: 800, height: 600 });
    const vp = await adapter.getPageViewport(1, 1, 180);
    assert.equal(vp.width, 800);
    assert.equal(vp.height, 600);
  });
});

describe('ImageAdapter – getText', () => {
  it('returns empty string', async () => {
    const adapter = new ImageAdapter('x', { width: 1, height: 1 });
    assert.equal(await adapter.getText(), '');
  });
});

// ─── DjVuAdapter ─────────────────────────────────────────────────────────────

describe('DjVuAdapter – constructor & setData', () => {
  it('initializes with null data', () => {
    const adapter = new DjVuAdapter('test.djvu', null);
    assert.equal(adapter.type, 'djvu');
    assert.equal(adapter.mode, 'compat');
    assert.equal(adapter.pageCount, 1);
    assert.deepEqual(adapter.pagesText, []);
    assert.deepEqual(adapter.pagesImages, []);
  });

  it('initializes with valid data', () => {
    const data = {
      pageCount: 3,
      pagesText: ['text1', 'text2', 'text3'],
      pagesImages: ['img1', 'img2', 'img3'],
      pageSizes: [{ width: 800, height: 600 }, { width: 900, height: 700 }],
      outline: [{ title: 'Ch1' }],
    };
    const adapter = new DjVuAdapter('test.djvu', data);
    assert.equal(adapter.pageCount, 3);
    assert.equal(adapter.pagesText.length, 3);
    assert.deepEqual(adapter.outline, [{ title: 'Ch1' }]);
  });

  it('infers pageCount from data arrays if not specified', () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pagesText: ['a', 'b', 'c', 'd', 'e'],
    });
    assert.equal(adapter.pageCount, 5);
  });

  it('uses max of explicit pageCount and inferred count', () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pageCount: 2,
      pagesText: ['a', 'b', 'c', 'd'],
    });
    assert.equal(adapter.pageCount, 4); // max(2, 4)
  });

  it('sanitizes non-string pagesText entries', () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pagesText: [123, null, 'valid'],
    });
    assert.deepEqual(adapter.pagesText, ['', '', 'valid']);
  });
});

describe('DjVuAdapter – exportData', () => {
  it('returns full data object', () => {
    const data = { pageCount: 2, pagesText: ['a', 'b'], pagesImages: [], pageSizes: [], outline: [] };
    const adapter = new DjVuAdapter('test.djvu', data);
    const exported = adapter.exportData();
    assert.equal(exported.pageCount, 2);
    assert.deepEqual(exported.pagesText, ['a', 'b']);
  });
});

describe('DjVuAdapter – getPageCount', () => {
  it('returns correct count', () => {
    const adapter = new DjVuAdapter('test.djvu', { pageCount: 10 });
    assert.equal(adapter.getPageCount(), 10);
  });
});

describe('DjVuAdapter – getPageViewport', () => {
  it('uses page size from data', async () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pageSizes: [{ width: 500, height: 700 }],
    });
    const vp = await adapter.getPageViewport(1, 2, 0);
    assert.equal(vp.width, 1000);
    assert.equal(vp.height, 1400);
  });

  it('falls back to 1200x1600 when no size data', async () => {
    const adapter = new DjVuAdapter('test.djvu', null);
    const vp = await adapter.getPageViewport(1, 1, 0);
    assert.equal(vp.width, 1200);
    assert.equal(vp.height, 1600);
  });

  it('swaps dims for 90 rotation', async () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pageSizes: [{ width: 500, height: 700 }],
    });
    const vp = await adapter.getPageViewport(1, 1, 90);
    assert.equal(vp.width, 700);
    assert.equal(vp.height, 500);
  });
});

describe('DjVuAdapter – getText', () => {
  it('returns text for valid page', async () => {
    const adapter = new DjVuAdapter('test.djvu', { pagesText: ['hello'] });
    assert.equal(await adapter.getText(1), 'hello');
  });

  it('returns empty for missing page', async () => {
    const adapter = new DjVuAdapter('test.djvu', { pagesText: ['hello'] });
    assert.equal(await adapter.getText(99), '');
  });
});

describe('DjVuAdapter – getOutline', () => {
  it('returns stored outline', async () => {
    const outline = [{ title: 'Ch1' }];
    const adapter = new DjVuAdapter('test.djvu', { outline });
    assert.deepEqual(await adapter.getOutline(), outline);
  });
});

describe('DjVuAdapter – resolveDestToPage', () => {
  it('resolves valid page number', async () => {
    const adapter = new DjVuAdapter('test.djvu', { pageCount: 10 });
    assert.equal(await adapter.resolveDestToPage(5), 5);
  });

  it('returns null for out-of-range', async () => {
    const adapter = new DjVuAdapter('test.djvu', { pageCount: 10 });
    assert.equal(await adapter.resolveDestToPage(0), null);
    assert.equal(await adapter.resolveDestToPage(11), null);
  });

  it('returns null for non-integer', async () => {
    const adapter = new DjVuAdapter('test.djvu', { pageCount: 10 });
    assert.equal(await adapter.resolveDestToPage('abc'), null);
  });
});

// ─── DjVuNativeAdapter ──────────────────────────────────────────────────────

describe('DjVuNativeAdapter – constructor', () => {
  it('initializes with doc and fileName', () => {
    const adapter = new DjVuNativeAdapter({ getPagesQuantity: () => 5 }, 'test.djvu');
    assert.equal(adapter.type, 'djvu');
    assert.equal(adapter.mode, 'native');
    assert.equal(adapter.pageCount, 5);
    assert.equal(adapter.fileName, 'test.djvu');
    assert.equal(adapter._pageSizesLoaded, false);
  });

  it('defaults to 1 page when getPagesQuantity is missing', () => {
    const adapter = new DjVuNativeAdapter({}, 'test.djvu');
    assert.equal(adapter.pageCount, 1);
  });
});

describe('DjVuNativeAdapter – _ensurePageSizes', () => {
  it('loads sizes lazily', async () => {
    let called = false;
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 2,
      getPagesSizes: () => {
        called = true;
        return [{ width: 800, height: 600 }, { width: 900, height: 700 }];
      },
    }, 'test.djvu');

    assert.equal(called, false);
    await adapter._ensurePageSizes();
    assert.equal(called, true);
    assert.equal(adapter._pageSizesLoaded, true);
    assert.equal(adapter.pageSizes.length, 2);
  });

  it('does not reload if already loaded', async () => {
    let callCount = 0;
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPagesSizes: () => { callCount++; return []; },
    }, 'test.djvu');

    await adapter._ensurePageSizes();
    await adapter._ensurePageSizes();
    assert.equal(callCount, 1);
  });

  it('handles getPagesSizes failure gracefully', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPagesSizes: () => { throw new Error('corrupt'); },
    }, 'test.djvu');

    await adapter._ensurePageSizes();
    assert.deepEqual(adapter.pageSizes, []);
    assert.equal(adapter._pageSizesLoaded, true);
  });
});

describe('DjVuNativeAdapter – getPageViewport', () => {
  it('returns scaled viewport', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPagesSizes: () => [{ width: 500, height: 700 }],
    }, 'test.djvu');

    const vp = await adapter.getPageViewport(1, 2, 0);
    assert.equal(vp.width, 1000);
    assert.equal(vp.height, 1400);
  });
});

describe('DjVuNativeAdapter – getText', () => {
  it('extracts text from page', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => ({ getText: () => 'page text', reset() {} }),
    }, 'test.djvu');

    assert.equal(await adapter.getText(1), 'page text');
  });
});

describe('DjVuNativeAdapter – getOutline', () => {
  it('maps contents to outline items', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 3,
      getContents: () => [
        { description: 'Ch1', url: '#p1', children: [] },
      ],
      getPageNumberByUrl: (url) => url === '#p1' ? 1 : null,
    }, 'test.djvu');

    const outline = await adapter.getOutline();
    assert.equal(outline.length, 1);
    assert.equal(outline[0].title, 'Ch1');
    assert.equal(outline[0].dest, 1);
  });

  it('handles empty contents', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
    }, 'test.djvu');

    const outline = await adapter.getOutline();
    assert.deepEqual(outline, []);
  });
});

describe('DjVuNativeAdapter – resolveDestToPage', () => {
  it('resolves valid page', async () => {
    const adapter = new DjVuNativeAdapter({ getPagesQuantity: () => 10 }, 'test.djvu');
    assert.equal(await adapter.resolveDestToPage(5), 5);
  });

  it('returns null for out-of-range', async () => {
    const adapter = new DjVuNativeAdapter({ getPagesQuantity: () => 10 }, 'test.djvu');
    assert.equal(await adapter.resolveDestToPage(0), null);
    assert.equal(await adapter.resolveDestToPage(11), null);
  });
});

// ─── UnsupportedAdapter ─────────────────────────────────────────────────────

describe('UnsupportedAdapter – constructor', () => {
  it('sets type and fileName', () => {
    const adapter = new UnsupportedAdapter('file.xyz');
    assert.equal(adapter.type, 'unsupported');
    assert.equal(adapter.fileName, 'file.xyz');
  });
});

describe('UnsupportedAdapter – getPageCount', () => {
  it('always returns 1', () => {
    assert.equal(new UnsupportedAdapter('x').getPageCount(), 1);
  });
});

describe('UnsupportedAdapter – getPageViewport', () => {
  it('returns fixed 1200x700', async () => {
    const vp = await new UnsupportedAdapter('x').getPageViewport();
    assert.equal(vp.width, 1200);
    assert.equal(vp.height, 700);
  });
});

describe('UnsupportedAdapter – renderPage', () => {
  it('renders placeholder on canvas', async () => {
    const canvas = document.createElement('canvas');
    await new UnsupportedAdapter('test.xyz').renderPage(1, canvas);
    assert.equal(canvas.width, 1200);
    assert.equal(canvas.height, 700);
  });
});

describe('UnsupportedAdapter – getText', () => {
  it('returns empty string', async () => {
    assert.equal(await new UnsupportedAdapter('x').getText(), '');
  });
});

// ─── Additional coverage tests ──────────────────────────────────────────────

describe('PDFAdapter – renderPage main canvas branch', () => {
  it('cancels in-flight render when rendering to main canvas', async () => {
    // Simulate els.canvas pointing to our canvas
    const { els } = await import('../../app/modules/state.js');
    const canvas = document.createElement('canvas');
    const origCanvas = els.canvas;
    els.canvas = canvas;

    let cancelCalled = false;
    const oldTask = { cancel() { cancelCalled = true; } };

    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    });
    adapter._currentRenderTask = oldTask;

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0, dpr: 1 });
    assert.ok(cancelCalled, 'should cancel in-flight render task');
    assert.equal(adapter._currentRenderTask, null, 'should clear render task after completion');

    els.canvas = origCanvas;
  });

  it('handles cancel error on main canvas gracefully', async () => {
    const { els } = await import('../../app/modules/state.js');
    const canvas = document.createElement('canvas');
    const origCanvas = els.canvas;
    els.canvas = canvas;

    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    });
    adapter._currentRenderTask = { cancel() { throw new Error('already done'); } };

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0, dpr: 1 });
    assert.equal(adapter._currentRenderTask, null);

    els.canvas = origCanvas;
  });

  it('sets _currentRenderTask when rendering to main canvas', async () => {
    const { els } = await import('../../app/modules/state.js');
    const canvas = document.createElement('canvas');
    const origCanvas = els.canvas;
    els.canvas = canvas;

    let capturedTask = null;
    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => {
          const task = { promise: Promise.resolve() };
          capturedTask = task;
          return task;
        },
      }),
    });

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0, dpr: 1 });
    // After successful completion, task should be cleared
    assert.equal(adapter._currentRenderTask, null);

    els.canvas = origCanvas;
  });

  it('clears _currentRenderTask in finally block even on error', async () => {
    const { els } = await import('../../app/modules/state.js');
    const canvas = document.createElement('canvas');
    const origCanvas = els.canvas;
    els.canvas = canvas;

    const realErr = new Error('render fail');
    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.reject(realErr) }),
      }),
    });

    await assert.rejects(
      adapter.renderPage(1, canvas, { zoom: 1, rotation: 0, dpr: 1 }),
      { message: 'render fail' },
    );
    assert.equal(adapter._currentRenderTask, null, 'task should be cleared after error');

    els.canvas = origCanvas;
  });

  it('does not set _currentRenderTask for non-main canvas', async () => {
    const { els } = await import('../../app/modules/state.js');
    const origCanvas = els.canvas;
    els.canvas = document.createElement('canvas'); // main canvas
    const otherCanvas = document.createElement('canvas'); // different canvas

    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    });

    await adapter.renderPage(1, otherCanvas, { zoom: 1, rotation: 0, dpr: 1 });
    assert.equal(adapter._currentRenderTask, null);

    els.canvas = origCanvas;
  });
});

describe('PDFAdapter – renderPage uses window.devicePixelRatio when no dpr override', () => {
  it('defaults dpr from window.devicePixelRatio', async () => {
    const canvas = document.createElement('canvas');
    const origDpr = window.devicePixelRatio;
    window.devicePixelRatio = 2;

    const adapter = new PDFAdapter({
      numPages: 1,
      getPage: async () => ({
        getViewport: ({ scale }) => ({
          width: 200 * scale,
          height: 100 * scale,
        }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    });

    // Pass no dpr override — zoom=1, rotation=0
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    // renderScale = zoom * dpr = 1 * 2 = 2, viewport = 400x200
    assert.equal(canvas.width, 400);
    assert.equal(canvas.height, 200);

    window.devicePixelRatio = origDpr;
  });
});

describe('PDFAdapter – resolveDestToPage edge cases', () => {
  it('returns null for empty array dest', async () => {
    const adapter = new PDFAdapter({
      numPages: 10,
      getDestination: async () => [],
    });
    const page = await adapter.resolveDestToPage('empty-dest');
    assert.equal(page, null);
  });
});

describe('PDFAdapter – buildTextFromItems edge cases', () => {
  const adapter = new PDFAdapter({ numPages: 1 });

  it('handles items without width (uses fallback calculation)', () => {
    const items = [
      { str: 'AB', transform: [1, 0, 0, 1, 10, 100], height: 10 },
    ];
    const text = adapter.buildTextFromItems(items);
    assert.equal(text, 'AB');
  });

  it('does not add space when gap is small', () => {
    // Same line, very close together
    const items = [
      { str: 'A', transform: [1, 0, 0, 1, 10, 100], height: 12, width: 8 },
      { str: 'B', transform: [1, 0, 0, 1, 18, 100], height: 12, width: 8 },
    ];
    const text = adapter.buildTextFromItems(items);
    assert.equal(text, 'AB');
  });

  it('adds space when gap is large', () => {
    const items = [
      { str: 'Hello', transform: [1, 0, 0, 1, 10, 100], height: 12, width: 30 },
      { str: 'World', transform: [1, 0, 0, 1, 100, 100], height: 12, width: 30 },
    ];
    const text = adapter.buildTextFromItems(items);
    assert.equal(text, 'Hello World');
  });

  it('collapses triple newlines', () => {
    const items = [
      { str: 'A', transform: [1, 0, 0, 1, 10, 300], height: 12, width: 10 },
      { str: 'B', transform: [1, 0, 0, 1, 10, 200], height: 12, width: 10 },
      { str: 'C', transform: [1, 0, 0, 1, 10, 100], height: 12, width: 10 },
    ];
    const text = adapter.buildTextFromItems(items);
    assert.ok(!text.includes('\n\n\n'), 'should not have triple newlines');
  });

  it('handles items with zero height', () => {
    const items = [
      { str: 'X', transform: [1, 0, 0, 1, 10, 100], height: 0, width: 10 },
    ];
    const text = adapter.buildTextFromItems(items);
    assert.equal(text, 'X');
  });

  it('handles item with null str', () => {
    const items = [
      { str: null, transform: [1, 0, 0, 1, 10, 100], height: 12 },
      { str: 'Valid', transform: [1, 0, 0, 1, 10, 100], height: 12, width: 30 },
    ];
    const text = adapter.buildTextFromItems(items);
    assert.equal(text, 'Valid');
  });
});

describe('ImageAdapter – renderPage', () => {
  it('renders image with 0 rotation', async () => {
    // Mock loadImage by providing a module-level override
    const canvas = document.createElement('canvas');
    const origImage = globalThis.Image;

    // The loadImage function uses the Image constructor, mock it
    globalThis.Image = class MockImage {
      constructor() {
        this.width = 200;
        this.height = 100;
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
      set src(_v) {
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    };

    const adapter = new ImageAdapter('blob:test', { width: 200, height: 100 });
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    // Canvas should have dimensions set
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);

    globalThis.Image = origImage;
  });

  it('renders image with 90 rotation (swapped dimensions)', async () => {
    const canvas = document.createElement('canvas');
    globalThis.Image = class MockImage {
      constructor() {
        this.width = 200;
        this.height = 100;
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
      set src(_v) {
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    };

    const adapter = new ImageAdapter('blob:test', { width: 200, height: 100 });
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 90 });
    // With 90 rotation, canvas width/height should be swapped
    // rw = ceil(200 * 1 * dpr), rh = ceil(100 * 1 * dpr)
    // canvas.width = rh, canvas.height = rw
    assert.equal(canvas.width, 100); // rh
    assert.equal(canvas.height, 200); // rw

    globalThis.Image = class MockImage { constructor() { this.width = 0; this.height = 0; } };
  });

  it('renders image with 180 rotation (no swap)', async () => {
    const canvas = document.createElement('canvas');
    globalThis.Image = class MockImage {
      constructor() {
        this.width = 200;
        this.height = 100;
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
      set src(_v) {
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    };

    const adapter = new ImageAdapter('blob:test', { width: 200, height: 100 });
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 180 });
    assert.equal(canvas.width, 200);
    assert.equal(canvas.height, 100);

    globalThis.Image = class MockImage { constructor() { this.width = 0; this.height = 0; } };
  });
});

describe('DjVuAdapter – setData edge cases', () => {
  it('sanitizes non-string pagesImages entries', () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pagesImages: [42, null, 'valid-url'],
    });
    assert.deepEqual(adapter.pagesImages, ['', '', 'valid-url']);
  });

  it('handles pageSizes with invalid width/height', () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pageSizes: [
        { width: -10, height: 0 },
        { width: 'abc', height: undefined },
        { width: 800, height: 600 },
      ],
    });
    assert.deepEqual(adapter.pageSizes[0], { width: null, height: null });
    assert.deepEqual(adapter.pageSizes[1], { width: null, height: null });
    assert.deepEqual(adapter.pageSizes[2], { width: 800, height: 600 });
  });

  it('handles non-array outline', () => {
    const adapter = new DjVuAdapter('test.djvu', { outline: 'not-an-array' });
    assert.deepEqual(adapter.outline, []);
  });

  it('handles non-integer pageCount with valid data arrays', () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pageCount: 'ten',
      pagesText: ['a', 'b'],
    });
    assert.equal(adapter.pageCount, 2); // inferred from pagesText
  });

  it('handles pageCount of 0', () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pageCount: 0,
      pagesText: ['a'],
    });
    assert.equal(adapter.pageCount, 1); // 0 is not > 0, so inferred
  });
});

describe('DjVuAdapter – renderPage with image URL', () => {
  it('renders from image URL with 0 rotation', async () => {
    const origImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() {
        this.width = 400;
        this.height = 300;
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
      set src(_v) {
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    };

    const canvas = document.createElement('canvas');
    const adapter = new DjVuAdapter('test.djvu', {
      pagesImages: ['blob:image1'],
      pageSizes: [{ width: 400, height: 300 }],
    });

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);

    globalThis.Image = origImage;
  });

  it('renders from image URL with 90 rotation', async () => {
    const origImage = globalThis.Image;
    globalThis.Image = class MockImage {
      constructor() {
        this.width = 400;
        this.height = 300;
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
      set src(_v) {
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    };

    const canvas = document.createElement('canvas');
    const adapter = new DjVuAdapter('test.djvu', {
      pagesImages: ['blob:image1'],
    });

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 90 });
    // With 90 rotation, canvas dimensions should be swapped
    assert.equal(canvas.width, 300); // rh
    assert.equal(canvas.height, 400); // rw

    globalThis.Image = origImage;
  });
});

describe('DjVuAdapter – renderPage without image URL (fallback)', () => {
  it('renders placeholder text when no image available', async () => {
    const canvas = document.createElement('canvas');
    const adapter = new DjVuAdapter('test.djvu', {
      pagesText: ['some text'],
      pageCount: 1,
    });

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('renders placeholder for page with no text', async () => {
    const canvas = document.createElement('canvas');
    const adapter = new DjVuAdapter('test.djvu', {
      pageCount: 2,
    });

    await adapter.renderPage(2, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });
});

describe('DjVuNativeAdapter – renderPage', () => {
  it('renders page successfully with 0 rotation', async () => {
    const canvas = document.createElement('canvas');
    const mockImageData = { width: 200, height: 150, data: new Uint8Array(200 * 150 * 4) };
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => ({
        getImageData: () => mockImageData,
        reset() {},
      }),
      getPagesSizes: () => [{ width: 200, height: 150 }],
    }, 'test.djvu');

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('renders page with 90 rotation (swapped dimensions)', async () => {
    const canvas = document.createElement('canvas');
    const mockImageData = { width: 200, height: 150, data: new Uint8Array(200 * 150 * 4) };
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => ({
        getImageData: () => mockImageData,
        reset() {},
      }),
      getPagesSizes: () => [{ width: 200, height: 150 }],
    }, 'test.djvu');

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 90 });
    // With 90deg rotation, canvas width/height should be swapped
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('uses two-pass rendering for high zoom levels', async () => {
    const canvas = document.createElement('canvas');
    const mockImageData = { width: 200, height: 150, data: new Uint8Array(200 * 150 * 4) };
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => ({
        getImageData: () => mockImageData,
        reset() {},
      }),
      getPagesSizes: () => [{ width: 200, height: 150 }],
    }, 'test.djvu');

    // effectiveScale = zoom * dpr = 3 * 1 = 3, which is > 2.5
    await adapter.renderPage(1, canvas, { zoom: 3, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('renders fallback on decompress error', async () => {
    const canvas = document.createElement('canvas');
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => { throw new Error('corrupt page'); },
      getPagesSizes: () => [],
    }, 'test.djvu');

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    // Should render error fallback with fixed dimensions
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('renders fallback on zero-dimension imageData', async () => {
    const canvas = document.createElement('canvas');
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => ({
        getImageData: () => ({ width: 0, height: 0 }),
        reset() {},
      }),
      getPagesSizes: () => [],
    }, 'test.djvu');

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('renders fallback on null imageData', async () => {
    const canvas = document.createElement('canvas');
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => ({
        getImageData: () => null,
        reset() {},
      }),
      getPagesSizes: () => [],
    }, 'test.djvu');

    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });

  it('handles page without reset method', async () => {
    const canvas = document.createElement('canvas');
    const mockImageData = { width: 200, height: 150, data: new Uint8Array(200 * 150 * 4) };
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => ({
        getImageData: () => mockImageData,
        // no reset method
      }),
      getPagesSizes: () => [{ width: 200, height: 150 }],
    }, 'test.djvu');

    // Should not throw even without reset()
    await adapter.renderPage(1, canvas, { zoom: 1, rotation: 0 });
    assert.ok(canvas.width > 0);
  });
});

describe('DjVuNativeAdapter – getPageViewport edge cases', () => {
  it('falls back to 1200x1600 when no page size data', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPagesSizes: () => [],
    }, 'test.djvu');

    const vp = await adapter.getPageViewport(1, 1, 0);
    assert.equal(vp.width, 1200);
    assert.equal(vp.height, 1600);
  });

  it('swaps dims for 90 rotation', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPagesSizes: () => [{ width: 500, height: 700 }],
    }, 'test.djvu');

    const vp = await adapter.getPageViewport(1, 1, 90);
    assert.equal(vp.width, 700);
    assert.equal(vp.height, 500);
  });

  it('keeps dims for 180 rotation', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPagesSizes: () => [{ width: 500, height: 700 }],
    }, 'test.djvu');

    const vp = await adapter.getPageViewport(1, 1, 180);
    assert.equal(vp.width, 500);
    assert.equal(vp.height, 700);
  });
});

describe('DjVuNativeAdapter – getText edge cases', () => {
  it('returns empty string when getText returns empty', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => ({ getText: () => '', reset() {} }),
    }, 'test.djvu');

    assert.equal(await adapter.getText(1), '');
  });

  it('handles page without reset method', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPage: async () => ({ getText: () => 'text' }),
    }, 'test.djvu');

    assert.equal(await adapter.getText(1), 'text');
  });
});

describe('DjVuNativeAdapter – getOutline edge cases', () => {
  it('handles items without url', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 3,
      getContents: () => [
        { description: 'No URL item', children: [] },
      ],
      getPageNumberByUrl: () => null,
    }, 'test.djvu');

    const outline = await adapter.getOutline();
    assert.equal(outline.length, 1);
    assert.equal(outline[0].title, 'No URL item');
    assert.equal(outline[0].dest, null);
  });

  it('handles items without description (uses default title)', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 3,
      getContents: () => [
        { url: '#p1', children: [] },
      ],
      getPageNumberByUrl: () => 1,
    }, 'test.djvu');

    const outline = await adapter.getOutline();
    assert.equal(outline[0].title, '(без названия)');
    assert.equal(outline[0].dest, 1);
  });

  it('handles nested children', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 5,
      getContents: () => [
        {
          description: 'Parent',
          url: '#p1',
          children: [
            { description: 'Child', url: '#p2', children: [] },
          ],
        },
      ],
      getPageNumberByUrl: (url) => {
        if (url === '#p1') return 1;
        if (url === '#p2') return 2;
        return null;
      },
    }, 'test.djvu');

    const outline = await adapter.getOutline();
    assert.equal(outline[0].title, 'Parent');
    assert.equal(outline[0].dest, 1);
    assert.equal(outline[0].items.length, 1);
    assert.equal(outline[0].items[0].title, 'Child');
    assert.equal(outline[0].items[0].dest, 2);
  });

  it('handles non-array children gracefully', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getContents: () => [
        { description: 'Item', url: '#p1', children: 'not-array' },
      ],
      getPageNumberByUrl: () => 1,
    }, 'test.djvu');

    const outline = await adapter.getOutline();
    assert.equal(outline[0].items.length, 0);
  });

  it('handles non-integer page number from getPageNumberByUrl', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 3,
      getContents: () => [
        { description: 'Bad page', url: '#bad', children: [] },
      ],
      getPageNumberByUrl: () => 'not-a-number',
    }, 'test.djvu');

    const outline = await adapter.getOutline();
    assert.equal(outline[0].dest, null);
  });
});

describe('DjVuNativeAdapter – resolveDestToPage edge cases', () => {
  it('returns null for non-integer string', async () => {
    const adapter = new DjVuNativeAdapter({ getPagesQuantity: () => 10 }, 'test.djvu');
    assert.equal(await adapter.resolveDestToPage('abc'), null);
  });

  it('returns null for float', async () => {
    const adapter = new DjVuNativeAdapter({ getPagesQuantity: () => 10 }, 'test.djvu');
    assert.equal(await adapter.resolveDestToPage(2.5), null);
  });
});

describe('DjVuNativeAdapter – _ensurePageSizes with non-array result', () => {
  it('handles getPagesSizes returning non-array', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      getPagesSizes: () => 'not-an-array',
    }, 'test.djvu');

    await adapter._ensurePageSizes();
    assert.deepEqual(adapter.pageSizes, []);
    assert.equal(adapter._pageSizesLoaded, true);
  });

  it('handles getPagesSizes missing from doc', async () => {
    const adapter = new DjVuNativeAdapter({
      getPagesQuantity: () => 1,
      // no getPagesSizes
    }, 'test.djvu');

    await adapter._ensurePageSizes();
    assert.deepEqual(adapter.pageSizes, []);
    assert.equal(adapter._pageSizesLoaded, true);
  });
});

describe('DjVuAdapter – getPageViewport with invalid page size', () => {
  it('falls back for page with zero-width size', async () => {
    const adapter = new DjVuAdapter('test.djvu', {
      pageSizes: [{ width: 0, height: 0 }],
    });
    const vp = await adapter.getPageViewport(1, 1, 0);
    // width: 0 is not > 0 so falls back to 1200
    assert.equal(vp.width, 1200);
    assert.equal(vp.height, 1600);
  });
});

describe('UnsupportedAdapter – renderPage with null context', () => {
  it('returns early when getContext returns null', async () => {
    const canvas = {
      width: 0,
      height: 0,
      style: {},
      getContext: () => null,
    };
    // Should not throw
    await new UnsupportedAdapter('test.xyz').renderPage(1, canvas);
    assert.equal(canvas.width, 1200);
    assert.equal(canvas.height, 700);
  });
});
