// @ts-check
// ─── Layout Controller ────────────────────────────────────────────────────────
// UI layout persistence, resizable panels, drag-and-drop, and annotation event setup.
// Extracted from app.js as part of module decomposition.

import { state, els } from './state.js';
import { throttle, debounce } from './utils.js';
import { safeTimeout } from './safe-timers.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
const _deps = {
  openFile: async () => {},
  beginStroke: () => {},
  moveStroke: () => {},
  endStroke: () => {},
  getCanvasPointFromEvent: () => ({ x: 0, y: 0 }),
  loadComments: () => [],
  denormalizePoint: () => ({ x: 0, y: 0 }),
  _applyTextMarkupFromSelection: () => {},
};

export function initLayoutControllerDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── UI Layout Key ──────────────────────────────────────────────────────────

export function uiLayoutKey(name) {
  return `novareader-ui-layout:${name}`;
}

// ─── Advanced Panels ────────────────────────────────────────────────────────

export function applyAdvancedPanelsState() {
  const hidden = localStorage.getItem(uiLayoutKey('advancedHidden')) !== '0';
  document.body.classList.toggle('advanced-hidden', hidden);
  if (els.toggleAdvancedPanels) {
    els.toggleAdvancedPanels.textContent = `Расширенные: ${hidden ? 'off' : 'on'}`;
  }
}

export function toggleAdvancedPanelsState() {
  const key = uiLayoutKey('advancedHidden');
  const hidden = localStorage.getItem(key) !== '0';
  localStorage.setItem(key, hidden ? '0' : '1');
  applyAdvancedPanelsState();
}

// ─── Layout State ───────────────────────────────────────────────────────────

export function applyLayoutState() {
  const sidebarRaw = localStorage.getItem(uiLayoutKey('sidebarHidden'));
  const toolsRaw = localStorage.getItem(uiLayoutKey('toolsHidden'));
  const textRaw = localStorage.getItem(uiLayoutKey('textHidden'));
  const searchToolsRaw = localStorage.getItem(uiLayoutKey('searchToolsHidden'));
  const annotToolsRaw = localStorage.getItem(uiLayoutKey('annotToolsHidden'));

  const sidebarHidden = sidebarRaw === '1';
  const toolsHidden = toolsRaw === '1';
  const textHidden = textRaw === null ? false : textRaw === '1';
  const searchToolsHidden = searchToolsRaw === null ? false : searchToolsRaw === '1';
  const annotToolsHidden = annotToolsRaw === null ? false : annotToolsRaw === '1';

  document.querySelector('.app-shell')?.classList.toggle('sidebar-hidden', sidebarHidden);
  document.querySelector('.viewer-area')?.classList.toggle('toolsbar-hidden', toolsHidden);
  document.querySelector('.viewer-area')?.classList.toggle('texttools-hidden', textHidden);
  document.querySelector('.viewer-area')?.classList.toggle('searchtools-hidden', searchToolsHidden);
  document.querySelector('.viewer-area')?.classList.toggle('annottools-hidden', annotToolsHidden);

  if (els.toggleSidebar) els.toggleSidebar.classList.toggle('active', !sidebarHidden);
  if (els.toggleToolsBar) els.toggleToolsBar.classList.toggle('active', !toolsHidden);
  if (els.toggleTextTools) els.toggleTextTools.classList.toggle('active', !textHidden);
  if (els.toggleSearchTools) els.toggleSearchTools.classList.toggle('active', !searchToolsHidden);
  if (els.toggleAnnotTools) els.toggleAnnotTools.classList.toggle('active', !annotToolsHidden);
  if (els.toggleTextToolsInline) els.toggleTextToolsInline.textContent = textHidden ? '▸' : '▾';
  updateSearchToolbarRows();
}

export function updateSearchToolbarRows() {
  if (!els.searchToolsGroup) return;
  const apply = () => {
    const controls = [els.searchInput, els.searchScope, els.searchBtn, els.searchPrev, els.searchNext]
      .filter(Boolean)
      .filter((el) => el.offsetParent !== null);
    if (!controls.length) {
      document.documentElement.style.setProperty('--search-toolbar-rows', '1');
      return;
    }

    const tops = new Set();
    controls.forEach((el) => tops.add(Math.round(el.getBoundingClientRect().top)));
    const rows = Math.max(1, tops.size);
    document.documentElement.style.setProperty('--search-toolbar-rows', String(rows));

    const sample = controls[0];
    const rowHeight = Math.max(18, Math.round(sample.getBoundingClientRect().height) + 4);
    document.documentElement.style.setProperty('--search-toolbar-row-height', `${rowHeight}px`);
  };

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      apply();
      safeTimeout(apply, 80);
      safeTimeout(apply, 220);
    });
    return;
  }

  apply();
}

export function toggleLayoutState(name) {
  const key = uiLayoutKey(name);
  const next = localStorage.getItem(key) === '1' ? '0' : '1';
  localStorage.setItem(key, next);
  applyLayoutState();
}

// ─── Resizable Layout ───────────────────────────────────────────────────────

export function applyResizableLayoutState() {
  const sidebarWidth = Number(localStorage.getItem(uiLayoutKey('sidebarWidth')) || 220);
  const pageAreaPx = Number(localStorage.getItem(uiLayoutKey('pageAreaPx')) || 0);
  const safeSidebar = Math.max(180, Math.min(360, sidebarWidth));
  const safePage = Math.max(520, Math.min(3200, pageAreaPx || 0));
  /** @type {any} */ (document.querySelector('.app-shell'))?.style.setProperty('--sidebar-width', `${safeSidebar}px`);
  if (pageAreaPx > 0) {
    /** @type {any} */ (document.querySelector('.viewer-area'))?.style.setProperty('--page-area-height', `${safePage}px`);
  }
}

export function ensureDefaultPageAreaHeight() {
  const raw = Number(localStorage.getItem(uiLayoutKey('pageAreaPx')) || 0);
  const viewerArea = document.querySelector('.viewer-area');
  if (!viewerArea) return;

  const preferred = Math.max(860, Math.floor(viewerArea.clientHeight * 0.92));
  if (raw <= 0 || raw < 520) {
    localStorage.setItem(uiLayoutKey('pageAreaPx'), String(preferred));
  }

  const rawSidebar = Number(localStorage.getItem(uiLayoutKey('sidebarWidth')) || 0);
  if (rawSidebar <= 0 || rawSidebar > 360) {
    localStorage.setItem(uiLayoutKey('sidebarWidth'), '220');
  }

  applyResizableLayoutState();
}

let _resizeAbort = null;

/** Create or reuse a tooltip element for showing pixel values during drag resize. */
function getOrCreateResizeTooltip() {
  let tip = document.getElementById('resizeTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'resizeTooltip';
    tip.className = 'resize-tooltip';
    document.body.appendChild(tip);
  }
  return tip;
}

function showResizeTooltip(text, x, y) {
  const tip = getOrCreateResizeTooltip();
  tip.textContent = text;
  tip.style.left = `${x + 12}px`;
  tip.style.top = `${y - 24}px`;
  tip.classList.add('visible');
}

function hideResizeTooltip() {
  const tip = document.getElementById('resizeTooltip');
  if (tip) tip.classList.remove('visible');
}

export function setupResizableLayout() {
  // Clean up previous listeners to prevent accumulation on re-init
  if (_resizeAbort) { _resizeAbort.abort(); }
  _resizeAbort = new AbortController();
  const signal = _resizeAbort.signal;

  applyResizableLayoutState();
  ensureDefaultPageAreaHeight();

  const debouncedSaveSidebar = debounce((val) => localStorage.setItem(uiLayoutKey('sidebarWidth'), val), 300);
  const debouncedSavePage = debounce((val) => localStorage.setItem(uiLayoutKey('pageAreaPx'), val), 300);

  if (els.sidebarResizeHandle) {
    let active = false;
    const appShell = document.querySelector('.app-shell');
    const onMove = throttle((e) => {
      if (!active || !appShell) return;
      const shellRect = appShell.getBoundingClientRect();
      const raw = e.clientX - shellRect.left;
      const safe = Math.max(180, Math.min(360, raw));
      const rounded = Math.round(safe);
      const val = String(rounded);
      debouncedSaveSidebar(val);
      /** @type {any} */ (appShell).style.setProperty('--sidebar-width', `${rounded}px`);
      showResizeTooltip(`${rounded}px`, e.clientX, e.clientY);
    }, 32);
    els.sidebarResizeHandle.addEventListener('pointerdown', (e) => {
      active = true;
      els.sidebarResizeHandle.setPointerCapture?.(e.pointerId);
      els.sidebarResizeHandle.classList.add('active');
    }, { signal });
    window.addEventListener('pointermove', onMove, { signal });
    window.addEventListener('pointerup', () => {
      if (active) {
        active = false;
        els.sidebarResizeHandle.classList.remove('active');
        hideResizeTooltip();
        // Sync persisted value to settings state
        const cur = parseInt(/** @type {any} */ (appShell)?.style.getPropertyValue('--sidebar-width'), 10);
        if (cur && state.settings) {
          state.settings.uiSidebarWidth = Math.max(160, Math.min(360, cur));
        }
      }
    }, { signal });
  }

  if (els.canvasResizeHandle) {
    let active = false;
    const viewerArea = document.querySelector('.viewer-area');
    const textTools = document.getElementById('textToolsSection');
    const onMove = throttle((e) => {
      if (!active || !viewerArea || !els.canvasWrap) return;
      const viewerRect = viewerArea.getBoundingClientRect();
      const canvasRect = els.canvasWrap.getBoundingClientRect();
      const textHidden = viewerArea.classList.contains('texttools-hidden');
      const minTextHeight = textTools && !textHidden ? Math.max(24, Number(state.settings?.uiTextMinHeight) || 40) : 0;
      const maxPageHeight = Math.max(420, viewerRect.height - minTextHeight - 14);
      const rawPageHeight = e.clientY - canvasRect.top;
      const safePageHeight = Math.max(420, Math.min(maxPageHeight, rawPageHeight));
      const rounded = Math.round(safePageHeight);
      const val = String(rounded);
      debouncedSavePage(val);
      /** @type {any} */ (viewerArea).style.setProperty('--page-area-height', `${rounded}px`);
      showResizeTooltip(`${rounded}px`, e.clientX, e.clientY);
    }, 32);
    els.canvasResizeHandle.addEventListener('pointerdown', (e) => {
      active = true;
      els.canvasResizeHandle.setPointerCapture?.(e.pointerId);
      els.canvasResizeHandle.classList.add('active');
    }, { signal });
    window.addEventListener('pointermove', onMove, { signal });
    window.addEventListener('pointerup', () => {
      if (active) {
        active = false;
        els.canvasResizeHandle.classList.remove('active');
        hideResizeTooltip();
        // Sync persisted value to settings state
        const cur = parseInt(/** @type {any} */ (viewerArea)?.style.getPropertyValue('--page-area-height'), 10);
        if (cur && state.settings) {
          state.settings.uiPageAreaPx = Math.max(520, Math.min(2600, cur));
        }
      }
    }, { signal });
  }
}

/**
 * Temporarily add smooth transition class then remove it after transition completes.
 */
export function applyLayoutWithTransition() {
  const appShell = document.querySelector('.app-shell');
  const viewerArea = document.querySelector('.viewer-area');
  if (appShell) appShell.classList.add('layout-transitioning');
  if (viewerArea) viewerArea.classList.add('layout-transitioning');
  safeTimeout(() => {
    if (appShell) appShell.classList.remove('layout-transitioning');
    if (viewerArea) viewerArea.classList.remove('layout-transitioning');
  }, 350);
}

// ─── Drag and Drop ──────────────────────────────────────────────────────────

let _dndAbort = null;

export function setupDragAndDrop() {
  if (_dndAbort) { _dndAbort.abort(); }
  _dndAbort = new AbortController();
  const signal = _dndAbort.signal;

  ['dragenter', 'dragover'].forEach((evt) => {
    window.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { signal });
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) await /** @type {any} */ (_deps).openFile(file);
  }, { signal });
}

// ─── Annotation Events Setup ────────────────────────────────────────────────

let _annotAbort = null;

export function setupAnnotationEvents() {
  const target = els.annotationCanvas;
  if (!target) return;
  if (_annotAbort) _annotAbort.abort();
  _annotAbort = new AbortController();
  const signal = _annotAbort.signal;
  target.addEventListener('pointerdown', _deps.beginStroke, { signal });
  target.addEventListener('pointermove', _deps.moveStroke, { signal });
  target.addEventListener('pointerup', _deps.endStroke, { signal });
  target.addEventListener('pointerleave', _deps.endStroke, { signal });
  target.addEventListener('dblclick', (e) => {
    const p = /** @type {any} */ (_deps).getCanvasPointFromEvent(e);
    const comments = /** @type {any} */ (_deps).loadComments();
    for (let i = 0; i < comments.length; i += 1) {
      const c = /** @type {any} */ (_deps).denormalizePoint(comments[i].point);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d <= 14) {
        const overlay = document.createElement('div');
        overlay.className = 'modal open';
        const card = document.createElement('div');
        card.className = 'modal-card';
        card.style.width = 'min(400px,80vw)';
        const head = document.createElement('div');
        head.className = 'modal-head';
        const h3 = document.createElement('h3');
        h3.textContent = 'Комментарий';
        const closeBtn = document.createElement('button');
        closeBtn.id = 'closeCommentPopup';
        closeBtn.textContent = '✕';
        head.appendChild(h3);
        head.appendChild(closeBtn);
        const body = document.createElement('div');
        body.className = 'modal-body';
        const p = document.createElement('p');
        p.style.cssText = 'margin:0;white-space:pre-wrap';
        p.textContent = comments[i].text;
        body.appendChild(p);
        card.appendChild(head);
        card.appendChild(body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('#closeCommentPopup').addEventListener('click', close);
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
        break;
      }
    }
  }, { signal });

  // Text layer context menu for quick markup on text selection
  if (els.textLayerDiv) {
    els.textLayerDiv.addEventListener('mouseup', () => {
      // Remove existing popup
      document.querySelector('.text-markup-popup')?.remove();

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      if (!els.textLayerDiv.contains(sel.anchorNode)) return;

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width < 3) return;

      const popup = document.createElement('div');
      popup.className = 'text-markup-popup';
      popup.style.cssText = `
        position: fixed; left: ${rect.left}px; top: ${rect.top - 36}px;
        z-index: 10000; display: flex; gap: 2px; background: var(--bg-card, #1e1e2e);
        border: 1px solid var(--border, #444); border-radius: 6px; padding: 3px 5px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      `;
      const tools = [
        { tool: 'text-highlight', icon: '🖍', title: 'Выделить' },
        { tool: 'text-underline', icon: '⎁', title: 'Подчеркнуть' },
        { tool: 'text-strikethrough', icon: '⊟', title: 'Зачеркнуть' },
        { tool: 'text-squiggly', icon: '〰', title: 'Волнистая' },
      ];
      for (const t of tools) {
        const btn = document.createElement('button');
        btn.textContent = t.icon;
        btn.title = t.title;
        btn.style.cssText = 'border:none; background:transparent; cursor:pointer; font-size:16px; padding:3px 6px; border-radius:4px; color: var(--text,#eee);';
        btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--hover, #333)'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
        btn.addEventListener('click', () => {
          /** @type {any} */ (_deps)._applyTextMarkupFromSelection(window.getSelection(), t.tool);
          window.getSelection()?.removeAllRanges();
          popup.remove();
        });
        popup.appendChild(btn);
      }
      document.body.appendChild(popup);

      // Auto-remove on click outside
      const removePopup = (ev) => {
        if (!popup.contains(ev.target)) {
          popup.remove();
          document.removeEventListener('mousedown', removePopup);
        }
      };
      safeTimeout(() => document.addEventListener('mousedown', removePopup), 50);
    }, { signal });
  }
}
