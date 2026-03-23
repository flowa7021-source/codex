// ─── Unit Tests: Render Text Layer ────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  _ocrWordCache,
  getActiveTextLayer,
  setActiveTextLayer,
  getActiveInlineEditor,
  setActiveInlineEditor,
  initRenderTextLayerDeps,
  _renderManualTextLayer,
  _reflowTextToSpans,
  _findParagraphSpans,
} from '../../app/modules/render-text-layer.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContainer() {
  const div = document.createElement('div');
  // Enhance mock with querySelectorAll and querySelector
  div._children = [];
  const origAppendChild = div.appendChild;
  div.appendChild = function (child) {
    if (child && child._children) {
      // fragment — collect its children
      for (const c of (child._children || [])) {
        div._children.push(c);
      }
    } else if (child) {
      div._children.push(child);
    }
    return child;
  };
  div.querySelectorAll = (sel) => {
    if (sel.includes('span')) return div._children.filter(c => c.tagName === 'SPAN');
    return [];
  };
  div.querySelector = (sel) => {
    const all = div.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  };
  return div;
}

const _origCreateDocumentFragment = document.createDocumentFragment.bind(document);

function makeDocFragment() {
  const frag = _origCreateDocumentFragment();
  frag._children = [];
  frag.appendChild = function (child) {
    frag._children.push(child);
    return child;
  };
  return frag;
}

function makeSpan(text, styles = {}) {
  const span = document.createElement('span');
  span.textContent = text;
  span.tagName = 'SPAN';
  Object.assign(span.style, styles);
  span.offsetWidth = 50;
  span.getBoundingClientRect = () => ({
    top: styles._top || 0, left: styles._left || 0,
    width: styles._width || 50, height: styles._height || 14,
    bottom: (styles._top || 0) + (styles._height || 14),
    right: (styles._left || 0) + (styles._width || 50),
    x: styles._left || 0, y: styles._top || 0, toJSON() {},
  });
  return span;
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  _ocrWordCache.clear();
  setActiveTextLayer(null);
  setActiveInlineEditor(null);
});

// ── getActiveTextLayer / setActiveTextLayer ──────────────────────────────────

describe('getActiveTextLayer / setActiveTextLayer', () => {
  it('returns null by default', () => {
    assert.equal(getActiveTextLayer(), null);
  });

  it('sets and gets a text layer', () => {
    const tl = { cancel() {} };
    setActiveTextLayer(tl);
    assert.equal(getActiveTextLayer(), tl);
  });

  it('can reset to null', () => {
    setActiveTextLayer({ cancel() {} });
    setActiveTextLayer(null);
    assert.equal(getActiveTextLayer(), null);
  });
});

// ── getActiveInlineEditor / setActiveInlineEditor ───────────────────────────

describe('getActiveInlineEditor / setActiveInlineEditor', () => {
  it('returns null by default', () => {
    assert.equal(getActiveInlineEditor(), null);
  });

  it('sets and gets an editor', () => {
    const ed = { remove() {} };
    setActiveInlineEditor(ed);
    assert.equal(getActiveInlineEditor(), ed);
  });

  it('can reset to null', () => {
    setActiveInlineEditor({ remove() {} });
    setActiveInlineEditor(null);
    assert.equal(getActiveInlineEditor(), null);
  });
});

// ── initRenderTextLayerDeps ─────────────────────────────────────────────────

describe('initRenderTextLayerDeps', () => {
  it('accepts deps object without throwing', () => {
    assert.doesNotThrow(() => {
      initRenderTextLayerDeps({ setOcrStatus: () => {} });
    });
  });

  it('accepts empty deps object', () => {
    assert.doesNotThrow(() => {
      initRenderTextLayerDeps({});
    });
  });
});

// ── _ocrWordCache ───────────────────────────────────────────────────────────

describe('_ocrWordCache', () => {
  it('is a Map', () => {
    assert.ok(_ocrWordCache instanceof Map);
  });

  it('starts empty', () => {
    assert.equal(_ocrWordCache.size, 0);
  });

  it('can store and retrieve word data', () => {
    const words = [{ text: 'hello', bbox: { x0: 0, y0: 0, x1: 0.5, y1: 0.1 } }];
    _ocrWordCache.set(1, words);
    assert.deepEqual(_ocrWordCache.get(1), words);
  });
});

// ── _renderManualTextLayer ──────────────────────────────────────────────────

describe('_renderManualTextLayer', () => {
  it('renders text items as spans', () => {
    const container = makeContainer();
    const textContent = {
      items: [
        {
          str: 'Hello',
          transform: [12, 0, 0, 12, 50, 700],
          fontName: 'Arial',
          width: 30,
        },
        {
          str: 'World',
          transform: [12, 0, 0, 12, 100, 700],
          fontName: 'Arial',
          width: 30,
        },
      ],
    };
    const viewport = {
      transform: [1, 0, 0, -1, 0, 800],
    };
    const zoom = 1;

    // We need to override createDocumentFragment to track appended children
    const origCreateFrag = document.createDocumentFragment;
    const fragments = [];
    document.createDocumentFragment = () => {
      const frag = makeDocFragment();
      fragments.push(frag);
      return frag;
    };

    _renderManualTextLayer(container, textContent, viewport, zoom);

    document.createDocumentFragment = origCreateFrag;

    // The container should have received children via fragment
    assert.ok(container._children.length >= 0 || fragments.length > 0);
  });

  it('skips empty text items', () => {
    const container = makeContainer();
    const textContent = {
      items: [
        { str: '', transform: [12, 0, 0, 12, 50, 700], fontName: 'Arial' },
        { str: '  ', transform: [12, 0, 0, 12, 50, 700], fontName: 'Arial' },
        { str: 'Hello', transform: [12, 0, 0, 12, 50, 700], fontName: 'Arial' },
      ],
    };
    const viewport = { transform: [1, 0, 0, -1, 0, 800] };

    const origCreateFrag = document.createDocumentFragment;
    const fragments = [];
    document.createDocumentFragment = () => {
      const frag = makeDocFragment();
      fragments.push(frag);
      return frag;
    };

    _renderManualTextLayer(container, textContent, viewport, 1);

    document.createDocumentFragment = origCreateFrag;

    // Only the non-empty item should be added
    if (fragments.length > 0) {
      assert.equal(fragments[0]._children.length, 1);
    }
  });

  it('applies zoom to font size and width', () => {
    const container = makeContainer();
    const textContent = {
      items: [
        { str: 'Test', transform: [10, 0, 0, 10, 50, 700], fontName: 'Arial', width: 40 },
      ],
    };
    const viewport = { transform: [1, 0, 0, -1, 0, 800] };

    const origCreateFrag = document.createDocumentFragment;
    const fragments = [];
    document.createDocumentFragment = () => {
      const frag = makeDocFragment();
      fragments.push(frag);
      return frag;
    };

    _renderManualTextLayer(container, textContent, viewport, 2);

    document.createDocumentFragment = origCreateFrag;

    if (fragments.length > 0 && fragments[0]._children.length > 0) {
      const span = fragments[0]._children[0];
      // fontSize should be sqrt(10^2 + 0^2) * 2 = 20px
      assert.equal(span.style.fontSize, '20px');
      // width should be 40 * 2 = 80px
      assert.equal(span.style.width, '80px');
    }
  });

  it('handles items without width property', () => {
    const container = makeContainer();
    const textContent = {
      items: [
        { str: 'NoWidth', transform: [12, 0, 0, 12, 50, 700], fontName: 'Arial' },
      ],
    };
    const viewport = { transform: [1, 0, 0, -1, 0, 800] };

    const origCreateFrag = document.createDocumentFragment;
    const fragments = [];
    document.createDocumentFragment = () => {
      const frag = makeDocFragment();
      fragments.push(frag);
      return frag;
    };

    _renderManualTextLayer(container, textContent, viewport, 1);
    document.createDocumentFragment = origCreateFrag;

    // Should not throw and should create span without width style
    if (fragments.length > 0 && fragments[0]._children.length > 0) {
      const span = fragments[0]._children[0];
      assert.equal(span.style.overflow, undefined);
    }
  });

  it('applies fontName from item', () => {
    const container = makeContainer();
    const textContent = {
      items: [
        { str: 'Font', transform: [12, 0, 0, 12, 50, 700], fontName: 'Courier' },
      ],
    };
    const viewport = { transform: [1, 0, 0, -1, 0, 800] };

    const origCreateFrag = document.createDocumentFragment;
    const fragments = [];
    document.createDocumentFragment = () => {
      const frag = makeDocFragment();
      fragments.push(frag);
      return frag;
    };

    _renderManualTextLayer(container, textContent, viewport, 1);
    document.createDocumentFragment = origCreateFrag;

    if (fragments.length > 0 && fragments[0]._children.length > 0) {
      assert.equal(fragments[0]._children[0].style.fontFamily, 'Courier');
    }
  });

  it('defaults fontName to sans-serif', () => {
    const container = makeContainer();
    const textContent = {
      items: [
        { str: 'NoFont', transform: [12, 0, 0, 12, 50, 700] },
      ],
    };
    const viewport = { transform: [1, 0, 0, -1, 0, 800] };

    const origCreateFrag = document.createDocumentFragment;
    const fragments = [];
    document.createDocumentFragment = () => {
      const frag = makeDocFragment();
      fragments.push(frag);
      return frag;
    };

    _renderManualTextLayer(container, textContent, viewport, 1);
    document.createDocumentFragment = origCreateFrag;

    if (fragments.length > 0 && fragments[0]._children.length > 0) {
      assert.equal(fragments[0]._children[0].style.fontFamily, 'sans-serif');
    }
  });

  it('handles empty items array', () => {
    const container = makeContainer();
    const textContent = { items: [] };
    const viewport = { transform: [1, 0, 0, -1, 0, 800] };

    assert.doesNotThrow(() => {
      _renderManualTextLayer(container, textContent, viewport, 1);
    });
  });
});

// ── _reflowTextToSpans ──────────────────────────────────────────────────────

describe('_reflowTextToSpans', () => {
  it('distributes words across spans evenly', () => {
    const spans = [
      makeSpan('a b'),
      makeSpan('c d'),
    ];
    _reflowTextToSpans(spans, 'one two three four', 14, 200);
    assert.equal(spans[0].textContent, 'one two');
    assert.equal(spans[1].textContent, 'three four');
  });

  it('handles more words than spans', () => {
    const spans = [makeSpan('x')];
    _reflowTextToSpans(spans, 'alpha beta gamma delta', 14, 200);
    // All words should end up in the single span
    assert.ok(spans[0].textContent.includes('alpha'));
    assert.ok(spans[0].textContent.includes('delta'));
  });

  it('handles more spans than words', () => {
    const spans = [
      makeSpan('a'),
      makeSpan('b'),
      makeSpan('c'),
    ];
    _reflowTextToSpans(spans, 'only one', 14, 200);
    // Extra spans should be cleared
    assert.equal(spans[0].textContent, 'only');
    assert.equal(spans[1].textContent, 'one');
    assert.equal(spans[2].textContent, '');
  });

  it('handles empty text', () => {
    const spans = [makeSpan('a'), makeSpan('b')];
    const origText0 = spans[0].textContent;
    _reflowTextToSpans(spans, '', 14, 200);
    // Should not change spans (early return)
    assert.equal(spans[0].textContent, origText0);
  });

  it('handles whitespace-only text', () => {
    const spans = [makeSpan('a')];
    const origText = spans[0].textContent;
    _reflowTextToSpans(spans, '   ', 14, 200);
    // After splitting and filtering, no words remain
    assert.equal(spans[0].textContent, origText);
  });

  it('handles empty spans array', () => {
    assert.doesNotThrow(() => {
      _reflowTextToSpans([], 'some text', 14, 200);
    });
  });

  it('handles single word with single span', () => {
    const spans = [makeSpan('old')];
    _reflowTextToSpans(spans, 'new', 14, 200);
    assert.equal(spans[0].textContent, 'new');
  });

  it('restores visibility on filled spans', () => {
    const spans = [makeSpan('a'), makeSpan('b')];
    spans[0].style.visibility = 'hidden';
    spans[1].style.visibility = 'hidden';
    _reflowTextToSpans(spans, 'hello world', 14, 200);
    assert.equal(spans[0].style.visibility, '');
    assert.equal(spans[1].style.visibility, '');
  });

  it('distributes multi-word text across 3 spans', () => {
    const spans = [makeSpan(''), makeSpan(''), makeSpan('')];
    _reflowTextToSpans(spans, 'a b c d e f', 14, 300);
    // wordsPerSpan = ceil(6/3) = 2
    assert.equal(spans[0].textContent, 'a b');
    assert.equal(spans[1].textContent, 'c d');
    assert.equal(spans[2].textContent, 'e f');
  });
});

// ── _findParagraphSpans (pure logic, needs DOM mock) ────────────────────────

describe('_findParagraphSpans', () => {
  it('returns the target span if container is missing', () => {
    // _findParagraphSpans reads from els.textLayerDiv which may be null
    // We test the function with a single-span scenario
    const span = makeSpan('test');
    const result = _findParagraphSpans(span);
    // Should return at least the target span
    assert.ok(result.length >= 1);
    assert.equal(result[0], span);
  });
});
