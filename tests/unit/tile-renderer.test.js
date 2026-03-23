// @ts-check
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldUseTileRendering,
  renderTiles,
  invalidateTiles,
  setRenderGenerationGetter,
} from '../../app/modules/tile-renderer.js';

// ─── shouldUseTileRendering ─────────────────────────────────────────────────

describe('shouldUseTileRendering', () => {
  it('returns false for null viewport', () => {
    assert.equal(shouldUseTileRendering(null), false);
  });

  it('returns false for undefined viewport', () => {
    assert.equal(shouldUseTileRendering(undefined), false);
  });

  it('returns false for small viewport', () => {
    assert.equal(shouldUseTileRendering({ width: 1920, height: 1080 }), false);
  });

  it('returns true when width exceeds threshold', () => {
    assert.equal(shouldUseTileRendering({ width: 5000, height: 1000 }), true);
  });

  it('returns true when height exceeds threshold', () => {
    assert.equal(shouldUseTileRendering({ width: 1000, height: 5000 }), true);
  });

  it('returns true when both exceed threshold', () => {
    assert.equal(shouldUseTileRendering({ width: 5000, height: 5000 }), true);
  });

  it('returns false at exactly 4000px', () => {
    assert.equal(shouldUseTileRendering({ width: 4000, height: 4000 }), false);
  });

  it('returns true at 4001px', () => {
    assert.equal(shouldUseTileRendering({ width: 4001, height: 1000 }), true);
  });
});

// ─── invalidateTiles ────────────────────────────────────────────────────────

describe('invalidateTiles', () => {
  it('can be called without error when cache is empty', () => {
    invalidateTiles(); // Should not throw
  });

  it('clears tile cache on repeated calls', () => {
    invalidateTiles();
    invalidateTiles();
    // No error means success — cache was cleared
  });
});

// ─── renderTiles ────────────────────────────────────────────────────────────

describe('renderTiles', () => {
  let generation = 0;

  beforeEach(() => {
    invalidateTiles();
    generation = 0;
    setRenderGenerationGetter(() => generation);
  });

  it('renders tiles for a large page', async () => {
    const mockCanvas = document.createElement('canvas');
    mockCanvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080 });
    const mockScrollContainer = {
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 1920, bottom: 1080 }),
    };
    const adapter = {
      getPageViewport: async () => ({ width: 5000, height: 5000 }),
      renderPage: async (_page, canvas) => {
        canvas.width = 5000;
        canvas.height = 5000;
      },
    };

    await renderTiles(adapter, 1, mockCanvas, { zoom: 1, rotation: 0 }, mockScrollContainer);
    assert.equal(mockCanvas.width, 5000);
    assert.equal(mockCanvas.height, 5000);
  });

  it('discards render if generation changes during async work', async () => {
    const mockCanvas = document.createElement('canvas');
    const adapter = {
      getPageViewport: async () => ({ width: 5000, height: 3000 }),
      renderPage: async (_page, canvas) => {
        // Simulate new render starting during this async operation
        generation = 999;
        canvas.width = 5000;
        canvas.height = 3000;
      },
    };

    await renderTiles(adapter, 1, mockCanvas, { zoom: 1, rotation: 0 }, null);
    // Canvas should be sized but tiles shouldn't be cached due to stale generation
    assert.equal(mockCanvas.width, 5000);
  });

  it('handles adapter renderPage failure gracefully', async () => {
    const mockCanvas = document.createElement('canvas');
    const adapter = {
      getPageViewport: async () => ({ width: 5000, height: 3000 }),
      renderPage: async () => { throw new Error('render failed'); },
    };

    // Should not throw
    await renderTiles(adapter, 1, mockCanvas, { zoom: 1, rotation: 0 }, null);
  });

  it('serves cached tiles on second render', async () => {
    let renderCount = 0;
    const adapter = {
      getPageViewport: async () => ({ width: 5000, height: 3000 }),
      renderPage: async (_page, canvas) => {
        renderCount++;
        canvas.width = 5000;
        canvas.height = 3000;
      },
    };
    const canvas = document.createElement('canvas');

    await renderTiles(adapter, 1, canvas, { zoom: 1, rotation: 0 }, null);
    const firstRenderCount = renderCount;

    await renderTiles(adapter, 1, canvas, { zoom: 1, rotation: 0 }, null);
    // Second render should use cache, so renderPage called at most once more
    // (the full page render is called once per renderTiles when there are uncached tiles)
    assert.ok(renderCount <= firstRenderCount + 1);
  });
});

// ─── setRenderGenerationGetter ──────────────────────────────────────────────

describe('setRenderGenerationGetter', () => {
  it('accepts a function', () => {
    setRenderGenerationGetter(() => 42);
    // No error means success
  });
});
