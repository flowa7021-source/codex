// ─── Number Range ─────────────────────────────────────────────────────────────
// Numeric range operations on half-open intervals [start, end).

// ─── Types ────────────────────────────────────────────────────────────────────

/** A half-open interval [start, end). Start is inclusive, end is exclusive. */
export interface Range {
  start: number;
  end: number;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a Range. Throws if start > end.
 */
export function createRange(start: number, end: number): Range {
  if (start > end) {
    throw new RangeError(`start (${start}) must not be greater than end (${end})`);
  }
  return { start, end };
}

// ─── Predicates ───────────────────────────────────────────────────────────────

/** Return true if the range is empty (start === end). */
export function isEmpty(range: Range): boolean {
  return range.start === range.end;
}

/** Return true if value falls within [start, end). */
export function contains(range: Range, value: number): boolean {
  return value >= range.start && value < range.end;
}

/** Return true if ranges a and b share any common point. */
export function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

// ─── Measurements ─────────────────────────────────────────────────────────────

/** Return the size (end − start) of the range. */
export function length(range: Range): number {
  return range.end - range.start;
}

/** Clamp a value to be within [range.start, range.end]. */
export function clamp(value: number, range: Range): number {
  if (value < range.start) return range.start;
  if (value > range.end) return range.end;
  return value;
}

// ─── Set Operations ───────────────────────────────────────────────────────────

/**
 * Return the overlapping portion of a and b, or null if they don't overlap.
 */
export function intersection(a: Range, b: Range): Range | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  if (start >= end) return null;
  return { start, end };
}

/**
 * Return the smallest range that covers both a and b, or null if they are
 * disjoint (i.e. don't overlap and aren't adjacent).
 */
export function union(a: Range, b: Range): Range | null {
  // Allow adjacent ranges (touching but not overlapping) to merge
  if (a.end < b.start || b.end < a.start) return null;
  return { start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) };
}

/**
 * Subtract range b from range a.  Returns 0, 1, or 2 ranges that together
 * cover the parts of a not covered by b.
 */
export function difference(a: Range, b: Range): Range[] {
  if (!overlaps(a, b)) return [{ start: a.start, end: a.end }];

  const result: Range[] = [];

  if (a.start < b.start) {
    result.push({ start: a.start, end: b.start });
  }

  if (a.end > b.end) {
    result.push({ start: b.end, end: a.end });
  }

  return result;
}

// ─── Multi-range Operations ───────────────────────────────────────────────────

/**
 * Merge an array of ranges, combining all overlapping or adjacent ranges.
 * Returns a sorted, non-overlapping list.
 */
export function merge(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: Range[] = [{ start: sorted[0].start, end: sorted[0].end }];

  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    const current = sorted[i];
    if (current.start <= last.end) {
      // Overlapping or adjacent — extend last
      if (current.end > last.end) last.end = current.end;
    } else {
      result.push({ start: current.start, end: current.end });
    }
  }

  return result;
}

/**
 * Return the complement of a list of ranges within a total range.
 * The input ranges are merged before inversion.
 */
export function invert(ranges: Range[], total: Range): Range[] {
  const merged = merge(ranges);
  const result: Range[] = [];
  let cursor = total.start;

  for (const r of merged) {
    const clampedStart = Math.max(r.start, total.start);
    const clampedEnd = Math.min(r.end, total.end);

    // Skip ranges that don't overlap with total
    if (clampedStart >= clampedEnd) continue;

    if (clampedStart > cursor) {
      result.push({ start: cursor, end: clampedStart });
    }

    if (clampedEnd > cursor) {
      cursor = clampedEnd;
    }
  }

  if (cursor < total.end) {
    result.push({ start: cursor, end: total.end });
  }

  return result;
}
