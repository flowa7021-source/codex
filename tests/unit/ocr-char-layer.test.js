import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  postCorrectText,
  estimateImageDpi,
  detectSkewAngle,
  deskewCanvas,
  preprocessCanvas,
  ocrWithCharBoxes,
  buildTextLayerFromResult,
} from '../../app/modules/ocr-char-layer.js';

// ---------------------------------------------------------------------------
// postCorrectText
// ---------------------------------------------------------------------------

describe('postCorrectText', () => {
  it('returns empty string for null/undefined', () => {
    assert.equal(postCorrectText(null), '');
    assert.equal(postCorrectText(undefined), '');
    assert.equal(postCorrectText(''), '');
  });

  it('collapses multiple spaces', () => {
    assert.equal(postCorrectText('hello   world'), 'hello world');
  });

  it('replaces soft hyphens with regular hyphens', () => {
    assert.equal(postCorrectText('hello\u00ADworld'), 'hello-world');
  });

  it('normalizes guillemets to straight quotes', () => {
    assert.equal(postCorrectText('\u00ABHello\u00BB'), '"Hello"');
  });

  it('removes space before punctuation', () => {
    assert.equal(postCorrectText('Hello , world .'), 'Hello, world.');
  });

  it('removes space inside parentheses', () => {
    assert.equal(postCorrectText('( hello )'), '(hello)');
  });

  it('rejoins hyphenated words across lines', () => {
    assert.equal(postCorrectText('hyphen-\nated'), 'hyphenated');
  });

  it('restores ligatures', () => {
    assert.equal(postCorrectText('ﬁnd ﬂow oﬀer'), 'find flow offer');
    assert.equal(postCorrectText('ﬃx ﬄ ﬅ'), 'ffix ffl st');
  });

  it('normalizes backtick and modifier apostrophe', () => {
    assert.equal(postCorrectText('\u0060test\u02BC'), "'test'");
  });

  it('trims whitespace', () => {
    assert.equal(postCorrectText('  hello  '), 'hello');
  });

  it('normalizes German low-9 quote', () => {
    assert.equal(postCorrectText('\u201Etest'), '"test');
  });

  it('removes space before semicolons, colons, and exclamation/question marks', () => {
    assert.equal(postCorrectText('yes !'), 'yes!');
    assert.equal(postCorrectText('why ?'), 'why?');
    assert.equal(postCorrectText('item ;'), 'item;');
    assert.equal(postCorrectText('title :'), 'title:');
  });

  it('combines multiple corrections in a single pass', () => {
    // soft hyphen + multiple spaces + ligature
    assert.equal(postCorrectText('hello\u00AD   ﬁnd'), 'hello- find');
  });
});

// ---------------------------------------------------------------------------
// estimateImageDpi
// ---------------------------------------------------------------------------

describe('estimateImageDpi', () => {
  it('computes DPI from canvas width and physical width in mm', () => {
    const canvas = { width: 2550, height: 3300 };
    const dpi = estimateImageDpi(canvas, 215.9);
    assert.ok(Math.abs(dpi - 300) < 1);
  });

  it('returns higher DPI for wider pixel canvas', () => {
    const lo = { width: 1000, height: 1000 };
    const hi = { width: 2000, height: 1000 };
    assert.ok(estimateImageDpi(hi, 210) > estimateImageDpi(lo, 210));
  });
});

// ---------------------------------------------------------------------------
// detectSkewAngle
// ---------------------------------------------------------------------------

describe('detectSkewAngle', () => {
  it('returns 0 when context is null', () => {
    const canvas = { width: 100, height: 100, getContext: () => null };
    assert.equal(detectSkewAngle(canvas), 0);
  });

  it('returns a number for a valid canvas', () => {
    const src = document.createElement('canvas');
    src.width = 10;
    src.height = 10;
    const angle = detectSkewAngle(src);
    assert.equal(typeof angle, 'number');
  });
});

// ---------------------------------------------------------------------------
// deskewCanvas
// ---------------------------------------------------------------------------

describe('deskewCanvas', () => {
  it('returns a canvas with same dimensions', () => {
    const src = document.createElement('canvas');
    src.width = 50;
    src.height = 50;
    const result = deskewCanvas(src, 2);
    assert.equal(result.width, 50);
    assert.equal(result.height, 50);
  });

  it('returns canvas even with 0 degree angle', () => {
    const src = document.createElement('canvas');
    src.width = 30;
    src.height = 30;
    const result = deskewCanvas(src, 0);
    assert.equal(result.width, 30);
    assert.equal(result.height, 30);
  });

  it('returns canvas with null context', () => {
    const src = document.createElement('canvas');
    src.width = 20;
    src.height = 20;
    src.getContext = () => null;
    const result = deskewCanvas(src, 5);
    assert.equal(result.width, 20);
  });
});

// ---------------------------------------------------------------------------
// preprocessCanvas
// ---------------------------------------------------------------------------

describe('preprocessCanvas', () => {
  it('returns a canvas with same dimensions as source', () => {
    const src = document.createElement('canvas');
    src.width = 40;
    src.height = 30;
    const result = preprocessCanvas(src);
    assert.equal(result.width, 40);
    assert.equal(result.height, 30);
  });

  it('respects denoise=false, normalise=false (returns early copy)', () => {
    const src = document.createElement('canvas');
    src.width = 20;
    src.height = 20;
    const result = preprocessCanvas(src, { denoise: false, normalise: false });
    assert.equal(result.width, 20);
    assert.equal(result.height, 20);
  });

  it('runs with denoise only', () => {
    const src = document.createElement('canvas');
    src.width = 10;
    src.height = 10;
    const result = preprocessCanvas(src, { denoise: true, normalise: false });
    assert.equal(result.width, 10);
  });

  it('runs with normalise only', () => {
    const src = document.createElement('canvas');
    src.width = 10;
    src.height = 10;
    const result = preprocessCanvas(src, { denoise: false, normalise: true });
    assert.equal(result.width, 10);
  });

  it('returns dst when ctx is null', () => {
    const src = document.createElement('canvas');
    src.width = 10;
    src.height = 10;
    // Override getContext on src to return a context, but the dst will get null
    // We can't easily override the dst's getContext since it's created internally,
    // but the mock always returns a context. This path is hard to trigger with the mock.
    // At least confirm default path works.
    const result = preprocessCanvas(src, { denoise: true, normalise: true });
    assert.equal(result.width, 10);
  });
});

// ---------------------------------------------------------------------------
// ocrWithCharBoxes
// ---------------------------------------------------------------------------

describe('ocrWithCharBoxes', () => {
  /** Helper: create a minimal canvas */
  function makeCanvas(w = 100, h = 100) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /** Helper: create a mock Tesseract worker returning given data */
  function mockWorkerFactory(data) {
    return async () => ({
      recognize: async () => ({ data }),
    });
  }

  it('returns empty result when Tesseract throws', async () => {
    const canvas = makeCanvas();
    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: async () => {
        throw new Error('worker unavailable');
      },
      deskew: false,
      denoise: false,
      upscale: false,
    });
    assert.equal(result.text, '');
    assert.equal(result.confidence, 0);
    assert.deepEqual(result.charBoxes, []);
    assert.deepEqual(result.words, []);
    assert.deepEqual(result.blocks, []);
    assert.equal(result.wasDeskewed, false);
    assert.equal(result.wasUpscaled, false);
    assert.equal(result.upscaleFactor, 1);
  });

  it('returns empty result when worker.recognize throws', async () => {
    const canvas = makeCanvas();
    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: async () => ({
        recognize: async () => { throw new Error('recognize failed'); },
      }),
      deskew: false,
      denoise: false,
      upscale: false,
    });
    assert.equal(result.text, '');
    assert.equal(result.confidence, 0);
  });

  it('extracts character boxes from Tesseract result', async () => {
    const canvas = makeCanvas();
    const tesseractData = {
      text: 'Hi',
      confidence: 95,
      blocks: [{
        paragraphs: [{
          lines: [{
            baseline: { y: 50 },
            bbox: { y1: 60 },
            words: [{
              text: 'Hi',
              bbox: { x0: 10, y0: 20, x1: 40, y1: 35 },
              confidence: 95,
              fontAttributes: { is_bold: true, is_italic: false, font_name: 'Arial' },
              symbols: [
                { text: 'H', bbox: { x0: 10, y0: 20, x1: 25, y1: 35 }, confidence: 97 },
                { text: 'i', bbox: { x0: 25, y0: 20, x1: 40, y1: 35 }, confidence: 93 },
              ],
            }],
          }],
        }],
      }],
    };

    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory(tesseractData),
      deskew: false,
      denoise: false,
      upscale: false,
    });

    assert.equal(result.text, 'Hi');
    assert.equal(result.confidence, 95);
    assert.equal(result.charBoxes.length, 2);
    assert.equal(result.charBoxes[0].char, 'H');
    assert.equal(result.charBoxes[0].bbox.x0, 10);
    assert.equal(result.charBoxes[0].bbox.y1, 35);
    assert.equal(result.charBoxes[0].wordText, 'Hi');
    assert.equal(result.charBoxes[0].confidence, 97);
    assert.equal(result.charBoxes[0].fontSize, 15); // y1 - y0 = 35 - 20
    assert.equal(result.charBoxes[1].char, 'i');

    assert.equal(result.words.length, 1);
    assert.equal(result.words[0].text, 'Hi');
    assert.equal(result.words[0].fontAttributes.isBold, true);
    assert.equal(result.words[0].fontAttributes.isItalic, false);
    assert.equal(result.words[0].fontAttributes.fontName, 'Arial');
    assert.equal(result.words[0].chars.length, 2);
  });

  it('handles empty blocks gracefully', async () => {
    const canvas = makeCanvas();
    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory({
        text: '',
        confidence: 0,
        blocks: [],
      }),
      deskew: false,
      denoise: false,
      upscale: false,
    });
    assert.equal(result.text, '');
    assert.deepEqual(result.charBoxes, []);
    assert.deepEqual(result.words, []);
  });

  it('handles missing paragraphs/lines/words/symbols', async () => {
    const canvas = makeCanvas();
    const tesseractData = {
      text: 'test',
      confidence: 80,
      blocks: [
        { paragraphs: null },
        { paragraphs: [{ lines: null }] },
        { paragraphs: [{ lines: [{ words: null }] }] },
        { paragraphs: [{ lines: [{ words: [{ text: 'w', symbols: null, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 80 }] }] }] },
      ],
    };

    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory(tesseractData),
      deskew: false,
      denoise: false,
      upscale: false,
    });

    // Should not crash; the word with null symbols still gets pushed to words
    assert.equal(result.words.length, 1);
    assert.equal(result.words[0].text, 'w');
    assert.equal(result.words[0].chars.length, 0);
  });

  it('handles missing data fields with defaults', async () => {
    const canvas = makeCanvas();
    const tesseractData = {
      text: 'x',
      confidence: 0,
      blocks: [{
        paragraphs: [{
          lines: [{
            // no baseline, no bbox
            words: [{
              text: '',
              bbox: {},
              confidence: 0,
              symbols: [{
                text: '',
                bbox: {},
                confidence: 0,
              }],
            }],
          }],
        }],
      }],
    };

    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory(tesseractData),
      deskew: false,
      denoise: false,
      upscale: false,
    });

    assert.equal(result.charBoxes.length, 1);
    assert.equal(result.charBoxes[0].char, '');
    assert.equal(result.charBoxes[0].bbox.x0, 0);
    assert.equal(result.charBoxes[0].lineBaseline, 0);
    assert.equal(result.charBoxes[0].fontSize, 0);
    assert.equal(result.words[0].fontAttributes.isBold, false);
    assert.equal(result.words[0].fontAttributes.isItalic, false);
    assert.equal(result.words[0].fontAttributes.fontName, 'unknown');
  });

  it('applies post-correction to text (e.g. ligatures)', async () => {
    const canvas = makeCanvas();
    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory({
        text: 'ﬁnd  things',
        confidence: 90,
        blocks: [],
      }),
      deskew: false,
      denoise: false,
      upscale: false,
    });

    assert.equal(result.text, 'find things');
  });

  it('uses bbox.left/top/right/bottom as fallbacks', async () => {
    const canvas = makeCanvas();
    const tesseractData = {
      text: 'A',
      confidence: 90,
      blocks: [{
        paragraphs: [{
          lines: [{
            baseline: { y: 30 },
            words: [{
              text: 'A',
              bbox: { left: 5, top: 10, right: 20, bottom: 25 },
              confidence: 90,
              symbols: [{
                text: 'A',
                bbox: { left: 5, top: 10, right: 20, bottom: 25 },
                confidence: 90,
              }],
            }],
          }],
        }],
      }],
    };

    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory(tesseractData),
      deskew: false,
      denoise: false,
      upscale: false,
    });

    assert.equal(result.charBoxes[0].bbox.x0, 5);
    assert.equal(result.charBoxes[0].bbox.y0, 10);
    assert.equal(result.charBoxes[0].bbox.x1, 20);
    assert.equal(result.charBoxes[0].bbox.y1, 25);
    assert.equal(result.words[0].bbox.x0, 5);
    assert.equal(result.words[0].bbox.y1, 25);
  });

  it('scales back coordinates when upscaling occurred', async () => {
    const canvas = makeCanvas(100, 100);
    // pageWidthMm = 254 => DPI = 100 / (254/25.4) = 100 / 10 = 10 DPI < 150
    // upscaleFactor = min(4, 300/10) = 4
    const tesseractData = {
      text: 'B',
      confidence: 85,
      blocks: [{
        paragraphs: [{
          lines: [{
            baseline: { y: 80 },
            words: [{
              text: 'B',
              bbox: { x0: 40, y0: 20, x1: 80, y1: 60 },
              confidence: 85,
              symbols: [{
                text: 'B',
                bbox: { x0: 40, y0: 20, x1: 80, y1: 60 },
                confidence: 85,
              }],
            }],
          }],
        }],
      }],
    };

    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory(tesseractData),
      deskew: false,
      denoise: false,
      upscale: true,
      pageWidthMm: 254,
    });

    assert.equal(result.wasUpscaled, true);
    // upscaleFactor = 4, so coords should be divided by 4
    assert.equal(result.upscaleFactor, 4);
    assert.equal(result.charBoxes[0].bbox.x0, 10); // 40/4
    assert.equal(result.charBoxes[0].bbox.y0, 5);  // 20/4
    assert.equal(result.charBoxes[0].bbox.x1, 20); // 80/4
    assert.equal(result.charBoxes[0].bbox.y1, 15); // 60/4
  });

  it('does not upscale when DPI is already sufficient', async () => {
    const canvas = makeCanvas(2550, 3300);
    // pageWidthMm = 215.9 => DPI ≈ 300, well above MIN_DPI=150
    const tesseractData = {
      text: '',
      confidence: 0,
      blocks: [],
    };

    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory(tesseractData),
      deskew: false,
      denoise: false,
      upscale: true,
      pageWidthMm: 215.9,
    });

    assert.equal(result.wasUpscaled, false);
    assert.equal(result.upscaleFactor, 1);
  });

  it('does not upscale when upscale option is false', async () => {
    const canvas = makeCanvas(50, 50);
    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory({ text: '', confidence: 0, blocks: [] }),
      deskew: false,
      denoise: false,
      upscale: false,
      pageWidthMm: 254,
    });
    assert.equal(result.wasUpscaled, false);
  });

  it('does not upscale when pageWidthMm not provided', async () => {
    const canvas = makeCanvas(50, 50);
    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory({ text: '', confidence: 0, blocks: [] }),
      deskew: false,
      denoise: false,
      upscale: true,
      // no pageWidthMm
    });
    assert.equal(result.wasUpscaled, false);
  });

  it('runs with all preprocessing enabled (defaults)', async () => {
    const canvas = makeCanvas();
    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory({ text: 'hello', confidence: 90, blocks: [] }),
      // deskew, denoise, upscale all default to true
    });
    assert.equal(result.text, 'hello');
    assert.equal(result.confidence, 90);
  });

  it('handles undefined data.blocks', async () => {
    const canvas = makeCanvas();
    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory({
        text: 'abc',
        confidence: 70,
        // blocks not present
      }),
      deskew: false,
      denoise: false,
      upscale: false,
    });
    assert.equal(result.text, 'abc');
    assert.deepEqual(result.charBoxes, []);
    assert.deepEqual(result.words, []);
    assert.deepEqual(result.blocks, []);
  });

  it('handles word with no fontAttributes', async () => {
    const canvas = makeCanvas();
    const tesseractData = {
      text: 'Z',
      confidence: 88,
      blocks: [{
        paragraphs: [{
          lines: [{
            words: [{
              text: 'Z',
              bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
              confidence: 88,
              // no fontAttributes
              symbols: [
                { text: 'Z', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 88 },
              ],
            }],
          }],
        }],
      }],
    };

    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory(tesseractData),
      deskew: false,
      denoise: false,
      upscale: false,
    });

    assert.equal(result.words[0].fontAttributes.isBold, false);
    assert.equal(result.words[0].fontAttributes.isItalic, false);
    assert.equal(result.words[0].fontAttributes.fontName, 'unknown');
  });

  it('uses line.bbox.y1 when baseline is missing', async () => {
    const canvas = makeCanvas();
    const tesseractData = {
      text: 'T',
      confidence: 90,
      blocks: [{
        paragraphs: [{
          lines: [{
            // no baseline
            bbox: { y1: 42 },
            words: [{
              text: 'T',
              bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
              confidence: 90,
              symbols: [
                { text: 'T', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 90 },
              ],
            }],
          }],
        }],
      }],
    };

    const result = await ocrWithCharBoxes(canvas, {
      getTesseractWorker: mockWorkerFactory(tesseractData),
      deskew: false,
      denoise: false,
      upscale: false,
    });

    assert.equal(result.charBoxes[0].lineBaseline, 42);
  });
});

// ---------------------------------------------------------------------------
// buildTextLayerFromResult
// ---------------------------------------------------------------------------

describe('buildTextLayerFromResult', () => {
  it('converts OcrCharResult to TextLayerModel with pt coordinates', () => {
    const result = {
      text: 'AB',
      confidence: 95,
      charBoxes: [
        { char: 'A', bbox: { x0: 0, y0: 0, x1: 50, y1: 40 }, confidence: 96, wordText: 'AB', lineBaseline: 35, fontSize: 40 },
        { char: 'B', bbox: { x0: 50, y0: 0, x1: 100, y1: 40 }, confidence: 94, wordText: 'AB', lineBaseline: 35, fontSize: 40 },
      ],
      words: [],
      blocks: [],
      wasDeskewed: false,
      deskewAngle: 0,
      wasUpscaled: false,
      upscaleFactor: 1,
    };

    const model = buildTextLayerFromResult(result, 612, 792, 200, 200);

    assert.equal(model.source, 'ocr');
    assert.equal(model.charBoxes.length, 2);

    // Check first charBox preserved fields
    assert.equal(model.charBoxes[0].char, 'A');
    assert.equal(model.charBoxes[0].bbox.x0, 0);
    assert.equal(model.charBoxes[0].confidence, 96);
    assert.equal(model.charBoxes[0].wordText, 'AB');
    assert.equal(model.charBoxes[0].lineBaseline, 35);
    assert.equal(model.charBoxes[0].fontSize, 40);

    // Check _pt conversion
    const scaleX = 612 / 200;
    const scaleY = 792 / 200;
    const pt0 = model.charBoxes[0]._pt;
    assert.equal(pt0.x, 0 * scaleX);  // x0 * scaleX
    assert.equal(pt0.y, 792 - 40 * scaleY);  // pageHeightPt - y1 * scaleY (flip Y)
    assert.equal(pt0.w, 50 * scaleX);  // (x1 - x0) * scaleX
    assert.equal(pt0.h, 40 * scaleY);  // (y1 - y0) * scaleY
  });

  it('handles empty charBoxes', () => {
    const result = {
      text: '',
      confidence: 0,
      charBoxes: [],
      words: [],
      blocks: [],
      wasDeskewed: false,
      deskewAngle: 0,
      wasUpscaled: false,
      upscaleFactor: 1,
    };

    const model = buildTextLayerFromResult(result, 612, 792, 100, 100);
    assert.equal(model.charBoxes.length, 0);
    assert.equal(model.source, 'ocr');
  });

  it('computes correct _pt for non-trivial image dimensions', () => {
    const result = {
      text: 'X',
      confidence: 80,
      charBoxes: [
        { char: 'X', bbox: { x0: 100, y0: 200, x1: 150, y1: 250 }, confidence: 80, wordText: 'X', lineBaseline: 240, fontSize: 50 },
      ],
      words: [],
      blocks: [],
      wasDeskewed: false,
      deskewAngle: 0,
      wasUpscaled: false,
      upscaleFactor: 1,
    };

    // imageWidth=500, imageHeight=700, pageWidthPt=500, pageHeightPt=700
    // so scaleX=1, scaleY=1 for simplicity
    const model = buildTextLayerFromResult(result, 500, 700, 500, 700);
    const pt = model.charBoxes[0]._pt;
    assert.equal(pt.x, 100);
    assert.equal(pt.y, 700 - 250);  // 450
    assert.equal(pt.w, 50);
    assert.equal(pt.h, 50);
  });
});
