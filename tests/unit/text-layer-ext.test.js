// ─── Extended Unit Tests: Text Layer Builder Module ─────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTextLayer,
  highlightSearchMatches,
  clearSearchHighlights,
} from '../../app/modules/text-layer-builder.js';

describe('buildTextLayer', () => {
  it('returns early for missing container', () => {
    assert.doesNotThrow(() => buildTextLayer({ container: null, textContent: {}, viewport: {} }));
  });

  it('returns early for missing textContent', () => {
    const container = document.createElement('div');
    assert.doesNotThrow(() => buildTextLayer({ container, textContent: null, viewport: {} }));
  });

  it('returns early for missing viewport', () => {
    const container = document.createElement('div');
    assert.doesNotThrow(() => buildTextLayer({ container, textContent: {}, viewport: null }));
  });

  it('processes valid items', () => {
    const container = document.createElement('div');
    assert.doesNotThrow(() => buildTextLayer({
      container,
      textContent: {
        items: [
          { str: 'Hello', transform: [12, 0, 0, 12, 100, 200], fontName: 'Arial', width: 60 },
        ],
        styles: { Arial: { fontFamily: 'Arial' } },
      },
      viewport: { transform: [1, 0, 0, 1, 0, 0] },
    }));
  });

  it('skips items with empty str', () => {
    const container = document.createElement('div');
    assert.doesNotThrow(() => buildTextLayer({
      container,
      textContent: { items: [{ str: '', transform: [12, 0, 0, 12, 100, 200] }], styles: {} },
      viewport: { transform: [1, 0, 0, 1, 0, 0] },
    }));
  });

  it('skips items with missing or short transform', () => {
    const container = document.createElement('div');
    assert.doesNotThrow(() => buildTextLayer({
      container,
      textContent: {
        items: [
          { str: 'a', transform: null },
          { str: 'b', transform: [1, 0] },
        ],
        styles: {},
      },
      viewport: { transform: [1, 0, 0, 1, 0, 0] },
    }));
  });

  it('handles RTL text', () => {
    const container = document.createElement('div');
    assert.doesNotThrow(() => buildTextLayer({
      container,
      textContent: { items: [{ str: 'مرحبا', transform: [12, 0, 0, 12, 100, 200], width: 50 }], styles: {} },
      viewport: { transform: [1, 0, 0, 1, 0, 0] },
    }));
  });

  it('handles CJK text', () => {
    const container = document.createElement('div');
    assert.doesNotThrow(() => buildTextLayer({
      container,
      textContent: { items: [{ str: '你好世界', transform: [12, 0, 0, 12, 100, 200], width: 50 }], styles: {} },
      viewport: { transform: [1, 0, 0, 1, 0, 0] },
    }));
  });

  it('handles small font text', () => {
    const container = document.createElement('div');
    assert.doesNotThrow(() => buildTextLayer({
      container,
      textContent: { items: [{ str: 'Tiny', transform: [4, 0, 0, 4, 100, 200], width: 20 }], styles: {} },
      viewport: { transform: [1, 0, 0, 1, 0, 0] },
      enhanceSmallText: true,
    }));
  });

  it('handles rotated text', () => {
    const container = document.createElement('div');
    const angle = Math.PI / 4;
    assert.doesNotThrow(() => buildTextLayer({
      container,
      textContent: { items: [{ str: 'R', transform: [12 * Math.cos(angle), 12 * Math.sin(angle), 0, 12, 100, 200], width: 10 }], styles: {} },
      viewport: { transform: [1, 0, 0, 1, 0, 0] },
    }));
  });
});

describe('highlightSearchMatches', () => {
  it('returns 0 for null container', () => {
    assert.equal(highlightSearchMatches(null, 'test'), 0);
  });

  it('returns 0 for empty query', () => {
    const container = document.createElement('div');
    assert.equal(highlightSearchMatches(container, ''), 0);
  });

  it('returns 0 for null query', () => {
    const container = document.createElement('div');
    assert.equal(highlightSearchMatches(container, null), 0);
  });
});

describe('clearSearchHighlights', () => {
  it('does not throw for null container', () => {
    assert.doesNotThrow(() => clearSearchHighlights(null));
  });
});
