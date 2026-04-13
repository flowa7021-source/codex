// ─── Unit Tests: SimpleDB ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SimpleDB, createDB, createCollection } from '../../app/modules/simple-db.js';

// ─── createCollection / insert ────────────────────────────────────────────────

describe('createCollection – basics', () => {
  it('createCollection returns a Collection', () => {
    const col = createCollection();
    assert.equal(typeof col.insert, 'function');
    assert.equal(typeof col.find, 'function');
  });

  it('createCollection with items pre-populates', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    assert.equal(col.count(), 1);
    assert.deepEqual(col.findById(1), { id: 1, name: 'Alice' });
  });

  it('createCollection with no args starts empty', () => {
    const col = createCollection();
    assert.equal(col.count(), 0);
  });

  it('insert returns the inserted item', () => {
    const col = createCollection();
    const result = col.insert({ id: 'a', value: 42 });
    assert.deepEqual(result, { id: 'a', value: 42 });
  });

  it('insert stores a copy — mutating the original does not affect the store', () => {
    const col = createCollection();
    const item = { id: 1, name: 'Alice' };
    col.insert(item);
    item.name = 'Mutated';
    assert.equal(col.findById(1)?.name, 'Alice');
  });

  it('insert throws when duplicate id is used', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    assert.throws(() => col.insert({ id: 1, name: 'Bob' }), /already exists/);
  });

  it('insertMany inserts all items and returns them', () => {
    const col = createCollection();
    const results = col.insertMany([
      { id: 1, v: 'a' },
      { id: 2, v: 'b' },
      { id: 3, v: 'c' },
    ]);
    assert.equal(results.length, 3);
    assert.equal(col.count(), 3);
  });

  it('insertMany with string and number ids', () => {
    const col = createCollection();
    col.insertMany([{ id: 'x', v: 1 }, { id: 99, v: 2 }]);
    assert.ok(col.findById('x'));
    assert.ok(col.findById(99));
  });
});

// ─── findById / find / findOne ────────────────────────────────────────────────

describe('Collection – find operations', () => {
  it('findById returns the item when it exists', () => {
    const col = createCollection([{ id: 5, label: 'hello' }]);
    assert.deepEqual(col.findById(5), { id: 5, label: 'hello' });
  });

  it('findById returns undefined for unknown id', () => {
    const col = createCollection();
    assert.equal(col.findById(999), undefined);
  });

  it('findById returns a copy — mutating result does not affect store', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    const found = col.findById(1);
    found.name = 'Mutated';
    assert.equal(col.findById(1)?.name, 'Alice');
  });

  it('find with no options returns all items', () => {
    const col = createCollection([
      { id: 1, n: 10 },
      { id: 2, n: 20 },
    ]);
    assert.equal(col.find().length, 2);
  });

  it('find with object where filters by equality', () => {
    const col = createCollection([
      { id: 1, role: 'admin' },
      { id: 2, role: 'user' },
      { id: 3, role: 'admin' },
    ]);
    const admins = col.find({ where: { role: 'admin' } });
    assert.equal(admins.length, 2);
    assert.ok(admins.every((a) => a.role === 'admin'));
  });

  it('find with function where filters correctly', () => {
    const col = createCollection([
      { id: 1, n: 5 },
      { id: 2, n: 15 },
      { id: 3, n: 25 },
    ]);
    const big = col.find({ where: (item) => item.n > 10 });
    assert.equal(big.length, 2);
  });

  it('find with orderBy sorts ascending by default', () => {
    const col = createCollection([
      { id: 1, n: 30 },
      { id: 2, n: 10 },
      { id: 3, n: 20 },
    ]);
    const sorted = col.find({ orderBy: 'n' });
    assert.deepEqual(sorted.map((x) => x.n), [10, 20, 30]);
  });

  it('find with orderBy desc sorts descending', () => {
    const col = createCollection([
      { id: 1, n: 30 },
      { id: 2, n: 10 },
      { id: 3, n: 20 },
    ]);
    const sorted = col.find({ orderBy: 'n', order: 'desc' });
    assert.deepEqual(sorted.map((x) => x.n), [30, 20, 10]);
  });

  it('find with limit returns at most N items', () => {
    const col = createCollection([
      { id: 1, v: 1 },
      { id: 2, v: 2 },
      { id: 3, v: 3 },
    ]);
    assert.equal(col.find({ limit: 2 }).length, 2);
  });

  it('find with offset skips items', () => {
    const col = createCollection([
      { id: 1, v: 1 },
      { id: 2, v: 2 },
      { id: 3, v: 3 },
    ]);
    const result = col.find({ orderBy: 'v', offset: 1 });
    assert.deepEqual(result.map((x) => x.v), [2, 3]);
  });

  it('find with offset and limit paginates', () => {
    const col = createCollection([
      { id: 1, v: 1 },
      { id: 2, v: 2 },
      { id: 3, v: 3 },
      { id: 4, v: 4 },
    ]);
    const page = col.find({ orderBy: 'v', offset: 1, limit: 2 });
    assert.deepEqual(page.map((x) => x.v), [2, 3]);
  });

  it('findOne returns first matching item', () => {
    const col = createCollection([
      { id: 1, role: 'user' },
      { id: 2, role: 'admin' },
    ]);
    const admin = col.findOne({ where: { role: 'admin' } });
    assert.ok(admin);
    assert.equal(admin.role, 'admin');
  });

  it('findOne returns undefined when nothing matches', () => {
    const col = createCollection([{ id: 1, role: 'user' }]);
    assert.equal(col.findOne({ where: { role: 'admin' } }), undefined);
  });

  it('find on empty collection returns empty array', () => {
    const col = createCollection();
    assert.deepEqual(col.find(), []);
  });

  it('find where with multiple keys applies AND logic', () => {
    const col = createCollection([
      { id: 1, role: 'admin', active: true },
      { id: 2, role: 'admin', active: false },
      { id: 3, role: 'user', active: true },
    ]);
    const results = col.find({ where: { role: 'admin', active: true } });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 1);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('Collection – update', () => {
  it('update merges changes and returns updated item', () => {
    const col = createCollection([{ id: 1, name: 'Alice', age: 30 }]);
    const updated = col.update(1, { age: 31 });
    assert.deepEqual(updated, { id: 1, name: 'Alice', age: 31 });
  });

  it('update persists changes', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    col.update(1, { name: 'Bob' });
    assert.equal(col.findById(1)?.name, 'Bob');
  });

  it('update returns undefined for non-existent id', () => {
    const col = createCollection();
    assert.equal(col.update(999, { name: 'X' }), undefined);
  });

  it('update cannot change the id', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    // id in changes should be overridden by original id
    col.update(1, { id: 99, name: 'Bob' });
    assert.ok(col.findById(1));
    assert.equal(col.findById(99), undefined);
  });
});

// ─── upsert ───────────────────────────────────────────────────────────────────

describe('Collection – upsert', () => {
  it('upsert inserts when id does not exist', () => {
    const col = createCollection();
    const result = col.upsert({ id: 1, name: 'Alice' });
    assert.deepEqual(result, { id: 1, name: 'Alice' });
    assert.equal(col.count(), 1);
  });

  it('upsert replaces when id exists', () => {
    const col = createCollection([{ id: 1, name: 'Alice', score: 10 }]);
    col.upsert({ id: 1, name: 'Alice', score: 99 });
    assert.equal(col.findById(1)?.score, 99);
  });

  it('upsert returns the stored item', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    const result = col.upsert({ id: 1, name: 'Bob' });
    assert.equal(result.name, 'Bob');
  });
});

// ─── delete / deleteWhere ─────────────────────────────────────────────────────

describe('Collection – delete', () => {
  it('delete removes item and returns true', () => {
    const col = createCollection([{ id: 1, v: 'x' }]);
    assert.equal(col.delete(1), true);
    assert.equal(col.count(), 0);
  });

  it('delete returns false for non-existent id', () => {
    const col = createCollection();
    assert.equal(col.delete(42), false);
  });

  it('delete does not affect other items', () => {
    const col = createCollection([
      { id: 1, v: 'a' },
      { id: 2, v: 'b' },
    ]);
    col.delete(1);
    assert.equal(col.count(), 1);
    assert.ok(col.findById(2));
  });

  it('deleteWhere removes matching items and returns count', () => {
    const col = createCollection([
      { id: 1, n: 5 },
      { id: 2, n: 15 },
      { id: 3, n: 25 },
    ]);
    const deleted = col.deleteWhere((item) => item.n > 10);
    assert.equal(deleted, 2);
    assert.equal(col.count(), 1);
    assert.ok(col.findById(1));
  });

  it('deleteWhere returns 0 when nothing matches', () => {
    const col = createCollection([{ id: 1, n: 5 }]);
    assert.equal(col.deleteWhere(() => false), 0);
  });
});

// ─── count ────────────────────────────────────────────────────────────────────

describe('Collection – count', () => {
  it('count with no predicate returns total items', () => {
    const col = createCollection([{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert.equal(col.count(), 3);
  });

  it('count with predicate counts matching items', () => {
    const col = createCollection([
      { id: 1, active: true },
      { id: 2, active: false },
      { id: 3, active: true },
    ]);
    assert.equal(col.count((item) => item.active), 2);
  });

  it('count returns 0 on empty collection', () => {
    const col = createCollection();
    assert.equal(col.count(), 0);
  });
});

// ─── batch (transactions) ─────────────────────────────────────────────────────

describe('Collection – batch (transactions)', () => {
  it('batch applies all operations atomically on success', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    col.batch((c) => {
      c.insert({ id: 2, name: 'Bob' });
      c.update(1, { name: 'Alicia' });
    });
    assert.equal(col.count(), 2);
    assert.equal(col.findById(1)?.name, 'Alicia');
    assert.ok(col.findById(2));
  });

  it('batch rolls back all operations on error', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    assert.throws(() => {
      col.batch((c) => {
        c.insert({ id: 2, name: 'Bob' });
        throw new Error('intentional failure');
      });
    }, /intentional failure/);
    // Rollback: id=2 should not exist, id=1 unchanged
    assert.equal(col.count(), 1);
    assert.equal(col.findById(1)?.name, 'Alice');
    assert.equal(col.findById(2), undefined);
  });

  it('batch rolls back on duplicate id error inside fn', () => {
    const col = createCollection([{ id: 1, v: 'a' }]);
    assert.throws(() => {
      col.batch((c) => {
        c.insert({ id: 2, v: 'b' });
        c.insert({ id: 1, v: 'duplicate' }); // should throw
      });
    }, /already exists/);
    assert.equal(col.count(), 1); // only original id=1
    assert.equal(col.findById(2), undefined);
  });

  it('batch with empty fn is a no-op', () => {
    const col = createCollection([{ id: 1, v: 'x' }]);
    col.batch(() => {});
    assert.equal(col.count(), 1);
  });
});

// ─── events ───────────────────────────────────────────────────────────────────

describe('Collection – events', () => {
  it('on("insert") fires synchronously with the inserted item', () => {
    const col = createCollection();
    const received = [];
    col.on('insert', (item) => received.push(item));
    col.insert({ id: 1, v: 'a' });
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { id: 1, v: 'a' });
  });

  it('on("update") fires synchronously with the updated item', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    const received = [];
    col.on('update', (item) => received.push(item));
    col.update(1, { name: 'Bob' });
    assert.equal(received.length, 1);
    assert.equal(received[0].name, 'Bob');
  });

  it('on("delete") fires synchronously with the deleted item', () => {
    const col = createCollection([{ id: 1, v: 'gone' }]);
    const received = [];
    col.on('delete', (item) => received.push(item));
    col.delete(1);
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { id: 1, v: 'gone' });
  });

  it('on("delete") fires for deleteWhere — once per deleted item', () => {
    const col = createCollection([
      { id: 1, n: 5 },
      { id: 2, n: 15 },
      { id: 3, n: 25 },
    ]);
    const ids = [];
    col.on('delete', (item) => ids.push(item.id));
    col.deleteWhere((item) => item.n > 10);
    assert.equal(ids.length, 2);
    assert.ok(ids.includes(2));
    assert.ok(ids.includes(3));
  });

  it('unsubscribe function removes the listener', () => {
    const col = createCollection();
    const received = [];
    const off = col.on('insert', (item) => received.push(item));
    col.insert({ id: 1, v: 'before' });
    off();
    col.insert({ id: 2, v: 'after' });
    assert.equal(received.length, 1); // only the first insert
  });

  it('multiple listeners on the same event all fire', () => {
    const col = createCollection();
    let count = 0;
    col.on('insert', () => count++);
    col.on('insert', () => count++);
    col.insert({ id: 1, v: 'x' });
    assert.equal(count, 2);
  });

  it('event listener receives a copy — mutating it does not corrupt the store', () => {
    const col = createCollection();
    let captured = null;
    col.on('insert', (item) => { captured = item; });
    col.insert({ id: 1, name: 'Alice' });
    captured.name = 'Mutated';
    assert.equal(col.findById(1)?.name, 'Alice');
  });

  it('upsert fires insert event when item is new', () => {
    const col = createCollection();
    const events = [];
    col.on('insert', () => events.push('insert'));
    col.on('update', () => events.push('update'));
    col.upsert({ id: 1, v: 'new' });
    assert.deepEqual(events, ['insert']);
  });

  it('upsert fires update event when item exists', () => {
    const col = createCollection([{ id: 1, v: 'old' }]);
    const events = [];
    col.on('insert', () => events.push('insert'));
    col.on('update', () => events.push('update'));
    col.upsert({ id: 1, v: 'new' });
    assert.deepEqual(events, ['update']);
  });
});

// ─── toArray / clear ──────────────────────────────────────────────────────────

describe('Collection – toArray / clear', () => {
  it('toArray returns all items as an array', () => {
    const col = createCollection([{ id: 1 }, { id: 2 }]);
    const arr = col.toArray();
    assert.equal(arr.length, 2);
  });

  it('toArray returns copies — mutations do not affect the store', () => {
    const col = createCollection([{ id: 1, name: 'Alice' }]);
    const arr = col.toArray();
    arr[0].name = 'Mutated';
    assert.equal(col.findById(1)?.name, 'Alice');
  });

  it('toArray on empty collection returns []', () => {
    const col = createCollection();
    assert.deepEqual(col.toArray(), []);
  });

  it('clear removes all items', () => {
    const col = createCollection([{ id: 1 }, { id: 2 }, { id: 3 }]);
    col.clear();
    assert.equal(col.count(), 0);
    assert.deepEqual(col.find(), []);
  });

  it('clear allows re-insertion of previously used ids', () => {
    const col = createCollection([{ id: 1, v: 'old' }]);
    col.clear();
    col.insert({ id: 1, v: 'new' });
    assert.equal(col.findById(1)?.v, 'new');
  });
});

// ─── SimpleDB ─────────────────────────────────────────────────────────────────

describe('SimpleDB', () => {
  it('createDB returns a SimpleDB instance', () => {
    const db = createDB();
    assert.ok(db instanceof SimpleDB);
  });

  it('collection creates a new collection on first access', () => {
    const db = createDB();
    const col = db.collection('users');
    assert.equal(typeof col.insert, 'function');
  });

  it('collection returns the same collection on subsequent calls', () => {
    const db = createDB();
    const col1 = db.collection('users');
    col1.insert({ id: 1, name: 'Alice' });
    const col2 = db.collection('users');
    assert.equal(col2.count(), 1);
  });

  it('different collection names are independent', () => {
    const db = createDB();
    db.collection('users').insert({ id: 1, name: 'Alice' });
    db.collection('posts').insert({ id: 1, title: 'Hello' });
    assert.equal(db.collection('users').count(), 1);
    assert.equal(db.collection('posts').count(), 1);
    assert.ok(db.collection('users').findById(1)?.name === 'Alice');
  });

  it('collectionNames lists all created collections', () => {
    const db = createDB();
    db.collection('a');
    db.collection('b');
    db.collection('c');
    const names = db.collectionNames.sort();
    assert.deepEqual(names, ['a', 'b', 'c']);
  });

  it('dropCollection removes a collection and returns true', () => {
    const db = createDB();
    db.collection('temp').insert({ id: 1 });
    assert.equal(db.dropCollection('temp'), true);
    assert.ok(!db.collectionNames.includes('temp'));
  });

  it('dropCollection returns false for unknown collection', () => {
    const db = createDB();
    assert.equal(db.dropCollection('ghost'), false);
  });

  it('after drop, collection() creates a fresh collection', () => {
    const db = createDB();
    db.collection('users').insert({ id: 1, name: 'Alice' });
    db.dropCollection('users');
    const fresh = db.collection('users');
    assert.equal(fresh.count(), 0);
  });

  it('collectionNames is empty on a new DB', () => {
    const db = createDB();
    assert.deepEqual(db.collectionNames, []);
  });
});
