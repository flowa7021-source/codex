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
