// ─── Unit Tests: Render Pipeline ────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderPage,
  schedulePreRender,
  invalidateCache,
  getCacheStats,
  renderPageProgressive,
} from '../../app/modules/render-pipeline.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 300;
  // Ensure getBoundingClientRect returns something useful
  c.getBoundingClientRect = () => ({ width: 200, height: 300, top: 0, left: 0, right: 200, bottom: 300, x: 0, y: 0, toJSON() {} });
  return c;
}

function makeCtx() {
  return {
    canvas: makeCanvas(),
    annotationCanvas: makeCanvas(),
    textLayerDiv: document.createElement('div'),
    canvasWrap: document.createElement('div'),
  };
}

function makeAdapter(opts = {}) {
  return {
    type: opts.type || 'image',
    pdfDoc: opts.pdfDoc || null,
    renderPage: async (_page, canvas, _zoom, _rotation) => {
      canvas.width = 200;
      canvas.height = 300;
      // Draw something so getImageData works
      const ctx2d = canvas.getContext('2d');
      if (ctx2d) ctx2d.fillRect(0, 0, 1, 1);
    },
  };
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  invalidateCache(); // clear all cache between tests
});

// ── renderPage ──────────────────────────────────────────────────────────────

describe('renderPage', () => {
  it('renders a page and returns dimensions', async () => {
    const ctx = makeCtx();
    const adapter = makeAdapter();
    const result = await renderPage(
      { page: 1, zoom: 1, rotation: 0, adapter },
      ctx,
    );
    assert.equal(typeof result.width, 'number');
    assert.equal(typeof result.height, 'number');
    assert.equal(typeof result.renderMs, 'number');
    assert.equal(result.fromCache, false);
  });

  it('throws on missing adapter', async () => {
    const ctx = makeCtx();
    await assert.rejects(
      () => renderPage({ page: 1, zoom: 1, rotation: 0, adapter: null }, ctx),
      { message: 'Invalid render options' },
    );
  });

  it('throws on page < 1', async () => {
    const ctx = makeCtx();
    await assert.rejects(
      () => renderPage({ page: 0, zoom: 1, rotation: 0, adapter: makeAdapter() }, ctx),
      { message: 'Invalid render options' },
    );
  });

  it('throws on negative page', async () => {
    const ctx = makeCtx();
    await assert.rejects(
      () => renderPage({ page: -1, zoom: 1, rotation: 0, adapter: makeAdapter() }, ctx),
      { message: 'Invalid render options' },
    );
  });

  it('caches result and returns fromCache on second call', async () => {
    const ctx = makeCtx();
    const adapter = makeAdapter();
    const opts = { page: 1, zoom: 1, rotation: 0, adapter, useCache: true };

    const r1 = await renderPage(opts, ctx);
    assert.equal(r1.fromCache, false);

    const r2 = await renderPage(opts, ctx);
    assert.equal(r2.fromCache, true);
  });

  it('skips cache when useCache=false', async () => {
    const ctx = makeCtx();
    const adapter = makeAdapter();

    await renderPage({ page: 1, zoom: 1, rotation: 0, adapter, useCache: true }, ctx);
    const r2 = await renderPage({ page: 1, zoom: 1, rotation: 0, adapter, useCache: false }, ctx);
    assert.equal(r2.fromCache, false);
  });

  it('calls onTextLayer callback when renderTextLayer is true', async () => {
    let called = false;
    const ctx = makeCtx();
    await renderPage(
      { page: 3, zoom: 1, rotation: 0, adapter: makeAdapter(), renderTextLayer: true },
      ctx,
      { onTextLayer: (page, div) => { called = true; assert.equal(page, 3); assert.ok(div); } },
    );
    assert.equal(called, true);
  });

  it('does not call onTextLayer when renderTextLayer is false', async () => {
    let called = false;
    const ctx = makeCtx();
    await renderPage(
      { page: 1, zoom: 1, rotation: 0, adapter: makeAdapter(), renderTextLayer: false },
      ctx,
      { onTextLayer: () => { called = true; } },
    );
    assert.equal(called, false);
  });

  it('does not call onTextLayer when textLayerDiv is null', async () => {
    let called = false;
    const ctx = makeCtx();
    ctx.textLayerDiv = null;
    await renderPage(
      { page: 1, zoom: 1, rotation: 0, adapter: makeAdapter() },
      ctx,
      { onTextLayer: () => { called = true; } },
    );
    assert.equal(called, false);
  });

  it('calls onAnnotations callback when renderAnnotations is true', async () => {
    let called = false;
    const ctx = makeCtx();
    await renderPage(
      { page: 2, zoom: 1, rotation: 0, adapter: makeAdapter(), renderAnnotations: true },
      ctx,
      { onAnnotations: (page, canvas) => { called = true; assert.equal(page, 2); assert.ok(canvas); } },
    );
    assert.equal(called, true);
  });

  it('does not call onAnnotations when renderAnnotations is false', async () => {
    let called = false;
    const ctx = makeCtx();
    await renderPage(
      { page: 1, zoom: 1, rotation: 0, adapter: makeAdapter(), renderAnnotations: false },
      ctx,
      { onAnnotations: () => { called = true; } },
    );
    assert.equal(called, false);
  });

  it('does not call onAnnotations when annotationCanvas is null', async () => {
    let called = false;
    const ctx = makeCtx();
    ctx.annotationCanvas = null;
    await renderPage(
      { page: 1, zoom: 1, rotation: 0, adapter: makeAdapter() },
      ctx,
      { onAnnotations: () => { called = true; } },
    );
    assert.equal(called, false);
  });

  it('calls onComplete callback with timing info', async () => {
    let info = null;
    const ctx = makeCtx();
    await renderPage(
      { page: 5, zoom: 2, rotation: 90, adapter: makeAdapter() },
      ctx,
      { onComplete: (page, timing) => { info = { page, timing }; } },
    );
    assert.equal(info.page, 5);
    assert.equal(typeof info.timing.renderMs, 'number');
    assert.equal(info.timing.fromCache, false);
    assert.equal(typeof info.timing.width, 'number');
    assert.equal(typeof info.timing.height, 'number');
  });

  it('works with no callbacks object', async () => {
    const ctx = makeCtx();
    const result = await renderPage(
      { page: 1, zoom: 1, rotation: 0, adapter: makeAdapter() },
      ctx,
    );
    assert.ok(result);
  });

  it('updates annotation canvas sizing', async () => {
    const ctx = makeCtx();
    await renderPage(
      { page: 1, zoom: 1, rotation: 0, adapter: makeAdapter() },
      ctx,
    );
    // annotationCanvas should have been sized
    assert.ok(ctx.annotationCanvas.width >= 0);
    assert.ok(ctx.annotationCanvas.height >= 0);
  });

  it('skips annotation canvas sizing when null', async () => {
    const ctx = makeCtx();
    ctx.annotationCanvas = null;
    // Should not throw
    const result = await renderPage(
      { page: 1, zoom: 1, rotation: 0, adapter: makeAdapter() },
      ctx,
    );
    assert.ok(result);
  });
});

// ── invalidateCache ─────────────────────────────────────────────────────────

describe('invalidateCache', () => {
  it('clears entire cache when called with no args', async () => {
    const ctx = makeCtx();
    const adapter = makeAdapter();
    await renderPage({ page: 1, zoom: 1, rotation: 0, adapter }, ctx);
    assert.ok(getCacheStats().entries > 0);
    invalidateCache();
    assert.equal(getCacheStats().entries, 0);
  });

  it('clears only specified pages', async () => {
    const ctx = makeCtx();
    const adapter = makeAdapter();
    await renderPage({ page: 1, zoom: 1, rotation: 0, adapter }, ctx);
    await renderPage({ page: 2, zoom: 1, rotation: 0, adapter }, ctx);
    assert.equal(getCacheStats().entries, 2);

    invalidateCache([1]);
    assert.equal(getCacheStats().entries, 1);
  });

  it('handles empty page array', async () => {
    const ctx = makeCtx();
    const adapter = makeAdapter();
    await renderPage({ page: 1, zoom: 1, rotation: 0, adapter }, ctx);
    invalidateCache([]);
    assert.equal(getCacheStats().entries, 1);
  });

  it('handles invalidating pages not in cache', () => {
    invalidateCache([999]);
    assert.equal(getCacheStats().entries, 0);
  });
});

// ── getCacheStats ───────────────────────────────────────────────────────────

describe('getCacheStats', () => {
  it('returns entries and maxSize', () => {
    const stats = getCacheStats();
    assert.equal(stats.entries, 0);
    assert.equal(stats.maxSize, 20);
  });

  it('increments entries after rendering', async () => {
    const ctx = makeCtx();
    await renderPage({ page: 1, zoom: 1, rotation: 0, adapter: makeAdapter() }, ctx);
    assert.equal(getCacheStats().entries, 1);
  });
});

// ── schedulePreRender ───────────────────────────────────────────────────────

describe('schedulePreRender', () => {
  it('can be called without error', () => {
    // Just verifying it doesn't throw
    schedulePreRender(1, 10, 1, 0, makeAdapter());
  });

  it('does not throw for edge pages', () => {
    schedulePreRender(1, 1, 1, 0, makeAdapter());
    schedulePreRender(10, 10, 1, 0, makeAdapter());
  });

  it('can be called multiple times (debounce)', () => {
    const adapter = makeAdapter();
    schedulePreRender(1, 10, 1, 0, adapter);
    schedulePreRender(2, 10, 1, 0, adapter);
    schedulePreRender(3, 10, 1, 0, adapter);
    // No error means debounce logic works
  });
});

// ── renderPageProgressive ───────────────────────────────────────────────────

describe('renderPageProgressive', () => {
  it('falls back to renderPage for non-PDF adapters', async () => {
    const ctx = makeCtx();
    const adapter = makeAdapter({ type: 'image' });
    const result = await renderPageProgressive(
      { page: 1, zoom: 1, rotation: 0, adapter },
      ctx,
    );
    assert.equal(typeof result.width, 'number');
    assert.equal(typeof result.height, 'number');
  });

  it('falls back to renderPage for DPR <= 1', async () => {
    // DPR is determined at module load, should be 1 in test env
    const ctx = makeCtx();
    const adapter = makeAdapter({ type: 'pdf', pdfDoc: {} });
    const result = await renderPageProgressive(
      { page: 1, zoom: 1, rotation: 0, adapter },
      ctx,
    );
    assert.equal(typeof result.width, 'number');
  });

  it('accepts callbacks without error', async () => {
    const ctx = makeCtx();
    const adapter = makeAdapter({ type: 'image' });
    let completeCalled = false;
    const result = await renderPageProgressive(
      { page: 1, zoom: 1, rotation: 0, adapter },
      ctx,
      { onComplete: () => { completeCalled = true; } },
    );
    assert.ok(result);
    assert.equal(completeCalled, true);
  });
});

// ── Cache eviction ──────────────────────────────────────────────────────────

describe('cache eviction', () => {
  it('evicts oldest entries when max capacity is reached', async () => {
    const ctx = makeCtx();
    const adapter = makeAdapter();

    // Fill cache beyond MAX_CACHE_SIZE (20)
    for (let i = 1; i <= 22; i++) {
      await renderPage({ page: i, zoom: 1, rotation: 0, adapter }, ctx);
    }

    const stats = getCacheStats();
    assert.ok(stats.entries <= 20, `Expected <= 20 entries, got ${stats.entries}`);
  });
});
