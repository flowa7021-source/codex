// ─── Unit Tests: cursor-pagination ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeCursor,
  decodeCursor,
  cursorPaginateArray,
  CursorPaginator,
} from '../../app/modules/cursor-pagination.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a simple item array: [{id:'1'}, {id:'2'}, ...] */
function makeItems(count) {
  return Array.from({ length: count }, (_, i) => ({ id: String(i + 1) }));
}

// ─── encodeCursor / decodeCursor ──────────────────────────────────────────────

describe('encodeCursor / decodeCursor', () => {
  it('roundtrip with a plain string value', () => {
    const cursor = encodeCursor('hello');
    assert.equal(decodeCursor(cursor), 'hello');
  });

  it('roundtrip with an object value', () => {
    const value = { id: 'abc', page: 3 };
    const cursor = encodeCursor(value);
    assert.deepEqual(decodeCursor(cursor), value);
  });

  it('roundtrip with a number', () => {
    const cursor = encodeCursor(42);
    assert.equal(decodeCursor(cursor), 42);
  });

  it('roundtrip with null', () => {
    const cursor = encodeCursor(null);
    assert.equal(decodeCursor(cursor), null);
  });

  it('roundtrip with an array', () => {
    const cursor = encodeCursor([1, 2, 3]);
    assert.deepEqual(decodeCursor(cursor), [1, 2, 3]);
  });

  it('returns null for invalid base64', () => {
    assert.equal(decodeCursor('!!!not-valid-base64!!!'), null);
  });

  it('returns null for valid base64 but invalid JSON', () => {
    const badBase64 = Buffer.from('{not json}').toString('base64');
    assert.equal(decodeCursor(badBase64), null);
  });

  it('produces a string (not an object)', () => {
    const cursor = encodeCursor({ id: '1' });
    assert.equal(typeof cursor, 'string');
  });

  it('different values produce different cursors', () => {
    const a = encodeCursor({ id: '1' });
    const b = encodeCursor({ id: '2' });
    assert.notEqual(a, b);
  });
});

// ─── cursorPaginateArray ──────────────────────────────────────────────────────

describe('cursorPaginateArray – forward (default)', () => {
  it('returns first page when cursor is null', () => {
    const items = makeItems(10);
    const page = cursorPaginateArray(items, null, { limit: 3 });
    assert.equal(page.items.length, 3);
    assert.deepEqual(page.items, items.slice(0, 3));
    assert.equal(page.hasPrev, false);
    assert.equal(page.hasNext, true);
  });

  it('nextCursor is non-null when there are more items', () => {
    const items = makeItems(10);
    const page = cursorPaginateArray(items, null, { limit: 3 });
    assert.notEqual(page.nextCursor, null);
  });

  it('prevCursor is null on first page', () => {
    const items = makeItems(10);
    const page = cursorPaginateArray(items, null, { limit: 3 });
    assert.equal(page.prevCursor, null);
  });

  it('advances to next page using nextCursor', () => {
    const items = makeItems(10);
    const page1 = cursorPaginateArray(items, null, { limit: 3 });
    const page2 = cursorPaginateArray(items, page1.nextCursor, { limit: 3 });
    assert.deepEqual(page2.items, items.slice(3, 6));
    assert.equal(page2.hasPrev, true);
  });

  it('last page has no next cursor', () => {
    const items = makeItems(6);
    const page1 = cursorPaginateArray(items, null, { limit: 3 });
    const page2 = cursorPaginateArray(items, page1.nextCursor, { limit: 3 });
    assert.equal(page2.hasNext, false);
    assert.equal(page2.nextCursor, null);
  });

  it('returns all items when limit >= total', () => {
    const items = makeItems(5);
    const page = cursorPaginateArray(items, null, { limit: 100 });
    assert.equal(page.items.length, 5);
    assert.equal(page.hasNext, false);
  });

  it('default limit is 20', () => {
    const items = makeItems(25);
    const page = cursorPaginateArray(items, null);
    assert.equal(page.items.length, 20);
  });

  it('handles empty array', () => {
    const page = cursorPaginateArray([], null, { limit: 5 });
    assert.deepEqual(page.items, []);
    assert.equal(page.hasNext, false);
    assert.equal(page.hasPrev, false);
    assert.equal(page.nextCursor, null);
    assert.equal(page.prevCursor, null);
  });

  it('can traverse all pages and cover all items', () => {
    const items = makeItems(7);
    let cursor = null;
    const seen = [];
    let safetyLimit = 20;
    do {
      const page = cursorPaginateArray(items, cursor, { limit: 3 });
      seen.push(...page.items.map((x) => x.id));
      cursor = page.nextCursor;
      safetyLimit--;
    } while (cursor !== null && safetyLimit > 0);
    assert.deepEqual(seen, items.map((x) => x.id));
  });

  it('returns empty result for invalid cursor (treats as start)', () => {
    const items = makeItems(5);
    // An invalid cursor should not throw; treat as start or skip gracefully
    assert.doesNotThrow(() => cursorPaginateArray(items, 'invalid-cursor', { limit: 3 }));
  });
});

describe('cursorPaginateArray – backward', () => {
  it('returns last items when cursor is null', () => {
    const items = makeItems(10);
    const page = cursorPaginateArray(items, null, { limit: 3, direction: 'backward' });
    assert.deepEqual(page.items, items.slice(7, 10));
    assert.equal(page.hasNext, false);
    assert.equal(page.hasPrev, true);
  });

  it('paginates backward using cursor', () => {
    const items = makeItems(9);
    // Get last 3 items first
    const page1 = cursorPaginateArray(items, null, { limit: 3, direction: 'backward' });
    // Build cursor pointing at the first item of page1 so backward from there gives previous 3
    const cursorForFirst = encodeCursor({ id: page1.items[0].id });
    const page2 = cursorPaginateArray(items, cursorForFirst, { limit: 3, direction: 'backward' });
    assert.deepEqual(page2.items, items.slice(3, 6));
  });

  it('first backward page has no nextCursor', () => {
    const items = makeItems(6);
    const page = cursorPaginateArray(items, null, { limit: 3, direction: 'backward' });
    assert.equal(page.nextCursor, null);
    assert.equal(page.hasNext, false);
  });
});

// ─── CursorPaginator ──────────────────────────────────────────────────────────

describe('CursorPaginator – first()', () => {
  it('returns first page', () => {
    const pager = new CursorPaginator(makeItems(10), 3);
    const page = pager.first();
    assert.equal(page.items.length, 3);
    assert.equal(page.items[0].id, '1');
    assert.equal(page.hasPrev, false);
    assert.equal(page.hasNext, true);
  });

  it('respects custom limit passed to first()', () => {
    const pager = new CursorPaginator(makeItems(10), 3);
    const page = pager.first(5);
    assert.equal(page.items.length, 5);
  });

  it('returns all items when limit >= total', () => {
    const pager = new CursorPaginator(makeItems(4), 3);
    const page = pager.first(100);
    assert.equal(page.items.length, 4);
    assert.equal(page.hasNext, false);
  });
});

describe('CursorPaginator – after()', () => {
  it('returns the next page after a cursor', () => {
    const pager = new CursorPaginator(makeItems(9), 3);
    const page1 = pager.first();
    const page2 = pager.after(page1.nextCursor);
    assert.equal(page2.items[0].id, '4');
    assert.equal(page2.items.length, 3);
    assert.equal(page2.hasPrev, true);
  });

  it('last page has hasNext = false', () => {
    const pager = new CursorPaginator(makeItems(6), 3);
    const page1 = pager.first();
    const page2 = pager.after(page1.nextCursor);
    assert.equal(page2.hasNext, false);
    assert.equal(page2.nextCursor, null);
  });

  it('can walk all pages', () => {
    const items = makeItems(8);
    const pager = new CursorPaginator(items, 3);
    const allIds = [];
    let page = pager.first();
    page.items.forEach((x) => allIds.push(x.id));
    while (page.nextCursor) {
      page = pager.after(page.nextCursor);
      page.items.forEach((x) => allIds.push(x.id));
    }
    assert.deepEqual(allIds, items.map((x) => x.id));
  });
});

describe('CursorPaginator – before()', () => {
  it('returns items before the cursor', () => {
    const items = makeItems(9);
    const pager = new CursorPaginator(items, 3);
    // Get the last page via backward
    const lastPage = cursorPaginateArray(items, null, { limit: 3, direction: 'backward' });
    // cursor pointing to first item of last page
    const cursorAtItem7 = encodeCursor({ id: lastPage.items[0].id });
    const page = pager.before(cursorAtItem7);
    assert.equal(page.items.length, 3);
    assert.equal(page.items[0].id, '4');
  });

  it('respects custom limit in before()', () => {
    const items = makeItems(10);
    const pager = new CursorPaginator(items, 3);
    const cursorAtItem6 = encodeCursor({ id: '6' });
    const page = pager.before(cursorAtItem6, 2);
    assert.equal(page.items.length, 2);
    assert.deepEqual(page.items.map((x) => x.id), ['4', '5']);
  });
});

describe('CursorPaginator – setItems()', () => {
  it('updates the item set', () => {
    const pager = new CursorPaginator(makeItems(5), 3);
    pager.setItems(makeItems(2));
    const page = pager.first();
    assert.equal(page.items.length, 2);
    assert.equal(page.hasNext, false);
  });

  it('does not mutate the original array passed to setItems', () => {
    const pager = new CursorPaginator(makeItems(3), 2);
    const arr = makeItems(4);
    pager.setItems(arr);
    arr.push({ id: '99' });
    const page = pager.first(10);
    assert.equal(page.items.length, 4);
  });
});
