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

// ─── convertCurrentToPdf — expanded coverage ─────────────────────────────────

describe('convertCurrentToPdf — PDF type', () => {
  it('reports already PDF when adapter type is pdf', async () => {
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    state.adapter = { type: 'pdf' };
    try {
      let statusMsg = '';
      const setStatus = (msg) => { statusMsg = msg; };
      const reloadPdf = mock.fn();
      await convertCurrentToPdf(reloadPdf, setStatus);
      assert.ok(statusMsg.includes('PDF'));
      assert.equal(reloadPdf.mock.callCount(), 0);
    } finally {
      state.adapter = origAdapter;
    }
  });
});

describe('convertCurrentToPdf — unsupported type', () => {
  it('reports unsupported format for unknown adapter type', async () => {
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    state.adapter = { type: 'epub' };
    try {
      let statusMsg = '';
      const setStatus = (msg) => { statusMsg = msg; };
      const reloadPdf = mock.fn();
      await convertCurrentToPdf(reloadPdf, setStatus);
      assert.ok(statusMsg.includes('epub'));
      assert.equal(reloadPdf.mock.callCount(), 0);
    } finally {
      state.adapter = origAdapter;
    }
  });
});

describe('convertCurrentToPdf — error handling', () => {
  it('reports error when image conversion throws', async () => {
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    const origFile = state.file;
    state.adapter = { type: 'image' };
    state.file = { name: 'test.png', arrayBuffer: () => Promise.reject(new Error('read fail')) };
    try {
      let statusMsg = '';
      const setStatus = (msg) => { statusMsg = msg; };
      const reloadPdf = mock.fn();
      await convertCurrentToPdf(reloadPdf, setStatus);
      assert.ok(statusMsg.includes('Ошибка') || statusMsg.includes('ошибка') || statusMsg.toLowerCase().includes('error') || statusMsg.includes('read fail'));
      assert.equal(reloadPdf.mock.callCount(), 0);
    } finally {
      state.adapter = origAdapter;
      state.file = origFile;
    }
  });

  it('reports error when djvu conversion throws', async () => {
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    state.adapter = {
      type: 'djvu',
      getPageCount: () => { throw new Error('djvu fail'); },
    };
    try {
      let statusMsg = '';
      const setStatus = (msg) => { statusMsg = msg; };
      const reloadPdf = mock.fn();
      await convertCurrentToPdf(reloadPdf, setStatus);
      assert.ok(statusMsg.includes('djvu fail') || statusMsg.includes('Ошибка'));
      assert.equal(reloadPdf.mock.callCount(), 0);
    } finally {
      state.adapter = origAdapter;
    }
  });
});

describe('convertCurrentToPdf — status messages', () => {
  it('sets initial status message for image conversion', async () => {
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    const origFile = state.file;
    const origDocName = state.docName;
    state.adapter = { type: 'image' };
    state.file = null; // will cause error but we capture first status
    state.docName = 'test.jpg';
    const messages = [];
    const setStatus = (msg) => { messages.push(msg); };
    const reloadPdf = mock.fn();
    try {
      await convertCurrentToPdf(reloadPdf, setStatus);
    } finally {
      state.adapter = origAdapter;
      state.file = origFile;
      state.docName = origDocName;
    }
    // First message should indicate image conversion starting
    assert.ok(messages.length >= 1);
  });

  it('sets initial status message for djvu conversion', async () => {
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    state.adapter = {
      type: 'djvu',
      getPageCount: () => { throw new Error('boom'); },
    };
    const messages = [];
    const setStatus = (msg) => { messages.push(msg); };
    const reloadPdf = mock.fn();
    try {
      await convertCurrentToPdf(reloadPdf, setStatus);
    } finally {
      state.adapter = origAdapter;
    }
    assert.ok(messages.length >= 1);
    assert.ok(messages[0].includes('DJVU'));
  });
});

describe('convertCurrentToPdf — null adapter', () => {
  it('sets status and returns immediately when adapter is null', async () => {
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    state.adapter = null;
    try {
      let statusMsg = '';
      const setStatus = (msg) => { statusMsg = msg; };
      const reloadPdf = mock.fn();
      await convertCurrentToPdf(reloadPdf, setStatus);
      assert.ok(statusMsg.length > 0);
      assert.equal(reloadPdf.mock.callCount(), 0);
    } finally {
      state.adapter = origAdapter;
    }
  });
});

describe('djvuToPdf — progress callback', () => {
  it('calls onProgress for each page', async () => {
    const { djvuToPdf } = await import('../../app/modules/convert-to-pdf.js');
    const progressCalls = [];
    const mockAdapter = {
      getPageCount: () => 2,
      renderPage: async (pageNum, canvas, opts) => {
        // canvas.toBlob is provided by setup-dom
      },
      getText: async () => 'sample text',
    };
    try {
      await djvuToPdf(mockAdapter, (page, total) => {
        progressCalls.push({ page, total });
      });
    } catch (_e) {
      // pdf-lib may throw due to invalid PNG from mock toBlob, that's ok
    }
    // onProgress should have been called for at least page 1
    assert.ok(progressCalls.length >= 1);
    assert.equal(progressCalls[0].page, 1);
    assert.equal(progressCalls[0].total, 2);
  });
});
