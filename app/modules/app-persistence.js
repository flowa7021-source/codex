// @ts-check
// ─── App Persistence ────────────────────────────────────────────────────────
// Centralized state persistence: localStorage, session state, workspace bundles.

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

const STORAGE_PREFIX = 'nr3_';
const MAX_RECENT_DOCS = 30;
const VIEW_STATE_DEBOUNCE_MS = 500;

let viewStateSaveTimer = null;

/**
 * Save a value to localStorage with prefix.
 * @param {string} key
 * @param {any} value
 */
export function save(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (err) { console.warn('[app-persistence storage] error:', err?.message); }
}

/**
 * Load a value from localStorage.
 * @param {string} key
 * @param {any} defaultValue
 * @returns {any}
 */
export function load(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.warn('[app-persistence storage] error:', err?.message);
    return defaultValue;
  }
}

/**
 * Remove a value from localStorage.
 * @param {string} key
 */
export function remove(key) {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

// ─── App Settings ───────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  theme: 'dark',
  lang: 'ru',
  ocrLang: 'auto',
  ocrQualityMode: 'balanced',
  autoOcr: false,
  continuousScroll: false,
  viewMode: 'single',
  showMinimap: false,
  showThumbnails: true,
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load('settings', {}) };
}

export function saveSettings(settings) {
  save('settings', settings);
}

export function updateSetting(key, value) {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
  return settings;
}

// ─── View State (per document) ──────────────────────────────────────────────

/**
 * Save view state for a document (debounced).
 * @param {string} docName
 * @param {object} state - { currentPage, zoom, scrollY, rotation }
 */
export function saveViewState(docName, state) {
  if (!docName) return;
  clearSafeTimeout(viewStateSaveTimer);
  viewStateSaveTimer = safeTimeout(() => {
    const viewStates = load('viewStates', {});
    viewStates[docName] = { ...state, savedAt: Date.now() };

    // Keep only recent 50 entries
    const entries = Object.entries(viewStates);
    if (entries.length > 50) {
      entries.sort(([, a], [, b]) => b.savedAt - a.savedAt);
      const trimmed = Object.fromEntries(entries.slice(0, 50));
      save('viewStates', trimmed);
    } else {
      save('viewStates', viewStates);
    }
  }, VIEW_STATE_DEBOUNCE_MS);
}

/**
 * Load view state for a document.
 * @param {string} docName
 * @returns {object|null}
 */
export function loadViewState(docName) {
  if (!docName) return null;
  const viewStates = load('viewStates', {});
  return viewStates[docName] || null;
}

// ─── Recent Documents ───────────────────────────────────────────────────────

export function getRecentDocs() {
  return load('recentDocs', []);
}

export function addRecentDoc(doc) {
  const recent = getRecentDocs().filter(d => d.name !== doc.name);
  recent.unshift({ ...doc, openedAt: Date.now() });
  if (recent.length > MAX_RECENT_DOCS) recent.length = MAX_RECENT_DOCS;
  save('recentDocs', recent);
  return recent;
}

export function clearRecentDocs() {
  save('recentDocs', []);
}

// ─── Bookmarks (per document) ───────────────────────────────────────────────

export function loadBookmarks(docName) {
  if (!docName) return [];
  const all = load('bookmarks', {});
  return all[docName] || [];
}

export function saveBookmarks(docName, bookmarks) {
  if (!docName) return;
  const all = load('bookmarks', {});
  all[docName] = bookmarks;
  save('bookmarks', all);
}

// ─── Notes (per document) ───────────────────────────────────────────────────

export function loadNotes(docName) {
  if (!docName) return [];
  const all = load('notes', {});
  return all[docName] || [];
}

export function saveNotes(docName, notes) {
  if (!docName) return;
  const all = load('notes', {});
  all[docName] = notes;
  save('notes', all);
}

// ─── Reading Progress ───────────────────────────────────────────────────────

export function loadReadingProgress(docName) {
  if (!docName) return { time: 0, goal: 0, pagesRead: [] };
  const all = load('readingProgress', {});
  return all[docName] || { time: 0, goal: 0, pagesRead: [] };
}

export function saveReadingProgress(docName, progress) {
  if (!docName) return;
  const all = load('readingProgress', {});
  all[docName] = progress;
  save('readingProgress', all);
}

// ─── Strokes & Annotations (per document, per page) ─────────────────────────

export function loadStrokes(docName, page) {
  return load(`strokes_${docName}_p${page}`, []);
}

export function saveStrokes(docName, page, strokes) {
  save(`strokes_${docName}_p${page}`, strokes);
}

export function loadComments(docName, page) {
  return load(`comments_${docName}_p${page}`, []);
}

export function saveComments(docName, page, comments) {
  save(`comments_${docName}_p${page}`, comments);
}

// ─── OCR Text Data ──────────────────────────────────────────────────────────

export function loadOcrText(docName, page) {
  return load(`ocr_${docName}_p${page}`, null);
}

export function saveOcrText(docName, page, text) {
  save(`ocr_${docName}_p${page}`, text);
}

// ─── Workspace Bundle ───────────────────────────────────────────────────────

/**
 * Export all persistent data for a document as a bundle.
 * @param {string} docName
 * @param {number} pageCount
 * @returns {object}
 */
export function exportWorkspaceBundle(docName, pageCount) {
  const bundle = {
    version: 3,
    docName,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    viewState: loadViewState(docName),
    bookmarks: loadBookmarks(docName),
    notes: loadNotes(docName),
    readingProgress: loadReadingProgress(docName),
    strokes: {},
    comments: {},
    ocrText: {},
  };

  for (let p = 1; p <= pageCount; p++) {
    const strokes = loadStrokes(docName, p);
    if (strokes.length) bundle.strokes[p] = strokes;

    const comments = loadComments(docName, p);
    if (comments.length) bundle.comments[p] = comments;

    const ocr = loadOcrText(docName, p);
    if (ocr) bundle.ocrText[p] = ocr;
  }

  return bundle;
}

/**
 * Import a workspace bundle.
 * @param {object} bundle
 */
export function importWorkspaceBundle(bundle) {
  if (!bundle || !bundle.docName) return;

  const docName = bundle.docName;

  if (bundle.bookmarks) saveBookmarks(docName, bundle.bookmarks);
  if (bundle.notes) saveNotes(docName, bundle.notes);
  if (bundle.readingProgress) saveReadingProgress(docName, bundle.readingProgress);
  if (bundle.viewState) {
    const viewStates = load('viewStates', {});
    viewStates[docName] = bundle.viewState;
    save('viewStates', viewStates);
  }

  if (bundle.strokes) {
    for (const [page, strokes] of Object.entries(bundle.strokes)) {
      saveStrokes(docName, parseInt(page), strokes);
    }
  }
  if (bundle.comments) {
    for (const [page, comments] of Object.entries(bundle.comments)) {
      saveComments(docName, parseInt(page), comments);
    }
  }
  if (bundle.ocrText) {
    for (const [page, text] of Object.entries(bundle.ocrText)) {
      saveOcrText(docName, parseInt(page), text);
    }
  }
}

/**
 * Clear all data for a document.
 * @param {string} docName
 * @param {number} pageCount
 */
export function clearDocumentData(docName, pageCount) {
  // View state
  const viewStates = load('viewStates', {});
  delete viewStates[docName];
  save('viewStates', viewStates);

  // Bookmarks, notes, progress
  const bookmarks = load('bookmarks', {});
  delete bookmarks[docName];
  save('bookmarks', bookmarks);

  const notes = load('notes', {});
  delete notes[docName];
  save('notes', notes);

  const progress = load('readingProgress', {});
  delete progress[docName];
  save('readingProgress', progress);

  // Per-page data
  for (let p = 1; p <= pageCount; p++) {
    remove(`strokes_${docName}_p${p}`);
    remove(`comments_${docName}_p${p}`);
    remove(`ocr_${docName}_p${p}`);
  }
}
