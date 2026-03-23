import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyseOcrFontCharacteristics,
  matchFontFromOcr,
  decomposeScannedPage,
} from '../../app/modules/scan-decomposer.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWord(text, x0, y0, x1, y1, attrs = {}) {
  return { text, bbox: { x0, y0, x1, y1 }, fontAttributes: attrs };
}

// Create a mock canvas element with a controllable getContext
function makeCanvas(width, height, pixels = null) {
  const defaultPixels = pixels || new Uint8ClampedArray(width * height * 4).fill(200);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.naturalWidth = width;
  canvas.naturalHeight = height;

  canvas.getContext = () => ({
    drawImage() {},
    fillRect() {},
    fillStyle: '',
    getImageData: (x, y, w, h) => ({
      data: defaultPixels,
      width: w,
      height: h,
    }),
  });

  // toBlob returns a minimal Blob for _canvasToBytes
  canvas.toBlob = (cb, type) => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: type || 'image/png' });
    blob.arrayBuffer = async () => new Uint8Array([1, 2, 3, 4]).buffer;
    cb(blob);
  };

  return canvas;
}

// Mock image element for decomposeScannedPage
function makeImageEl(w = 100, h = 100) {
  const img = document.createElement('canvas'); // Use canvas as it has similar interface
  img.naturalWidth = w;
  img.naturalHeight = h;

  // Add the 'naturalWidth' property to identify it as an image element
  Object.defineProperty(img, 'naturalWidth', { value: w, writable: true });
  Object.defineProperty(img, 'naturalHeight', { value: h, writable: true });

  img.getContext = () => ({
    drawImage() {},
    fillRect() {},
    fillStyle: '',
    getImageData: (x, y, w, h) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(128),
      width: w,
      height: h,
    }),
  });
  img.toBlob = (cb, type) => {
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    blob.arrayBuffer = async () => new Uint8Array([1, 2, 3]).buffer;
    cb(blob);
  };
  return img;
}

// ── analyseOcrFontCharacteristics ────────────────────────────────────────────

describe('analyseOcrFontCharacteristics', () => {
  it('returns defaults for empty words array', () => {
    const result = analyseOcrFontCharacteristics({ words: [] });
    assert.equal(result.isSerif, false);
    assert.equal(result.weight, 400);
    assert.equal(result.isItalic, false);
    assert.equal(result.xHeightRatio, 0.5);
    assert.equal(result.aspectRatio, 0.56);
  });

  it('returns defaults when words is not provided', () => {
    const result = analyseOcrFontCharacteristics({});
    assert.equal(result.weight, 400);
    assert.equal(result.isItalic, false);
  });

  it('filters out words with empty text', () => {
    const words = [
      makeWord('', 0, 0, 50, 20),
      makeWord('   ', 60, 0, 110, 20),
      makeWord('Hello', 120, 0, 170, 20),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    // Should behave like only one valid word
    assert.equal(typeof result.weight, 'number');
  });

  it('filters out words without bbox', () => {
    const words = [
      { text: 'Hello', fontAttributes: {} },
      makeWord('World', 0, 0, 50, 20),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(typeof result.aspectRatio, 'number');
  });

  it('detects bold when majority of words are bold', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { isBold: true }),
      makeWord('World', 60, 0, 110, 20, { isBold: true }),
      makeWord('test', 120, 0, 160, 20, { isBold: false }),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.weight, 700);
  });

  it('uses weight 400 when less than half are bold', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { isBold: false }),
      makeWord('World', 60, 0, 110, 20, { isBold: false }),
      makeWord('Bold', 120, 0, 160, 20, { isBold: true }),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.weight, 400);
  });

  it('detects italic when majority are italic', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { isItalic: true }),
      makeWord('World', 60, 0, 110, 20, { isItalic: true }),
      makeWord('Normal', 120, 0, 160, 20, { isItalic: false }),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isItalic, true);
  });

  it('detects non-italic when minority are italic', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { isItalic: false }),
      makeWord('World', 60, 0, 110, 20, { isItalic: false }),
      makeWord('Italic', 120, 0, 160, 20, { isItalic: true }),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isItalic, false);
  });

  it('computes aspect ratio from bounding boxes', () => {
    const words = [
      makeWord('MMMM', 0, 0, 40, 20),  // charW=10, h=20, ratio=0.5
      makeWord('MMMM', 50, 0, 90, 20), // same
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(typeof result.aspectRatio, 'number');
    assert.ok(result.aspectRatio > 0 && result.aspectRatio < 1);
  });

  it('handles zero-height words in aspect ratio (h=0 fallback)', () => {
    const words = [
      makeWord('AB', 0, 10, 20, 10), // height=0 (y0==y1)
      makeWord('CD', 30, 0, 50, 20), // normal
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(typeof result.aspectRatio, 'number');
  });

  it('computes xHeightRatio from lowercase vs uppercase words', () => {
    const words = [
      makeWord('abc', 0, 5, 30, 15),    // lowercase, height=10
      makeWord('xyz', 40, 5, 70, 15),   // lowercase, height=10
      makeWord('ABC', 80, 0, 110, 20),  // uppercase, height=20
      makeWord('XYZ', 120, 0, 150, 20), // uppercase, height=20
    ];
    const result = analyseOcrFontCharacteristics({ words });
    // xHeightRatio = 10/20 = 0.5
    assert.ok(result.xHeightRatio > 0 && result.xHeightRatio <= 1);
  });

  it('caps xHeightRatio at 0.95', () => {
    const words = [
      makeWord('abc', 0, 0, 30, 18),  // lowercase, height=18
      makeWord('ABC', 40, 0, 70, 20), // uppercase, height=20
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.ok(result.xHeightRatio <= 0.95);
  });

  it('detects serif from fontName attribute', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { fontName: 'TimesNewRoman' }),
      makeWord('World', 60, 0, 110, 20, { fontName: 'times' }),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isSerif, true);
  });

  it('detects serif from "roman" in fontName', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { fontName: 'romanBold' }),
      makeWord('World', 60, 0, 110, 20, { fontName: 'Garamond' }),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isSerif, true);
  });

  it('detects sans-serif when fontName contains "sans"', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { fontName: 'sansserif' }),
      makeWord('World', 60, 0, 110, 20, { fontName: 'Arial' }),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isSerif, false);
  });

  it('detects sans-serif via fontName Arial (not serif keyword)', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { fontName: 'Arial' }),
      makeWord('World', 60, 0, 110, 20, { fontName: 'Helvetica' }),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isSerif, false);
  });

  it('uses narrow aspect ratio as serif fallback when no fontNames', () => {
    // aspectRatio < 0.50 → serif
    // Make very narrow characters: text='A' (1 char), width=8, height=20 → charW=8, ratio=0.4
    const words = [
      makeWord('A', 0, 0, 8, 20),
      makeWord('B', 20, 0, 28, 20),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    // Narrow aspect ratio should result in isSerif=true
    assert.equal(result.isSerif, aspectRatioIsSerifForWords(words));
  });

  it('uses wide aspect ratio as sans-serif fallback when no fontNames', () => {
    // Wide aspect ratio: 1 char, width=40, height=20 → ratio=2.0
    const words = [
      makeWord('M', 0, 0, 40, 20),
      makeWord('W', 50, 0, 90, 20),
    ];
    const result = analyseOcrFontCharacteristics({ words });
    assert.equal(result.isSerif, false);
  });

  it('returns correct properties structure', () => {
    const result = analyseOcrFontCharacteristics({ words: [makeWord('hi', 0, 0, 20, 10)] });
    assert.ok('isSerif' in result);
    assert.ok('weight' in result);
    assert.ok('isItalic' in result);
    assert.ok('xHeightRatio' in result);
    assert.ok('aspectRatio' in result);
  });
});

// Helper to predict serif/not based on aspect ratio
function aspectRatioIsSerifForWords(words) {
  const validWords = words.filter(w => w.text && w.text.trim() && w.bbox);
  const aspectRatios = validWords.map(w => {
    const h = w.bbox.y1 - w.bbox.y0;
    const charW = h === 0 ? 0 : (w.bbox.x1 - w.bbox.x0) / Math.max(w.text.length, 1);
    return h > 0 ? charW / h : 0.56;
  }).filter(r => r > 0);
  const median = aspectRatios.sort((a, b) => a - b);
  const mid = Math.floor(median.length / 2);
  const medianVal = median.length % 2 === 0 ? (median[mid - 1] + median[mid]) / 2 : median[mid];
  return medianVal < 0.50;
}

// ── matchFontFromOcr ──────────────────────────────────────────────────────────

describe('matchFontFromOcr', () => {
  it('returns a FontMatchResult with all required properties', () => {
    const result = matchFontFromOcr({ words: [] });
    assert.ok('family' in result);
    assert.ok('weight' in result);
    assert.ok('style' in result);
    assert.ok('score' in result);
    assert.ok('characteristics' in result);
  });

  it('returns style normal for non-italic text', () => {
    const words = [makeWord('Hello', 0, 0, 50, 20, { isItalic: false })];
    const result = matchFontFromOcr({ words });
    assert.equal(result.style, 'normal');
  });

  it('returns style italic for italic text', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { isItalic: true }),
      makeWord('World', 60, 0, 110, 20, { isItalic: true }),
    ];
    const result = matchFontFromOcr({ words });
    assert.equal(result.style, 'italic');
  });

  it('returns a score between 0 and 1', () => {
    const result = matchFontFromOcr({ words: [] });
    assert.ok(result.score >= 0 && result.score <= 1);
  });

  it('score is higher for better match', () => {
    // Bold serif → should score higher for Times New Roman bold than Arial regular
    const boldSerifWords = [
      makeWord('Hello', 0, 0, 26, 20, { isBold: true, fontName: 'TimesNewRoman' }),
      makeWord('World', 30, 0, 56, 20, { isBold: true, fontName: 'TimesNewRoman' }),
    ];
    const result = matchFontFromOcr({ words: boldSerifWords });
    assert.ok(result.score > 0.5, `Expected score > 0.5, got ${result.score}`);
  });

  it('matches bold weight for bold OCR input', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { isBold: true }),
      makeWord('World', 60, 0, 110, 20, { isBold: true }),
    ];
    const result = matchFontFromOcr({ words });
    assert.equal(result.weight, 700);
  });

  it('matches regular weight for non-bold text', () => {
    const words = [
      makeWord('Hello', 0, 0, 50, 20, { isBold: false }),
      makeWord('World', 60, 0, 110, 20, { isBold: false }),
    ];
    const result = matchFontFromOcr({ words });
    assert.equal(result.weight, 400);
  });

  it('matches serif font for text with serif fontName', () => {
    const words = [
      makeWord('Hello', 0, 0, 26, 20, { fontName: 'TimesNewRoman' }),
      makeWord('World', 30, 0, 56, 20, { fontName: 'TimesRoman' }),
    ];
    const result = matchFontFromOcr({ words });
    const serifFamilies = ['Times New Roman', 'Georgia', 'Courier New'];
    assert.ok(serifFamilies.includes(result.family), `Expected serif, got ${result.family}`);
  });

  it('returns a font family string', () => {
    const result = matchFontFromOcr({ words: [] });
    assert.equal(typeof result.family, 'string');
    assert.ok(result.family.length > 0);
  });

  it('characteristics matches the analysed chars', () => {
    const words = [makeWord('test', 0, 0, 40, 20, { isBold: true })];
    const result = matchFontFromOcr({ words });
    assert.equal(result.characteristics.weight, 700);
  });

  it('sorts candidates and picks best match', () => {
    // All default: sans-serif, regular
    const result1 = matchFontFromOcr({ words: [] });
    assert.ok(typeof result1.family === 'string');

    // Explicit sans-serif wide aspect ratio
    const sansWords = [
      makeWord('MM', 0, 0, 72, 20, { fontName: 'Arial' }),
    ];
    const result2 = matchFontFromOcr({ words: sansWords });
    // Should pick a sans-serif font
    const sansFamilies = ['Arial', 'Helvetica Neue', 'Verdana', 'Calibri'];
    assert.ok(sansFamilies.some(f => result2.family.includes(f.split(' ')[0])));
  });
});

// ── decomposeScannedPage ──────────────────────────────────────────────────────

describe('decomposeScannedPage', () => {
  it('processes an image element directly', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };

    // Create a canvas returned by document.createElement
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(100 * 100 * 4).fill(200) }),
    };
    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: () => mockCtx,
      toBlob: (cb, type) => {
        const blob = {
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
        cb(blob);
      },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => {
      if (tag === 'canvas') return mockCanvas;
      return origCreate(tag);
    };

    const ocrResult = {
      words: [
        makeWord('Hello', 10, 10, 50, 30),
        makeWord('World', 60, 10, 100, 30),
      ],
    };

    const result = await decomposeScannedPage(imgEl, ocrResult, 595, 842);
    document.createElement = origCreate;

    assert.ok('backgroundImage' in result);
    assert.ok('backgroundMime' in result);
    assert.ok('textBlocks' in result);
    assert.ok('fontMatch' in result);
  });

  it('returns correct backgroundMime for png (default)', async () => {
    const imgEl = { naturalWidth: 50, naturalHeight: 50 };
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(50 * 50 * 4).fill(255) }),
    };
    const mockCanvas = {
      width: 50, height: 50,
      getContext: () => mockCtx,
      toBlob: (cb) => {
        const blob = { arrayBuffer: async () => new Uint8Array([1]).buffer };
        cb(blob);
      },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const result = await decomposeScannedPage(imgEl, { words: [] }, 100, 100);
    document.createElement = origCreate;

    assert.equal(result.backgroundMime, 'image/png');
  });

  it('respects outputMime option for jpeg', async () => {
    const imgEl = { naturalWidth: 50, naturalHeight: 50 };
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(50 * 50 * 4).fill(255) }),
    };
    let usedMime = null;
    const mockCanvas = {
      width: 50, height: 50,
      getContext: () => mockCtx,
      toBlob: (cb, type) => {
        usedMime = type;
        const blob = { arrayBuffer: async () => new Uint8Array([1]).buffer };
        cb(blob);
      },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const result = await decomposeScannedPage(imgEl, { words: [] }, 100, 100, { outputMime: 'image/jpeg' });
    document.createElement = origCreate;

    assert.equal(result.backgroundMime, 'image/jpeg');
  });

  it('creates text blocks for each OCR word', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4).fill(128) }),
    };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => mockCtx,
      toBlob: (cb) => { cb({ arrayBuffer: async () => new Uint8Array([1]).buffer }); },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const ocrResult = {
      words: [
        makeWord('Hello', 10, 10, 50, 30),
        makeWord('World', 60, 10, 100, 30),
        makeWord('  ', 0, 0, 20, 10), // should be filtered out
      ],
    };

    const result = await decomposeScannedPage(imgEl, ocrResult, 595, 842);
    document.createElement = origCreate;

    assert.equal(result.textBlocks.length, 2);
    assert.equal(result.textBlocks[0].text, 'Hello');
    assert.equal(result.textBlocks[1].text, 'World');
  });

  it('text blocks have correct bbox coordinate conversion', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4).fill(100) }),
    };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => mockCtx,
      toBlob: (cb) => { cb({ arrayBuffer: async () => new Uint8Array([1]).buffer }); },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    // pageWidthPt=100, pageHeightPt=100, imgWidth=100, imgHeight=100 → scale=1
    const ocrResult = {
      words: [makeWord('Test', 10, 20, 50, 40)], // x0=10, y0=20, x1=50, y1=40
    };

    const result = await decomposeScannedPage(imgEl, ocrResult, 100, 100);
    document.createElement = origCreate;

    const block = result.textBlocks[0];
    // x = x0 * scaleX = 10 * 1 = 10
    assert.equal(block.bbox.x, 10);
    // y = pageH - y1 * scaleY = 100 - 40 * 1 = 60 (Y flipped)
    assert.equal(block.bbox.y, 60);
    // width = (x1-x0)*scaleX = 40
    assert.equal(block.bbox.width, 40);
    // height = (y1-y0)*scaleY = 20
    assert.equal(block.bbox.height, 20);
  });

  it('text block includes font properties from fontMatch', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4).fill(100) }),
    };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => mockCtx,
      toBlob: (cb) => { cb({ arrayBuffer: async () => new Uint8Array([1]).buffer }); },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const ocrResult = { words: [makeWord('Test', 10, 20, 50, 40)] };
    const result = await decomposeScannedPage(imgEl, ocrResult, 100, 100);
    document.createElement = origCreate;

    const block = result.textBlocks[0];
    assert.equal(typeof block.fontFamily, 'string');
    assert.ok([400, 700].includes(block.fontWeight));
    assert.ok(['normal', 'italic'].includes(block.fontStyle));
    assert.equal(typeof block.color, 'string');
  });

  it('respects expandPx option', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    let fillRectCalls = [];
    const mockCtx = {
      drawImage() {},
      fillRect(x, y, w, h) { fillRectCalls.push({ x, y, w, h }); },
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4).fill(100) }),
    };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => mockCtx,
      toBlob: (cb) => { cb({ arrayBuffer: async () => new Uint8Array([1]).buffer }); },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const ocrResult = { words: [makeWord('Test', 10, 10, 50, 30)] };
    // expandPx=5 → word bbox should be expanded by 5px
    await decomposeScannedPage(imgEl, ocrResult, 100, 100, { expandPx: 5 });
    document.createElement = origCreate;

    assert.ok(fillRectCalls.length > 0);
    // x should be max(0, 10-5) = 5
    assert.equal(fillRectCalls[0].x, 5);
    // y should be max(0, 10-5) = 5
    assert.equal(fillRectCalls[0].y, 5);
  });

  it('handles words with no text (skips them)', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4).fill(200) }),
    };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => mockCtx,
      toBlob: (cb) => { cb({ arrayBuffer: async () => new Uint8Array([1]).buffer }); },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const ocrResult = {
      words: [
        { text: '', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
        { text: null, bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
        { text: 'Valid', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
      ],
    };

    const result = await decomposeScannedPage(imgEl, ocrResult, 100, 100);
    document.createElement = origCreate;

    assert.equal(result.textBlocks.length, 1);
  });

  it('handles words without bbox (skips them)', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4).fill(200) }),
    };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => mockCtx,
      toBlob: (cb) => { cb({ arrayBuffer: async () => new Uint8Array([1]).buffer }); },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const ocrResult = {
      words: [{ text: 'NoBbox' }],
    };

    const result = await decomposeScannedPage(imgEl, ocrResult, 100, 100);
    document.createElement = origCreate;

    assert.equal(result.textBlocks.length, 0);
  });

  it('returns [] when ctx is null', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => null,
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const result = await decomposeScannedPage(imgEl, { words: [] }, 100, 100);
    document.createElement = origCreate;

    // Returns [] when ctx is null
    assert.deepEqual(result, []);
  });

  it('includes confidence from OCR word when available', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4).fill(100) }),
    };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => mockCtx,
      toBlob: (cb) => { cb({ arrayBuffer: async () => new Uint8Array([1]).buffer }); },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const word = makeWord('Test', 10, 20, 50, 40);
    word.confidence = 95;
    const result = await decomposeScannedPage(imgEl, { words: [word] }, 100, 100);
    document.createElement = origCreate;

    assert.equal(result.textBlocks[0].confidence, 95);
  });

  it('defaults confidence to 0 when not provided', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    const mockCtx = {
      drawImage() {},
      fillRect() {},
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4).fill(100) }),
    };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => mockCtx,
      toBlob: (cb) => { cb({ arrayBuffer: async () => new Uint8Array([1]).buffer }); },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const result = await decomposeScannedPage(imgEl, { words: [makeWord('Test', 10, 20, 50, 40)] }, 100, 100);
    document.createElement = origCreate;

    assert.equal(result.textBlocks[0].confidence, 0);
  });

  it('uses default expandPx=2 when not specified', async () => {
    const imgEl = { naturalWidth: 100, naturalHeight: 100 };
    let fillCalls = [];
    const mockCtx = {
      drawImage() {},
      fillRect(x, y, w, h) { fillCalls.push({ x, y, w, h }); },
      fillStyle: '',
      getImageData: () => ({ data: new Uint8ClampedArray(4).fill(100) }),
    };
    const mockCanvas = {
      width: 100, height: 100,
      getContext: () => mockCtx,
      toBlob: (cb) => { cb({ arrayBuffer: async () => new Uint8Array([1]).buffer }); },
    };

    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => tag === 'canvas' ? mockCanvas : origCreate(tag);

    const ocrResult = { words: [makeWord('Test', 10, 10, 50, 30)] };
    await decomposeScannedPage(imgEl, ocrResult, 100, 100);
    document.createElement = origCreate;

    // With expandPx=2, x = max(0, 10-2) = 8
    assert.equal(fillCalls[0].x, 8);
  });
});
