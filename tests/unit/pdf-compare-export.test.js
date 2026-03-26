import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  computeLineDiff,
  computeWordDiff,
  PdfCompare,
  pdfCompare,
  exportAsAnnotatedPdf,
} from '../../app/modules/pdf-compare.js';

// ---------------------------------------------------------------------------
// computeLineDiff
// ---------------------------------------------------------------------------

describe('computeLineDiff', () => {
  it('returns all equal entries for identical arrays', () => {
    const lines = ['hello', 'world'];
    const diff = computeLineDiff(lines, lines);
    assert.ok(diff.every(d => d.type === 'equal'));
    assert.equal(diff.length, 2);
  });

  it('detects removed lines', () => {
    const a = ['line1', 'line2', 'line3'];
    const b = ['line1', 'line3'];
    const diff = computeLineDiff(a, b);
    const removed = diff.filter(d => d.type === 'remove');
    assert.ok(removed.length >= 1);
    assert.ok(removed.some(d => d.text === 'line2'));
  });

  it('detects added lines', () => {
    const a = ['line1'];
    const b = ['line1', 'line2'];
    const diff = computeLineDiff(a, b);
    const added = diff.filter(d => d.type === 'add');
    assert.ok(added.length >= 1);
    assert.ok(added.some(d => d.text === 'line2'));
  });

  it('handles diff with equal + remove + add entries', () => {
    const a = ['same', 'old'];
    const b = ['same', 'new'];
    const diff = computeLineDiff(a, b);
    const types = new Set(diff.map(d => d.type));
    assert.ok(types.has('equal'));
    assert.ok(types.has('remove') || types.has('add'));
  });

  it('handles empty arrays', () => {
    const diff = computeLineDiff([], []);
    assert.ok(Array.isArray(diff));
    assert.equal(diff.length, 0);
  });

  it('handles one empty, one non-empty', () => {
    const diff = computeLineDiff([], ['new']);
    assert.equal(diff.length, 1);
    assert.equal(diff[0].type, 'add');
    assert.equal(diff[0].text, 'new');
  });
});

// ---------------------------------------------------------------------------
// computeWordDiff
// ---------------------------------------------------------------------------

describe('computeWordDiff', () => {
  it('detects word-level changes', () => {
    const diff = computeWordDiff('the quick fox', 'the slow fox');
    const types = new Set(diff.map(d => d.type));
    assert.ok(types.has('equal'));
    // 'quick' removed, 'slow' added
    assert.ok(types.has('remove') || types.has('add'));
  });

  it('returns all equal for identical strings', () => {
    const diff = computeWordDiff('hello world', 'hello world');
    assert.ok(diff.every(d => d.type === 'equal'));
  });

  it('handles empty strings', () => {
    const diff = computeWordDiff('', '');
    assert.ok(Array.isArray(diff));
  });
});

// ---------------------------------------------------------------------------
// PdfCompare class
// ---------------------------------------------------------------------------

describe('PdfCompare', () => {
  it('pdfCompare is an instance of PdfCompare', () => {
    assert.ok(pdfCompare instanceof PdfCompare);
  });

  it('generateDiffHtml produces HTML string', () => {
    const diff = [
      { type: 'equal', text: 'same line' },
      { type: 'add', text: 'added line' },
      { type: 'remove', text: 'removed line' },
    ];
    const html = pdfCompare.generateDiffHtml(diff);
    assert.ok(typeof html === 'string');
    assert.ok(html.includes('diff-report'));
    assert.ok(html.includes('diff-add'));
    assert.ok(html.includes('diff-remove'));
    assert.ok(html.includes('diff-equal'));
    assert.ok(html.includes('added line'));
    assert.ok(html.includes('removed line'));
  });

  it('generateDiffHtml escapes HTML entities', () => {
    const diff = [{ type: 'equal', text: '<script>alert("xss")</script>' }];
    const html = pdfCompare.generateDiffHtml(diff);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});

// ---------------------------------------------------------------------------
// exportAsAnnotatedPdf
// ---------------------------------------------------------------------------

describe('exportAsAnnotatedPdf', () => {
  it('returns a Blob for a diff with changes', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const pdfBytes = new Uint8Array(await doc.save());

    const diffResult = [
      { type: 'equal', text: 'same' },
      { type: 'remove', text: 'old text' },
      { type: 'add', text: 'new text' },
    ];

    const blob = await exportAsAnnotatedPdf(pdfBytes, diffResult);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
  });

  it('handles empty diff gracefully', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const pdfBytes = new Uint8Array(await doc.save());

    const blob = await exportAsAnnotatedPdf(pdfBytes, []);
    assert.ok(blob instanceof Blob);
  });

  it('handles PDF with no pages', async () => {
    const doc = await PDFDocument.create();
    const pdfBytes = new Uint8Array(await doc.save());

    const blob = await exportAsAnnotatedPdf(pdfBytes, [
      { type: 'add', text: 'something' },
    ]);
    assert.ok(blob instanceof Blob);
  });
});
