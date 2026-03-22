// @ts-check
// ─── Auto-save & Crash Recovery ─────────────────────────────────────────────
// Periodic session snapshots to IndexedDB with recovery on unclean exit.

import { safeInterval, safeTimeout, clearSafeInterval } from './safe-timers.js';

const DB_NAME = 'novareader-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const MAX_SNAPSHOTS = 3;
const DEFAULT_INTERVAL_MS = 30_000;
const LS_FALLBACK_KEY = 'novareader-autosave-fallback';

/** @type {IDBDatabase|null} */
let _db = null;

/** @type {number|null} */
let _timerId = null;

/** @type {string} */
let _sessionId = `as-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** @type {boolean} */
let _isDocumentOpen = false;

/** @type {number} */
let _intervalMs = DEFAULT_INTERVAL_MS;

/** @type {{state: object, els: object, getAnnotations: Function, setAnnotations: Function, showToast: Function}|null} */
let _deps = null;

/** @type {boolean} */
let _useIndexedDB = true;

// ─── IndexedDB Helpers ──────────────────────────────────────────────────────

function _openDb() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      _useIndexedDB = false;
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = /** @type {any} */ (event.target).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('wasCleanExit', 'wasCleanExit', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      _db = /** @type {any} */ (event.target).result;
      resolve(_db);
    };

    request.onerror = () => {
      _useIndexedDB = false;
      reject(request.error);
    };
  });
}

function _txComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function _getRecord(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function _getAllRecords(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ─── localStorage Fallback ──────────────────────────────────────────────────

function _lsFallbackSave(snapshot) {
  try {
    let snapshots = [];
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (raw) snapshots = JSON.parse(raw);
    } catch (_e) { console.warn('[autosave] failed to parse localStorage fallback:', _e?.message); }

    // Replace existing or append
    const idx = snapshots.findIndex(s => s.sessionId === snapshot.sessionId);
    if (idx >= 0) {
      snapshots[idx] = snapshot;
    } else {
      snapshots.push(snapshot);
    }

    // Evict oldest beyond max
    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots.sort((a, b) => b.timestamp - a.timestamp);
      snapshots = snapshots.slice(0, MAX_SNAPSHOTS);
    }

    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(snapshots));
  } catch (_e) {
    console.warn('[autosave] localStorage fallback save failed');
  }
}

function _lsFallbackGetUnclean() {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return null;
    const snapshots = JSON.parse(raw);
    const unclean = snapshots
      .filter(s => s.wasCleanExit === false)
      .sort((a, b) => b.timestamp - a.timestamp);
    return unclean[0] || null;
  } catch (_e) {
    return null;
  }
}

function _lsFallbackMarkClean(sessionId) {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return;
    const snapshots = JSON.parse(raw);
    const target = snapshots.find(s => s.sessionId === sessionId);
    if (target) {
      target.wasCleanExit = true;
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(snapshots));
    }
  } catch (_e) { console.warn('[autosave] failed to mark clean in localStorage:', _e?.message); }
}

function _lsFallbackClear() {
  try {
    localStorage.removeItem(LS_FALLBACK_KEY);
  } catch (_e) { console.warn('[autosave] failed to clear localStorage fallback:', _e?.message); }
}

// ─── Snapshot Building ──────────────────────────────────────────────────────

function _buildSnapshot() {
  if (!_deps) return null;
  const { state, els, getAnnotations } = _deps;
  if (!state.adapter || !state.docName) return null;

  const scrollEl = els.canvasWrap;
  const scrollPosition = {
    top: scrollEl ? scrollEl.scrollTop : 0,
    left: scrollEl ? scrollEl.scrollLeft : 0,
  };

  let annotations = null;
  try {
    annotations = getAnnotations();
  } catch (_e) { console.warn('[autosave] annotations not available:', _e?.message); }

  let bookmarks = [];
  try {
    const raw = localStorage.getItem(`novareader-bookmarks-${state.docName}`);
    if (raw) bookmarks = JSON.parse(raw);
  } catch (_e) { console.warn('[autosave] failed to read bookmarks:', _e?.message); }

  const ocrPages = [];
  try {
    for (let p = 1; p <= state.pageCount; p++) {
      const key = `ocrText_${state.docName}_page_${p}`;
      if (localStorage.getItem(key)) {
        ocrPages.push(p);
      }
    }
  } catch (_e) { console.warn('[autosave] failed to enumerate OCR pages:', _e?.message); }

  return {
    sessionId: _sessionId,
    fileName: state.docName,
    filePath: state.file?.name || null,
    currentPage: state.currentPage,
    zoom: state.zoom,
    rotation: state.rotation,
    scrollPosition,
    annotations,
    bookmarks,
    ocrPages,
    timestamp: Date.now(),
    wasCleanExit: false,
  };
}

// ─── Core Save Logic ────────────────────────────────────────────────────────

async function _saveToIndexedDB(snapshot) {
  const database = await _openDb();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  store.put(snapshot);
  await _txComplete(tx);

  // Evict oldest beyond MAX_SNAPSHOTS
  const txRead = database.transaction(STORE_NAME, 'readwrite');
  const readStore = txRead.objectStore(STORE_NAME);
  const all = await _getAllRecords(readStore);

  if (all.length > MAX_SNAPSHOTS) {
    all.sort((a, b) => b.timestamp - a.timestamp);
    const toDelete = all.slice(MAX_SNAPSHOTS);
    const txDel = database.transaction(STORE_NAME, 'readwrite');
    const delStore = txDel.objectStore(STORE_NAME);
    for (const old of toDelete) {
      delStore.delete(old.sessionId);
    }
    await _txComplete(txDel);
  }
}

async function _performSave() {
  if (!_isDocumentOpen || !_deps) return;

  // Avoid saving during heavy render operations
  const renderStart = performance.now();
  const snapshot = _buildSnapshot();
  const buildMs = performance.now() - renderStart;

  if (!snapshot) return;

  // Skip if snapshot building took too long (>100ms indicates heavy rendering)
  if (buildMs > 100) {
    console.warn(`[autosave] snapshot build took ${Math.round(buildMs)}ms, skipping save`);
    return;
  }

  try {
    if (_useIndexedDB) {
      await _saveToIndexedDB(snapshot);
    } else {
      _lsFallbackSave(snapshot);
    }
  } catch (err) {
    console.warn('[autosave] save failed, trying localStorage fallback:', err?.message);
    _useIndexedDB = false;
    _lsFallbackSave(snapshot);
  }
}

// ─── Timer Management ───────────────────────────────────────────────────────

function _startTimer() {
  _stopTimer();
  _timerId = safeInterval(() => {
    _performSave().catch(err => {
      console.warn('[autosave] periodic save error:', err?.message);
    });
  }, _intervalMs);
}

function _stopTimer() {
  if (_timerId !== null) {
    clearSafeInterval(_timerId);
    _timerId = null;
  }
}

// ─── Recovery Banner UI ─────────────────────────────────────────────────────

function _formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function _showRecoveryBanner(snapshot) {
  return new Promise((resolve) => {
    const banner = document.getElementById('recoveryBanner');
    const tsEl = document.getElementById('recoveryTimestamp');
    const restoreBtn = document.getElementById('recoveryRestore');
    const dismissBtn = document.getElementById('recoveryDismiss');

    if (!banner || !restoreBtn || !dismissBtn) {
      resolve(null);
      return;
    }

    if (tsEl) {
      tsEl.textContent = ` от ${_formatTimestamp(snapshot.timestamp)}`;
    }

    banner.style.display = 'flex';

    const cleanup = () => {
      banner.style.display = 'none';
      restoreBtn.removeEventListener('click', onRestore);
      dismissBtn.removeEventListener('click', onDismiss);
    };

    const onRestore = () => {
      cleanup();
      resolve(snapshot);
    };

    const onDismiss = () => {
      cleanup();
      // Mark as acknowledged
      _markSnapshotClean(snapshot.sessionId).catch(() => {});
      resolve(null);
    };

    restoreBtn.addEventListener('click', onRestore);
    dismissBtn.addEventListener('click', onDismiss);
  });
}

async function _markSnapshotClean(sessionId) {
  if (_useIndexedDB) {
    try {
      const database = await _openDb();
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = await _getRecord(store, sessionId);
      if (record) {
        record.wasCleanExit = true;
        store.put(record);
        await _txComplete(tx);
      }
    } catch (_e) {
      _lsFallbackMarkClean(sessionId);
    }
  } else {
    _lsFallbackMarkClean(sessionId);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize the autosave module.
 * @param {object} deps - Dependencies
 * @param {object} deps.state - Application state
 * @param {object} deps.els - DOM element references
 * @param {Function} deps.getAnnotations - Returns current annotations
 * @param {Function} deps.setAnnotations - Restores annotations
 * @param {Function} deps.showToast - Show toast notification
 */
export function initAutosave(deps) {
  _deps = deps;
  _intervalMs = /** @type {any} */ (deps).intervalMs || DEFAULT_INTERVAL_MS;
  _sessionId = `as-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  // Try to open the DB early to detect availability
  _openDb().catch(() => {
    _useIndexedDB = false;
    console.warn('[autosave] IndexedDB not available, using localStorage fallback');
  });
}

/**
 * Trigger a manual autosave snapshot.
 */
export async function triggerAutosave() {
  await _performSave();
}

/**
 * Mark the current session snapshot as a clean exit.
 * Call this from the beforeunload handler.
 */
export async function markCleanExit() {
  _stopTimer();
  _isDocumentOpen = false;

  try {
    if (_useIndexedDB) {
      const database = await _openDb();
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = await _getRecord(store, _sessionId);
      if (record) {
        record.wasCleanExit = true;
        store.put(record);
        await _txComplete(tx);
      }
    } else {
      _lsFallbackMarkClean(_sessionId);
    }
  } catch (_e) {
    _lsFallbackMarkClean(_sessionId);
  }
}

/**
 * Check IndexedDB for unclean session snapshots.
 * If found, shows a recovery banner and returns the snapshot if user chooses to restore.
 * @returns {Promise<object|null>} The snapshot to restore, or null
 */
export async function checkForRecovery() {
  let snapshot = null;

  try {
    if (_useIndexedDB) {
      const database = await _openDb();
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const all = await _getAllRecords(store);

      const unclean = all
        .filter(s => s.wasCleanExit === false)
        .sort((a, b) => b.timestamp - a.timestamp);

      snapshot = unclean[0] || null;
    }
  } catch (_e) {
    console.warn('[autosave] IndexedDB recovery check failed:', _e?.message);
    _useIndexedDB = false;
  }

  if (!snapshot) {
    snapshot = _lsFallbackGetUnclean();
  }

  if (!snapshot) return null;

  // Don't show recovery for very old snapshots (>24h)
  const age = Date.now() - snapshot.timestamp;
  if (age > 24 * 60 * 60 * 1000) {
    await _markSnapshotClean(snapshot.sessionId);
    return null;
  }

  return _showRecoveryBanner(snapshot);
}

/**
 * Clear all autosave snapshots from IndexedDB and localStorage.
 */
export async function clearRecoveryData() {
  try {
    if (_useIndexedDB) {
      const database = await _openDb();
      const tx = database.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      await _txComplete(tx);
    }
  } catch (_e) { console.warn('[autosave] failed to clear IndexedDB recovery data:', _e?.message); }

  _lsFallbackClear();
}

/**
 * Signal that a document has been opened. Starts the autosave timer.
 */
export function startAutosaveTimer() {
  _isDocumentOpen = true;
  _startTimer();
  // Perform an immediate save
  _performSave().catch(err => {
    console.warn('[autosave] initial save error:', err?.message);
  });
}

/**
 * Signal that the document has been closed. Stops the autosave timer.
 */
export function stopAutosaveTimer() {
  _isDocumentOpen = false;
  _stopTimer();
}

/**
 * Apply a recovered snapshot to restore session state.
 * @param {object} snapshot - The snapshot to restore
 */
export function applyRecoveredSnapshot(snapshot) {
  if (!_deps || !snapshot) return;
  const { state, els, setAnnotations, showToast } = _deps;

  if (snapshot.currentPage && snapshot.currentPage >= 1) {
    state.currentPage = snapshot.currentPage;
  }

  if (snapshot.zoom && snapshot.zoom > 0) {
    state.zoom = snapshot.zoom;
  }

  if (typeof snapshot.rotation === 'number') {
    state.rotation = snapshot.rotation;
  }

  // Restore scroll position after a brief delay to let render complete
  if (snapshot.scrollPosition && els.canvasWrap) {
    safeTimeout(() => {
      els.canvasWrap.scrollTop = snapshot.scrollPosition.top || 0;
      els.canvasWrap.scrollLeft = snapshot.scrollPosition.left || 0;
    }, 200);
  }

  // Restore annotations
  if (snapshot.annotations) {
    try {
      setAnnotations(snapshot.annotations);
    } catch (_e) {
      console.warn('[autosave] failed to restore annotations');
    }
  }

  if (showToast) {
    showToast('Сессия восстановлена');
  }
}
