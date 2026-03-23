import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PdfCompare, pdfCompare, computeLineDiff, computeWordDiff } from '../../app/modules/pdf-compare.js';

describe('computeLineDiff', () => {
  it('returns equal entries for identical arrays', () => {
    const diff = computeLineDiff(['a', 'b', 'c'], ['a', 'b', 'c']);
    assert.ok(diff.every(d => d.type === 'equal'));
    assert.equal(diff.length, 3);
  });

  it('detects added lines', () => {
    const diff = computeLineDiff(['a'], ['a', 'b']);
    const added = diff.filter(d => d.type === 'add');
    assert.equal(added.length, 1);
    assert.equal(added[0].text, 'b');
  });

  it('detects removed lines', () => {
    const diff = computeLineDiff(['a', 'b'], ['a']);
    const removed = diff.filter(d => d.type === 'remove');
    assert.equal(removed.length, 1);
    assert.equal(removed[0].text, 'b');
  });

  it('handles empty arrays', () => {
    const diff = computeLineDiff([], []);
    assert.equal(diff.length, 0);
  });

  it('handles one empty array', () => {
    const diff = computeLineDiff([], ['a', 'b']);
    assert.equal(diff.filter(d => d.type === 'add').length, 2);
  });

  it('handles completely different arrays', () => {
    const diff = computeLineDiff(['a', 'b'], ['c', 'd']);
    const adds = diff.filter(d => d.type === 'add');
    const removes = diff.filter(d => d.type === 'remove');
    assert.equal(adds.length, 2);
    assert.equal(removes.length, 2);
  });

  it('falls back to simpleDiff for large inputs', () => {
    const bigA = Array.from({ length: 6000 }, (_, i) => `line${i}`);
    const bigB = Array.from({ length: 6000 }, (_, i) => `line${i}`);
    bigB[100] = 'changed';
    const diff = computeLineDiff(bigA, bigB);
    assert.ok(diff.length > 0);
  });
});

describe('computeWordDiff', () => {
  it('returns equal entries for identical text', () => {
    const diff = computeWordDiff('hello world', 'hello world');
    assert.ok(diff.every(d => d.type === 'equal'));
  });

  it('detects word-level changes', () => {
    const diff = computeWordDiff('hello world', 'hello there');
    const adds = diff.filter(d => d.type === 'add');
    const removes = diff.filter(d => d.type === 'remove');
    assert.ok(adds.length > 0);
    assert.ok(removes.length > 0);
  });

  it('falls back for very long word lists', () => {
    const a = Array.from({ length: 600 }, (_, i) => `w${i}`).join(' ');
    const b = Array.from({ length: 600 }, (_, i) => `w${i}`).join(' ');
    const diff = computeWordDiff(a, b);
    assert.ok(diff.length > 0);
  });
});

describe('PdfCompare', () => {
  it('exports a singleton pdfCompare instance', () => {
    assert.ok(pdfCompare instanceof PdfCompare);
  });

  it('extractAllText returns text per page', async () => {
    const cmp = new PdfCompare();
    const mockDoc = {
      numPages: 2,
      getPage: mock.fn(async (n) => ({
        getTextContent: async () => ({
          items: [{ str: `Page ${n} text` }],
        }),
      })),
    };
    const pages = await cmp.extractAllText(mockDoc);
    assert.equal(pages.length, 2);
    assert.ok(pages[0].includes('Page 1'));
    assert.ok(pages[1].includes('Page 2'));
  });

  it('compareText returns diff summary', async () => {
    const cmp = new PdfCompare();
    const makeDoc = (texts) => ({
      numPages: texts.length,
      getPage: mock.fn(async (n) => ({
        getTextContent: async () => ({
          items: [{ str: texts[n - 1] }],
        }),
      })),
    });

    const docA = makeDoc(['Hello world', 'Second page']);
    const docB = makeDoc(['Hello world', 'Modified page']);

    const result = await cmp.compareText(docA, docB);
    assert.ok(result.summary);
    assert.ok(typeof result.summary.totalLines === 'number');
    assert.ok(typeof result.summary.changePercent === 'string');
    assert.equal(result.pagesA, 2);
    assert.equal(result.pagesB, 2);
  });

  it('generateDiffHtml produces HTML string', () => {
    const cmp = new PdfCompare();
    const diff = [
      { type: 'equal', text: 'same' },
      { type: 'add', text: 'new' },
      { type: 'remove', text: 'old' },
    ];
    const html = cmp.generateDiffHtml(diff);
    assert.ok(html.includes('diff-report'));
    assert.ok(html.includes('diff-add'));
    assert.ok(html.includes('diff-remove'));
    assert.ok(html.includes('diff-equal'));
  });

  it('generateDiffHtml escapes HTML entities', () => {
    const cmp = new PdfCompare();
    const diff = [{ type: 'equal', text: '<script>alert("xss")</script>' }];
    const html = cmp.generateDiffHtml(diff);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});
