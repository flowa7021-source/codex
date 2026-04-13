// ─── App Persistence ────────────────────────────────────────────────────────
// Centralized state persistence: localStorage, session state, workspace bundles.

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

const STORAGE_PREFIX = 'nr3_';
const MAX_RECENT_DOCS = 30;
const VIEW_STATE_DEBOUNCE_MS = 500;

let viewStateSaveTimer: number | null = null;

/**
 * Save a value to localStorage with prefix.
 */
export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (err) { console.warn('[app-persistence storage] error:', (err as any)?.message); }
}

/**
 * Load a value from localStorage.
 */
export function load(key: string, defaultValue: unknown = null): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.warn('[app-persistence storage] error:', (err as any)?.message);
    return defaultValue;
  }
}

/**
 * Remove a value from localStorage.
 */
export function remove(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

// ─── App Settings ───────────────────────────────────────────────────────────

interface AppSettings {
  theme: string;
  lang: string;
  ocrLang: string;
  ocrQualityMode: string;
  autoOcr: boolean;
  continuousScroll: boolean;
  viewMode: string;
  showMinimap: boolean;
  showThumbnails: boolean;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: AppSettings = {
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

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(load('settings', {}) as Partial<AppSettings>) };
}

export function saveSettings(settings: AppSettings): void {
  save('settings', settings);
}

export function updateSetting(key: string, value: unknown): AppSettings {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
  return settings;
}

// ─── View State (per document) ──────────────────────────────────────────────

interface ViewState {
  currentPage?: number;
  zoom?: number;
  scrollY?: number;
  rotation?: number;
  savedAt?: number;
  [key: string]: unknown;
}

/**
 * Save view state for a document (debounced).
 */
export function saveViewState(docName: string, state: ViewState): void {
  if (!docName) return;
  if (viewStateSaveTimer !== null) clearSafeTimeout(viewStateSaveTimer);
  viewStateSaveTimer = safeTimeout(() => {
    const viewStates = load('viewStates', {}) as Record<string, ViewState>;
    viewStates[docName] = { ...state, savedAt: Date.now() };

    // Keep only recent 50 entries
    const entries = Object.entries(viewStates);
    if (entries.length > 50) {
      entries.sort(([, a], [, b]) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
      const trimmed = Object.fromEntries(entries.slice(0, 50));
      save('viewStates', trimmed);
    } else {
      save('viewStates', viewStates);
    }
  }, VIEW_STATE_DEBOUNCE_MS);
}

/**
 * Load view state for a document.
 */
export function loadViewState(docName: string): ViewState | null {
  if (!docName) return null;
  const viewStates = load('viewStates', {}) as Record<string, ViewState>;
  return viewStates[docName] || null;
}

// ─── Recent Documents ───────────────────────────────────────────────────────

interface RecentDoc {
  name: string;
  openedAt?: number;
  [key: string]: unknown;
}

export function getRecentDocs(): RecentDoc[] {
  return load('recentDocs', []) as RecentDoc[];
}

export function addRecentDoc(doc: RecentDoc): RecentDoc[] {
  const recent = getRecentDocs().filter(d => d.name !== doc.name);
  recent.unshift({ ...doc, openedAt: Date.now() });
  if (recent.length > MAX_RECENT_DOCS) recent.length = MAX_RECENT_DOCS;
  save('recentDocs', recent);
  return recent;
}

export function clearRecentDocs(): void {
  save('recentDocs', []);
}

// ─── Bookmarks (per document) ───────────────────────────────────────────────

export function loadBookmarks(docName: string): unknown[] {
  if (!docName) return [];
  const all = load('bookmarks', {}) as Record<string, unknown[]>;
  return all[docName] || [];
}

export function saveBookmarks(docName: string, bookmarks: unknown[]): void {
  if (!docName) return;
  const all = load('bookmarks', {}) as Record<string, unknown[]>;
  all[docName] = bookmarks;
  save('bookmarks', all);
}

// ─── Notes (per document) ───────────────────────────────────────────────────

export function loadNotes(docName: string): unknown[] {
  if (!docName) return [];
  const all = load('notes', {}) as Record<string, unknown[]>;
  return all[docName] || [];
}

export function saveNotes(docName: string, notes: unknown[]): void {
  if (!docName) return;
  const all = load('notes', {}) as Record<string, unknown[]>;
  all[docName] = notes;
  save('notes', all);
}

// ─── Reading Progress ───────────────────────────────────────────────────────

interface ReadingProgress {
  time: number;
  goal: number;
  pagesRead: number[];
  [key: string]: unknown;
}

export function loadReadingProgress(docName: string): ReadingProgress {
  if (!docName) return { time: 0, goal: 0, pagesRead: [] };
  const all = load('readingProgress', {}) as Record<string, ReadingProgress>;
  return all[docName] || { time: 0, goal: 0, pagesRead: [] };
}

export function saveReadingProgress(docName: string, progress: ReadingProgress): void {
  if (!docName) return;
  const all = load('readingProgress', {}) as Record<string, ReadingProgress>;
  all[docName] = progress;
  save('readingProgress', all);
}

// ─── Strokes & Annotations (per document, per page) ─────────────────────────

export function loadStrokes(docName: string, page: number): unknown[] {
  return load(`strokes_${docName}_p${page}`, []) as unknown[];
}

export function saveStrokes(docName: string, page: number, strokes: unknown[]): void {
  save(`strokes_${docName}_p${page}`, strokes);
}

export function loadComments(docName: string, page: number): unknown[] {
  return load(`comments_${docName}_p${page}`, []) as unknown[];
}

export function saveComments(docName: string, page: number, comments: unknown[]): void {
  save(`comments_${docName}_p${page}`, comments);
}

// ─── OCR Text Data ──────────────────────────────────────────────────────────

export function loadOcrText(docName: string, page: number): unknown {
  return load(`ocr_${docName}_p${page}`, null);
}

export function saveOcrText(docName: string, page: number, text: unknown): void {
  save(`ocr_${docName}_p${page}`, text);
}

// ─── Workspace Bundle ───────────────────────────────────────────────────────

interface WorkspaceBundle {
  version: number;
  docName: string;
  exportedAt: string;
  settings: AppSettings;
  viewState: ViewState | null;
  bookmarks: unknown[];
  notes: unknown[];
  readingProgress: ReadingProgress;
  strokes: Record<number, unknown[]>;
  comments: Record<number, unknown[]>;
  ocrText: Record<number, unknown>;
  [key: string]: unknown;
}

/**
 * Export all persistent data for a document as a bundle.
 */
export function exportWorkspaceBundle(docName: string, pageCount: number): WorkspaceBundle {
  const bundle: WorkspaceBundle = {
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
 */
export function importWorkspaceBundle(bundle: WorkspaceBundle): void {
  if (!bundle || !bundle.docName) return;

  const docName = bundle.docName;

  if (bundle.bookmarks) saveBookmarks(docName, bundle.bookmarks);
  if (bundle.notes) saveNotes(docName, bundle.notes);
  if (bundle.readingProgress) saveReadingProgress(docName, bundle.readingProgress);
  if (bundle.viewState) {
    const viewStates = load('viewStates', {}) as Record<string, ViewState>;
    viewStates[docName] = bundle.viewState;
    save('viewStates', viewStates);
  }

  if (bundle.strokes) {
    for (const [page, strokes] of Object.entries(bundle.strokes)) {
      saveStrokes(docName, parseInt(page), strokes as unknown[]);
    }
  }
  if (bundle.comments) {
    for (const [page, comments] of Object.entries(bundle.comments)) {
      saveComments(docName, parseInt(page), comments as unknown[]);
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
 */
export function clearDocumentData(docName: string, pageCount: number): void {
  // View state
  const viewStates = load('viewStates', {}) as Record<string, ViewState>;
  delete viewStates[docName];
  save('viewStates', viewStates);

  // Bookmarks, notes, progress
  const bookmarks = load('bookmarks', {}) as Record<string, unknown[]>;
  delete bookmarks[docName];
  save('bookmarks', bookmarks);

  const notes = load('notes', {}) as Record<string, unknown[]>;
  delete notes[docName];
  save('notes', notes);

  const progress = load('readingProgress', {}) as Record<string, ReadingProgress>;
  delete progress[docName];
  save('readingProgress', progress);

  // Per-page data
  for (let p = 1; p <= pageCount; p++) {
    remove(`strokes_${docName}_p${p}`);
    remove(`comments_${docName}_p${p}`);
    remove(`ocr_${docName}_p${p}`);
  }
}
