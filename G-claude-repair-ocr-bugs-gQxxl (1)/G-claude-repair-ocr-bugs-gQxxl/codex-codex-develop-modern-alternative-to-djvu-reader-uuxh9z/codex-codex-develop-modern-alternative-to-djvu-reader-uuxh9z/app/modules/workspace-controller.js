// ─── Workspace Controller ────────────────────────────────────────────────────
// Cloud sync, collaboration channel, workspace import/export, OCR text storage.
// Extracted from app.js Phase 5 as part of Q1.1 decomposition.

import { state, els, hotkeys, defaultHotkeys, setHotkeys } from './state.js';
import { APP_VERSION } from './constants.js';
import { saveOcrData, loadOcrData } from './ocr-storage.js';
import { nrConfirm } from './modal-prompt.js';
import { createLogger } from './logger.js';

const log = createLogger('workspace');

// ─── Dependency injection for app.js callbacks ──────────────────────────────
// These are functions defined in app.js or other controllers that workspace
// needs to call. They are registered via initWorkspaceDeps() during app init.
const _deps = {
  loadStrokes: () => [],
  saveStrokes: () => {},
  loadComments: () => [],
  saveComments: () => {},
  getNotesModel: () => ({ title: '', tags: '', body: '' }),
  normalizeImportedNotes: (n) => n || { title: '', tags: '', body: '' },
  saveNotes: () => {},
  loadBookmarks: () => [],
  saveBookmarks: () => {},
  renderBookmarks: () => {},
  setBookmarksStatus: () => {},
  normalizeHotkey: (v, f) => v || f,
  validateHotkeys: () => ({ ok: true }),
  renderHotkeyInputs: () => {},
  setHotkeysInputErrors: () => {},
  setHotkeysStatus: () => {},
  renderAnnotations: () => {},
  renderCommentList: () => {},
  clearDocumentAnnotationStorage: () => {},
  clearDocumentCommentStorage: () => {},
  renderPagePreviews: async () => {},
  renderCurrentPage: async () => {},
};

/**
 * Register app.js callbacks that workspace functions need.
 * Must be called once during app initialization.
 * @param {object} deps
 */
export function initWorkspaceDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Status helpers ─────────────────────────────────────────────────────────

export function setWorkspaceStatus(message, type = '') {
  if (!els.workspaceStatus) return;
  els.workspaceStatus.textContent = message;
  els.workspaceStatus.classList.remove('error', 'success');
  if (type) {
    els.workspaceStatus.classList.add(type);
  }
}

export function setStage4Status(message, type = '') {
  if (!els.stage4Status) return;
  els.stage4Status.textContent = message;
  els.stage4Status.classList.remove('error', 'success');
  if (type) {
    els.stage4Status.classList.add(type);
  }
}

export function initReleaseGuards() {
  if (els.appVersion) {
    els.appVersion.textContent = APP_VERSION;
  }

  if (typeof fetch !== 'function') {
    if (els.pushCloudSync) els.pushCloudSync.disabled = true;
    if (els.pullCloudSync) els.pullCloudSync.disabled = true;
    setStage4Status('Cloud sync недоступен: fetch API отсутствует.', 'error');
  }

  if (typeof BroadcastChannel !== 'function') {
    if (els.toggleCollab) els.toggleCollab.disabled = true;
    if (els.broadcastCollab) els.broadcastCollab.disabled = true;
    setStage4Status('Collaboration недоступна: BroadcastChannel отсутствует.', 'error');
  }
}

// ─── Cloud sync URL ─────────────────────────────────────────────────────────

export function cloudSyncUrlKey() {
  return 'novareader-cloud-sync-url';
}

export function loadCloudSyncUrl() {
  const saved = localStorage.getItem(cloudSyncUrlKey());
  if (saved) return saved;
  if (typeof location !== 'undefined') {
    const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
    if (isHttp && location.origin) {
      return `${location.origin}/api/workspace`;
    }
  }
  return '';
}

export function saveCloudSyncUrl() {
  const value = (els.cloudSyncUrl?.value || '').trim();
  localStorage.setItem(cloudSyncUrlKey(), value);
  setStage4Status(value ? 'Cloud URL сохранён.' : 'Cloud URL очищен.', 'success');
}

// ─── OCR text storage (localStorage + IndexedDB) ────────────────────────────

export function ocrTextKey() {
  return `novareader-ocr-text:${state.docName || 'global'}`;
}

export function loadOcrTextData() {
  try {
    const raw = localStorage.getItem(ocrTextKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOcrTextData(payload) {
  localStorage.setItem(ocrTextKey(), JSON.stringify(payload));
  const docName = state.docName || 'global';
  saveOcrData(docName, payload).catch((err) => { console.warn('[ocr] error:', err?.message); });
}

export async function loadOcrTextDataAsync() {
  const docName = state.docName || 'global';
  try {
    const idbData = await loadOcrData(docName);
    if (idbData) return idbData;
  } catch (err) { log.warn('fallthrough:', err?.message); }
  return loadOcrTextData();
}

// ─── Workspace payload build/apply ──────────────────────────────────────────

export function buildWorkspacePayload() {
  const pages = {};
  for (let page = 1; page <= state.pageCount; page += 1) {
    const strokes = _deps.loadStrokes(page);
    const comments = _deps.loadComments(page);
    if (strokes.length || comments.length) {
      pages[String(page)] = { strokes, comments };
    }
  }

  return {
    app: 'NovaReader',
    type: 'workspace-backup',
    version: 1,
    docName: state.docName,
    pageCount: state.pageCount,
    exportedAt: new Date().toISOString(),
    notes: _deps.getNotesModel(),
    bookmarks: _deps.loadBookmarks(),
    hotkeys,
    theme: localStorage.getItem('novareader-theme') || 'dark',
    pages,
    ocrText: loadOcrTextData(),
  };
}

export async function applyWorkspacePayload(payload, { skipConfirm = false } = {}) {
  if (!payload || typeof payload !== 'object' || payload.type !== 'workspace-backup') {
    throw new Error('bad workspace payload');
  }

  const sourceDoc = payload.docName || 'unknown';
  if (!skipConfirm && payload.docName && payload.docName !== state.docName) {
    const proceed = await nrConfirm(`Backup создан для «${sourceDoc}». Импортировать в «${state.docName}»?`);
    if (!proceed) {
      setWorkspaceStatus('Импорт отменён пользователем.');
      return false;
    }
  }

  const normalizedNotes = _deps.normalizeImportedNotes(payload.notes);
  if (els.notesTitle) els.notesTitle.value = normalizedNotes.title;
  if (els.notesTags) els.notesTags.value = normalizedNotes.tags;
  if (els.notes) els.notes.value = normalizedNotes.body;
  _deps.saveNotes('manual');

  const bookmarks = Array.isArray(payload.bookmarks)
    ? payload.bookmarks.filter((x) => Number.isInteger(x?.page) && x.page >= 1 && x.page <= state.pageCount)
    : [];
  _deps.saveBookmarks(bookmarks);
  _deps.renderBookmarks();
  _deps.setBookmarksStatus('');

  if (payload.hotkeys && typeof payload.hotkeys === 'object') {
    const candidate = {
      next: _deps.normalizeHotkey(payload.hotkeys.next, defaultHotkeys.next),
      prev: _deps.normalizeHotkey(payload.hotkeys.prev, defaultHotkeys.prev),
      zoomIn: _deps.normalizeHotkey(payload.hotkeys.zoomIn, defaultHotkeys.zoomIn),
      zoomOut: _deps.normalizeHotkey(payload.hotkeys.zoomOut, defaultHotkeys.zoomOut),
      annotate: _deps.normalizeHotkey(payload.hotkeys.annotate, defaultHotkeys.annotate),
      searchFocus: _deps.normalizeHotkey(payload.hotkeys.searchFocus, defaultHotkeys.searchFocus),
      ocrPage: _deps.normalizeHotkey(payload.hotkeys.ocrPage, defaultHotkeys.ocrPage),
      fitWidth: _deps.normalizeHotkey(payload.hotkeys.fitWidth, defaultHotkeys.fitWidth),
      fitPage: _deps.normalizeHotkey(payload.hotkeys.fitPage, defaultHotkeys.fitPage),
    };
    const validation = _deps.validateHotkeys(candidate);
    if (validation.ok) {
      setHotkeys(candidate);
      localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
      _deps.renderHotkeyInputs();
      _deps.setHotkeysInputErrors([]);
      _deps.setHotkeysStatus('Hotkeys импортированы из backup.', 'success');
    }
  }

  if (payload.theme === 'light' || payload.theme === 'dark') {
    localStorage.setItem('novareader-theme', payload.theme);
    document.body.classList.toggle('light', payload.theme === 'light');
  }

  if (payload.ocrText && typeof payload.ocrText === 'object') {
    saveOcrTextData(payload.ocrText);
  }

  _deps.clearDocumentAnnotationStorage();
  _deps.clearDocumentCommentStorage();
  const pages = payload.pages && typeof payload.pages === 'object' ? payload.pages : {};
  Object.entries(pages).forEach(([pageRaw, entry]) => {
    const page = Number.parseInt(pageRaw, 10);
    const strokes = Array.isArray(entry?.strokes) ? entry.strokes : [];
    const comments = Array.isArray(entry?.comments) ? entry.comments : [];
    if (!Number.isInteger(page) || page < 1 || page > state.pageCount) return;
    const normalizedStrokes = strokes.filter((stroke) => (
      stroke && ['pen', 'highlighter', 'eraser', 'rect', 'arrow', 'line', 'circle'].includes(stroke.tool)
      && typeof stroke.size === 'number'
      && Array.isArray(stroke.points)
    ));
    const normalizedComments = comments.filter((x) => x && x.point && typeof x.text === 'string');
    _deps.saveStrokes(normalizedStrokes, page);
    _deps.saveComments(normalizedComments, page);
  });

  _deps.renderAnnotations();
  _deps.renderCommentList();
  return true;
}

// ─── Cloud push/pull ────────────────────────────────────────────────────────

export async function pushWorkspaceToCloud() {
  if (!state.adapter) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }
  const endpoint = (els.cloudSyncUrl?.value || '').trim();
  if (!endpoint) {
    setStage4Status('Укажите Cloud endpoint URL.', 'error');
    return;
  }

  const payload = buildWorkspacePayload();
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`push failed: ${response.status}`);
  }
  setStage4Status('Workspace отправлен в cloud.', 'success');
}

export async function pullWorkspaceFromCloud() {
  if (!state.adapter) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }
  const endpoint = (els.cloudSyncUrl?.value || '').trim();
  if (!endpoint) {
    setStage4Status('Укажите Cloud endpoint URL.', 'error');
    return;
  }

  const response = await fetch(endpoint, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`pull failed: ${response.status}`);
  }
  const payload = await response.json();
  const ok = await applyWorkspacePayload(payload, { skipConfirm: true });
  if (ok) {
    setWorkspaceStatus('Workspace подтянут из cloud.', 'success');
    setStage4Status('Cloud pull завершён.', 'success');
  }
}

// ─── Collaboration channel ──────────────────────────────────────────────────

export function collabChannelName() {
  return `novareader-collab:${state.docName || 'global'}`;
}

export function broadcastWorkspaceSnapshot(reason = 'manual') {
  if (!state.collabEnabled || !state.collabChannel) return;
  state.collabChannel.postMessage({
    type: 'workspace-sync',
    reason,
    payload: buildWorkspacePayload(),
    at: Date.now(),
  });
  setStage4Status(`Snapshot отправлен (${reason}).`, 'success');
}

export function toggleCollaborationChannel() {
  if (!state.adapter) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }

  if (state.collabEnabled) {
    state.collabEnabled = false;
    if (state.collabChannel) {
      state.collabChannel.close();
      state.collabChannel = null;
    }
    if (els.toggleCollab) els.toggleCollab.textContent = 'Collab: off';
    setStage4Status('Collab выключен.');
    return;
  }

  state.collabChannel = new BroadcastChannel(collabChannelName());
  state.collabChannel.onmessage = async (e) => {
    const msg = e.data;
    if (!msg || msg.type !== 'workspace-sync' || !msg.payload) return;
    try {
      const ok = await applyWorkspacePayload(msg.payload, { skipConfirm: true });
      if (ok) {
        setWorkspaceStatus('Workspace получен из collab-канала.', 'success');
        setStage4Status('Collab snapshot применён.', 'success');
      }
    } catch {
      setStage4Status('Ошибка применения collab snapshot.', 'error');
    }
  };
  state.collabEnabled = true;
  if (els.toggleCollab) els.toggleCollab.textContent = 'Collab: on';
  setStage4Status('Collab включен.', 'success');
}

// ─── OCR JSON import ────────────────────────────────────────────────────────

export async function importOcrJson(file) {
  if (!state.adapter || !file) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const pagesText = Array.isArray(payload?.pagesText)
      ? payload.pagesText.map((x) => (typeof x === 'string' ? x : ''))
      : [];
    if (!pagesText.length) {
      setStage4Status('OCR JSON: нет pagesText.', 'error');
      return;
    }
    const normalized = {
      pageCount: Math.max(state.pageCount, pagesText.length),
      pagesText,
      importedAt: new Date().toISOString(),
      source: payload?.source || 'ocr-import',
    };
    saveOcrTextData(normalized);
    if (state.adapter.type === 'djvu' && typeof state.adapter.setData === 'function' && typeof state.adapter.exportData === 'function') {
      state.adapter.setData({ ...state.adapter.exportData(), pagesText: normalized.pagesText, pageCount: normalized.pageCount });
      state.pageCount = state.adapter.getPageCount();
      if (els.pageInput) els.pageInput.max = String(state.pageCount);
      await _deps.renderPagePreviews();
      await _deps.renderCurrentPage();
    }
    setStage4Status('OCR JSON импортирован.', 'success');
  } catch {
    setStage4Status('Ошибка импорта OCR JSON.', 'error');
  }
}

// ─── Workspace bundle export/import ─────────────────────────────────────────

export function exportWorkspaceBundleJson() {
  if (!state.adapter) {
    setWorkspaceStatus('Сначала откройте документ.', 'error');
    return;
  }

  const payload = buildWorkspacePayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-workspace-backup.json`;
  a.click();
  URL.revokeObjectURL(url);
  setWorkspaceStatus('Workspace экспортирован.', 'success');
}

export async function importWorkspaceBundleJson(file) {
  if (!state.adapter || !file) {
    setWorkspaceStatus('Сначала откройте документ.', 'error');
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const ok = await applyWorkspacePayload(payload);
    if (ok) {
      setWorkspaceStatus('Workspace импортирован.', 'success');
    }
  } catch {
    setWorkspaceStatus('Ошибка импорта workspace backup.', 'error');
  }
}
