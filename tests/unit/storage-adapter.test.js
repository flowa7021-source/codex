// ─── Unit Tests: StorageAdapter ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { StorageAdapter, MemoryBackend } from '../../app/modules/storage-adapter.js';

// ─── MemoryBackend direct tests ───────────────────────────────────────────────

describe('MemoryBackend – basic operations', () => {
  it('get returns null for missing key', async () => {
    const b = new MemoryBackend();
    assert.equal(await b.get('missing'), null);
  });

  it('set then get returns the stored string', async () => {
    const b = new MemoryBackend();
    await b.set('k', 'hello');
    assert.equal(await b.get('k'), 'hello');
  });

  it('delete removes a key', async () => {
    const b = new MemoryBackend();
    await b.set('k', 'v');
    await b.delete('k');
    assert.equal(await b.get('k'), null);
  });

  it('delete on missing key is a no-op', async () => {
    const b = new MemoryBackend();
    await assert.doesNotReject(() => b.delete('ghost'));
  });

  it('clear removes all keys', async () => {
    const b = new MemoryBackend();
    await b.set('a', '1');
    await b.set('b', '2');
    await b.clear();
    assert.deepEqual(await b.keys(), []);
  });

  it('keys returns all stored keys', async () => {
    const b = new MemoryBackend();
    await b.set('x', '1');
    await b.set('y', '2');
    const keys = (await b.keys()).sort();
    assert.deepEqual(keys, ['x', 'y']);
  });
});

// ─── StorageAdapter – get / set ──────────────────────────────────────────────

describe('StorageAdapter – get / set', () => {
  it('set and get round-trips a string value', async () => {
    const s = new StorageAdapter();
    await s.set('name', 'Alice');
    assert.equal(await s.get('name'), 'Alice');
  });

  it('set and get round-trips a number', async () => {
    const s = new StorageAdapter();
    await s.set('n', 42);
    assert.equal(await s.get('n'), 42);
  });

  it('set and get round-trips a nested object', async () => {
    const s = new StorageAdapter();
    const obj = { a: 1, b: [2, 3] };
    await s.set('obj', obj);
    assert.deepEqual(await s.get('obj'), obj);
  });

  it('get returns null for missing key', async () => {
    const s = new StorageAdapter();
    assert.equal(await s.get('missing'), null);
  });

  it('overwriting a key replaces the value', async () => {
    const s = new StorageAdapter();
    await s.set('k', 'first');
    await s.set('k', 'second');
    assert.equal(await s.get('k'), 'second');
  });
});

// ─── StorageAdapter – delete ─────────────────────────────────────────────────

describe('StorageAdapter – delete', () => {
  it('deletes an existing key', async () => {
    const s = new StorageAdapter();
    await s.set('k', 'v');
    await s.delete('k');
    assert.equal(await s.get('k'), null);
  });

  it('delete on missing key does not throw', async () => {
    const s = new StorageAdapter();
    await assert.doesNotReject(() => s.delete('ghost'));
  });
});

// ─── StorageAdapter – clear ───────────────────────────────────────────────────

describe('StorageAdapter – clear', () => {
  it('removes all keys', async () => {
    const s = new StorageAdapter();
    await s.set('a', 1);
    await s.set('b', 2);
    await s.clear();
    assert.deepEqual(await s.keys(), []);
  });

  it('clear on empty store is a no-op', async () => {
    const s = new StorageAdapter();
    await assert.doesNotReject(() => s.clear());
  });
});

// ─── StorageAdapter – keys ────────────────────────────────────────────────────

describe('StorageAdapter – keys', () => {
  it('returns an empty array when no keys stored', async () => {
    const s = new StorageAdapter();
    assert.deepEqual(await s.keys(), []);
  });

  it('returns all stored keys', async () => {
    const s = new StorageAdapter();
    await s.set('x', 1);
    await s.set('y', 2);
    const keys = (await s.keys()).sort();
    assert.deepEqual(keys, ['x', 'y']);
  });
});

// ─── StorageAdapter – has ─────────────────────────────────────────────────────

describe('StorageAdapter – has', () => {
  it('returns false for a missing key', async () => {
    const s = new StorageAdapter();
    assert.equal(await s.has('missing'), false);
  });

  it('returns true after setting a key', async () => {
    const s = new StorageAdapter();
    await s.set('present', 'yes');
    assert.equal(await s.has('present'), true);
  });

  it('returns false after deleting a key', async () => {
    const s = new StorageAdapter();
    await s.set('k', 'v');
    await s.delete('k');
    assert.equal(await s.has('k'), false);
  });
});

// ─── StorageAdapter – prefix isolation ───────────────────────────────────────

describe('StorageAdapter – prefix isolation', () => {
  it('two adapters with different prefixes share the same backend without interference', async () => {
    const backend = new MemoryBackend();
    const a = new StorageAdapter({ prefix: 'a:', backend });
    const b = new StorageAdapter({ prefix: 'b:', backend });

    await a.set('key', 'alpha');
    await b.set('key', 'beta');

    assert.equal(await a.get('key'), 'alpha');
    assert.equal(await b.get('key'), 'beta');
  });

  it('keys() only returns keys belonging to this prefix', async () => {
    const backend = new MemoryBackend();
    const a = new StorageAdapter({ prefix: 'ns1:', backend });
    const b = new StorageAdapter({ prefix: 'ns2:', backend });

    await a.set('foo', 1);
    await a.set('bar', 2);
    await b.set('baz', 3);

    const aKeys = (await a.keys()).sort();
    const bKeys = await b.keys();

    assert.deepEqual(aKeys, ['bar', 'foo']);
    assert.deepEqual(bKeys, ['baz']);
  });

  it('clear() only removes keys belonging to this prefix', async () => {
    const backend = new MemoryBackend();
    const a = new StorageAdapter({ prefix: 'ns1:', backend });
    const b = new StorageAdapter({ prefix: 'ns2:', backend });

    await a.set('x', 1);
    await b.set('y', 2);
    await a.clear();

    assert.deepEqual(await a.keys(), []);
    assert.deepEqual(await b.keys(), ['y']);
  });

  it('has() respects prefix', async () => {
    const backend = new MemoryBackend();
    const a = new StorageAdapter({ prefix: 'a:', backend });
    const b = new StorageAdapter({ prefix: 'b:', backend });

    await a.set('k', 'v');
    assert.equal(await b.has('k'), false);
  });
});

// ─── StorageAdapter – custom serializer ──────────────────────────────────────

describe('StorageAdapter – custom serializer', () => {
  it('uses a custom serializer for set/get', async () => {
    const calls = { serialize: 0, deserialize: 0 };
    const serializer = {
      serialize(v) {
        calls.serialize++;
        return JSON.stringify(v);
      },
      deserialize(s) {
        calls.deserialize++;
        return JSON.parse(s);
      },
    };

    const s = new StorageAdapter({ serializer });
    await s.set('k', { hello: 'world' });
    const val = await s.get('k');

    assert.deepEqual(val, { hello: 'world' });
    assert.equal(calls.serialize, 1);
    assert.equal(calls.deserialize, 1);
  });
});

// ─── StorageAdapter – getOrSet ────────────────────────────────────────────────

describe('StorageAdapter – getOrSet', () => {
  it('computes and stores a value when key is missing', async () => {
    const s = new StorageAdapter();
    let computeCalls = 0;
    const val = await s.getOrSet('k', async () => {
      computeCalls++;
      return 'computed';
    });
    assert.equal(val, 'computed');
    assert.equal(computeCalls, 1);
    assert.equal(await s.get('k'), 'computed');
  });

  it('returns existing value without calling fn', async () => {
    const s = new StorageAdapter();
    await s.set('k', 'existing');
    let computeCalls = 0;
    const val = await s.getOrSet('k', async () => {
      computeCalls++;
      return 'computed';
    });
    assert.equal(val, 'existing');
    assert.equal(computeCalls, 0);
  });

  it('stores the computed value so subsequent get returns it', async () => {
    const s = new StorageAdapter();
    await s.getOrSet('k', async () => 99);
    assert.equal(await s.get('k'), 99);
  });
});

// ─── StorageAdapter – getMany / setMany ──────────────────────────────────────

describe('StorageAdapter – getMany / setMany', () => {
  it('getMany returns values in order, null for missing keys', async () => {
    const s = new StorageAdapter();
    await s.set('a', 1);
    await s.set('c', 3);
    const result = await s.getMany(['a', 'b', 'c']);
    assert.deepEqual(result, [1, null, 3]);
  });

  it('getMany on empty list returns empty array', async () => {
    const s = new StorageAdapter();
    assert.deepEqual(await s.getMany([]), []);
  });

  it('setMany stores all entries', async () => {
    const s = new StorageAdapter();
    await s.setMany([
      ['x', 10],
      ['y', 20],
      ['z', 30],
    ]);
    assert.equal(await s.get('x'), 10);
    assert.equal(await s.get('y'), 20);
    assert.equal(await s.get('z'), 30);
  });

  it('setMany on empty list is a no-op', async () => {
    const s = new StorageAdapter();
    await assert.doesNotReject(() => s.setMany([]));
  });

  it('setMany then getMany round-trips correctly', async () => {
    const s = new StorageAdapter();
    const entries = [['a', { v: 1 }], ['b', [1, 2, 3]]];
    await s.setMany(entries);
    const result = await s.getMany(['a', 'b']);
    assert.deepEqual(result, [{ v: 1 }, [1, 2, 3]]);
  });
});
