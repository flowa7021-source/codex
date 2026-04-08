import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

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

  it('accepts custom language option', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { language: 'fra' });
    assert.equal(editor._language, 'fra');
  });

  it('accepts autoCorrect=false', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: false });
    assert.equal(editor._autoCorrect, false);
  });

  it('accepts custom dpi', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { dpi: 150 });
    assert.equal(editor._dpi, 150);
  });

  it('accepts custom concurrency', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { concurrency: 4 });
    assert.equal(editor._concurrency, 4);
  });

  it('accepts pages filter', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { pages: [1, 3, 5] });
    assert.deepEqual(editor._pages, [1, 3, 5]);
  });

  it('accepts embedTextLayer=false', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { embedTextLayer: false });
    assert.equal(editor._embedText, false);
  });

  it('accepts replacements', () => {
    const replacements = [{ find: 'foo', replace: 'bar' }];
    const editor = new BatchOcrEditor(new Uint8Array(0), { replacements });
    assert.equal(editor._replacements.length, 1);
  });

  it('accepts onProgress callback', () => {
    const fn = () => {};
    const editor = new BatchOcrEditor(new Uint8Array(0), { onProgress: fn });
    assert.equal(editor._onProgress, fn);
  });

  it('converts ArrayBuffer to Uint8Array', () => {
    const buf = new ArrayBuffer(8);
    const editor = new BatchOcrEditor(buf);
    assert.ok(editor._pdfBytes instanceof Uint8Array);
    assert.equal(editor._pdfBytes.length, 8);
  });

  it('keeps Uint8Array input as Uint8Array', () => {
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

  it('can be called multiple times safely', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    editor.cancel();
    editor.cancel();
    assert.equal(editor._cancelled, true);
  });
});

// ─── _postProcess ─────────────────────────────────────────────────────────────

describe('BatchOcrEditor._postProcess() — ligatures', () => {
  let editor;
  beforeEach(() => {
    editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: true });
  });

  it('replaces fi ligature', () => {
    assert.equal(editor._postProcess('ﬁnd'), 'find');
  });

  it('replaces fl ligature', () => {
    assert.equal(editor._postProcess('ﬂoor'), 'floor');
  });

  it('replaces ff ligature', () => {
    assert.equal(editor._postProcess('ﬀ'), 'ff');
  });

  it('replaces ffi ligature', () => {
    assert.equal(editor._postProcess('ﬃ'), 'ffi');
  });

  it('replaces ffl ligature', () => {
    assert.equal(editor._postProcess('ﬄ'), 'ffl');
  });

  it('replaces st ligature', () => {
    assert.equal(editor._postProcess('ﬅ'), 'st');
  });

  it('handles multiple ligatures in one string', () => {
    const result = editor._postProcess('ﬁnd the ﬂoor');
    assert.equal(result, 'find the floor');
  });
});

describe('BatchOcrEditor._postProcess() — smart quotes', () => {
  let editor;
  beforeEach(() => {
    editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: true });
  });

  it('normalizes left double quote', () => {
    assert.ok(editor._postProcess('\u201CHello\u201D').includes('"Hello"'));
  });

  it('normalizes single curly quotes', () => {
    assert.ok(editor._postProcess('\u2018world\u2019').includes("'world'"));
  });

  it('normalizes low-9 double quote', () => {
    assert.ok(editor._postProcess('\u201Etext\u201F').includes('"text"'));
  });

  it('normalizes ellipsis to three dots', () => {
    assert.equal(editor._postProcess('\u2026'), '...');
  });

  it('normalizes em dash to hyphen', () => {
    assert.equal(editor._postProcess('\u2014'), '-');
  });

  it('normalizes en dash to hyphen', () => {
    assert.equal(editor._postProcess('\u2013'), '-');
  });
});

describe('BatchOcrEditor._postProcess() — hyphen break', () => {
  it('repairs hyphen-newline break', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: true });
    assert.equal(editor._postProcess('docu-\nment'), 'document');
  });

  it('repairs hyphen-break with surrounding spaces', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: true });
    const result = editor._postProcess('some-\n  thing');
    assert.equal(result, 'something');
  });
});

describe('BatchOcrEditor._postProcess() — autoCorrect disabled', () => {
  it('skips all corrections when autoCorrect=false', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: false });
    const text = 'ﬁnd \u2014 ﬂoor \u2026';
    assert.equal(editor._postProcess(text), text);
  });

  it('still applies user replacements when autoCorrect=false', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      autoCorrect: false,
      replacements: [{ find: 'foo', replace: 'bar' }],
    });
    assert.equal(editor._postProcess('foo'), 'bar');
  });
});

describe('BatchOcrEditor._postProcess() — user replacements', () => {
  it('applies string replacements globally', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      replacements: [{ find: 'foo', replace: 'bar' }],
    });
    assert.equal(editor._postProcess('foo baz foo'), 'bar baz bar');
  });

  it('applies regex replacements', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      replacements: [{ find: /\d+/g, replace: 'NUM' }],
    });
    assert.equal(editor._postProcess('abc 123 def 456'), 'abc NUM def NUM');
  });

  it('escapes special characters in string find', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      replacements: [{ find: 'a.b', replace: 'X' }],
    });
    // 'a.b' should match literal 'a.b' not regex wildcard
    const result = editor._postProcess('a.b axb');
    assert.equal(result, 'X axb');
  });

  it('applies multiple replacements in sequence', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      autoCorrect: false,
      replacements: [
        { find: 'a', replace: 'x' },
        { find: 'x', replace: 'z' },
      ],
    });
    assert.equal(editor._postProcess('abc'), 'zbc');
  });

  it('handles empty replacements array', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      autoCorrect: false,
      replacements: [],
    });
    assert.equal(editor._postProcess('hello'), 'hello');
  });
});

// ─── _computeStats ──────────────────────────────────────────────────────────

describe('BatchOcrEditor._computeStats()', () => {
  it('returns zeros for empty results', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const stats = editor._computeStats([]);
    assert.equal(stats.pagesProcessed, 0);
    assert.equal(stats.totalChars, 0);
    assert.equal(stats.correctedChars, 0);
    assert.equal(stats.avgConfidence, 0);
  });

  it('computes stats for single page', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const stats = editor._computeStats([
      { correctedText: 'hello', corrections: 2, confidence: 80 },
    ]);
    assert.equal(stats.pagesProcessed, 1);
    assert.equal(stats.totalChars, 5);
    assert.equal(stats.correctedChars, 2);
    assert.equal(stats.avgConfidence, 80);
  });

  it('computes stats for multiple pages', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const stats = editor._computeStats([
      { correctedText: 'hello', corrections: 2, confidence: 80 },
      { correctedText: 'world!', corrections: 1, confidence: 90 },
    ]);
    assert.equal(stats.pagesProcessed, 2);
    assert.equal(stats.totalChars, 11);
    assert.equal(stats.correctedChars, 3);
    assert.equal(stats.avgConfidence, 85);
  });

  it('rounds avgConfidence to 2 decimal places', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const stats = editor._computeStats([
      { correctedText: 'a', corrections: 0, confidence: 91 },
      { correctedText: 'b', corrections: 0, confidence: 92 },
      { correctedText: 'c', corrections: 0, confidence: 93 },
    ]);
    assert.equal(stats.avgConfidence, 92);
  });
});

// ─── _progress ───────────────────────────────────────────────────────────────

describe('BatchOcrEditor._progress()', () => {
  it('calls onProgress with event', () => {
    const events = [];
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      onProgress: (e) => events.push(e),
    });
    editor._progress({ phase: 'init', page: 0, total: 5 });
    assert.equal(events.length, 1);
    assert.equal(events[0].phase, 'init');
    assert.equal(events[0].total, 5);
  });

  it('does nothing when onProgress is null', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    assert.doesNotThrow(() => editor._progress({ phase: 'init', page: 0, total: 1 }));
  });

  it('passes all event fields to callback', () => {
    const events = [];
    const editor = new BatchOcrEditor(new Uint8Array(0), {
      onProgress: (e) => events.push(e),
    });
    editor._progress({ phase: 'ocr', page: 2, total: 5, pageNum: 3 });
    assert.equal(events[0].phase, 'ocr');
    assert.equal(events[0].page, 2);
    assert.equal(events[0].pageNum, 3);
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
    assert.equal(drawCalls[0].opts.opacity, 0);
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

  it('stops near bottom margin', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(text) };
    const manyLines = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n');
    // Short height: y starts at 100-36=64, leading=14, so fits ~2 lines before y<36
    editor._embedPlainText(page, manyLines, 612, 100);
    assert.ok(drawCalls.length < 10);
  });

  it('uses font size 10 and leading 14', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(opts) };
    editor._embedPlainText(page, 'first\nsecond', 612, 792);
    assert.equal(drawCalls[0].size, 10);
    // second line should be 14px lower
    assert.equal(drawCalls[1].y, drawCalls[0].y - 14);
  });
});

// ─── _embedCharBoxes ─────────────────────────────────────────────────────────

describe('BatchOcrEditor._embedCharBoxes()', () => {
  it('returns early when charBoxes is empty', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(text) };
    editor._embedCharBoxes(page, { charBoxes: [] }, 612, 792);
    assert.equal(drawCalls.length, 0);
  });

  it('draws grouped chars as a line with opacity 0', () => {
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

  it('handles multiple separate lines', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(text) };
    const charBoxes = [
      { char: 'A', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 90 },
      { char: 'B', bbox: { x0: 11, y0: 0, x1: 20, y1: 10 }, confidence: 90 },
      // Far below — new line
      { char: 'C', bbox: { x0: 0, y0: 50, x1: 10, y1: 60 }, confidence: 90 },
    ];
    editor._embedCharBoxes(page, { charBoxes }, 612, 792);
    assert.equal(drawCalls.length, 2);
  });

  it('clamps fontSize between 4 and 72', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const drawCalls = [];
    const page = { drawText: (text, opts) => drawCalls.push(opts) };
    const charBoxes = [
      { char: 'X', bbox: { x0: 0, y0: 0, x1: 1, y1: 1 }, confidence: 90 },
    ];
    editor._embedCharBoxes(page, { charBoxes }, 612, 792);
    assert.ok(drawCalls[0].size >= 4);
    assert.ok(drawCalls[0].size <= 72);
  });
});

// ─── _ocrPage ────────────────────────────────────────────────────────────────

describe('BatchOcrEditor._ocrPage()', () => {
  it('extracts text, confidence and charBoxes from worker result', async () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
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
    const result = await editor._ocrPage(worker, {});
    assert.equal(result.text, 'Hello');
    assert.equal(result.confidence, 92);
    assert.equal(result.charBoxes.length, 2);
    assert.equal(result.charBoxes[0].char, 'H');
    assert.deepEqual(result.charBoxes[0].bbox, { x0: 0, y0: 0, x1: 10, y1: 10 });
  });

  it('handles words without symbols gracefully', async () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const worker = {
      recognize: async () => ({
        data: {
          text: 'test',
          confidence: 85,
          words: [{ /* no symbols property */ }],
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

  it('flattens symbols from multiple words', async () => {
    const editor = new BatchOcrEditor(new Uint8Array(0));
    const worker = {
      recognize: async () => ({
        data: {
          text: 'Hi World',
          confidence: 88,
          words: [
            {
              symbols: [
                { text: 'H', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 90 },
                { text: 'i', bbox: { x0: 11, y0: 0, x1: 16, y1: 10 }, confidence: 90 },
              ],
            },
            {
              symbols: [
                { text: 'W', bbox: { x0: 20, y0: 0, x1: 30, y1: 10 }, confidence: 85 },
              ],
            },
          ],
        },
      }),
    };
    const result = await editor._ocrPage(worker, {});
    assert.equal(result.charBoxes.length, 3);
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

  it('does not mutate original page objects', () => {
    const pages = [
      { page: 1, rawText: 'foo', correctedText: 'foo', confidence: 90, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [{ find: 'foo', replace: 'baz' }]);
    assert.equal(pages[0].correctedText, 'foo');
    assert.equal(result[0].correctedText, 'baz');
  });

  it('applies multiple replacements in sequence', () => {
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

  it('recalculates corrections relative to rawText', () => {
    const pages = [
      { page: 1, rawText: 'original text', correctedText: 'original text', confidence: 90, corrections: 0, charBoxes: [] },
    ];
    const result = batchFindReplace(pages, [{ find: 'original', replace: 'new' }]);
    // 'new text' vs 'original text' — differences at each char position
    assert.ok(result[0].corrections > 0);
  });
});

// ─── generateBatchReport ─────────────────────────────────────────────────────

describe('generateBatchReport()', () => {
  it('generates report with header', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [],
      stats: { pagesProcessed: 0, totalChars: 0, correctedChars: 0, avgConfidence: 0 },
    };
    const report = generateBatchReport(result);
    assert.ok(report.includes('Batch OCR Report'));
  });

  it('includes pages processed count', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [],
      stats: { pagesProcessed: 5, totalChars: 100, correctedChars: 10, avgConfidence: 88.5 },
    };
    const report = generateBatchReport(result);
    assert.ok(report.includes('Pages processed: 5'));
  });

  it('includes total characters', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [],
      stats: { pagesProcessed: 1, totalChars: 1234, correctedChars: 5, avgConfidence: 90 },
    };
    const report = generateBatchReport(result);
    assert.ok(report.includes('Total characters'));
  });

  it('includes characters corrected', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [],
      stats: { pagesProcessed: 1, totalChars: 100, correctedChars: 12, avgConfidence: 90 },
    };
    const report = generateBatchReport(result);
    assert.ok(report.includes('Characters corrected'));
  });

  it('includes average confidence', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [],
      stats: { pagesProcessed: 2, totalChars: 200, correctedChars: 2, avgConfidence: 90.25 },
    };
    const report = generateBatchReport(result);
    assert.ok(report.includes('90.25%'));
  });

  it('includes per-page details', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [
        { page: 1, correctedText: 'hello world', confidence: 92.5, corrections: 2 },
        { page: 3, correctedText: 'test text here!', confidence: 85.0, corrections: 0 },
      ],
      stats: { pagesProcessed: 2, totalChars: 200, correctedChars: 2, avgConfidence: 88.75 },
    };
    const report = generateBatchReport(result);
    assert.ok(report.includes('Page 1'));
    assert.ok(report.includes('Page 3'));
    assert.ok(report.includes('92.5%'));
    assert.ok(report.includes('85.0%'));
  });

  it('returns a newline-separated string', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [],
      stats: { pagesProcessed: 0, totalChars: 0, correctedChars: 0, avgConfidence: 0 },
    };
    assert.ok(generateBatchReport(result).includes('\n'));
  });

  it('includes per-page summary header', () => {
    const result = {
      pdfBytes: new Uint8Array(0),
      pages: [],
      stats: { pagesProcessed: 0, totalChars: 0, correctedChars: 0, avgConfidence: 0 },
    };
    assert.ok(generateBatchReport(result).includes('Per-Page Summary'));
  });
});

// ─── _postProcess — rn pattern ─────────────────────────────────────────────────

describe('BatchOcrEditor._postProcess() — rn OCR pattern', () => {
  it('handles rn word boundary pattern (conservative — keeps as-is)', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: true });
    // The rn pattern: /\brn\b/ — 'rn' surrounded by word boundaries
    // The implementation is conservative and always returns the original match
    const result = editor._postProcess('test rn here');
    // should remain as 'test rn here' (conservative: no change)
    assert.equal(result, 'test rn here');
  });

  it('rn correction callback is invoked and returns original text', () => {
    const editor = new BatchOcrEditor(new Uint8Array(0), { autoCorrect: true });
    // Multiple rn words to exercise the callback function body (lines 287-288)
    const text = 'rn rn test rn';
    const result = editor._postProcess(text);
    assert.equal(result, 'rn rn test rn');
  });
});

// ─── _embedTextLayer ─────────────────────────────────────────────────────────

describe('BatchOcrEditor._embedTextLayer()', () => {
  it('processes results with charBoxes and plain text', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const pdfBytes = new Uint8Array(await doc.save());

    const editor = new BatchOcrEditor(pdfBytes);
    const results = [
      {
        page: 1,
        correctedText: 'Hello world',
        charBoxes: [],  // No charBoxes → uses _embedPlainText path
        confidence: 95,
        corrections: 0,
      },
    ];

    const bytes = await editor._embedTextLayer(results);
    assert.ok(bytes instanceof Uint8Array);
    assert.ok(bytes.length > 0);
  });

  it('skips page results with invalid page number', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const pdfBytes = new Uint8Array(await doc.save());

    const editor = new BatchOcrEditor(pdfBytes);
    const results = [
      {
        page: 99, // Out of range — should be skipped
        correctedText: 'Text',
        charBoxes: [],
        confidence: 90,
        corrections: 0,
      },
    ];

    const bytes = await editor._embedTextLayer(results);
    assert.ok(bytes instanceof Uint8Array);
  });
});
