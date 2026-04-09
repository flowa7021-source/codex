// @ts-check
// ─── Array Utilities ─────────────────────────────────────────────────────────
// General-purpose array manipulation helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Split an array into chunks of `size`. */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
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

/** Remove duplicate values from an array. */
export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/** Remove duplicates by a key function. */
export function uniqueBy<T>(arr: T[], key: (item: T) => unknown): T[] {
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Group an array by a key function. Returns a Record. */
export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    if (k in result) {
      result[k].push(item);
    } else {
      result[k] = [item];
    }
  }
  return result;
}

/** Partition an array into two based on a predicate: [matching, non-matching]. */
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

/** Zip two arrays into an array of pairs, stopping at the shorter length. */
export function zip<A, B>(a: A[], b: B[]): [A, B][] {
  const length = Math.min(a.length, b.length);
  return Array.from({ length }, (_, i) => [a[i], b[i]] as [A, B]);
}

/** Zip two arrays, applying a function to each pair. */
export function zipWith<A, B, C>(a: A[], b: B[], fn: (a: A, b: B) => C): C[] {
  const length = Math.min(a.length, b.length);
  return Array.from({ length }, (_, i) => fn(a[i], b[i]));
}

/** Get elements common to both arrays. */
export function intersection<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((item) => setB.has(item));
}

/** Get elements in `a` that are not in `b`. */
export function difference<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((item) => !setB.has(item));
}

/** Get the union of two arrays (unique elements from both). */
export function union<T>(a: T[], b: T[]): T[] {
  return unique([...a, ...b]);
}

/** Shuffle an array. Optionally pass a `seed` for determinism (seeded LCG). */
export function shuffle<T>(arr: T[], seed?: number): T[] {
  const result = [...arr];
  let rand: () => number;

  if (seed !== undefined) {
    // Simple LCG seeded PRNG
    let s = seed | 0;
    rand = () => {
      s = (Math.imul(1664525, s) + 1013904223) | 0;
      return (s >>> 0) / 0x100000000;
    };
  } else {
    rand = Math.random;
  }

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Sample `n` random elements from an array (without replacement). */
export function sample<T>(arr: T[], n: number): T[] {
  if (n <= 0) return [];
  if (n >= arr.length) return [...arr];
  return shuffle(arr).slice(0, n);
}

/**
 * Rotate an array by `n` positions.
 * Positive n = right rotation (last elements move to front).
 * Negative n = left rotation (first elements move to back).
 */
export function rotate<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return [];
  const len = arr.length;
  // Normalise: positive = right, so we shift from the right
  const shift = ((-n % len) + len) % len;
  return [...arr.slice(shift), ...arr.slice(0, shift)];
}

/** Remove falsy values (null, undefined, false, 0, '') from an array. */
export function compact<T>(arr: (T | null | undefined | false | 0 | '')[]): T[] {
  return arr.filter(Boolean) as T[];
}

/** Sum an array of numbers. */
export function sum(arr: number[]): number {
  return arr.reduce((acc, n) => acc + n, 0);
}

/** Create a range array [start, end) with optional step (default 1). */
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

/** Sort array by a key function (returns new array). */
export function sortBy<T>(arr: T[], key: (item: T) => number | string): T[] {
  return [...arr].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** Get the last element (or undefined if empty). */
export function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}
