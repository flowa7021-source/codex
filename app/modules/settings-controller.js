// ─── Settings Controller ────────────────────────────────────────────────────
// App settings, hotkeys, notes, bookmarks, and theme toggling.
// Extracted from app.js as part of module decomposition.

import { SIDEBAR_SECTION_CONFIG, TOOLBAR_SECTION_CONFIG, OCR_MIN_DPI, CSS_BASE_DPI } from './constants.js';
import { state, defaultHotkeys, hotkeys, setHotkeys, els } from './state.js';
import { toastError } from './toast.js';
import { nrPrompt } from './modal-prompt.js';
import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

// ─── App Settings ───────────────────────────────────────────────────────────

export function appSettingsKey() {
  return 'novareader-settings';
}

export function defaultSettings() {
  return {
    appLang: 'ru',
    ocrLang: 'auto',
    ocrMinW: 24,
    ocrMinH: 24,
    backgroundOcr: false,
    ocrCyrillicOnly: true,
    ocrQualityMode: 'balanced',
    uiSidebarWidth: 220,
    uiToolbarScale: 1,
    uiTextMinHeight: 40,
    uiPageAreaPx: 860,
    uiToolbarTopPx: 38,
    uiToolbarBottomPx: 86,
    uiTextPanelPx: 120,
    uiAnnotationCanvasScale: 90,
    sidebarSections: Object.fromEntries(SIDEBAR_SECTION_CONFIG.map((x) => [x.key, true])),
    toolbarSections: Object.fromEntries(TOOLBAR_SECTION_CONFIG.map((x) => [x.key, true])),
  };
}

export function loadAppSettings() {
  try {
    const raw = localStorage.getItem(appSettingsKey());
    const parsed = raw ? JSON.parse(raw) : {};
    const defaults = defaultSettings();
    state.settings = { ...defaults, ...(parsed || {}) };
    // Deep merge all nested objects so saved keys are merged with defaults
    for (const key of Object.keys(defaults)) {
      if (defaults[key] !== null && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
        state.settings[key] = { ...defaults[key], ...(state.settings[key] || {}) };
      }
    }
  } catch (err) {
    console.warn('[settings-controller storage] error:', err?.message);
    state.settings = defaultSettings();
  }
}

export function saveAppSettings() {
  localStorage.setItem(appSettingsKey(), JSON.stringify(state.settings || defaultSettings()));
}

/**
 * Apply UI size settings to CSS custom properties and layout keys.
 * @param {function} uiLayoutKey - Function to compute localStorage key for UI layout values.
 */
export function applyUiSizeSettings(uiLayoutKey) {
  const settings = state.settings || defaultSettings();
  const sidebar = Math.max(160, Math.min(360, Number(settings.uiSidebarWidth) || 220));
  const toolbarScale = Math.max(0.1, Math.min(1, Number(settings.uiToolbarScale) || 1));
  const textMin = Math.max(24, Math.min(180, Number(settings.uiTextMinHeight) || 40));
  const pageArea = Math.max(520, Math.min(2600, Number(settings.uiPageAreaPx) || 860));
  const topToolbar = Math.max(28, Math.min(72, Number(settings.uiToolbarTopPx) || 34));
  const bottomToolbar = Math.max(48, Math.min(220, Number(settings.uiToolbarBottomPx) || 86));
  const textPanel = Math.max(72, Math.min(360, Number(settings.uiTextPanelPx) || 120));
  const annotationScale = Math.max(0.5, Math.min(1, (Number(settings.uiAnnotationCanvasScale) || 90) / 100));

  localStorage.setItem(uiLayoutKey('sidebarWidth'), String(Math.round(sidebar)));
  localStorage.setItem(uiLayoutKey('pageAreaPx'), String(Math.round(pageArea)));
  document.documentElement.style.setProperty('--ui-toolbar-scale', String(toolbarScale));
  document.documentElement.style.setProperty('--ui-text-min-height', `${Math.round(textMin)}px`);
  document.documentElement.style.setProperty('--ui-toolbar-top-height', `${Math.round(topToolbar)}px`);
  document.documentElement.style.setProperty('--ui-toolbar-bottom-height', `${Math.round(bottomToolbar)}px`);
  document.documentElement.style.setProperty('--ui-text-panel-height', `${Math.round(textPanel)}px`);
  document.documentElement.style.setProperty('--ui-annotation-canvas-scale', annotationScale.toFixed(2));

  document.querySelector('.app-shell')?.style.setProperty('--sidebar-width', `${Math.round(sidebar)}px`);
  document.querySelector('.viewer-area')?.style.setProperty('--page-area-height', `${Math.round(pageArea)}px`);
}

export function getOcrLang() {
  return state.settings?.ocrLang || 'auto';
}

export function getOcrScale() {
  const lang = getOcrLang();
  const qualityScale = state.settings?.ocrQualityMode === 'accurate' ? 1.35 : 1;
  const langScale = (lang === 'rus' ? 3 : 2) * qualityScale;
  const dpiScale = OCR_MIN_DPI / CSS_BASE_DPI;
  return Math.max(langScale, dpiScale);
}

// ─── Theme ──────────────────────────────────────────────────────────────────

/**
 * Cycle to the next theme.
 * @param {function} applyTheme - Function to apply a theme by name.
 */
export function toggleTheme(applyTheme) {
  const themes = ['dark', 'light', 'sepia', 'high-contrast', 'auto'];
  const current = localStorage.getItem('novareader-theme') || 'dark';
  const nextIdx = (themes.indexOf(current) + 1) % themes.length;
  applyTheme(themes[nextIdx]);
}

// ─── Notes ──────────────────────────────────────────────────────────────────

/**
 * Build the notes model from the current DOM inputs.
 * @param {function} noteKey - Returns the localStorage key for notes.
 */
export function getNotesModel() {
  return {
    title: (els.notesTitle.value || '').trim(),
    tags: (els.notesTags.value || '').trim(),
    body: els.notes.value || '',
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeImportedNotes(payload) {
  if (payload && payload.notes && typeof payload.notes === 'object') {
    return {
      title: payload.notes.title || state.docName || '',
      tags: payload.notes.tags || '',
      body: payload.notes.body || '',
    };
  }

  if (payload && typeof payload.notes === 'string') {
    return {
      title: state.docName || '',
      tags: '',
      body: payload.notes,
    };
  }

  return {
    title: state.docName || '',
    tags: '',
    body: '',
  };
}

export function mergeNotesByMode(current, incoming, mode) {
  if (mode === 'append') {
    const joinedBody = [current.body, incoming.body].filter(Boolean).join('\n\n');
    const mergedTags = [current.tags, incoming.tags]
      .filter(Boolean)
      .join(',')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const dedupTags = [...new Set(mergedTags)].join(', ');

    return {
      title: current.title || incoming.title || state.docName || '',
      tags: dedupTags,
      body: joinedBody,
    };
  }

  return {
    title: incoming.title || state.docName || '',
    tags: incoming.tags || '',
    body: incoming.body || '',
  };
}

/**
 * Load notes from localStorage into the DOM.
 * @param {function} noteKey - Returns the localStorage key for notes.
 */
export function loadNotes(noteKey) {
  const raw = localStorage.getItem(noteKey());
  if (!raw) {
    els.notesTitle.value = state.docName || '';
    els.notesTags.value = '';
    els.notes.value = '';
    setNotesStatus('Заметки загружены');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && ('body' in parsed || 'title' in parsed || 'tags' in parsed)) {
      els.notesTitle.value = parsed.title || state.docName || '';
      els.notesTags.value = parsed.tags || '';
      els.notes.value = parsed.body || '';
      setNotesStatus('Заметки загружены');
      return;
    }
  } catch (err) {
    console.warn('[settings-controller] error:', err?.message);
    // Backward compatibility with old plain-string format.
  }

  els.notesTitle.value = state.docName || '';
  els.notesTags.value = '';
  els.notes.value = raw;
  setNotesStatus('Заметки загружены');
}

let notesAutosaveTimer = null;

export function setNotesStatus(message) {
  els.notesStatus.textContent = message;
}

/**
 * Save notes to localStorage.
 * @param {function} noteKey - Returns the localStorage key for notes.
 * @param {string} [source='manual']
 */
export function saveNotes(noteKey, source = 'manual') {
  localStorage.setItem(noteKey(), JSON.stringify(getNotesModel()));
  if (source === 'manual') {
    setNotesStatus(`Сохранено вручную: ${new Date().toLocaleTimeString()}`);
  } else {
    setNotesStatus(`Автосохранение: ${new Date().toLocaleTimeString()}`);
  }
}

/**
 * Queue a debounced autosave for notes.
 * @param {function} noteKey - Returns the localStorage key for notes.
 */
export function queueNotesAutosave(noteKey) {
  setNotesStatus('Есть несохранённые изменения...');
  if (notesAutosaveTimer) {
    clearSafeTimeout(notesAutosaveTimer);
  }
  notesAutosaveTimer = safeTimeout(() => {
    saveNotes(noteKey, 'auto');
    notesAutosaveTimer = null;
  }, 600);
}

/**
 * Export notes as plain text download.
 */
export function exportNotes() {
  const m = getNotesModel();
  const plain = `Заголовок: ${m.title}
Теги: ${m.tags}
Обновлено: ${m.updatedAt}

${m.body}`;
  const blob = new Blob([plain], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportNotesMarkdown() {
  const m = getNotesModel();
  const title = m.title || state.docName || 'Документ';
  const tags = m.tags ? `**Теги:** ${m.tags}

` : '';
  const markdown = `# Заметки: ${title}

${tags}${m.body}

_Обновлено: ${m.updatedAt}_
`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportNotesJson() {
  const payload = {
    app: 'NovaReader',
    version: 2,
    docName: state.docName || null,
    notes: getNotesModel(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import notes from a JSON file.
 * @param {File} file
 * @param {function} noteKey - Returns the localStorage key for notes.
 */
export async function importNotesJson(file, noteKey) {
  if (!file) return;
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const incoming = normalizeImportedNotes(payload);
    if (!incoming) {
      throw new Error('bad notes payload');
    }

    const current = {
      title: els.notesTitle.value || state.docName || '',
      tags: els.notesTags.value || '',
      body: els.notes.value || '',
    };

    const mode = els.notesImportMode?.value || 'replace';
    const merged = mergeNotesByMode(current, incoming, mode);

    els.notesTitle.value = merged.title;
    els.notesTags.value = merged.tags;
    els.notes.value = merged.body;
    saveNotes(noteKey, 'manual');
  } catch (err) {
    console.warn('[settings-controller storage] error:', err?.message);
    toastError('Не удалось импортировать заметки JSON. Проверьте формат файла.');
  }
}

/**
 * Insert a timestamp at the end of the notes textarea.
 * @param {function} noteKey - Returns the localStorage key for notes.
 */
export function insertTimestamp(noteKey) {
  const stamp = new Date().toLocaleString();
  const prefix = els.notes.value ? '\n' : '';
  els.notes.value += `${prefix}[${stamp}] `;
  els.notes.focus();
  saveNotes(noteKey, 'manual');
}

// ─── Hotkeys ────────────────────────────────────────────────────────────────

export function normalizeHotkey(value, fallback) {
  const v = (value || '').trim().toLowerCase();
  return v || fallback;
}

export function setHotkeysStatus(message, type = '') {
  els.hotkeysStatus.textContent = message;
  els.hotkeysStatus.classList.remove('error', 'success');
  if (type) {
    els.hotkeysStatus.classList.add(type);
  }
}

export const hotkeyFieldMeta = {
  next: { input: () => els.hkNext, hint: () => els.hkNextHint, label: 'След. стр.' },
  prev: { input: () => els.hkPrev, hint: () => els.hkPrevHint, label: 'Пред. стр.' },
  zoomIn: { input: () => els.hkZoomIn, hint: () => els.hkZoomInHint, label: 'Zoom +' },
  zoomOut: { input: () => els.hkZoomOut, hint: () => els.hkZoomOutHint, label: 'Zoom -' },
  annotate: { input: () => els.hkAnnotate, hint: () => els.hkAnnotateHint, label: 'Аннотации' },
  searchFocus: { input: () => els.hkSearchFocus, hint: () => els.hkSearchFocusHint, label: 'Фокус поиска' },
  ocrPage: { input: () => els.hkOcrPage, hint: () => els.hkOcrPageHint, label: 'OCR страницы' },
  fitWidth: { input: () => els.hkFitWidth, hint: () => els.hkFitWidthHint, label: 'По ширине' },
  fitPage: { input: () => els.hkFitPage, hint: () => els.hkFitPageHint, label: 'По странице' },
};

export function hotkeyKeys() {
  return Object.keys(hotkeyFieldMeta);
}

export function normalizeHotkeyForDisplay(value) {
  const v = (value || '').toLowerCase();
  if (v === 'arrowright') return '>';
  if (v === 'arrowleft') return '<';
  return value;
}

export function setHotkeysInputErrors(fields = [], details = {}) {
  Object.values(hotkeyFieldMeta).forEach((meta) => {
    const input = meta.input();
    const hint = meta.hint();
    input.classList.remove('hotkey-invalid');
    hint.textContent = '';
  });

  fields.forEach((field) => {
    const meta = hotkeyFieldMeta[field];
    if (!meta) return;
    const input = meta.input();
    const hint = meta.hint();
    input.classList.add('hotkey-invalid');
    hint.textContent = details[field] || 'Проверьте значение поля.';
  });
}

export function validateHotkeys(nextHotkeys) {
  const entries = Object.entries(nextHotkeys);
  const emptyFields = entries.filter(([, value]) => !value || value.length < 1).map(([field]) => field);
  if (emptyFields.length) {
    const fieldMessages = Object.fromEntries(emptyFields.map((field) => [field, 'Пустое значение.']));
    return { ok: false, message: 'Ошибка: есть пустые хоткеи.', fields: emptyFields, fieldMessages };
  }

  const byValue = new Map();
  entries.forEach(([field, value]) => {
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value).push(field);
  });

  const duplicateValues = [...byValue.entries()].filter(([, arr]) => arr.length > 1);
  if (duplicateValues.length) {
    const duplicateFields = duplicateValues.flatMap(([, arr]) => arr);
    const fieldMessages = {};
    duplicateValues.forEach(([value, fields]) => {
      const labels = fields.map((field) => hotkeyFieldMeta[field]?.label || field).join(', ');
      fields.forEach((field) => {
        fieldMessages[field] = `Конфликт: «${normalizeHotkeyForDisplay(value)}» уже используется в ${labels}.`;
      });
    });
    const duplicates = duplicateValues.map(([v]) => normalizeHotkeyForDisplay(v));
    return {
      ok: false,
      message: `Ошибка: дублирующиеся хоткеи (${duplicates.join(', ')})`,
      fields: duplicateFields,
      fieldMessages,
    };
  }

  return { ok: true, message: 'Hotkeys сохранены.', fields: [], fieldMessages: {} };
}

export function renderHotkeyInputs() {
  els.hkNext.value = normalizeHotkeyForDisplay(hotkeys.next);
  els.hkPrev.value = normalizeHotkeyForDisplay(hotkeys.prev);
  els.hkZoomIn.value = hotkeys.zoomIn;
  els.hkZoomOut.value = hotkeys.zoomOut;
  els.hkAnnotate.value = hotkeys.annotate;
  if (els.hkSearchFocus) els.hkSearchFocus.value = hotkeys.searchFocus;
  if (els.hkOcrPage) els.hkOcrPage.value = hotkeys.ocrPage;
  if (els.hkFitWidth) els.hkFitWidth.value = hotkeys.fitWidth;
  if (els.hkFitPage) els.hkFitPage.value = hotkeys.fitPage;
}

export function saveHotkeys() {
  const candidate = {
    next: normalizeHotkey(els.hkNext.value === '>' ? 'arrowright' : els.hkNext.value, defaultHotkeys.next),
    prev: normalizeHotkey(els.hkPrev.value === '<' ? 'arrowleft' : els.hkPrev.value, defaultHotkeys.prev),
    zoomIn: normalizeHotkey(els.hkZoomIn.value, defaultHotkeys.zoomIn),
    zoomOut: normalizeHotkey(els.hkZoomOut.value, defaultHotkeys.zoomOut),
    annotate: normalizeHotkey(els.hkAnnotate.value, defaultHotkeys.annotate),
    searchFocus: normalizeHotkey(els.hkSearchFocus?.value, defaultHotkeys.searchFocus),
    ocrPage: normalizeHotkey(els.hkOcrPage?.value, defaultHotkeys.ocrPage),
    fitWidth: normalizeHotkey(els.hkFitWidth?.value, defaultHotkeys.fitWidth),
    fitPage: normalizeHotkey(els.hkFitPage?.value, defaultHotkeys.fitPage),
  };

  const validation = validateHotkeys(candidate);
  if (!validation.ok) {
    setHotkeysInputErrors(validation.fields, validation.fieldMessages);
    setHotkeysStatus(validation.message, 'error');
    return;
  }

  setHotkeysInputErrors([]);
  setHotkeys(candidate);
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysStatus(validation.message, 'success');
}

export function loadHotkeys() {
  const raw = localStorage.getItem('novareader-hotkeys');
  if (!raw) {
    setHotkeys({ ...defaultHotkeys });
    renderHotkeyInputs();
    setHotkeysInputErrors([]);
    setHotkeysStatus('Используются значения по умолчанию.');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    setHotkeys({
      next: normalizeHotkey(parsed.next, defaultHotkeys.next),
      prev: normalizeHotkey(parsed.prev, defaultHotkeys.prev),
      zoomIn: normalizeHotkey(parsed.zoomIn, defaultHotkeys.zoomIn),
      zoomOut: normalizeHotkey(parsed.zoomOut, defaultHotkeys.zoomOut),
      annotate: normalizeHotkey(parsed.annotate, defaultHotkeys.annotate),
      searchFocus: normalizeHotkey(parsed.searchFocus, defaultHotkeys.searchFocus),
      ocrPage: normalizeHotkey(parsed.ocrPage, defaultHotkeys.ocrPage),
      fitWidth: normalizeHotkey(parsed.fitWidth, defaultHotkeys.fitWidth),
      fitPage: normalizeHotkey(parsed.fitPage, defaultHotkeys.fitPage),
    });
  } catch (err) {
    console.warn('[ocr] error:', err?.message);
    setHotkeys({ ...defaultHotkeys });
  }
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Hotkeys загружены.');
}

export function resetHotkeys() {
  setHotkeys({ ...defaultHotkeys });
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Hotkeys сброшены к умолчанию.', 'success');
}

export function stringifyHotkeyEvent(e) {
  const base = e.key.toLowerCase();
  const specialMap = {
    ' ': 'space',
    arrowup: 'arrowup',
    arrowdown: 'arrowdown',
    arrowleft: 'arrowleft',
    arrowright: 'arrowright',
    escape: 'escape',
  };
  const normalizedBase = specialMap[base] || base;
  if (['control', 'shift', 'alt', 'meta'].includes(normalizedBase)) return '';

  const combo = [];
  if (e.ctrlKey) combo.push('ctrl');
  if (e.altKey) combo.push('alt');
  if (e.shiftKey) combo.push('shift');
  if (e.metaKey) combo.push('meta');
  combo.push(normalizedBase);
  return combo.join('+');
}

export function bindHotkeyCapture() {
  const fields = hotkeyKeys();
  fields.forEach((field) => {
    const input = hotkeyFieldMeta[field].input();
    input.addEventListener('keydown', (e) => {
      e.preventDefault();
      if (e.key === 'Backspace' || e.key === 'Delete') {
        input.value = '';
        setHotkeysStatus('Поле очищено. Сохраните или примените авто-фикс.');
        setHotkeysInputErrors([]);
        return;
      }

      const value = stringifyHotkeyEvent(e);
      if (!value) return;
      input.value = normalizeHotkeyForDisplay(value);
      setHotkeysStatus(`Назначено: ${hotkeyFieldMeta[field].label} = ${input.value}`);
      setHotkeysInputErrors([]);
    });
  });
}

export function autoFixHotkeys() {
  const fields = hotkeyKeys();
  const candidate = {
    next: normalizeHotkey(els.hkNext.value === '>' ? 'arrowright' : els.hkNext.value, ''),
    prev: normalizeHotkey(els.hkPrev.value === '<' ? 'arrowleft' : els.hkPrev.value, ''),
    zoomIn: normalizeHotkey(els.hkZoomIn.value, ''),
    zoomOut: normalizeHotkey(els.hkZoomOut.value, ''),
    annotate: normalizeHotkey(els.hkAnnotate.value, ''),
    searchFocus: normalizeHotkey(els.hkSearchFocus?.value, ''),
    ocrPage: normalizeHotkey(els.hkOcrPage?.value, ''),
    fitWidth: normalizeHotkey(els.hkFitWidth?.value, ''),
    fitPage: normalizeHotkey(els.hkFitPage?.value, ''),
  };

  const used = new Set();
  for (const key of fields) {
    const value = candidate[key];
    if (!value || used.has(value)) {
      candidate[key] = '';
      continue;
    }
    used.add(value);
  }

  for (const key of fields) {
    if (candidate[key]) continue;
    const preferred = defaultHotkeys[key];
    if (!used.has(preferred)) {
      candidate[key] = preferred;
      used.add(preferred);
      continue;
    }

    const fallbackPool = ['j', 'k', 'i', 'o', 'u', 'p', 'n', 'm', 'f2', 'f3', 'f4'];
    const fallback = fallbackPool.find((x) => !used.has(x)) || preferred;
    candidate[key] = fallback;
    used.add(fallback);
  }

  setHotkeys(candidate);
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Hotkeys авто-исправлены и сохранены.', 'success');
}

// ─── Bookmarks ──────────────────────────────────────────────────────────────

export function setBookmarksStatus(message, type = '') {
  els.bookmarksStatus.textContent = message;
  els.bookmarksStatus.classList.remove('error', 'success');
  if (type) {
    els.bookmarksStatus.classList.add(type);
  }
}

/**
 * Export bookmarks to JSON file.
 * @param {function} bookmarkKey - Returns the localStorage key for bookmarks.
 * @param {function} loadBookmarksFn - Loads bookmarks from localStorage.
 */
export function exportBookmarksJson(bookmarkKey, loadBookmarksFn) {
  if (!state.adapter) {
    setBookmarksStatus('Сначала откройте документ', 'error');
    return;
  }

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    exportedAt: new Date().toISOString(),
    bookmarks: loadBookmarksFn(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-bookmarks.json`;
  a.click();
  URL.revokeObjectURL(url);
  setBookmarksStatus('Закладки экспортированы', 'success');
}

/**
 * Import bookmarks from a JSON file.
 * @param {File} file
 * @param {function} saveBookmarksFn - Saves bookmarks to localStorage.
 * @param {function} renderBookmarksFn - Re-renders the bookmark list.
 */
export async function importBookmarksJson(file, saveBookmarksFn, renderBookmarksFn) {
  if (!state.adapter || !file) {
    setBookmarksStatus('Сначала откройте документ', 'error');
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const list = Array.isArray(payload?.bookmarks) ? payload.bookmarks : (Array.isArray(payload) ? payload : null);
    if (!list) throw new Error('bad payload');

    const normalized = list
      .filter((x) => Number.isInteger(x?.page) && x.page >= 1 && x.page <= state.pageCount)
      .map((x) => ({
        page: x.page,
        label: (x.label || `Метка ${x.page}`).toString().slice(0, 120),
      }));

    const unique = [];
    const seen = new Set();
    normalized.forEach((x) => {
      const key = `${x.page}:${x.label}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(x);
      }
    });

    unique.sort((a, b) => a.page - b.page);
    saveBookmarksFn(unique);
    renderBookmarksFn();
    setBookmarksStatus(`Импортировано закладок: ${unique.length}`, 'success');
  } catch (err) {
    console.warn('[settings-controller storage] error:', err?.message);
    setBookmarksStatus('Ошибка импорта закладок', 'error');
  }
}

/**
 * Load bookmarks from localStorage.
 * @param {function} bookmarkKey - Returns the localStorage key for bookmarks.
 * @returns {Array}
 */
export function loadBookmarks(bookmarkKey) {
  return JSON.parse(localStorage.getItem(bookmarkKey()) || '[]');
}

/**
 * Save bookmarks to localStorage.
 * @param {Array} next - The bookmarks array.
 * @param {function} bookmarkKey - Returns the localStorage key for bookmarks.
 * @param {function} renderDocStats - Re-renders document stats.
 * @param {function} renderEtaStatus - Re-renders ETA status.
 */
export function saveBookmarks(next, bookmarkKey, renderDocStats, renderEtaStatus) {
  localStorage.setItem(bookmarkKey(), JSON.stringify(next));
  renderDocStats();
  renderEtaStatus();
}

/**
 * Render the bookmark list in the sidebar.
 * @param {function} bookmarkKey - Returns the localStorage key for bookmarks.
 * @param {function} saveBookmarksFn - Saves bookmarks.
 * @param {function} renderCurrentPage - Renders the current page.
 */
export function renderBookmarks(bookmarkKey, saveBookmarksFn, renderCurrentPage) {
  const bookmarks = loadBookmarks(bookmarkKey);
  const filter = (els.bookmarkFilter?.value || '').trim().toLowerCase();
  const filtered = filter
    ? bookmarks.filter((entry) => (`${entry.label} ${entry.page}`).toLowerCase().includes(filter))
    : bookmarks;

  els.bookmarkList.innerHTML = '';

  if (!filtered.length) {
    const li = document.createElement('li');
    li.className = 'bookmark-item';
    li.textContent = filter ? 'Нет закладок по фильтру' : 'Закладок пока нет';
    els.bookmarkList.appendChild(li);
    return;
  }

  filtered.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'bookmark-item';

    const btn = document.createElement('button');
    btn.textContent = `Стр. ${entry.page} — ${entry.label}`;
    btn.addEventListener('click', async () => {
      state.currentPage = entry.page;
      await renderCurrentPage();
    });

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Переим.';
    renameBtn.addEventListener('click', async () => {
      const next = await nrPrompt('Новое название закладки:', entry.label);
      if (!next) return;
      const all = loadBookmarks(bookmarkKey);
      const idx = all.findIndex((x) => x.page === entry.page && x.label === entry.label);
      if (idx >= 0) {
        all[idx].label = next.trim();
        saveBookmarksFn(all);
        renderBookmarks(bookmarkKey, saveBookmarksFn, renderCurrentPage);
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Удалить';
    deleteBtn.addEventListener('click', () => {
      const all = loadBookmarks(bookmarkKey).filter((x) => !(x.page === entry.page && x.label === entry.label));
      saveBookmarksFn(all);
      renderBookmarks(bookmarkKey, saveBookmarksFn, renderCurrentPage);
    });

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(btn);
    li.appendChild(actions);
    els.bookmarkList.appendChild(li);
  });
}

/**
 * Add a bookmark for the current page.
 * @param {function} bookmarkKey - Returns the localStorage key for bookmarks.
 * @param {function} saveBookmarksFn - Saves bookmarks.
 * @param {function} renderBookmarksFn - Re-renders the bookmark list.
 */
export async function addBookmark(bookmarkKey, saveBookmarksFn, renderBookmarksFn) {
  if (!state.adapter) return;
  const label = (await nrPrompt('Название закладки:', `Метка ${state.currentPage}`)) || `Метка ${state.currentPage}`;
  const bookmarks = loadBookmarks(bookmarkKey);
  if (!bookmarks.some((x) => x.page === state.currentPage && x.label === label)) {
    bookmarks.push({ page: state.currentPage, label });
    bookmarks.sort((a, b) => a.page - b.page);
    saveBookmarksFn(bookmarks);
    renderBookmarksFn();
  }
}

/**
 * Clear all bookmarks.
 * @param {function} saveBookmarksFn - Saves bookmarks.
 * @param {function} renderBookmarksFn - Re-renders the bookmark list.
 */
export function clearBookmarks(saveBookmarksFn, renderBookmarksFn) {
  saveBookmarksFn([]);
  renderBookmarksFn();
  setBookmarksStatus('Закладки очищены', 'success');
}
