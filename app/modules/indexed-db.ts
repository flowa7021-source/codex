// @ts-check
// ─── IndexedDB Utilities ─────────────────────────────────────────────────────
// Simple IndexedDB wrapper with Promise-based API.

// ─── Database open ───────────────────────────────────────────────────────────

/** Open (or create) an IndexedDB database. Returns a handle or null on failure. */
export async function openDB(
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase, oldVersion: number) => void,
): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(name, version);
    } catch {
      resolve(null);
      return;
    }

    req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      onUpgrade(db, event.oldVersion);
    };

    req.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    req.onerror = () => {
      resolve(null);
    };
  });
}

// ─── Object store operations ─────────────────────────────────────────────────

/** Put a value into an object store. Returns true on success. */
export async function dbPut(
  db: IDBDatabase,
  storeName: string,
  value: unknown,
  key?: IDBValidKey,
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = key !== undefined ? store.put(value, key) : store.put(value);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Get a value by key from an object store. Returns null if not found. */
export async function dbGet<T>(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = (event: Event) => {
        const result = (event.target as IDBRequest).result;
        resolve(result !== undefined ? (result as T) : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Delete a key from an object store. Returns true on success. */
export async function dbDelete(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Get all values from an object store. */
export async function dbGetAll<T>(
  db: IDBDatabase,
  storeName: string,
): Promise<T[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = (event: Event) => {
        resolve((event.target as IDBRequest).result as T[]);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/** Clear all records from an object store. Returns true on success. */
export async function dbClear(
  db: IDBDatabase,
  storeName: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Count records in an object store. */
export async function dbCount(
  db: IDBDatabase,
  storeName: string,
): Promise<number> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = (event: Event) => {
        resolve((event.target as IDBRequest).result as number);
      };
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}
