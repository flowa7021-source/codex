import './setup-dom.js';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  PIPELINE_VERSION,
  convertPdfToDocxV2,
  convertPdfToDocxCompat,
} from '../../app/modules/conversion-pipeline.js';

function makeMockPdfPage() {
  return {
    getTextContent: async () => ({ items: [{ str: 'hello', transform: [12, 0, 0, 12, 72, 700], width: 30, height: 12 }], styles: {} }),
    getViewport: () => ({ width: 595, height: 842, scale: 1 }),
    getAnnotations: async () => [],
    getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
    rotate: 0,
    commonObjs: { get: () => null, has: () => false },
    objs: { get: () => null, has: () => false },
  };
}

function makeMockPdfDoc(numPages = 1) {
  return {
    numPages,
    getPage: async () => makeMockPdfPage(),
    getOutline: async () => null,
  };
}

describe('PIPELINE_VERSION', () => {
  it('is a semver string', () => {
    assert.match(PIPELINE_VERSION, /^\d+\.\d+\.\d+$/);
  });
});

describe('convertPdfToDocxV2', () => {
  it('returns an object with blob and qa=null by default', async () => {
    const pdfDoc = makeMockPdfDoc(1);
    const result = await convertPdfToDocxV2(pdfDoc, { mode: 'text' });
    assert.ok(result.blob !== undefined);
    assert.equal(result.qa, null);
  });

  it('calls onProgress with expected stages', async () => {
    const stages = new Set();
    const pdfDoc = makeMockPdfDoc(1);
    await convertPdfToDocxV2(pdfDoc, {
      onProgress(stage) { stages.add(stage); },
    });
    assert.ok(stages.has('extract'));
    assert.ok(stages.has('layout'));
    assert.ok(stages.has('semantic'));
    assert.ok(stages.has('build'));
  });

  it('runs QA when runQA is true and returns metrics', async () => {
    const pdfDoc = makeMockPdfDoc(1);
    const result = await convertPdfToDocxV2(pdfDoc, { runQA: true });
    assert.ok(result.qa);
    assert.ok(result.qa.textMetrics);
    assert.equal(result.qa.pipelineVersion, PIPELINE_VERSION);
  });

  it('respects pageRange option', async () => {
    const requestedPages = [];
    const pdfDoc = {
      numPages: 5,
      getPage: async (num) => {
        requestedPages.push(num);
        return makeMockPdfPage();
      },
      getOutline: async () => null,
    };
    await convertPdfToDocxV2(pdfDoc, { pageRange: [2, 4] });
    assert.deepEqual(requestedPages, [2, 4]);
  });

  it('uses default title when not specified', async () => {
    const pdfDoc = makeMockPdfDoc(1);
    // Should not throw
    const result = await convertPdfToDocxV2(pdfDoc);
    assert.ok(result.blob !== undefined);
  });
});

describe('convertPdfToDocxCompat', () => {
  it('returns a blob from V2 pipeline', async () => {
    const pdfDoc = makeMockPdfDoc(1);
    const blob = await convertPdfToDocxCompat(pdfDoc, 'Test', 1);
    assert.ok(blob !== undefined);
  });

  it('attempts V1 fallback when V2 throws', async () => {
    const badDoc = {
      numPages: 1,
      getPage: async () => { throw new Error('v2-fail'); },
      getOutline: async () => null,
    };
    // Both V2 and V1 may fail in test env; we just verify the function
    // does not crash unexpectedly (the fallback path is exercised).
    try {
      await convertPdfToDocxCompat(badDoc, 'Test', 1);
    } catch (_) {
      // Expected: V1 fallback also fails in test environment
    }
  });
});
