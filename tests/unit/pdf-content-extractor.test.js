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

// ─── Additional coverage tests ───────────────────────────────────────────────

describe('normalizeFontName — extended coverage', () => {
  it('resolves Noto aliases', () => {
    assert.equal(normalizeFontName('NotoSans'), 'Noto Sans');
    assert.equal(normalizeFontName('NotoSerif'), 'Noto Serif');
  });

  it('resolves Roboto / OpenSans / Lato / Montserrat aliases', () => {
    assert.equal(normalizeFontName('Roboto'), 'Roboto');
    assert.equal(normalizeFontName('OpenSans'), 'Open Sans');
    assert.equal(normalizeFontName('Lato'), 'Lato');
    assert.equal(normalizeFontName('Montserrat'), 'Montserrat');
  });

  it('resolves SegoeUI, TrebuchetMS, Garamond, Palatino aliases', () => {
    assert.equal(normalizeFontName('SegoeUI'), 'Segoe UI');
    assert.equal(normalizeFontName('TrebuchetMS'), 'Trebuchet MS');
    assert.equal(normalizeFontName('Garamond'), 'Garamond');
    assert.equal(normalizeFontName('Palatino'), 'Palatino Linotype');
  });

  it('resolves BookAntiqua, Century, CenturyGothic, Impact, ComicSansMS', () => {
    assert.equal(normalizeFontName('BookAntiqua'), 'Book Antiqua');
    assert.equal(normalizeFontName('Century'), 'Century');
    assert.equal(normalizeFontName('CenturyGothic'), 'Century Gothic');
    assert.equal(normalizeFontName('Impact'), 'Impact');
    assert.equal(normalizeFontName('ComicSansMS'), 'Comic Sans MS');
  });

  it('resolves LucidaSans, PTSans, PTSerif, PTMono', () => {
    assert.equal(normalizeFontName('LucidaSans'), 'Lucida Sans');
    assert.equal(normalizeFontName('PTSans'), 'PT Sans');
    assert.equal(normalizeFontName('PTSerif'), 'PT Serif');
    assert.equal(normalizeFontName('PTMono'), 'PT Mono');
  });

  it('resolves SourceSansPro, LucidaConsole, Consolas', () => {
    assert.equal(normalizeFontName('SourceSansPro'), 'Source Sans Pro');
    assert.equal(normalizeFontName('LucidaConsole'), 'Lucida Console');
    assert.equal(normalizeFontName('Consolas'), 'Consolas');
  });

  it('pattern fallback: georgia', () => {
    assert.equal(normalizeFontName('SomeGeorgiaFont'), 'Georgia');
  });

  it('pattern fallback: verdana', () => {
    assert.equal(normalizeFontName('VerdanaCustom'), 'Verdana');
  });

  it('pattern fallback: calibri', () => {
    assert.equal(normalizeFontName('CalibriLight'), 'Calibri');
  });

  it('pattern fallback: cambria', () => {
    assert.equal(normalizeFontName('CambriaSomething'), 'Cambria');
  });

  it('pattern fallback: tahoma', () => {
    assert.equal(normalizeFontName('TahomaRegular'), 'Tahoma');
  });

  it('pattern fallback: segoe', () => {
    assert.equal(normalizeFontName('SegoeProUI'), 'Segoe UI');
  });

  it('pattern fallback: trebuchet', () => {
    assert.equal(normalizeFontName('TrebuchetStd'), 'Trebuchet MS');
  });

  it('pattern fallback: palatino', () => {
    assert.equal(normalizeFontName('PalatinoNew'), 'Palatino Linotype');
  });

  it('pattern fallback: garamond', () => {
    assert.equal(normalizeFontName('GaramondPremiere'), 'Garamond');
  });

  it('strips subset prefix and resolves alias', () => {
    assert.equal(normalizeFontName('ABCDEF+Helvetica'), 'Arial');
    assert.equal(normalizeFontName('XYZABC+CourierNewPSMT'), 'Courier New');
  });

  it('strips style suffixes like -Regular, -Light, -Medium', () => {
    // Verdana-Regular => base "Verdana" => alias match
    assert.equal(normalizeFontName('Verdana-Regular'), 'Verdana');
  });

  it('handles camelCase splitting for alias lookup', () => {
    // "MalgunGothic" is a direct alias
    assert.equal(normalizeFontName('MalgunGothic'), 'Malgun Gothic');
  });

  it('handles Arial variants', () => {
    assert.equal(normalizeFontName('Arial-BoldMT'), 'Arial');
    assert.equal(normalizeFontName('Arial-ItalicMT'), 'Arial');
    assert.equal(normalizeFontName('Arial-BoldItalicMT'), 'Arial');
    assert.equal(normalizeFontName('HelveticaNeue'), 'Arial');
  });

  it('handles TimesNewRoman variants', () => {
    assert.equal(normalizeFontName('TimesNewRomanPS-BoldMT'), 'Times New Roman');
    assert.equal(normalizeFontName('TimesNewRomanPS-ItalicMT'), 'Times New Roman');
    assert.equal(normalizeFontName('TimesNewRomanPS-BoldItalicMT'), 'Times New Roman');
  });

  it('handles CourierNew / Courier aliases', () => {
    assert.equal(normalizeFontName('CourierNew'), 'Courier New');
    assert.equal(normalizeFontName('Courier'), 'Courier New');
  });

  it('handles CambriaMath alias', () => {
    assert.equal(normalizeFontName('CambriaMath'), 'Cambria Math');
  });
});

describe('extractPageContent — operator list paths', () => {
  // OPS constants (mirrored from the source module)
  const OPS = {
    save: 10, restore: 11, transform: 12,
    moveTo: 13, lineTo: 14, curveTo: 15, curveTo2: 16, curveTo3: 17,
    closePath: 18, rectangle: 19, stroke: 20, closeStroke: 21,
    fill: 22, eoFill: 23, fillStroke: 24, eoFillStroke: 25,
    closeFillStroke: 26, closeEoFillStroke: 27, endPath: 28,
    setLineWidth: 2,
    setStrokeRGBColor: 94, setFillRGBColor: 95,
    setStrokeGray: 96, setFillGray: 97,
    setStrokeCMYKColor: 98, setFillCMYKColor: 99,
    constructPath: 91,
    paintImageXObject: 85, paintInlineImageXObject: 86, paintJpegXObject: 82,
  };

  function makePage(opListOverride = {}, opts = {}) {
    return {
      pageNumber: opts.pageNumber || 1,
      _pageIndex: 0,
      rotate: 0,
      getViewport: () => ({ width: 612, height: 792, scale: 1.0 }),
      getTextContent: mock.fn(async () => ({
        items: opts.textItems || [],
        styles: opts.styles || {},
      })),
      getOperatorList: mock.fn(async () => ({
        fnArray: opListOverride.fnArray || [],
        argsArray: opListOverride.argsArray || [],
      })),
      getAnnotations: mock.fn(async () => opts.annotations || []),
      objs: { get: () => null },
      commonObjs: { get: () => null },
    };
  }

  it('extracts horizontal and vertical lines from a moveTo+lineTo+stroke sequence', async () => {
    const page = makePage({
      fnArray: [OPS.moveTo, OPS.lineTo, OPS.stroke],
      argsArray: [[0, 792], [612, 792], []],
    });
    const result = await extractPageContent(page);
    assert.ok(result.paths.length > 0, 'should extract at least one path');
    assert.equal(result.paths[0].type, 'line');
  });

  it('extracts a rectangle op', async () => {
    const page = makePage({
      fnArray: [OPS.rectangle],
      argsArray: [[50, 50, 200, 100]],
    });
    const result = await extractPageContent(page);
    // rectangle generates line segments + a rect if big enough
    const rects = result.paths.filter(p => p.type === 'rect');
    assert.ok(rects.length > 0, 'should extract rectangle');
  });

  it('handles save/restore state', async () => {
    const page = makePage({
      fnArray: [OPS.save, OPS.setLineWidth, OPS.restore],
      argsArray: [[], [3], []],
    });
    const result = await extractPageContent(page);
    assert.ok(result, 'should not throw');
  });

  it('handles setStrokeRGBColor and setFillRGBColor', async () => {
    const page = makePage({
      fnArray: [
        OPS.setStrokeRGBColor, OPS.setFillRGBColor,
        OPS.moveTo, OPS.lineTo, OPS.fillStroke,
      ],
      argsArray: [
        [1, 0, 0], [0, 0, 1],
        [0, 792], [612, 792], [],
      ],
    });
    const result = await extractPageContent(page);
    if (result.paths.length > 0) {
      assert.ok(result.paths[0].strokeColor || result.paths[0].fillColor);
    }
  });

  it('handles setStrokeGray and setFillGray', async () => {
    const page = makePage({
      fnArray: [OPS.setStrokeGray, OPS.setFillGray, OPS.moveTo, OPS.lineTo, OPS.stroke],
      argsArray: [[0.5], [0.8], [0, 792], [612, 792], []],
    });
    const result = await extractPageContent(page);
    assert.ok(result, 'should not throw');
  });

  it('handles setStrokeCMYKColor and setFillCMYKColor', async () => {
    const page = makePage({
      fnArray: [OPS.setStrokeCMYKColor, OPS.setFillCMYKColor, OPS.moveTo, OPS.lineTo, OPS.stroke],
      argsArray: [[0, 1, 1, 0], [1, 0, 0, 0], [0, 792], [612, 792], []],
    });
    const result = await extractPageContent(page);
    assert.ok(result, 'should not throw');
  });

  it('handles fill, eoFill ops', async () => {
    const page = makePage({
      fnArray: [OPS.moveTo, OPS.lineTo, OPS.fill],
      argsArray: [[0, 792], [612, 792], []],
    });
    const result = await extractPageContent(page);
    assert.ok(result, 'should not throw with fill');

    const page2 = makePage({
      fnArray: [OPS.moveTo, OPS.lineTo, OPS.eoFill],
      argsArray: [[0, 792], [612, 792], []],
    });
    const result2 = await extractPageContent(page2);
    assert.ok(result2, 'should not throw with eoFill');
  });

  it('handles closeFillStroke and closeEoFillStroke', async () => {
    const page = makePage({
      fnArray: [OPS.moveTo, OPS.lineTo, OPS.closeFillStroke],
      argsArray: [[0, 792], [612, 792], []],
    });
    const result = await extractPageContent(page);
    assert.ok(result, 'should not throw with closeFillStroke');

    const page2 = makePage({
      fnArray: [OPS.moveTo, OPS.lineTo, OPS.closeEoFillStroke],
      argsArray: [[0, 792], [612, 792], []],
    });
    const result2 = await extractPageContent(page2);
    assert.ok(result2, 'should not throw');
  });

  it('handles endPath op (clears current path)', async () => {
    const page = makePage({
      fnArray: [OPS.moveTo, OPS.lineTo, OPS.endPath],
      argsArray: [[0, 792], [612, 792], []],
    });
    const result = await extractPageContent(page);
    // endPath clears path, so no paths should be emitted
    assert.equal(result.paths.length, 0);
  });

  it('handles closeStroke', async () => {
    const page = makePage({
      fnArray: [OPS.moveTo, OPS.lineTo, OPS.closeStroke],
      argsArray: [[0, 792], [612, 792], []],
    });
    const result = await extractPageContent(page);
    assert.ok(result);
  });

  it('handles curveTo, curveTo2, curveTo3', async () => {
    const page = makePage({
      fnArray: [OPS.moveTo, OPS.curveTo, OPS.curveTo2, OPS.curveTo3, OPS.stroke],
      argsArray: [
        [0, 792],
        [10, 20, 30, 40, 50, 60],  // curveTo: args[4]=50, args[5]=60
        [10, 20, 100, 200],          // curveTo2: args[2]=100, args[3]=200
        [10, 20, 150, 250],          // curveTo3: args[2]=150, args[3]=250
        [],
      ],
    });
    const result = await extractPageContent(page);
    assert.ok(result);
  });

  it('handles closePath op', async () => {
    const page = makePage({
      fnArray: [
        OPS.moveTo, OPS.lineTo, OPS.lineTo, OPS.lineTo, OPS.closePath, OPS.stroke,
      ],
      argsArray: [
        [0, 0], [100, 0], [100, 100], [0, 100], [], [],
      ],
    });
    const result = await extractPageContent(page);
    // Should detect a closed rectangle
    assert.ok(result.paths.length > 0);
  });

  it('handles constructPath op with moveTo and lineTo', async () => {
    const page = makePage({
      fnArray: [OPS.constructPath, OPS.stroke],
      argsArray: [
        [[OPS.moveTo, OPS.lineTo], [0, 792, 612, 792]],
        [],
      ],
    });
    const result = await extractPageContent(page);
    assert.ok(result.paths.length > 0);
  });

  it('handles constructPath op with rectangle sub-op', async () => {
    const page = makePage({
      fnArray: [OPS.constructPath, OPS.stroke],
      argsArray: [
        [[OPS.rectangle], [50, 50, 200, 100]],
        [],
      ],
    });
    const result = await extractPageContent(page);
    // constructPath with rectangle should produce path segments
    assert.ok(result.paths.length > 0);
  });

  it('handles constructPath with closePath sub-op', async () => {
    const page = makePage({
      fnArray: [OPS.constructPath, OPS.stroke],
      argsArray: [
        [[OPS.moveTo, OPS.lineTo, OPS.closePath], [0, 0, 100, 0]],
        [],
      ],
    });
    const result = await extractPageContent(page);
    assert.ok(result);
  });

  it('handles constructPath with curveTo sub-op', async () => {
    const page = makePage({
      fnArray: [OPS.constructPath, OPS.stroke],
      argsArray: [
        [[OPS.moveTo, OPS.curveTo], [0, 0, 10, 20, 30, 40, 50, 60]],
        [],
      ],
    });
    const result = await extractPageContent(page);
    assert.ok(result);
  });

  it('handles transform op', async () => {
    const page = makePage({
      fnArray: [OPS.transform, OPS.moveTo, OPS.lineTo, OPS.stroke],
      argsArray: [[2, 0, 0, 2, 0, 0], [0, 396], [306, 396], []],
    });
    const result = await extractPageContent(page);
    assert.ok(result);
  });

  it('deduplicates near-identical paths', async () => {
    // Two identical lines at same position => should deduplicate to 1
    const page = makePage({
      fnArray: [
        OPS.moveTo, OPS.lineTo, OPS.stroke,
        OPS.moveTo, OPS.lineTo, OPS.stroke,
      ],
      argsArray: [
        [0, 792], [612, 792], [],
        [0, 792], [612, 792], [],
      ],
    });
    const result = await extractPageContent(page);
    // Should have at most 1 path after dedup (same rounded key)
    const lineCount = result.paths.filter(p => p.type === 'line').length;
    assert.ok(lineCount <= 1, 'should deduplicate identical paths');
  });

  it('flushPath ignores path with fewer than 2 points', async () => {
    // Single moveTo then stroke => should produce no paths
    const page = makePage({
      fnArray: [OPS.moveTo, OPS.stroke],
      argsArray: [[100, 100], []],
    });
    const result = await extractPageContent(page);
    assert.equal(result.paths.length, 0);
  });

  it('handles eoFillStroke op', async () => {
    const page = makePage({
      fnArray: [OPS.moveTo, OPS.lineTo, OPS.eoFillStroke],
      argsArray: [[0, 792], [612, 792], []],
    });
    const result = await extractPageContent(page);
    assert.ok(result);
  });
});

describe('extractPageContent — image extraction', () => {
  const OPS_paintImageXObject = 85;

  it('skips images when imgName is null', async () => {
    const page = {
      pageNumber: 1, _pageIndex: 0, rotate: 0,
      getViewport: () => ({ width: 612, height: 792, scale: 1.0 }),
      getTextContent: mock.fn(async () => ({ items: [], styles: {} })),
      getOperatorList: mock.fn(async () => ({
        fnArray: [OPS_paintImageXObject],
        argsArray: [[null]],
      })),
      getAnnotations: mock.fn(async () => []),
      objs: { get: () => null },
      commonObjs: { get: () => null },
    };
    const result = await extractPageContent(page);
    assert.equal(result.images.length, 0);
  });

  it('skips images smaller than 20x20', async () => {
    const page = {
      pageNumber: 1, _pageIndex: 0, rotate: 0,
      getViewport: () => ({ width: 612, height: 792, scale: 1.0 }),
      getTextContent: mock.fn(async () => ({ items: [], styles: {} })),
      getOperatorList: mock.fn(async () => ({
        fnArray: [OPS_paintImageXObject],
        argsArray: [['img1']],
      })),
      getAnnotations: mock.fn(async () => []),
      objs: { get: (name) => name === 'img1' ? { data: new Uint8Array(10 * 10 * 4), width: 10, height: 10 } : null },
      commonObjs: { get: () => null },
    };
    const result = await extractPageContent(page);
    assert.equal(result.images.length, 0);
  });

  it('skips images without data', async () => {
    const page = {
      pageNumber: 1, _pageIndex: 0, rotate: 0,
      getViewport: () => ({ width: 612, height: 792, scale: 1.0 }),
      getTextContent: mock.fn(async () => ({ items: [], styles: {} })),
      getOperatorList: mock.fn(async () => ({
        fnArray: [OPS_paintImageXObject],
        argsArray: [['img1']],
      })),
      getAnnotations: mock.fn(async () => []),
      objs: { get: (name) => name === 'img1' ? { width: 100, height: 100 } : null },
      commonObjs: { get: () => null },
    };
    const result = await extractPageContent(page);
    assert.equal(result.images.length, 0);
  });

  it('catches image extraction errors gracefully', async () => {
    const page = {
      pageNumber: 1, _pageIndex: 0, rotate: 0,
      getViewport: () => ({ width: 612, height: 792, scale: 1.0 }),
      getTextContent: mock.fn(async () => ({ items: [], styles: {} })),
      getOperatorList: mock.fn(async () => ({
        fnArray: [OPS_paintImageXObject],
        argsArray: [['img1']],
      })),
      getAnnotations: mock.fn(async () => []),
      objs: { get: () => { throw new Error('corrupt'); } },
      commonObjs: { get: () => { throw new Error('corrupt'); } },
    };
    const result = await extractPageContent(page);
    assert.equal(result.images.length, 0);
  });
});

describe('extractPageContent — annotations', () => {
  function makePage(opts = {}) {
    return {
      pageNumber: 1, _pageIndex: 0, rotate: 0,
      getViewport: () => ({ width: 612, height: 792, scale: 1.0 }),
      getTextContent: mock.fn(async () => ({
        items: opts.textItems || [{
          str: 'Click here',
          fontName: 'ArialMT',
          transform: [12, 0, 0, 12, 100, 700],
          width: 60,
          height: 12,
          dir: 'ltr',
        }],
        styles: { ArialMT: { fontFamily: 'ArialMT' } },
      })),
      getOperatorList: mock.fn(async () => ({ fnArray: [], argsArray: [] })),
      getAnnotations: mock.fn(async () => opts.annotations || []),
      objs: { get: () => null },
      commonObjs: { get: () => null },
    };
  }

  it('applies link annotations to matching text runs', async () => {
    const page = makePage({
      annotations: [{
        subtype: 'Link',
        url: 'https://example.com',
        rect: [98, 688, 162, 704],  // around x=100, y=700 in PDF coords
      }],
    });
    const result = await extractPageContent(page);
    const linkedRun = result.textRuns.find(r => r.url);
    assert.ok(linkedRun, 'should find a run with url applied');
    assert.equal(linkedRun.url, 'https://example.com');
  });

  it('returns annotations array in result', async () => {
    const page = makePage({
      annotations: [{ subtype: 'Link', url: 'https://test.com', rect: [0, 0, 100, 100] }],
    });
    const result = await extractPageContent(page);
    assert.ok(result.annotations.length > 0);
  });

  it('handles getAnnotations failure gracefully', async () => {
    const page = {
      pageNumber: 1, _pageIndex: 0, rotate: 0,
      getViewport: () => ({ width: 612, height: 792, scale: 1.0 }),
      getTextContent: mock.fn(async () => ({ items: [], styles: {} })),
      getOperatorList: mock.fn(async () => ({ fnArray: [], argsArray: [] })),
      getAnnotations: mock.fn(async () => { throw new Error('corrupt annotations'); }),
      objs: { get: () => null },
      commonObjs: { get: () => null },
    };
    const result = await extractPageContent(page);
    assert.deepEqual(result.annotations, []);
  });
});

describe('extractPageContent — text items edge cases', () => {
  function makePage(textItems, styles = {}) {
    return {
      pageNumber: 1, _pageIndex: 0, rotate: 0,
      getViewport: () => ({ width: 612, height: 792, scale: 1.0 }),
      getTextContent: mock.fn(async () => ({ items: textItems, styles })),
      getOperatorList: mock.fn(async () => ({ fnArray: [], argsArray: [] })),
      getAnnotations: mock.fn(async () => []),
      objs: { get: () => null },
      commonObjs: { get: () => null },
    };
  }

  it('skips items without transform', async () => {
    const page = makePage([{ str: 'no transform', fontName: 'ArialMT', width: 50 }]);
    const result = await extractPageContent(page);
    assert.equal(result.textRuns.length, 0);
  });

  it('skips empty string items without hasEOL', async () => {
    const page = makePage([{
      str: '',
      fontName: 'ArialMT',
      transform: [12, 0, 0, 12, 72, 700],
      hasEOL: false,
    }]);
    const result = await extractPageContent(page);
    assert.equal(result.textRuns.length, 0);
  });

  it('includes empty string items WITH hasEOL', async () => {
    const page = makePage([{
      str: '',
      fontName: 'ArialMT',
      transform: [12, 0, 0, 12, 72, 700],
      hasEOL: true,
      width: 0,
      height: 12,
    }]);
    const result = await extractPageContent(page);
    assert.equal(result.textRuns.length, 1);
  });

  it('detects bold from font name', async () => {
    const page = makePage([{
      str: 'Bold text',
      fontName: 'Arial-BoldMT',
      transform: [12, 0, 0, 12, 72, 700],
      width: 50,
      height: 12,
    }], { 'Arial-BoldMT': { fontFamily: 'Arial-BoldMT' } });
    const result = await extractPageContent(page);
    assert.ok(result.textRuns[0].bold);
  });

  it('detects italic from font name', async () => {
    const page = makePage([{
      str: 'Italic text',
      fontName: 'Arial-ItalicMT',
      transform: [12, 0, 0, 12, 72, 700],
      width: 50,
      height: 12,
    }], { 'Arial-ItalicMT': { fontFamily: 'Arial-ItalicMT' } });
    const result = await extractPageContent(page);
    assert.ok(result.textRuns[0].italic);
  });

  it('uses absolute height when item.height is negative', async () => {
    const page = makePage([{
      str: 'Test',
      fontName: 'ArialMT',
      transform: [12, 0, 0, 12, 72, 700],
      width: 30,
      height: -12,
    }], { ArialMT: { fontFamily: 'ArialMT' } });
    const result = await extractPageContent(page);
    assert.ok(result.textRuns[0].height > 0);
  });

  it('falls back to pageNumber from _pageIndex when pageNumber is 0', async () => {
    const page = makePage([]);
    page.pageNumber = 0;
    page._pageIndex = 4;
    const result = await extractPageContent(page);
    // 0 || (4 + 1) = 5
    assert.equal(result.pageNumber, 5);
  });
});

describe('extractDocumentFonts — extended', () => {
  it('merges fonts from multiple pages without overwriting', async () => {
    const mockDoc = {
      numPages: 2,
      getPage: mock.fn(async (num) => ({
        getTextContent: async () => ({
          items: [],
          styles: num === 1
            ? { 'font1': { fontFamily: 'Arial' } }
            : { 'font2': { fontFamily: 'Courier' } },
        }),
      })),
    };
    const fonts = await extractDocumentFonts(mockDoc);
    assert.ok(fonts.has('font1'));
    assert.ok(fonts.has('font2'));
  });

  it('does not overwrite existing font entry from earlier page', async () => {
    const mockDoc = {
      numPages: 2,
      getPage: mock.fn(async () => ({
        getTextContent: async () => ({
          items: [],
          styles: { 'shared': { fontFamily: 'Arial' } },
        }),
      })),
    };
    const fonts = await extractDocumentFonts(mockDoc);
    // Both pages have 'shared' but only the first one should be kept
    assert.ok(fonts.has('shared'));
    assert.equal(fonts.size, 1);
  });

  it('extracts bold weight from font name', async () => {
    const mockDoc = {
      numPages: 1,
      getPage: mock.fn(async () => ({
        getTextContent: async () => ({
          items: [],
          styles: { 'BoldFont': { fontFamily: 'Arial-Bold' } },
        }),
      })),
    };
    const fonts = await extractDocumentFonts(mockDoc);
    assert.equal(fonts.get('BoldFont').weight, 700);
  });

  it('extracts italic style from font name', async () => {
    const mockDoc = {
      numPages: 1,
      getPage: mock.fn(async () => ({
        getTextContent: async () => ({
          items: [],
          styles: { 'ItalicFont': { fontFamily: 'Arial-Italic' } },
        }),
      })),
    };
    const fonts = await extractDocumentFonts(mockDoc);
    assert.equal(fonts.get('ItalicFont').style, 'italic');
  });

  it('classifies monospace font family', async () => {
    const mockDoc = {
      numPages: 1,
      getPage: mock.fn(async () => ({
        getTextContent: async () => ({
          items: [],
          styles: { 'MonoFont': { fontFamily: 'CourierNew' } },
        }),
      })),
    };
    const fonts = await extractDocumentFonts(mockDoc);
    assert.equal(fonts.get('MonoFont').family, 'monospace');
  });

  it('classifies serif font family', async () => {
    const mockDoc = {
      numPages: 1,
      getPage: mock.fn(async () => ({
        getTextContent: async () => ({
          items: [],
          styles: { 'SerifFont': { fontFamily: 'TimesNewRoman' } },
        }),
      })),
    };
    const fonts = await extractDocumentFonts(mockDoc);
    assert.equal(fonts.get('SerifFont').family, 'serif');
  });

  it('uses default descent/ascent when not provided', async () => {
    const mockDoc = {
      numPages: 1,
      getPage: mock.fn(async () => ({
        getTextContent: async () => ({
          items: [],
          styles: { 'Plain': { fontFamily: 'Arial' } },
        }),
      })),
    };
    const fonts = await extractDocumentFonts(mockDoc);
    assert.equal(fonts.get('Plain').descent, -0.2);
    assert.equal(fonts.get('Plain').ascent, 0.8);
  });

  it('returns empty map when styles is null', async () => {
    const mockDoc = {
      numPages: 1,
      getPage: mock.fn(async () => ({
        getTextContent: async () => ({
          items: [],
          styles: null,
        }),
      })),
    };
    const fonts = await extractDocumentFonts(mockDoc);
    assert.equal(fonts.size, 0);
  });
});
