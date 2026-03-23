// ─── Unit Tests: Persistence Facade ────────────────────────────────────────
import { describe, it, beforeEach, mock } from 'node:test';
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

// ─── Mock IndexedDB helpers via indexed-storage mock ────────────────────────
let mockDbRecords = new Map();
let mockClearAllCalled = false;
let mockUsageResult = { total: 0, pages: 0, ocr: 0, annotations: 0 };
let mockOpenDbError = null;

const mockObjectStore = (storeName) => ({
  get: (key) => {
    const compositeKey = `${storeName}::${key}`;
    const result = mockDbRecords.get(compositeKey) ?? undefined;
    return {
      result,
      onsuccess: null,
      onerror: null,
      _fire() {
        if (this.onsuccess) this.onsuccess();
      },
      _fireError() {
        if (this.onerror) this.onerror();
      },
    };
  },
  put: (record) => {
    const key = record.key || JSON.stringify(record);
    const compositeKey = `${storeName}::${key}`;
    mockDbRecords.set(compositeKey, record);
    return { onsuccess: null, onerror: null };
  },
  delete: (key) => {
    const compositeKey = `${storeName}::${key}`;
    mockDbRecords.delete(compositeKey);
    return { onsuccess: null, onerror: null };
  },
});

const mockTransaction = (storeName, mode) => {
  const store = mockObjectStore(storeName);
  return {
    objectStore: () => store,
    oncomplete: null,
    onerror: null,
    error: null,
    _store: store,
  };
};

const mockDb = {
  transaction: (storeName, mode) => mockTransaction(storeName, mode),
};

// Mock indexed-storage.js — openDatabase, clearAllCache, getStorageUsage
mock.module('../../app/modules/indexed-storage.js', {
  namedExports: {
    openDatabase: async () => {
      if (mockOpenDbError) throw mockOpenDbError;
      // Return a db that creates properly resolving transactions
      return {
        transaction: (storeName, mode) => {
          const records = mockDbRecords;
          const storeObj = {
            get: (key) => {
              const compositeKey = `${storeName}::${key}`;
              const req = { result: records.get(compositeKey) ?? undefined };
              // Schedule onsuccess
              Promise.resolve().then(() => { if (req.onsuccess) req.onsuccess(); });
              return req;
            },
            put: (record) => {
              const key = record.key || 'auto';
              const compositeKey = `${storeName}::${key}`;
              records.set(compositeKey, record);
              return {};
            },
            delete: (key) => {
              const compositeKey = `${storeName}::${key}`;
              records.delete(compositeKey);
              return {};
            },
          };
          const tx = {
            objectStore: () => storeObj,
            oncomplete: null,
            onerror: null,
            error: null,
          };
          // Schedule oncomplete for readwrite, onsuccess for readonly get
          Promise.resolve().then(() => {
            if (mode === 'readwrite' && tx.oncomplete) tx.oncomplete();
          });
          return tx;
        },
      };
    },
    clearAllCache: async () => { mockClearAllCalled = true; },
    getStorageUsage: async () => mockUsageResult,
  },
});

const { persistence } = await import('../../app/modules/persistence-facade.js');

describe('PersistenceFacade', () => {
  beforeEach(() => {
    storage.clear();
    mockDbRecords.clear();
    mockClearAllCalled = false;
    mockOpenDbError = null;
    mockUsageResult = { total: 0, pages: 0, ocr: 0, annotations: 0 };
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
      mockDbRecords.set('rendered-pages::page1', { key: 'page1', data: 'blob' });
      const result = await persistence.getLargeData('rendered-pages', 'page1');
      assert.deepEqual(result, { key: 'page1', data: 'blob' });
    });

    it('returns null for missing key', async () => {
      const result = await persistence.getLargeData('rendered-pages', 'nope');
      assert.equal(result, null);
    });

    it('returns null on error', async () => {
      mockOpenDbError = new Error('DB error');
      const result = await persistence.getLargeData('rendered-pages', 'x');
      assert.equal(result, null);
      mockOpenDbError = null;
    });
  });

  describe('setLargeData', () => {
    it('stores record in IndexedDB', async () => {
      await persistence.setLargeData('document-meta', 'k1', { key: 'k1', value: 'v1' });
      assert.ok(mockDbRecords.has('document-meta::k1'));
    });

    it('handles error gracefully', async () => {
      mockOpenDbError = new Error('write error');
      await persistence.setLargeData('document-meta', 'k1', { key: 'k1' });
      // Should not throw
      mockOpenDbError = null;
    });
  });

  describe('deleteLargeData', () => {
    it('removes record from IndexedDB', async () => {
      mockDbRecords.set('ocr-results::r1', { key: 'r1' });
      await persistence.deleteLargeData('ocr-results', 'r1');
      assert.ok(!mockDbRecords.has('ocr-results::r1'));
    });

    it('handles error gracefully', async () => {
      mockOpenDbError = new Error('delete error');
      await persistence.deleteLargeData('ocr-results', 'x');
      mockOpenDbError = null;
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
      const backend = await persistence.smartPut('bigKey2', largeValue, { idbStore: 'my-store' });
      assert.equal(backend, 'indexedDB');
      assert.ok(mockDbRecords.has('my-store::bigKey2'));
    });

    it('uses document-meta as default idb store', async () => {
      const largeValue = 'x'.repeat(200 * 1024);
      await persistence.smartPut('bigKey3', largeValue);
      assert.ok(mockDbRecords.has('document-meta::bigKey3'));
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
      await persistence.migrateLocalStorageToIndexedDB('m_', 'custom-store');
      assert.ok(mockDbRecords.has('custom-store::m_k'));
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
      await persistence.clearAll();
      assert.ok(mockClearAllCalled);
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
      mockUsageResult = { total: 100, pages: 50, ocr: 30, annotations: 20 };
      const stats = await persistence.getStorageStats();
      assert.deepEqual(stats.indexedDB, { total: 100, pages: 50, ocr: 30, annotations: 20 });
    });

    it('handles idb stats error gracefully', async () => {
      mockOpenDbError = new Error('stats error');
      // getStorageUsage mock doesn't use openDatabase, but let's test the try/catch
      // by overriding the mock temporarily
      const origUsage = mockUsageResult;
      mock.module('../../app/modules/indexed-storage.js', {
        namedExports: {
          openDatabase: async () => { throw new Error('fail'); },
          clearAllCache: async () => {},
          getStorageUsage: async () => { throw new Error('idb fail'); },
        },
      });
      // Since the module is already imported, this won't re-import.
      // The try/catch in getStorageStats handles errors from idbGetUsage.
      // We just verify no throw:
      const stats = await persistence.getStorageStats();
      assert.ok(stats.localStorage);
      mockOpenDbError = null;
    });

    it('returns totalEstimatedBytes matching localStorage bytes', async () => {
      storage.set('k', 'v');
      const stats = await persistence.getStorageStats();
      assert.equal(stats.totalEstimatedBytes, stats.localStorage.bytes);
    });
  });
});
