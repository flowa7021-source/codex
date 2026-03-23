import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { BatchOcrEditor, batchFindReplace, generateBatchReport } from '../../app/modules/batch-ocr-editor.js';

describe('BatchOcrEditor', () => {
  it('constructor sets default options', () => {
    const bytes = new Uint8Array(10);
    const editor = new BatchOcrEditor(bytes);
    assert.ok(editor, 'should create an instance');
    assert.equal(editor._language, 'eng');
    assert.equal(editor._autoCorrect, true);
    assert.equal(editor._dpi, 300);
    assert.equal(editor._concurrency, 2);
    assert.equal(editor._embedText, true);
  });

  it('constructor accepts custom options', () => {
    const bytes = new Uint8Array(10);
    const editor = new BatchOcrEditor(bytes, {
      language: 'fra',
      autoCorrect: false,
      dpi: 150,
      concurrency: 4,
      pages: [1, 3, 5],
    });
    assert.equal(editor._language, 'fra');
    assert.equal(editor._autoCorrect, false);
    assert.equal(editor._dpi, 150);
    assert.equal(editor._concurrency, 4);
    assert.deepEqual(editor._pages, [1, 3, 5]);
  });

  it('cancel sets _cancelled flag', () => {
    const editor = new BatchOcrEditor(new Uint8Array(10));
    assert.equal(editor._cancelled, false);
    editor.cancel();
    assert.equal(editor._cancelled, true);
  });

  it('accepts ArrayBuffer input and converts to Uint8Array', () => {
    const buf = new ArrayBuffer(8);
    const editor = new BatchOcrEditor(buf);
    assert.ok(editor._pdfBytes instanceof Uint8Array);
    assert.equal(editor._pdfBytes.length, 8);
  });

  it('_postProcess corrects ligatures when autoCorrect is true', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: true });
    const text = 'ﬁnd the ﬂoor';
    const result = editor._postProcess(text);
    assert.ok(result.includes('find'), 'should replace fi ligature');
    assert.ok(result.includes('floor'), 'should replace fl ligature');
  });

  it('_postProcess normalizes smart quotes', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const text = '\u201CHello\u201D \u2018world\u2019';
    const result = editor._postProcess(text);
    assert.ok(result.includes('"Hello"'));
    assert.ok(result.includes("'world'"));
  });

  it('_postProcess repairs hyphen breaks', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const text = 'docu-\nment';
    const result = editor._postProcess(text);
    assert.ok(result.includes('document'));
  });

  it('_postProcess applies user replacements', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      replacements: [{ find: 'foo', replace: 'bar' }],
    });
    const result = editor._postProcess('foo baz foo');
    assert.equal(result, 'bar baz bar');
  });
});

describe('batchFindReplace', () => {
  it('applies replacements to page results', () => {
    const pages = [
      { page: 1, rawText: 'hello world', correctedText: 'hello world', confidence: 90, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [{ find: 'hello', replace: 'hi' }]);
    assert.equal(result[0].correctedText, 'hi world');
    assert.ok(result[0].corrections > 0);
  });

  it('supports regex replacements', () => {
    const pages = [
      { page: 1, rawText: 'abc 123 def 456', correctedText: 'abc 123 def 456', confidence: 95, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [{ find: /\d+/g, replace: 'NUM' }]);
    assert.equal(result[0].correctedText, 'abc NUM def NUM');
  });
});

describe('generateBatchReport', () => {
  it('generates a report string with stats and per-page data', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [
        { page: 1, rawText: 'a', correctedText: 'a', confidence: 92.5, corrections: 2, charBoxes: [] },
        { page: 2, rawText: 'b', correctedText: 'b', confidence: 88.0, corrections: 0, charBoxes: [] },
      ],
      stats: { pagesProcessed: 2, totalChars: 200, correctedChars: 2, avgConfidence: 90.25 },
    };

    const report = generateBatchReport(result);
    assert.ok(report.includes('Batch OCR Report'));
    assert.ok(report.includes('Pages processed: 2'));
    assert.ok(report.includes('Page 1'));
    assert.ok(report.includes('Page 2'));
    assert.ok(report.includes('90.25%'));
  });
});
