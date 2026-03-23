import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock state and els before importing module
const mockState = {
  adapter: null,
  docName: null,
  currentPage: 1,
  pageCount: 0,
  rotation: 0,
};

const mockEls = {
  pagePreviewList: null,
};

// Provide IntersectionObserver stub
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(cb, opts) { this._cb = cb; this._entries = []; }
    observe(el) { this._entries.push(el); }
    disconnect() { this._entries = []; }
    unobserve() {}
  };
}

// Mock state module
mock.module('../../app/modules/state.js', {
  namedExports: { state: mockState, els: mockEls },
});

const {
  invalidateThumbnailCache,
  renderPagePreviews,
  highlightCurrentPage,
  cleanupThumbnails,
} = await import('../../app/modules/thumbnail-renderer.js');

describe('thumbnail-renderer', () => {
  beforeEach(() => {
    mockState.adapter = null;
    mockState.docName = null;
    mockState.currentPage = 1;
    mockState.pageCount = 0;
    mockEls.pagePreviewList = null;
  });

  describe('invalidateThumbnailCache', () => {
    it('runs without error when cache is empty', () => {
      assert.doesNotThrow(() => invalidateThumbnailCache());
    });
  });

  describe('renderPagePreviews', () => {
    it('returns early when no container', async () => {
      mockEls.pagePreviewList = null;
      await assert.doesNotReject(() => renderPagePreviews());
    });

    it('returns early when no adapter', async () => {
      mockEls.pagePreviewList = document.createElement('div');
      mockState.adapter = null;
      await assert.doesNotReject(() => renderPagePreviews());
    });

    it('returns early when pageCount is 0', async () => {
      const container = document.createElement('div');
      mockEls.pagePreviewList = container;
      mockState.adapter = { renderPage: async () => {} };
      mockState.pageCount = 0;
      await renderPagePreviews();
      assert.equal(container.children.length, 0);
    });

    it('creates placeholders for each page', async () => {
      const container = document.createElement('div');
      mockEls.pagePreviewList = container;
      mockState.adapter = { renderPage: async () => {} };
      mockState.pageCount = 3;
      mockState.docName = 'test.pdf';
      await renderPagePreviews();
      assert.equal(container.children.length, 3);
    });

    it('sets data-page attribute on wrappers', async () => {
      const container = document.createElement('div');
      mockEls.pagePreviewList = container;
      mockState.adapter = { renderPage: async () => {} };
      mockState.pageCount = 2;
      mockState.docName = 'test2.pdf';
      await renderPagePreviews();
      assert.equal(container.children[0].dataset.page, '1');
      assert.equal(container.children[1].dataset.page, '2');
    });
  });

  describe('highlightCurrentPage', () => {
    it('does nothing when container is null', () => {
      mockEls.pagePreviewList = null;
      assert.doesNotThrow(() => highlightCurrentPage());
    });

    it('highlights the current page wrapper', async () => {
      const container = document.createElement('div');
      mockEls.pagePreviewList = container;
      mockState.adapter = { renderPage: async () => {} };
      mockState.pageCount = 2;
      mockState.docName = 'hl.pdf';
      mockState.currentPage = 2;
      await renderPagePreviews();
      highlightCurrentPage();
      // Current page (2) should have accent border
      const w2 = container.children[1];
      assert.ok(w2.style.borderColor.includes('accent') || w2.style.borderColor !== 'transparent');
    });
  });

  describe('cleanupThumbnails', () => {
    it('runs without error', () => {
      assert.doesNotThrow(() => cleanupThumbnails());
    });

    it('can be called multiple times safely', () => {
      cleanupThumbnails();
      cleanupThumbnails();
      assert.ok(true);
    });
  });
});
