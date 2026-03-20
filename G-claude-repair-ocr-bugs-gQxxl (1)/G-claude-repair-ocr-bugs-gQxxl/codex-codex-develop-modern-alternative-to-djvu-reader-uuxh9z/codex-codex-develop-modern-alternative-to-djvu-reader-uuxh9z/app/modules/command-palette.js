// ─── Command Palette Module ─────────────────────────────────────────────────
// VS Code-style Ctrl+K command palette for NovaReader 4.0

const STORAGE_KEY = 'novareader-recent-commands';
const MAX_VISIBLE = 30;
const MAX_RECENT = 10;
const DEBOUNCE_MS = 50;

/** @type {Array<{id: string, label: string, shortcut?: string, icon?: string, category?: string, action: Function}>} */
const commands = [];

/** @type {{state: object, els: object} | null} */
let _deps = null;

/** @type {number} */
let _selectedIndex = 0;

/** @type {number|null} */
let _debounceTimer = null;

/** @type {boolean} */
let _visible = false;

// ─── Recent Commands ────────────────────────────────────────────────────────

function loadRecent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

function saveRecent(recentIds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentIds.slice(0, MAX_RECENT)));
  } catch (_e) {
    // quota exceeded
  }
}

function pushRecent(commandId) {
  const recent = loadRecent().filter(id => id !== commandId);
  recent.unshift(commandId);
  saveRecent(recent);
}

// ─── Fuzzy Matching ─────────────────────────────────────────────────────────

/**
 * Simple fuzzy scoring: exact > starts with > contains > fuzzy char match.
 * Returns score >= 0 if match, -1 if no match.
 */
function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact match
  if (t === q) return 100;

  // Starts with
  if (t.startsWith(q)) return 80;

  // Contains
  if (t.includes(q)) return 60;

  // Fuzzy character match
  let qi = 0;
  let consecutiveBonus = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      score += 10 + consecutiveBonus;
      consecutiveBonus += 5;
    } else {
      consecutiveBonus = 0;
    }
  }

  if (qi === q.length) {
    return Math.min(score, 59); // Cap below "contains"
  }

  return -1;
}

// ─── Filtering & Searching ──────────────────────────────────────────────────

function getFilteredCommands(input) {
  const raw = input.trim();

  // Empty input: show recent commands
  if (!raw) {
    const recentIds = loadRecent();
    const recentCmds = recentIds
      .map(id => commands.find(c => c.id === id))
      .filter(Boolean);
    const remaining = commands.filter(c => !recentIds.includes(c.id));
    return [...recentCmds, ...remaining].slice(0, MAX_VISIBLE);
  }

  // `:` prefix: go to page by number
  if (raw.startsWith(':')) {
    const pageNum = raw.slice(1).trim();
    if (pageNum) {
      return [{
        id: '_goto_page',
        label: `Перейти к странице ${pageNum}`,
        icon: '#',
        category: 'page',
        action: () => {
          const n = parseInt(pageNum, 10);
          if (_deps && n >= 1) {
            _deps.goToPage(n);
          }
        },
      }];
    }
    return [{
      id: '_goto_page_hint',
      label: 'Введите номер страницы...',
      icon: '#',
      category: 'page',
      action: () => {},
    }];
  }

  // `#` prefix: jump to page number
  if (raw.startsWith('#')) {
    const pageNum = raw.slice(1).trim();
    if (pageNum) {
      return [{
        id: '_jump_page',
        label: `Страница ${pageNum}`,
        icon: '#',
        category: 'page',
        action: () => {
          const n = parseInt(pageNum, 10);
          if (_deps && n >= 1) {
            _deps.goToPage(n);
          }
        },
      }];
    }
    // Show page range hint
    const pageCount = _deps?.state?.pageCount || 0;
    return [{
      id: '_jump_page_hint',
      label: `Введите номер страницы (1-${pageCount || '?'})`,
      icon: '#',
      category: 'page',
      action: () => {},
    }];
  }

  // `>` prefix: search only commands
  const isCommandMode = raw.startsWith('>');
  const query = isCommandMode ? raw.slice(1).trim() : raw;

  if (!query) {
    return commands.slice(0, MAX_VISIBLE);
  }

  // Score and sort
  const scored = commands
    .map(cmd => ({
      cmd,
      score: Math.max(
        fuzzyScore(query, cmd.label),
        fuzzyScore(query, cmd.id)
      ),
    }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(item => item.cmd).slice(0, MAX_VISIBLE);
}

// ─── DOM Rendering ──────────────────────────────────────────────────────────

function getElements() {
  return {
    overlay: document.getElementById('commandPalette'),
    input: document.getElementById('commandPaletteInput'),
    list: document.getElementById('commandPaletteList'),
  };
}

function renderList(filtered) {
  const { list } = getElements();
  if (!list) return;

  list.innerHTML = '';
  filtered.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = 'command-palette-item' + (index === _selectedIndex ? ' selected' : '');
    item.dataset.index = String(index);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'command-palette-icon';
    iconSpan.textContent = cmd.icon || '';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'command-palette-label';
    labelSpan.textContent = cmd.label;

    item.appendChild(iconSpan);
    item.appendChild(labelSpan);

    if (cmd.category) {
      const badge = document.createElement('span');
      badge.className = 'command-palette-badge command-palette-badge--' + cmd.category;
      badge.textContent = cmd.category;
      item.appendChild(badge);
    }

    if (cmd.shortcut) {
      const kbd = document.createElement('kbd');
      kbd.className = 'command-palette-shortcut';
      kbd.textContent = cmd.shortcut;
      item.appendChild(kbd);
    }

    item.addEventListener('click', () => {
      executeCommand(cmd);
    });

    item.addEventListener('mouseenter', () => {
      _selectedIndex = index;
      updateSelection();
    });

    list.appendChild(item);
  });
}

function updateSelection() {
  const { list } = getElements();
  if (!list) return;

  const items = list.querySelectorAll('.command-palette-item');
  items.forEach((el, i) => {
    el.classList.toggle('selected', i === _selectedIndex);
  });

  // Scroll selected into view
  const selected = list.querySelector('.command-palette-item.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}

// ─── Command Execution ──────────────────────────────────────────────────────

function executeCommand(cmd) {
  hideCommandPalette();
  if (cmd.id && !cmd.id.startsWith('_')) {
    pushRecent(cmd.id);
  }
  try {
    cmd.action();
  } catch (err) {
    console.warn('[command-palette] action error:', err?.message);
  }
}

// ─── Input Handling ─────────────────────────────────────────────────────────

function onInput() {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    const { input } = getElements();
    if (!input) return;
    _selectedIndex = 0;
    const filtered = getFilteredCommands(input.value);
    renderList(filtered);
  }, DEBOUNCE_MS);
}

function onKeyDown(e) {
  const { list, input } = getElements();
  if (!list || !input) return;

  const items = list.querySelectorAll('.command-palette-item');
  const count = items.length;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _selectedIndex = (_selectedIndex + 1) % Math.max(1, count);
    updateSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _selectedIndex = (_selectedIndex - 1 + Math.max(1, count)) % Math.max(1, count);
    updateSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (items[_selectedIndex]) {
      const filtered = getFilteredCommands(input.value);
      if (filtered[_selectedIndex]) {
        executeCommand(filtered[_selectedIndex]);
      }
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    hideCommandPalette();
  }
}

// ─── Show / Hide ────────────────────────────────────────────────────────────

export function showCommandPalette() {
  const { overlay, input } = getElements();
  if (!overlay || !input) return;

  _visible = true;
  _selectedIndex = 0;
  overlay.style.display = '';
  overlay.classList.add('open');
  input.value = '';

  const filtered = getFilteredCommands('');
  renderList(filtered);

  // Focus input after frame paint
  requestAnimationFrame(() => {
    input.focus();
  });
}

export function hideCommandPalette() {
  const { overlay, input } = getElements();
  if (!overlay) return;

  _visible = false;
  overlay.classList.remove('open');
  overlay.style.display = 'none';

  if (input) {
    input.value = '';
  }

  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
}

export function isCommandPaletteVisible() {
  return _visible;
}

// ─── Command Registry ───────────────────────────────────────────────────────

export function registerCommand(cmd) {
  // Avoid duplicates
  const existing = commands.findIndex(c => c.id === cmd.id);
  if (existing >= 0) {
    commands[existing] = cmd;
  } else {
    commands.push(cmd);
  }
}

// ─── Default Commands ───────────────────────────────────────────────────────

function buildDefaultCommands(deps) {
  const { state, els } = deps;

  return [
    { id: 'file.open', label: 'Открыть файл', shortcut: 'Ctrl+O', icon: '\uD83D\uDCC2', category: 'file', action: () => els.fileInput?.click() },
    { id: 'page.next', label: 'Следующая страница', shortcut: '\u2192', icon: '\u2192', category: 'nav', action: () => els.nextPage?.click() },
    { id: 'page.prev', label: 'Предыдущая страница', shortcut: '\u2190', icon: '\u2190', category: 'nav', action: () => els.prevPage?.click() },
    { id: 'zoom.in', label: 'Увеличить масштаб', shortcut: 'Ctrl++', icon: '\uD83D\uDD0D', category: 'zoom', action: () => els.zoomIn?.click() },
    { id: 'zoom.out', label: 'Уменьшить масштаб', shortcut: 'Ctrl+-', icon: '\uD83D\uDD0D', category: 'zoom', action: () => els.zoomOut?.click() },
    { id: 'zoom.fit-width', label: 'По ширине страницы', icon: '\u2194', category: 'zoom', action: () => els.fitWidth?.click() },
    { id: 'zoom.fit-page', label: 'Вместить страницу', icon: '\u2B1C', category: 'zoom', action: () => els.fitPage?.click() },
    { id: 'view.rotate', label: 'Повернуть на 90\u00B0', shortcut: 'Ctrl+R', icon: '\uD83D\uDD04', category: 'view', action: () => els.rotate?.click() },
    { id: 'view.fullscreen', label: 'Полный экран', shortcut: 'F11', icon: '\u26F6', category: 'view', action: () => els.fullscreen?.click() },
    { id: 'view.theme', label: 'Сменить тему', icon: '\uD83C\uDFA8', category: 'view', action: () => els.themeToggle?.click() },
    { id: 'edit.find', label: 'Поиск по документу', shortcut: 'Ctrl+F', icon: '\uD83D\uDD0E', category: 'edit', action: () => { if (els.searchInput) els.searchInput.focus(); } },
    { id: 'edit.annotations', label: 'Аннотации', icon: '\u270F\uFE0F', category: 'edit', action: () => els.annotateToggle?.click() },
    { id: 'ocr.run', label: 'Запустить OCR', icon: '\uD83D\uDCDD', category: 'ocr', action: () => els.ocrCurrentPage?.click() },
    { id: 'ocr.batch', label: 'Пакетный OCR', icon: '\uD83D\uDCDD', category: 'ocr', action: () => { const btn = document.getElementById('batchOcrAll'); if (btn) btn.click(); } },
    { id: 'export.docx', label: 'Экспорт в Word', icon: '\uD83D\uDCC4', category: 'export', action: () => els.exportWord?.click() },
    { id: 'export.html', label: 'Экспорт в HTML', icon: '\uD83C\uDF10', category: 'export', action: () => { const btn = document.getElementById('exportHtml'); if (btn) btn.click(); } },
    { id: 'export.png', label: 'Экспорт в PNG', icon: '\uD83D\uDDBC\uFE0F', category: 'export', action: () => els.exportAnnotated?.click() },
    { id: 'export.txt', label: 'Экспорт текста', icon: '\uD83D\uDCC3', category: 'export', action: () => els.exportText?.click() },
    { id: 'tools.merge', label: 'Объединить PDF', icon: '\uD83D\uDCCE', category: 'tools', action: () => els.mergePages?.click() },
    { id: 'tools.split', label: 'Разделить PDF', icon: '\u2702\uFE0F', category: 'tools', action: () => els.splitPages?.click() },
    { id: 'tools.organize', label: 'Организатор страниц', icon: '\uD83D\uDCCB', category: 'tools', action: () => { const btn = document.getElementById('openPageOrganizer'); if (btn) btn.click(); } },
    { id: 'tools.watermark', label: 'Водяной знак', icon: '\uD83D\uDCA7', category: 'tools', action: () => els.addWatermark?.click() },
    { id: 'tools.redact', label: 'Редакция данных', icon: '\uD83D\uDD12', category: 'tools', action: () => { const btn = document.getElementById('pdfRedact'); if (btn) btn.click(); } },
    { id: 'tools.compare', label: 'Сравнить документы', icon: '\u2696\uFE0F', category: 'tools', action: () => { const btn = document.getElementById('pdfCompare'); if (btn) btn.click(); } },
    { id: 'tools.searchable-pdf', label: 'Создать PDF с текстом', icon: '\uD83D\uDCD1', category: 'tools', action: () => { const btn = document.getElementById('createSearchablePdf'); if (btn) btn.click(); } },
    { id: 'print', label: 'Печать', shortcut: 'Ctrl+P', icon: '\uD83D\uDDA8\uFE0F', category: 'file', action: () => els.printPage?.click() },
    { id: 'settings', label: 'Настройки', icon: '\u2699\uFE0F', category: 'app', action: () => els.openSettingsModal?.click() },
    { id: 'page.first', label: 'Первая страница', shortcut: 'Home', icon: '\u23EE', category: 'nav', action: () => { if (deps.goToPage) deps.goToPage(1); } },
    { id: 'page.last', label: 'Последняя страница', shortcut: 'End', icon: '\u23ED', category: 'nav', action: () => { if (deps.goToPage && state.pageCount) deps.goToPage(state.pageCount); } },
    { id: 'view.sidebar', label: 'Показать/скрыть панель', icon: '\u2630', category: 'view', action: () => els.toggleSidebar?.click() },
    { id: 'file.download', label: 'Скачать файл', icon: '\u2B07', category: 'file', action: () => els.downloadFile?.click() },
  ];
}

// ─── Initialization ─────────────────────────────────────────────────────────

/**
 * Initialize the command palette with app dependencies.
 * @param {object} deps - { state, els, goToPage }
 */
export function initCommandPalette(deps) {
  _deps = deps;

  // Register default commands
  const defaults = buildDefaultCommands(deps);
  for (const cmd of defaults) {
    registerCommand(cmd);
  }

  // Bind events
  const { overlay, input } = getElements();

  if (input) {
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);
  }

  // Close on backdrop click
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        hideCommandPalette();
      }
    });
  }

  // Global Ctrl+K / Cmd+K shortcut
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform?.toUpperCase().includes('MAC');
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (_visible) {
        hideCommandPalette();
      } else {
        showCommandPalette();
      }
    }
  });
}
