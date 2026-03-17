// ─── OCR IndexedDB Storage Module ────────────────────────────────────────────
// Replaces localStorage for OCR data with IndexedDB.
// Handles large OCR datasets (hundreds of pages) without hitting
// localStorage's ~5MB limit. Fully offline — no network calls.

const DB_NAME = 'novareader-ocr';
const DB_VERSION = 1;
const STORE_NAME = 'ocr-pages';

let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('docName', 'docName', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      request.onerror = () => {
        reject(new Error('IndexedDB open failed'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

function getStore(mode = 'readonly') {
  return openDb().then((db) => {
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save OCR text data for a document.
 * @param {string} docName
 * @param {{ pagesText: string[], source?: string, scannedPages?: number, totalPages?: number }} data
 */
export async function saveOcrData(docName, data) {
  try {
    const store = await getStore('readwrite');
    const record = {
      id: `ocr:${docName}`,
      docName,
      pagesText: data.pagesText || [],
      source: data.source || 'manual',
      scannedPages: data.scannedPages || 0,
      totalPages: data.totalPages || 0,
      updatedAt: new Date().toISOString(),
    };
    await idbRequest(store.put(record));
  } catch {
    // Fallback to localStorage
    try {
      const key = `novareader-ocr-text:${docName}`;
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* storage full, ignore */ }
  }
}

/**
 * Load OCR text data for a document.
 * @param {string} docName
 * @returns {Promise<{pagesText: string[], source: string, scannedPages: number, totalPages: number}|null>}
 */
export async function loadOcrData(docName) {
  try {
    const store = await getStore('readonly');
    const record = await idbRequest(store.get(`ocr:${docName}`));
    if (record) return record;
  } catch { /* fall through */ }

  // Fallback: check localStorage
  try {
    const key = `novareader-ocr-text:${docName}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate to IndexedDB
      saveOcrData(docName, parsed).catch(() => {});
      return parsed;
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Save OCR result for a single page.
 * @param {string} docName
 * @param {number} pageNum - 1-based
 * @param {string} text
 */
export async function savePageOcrText(docName, pageNum, text) {
  const existing = await loadOcrData(docName);
  const pagesText = existing?.pagesText ? [...existing.pagesText] : [];
  while (pagesText.length < pageNum) pagesText.push('');
  pagesText[pageNum - 1] = text;
  await saveOcrData(docName, {
    ...existing,
    pagesText,
    scannedPages: pagesText.filter(Boolean).length,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Get OCR text for a single page.
 * @param {string} docName
 * @param {number} pageNum - 1-based
 * @returns {Promise<string>}
 */
export async function getPageOcrText(docName, pageNum) {
  const data = await loadOcrData(docName);
  if (!data?.pagesText) return '';
  return data.pagesText[pageNum - 1] || '';
}

/**
 * Delete all OCR data for a document.
 * @param {string} docName
 */
export async function deleteOcrData(docName) {
  try {
    const store = await getStore('readwrite');
    await idbRequest(store.delete(`ocr:${docName}`));
  } catch { /* ignore */ }
  try {
    localStorage.removeItem(`novareader-ocr-text:${docName}`);
  } catch { /* ignore */ }
}

/**
 * List all documents that have OCR data.
 * @returns {Promise<string[]>}
 */
export async function listOcrDocuments() {
  try {
    const store = await getStore('readonly');
    const all = await idbRequest(store.getAll());
    return all.map((r) => r.docName);
  } catch {
    return [];
  }
}

/**
 * Get total size of OCR data in bytes (approximate).
 * @returns {Promise<number>}
 */
export async function getOcrStorageSize() {
  try {
    const store = await getStore('readonly');
    const all = await idbRequest(store.getAll());
    let size = 0;
    for (const record of all) {
      size += JSON.stringify(record).length * 2; // UTF-16 estimate
    }
    return size;
  } catch {
    return 0;
  }
}

/**
 * Check if IndexedDB is available.
 * @returns {boolean}
 */
export function isIndexedDbAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}
