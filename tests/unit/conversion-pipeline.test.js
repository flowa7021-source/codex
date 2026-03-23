import './setup-dom.js';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  PIPELINE_VERSION,
  convertPdfToDocxV2,
  convertPdfToDocxCompat,
} from '../../app/modules/conversion-pipeline.js';

describe('PIPELINE_VERSION', () => {
  it('is a semver string', () => {
    assert.match(PIPELINE_VERSION, /^\d+\.\d+\.\d+$/);
  });
});

describe('convertPdfToDocxV2', () => {
  function makeMockPdfDoc(numPages = 2) {
    const mockPage = {
      getTextContent: async () => ({ items: [{ str: 'hello', transform: [12, 0, 0, 12, 72, 700] }] }),
      getViewport: () => ({ width: 595, height: 842 }),
      getAnnotations: async () => [],
    };
    return {
      numPages,
      getPage: async () => mockPage,
      getOutline: async () => null,
    };
  }

  it('returns an object with blob and qa properties', async () => {
    const pdfDoc = makeMockPdfDoc(1);
    const result = await convertPdfToDocxV2(pdfDoc, { mode: 'text' });
    assert.ok(result.blob !== undefined);
    assert.equal(result.qa, null);
  });

  it('calls onProgress during conversion', async () => {
    const stages = [];
    const pdfDoc = makeMockPdfDoc(1);
    await convertPdfToDocxV2(pdfDoc, {
      onProgress(stage) { stages.push(stage); },
    });
    assert.ok(stages.includes('extract'));
    assert.ok(stages.includes('layout'));
    assert.ok(stages.includes('build'));
  });

  it('runs QA when runQA is true', async () => {
    const pdfDoc = makeMockPdfDoc(1);
    const result = await convertPdfToDocxV2(pdfDoc, { runQA: true });
    assert.ok(result.qa);
    assert.ok(result.qa.textMetrics);
    assert.equal(result.qa.pipelineVersion, PIPELINE_VERSION);
  });

  it('respects pageRange option', async () => {
    const pages = [];
    const pdfDoc = {
      numPages: 5,
      getPage: async (num) => {
        pages.push(num);
        return {
          getTextContent: async () => ({ items: [] }),
          getViewport: () => ({ width: 595, height: 842 }),
          getAnnotations: async () => [],
        };
      },
      getOutline: async () => null,
    };
    await convertPdfToDocxV2(pdfDoc, { pageRange: [2, 4] });
    assert.deepEqual(pages, [2, 4]);
  });
});

describe('convertPdfToDocxCompat', () => {
  it('returns a Blob on success', async () => {
    const mockPage = {
      getTextContent: async () => ({ items: [] }),
      getViewport: () => ({ width: 595, height: 842 }),
      getAnnotations: async () => [],
    };
    const pdfDoc = {
      numPages: 1,
      getPage: async () => mockPage,
      getOutline: async () => null,
    };
    const blob = await convertPdfToDocxCompat(pdfDoc, 'Test', 1);
    assert.ok(blob !== undefined);
  });
});
