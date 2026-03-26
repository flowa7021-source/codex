// ─── Extended Unit Tests: PDF Print Module ──────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  _DEFAULT_OPTIONS,
  parsePageRange,
  getPagesToPrint,
  arrangeBooklet,
  arrangeNup,
  renderNupSheet,
  triggerPrint,
} from '../../app/modules/pdf-print.js';

// ─── _DEFAULT_OPTIONS annotation fields ─────────────────────────────────────

describe('_DEFAULT_OPTIONS annotation options', () => {
  it('printAnnotations option exists in defaults', () => {
    assert.equal(typeof _DEFAULT_OPTIONS.printAnnotations, 'boolean');
    assert.equal(_DEFAULT_OPTIONS.printAnnotations, true);
  });

  it('printFormFieldsOnly option exists in defaults', () => {
    assert.equal(typeof _DEFAULT_OPTIONS.printFormFieldsOnly, 'boolean');
    assert.equal(_DEFAULT_OPTIONS.printFormFieldsOnly, false);
  });
});

// ─── parsePageRange ─────────────────────────────────────────────────────────

describe('parsePageRange', () => {
  it('returns empty array for empty string', () => {
    assert.deepEqual(parsePageRange('', 100), []);
  });

  it('parses single page numbers', () => {
    assert.deepEqual(parsePageRange('5', 100), [5]);
  });

  it('parses multiple comma-separated pages', () => {
    assert.deepEqual(parsePageRange('1, 3, 5', 100), [1, 3, 5]);
  });

  it('parses ranges', () => {
    assert.deepEqual(parsePageRange('1-5', 100), [1, 2, 3, 4, 5]);
  });

  it('clamps ranges to maxPage', () => {
    assert.deepEqual(parsePageRange('8-15', 10), [8, 9, 10]);
  });

  it('ignores pages beyond maxPage', () => {
    assert.deepEqual(parsePageRange('50, 100, 200', 100), [50, 100]);
  });

  it('handles combined ranges and single pages', () => {
    const result = parsePageRange('1-3, 7, 10-12', 20);
    assert.deepEqual(result, [1, 2, 3, 7, 10, 11, 12]);
  });

  it('deduplicates pages', () => {
    const result = parsePageRange('1, 1, 2, 2-3', 10);
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('ignores non-numeric parts', () => {
    const result = parsePageRange('abc, 5, xyz', 10);
    assert.deepEqual(result, [5]);
  });

  it('ignores pages below 1', () => {
    const result = parsePageRange('0, -1, 1', 10);
    assert.deepEqual(result, [1]);
  });
});

// ─── getPagesToPrint ────────────────────────────────────────────────────────

describe('getPagesToPrint', () => {
  it('returns all pages for "all" mode', () => {
    const result = getPagesToPrint({ pages: 'all', totalPages: 5, currentPage: 1 });
    assert.deepEqual(result, [1, 2, 3, 4, 5]);
  });

  it('returns only current page for "current" mode', () => {
    const result = getPagesToPrint({ pages: 'current', totalPages: 5, currentPage: 3 });
    assert.deepEqual(result, [3]);
  });

  it('returns parsed range for "range" mode', () => {
    const result = getPagesToPrint({ pages: 'range', pageRange: '2-4', totalPages: 10, currentPage: 1 });
    assert.deepEqual(result, [2, 3, 4]);
  });

  it('returns odd pages for "odd" mode', () => {
    const result = getPagesToPrint({ pages: 'odd', totalPages: 6, currentPage: 1 });
    assert.deepEqual(result, [1, 3, 5]);
  });

  it('returns even pages for "even" mode', () => {
    const result = getPagesToPrint({ pages: 'even', totalPages: 6, currentPage: 1 });
    assert.deepEqual(result, [2, 4, 6]);
  });

  it('defaults to all pages for unknown mode', () => {
    const result = getPagesToPrint({ pages: 'unknown', totalPages: 3, currentPage: 1 });
    assert.deepEqual(result, [1, 2, 3]);
  });
});

// ─── arrangeBooklet ─────────────────────────────────────────────────────────

describe('arrangeBooklet', () => {
  it('pads to multiple of 4', () => {
    const sheets = arrangeBooklet([1, 2, 3, 4]);
    assert.equal(sheets.length, 1);
    assert.equal(sheets[0].length, 4);
  });

  it('handles 8 pages (2 sheets)', () => {
    const sheets = arrangeBooklet([1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(sheets.length, 2);
  });

  it('pads odd number of pages with blanks (0)', () => {
    const sheets = arrangeBooklet([1, 2, 3]);
    // Should be padded to 4 pages -> 1 sheet
    assert.equal(sheets.length, 1);
    assert.ok(sheets[0].includes(0));
  });

  it('arranges single page', () => {
    const sheets = arrangeBooklet([1]);
    assert.equal(sheets.length, 1);
  });
});

// ─── arrangeNup ─────────────────────────────────────────────────────────────

describe('arrangeNup', () => {
  it('puts 1 page per sheet', () => {
    const sheets = arrangeNup([1, 2, 3], 1);
    assert.equal(sheets.length, 3);
    assert.deepEqual(sheets[0], [1]);
  });

  it('puts 2 pages per sheet', () => {
    const sheets = arrangeNup([1, 2, 3, 4], 2);
    assert.equal(sheets.length, 2);
    assert.deepEqual(sheets[0], [1, 2]);
    assert.deepEqual(sheets[1], [3, 4]);
  });

  it('puts 4 pages per sheet', () => {
    const sheets = arrangeNup([1, 2, 3, 4, 5], 4);
    assert.equal(sheets.length, 2);
    assert.deepEqual(sheets[0], [1, 2, 3, 4]);
    assert.deepEqual(sheets[1], [5]);
  });

  it('handles empty pages', () => {
    const sheets = arrangeNup([], 4);
    assert.equal(sheets.length, 0);
  });
});

// ─── renderNupSheet ─────────────────────────────────────────────────────────

describe('renderNupSheet', () => {
  it('is a function', () => {
    assert.equal(typeof renderNupSheet, 'function');
  });
});

// ─── triggerPrint ───────────────────────────────────────────────────────────

describe('triggerPrint', () => {
  it('is a function', () => {
    assert.equal(typeof triggerPrint, 'function');
  });
});
