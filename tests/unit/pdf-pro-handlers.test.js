import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { initPdfProHandlersDeps, initPdfProHandlers } from '../../app/modules/pdf-pro-handlers.js';
import { state } from '../../app/modules/state.js';

// Helper: capture the event handler registered for a given element ID and event type
function captureHandler(elementId, eventType = 'click') {
  let handler = null;
  const el = {
    addEventListener: (type, fn) => {
      if (type === eventType) handler = fn;
    },
  };
  const origGetById = document.getElementById.bind(document);
  document.getElementById = (id) => (id === elementId ? el : origGetById(id));
  try {
    initPdfProHandlers();
  } finally {
    document.getElementById = origGetById;
  }
  return handler;
}

// Helper: create a minimal mock File
function makeMockFile(name = 'test.pdf') {
  const buf = new ArrayBuffer(8);
  return { name, arrayBuffer: async () => buf };
}

// Helper: create a minimal mock Blob
function makeMockBlob() {
  return {
    arrayBuffer: async () => new ArrayBuffer(8),
    type: 'application/pdf',
  };
}

// ─── initPdfProHandlersDeps ───────────────────────────────────────────────────

describe('initPdfProHandlersDeps', () => {
  it('does not throw when called with empty object', () => {
    assert.doesNotThrow(() => initPdfProHandlersDeps({}));
  });

  it('accepts partial dependency overrides', () => {
    assert.doesNotThrow(() =>
      initPdfProHandlersDeps({ setOcrStatus: () => {}, nrPrompt: async () => null })
    );
  });

  it('can override all known deps without error', () => {
    assert.doesNotThrow(() =>
      initPdfProHandlersDeps({
        setOcrStatus: () => {},
        nrPrompt: async () => null,
        nrConfirm: async () => false,
        safeCreateObjectURL: () => 'blob:url',
        pushDiagnosticEvent: () => {},
        ensurePdfJs: async () => {},
        toastSuccess: () => {},
        toastInfo: () => {},
        pdfOptimizer: null,
        flattenPdf: async () => {},
        checkAccessibility: async () => {},
        autoFixAccessibility: async () => {},
        pdfCompare: null,
        addHeaderFooter: async () => {},
        addBatesNumbering: async () => {},
        rotatePdfPages: async () => {},
        splitPdfDocument: async () => {},
        mergePdfDocuments: async () => {},
        parsePageRangeLib: () => [],
        reloadPdfFromBytes: async () => {},
      })
    );
  });
});

// ─── initPdfProHandlers (handler registration) ───────────────────────────────

describe('initPdfProHandlers', () => {
  it('does not throw when all DOM elements are missing', () => {
    const origGetById = document.getElementById.bind(document);
    document.getElementById = () => null;
    try {
      assert.doesNotThrow(() => initPdfProHandlers());
    } finally {
      document.getElementById = origGetById;
    }
  });

  const clickIds = [
    'pdfRedact', 'pdfOptimize', 'pdfFlatten', 'pdfAccessibility',
    'pdfCompare', 'pdfHeaderFooter', 'pdfBatesNumber',
    'orgRotateCW', 'orgRotateCCW', 'orgDelete', 'orgExtract',
  ];

  for (const id of clickIds) {
    it(`registers click handler on #${id}`, () => {
      const handler = captureHandler(id, 'click');
      assert.equal(typeof handler, 'function');
    });
  }

  it('registers change handler on #orgInsertPages', () => {
    const handler = captureHandler('orgInsertPages', 'change');
    assert.equal(typeof handler, 'function');
  });
});

// ─── requirePdfFile — called implicitly via handlers ─────────────────────────

describe('requirePdfFile (via handlers)', () => {
  it('sets error status when file is null', async () => {
    const origFile = state.file;
    const origAdapter = state.adapter;
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    const handler = captureHandler('pdfOptimize');
    await handler();

    state.file = origFile;
    state.adapter = origAdapter;

    assert.ok(statusCalls.length > 0);
  });

  it('sets error status when adapter type is not pdf', async () => {
    const origFile = state.file;
    const origAdapter = state.adapter;
    state.file = makeMockFile();
    state.adapter = { type: 'epub' };

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    const handler = captureHandler('pdfFlatten');
    await handler();

    state.file = origFile;
    state.adapter = origAdapter;

    assert.ok(statusCalls.length > 0);
  });
});

// ─── pdfOptimize handler ──────────────────────────────────────────────────────

describe('pdfOptimize handler', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('calls optimize and reloads PDF when file is set', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    const reloadCalls = [];
    const diagCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      pdfOptimizer: {
        optimize: async () => ({
          blob: mockBlob,
          summary: '10% saved',
          original: 1000,
          optimized: 900,
          savingsPercent: 10,
        }),
      },
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
      pushDiagnosticEvent: (ev, d) => diagCalls.push({ ev, d }),
    });

    const handler = captureHandler('pdfOptimize');
    await handler();

    assert.ok(reloadCalls.length === 1);
    assert.ok(diagCalls.some((d) => d.ev === 'pdf.optimize'));
  });

  it('sets error status when optimizer throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      pdfOptimizer: { optimize: async () => { throw new Error('optimize failed'); } },
    });

    await captureHandler('pdfOptimize')();

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── pdfFlatten handler ───────────────────────────────────────────────────────

describe('pdfFlatten handler', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('calls flattenPdf and reloads when file is set', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const reloadCalls = [];
    const diagCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      flattenPdf: async () => ({ blob: mockBlob, formsFlattened: 3, annotationsFlattened: 2 }),
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
      pushDiagnosticEvent: (ev, d) => diagCalls.push({ ev, d }),
    });

    await captureHandler('pdfFlatten')();

    assert.ok(reloadCalls.length > 0);
    assert.ok(diagCalls.some((d) => d.ev === 'pdf.flatten'));
  });

  it('sets error status when flattenPdf throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      flattenPdf: async () => { throw new Error('flatten error'); },
    });

    await captureHandler('pdfFlatten')();

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── pdfAccessibility handler ─────────────────────────────────────────────────

describe('pdfAccessibility handler', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('pdfAccessibility')();

    assert.ok(statusCalls.length > 0);
  });

  it('shows status when no auto-fixable issues', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.docName = 'test.pdf';

    const statusCalls = [];
    const diagCalls = [];

    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      toastInfo: () => {},
      checkAccessibility: async () => ({
        score: 85,
        level: 'AA',
        summary: { errors: 0, warnings: 2 },
        issues: [
          { severity: 'warning', rule: 'alt-text', message: 'Missing alt', fix: 'Add alt', autoFixable: false },
        ],
      }),
      pushDiagnosticEvent: (ev, d) => diagCalls.push({ ev, d }),
      nrConfirm: async () => false,
    });

    await captureHandler('pdfAccessibility')();

    assert.ok(statusCalls.some((m) => m.includes('85')));
    assert.ok(diagCalls.some((d) => d.ev === 'pdf.accessibility'));
  });

  it('auto-fixes issues when nrConfirm returns true', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.docName = 'test.pdf';

    const reloadCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      toastInfo: () => {},
      checkAccessibility: async () => ({
        score: 60,
        level: 'A',
        summary: { errors: 2, warnings: 1 },
        issues: [{ severity: 'error', rule: 'title', message: 'No title', fix: 'Add title', autoFixable: true }],
      }),
      autoFixAccessibility: async () => ({ blob: mockBlob, fixCount: 1 }),
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
      nrConfirm: async () => true,
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfAccessibility')();

    assert.ok(reloadCalls.length > 0);
  });

  it('skips auto-fix when nrConfirm returns false for fixable issues', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const reloadCalls = [];

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      toastInfo: () => {},
      checkAccessibility: async () => ({
        score: 70,
        level: 'A',
        summary: { errors: 1, warnings: 0 },
        issues: [{ severity: 'error', rule: 'title', message: 'No title', fix: 'Add title', autoFixable: true }],
      }),
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
      nrConfirm: async () => false,
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfAccessibility')();

    assert.equal(reloadCalls.length, 0);
  });

  it('sets error status when checkAccessibility throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      checkAccessibility: async () => { throw new Error('access error'); },
    });

    await captureHandler('pdfAccessibility')();

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── pdfHeaderFooter handler ──────────────────────────────────────────────────

describe('pdfHeaderFooter handler', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('returns early when nrPrompt returns null for format', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => null,
    });

    await captureHandler('pdfHeaderFooter')();

    assert.ok(!statusCalls.some((m) => m.includes('Добавление')));
  });

  it('returns early when nrPrompt returns null for position', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    let callCount = 0;
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => { callCount++; return callCount === 1 ? '{{page}}' : null; },
    });

    await captureHandler('pdfHeaderFooter')();

    assert.ok(!statusCalls.some((m) => m.includes('Добавление')));
  });

  it('adds header when position is top', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const reloadCalls = [];
    const diagCalls = [];
    const mockBlob = makeMockBlob();
    let promptCount = 0;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? '{{page}} / {{total}}' : 'top'; },
      addHeaderFooter: async () => mockBlob,
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
      pushDiagnosticEvent: (ev) => diagCalls.push(ev),
    });

    await captureHandler('pdfHeaderFooter')();

    assert.ok(reloadCalls.length > 0);
    assert.ok(diagCalls.includes('pdf.headerFooter'));
  });

  it('adds footer when position is bottom', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const reloadCalls = [];
    const mockBlob = makeMockBlob();
    let promptCount = 0;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? '{{page}}' : 'bottom'; },
      addHeaderFooter: async () => mockBlob,
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfHeaderFooter')();

    assert.ok(reloadCalls.length > 0);
  });

  it('sets error status when addHeaderFooter throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    let promptCount = 0;
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? '{{page}}' : 'bottom'; },
      addHeaderFooter: async () => { throw new Error('header error'); },
    });

    await captureHandler('pdfHeaderFooter')();

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── pdfBatesNumber handler ───────────────────────────────────────────────────

describe('pdfBatesNumber handler', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('returns early when prefix prompt returns null', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => null,
    });

    await captureHandler('pdfBatesNumber')();

    assert.ok(!statusCalls.some((m) => m.includes('Добавление нумерации')));
  });

  it('returns early when startNum prompt returns falsy', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    let promptCount = 0;
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? 'DOC-' : ''; },
    });

    await captureHandler('pdfBatesNumber')();

    assert.ok(!statusCalls.some((m) => m.includes('Добавление нумерации')));
  });

  it('adds Bates numbering successfully', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const reloadCalls = [];
    const diagCalls = [];
    const mockBlob = makeMockBlob();
    let promptCount = 0;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? 'DOC-' : '1'; },
      addBatesNumbering: async () => ({ blob: mockBlob, startNum: 1, endNum: 10, totalPages: 10 }),
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
      pushDiagnosticEvent: (ev, d) => diagCalls.push({ ev, d }),
    });

    await captureHandler('pdfBatesNumber')();

    assert.ok(reloadCalls.length > 0);
    assert.ok(diagCalls.some((d) => d.ev === 'pdf.bates'));
  });

  it('sets error status when addBatesNumbering throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    let promptCount = 0;
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? 'DOC-' : '1'; },
      addBatesNumbering: async () => { throw new Error('bates error'); },
    });

    await captureHandler('pdfBatesNumber')();

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── orgRotateCW handler ──────────────────────────────────────────────────────

describe('orgRotateCW handler', () => {
  let origFile, origAdapter, origCurrentPage;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
    origCurrentPage = state.currentPage;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
    state.currentPage = origCurrentPage;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('orgRotateCW')();

    assert.ok(statusCalls.length > 0);
  });

  it('rotates page 90 degrees clockwise', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.currentPage = 1;

    const rotateCalls = [];
    const reloadCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      rotatePdfPages: async (buf, pages, angle) => { rotateCalls.push({ pages, angle }); return mockBlob; },
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
    });

    await captureHandler('orgRotateCW')();

    assert.ok(rotateCalls.some((r) => r.angle === 90));
    assert.ok(reloadCalls.length > 0);
  });

  it('does not reload when rotatePdfPages returns null', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.currentPage = 1;

    const reloadCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      rotatePdfPages: async () => null,
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
    });

    await captureHandler('orgRotateCW')();

    assert.equal(reloadCalls.length, 0);
  });

  it('sets error status when rotatePdfPages throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      rotatePdfPages: async () => { throw new Error('rotate error'); },
    });

    await captureHandler('orgRotateCW')();

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── orgRotateCCW handler ─────────────────────────────────────────────────────

describe('orgRotateCCW handler', () => {
  let origFile, origAdapter, origCurrentPage;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
    origCurrentPage = state.currentPage;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
    state.currentPage = origCurrentPage;
  });

  it('rotates page -90 degrees counter-clockwise', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.currentPage = 2;

    const rotateCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      rotatePdfPages: async (buf, pages, angle) => { rotateCalls.push({ pages, angle }); return mockBlob; },
      reloadPdfFromBytes: async () => {},
    });

    await captureHandler('orgRotateCCW')();

    assert.ok(rotateCalls.some((r) => r.angle === -90));
  });

  it('sets error status when rotatePdfPages throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      rotatePdfPages: async () => { throw new Error('ccw error'); },
    });

    await captureHandler('orgRotateCCW')();

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── orgDelete handler ────────────────────────────────────────────────────────

describe('orgDelete handler', () => {
  let origFile, origAdapter, origPageCount, origCurrentPage;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
    origPageCount = state.pageCount;
    origCurrentPage = state.currentPage;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
    state.pageCount = origPageCount;
    state.currentPage = origCurrentPage;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('orgDelete')();
  });

  it('shows error when only one page exists', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.pageCount = 1;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('orgDelete')();

    assert.ok(statusCalls.some((m) => m.includes('единственную')));
  });

  it('does nothing when nrConfirm returns false', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.pageCount = 3;
    state.currentPage = 2;

    const reloadCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrConfirm: async () => false,
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
    });

    await captureHandler('orgDelete')();

    assert.equal(reloadCalls.length, 0);
  });

  it('deletes the current page when confirmed (3 pages, delete page 2)', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.pageCount = 3;
    state.currentPage = 2;

    const reloadCalls = [];
    const splitCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrConfirm: async () => true,
      splitPdfDocument: async (buf, pages) => { splitCalls.push(pages); return mockBlob; },
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
    });

    await captureHandler('orgDelete')();

    assert.ok(splitCalls.length > 0);
    assert.deepEqual(splitCalls[0], [1, 3]);
    assert.ok(reloadCalls.length > 0);
  });

  it('does not reload when splitPdfDocument returns null', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.pageCount = 2;
    state.currentPage = 1;

    const reloadCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrConfirm: async () => true,
      splitPdfDocument: async () => null,
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
    });

    await captureHandler('orgDelete')();

    assert.equal(reloadCalls.length, 0);
  });

  it('sets error status when splitPdfDocument throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.pageCount = 3;
    state.currentPage = 1;

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrConfirm: async () => true,
      splitPdfDocument: async () => { throw new Error('split error'); },
    });

    await captureHandler('orgDelete')();

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── orgExtract handler ───────────────────────────────────────────────────────

describe('orgExtract handler', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('orgExtract')();
  });

  it('returns early when nrPrompt returns null', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => null,
    });

    await captureHandler('orgExtract')();
  });

  it('shows error when parsePageRangeLib returns empty array', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => 'invalid-range',
      parsePageRangeLib: () => [],
    });

    await captureHandler('orgExtract')();

    assert.ok(statusCalls.some((m) => m.includes('Неверный')));
  });

  it('extracts pages and triggers download', async () => {
    state.file = makeMockFile('doc.pdf');
    state.adapter = { type: 'pdf' };
    state.docName = 'doc';

    const statusCalls = [];
    const mockBlob = makeMockBlob();
    let anchorClicked = false;

    const origCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      if (tag === 'a') {
        return { href: '', download: '', click: () => { anchorClicked = true; } };
      }
      return origCreateElement(tag);
    };

    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => '1-2',
      parsePageRangeLib: () => [1, 2],
      splitPdfDocument: async () => mockBlob,
      safeCreateObjectURL: () => 'blob:url',
    });

    await captureHandler('orgExtract')();

    document.createElement = origCreateElement;

    assert.ok(anchorClicked);
    assert.ok(statusCalls.some((m) => m.includes('Извлечено')));
  });

  it('does not download when splitPdfDocument returns null', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => '1',
      parsePageRangeLib: () => [1],
      splitPdfDocument: async () => null,
    });

    await captureHandler('orgExtract')();

    assert.ok(!statusCalls.some((m) => m.includes('Извлечено')));
  });

  it('sets error status when splitPdfDocument throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      nrPrompt: async () => '1',
      parsePageRangeLib: () => [1],
      splitPdfDocument: async () => { throw new Error('extract error'); },
    });

    await captureHandler('orgExtract')();

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── orgInsertPages handler ───────────────────────────────────────────────────

describe('orgInsertPages handler', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    initPdfProHandlersDeps({ setOcrStatus: () => {} });

    const handler = captureHandler('orgInsertPages', 'change');
    await handler({ target: { files: [makeMockFile('insert.pdf')], value: '' } });
  });

  it('returns early when no files in event', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const reloadCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
    });

    const handler = captureHandler('orgInsertPages', 'change');
    await handler({ target: { files: [], value: '' } });

    assert.equal(reloadCalls.length, 0);
  });

  it('merges PDFs when insert file is provided', async () => {
    state.file = makeMockFile('main.pdf');
    state.adapter = { type: 'pdf' };

    const reloadCalls = [];
    const mergeCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      mergePdfDocuments: async (files) => { mergeCalls.push(files); return mockBlob; },
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
    });

    const handler = captureHandler('orgInsertPages', 'change');
    await handler({ target: { files: [makeMockFile('insert.pdf')], value: '' } });

    assert.ok(mergeCalls.length > 0);
    assert.ok(reloadCalls.length > 0);
  });

  it('does not reload when mergePdfDocuments returns null', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const reloadCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      mergePdfDocuments: async () => null,
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
    });

    const handler = captureHandler('orgInsertPages', 'change');
    await handler({ target: { files: [makeMockFile('insert.pdf')], value: '' } });

    assert.equal(reloadCalls.length, 0);
  });

  it('sets error status when mergePdfDocuments throws', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    const statusCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      mergePdfDocuments: async () => { throw new Error('merge error'); },
    });

    const handler = captureHandler('orgInsertPages', 'change');
    await handler({ target: { files: [makeMockFile('insert.pdf')], value: '' } });

    assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
  });
});

// ─── pdfCompare handler ───────────────────────────────────────────────────────

describe('pdfCompare handler', () => {
  let origAdapter;

  beforeEach(() => {
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.adapter = origAdapter;
  });

  it('sets error status when adapter type is not pdf', async () => {
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('pdfCompare')();

    assert.ok(statusCalls.some((m) => m.includes('Откройте PDF')));
  });

  it('creates a file input element and triggers click when adapter is pdf', async () => {
    state.adapter = { type: 'pdf', pdfDoc: { numPages: 2 } };

    let inputCreated = null;
    let inputClicked = false;
    const origCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      if (tag === 'input') {
        const el = origCreateElement('input');
        inputCreated = el;
        el.click = () => { inputClicked = true; };
        return el;
      }
      return origCreateElement(tag);
    };

    initPdfProHandlersDeps({ setOcrStatus: () => {} });

    await captureHandler('pdfCompare')();

    document.createElement = origCreateElement;

    assert.ok(inputClicked);
    assert.equal(inputCreated?.type, 'file');
    assert.equal(inputCreated?.accept, '.pdf');
  });

  it('sets error status when file processing throws in onchange', async () => {
    state.adapter = { type: 'pdf', pdfDoc: { numPages: 2 } };

    const statusCalls = [];
    let capturedOnchange = null;
    const origCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      if (tag === 'input') {
        const el = origCreateElement('input');
        el.click = () => {};
        Object.defineProperty(el, 'onchange', {
          set(fn) { capturedOnchange = fn; },
          get() { return capturedOnchange; },
        });
        return el;
      }
      return origCreateElement(tag);
    };

    initPdfProHandlersDeps({
      setOcrStatus: (m) => statusCalls.push(m),
      ensurePdfJs: async () => { throw new Error('pdfjs error'); },
    });

    await captureHandler('pdfCompare')();

    document.createElement = origCreateElement;

    // Simulate onchange with a file
    if (capturedOnchange) {
      const mockFile2 = makeMockFile('compare.pdf');
      await capturedOnchange({ target: { files: [mockFile2] } });
      assert.ok(statusCalls.some((m) => m.includes('Ошибка')));
    }
  });
});

// ─── pdfRedact handler ────────────────────────────────────────────────────────

describe('pdfRedact handler', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('pdfRedact')();

    assert.ok(statusCalls.length > 0);
  });

  it('appends a modal and resolves when close button is clicked', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.pageCount = 0;

    // The pdfRedact handler builds a modal div using innerHTML (which doesn't create
    // real child nodes in the mock DOM), then calls querySelector/querySelectorAll on it.
    // We patch createElement('div') so that the created modal div has stubbed
    // querySelector/querySelectorAll that return stubs. The close button stub fires its
    // click listener immediately when addEventListener is called, resolving the Promise.
    const origCreateElement = document.createElement.bind(document);
    let divCount = 0;
    document.createElement = (tag) => {
      const el = origCreateElement(tag);
      if (tag === 'div') {
        divCount++;
        // Only patch the modal div (first one created in the handler)
        let closeClickFn = null;
        el.querySelectorAll = (sel) => {
          // Return one stub pattern button so the forEach fires (but does nothing harmful)
          if (sel.includes('data-pat')) {
            const stubBtn = origCreateElement('button');
            stubBtn.dataset = { pat: 'email' };
            stubBtn.addEventListener = () => {};
            return [stubBtn];
          }
          return [];
        };
        el.querySelector = (sel) => {
          const stub = origCreateElement('button');
          stub.value = '';
          stub.addEventListener = (type, fn) => {
            // Immediately invoke click listeners (resolves the Promise with null)
            if (type === 'click' && sel === '#_redCloseModal') {
              closeClickFn = fn;
            }
          };
          return stub;
        };
        el.addEventListener = (type, fn) => {
          // backdrop click - ignore
        };
        // Override remove to be a no-op
        el.remove = () => {};
        // After element is fully set up and appended, fire the close button
        const origInnerHTMLSetter = Object.getOwnPropertyDescriptor(el, 'innerHTML')?.set;
        // We'll fire closeClickFn after querySelectorAll/querySelector calls are done
        // Use a microtask delay via Promise
        const origRemove = el.remove;
        Object.defineProperty(el, 'innerHTML', {
          set(val) {
            // After innerHTML is set, querySelectorAll/querySelector will be called
            // We schedule the close button click for after all setup
            Promise.resolve().then(() => {
              if (closeClickFn) closeClickFn();
            });
          },
          get() { return ''; },
        });
      }
      return el;
    };

    const origAppend = document.body.appendChild.bind(document.body);
    document.body.appendChild = (el) => origAppend(el);

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrConfirm: async () => false,
    });

    const handler = captureHandler('pdfRedact');
    await handler(); // should complete because close resolves null → early return

    document.createElement = origCreateElement;
    document.body.appendChild = origAppend;
  });
});

// ─── orgRotateCCW handler — additional coverage ────────────────────────────────

describe('orgRotateCCW handler — additional', () => {
  let origFile, origAdapter, origCurrentPage;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
    origCurrentPage = state.currentPage;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
    state.currentPage = origCurrentPage;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('orgRotateCCW')();

    assert.ok(statusCalls.length > 0);
  });

  it('does not reload when rotatePdfPages returns null', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.currentPage = 1;

    const reloadCalls = [];
    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      rotatePdfPages: async () => null,
      reloadPdfFromBytes: async (b) => reloadCalls.push(b),
    });

    await captureHandler('orgRotateCCW')();

    assert.equal(reloadCalls.length, 0);
  });
});

// ─── orgDelete handler — additional coverage ───────────────────────────────────

describe('orgDelete handler — additional', () => {
  let origFile, origAdapter, origPageCount, origCurrentPage;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
    origPageCount = state.pageCount;
    origCurrentPage = state.currentPage;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
    state.pageCount = origPageCount;
    state.currentPage = origCurrentPage;
  });

  it('deletes first page from 3-page doc (pages 2,3 remain)', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.pageCount = 3;
    state.currentPage = 1;

    const splitCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrConfirm: async () => true,
      splitPdfDocument: async (buf, pages) => { splitCalls.push(pages); return mockBlob; },
      reloadPdfFromBytes: async () => {},
    });

    await captureHandler('orgDelete')();

    assert.deepEqual(splitCalls[0], [2, 3]);
  });

  it('deletes last page from 3-page doc (pages 1,2 remain)', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.pageCount = 3;
    state.currentPage = 3;

    const splitCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrConfirm: async () => true,
      splitPdfDocument: async (buf, pages) => { splitCalls.push(pages); return mockBlob; },
      reloadPdfFromBytes: async () => {},
    });

    await captureHandler('orgDelete')();

    assert.deepEqual(splitCalls[0], [1, 2]);
  });
});

// ─── pdfOptimize handler — additional coverage ─────────────────────────────────

describe('pdfOptimize handler — additional', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('pdfOptimize')();

    assert.ok(statusCalls.length > 0);
  });

  it('passes arrayBuffer to optimizer', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    let receivedBuffer = null;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      pdfOptimizer: {
        optimize: async (buf) => {
          receivedBuffer = buf;
          return { blob: makeMockBlob(), summary: 'ok', original: 100, optimized: 90, savingsPercent: 10 };
        },
      },
      reloadPdfFromBytes: async () => {},
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfOptimize')();

    assert.ok(receivedBuffer instanceof ArrayBuffer);
  });
});

// ─── pdfFlatten handler — additional coverage ──────────────────────────────────

describe('pdfFlatten handler — additional', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('pdfFlatten')();

    assert.ok(statusCalls.length > 0);
  });

  it('passes correct options to flattenPdf', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    let receivedOpts = null;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      flattenPdf: async (buf, opts) => {
        receivedOpts = opts;
        return { blob: makeMockBlob(), formsFlattened: 0, annotationsFlattened: 0 };
      },
      reloadPdfFromBytes: async () => {},
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfFlatten')();

    assert.deepEqual(receivedOpts, { flattenForms: true, flattenAnnotations: true });
  });
});

// ─── orgRotateCW handler — additional coverage ─────────────────────────────────

describe('orgRotateCW handler — additional', () => {
  let origFile, origAdapter, origCurrentPage;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
    origCurrentPage = state.currentPage;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
    state.currentPage = origCurrentPage;
  });

  it('rotates correct page number', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.currentPage = 5;

    const rotateCalls = [];
    const mockBlob = makeMockBlob();

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      rotatePdfPages: async (buf, pages, angle) => { rotateCalls.push({ pages, angle }); return mockBlob; },
      reloadPdfFromBytes: async () => {},
    });

    await captureHandler('orgRotateCW')();

    assert.deepEqual(rotateCalls[0].pages, [5]);
    assert.equal(rotateCalls[0].angle, 90);
  });
});

// ─── pdfBatesNumber handler — additional coverage ──────────────────────────────

describe('pdfBatesNumber handler — additional', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('passes correct options to addBatesNumbering', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    let receivedOpts = null;
    let promptCount = 0;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? 'CASE-' : '10'; },
      addBatesNumbering: async (buf, opts) => {
        receivedOpts = opts;
        return { blob: makeMockBlob(), startNum: 10, endNum: 20, totalPages: 11 };
      },
      reloadPdfFromBytes: async () => {},
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfBatesNumber')();

    assert.equal(receivedOpts.prefix, 'CASE-');
    assert.equal(receivedOpts.startNum, 10);
    assert.equal(receivedOpts.digits, 6);
    assert.equal(receivedOpts.position, 'bottom-right');
  });

  it('defaults startNum to 1 when invalid', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    let receivedOpts = null;
    let promptCount = 0;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? 'DOC-' : 'abc'; },
      addBatesNumbering: async (buf, opts) => {
        receivedOpts = opts;
        return { blob: makeMockBlob(), startNum: 1, endNum: 10, totalPages: 10 };
      },
      reloadPdfFromBytes: async () => {},
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfBatesNumber')();

    assert.equal(receivedOpts.startNum, 1);
  });
});

// ─── pdfAccessibility handler — additional coverage ────────────────────────────

describe('pdfAccessibility handler — additional', () => {
  let origFile, origAdapter, origDocName;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
    origDocName = state.docName;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
    state.docName = origDocName;
  });

  it('passes document title and language to autoFixAccessibility', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.docName = 'my-report.pdf';

    let fixOpts = null;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      toastInfo: () => {},
      checkAccessibility: async () => ({
        score: 40,
        level: 'A',
        summary: { errors: 3, warnings: 0 },
        issues: [{ severity: 'error', rule: 'title', message: 'No title', fix: 'Add', autoFixable: true }],
      }),
      autoFixAccessibility: async (buf, opts) => {
        fixOpts = opts;
        return { blob: makeMockBlob(), fixCount: 1 };
      },
      reloadPdfFromBytes: async () => {},
      nrConfirm: async () => true,
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfAccessibility')();

    assert.equal(fixOpts.title, 'my-report.pdf');
    assert.equal(fixOpts.language, 'ru');
  });
});

// ─── pdfHeaderFooter handler — additional coverage ─────────────────────────────

describe('pdfHeaderFooter handler — additional', () => {
  let origFile, origAdapter;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
  });

  it('returns early when no file is set', async () => {
    state.file = null;
    state.adapter = null;

    const statusCalls = [];
    initPdfProHandlersDeps({ setOcrStatus: (m) => statusCalls.push(m) });

    await captureHandler('pdfHeaderFooter')();

    assert.ok(statusCalls.length > 0);
  });

  it('passes headerCenter when position is top', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    let receivedOpts = null;
    let promptCount = 0;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? '{{title}}' : 'top'; },
      addHeaderFooter: async (buf, opts) => { receivedOpts = opts; return makeMockBlob(); },
      reloadPdfFromBytes: async () => {},
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfHeaderFooter')();

    assert.equal(receivedOpts.headerCenter, '{{title}}');
    assert.equal(receivedOpts.footerCenter, undefined);
  });

  it('passes footerCenter when position is bottom', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };

    let receivedOpts = null;
    let promptCount = 0;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => { promptCount++; return promptCount === 1 ? '{{date}}' : 'bottom'; },
      addHeaderFooter: async (buf, opts) => { receivedOpts = opts; return makeMockBlob(); },
      reloadPdfFromBytes: async () => {},
      pushDiagnosticEvent: () => {},
    });

    await captureHandler('pdfHeaderFooter')();

    assert.equal(receivedOpts.footerCenter, '{{date}}');
    assert.equal(receivedOpts.headerCenter, undefined);
  });
});

// ─── orgExtract handler — additional coverage ──────────────────────────────────

describe('orgExtract handler — additional', () => {
  let origFile, origAdapter, origDocName, origCurrentPage, origPageCount;

  beforeEach(() => {
    origFile = state.file;
    origAdapter = state.adapter;
    origDocName = state.docName;
    origCurrentPage = state.currentPage;
    origPageCount = state.pageCount;
  });

  afterEach(() => {
    state.file = origFile;
    state.adapter = origAdapter;
    state.docName = origDocName;
    state.currentPage = origCurrentPage;
    state.pageCount = origPageCount;
  });

  it('passes correct pages to splitPdfDocument', async () => {
    state.file = makeMockFile();
    state.adapter = { type: 'pdf' };
    state.pageCount = 10;
    state.currentPage = 3;

    let splitPages = null;

    initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => '2,4,6',
      parsePageRangeLib: () => [2, 4, 6],
      splitPdfDocument: async (buf, pages) => { splitPages = pages; return makeMockBlob(); },
      safeCreateObjectURL: () => 'blob:url',
    });

    const origCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      if (tag === 'a') return { href: '', download: '', click: () => {} };
      return origCreateElement(tag);
    };

    await captureHandler('orgExtract')();

    document.createElement = origCreateElement;

    assert.deepEqual(splitPages, [2, 4, 6]);
  });
});
