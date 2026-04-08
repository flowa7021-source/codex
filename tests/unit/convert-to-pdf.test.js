import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// We need to mock state and PDFDocument before importing
// Since convert-to-pdf imports pdf-lib and state, we test what we can

import { convertCurrentToPdf, imagesToPdf, djvuToPdf } from '../../app/modules/convert-to-pdf.js';

// ── Shared minimal image bytes ────────────────────────────────────────────────
// Valid 1×1 white PNG in base64
const PNG_1X1_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
const PNG_1X1 = Uint8Array.from(atob(PNG_1X1_B64), c => c.charCodeAt(0));

// Valid small JPEG (14×64 px thumbnail)
const JPG_SMALL_B64 = '/9j/4AAQSkZJRgABAQIAIwAjAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAAECABAAA4DARIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAABf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
const JPG_SMALL = Uint8Array.from(atob(JPG_SMALL_B64), c => c.charCodeAt(0));

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
    const progressCalls = [];
    const mockAdapter = {
      getPageCount: () => 2,
      renderPage: async (_pageNum, _canvas, _opts) => {
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

// ── imagesToPdf — PNG and JPG paths ──────────────────────────────────────────

describe('imagesToPdf — PNG conversion', () => {
  it('converts a PNG file to PDF bytes', async () => {
    const file = new File([PNG_1X1], 'test.png', { type: 'image/png' });
    const result = await imagesToPdf([file]);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 100, 'should produce non-trivial PDF');
    // Starts with %PDF
    assert.equal(result[0], 0x25); // %
    assert.equal(result[1], 0x50); // P
  });

  it('converts multiple PNG files to multi-page PDF', async () => {
    const files = [
      new File([PNG_1X1], 'page1.png', { type: 'image/png' }),
      new File([PNG_1X1], 'page2.png', { type: 'image/png' }),
    ];
    const result = await imagesToPdf(files);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 200);
  });
});

describe('imagesToPdf — JPEG conversion', () => {
  it('converts a JPG file to PDF bytes', async () => {
    const file = new File([JPG_SMALL], 'photo.jpg', { type: 'image/jpeg' });
    const result = await imagesToPdf([file]);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 100);
  });

  it('converts a JPEG file (.jpeg extension) to PDF bytes', async () => {
    const file = new File([JPG_SMALL], 'photo.jpeg', { type: 'image/jpeg' });
    const result = await imagesToPdf([file]);
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 100);
  });
});

describe('imagesToPdf — canvas fallback path (non-PNG/JPG)', () => {
  it('falls through to canvas path for BMP/WebP, failing gracefully on error', async () => {
    // The Image mock in setup-dom fires onerror, so the canvas path will reject
    const file = new File([new Uint8Array([0, 1, 2, 3])], 'image.bmp', { type: 'image/bmp' });
    await assert.rejects(() => imagesToPdf([file]));
  });

  it('succeeds via canvas path when Image mock fires onload', async () => {
    const origImage = globalThis.Image;
    // Override Image to fire onload with fake dimensions
    globalThis.Image = class MockImage {
      constructor() { this.naturalWidth = 10; this.naturalHeight = 10; this.onload = null; this.onerror = null; }
      set src(_v) {
        queueMicrotask(() => { if (this.onload) this.onload(); });
      }
    };

    // Override canvas.toBlob to return valid PNG bytes
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = origCreateElement(tag);
      if (tag === 'canvas') {
        el.toBlob = (cb, _type) => cb(new Blob([PNG_1X1], { type: 'image/png' }));
      }
      return el;
    };

    try {
      const file = new File([new Uint8Array([0, 1, 2, 3])], 'image.webp', { type: 'image/webp' });
      const result = await imagesToPdf([file]);
      assert.ok(result instanceof Uint8Array);
      assert.ok(result.length > 100);
    } finally {
      globalThis.Image = origImage;
      document.createElement = origCreateElement;
    }
  });
});

// ── djvuToPdf — full success path ────────────────────────────────────────────

describe('djvuToPdf — full conversion with text layer', () => {
  it('converts djvu with valid canvas JPEG and text to PDF bytes', async () => {
    // Override canvas.toBlob to return valid JPEG bytes
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = origCreateElement(tag);
      if (tag === 'canvas') {
        el.toBlob = (cb, type) => cb(new Blob([JPG_SMALL], { type: type || 'image/jpeg' }));
      }
      return el;
    };

    const progressCalls = [];
    const mockAdapter = {
      getPageCount: () => 2,
      renderPage: async (_pageNum, canvas) => {
        canvas.width = 14;
        canvas.height = 64;
      },
      getText: async (_page) => 'page text content',
    };

    try {
      const result = await djvuToPdf(mockAdapter, (page, total) => progressCalls.push({ page, total }));
      assert.ok(result instanceof Uint8Array);
      assert.ok(result.length > 500);
      assert.equal(progressCalls.length, 2);
      assert.equal(progressCalls[0].page, 1);
      assert.equal(progressCalls[1].page, 2);
    } finally {
      document.createElement = origCreateElement;
    }
  });

  it('handles getText throwing without failing conversion', async () => {
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = origCreateElement(tag);
      if (tag === 'canvas') {
        el.toBlob = (cb, type) => cb(new Blob([JPG_SMALL], { type: type || 'image/jpeg' }));
      }
      return el;
    };

    const mockAdapter = {
      getPageCount: () => 1,
      renderPage: async (_pageNum, canvas) => { canvas.width = 14; canvas.height = 64; },
      getText: async () => { throw new Error('text unavailable'); },
    };

    try {
      const result = await djvuToPdf(mockAdapter);
      assert.ok(result instanceof Uint8Array);
    } finally {
      document.createElement = origCreateElement;
    }
  });

  it('handles getText returning null without failing', async () => {
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = origCreateElement(tag);
      if (tag === 'canvas') {
        el.toBlob = (cb, type) => cb(new Blob([JPG_SMALL], { type: type || 'image/jpeg' }));
      }
      return el;
    };

    const mockAdapter = {
      getPageCount: () => 1,
      renderPage: async (_pageNum, canvas) => { canvas.width = 14; canvas.height = 64; },
      getText: async () => null,
    };

    try {
      const result = await djvuToPdf(mockAdapter);
      assert.ok(result instanceof Uint8Array);
    } finally {
      document.createElement = origCreateElement;
    }
  });
});

// ── convertCurrentToPdf — image success path ─────────────────────────────────

describe('convertCurrentToPdf — image type success', () => {
  it('converts image type and calls reloadPdfFromBytes', async () => {
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    const origFile = state.file;
    const origDocName = state.docName;

    state.adapter = { type: 'image' };
    state.file = new File([PNG_1X1], 'photo.png', { type: 'image/png' });
    state.docName = 'photo.png';

    const reloadCalls = [];
    const reloadPdf = async (bytes) => reloadCalls.push(bytes);
    const messages = [];
    const setStatus = (msg) => messages.push(msg);

    try {
      await convertCurrentToPdf(reloadPdf, setStatus);
      assert.ok(reloadCalls.length === 1, 'should call reloadPdfFromBytes once');
      assert.ok(reloadCalls[0] instanceof Uint8Array);
      assert.ok(messages.some(m => m.toLowerCase().includes('pdf') || m.toLowerCase().includes('конверта') || m.toLowerCase().includes('конверт')));
    } finally {
      state.adapter = origAdapter;
      state.file = origFile;
      state.docName = origDocName;
    }
  });
});

// ── convertCurrentToPdf — djvu success path ──────────────────────────────────

describe('convertCurrentToPdf — djvu type success', () => {
  it('converts djvu type and calls reloadPdfFromBytes', async () => {
    const { state } = await import('../../app/modules/state.js');
    const origAdapter = state.adapter;
    const origDocName = state.docName;

    // Override canvas.toBlob to provide valid JPEG
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = origCreateElement(tag);
      if (tag === 'canvas') {
        el.toBlob = (cb, type) => cb(new Blob([JPG_SMALL], { type: type || 'image/jpeg' }));
      }
      return el;
    };

    state.adapter = {
      type: 'djvu',
      getPageCount: () => 1,
      renderPage: async (_pageNum, canvas) => { canvas.width = 14; canvas.height = 64; },
      getText: async () => 'text',
    };
    state.docName = 'document.djvu';

    const reloadCalls = [];
    const reloadPdf = async (bytes) => reloadCalls.push(bytes);
    const messages = [];
    const setStatus = (msg) => messages.push(msg);

    try {
      await convertCurrentToPdf(reloadPdf, setStatus);
      assert.ok(reloadCalls.length === 1, 'should call reloadPdfFromBytes');
      assert.ok(reloadCalls[0] instanceof Uint8Array);
    } finally {
      state.adapter = origAdapter;
      state.docName = origDocName;
      document.createElement = origCreateElement;
    }
  });
});
