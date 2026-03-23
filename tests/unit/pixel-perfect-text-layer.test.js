import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const { FontWidthProvider, PixelPerfectTextLayer } = await import('../../app/modules/pixel-perfect-text-layer.js');

describe('FontWidthProvider', () => {
  it('constructs with empty fonts map', () => {
    const p = new FontWidthProvider();
    assert.equal(p.fonts.size, 0);
  });

  it('getMetrics returns null for unknown font', () => {
    const p = new FontWidthProvider();
    assert.equal(p.getMetrics('UnknownFont'), null);
  });

  it('getMetrics returns stored metrics', () => {
    const p = new FontWidthProvider();
    const data = { fallbackFont: 'Arial', ascent: 0.8, descent: -0.2, isMonospace: false };
    p.fonts.set('TestFont', data);
    assert.deepEqual(p.getMetrics('TestFont'), data);
  });

  it('measureText returns a number', () => {
    const p = new FontWidthProvider();
    const w = p.measureText('hello', 12, 'Arial');
    assert.equal(typeof w, 'number');
  });

  it('loadFromPage handles page with no commonObjs', async () => {
    const p = new FontWidthProvider();
    const fakePage = {
      getOperatorList: async () => ({}),
      commonObjs: null,
    };
    await assert.doesNotReject(() => p.loadFromPage(fakePage));
  });

  it('loadFromPage extracts font data from commonObjs', async () => {
    const p = new FontWidthProvider();
    const fakePage = {
      getOperatorList: async () => ({}),
      commonObjs: {
        _objs: {
          'font1': { data: { type: 'Type1', name: 'Helvetica', widths: [], defaultWidth: 1000, ascent: 0.8, descent: -0.2 } },
        },
      },
    };
    await p.loadFromPage(fakePage);
    assert.equal(p.fonts.size, 1);
    const m = p.getMetrics('font1');
    assert.equal(m.fallbackFont, 'Arial');
  });
});

describe('PixelPerfectTextLayer', () => {
  let container, viewport, layer;

  beforeEach(() => {
    container = document.createElement('div');
    viewport = { width: 800, height: 600, scale: 1, convertToViewportPoint: (x, y) => [x, y] };
    layer = new PixelPerfectTextLayer(container, viewport);
  });

  it('creates a pptl-layer div in the container', () => {
    assert.equal(layer.div.className, 'pptl-layer');
    assert.ok(container.children.length > 0);
  });

  it('setZoom updates internal zoom', () => {
    layer.setZoom(2);
    assert.equal(layer._zoom, 2);
  });

  it('setZoom does nothing if same zoom', () => {
    layer.setZoom(1);
    // no error, _zoom stays 1
    assert.equal(layer._zoom, 1);
  });

  it('render clears previous items', () => {
    const provider = new FontWidthProvider();
    const textContent = { items: [{ str: 'Hello', fontName: '', transform: [12, 0, 0, 12, 0, 0], width: 50 }] };
    layer.render(textContent, provider);
    assert.equal(layer._items.length, 1);
    layer.render({ items: [] }, provider);
    assert.equal(layer._items.length, 0);
  });

  it('render filters out empty/whitespace-only items', () => {
    const provider = new FontWidthProvider();
    const textContent = {
      items: [
        { str: 'Valid', fontName: '', transform: [12, 0, 0, 12, 0, 0], width: 40 },
        { str: '   ', fontName: '', transform: [12, 0, 0, 12, 0, 0], width: 10 },
        { str: '', fontName: '', transform: [12, 0, 0, 12, 0, 0], width: 0 },
      ],
    };
    layer.render(textContent, provider);
    assert.equal(layer._items.length, 1);
  });

  it('destroy removes the layer div and clears items', () => {
    layer.destroy();
    assert.equal(layer._items.length, 0);
  });
});
