// ─── Unit Tests: Text Extractor ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractTextInReadingOrder, extractMultiPageText } from '../../app/modules/text-extractor.js';

// Helper: create a text item
function item(str, x, y, width = 50, height = 12, fontSize = 12) {
  return { str, x, y, width, height, fontSize };
}

describe('extractTextInReadingOrder', () => {
  it('returns empty string for no items', () => {
    assert.equal(extractTextInReadingOrder([]), '');
    assert.equal(extractTextInReadingOrder(null), '');
  });

  it('extracts single-line text', () => {
    const items = [
      item('Hello', 10, 500, 50),
      item('World', 70, 500, 50),
    ];
    const text = extractTextInReadingOrder(items, { removeHeaders: false, removeFooters: false });
    assert.ok(text.includes('Hello'));
    assert.ok(text.includes('World'));
  });

  it('orders text top-to-bottom (higher Y = higher on page in PDF)', () => {
    const items = [
      item('Bottom', 10, 100, 50),
      item('Top', 10, 500, 50),
    ];
    const text = extractTextInReadingOrder(items, { removeHeaders: false, removeFooters: false });
    const lines = text.split('\n');
    assert.ok(lines[0].includes('Top'));
    assert.ok(lines[1].includes('Bottom'));
  });

  it('groups items on the same line', () => {
    const items = [
      item('A', 10, 500, 20),
      item('B', 40, 501, 20), // Y within threshold
      item('C', 70, 500, 20),
    ];
    const text = extractTextInReadingOrder(items, { removeHeaders: false, removeFooters: false });
    const lines = text.split('\n').filter(l => l.trim());
    assert.equal(lines.length, 1); // all on one line
    assert.ok(lines[0].includes('A'));
    assert.ok(lines[0].includes('C'));
  });

  it('detects two-column layout', () => {
    const items = [
      // Left column
      item('Left1', 10, 500, 100),
      item('Left2', 10, 480, 100),
      item('Left3', 10, 460, 100),
      // Right column (gap > 50)
      item('Right1', 300, 500, 100),
      item('Right2', 300, 480, 100),
      item('Right3', 300, 460, 100),
    ];
    const text = extractTextInReadingOrder(items, { removeHeaders: false, removeFooters: false });
    // Left column should come before right column
    const left1Pos = text.indexOf('Left1');
    const right1Pos = text.indexOf('Right1');
    assert.ok(left1Pos < right1Pos, 'Left column should precede right column');
  });

  it('removes header/footer items', () => {
    const pageHeight = 842;
    const items = [
      item('Header', 10, pageHeight * 0.97, 50), // in header zone (top 5%)
      item('Content', 10, 400, 50),
      item('Footer', 10, pageHeight * 0.03, 50), // in footer zone (bottom 5%)
    ];
    const text = extractTextInReadingOrder(items, { pageHeight });
    assert.ok(text.includes('Content'));
    assert.ok(!text.includes('Header'));
    assert.ok(!text.includes('Footer'));
  });

  it('keeps headers when removeHeaders=false', () => {
    const pageHeight = 842;
    const items = [
      item('Header', 10, pageHeight * 0.97, 50),
      item('Content', 10, 400, 50),
    ];
    const text = extractTextInReadingOrder(items, { pageHeight, removeHeaders: false });
    assert.ok(text.includes('Header'));
    assert.ok(text.includes('Content'));
  });
});

describe('extractMultiPageText', () => {
  it('combines text from multiple pages', () => {
    const pages = [
      { items: [item('Page1', 10, 400, 50)], pageHeight: 842 },
      { items: [item('Page2', 10, 400, 50)], pageHeight: 842 },
    ];
    const text = extractMultiPageText(pages);
    assert.ok(text.includes('Page1'));
    assert.ok(text.includes('Page2'));
  });

  it('adds page break markers', () => {
    const pages = [
      { items: [item('A', 10, 400, 50)], pageHeight: 842 },
      { items: [item('B', 10, 400, 50)], pageHeight: 842 },
    ];
    const text = extractMultiPageText(pages);
    assert.ok(text.includes('--- Page 2 ---'));
  });

  it('omits page breaks when disabled', () => {
    const pages = [
      { items: [item('A', 10, 400, 50)], pageHeight: 842 },
      { items: [item('B', 10, 400, 50)], pageHeight: 842 },
    ];
    const text = extractMultiPageText(pages, { addPageBreaks: false });
    assert.ok(!text.includes('Page'));
  });
});
