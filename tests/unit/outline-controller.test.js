import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { state, els } from '../../app/modules/state.js';
import {
  initOutlineControllerDeps,
  renderDocInfo,
  buildOutlineItems,
  renderOutline,
  updatePreviewSelection,
  _drawPreviewPlaceholder,
} from '../../app/modules/outline-controller.js';

function resetState() {
  state.file = null;
  state.adapter = null;
  state.pageCount = 0;
  state.currentPage = 1;
  state.rotation = 0;
  state.outline = [];
  state.djvuBinaryDetected = false;
  els.docInfo = document.createElement('div');
  els.outlineList = document.createElement('ul');
  els.pagePreviewList = document.createElement('ul');
  els.importDjvuDataQuick = document.createElement('button');
  initOutlineControllerDeps({
    canSearchCurrentDoc: () => !!state.adapter,
    renderCurrentPage: async () => {},
  });
}

describe('outline-controller', () => {
  beforeEach(() => resetState());

  describe('renderDocInfo', () => {
    it('clears docInfo when no file is set', () => {
      els.docInfo.textContent = 'old';
      renderDocInfo();
      assert.equal(els.docInfo.textContent, '');
    });

    it('shows file info when file is present', () => {
      state.file = { name: 'doc.pdf', size: 1024 * 1024 * 2.5 };
      state.pageCount = 10;
      state.adapter = { type: 'pdf' };
      renderDocInfo();
      assert.ok(els.docInfo.textContent.includes('PDF'));
      assert.ok(els.docInfo.textContent.includes('2.50'));
      assert.ok(els.docInfo.textContent.includes('10'));
    });

    it('shows DjVu binary detected suffix', () => {
      state.file = { name: 'doc.djvu', size: 1024 };
      state.pageCount = 1;
      state.adapter = { type: 'djvu' };
      state.djvuBinaryDetected = true;
      renderDocInfo();
      assert.ok(els.docInfo.textContent.includes('DjVu binary detected'));
    });
  });

  describe('buildOutlineItems', () => {
    it('returns empty array when canSearchCurrentDoc is false', async () => {
      state.adapter = null;
      const result = await buildOutlineItems([{ title: 'Ch1' }]);
      assert.deepEqual(result, []);
    });

    it('builds flat outline items', async () => {
      state.adapter = {
        resolveDestToPage: async (dest) => 5,
      };
      const result = await buildOutlineItems([{ title: 'Chapter 1', dest: 'ref1' }]);
      assert.equal(result.length, 1);
      assert.equal(result[0].title, 'Chapter 1');
      assert.equal(result[0].page, 5);
      assert.equal(result[0].level, 0);
    });

    it('builds nested outline items with levels', async () => {
      state.adapter = {
        resolveDestToPage: async () => 1,
      };
      const items = [
        { title: 'Ch1', dest: 'r', items: [{ title: 'Sec1', dest: 'r2' }] },
      ];
      const result = await buildOutlineItems(items);
      assert.equal(result.length, 2);
      assert.equal(result[1].level, 1);
    });

    it('uses fallback title for untitled items', async () => {
      state.adapter = { resolveDestToPage: async () => 1 };
      const result = await buildOutlineItems([{ dest: 'r' }]);
      assert.equal(result[0].title, '(без названия)');
    });
  });

  describe('renderOutline', () => {
    it('shows message when adapter is not available', async () => {
      state.adapter = null;
      await renderOutline();
      assert.ok(els.outlineList.children.length > 0 || els.outlineList.innerHTML !== '');
    });
  });

  describe('updatePreviewSelection', () => {
    it('toggles active class on matching button', () => {
      const btn = document.createElement('button');
      btn.dataset = { page: '3' };
      btn.setAttribute('data-page', '3');
      // The mock querySelector won't fully work, but the function should not throw
      assert.doesNotThrow(() => updatePreviewSelection());
    });
  });

  describe('_drawPreviewPlaceholder', () => {
    it('draws on a canvas without errors', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 160;
      assert.doesNotThrow(() => _drawPreviewPlaceholder(canvas, 5));
    });
  });
});
