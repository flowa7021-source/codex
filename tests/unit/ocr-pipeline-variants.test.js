import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initOcrPipelineVariantsDeps } from '../../app/modules/ocr-pipeline-variants.js';

describe('initOcrPipelineVariantsDeps', () => {
  it('accepts a deps object without error', () => {
    const cache = new Map();
    initOcrPipelineVariantsDeps({ _ocrWordCache: cache });
    // Should not throw
  });

  it('works with empty deps', () => {
    initOcrPipelineVariantsDeps({});
  });

  it('handles multiple calls without error', () => {
    initOcrPipelineVariantsDeps({ _ocrWordCache: new Map() });
    initOcrPipelineVariantsDeps({ _ocrWordCache: new Map() });
  });
});

// runOcrOnPreparedCanvas requires Tesseract + state, so we test
// its early-exit guard for invalid canvas
describe('runOcrOnPreparedCanvas guards', () => {
  // Importing separately since the module has many deps
  it('module exports runOcrOnPreparedCanvas', async () => {
    const mod = await import('../../app/modules/ocr-pipeline-variants.js');
    assert.equal(typeof mod.runOcrOnPreparedCanvas, 'function');
  });

  it('returns empty string for null canvas', async () => {
    const { runOcrOnPreparedCanvas } = await import('../../app/modules/ocr-pipeline-variants.js');
    const result = await runOcrOnPreparedCanvas(null);
    assert.equal(result, '');
  });

  it('returns empty string for zero-dimension canvas', async () => {
    const { runOcrOnPreparedCanvas } = await import('../../app/modules/ocr-pipeline-variants.js');
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });

  it('returns empty string for canvas with zero height', async () => {
    const { runOcrOnPreparedCanvas } = await import('../../app/modules/ocr-pipeline-variants.js');
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 0;
    const result = await runOcrOnPreparedCanvas(canvas);
    assert.equal(result, '');
  });
});
