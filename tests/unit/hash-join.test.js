// ─── Unit Tests: Hash Join Operations ─────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hashJoin,
  leftHashJoin,
  rightHashJoin,
  fullHashJoin,
  groupBy,
  distinct,
} from '../../app/modules/hash-join.js';

// ─── Test Data ───────────────────────────────────────────────────────────────

const employees = [
  { id: 1, name: 'Alice', deptId: 10 },
  { id: 2, name: 'Bob', deptId: 20 },
  { id: 3, name: 'Carol', deptId: 10 },
  { id: 4, name: 'Dave', deptId: 30 },
  { id: 5, name: 'Eve', deptId: 99 }, // no matching dept
];

const departments = [
  { deptId: 10, deptName: 'Engineering' },
  { deptId: 20, deptName: 'Sales' },
  { deptId: 30, deptName: 'Marketing' },
  { deptId: 40, deptName: 'HR' }, // no matching employee
];

// ─── hashJoin (inner) ────────────────────────────────────────────────────────

describe('hashJoin – inner join', () => {
  it('joins matching rows from both sides', () => {
    const result = hashJoin(employees, departments, 'deptId', 'deptId');
    assert.equal(result.length, 4); // Alice, Bob, Carol, Dave
    assert.ok(result.every((r) => r.deptName !== undefined));
  });

  it('excludes rows without a match', () => {
    const result = hashJoin(employees, departments, 'deptId', 'deptId');
    const names = result.map((r) => r.name);
    assert.ok(!names.includes('Eve')); // Eve has deptId 99
  });

  it('returns empty array when no keys match', () => {
    const left = [{ a: 1 }];
    const right = [{ b: 2 }];
    assert.deepEqual(hashJoin(left, right, 'a', 'b'), []);
  });

  it('handles empty left array', () => {
    assert.deepEqual(hashJoin([], departments, 'deptId', 'deptId'), []);
  });

  it('handles empty right array', () => {
    assert.deepEqual(hashJoin(employees, [], 'deptId', 'deptId'), []);
  });

  it('produces multiple rows for duplicate keys', () => {
    const left = [{ k: 1, v: 'a' }];
    const right = [
      { k: 1, r: 'x' },
      { k: 1, r: 'y' },
    ];
    const result = hashJoin(left, right, 'k', 'k');
    assert.equal(result.length, 2);
  });
});

// ─── leftHashJoin ────────────────────────────────────────────────────────────

describe('leftHashJoin – left outer join', () => {
  it('keeps all left rows', () => {
    const result = leftHashJoin(employees, departments, 'deptId', 'deptId');
    assert.equal(result.length, 5); // 4 matched + Eve unmatched
  });

  it('fills unmatched right columns with null', () => {
    const result = leftHashJoin(employees, departments, 'deptId', 'deptId');
    const eve = result.find((r) => r.name === 'Eve');
    assert.ok(eve);
    assert.equal(eve.deptName, null);
  });

  it('returns null-padded rows when right is empty', () => {
    const result = leftHashJoin([{ a: 1 }], [], 'a', 'a');
    assert.equal(result.length, 1);
  });
});

// ─── rightHashJoin ───────────────────────────────────────────────────────────

describe('rightHashJoin – right outer join', () => {
  it('keeps all right rows', () => {
    const result = rightHashJoin(employees, departments, 'deptId', 'deptId');
    // 4 matched + HR unmatched
    assert.equal(result.length, 5);
  });

  it('fills unmatched left columns with null', () => {
    const result = rightHashJoin(employees, departments, 'deptId', 'deptId');
    const hr = result.find((r) => r.deptName === 'HR');
    assert.ok(hr);
    assert.equal(hr.name, null);
  });
});

// ─── fullHashJoin ────────────────────────────────────────────────────────────

describe('fullHashJoin – full outer join', () => {
  it('includes all rows from both sides', () => {
    const result = fullHashJoin(employees, departments, 'deptId', 'deptId');
    // 4 matched + Eve (left only) + HR (right only) = 6
    assert.equal(result.length, 6);
  });

  it('null-pads left-only rows on the right side', () => {
    const result = fullHashJoin(employees, departments, 'deptId', 'deptId');
    const eve = result.find((r) => r.name === 'Eve');
    assert.ok(eve);
    assert.equal(eve.deptName, null);
  });

  it('null-pads right-only rows on the left side', () => {
    const result = fullHashJoin(employees, departments, 'deptId', 'deptId');
    const hr = result.find((r) => r.deptName === 'HR');
    assert.ok(hr);
    assert.equal(hr.name, null);
  });

  it('returns empty for two empty arrays', () => {
    assert.deepEqual(fullHashJoin([], [], 'k', 'k'), []);
  });
});

// ─── groupBy ─────────────────────────────────────────────────────────────────

describe('groupBy', () => {
  it('groups rows and applies aggregate', () => {
    const data = [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
      { category: 'A', value: 30 },
    ];
    const result = groupBy(data, 'category', (group) => group.length);
    assert.equal(result.length, 2);
    const a = result.find((r) => r.key === 'A');
    assert.ok(a);
    assert.equal(a.value, 2);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(groupBy([], 'k', (g) => g.length), []);
  });

  it('supports sum aggregation', () => {
    const data = [
      { dept: 'X', salary: 100 },
      { dept: 'X', salary: 200 },
      { dept: 'Y', salary: 300 },
    ];
    const result = groupBy(data, 'dept', (group) =>
      group.reduce((sum, r) => sum + /** @type {number} */ (r.salary), 0),
    );
    const x = result.find((r) => r.key === 'X');
    assert.ok(x);
    assert.equal(x.value, 300);
  });
});

// ─── distinct ────────────────────────────────────────────────────────────────

describe('distinct', () => {
  it('removes duplicate key values', () => {
    const data = [
      { color: 'red', id: 1 },
      { color: 'blue', id: 2 },
      { color: 'red', id: 3 },
    ];
    const result = distinct(data, 'color');
    assert.equal(result.length, 2);
  });

  it('keeps the first occurrence', () => {
    const data = [
      { color: 'red', id: 1 },
      { color: 'red', id: 2 },
    ];
    const result = distinct(data, 'color');
    assert.equal(result[0].id, 1);
  });

  it('returns empty for empty input', () => {
    assert.deepEqual(distinct([], 'k'), []);
  });

  it('returns all rows when all keys are unique', () => {
    const data = [{ k: 1 }, { k: 2 }, { k: 3 }];
    assert.equal(distinct(data, 'k').length, 3);
  });
});
