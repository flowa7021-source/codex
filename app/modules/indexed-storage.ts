// ─── IndexedDB Storage ──────────────────────────────────────────────────────
// Persistent storage for rendered pages, OCR data, annotations. LRU eviction.

const DB_NAME = 'novareader-cache';
const DB_VERSION = 1;

const STORES = {
  pages: 'rendered-pages',      // cached page renders (Blob)
  ocr: 'ocr-results',           // OCR text results
  annotations: 'annotations',    // annotation data per doc
  documents: 'document-meta',    // document metadata
};

const _MAX_CACHE_SIZE_MB = 200;
const MAX_CACHE_ENTRIES = 1000;

let db: IDBDatabase | null = null;

/**
 * Open or create the IndexedDB database.
 */
export async function openDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = (event.target as any).result as IDBDatabase;

      // Rendered pages store
      if (!database.objectStoreNames.contains(STORES.pages)) {
        const store = database.createObjectStore(STORES.pages, { keyPath: 'key' });
        store.createIndex('docName', 'docName', { unique: false });
        store.createIndex('accessedAt', 'accessedAt', { unique: false });
      }

      // OCR results store
      if (!database.objectStoreNames.contains(STORES.ocr)) {
        const store = database.createObjectStore(STORES.ocr, { keyPath: 'key' });
        store.createIndex('docName', 'docName', { unique: false });
      }

      // Annotations store
      if (!database.objectStoreNames.contains(STORES.annotations)) {
        const store = database.createObjectStore(STORES.annotations, { keyPath: 'key' });
        store.createIndex('docName', 'docName', { unique: false });
      }

      // Document metadata
      if (!database.objectStoreNames.contains(STORES.documents)) {
        database.createObjectStore(STORES.documents, { keyPath: 'name' });
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as any).result as IDBDatabase;
      resolve(db!);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Store a rendered page in cache.
 */
export async function cachePageRender(
  docName: string,
  pageNum: number,
  blob: Blob,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const database = await openDatabase();
  const key = `${docName}:page:${pageNum}`;

  const tx = database.transaction(STORES.pages, 'readwrite');
  tx.objectStore(STORES.pages).put({
    key,
    docName,
    pageNum,
    blob,
    size: blob.size,
    accessedAt: Date.now(),
    ...meta,
  });

  await txComplete(tx);
  await _evictIfNeeded(STORES.pages);
}

/**
 * Retrieve a cached page render.
 */
export async function getCachedPageRender(docName: string, pageNum: number): Promise<Blob | null> {
  const database = await openDatabase();
  const key = `${docName}:page:${pageNum}`;

  const tx = database.transaction(STORES.pages, 'readwrite');
  const store = tx.objectStore(STORES.pages);
  const record = await getRecord(store, key) as { blob: Blob; accessedAt: number } | null;

  if (record) {
    // Update access time (LRU)
    record.accessedAt = Date.now();
    store.put(record);
    return record.blob;
  }
  return null;
}

/**
 * Store OCR result for a page.
 */
export async function cacheOcrResult(
  docName: string,
  pageNum: number,
  ocrResult: Record<string, unknown>,
): Promise<void> {
  const database = await openDatabase();
  const key = `${docName}:ocr:${pageNum}`;

  const tx = database.transaction(STORES.ocr, 'readwrite');
  tx.objectStore(STORES.ocr).put({
    key,
    docName,
    pageNum,
    ...ocrResult,
    cachedAt: Date.now(),
  });

  await txComplete(tx);
}

/**
 * Retrieve cached OCR result.
 */
export async function getCachedOcrResult(
  docName: string,
  pageNum: number,
): Promise<Record<string, unknown> | null> {
  const database = await openDatabase();
  const key = `${docName}:ocr:${pageNum}`;

  const tx = database.transaction(STORES.ocr, 'readonly');
  return getRecord(tx.objectStore(STORES.ocr), key) as Promise<Record<string, unknown> | null>;
}

/**
 * Store annotations for a document.
 */
export async function saveAnnotations(
  docName: string,
  pageNum: number,
  annotations: Array<unknown>,
): Promise<void> {
  const database = await openDatabase();
  const key = `${docName}:annot:${pageNum}`;

  const tx = database.transaction(STORES.annotations, 'readwrite');
  tx.objectStore(STORES.annotations).put({
    key,
    docName,
    pageNum,
    annotations,
    savedAt: Date.now(),
  });

  await txComplete(tx);
}

/**
 * Load annotations for a page.
 */
export async function loadAnnotations(
  docName: string,
  pageNum: number,
): Promise<Array<unknown> | null> {
  const database = await openDatabase();
  const key = `${docName}:annot:${pageNum}`;

  const tx = database.transaction(STORES.annotations, 'readonly');
  const record = await getRecord(tx.objectStore(STORES.annotations), key) as { annotations: Array<unknown> } | null;
  return record?.annotations || null;
}

/**
 * Clear all cached data for a document.
 */
export async function clearDocumentCache(docName: string): Promise<void> {
  const database = await openDatabase();

  for (const storeName of [STORES.pages, STORES.ocr, STORES.annotations]) {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const index = store.index('docName');
    const range = IDBKeyRange.only(docName);

    const keys = await getAllKeys(index, range);
    for (const key of keys) {
      store.delete(key);
    }
    await txComplete(tx);
  }
}

/**
 * Get total storage usage in bytes.
 */
export async function getStorageUsage(): Promise<{ total: number; pages: number; ocr: number; annotations: number }> {
  const database = await openDatabase();
  const usage: { total: number; pages: number; ocr: number; annotations: number; [key: string]: number } = { total: 0, pages: 0, ocr: 0, annotations: 0 };

  for (const [label, storeName] of Object.entries(STORES)) {
    if (label === 'documents') continue;
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const count = await countRecords(store);
    usage[label] = count;
    usage.total += count;
  }

  return usage;
}

/**
 * Clear all cached data.
 */
export async function clearAllCache(): Promise<void> {
  const database = await openDatabase();
  for (const storeName of Object.values(STORES)) {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    await txComplete(tx);
  }
}

// ─── LRU Eviction ───────────────────────────────────────────────────────────

async function _evictIfNeeded(storeName: string): Promise<void> {
  const database = await openDatabase();
  const tx = database.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const count = await countRecords(store);

  if (count <= MAX_CACHE_ENTRIES) return;

  // Evict oldest entries (by accessedAt)
  const index = store.index('accessedAt');
  const toEvict = count - Math.floor(MAX_CACHE_ENTRIES * 0.8);

  let evicted = 0;
  let safetyCounter = 0;
  const cursor = index.openCursor();

  await new Promise<void>((resolve, reject) => {
    cursor.onsuccess = (event) => {
      if (++safetyCounter > toEvict + 50) { resolve(); return; }
      const c = (event.target as any).result as IDBCursorWithValue | null;
      if (c && evicted < toEvict) {
        c.delete();
        evicted++;
        c.continue();
      } else {
        resolve();
      }
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getRecord(store: IDBObjectStore, key: string): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function getAllKeys(index: IDBIndex, range: IDBKeyRange): Promise<IDBValidKey[]> {
  return new Promise<IDBValidKey[]>((resolve, reject) => {
    const req = index.getAllKeys(range);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function countRecords(store: IDBObjectStore): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
