// ─── Unit Tests: Sort-Merge Join Operations ──────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sortMergeJoin,
  leftSortMergeJoin,
  antiJoin,
  semiJoin,
  crossJoin,
} from '../../app/modules/sort-merge-join.js';

// ─── Test Data ───────────────────────────────────────────────────────────────

const orders = [
  { orderId: 1, customerId: 100 },
  { orderId: 2, customerId: 200 },
  { orderId: 3, customerId: 100 },
  { orderId: 4, customerId: 300 },
  { orderId: 5, customerId: 999 }, // no matching customer
];

const customers = [
  { customerId: 100, name: 'Alice' },
  { customerId: 200, name: 'Bob' },
  { customerId: 300, name: 'Carol' },
  { customerId: 400, name: 'Dave' }, // no matching order
];

// ─── sortMergeJoin (inner) ──────────────────────────────────────────────────

describe('sortMergeJoin – inner join', () => {
  it('joins matching rows', () => {
    const result = sortMergeJoin(orders, customers, 'customerId', 'customerId');
    assert.equal(result.length, 4); // orders 1,2,3,4
  });

  it('excludes non-matching rows from both sides', () => {
    const result = sortMergeJoin(orders, customers, 'customerId', 'customerId');
    const ids = result.map((r) => r.orderId);
    assert.ok(!ids.includes(5)); // order 5 has customerId 999
    const names = result.map((r) => r.name);
    assert.ok(!names.includes('Dave')); // Dave has customerId 400
  });

  it('returns empty when left is empty', () => {
    assert.deepEqual(sortMergeJoin([], customers, 'customerId', 'customerId'), []);
  });

  it('returns empty when right is empty', () => {
    assert.deepEqual(sortMergeJoin(orders, [], 'customerId', 'customerId'), []);
  });

  it('handles duplicate keys on both sides', () => {
    const left = [
      { k: 1, side: 'L1' },
      { k: 1, side: 'L2' },
    ];
    const right = [
      { k: 1, val: 'R1' },
      { k: 1, val: 'R2' },
    ];
    const result = sortMergeJoin(left, right, 'k', 'k');
    assert.equal(result.length, 4); // 2 x 2
  });

  it('works with unsorted input', () => {
    const left = [{ k: 3 }, { k: 1 }, { k: 2 }];
    const right = [{ k: 2, v: 'b' }, { k: 3, v: 'c' }, { k: 1, v: 'a' }];
    const result = sortMergeJoin(left, right, 'k', 'k');
    assert.equal(result.length, 3);
  });
});

// ─── leftSortMergeJoin ──────────────────────────────────────────────────────

describe('leftSortMergeJoin – left outer join', () => {
  it('keeps all left rows', () => {
    const result = leftSortMergeJoin(orders, customers, 'customerId', 'customerId');
    assert.equal(result.length, 5); // 4 matched + order 5
  });

  it('fills unmatched right columns with null', () => {
    const result = leftSortMergeJoin(orders, customers, 'customerId', 'customerId');
    const unmatched = result.find((r) => r.orderId === 5);
    assert.ok(unmatched);
    assert.equal(unmatched.name, null);
  });

  it('returns null-padded rows when right is empty', () => {
    const left = [{ a: 1 }, { a: 2 }];
    const result = leftSortMergeJoin(left, [], 'a', 'a');
    assert.equal(result.length, 2);
  });
});

// ─── antiJoin ────────────────────────────────────────────────────────────────

describe('antiJoin – rows in left with no match', () => {
  it('returns only unmatched left rows', () => {
    const result = antiJoin(orders, customers, 'customerId', 'customerId');
    assert.equal(result.length, 1);
    assert.equal(result[0].orderId, 5);
  });

  it('returns all left rows when right is empty', () => {
    const result = antiJoin(orders, [], 'customerId', 'customerId');
    assert.equal(result.length, orders.length);
  });

  it('returns empty when all left rows have a match', () => {
    const left = [{ k: 1 }, { k: 2 }];
    const right = [{ k: 1 }, { k: 2 }];
    assert.deepEqual(antiJoin(left, right, 'k', 'k'), []);
  });
});

// ─── semiJoin ────────────────────────────────────────────────────────────────

describe('semiJoin – rows in left with match', () => {
  it('returns matched left rows without merging', () => {
    const result = semiJoin(orders, customers, 'customerId', 'customerId');
    assert.equal(result.length, 4);
    // Should NOT have customer name merged in
    assert.ok(result.every((r) => r.name === undefined));
  });

  it('returns empty when no keys match', () => {
    const left = [{ k: 1 }];
    const right = [{ k: 2 }];
    assert.deepEqual(semiJoin(left, right, 'k', 'k'), []);
  });

  it('returns empty when left is empty', () => {
    assert.deepEqual(semiJoin([], customers, 'customerId', 'customerId'), []);
  });
});

// ─── crossJoin ───────────────────────────────────────────────────────────────

describe('crossJoin – cartesian product', () => {
  it('produces m*n rows', () => {
    const left = [{ a: 1 }, { a: 2 }];
    const right = [{ b: 'x' }, { b: 'y' }, { b: 'z' }];
    const result = crossJoin(left, right);
    assert.equal(result.length, 6);
  });

  it('merges columns from both sides', () => {
    const left = [{ a: 1 }];
    const right = [{ b: 2 }];
    const result = crossJoin(left, right);
    assert.deepEqual(result, [{ a: 1, b: 2 }]);
  });

  it('returns empty when left is empty', () => {
    assert.deepEqual(crossJoin([], [{ a: 1 }]), []);
  });

  it('returns empty when right is empty', () => {
    assert.deepEqual(crossJoin([{ a: 1 }], []), []);
  });

  it('handles single-element arrays', () => {
    const result = crossJoin([{ x: 1 }], [{ y: 2 }]);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { x: 1, y: 2 });
  });
});
