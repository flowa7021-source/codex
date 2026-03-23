import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Import directly -- pdfjs-dist is installed; computePixelDiff and VisualDiff
// don't call into pdfjs at construction/test time.
const { computePixelDiff, VisualDiff } = await import('../../app/modules/visual-diff.js');

describe('computePixelDiff', () => {
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  it('returns result object with expected properties', () => {
    const a = makeCanvas(2, 2);
    const b = makeCanvas(2, 2);
    const result = computePixelDiff(a, b);
    assert.ok('diffCanvas' in result);
    assert.ok('changedPercent' in result);
    assert.ok('changedPixels' in result);
    assert.ok('totalPixels' in result);
    assert.ok('diffRect' in result);
  });

  it('reports 0% change for identical canvases', () => {
    const a = makeCanvas(4, 4);
    const b = makeCanvas(4, 4);
    const result = computePixelDiff(a, b);
    assert.equal(result.changedPercent, 0);
    assert.equal(result.changedPixels, 0);
    assert.equal(result.diffRect, null);
  });

  it('totalPixels equals w * h', () => {
    const a = makeCanvas(10, 5);
    const b = makeCanvas(10, 5);
    const result = computePixelDiff(a, b);
    assert.equal(result.totalPixels, 50);
  });

  it('handles canvases of different sizes', () => {
    const a = makeCanvas(10, 10);
    const b = makeCanvas(5, 5);
    const result = computePixelDiff(a, b);
    assert.equal(result.totalPixels, 100);
  });

  it('accepts custom threshold option', () => {
    const a = makeCanvas(2, 2);
    const b = makeCanvas(2, 2);
    const result = computePixelDiff(a, b, { threshold: 0 });
    assert.equal(typeof result.changedPercent, 'number');
  });

  it('changedPercent is between 0 and 100', () => {
    const a = makeCanvas(3, 3);
    const b = makeCanvas(3, 3);
    const result = computePixelDiff(a, b);
    assert.ok(result.changedPercent >= 0);
    assert.ok(result.changedPercent <= 100);
  });
});

describe('VisualDiff', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('constructs and builds shell', () => {
    const vd = new VisualDiff(container);
    assert.ok(container.children.length > 0);
  });

  it('setMode updates internal mode', () => {
    const vd = new VisualDiff(container);
    vd._canvasA = document.createElement('canvas');
    vd._canvasB = document.createElement('canvas');
    vd._canvasA.width = 10; vd._canvasA.height = 10;
    vd._canvasB.width = 10; vd._canvasB.height = 10;
    vd._diffCanvas = document.createElement('canvas');
    vd.setMode('overlay');
    assert.equal(vd._mode, 'overlay');
  });

  it('setOpacity clamps to [0, 1]', () => {
    const vd = new VisualDiff(container);
    vd.setOpacity(-0.5);
    assert.equal(vd._opacity, 0);
    vd.setOpacity(1.5);
    assert.equal(vd._opacity, 1);
    vd.setOpacity(0.7);
    assert.ok(Math.abs(vd._opacity - 0.7) < 0.001);
  });

  it('destroy clears container and nullifies references', () => {
    const vd = new VisualDiff(container);
    vd.destroy();
    assert.equal(vd._canvasA, null);
    assert.equal(vd._canvasB, null);
    assert.equal(vd._diffCanvas, null);
    assert.equal(vd._result, null);
    assert.equal(vd._ui, null);
  });

  it('accepts custom options', () => {
    const vd = new VisualDiff(container, {
      scale: 2.0,
      threshold: 5,
      labelA: 'Before',
      labelB: 'After',
    });
    assert.equal(vd._scale, 2.0);
    assert.equal(vd._threshold, 5);
    assert.equal(vd._labelA, 'Before');
    assert.equal(vd._labelB, 'After');
  });
});
