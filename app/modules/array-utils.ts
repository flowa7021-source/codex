// @ts-check
// ─── Array Utilities ─────────────────────────────────────────────────────────
// General-purpose array manipulation helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Remove duplicate values from an array. */
export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/** Remove duplicates by a key function. */
export function uniqueBy<T>(arr: T[], keyFn: (item: T) => unknown): T[] {
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Flatten a nested array one level deep. */
export function flatten<T>(arr: (T | T[])[]): T[] {
  return ([] as T[]).concat(...arr);
}

/** Deeply flatten a nested array. */
export function flattenDeep(arr: unknown[]): unknown[] {
  const result: unknown[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flattenDeep(item));
    } else {
      result.push(item);
    }
  }
  return result;
}

/** Group an array by a key function. Returns a Map. */
export function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

/** Chunk an array into arrays of size n. */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/** Zip multiple arrays together. */
export function zip<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  const length = Math.min(...arrays.map((a) => a.length));
  return Array.from({ length }, (_, i) => arrays.map((a) => a[i]));
}

/** Get the difference between two arrays (elements in a not in b). */
export function difference<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((item) => !setB.has(item));
}

/** Get the intersection of two arrays. */
export function intersection<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((item) => setB.has(item));
}

/** Rotate an array by n positions (positive = left, negative = right). */
export function rotate<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return [];
  const len = arr.length;
  const shift = ((n % len) + len) % len;
  return [...arr.slice(shift), ...arr.slice(0, shift)];
}

/** Partition an array into two based on a predicate. */
export function partition<T>(arr: T[], pred: (item: T) => boolean): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];
  for (const item of arr) {
    if (pred(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }
  return [truthy, falsy];
}

/** Sort an array by a key function, stable sort. */
export function sortBy<T>(arr: T[], keyFn: (item: T) => number | string): T[] {
  return [...arr].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });
}

/** Get the last element, or last N elements if n is provided. */
export function last<T>(arr: T[], n?: number): T | T[] | undefined {
  if (n === undefined) return arr[arr.length - 1];
  return arr.slice(Math.max(0, arr.length - n));
}

/** Create a range array [start, end) with optional step. */
export function range(start: number, end: number, step = 1): number[] {
  if (step === 0) return [];
  const result: number[] = [];
  if (step > 0) {
    for (let i = start; i < end; i += step) result.push(i);
  } else {
    for (let i = start; i > end; i += step) result.push(i);
  }
  return result;
}
