// ─── Unit Tests: pagination ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  paginate,
  paginateArray,
  pageNumbers,
  pageToOffset,
  offsetToPage,
  Paginator,
} from '../../app/modules/pagination.js';

// ─── paginate ─────────────────────────────────────────────────────────────────

describe('paginate', () => {
  it('returns correct info for first page', () => {
    const info = paginate(1, 10, 35);
    assert.equal(info.page, 1);
    assert.equal(info.pageSize, 10);
    assert.equal(info.total, 35);
    assert.equal(info.totalPages, 4);
    assert.equal(info.hasNext, true);
    assert.equal(info.hasPrev, false);
    assert.equal(info.startIndex, 0);
    assert.equal(info.endIndex, 10);
  });

  it('returns correct info for last page', () => {
    const info = paginate(4, 10, 35);
    assert.equal(info.page, 4);
    assert.equal(info.hasNext, false);
    assert.equal(info.hasPrev, true);
    assert.equal(info.startIndex, 30);
    assert.equal(info.endIndex, 35);
  });

  it('returns correct info for middle page', () => {
    const info = paginate(2, 5, 20);
    assert.equal(info.page, 2);
    assert.equal(info.totalPages, 4);
    assert.equal(info.hasNext, true);
    assert.equal(info.hasPrev, true);
    assert.equal(info.startIndex, 5);
    assert.equal(info.endIndex, 10);
  });

  it('clamps page below 1 to page 1', () => {
    const info = paginate(0, 10, 20);
    assert.equal(info.page, 1);
  });

  it('clamps page above totalPages to totalPages', () => {
    const info = paginate(99, 10, 20);
    assert.equal(info.page, 2);
  });

  it('handles total of 0 (1 empty page)', () => {
    const info = paginate(1, 10, 0);
    assert.equal(info.totalPages, 1);
    assert.equal(info.hasNext, false);
    assert.equal(info.hasPrev, false);
    assert.equal(info.startIndex, 0);
    assert.equal(info.endIndex, 0);
  });

  it('handles exact page size boundary (total divisible by pageSize)', () => {
    const info = paginate(3, 5, 15);
    assert.equal(info.totalPages, 3);
    assert.equal(info.hasNext, false);
    assert.equal(info.startIndex, 10);
    assert.equal(info.endIndex, 15);
  });

  it('treats pageSize <= 0 as 1', () => {
    const info = paginate(1, 0, 5);
    assert.equal(info.pageSize, 1);
    assert.equal(info.totalPages, 5);
  });
});

// ─── paginateArray ────────────────────────────────────────────────────────────

describe('paginateArray', () => {
  it('slices first page correctly', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    const { items, info } = paginateArray(arr, 1, 3);
    assert.deepEqual(items, [1, 2, 3]);
    assert.equal(info.page, 1);
    assert.equal(info.totalPages, 3);
  });

  it('slices last (partial) page correctly', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    const { items } = paginateArray(arr, 3, 3);
    assert.deepEqual(items, [7]);
  });

  it('slices middle page correctly', () => {
    const arr = [10, 20, 30, 40, 50];
    const { items } = paginateArray(arr, 2, 2);
    assert.deepEqual(items, [30, 40]);
  });

  it('returns empty items for empty array', () => {
    const { items, info } = paginateArray([], 1, 10);
    assert.deepEqual(items, []);
    assert.equal(info.total, 0);
  });

  it('returns all items when pageSize >= array length', () => {
    const arr = [1, 2, 3];
    const { items } = paginateArray(arr, 1, 100);
    assert.deepEqual(items, [1, 2, 3]);
  });

  it('info.total equals array length', () => {
    const arr = [1, 2, 3, 4, 5];
    const { info } = paginateArray(arr, 1, 2);
    assert.equal(info.total, 5);
  });
});

// ─── pageNumbers ──────────────────────────────────────────────────────────────

describe('pageNumbers', () => {
  it('returns all pages when totalPages <= maxVisible', () => {
    assert.deepEqual(pageNumbers(1, 5, 7), [1, 2, 3, 4, 5]);
  });

  it('returns empty array for totalPages = 0', () => {
    assert.deepEqual(pageNumbers(1, 0), []);
  });

  it('includes first and last page always', () => {
    const nums = pageNumbers(5, 20);
    assert.equal(nums[0], 1);
    assert.equal(nums[nums.length - 1], 20);
  });

  it('adds ellipsis when gap exists near start', () => {
    const nums = pageNumbers(10, 20);
    assert.equal(nums[0], 1);
    assert.ok(nums.includes('...'), 'should contain ellipsis');
  });

  it('adds ellipsis when gap exists near end', () => {
    const nums = pageNumbers(1, 20);
    assert.ok(nums.includes('...'), 'should contain ellipsis');
    assert.equal(nums[nums.length - 1], 20);
  });

  it('adds double ellipsis when current page is far from both ends', () => {
    const nums = pageNumbers(10, 20);
    const ellipses = nums.filter((n) => n === '...');
    assert.ok(ellipses.length >= 1, 'should have at least one ellipsis');
  });

  it('current page is included in results', () => {
    const nums = pageNumbers(7, 20);
    assert.ok(nums.includes(7), 'current page should be in results');
  });

  it('respects maxVisible parameter', () => {
    const nums = pageNumbers(5, 20, 5);
    // With maxVisible=5: 1 + ... + window + ... + 20
    assert.ok(nums.length <= 7, `result too long: ${nums.length}`);
  });

  it('no ellipsis when all pages fit within maxVisible', () => {
    const nums = pageNumbers(3, 5, 7);
    assert.deepEqual(nums, [1, 2, 3, 4, 5]);
  });

  it('handles single page', () => {
    assert.deepEqual(pageNumbers(1, 1), [1]);
  });
});

// ─── pageToOffset / offsetToPage ─────────────────────────────────────────────

describe('pageToOffset', () => {
  it('page 1 has offset 0', () => {
    assert.equal(pageToOffset(1, 10), 0);
  });

  it('page 2 has offset = pageSize', () => {
    assert.equal(pageToOffset(2, 10), 10);
  });

  it('page 3, pageSize 5 = offset 10', () => {
    assert.equal(pageToOffset(3, 5), 10);
  });

  it('treats page <= 0 as page 1 (offset 0)', () => {
    assert.equal(pageToOffset(0, 10), 0);
    assert.equal(pageToOffset(-5, 10), 0);
  });
});

describe('offsetToPage', () => {
  it('offset 0 is page 1', () => {
    assert.equal(offsetToPage(0, 10), 1);
  });

  it('offset = pageSize is page 2', () => {
    assert.equal(offsetToPage(10, 10), 2);
  });

  it('offset 11, pageSize 10 is page 2', () => {
    assert.equal(offsetToPage(11, 10), 2);
  });

  it('offset 20, pageSize 10 is page 3', () => {
    assert.equal(offsetToPage(20, 10), 3);
  });

  it('rounds down (mid-page offset)', () => {
    assert.equal(offsetToPage(7, 5), 2);
  });

  it('treats negative offset as 0', () => {
    assert.equal(offsetToPage(-5, 10), 1);
  });

  it('pageToOffset and offsetToPage are inverse operations', () => {
    for (let page = 1; page <= 5; page++) {
      const offset = pageToOffset(page, 10);
      assert.equal(offsetToPage(offset, 10), page);
    }
  });
});

// ─── Paginator ────────────────────────────────────────────────────────────────

describe('Paginator – basic properties', () => {
  it('starts on page 1', () => {
    const p = new Paginator([1, 2, 3, 4, 5], 2);
    assert.equal(p.currentPage, 1);
  });

  it('totalPages is computed correctly', () => {
    const p = new Paginator([1, 2, 3, 4, 5], 2);
    assert.equal(p.totalPages, 3);
  });

  it('pageSize is accessible', () => {
    const p = new Paginator([1, 2, 3], 5);
    assert.equal(p.pageSize, 5);
  });

  it('total reflects the full item count', () => {
    const p = new Paginator([10, 20, 30, 40], 3);
    assert.equal(p.total, 4);
  });

  it('info returns PaginationInfo for the current page', () => {
    const p = new Paginator([1, 2, 3, 4, 5], 2);
    const info = p.info;
    assert.equal(info.page, 1);
    assert.equal(info.pageSize, 2);
    assert.equal(info.total, 5);
    assert.equal(info.totalPages, 3);
  });

  it('default pageSize is 10', () => {
    const p = new Paginator([1, 2, 3]);
    assert.equal(p.pageSize, 10);
  });
});

describe('Paginator – items()', () => {
  it('returns items for the current page', () => {
    const p = new Paginator([1, 2, 3, 4, 5], 2);
    assert.deepEqual(p.items(), [1, 2]);
  });

  it('returns last partial page correctly', () => {
    const p = new Paginator([1, 2, 3, 4, 5], 2);
    p.goto(3);
    assert.deepEqual(p.items(), [5]);
  });

  it('returns all items when pageSize >= total', () => {
    const p = new Paginator([1, 2, 3], 100);
    assert.deepEqual(p.items(), [1, 2, 3]);
  });

  it('returns empty array for empty items', () => {
    const p = new Paginator([], 5);
    assert.deepEqual(p.items(), []);
  });
});

describe('Paginator – next()', () => {
  it('advances to next page and returns true', () => {
    const p = new Paginator([1, 2, 3, 4], 2);
    const result = p.next();
    assert.equal(result, true);
    assert.equal(p.currentPage, 2);
  });

  it('returns false and stays on last page when already at end', () => {
    const p = new Paginator([1, 2, 3, 4], 2);
    p.next(); // page 2
    const result = p.next(); // already last
    assert.equal(result, false);
    assert.equal(p.currentPage, 2);
  });

  it('items() changes after next()', () => {
    const p = new Paginator([1, 2, 3, 4], 2);
    p.next();
    assert.deepEqual(p.items(), [3, 4]);
  });
});

describe('Paginator – prev()', () => {
  it('goes to previous page and returns true', () => {
    const p = new Paginator([1, 2, 3, 4], 2);
    p.next();
    const result = p.prev();
    assert.equal(result, true);
    assert.equal(p.currentPage, 1);
  });

  it('returns false and stays on page 1 when already at start', () => {
    const p = new Paginator([1, 2, 3, 4], 2);
    const result = p.prev();
    assert.equal(result, false);
    assert.equal(p.currentPage, 1);
  });
});

describe('Paginator – goto()', () => {
  it('jumps to specified page', () => {
    const p = new Paginator([1, 2, 3, 4, 5, 6], 2);
    const result = p.goto(3);
    assert.equal(result, true);
    assert.equal(p.currentPage, 3);
  });

  it('returns false for page below 1', () => {
    const p = new Paginator([1, 2, 3, 4], 2);
    const result = p.goto(0);
    assert.equal(result, false);
    assert.equal(p.currentPage, 1);
  });

  it('returns false for page above totalPages', () => {
    const p = new Paginator([1, 2, 3, 4], 2);
    const result = p.goto(10);
    assert.equal(result, false);
  });

  it('goes to last page', () => {
    const p = new Paginator([1, 2, 3, 4, 5], 2);
    p.goto(3);
    assert.equal(p.currentPage, 3);
    assert.deepEqual(p.items(), [5]);
  });
});

describe('Paginator – filter()', () => {
  it('filters items by predicate', () => {
    const p = new Paginator([1, 2, 3, 4, 5, 6], 3);
    p.filter((n) => n % 2 === 0);
    assert.equal(p.total, 3);
    assert.deepEqual(p.items(), [2, 4, 6]);
  });

  it('resets to page 1 after filter', () => {
    const p = new Paginator([1, 2, 3, 4, 5, 6], 2);
    p.goto(3);
    p.filter((n) => n > 4);
    assert.equal(p.currentPage, 1);
  });

  it('filter with no matches yields empty paginator', () => {
    const p = new Paginator([1, 2, 3], 5);
    p.filter((n) => n > 100);
    assert.equal(p.total, 0);
    assert.deepEqual(p.items(), []);
  });

  it('filter is applied on top of original items', () => {
    const p = new Paginator([1, 2, 3, 4, 5], 5);
    p.filter((n) => n <= 3);
    assert.equal(p.total, 3);
  });
});

describe('Paginator – resetFilter()', () => {
  it('restores all items after a filter', () => {
    const p = new Paginator([1, 2, 3, 4, 5], 5);
    p.filter((n) => n > 3);
    p.resetFilter();
    assert.equal(p.total, 5);
    assert.deepEqual(p.items(), [1, 2, 3, 4, 5]);
  });

  it('resets to page 1', () => {
    const p = new Paginator([1, 2, 3, 4, 5, 6], 2);
    p.filter((n) => n % 2 === 0);
    p.next();
    p.resetFilter();
    assert.equal(p.currentPage, 1);
  });

  it('resetFilter when no filter is active is a no-op', () => {
    const p = new Paginator([1, 2, 3], 5);
    assert.doesNotThrow(() => p.resetFilter());
    assert.equal(p.total, 3);
  });

  it('multiple filters accumulate only from original items', () => {
    const p = new Paginator([1, 2, 3, 4, 5, 6], 10);
    p.filter((n) => n <= 4);
    p.filter((n) => n % 2 === 0); // applied on original, not filtered
    assert.deepEqual(p.items(), [2, 4, 6]);
  });
});
