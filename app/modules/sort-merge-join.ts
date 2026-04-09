// @ts-check
// ─── Sort-Merge Join Operations ────────────────────────────────────────────
// Sort-merge join implementations: inner, left outer, anti, semi, and cross.

// ─── Types ────────────────────────────────────────────────────────────────────

import type { Row } from './hash-join.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compare two unknown values as strings for sorting. */
function compareKeys(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const sa = String(a);
  const sb = String(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

/** Return a sorted copy of `rows` by the given `key`. */
function sortByKey(rows: Row[], key: string): Row[] {
  return [...rows].sort((a, b) => compareKeys(a[key], b[key]));
}

/** Merge two rows into a single row. */
function mergeRows(a: Row, b: Row): Row {
  return { ...a, ...b };
}

/** Create a row with all keys set to null. */
function nullRow(template: Row): Row {
  const row: Row = {};
  for (const k of Object.keys(template)) {
    row[k] = null;
  }
  return row;
}

// ─── Inner Sort-Merge Join ───────────────────────────────────────────────────

/**
 * Inner sort-merge join — sorts both sides by their join key and merges
 * with a two-pointer scan.
 */
export function sortMergeJoin(
  left: Row[],
  right: Row[],
  leftKey: string,
  rightKey: string,
): Row[] {
  const sortedLeft = sortByKey(left, leftKey);
  const sortedRight = sortByKey(right, rightKey);
  const result: Row[] = [];

  let i = 0;
  let j = 0;

  while (i < sortedLeft.length && j < sortedRight.length) {
    const cmp = compareKeys(sortedLeft[i][leftKey], sortedRight[j][rightKey]);
    if (cmp < 0) {
      i++;
    } else if (cmp > 0) {
      j++;
    } else {
      // Collect all right rows that share this key value
      const rightStart = j;
      const matchKey = sortedRight[j][rightKey];
      while (j < sortedRight.length && compareKeys(sortedRight[j][rightKey], matchKey) === 0) {
        j++;
      }
      // For each left row with matching key, pair with all collected right rows
      while (i < sortedLeft.length && compareKeys(sortedLeft[i][leftKey], matchKey) === 0) {
        for (let k = rightStart; k < j; k++) {
          result.push(mergeRows(sortedLeft[i], sortedRight[k]));
        }
        i++;
      }
    }
  }

  return result;
}

// ─── Left Sort-Merge Join ────────────────────────────────────────────────────

/**
 * Left outer sort-merge join — every left row appears at least once.
 * Unmatched right columns are filled with `null`.
 */
export function leftSortMergeJoin(
  left: Row[],
  right: Row[],
  leftKey: string,
  rightKey: string,
): Row[] {
  const sortedLeft = sortByKey(left, leftKey);
  const sortedRight = sortByKey(right, rightKey);
  const result: Row[] = [];
  const rightTemplate = right.length > 0 ? right[0] : {};

  let i = 0;
  let j = 0;

  while (i < sortedLeft.length) {
    if (j >= sortedRight.length) {
      // No more right rows — emit remaining left rows with nulls
      result.push(mergeRows(sortedLeft[i], nullRow(rightTemplate)));
      i++;
      continue;
    }

    const cmp = compareKeys(sortedLeft[i][leftKey], sortedRight[j][rightKey]);
    if (cmp < 0) {
      result.push(mergeRows(sortedLeft[i], nullRow(rightTemplate)));
      i++;
    } else if (cmp > 0) {
      j++;
    } else {
      // Collect all right rows that share this key value
      const rightStart = j;
      const matchKey = sortedRight[j][rightKey];
      while (j < sortedRight.length && compareKeys(sortedRight[j][rightKey], matchKey) === 0) {
        j++;
      }
      // For each left row with matching key, pair with all collected right rows
      while (i < sortedLeft.length && compareKeys(sortedLeft[i][leftKey], matchKey) === 0) {
        for (let k = rightStart; k < j; k++) {
          result.push(mergeRows(sortedLeft[i], sortedRight[k]));
        }
        i++;
      }
    }
  }

  return result;
}

// ─── Anti Join ───────────────────────────────────────────────────────────────

/**
 * Anti join — returns rows from `left` that have NO matching row in `right`.
 */
export function antiJoin(
  left: Row[],
  right: Row[],
  leftKey: string,
  rightKey: string,
): Row[] {
  const rightKeys = new Set<unknown>();
  for (const r of right) {
    rightKeys.add(r[rightKey]);
  }

  return left.filter((row) => !rightKeys.has(row[leftKey]));
}

// ─── Semi Join ───────────────────────────────────────────────────────────────

/**
 * Semi join — returns rows from `left` that have at least one match in `right`.
 * Unlike an inner join the left row is NOT merged with the right row.
 */
export function semiJoin(
  left: Row[],
  right: Row[],
  leftKey: string,
  rightKey: string,
): Row[] {
  const rightKeys = new Set<unknown>();
  for (const r of right) {
    rightKeys.add(r[rightKey]);
  }

  return left.filter((row) => rightKeys.has(row[leftKey]));
}

// ─── Cross Join ──────────────────────────────────────────────────────────────

/**
 * Cross join (cartesian product) — every row in `left` paired with every
 * row in `right`.
 */
export function crossJoin(left: Row[], right: Row[]): Row[] {
  const result: Row[] = [];
  for (const lRow of left) {
    for (const rRow of right) {
      result.push(mergeRows(lRow, rRow));
    }
  }
  return result;
}
