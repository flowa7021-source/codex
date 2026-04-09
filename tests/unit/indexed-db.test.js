// ─── Unit Tests: indexed-db ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── IDB mock ────────────────────────────────────────────────────────────────

// Minimal IDBDatabase/IDBObjectStore mock
function makeIDBMock() {
  const stores = {};
  function makeStore(name) {
    const data = new Map();
    return {
      put(value, key) {
        const req = { result: key ?? value?.id ?? data.size };
        data.set(req.result, value);
        setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
        return req;
      },
      get(key) {
        const req = { result: data.get(key) ?? undefined };
        setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
        return req;
      },
      delete(key) {
        data.delete(key);
        const req = {};
        setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
        return req;
      },
      getAll() {
        const req = { result: [...data.values()] };
        setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
        return req;
      },
      clear() {
        data.clear();
        const req = {};
        setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
        return req;
      },
      count() {
        const req = { result: data.size };
        setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
        return req;
      },
    };
  }
  const db = {
    transaction(storeNames, mode) {
      const name = Array.isArray(storeNames) ? storeNames[0] : storeNames;
      if (!stores[name]) stores[name] = makeStore(name);
      return { objectStore: () => stores[name] };
    },
    _stores: stores,
  };
  return db;
}

// Mock indexedDB.open
globalThis.indexedDB = {
  open(name, version) {
    const db = makeIDBMock();
    const req = { result: db };
    setTimeout(() => {
      if (req.onupgradeneeded) req.onupgradeneeded({ target: req, oldVersion: 0 });
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  },
};

import {
  openDB,
  dbPut,
  dbGet,
  dbDelete,
  dbGetAll,
  dbClear,
  dbCount,
} from '../../app/modules/indexed-db.js';

// ─── openDB ───────────────────────────────────────────────────────────────────

describe('openDB', () => {
  it('returns an IDBDatabase handle', async () => {
    const db = await openDB('test', 1, () => {});
    assert.ok(db !== null);
  });

  it('calls onUpgrade with db and oldVersion', async () => {
    let upgradeCalled = false;
    let upgradedOldVersion = -1;
    await openDB('test', 1, (db, oldVersion) => {
      upgradeCalled = true;
      upgradedOldVersion = oldVersion;
    });
    assert.equal(upgradeCalled, true);
    assert.equal(upgradedOldVersion, 0);
  });

  it('returns null when indexedDB.open throws', async () => {
    const orig = globalThis.indexedDB;
    globalThis.indexedDB = {
      open() { throw new Error('not supported'); },
    };
    const db = await openDB('fail', 1, () => {});
    assert.equal(db, null);
    globalThis.indexedDB = orig;
  });

  it('returns null when request fires onerror', async () => {
    const orig = globalThis.indexedDB;
    globalThis.indexedDB = {
      open() {
        const req = {};
        setTimeout(() => { if (req.onerror) req.onerror({}); }, 0);
        return req;
      },
    };
    const db = await openDB('fail', 1, () => {});
    assert.equal(db, null);
    globalThis.indexedDB = orig;
  });
});

// ─── dbPut ────────────────────────────────────────────────────────────────────

describe('dbPut', () => {
  it('inserts a value and returns true', async () => {
    const db = await openDB('test', 1, () => {});
    const result = await dbPut(db, 'items', { name: 'alpha' }, 'key1');
    assert.equal(result, true);
  });

  it('stores value without explicit key', async () => {
    const db = await openDB('test', 1, () => {});
    const result = await dbPut(db, 'items', { name: 'beta' });
    assert.equal(result, true);
  });

  it('overwrites an existing key', async () => {
    const db = await openDB('test', 1, () => {});
    await dbPut(db, 'items', { v: 1 }, 'k');
    await dbPut(db, 'items', { v: 2 }, 'k');
    const val = await dbGet(db, 'items', 'k');
    assert.deepEqual(val, { v: 2 });
  });
});

// ─── dbGet ────────────────────────────────────────────────────────────────────

describe('dbGet', () => {
  it('retrieves a stored value', async () => {
    const db = await openDB('test', 1, () => {});
    await dbPut(db, 'things', { data: 42 }, 'mykey');
    const val = await dbGet(db, 'things', 'mykey');
    assert.deepEqual(val, { data: 42 });
  });

  it('returns null for a missing key', async () => {
    const db = await openDB('test', 1, () => {});
    const val = await dbGet(db, 'things', 'nonexistent');
    assert.equal(val, null);
  });
});

// ─── dbDelete ─────────────────────────────────────────────────────────────────

describe('dbDelete', () => {
  it('deletes a key and returns true', async () => {
    const db = await openDB('test', 1, () => {});
    await dbPut(db, 'docs', { x: 1 }, 'del-key');
    const result = await dbDelete(db, 'docs', 'del-key');
    assert.equal(result, true);
  });

  it('deleted key is no longer retrievable', async () => {
    const db = await openDB('test', 1, () => {});
    await dbPut(db, 'docs', { x: 1 }, 'to-delete');
    await dbDelete(db, 'docs', 'to-delete');
    const val = await dbGet(db, 'docs', 'to-delete');
    assert.equal(val, null);
  });

  it('returns true even for non-existent key', async () => {
    const db = await openDB('test', 1, () => {});
    const result = await dbDelete(db, 'docs', 'ghost');
    assert.equal(result, true);
  });
});

// ─── dbGetAll ─────────────────────────────────────────────────────────────────

describe('dbGetAll', () => {
  it('returns empty array from empty store', async () => {
    const db = await openDB('test', 1, () => {});
    const vals = await dbGetAll(db, 'empty-store');
    assert.deepEqual(vals, []);
  });

  it('returns all stored values', async () => {
    const db = await openDB('test', 1, () => {});
    await dbPut(db, 'all-store', 'first', 1);
    await dbPut(db, 'all-store', 'second', 2);
    await dbPut(db, 'all-store', 'third', 3);
    const vals = await dbGetAll(db, 'all-store');
    assert.equal(vals.length, 3);
    assert.ok(vals.includes('first'));
    assert.ok(vals.includes('second'));
    assert.ok(vals.includes('third'));
  });
});

// ─── dbClear ──────────────────────────────────────────────────────────────────

describe('dbClear', () => {
  it('removes all records and returns true', async () => {
    const db = await openDB('test', 1, () => {});
    await dbPut(db, 'clr', 'a', 1);
    await dbPut(db, 'clr', 'b', 2);
    const result = await dbClear(db, 'clr');
    assert.equal(result, true);
    const vals = await dbGetAll(db, 'clr');
    assert.deepEqual(vals, []);
  });

  it('is safe on empty store', async () => {
    const db = await openDB('test', 1, () => {});
    const result = await dbClear(db, 'empty-clr');
    assert.equal(result, true);
  });
});

// ─── dbCount ──────────────────────────────────────────────────────────────────

describe('dbCount', () => {
  it('returns 0 for empty store', async () => {
    const db = await openDB('test', 1, () => {});
    const count = await dbCount(db, 'cnt-empty');
    assert.equal(count, 0);
  });

  it('returns correct count after puts', async () => {
    const db = await openDB('test', 1, () => {});
    await dbPut(db, 'cnt-store', 'x', 1);
    await dbPut(db, 'cnt-store', 'y', 2);
    await dbPut(db, 'cnt-store', 'z', 3);
    const count = await dbCount(db, 'cnt-store');
    assert.equal(count, 3);
  });

  it('count decreases after delete', async () => {
    const db = await openDB('test', 1, () => {});
    await dbPut(db, 'cnt-del', 'a', 1);
    await dbPut(db, 'cnt-del', 'b', 2);
    await dbDelete(db, 'cnt-del', 1);
    const count = await dbCount(db, 'cnt-del');
    assert.equal(count, 1);
  });

  it('count is 0 after clear', async () => {
    const db = await openDB('test', 1, () => {});
    await dbPut(db, 'cnt-clr', 'a', 1);
    await dbClear(db, 'cnt-clr');
    const count = await dbCount(db, 'cnt-clr');
    assert.equal(count, 0);
  });
});
