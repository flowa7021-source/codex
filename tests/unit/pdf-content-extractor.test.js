import './setup-dom.js';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFontName,
  extractPageContent,
  extractDocumentFonts,
} from '../../app/modules/pdf-content-extractor.js';

describe('normalizeFontName', () => {
  it('returns Arial for null/empty input', () => {
    assert.equal(normalizeFontName(null), 'Arial');
    assert.equal(normalizeFontName(''), 'Arial');
  });

  it('strips subset prefix (BCDFEE+ArialMT)', () => {
    assert.equal(normalizeFontName('BCDFEE+ArialMT'), 'Arial');
  });

  it('resolves known aliases', () => {
    assert.equal(normalizeFontName('ArialMT'), 'Arial');
    assert.equal(normalizeFontName('TimesNewRomanPSMT'), 'Times New Roman');
    assert.equal(normalizeFontName('CourierNewPSMT'), 'Courier New');
    assert.equal(normalizeFontName('Helvetica'), 'Arial');
  });

  it('resolves fonts by pattern matching', () => {
    assert.equal(normalizeFontName('SomeTimesFont'), 'Times New Roman');
    assert.equal(normalizeFontName('MyHelveticaVariant'), 'Arial');
    assert.equal(normalizeFontName('CourierSomething'), 'Courier New');
  });

  it('strips style suffixes', () => {
    assert.equal(normalizeFontName('Calibri-Bold'), 'Calibri');
    assert.equal(normalizeFontName('Georgia-Italic'), 'Georgia');
  });

  it('returns base name for unknown fonts', () => {
    const result = normalizeFontName('MyCustomFont');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('handles CJK font aliases', () => {
    assert.equal(normalizeFontName('SimSun'), 'SimSun');
    assert.equal(normalizeFontName('MSGothic'), 'MS Gothic');
  });
});

describe('extractPageContent', () => {
  function makeMockPage(opts = {}) {
    const textItems = opts.textItems || [
      {
        str: 'Hello',
        fontName: 'ArialMT',
        transform: [12, 0, 0, 12, 72, 700],
        width: 30,
        height: 12,
        dir: 'ltr',
      },
    ];
    return {
      pageNumber: opts.pageNumber || 1,
      _pageIndex: 0,
      rotate: 0,
      getViewport: () => ({ width: 612, height: 792, scale: 1.0 }),
      getTextContent: mock.fn(async () => ({
        items: textItems,
        styles: opts.styles || { ArialMT: { fontFamily: 'ArialMT' } },
      })),
      getOperatorList: mock.fn(async () => ({
        fnArray: [],
        argsArray: [],
      })),
      getAnnotations: mock.fn(async () => opts.annotations || []),
      objs: { get: () => null },
      commonObjs: { get: () => null },
    };
  }

  it('extracts text runs from a page', async () => {
    const page = makeMockPage();
    const result = await extractPageContent(page);
    assert.ok(result.textRuns.length > 0);
    assert.equal(result.textRuns[0].text, 'Hello');
  });

  it('returns page dimensions', async () => {
    const page = makeMockPage();
    const result = await extractPageContent(page);
    assert.equal(result.width, 612);
    assert.equal(result.height, 792);
  });

  it('returns page number', async () => {
    const page = makeMockPage({ pageNumber: 3 });
    const result = await extractPageContent(page);
    assert.equal(result.pageNumber, 3);
  });

  it('handles empty text content', async () => {
    const page = makeMockPage({ textItems: [] });
    const result = await extractPageContent(page);
    assert.equal(result.textRuns.length, 0);
  });

  it('extracts font information', async () => {
    const page = makeMockPage({
      styles: { 'MyFont': { fontFamily: 'TimesNewRomanPSMT' } },
    });
    const result = await extractPageContent(page);
    assert.ok(result.fonts instanceof Map);
    assert.ok(result.fonts.has('MyFont'));
  });

  it('handles RTL text items', async () => {
    const page = makeMockPage({
      textItems: [{
        str: 'Arabic text',
        fontName: 'ArialMT',
        transform: [12, 0, 0, 12, 72, 700],
        width: 50,
        height: 12,
        dir: 'rtl',
      }],
    });
    const result = await extractPageContent(page);
    assert.ok(result.textRuns[0]._rtl);
  });

  it('skips items with very small font size', async () => {
    const page = makeMockPage({
      textItems: [{
        str: 'Tiny',
        fontName: 'ArialMT',
        transform: [0.1, 0, 0, 0.1, 72, 700],
        width: 5,
        height: 1,
      }],
    });
    const result = await extractPageContent(page);
    assert.equal(result.textRuns.length, 0);
  });
});

describe('extractDocumentFonts', () => {
  it('extracts fonts from sampled pages', async () => {
    const mockDoc = {
      numPages: 2,
      getPage: mock.fn(async () => ({
        getTextContent: async () => ({
          items: [],
          styles: {
            'g_d0_f1': { fontFamily: 'Arial' },
          },
        }),
      })),
    };
    const fonts = await extractDocumentFonts(mockDoc);
    assert.ok(fonts instanceof Map);
    assert.ok(fonts.has('g_d0_f1'));
  });

  it('limits sampling to 5 pages', async () => {
    const getPage = mock.fn(async () => ({
      getTextContent: async () => ({ items: [], styles: {} }),
    }));
    const mockDoc = { numPages: 20, getPage };
    await extractDocumentFonts(mockDoc);
    assert.equal(getPage.mock.callCount(), 5);
  });
});
