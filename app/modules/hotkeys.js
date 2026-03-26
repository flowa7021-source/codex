// @ts-check
// ─── Extended Hotkeys ───────────────────────────────────────────────────────
// Professional keyboard shortcuts with Space+drag hand tool, single-key tools.

/**
 * @typedef {object} HotkeyBinding
 * @property {string} key - Key or key combo (e.g. 'ctrl+f', 'h', 'ctrl+shift+p')
 * @property {string} action - Action identifier
 * @property {string} description - Human-readable description
 * @property {boolean} [global=false] - Works even when input is focused
 */

const DEFAULT_BINDINGS = [
  // Navigation
  { key: 'ctrl+g', action: 'goToPage', description: 'Перейти к странице' },
  { key: 'home', action: 'firstPage', description: 'Первая страница' },
  { key: 'end', action: 'lastPage', description: 'Последняя страница' },
  { key: 'pageup', action: 'prevPage', description: 'Предыдущая страница' },
  { key: 'pagedown', action: 'nextPage', description: 'Следующая страница' },

  // Zoom
  { key: 'ctrl+=', action: 'zoomIn', description: 'Увеличить' },
  { key: 'ctrl+-', action: 'zoomOut', description: 'Уменьшить' },
  { key: 'ctrl+0', action: 'zoomReset', description: 'Масштаб 100%' },
  { key: 'ctrl+1', action: 'fitPage', description: 'По размеру страницы' },
  { key: 'ctrl+2', action: 'fitWidth', description: 'По ширине' },

  // Search
  { key: 'ctrl+f', action: 'search', description: 'Поиск', global: true },
  { key: 'f3', action: 'searchNext', description: 'Следующий результат' },
  { key: 'shift+f3', action: 'searchPrev', description: 'Предыдущий результат' },

  // Document operations
  { key: 'ctrl+d', action: 'docProperties', description: 'Свойства документа' },
  { key: 'ctrl+shift+p', action: 'pageOrganizer', description: 'Организация страниц' },
  { key: 'ctrl+shift+r', action: 'redactionMode', description: 'Режим редактирования' },
  { key: 'ctrl+e', action: 'export', description: 'Экспорт' },
  { key: 'ctrl+shift+s', action: 'saveAs', description: 'Сохранить как' },
  { key: 'ctrl+p', action: 'print', description: 'Печать', global: true },
  { key: 'ctrl+shift+a', action: 'accessibilityCheck', description: 'Проверка доступности' },

  // Tools (single-key when not in input)
  { key: 'h', action: 'handTool', description: 'Инструмент «рука»' },
  { key: 'v', action: 'selectTool', description: 'Инструмент «выделение»' },
  { key: 't', action: 'textTool', description: 'Текстовый инструмент' },
  { key: 's', action: 'stickyNote', description: 'Заметка' },
  { key: 'l', action: 'lineTool', description: 'Линия' },
  { key: 'r', action: 'rectangleTool', description: 'Прямоугольник' },
  { key: 'o', action: 'ovalTool', description: 'Овал' },

  // Export & Batch
  { key: 'ctrl+shift+x', action: 'exportXlsx', description: 'Экспорт в Excel' },
  { key: 'ctrl+shift+b', action: 'batchConvert', description: 'Пакетная конвертация' },

  // View
  { key: 'f11', action: 'fullscreen', description: 'Полный экран', global: true },
  { key: 'escape', action: 'exitMode', description: 'Выход из режима', global: true },
];

/** @type {Map<string, Function>} */
const actionHandlers = new Map();
/** @type {HotkeyBinding[]} */
let bindings = [...DEFAULT_BINDINGS];
let spaceDown = false;
let initialized = false;

/**
 * Initialize the extended hotkey system.
 * @param {object} [options]
 * @param {HotkeyBinding[]} [options.customBindings] - Override or extend bindings
 */
export function initHotkeys(options = {}) {
  if (initialized) return;
  initialized = true;

  if (options.customBindings) {
    bindings = [...DEFAULT_BINDINGS, ...options.customBindings];
  }

  document.addEventListener('keydown', handleKeyDown, { capture: true });
  document.addEventListener('keyup', handleKeyUp);

  // Space+drag for hand tool
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isInputFocused()) {
      spaceDown = true;
      document.body.classList.add('hand-tool-active');
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceDown = false;
      document.body.classList.remove('hand-tool-active');
    }
  });
}

/**
 * Register a handler for an action.
 * @param {string} action
 * @param {Function} handler
 */
export function onHotkey(action, handler) {
  actionHandlers.set(action, handler);
}

/**
 * Register multiple handlers at once.
 * @param {Object<string, Function>} handlers
 */
export function registerHotkeyHandlers(handlers) {
  for (const [action, fn] of Object.entries(handlers)) {
    actionHandlers.set(action, fn);
  }
}

/**
 * Check if Space is currently held (for hand tool).
 */
export function isSpaceHeld() {
  return spaceDown;
}

/**
 * Get all current bindings.
 * @returns {HotkeyBinding[]}
 */
export function getBindings() {
  return [...bindings];
}

/**
 * Update a binding.
 * @param {string} action
 * @param {string} newKey
 */
export function rebindKey(action, newKey) {
  const binding = bindings.find(b => b.action === action);
  if (binding) {
    binding.key = newKey;
  }
}

/**
 * Show hotkey cheatsheet.
 * @returns {string} Formatted hotkey list
 */
export function getCheatsheet() {
  return bindings
    .map(b => `${b.key.padEnd(20)} ${b.description}`)
    .join('\n');
}

// ─── Internal ───────────────────────────────────────────────────────────────

function handleKeyDown(e) {
  const combo = buildCombo(e);
  if (!combo) return;

  const binding = bindings.find(b => normalizeKey(b.key) === combo);
  if (!binding) return;

  // Skip single-key shortcuts if in input, unless global
  if (!binding.global && isInputFocused() && !combo.includes('ctrl') && !combo.includes('alt')) {
    return;
  }

  const handler = actionHandlers.get(binding.action);
  if (handler) {
    e.preventDefault();
    e.stopPropagation();
    handler(e);
  }
}

function handleKeyUp() {
  // Future: could track modifier states
}

function buildCombo(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');

  let key = e.key.toLowerCase();
  // Normalize special keys
  if (key === ' ') key = 'space';
  if (key === '+') key = '='; // Ctrl+=
  if (key === 'escape') key = 'escape';

  // Don't add modifier keys themselves
  if (['control', 'alt', 'shift', 'meta'].includes(key)) return null;

  parts.push(key);
  return parts.join('+');
}

function normalizeKey(keyStr) {
  return keyStr.toLowerCase().replace(/\s/g, '').split('+').sort((a, b) => {
    const order = { ctrl: 0, alt: 1, shift: 2 };
    const oa = order[a] ?? 3;
    const ob = order[b] ?? 3;
    return oa !== ob ? oa - ob : a.localeCompare(b);
  }).join('+');
}

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || /** @type {any} */ (el).isContentEditable;
}
