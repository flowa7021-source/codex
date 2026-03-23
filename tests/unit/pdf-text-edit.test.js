import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAvailableFonts,
  spellCheck,
  applyTextEdits,
  addTextBlock,
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
});
