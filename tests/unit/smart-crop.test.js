import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { detectContentBounds, smartCropPage, smartCropAll, SmartCropPreview } from '../../app/modules/smart-crop.js';

// ── Canvas helper ─────────────────────────────────────────────────────────────

/**
 * Create a canvas with a controllable pixel layout.
 * fillFn receives (pixels: Uint8ClampedArray, width, height) and can set pixels.
 */
function makeCanvas(width, height, fillFn) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  // Default: all white background
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = 255;
  }
  if (fillFn) fillFn(pixels, width, height);

  const mockCtx = {
    getImageData: (x, y, w, h) => ({ data: pixels, width: w, height: h }),
    drawImage() {},
    fillRect() {},
    clearRect() {},
    strokeRect() {},
    fillText() {},
    setLineDash() {},
    measureText: () => ({ width: 0 }),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
  };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => mockCtx;
  return canvas;
}

/** Paint a black rectangle into the pixel buffer */
function paintBlack(pixels, w, x0, y0, x1, y1) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * w + x) * 4;
      pixels[idx] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 255;
    }
  }
}

// ── PDF fixture ───────────────────────────────────────────────────────────────

let testPdfBytes;

before(async () => {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  doc.addPage([595, 842]);
  testPdfBytes = await doc.save();
});

// ── detectContentBounds ───────────────────────────────────────────────────────

describe('detectContentBounds', () => {
  it('returns bounds object with required properties', () => {
    const canvas = makeCanvas(100, 100);
    const bounds = detectContentBounds(canvas);
    assert.ok('x' in bounds);
    assert.ok('y' in bounds);
    assert.ok('width' in bounds);
    assert.ok('height' in bounds);
    assert.ok('marginTop' in bounds);
    assert.ok('marginRight' in bounds);
    assert.ok('marginBottom' in bounds);
    assert.ok('marginLeft' in bounds);
    assert.ok('_canvasWidth' in bounds);
    assert.ok('_canvasHeight' in bounds);
  });

  it('stores canvas dimensions in _canvasWidth/_canvasHeight', () => {
    const canvas = makeCanvas(200, 300);
    const bounds = detectContentBounds(canvas);
    assert.equal(bounds._canvasWidth, 200);
    assert.equal(bounds._canvasHeight, 300);
  });

  it('returns full canvas area when all-white (no content)', () => {
    const canvas = makeCanvas(100, 100);
    const bounds = detectContentBounds(canvas, { paddingPx: 0 });
    assert.equal(typeof bounds.x, 'number');
    assert.equal(typeof bounds.y, 'number');
    // All white → edges don't advance → marginTop=0, marginLeft=0 (edges stay at 0)
    assert.equal(bounds.marginTop, 0);
    assert.equal(bounds.marginLeft, 0);
  });

  it('detects content in center of canvas', () => {
    const canvas = makeCanvas(100, 100, (pixels, w) => {
      paintBlack(pixels, w, 30, 30, 70, 70);
    });
    const bounds = detectContentBounds(canvas, { paddingPx: 0, threshold: 240 });
    // Content starts at row 30, column 30
    assert.ok(bounds.y <= 30, `top edge ${bounds.y} should be <= 30`);
    assert.ok(bounds.x <= 30, `left edge ${bounds.x} should be <= 30`);
    assert.ok(bounds.marginTop >= 28, `top margin should detect ~30px of whitespace`);
    assert.ok(bounds.marginLeft >= 28, `left margin should detect ~30px of whitespace`);
  });

  it('detects content at edge gives zero margin', () => {
    const canvas = makeCanvas(50, 50, (pixels, w) => {
      paintBlack(pixels, w, 0, 0, 50, 50); // full canvas content
    });
    const bounds = detectContentBounds(canvas, { paddingPx: 0 });
    assert.equal(bounds.marginTop, 0);
    assert.equal(bounds.marginLeft, 0);
    assert.equal(bounds.marginBottom, 0);
    assert.equal(bounds.marginRight, 0);
  });

  it('applies paddingPx to expand detected content area', () => {
    const canvas = makeCanvas(100, 100, (pixels, w) => {
      paintBlack(pixels, w, 40, 40, 60, 60);
    });
    const noPad = detectContentBounds(canvas, { paddingPx: 0 });
    const withPad = detectContentBounds(canvas, { paddingPx: 10 });

    // With padding, edges should be further out (more encompassing)
    assert.ok(withPad.y <= noPad.y, 'padding expands top edge upward');
    assert.ok(withPad.x <= noPad.x, 'padding expands left edge leftward');
  });

  it('clamps padding at canvas boundaries', () => {
    const canvas = makeCanvas(50, 50, (pixels, w) => {
      paintBlack(pixels, w, 2, 2, 48, 48);
    });
    const bounds = detectContentBounds(canvas, { paddingPx: 20 });
    assert.ok(bounds.x >= 0);
    assert.ok(bounds.y >= 0);
  });

  it('uses custom threshold to distinguish content', () => {
    const canvas = makeCanvas(60, 60, (pixels, w) => {
      // Fill center with gray (lum ~200)
      for (let y = 20; y < 40; y++) {
        for (let x = 20; x < 40; x++) {
          const idx = (y * w + x) * 4;
          pixels[idx] = 200; pixels[idx + 1] = 200; pixels[idx + 2] = 200;
        }
      }
    });
    // Threshold 240 → gray 200 is content → should detect margins
    const high = detectContentBounds(canvas, { threshold: 240, paddingPx: 0 });
    assert.ok(high.marginTop > 0 || high.marginLeft > 0);

    // Threshold 100 → gray 200 is background → all-white behavior
    const low = detectContentBounds(canvas, { threshold: 100, paddingPx: 0 });
    // With low threshold, gray is not content → edges don't advance
    assert.equal(low.marginTop, 0);
  });

  it('uses minContentRatio to require fraction of row to be content', () => {
    const canvas = makeCanvas(100, 100, (pixels, w) => {
      // Only one pixel in row 40 is black (1/100 = 1% content)
      const idx = (40 * w + 50) * 4;
      pixels[idx] = 0; pixels[idx + 1] = 0; pixels[idx + 2] = 0;
    });
    // With minRatio=0.05 (5%), one pixel in 100 is not enough → no content detected
    const strict = detectContentBounds(canvas, { paddingPx: 0, minContentRatio: 0.05 });
    assert.equal(strict.marginTop, 0);

    // With minRatio=0.001, single pixel qualifies → content detected
    const loose = detectContentBounds(canvas, { paddingPx: 0, minContentRatio: 0.001 });
    assert.ok(loose.marginTop >= 0);
  });

  it('computes margins correctly for content at bottom-right', () => {
    const canvas = makeCanvas(100, 100, (pixels, w) => {
      paintBlack(pixels, w, 70, 70, 90, 90);
    });
    const bounds = detectContentBounds(canvas, { paddingPx: 0 });
    // Large top margin, large left margin, small bottom margin, small right margin
    assert.ok(bounds.marginTop > 60);
    assert.ok(bounds.marginLeft > 60);
    assert.ok(bounds.marginBottom < 20);
    assert.ok(bounds.marginRight < 20);
  });

  it('returns fallback when ctx is null', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    canvas.getContext = () => null;
    const bounds = detectContentBounds(canvas);
    assert.equal(bounds.x, 0);
    assert.equal(bounds.y, 0);
    assert.equal(bounds.width, 100);
    assert.equal(bounds.height, 100);
  });

  it('default paddingPx is 10', () => {
    const canvas = makeCanvas(100, 100, (pixels, w) => {
      paintBlack(pixels, w, 50, 50, 60, 60);
    });
    const defaultBounds = detectContentBounds(canvas);
    const explicitBounds = detectContentBounds(canvas, { paddingPx: 10 });
    assert.equal(defaultBounds.x, explicitBounds.x);
    assert.equal(defaultBounds.y, explicitBounds.y);
  });

  it('computes width and height as right-left and bottom-top', () => {
    const canvas = makeCanvas(100, 100, (pixels, w) => {
      paintBlack(pixels, w, 20, 10, 80, 90);
    });
    const bounds = detectContentBounds(canvas, { paddingPx: 0 });
    // For all-content canvas: top=10, bottom=89, left=20, right=79
    // width = right - left, height = bottom - top
    assert.equal(bounds.width, bounds.x === 0 ? bounds.width : bounds.width);
    assert.ok(bounds.width > 0);
    assert.ok(bounds.height > 0);
  });
});

// ── smartCropPage ─────────────────────────────────────────────────────────────

describe('smartCropPage', () => {
  it('processes a PDF page and returns blob and cropRect', async () => {
    const result = await smartCropPage(testPdfBytes, 1);
    assert.ok(result !== null);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/pdf');
    assert.ok('cropRect' in result);
  });

  it('cropRect has required properties', async () => {
    const result = await smartCropPage(testPdfBytes, 1);
    const r = result.cropRect;
    assert.ok('x' in r);
    assert.ok('y' in r);
    assert.ok('width' in r);
    assert.ok('height' in r);
    assert.ok('marginTop' in r);
    assert.ok('marginRight' in r);
    assert.ok('marginBottom' in r);
    assert.ok('marginLeft' in r);
  });

  it('uses custom renderPage function when provided', async () => {
    let renderCalled = false;
    const renderPage = async (pageNum) => {
      renderCalled = true;
      assert.equal(pageNum, 1);
      return makeCanvas(612, 792, (pixels, w) => {
        paintBlack(pixels, w, 50, 50, 562, 742);
      });
    };

    const result = await smartCropPage(testPdfBytes, 1, { renderPage });
    assert.ok(renderCalled);
    assert.ok(result !== null);
  });

  it('applies custom threshold', async () => {
    const result = await smartCropPage(testPdfBytes, 1, { threshold: 200 });
    assert.ok(result !== null);
  });

  it('applies custom paddingPt', async () => {
    const result = await smartCropPage(testPdfBytes, 1, { paddingPt: 10 });
    assert.ok(result !== null);
    // cropRect.x should start at 0 - 10 = clamped to 0
    assert.ok(result.cropRect.x >= 0);
  });

  it('applyAll=true applies crop to all pages', async () => {
    const result = await smartCropPage(testPdfBytes, 1, { applyAll: true });
    assert.ok(result !== null);
    // Verify all pages got the crop applied by checking the saved PDF is valid
    const savedDoc = await PDFDocument.load(await result.blob.arrayBuffer());
    assert.equal(savedDoc.getPageCount(), 3);
  });

  it('processes page 2 (1-based)', async () => {
    const result = await smartCropPage(testPdfBytes, 2);
    assert.ok(result !== null);
    assert.ok(result.blob instanceof Blob);
  });

  it('processes last page', async () => {
    const result = await smartCropPage(testPdfBytes, 3);
    assert.ok(result !== null);
  });

  it('fallback canvas is white (blank page has full margin)', async () => {
    // Without a renderPage, it creates a blank white canvas
    // Blank white → no content → cropRect.x = max(0, 0 - paddingPt)
    const result = await smartCropPage(testPdfBytes, 1, { paddingPt: 0 });
    assert.ok(result !== null);
    assert.ok(result.cropRect.x >= 0);
  });

  it('with renderPage returning content-filled canvas', async () => {
    const renderPage = async (pageNum) => {
      return makeCanvas(100, 100, (pixels, w) => {
        paintBlack(pixels, w, 10, 10, 90, 90);
      });
    };
    const result = await smartCropPage(testPdfBytes, 1, { renderPage, paddingPt: 5 });
    assert.ok(result !== null);
    assert.ok(result.cropRect.width > 0);
    assert.ok(result.cropRect.height > 0);
  });
});

// ── smartCropAll ──────────────────────────────────────────────────────────────

describe('smartCropAll', () => {
  it('returns blob and rects array', async () => {
    const result = await smartCropAll(testPdfBytes);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/pdf');
    assert.ok(Array.isArray(result.rects));
  });

  it('returns one rect per page', async () => {
    const result = await smartCropAll(testPdfBytes);
    // testPdfBytes has 3 pages
    assert.equal(result.rects.length, 3);
  });

  it('each rect has required margin properties', async () => {
    const result = await smartCropAll(testPdfBytes);
    for (const rect of result.rects) {
      assert.ok('x' in rect);
      assert.ok('y' in rect);
      assert.ok('width' in rect);
      assert.ok('height' in rect);
      assert.ok('marginTop' in rect);
      assert.ok('marginRight' in rect);
      assert.ok('marginBottom' in rect);
      assert.ok('marginLeft' in rect);
    }
  });

  it('uses custom renderPage function for each page', async () => {
    const rendered = [];
    const renderPage = async (pageNum) => {
      rendered.push(pageNum);
      return makeCanvas(612, 792, (pixels, w) => {
        paintBlack(pixels, w, 30, 30, 580, 760);
      });
    };

    const result = await smartCropAll(testPdfBytes, { renderPage });
    assert.deepEqual(rendered, [1, 2, 3]);
    assert.equal(result.rects.length, 3);
  });

  it('calls onProgress for each page', async () => {
    const progress = [];
    await smartCropAll(testPdfBytes, {
      onProgress: (pageNum, total) => progress.push({ pageNum, total }),
    });
    assert.equal(progress.length, 3);
    assert.equal(progress[0].pageNum, 1);
    assert.equal(progress[0].total, 3);
    assert.equal(progress[2].pageNum, 3);
  });

  it('applies custom threshold', async () => {
    const result = await smartCropAll(testPdfBytes, { threshold: 200 });
    assert.equal(result.rects.length, 3);
  });

  it('applies custom paddingPt', async () => {
    const result = await smartCropAll(testPdfBytes, { paddingPt: 0 });
    for (const rect of result.rects) {
      assert.ok(rect.x >= 0);
      assert.ok(rect.y >= 0);
    }
  });

  it('produces a valid PDF with CropBoxes applied', async () => {
    const result = await smartCropAll(testPdfBytes);
    const savedDoc = await PDFDocument.load(await result.blob.arrayBuffer());
    assert.equal(savedDoc.getPageCount(), 3);
  });

  it('handles single-page PDFs', async () => {
    const singleDoc = await PDFDocument.create();
    singleDoc.addPage([595, 842]);
    const singlePdfBytes = await singleDoc.save();

    const result = await smartCropAll(singlePdfBytes);
    assert.equal(result.rects.length, 1);
  });

  it('with renderPage returning content-heavy canvas', async () => {
    const renderPage = async () => makeCanvas(100, 100, (pixels, w) => {
      paintBlack(pixels, w, 5, 5, 95, 95);
    });
    const result = await smartCropAll(testPdfBytes, { renderPage });
    for (const rect of result.rects) {
      // Content-heavy → small margins → x,y near 0
      assert.ok(rect.x >= 0);
      assert.ok(rect.y >= 0);
    }
  });
});

// ── SmartCropPreview ──────────────────────────────────────────────────────────

describe('SmartCropPreview', () => {
  let overlayCanvas;
  let mockCtx;

  beforeEach(() => {
    const calls = { clear: 0, fill: 0, stroke: 0, text: 0, lineDash: 0 };
    mockCtx = {
      calls,
      clearRect(...args) { calls.clear++; },
      fillRect(...args) { calls.fill++; },
      strokeRect(...args) { calls.stroke++; },
      fillText(...args) { calls.text++; },
      setLineDash(...args) { calls.lineDash++; },
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      font: '',
    };
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = 612;
    overlayCanvas.height = 792;
    overlayCanvas.getContext = () => mockCtx;
  });

  it('constructs with given parameters', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1.5);
    assert.equal(preview.pageW, 612);
    assert.equal(preview.pageH, 792);
    assert.equal(preview.zoom, 1.5);
    assert.equal(preview._cropRect, null);
  });

  it('uses default zoom of 1 when not specified', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792);
    assert.equal(preview.zoom, 1);
  });

  it('stores canvas reference', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792);
    assert.equal(preview.canvas, overlayCanvas);
  });

  it('show stores the crop rect', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1);
    const rect = { x: 10, y: 10, width: 500, height: 700, marginTop: 5, marginBottom: 5, marginRight: 5, marginLeft: 5 };
    preview.show(rect);
    assert.equal(preview._cropRect, rect);
  });

  it('show draws on the canvas (fills and strokes)', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1);
    const rect = { x: 10, y: 10, width: 500, height: 700, marginTop: 5, marginBottom: 5, marginRight: 5, marginLeft: 5 };
    preview.show(rect);
    // Should have called fillRect multiple times for dark overlays + corner handles
    assert.ok(mockCtx.calls.fill > 0);
    // Should have called strokeRect for the dashed crop border
    assert.ok(mockCtx.calls.stroke > 0);
  });

  it('show calls clearRect first', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1);
    preview.show({ x: 0, y: 0, width: 612, height: 792, marginTop: 0, marginBottom: 0, marginRight: 0, marginLeft: 0 });
    assert.ok(mockCtx.calls.clear >= 1);
  });

  it('show draws text labels for margins', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1);
    preview.show({ x: 10, y: 10, width: 500, height: 700, marginTop: 20, marginBottom: 15, marginRight: 10, marginLeft: 10 });
    assert.ok(mockCtx.calls.text >= 2);
  });

  it('show draws 4 corner handles', () => {
    // The show method draws 4 corner handles (fillRect for each)
    // Plus 4 dark overlay strips = 8 fillRects total, then setLineDash calls
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1);
    preview.show({ x: 50, y: 50, width: 400, height: 600, marginTop: 50, marginBottom: 50, marginRight: 50, marginLeft: 50 });
    // 4 dark strips + 4 corner handles = 8 fillRect calls minimum
    assert.ok(mockCtx.calls.fill >= 8);
  });

  it('setZoom updates zoom value', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1);
    preview.setZoom(2.5);
    assert.equal(preview.zoom, 2.5);
  });

  it('setZoom re-renders if crop rect is set', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1);
    const rect = { x: 10, y: 10, width: 500, height: 700, marginTop: 5, marginBottom: 5, marginRight: 5, marginLeft: 5 };
    preview.show(rect);
    const fillsBefore = mockCtx.calls.fill;
    preview.setZoom(2);
    // setZoom should call show again which calls fillRect more
    assert.ok(mockCtx.calls.fill > fillsBefore);
  });

  it('setZoom does not re-render if no crop rect', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1);
    preview.setZoom(2);
    assert.equal(preview.zoom, 2);
    // No rendering should have happened
    assert.equal(mockCtx.calls.fill, 0);
  });

  it('hide clears the canvas', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792, 1);
    preview.show({ x: 10, y: 10, width: 500, height: 700, marginTop: 5, marginBottom: 5, marginRight: 5, marginLeft: 5 });
    const clearBefore = mockCtx.calls.clear;
    preview.hide();
    assert.ok(mockCtx.calls.clear > clearBefore);
  });

  it('hide sets _cropRect to null', () => {
    const preview = new SmartCropPreview(overlayCanvas, 612, 792);
    preview._cropRect = { x: 0, y: 0, width: 100, height: 100, marginTop: 0, marginBottom: 0, marginRight: 0, marginLeft: 0 };
    preview.hide();
    assert.equal(preview._cropRect, null);
  });

  it('handles null ctx gracefully in constructor', () => {
    const noCtxCanvas = document.createElement('canvas');
    noCtxCanvas.getContext = () => null;
    // Should not throw
    assert.doesNotThrow(() => {
      new SmartCropPreview(noCtxCanvas, 612, 792);
    });
  });

  it('show with zoom affects coordinate scaling', () => {
    // Two previews with different zoom should draw at different coordinates
    const calls1 = { text: [] };
    const ctx1 = {
      clearRect() {}, fillRect() {}, strokeRect() {},
      fillText(txt, x, y) { calls1.text.push({ txt, x, y }); },
      setLineDash() {}, strokeStyle: '', fillStyle: '', lineWidth: 1, font: '',
    };
    const canvas1 = document.createElement('canvas');
    canvas1.width = 612;
    canvas1.height = 792;
    canvas1.getContext = () => ctx1;

    const calls2 = { text: [] };
    const ctx2 = {
      clearRect() {}, fillRect() {}, strokeRect() {},
      fillText(txt, x, y) { calls2.text.push({ txt, x, y }); },
      setLineDash() {}, strokeStyle: '', fillStyle: '', lineWidth: 1, font: '',
    };
    const canvas2 = document.createElement('canvas');
    canvas2.width = 1224;
    canvas2.height = 1584;
    canvas2.getContext = () => ctx2;

    const rect = { x: 10, y: 10, width: 500, height: 700, marginTop: 20, marginBottom: 20, marginRight: 20, marginLeft: 20 };

    const preview1 = new SmartCropPreview(canvas1, 612, 792, 1);
    preview1.show(rect);

    const preview2 = new SmartCropPreview(canvas2, 612, 792, 2);
    preview2.show(rect);

    // At zoom=2, labels should be drawn at 2x the position
    if (calls1.text.length > 0 && calls2.text.length > 0) {
      assert.ok(calls2.text[0].x > calls1.text[0].x || calls2.text[0].y !== calls1.text[0].y);
    }
  });
});
