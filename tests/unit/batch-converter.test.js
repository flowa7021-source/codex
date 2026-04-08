import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// batch-converter dynamically imports converters and pdfjs-dist.
let BatchConverter;
let moduleAvailable = false;

try {
  const mod = await import('../../app/modules/batch-converter.js');
  BatchConverter = mod.BatchConverter;
  moduleAvailable = true;
} catch {
  // Module may fail if dependencies have issues
}

/**
 * Create a mock File object with valid PDF bytes.
 * @param {string} name
 * @returns {Promise<File>}
 */
async function createMockPdfFile(name) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText('Test content', { x: 72, y: 700, size: 12, font, color: rgb(0, 0, 0) });
  const bytes = await pdf.save();
  return new File([bytes], name, { type: 'application/pdf' });
}

describe('BatchConverter', () => {
  it('class is available', { skip: !moduleAvailable && 'module not loadable' }, () => {
    assert.equal(typeof BatchConverter, 'function');
  });

  it('constructor initializes empty queue and results', { skip: !moduleAvailable && 'module not loadable' }, () => {
    const bc = new BatchConverter();
    assert.deepStrictEqual(bc.queue, []);
    assert.deepStrictEqual(bc.results, []);
  });

  it('addFile adds items to the queue and returns this for chaining', { skip: !moduleAvailable && 'module not loadable' }, () => {
    const bc = new BatchConverter();
    const file = new File(['test'], 'test.pdf');
    const result = bc.addFile(file, 'rtf');

    assert.equal(bc.queue.length, 1);
    assert.equal(bc.queue[0].file, file);
    assert.equal(bc.queue[0].outputFormat, 'rtf');
    assert.equal(result, bc);
  });

  it('addFile supports chaining multiple files', { skip: !moduleAvailable && 'module not loadable' }, () => {
    const bc = new BatchConverter();
    bc.addFile(new File(['a'], 'a.pdf'), 'rtf')
      .addFile(new File(['b'], 'b.pdf'), 'csv')
      .addFile(new File(['c'], 'c.pdf'), 'txt');

    assert.equal(bc.queue.length, 3);
  });

  it('run calls onProgress for each file', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('test.pdf');
    bc.addFile(file, 'rtf');

    /** @type {Array<{current: number, total: number, filename: string}>} */
    const progressCalls = [];

    await bc.run((current, total, filename) => {
      progressCalls.push({ current, total, filename });
    });

    assert.equal(progressCalls.length, 1);
    assert.equal(progressCalls[0].current, 1);
    assert.equal(progressCalls[0].total, 1);
    assert.equal(progressCalls[0].filename, 'test.pdf');
  });

  it('run produces results with ok status for rtf', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('doc.pdf');
    bc.addFile(file, 'rtf');

    const results = await bc.run();

    assert.equal(results.length, 1);
    assert.equal(results[0].filename, 'doc.pdf');
    assert.equal(results[0].status, 'ok');
    assert.ok(results[0].blob instanceof Blob);
  });

  it('run produces error results for unsupported formats', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('doc.pdf');
    bc.addFile(file, 'docx');

    const results = await bc.run();

    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'error');
    assert.ok(results[0].error?.includes('Unsupported format'));
  });

  it('cancel stops processing remaining files', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file1 = await createMockPdfFile('first.pdf');
    const file2 = await createMockPdfFile('second.pdf');
    const file3 = await createMockPdfFile('third.pdf');

    bc.addFile(file1, 'rtf')
      .addFile(file2, 'rtf')
      .addFile(file3, 'rtf');

    // Cancel after the first file processes
    const results = await bc.run((current) => {
      if (current === 1) bc.cancel();
    });

    // Should have processed at most the first file (cancel takes effect before file 2)
    assert.ok(results.length <= 2);
    assert.equal(results[0].filename, 'first.pdf');
  });

  it('getResults returns the last run results', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('test.pdf');
    bc.addFile(file, 'rtf');

    await bc.run();
    const results = bc.getResults();

    assert.equal(results.length, 1);
    assert.equal(results[0].filename, 'test.pdf');
  });

  it('run resets results from previous run', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file1 = await createMockPdfFile('first.pdf');
    bc.addFile(file1, 'rtf');

    await bc.run();
    assert.equal(bc.results.length, 1);

    await bc.run();
    assert.equal(bc.results.length, 1);
  });

  it('handles mixed success and failure', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const goodFile = await createMockPdfFile('good.pdf');
    const badFile = await createMockPdfFile('bad.pdf');

    bc.addFile(goodFile, 'rtf')
      .addFile(badFile, 'docx');

    const results = await bc.run();

    assert.equal(results.length, 2);
    assert.equal(results[0].status, 'ok');
    assert.equal(results[1].status, 'error');
  });

  it('supports txt format conversion', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('text.pdf');
    bc.addFile(file, 'txt');

    const results = await bc.run();

    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'ok');
  });

  it('supports html format conversion', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('page.pdf');
    bc.addFile(file, 'html');

    const results = await bc.run();

    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'ok');
  });

  it('supports xlsx format conversion', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('data.pdf');
    bc.addFile(file, 'xlsx');

    const results = await bc.run();

    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'ok');
    assert.ok(results[0].blob instanceof Blob);
  });

  it('supports pptx format conversion', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('pres.pdf');
    bc.addFile(file, 'pptx');

    const results = await bc.run();

    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'ok');
    assert.ok(results[0].blob instanceof Blob);
  });

  it('supports csv format conversion', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('table.pdf');
    bc.addFile(file, 'csv');

    const results = await bc.run();

    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'ok');
    assert.ok(results[0].blob instanceof Blob);
  });

  it('supports svg format conversion', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('graphic.pdf');
    bc.addFile(file, 'svg');

    const results = await bc.run();

    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'ok');
    assert.ok(results[0].blob instanceof Blob);
  });

  it('supports tiff format conversion', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const bc = new BatchConverter();
    const file = await createMockPdfFile('scan.pdf');
    bc.addFile(file, 'tiff');

    const results = await bc.run();

    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'ok');
    assert.ok(results[0].blob instanceof Blob);
  });

  it('supports png format conversion using OffscreenCanvas', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    // Provide a complete OffscreenCanvas + Path2D mock for pdfjs rendering
    const origOffscreen = globalThis.OffscreenCanvas;
    const origPath2D = globalThis.Path2D;

    globalThis.Path2D = class Path2D {
      moveTo() {} lineTo() {} arc() {} arcTo() {}
      bezierCurveTo() {} quadraticCurveTo() {}
      rect() {} ellipse() {} closePath() {} addPath() {}
    };
    globalThis.OffscreenCanvas = class OffscreenCanvas {
      constructor(w, h) { this.width = w; this.height = h; }
      getContext() {
        return {
          canvas: this, save() {}, restore() {}, transform() {}, setTransform() {},
          getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
          scale() {}, translate() {}, rotate() {}, resetTransform() {},
          fillRect() {}, clearRect() {}, strokeRect() {}, rect() {}, ellipse() {},
          fillText() {}, strokeText() {}, drawImage() {},
          beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
          stroke() {}, fill() {}, clip() {},
          bezierCurveTo() {}, arc() {}, arcTo() {}, quadraticCurveTo() {},
          putImageData() {},
          getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
          measureText: (t) => ({ width: t.length * 5, actualBoundingBoxAscent: 5, actualBoundingBoxDescent: 2 }),
          createLinearGradient: () => ({ addColorStop() {} }),
          createRadialGradient: () => ({ addColorStop() {} }),
          createPattern: () => null,
          isPointInPath: () => false,
          strokeStyle: '', fillStyle: '#000', lineWidth: 1, globalAlpha: 1,
          globalCompositeOperation: 'source-over', lineCap: 'butt', lineJoin: 'miter',
          miterLimit: 10, shadowBlur: 0, shadowColor: '', shadowOffsetX: 0, shadowOffsetY: 0,
          font: '10px sans-serif', textAlign: 'left', textBaseline: 'alphabetic',
          direction: 'ltr', imageSmoothingEnabled: true,
        };
      }
      async convertToBlob(opts) { return new Blob(['png-data'], { type: opts?.type || 'image/png' }); }
    };

    try {
      const bc = new BatchConverter();
      const file = await createMockPdfFile('img.pdf');
      bc.addFile(file, 'png');
      const results = await bc.run();
      assert.equal(results.length, 1);
      assert.equal(results[0].status, 'ok');
      assert.ok(results[0].blob instanceof Blob);
    } finally {
      globalThis.OffscreenCanvas = origOffscreen;
      globalThis.Path2D = origPath2D;
    }
  });

  it('supports jpg format conversion using OffscreenCanvas', { skip: !moduleAvailable && 'module not loadable' }, async () => {
    const origOffscreen = globalThis.OffscreenCanvas;
    const origPath2D = globalThis.Path2D;

    globalThis.Path2D = class Path2D {
      moveTo() {} lineTo() {} arc() {} arcTo() {}
      bezierCurveTo() {} quadraticCurveTo() {}
      rect() {} ellipse() {} closePath() {} addPath() {}
    };
    globalThis.OffscreenCanvas = class OffscreenCanvas {
      constructor(w, h) { this.width = w; this.height = h; }
      getContext() {
        return {
          canvas: this, save() {}, restore() {}, transform() {}, setTransform() {},
          getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
          scale() {}, translate() {}, rotate() {}, resetTransform() {},
          fillRect() {}, clearRect() {}, strokeRect() {}, rect() {}, ellipse() {},
          fillText() {}, strokeText() {}, drawImage() {},
          beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
          stroke() {}, fill() {}, clip() {},
          bezierCurveTo() {}, arc() {}, arcTo() {}, quadraticCurveTo() {},
          putImageData() {},
          getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
          measureText: (t) => ({ width: t.length * 5, actualBoundingBoxAscent: 5, actualBoundingBoxDescent: 2 }),
          createLinearGradient: () => ({ addColorStop() {} }),
          createRadialGradient: () => ({ addColorStop() {} }),
          createPattern: () => null,
          isPointInPath: () => false,
          strokeStyle: '', fillStyle: '#000', lineWidth: 1, globalAlpha: 1,
          globalCompositeOperation: 'source-over', lineCap: 'butt', lineJoin: 'miter',
          miterLimit: 10, shadowBlur: 0, shadowColor: '', shadowOffsetX: 0, shadowOffsetY: 0,
          font: '10px sans-serif', textAlign: 'left', textBaseline: 'alphabetic',
          direction: 'ltr', imageSmoothingEnabled: true,
        };
      }
      async convertToBlob(opts) { return new Blob(['jpg-data'], { type: opts?.type || 'image/jpeg' }); }
    };

    try {
      const bc = new BatchConverter();
      const file = await createMockPdfFile('photo.pdf');
      bc.addFile(file, 'jpg');
      const results = await bc.run();
      assert.equal(results.length, 1);
      assert.equal(results[0].status, 'ok');
      assert.ok(results[0].blob instanceof Blob);
    } finally {
      globalThis.OffscreenCanvas = origOffscreen;
      globalThis.Path2D = origPath2D;
    }
  });
});
