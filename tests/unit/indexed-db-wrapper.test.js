// ─── Unit Tests: IDBWrapper ───────────────────────────────────────────────────
// All tests use inMemory: true so they run safely in Node.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { IDBWrapper } from '../../app/modules/indexed-db-wrapper.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create and open an in-memory IDBWrapper. */
async function openDB(name = 'test-db') {
  const db = new IDBWrapper({ name, inMemory: true });
  await db.open();
  return db;
}

// ─── open ─────────────────────────────────────────────────────────────────────

describe('IDBWrapper – open', () => {
  it('open() resolves without error', async () => {
    const db = new IDBWrapper({ name: 'db', inMemory: true });
    await assert.doesNotReject(() => db.open());
  });

  it('calling open() twice is idempotent', async () => {
    const db = new IDBWrapper({ name: 'db', inMemory: true });
    await db.open();
    await assert.doesNotReject(() => db.open());
  });

  it('using db before open() throws', async () => {
    const db = new IDBWrapper({ name: 'db', inMemory: true });
    await assert.rejects(() => db.put('store', { id: 1, name: 'x' }), /open\(\)/);
  });
});

// ─── put / get ────────────────────────────────────────────────────────────────

describe('IDBWrapper – put / get', () => {
  it('put then get returns the stored value', async () => {
    const db = await openDB();
    await db.put('items', { id: 1, name: 'apple' });
    const result = await db.get('items', 1);
    assert.deepEqual(result, { id: 1, name: 'apple' });
  });

  it('get returns undefined for a missing key', async () => {
    const db = await openDB();
    const result = await db.get('items', 999);
    assert.equal(result, undefined);
  });

  it('put replaces an existing record with the same key', async () => {
    const db = await openDB();
    await db.put('items', { id: 1, name: 'apple' });
    await db.put('items', { id: 1, name: 'orange' });
    const result = await db.get('items', 1);
    assert.deepEqual(result, { id: 1, name: 'orange' });
  });

  it('put works with a string key', async () => {
    const db = await openDB();
    await db.put('config', { key: 'theme', value: 'dark' });
    const result = await db.get('config', 'theme');
    assert.deepEqual(result, { key: 'theme', value: 'dark' });
  });

  it('put/get work across different stores independently', async () => {
    const db = await openDB();
    await db.put('users', { id: 1, name: 'Alice' });
    await db.put('posts', { id: 1, title: 'Hello' });
    const user = await db.get('users', 1);
    const post = await db.get('posts', 1);
    assert.equal(user.name, 'Alice');
    assert.equal(post.title, 'Hello');
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('IDBWrapper – delete', () => {
  it('deletes an existing record', async () => {
    const db = await openDB();
    await db.put('items', { id: 42, name: 'pear' });
    await db.delete('items', 42);
    assert.equal(await db.get('items', 42), undefined);
  });

  it('delete on a missing key is a no-op', async () => {
    const db = await openDB();
    await assert.doesNotReject(() => db.delete('items', 999));
  });

  it('deleting one record does not affect others', async () => {
    const db = await openDB();
    await db.put('items', { id: 1, name: 'a' });
    await db.put('items', { id: 2, name: 'b' });
    await db.delete('items', 1);
    assert.equal(await db.get('items', 1), undefined);
    assert.deepEqual(await db.get('items', 2), { id: 2, name: 'b' });
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('IDBWrapper – getAll', () => {
  it('returns an empty array for an empty store', async () => {
    const db = await openDB();
    assert.deepEqual(await db.getAll('items'), []);
  });

  it('returns all stored records', async () => {
    const db = await openDB();
    await db.put('items', { id: 1, name: 'a' });
    await db.put('items', { id: 2, name: 'b' });
    const all = await db.getAll('items');
    assert.equal(all.length, 2);
    const names = all.map((r) => r.name).sort();
    assert.deepEqual(names, ['a', 'b']);
  });

  it('getAll is scoped to the requested store', async () => {
    const db = await openDB();
    await db.put('users', { id: 1, name: 'Alice' });
    await db.put('posts', { id: 1, title: 'Hello' });
    const users = await db.getAll('users');
    assert.equal(users.length, 1);
    assert.equal(users[0].name, 'Alice');
  });
});

// ─── clearStore ───────────────────────────────────────────────────────────────

describe('IDBWrapper – clearStore', () => {
  it('removes all records from a store', async () => {
    const db = await openDB();
    await db.put('items', { id: 1 });
    await db.put('items', { id: 2 });
    await db.clearStore('items');
    assert.deepEqual(await db.getAll('items'), []);
  });

  it('clearStore only affects the specified store', async () => {
    const db = await openDB();
    await db.put('users', { id: 1, name: 'Alice' });
    await db.put('posts', { id: 1, title: 'Post' });
    await db.clearStore('posts');
    assert.equal((await db.getAll('posts')).length, 0);
    assert.equal((await db.getAll('users')).length, 1);
  });

  it('clearStore on empty store is a no-op', async () => {
    const db = await openDB();
    await assert.doesNotReject(() => db.clearStore('empty'));
  });
});

// ─── count ────────────────────────────────────────────────────────────────────

describe('IDBWrapper – count', () => {
  it('returns 0 for an empty store', async () => {
    const db = await openDB();
    assert.equal(await db.count('items'), 0);
  });

  it('returns the number of stored records', async () => {
    const db = await openDB();
    await db.put('items', { id: 1 });
    await db.put('items', { id: 2 });
    await db.put('items', { id: 3 });
    assert.equal(await db.count('items'), 3);
  });

  it('count decreases after delete', async () => {
    const db = await openDB();
    await db.put('items', { id: 1 });
    await db.put('items', { id: 2 });
    await db.delete('items', 1);
    assert.equal(await db.count('items'), 1);
  });

  it('count returns 0 after clearStore', async () => {
    const db = await openDB();
    await db.put('items', { id: 1 });
    await db.clearStore('items');
    assert.equal(await db.count('items'), 0);
  });
});

// ─── close ────────────────────────────────────────────────────────────────────

describe('IDBWrapper – close', () => {
  it('close() does not throw', async () => {
    const db = await openDB();
    assert.doesNotThrow(() => db.close());
  });

  it('after close, operations throw', async () => {
    const db = await openDB();
    db.close();
    await assert.rejects(() => db.put('items', { id: 1 }), /open\(\)/);
  });

  it('close on an un-opened db does not throw', () => {
    const db = new IDBWrapper({ name: 'db', inMemory: true });
    assert.doesNotThrow(() => db.close());
  });
});
