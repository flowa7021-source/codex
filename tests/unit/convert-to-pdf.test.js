import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// We need to mock state and PDFDocument before importing
// Since convert-to-pdf imports pdf-lib and state, we test what we can

import { convertCurrentToPdf } from '../../app/modules/convert-to-pdf.js';

describe('convertCurrentToPdf', () => {
  it('shows error when no adapter in state', async () => {
    // state.adapter is null by default
    let statusMsg = '';
    const setStatus = (msg) => { statusMsg = msg; };
    const reloadPdf = mock.fn();
    await convertCurrentToPdf(reloadPdf, setStatus);
    assert.ok(statusMsg.length > 0);
    assert.equal(reloadPdf.mock.calls.length, 0);
  });
});

describe('djvuToPdf', () => {
  it('is exported as a function', async () => {
    const mod = await import('../../app/modules/convert-to-pdf.js');
    assert.equal(typeof mod.djvuToPdf, 'function');
  });

  it('throws when adapter is null', async () => {
    const { djvuToPdf } = await import('../../app/modules/convert-to-pdf.js');
    await assert.rejects(() => djvuToPdf(null, () => {}), { message: /No adapter/ });
  });
});

describe('imagesToPdf', () => {
  it('is exported as a function', async () => {
    const mod = await import('../../app/modules/convert-to-pdf.js');
    assert.equal(typeof mod.imagesToPdf, 'function');
  });
});
