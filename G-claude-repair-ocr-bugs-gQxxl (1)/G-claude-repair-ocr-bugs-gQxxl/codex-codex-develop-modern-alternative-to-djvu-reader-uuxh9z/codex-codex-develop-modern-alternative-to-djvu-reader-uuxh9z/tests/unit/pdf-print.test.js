// ─── Unit Tests: PDF Print ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageRange, getPagesToPrint, arrangeBooklet, arrangeNup } from '../../app/modules/pdf-print.js';

describe('parsePageRange', () => {
  it('parses single pages', () => {
    assert.deepEqual(parsePageRange('3', 10), [3]);
  });

  it('parses page ranges', () => {
    assert.deepEqual(parsePageRange('2-5', 10), [2, 3, 4, 5]);
  });

  it('parses mixed ranges and singles', () => {
    assert.deepEqual(parsePageRange('1-3, 7, 9-10', 10), [1, 2, 3, 7, 9, 10]);
  });

  it('clamps to maxPage', () => {
    assert.deepEqual(parsePageRange('1-100', 5), [1, 2, 3, 4, 5]);
  });

  it('ignores invalid entries', () => {
    assert.deepEqual(parsePageRange('0, -1, abc', 10), []);
  });

  it('returns empty for empty string', () => {
    assert.deepEqual(parsePageRange('', 10), []);
  });

  it('deduplicates pages', () => {
    assert.deepEqual(parsePageRange('1, 1, 2-3, 2', 10), [1, 2, 3]);
  });

  it('returns sorted output', () => {
    assert.deepEqual(parsePageRange('5, 3, 1', 10), [1, 3, 5]);
  });
});

describe('getPagesToPrint', () => {
  it('returns all pages', () => {
    assert.deepEqual(getPagesToPrint({ pages: 'all', totalPages: 4 }), [1, 2, 3, 4]);
  });

  it('returns current page only', () => {
    assert.deepEqual(getPagesToPrint({ pages: 'current', currentPage: 3, totalPages: 10 }), [3]);
  });

  it('returns odd pages', () => {
    assert.deepEqual(getPagesToPrint({ pages: 'odd', totalPages: 6 }), [1, 3, 5]);
  });

  it('returns even pages', () => {
    assert.deepEqual(getPagesToPrint({ pages: 'even', totalPages: 6 }), [2, 4, 6]);
  });

  it('returns range pages', () => {
    assert.deepEqual(getPagesToPrint({ pages: 'range', pageRange: '2-4', totalPages: 10 }), [2, 3, 4]);
  });
});

describe('arrangeBooklet', () => {
  it('arranges 4 pages into 1 sheet', () => {
    const sheets = arrangeBooklet([1, 2, 3, 4]);
    assert.equal(sheets.length, 1);
    // Front: [4, 1], Back: [2, 3]
    assert.deepEqual(sheets[0], [4, 1, 2, 3]);
  });

  it('pads odd page count to multiple of 4', () => {
    const sheets = arrangeBooklet([1, 2, 3]);
    assert.equal(sheets.length, 1);
    // Padded to [1,2,3,0], then arranged
    assert.deepEqual(sheets[0], [0, 1, 2, 3]);
  });

  it('arranges 8 pages into 2 sheets', () => {
    const sheets = arrangeBooklet([1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(sheets.length, 2);
  });
});

describe('arrangeNup', () => {
  it('groups pages into sheets of 2', () => {
    const sheets = arrangeNup([1, 2, 3, 4, 5], 2);
    assert.deepEqual(sheets, [[1, 2], [3, 4], [5]]);
  });

  it('groups pages into sheets of 4', () => {
    const sheets = arrangeNup([1, 2, 3, 4, 5, 6, 7, 8], 4);
    assert.deepEqual(sheets, [[1, 2, 3, 4], [5, 6, 7, 8]]);
  });

  it('handles single page per sheet', () => {
    const sheets = arrangeNup([1, 2, 3], 1);
    assert.deepEqual(sheets, [[1], [2], [3]]);
  });
});
