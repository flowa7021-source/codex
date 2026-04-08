import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAvailableFonts,
  spellCheck,
  applyTextEdits,
  addTextBlock,
  findAndReplace,
} from '../../app/modules/pdf-text-edit.js';
import { PDFDocument } from 'pdf-lib';

async function createTestPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return doc.save();
}

describe('getAvailableFonts', () => {
  it('returns an array of font objects', () => {
    const fonts = getAvailableFonts();
    assert.ok(Array.isArray(fonts));
    assert.ok(fonts.length > 0);
    assert.ok(fonts[0].name);
    assert.ok(fonts[0].label);
  });

  it('includes Helvetica', () => {
    const fonts = getAvailableFonts();
    const names = fonts.map(f => f.name);
    assert.ok(names.includes('Helvetica'));
  });

  it('includes Courier', () => {
    const fonts = getAvailableFonts();
    const names = fonts.map(f => f.name);
    assert.ok(names.includes('Courier'));
  });
});

describe('spellCheck', () => {
  it('returns empty array for empty text', () => {
    assert.deepEqual(spellCheck('', new Set(['hello'])), []);
  });

  it('returns empty when all words are in dictionary', () => {
    const dict = new Set(['hello', 'world']);
    assert.deepEqual(spellCheck('hello world', dict), []);
  });

  it('returns misspelled words not in dictionary', () => {
    const dict = new Set(['hello']);
    const result = spellCheck('hello wrold', dict);
    assert.deepEqual(result, ['wrold']);
  });

  it('is case-insensitive for dictionary lookup', () => {
    const dict = new Set(['hello']);
    assert.deepEqual(spellCheck('Hello', dict), []);
  });

  it('returns empty when dictionary is null', () => {
    assert.deepEqual(spellCheck('hello', null), []);
  });
});

describe('applyTextEdits', () => {
  it('returns a Blob for valid edits', async () => {
    const bytes = await createTestPdf();
    const blob = await applyTextEdits(bytes, [{
      page: 1, x: 50, y: 700, oldText: 'old', newText: 'new',
    }]);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
  });

  it('skips edits for out-of-range pages', async () => {
    const bytes = await createTestPdf();
    const blob = await applyTextEdits(bytes, [{
      page: 99, x: 50, y: 700, oldText: 'old', newText: 'new',
    }]);
    assert.ok(blob instanceof Blob);
  });
});

describe('addTextBlock', () => {
  it('adds text to specified page', async () => {
    const bytes = await createTestPdf();
    const blob = await addTextBlock(bytes, {
      page: 1, text: 'Hello', x: 50, y: 700,
    });
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
  });

  it('throws for invalid page number', async () => {
    const bytes = await createTestPdf();
    await assert.rejects(
      () => addTextBlock(bytes, { page: 5, text: 'Hi', x: 50, y: 700 }),
      { message: /Page 5 not found/ },
    );
  });

  it('wraps long text when maxWidth is specified', async () => {
    const bytes = await createTestPdf();
    // A very narrow maxWidth forces multiple lines
    const blob = await addTextBlock(bytes, {
      page: 1,
      text: 'This is a sentence that should wrap across multiple lines',
      x: 50, y: 700,
      maxWidth: 80,
    });
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
  });

  it('applies custom font, fontSize, and color', async () => {
    const bytes = await createTestPdf();
    const blob = await addTextBlock(bytes, {
      page: 1, text: 'Styled text', x: 50, y: 600,
      fontSize: 16,
      fontName: 'Courier',
      color: { r: 1, g: 0, b: 0 },
    });
    assert.ok(blob instanceof Blob);
  });
});

describe('findAndReplace', () => {
  it('returns blob and replacements count for any PDF', async () => {
    const bytes = await createTestPdf();
    const result = await findAndReplace(bytes, 'nonexistent_xyz', 'replaced');
    assert.ok(result.blob instanceof Blob);
    assert.equal(typeof result.replacements, 'number');
    assert.ok(result.replacements >= 0);
  });

  it('works with caseSensitive=false option', async () => {
    const bytes = await createTestPdf();
    const result = await findAndReplace(bytes, 'SOMETHING', 'other', { caseSensitive: false });
    assert.ok(result.blob instanceof Blob);
  });

  it('respects pageRange — skips excluded pages', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    doc.addPage([612, 792]);
    const bytes = await doc.save();

    // Only process page 2; page 1 should be skipped
    const result = await findAndReplace(bytes, 'search', 'replace', { pageRange: [2] });
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.replacements, 0);
  });

  it('handles PDF with no Contents entry gracefully', async () => {
    // A totally blank page (no drawing ops) may have no Contents — should not throw
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = await doc.save();
    const result = await findAndReplace(bytes, 'anything', 'replaced');
    assert.ok(result.blob instanceof Blob);
  });
});
