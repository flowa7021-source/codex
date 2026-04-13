// @ts-check
// ─── Hash Join Operations ──────────────────────────────────────────────────
// Database-style hash join implementations: inner, left, right, full outer,
// plus groupBy and distinct utilities.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A generic row represented as a string-keyed record. */
export type Row = Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a hash map that groups rows by the value at `key`. */
function buildHashMap(rows: Row[], key: string): Map<unknown, Row[]> {
  const map = new Map<unknown, Row[]>();
  for (const row of rows) {
    const k = row[key];
    let bucket = map.get(k);
    if (!bucket) {
      bucket = [];
      map.set(k, bucket);
    }
    bucket.push(row);
  }
  return map;
}

/** Merge two rows into a single row. Properties from `b` override `a`. */
function mergeRows(a: Row, b: Row): Row {
  return { ...a, ...b };
}

/** Create a row with all keys from `template` set to `null`. */
function nullRow(template: Row): Row {
  const row: Row = {};
  for (const k of Object.keys(template)) {
    row[k] = null;
  }
  return row;
}

// ─── Inner Hash Join ──────────────────────────────────────────────────────────

/**
 * Inner hash join — returns merged rows where `leftKey` equals `rightKey`.
 */
export function hashJoin(
  left: Row[],
  right: Row[],
  leftKey: string,
  rightKey: string,
): Row[] {
  const rightMap = buildHashMap(right, rightKey);
  const result: Row[] = [];

  for (const lRow of left) {
    const matches = rightMap.get(lRow[leftKey]);
    if (matches) {
      for (const rRow of matches) {
        result.push(mergeRows(lRow, rRow));
      }
    }
  }
  return result;
}

// ─── Left Hash Join ──────────────────────────────────────────────────────────

/**
 * Left outer hash join — every left row appears at least once; unmatched
 * right columns are filled with `null`.
 */
export function leftHashJoin(
  left: Row[],
  right: Row[],
  leftKey: string,
  rightKey: string,
): Row[] {
  const rightMap = buildHashMap(right, rightKey);
  const result: Row[] = [];
  const rightTemplate = right.length > 0 ? right[0] : {};

  for (const lRow of left) {
    const matches = rightMap.get(lRow[leftKey]);
    if (matches) {
      for (const rRow of matches) {
        result.push(mergeRows(lRow, rRow));
      }
    } else {
      result.push(mergeRows(lRow, nullRow(rightTemplate)));
    }
  }
  return result;
}

// ─── Right Hash Join ─────────────────────────────────────────────────────────

/**
 * Right outer hash join — every right row appears at least once; unmatched
 * left columns are filled with `null`.
 */
export function rightHashJoin(
  left: Row[],
  right: Row[],
  leftKey: string,
  rightKey: string,
): Row[] {
  const leftMap = buildHashMap(left, leftKey);
  const result: Row[] = [];
  const leftTemplate = left.length > 0 ? left[0] : {};

  for (const rRow of right) {
    const matches = leftMap.get(rRow[rightKey]);
    if (matches) {
      for (const lRow of matches) {
        result.push(mergeRows(lRow, rRow));
      }
    } else {
      result.push(mergeRows(nullRow(leftTemplate), rRow));
    }
  }
  return result;
}

// ─── Full Hash Join ──────────────────────────────────────────────────────────

/**
 * Full outer hash join — every row from both sides appears at least once.
 */
export function fullHashJoin(
  left: Row[],
  right: Row[],
  leftKey: string,
  rightKey: string,
): Row[] {
  const rightMap = buildHashMap(right, rightKey);
  const result: Row[] = [];
  const matchedRightKeys = new Set<unknown>();
  const rightTemplate = right.length > 0 ? right[0] : {};
  const leftTemplate = left.length > 0 ? left[0] : {};

  // Emit all left rows (with matches or null-padded)
  for (const lRow of left) {
    const k = lRow[leftKey];
    const matches = rightMap.get(k);
    if (matches) {
      matchedRightKeys.add(k);
      for (const rRow of matches) {
        result.push(mergeRows(lRow, rRow));
      }
    } else {
      result.push(mergeRows(lRow, nullRow(rightTemplate)));
    }
  }

  // Emit unmatched right rows
  for (const rRow of right) {
    if (!matchedRightKeys.has(rRow[rightKey])) {
      result.push(mergeRows(nullRow(leftTemplate), rRow));
    }
  }

  return result;
}

// ─── Group By ────────────────────────────────────────────────────────────────

/**
 * Group rows by `key` and apply `aggregate` to each group.
 */
export function groupBy<T>(
  rows: Row[],
  key: string,
  aggregate: (group: Row[]) => T,
): { key: unknown; value: T }[] {
  const map = buildHashMap(rows, key);
  const result: { key: unknown; value: T }[] = [];
  for (const [k, group] of map) {
    result.push({ key: k, value: aggregate(group) });
  }
  return result;
}

// ─── Distinct ────────────────────────────────────────────────────────────────

/**
 * Return rows with distinct values for `key`, keeping the first occurrence.
 */
export function distinct(rows: Row[], key: string): Row[] {
  const seen = new Set<unknown>();
  const result: Row[] = [];
  for (const row of rows) {
    const k = row[key];
    if (!seen.has(k)) {
      seen.add(k);
      result.push(row);
    }
  }
  return result;
}
