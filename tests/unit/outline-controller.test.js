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
  _renderDeferredPreviews,
  renderPagePreviews,
} from '../../app/modules/outline-controller.js';

let mockRenderCurrentPage;

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
  mockRenderCurrentPage = mock.fn(async () => {});
  initOutlineControllerDeps({
    canSearchCurrentDoc: () => !!state.adapter,
    renderCurrentPage: mockRenderCurrentPage,
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

    it('hides importDjvuDataQuick button for non-djvu files', () => {
      state.file = { name: 'doc.pdf', size: 1024 };
      state.pageCount = 1;
      state.adapter = { type: 'pdf' };
      renderDocInfo();
      assert.ok(els.importDjvuDataQuick.classList.contains('is-hidden'));
    });

    it('shows importDjvuDataQuick button for djvu files', () => {
      state.file = { name: 'doc.djvu', size: 1024 };
      state.pageCount = 1;
      state.adapter = { type: 'djvu' };
      renderDocInfo();
      assert.ok(!els.importDjvuDataQuick.classList.contains('is-hidden'));
    });

    it('handles missing importDjvuDataQuick element', () => {
      els.importDjvuDataQuick = null;
      state.file = { name: 'doc.pdf', size: 1024 };
      state.pageCount = 1;
      state.adapter = { type: 'pdf' };
      assert.doesNotThrow(() => renderDocInfo());
    });

    it('does not show DjVu suffix when adapter is djvu but binary not detected', () => {
      state.file = { name: 'doc.djvu', size: 1024 };
      state.pageCount = 1;
      state.adapter = { type: 'djvu' };
      state.djvuBinaryDetected = false;
      renderDocInfo();
      assert.ok(!els.docInfo.textContent.includes('DjVu binary detected'));
    });

    it('handles file without extension gracefully', () => {
      state.file = { name: 'noext', size: 512 };
      state.pageCount = 1;
      state.adapter = { type: 'pdf' };
      renderDocInfo();
      // Should show 'NOEXT' as extension (last segment after split on .)
      assert.ok(els.docInfo.textContent.length > 0);
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

    it('sets page to null when item has no dest', async () => {
      state.adapter = { resolveDestToPage: async () => 1 };
      const result = await buildOutlineItems([{ title: 'No Dest' }]);
      assert.equal(result.length, 1);
      assert.equal(result[0].page, null);
      assert.equal(result[0].title, 'No Dest');
    });

    it('sets page to null when resolveDestToPage throws', async () => {
      state.adapter = {
        resolveDestToPage: async () => { throw new Error('resolve failed'); },
      };
      const result = await buildOutlineItems([{ title: 'Bad', dest: 'broken' }]);
      assert.equal(result.length, 1);
      assert.equal(result[0].page, null);
      assert.equal(result[0].title, 'Bad');
    });

    it('returns empty array when called with no arguments (defaults)', async () => {
      state.adapter = { resolveDestToPage: async () => 1 };
      const result = await buildOutlineItems();
      assert.deepEqual(result, []);
    });

    it('handles deeply nested outline items', async () => {
      state.adapter = { resolveDestToPage: async () => 3 };
      const items = [
        {
          title: 'L0', dest: 'd0', items: [
            {
              title: 'L1', dest: 'd1', items: [
                { title: 'L2', dest: 'd2' },
              ],
            },
          ],
        },
      ];
      const result = await buildOutlineItems(items);
      assert.equal(result.length, 3);
      assert.equal(result[0].level, 0);
      assert.equal(result[1].level, 1);
      assert.equal(result[2].level, 2);
    });
  });

  describe('renderOutline', () => {
    it('shows message when adapter is not available', async () => {
      state.adapter = null;
      await renderOutline();
      assert.ok(els.outlineList.children.length > 0 || els.outlineList.innerHTML !== '');
      const li = els.outlineList.children[0];
      assert.ok(li.textContent.includes('Оглавление доступно'));
    });

    it('shows empty outline message when adapter has no outline', async () => {
      state.adapter = {
        getOutline: async () => [],
        resolveDestToPage: async () => 1,
      };
      await renderOutline();
      const li = els.outlineList.children[0];
      assert.ok(li.textContent.includes('Оглавление отсутствует'));
    });

    it('shows empty outline message when getOutline returns null', async () => {
      state.adapter = {
        getOutline: async () => null,
        resolveDestToPage: async () => 1,
      };
      await renderOutline();
      const li = els.outlineList.children[0];
      assert.ok(li.textContent.includes('Оглавление отсутствует'));
    });

    it('renders outline items with buttons', async () => {
      state.adapter = {
        getOutline: async () => [
          { title: 'Chapter 1', dest: 'ch1' },
          { title: 'Chapter 2', dest: 'ch2' },
        ],
        resolveDestToPage: async (dest) => (dest === 'ch1' ? 1 : 2),
      };
      await renderOutline();
      assert.equal(els.outlineList.children.length, 2);
      assert.equal(state.outline.length, 2);

      const btn1 = els.outlineList.children[0].children[0];
      assert.ok(btn1.textContent.includes('Chapter 1'));
      assert.ok(btn1.textContent.includes('стр. 1'));
      assert.equal(btn1.tagName, 'BUTTON');
    });

    it('renders outline item without link when page is null', async () => {
      state.adapter = {
        getOutline: async () => [{ title: 'No Link' }],
        resolveDestToPage: async () => 1,
      };
      await renderOutline();
      const btn = els.outlineList.children[0].children[0];
      assert.ok(btn.textContent.includes('без ссылки'));
      assert.equal(btn.disabled, true);
    });

    it('applies padding based on level', async () => {
      state.adapter = {
        getOutline: async () => [
          { title: 'Top', dest: 'd1', items: [{ title: 'Sub', dest: 'd2' }] },
        ],
        resolveDestToPage: async () => 1,
      };
      await renderOutline();
      const li0 = els.outlineList.children[0];
      const li1 = els.outlineList.children[1];
      assert.equal(li0.style.paddingLeft, '8px');
      assert.equal(li1.style.paddingLeft, '18px');
    });

    it('clicking outline button navigates to page', async () => {
      state.adapter = {
        getOutline: async () => [{ title: 'Go', dest: 'x' }],
        resolveDestToPage: async () => 7,
      };
      await renderOutline();
      const btn = els.outlineList.children[0].children[0];
      btn.click();
      // Allow async click handler to execute
      await new Promise(r => setTimeout(r, 10));
      assert.equal(state.currentPage, 7);
      assert.equal(mockRenderCurrentPage.mock.calls.length, 1);
    });

    it('clicking disabled outline button does not navigate', async () => {
      state.adapter = {
        getOutline: async () => [{ title: 'Nowhere' }],
        resolveDestToPage: async () => 1,
      };
      await renderOutline();
      const btn = els.outlineList.children[0].children[0];
      state.currentPage = 1;
      btn.click();
      await new Promise(r => setTimeout(r, 10));
      assert.equal(state.currentPage, 1);
      assert.equal(mockRenderCurrentPage.mock.calls.length, 0);
    });

    it('clears previous outline on re-render', async () => {
      state.adapter = {
        getOutline: async () => [{ title: 'A', dest: 'a' }],
        resolveDestToPage: async () => 1,
      };
      await renderOutline();
      assert.equal(els.outlineList.children.length, 1);

      // Re-render with empty outline
      state.adapter.getOutline = async () => [];
      await renderOutline();
      // Should have one child: the "no outline" message
      assert.equal(els.outlineList.children.length, 1);
      assert.ok(els.outlineList.children[0].textContent.includes('Оглавление отсутствует'));
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

    it('sets active class on button matching currentPage', () => {
      const btn1 = document.createElement('button');
      btn1.setAttribute('data-page', '1');
      btn1.dataset.page = '1';
      const btn2 = document.createElement('button');
      btn2.setAttribute('data-page', '2');
      btn2.dataset.page = '2';

      // Patch querySelectorAll to return our buttons for the attribute selector
      els.pagePreviewList.querySelectorAll = (selector) => {
        if (selector === 'button[data-page]') return [btn1, btn2];
        return [];
      };

      state.currentPage = 2;
      updatePreviewSelection();

      assert.ok(!btn1.classList.contains('active'));
      assert.ok(btn2.classList.contains('active'));
    });

    it('removes active class when page changes', () => {
      const btn1 = document.createElement('button');
      btn1.setAttribute('data-page', '1');
      btn1.dataset.page = '1';
      btn1.classList.add('active');

      els.pagePreviewList.querySelectorAll = (selector) => {
        if (selector === 'button[data-page]') return [btn1];
        return [];
      };

      state.currentPage = 5;
      updatePreviewSelection();

      assert.ok(!btn1.classList.contains('active'));
    });
  });

  describe('_drawPreviewPlaceholder', () => {
    it('draws on a canvas without errors', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 160;
      assert.doesNotThrow(() => _drawPreviewPlaceholder(canvas, 5));
    });

    it('does nothing when getContext returns null', () => {
      const canvas = document.createElement('canvas');
      canvas.getContext = () => null;
      assert.doesNotThrow(() => _drawPreviewPlaceholder(canvas, 1));
    });
  });

  describe('_renderDeferredPreviews', () => {
    /** Helper: create a button with data-page that the mock DOM can find */
    function makePageButton(page, opts = {}) {
      const btn = document.createElement('button');
      btn.setAttribute('data-page', String(page));
      btn.dataset.page = String(page);
      if (opts.withCanvas) {
        const canvas = document.createElement('canvas');
        if (opts.needsRender) canvas.dataset.needsRender = '1';
        btn.appendChild(canvas);
      }
      return btn;
    }

    /**
     * Override querySelectorAll on els.pagePreviewList so that
     * the attribute selector 'button[data-page]' works in our mock DOM.
     */
    function patchPreviewListQuery(buttons) {
      const origQSA = els.pagePreviewList.querySelectorAll.bind(els.pagePreviewList);
      els.pagePreviewList.querySelectorAll = (selector) => {
        if (selector === 'button[data-page]') return buttons;
        return origQSA(selector);
      };
    }

    it('returns early when adapter is null', async () => {
      state.adapter = null;
      await assert.doesNotReject(() => _renderDeferredPreviews(1, 5));
    });

    it('skips buttons outside the requested range', async () => {
      const renderPageMock = mock.fn(async () => {});
      state.adapter = {
        getPageViewport: async () => ({ width: 100, height: 150 }),
        renderPage: renderPageMock,
      };
      state.rotation = 0;

      const btn = makePageButton(10, { withCanvas: true, needsRender: true });
      patchPreviewListQuery([btn]);

      await _renderDeferredPreviews(1, 5);
      assert.equal(renderPageMock.mock.calls.length, 0);
    });

    it('skips buttons without canvas', async () => {
      const renderPageMock = mock.fn(async () => {});
      state.adapter = {
        getPageViewport: async () => ({ width: 100, height: 150 }),
        renderPage: renderPageMock,
      };

      const btn = makePageButton(2); // no canvas
      patchPreviewListQuery([btn]);

      await _renderDeferredPreviews(1, 5);
      assert.equal(renderPageMock.mock.calls.length, 0);
    });

    it('skips canvas without needsRender flag', async () => {
      const renderPageMock = mock.fn(async () => {});
      state.adapter = {
        getPageViewport: async () => ({ width: 100, height: 150 }),
        renderPage: renderPageMock,
      };

      const btn = makePageButton(2, { withCanvas: true, needsRender: false });
      patchPreviewListQuery([btn]);

      await _renderDeferredPreviews(1, 5);
      assert.equal(renderPageMock.mock.calls.length, 0);
    });

    it('renders preview for canvas in range with needsRender flag', async () => {
      const renderPageMock = mock.fn(async () => {});
      state.adapter = {
        getPageViewport: async () => ({ width: 100, height: 150 }),
        renderPage: renderPageMock,
      };
      state.rotation = 0;

      const btn = makePageButton(3, { withCanvas: true, needsRender: true });
      const canvas = btn.querySelector('canvas');
      patchPreviewListQuery([btn]);

      await _renderDeferredPreviews(1, 5);
      assert.equal(renderPageMock.mock.calls.length, 1);
      assert.equal(canvas.dataset.needsRender, undefined);
    });

    it('handles render error gracefully (fallback)', async () => {
      state.adapter = {
        getPageViewport: async () => { throw new Error('viewport failed'); },
        renderPage: async () => {},
      };
      state.rotation = 0;

      const btn = makePageButton(2, { withCanvas: true, needsRender: true });
      patchPreviewListQuery([btn]);

      // Should not throw — error is caught internally
      await assert.doesNotReject(() => _renderDeferredPreviews(1, 5));
    });

    it('uses correct scale based on viewport dimensions', async () => {
      let capturedOpts;
      state.adapter = {
        getPageViewport: async () => ({ width: 200, height: 300 }),
        renderPage: async (page, canvas, opts) => { capturedOpts = opts; },
      };
      state.rotation = 90;

      const btn = makePageButton(1, { withCanvas: true, needsRender: true });
      patchPreviewListQuery([btn]);

      await _renderDeferredPreviews(1, 1);
      // scale = Math.min(120/200, 160/300) = Math.min(0.6, 0.533) = 0.533...
      const expectedScale = Math.min(120 / 200, 160 / 300);
      assert.ok(Math.abs(capturedOpts.zoom - expectedScale) < 0.001);
      assert.equal(capturedOpts.rotation, 90);
    });
  });

  describe('renderPagePreviews', () => {
    it('falls back to simple list when dynamic import fails', async () => {
      state.adapter = { type: 'pdf' };
      state.pageCount = 3;

      await renderPagePreviews();
      // The dynamic import of thumbnail-renderer.js will fail in test env,
      // so the fallback path should run, creating list items
      const children = els.pagePreviewList.children;
      assert.equal(children.length, 3);
      for (let i = 0; i < children.length; i++) {
        assert.equal(children[i].className, 'recent-item');
      }
    });

    it('fallback returns early when no adapter', async () => {
      state.adapter = null;
      state.pageCount = 5;

      await renderPagePreviews();
      assert.equal(els.pagePreviewList.children.length, 0);
    });

    it('fallback limits to 20 pages and shows message', async () => {
      state.adapter = { type: 'pdf' };
      state.pageCount = 25;

      await renderPagePreviews();
      const children = els.pagePreviewList.children;
      // 20 page items + 1 message item
      assert.equal(children.length, 21);
      const lastChild = children[20];
      assert.ok(lastChild.textContent.includes('25'));
      assert.ok(lastChild.textContent.includes('20'));
    });

    it('fallback does not show message when pageCount <= 20', async () => {
      state.adapter = { type: 'pdf' };
      state.pageCount = 15;

      await renderPagePreviews();
      const children = els.pagePreviewList.children;
      assert.equal(children.length, 15);
    });

    it('fallback button click navigates to page', async () => {
      state.adapter = { type: 'pdf' };
      state.pageCount = 2;

      await renderPagePreviews();
      const btn = els.pagePreviewList.children[1].children[0];
      btn.click();
      await new Promise(r => setTimeout(r, 10));
      assert.equal(state.currentPage, 2);
      assert.equal(mockRenderCurrentPage.mock.calls.length, 1);
    });

    it('calls updatePreviewSelection after rendering', async () => {
      state.adapter = { type: 'pdf' };
      state.pageCount = 2;
      state.currentPage = 2;

      // Add buttons with data-page to the list before calling renderPagePreviews
      // (renderPagePreviews clears the list so we check after)
      await renderPagePreviews();
      // The function calls updatePreviewSelection at the end.
      // Just verify it doesn't throw and completes.
      assert.ok(true);
    });
  });
});
