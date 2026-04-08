// @ts-check
// ─── Background Sync Queue ────────────────────────────────────────────────────
// Persists pending cloud operations to IndexedDB so they can be replayed
// when connectivity is restored via the Service Worker Background Sync API.

const DB_NAME = 'novareader-sync';
const DB_VERSION = 1;
const STORE_NAME = 'sync-queue';
const SW_SYNC_TAG = 'cloud-sync';

export interface SyncOperation {
  id: string;
  type: 'upload' | 'download' | 'delete';
  providerId: string;
  fileId?: string;
  fileName?: string;
  data?: ArrayBuffer;
  mimeType?: string;
  createdAt: number;
  retries: number;
}

let _db: IDBDatabase | null = null;

/**
 * Open or return the sync queue IndexedDB database.
 */
async function openSyncDb(): Promise<IDBDatabase> {
  if (_db) return _db;

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      _db = (event.target as IDBOpenDBRequest).result;
      resolve(_db);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate a unique ID for a sync operation.
 */
function generateId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Checks whether Background Sync is supported in this environment.
 */
export function isSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'SyncManager' in window;
}

/**
 * Add a new operation to the IDB queue and register a Background Sync tag
 * with the Service Worker (if available).
 *
 * @returns The generated operation ID.
 */
export async function enqueueSyncOperation(
  op: Omit<SyncOperation, 'id' | 'createdAt' | 'retries'>,
): Promise<string> {
  const id = generateId();
  const record: SyncOperation = {
    ...op,
    id,
    createdAt: Date.now(),
    retries: 0,
  };

  const db = await openSyncDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Register Background Sync tag if SW + SyncManager are available
  if (isSyncSupported()) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // SyncManager is a browser API; cast to avoid TS complaints in non-browser envs
      const syncManager = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
      if (syncManager) {
        await syncManager.register(SW_SYNC_TAG);
      }
    } catch {
      // SW not available or sync registration failed — silently ignore
    }
  }

  return id;
}

/**
 * Return the oldest pending operation (FIFO by createdAt), or null if the
 * queue is empty. The operation is NOT removed from the queue.
 */
export async function dequeueSyncOperation(): Promise<SyncOperation | null> {
  const db = await openSyncDb();

  const all = await new Promise<SyncOperation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as SyncOperation[]) || []);
    req.onerror = () => reject(req.error);
  });

  if (all.length === 0) return null;

  // Sort ascending by createdAt to get the oldest first
  all.sort((a, b) => a.createdAt - b.createdAt);
  return all[0];
}

/**
 * Remove a completed (or permanently failed) operation from the queue.
 */
export async function removeSyncOperation(id: string): Promise<void> {
  const db = await openSyncDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Return the number of pending operations in the queue.
 */
export async function getPendingCount(): Promise<number> {
  const db = await openSyncDb();

  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Return all pending operations sorted oldest-first by createdAt.
 */
export async function getAllPending(): Promise<SyncOperation[]> {
  const db = await openSyncDb();

  const all = await new Promise<SyncOperation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as SyncOperation[]) || []);
    req.onerror = () => reject(req.error);
  });

  return all.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Clear the entire sync queue.
 */
export async function clearAll(): Promise<void> {
  const db = await openSyncDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Reset the cached DB reference (for testing only).
 * @internal
 */
export function _resetDbForTesting(): void {
  _db = null;
}
