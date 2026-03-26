// ─── Unit Tests: Outline Editor Extended ──────────────────────────────────────
import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeOutline, generateBookmarksFromHeadings } from '../../app/modules/outline-editor.js';
import { PDFDocument } from 'pdf-lib';

async function createTestPdf(pageCount = 3) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792]);
  return doc.save();
}

describe('writeOutline', () => {
  it('creates PDF with outline entries', async () => {
    const bytes = await createTestPdf();
    const tree = [
      { title: 'Chapter 1', pageNum: 1, children: [], open: true },
      { title: 'Chapter 2', pageNum: 2, children: [], open: true },
    ];
    const blob = await writeOutline(bytes, tree);
    assert.ok(blob instanceof Blob);
    assert.ok(blob.size > 0);
  });

  it('handles empty outline tree', async () => {
    const bytes = await createTestPdf();
    const blob = await writeOutline(bytes, []);
    assert.ok(blob instanceof Blob);
  });

  it('handles nested children', async () => {
    const bytes = await createTestPdf();
    const tree = [
      {
        title: 'Part 1', pageNum: 1, children: [
          { title: 'Section 1.1', pageNum: 1, children: [], open: true },
          { title: 'Section 1.2', pageNum: 2, children: [], open: true },
        ], open: true,
      },
    ];
    const blob = await writeOutline(bytes, tree);
    assert.ok(blob.size > 0);
  });
});

describe('generateBookmarksFromHeadings', () => {
  it('is exported as a function', () => {
    assert.equal(typeof generateBookmarksFromHeadings, 'function');
  });

  it('accepts options parameter', () => {
    // Just verifying the function signature exists with correct arity
    assert.ok(generateBookmarksFromHeadings.length >= 1);
  });
});
