// @ts-check
// ─── Cursor Pagination Utilities ─────────────────────────────────────────────
// Cursor-based pagination helpers for databases/APIs.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CursorOptions {
  limit?: number;                    // items per page, default 20
  direction?: 'forward' | 'backward';
}

// ─── Cursor Encoding ──────────────────────────────────────────────────────────

/** Encode a cursor (base64 of JSON). */
export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

/** Decode a cursor. Returns null if invalid. */
export function decodeCursor<T = unknown>(cursor: string): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as T;
  } catch {
    return null;
  }
}

// ─── Array-Based Cursor Pagination ────────────────────────────────────────────

/**
 * Paginate an array using cursor-based pagination.
 * Items must have an `id` field used for cursor positioning.
 */
export function cursorPaginateArray<T extends { id: string }>(
  items: T[],
  cursor: string | null,
  options: CursorOptions = {},
): CursorPage<T> {
  const limit = Math.max(1, options.limit ?? 20);
  const direction = options.direction ?? 'forward';

  if (direction === 'backward') {
    return _cursorPageBackward(items, cursor, limit);
  }
  return _cursorPageForward(items, cursor, limit);
}

function _cursorPageForward<T extends { id: string }>(
  items: T[],
  cursor: string | null,
  limit: number,
): CursorPage<T> {
  let startIdx = 0;

  if (cursor !== null) {
    const cursorData = decodeCursor<{ id: string }>(cursor);
    if (cursorData !== null) {
      const idx = items.findIndex((item) => item.id === cursorData.id);
      if (idx !== -1) {
        startIdx = idx + 1;
      }
    }
  }

  const slice = items.slice(startIdx, startIdx + limit);
  const hasNext = startIdx + limit < items.length;
  const hasPrev = startIdx > 0;

  const nextCursor = hasNext ? encodeCursor({ id: slice[slice.length - 1].id }) : null;
  const prevCursor = hasPrev ? encodeCursor({ id: items[startIdx - 1].id }) : null;

  return { items: slice, nextCursor, prevCursor, hasNext, hasPrev };
}

function _cursorPageBackward<T extends { id: string }>(
  items: T[],
  cursor: string | null,
  limit: number,
): CursorPage<T> {
  let endIdx = items.length;

  if (cursor !== null) {
    const cursorData = decodeCursor<{ id: string }>(cursor);
    if (cursorData !== null) {
      const idx = items.findIndex((item) => item.id === cursorData.id);
      if (idx !== -1) {
        endIdx = idx;
      }
    }
  }

  const startIdx = Math.max(0, endIdx - limit);
  const slice = items.slice(startIdx, endIdx);
  const hasPrev = startIdx > 0;
  const hasNext = endIdx < items.length;

  const prevCursor = hasPrev ? encodeCursor({ id: items[startIdx - 1].id }) : null;
  const nextCursor = hasNext ? encodeCursor({ id: items[endIdx].id }) : null;

  return { items: slice, nextCursor, prevCursor, hasNext, hasPrev };
}

// ─── CursorPaginator Class ────────────────────────────────────────────────────

export class CursorPaginator<T extends { id: string }> {
  #items: T[];
  #defaultLimit: number;

  constructor(items: T[], limit = 20) {
    this.#items = [...items];
    this.#defaultLimit = Math.max(1, limit);
  }

  /** Get first page. */
  first(limit?: number): CursorPage<T> {
    return cursorPaginateArray(this.#items, null, {
      limit: limit ?? this.#defaultLimit,
      direction: 'forward',
    });
  }

  /** Get next page from cursor (items after the cursor). */
  after(cursor: string, limit?: number): CursorPage<T> {
    return cursorPaginateArray(this.#items, cursor, {
      limit: limit ?? this.#defaultLimit,
      direction: 'forward',
    });
  }

  /** Get previous page from cursor (items before the cursor). */
  before(cursor: string, limit?: number): CursorPage<T> {
    return cursorPaginateArray(this.#items, cursor, {
      limit: limit ?? this.#defaultLimit,
      direction: 'backward',
    });
  }

  /** Update the items (for dynamic data). */
  setItems(items: T[]): void {
    this.#items = [...items];
  }
}
