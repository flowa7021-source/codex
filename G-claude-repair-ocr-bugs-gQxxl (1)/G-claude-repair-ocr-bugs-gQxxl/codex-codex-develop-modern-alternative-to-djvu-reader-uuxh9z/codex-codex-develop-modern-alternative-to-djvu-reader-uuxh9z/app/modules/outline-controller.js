/**
 * outline-controller.js
 * ---------------------
 * Manages document outline (table of contents) and page preview thumbnails.
 * Extracted from app.js to keep the main module lean.
 */

import { state, els } from './state.js';
import { yieldToMainThread } from './utils.js';

/* Late-bound cross-module dependencies */
let _deps = {
  canSearchCurrentDoc: null,
  renderCurrentPage: null,
};

export function initOutlineControllerDeps(deps) {
  _deps.canSearchCurrentDoc = deps.canSearchCurrentDoc;
  _deps.renderCurrentPage = deps.renderCurrentPage;
}

export function renderDocInfo() {
  if (!state.file) {
    els.docInfo.textContent = '';
    return;
  }

  const sizeMb = (state.file.size / (1024 * 1024)).toFixed(2);
  const ext = state.file.name.split('.').pop()?.toUpperCase() || 'FILE';
  const isDjvu = state.adapter?.type === 'djvu';
  if (els.importDjvuDataQuick) {
    els.importDjvuDataQuick.classList.toggle('is-hidden', !isDjvu);
  }
  const suffix = isDjvu && state.djvuBinaryDetected ? ' • DjVu binary detected' : '';
  els.docInfo.textContent = `${ext} • ${sizeMb} MB • ${state.pageCount} стр.${suffix}`;
}

export async function buildOutlineItems(items = [], level = 0) {
  if (!_deps.canSearchCurrentDoc()) return [];
  const result = [];

  for (const item of items) {
    let page = null;
    if (item.dest) {
      try {
        page = await state.adapter.resolveDestToPage(item.dest);
      } catch (err) {
        page = null;
      }
    }

    result.push({ title: item.title || '(без названия)', page, level });

    if (item.items?.length) {
      const children = await buildOutlineItems(item.items, level + 1);
      result.push(...children);
    }
  }

  return result;
}

export async function renderOutline() {
  els.outlineList.innerHTML = '';
  state.outline = [];

  if (!_deps.canSearchCurrentDoc()) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.textContent = 'Оглавление доступно для PDF/DjVu';
    els.outlineList.appendChild(li);
    return;
  }

  const raw = await state.adapter.getOutline();
  if (!raw?.length) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.textContent = 'Оглавление отсутствует';
    els.outlineList.appendChild(li);
    return;
  }

  state.outline = await buildOutlineItems(raw, 0);

  state.outline.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.style.paddingLeft = `${8 + entry.level * 10}px`;
    const btn = document.createElement('button');
    btn.textContent = entry.page ? `${entry.title} (стр. ${entry.page})` : `${entry.title} (без ссылки)`;
    btn.disabled = !entry.page;
    btn.addEventListener('click', async () => {
      if (!entry.page) return;
      state.currentPage = entry.page;
      await _deps.renderCurrentPage();
    });
    li.appendChild(btn);
    els.outlineList.appendChild(li);
  });
}

export function updatePreviewSelection() {
  const buttons = els.pagePreviewList.querySelectorAll('button[data-page]');
  buttons.forEach((btn) => {
    const page = Number(btn.dataset.page);
    btn.classList.toggle('active', page === state.currentPage);
  });
}

export function _drawPreviewPlaceholder(canvas, pageNum) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10141b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Стр. ${pageNum}`, 12, 20);
}

export async function _renderDeferredPreviews(from, to) {
  if (!state.adapter) return;
  const buttons = els.pagePreviewList.querySelectorAll('button[data-page]');
  for (const btn of buttons) {
    const page = Number(btn.dataset.page);
    if (page < from || page > to) continue;
    const canvas = btn.querySelector('canvas');
    if (!canvas || canvas.dataset.needsRender !== '1') continue;
    try {
      const viewport = await state.adapter.getPageViewport(page, 1, state.rotation);
      const scale = Math.min(120 / Math.max(1, viewport.width), 160 / Math.max(1, viewport.height));
      await state.adapter.renderPage(page, canvas, { zoom: scale, rotation: state.rotation });
      delete canvas.dataset.needsRender;
    } catch (err) { console.warn('[app] thumbnail placeholder fallback:', err?.message); }
    // Yield between previews to not block the main thread
    await yieldToMainThread();
  }
}

export async function renderPagePreviews() {
  els.pagePreviewList.innerHTML = '';

  if (!state.adapter) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Откройте документ для превью';
    els.pagePreviewList.appendChild(li);
    return;
  }

  const maxPages = state.adapter.type === 'pdf' ? Math.min(state.pageCount, 24) : Math.min(state.pageCount, 4);
  // Render first batch immediately (fast initial paint), defer rest
  const immediateBatch = Math.min(maxPages, 6);

  for (let i = 1; i <= maxPages; i += 1) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const btn = document.createElement('button');
    btn.className = 'preview-btn';
    btn.dataset.page = String(i);

    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 160;

    // Only render first batch synchronously; the rest are placeholders
    // that will be rendered after the main page is displayed
    if (i <= immediateBatch) {
      try {
        const viewport = await state.adapter.getPageViewport(i, 1, state.rotation);
        const scale = Math.min(120 / Math.max(1, viewport.width), 160 / Math.max(1, viewport.height));
        await state.adapter.renderPage(i, canvas, { zoom: scale, rotation: state.rotation });
      } catch (err) {
        _drawPreviewPlaceholder(canvas, i);
      }
    } else {
      _drawPreviewPlaceholder(canvas, i);
      canvas.dataset.needsRender = '1';
    }

    const label = document.createElement('span');
    label.className = 'preview-label';
    label.textContent = `Страница ${i}`;

    btn.appendChild(canvas);
    btn.appendChild(label);
    btn.addEventListener('click', async () => {
      state.currentPage = i;
      await _deps.renderCurrentPage();
    });

    li.appendChild(btn);
    els.pagePreviewList.appendChild(li);
  }

  // Render deferred thumbnails in the background after file open completes
  if (maxPages > immediateBatch) {
    requestAnimationFrame(() => _renderDeferredPreviews(immediateBatch + 1, maxPages));
  }

  if (state.pageCount > maxPages) {
    const li = document.createElement('li');
    li.className = 'recent-item tiny muted';
    li.textContent = `Показаны первые ${maxPages} из ${state.pageCount} страниц`;
    els.pagePreviewList.appendChild(li);
  }

  updatePreviewSelection();
}
