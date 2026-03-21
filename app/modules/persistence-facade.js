// ─── Persistence Facade ─────────────────────────────────────────────────────
// Unified persistence API for NovaReader.
// Provides a single interface for all storage needs.
// Backend: localStorage for small data (<100KB), IndexedDB for large data.
//
// Consolidates three existing patterns:
//   1. Direct localStorage calls (settings-controller.js, etc.)
//   2. AppPersistence module (app-persistence.js) with nr3_ prefix
//   3. IndexedDB via indexed-storage.js for rendered pages, OCR cache, blobs

import {
  save as apSave,
  load as apLoad,
  remove as apRemove,
} from './app-persistence.js';

import {
  openDatabase,
  clearAllCache as idbClearAll,
  getStorageUsage as idbGetUsage,
} from './indexed-storage.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'nr3_';
const SIZE_THRESHOLD_BYTES = 100 * 1024; // 100 KB

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Estimate the byte size of a value when serialized to JSON.
 * @param {any} value
 * @returns {number}
 */
function estimateJsonSize(value) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

/**
 * Generic IDB get helper.  Opens the database, runs a readonly transaction,
 * and returns the record (or null).
 */
async function idbGet(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic IDB put helper.
 */
async function idbPut(storeName, record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Generic IDB delete helper.
 */
async function idbDelete(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Collect all localStorage keys that match a given prefix.
 * @param {string} prefix
 * @returns {string[]}
 */
function localStorageKeysWithPrefix(prefix) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      keys.push(k);
    }
  }
  return keys;
}

// ─── Facade ─────────────────────────────────────────────────────────────────

export const persistence = {

  // ── Settings (localStorage) ─────────────────────────────────────────────
  // Wraps app-persistence save/load with the nr3_ prefix transparently.
  // Also supports direct (unprefixed) keys used by settings-controller.js
  // (e.g. 'novareader-settings', 'novareader-hotkeys', 'novareader-theme').

  /**
   * Read a settings value.
   * For prefixed keys (app-persistence style) pass the short key; the nr3_
   * prefix is added automatically.  For legacy unprefixed keys pass the full
   * key and set `options.raw = true`.
   *
   * @param {string} key
   * @param {any}    [defaultValue=null]
   * @param {object} [options]
   * @param {boolean} [options.raw=false] - If true, read the key as-is (no prefix).
   * @returns {any}
   */
  getSettings(key, defaultValue = null, options = {}) {
    if (options.raw) {
      try {
        const raw = localStorage.getItem(key);
        return raw !== null ? JSON.parse(raw) : defaultValue;
      } catch {
        return defaultValue;
      }
    }
    return apLoad(key, defaultValue);
  },

  /**
   * Write a settings value.
   * @param {string}  key
   * @param {any}     value
   * @param {object}  [options]
   * @param {boolean} [options.raw=false]
   */
  setSettings(key, value, options = {}) {
    if (options.raw) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.warn('[persistence-facade] setSettings error:', err?.message);
      }
      return;
    }
    apSave(key, value);
  },

  /**
   * Remove a settings key.
   * @param {string}  key
   * @param {object}  [options]
   * @param {boolean} [options.raw=false]
   */
  removeSettings(key, options = {}) {
    if (options.raw) {
      localStorage.removeItem(key);
      return;
    }
    apRemove(key);
  },

  // ── Document state (localStorage, keyed by docName) ─────────────────────
  // Per-document small state: view position, bookmarks, notes, reading
  // progress.  Stored inside nested objects under the nr3_ prefix via
  // app-persistence (e.g. nr3_viewStates, nr3_bookmarks, etc.).

  /**
   * Read a per-document value that lives inside a top-level map.
   * Equivalent to: load(mapKey, {})[docName]  or  defaultValue.
   *
   * @param {string} docName
   * @param {string} key       - The map key (e.g. 'viewStates', 'bookmarks').
   * @param {any}    [defaultValue=null]
   * @returns {any}
   */
  getDocState(docName, key, defaultValue = null) {
    if (!docName) return defaultValue;
    const map = apLoad(key, {});
    return map[docName] !== undefined ? map[docName] : defaultValue;
  },

  /**
   * Write a per-document value into a top-level map.
   *
   * @param {string} docName
   * @param {string} key
   * @param {any}    value
   */
  setDocState(docName, key, value) {
    if (!docName) return;
    const map = apLoad(key, {});
    map[docName] = value;
    apSave(key, map);
  },

  /**
   * Remove all state for a specific document across all known map keys and
   * per-page keys.
   *
   * @param {string} docName
   * @param {number} [pageCount=0] - If provided, also cleans per-page keys.
   */
  clearDocState(docName, pageCount = 0) {
    if (!docName) return;

    // Remove from map-style keys
    const mapKeys = ['viewStates', 'bookmarks', 'notes', 'readingProgress'];
    for (const mk of mapKeys) {
      const map = apLoad(mk, {});
      if (docName in map) {
        delete map[docName];
        apSave(mk, map);
      }
    }

    // Remove per-page keys (strokes, comments, ocr)
    for (let p = 1; p <= pageCount; p++) {
      apRemove(`strokes_${docName}_p${p}`);
      apRemove(`comments_${docName}_p${p}`);
      apRemove(`ocr_${docName}_p${p}`);
    }
  },

  // ── Large data (IndexedDB) ──────────────────────────────────────────────
  // Rendered page blobs, full OCR results, annotations, document metadata.
  // Thin wrappers around indexed-storage.js that accept arbitrary store
  // names so callers do not need to import indexed-storage directly.

  /**
   * Read a record from IndexedDB.
   *
   * @param {string} store - Object store name (e.g. 'rendered-pages').
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async getLargeData(store, key) {
    try {
      return await idbGet(store, key);
    } catch (err) {
      console.warn('[persistence-facade] getLargeData error:', err?.message);
      return null;
    }
  },

  /**
   * Write a record to IndexedDB.
   *
   * @param {string} store
   * @param {string} key
   * @param {any}    value  - Stored as-is (should include the keyPath field).
   * @returns {Promise<void>}
   */
  async setLargeData(store, key, value) {
    try {
      await idbPut(store, value);
    } catch (err) {
      console.warn('[persistence-facade] setLargeData error:', err?.message);
    }
  },

  /**
   * Delete a record from IndexedDB.
   *
   * @param {string} store
   * @param {string} key
   * @returns {Promise<void>}
   */
  async deleteLargeData(store, key) {
    try {
      await idbDelete(store, key);
    } catch (err) {
      console.warn('[persistence-facade] deleteLargeData error:', err?.message);
    }
  },

  // ── Smart put ───────────────────────────────────────────────────────────
  // Automatically routes to localStorage or IndexedDB based on size.

  /**
   * Store data, choosing the backend based on serialized size.
   * Values under SIZE_THRESHOLD_BYTES go to localStorage (via app-persistence);
   * larger values go to IndexedDB ('document-meta' store by default).
   *
   * @param {string} key
   * @param {any}    value
   * @param {object} [options]
   * @param {string} [options.idbStore='document-meta'] - IndexedDB store for large data.
   * @returns {Promise<'localStorage'|'indexedDB'>} - Which backend was used.
   */
  async smartPut(key, value, options = {}) {
    const size = estimateJsonSize(value);
    if (size < SIZE_THRESHOLD_BYTES) {
      apSave(key, value);
      return 'localStorage';
    }
    const store = options.idbStore || 'document-meta';
    await idbPut(store, { key, value, savedAt: Date.now() });
    return 'indexedDB';
  },

  // ── Migration helper ──────────────────────────────────────────────────

  /**
   * Move all localStorage entries whose key starts with `prefix` into an
   * IndexedDB object store.  After a successful copy the localStorage entry
   * is removed.
   *
   * @param {string} prefix      - localStorage key prefix to migrate.
   * @param {string} [targetStore='document-meta'] - Target IDB store.
   * @returns {Promise<{migrated: number, errors: number}>}
   */
  async migrateLocalStorageToIndexedDB(prefix, targetStore = 'document-meta') {
    const keys = localStorageKeysWithPrefix(prefix);
    let migrated = 0;
    let errors = 0;

    for (const fullKey of keys) {
      try {
        const raw = localStorage.getItem(fullKey);
        if (raw === null) continue;

        const value = JSON.parse(raw);
        await idbPut(targetStore, {
          key: fullKey,
          value,
          migratedAt: Date.now(),
        });

        localStorage.removeItem(fullKey);
        migrated++;
      } catch (err) {
        console.warn(`[persistence-facade] migration error for key "${fullKey}":`, err?.message);
        errors++;
      }
    }

    return { migrated, errors };
  },

  // ── Cleanup ───────────────────────────────────────────────────────────

  /**
   * Clear ALL persisted data (both localStorage and IndexedDB).
   * Use with caution.
   *
   * @returns {Promise<void>}
   */
  async clearAll() {
    // Clear prefixed localStorage entries
    const prefixedKeys = localStorageKeysWithPrefix(STORAGE_PREFIX);
    for (const k of prefixedKeys) {
      localStorage.removeItem(k);
    }

    // Clear well-known unprefixed keys used by settings-controller
    const unprefixedKeys = [
      'novareader-settings',
      'novareader-hotkeys',
      'novareader-theme',
    ];
    for (const k of unprefixedKeys) {
      localStorage.removeItem(k);
    }

    // Clear IndexedDB stores
    await idbClearAll();
  },

  // ── Storage statistics ────────────────────────────────────────────────

  /**
   * Gather usage statistics for both backends.
   *
   * @returns {Promise<{
   *   localStorage: { keys: number, bytes: number },
   *   indexedDB: { total: number, pages: number, ocr: number, annotations: number },
   *   totalEstimatedBytes: number
   * }>}
   */
  async getStorageStats() {
    // localStorage stats
    let lsBytes = 0;
    let lsKeys = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) || '';
      // Each char in localStorage is stored as UTF-16 (2 bytes).
      lsBytes += (k.length + v.length) * 2;
      lsKeys++;
    }

    // IndexedDB stats (record counts from indexed-storage)
    let idbStats = { total: 0, pages: 0, ocr: 0, annotations: 0 };
    try {
      idbStats = await idbGetUsage();
    } catch (err) {
      console.warn('[persistence-facade] idb stats error:', err?.message);
    }

    return {
      localStorage: { keys: lsKeys, bytes: lsBytes },
      indexedDB: idbStats,
      totalEstimatedBytes: lsBytes, // IDB counts are record-counts, not bytes
    };
  },
};

export default persistence;
