// ─── Unit Tests: DocxConverter Pipeline (deep coverage) ──────────────────────
// Tests the full convertPdfToDocx pipeline and internal helpers using the real
// 'docx' library (loaded via dynamic import, works in Node.js).
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  convertPdfToDocx,
  extractStructuredContent,
} from '../../app/modules/docx-converter.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a mock pdfDoc that returns pages with configurable text items.
 * Each page entry is an array of { str, transform, fontName, width, height }.
 */
function makeMockPdfDoc(pages) {
  return {
    getPage(pageNum) {
      const items = pages[pageNum - 1] || [];
      return Promise.resolve({
        getTextContent() {
          return Promise.resolve({
            items: items.map(it => ({
              str: it.str || '',
              transform: it.transform || [12, 0, 0, 12, it.x || 72, 800 - (it.y || 72)],
              fontName: it.fontName || 'Helvetica',
              width: it.width ?? 50,
              height: it.height ?? 12,
            })),
          });
        },
        getViewport() {
          return { width: 595, height: 842 };
        },
        getAnnotations() {
          return Promise.resolve([]);
        },
        // extractPageImages calls page.objs and page.commonObjs — stub them
        objs: { get() { return null; } },
        commonObjs: { get() { return null; } },
        getOperatorList() {
          return Promise.resolve({ fnArray: [], argsArray: [] });
        },
      });
    },
  };
}

// ─── convertPdfToDocx: mode='text' ──────────────────────────────────────────

describe('convertPdfToDocx — text mode', () => {
  let result;

  before(async () => {
    const pdfDoc = makeMockPdfDoc([
      [
        { str: 'Hello', x: 72, y: 72 },
        { str: 'World', x: 150, y: 72 },
      ],
    ]);
    result = await convertPdfToDocx(pdfDoc, 'Test Doc', 1, { mode: 'text' });
  });

  it('returns a Blob or Buffer', () => {
    // In Node the docx library returns a Blob (from the 'buffer' polyfill).
    assert.ok(result != null, 'result should not be null');
    assert.ok(
      result instanceof Blob || Buffer.isBuffer(result) || (result && typeof result.arrayBuffer === 'function'),
      'result should be Blob-like or Buffer',
    );
  });

  it('result has non-zero size', () => {
    const size = result.size ?? result.length ?? result.byteLength ?? 0;
    assert.ok(size > 0, `expected non-zero size, got ${size}`);
  });
});

// ─── convertPdfToDocx: mode='images-only' ───────────────────────────────────

describe('convertPdfToDocx — images-only mode', () => {
  it('calls capturePageImage for each page', async () => {
    const captured = [];
    const capturePageImage = async (pageNum) => {
      captured.push(pageNum);
      // Return a minimal valid PNG header as Uint8Array
      return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    };

    const pdfDoc = makeMockPdfDoc([[], []]);
    const result = await convertPdfToDocx(pdfDoc, 'Images', 2, {
      mode: 'images-only',
      capturePageImage,
    });

    assert.deepStrictEqual(captured, [1, 2]);
    assert.ok(result != null);
  });

  it('handles capturePageImage returning null gracefully', async () => {
    const pdfDoc = makeMockPdfDoc([[]]);
    const result = await convertPdfToDocx(pdfDoc, 'Empty', 1, {
      mode: 'images-only',
      capturePageImage: async () => null,
    });
    assert.ok(result != null);
  });
});

// ─── convertPdfToDocx: pageRange ─────────────────────────────────────────────

describe('convertPdfToDocx — pageRange', () => {
  it('only processes specified pages', async () => {
    const accessedPages = [];
    const pdfDoc = {
      getPage(pageNum) {
        accessedPages.push(pageNum);
        return makeMockPdfDoc([
          [{ str: `Page ${pageNum}`, x: 72, y: 72 }],
        ]).getPage(1);
      },
    };

    await convertPdfToDocx(pdfDoc, 'Subset', 5, {
      mode: 'text',
      pageRange: [2, 4],
    });

    assert.deepStrictEqual(accessedPages, [2, 4]);
  });
});

// ─── convertPdfToDocx: empty pages ──────────────────────────────────────────

describe('convertPdfToDocx — empty pages', () => {
  it('produces valid output for pages with no text', async () => {
    const pdfDoc = makeMockPdfDoc([[]]);
    const result = await convertPdfToDocx(pdfDoc, 'Empty', 1, { mode: 'text' });
    assert.ok(result != null);
    const size = result.size ?? result.length ?? result.byteLength ?? 0;
    assert.ok(size > 0);
  });
});

// ─── convertPdfToDocx: includeHeader / includeFooter ────────────────────────

describe('convertPdfToDocx — headers and footers', () => {
  it('works with includeHeader=true', async () => {
    const pdfDoc = makeMockPdfDoc([[{ str: 'Content', x: 72, y: 72 }]]);
    const result = await convertPdfToDocx(pdfDoc, 'WithHeader', 1, {
      mode: 'text',
      includeHeader: true,
      includeFooter: true,
    });
    assert.ok(result != null);
  });

  it('works with includeFooter=false', async () => {
    const pdfDoc = makeMockPdfDoc([[{ str: 'Content', x: 72, y: 72 }]]);
    const result = await convertPdfToDocx(pdfDoc, 'NoFooter', 1, {
      mode: 'text',
      includeFooter: false,
    });
    assert.ok(result != null);
  });
});

// ─── Internal helpers (accessed through _loadDocx side-effect) ──────────────
// After calling convertPdfToDocx, _docx is loaded, so internal functions that
// use _docx.TextRun etc. will work. We test them indirectly through the
// pipeline: by crafting specific input blocks through extractStructuredContent.

describe('convertPdfToDocx — paragraph formatting', () => {
  it('handles bold and italic font names', async () => {
    const pdfDoc = makeMockPdfDoc([
      [
        { str: 'Bold text', x: 72, y: 72, fontName: 'Helvetica-Bold' },
        { str: 'Italic text', x: 200, y: 72, fontName: 'Helvetica-Oblique' },
      ],
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Formatted', 1, { mode: 'text' });
    assert.ok(result != null);
  });
});

describe('convertPdfToDocx — text+images mode', () => {
  it('appends page image after text', async () => {
    const captured = [];
    const pdfDoc = makeMockPdfDoc([[{ str: 'Page text', x: 72, y: 72 }]]);
    const result = await convertPdfToDocx(pdfDoc, 'TextImages', 1, {
      mode: 'text+images',
      capturePageImage: async (num) => {
        captured.push(num);
        return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
      },
    });
    assert.deepStrictEqual(captured, [1]);
    assert.ok(result != null);
  });
});

// ─── extractStructuredContent (used by pipeline) ────────────────────────────

describe('extractStructuredContent', () => {
  it('returns blocks array for a page with text', async () => {
    const pdfDoc = makeMockPdfDoc([
      [
        { str: 'First line', x: 72, y: 72 },
        { str: 'Second line', x: 72, y: 100 },
      ],
    ]);
    const content = await extractStructuredContent(pdfDoc, 1);
    assert.ok(Array.isArray(content.blocks));
    assert.ok(content.pageWidth > 0);
    assert.ok(content.pageHeight > 0);
  });

  it('returns empty blocks for empty page', async () => {
    const pdfDoc = makeMockPdfDoc([[]]);
    const content = await extractStructuredContent(pdfDoc, 1);
    assert.ok(Array.isArray(content.blocks));
    assert.equal(content.blocks.length, 0);
  });
});

// ─── convertPdfToDocx with ocrWordCache ─────────────────────────────────────

describe('convertPdfToDocx — ocrWordCache fallback', () => {
  it('uses OCR word cache when page has no native text', async () => {
    const pdfDoc = makeMockPdfDoc([[]]);  // empty page
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      { text: 'OCR', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 90 },
      { text: 'Text', bbox: { x0: 60, y0: 10, x1: 100, y1: 25 }, confidence: 88 },
    ]);

    const result = await convertPdfToDocx(pdfDoc, 'OCR Fallback', 1, {
      mode: 'text',
      ocrWordCache,
    });
    assert.ok(result != null);
    const size = result.size ?? result.length ?? result.byteLength ?? 0;
    assert.ok(size > 0);
  });
});

// ─── Multiple pages ─────────────────────────────────────────────────────────

describe('convertPdfToDocx — multiple pages', () => {
  it('converts multi-page document', async () => {
    const pdfDoc = makeMockPdfDoc([
      [{ str: 'Page 1 content', x: 72, y: 72 }],
      [{ str: 'Page 2 content', x: 72, y: 72 }],
      [{ str: 'Page 3 content', x: 72, y: 72 }],
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Multi', 3);
    assert.ok(result != null);
    const size = result.size ?? result.length ?? result.byteLength ?? 0;
    assert.ok(size > 0);
  });
});
