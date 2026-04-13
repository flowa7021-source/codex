// ─── Unit Tests: data-table ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DataTable } from '../../app/modules/data-table.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('DataTable constructor', () => {
  it('creates an empty table with no arguments', () => {
    const dt = new DataTable();
    assert.equal(dt.rowCount, 0);
    assert.deepEqual(dt.columns, []);
  });

  it('creates a table from an initial array of rows', () => {
    const dt = new DataTable([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
    assert.equal(dt.rowCount, 2);
    assert.deepEqual(dt.columns, ['a', 'b']);
  });

  it('creates an empty table from an empty array', () => {
    const dt = new DataTable([]);
    assert.equal(dt.rowCount, 0);
    assert.deepEqual(dt.columns, []);
  });
});

// ─── rowCount / columns ───────────────────────────────────────────────────────

describe('rowCount and columns', () => {
  it('returns correct rowCount', () => {
    const dt = new DataTable([{ x: 1 }, { x: 2 }, { x: 3 }]);
    assert.equal(dt.rowCount, 3);
  });

  it('returns correct columns', () => {
    const dt = new DataTable([{ name: 'Alice', age: 30, city: 'NYC' }]);
    assert.deepEqual(dt.columns, ['name', 'age', 'city']);
  });

  it('columns snapshot does not mutate internal state', () => {
    const dt = new DataTable([{ a: 1 }]);
    const cols = dt.columns;
    cols.push('injected');
    assert.deepEqual(dt.columns, ['a']);
  });
});

// ─── addRow ───────────────────────────────────────────────────────────────────

describe('addRow', () => {
  it('adds a row and increments rowCount', () => {
    const dt = new DataTable();
    dt.addRow({ a: 1 });
    assert.equal(dt.rowCount, 1);
  });

  it('updates columns when new keys are introduced', () => {
    const dt = new DataTable();
    dt.addRow({ a: 1 });
    dt.addRow({ b: 2 });
    assert.deepEqual(dt.columns, ['a', 'b']);
  });

  it('does not duplicate existing columns', () => {
    const dt = new DataTable();
    dt.addRow({ a: 1, b: 2 });
    dt.addRow({ a: 3, b: 4 });
    assert.deepEqual(dt.columns, ['a', 'b']);
  });

  it('stores a copy of the row, not a reference', () => {
    const dt = new DataTable();
    const row = { a: 1 };
    dt.addRow(row);
    row.a = 99;
    assert.equal(dt.getRow(0)?.a, 1);
  });
});

// ─── getRow ───────────────────────────────────────────────────────────────────

describe('getRow', () => {
  it('returns the correct row by index', () => {
    const dt = new DataTable([{ x: 10 }, { x: 20 }, { x: 30 }]);
    assert.deepEqual(dt.getRow(1), { x: 20 });
  });

  it('returns undefined for out-of-bounds index', () => {
    const dt = new DataTable([{ x: 1 }]);
    assert.equal(dt.getRow(5), undefined);
    assert.equal(dt.getRow(-1), undefined);
  });

  it('returns a copy, not a reference', () => {
    const dt = new DataTable([{ a: 1 }]);
    const row = dt.getRow(0);
    if (row) row.a = 99;
    assert.equal(dt.getRow(0)?.a, 1);
  });
});

// ─── filter eq ────────────────────────────────────────────────────────────────

describe('filter eq', () => {
  it('filters rows by equality', () => {
    const dt = new DataTable([
      { name: 'Alice', dept: 'eng' },
      { name: 'Bob', dept: 'hr' },
      { name: 'Carol', dept: 'eng' },
    ]);
    const result = dt.filter({ column: 'dept', operator: 'eq', value: 'eng' });
    assert.equal(result.rowCount, 2);
    assert.equal(result.getRow(0)?.name, 'Alice');
    assert.equal(result.getRow(1)?.name, 'Carol');
  });

  it('returns empty table when no rows match', () => {
    const dt = new DataTable([{ a: 1 }, { a: 2 }]);
    const result = dt.filter({ column: 'a', operator: 'eq', value: 99 });
    assert.equal(result.rowCount, 0);
  });

  it('returns new DataTable (does not mutate original)', () => {
    const dt = new DataTable([{ a: 1 }, { a: 2 }]);
    dt.filter({ column: 'a', operator: 'eq', value: 1 });
    assert.equal(dt.rowCount, 2);
  });
});

// ─── filter contains ──────────────────────────────────────────────────────────

describe('filter contains', () => {
  it('filters by substring match', () => {
    const dt = new DataTable([
      { name: 'Alexander' },
      { name: 'Alice' },
      { name: 'Bob' },
    ]);
    const result = dt.filter({ column: 'name', operator: 'contains', value: 'Al' });
    assert.equal(result.rowCount, 2);
  });

  it('returns empty table when no match', () => {
    const dt = new DataTable([{ name: 'Alice' }]);
    const result = dt.filter({ column: 'name', operator: 'contains', value: 'xyz' });
    assert.equal(result.rowCount, 0);
  });
});

// ─── filter lt / gt ───────────────────────────────────────────────────────────

describe('filter lt and gt', () => {
  it('filters rows where column < value', () => {
    const dt = new DataTable([{ age: 20 }, { age: 30 }, { age: 40 }]);
    const result = dt.filter({ column: 'age', operator: 'lt', value: 35 });
    assert.equal(result.rowCount, 2);
  });

  it('filters rows where column > value', () => {
    const dt = new DataTable([{ age: 20 }, { age: 30 }, { age: 40 }]);
    const result = dt.filter({ column: 'age', operator: 'gt', value: 25 });
    assert.equal(result.rowCount, 2);
  });

  it('filters rows where column <= value', () => {
    const dt = new DataTable([{ age: 20 }, { age: 30 }, { age: 40 }]);
    const result = dt.filter({ column: 'age', operator: 'lte', value: 30 });
    assert.equal(result.rowCount, 2);
  });

  it('filters rows where column >= value', () => {
    const dt = new DataTable([{ age: 20 }, { age: 30 }, { age: 40 }]);
    const result = dt.filter({ column: 'age', operator: 'gte', value: 30 });
    assert.equal(result.rowCount, 2);
  });
});

// ─── multiple filters (AND logic) ─────────────────────────────────────────────

describe('multiple filters - AND logic', () => {
  it('applies multiple filter specs as AND', () => {
    const dt = new DataTable([
      { name: 'Alice', age: 30, dept: 'eng' },
      { name: 'Bob', age: 25, dept: 'eng' },
      { name: 'Carol', age: 30, dept: 'hr' },
    ]);
    const result = dt.filter([
      { column: 'age', operator: 'eq', value: 30 },
      { column: 'dept', operator: 'eq', value: 'eng' },
    ]);
    assert.equal(result.rowCount, 1);
    assert.equal(result.getRow(0)?.name, 'Alice');
  });

  it('returns empty table when AND conditions are contradictory', () => {
    const dt = new DataTable([{ a: 5 }]);
    const result = dt.filter([
      { column: 'a', operator: 'gt', value: 10 },
      { column: 'a', operator: 'lt', value: 3 },
    ]);
    assert.equal(result.rowCount, 0);
  });
});

// ─── sort asc / desc ──────────────────────────────────────────────────────────

describe('sort asc/desc', () => {
  it('sorts rows ascending by default', () => {
    const dt = new DataTable([{ n: 3 }, { n: 1 }, { n: 2 }]);
    const result = dt.sort({ column: 'n' });
    assert.deepEqual(result.toArray().map((r) => r.n), [1, 2, 3]);
  });

  it('sorts rows ascending explicitly', () => {
    const dt = new DataTable([{ n: 3 }, { n: 1 }, { n: 2 }]);
    const result = dt.sort({ column: 'n', order: 'asc' });
    assert.deepEqual(result.toArray().map((r) => r.n), [1, 2, 3]);
  });

  it('sorts rows descending', () => {
    const dt = new DataTable([{ n: 3 }, { n: 1 }, { n: 2 }]);
    const result = dt.sort({ column: 'n', order: 'desc' });
    assert.deepEqual(result.toArray().map((r) => r.n), [3, 2, 1]);
  });

  it('sorts string columns alphabetically', () => {
    const dt = new DataTable([{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }]);
    const result = dt.sort({ column: 'name', order: 'asc' });
    assert.deepEqual(result.toArray().map((r) => r.name), ['Alice', 'Bob', 'Charlie']);
  });

  it('does not mutate original table', () => {
    const dt = new DataTable([{ n: 3 }, { n: 1 }]);
    dt.sort({ column: 'n' });
    assert.equal(dt.getRow(0)?.n, 3);
  });
});

// ─── sort multi-column ────────────────────────────────────────────────────────

describe('sort multi-column', () => {
  it('applies secondary sort when primary values are equal', () => {
    const dt = new DataTable([
      { dept: 'eng', name: 'Charlie' },
      { dept: 'hr', name: 'Alice' },
      { dept: 'eng', name: 'Alice' },
    ]);
    const result = dt.sort([
      { column: 'dept', order: 'asc' },
      { column: 'name', order: 'asc' },
    ]);
    const names = result.toArray().map((r) => r.name);
    assert.deepEqual(names, ['Alice', 'Charlie', 'Alice']);
  });
});

// ─── select ───────────────────────────────────────────────────────────────────

describe('select', () => {
  it('reduces to specified columns', () => {
    const dt = new DataTable([{ a: 1, b: 2, c: 3 }]);
    const result = dt.select(['a', 'c']);
    assert.deepEqual(result.columns, ['a', 'c']);
    assert.equal(result.getRow(0)?.b, undefined);
    assert.equal(result.getRow(0)?.a, 1);
  });

  it('preserves all rows', () => {
    const dt = new DataTable([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
    const result = dt.select(['a']);
    assert.equal(result.rowCount, 2);
  });
});

// ─── distinct ────────────────────────────────────────────────────────────────

describe('distinct', () => {
  it('returns unique values for a column', () => {
    const dt = new DataTable([
      { color: 'red' },
      { color: 'blue' },
      { color: 'red' },
      { color: 'green' },
    ]);
    const result = dt.distinct('color');
    assert.deepEqual(result.sort(), ['blue', 'green', 'red']);
  });

  it('returns single value when all rows have the same value', () => {
    const dt = new DataTable([{ x: 1 }, { x: 1 }, { x: 1 }]);
    assert.deepEqual(dt.distinct('x'), [1]);
  });

  it('returns empty array for empty table', () => {
    const dt = new DataTable();
    assert.deepEqual(dt.distinct('x'), []);
  });
});

// ─── count / sum / avg / min / max ───────────────────────────────────────────

describe('aggregates', () => {
  const rows = [
    { name: 'Alice', score: 90 },
    { name: 'Bob', score: 70 },
    { name: 'Carol', score: 80 },
  ];

  it('count returns total number of rows', () => {
    const dt = new DataTable(rows);
    assert.equal(dt.count(), 3);
  });

  it('sum returns the sum of a numeric column', () => {
    const dt = new DataTable(rows);
    assert.equal(dt.sum('score'), 240);
  });

  it('avg returns the average of a numeric column', () => {
    const dt = new DataTable(rows);
    assert.equal(dt.avg('score'), 80);
  });

  it('min returns the minimum value of a numeric column', () => {
    const dt = new DataTable(rows);
    assert.equal(dt.min('score'), 70);
  });

  it('max returns the maximum value of a numeric column', () => {
    const dt = new DataTable(rows);
    assert.equal(dt.max('score'), 90);
  });

  it('sum returns 0 for empty table', () => {
    const dt = new DataTable();
    assert.equal(dt.sum('score'), 0);
  });

  it('avg returns 0 for empty table', () => {
    const dt = new DataTable();
    assert.equal(dt.avg('score'), 0);
  });

  it('min returns 0 for empty table', () => {
    const dt = new DataTable();
    assert.equal(dt.min('score'), 0);
  });

  it('max returns 0 for empty table', () => {
    const dt = new DataTable();
    assert.equal(dt.max('score'), 0);
  });

  it('count returns 0 for empty table', () => {
    const dt = new DataTable();
    assert.equal(dt.count(), 0);
  });
});

// ─── toArray ──────────────────────────────────────────────────────────────────

describe('toArray', () => {
  it('returns all rows as an array of records', () => {
    const input = [{ a: 1, b: 'x' }, { a: 2, b: 'y' }];
    const dt = new DataTable(input);
    assert.deepEqual(dt.toArray(), input);
  });

  it('returns empty array for empty table', () => {
    const dt = new DataTable();
    assert.deepEqual(dt.toArray(), []);
  });

  it('returns copies of rows, not references', () => {
    const dt = new DataTable([{ a: 1 }]);
    const arr = dt.toArray();
    arr[0].a = 99;
    assert.equal(dt.getRow(0)?.a, 1);
  });
});
