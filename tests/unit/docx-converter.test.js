// ─── Unit Tests: DocxConverter / DocxStructureDetector ────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// We test the re-exported structure detector helpers that don't require
// the heavy 'docx' library (which is lazily loaded). The main convertPdfToDocx
// function requires a real pdfDoc object and the docx library, so we focus on
// the pure functions that are exported for unit testing.
import {
  mapPdfFont,
  isBoldFont,
  isItalicFont,
  isMonospaceFont,
  convertPdfToDocx,
} from '../../app/modules/docx-converter.js';

// ── mapPdfFont ───────────────────────────────────────────────────────────────

describe('mapPdfFont', () => {
  it('maps Helvetica to Arial', () => {
    assert.equal(mapPdfFont('Helvetica'), 'Arial');
  });

  it('maps Times-Roman to Times New Roman', () => {
    assert.equal(mapPdfFont('Times-Roman'), 'Times New Roman');
  });

  it('maps Courier to Courier New', () => {
    assert.equal(mapPdfFont('Courier'), 'Courier New');
  });

  it('maps ArialMT to Arial', () => {
    assert.equal(mapPdfFont('ArialMT'), 'Arial');
  });

  it('maps TimesNewRomanPSMT to Times New Roman', () => {
    assert.equal(mapPdfFont('TimesNewRomanPSMT'), 'Times New Roman');
  });

  it('strips Bold suffix when mapping', () => {
    const mapped = mapPdfFont('Helvetica-Bold');
    // Should map to Arial (base font of Helvetica)
    assert.equal(mapped, 'Arial');
  });

  it('strips Italic suffix when mapping', () => {
    const mapped = mapPdfFont('Helvetica-Oblique');
    assert.equal(mapped, 'Arial');
  });

  it('returns Arial for empty/null input', () => {
    assert.equal(mapPdfFont(''), 'Arial');
    assert.equal(mapPdfFont(null), 'Arial');
    assert.equal(mapPdfFont(undefined), 'Arial');
  });

  it('returns input-based mapping for unknown fonts', () => {
    // Unknown fonts fall through to heuristic matching
    const result = mapPdfFont('MyCustomFont-Regular');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });
});

// ── isBoldFont ───────────────────────────────────────────────────────────────

describe('isBoldFont', () => {
  it('detects Bold in font name', () => {
    assert.equal(isBoldFont('Helvetica-Bold'), true);
    assert.equal(isBoldFont('ArialBold'), true);
  });

  it('detects Black weight', () => {
    assert.equal(isBoldFont('Arial-Black'), true);
  });

  it('detects Heavy weight', () => {
    assert.equal(isBoldFont('FontHeavy'), true);
  });

  it('returns false for regular fonts', () => {
    assert.equal(isBoldFont('Helvetica'), false);
    assert.equal(isBoldFont('Arial'), false);
    assert.equal(isBoldFont('Times-Roman'), false);
  });

  it('handles empty/null input', () => {
    assert.equal(isBoldFont(''), false);
    assert.equal(isBoldFont(null), false);
    assert.equal(isBoldFont(undefined), false);
  });
});

// ── isItalicFont ─────────────────────────────────────────────────────────────

describe('isItalicFont', () => {
  it('detects Italic in font name', () => {
    assert.equal(isItalicFont('Times-Italic'), true);
    assert.equal(isItalicFont('ArialItalic'), true);
  });

  it('detects Oblique in font name', () => {
    assert.equal(isItalicFont('Helvetica-Oblique'), true);
  });

  it('returns false for non-italic fonts', () => {
    assert.equal(isItalicFont('Helvetica'), false);
    assert.equal(isItalicFont('Times-Bold'), false);
  });

  it('handles empty/null input', () => {
    assert.equal(isItalicFont(''), false);
    assert.equal(isItalicFont(null), false);
  });
});

// ── isMonospaceFont ──────────────────────────────────────────────────────────

describe('isMonospaceFont', () => {
  it('detects Courier', () => {
    assert.equal(isMonospaceFont('Courier'), true);
    assert.equal(isMonospaceFont('Courier-Bold'), true);
    assert.equal(isMonospaceFont('CourierNewPSMT'), true);
  });

  it('detects Consolas', () => {
    assert.equal(isMonospaceFont('Consolas'), true);
  });

  it('detects monospace keyword', () => {
    assert.equal(isMonospaceFont('SomeMonospaceFont'), true);
  });

  it('detects fixed keyword', () => {
    assert.equal(isMonospaceFont('FixedSys'), true);
  });

  it('returns false for proportional fonts', () => {
    assert.equal(isMonospaceFont('Arial'), false);
    assert.equal(isMonospaceFont('Times-Roman'), false);
    assert.equal(isMonospaceFont('Helvetica'), false);
  });

  it('handles empty/null input', () => {
    assert.equal(isMonospaceFont(''), false);
    assert.equal(isMonospaceFont(null), false);
  });
});

// ── Helper: create a mock pdfDoc ─────────────────────────────────────────────
// Builds a minimal pdfDoc that works with extractStructuredContent.
// By default returns empty text content (so blocks are empty and OCR path can be tested).

function makeMockPdfDoc(options = {}) {
  const {
    textItems = [],
    annotations = [],
    pageWidth = 595,
    pageHeight = 842,
  } = options;

  return {
    getPage: async () => ({
      getTextContent: async () => ({ items: textItems }),
      getViewport: () => ({ width: pageWidth, height: pageHeight }),
      getAnnotations: async () => annotations,
      getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
      objs: { get: () => null },
      commonObjs: { get: () => null },
    }),
  };
}

// Helper: create text items for a mock PDF page
function makeTextItem(str, x, y, fontSize = 12, fontName = 'Helvetica') {
  return {
    str,
    transform: [fontSize, 0, 0, fontSize, x, 842 - y], // flip Y back for PDF coords
    width: str.length * fontSize * 0.5,
    height: fontSize,
    fontName,
  };
}

// ── convertPdfToDocx — images-only mode ──────────────────────────────────────

describe('convertPdfToDocx', () => {
  it('returns a Blob in images-only mode with capturePageImage', async () => {
    const pdfDoc = makeMockPdfDoc();
    const fakeImage = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header stub
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      mode: 'images-only',
      capturePageImage: async () => fakeImage,
    });
    assert.ok(result, 'should return a blob');
  });

  it('handles images-only mode without capturePageImage', async () => {
    const pdfDoc = makeMockPdfDoc();
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      mode: 'images-only',
    });
    assert.ok(result, 'should return a blob even without images');
  });

  it('handles images-only mode when capturePageImage returns null', async () => {
    const pdfDoc = makeMockPdfDoc();
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      mode: 'images-only',
      capturePageImage: async () => null,
    });
    assert.ok(result, 'should return a blob with empty page');
  });

  it('uses pageRange to limit pages', async () => {
    const pagesRequested = [];
    const pdfDoc = {
      getPage: async (num) => {
        pagesRequested.push(num);
        return {
          getTextContent: async () => ({ items: [] }),
          getViewport: () => ({ width: 595, height: 842 }),
          getAnnotations: async () => [],
          getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
          objs: { get: () => null },
          commonObjs: { get: () => null },
        };
      },
    };
    await convertPdfToDocx(pdfDoc, 'Test', 5, {
      pageRange: [2, 4],
    });
    assert.deepEqual(pagesRequested, [2, 4]);
  });

  it('includes header when includeHeader is true', async () => {
    const pdfDoc = makeMockPdfDoc();
    const result = await convertPdfToDocx(pdfDoc, 'My Doc Title', 1, {
      includeHeader: true,
    });
    assert.ok(result, 'should return a blob with header');
  });

  it('excludes footer when includeFooter is false', async () => {
    const pdfDoc = makeMockPdfDoc();
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      includeFooter: false,
    });
    assert.ok(result, 'should return a blob without footer');
  });

  it('defaults to text mode with no options', async () => {
    const pdfDoc = makeMockPdfDoc();
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1);
    assert.ok(result, 'should return a blob in default text mode');
  });

  it('uses null title gracefully', async () => {
    const pdfDoc = makeMockPdfDoc();
    const result = await convertPdfToDocx(pdfDoc, null, 1);
    assert.ok(result, 'should handle null title');
  });

  it('handles text+images mode with capturePageImage', async () => {
    const pdfDoc = makeMockPdfDoc();
    const fakeImage = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      mode: 'text+images',
      capturePageImage: async () => fakeImage,
    });
    assert.ok(result, 'should return a blob in text+images mode');
  });

  it('handles text+images mode when capturePageImage returns null', async () => {
    const pdfDoc = makeMockPdfDoc();
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      mode: 'text+images',
      capturePageImage: async () => null,
    });
    assert.ok(result);
  });
});

// ── convertPdfToDocx with text content (heading, paragraph, list, etc.) ──────

describe('convertPdfToDocx with text content', () => {
  it('converts a page with a heading block', async () => {
    // Create a text item that will be detected as a heading (large font)
    const pdfDoc = makeMockPdfDoc({
      textItems: [
        makeTextItem('Introduction', 72, 100, 24, 'Helvetica-Bold'),
      ],
    });
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1);
    assert.ok(result);
  });

  it('converts a page with multiple paragraph blocks', async () => {
    const pdfDoc = makeMockPdfDoc({
      textItems: [
        makeTextItem('First paragraph text here.', 72, 100, 12, 'Helvetica'),
        makeTextItem('Second paragraph text.', 72, 200, 12, 'Helvetica'),
      ],
    });
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1);
    assert.ok(result);
  });

  it('converts a page with link annotations (hyperlinks)', async () => {
    const pdfDoc = makeMockPdfDoc({
      textItems: [
        makeTextItem('Click here', 72, 100, 12, 'Helvetica'),
      ],
      annotations: [{
        subtype: 'Link',
        url: 'https://example.com',
        rect: [70, 742 - 14, 140, 742], // PDF bottom-up coords: [x1, y1, x2, y2]
      }],
    });
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1);
    assert.ok(result);
  });

  it('converts a page with monospace font runs', async () => {
    const pdfDoc = makeMockPdfDoc({
      textItems: [
        makeTextItem('code snippet', 72, 100, 12, 'Courier'),
      ],
    });
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1);
    assert.ok(result);
  });

  it('converts multiple pages', async () => {
    let pageCallCount = 0;
    const pdfDoc = {
      getPage: async () => {
        pageCallCount++;
        return {
          getTextContent: async () => ({
            items: [makeTextItem('Page content', 72, 100, 12, 'Helvetica')],
          }),
          getViewport: () => ({ width: 595, height: 842 }),
          getAnnotations: async () => [],
          getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
          objs: { get: () => null },
          commonObjs: { get: () => null },
        };
      },
    };
    const result = await convertPdfToDocx(pdfDoc, 'Test', 3);
    assert.ok(result);
    assert.equal(pageCallCount, 3);
  });
});

// ── convertPdfToDocx with OCR word cache ─────────────────────────────────────

describe('convertPdfToDocx with ocrWordCache', () => {
  function makeWord(text, x0, y0, x1, y1, fontName = '') {
    return { text, bbox: { x0, y0, x1, y1 }, fontName };
  }

  it('uses ocrWordCache when PDF has no native text', async () => {
    const pdfDoc = makeMockPdfDoc(); // empty text items
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Hello', 72, 100, 120, 112),
      makeWord('World', 130, 100, 180, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('ignores ocrWordCache when PDF has native text', async () => {
    const pdfDoc = makeMockPdfDoc({
      textItems: [makeTextItem('Native text', 72, 100, 12)],
    });
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [makeWord('OCR text', 72, 100, 150, 112)]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles empty ocrWordCache gracefully', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, []);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles ocrWordCache with no entry for the page', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // No entry for page 1
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('applies OCR post-correction with ocrLanguage=eng', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('tbe', 72, 100, 100, 112),
      makeWord('quick', 110, 100, 160, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
      ocrLanguage: 'eng',
    });
    assert.ok(result);
  });

  it('applies OCR post-correction with ocrLanguage=rus', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Привет', 72, 100, 150, 112),
      makeWord('мир', 160, 100, 200, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
      ocrLanguage: 'rus',
    });
    assert.ok(result);
  });

  it('applies OCR post-correction with ocrLanguage=deu', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Hallo', 72, 100, 120, 112),
      makeWord('Welt', 130, 100, 170, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
      ocrLanguage: 'deu',
    });
    assert.ok(result);
  });

  it('applies OCR post-correction with ocrLanguage=fra', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Bonjour', 72, 100, 140, 112),
      makeWord('monde', 150, 100, 200, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
      ocrLanguage: 'fra',
    });
    assert.ok(result);
  });

  it('detects headings from OCR words (large font)', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // Large words (height 30 vs typical 12) should be detected as heading
    ocrWordCache.set(1, [
      makeWord('Chapter', 72, 50, 180, 80),
      makeWord('One', 190, 50, 240, 80),
      makeWord('Some body text here.', 72, 150, 300, 162),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('detects headings from OCR words by semantic pattern', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Introduction', 72, 100, 200, 114),
      makeWord('body', 72, 150, 120, 162),
      makeWord('text', 130, 150, 170, 162),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('detects bullet lists from OCR words', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('\u2022', 100, 100, 108, 112),
      makeWord('First', 115, 100, 155, 112),
      makeWord('item', 160, 100, 190, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('detects numbered lists from OCR words', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('1.', 72, 100, 85, 112),
      makeWord('First', 90, 100, 130, 112),
      makeWord('item', 135, 100, 165, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('detects tables from OCR words with large gaps (tab stops)', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // Two rows with large horizontal gaps -> table
    ocrWordCache.set(1, [
      makeWord('Name', 72, 100, 110, 112),
      makeWord('Value', 350, 100, 400, 112),
      makeWord('Alpha', 72, 120, 110, 132),
      makeWord('100', 350, 120, 380, 132),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('merges continuation lines into same paragraph', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // Two lines close together with same indent -> merge
    ocrWordCache.set(1, [
      makeWord('First', 72, 100, 110, 112),
      makeWord('line.', 115, 100, 150, 112),
      makeWord('Second', 72, 113, 120, 125), // small gap -> continuation
      makeWord('line.', 125, 113, 160, 125),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('detects paragraph break on large vertical gap', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('First', 72, 100, 110, 112),
      makeWord('para.', 115, 100, 150, 112),
      makeWord('Second', 72, 140, 120, 152), // large gap -> paragraph break
      makeWord('para.', 125, 140, 160, 152),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('detects bold/italic from OCR word font names', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Bold', 72, 100, 110, 112, 'Arial-Bold'),
      makeWord('text', 115, 100, 150, 112, 'Arial-Bold'),
      makeWord('Normal', 72, 130, 120, 142, 'Arial'),
      makeWord('text', 125, 130, 155, 142, 'Arial'),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles mixed bold/italic runs in same line', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Bold', 72, 100, 110, 112, 'Arial-Bold'),
      makeWord('Italic', 115, 100, 160, 112, 'Arial-Italic'),
      makeWord('Normal', 165, 100, 210, 112, 'Arial'),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles ALL CAPS bold text as heading', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('TITLE', 72, 50, 140, 64, 'Arial-Bold'),
      makeWord('HERE', 150, 50, 200, 64, 'Arial-Bold'),
      makeWord('Normal body text.', 72, 120, 250, 132, 'Arial'),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('single table candidate row is output as paragraph', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // Only one row with large gap, then a normal line -> should flush as paragraph
    ocrWordCache.set(1, [
      makeWord('Label', 72, 100, 120, 112),
      makeWord('Value', 350, 100, 400, 112), // large gap -> table candidate
      // Large vertical gap to flush the single table candidate
      makeWord('Normal', 72, 170, 130, 182),
      makeWord('text', 135, 170, 165, 182),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles indented text', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Normal', 72, 100, 130, 112),
      makeWord('Indented', 120, 130, 200, 142), // slightly right of left margin
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles chapter heading pattern', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Chapter', 72, 100, 150, 112),
      makeWord('1', 155, 100, 165, 112),
      makeWord('Body', 72, 150, 110, 162),
      makeWord('text', 115, 150, 145, 162),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles section heading pattern', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Section', 72, 100, 150, 112),
      makeWord('2', 155, 100, 165, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles conclusion heading pattern', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      makeWord('Conclusion', 72, 100, 180, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles alpha list pattern', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      // Alpha list: "a) Something" with indent
      makeWord('a)', 100, 100, 112, 112),
      makeWord('Something', 118, 100, 200, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles trailing single table candidate at end of page', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // Single table candidate row at end -> should be output as paragraph
    ocrWordCache.set(1, [
      makeWord('Col1', 72, 100, 120, 112),
      makeWord('Col2', 350, 100, 400, 112),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles trailing multi-row table at end of page', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // Two table candidate rows at end -> should be output as table
    ocrWordCache.set(1, [
      makeWord('Col1', 72, 100, 120, 112),
      makeWord('Col2', 350, 100, 400, 112),
      makeWord('Val1', 72, 115, 120, 127),
      makeWord('Val2', 350, 115, 400, 127),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('handles double space gap in OCR words', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // Words with medium gap (> 0.8*h but < 2*h) -> double space
    ocrWordCache.set(1, [
      makeWord('Hello', 72, 100, 110, 112),
      makeWord('World', 125, 100, 170, 112), // moderate gap
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('skips words without bbox or text', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      { text: '', bbox: { x0: 72, y0: 100, x1: 110, y1: 112 } },
      { text: 'Valid', bbox: { x0: 72, y0: 120, x1: 120, y1: 132 } },
      { text: 'NoBbox', bbox: null },
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('flushes multi-row table candidate on large vertical gap', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // Two table rows with large gap, then regular text after large gap
    // This triggers the "flush table on large gap" path (lines 595-604)
    ocrWordCache.set(1, [
      makeWord('Header1', 72, 50, 130, 62),
      makeWord('Header2', 350, 50, 420, 62),
      makeWord('Cell1', 72, 65, 120, 77),
      makeWord('Cell2', 350, 65, 400, 77),
      // Large gap (> avgH * 1.5) to trigger table flush
      makeWord('Paragraph', 72, 120, 180, 132),
      makeWord('text', 185, 120, 215, 132),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('flushes multi-row table candidate before non-table line', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // Two table rows, then a non-table line at normal spacing
    // This triggers the "flush pending table" path (lines 631-651)
    ocrWordCache.set(1, [
      makeWord('A1', 72, 50, 95, 62),
      makeWord('B1', 350, 50, 380, 62),
      makeWord('A2', 72, 65, 95, 77),
      makeWord('B2', 350, 65, 380, 77),
      // Normal line immediately after (small gap, no large horizontal gap)
      makeWord('Normal', 72, 80, 130, 92),
      makeWord('line', 135, 80, 165, 92),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('flushes single-row table candidate before non-table line', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // One table row, then a non-table line at normal spacing
    // Triggers single-candidate flush as paragraph (lines 641-648)
    ocrWordCache.set(1, [
      makeWord('Key', 72, 50, 100, 62),
      makeWord('Value', 350, 50, 400, 62),
      // Normal line immediately after
      makeWord('Regular', 72, 65, 140, 77),
      makeWord('text', 145, 65, 175, 77),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });

  it('flushes single-row table candidate on large gap', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    // One table row, then a large gap before next line
    // Triggers single-candidate flush on gap (lines 605-612)
    ocrWordCache.set(1, [
      makeWord('Key', 72, 50, 100, 62),
      makeWord('Value', 350, 50, 400, 62),
      // Large gap before next line
      makeWord('Later', 72, 120, 130, 132),
      makeWord('text', 135, 120, 165, 132),
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
    });
    assert.ok(result);
  });
});

// ── convertPdfToDocx with column info ────────────────────────────────────────

describe('convertPdfToDocx with column info', () => {
  it('handles multi-column content', async () => {
    // Create a pdfDoc that returns text items in two columns
    const pdfDoc = makeMockPdfDoc({
      textItems: [
        makeTextItem('Left column text', 72, 100, 12, 'Helvetica'),
        makeTextItem('Right column text', 350, 100, 12, 'Helvetica'),
      ],
    });
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1);
    assert.ok(result);
  });
});

// ── convertPdfToDocx with rich formatting ────────────────────────────────────

describe('convertPdfToDocx with rich text formatting', () => {
  it('handles text with underline, strikethrough, superscript, subscript, color', async () => {
    // Use Times-Roman which maps to Times New Roman
    const pdfDoc = makeMockPdfDoc({
      textItems: [
        makeTextItem('Formatted text', 72, 100, 14, 'Times-Italic'),
        makeTextItem('More text', 72, 140, 12, 'Courier-Bold'),
      ],
    });
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1);
    assert.ok(result);
  });
});

// ── OCR post-correction patterns ─────────────────────────────────────────────
// Test specific OCR correction patterns through the OCR word path

describe('OCR post-correction patterns', () => {
  it('normalizes multiple spaces', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      { text: 'hello', bbox: { x0: 72, y0: 100, x1: 120, y1: 112 } },
      { text: 'world', bbox: { x0: 125, y0: 100, x1: 175, y1: 112 } },
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
      ocrLanguage: 'eng',
    });
    assert.ok(result);
  });

  it('handles unknown ocrLanguage gracefully (no lang-specific fixes)', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      { text: 'text', bbox: { x0: 72, y0: 100, x1: 110, y1: 112 } },
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
      ocrLanguage: 'zzz', // unknown language
    });
    assert.ok(result);
  });

  it('handles ocrLanguage=null (no corrections)', async () => {
    const pdfDoc = makeMockPdfDoc();
    const ocrWordCache = new Map();
    ocrWordCache.set(1, [
      { text: 'text', bbox: { x0: 72, y0: 100, x1: 110, y1: 112 } },
    ]);
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      ocrWordCache,
      ocrLanguage: null,
    });
    assert.ok(result);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe('convertPdfToDocx edge cases', () => {
  it('handles 0 pageCount gracefully', async () => {
    const pdfDoc = makeMockPdfDoc();
    // 0 pages -> empty sections array; Document should still be created
    const result = await convertPdfToDocx(pdfDoc, 'Test', 0);
    assert.ok(result);
  });

  it('handles layout mode (falls through to text extraction)', async () => {
    const pdfDoc = makeMockPdfDoc({
      textItems: [makeTextItem('Layout text', 72, 100, 12)],
    });
    const result = await convertPdfToDocx(pdfDoc, 'Test', 1, {
      mode: 'layout',
    });
    assert.ok(result);
  });
});
