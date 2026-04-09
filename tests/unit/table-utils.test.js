// ─── Unit Tests: table-utils ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Table, join } from '../../app/modules/table-utils.js';

// ─── Table constructor / toArray / count ──────────────────────────────────────

describe('Table – constructor and basic accessors', () => {
  it('stores rows and returns them via toArray', () => {
    const t = new Table([{ a: 1 }, { a: 2 }]);
    assert.deepEqual(t.toArray(), [{ a: 1 }, { a: 2 }]);
  });

  it('count returns the number of rows', () => {
    assert.equal(new Table([{ x: 1 }, { x: 2 }, { x: 3 }]).count(), 3);
  });

  it('count returns 0 for empty table', () => {
    assert.equal(new Table([]).count(), 0);
  });

  it('toArray returns a copy, not the internal array', () => {
    const t = new Table([{ a: 1 }]);
    const arr = t.toArray();
    arr.push({ a: 99 });
    assert.equal(t.count(), 1);
  });

  it('stores rows with various value types', () => {
    const t = new Table([{ n: 1, s: 'hi', b: true }]);
    assert.deepEqual(t.toArray()[0], { n: 1, s: 'hi', b: true });
  });
});

// ─── select ───────────────────────────────────────────────────────────────────

describe('Table#select', () => {
  const rows = [
    { name: 'Alice', age: 30, city: 'NYC' },
    { name: 'Bob', age: 25, city: 'LA' },
  ];

  it('projects only the specified columns', () => {
    const result = new Table(rows).select('name', 'age').toArray();
    assert.deepEqual(result, [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
  });

  it('selects a single column', () => {
    const result = new Table(rows).select('city').toArray();
    assert.deepEqual(result, [{ city: 'NYC' }, { city: 'LA' }]);
  });

  it('returns empty rows when table is empty', () => {
    assert.equal(new Table([]).select('name').count(), 0);
  });

  it('selecting all columns returns equivalent rows', () => {
    const result = new Table(rows).select('name', 'age', 'city').toArray();
    assert.deepEqual(result, rows);
  });

  it('returns undefined for a column that does not exist on a row', () => {
    const result = new Table([{ a: 1 }]).select('a', 'b' ).toArray();
    assert.equal(result[0].a, 1);
    assert.equal(result[0].b, undefined);
  });

  it('is chainable with where', () => {
    const result = new Table(rows).where((r) => r.age > 26).select('name').toArray();
    assert.deepEqual(result, [{ name: 'Alice' }]);
  });

  it('does not mutate the original table', () => {
    const t = new Table(rows);
    t.select('name');
    assert.equal(t.toArray()[0].city, 'NYC');
  });

  it('handles a table with a single row', () => {
    const result = new Table([{ x: 42, y: 'hello' }]).select('x').toArray();
    assert.deepEqual(result, [{ x: 42 }]);
  });
});

// ─── where ────────────────────────────────────────────────────────────────────

describe('Table#where', () => {
  const rows = [
    { name: 'Alice', score: 90 },
    { name: 'Bob', score: 55 },
    { name: 'Carol', score: 75 },
  ];

  it('filters rows matching a predicate', () => {
    const result = new Table(rows).where((r) => r.score >= 75).toArray();
    assert.deepEqual(result, [{ name: 'Alice', score: 90 }, { name: 'Carol', score: 75 }]);
  });

  it('returns an empty table when no rows match', () => {
    assert.equal(new Table(rows).where(() => false).count(), 0);
  });

  it('returns all rows when all match', () => {
    assert.equal(new Table(rows).where(() => true).count(), 3);
  });

  it('is chainable', () => {
    const result = new Table(rows)
      .where((r) => r.score >= 55)
      .where((r) => r.name !== 'Bob')
      .toArray();
    assert.deepEqual(result, [{ name: 'Alice', score: 90 }, { name: 'Carol', score: 75 }]);
  });

  it('does not mutate the original table', () => {
    const t = new Table(rows);
    t.where((r) => r.score > 80);
    assert.equal(t.count(), 3);
  });

  it('handles an empty table gracefully', () => {
    assert.deepEqual(new Table([]).where(() => true).toArray(), []);
  });

  it('predicate receives the full row object', () => {
    const result = new Table(rows).where((r) => r.name === 'Carol').toArray();
    assert.equal(result.length, 1);
    assert.equal(result[0].score, 75);
  });

  it('can filter by string equality', () => {
    const result = new Table(rows).where((r) => r.name === 'Bob').toArray();
    assert.equal(result.length, 1);
    assert.equal(result[0].score, 55);
  });
});

// ─── orderBy ──────────────────────────────────────────────────────────────────

describe('Table#orderBy', () => {
  const rows = [
    { name: 'Charlie', age: 35 },
    { name: 'Alice', age: 28 },
    { name: 'Bob', age: 28 },
  ];

  it('sorts by a numeric column ascending (default)', () => {
    const result = new Table(rows).orderBy('age').toArray();
    assert.equal(result[0].name, 'Alice');
    assert.equal(result[2].name, 'Charlie');
  });

  it('sorts by a numeric column descending', () => {
    const result = new Table(rows).orderBy('age', 'desc').toArray();
    assert.equal(result[0].name, 'Charlie');
    assert.equal(result[2].age, 28);
  });

  it('sorts by a string column ascending', () => {
    const result = new Table(rows).orderBy('name').toArray();
    assert.equal(result[0].name, 'Alice');
    assert.equal(result[1].name, 'Bob');
    assert.equal(result[2].name, 'Charlie');
  });

  it('sorts by a string column descending', () => {
    const result = new Table(rows).orderBy('name', 'desc').toArray();
    assert.equal(result[0].name, 'Charlie');
  });

  it('does not mutate the original table', () => {
    const t = new Table(rows);
    t.orderBy('name');
    assert.equal(t.toArray()[0].name, 'Charlie');
  });

  it('handles an empty table', () => {
    assert.deepEqual(new Table([]).orderBy('age').toArray(), []);
  });

  it('stable for equal keys (order preserved relative to input)', () => {
    const result = new Table(rows).orderBy('age').toArray();
    const age28 = result.filter((r) => r.age === 28);
    assert.equal(age28.length, 2);
  });

  it('handles a single-row table', () => {
    const t = new Table([{ v: 5 }]);
    assert.deepEqual(t.orderBy('v').toArray(), [{ v: 5 }]);
  });
});

// ─── limit / offset ───────────────────────────────────────────────────────────

describe('Table#limit and Table#offset', () => {
  const rows = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }];

  it('limit takes the first N rows', () => {
    assert.deepEqual(new Table(rows).limit(3).toArray(), [{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it('limit(0) returns empty table', () => {
    assert.equal(new Table(rows).limit(0).count(), 0);
  });

  it('limit larger than count returns all rows', () => {
    assert.equal(new Table(rows).limit(100).count(), 5);
  });

  it('offset skips the first N rows', () => {
    assert.deepEqual(new Table(rows).offset(3).toArray(), [{ n: 4 }, { n: 5 }]);
  });

  it('offset equal to count returns empty table', () => {
    assert.equal(new Table(rows).offset(5).count(), 0);
  });

  it('offset(0) returns all rows', () => {
    assert.equal(new Table(rows).offset(0).count(), 5);
  });

  it('limit and offset can be chained for pagination', () => {
    const page2 = new Table(rows).offset(2).limit(2).toArray();
    assert.deepEqual(page2, [{ n: 3 }, { n: 4 }]);
  });

  it('offset larger than count returns empty table', () => {
    assert.equal(new Table(rows).offset(99).count(), 0);
  });
});

// ─── groupBy ──────────────────────────────────────────────────────────────────

describe('Table#groupBy', () => {
  const rows = [
    { dept: 'eng', name: 'Alice' },
    { dept: 'eng', name: 'Bob' },
    { dept: 'hr', name: 'Carol' },
    { dept: 'hr', name: 'Dave' },
    { dept: 'finance', name: 'Eve' },
  ];

  it('returns a Map keyed by the column values', () => {
    const groups = new Table(rows).groupBy('dept');
    assert.ok(groups instanceof Map);
    assert.equal(groups.size, 3);
  });

  it('each group is a Table containing the matching rows', () => {
    const groups = new Table(rows).groupBy('dept');
    assert.equal(groups.get('eng').count(), 2);
    assert.equal(groups.get('hr').count(), 2);
    assert.equal(groups.get('finance').count(), 1);
  });

  it('group rows contain the full original row objects', () => {
    const groups = new Table(rows).groupBy('dept');
    const engNames = groups.get('eng').toArray().map((r) => r.name);
    assert.deepEqual(engNames, ['Alice', 'Bob']);
  });

  it('returns an empty Map for an empty table', () => {
    assert.equal(new Table([]).groupBy('dept').size, 0);
  });

  it('groups all rows under one key when all values are identical', () => {
    const t = new Table([{ k: 'x', v: 1 }, { k: 'x', v: 2 }]);
    const groups = t.groupBy('k');
    assert.equal(groups.size, 1);
    assert.equal(groups.get('x').count(), 2);
  });

  it('each group is an independent Table (not mutually affected)', () => {
    const groups = new Table(rows).groupBy('dept');
    const engTable = groups.get('eng');
    assert.equal(engTable.where((r) => r.name === 'Alice').count(), 1);
  });

  it('groups by numeric column values', () => {
    const t = new Table([{ score: 90, name: 'Alice' }, { score: 90, name: 'Bob' }, { score: 80, name: 'Carol' }]);
    const groups = t.groupBy('score');
    assert.equal(groups.get(90).count(), 2);
    assert.equal(groups.get(80).count(), 1);
  });

  it('preserves row insertion order within each group', () => {
    const groups = new Table(rows).groupBy('dept');
    const hrNames = groups.get('hr').toArray().map((r) => r.name);
    assert.deepEqual(hrNames, ['Carol', 'Dave']);
  });
});

// ─── aggregate ────────────────────────────────────────────────────────────────

describe('Table#aggregate', () => {
  const rows = [{ val: 10 }, { val: 20 }, { val: 30 }];

  it('computes a sum via aggregate', () => {
    const total = new Table(rows).aggregate((rs) => rs.reduce((s, r) => s + r.val, 0));
    assert.equal(total, 60);
  });

  it('computes count via aggregate', () => {
    assert.equal(new Table(rows).aggregate((rs) => rs.length), 3);
  });

  it('returns 0 for empty table sum', () => {
    const total = new Table([]).aggregate((rs) => rs.reduce((s, r) => s + r.val, 0));
    assert.equal(total, 0);
  });

  it('can return an object', () => {
    const stats = new Table(rows).aggregate((rs) => ({
      min: Math.min(...rs.map((r) => r.val)),
      max: Math.max(...rs.map((r) => r.val)),
    }));
    assert.equal(stats.min, 10);
    assert.equal(stats.max, 30);
  });

  it('receives a copy of the rows array', () => {
    let received;
    new Table(rows).aggregate((rs) => { received = rs; return null; });
    assert.deepEqual(received, rows);
  });

  it('can compute average', () => {
    const avg = new Table(rows).aggregate((rs) => rs.reduce((s, r) => s + r.val, 0) / rs.length);
    assert.equal(avg, 20);
  });

  it('can filter and then aggregate', () => {
    const total = new Table(rows)
      .where((r) => r.val >= 20)
      .aggregate((rs) => rs.reduce((s, r) => s + r.val, 0));
    assert.equal(total, 50);
  });

  it('returns undefined when fn returns undefined', () => {
    const result = new Table(rows).aggregate(() => undefined);
    assert.equal(result, undefined);
  });
});

// ─── distinct ─────────────────────────────────────────────────────────────────

describe('Table#distinct', () => {
  it('returns unique values for a column', () => {
    const t = new Table([{ x: 1 }, { x: 2 }, { x: 1 }, { x: 3 }]);
    assert.deepEqual(t.distinct('x'), [1, 2, 3]);
  });

  it('preserves insertion order (first occurrence)', () => {
    const t = new Table([{ v: 'b' }, { v: 'a' }, { v: 'b' }, { v: 'c' }]);
    assert.deepEqual(t.distinct('v'), ['b', 'a', 'c']);
  });

  it('returns empty array for an empty table', () => {
    assert.deepEqual(new Table([]).distinct('x'), []);
  });

  it('returns a single value when all rows have the same value', () => {
    const t = new Table([{ k: 'x' }, { k: 'x' }, { k: 'x' }]);
    assert.deepEqual(t.distinct('k'), ['x']);
  });

  it('handles null values', () => {
    const t = new Table([{ v: null }, { v: 1 }, { v: null }]);
    const result = t.distinct('v');
    assert.equal(result.length, 2);
    assert.ok(result.includes(null));
    assert.ok(result.includes(1));
  });

  it('handles undefined values', () => {
    const t = new Table([{ v: undefined }, { v: 1 }, { v: undefined }]);
    const result = t.distinct('v');
    assert.equal(result.length, 2);
  });

  it('returns distinct values after a where filter', () => {
    const t = new Table([{ dept: 'eng', name: 'Alice' }, { dept: 'eng', name: 'Bob' }, { dept: 'hr', name: 'Carol' }]);
    const result = t.where((r) => r.dept === 'eng').distinct('name');
    assert.deepEqual(result, ['Alice', 'Bob']);
  });

  it('works with boolean values', () => {
    const t = new Table([{ active: true }, { active: false }, { active: true }]);
    assert.deepEqual(t.distinct('active').sort(), [false, true]);
  });
});

// ─── join ─────────────────────────────────────────────────────────────────────

describe('join', () => {
  const users = new Table([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Carol' },
  ]);

  const orders = new Table([
    { userId: 1, product: 'Widget' },
    { userId: 1, product: 'Gadget' },
    { userId: 2, product: 'Doohickey' },
  ]);

  it('inner-joins two tables on a matching predicate', () => {
    const result = join(users, orders, (u, o) => u.id === o.userId).toArray();
    assert.equal(result.length, 3);
  });

  it('merged rows contain columns from both sides', () => {
    const result = join(users, orders, (u, o) => u.id === o.userId).toArray();
    assert.ok('name' in result[0]);
    assert.ok('product' in result[0]);
  });

  it('excludes left rows with no matching right row', () => {
    const result = join(users, orders, (u, o) => u.id === o.userId).toArray();
    const names = result.map((r) => r.name);
    assert.ok(!names.includes('Carol'));
  });

  it('returns empty table when no rows match', () => {
    const result = join(users, orders, () => false);
    assert.equal(result.count(), 0);
  });

  it('returns a cross-join when predicate is always true', () => {
    const a = new Table([{ a: 1 }, { a: 2 }]);
    const b = new Table([{ b: 'x' }, { b: 'y' }]);
    assert.equal(join(a, b, () => true).count(), 4);
  });

  it('right-side columns win on key collision', () => {
    const left = new Table([{ id: 1, name: 'left-name' }]);
    const right = new Table([{ id: 1, name: 'right-name' }]);
    const result = join(left, right, (l, r) => l.id === r.id).toArray();
    assert.equal(result[0].name, 'right-name');
  });

  it('handles empty left table', () => {
    const result = join(new Table([]), orders, () => true);
    assert.equal(result.count(), 0);
  });

  it('handles empty right table', () => {
    const result = join(users, new Table([]), () => true);
    assert.equal(result.count(), 0);
  });

  it('returns a proper Table instance (chainable)', () => {
    const result = join(users, orders, (u, o) => u.id === o.userId);
    assert.ok(result instanceof Table);
    assert.equal(result.where((r) => r.product === 'Widget').count(), 1);
  });
});
