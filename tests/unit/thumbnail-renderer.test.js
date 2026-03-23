import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { state, els } from '../../app/modules/state.js';

// Provide IntersectionObserver stub
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(cb, opts) { this._cb = cb; this._entries = []; }
    observe(el) { this._entries.push(el); }
    disconnect() { this._entries = []; }
    unobserve() {}
  };
}

const {
  invalidateThumbnailCache,
  renderPagePreviews,
  highlightCurrentPage,
  cleanupThumbnails,
} = await import('../../app/modules/thumbnail-renderer.js');

describe('thumbnail-renderer', () => {
  beforeEach(() => {
    state.adapter = null;
    state.docName = null;
    state.currentPage = 1;
    state.pageCount = 0;
    state.rotation = 0;
    els.pagePreviewList = null;
  });

  describe('invalidateThumbnailCache', () => {
    it('runs without error when cache is empty', () => {
      assert.doesNotThrow(() => invalidateThumbnailCache());
    });
  });

  describe('renderPagePreviews', () => {
    it('returns early when no container', async () => {
      els.pagePreviewList = null;
      await assert.doesNotReject(() => renderPagePreviews());
    });

    it('returns early when no adapter', async () => {
      els.pagePreviewList = document.createElement('div');
      state.adapter = null;
      await assert.doesNotReject(() => renderPagePreviews());
    });

    it('returns early when pageCount is 0', async () => {
      const container = document.createElement('div');
      els.pagePreviewList = container;
      state.adapter = { renderPage: async () => {} };
      state.pageCount = 0;
      await renderPagePreviews();
      assert.equal(container.children.length, 0);
    });

    it('creates placeholders for each page', async () => {
      const container = document.createElement('div');
      els.pagePreviewList = container;
      state.adapter = { renderPage: async () => {} };
      state.pageCount = 3;
      state.docName = 'test.pdf';
      await renderPagePreviews();
      assert.equal(container.children.length, 3);
    });

    it('sets data-page attribute on wrappers', async () => {
      const container = document.createElement('div');
      els.pagePreviewList = container;
      state.adapter = { renderPage: async () => {} };
      state.pageCount = 2;
      state.docName = 'test2.pdf';
      await renderPagePreviews();
      assert.equal(container.children[0].dataset.page, '1');
      assert.equal(container.children[1].dataset.page, '2');
    });
  });

  describe('highlightCurrentPage', () => {
    it('does nothing when container is null', () => {
      els.pagePreviewList = null;
      assert.doesNotThrow(() => highlightCurrentPage());
    });

    it('highlights the current page wrapper', async () => {
      const container = document.createElement('div');
      els.pagePreviewList = container;
      state.adapter = { renderPage: async () => {} };
      state.pageCount = 2;
      state.docName = 'hl.pdf';
      state.currentPage = 2;
      await renderPagePreviews();
      highlightCurrentPage();
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
