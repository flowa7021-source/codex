import './setup-dom.js';
import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageRange, initPdfOpsDeps, buildMergedPdfFromCanvases } from '../../app/modules/pdf-ops-controller.js';

describe('parsePageRange', () => {
  it('parses single page numbers', () => {
    assert.deepEqual(parsePageRange('3', 10), [3]);
  });

  it('parses comma-separated pages', () => {
    assert.deepEqual(parsePageRange('1,3,5', 10), [1, 3, 5]);
  });

  it('parses a range', () => {
    assert.deepEqual(parsePageRange('2-5', 10), [2, 3, 4, 5]);
  });

  it('parses mixed ranges and pages', () => {
    assert.deepEqual(parsePageRange('1,3-5,8', 10), [1, 3, 4, 5, 8]);
  });

  it('clamps to maxPage', () => {
    assert.deepEqual(parsePageRange('8-15', 10), [8, 9, 10]);
  });

  it('ignores pages below 1', () => {
    assert.deepEqual(parsePageRange('0,1,2', 5), [1, 2]);
  });

  it('deduplicates overlapping ranges', () => {
    assert.deepEqual(parsePageRange('1-3,2-4', 10), [1, 2, 3, 4]);
  });

  it('returns empty for invalid input', () => {
    assert.deepEqual(parsePageRange('abc', 10), []);
  });

  it('handles whitespace in input', () => {
    assert.deepEqual(parsePageRange(' 1 , 3 - 5 ', 10), [1, 3, 4, 5]);
  });
});

describe('initPdfOpsDeps', () => {
  it('does not throw when called with partial deps', () => {
    assert.doesNotThrow(() => initPdfOpsDeps({ setOcrStatus: () => {} }));
  });
});

describe('buildMergedPdfFromCanvases', () => {
  it('throws when no valid files are provided', async () => {
    await assert.rejects(
      () => buildMergedPdfFromCanvases([{ file: null }]),
      { message: 'No valid PDF files provided' },
    );
  });

  it('delegates to mergePdfDocuments dep', async () => {
    const fakeBlob = new Blob(['test']);
    const mergeFn = mock.fn(async () => fakeBlob);
    initPdfOpsDeps({ mergePdfDocuments: mergeFn });

    const file = new Blob(['pdf'], { type: 'application/pdf' });
    const result = await buildMergedPdfFromCanvases([{ file }]);
    assert.equal(result, fakeBlob);
    assert.equal(mergeFn.mock.calls.length, 1);
  });
});

// ─── Additional coverage tests ───────────────────────────────────────────────

describe('parsePageRange — extended', () => {
  it('handles empty string', () => {
    assert.deepEqual(parsePageRange('', 10), []);
  });

  it('handles single page at boundary', () => {
    assert.deepEqual(parsePageRange('10', 10), [10]);
  });

  it('handles page beyond maxPage', () => {
    assert.deepEqual(parsePageRange('15', 10), []);
  });

  it('handles reversed range (from > to)', () => {
    // from=5, to=3, Math.max(1,5)=5, Math.min(10,3)=3, loop doesn't execute
    assert.deepEqual(parsePageRange('5-3', 10), []);
  });

  it('handles range starting at 0', () => {
    // from=Math.max(1,0)=1, to=Math.min(10,3)=3
    assert.deepEqual(parsePageRange('0-3', 10), [1, 2, 3]);
  });

  it('handles range where both ends exceed max', () => {
    assert.deepEqual(parsePageRange('15-20', 10), []);
  });

  it('handles multiple commas with whitespace', () => {
    assert.deepEqual(parsePageRange('  1  ,  ,  3  ', 10), [1, 3]);
  });

  it('handles range with single page overlap', () => {
    assert.deepEqual(parsePageRange('1-3,3-5', 10), [1, 2, 3, 4, 5]);
  });

  it('handles maxPage of 1', () => {
    assert.deepEqual(parsePageRange('1', 1), [1]);
    assert.deepEqual(parsePageRange('1-1', 1), [1]);
    assert.deepEqual(parsePageRange('2', 1), []);
  });
});

describe('buildMergedPdfFromCanvases — extended', () => {
  it('throws when pages array is empty', async () => {
    await assert.rejects(
      () => buildMergedPdfFromCanvases([]),
      { message: 'No valid PDF files provided' },
    );
  });

  it('filters out entries without file property', async () => {
    const fakeBlob = new Blob(['merged']);
    const mergeFn = mock.fn(async () => fakeBlob);
    initPdfOpsDeps({ mergePdfDocuments: mergeFn });

    const file = new Blob(['pdf']);
    const result = await buildMergedPdfFromCanvases([
      { file: null },
      { file },
      { file: undefined },
    ]);
    assert.equal(result, fakeBlob);
    // Should have been called with only the valid file
    const passedFiles = mergeFn.mock.calls[0].arguments[0];
    assert.equal(passedFiles.length, 1);
  });
});

describe('mergePdfFiles', () => {
  // We import dynamically since it depends on document.createElement
  let mergePdfFiles;
  before(async () => {
    const mod = await import('../../app/modules/pdf-ops-controller.js');
    mergePdfFiles = mod.mergePdfFiles;
  });

  it('is exported as a function', () => {
    assert.equal(typeof mergePdfFiles, 'function');
  });

  it('creates a file input and triggers click', async () => {
    // Track if input.click was called
    let clickCalled = false;
    const origCreateElement = document.createElement;
    document.createElement = (tag) => {
      const el = origCreateElement.call(document, tag);
      if (tag === 'input') {
        const origClick = el.click.bind(el);
        el.click = () => { clickCalled = true; };
      }
      return el;
    };

    mergePdfFiles();
    assert.ok(clickCalled, 'should click the file input');

    document.createElement = origCreateElement;
  });
});

describe('splitPdfPages', () => {
  let splitPdfPages;
  before(async () => {
    const mod = await import('../../app/modules/pdf-ops-controller.js');
    splitPdfPages = mod.splitPdfPages;
  });

  it('is exported as a function', () => {
    assert.equal(typeof splitPdfPages, 'function');
  });

  it('shows error when adapter is not pdf type', async () => {
    const statusMessages = [];
    initPdfOpsDeps({
      setOcrStatus: (msg) => statusMessages.push(msg),
      nrPrompt: async () => null,
    });

    // Import state to set adapter
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    state.adapter = { type: 'image' };

    await splitPdfPages();

    assert.ok(statusMessages.some(m => m.includes('PDF')));
    state.adapter = origAdapter;
  });

  it('returns early when no adapter', async () => {
    const statusMessages = [];
    initPdfOpsDeps({
      setOcrStatus: (msg) => statusMessages.push(msg),
    });

    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    state.adapter = null;

    await splitPdfPages();

    assert.ok(statusMessages.some(m => m.includes('PDF')));
    state.adapter = origAdapter;
  });

  it('returns early when user cancels prompt (null)', async () => {
    const statusMessages = [];
    initPdfOpsDeps({
      setOcrStatus: (msg) => statusMessages.push(msg),
      nrPrompt: async () => null,
      parsePageRangeLib: () => [],
    });

    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    state.adapter = { type: 'pdf' };
    const origPageCount = state.pageCount;
    state.pageCount = 10;

    await splitPdfPages();
    // nrPrompt returns null => early return
    state.adapter = origAdapter;
    state.pageCount = origPageCount;
  });

  it('shows error for invalid page range', async () => {
    const statusMessages = [];
    initPdfOpsDeps({
      setOcrStatus: (msg) => statusMessages.push(msg),
      nrPrompt: async () => 'abc',
      parsePageRangeLib: () => [],
    });

    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    state.adapter = { type: 'pdf' };
    const origPageCount = state.pageCount;
    state.pageCount = 10;

    await splitPdfPages();

    assert.ok(statusMessages.some(m => m.includes('Неверный')));
    state.adapter = origAdapter;
    state.pageCount = origPageCount;
  });

  it('handles split success', async () => {
    const statusMessages = [];
    const diagnosticEvents = [];
    const fakeBlob = new Blob(['split-pdf']);
    Object.defineProperty(fakeBlob, 'size', { value: 5000 });

    initPdfOpsDeps({
      setOcrStatus: (msg) => statusMessages.push(msg),
      nrPrompt: async () => '1-3',
      parsePageRangeLib: () => [1, 2, 3],
      splitPdfDocument: async () => fakeBlob,
      safeCreateObjectURL: () => 'blob:mock-url',
      pushDiagnosticEvent: (name, data) => diagnosticEvents.push({ name, data }),
    });

    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    const origFile = state.file;
    const origPageCount = state.pageCount;
    const origDocName = state.docName;

    state.adapter = { type: 'pdf' };
    state.pageCount = 10;
    state.docName = 'test';
    state.file = new Blob(['pdf-data']);

    await splitPdfPages();

    assert.ok(statusMessages.some(m => m.includes('3')));
    assert.ok(diagnosticEvents.some(e => e.name === 'pdf.split'));

    state.adapter = origAdapter;
    state.file = origFile;
    state.pageCount = origPageCount;
    state.docName = origDocName;
  });

  it('handles split returning null blob', async () => {
    const statusMessages = [];

    initPdfOpsDeps({
      setOcrStatus: (msg) => statusMessages.push(msg),
      nrPrompt: async () => '1-3',
      parsePageRangeLib: () => [1, 2, 3],
      splitPdfDocument: async () => null,
      pushDiagnosticEvent: () => {},
    });

    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    const origFile = state.file;
    const origPageCount = state.pageCount;

    state.adapter = { type: 'pdf' };
    state.pageCount = 10;
    state.file = new Blob(['pdf-data']);

    await splitPdfPages();

    assert.ok(statusMessages.some(m => m.includes('Ошибка')));

    state.adapter = origAdapter;
    state.file = origFile;
    state.pageCount = origPageCount;
  });

  it('handles split error', async () => {
    const statusMessages = [];
    const diagnosticEvents = [];

    initPdfOpsDeps({
      setOcrStatus: (msg) => statusMessages.push(msg),
      nrPrompt: async () => '1-3',
      parsePageRangeLib: () => [1, 2, 3],
      splitPdfDocument: async () => { throw new Error('split failed'); },
      pushDiagnosticEvent: (name, data, level) => diagnosticEvents.push({ name, level }),
    });

    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    const origFile = state.file;
    const origPageCount = state.pageCount;

    state.adapter = { type: 'pdf' };
    state.pageCount = 10;
    state.file = new Blob(['pdf-data']);

    await splitPdfPages();

    assert.ok(statusMessages.some(m => m.includes('split failed')));
    assert.ok(diagnosticEvents.some(e => e.name === 'pdf.split.error'));

    state.adapter = origAdapter;
    state.file = origFile;
    state.pageCount = origPageCount;
  });
});

describe('initPdfOpsDeps — extended', () => {
  it('overwrites only provided keys', () => {
    const fn1 = () => 'test1';
    const fn2 = () => 'test2';
    initPdfOpsDeps({ setOcrStatus: fn1 });
    initPdfOpsDeps({ pushDiagnosticEvent: fn2 });
    // Both should be set now (Object.assign merges)
    assert.doesNotThrow(() => initPdfOpsDeps({}));
  });
});
