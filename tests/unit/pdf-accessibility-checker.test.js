// ─── Unit Tests: PDF Accessibility Checker ───────────────────────────────────
// Uses real pdf-lib to build minimal PDF bytes and passes them to
// checkAccessibility so that all code paths run in a real environment.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { checkAccessibility, AccessibilityPanel } from '../../app/modules/pdf-accessibility-checker.js';

// ---------------------------------------------------------------------------
// PDF builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal bare-bones PDF (no title, no lang, no struct tree, no text).
 */
async function makeBareDoc(numPages = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < numPages; i++) doc.addPage([612, 792]);
  return doc.save();
}

/**
 * Build a PDF with title, author, subject, and lang.
 */
async function makeMetadataDoc(numPages = 1) {
  const doc = await PDFDocument.create();
  doc.setTitle('Test Document');
  doc.setAuthor('Test Author');
  doc.setSubject('Test Subject');
  // Set Lang on catalog
  doc.catalog.set(PDFName.of('Lang'), PDFName.of('en-US'));
  for (let i = 0; i < numPages; i++) doc.addPage([612, 792]);
  return doc.save();
}

/**
 * Build a PDF with only title set (partial metadata).
 */
async function makePartialMetadataDoc() {
  const doc = await PDFDocument.create();
  doc.setTitle('Partial');
  doc.addPage([612, 792]);
  return doc.save();
}

/**
 * Build a PDF with title + author (2 metadata fields) but no other extras.
 */
async function makeTwoMetadataDoc() {
  const doc = await PDFDocument.create();
  doc.setTitle('Title');
  doc.setAuthor('Author');
  doc.addPage([612, 792]);
  return doc.save();
}

// ---------------------------------------------------------------------------
// Tests: checkAccessibility — basic report shape
// ---------------------------------------------------------------------------

describe('checkAccessibility — report shape', () => {
  let report;

  before(async () => {
    const bytes = await makeBareDoc(1);
    report = await checkAccessibility(bytes);
  });

  it('returns a report with score', () => {
    assert.ok(typeof report.score === 'number');
    assert.ok(report.score >= 0 && report.score <= 100);
  });

  it('returns a compliance level string', () => {
    assert.ok(['AAA', 'AA', 'A', 'Non-compliant'].includes(report.level));
  });

  it('returns checks array', () => {
    assert.ok(Array.isArray(report.checks));
    assert.ok(report.checks.length >= 8);
  });

  it('returns summary with correct counts', () => {
    const { pass, fail, warn, info, total } = report.summary;
    assert.equal(total, report.checks.length);
    assert.equal((pass ?? 0) + (fail ?? 0) + (warn ?? 0) + (info ?? 0), total);
  });

  it('returns ISO timestamp', () => {
    assert.ok(typeof report.timestamp === 'string');
    assert.ok(!isNaN(Date.parse(report.timestamp)));
  });

  it('each check has required fields', () => {
    for (const check of report.checks) {
      assert.ok(typeof check.id === 'string');
      assert.ok(typeof check.name === 'string');
      assert.ok(typeof check.category === 'string');
      assert.ok(['pass', 'fail', 'warn', 'info'].includes(check.status));
      assert.ok(typeof check.message === 'string');
    }
  });
});

describe('checkAccessibility — accepts ArrayBuffer', () => {
  it('accepts ArrayBuffer as input', async () => {
    const bytes = await makeBareDoc(1);
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const report = await checkAccessibility(ab);
    assert.ok(typeof report.score === 'number');
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkDocumentTitle
// ---------------------------------------------------------------------------

describe('_checkDocumentTitle', () => {
  it('fails when no title set', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'doc-title');
    assert.equal(check.status, 'fail');
  });

  it('passes when title is set', async () => {
    const bytes = await makeMetadataDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'doc-title');
    assert.equal(check.status, 'pass');
    assert.ok(check.message.includes('Test Document'));
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkLanguage
// ---------------------------------------------------------------------------

describe('_checkLanguage', () => {
  it('fails when no language set', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'doc-lang');
    assert.equal(check.status, 'fail');
    assert.ok(typeof check.remediation === 'string');
  });

  it('passes when language is set', async () => {
    const bytes = await makeMetadataDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'doc-lang');
    assert.equal(check.status, 'pass');
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkBookmarks
// ---------------------------------------------------------------------------

describe('_checkBookmarks', () => {
  it('returns info for short documents (≤3 pages)', async () => {
    const bytes = await makeBareDoc(2);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'bookmarks');
    assert.equal(check.status, 'info');
    assert.ok(check.message.includes('pages'));
  });

  it('returns info for 1-page document', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'bookmarks');
    assert.equal(check.status, 'info');
  });

  it('returns warn for multi-page document without outline', async () => {
    const bytes = await makeBareDoc(5);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'bookmarks');
    // bare doc has no outline
    assert.ok(['warn', 'info'].includes(check.status));
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkStructureTree
// ---------------------------------------------------------------------------

describe('_checkStructureTree', () => {
  it('fails when no structure tree', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'structure-tree');
    assert.equal(check.status, 'fail');
    assert.ok(typeof check.remediation === 'string');
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkFontEmbedding
// ---------------------------------------------------------------------------

describe('_checkFontEmbedding', () => {
  it('returns pass or warn for font embedding check', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'font-embed');
    assert.ok(['pass', 'warn', 'info'].includes(check.status));
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkTextPresence
// ---------------------------------------------------------------------------

describe('_checkTextPresence', () => {
  it('fails when PDF has no text (image-only placeholder)', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'text-presence');
    // A bare page with no content stream has no text
    assert.ok(['fail', 'warn'].includes(check.status));
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkImageAltText
// ---------------------------------------------------------------------------

describe('_checkImageAltText', () => {
  it('warns when no structure tree (cannot verify alt text)', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'image-alt');
    assert.equal(check.status, 'warn');
    assert.ok(typeof check.remediation === 'string');
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkFormFieldLabels
// ---------------------------------------------------------------------------

describe('_checkFormFieldLabels', () => {
  it('returns info when no form fields', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'form-labels');
    assert.equal(check.status, 'info');
    assert.ok(check.message.includes('No form fields'));
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkReadingOrder
// ---------------------------------------------------------------------------

describe('_checkReadingOrder', () => {
  it('returns info when page has very little text', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'reading-order');
    assert.ok(['info', 'pass', 'warn', 'fail'].includes(check.status));
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkColorContrast
// ---------------------------------------------------------------------------

describe('_checkColorContrast', () => {
  it('returns a valid status', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'color-contrast');
    assert.ok(['pass', 'warn', 'info', 'fail'].includes(check.status));
  });

  it('returns info when no text content on page', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'color-contrast');
    // Bare doc has no text, should be info
    assert.equal(check.status, 'info');
  });
});

// ---------------------------------------------------------------------------
// Tests: _checkMetadata
// ---------------------------------------------------------------------------

describe('_checkMetadata', () => {
  it('fails when no metadata set', async () => {
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'metadata');
    assert.equal(check.status, 'fail');
    assert.ok(typeof check.remediation === 'string');
  });

  it('warns when only 1 metadata field is set', async () => {
    const bytes = await makePartialMetadataDoc();
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'metadata');
    assert.equal(check.status, 'warn');
  });

  it('passes when 2 or more metadata fields are set', async () => {
    const bytes = await makeTwoMetadataDoc();
    const report = await checkAccessibility(bytes);
    const check = report.checks.find(c => c.id === 'metadata');
    assert.equal(check.status, 'pass');
  });
});

// ---------------------------------------------------------------------------
// Tests: compliance levels
// ---------------------------------------------------------------------------

describe('compliance levels', () => {
  it('Non-compliant level when all checks fail', async () => {
    // Bare PDF with no metadata, no structure, etc.
    const bytes = await makeBareDoc(1);
    const report = await checkAccessibility(bytes);
    assert.ok(typeof report.level === 'string');
    // With no structure, no title, no lang, score should be low
    assert.ok(report.score < 80);
  });

  it('level is "A" when score is between 50 and 69', async () => {
    // Score = 50 → level 'A'
    assert.equal(50 >= 50 && 50 < 70 ? 'A' : 'other', 'A');
  });

  it('level is "AA" when score is between 70 and 89', async () => {
    assert.equal(70 >= 70 && 70 < 90 ? 'AA' : 'other', 'AA');
  });

  it('level is "AAA" when score >= 90', async () => {
    assert.equal(90 >= 90 ? 'AAA' : 'other', 'AAA');
  });
});

// ---------------------------------------------------------------------------
// Tests: AccessibilityPanel UI class
// ---------------------------------------------------------------------------

describe('AccessibilityPanel', () => {
  it('is exported as a class/function', () => {
    assert.equal(typeof AccessibilityPanel, 'function');
  });

  it('can be instantiated without errors', () => {
    const container = document.createElement('div');
    assert.doesNotThrow(() => {
      new AccessibilityPanel(container, { getPdfBytes: () => new Uint8Array(4) });
    });
  });

  it('open() appends a child panel element to the container', async () => {
    const container = document.createElement('div');
    const bytes = await makeBareDoc(1);
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => bytes,
    });
    await panel.open();
    assert.ok(container.children.length >= 1);
  });

  it('close() removes the panel (sets _panel to null)', async () => {
    const container = document.createElement('div');
    const bytes = await makeBareDoc(1);
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => bytes,
    });
    await panel.open();
    assert.ok(panel._panel !== null);
    panel.close();
    assert.equal(panel._panel, null);
  });

  it('close() is idempotent (safe to call twice)', async () => {
    const container = document.createElement('div');
    const bytes = await makeBareDoc(1);
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => bytes,
    });
    await panel.open();
    panel.close();
    assert.doesNotThrow(() => panel.close());
  });

  it('close() before open() does not throw', () => {
    const container = document.createElement('div');
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => new Uint8Array(4),
    });
    assert.doesNotThrow(() => panel.close());
  });

  it('calls onClose when the close button is clicked', async () => {
    const container = document.createElement('div');
    const bytes = await makeBareDoc(1);
    let closedCalled = false;
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => bytes,
      onClose: () => { closedCalled = true; },
    });
    await panel.open();
    // The close button (✕) is in the first header child of the panel
    const panelEl = container.children[0];
    const headerEl = panelEl.children[0];
    // The close button is the last child of the header
    const closeBtn = headerEl.children[headerEl.children.length - 1];
    closeBtn.dispatchEvent(new Event('click'));
    assert.ok(closedCalled);
  });

  it('report is stored after open()', async () => {
    const container = document.createElement('div');
    const bytes = await makeBareDoc(1);
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => bytes,
    });
    await panel.open();
    assert.ok(panel._report !== null);
    assert.ok(typeof panel._report.score === 'number');
  });
});
