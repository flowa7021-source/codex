import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
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
