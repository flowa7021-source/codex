// ─── Extended Unit Tests: Text Extractor Module ─────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractTextInReadingOrder,
  extractMultiPageText,
} from '../../app/modules/text-extractor.js';

describe('extractTextInReadingOrder', () => {
  it('returns empty string for empty items', () => {
    assert.equal(extractTextInReadingOrder([]), '');
    assert.equal(extractTextInReadingOrder(null), '');
    assert.equal(extractTextInReadingOrder(undefined), '');
  });

  it('extracts single item', () => {
    const items = [{ str: 'Hello', x: 10, y: 500, width: 40, height: 12, fontSize: 12 }];
    const result = extractTextInReadingOrder(items, { removeHeaders: false, removeFooters: false });
    assert.ok(result.includes('Hello'));
  });

  it('groups items on the same line', () => {
    const items = [
      { str: 'Hello', x: 10, y: 500, width: 40, height: 12, fontSize: 12 },
      { str: 'World', x: 60, y: 500, width: 40, height: 12, fontSize: 12 },
    ];
    const result = extractTextInReadingOrder(items, { lineThreshold: 5, removeHeaders: false, removeFooters: false });
    assert.ok(result.includes('Hello'));
    assert.ok(result.includes('World'));
    const lines = result.split('\n').filter(Boolean);
    assert.equal(lines.length, 1);
  });

  it('separates items on different lines', () => {
    const items = [
      { str: 'Line1', x: 10, y: 800, width: 40, height: 12, fontSize: 12 },
      { str: 'Line2', x: 10, y: 700, width: 40, height: 12, fontSize: 12 },
    ];
    const result = extractTextInReadingOrder(items, { removeHeaders: false, removeFooters: false });
    const lines = result.split('\n').filter(Boolean);
    assert.ok(lines.length >= 2);
  });

  it('does not remove items when headers/footers filtering disabled', () => {
    const items = [
      { str: 'Body', x: 10, y: 400, width: 40, height: 12, fontSize: 12 },
    ];
    const result = extractTextInReadingOrder(items, { removeHeaders: false, removeFooters: false });
    assert.ok(result.includes('Body'));
  });

  it('handles single-column layout', () => {
    const items = [
      { str: 'A', x: 10, y: 800, width: 40, height: 12, fontSize: 12 },
      { str: 'B', x: 10, y: 780, width: 40, height: 12, fontSize: 12 },
      { str: 'C', x: 10, y: 760, width: 40, height: 12, fontSize: 12 },
    ];
    const result = extractTextInReadingOrder(items, { removeHeaders: false, removeFooters: false });
    assert.ok(result.includes('A'));
    assert.ok(result.includes('B'));
    assert.ok(result.includes('C'));
  });

  it('inserts spaces between items with significant gap', () => {
    const items = [
      { str: 'Word1', x: 10, y: 500, width: 40, height: 12, fontSize: 12 },
      { str: 'Word2', x: 100, y: 500, width: 40, height: 12, fontSize: 12 },
    ];
    const result = extractTextInReadingOrder(items, { lineThreshold: 5, removeHeaders: false, removeFooters: false });
    assert.ok(result.includes('Word1'));
    assert.ok(result.includes('Word2'));
  });
});

describe('extractMultiPageText', () => {
  it('combines text from multiple pages', () => {
    const pages = [
      { items: [{ str: 'Page1', x: 10, y: 400, width: 40, height: 12, fontSize: 12 }], pageHeight: 842 },
      { items: [{ str: 'Page2', x: 10, y: 400, width: 40, height: 12, fontSize: 12 }], pageHeight: 842 },
    ];
    const result = extractMultiPageText(pages);
    assert.ok(result.includes('Page1'));
    assert.ok(result.includes('Page2'));
  });

  it('adds page break markers when enabled', () => {
    const pages = [
      { items: [{ str: 'A', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 },
      { items: [{ str: 'B', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 },
    ];
    const result = extractMultiPageText(pages, { addPageBreaks: true });
    assert.ok(result.includes('Page 2'));
  });

  it('omits page breaks when disabled', () => {
    const pages = [
      { items: [{ str: 'A', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 },
      { items: [{ str: 'B', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 },
    ];
    const result = extractMultiPageText(pages, { addPageBreaks: false });
    assert.ok(!result.includes('Page'));
  });

  it('uses custom page break marker', () => {
    const pages = [
      { items: [{ str: 'A', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 },
      { items: [{ str: 'B', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 },
    ];
    const result = extractMultiPageText(pages, { pageBreakMarker: '\n===PAGE {n}===\n' });
    assert.ok(result.includes('===PAGE 2==='));
  });
});
