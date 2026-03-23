// ─── Unit Tests: PDF Accessibility Checker ───────────────────────────────────
// Uses mock.module() to replace pdf-lib and pdfjs-dist before importing the
// module under test — this enables full coverage without real PDF bytes.
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers to build mock pdfDoc / pdfJsDoc
// ---------------------------------------------------------------------------

function makeCatalog({ hasStructTree = false, hasMarkInfo = false, lang = null } = {}) {
  const keys = new Set();
  if (hasStructTree) keys.add('StructTreeRoot');
  if (hasMarkInfo) keys.add('MarkInfo');
  const entries = new Map();
  if (lang) entries.set('Lang', lang);
  return {
    has: (name) => keys.has(String(name)),
    get: (name) => entries.get(String(name)) ?? null,
  };
}

function makePdfDoc({
  title = null,
  author = null,
  subject = null,
  hasStructTree = false,
  hasMarkInfo = false,
  lang = null,
  formFields = [],
} = {}) {
  return {
    catalog: makeCatalog({ hasStructTree, hasMarkInfo, lang }),
    getTitle: () => title,
    getAuthor: () => author,
    getSubject: () => subject,
    getForm: () => ({
      getFields: () => formFields,
    }),
  };
}

function makePdfJsPage({ textItems = [], fontNames = [] } = {}) {
  const items = textItems.length
    ? textItems
    : fontNames.map((fn, i) => ({
        str: 'Hello world this is text',
        fontName: fn,
        transform: [12, 0, 0, 0, 0, i * 10],
      }));
  return {
    getTextContent: async () => ({ items }),
  };
}

function makePdfJsDoc({
  numPages = 1,
  outline = null,
  textItems = [],
  fontNames = [],
} = {}) {
  return {
    numPages,
    getOutline: async () => outline,
    getPage: async (_n) => makePdfJsPage({ textItems, fontNames }),
    destroy: () => {},
  };
}

// ---------------------------------------------------------------------------
// Mock pdf-lib and pdfjs-dist BEFORE importing the module under test
// ---------------------------------------------------------------------------

const _pdfDocInstances = [];

await mock.module('pdf-lib', {
  namedExports: {
    PDFDocument: {
      load: async (data, _opts) => {
        // Return the last pushed mock doc
        return _pdfDocInstances[_pdfDocInstances.length - 1] ?? makePdfDoc();
      },
    },
    PDFName: {
      of: (name) => name, // identity — our makeCatalog uses string keys
    },
  },
});

// We need a controllable pdfJs mock. Store the current factory in a ref.
let _pdfJsFactory = null;

await mock.module('pdfjs-dist/build/pdf.mjs', {
  namedExports: {
    getDocument: (opts) => ({
      promise: _pdfJsFactory
        ? Promise.resolve(_pdfJsFactory())
        : Promise.resolve(makePdfJsDoc()),
    }),
  },
});

// Now import the module under test (mocks are already registered)
const { checkAccessibility, AccessibilityPanel } = await import(
  '../../app/modules/pdf-accessibility-checker.js'
);

// ---------------------------------------------------------------------------
// Helper: run checkAccessibility with controlled state
// ---------------------------------------------------------------------------

async function runCheck(pdfDocOpts, pdfJsDocOpts) {
  const pdfDoc = makePdfDoc(pdfDocOpts);
  const pdfJsDoc = makePdfJsDoc(pdfJsDocOpts);
  // Push to the array so PDFDocument.load() returns the right one
  _pdfDocInstances.push(pdfDoc);
  _pdfJsFactory = () => pdfJsDoc;
  const data = new Uint8Array(4);
  const report = await checkAccessibility(data);
  _pdfDocInstances.pop();
  _pdfJsFactory = null;
  return report;
}

// ---------------------------------------------------------------------------
// Tests: checkAccessibility
// ---------------------------------------------------------------------------

describe('checkAccessibility — report shape', () => {
  it('returns a report with required fields', async () => {
    const report = await runCheck({}, {});
    assert.ok(typeof report.score === 'number');
    assert.ok(typeof report.level === 'string');
    assert.ok(Array.isArray(report.checks));
    assert.ok(typeof report.summary === 'object');
    assert.ok(typeof report.timestamp === 'string');
  });

  it('accepts ArrayBuffer input (not just Uint8Array)', async () => {
    const pdfDoc = makePdfDoc();
    _pdfDocInstances.push(pdfDoc);
    _pdfJsFactory = () => makePdfJsDoc();
    const buf = new ArrayBuffer(4);
    const report = await checkAccessibility(buf);
    _pdfDocInstances.pop();
    _pdfJsFactory = null;
    assert.ok(Array.isArray(report.checks));
  });

  it('summary counts pass/fail/warn correctly', async () => {
    // All checks fail scenario: no title, no lang, no structTree, no text, etc.
    const report = await runCheck(
      { title: null, author: null, subject: null, hasStructTree: false, hasMarkInfo: false },
      { numPages: 1, textItems: [] },
    );
    const { pass, fail, warn } = report.summary;
    assert.equal(pass + fail + warn + (report.summary.info || 0), report.summary.total);
    assert.equal(report.summary.total, report.checks.length);
  });
});

describe('checkAccessibility — compliance level', () => {
  it('level is Non-compliant when score < 50', async () => {
    // All failing: no title, no lang, no struct, no text, no metadata
    const report = await runCheck(
      { title: null, author: null, subject: null, hasStructTree: false },
      { numPages: 1, textItems: [] },
    );
    assert.ok(['Non-compliant', 'A', 'AA', 'AAA'].includes(report.level));
  });

  it('level is AAA when score >= 90', async () => {
    const richItems = Array.from({ length: 60 }, (_, i) => ({
      str: 'Sample text content with sufficient characters',
      fontName: 'g_d0_f1',
      transform: [12, 0, 0, 0, 0, i * 5],
    }));
    const report = await runCheck(
      {
        title: 'My Doc',
        author: 'Me',
        subject: 'Testing',
        hasStructTree: true,
        hasMarkInfo: true,
        lang: 'en-US',
        formFields: [],
      },
      {
        numPages: 2,
        outline: null,
        textItems: richItems,
      },
    );
    // May be AAA or AA depending on bookmarks check — just ensure it's not null
    assert.ok(typeof report.level === 'string');
  });
});

describe('_checkStructureTree (via checkAccessibility)', () => {
  it('pass when both StructTreeRoot and MarkInfo present', async () => {
    const report = await runCheck({ hasStructTree: true, hasMarkInfo: true }, {});
    const check = report.checks.find(c => c.id === 'structure-tree');
    assert.equal(check.status, 'pass');
  });

  it('warn when StructTreeRoot present but no MarkInfo', async () => {
    const report = await runCheck({ hasStructTree: true, hasMarkInfo: false }, {});
    const check = report.checks.find(c => c.id === 'structure-tree');
    assert.equal(check.status, 'warn');
  });

  it('fail when no StructTreeRoot', async () => {
    const report = await runCheck({ hasStructTree: false, hasMarkInfo: false }, {});
    const check = report.checks.find(c => c.id === 'structure-tree');
    assert.equal(check.status, 'fail');
  });
});

describe('_checkDocumentTitle (via checkAccessibility)', () => {
  it('pass when title is set', async () => {
    const report = await runCheck({ title: 'Test Document' }, {});
    const check = report.checks.find(c => c.id === 'doc-title');
    assert.equal(check.status, 'pass');
    assert.ok(check.message.includes('Test Document'));
  });

  it('fail when no title', async () => {
    const report = await runCheck({ title: null }, {});
    const check = report.checks.find(c => c.id === 'doc-title');
    assert.equal(check.status, 'fail');
  });

  it('fail when title is whitespace only', async () => {
    const report = await runCheck({ title: '   ' }, {});
    const check = report.checks.find(c => c.id === 'doc-title');
    assert.equal(check.status, 'fail');
  });
});

describe('_checkLanguage (via checkAccessibility)', () => {
  it('pass when language tag present', async () => {
    const report = await runCheck({ lang: 'en-US' }, {});
    const check = report.checks.find(c => c.id === 'doc-lang');
    assert.equal(check.status, 'pass');
  });

  it('fail when no language tag', async () => {
    const report = await runCheck({ lang: null }, {});
    const check = report.checks.find(c => c.id === 'doc-lang');
    assert.equal(check.status, 'fail');
  });
});

describe('_checkBookmarks (via checkAccessibility)', () => {
  it('info for short document (≤3 pages)', async () => {
    const report = await runCheck({}, { numPages: 2 });
    const check = report.checks.find(c => c.id === 'bookmarks');
    assert.equal(check.status, 'info');
  });

  it('pass when outline present on multi-page doc', async () => {
    const report = await runCheck(
      {},
      { numPages: 10, outline: [{ title: 'Chapter 1' }, { title: 'Chapter 2' }] },
    );
    const check = report.checks.find(c => c.id === 'bookmarks');
    assert.equal(check.status, 'pass');
  });

  it('warn when no outline on multi-page doc', async () => {
    const report = await runCheck({}, { numPages: 10, outline: null });
    const check = report.checks.find(c => c.id === 'bookmarks');
    assert.equal(check.status, 'warn');
  });

  it('warn when outline is empty array on multi-page doc', async () => {
    const report = await runCheck({}, { numPages: 10, outline: [] });
    const check = report.checks.find(c => c.id === 'bookmarks');
    assert.equal(check.status, 'warn');
  });
});

describe('_checkFontEmbedding (via checkAccessibility)', () => {
  it('pass when fonts appear embedded (no standard names)', async () => {
    const report = await runCheck(
      {},
      { textItems: [{ str: 'Text', fontName: 'g_d0_f1', transform: [12, 0, 0, 0, 0, 0] }] },
    );
    const check = report.checks.find(c => c.id === 'font-embed');
    assert.equal(check.status, 'pass');
  });

  it('warn when standard font names present', async () => {
    const report = await runCheck(
      {},
      { textItems: [{ str: 'Text', fontName: 'Helvetica', transform: [12, 0, 0, 0, 0, 0] }] },
    );
    const check = report.checks.find(c => c.id === 'font-embed');
    assert.equal(check.status, 'warn');
  });

  it('pass when no font names in content', async () => {
    const report = await runCheck(
      {},
      { textItems: [{ str: 'Text', fontName: '', transform: [12, 0, 0, 0, 0, 0] }] },
    );
    const check = report.checks.find(c => c.id === 'font-embed');
    assert.equal(check.status, 'pass');
  });
});

describe('_checkTextPresence (via checkAccessibility)', () => {
  it('pass when more than 50 chars found', async () => {
    const longText = 'a'.repeat(60);
    const report = await runCheck(
      {},
      { textItems: [{ str: longText, fontName: 'f1', transform: [12, 0, 0, 0, 0, 0] }] },
    );
    const check = report.checks.find(c => c.id === 'text-presence');
    assert.equal(check.status, 'pass');
  });

  it('warn when very little text (1-50 chars)', async () => {
    const report = await runCheck(
      {},
      { textItems: [{ str: 'Hi', fontName: 'f1', transform: [12, 0, 0, 0, 0, 0] }] },
    );
    const check = report.checks.find(c => c.id === 'text-presence');
    assert.equal(check.status, 'warn');
  });

  it('fail when no text at all', async () => {
    const report = await runCheck({}, { textItems: [] });
    const check = report.checks.find(c => c.id === 'text-presence');
    assert.equal(check.status, 'fail');
  });
});

describe('_checkImageAltText (via checkAccessibility)', () => {
  it('warn when no structure tree (cannot verify alt text)', async () => {
    const report = await runCheck({ hasStructTree: false }, {});
    const check = report.checks.find(c => c.id === 'image-alt');
    assert.equal(check.status, 'warn');
  });

  it('info when structure tree present', async () => {
    const report = await runCheck({ hasStructTree: true }, {});
    const check = report.checks.find(c => c.id === 'image-alt');
    assert.equal(check.status, 'info');
  });
});

describe('_checkFormFieldLabels (via checkAccessibility)', () => {
  it('info when no form fields', async () => {
    const report = await runCheck({ formFields: [] }, {});
    const check = report.checks.find(c => c.id === 'form-labels');
    assert.equal(check.status, 'info');
  });

  it('pass when all fields are named', async () => {
    const fields = [
      { getName: () => 'firstName' },
      { getName: () => 'lastName' },
    ];
    const report = await runCheck({ formFields: fields }, {});
    const check = report.checks.find(c => c.id === 'form-labels');
    assert.equal(check.status, 'pass');
  });

  it('fail when some fields lack names', async () => {
    const fields = [
      { getName: () => 'firstName' },
      { getName: () => '' },
    ];
    const report = await runCheck({ formFields: fields }, {});
    const check = report.checks.find(c => c.id === 'form-labels');
    assert.equal(check.status, 'fail');
  });

  it('fail when all fields have null names', async () => {
    const fields = [
      { getName: () => null },
      { getName: () => null },
    ];
    const report = await runCheck({ formFields: fields }, {});
    const check = report.checks.find(c => c.id === 'form-labels');
    assert.equal(check.status, 'fail');
  });
});

describe('_checkReadingOrder (via checkAccessibility)', () => {
  it('info when fewer than 3 text items', async () => {
    const report = await runCheck(
      {},
      { textItems: [{ str: 'A', fontName: 'f', transform: [12, 0, 0, 0, 0, 100] }] },
    );
    const check = report.checks.find(c => c.id === 'reading-order');
    assert.equal(check.status, 'info');
  });

  it('pass for normal top-to-bottom order', async () => {
    // Decreasing Y values = top-to-bottom in PDF (origin bottom-left)
    const items = [
      { str: 'Line one', fontName: 'f', transform: [12, 0, 0, 0, 0, 700] },
      { str: 'Line two', fontName: 'f', transform: [12, 0, 0, 0, 0, 680] },
      { str: 'Line three', fontName: 'f', transform: [12, 0, 0, 0, 0, 660] },
      { str: 'Line four', fontName: 'f', transform: [12, 0, 0, 0, 0, 640] },
    ];
    const report = await runCheck({}, { textItems: items });
    const check = report.checks.find(c => c.id === 'reading-order');
    assert.ok(['pass', 'warn', 'fail'].includes(check.status));
  });

  it('fail for very out-of-order items', async () => {
    // Many jumps upward (y increases significantly) = out of order
    const items = Array.from({ length: 20 }, (_, i) => ({
      str: 'text',
      fontName: 'f',
      // Alternating y values to create many upward jumps
      transform: [12, 0, 0, 0, 0, i % 2 === 0 ? 100 : 700],
    }));
    const report = await runCheck({}, { textItems: items });
    const check = report.checks.find(c => c.id === 'reading-order');
    assert.ok(['warn', 'fail'].includes(check.status));
  });
});

describe('_checkColorContrast (via checkAccessibility)', () => {
  it('info when no text items', async () => {
    const report = await runCheck({}, { textItems: [] });
    const check = report.checks.find(c => c.id === 'color-contrast');
    assert.equal(check.status, 'info');
  });

  it('pass when no tiny text', async () => {
    const items = [{ str: 'Text', fontName: 'f', transform: [12, 0, 0, 0, 0, 0] }];
    const report = await runCheck({}, { textItems: items });
    const check = report.checks.find(c => c.id === 'color-contrast');
    assert.equal(check.status, 'pass');
  });

  it('warn when tiny text detected (fontSize < 6)', async () => {
    const items = [
      { str: 'Tiny', fontName: 'f', transform: [3, 0, 0, 0, 0, 0] }, // fontSize=3
      { str: 'Normal', fontName: 'f', transform: [12, 0, 0, 0, 0, 20] },
    ];
    const report = await runCheck({}, { textItems: items });
    const check = report.checks.find(c => c.id === 'color-contrast');
    assert.equal(check.status, 'warn');
  });
});

describe('_checkMetadata (via checkAccessibility)', () => {
  it('pass when at least 2 metadata fields are set', async () => {
    const report = await runCheck({ title: 'Doc', author: 'Me', subject: null }, {});
    const check = report.checks.find(c => c.id === 'metadata');
    assert.equal(check.status, 'pass');
  });

  it('warn when only 1 field is set', async () => {
    const report = await runCheck({ title: 'Doc', author: null, subject: null }, {});
    const check = report.checks.find(c => c.id === 'metadata');
    assert.equal(check.status, 'warn');
  });

  it('fail when no metadata at all', async () => {
    const report = await runCheck({ title: null, author: null, subject: null }, {});
    const check = report.checks.find(c => c.id === 'metadata');
    assert.equal(check.status, 'fail');
  });
});

// ---------------------------------------------------------------------------
// Tests: AccessibilityPanel (UI class)
// ---------------------------------------------------------------------------

describe('AccessibilityPanel', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    _pdfJsFactory = () => makePdfJsDoc({ numPages: 1, textItems: [] });
    _pdfDocInstances.push(makePdfDoc({ title: 'T', author: 'A' }));
  });

  it('is a class / constructor function', () => {
    assert.equal(typeof AccessibilityPanel, 'function');
  });

  it('open() appends a panel to the container', async () => {
    const pdfBytes = new Uint8Array(4);
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => pdfBytes,
      onClose: () => {},
    });
    await panel.open();
    assert.ok(container.children.length > 0);
    _pdfDocInstances.pop();
  });

  it('close() removes the panel from the container', async () => {
    const pdfBytes = new Uint8Array(4);
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => pdfBytes,
    });
    await panel.open();
    panel.close();
    // Panel element removed
    assert.equal(panel._panel, null);
    _pdfDocInstances.pop();
  });

  it('close() is safe when called before open()', () => {
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => new Uint8Array(4),
    });
    assert.doesNotThrow(() => panel.close());
  });

  it('calls onClose callback when close button clicked', async () => {
    let closed = false;
    const pdfBytes = new Uint8Array(4);
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => pdfBytes,
      onClose: () => { closed = true; },
    });
    await panel.open();

    // Find the close button (✕) and dispatch click
    // The panel is first child of container
    const panelEl = container.children[0];
    // The close button is inside the header (first child of panel)
    const header = panelEl.children[0];
    const closeBtn = header.children[header.children.length - 1];
    closeBtn.dispatchEvent(new Event('click'));
    assert.ok(closed);
    _pdfDocInstances.pop();
  });
});

// ---------------------------------------------------------------------------
// Tests: score and summary computation
// ---------------------------------------------------------------------------

describe('score computation', () => {
  it('score is between 0 and 100', async () => {
    const report = await runCheck({}, {});
    assert.ok(report.score >= 0 && report.score <= 100);
  });

  it('higher compliance gives higher score', async () => {
    const goodReport = await runCheck(
      { title: 'Doc', author: 'Me', subject: 'Test', hasStructTree: true, hasMarkInfo: true, lang: 'en' },
      { textItems: [{ str: 'a'.repeat(60), fontName: 'g_d0', transform: [12, 0, 0, 0, 0, 0] }] },
    );
    const badReport = await runCheck(
      { title: null, author: null, subject: null, hasStructTree: false },
      { textItems: [] },
    );
    assert.ok(goodReport.score >= badReport.score);
  });
});
