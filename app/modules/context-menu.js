// @ts-check
// ─── Context Menu System ────────────────────────────────────────────────────
// Custom right-click context menus for the viewer, annotations, and thumbnails.

import { state } from './state.js';
import { getSelectedPages, selectedPages } from './thumbnail-renderer.js';
import { addWord } from './ocr-user-dictionary.js';

let menuEl = null;

function ensureMenu() {
  if (menuEl && document.body.contains(menuEl)) return menuEl;
  menuEl = document.createElement('div');
  menuEl.className = 'ctx-menu';
  menuEl.setAttribute('role', 'menu');
  menuEl.tabIndex = -1;
  document.body.appendChild(menuEl);
  return menuEl;
}

function closeMenu() {
  if (!menuEl) return;
  menuEl.classList.remove('ctx-menu-open');
  menuEl.innerHTML = '';
}

/**
 * @typedef {object} ContextMenuItem
 * @property {string} label - Display text
 * @property {string} [icon] - SVG HTML string
 * @property {string} [shortcut] - Keyboard shortcut hint (e.g. "Ctrl+C")
 * @property {boolean} [disabled] - Grey out the item
 * @property {boolean} [separator] - Render a separator line instead
 * @property {Function} [action] - Click handler
 */

/**
 * Show a context menu at the specified position.
 * @param {number} x - clientX
 * @param {number} y - clientY
 * @param {ContextMenuItem[]} items
 */
export function showContextMenu(x, y, items) {
  const el = ensureMenu();
  el.innerHTML = '';

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'ctx-sep';
      sep.setAttribute('role', 'separator');
      el.appendChild(sep);
      continue;
    }

    const btn = document.createElement('button');
    btn.className = 'ctx-item';
    btn.setAttribute('role', 'menuitem');
    if (item.disabled) {
      btn.disabled = true;
      btn.classList.add('ctx-disabled');
    }

    let html = '';
    if (item.icon) html += `<span class="ctx-icon">${item.icon}</span>`;
    html += `<span class="ctx-label">${escapeHtml(item.label)}</span>`;
    if (item.shortcut) html += `<kbd class="ctx-kbd">${escapeHtml(item.shortcut)}</kbd>`;
    btn.innerHTML = html;

    btn.addEventListener('click', () => {
      closeMenu();
      if (item.action) item.action();
    });

    el.appendChild(btn);
  }

  // Position
  el.classList.add('ctx-menu-open');
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = x;
  let top = y;
  if (left + rect.width > vw - 4) left = vw - rect.width - 4;
  if (top + rect.height > vh - 4) top = vh - rect.height - 4;
  if (left < 4) left = 4;
  if (top < 4) top = 4;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;

  // Focus for keyboard nav
  el.focus();
}

function onKeyDown(e) {
  if (!menuEl || !menuEl.classList.contains('ctx-menu-open')) return;
  if (e.key === 'Escape') { closeMenu(); e.preventDefault(); return; }

  const items = [...menuEl.querySelectorAll('.ctx-item:not(:disabled)')];
  const focused = menuEl.querySelector('.ctx-item:focus');
  let idx = items.indexOf(focused);

  if (e.key === 'ArrowDown') {
    idx = idx < items.length - 1 ? idx + 1 : 0;
    items[idx]?.focus();
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    idx = idx > 0 ? idx - 1 : items.length - 1;
    items[idx]?.focus();
    e.preventDefault();
  } else if (e.key === 'Enter' || e.key === ' ') {
    focused?.click();
    e.preventDefault();
  }
}

export function initContextMenu() {
  document.addEventListener('contextmenu', (e) => {
    // Only intercept within app-shell
    if (!/** @type {any} */ (e.target).closest('.app-shell')) return;

    // Allow default context menu on text inputs
    if (/** @type {any} */ (e.target).matches('input, textarea, [contenteditable]')) return;

    e.preventDefault();

    const target = e.target;
    const items = buildContextItems(target);
    if (items.length === 0) return;
    showContextMenu(e.clientX, e.clientY, /** @type {any} */ (items));
  });

  document.addEventListener('click', (e) => {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('scroll', closeMenu, true);
}

/** Build context items based on what was right-clicked */
function buildContextItems(target) {
  const items = [];

  // OCR text layer — right-click on a word span to correct it
  const textLayerSpan = target.closest('#textLayerDiv > span');
  if (textLayerSpan && textLayerSpan.textContent.trim()) {
    const originalWord = textLayerSpan.textContent.trim();
    items.push({
      label: `Исправить «${originalWord.length > 20 ? originalWord.slice(0, 20) + '…' : originalWord}»`,
      action: () => {
        const corrected = prompt(
          `Введите правильное написание для «${originalWord}»:`,
          originalWord
        );
        if (corrected != null && corrected.trim() && corrected.trim() !== originalWord) {
          addWord(originalWord, corrected.trim());
          // Update the span in-place for immediate visual feedback
          textLayerSpan.textContent = corrected.trim();
        }
      },
    });
    items.push({ separator: true });
  }

  // Viewer canvas area
  if (target.closest('#canvasStack, .document-viewport')) {
    items.push({ label: 'Копировать текст', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') });
    items.push({ label: 'Выделить всё', shortcut: 'Ctrl+A', action: () => document.execCommand('selectAll') });
    items.push({ separator: true });
    items.push({ label: 'OCR этой области', action: () => { document.getElementById('ocrRegionMode')?.click(); } });
    items.push({ separator: true });
    items.push({ label: 'Увеличить', shortcut: 'Ctrl++', action: () => { document.getElementById('zoomIn')?.click(); } });
    items.push({ label: 'Уменьшить', shortcut: 'Ctrl+−', action: () => { document.getElementById('zoomOut')?.click(); } });
    items.push({ label: 'По ширине', shortcut: 'Ctrl+9', action: () => { document.getElementById('fitWidth')?.click(); } });
    items.push({ label: 'По странице', shortcut: 'Ctrl+0', action: () => { document.getElementById('fitPage')?.click(); } });
    return items;
  }

  // Annotation area
  if (target.closest('.annotation-canvas')) {
    items.push({ label: 'Отменить штрих', shortcut: 'Ctrl+Z', action: () => { document.getElementById('undoStroke')?.click(); } });
    items.push({ label: 'Очистить все', action: () => { document.getElementById('clearStrokes')?.click(); } });
    items.push({ separator: true });
    items.push({ label: 'Экспорт аннотаций', action: () => { document.getElementById('exportAnnJson')?.click(); } });
    return items;
  }

  // Thumbnail panel (page previews)
  const thumbWrapper = target.closest('.thumb-wrapper, .page-preview-list, #pagePreviewList');
  if (thumbWrapper) {
    // Determine which page was right-clicked
    const pageEl = target.closest('[data-page]');
    const pageNum = pageEl ? parseInt(pageEl.dataset.page, 10) : null;

    if (pageNum && pageNum >= 1) {
      // If right-clicked page isn't in selection, select it alone
      if (!selectedPages.has(pageNum)) {
        selectedPages.clear();
        selectedPages.add(pageNum);
      }
      const sel = getSelectedPages();
      const label = sel.length > 1 ? `${sel.length} страниц выделено` : `Страница ${pageNum}`;
      items.push({ label, action: () => {}, shortcut: '', icon: '📄' });
      items.push({ separator: true });

      // 0-based indices for pdf-lib operations
      const indices = sel.map(p => p - 1);

      items.push({
        label: `Повернуть по часовой ↻ (${sel.length})`,
        icon: '↻',
        action: async () => {
          try {
            const { rotatePages } = await import('./page-organizer.js');
            if (!state.pdfBytes) return;
            state.pdfBytes = /** @type {any} */ (await rotatePages(state.pdfBytes, indices, 90));
            const file = new File([state.pdfBytes], state.docName || 'doc.pdf', { type: 'application/pdf' });
            document.dispatchEvent(new CustomEvent('novareader-reopen-file', { detail: { file } }));
          } catch (err) { console.warn('[ctx-menu] rotate error:', err?.message); }
        },
      });

      items.push({
        label: `Повернуть против часовой ↺ (${sel.length})`,
        icon: '↺',
        action: async () => {
          try {
            const { rotatePages } = await import('./page-organizer.js');
            if (!state.pdfBytes) return;
            state.pdfBytes = /** @type {any} */ (await rotatePages(state.pdfBytes, indices, 270));
            const file = new File([state.pdfBytes], state.docName || 'doc.pdf', { type: 'application/pdf' });
            document.dispatchEvent(new CustomEvent('novareader-reopen-file', { detail: { file } }));
          } catch (err) { console.warn('[ctx-menu] rotate error:', err?.message); }
        },
      });

      items.push({
        label: sel.length > 1 ? `OCR ${sel.length} страниц` : 'OCR этой страницы',
        icon: '🔍',
        action: () => {
          state.currentPage = sel[0];
          document.getElementById('ocrCurrentPage')?.click();
        },
      });

      items.push({ separator: true });

      items.push({
        label: sel.length > 1 ? `Удалить ${sel.length} страниц` : 'Удалить страницу',
        icon: '🗑️',
        action: async () => {
          if (!state.pdfBytes || state.pageCount <= sel.length) return;
          const msg = sel.length > 1 ? `Удалить ${sel.length} страниц?` : `Удалить страницу ${pageNum}?`;
          if (!confirm(msg)) return;
          try {
            const { deletePages } = await import('./page-organizer.js');
            state.pdfBytes = /** @type {any} */ (await deletePages(state.pdfBytes, indices));
            selectedPages.clear();
            const file = new File([state.pdfBytes], state.docName || 'doc.pdf', { type: 'application/pdf' });
            document.dispatchEvent(new CustomEvent('novareader-reopen-file', { detail: { file } }));
          } catch (err) { console.warn('[ctx-menu] delete error:', err?.message); }
        },
      });
    }

    return items;
  }

  return items;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
