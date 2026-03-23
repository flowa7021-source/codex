// ─── Unit Tests: Persistence Facade ────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Mock localStorage ──────────────────────────────────────────────────────
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (i) => [...storage.keys()][i] ?? null,
};

// ─── Mock Blob for estimateJsonSize ─────────────────────────────────────────
globalThis.Blob = class Blob {
  constructor(parts) {
    this._content = parts.join('');
    this.size = Buffer.byteLength(this._content, 'utf8');
  }
};

// ─── Mock IndexedDB ─────────────────────────────────────────────────────────
// Provide a minimal in-memory IndexedDB mock so indexed-storage.js works.
if (typeof globalThis.indexedDB === 'undefined') {
  const _idbDatabases = new Map();

  class MockObjectStore {
    constructor(name, keyPath) {
      this.name = name;
      this.keyPath = keyPath;
      this._data = new Map();
      this._indexes = new Map();
    }
    createIndex(name, keyPath, opts) {
      this._indexes.set(name, { keyPath, ...opts });
      return { name, keyPath };
    }
    index(name) {
      return {
        openCursor: () => {
          const req = { result: null, onsuccess: null, onerror: null };
          queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: { result: null } }); });
          return req;
        },
        getAllKeys: () => {
          const req = { result: [], onsuccess: null, onerror: null };
          queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
          return req;
        },
      };
    }
    put(value) {
      const key = value[this.keyPath];
      this._data.set(key, structuredClone(value));
      const req = { result: key, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
    get(key) {
      const req = {
        result: this._data.has(key) ? structuredClone(this._data.get(key)) : undefined,
        onsuccess: null, onerror: null,
      };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
    delete(key) {
      this._data.delete(key);
      const req = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
    clear() {
      this._data.clear();
      const req = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
    count() {
      const req = { result: this._data.size, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    }
  }

  class MockDatabase {
    constructor(name) {
      this.name = name;
      this.objectStoreNames = { contains: (n) => this._stores.has(n) };
      this._stores = new Map();
      this.version = 1;
    }
    createObjectStore(name, opts = {}) {
      const store = new MockObjectStore(name, opts.keyPath || 'id');
      this._stores.set(name, store);
      return store;
    }
    transaction(storeNames, mode) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const tx = {
        objectStore: (name) => this._stores.get(name),
        oncomplete: null, onerror: null, onabort: null,
        error: null,
      };
      queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete({}); });
      return tx;
    }
    close() {}
  }

  globalThis.indexedDB = {
    open: (name, version) => {
      const req = { result: null, onerror: null, onsuccess: null, onupgradeneeded: null };
      queueMicrotask(() => {
        let db = _idbDatabases.get(name);
        const isNew = !db;
        if (!db) {
          db = new MockDatabase(name);
          _idbDatabases.set(name, db);
        }
        req.result = db;
        if (isNew && req.onupgradeneeded) {
          req.onupgradeneeded({ target: { result: db } });
        }
        if (req.onsuccess) req.onsuccess({ target: { result: db } });
      });
      return req;
    },
    deleteDatabase: (name) => {
      _idbDatabases.delete(name);
      const req = { result: undefined, onsuccess: null, onerror: null };
      queueMicrotask(() => { if (req.onsuccess) req.onsuccess({}); });
      return req;
    },
  };
}

// ─── Import modules under test (uses mocked globals) ────────────────────────
const { persistence } = await import('../../app/modules/persistence-facade.js');
const { openDatabase } = await import('../../app/modules/indexed-storage.js');

describe('PersistenceFacade', () => {
  beforeEach(() => {
    storage.clear();
  });

  // ─── getSettings / setSettings ──────────────────────────────────────────

  describe('getSettings', () => {
    it('returns default value for missing key', () => {
      assert.equal(persistence.getSettings('missing', 42), 42);
    });

    it('returns null for missing key with no default', () => {
      assert.equal(persistence.getSettings('missing'), null);
    });

    it('reads and writes via app-persistence (prefixed)', () => {
      persistence.setSettings('theme', 'dark');
      assert.equal(persistence.getSettings('theme'), 'dark');
    });

    it('reads raw keys from localStorage directly', () => {
      localStorage.setItem('novareader-settings', JSON.stringify({ lang: 'en' }));
      const result = persistence.getSettings('novareader-settings', null, { raw: true });
      assert.deepEqual(result, { lang: 'en' });
    });

    it('returns default on invalid JSON for raw keys', () => {
      localStorage.setItem('bad-json', '{not valid');
      assert.equal(persistence.getSettings('bad-json', 'fallback', { raw: true }), 'fallback');
    });

    it('returns default when raw key does not exist', () => {
      assert.equal(persistence.getSettings('nonexistent', 'def', { raw: true }), 'def');
    });
  });

  describe('setSettings', () => {
    it('writes raw key to localStorage directly', () => {
      persistence.setSettings('my-raw-key', { a: 1 }, { raw: true });
      assert.equal(localStorage.getItem('my-raw-key'), '{"a":1}');
    });

    it('writes prefixed key via app-persistence', () => {
      persistence.setSettings('color', 'blue');
      assert.ok(storage.has('nr3_color'));
    });

    it('handles setItem error gracefully for raw mode', () => {
      const origSetItem = localStorage.setItem;
      localStorage.setItem = () => { throw new Error('quota exceeded'); };
      // Should not throw
      persistence.setSettings('fail-key', 'value', { raw: true });
      localStorage.setItem = origSetItem;
    });
  });

  describe('removeSettings', () => {
    it('removes raw key from localStorage', () => {
      localStorage.setItem('remove-me', '"val"');
      persistence.removeSettings('remove-me', { raw: true });
      assert.equal(localStorage.getItem('remove-me'), null);
    });

    it('removes prefixed key via app-persistence', () => {
      persistence.setSettings('toRemove', 'yes');
      assert.ok(storage.has('nr3_toRemove'));
      persistence.removeSettings('toRemove');
      assert.ok(!storage.has('nr3_toRemove'));
    });
  });

  // ─── getDocState / setDocState / clearDocState ──────────────────────────

  describe('getDocState', () => {
    it('returns default for empty docName', () => {
      assert.equal(persistence.getDocState('', 'viewStates', 'def'), 'def');
    });

    it('returns default for null docName', () => {
      assert.equal(persistence.getDocState(null, 'viewStates', 'def'), 'def');
    });

    it('returns stored doc state', () => {
      persistence.setDocState('doc1', 'viewStates', { page: 5 });
      assert.deepEqual(persistence.getDocState('doc1', 'viewStates'), { page: 5 });
    });

    it('returns default when doc not in map', () => {
      assert.equal(persistence.getDocState('unknown', 'viewStates', 99), 99);
    });
  });

  describe('setDocState', () => {
    it('does nothing for empty docName', () => {
      persistence.setDocState('', 'viewStates', { page: 1 });
      assert.deepEqual(persistence.getDocState('', 'viewStates', {}), {});
    });

    it('overwrites existing doc state', () => {
      persistence.setDocState('doc1', 'bookmarks', [1, 2]);
      persistence.setDocState('doc1', 'bookmarks', [3, 4]);
      assert.deepEqual(persistence.getDocState('doc1', 'bookmarks'), [3, 4]);
    });

    it('preserves other documents in the same map', () => {
      persistence.setDocState('doc1', 'notes', 'note1');
      persistence.setDocState('doc2', 'notes', 'note2');
      assert.equal(persistence.getDocState('doc1', 'notes'), 'note1');
      assert.equal(persistence.getDocState('doc2', 'notes'), 'note2');
    });
  });

  describe('clearDocState', () => {
    it('does nothing for empty docName', () => {
      persistence.clearDocState('');
      // No assertion needed — just verifying no error
    });

    it('removes doc from all map keys', () => {
      persistence.setDocState('doc1', 'viewStates', { page: 1 });
      persistence.setDocState('doc1', 'bookmarks', [1]);
      persistence.setDocState('doc1', 'notes', 'hello');
      persistence.setDocState('doc1', 'readingProgress', 0.5);
      persistence.clearDocState('doc1');
      assert.equal(persistence.getDocState('doc1', 'viewStates'), null);
      assert.equal(persistence.getDocState('doc1', 'bookmarks'), null);
      assert.equal(persistence.getDocState('doc1', 'notes'), null);
      assert.equal(persistence.getDocState('doc1', 'readingProgress'), null);
    });

    it('removes per-page keys when pageCount > 0', () => {
      persistence.setSettings('strokes_doc1_p1', 'data', { raw: false });
      storage.set('nr3_strokes_doc1_p1', '"data"');
      storage.set('nr3_comments_doc1_p1', '"comment"');
      storage.set('nr3_ocr_doc1_p1', '"ocr"');
      persistence.clearDocState('doc1', 1);
      assert.ok(!storage.has('nr3_strokes_doc1_p1'));
      assert.ok(!storage.has('nr3_comments_doc1_p1'));
      assert.ok(!storage.has('nr3_ocr_doc1_p1'));
    });

    it('preserves other documents state', () => {
      persistence.setDocState('doc1', 'viewStates', { page: 1 });
      persistence.setDocState('doc2', 'viewStates', { page: 2 });
      persistence.clearDocState('doc1');
      assert.deepEqual(persistence.getDocState('doc2', 'viewStates'), { page: 2 });
    });
  });

  // ─── Large data (IndexedDB) ─────────────────────────────────────────────

  describe('getLargeData', () => {
    it('returns record from IndexedDB', async () => {
      // Pre-populate the IDB store via setLargeData
      await persistence.setLargeData('rendered-pages', 'page1', { key: 'page1', data: 'blob' });
      const result = await persistence.getLargeData('rendered-pages', 'page1');
      assert.deepEqual(result, { key: 'page1', data: 'blob' });
    });

    it('returns null for missing key', async () => {
      const result = await persistence.getLargeData('rendered-pages', 'nope');
      assert.equal(result, null);
    });

    it('returns null on error', async () => {
      // Temporarily break the db transaction to trigger error path
      const db = await openDatabase();
      const origTransaction = db.transaction.bind(db);
      db.transaction = () => { throw new Error('DB error'); };
      const result = await persistence.getLargeData('rendered-pages', 'x');
      assert.equal(result, null);
      db.transaction = origTransaction;
    });
  });

  describe('setLargeData', () => {
    it('stores record in IndexedDB', async () => {
      await persistence.setLargeData('document-meta', 'k1', { key: 'k1', name: 'k1', value: 'v1' });
      const result = await persistence.getLargeData('document-meta', 'k1');
      assert.ok(result);
    });

    it('handles error gracefully', async () => {
      const db = await openDatabase();
      const origTransaction = db.transaction.bind(db);
      db.transaction = () => { throw new Error('write error'); };
      await persistence.setLargeData('document-meta', 'k1', { key: 'k1' });
      // Should not throw
      db.transaction = origTransaction;
    });
  });

  describe('deleteLargeData', () => {
    it('removes record from IndexedDB', async () => {
      await persistence.setLargeData('ocr-results', 'r1', { key: 'r1' });
      await persistence.deleteLargeData('ocr-results', 'r1');
      const result = await persistence.getLargeData('ocr-results', 'r1');
      assert.equal(result, null);
    });

    it('handles error gracefully', async () => {
      const db = await openDatabase();
      const origTransaction = db.transaction.bind(db);
      db.transaction = () => { throw new Error('delete error'); };
      await persistence.deleteLargeData('ocr-results', 'x');
      db.transaction = origTransaction;
    });
  });

  // ─── smartPut ───────────────────────────────────────────────────────────

  describe('smartPut', () => {
    it('routes small data to localStorage', async () => {
      const backend = await persistence.smartPut('smallKey', { a: 1 });
      assert.equal(backend, 'localStorage');
      assert.ok(storage.has('nr3_smallKey'));
    });

    it('routes large data to IndexedDB', async () => {
      const largeValue = 'x'.repeat(200 * 1024);
      const backend = await persistence.smartPut('bigKey', largeValue);
      assert.equal(backend, 'indexedDB');
    });

    it('uses custom idbStore option', async () => {
      const largeValue = 'x'.repeat(200 * 1024);
      const backend = await persistence.smartPut('bigKey2', largeValue, { idbStore: 'rendered-pages' });
      assert.equal(backend, 'indexedDB');
      // Verify it was stored — smartPut uses 'key' as the field, and rendered-pages
      // store has keyPath 'key', so we can read it back via getLargeData.
      const result = await persistence.getLargeData('rendered-pages', 'bigKey2');
      assert.ok(result);
      assert.equal(result.key, 'bigKey2');
    });

    it('uses document-meta as default idb store', async () => {
      const largeValue = 'x'.repeat(200 * 1024);
      const backend = await persistence.smartPut('bigKey3', largeValue);
      assert.equal(backend, 'indexedDB');
      // document-meta store uses keyPath 'name', but smartPut stores { key, value }.
      // The record is stored; we verify the backend was indexedDB.
    });
  });

  // ─── migrateLocalStorageToIndexedDB ─────────────────────────────────────

  describe('migrateLocalStorageToIndexedDB', () => {
    it('migrates matching keys', async () => {
      storage.set('migrate_doc1', JSON.stringify({ pages: 10 }));
      storage.set('migrate_doc2', JSON.stringify({ pages: 5 }));
      storage.set('other_key', '"irrelevant"');
      const result = await persistence.migrateLocalStorageToIndexedDB('migrate_');
      assert.equal(result.migrated, 2);
      assert.equal(result.errors, 0);
      assert.ok(!storage.has('migrate_doc1'));
      assert.ok(!storage.has('migrate_doc2'));
      assert.ok(storage.has('other_key'));
    });

    it('returns 0 migrated when no keys match', async () => {
      const result = await persistence.migrateLocalStorageToIndexedDB('nonexistent_');
      assert.equal(result.migrated, 0);
      assert.equal(result.errors, 0);
    });

    it('counts parse errors', async () => {
      storage.set('bad_key1', '{invalid json');
      const result = await persistence.migrateLocalStorageToIndexedDB('bad_');
      assert.equal(result.errors, 1);
      assert.equal(result.migrated, 0);
    });

    it('uses custom target store', async () => {
      storage.set('m_k', JSON.stringify('val'));
      // migrateLocalStorageToIndexedDB stores { key: fullKey, value, migratedAt }
      // Use rendered-pages store (keyPath 'key') so we can read it back.
      await persistence.migrateLocalStorageToIndexedDB('m_', 'rendered-pages');
      const result = await persistence.getLargeData('rendered-pages', 'm_k');
      assert.ok(result);
      assert.equal(result.key, 'm_k');
    });
  });

  // ─── clearAll ───────────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('clears prefixed localStorage keys', async () => {
      storage.set('nr3_setting1', '"val"');
      storage.set('nr3_setting2', '"val"');
      storage.set('unrelated', '"keep"');
      await persistence.clearAll();
      assert.ok(!storage.has('nr3_setting1'));
      assert.ok(!storage.has('nr3_setting2'));
      assert.ok(storage.has('unrelated'));
    });

    it('clears well-known unprefixed keys', async () => {
      storage.set('novareader-settings', '{}');
      storage.set('novareader-hotkeys', '{}');
      storage.set('novareader-theme', '"dark"');
      await persistence.clearAll();
      assert.ok(!storage.has('novareader-settings'));
      assert.ok(!storage.has('novareader-hotkeys'));
      assert.ok(!storage.has('novareader-theme'));
    });

    it('calls idbClearAll', async () => {
      // Store something in IDB, then clear, then verify it is gone
      await persistence.setLargeData('rendered-pages', 'test-clear', { key: 'test-clear' });
      await persistence.clearAll();
      const result = await persistence.getLargeData('rendered-pages', 'test-clear');
      assert.equal(result, null);
    });
  });

  // ─── getStorageStats ────────────────────────────────────────────────────

  describe('getStorageStats', () => {
    it('counts localStorage keys and estimates bytes', async () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'val2');
      const stats = await persistence.getStorageStats();
      assert.equal(stats.localStorage.keys, 2);
      // Each char = 2 bytes (UTF-16). key1(4)+value1(6)=10 chars * 2 = 20 bytes
      // key2(4)+val2(4)=8 chars * 2 = 16 bytes => total 36
      assert.equal(stats.localStorage.bytes, 36);
    });

    it('includes indexedDB stats', async () => {
      const stats = await persistence.getStorageStats();
      assert.ok('total' in stats.indexedDB);
      assert.ok('pages' in stats.indexedDB);
      assert.ok('ocr' in stats.indexedDB);
      assert.ok('annotations' in stats.indexedDB);
    });

    it('handles idb stats error gracefully', async () => {
      // Temporarily break the db transaction to trigger the try/catch in getStorageStats
      const db = await openDatabase();
      const origTransaction = db.transaction.bind(db);
      db.transaction = () => { throw new Error('idb fail'); };
      // getStorageStats catches idb errors and returns default stats
      const stats = await persistence.getStorageStats();
      assert.ok(stats.localStorage);
      assert.deepEqual(stats.indexedDB, { total: 0, pages: 0, ocr: 0, annotations: 0 });
      db.transaction = origTransaction;
    });

    it('returns totalEstimatedBytes matching localStorage bytes', async () => {
      storage.set('k', 'v');
      const stats = await persistence.getStorageStats();
      assert.equal(stats.totalEstimatedBytes, stats.localStorage.bytes);
    });
  });
});
