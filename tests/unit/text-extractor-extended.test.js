import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractTextInReadingOrder, extractMultiPageText, downloadText } from '../../app/modules/text-extractor.js';

const _origCreate = document.createElement;
document.createElement = (tag) => { const el = _origCreate(tag); if (!el.click) el.click = () => {}; return el; };
if (!document.body.removeChild) document.body.removeChild = () => {};

describe('extractTextInReadingOrder', () => {
  it('returns empty for null', () => { assert.equal(extractTextInReadingOrder(null), ''); });
  it('returns empty for empty', () => { assert.equal(extractTextInReadingOrder([]), ''); });
  it('extracts single item', () => { assert.equal(extractTextInReadingOrder([{ str: 'Hello', x: 10, y: 700, width: 50, height: 12, fontSize: 12 }]), 'Hello'); });
  it('groups same line items', () => { const t = extractTextInReadingOrder([{ str: 'A', x: 10, y: 700, width: 40, height: 12, fontSize: 12 }, { str: 'B', x: 60, y: 700, width: 40, height: 12, fontSize: 12 }]); assert.ok(t.includes('A') && t.includes('B')); });
  it('orders top to bottom', () => { const t = extractTextInReadingOrder([{ str: 'Bot', x: 10, y: 100, width: 30, height: 12, fontSize: 12 }, { str: 'Top', x: 10, y: 700, width: 30, height: 12, fontSize: 12 }]); const lines = t.split('\n').filter(Boolean); assert.equal(lines[0], 'Top'); });
  it('filters headers', () => { const t = extractTextInReadingOrder([{ str: 'H', x: 10, y: 810, width: 20, height: 12, fontSize: 12 }, { str: 'Body', x: 10, y: 400, width: 40, height: 12, fontSize: 12 }], { removeHeaders: true, removeFooters: false, pageHeight: 842 }); assert.ok(!t.includes('H')); assert.ok(t.includes('Body')); });
  it('filters footers', () => { const t = extractTextInReadingOrder([{ str: 'F', x: 10, y: 20, width: 20, height: 12, fontSize: 12 }, { str: 'Body', x: 10, y: 400, width: 40, height: 12, fontSize: 12 }], { removeHeaders: false, removeFooters: true, pageHeight: 842 }); assert.ok(!t.includes('F')); });
  it('detects two columns', () => { const t = extractTextInReadingOrder([{ str: 'L', x: 10, y: 700, width: 40, height: 12, fontSize: 12 }, { str: 'L2', x: 10, y: 680, width: 40, height: 12, fontSize: 12 }, { str: 'R', x: 350, y: 700, width: 40, height: 12, fontSize: 12 }, { str: 'R2', x: 350, y: 680, width: 40, height: 12, fontSize: 12 }], { columnGap: 50, removeHeaders: false, removeFooters: false }); assert.ok(t.indexOf('L') < t.indexOf('R')); });
});

describe('extractMultiPageText', () => {
  it('combines pages', () => { const t = extractMultiPageText([{ items: [{ str: 'P1', x: 10, y: 400, width: 20, height: 12, fontSize: 12 }], pageHeight: 842 }, { items: [{ str: 'P2', x: 10, y: 400, width: 20, height: 12, fontSize: 12 }], pageHeight: 842 }]); assert.ok(t.includes('P1') && t.includes('P2')); });
  it('has page breaks', () => { const t = extractMultiPageText([{ items: [{ str: 'A', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 }, { items: [{ str: 'B', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 }]); assert.ok(t.includes('Page 2')); });
  it('no breaks when disabled', () => { const t = extractMultiPageText([{ items: [{ str: 'A', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 }, { items: [{ str: 'B', x: 10, y: 400, width: 10, height: 12, fontSize: 12 }], pageHeight: 842 }], { addPageBreaks: false }); assert.ok(!t.includes('Page')); });
});

describe('downloadText', () => {
  it('does not throw', () => { assert.doesNotThrow(() => downloadText('hello', 'test.txt')); });
});
