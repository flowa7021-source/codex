// ─── Context Menu System ────────────────────────────────────────────────────
// Custom right-click context menus for the viewer, annotations, and thumbnails.

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
    if (!e.target.closest('.app-shell')) return;

    // Allow default context menu on text inputs
    if (e.target.matches('input, textarea, [contenteditable]')) return;

    e.preventDefault();

    const target = e.target;
    const items = buildContextItems(target);
    if (items.length === 0) return;
    showContextMenu(e.clientX, e.clientY, items);
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

  // Thumbnail panel
  if (target.closest('.page-preview-list')) {
    items.push({ label: 'Перейти к странице', action: () => { /* handled by click */ } });
    items.push({ label: 'Повернуть страницу', action: () => { document.getElementById('rotate')?.click(); } });
    return items;
  }

  return items;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
