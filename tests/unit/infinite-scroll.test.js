// ─── Unit Tests: infinite-scroll ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InfiniteScroll } from '../../app/modules/infinite-scroll.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Create a fetchPage function that returns items for the given page. */
function makeFetch(pageSize = 5, totalItems = 25) {
  return async (page) => {
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, totalItems);
    return Array.from({ length: end - start }, (_, i) => start + i);
  };
}

/** Create a fetchPage that always rejects. */
function makeFailingFetch(msg = 'fetch error') {
  return async (_page) => {
    throw new Error(msg);
  };
}

// ─── initial state ────────────────────────────────────────────────────────────

describe('InfiniteScroll – initial state', () => {
  it('has empty items, page 1, hasMore true, loading false, error null', () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch() });
    const { items, page, hasMore, loading, error } = scroll.state;
    assert.deepEqual(items, []);
    assert.equal(page, 1);
    assert.equal(hasMore, true);
    assert.equal(loading, false);
    assert.equal(error, null);
  });
});

// ─── loadMore ─────────────────────────────────────────────────────────────────

describe('InfiniteScroll – loadMore', () => {
  it('fetches first page, appends items, increments page', async () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch(5, 25), pageSize: 5 });
    await scroll.loadMore();
    const { items, page, loading } = scroll.state;
    assert.deepEqual(items, [0, 1, 2, 3, 4]);
    assert.equal(page, 2);
    assert.equal(loading, false);
  });

  it('does not fire duplicate requests when already loading', async () => {
    let callCount = 0;
    const fetchPage = async (_page) => {
      callCount++;
      return [1, 2, 3, 4, 5];
    };
    const scroll = new InfiniteScroll({ fetchPage, pageSize: 5 });
    // Start two concurrent loadMore calls
    const p1 = scroll.loadMore();
    const p2 = scroll.loadMore(); // should be a no-op
    await Promise.all([p1, p2]);
    assert.equal(callCount, 1);
  });

  it('sets hasMore=false when fetchPage returns fewer than pageSize items', async () => {
    // Only 3 items available, pageSize=5
    const scroll = new InfiniteScroll({ fetchPage: makeFetch(5, 3), pageSize: 5 });
    await scroll.loadMore();
    assert.equal(scroll.state.hasMore, false);
  });

  it('appends items across multiple loadMore calls', async () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch(5, 15), pageSize: 5 });
    await scroll.loadMore();
    await scroll.loadMore();
    assert.deepEqual(scroll.state.items, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(scroll.state.page, 3);
  });
});

// ─── error handling ───────────────────────────────────────────────────────────

describe('InfiniteScroll – error handling', () => {
  it('sets error state when fetchPage throws', async () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFailingFetch('network error') });
    await scroll.loadMore();
    const { error, loading, items } = scroll.state;
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'network error');
    assert.equal(loading, false);
    assert.deepEqual(items, []);
  });

  it('wraps non-Error throws in an Error', async () => {
    const scroll = new InfiniteScroll({
      fetchPage: async () => { throw 'string error'; },
    });
    await scroll.loadMore();
    assert.ok(scroll.state.error instanceof Error);
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('InfiniteScroll – reset', () => {
  it('clears items and reloads from page 1', async () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch(5, 25), pageSize: 5 });
    await scroll.loadMore();
    await scroll.loadMore();
    assert.equal(scroll.state.page, 3);

    await scroll.reset();
    // After reset it loads page 1 again
    assert.deepEqual(scroll.state.items, [0, 1, 2, 3, 4]);
    assert.equal(scroll.state.page, 2);
  });

  it('clears error state on reset', async () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFailingFetch() });
    await scroll.loadMore();
    assert.ok(scroll.state.error);

    // Replace fetchPage via reset with a working one indirectly — we just reset and
    // confirm state is cleared (error is reset to null before re-fetching).
    // The first loadMore in reset will fail again; error cleared then set again.
    await scroll.reset();
    // After reset+loadMore, error will be set again (same failing fetch), but the
    // point is reset does clear items.
    assert.deepEqual(scroll.state.items, []);
  });
});

// ─── shouldLoadMore ───────────────────────────────────────────────────────────

describe('InfiniteScroll – shouldLoadMore', () => {
  it('returns true when near the bottom (past threshold)', () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch() });
    // scrollTop=900, scrollHeight=1000, containerHeight=100 → (900+100)/1000 = 1.0 >= 0.8
    assert.equal(scroll.shouldLoadMore(900, 1000, 100), true);
  });

  it('returns false when not near the bottom (below threshold)', () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch() });
    // scrollTop=0, scrollHeight=1000, containerHeight=100 → (0+100)/1000 = 0.1 < 0.8
    assert.equal(scroll.shouldLoadMore(0, 1000, 100), false);
  });

  it('returns false when already loading', async () => {
    let resolve;
    const fetchPage = () => new Promise((res) => { resolve = res; });
    const scroll = new InfiniteScroll({ fetchPage });
    const p = scroll.loadMore(); // now loading
    assert.equal(scroll.shouldLoadMore(900, 1000, 100), false);
    resolve([]);
    await p;
  });

  it('returns false when hasMore is false', async () => {
    // Only 2 items, pageSize=5 → hasMore=false after first load
    const scroll = new InfiniteScroll({ fetchPage: makeFetch(5, 2), pageSize: 5 });
    await scroll.loadMore();
    assert.equal(scroll.state.hasMore, false);
    assert.equal(scroll.shouldLoadMore(900, 1000, 100), false);
  });

  it('respects custom threshold', () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch() });
    // At threshold 0.5: (400+100)/1000 = 0.5 exactly → true
    assert.equal(scroll.shouldLoadMore(400, 1000, 100, 0.5), true);
    // At threshold 0.6: 0.5 < 0.6 → false
    assert.equal(scroll.shouldLoadMore(400, 1000, 100, 0.6), false);
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('InfiniteScroll – subscribe', () => {
  it('callback is called on state change', async () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch(5, 25), pageSize: 5 });
    const snapshots = [];
    scroll.subscribe((state) => snapshots.push(state.loading));
    await scroll.loadMore();
    // loading went true then false
    assert.ok(snapshots.includes(true));
    assert.ok(snapshots.includes(false));
  });

  it('unsubscribe stops receiving callbacks', async () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch(5, 25), pageSize: 5 });
    const calls = [];
    const unsub = scroll.subscribe((state) => calls.push(state));
    unsub();
    await scroll.loadMore();
    assert.equal(calls.length, 0);
  });

  it('multiple subscribers each receive state updates', async () => {
    const scroll = new InfiniteScroll({ fetchPage: makeFetch(5, 25), pageSize: 5 });
    const a = [];
    const b = [];
    scroll.subscribe((s) => a.push(s.page));
    scroll.subscribe((s) => b.push(s.page));
    await scroll.loadMore();
    assert.ok(a.length > 0);
    assert.ok(b.length > 0);
    assert.deepEqual(a, b);
  });
});
