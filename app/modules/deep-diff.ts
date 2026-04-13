// @ts-check
// ─── Deep Diff Utilities ──────────────────────────────────────────────────────
// Deep comparison helpers and object diffing.

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffEntry {
  path: string;       // dot-notation path
  type: DiffType;
  oldValue?: unknown;
  newValue?: unknown;
}

// ─── deepEqual ────────────────────────────────────────────────────────────────

/** Check if two values are deeply equal. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, (b as unknown[])[i]));
  }

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k], bo[k]),
  );
}

// ─── diff ─────────────────────────────────────────────────────────────────────

/** Compare two values deeply, return list of differences. */
export function diff(oldVal: unknown, newVal: unknown, path = ''): DiffEntry[] {
  const entries: DiffEntry[] = [];
  diffRecurse(oldVal, newVal, path, entries);
  return entries;
}

function diffRecurse(oldVal: unknown, newVal: unknown, path: string, entries: DiffEntry[]): void {
  const isOldObj = oldVal !== null && typeof oldVal === 'object' && !Array.isArray(oldVal);
  const isNewObj = newVal !== null && typeof newVal === 'object' && !Array.isArray(newVal);

  if (isOldObj && isNewObj) {
    const oldObj = oldVal as Record<string, unknown>;
    const newObj = newVal as Record<string, unknown>;
    const oldKeys = new Set(Object.keys(oldObj));
    const newKeys = new Set(Object.keys(newObj));
    const allKeys = new Set([...oldKeys, ...newKeys]);

    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!oldKeys.has(key)) {
        entries.push({ path: childPath, type: 'added', newValue: newObj[key] });
      } else if (!newKeys.has(key)) {
        entries.push({ path: childPath, type: 'removed', oldValue: oldObj[key] });
      } else {
        diffRecurse(oldObj[key], newObj[key], childPath, entries);
      }
    }
    return;
  }

  if (deepEqual(oldVal, newVal)) {
    entries.push({ path, type: 'unchanged', oldValue: oldVal, newValue: newVal });
  } else {
    entries.push({ path, type: 'changed', oldValue: oldVal, newValue: newVal });
  }
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

/** Get added keys in newObj that are not in oldObj. */
export function addedKeys(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): string[] {
  return Object.keys(newObj).filter(
    (k) => !Object.prototype.hasOwnProperty.call(oldObj, k),
  );
}

/** Get removed keys in oldObj that are not in newObj. */
export function removedKeys(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): string[] {
  return Object.keys(oldObj).filter(
    (k) => !Object.prototype.hasOwnProperty.call(newObj, k),
  );
}

/** Get changed keys (exist in both but different value). */
export function changedKeys(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): string[] {
  return Object.keys(oldObj).filter(
    (k) =>
      Object.prototype.hasOwnProperty.call(newObj, k) && !deepEqual(oldObj[k], newObj[k]),
  );
}

// ─── applyDiff ────────────────────────────────────────────────────────────────

/** Patch an object with a diff (apply all changes). Returns a new object. */
export function applyDiff(
  obj: Record<string, unknown>,
  entries: DiffEntry[],
): Record<string, unknown> {
  // Deep-clone the base object so we don't mutate the input.
  const result = deepClone(obj) as Record<string, unknown>;

  for (const entry of entries) {
    if (entry.type === 'unchanged') continue;

    const segments = entry.path ? entry.path.split('.') : [];
    if (segments.length === 0) continue;

    if (entry.type === 'removed') {
      setPath(result, segments, undefined, true);
    } else {
      // added or changed
      setPath(result, segments, entry.newValue, false);
    }
  }

  return result;
}

function deepClone(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(deepClone);
  const obj = val as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    out[k] = deepClone(obj[k]);
  }
  return out;
}

function setPath(
  obj: Record<string, unknown>,
  segments: string[],
  value: unknown,
  remove: boolean,
): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (cur[seg] === null || typeof cur[seg] !== 'object' || Array.isArray(cur[seg])) {
      cur[seg] = {};
    }
    cur = cur[seg] as Record<string, unknown>;
  }
  const last = segments[segments.length - 1];
  if (remove) {
    delete cur[last];
  } else {
    cur[last] = value;
  }
}
