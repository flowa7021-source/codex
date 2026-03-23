import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock pdfjs-dist and pdf-lib BEFORE importing the module under test
await mock.module('pdfjs-dist/build/pdf.mjs', {
  namedExports: {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 3,
        getPage: async (pageNum) => ({
          getViewport: () => ({ width: 100, height: 100 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
        destroy: () => {},
      }),
    }),
  },
});

await mock.module('pdf-lib', {
  namedExports: {
    PDFDocument: {
      load: async () => {
        const pages = [
          {
            ref: { pageRef: 0 },
            getSize: () => ({ width: 612, height: 792 }),
            drawText: () => {},
          },
          {
            ref: { pageRef: 1 },
            getSize: () => ({ width: 612, height: 792 }),
            drawText: () => {},
          },
          {
            ref: { pageRef: 2 },
            getSize: () => ({ width: 612, height: 792 }),
            drawText: () => {},
          },
        ];
        return {
          getPages: () => pages,
          save: async () => new Uint8Array([1, 2, 3, 4]),
        };
      },
    },
    PDFName: { of: (n) => n },
    PDFString: { of: (s) => s },
    PDFNumber: { of: (n) => n },
  },
});

import { BatchOcrEditor, batchFindReplace, generateBatchReport } from '../../app/modules/batch-ocr-editor.js';

// ─── BatchOcrEditor constructor ──────────────────────────────────────────────

describe('BatchOcrEditor constructor', () => {
  it('sets default options when no opts given', () => {
    const bytes = new Uint8Array(10);
    const editor = new BatchOcrEditor(bytes);
    assert.equal(editor._language, 'eng');
    assert.equal(editor._autoCorrect, true);
    assert.equal(editor._dpi, 300);
    assert.equal(editor._concurrency, 2);
    assert.equal(editor._embedText, true);
    assert.equal(editor._pages, null);
    assert.deepEqual(editor._replacements, []);
    assert.equal(editor._onProgress, null);
    assert.equal(editor._cancelled, false);
  });

  it('accepts custom options', () => {
    const bytes = new Uint8Array(10);
    const onProgress = () => {};
    const editor = new BatchOcrEditor(bytes, {
      language: 'fra',
      autoCorrect: false,
      dpi: 150,
      concurrency: 4,
      pages: [1, 3, 5],
      embedTextLayer: false,
      replacements: [{ find: 'foo', replace: 'bar' }],
      onProgress,
    });
    assert.equal(editor._language, 'fra');
    assert.equal(editor._autoCorrect, false);
    assert.equal(editor._dpi, 150);
    assert.equal(editor._concurrency, 4);
    assert.deepEqual(editor._pages, [1, 3, 5]);
    assert.equal(editor._embedText, false);
    assert.equal(editor._replacements.length, 1);
    assert.equal(editor._onProgress, onProgress);
  });

  it('converts ArrayBuffer to Uint8Array', () => {
    const buf = new ArrayBuffer(8);
    const editor = new BatchOcrEditor(buf);
    assert.ok(editor._pdfBytes instanceof Uint8Array);
    assert.equal(editor._pdfBytes.length, 8);
  });

  it('keeps Uint8Array as is', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const editor = new BatchOcrEditor(bytes);
    assert.ok(editor._pdfBytes instanceof Uint8Array);
    assert.equal(editor._pdfBytes.length, 3);
  });
});

// ─── cancel() ────────────────────────────────────────────────────────────────

describe('BatchOcrEditor.cancel()', () => {
  it('sets _cancelled to true', () => {
    const editor = new BatchOcrEditor(new Uint8Array(10));
    assert.equal(editor._cancelled, false);
    editor.cancel();
    assert.equal(editor._cancelled, true);
  });
});

// ─── _postProcess ─────────────────────────────────────────────────────────────

describe('BatchOcrEditor._postProcess()', () => {
  it('corrects fi ligature', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('ﬁnd'), 'find');
  });

  it('corrects fl ligature', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('ﬂoor'), 'floor');
  });

  it('corrects ff ligature', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('ﬀ'), 'ff');
  });

  it('corrects ffi ligature', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('ﬃ'), 'ffi');
  });

  it('corrects ffl ligature', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('ﬄ'), 'ffl');
  });

  it('corrects st ligature', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('ﬅ'), 'st');
  });

  it('normalizes left double quote', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.ok(editor._postProcess('\u201CHello\u201D').includes('"Hello"'));
  });

  it('normalizes right single quote', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.ok(editor._postProcess('\u2018world\u2019').includes("'world'"));
  });

  it('normalizes ellipsis', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('\u2026'), '...');
  });

  it('normalizes em dash', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('\u2014'), '-');
  });

  it('normalizes en dash', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('\u2013'), '-');
  });

  it('repairs hyphen break', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.equal(editor._postProcess('docu-\nment'), 'document');
  });

  it('skips ligature correction when autoCorrect=false', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: false });
    const text = 'ﬁnd';
    assert.equal(editor._postProcess(text), 'ﬁnd');
  });

  it('applies user string replacements globally', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      replacements: [{ find: 'foo', replace: 'bar' }],
    });
    assert.equal(editor._postProcess('foo baz foo'), 'bar baz bar');
  });

  it('applies user regex replacements', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      replacements: [{ find: /\d+/g, replace: 'NUM' }],
    });
    assert.equal(editor._postProcess('abc 123 def 456'), 'abc NUM def NUM');
  });

  it('escapes special chars in string find', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      replacements: [{ find: 'a.b', replace: 'X' }],
    });
    // 'a.b' should match literal 'a.b' not any char between
    const result = editor._postProcess('a.b axb');
    assert.equal(result, 'X axb');
  });

  it('returns text unchanged when autoCorrect=false and no replacements', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: false });
    const text = 'Hello World 123';
    assert.equal(editor._postProcess(text), text);
  });
});

// ─── _computeStats ──────────────────────────────────────────────────────────

describe('BatchOcrEditor._computeStats()', () => {
  it('computes stats for multiple pages', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const results = [
      { correctedText: 'hello', corrections: 2, confidence: 80 },
      { correctedText: 'world!', corrections: 1, confidence: 90 },
    ];
    const stats = editor._computeStats(results);
    assert.equal(stats.pagesProcessed, 2);
    assert.equal(stats.totalChars, 11); // 5 + 6
    assert.equal(stats.correctedChars, 3);
    assert.equal(stats.avgConfidence, 85);
  });

  it('returns zero avgConfidence for empty results', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const stats = editor._computeStats([]);
    assert.equal(stats.pagesProcessed, 0);
    assert.equal(stats.avgConfidence, 0);
    assert.equal(stats.totalChars, 0);
    assert.equal(stats.correctedChars, 0);
  });

  it('computes stats for single page', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const stats = editor._computeStats([
      { correctedText: 'abc', corrections: 1, confidence: 95 },
    ]);
    assert.equal(stats.pagesProcessed, 1);
    assert.equal(stats.totalChars, 3);
    assert.equal(stats.correctedChars, 1);
    assert.equal(stats.avgConfidence, 95);
  });
});

// ─── _progress ───────────────────────────────────────────────────────────────

describe('BatchOcrEditor._progress()', () => {
  it('calls onProgress callback when set', () => {
    const events = [];
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      onProgress: (e) => events.push(e),
    });
    editor._progress({ phase: 'init', page: 0, total: 5 });
    assert.equal(events.length, 1);
    assert.equal(events[0].phase, 'init');
  });

  it('does not throw when onProgress is null', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.doesNotThrow(() => editor._progress({ phase: 'init', page: 0, total: 1 }));
  });
});

// ─── _embedPlainText ──────────────────────────────────────────────────────────

describe('BatchOcrEditor._embedPlainText()', () => {
  it('draws lines on page', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push({ text, opts }) };
    editor._embedPlainText(page, 'line1\nline2\nline3', 612, 792);
    assert.equal(drawCalls.length, 3);
    assert.equal(drawCalls[0].text, 'line1');
  });

  it('stops near bottom margin', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(text) };
    // Short page height, many lines - should stop before bottom
    const manyLines = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n');
    editor._embedPlainText(page, manyLines, 612, 100);
    // With y starting at 100-36=64 and leading=14, should stop after 2-3 lines
    assert.ok(drawCalls.length < 10);
  });

  it('skips blank lines', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(text) };
    editor._embedPlainText(page, 'line1\n\n  \nline2', 612, 792);
    assert.equal(drawCalls.length, 2);
  });

  it('truncates long lines to 200 chars', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(text) };
    const longLine = 'a'.repeat(300);
    editor._embedPlainText(page, longLine, 612, 792);
    assert.equal(drawCalls[0].length, 200);
  });
});

// ─── _embedCharBoxes ─────────────────────────────────────────────────────────

describe('BatchOcrEditor._embedCharBoxes()', () => {
  it('returns early when no charBoxes', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(text) };
    editor._embedCharBoxes(page, { charBoxes: [] }, 612, 792);
    assert.equal(drawCalls.length, 0);
  });

  it('groups chars into lines and draws text', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push({ text, opts }) };
    const charBoxes = [
      { char: 'H', bbox: { x0: 0, y0: 10, x1: 10, y1: 20 }, confidence: 95 },
      { char: 'i', bbox: { x0: 11, y0: 10, x1: 16, y1: 20 }, confidence: 95 },
    ];
    editor._embedCharBoxes(page, { charBoxes }, 612, 792);
    assert.equal(drawCalls.length, 1);
    assert.equal(drawCalls[0].text, 'Hi');
    assert.equal(drawCalls[0].opts.opacity, 0);
  });

  it('handles multiple lines of char boxes', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(text) };
    const charBoxes = [
      // Line 1
      { char: 'A', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 90 },
      { char: 'B', bbox: { x0: 11, y0: 0, x1: 20, y1: 10 }, confidence: 90 },
      // Line 2 (far below)
      { char: 'C', bbox: { x0: 0, y0: 50, x1: 10, y1: 60 }, confidence: 90 },
    ];
    editor._embedCharBoxes(page, { charBoxes }, 612, 792);
    assert.equal(drawCalls.length, 2);
  });
});

// ─── _ocrPage ────────────────────────────────────────────────────────────────

describe('BatchOcrEditor._ocrPage()', () => {
  it('extracts text and charBoxes from worker result', async () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const canvas = {};
    const worker = {
      recognize: async () => ({
        data: {
          text: 'Hello',
          confidence: 92,
          words: [
            {
              symbols: [
                { text: 'H', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 95 },
                { text: 'i', bbox: { x0: 11, y0: 0, x1: 16, y1: 10 }, confidence: 90 },
              ],
            },
          ],
        },
      }),
    };
    const result = await editor._ocrPage(worker, canvas);
    assert.equal(result.text, 'Hello');
    assert.equal(result.confidence, 92);
    assert.equal(result.charBoxes.length, 2);
    assert.equal(result.charBoxes[0].char, 'H');
  });

  it('handles words without symbols gracefully', async () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const worker = {
      recognize: async () => ({
        data: {
          text: 'test',
          confidence: 85,
          words: [{ /* no symbols */ }],
        },
      }),
    };
    const result = await editor._ocrPage(worker, {});
    assert.equal(result.charBoxes.length, 0);
  });

  it('handles no words in data', async () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const worker = {
      recognize: async () => ({
        data: { text: 'no words', confidence: 80 },
      }),
    };
    const result = await editor._ocrPage(worker, {});
    assert.equal(result.charBoxes.length, 0);
    assert.equal(result.text, 'no words');
  });
});

// ─── batchFindReplace ────────────────────────────────────────────────────────

describe('batchFindReplace()', () => {
  it('applies string replacements', () => {
    const pages = [
      { page: 1, rawText: 'hello world', correctedText: 'hello world', confidence: 90, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [{ find: 'hello', replace: 'hi' }]);
    assert.equal(result[0].correctedText, 'hi world');
    assert.ok(result[0].corrections > 0);
  });

  it('applies regex replacements', () => {
    const pages = [
      { page: 1, rawText: 'abc 123 def 456', correctedText: 'abc 123 def 456', confidence: 95, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [{ find: /\d+/g, replace: 'NUM' }]);
    assert.equal(result[0].correctedText, 'abc NUM def NUM');
  });

  it('processes multiple pages', () => {
    const pages = [
      { page: 1, rawText: 'foo', correctedText: 'foo', confidence: 90, corrections: 0, charBoxes: [] },
      { page: 2, rawText: 'bar', correctedText: 'bar foo', confidence: 88, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [{ find: 'foo', replace: 'baz' }]);
    assert.equal(result[0].correctedText, 'baz');
    assert.equal(result[1].correctedText, 'bar baz');
  });

  it('does not mutate original array', () => {
    const pages = [
      { page: 1, rawText: 'foo', correctedText: 'foo', confidence: 90, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [{ find: 'foo', replace: 'baz' }]);
    assert.equal(pages[0].correctedText, 'foo');
    assert.equal(result[0].correctedText, 'baz');
  });

  it('applies multiple replacements in order', () => {
    const pages = [
      { page: 1, rawText: 'abc', correctedText: 'abc', confidence: 90, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [
      { find: 'a', replace: 'x' },
      { find: 'x', replace: 'z' },
    ]);
    assert.equal(result[0].correctedText, 'zbc');
  });

  it('updates corrections count', () => {
    const pages = [
      { page: 1, rawText: 'abc', correctedText: 'abc', confidence: 90, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [{ find: 'abc', replace: 'xyz' }]);
    assert.equal(result[0].corrections, 3);
  });

  it('handles empty replacements array', () => {
    const pages = [
      { page: 1, rawText: 'text', correctedText: 'text', confidence: 90, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, []);
    assert.equal(result[0].correctedText, 'text');
  });

  it('handles empty pages array', () => {
    const result = batchFindReplace([], [{ find: 'foo', replace: 'bar' }]);
    assert.deepEqual(result, []);
  });
});

// ─── generateBatchReport ─────────────────────────────────────────────────────

describe('generateBatchReport()', () => {
  it('generates report with stats and per-page data', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [
        { page: 1, rawText: 'a', correctedText: 'abc', confidence: 92.5, corrections: 2, charBoxes: [] },
        { page: 2, rawText: 'b', correctedText: 'def', confidence: 88.0, corrections: 0, charBoxes: [] },
      ],
      stats: { pagesProcessed: 2, totalChars: 200, correctedChars: 2, avgConfidence: 90.25 },
    };

    const report = generateBatchReport(result);
    assert.ok(report.includes('Batch OCR Report'));
    assert.ok(report.includes('Pages processed: 2'));
    assert.ok(report.includes('Total characters'));
    assert.ok(report.includes('Characters corrected'));
    assert.ok(report.includes('Average confidence'));
    assert.ok(report.includes('Page 1'));
    assert.ok(report.includes('Page 2'));
    assert.ok(report.includes('90.25%'));
  });

  it('includes per-page confidence values', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [
        { page: 1, correctedText: 'hello', confidence: 75.123, corrections: 1, charBoxes: [] },
      ],
      stats: { pagesProcessed: 1, totalChars: 5, correctedChars: 1, avgConfidence: 75.12 },
    };
    const report = generateBatchReport(result);
    assert.ok(report.includes('75.1'));
    assert.ok(report.includes('1 corrections'));
  });

  it('handles empty pages', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [],
      stats: { pagesProcessed: 0, totalChars: 0, correctedChars: 0, avgConfidence: 0 },
    };
    const report = generateBatchReport(result);
    assert.ok(report.includes('Pages processed: 0'));
    assert.ok(typeof report === 'string');
  });

  it('returns a newline-joined string', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [],
      stats: { pagesProcessed: 0, totalChars: 0, correctedChars: 0, avgConfidence: 0 },
    };
    const report = generateBatchReport(result);
    assert.ok(report.includes('\n'));
  });
});
