// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VirtualScroll } from '../../app/modules/virtual-scroll.js';

/** Wait for async renders triggered by constructor to settle. */
async function settle(ms = 60) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Create a mock container element with configurable dimensions.
 */
function createMockContainer(opts = {}) {
  const scrollTop = opts.scrollTop ?? 0;
  const clientHeight = opts.clientHeight ?? 800;
  const container = document.createElement('div');
  Object.defineProperty(container, 'scrollTop', {
    get: () => scrollTop,
    set: () => {},
    configurable: true,
  });
  Object.defineProperty(container, 'clientHeight', {
    get: () => clientHeight,
    configurable: true,
  });
  container.scrollTo = () => {};
  return container;
}

// ─── Constructor & Initialization ───────────────────────────────────────────

describe('VirtualScroll – constructor', () => {
  it('initializes with correct properties', async () => {
    const container = createMockContainer();
    const vs = new VirtualScroll({
      container,
      pageCount: 10,
      getPageHeight: () => 1000,
      renderPage: async () => {},
    });

    assert.equal(vs.pageCount, 10);
    assert.equal(vs.overscan, 2);
    assert.equal(vs.gap, 8);
    assert.equal(vs._destroyed, false);

    await settle();
    vs.destroy();
  });

  it('accepts custom overscan and gap', async () => {
    const container = createMockContainer();
    const vs = new VirtualScroll({
      container,
      pageCount: 5,
      getPageHeight: () => 500,
      renderPage: async () => {},
      overscan: 3,
      gap: 16,
    });

    assert.equal(vs.overscan, 3);
    assert.equal(vs.gap, 16);

    await settle();
    vs.destroy();
  });

  it('provides default destroyPage callback', async () => {
    const container = createMockContainer();
    const vs = new VirtualScroll({
      container,
      pageCount: 1,
      getPageHeight: () => 500,
      renderPage: async () => {},
    });

    // Should not throw
    vs.destroyPage(1, document.createElement('div'));
    await settle();
    vs.destroy();
  });
});

// ─── Offset Computation ─────────────────────────────────────────────────────

describe('VirtualScroll – _computeOffsets', () => {
  it('computes correct cumulative offsets', async () => {
    const container = createMockContainer();
    const vs = new VirtualScroll({
      container,
      pageCount: 3,
      getPageHeight: (n) => n * 100,
      renderPage: async () => {},
      gap: 10,
    });

    assert.equal(vs.offsets[0], 0);
    assert.equal(vs.offsets[1], 110);
    assert.equal(vs.offsets[2], 320);
    assert.equal(vs.offsets[3], 630);

    await settle();
    vs.destroy();
  });

  it('handles single page', async () => {
    const container = createMockContainer();
    const vs = new VirtualScroll({
      container,
      pageCount: 1,
      getPageHeight: () => 500,
      renderPage: async () => {},
      gap: 0,
    });

    assert.equal(vs.offsets.length, 2);
    assert.equal(vs.offsets[0], 0);
    assert.equal(vs.offsets[1], 500);

    await settle();
    vs.destroy();
  });
});

// ─── getCurrentPage ─────────────────────────────────────────────────────────

describe('VirtualScroll – getCurrentPage', () => {
  it('returns page 1 when scrolled to top', async () => {
    const container = createMockContainer({ scrollTop: 0, clientHeight: 800 });
    const vs = new VirtualScroll({
      container,
      pageCount: 5,
      getPageHeight: () => 1000,
      renderPage: async () => {},
    });

    assert.equal(vs.getCurrentPage(), 1);
    await settle();
    vs.destroy();
  });

  it('returns last page when scrolled to bottom', async () => {
    const container = createMockContainer({ scrollTop: 100000, clientHeight: 800 });
    const vs = new VirtualScroll({
      container,
      pageCount: 5,
      getPageHeight: () => 1000,
      renderPage: async () => {},
    });

    assert.equal(vs.getCurrentPage(), 5);
    await settle();
    vs.destroy();
  });
});

// ─── scrollToPage ───────────────────────────────────────────────────────────

describe('VirtualScroll – scrollToPage', () => {
  it('calls scrollTo on container', async () => {
    let scrolledTo = null;
    const container = createMockContainer();
    container.scrollTo = (opts) => { scrolledTo = opts; };

    const vs = new VirtualScroll({
      container,
      pageCount: 5,
      getPageHeight: () => 500,
      renderPage: async () => {},
      gap: 0,
    });

    vs.scrollToPage(3);
    assert.ok(scrolledTo);
    assert.equal(scrolledTo.top, vs.offsets[2]);
    assert.equal(scrolledTo.behavior, 'smooth');

    await settle();
    vs.destroy();
  });

  it('supports instant scroll', async () => {
    let scrolledTo = null;
    const container = createMockContainer();
    container.scrollTo = (opts) => { scrolledTo = opts; };

    const vs = new VirtualScroll({
      container,
      pageCount: 5,
      getPageHeight: () => 500,
      renderPage: async () => {},
    });

    vs.scrollToPage(1, false);
    assert.equal(scrolledTo.behavior, 'instant');

    await settle();
    vs.destroy();
  });

  it('ignores invalid page numbers', async () => {
    let scrollCalled = false;
    const container = createMockContainer();
    container.scrollTo = () => { scrollCalled = true; };

    const vs = new VirtualScroll({
      container,
      pageCount: 5,
      getPageHeight: () => 500,
      renderPage: async () => {},
    });

    vs.scrollToPage(0);
    assert.equal(scrollCalled, false);

    vs.scrollToPage(6);
    assert.equal(scrollCalled, false);

    await settle();
    vs.destroy();
  });
});

// ─── setPageCount ───────────────────────────────────────────────────────────

describe('VirtualScroll – setPageCount', () => {
  it('updates page count and recomputes offsets', async () => {
    const container = createMockContainer();
    const vs = new VirtualScroll({
      container,
      pageCount: 3,
      getPageHeight: () => 500,
      renderPage: async () => {},
    });

    assert.equal(vs.pageCount, 3);
    vs.setPageCount(10);
    assert.equal(vs.pageCount, 10);
    assert.equal(vs.offsets.length, 11);

    await settle();
    vs.destroy();
  });
});

// ─── refresh ────────────────────────────────────────────────────────────────

describe('VirtualScroll – refresh', () => {
  it('clears rendered pages and recomputes', async () => {
    const container = createMockContainer();
    const vs = new VirtualScroll({
      container,
      pageCount: 3,
      getPageHeight: () => 500,
      renderPage: async () => {},
    });

    await settle();
    const fakeEl = document.createElement('div');
    vs.renderedPages.set(99, fakeEl);
    vs.refresh();
    // refresh clears all, then re-renders visible. Check 99 is gone.
    assert.ok(!vs.renderedPages.has(99));

    await settle();
    vs.destroy();
  });
});

// ─── destroy ────────────────────────────────────────────────────────────────

describe('VirtualScroll – destroy', () => {
  it('sets _destroyed flag and clears rendered pages', async () => {
    const container = createMockContainer();
    const vs = new VirtualScroll({
      container,
      pageCount: 3,
      getPageHeight: () => 500,
      renderPage: async () => {},
    });

    await settle();
    vs.destroy();
    assert.equal(vs._destroyed, true);
    assert.equal(vs.renderedPages.size, 0);
  });

  it('can be destroyed multiple times safely', async () => {
    const container = createMockContainer();
    const vs = new VirtualScroll({
      container,
      pageCount: 1,
      getPageHeight: () => 500,
      renderPage: async () => {},
    });

    await settle();
    vs.destroy();
    vs.destroy(); // Should not throw
  });
});

// ─── _renderPageElement error handling ───────────────────────────────────────

describe('VirtualScroll – render error handling', () => {
  it('handles renderPage errors and still tracks page', async () => {
    const container = createMockContainer();
    let renderCalled = false;
    const vs = new VirtualScroll({
      container,
      pageCount: 1,
      getPageHeight: () => 500,
      renderPage: async () => { renderCalled = true; throw new Error('render fail'); },
    });

    await settle(150);

    assert.ok(renderCalled, 'renderPage should have been called');
    assert.ok(vs.renderedPages.has(1), 'failed page should still be in renderedPages');
    vs.destroy();
  });
});
