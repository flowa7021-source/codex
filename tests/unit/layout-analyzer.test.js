import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLayout, analyzeMultiPageLayout } from '../../app/modules/layout-analyzer.js';

describe('analyzeLayout', () => {
  it('returns default margins and empty body for page with no textRuns', () => {
    const result = analyzeLayout({ width: 612, height: 792, textRuns: [], paths: [], images: [] });
    assert.deepStrictEqual(result.margins, { top: 72, bottom: 72, left: 72, right: 72 });
    assert.deepStrictEqual(result.body, []);
    assert.strictEqual(result.columns.length, 1);
  });

  it('returns images in body when page has no text but has images', () => {
    const img = { x: 10, y: 10, width: 100, height: 100 };
    const result = analyzeLayout({ width: 612, height: 792, textRuns: [], paths: [], images: [img] });
    assert.strictEqual(result.body.length, 1);
    assert.strictEqual(result.body[0].type, 'image');
  });

  it('detects single column for few text runs', () => {
    const runs = [
      { x: 72, y: 100, width: 50, height: 12, fontSize: 12, text: 'Hello' },
      { x: 72, y: 115, width: 50, height: 12, fontSize: 12, text: 'World' },
    ];
    const result = analyzeLayout({ width: 612, height: 792, textRuns: runs, paths: [], images: [] });
    assert.strictEqual(result.columns.length, 1);
    assert.ok(result.body.length > 0);
  });

  it('assembles text runs into paragraphs in reading order', () => {
    const runs = [
      { x: 72, y: 100, width: 200, height: 12, fontSize: 12, text: 'First line' },
      { x: 72, y: 115, width: 200, height: 12, fontSize: 12, text: 'Second line' },
      { x: 72, y: 160, width: 200, height: 12, fontSize: 12, text: 'New paragraph' },
    ];
    const result = analyzeLayout({ width: 612, height: 792, textRuns: runs, paths: [], images: [] });
    assert.ok(result.body.length >= 1);
    assert.strictEqual(result.body[0].type, 'paragraph');
  });

  it('detects margins from text run positions', () => {
    const runs = [
      { x: 50, y: 80, width: 400, height: 12, fontSize: 12, text: 'Text' },
      { x: 50, y: 95, width: 400, height: 12, fontSize: 12, text: 'More' },
    ];
    const result = analyzeLayout({ width: 612, height: 792, textRuns: runs, paths: [], images: [] });
    assert.ok(result.margins.left >= 20);
    assert.ok(result.margins.top >= 20);
  });

  it('preserves pageNumber from input', () => {
    const result = analyzeLayout({ pageNumber: 5, width: 612, height: 792, textRuns: [], paths: [], images: [] });
    assert.strictEqual(result.pageNumber, 5);
  });

  it('handles bordered table detection with horizontal and vertical lines', () => {
    const hLines = [
      { subtype: 'horizontal', x1: 100, y1: 100, x2: 300, y2: 100, lineWidth: 1 },
      { subtype: 'horizontal', x1: 100, y1: 150, x2: 300, y2: 150, lineWidth: 1 },
      { subtype: 'horizontal', x1: 100, y1: 200, x2: 300, y2: 200, lineWidth: 1 },
    ];
    const vLines = [
      { subtype: 'vertical', x1: 100, y1: 100, x2: 100, y2: 200, lineWidth: 1 },
      { subtype: 'vertical', x1: 200, y1: 100, x2: 200, y2: 200, lineWidth: 1 },
      { subtype: 'vertical', x1: 300, y1: 100, x2: 300, y2: 200, lineWidth: 1 },
    ];
    const runs = [
      { x: 110, y: 110, width: 30, height: 10, fontSize: 10, text: 'A' },
      { x: 210, y: 110, width: 30, height: 10, fontSize: 10, text: 'B' },
    ];
    const result = analyzeLayout({
      width: 612, height: 792,
      textRuns: runs,
      paths: [...hLines, ...vLines],
      images: [],
    });
    // Should have at least one body element
    assert.ok(result.body.length >= 1);
  });

  it('handles null/undefined paths gracefully', () => {
    const runs = [
      { x: 72, y: 100, width: 50, height: 12, fontSize: 12, text: 'Hello' },
    ];
    const result = analyzeLayout({ width: 612, height: 792, textRuns: runs, paths: null, images: null });
    assert.ok(result.body.length >= 1);
  });
});

describe('analyzeMultiPageLayout', () => {
  it('returns empty array for no pages', () => {
    assert.deepStrictEqual(analyzeMultiPageLayout([]), []);
  });

  it('analyzes multiple pages and returns layout for each', () => {
    const pages = [
      { pageNumber: 1, width: 612, height: 792, textRuns: [{ x: 72, y: 100, width: 50, height: 12, fontSize: 12, text: 'Page1' }], paths: [], images: [] },
      { pageNumber: 2, width: 612, height: 792, textRuns: [{ x: 72, y: 100, width: 50, height: 12, fontSize: 12, text: 'Page2' }], paths: [], images: [] },
    ];
    const result = analyzeMultiPageLayout(pages);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].pageNumber, 1);
    assert.strictEqual(result[1].pageNumber, 2);
  });

  it('detects repeated headers across pages', () => {
    const makeRun = (text, y) => ({ x: 72, y, width: 100, height: 10, fontSize: 10, text });
    const pages = [];
    for (let i = 0; i < 5; i++) {
      pages.push({
        pageNumber: i + 1, width: 612, height: 792,
        textRuns: [
          makeRun('Header Text', 20),   // top of page - header region
          makeRun('Body text', 400),
        ],
        paths: [], images: [],
      });
    }
    const result = analyzeMultiPageLayout(pages);
    assert.strictEqual(result.length, 5);
  });
});
