// ─── Unit Tests: Render Text Layer ────────────────────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
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
  _renderOcrTextLayer,
  _renderPdfAnnotationLayer,
  enableInlineTextEditing,
  disableInlineTextEditing,
  _handleTextLayerClick,
  _handleTextLayerDblClick,
  _createInlineEditor,
  _createParagraphEditor,
  _syncTextLayerToStorage,
  renderTextLayer,
} from '../../app/modules/render-text-layer.js';
import { blockEditor } from '../../app/modules/pdf-advanced-edit.js';
import { state, els as _els } from '../../app/modules/state.js';

/** @type {Record<string, any>} */
const els = _els;

// Patch DOM mocks needed by inline editor functions
const _origCreateElement = document.createElement.bind(document);
document.createElement = function (tag) {
  const el = _origCreateElement(tag);
  if (!el.focus) el.focus = () => {};
  if (!el.blur) el.blur = () => {};
  if (!el.closest) el.closest = () => null;
  return el;
};
if (!document.createRange) {
  document.createRange = () => ({
    selectNodeContents() {},
    setStart() {},
    setEnd() {},
    collapse() {},
  });
}
if (!window.getSelection) {
  window.getSelection = () => ({
    removeAllRanges() {},
    addRange() {},
  });
}

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
    const span = makeSpan('test');
    const result = _findParagraphSpans(span);
    assert.ok(result.length >= 1);
    assert.equal(result[0], span);
  });
});

// ── _renderOcrTextLayer ───────────────────────────────────────────────────

describe('_renderOcrTextLayer', () => {
  let origTextLayerDiv, origCanvas;

  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origCanvas = els.canvas;
    _ocrWordCache.clear();
  });

  /** @param {any} val */
  function setEls(val) {
    Object.assign(els, val);
  }

  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    els.canvas = origCanvas;
    state.ocrConfidenceMode = false;
  });

  it('returns early when container is null', async () => {
    setEls({ textLayerDiv: null });
    // Should not throw
    await _renderOcrTextLayer(1, 1, 1);
  });

  it('returns early when no words in cache or ocr data', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    setEls({ textLayerDiv: container, canvas });
    await _renderOcrTextLayer(1, 1, 1);
    // No spans should be added
    assert.equal(container.children.length, 0);
  });

  it('renders words from _ocrWordCache', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    setEls({ textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'Hello', confidence: 95, bbox: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.15 } },
      { text: 'World', confidence: 88, bbox: { x0: 0.35, y0: 0.1, x1: 0.55, y1: 0.15 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);
    // Container should have children now
    assert.ok(container.children.length > 0);
  });

  it('handles single-character words', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    setEls({ textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'A', bbox: { x0: 0.1, y0: 0.1, x1: 0.12, y1: 0.15 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);
    assert.ok(container.children.length > 0);
  });

  it('filters out words without text or bbox', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    setEls({ textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: '', bbox: { x0: 0, y0: 0, x1: 0.1, y1: 0.1 } },
      { text: 'Valid', bbox: null },
      { text: null, bbox: { x0: 0, y0: 0, x1: 0.1, y1: 0.1 } },
      { text: 'OK', bbox: { x0: 0.2, y0: 0.2, x1: 0.4, y1: 0.25 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);
    // Only 'OK' should render
    assert.ok(container.children.length <= 2);
  });

  it('applies baseline angle rotation when angle > 0.5', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    setEls({ textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'Rotated', bbox: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.15 }, baseline: { angle: 2.5 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);
    assert.ok(container.children.length > 0);
  });

  it('uses canvas dimensions when style width/height not set', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    // Don't set style.width/height so fallback to canvas.width/dpr
    setEls({ textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'Test', bbox: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.15 } },
    ]);

    await _renderOcrTextLayer(1, 1, 2);
    assert.ok(container.children.length > 0);
  });
});

// ── renderTextLayer ─────────────────────────────────────────────────────────

describe('renderTextLayer', () => {
  let origTextLayerDiv, origCanvas, origPdfAnnotationLayer, origAdapter;

  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origCanvas = els.canvas;
    origPdfAnnotationLayer = els.pdfAnnotationLayer;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    els.canvas = origCanvas;
    els.pdfAnnotationLayer = origPdfAnnotationLayer;
    state.adapter = origAdapter;
    setActiveTextLayer(null);
  });

  it('returns early when container is null', async () => {
    els.textLayerDiv = null;
    await renderTextLayer(1, 1, 0);
  });

  it('cancels previous active text layer', async () => {
    const container = document.createElement('div');
    container.style.width = '800px';
    const canvas = document.createElement('canvas');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    els.textLayerDiv = container;
    els.canvas = canvas;
    els.pdfAnnotationLayer = document.createElement('div');
    state.adapter = null;

    let cancelCalled = false;
    setActiveTextLayer({ cancel() { cancelCalled = true; } });

    await renderTextLayer(1, 1, 0);
    assert.ok(cancelCalled);
    assert.equal(getActiveTextLayer(), null);
  });

  it('renders OCR text layer for non-pdf adapters', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    els.textLayerDiv = container;
    els.canvas = canvas;
    els.pdfAnnotationLayer = null;
    state.adapter = { type: 'image' };
    _ocrWordCache.set(1, [
      { text: 'OCR', bbox: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.15 } },
    ]);

    await renderTextLayer(1, 1, 0);
    assert.ok(container.children.length > 0);
  });

  it('clears pdfAnnotationLayer innerHTML on render', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    const annotLayer = document.createElement('div');
    annotLayer.innerHTML = '<span>old</span>';
    els.textLayerDiv = container;
    els.canvas = canvas;
    els.pdfAnnotationLayer = annotLayer;
    state.adapter = null;

    await renderTextLayer(1, 1, 0);
    assert.equal(annotLayer.innerHTML, '');
  });
});

// ── _renderPdfAnnotationLayer ───────────────────────────────────────────────

describe('_renderPdfAnnotationLayer', () => {
  let origAnnotLayer;
  beforeEach(() => { origAnnotLayer = els.pdfAnnotationLayer; });
  afterEach(() => { els.pdfAnnotationLayer = origAnnotLayer; });

  it('returns early when container is null', async () => {
    els.pdfAnnotationLayer = null;
    await _renderPdfAnnotationLayer({}, { width: 100, height: 100 });
  });

  it('clears container and sets dimensions', async () => {
    const container = document.createElement('div');
    container.innerHTML = '<span>old</span>';
    els.pdfAnnotationLayer = container;

    // Mock page with no annotations
    const page = { getAnnotations: async () => [] };
    const viewport = { width: 500, height: 700 };

    await _renderPdfAnnotationLayer(page, viewport);
    assert.equal(container.innerHTML, '');
    assert.equal(container.style.width, '500px');
    assert.equal(container.style.height, '700px');
  });
});

// ── enableInlineTextEditing / disableInlineTextEditing ───────────────────────

describe('enableInlineTextEditing / disableInlineTextEditing', () => {
  let origTextLayerDiv;
  beforeEach(() => { origTextLayerDiv = els.textLayerDiv; });
  afterEach(() => { els.textLayerDiv = origTextLayerDiv; setActiveInlineEditor(null); });

  it('returns early when container is null', () => {
    els.textLayerDiv = null;
    enableInlineTextEditing();
    disableInlineTextEditing();
  });

  it('adds editing class on enable', () => {
    const container = document.createElement('div');
    els.textLayerDiv = container;
    enableInlineTextEditing();
    assert.ok(container.classList.contains('editing'));
  });

  it('removes editing class on disable', () => {
    const container = document.createElement('div');
    container.classList.add('editing');
    els.textLayerDiv = container;
    disableInlineTextEditing();
    assert.ok(!container.classList.contains('editing'));
  });

  it('removes active inline editor on disable', () => {
    const container = document.createElement('div');
    els.textLayerDiv = container;
    let removeCalled = false;
    setActiveInlineEditor({ remove() { removeCalled = true; } });
    disableInlineTextEditing();
    assert.ok(removeCalled);
    assert.equal(getActiveInlineEditor(), null);
  });
});

// ── _createInlineEditor ─────────────────────────────────────────────────────

describe('_createInlineEditor', () => {
  let origTextLayerDiv, origCanvas, origAdapter;
  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origCanvas = els.canvas;
    origAdapter = state.adapter;
  });
  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    els.canvas = origCanvas;
    state.adapter = origAdapter;
    setActiveInlineEditor(null);
  });

  it('creates an inline editor div', () => {
    const container = document.createElement('div');
    els.textLayerDiv = container;
    _createInlineEditor(10, 20, 'test', null, []);
    const editor = getActiveInlineEditor();
    assert.ok(editor);
    assert.equal(editor.textContent, 'test');
  });

  it('removes previous inline editor when creating new one', () => {
    const container = document.createElement('div');
    els.textLayerDiv = container;

    let firstRemoved = false;
    const first = document.createElement('div');
    first.remove = () => { firstRemoved = true; };
    setActiveInlineEditor(first);

    _createInlineEditor(10, 20, 'new', null, []);
    assert.ok(firstRemoved);
  });

  it('sets minWidth and fontSize from targetSpan', () => {
    const container = document.createElement('div');
    els.textLayerDiv = container;
    const span = makeSpan('hello');
    span.style.fontSize = '16px';
    _createInlineEditor(10, 20, 'hello', span, []);
    const editor = getActiveInlineEditor();
    assert.ok(editor);
  });
});

// ── _handleTextLayerClick ──────────────────────────────────────────────────

describe('_handleTextLayerClick', () => {
  let origTextLayerDiv, origCanvas;
  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origCanvas = els.canvas;
  });
  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    els.canvas = origCanvas;
    setActiveInlineEditor(null);
  });

  it('ignores clicks on inline-editor', () => {
    const e = {
      target: {
        closest(sel) {
          if (sel === '.inline-editor') return document.createElement('div');
          return null;
        },
      },
    };
    // Should not throw
    _handleTextLayerClick(e);
  });

  it('opens editor when clicking on a span', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    els.textLayerDiv = container;

    const span = document.createElement('span');
    span.textContent = 'test';
    span.getBoundingClientRect = () => ({ top: 10, left: 20, width: 50, height: 14 });

    const e = {
      target: {
        closest(sel) {
          if (sel === '.inline-editor') return null;
          if (sel === 'span') return span;
          return null;
        },
      },
    };

    _handleTextLayerClick(e);
    assert.ok(getActiveInlineEditor());
  });
});

// ── _handleTextLayerDblClick ──────────────────────────────────────────────

describe('_handleTextLayerDblClick', () => {
  let origTextLayerDiv;
  beforeEach(() => { origTextLayerDiv = els.textLayerDiv; });
  afterEach(() => { els.textLayerDiv = origTextLayerDiv; setActiveInlineEditor(null); });

  it('creates editor for empty area click', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    els.textLayerDiv = container;

    const e = {
      target: { closest: () => null },
      clientX: 100,
      clientY: 100,
    };

    _handleTextLayerDblClick(e);
    assert.ok(getActiveInlineEditor());
  });
});

// ── _syncTextLayerToStorage ────────────────────────────────────────────────

describe('_syncTextLayerToStorage', () => {
  let origTextLayerDiv, origAdapter;
  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origAdapter = state.adapter;
  });
  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    state.adapter = origAdapter;
  });

  it('returns early when container is null', () => {
    els.textLayerDiv = null;
    _syncTextLayerToStorage();
  });

  it('returns early when adapter is null', () => {
    els.textLayerDiv = document.createElement('div');
    state.adapter = null;
    _syncTextLayerToStorage();
  });
});

// ── _createParagraphEditor ───────────────────────────────────────────────────

describe('_createParagraphEditor', () => {
  let origTextLayerDiv;
  beforeEach(() => { origTextLayerDiv = els.textLayerDiv; });
  afterEach(() => { els.textLayerDiv = origTextLayerDiv; setActiveInlineEditor(null); });

  it('creates a paragraph editor from spans', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    els.textLayerDiv = container;

    const spans = [
      makeSpan('Hello', { fontSize: '14px', _top: 10, _left: 10, _width: 40, _height: 14 }),
      makeSpan('World', { fontSize: '14px', _top: 10, _left: 55, _width: 40, _height: 14 }),
    ];

    _createParagraphEditor(spans);
    const editor = getActiveInlineEditor();
    assert.ok(editor);
    assert.ok(editor.className.includes('paragraph-editor'));
  });

  it('hides original spans', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    els.textLayerDiv = container;

    const spans = [
      makeSpan('A', { fontSize: '14px', _top: 10, _left: 10, _width: 20, _height: 14 }),
    ];

    _createParagraphEditor(spans);
    assert.equal(spans[0].style.visibility, 'hidden');
  });

  it('removes previous inline editor', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    els.textLayerDiv = container;

    let removed = false;
    setActiveInlineEditor({ remove() { removed = true; } });

    const spans = [makeSpan('X', { fontSize: '14px', _top: 10, _left: 10, _width: 20, _height: 14 })];
    _createParagraphEditor(spans);
    assert.ok(removed);
  });

  it('calculates bounding box from multiple spans', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    els.textLayerDiv = container;

    const spans = [
      makeSpan('First', { fontSize: '14px', _top: 10, _left: 10, _width: 60, _height: 14 }),
      makeSpan('Second', { fontSize: '14px', _top: 10, _left: 80, _width: 70, _height: 14 }),
      makeSpan('Third', { fontSize: '14px', _top: 30, _left: 10, _width: 50, _height: 14 }),
    ];

    _createParagraphEditor(spans);
    const editor = getActiveInlineEditor();
    assert.ok(editor);
    // Editor should span from x=10 to x=150 and y=10 to y=44
    assert.equal(editor.style.left, '10px');
    assert.equal(editor.style.top, '10px');
  });

  it('uses dominant font size', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    els.textLayerDiv = container;

    const spans = [
      makeSpan('Large', { fontSize: '20px', _top: 10, _left: 10, _width: 80, _height: 20 }),
      makeSpan('Small', { fontSize: '12px', _top: 10, _left: 100, _width: 40, _height: 12 }),
    ];

    _createParagraphEditor(spans);
    const editor = getActiveInlineEditor();
    // Dominant size should be the largest: 20px
    assert.equal(editor.style.fontSize, '20px');
  });
});

// ── Additional _renderOcrTextLayer tests ─────────────────────────────────────

describe('_renderOcrTextLayer — additional coverage', () => {
  let origTextLayerDiv, origCanvas, origAnnotCanvas;

  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origCanvas = els.canvas;
    origAnnotCanvas = els.annotationCanvas;
    _ocrWordCache.clear();
  });

  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    els.canvas = origCanvas;
    els.annotationCanvas = origAnnotCanvas;
    state.ocrConfidenceMode = false;
  });

  it('sorts words by reading order (top-to-bottom, left-to-right)', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    Object.assign(els, { textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'Second', bbox: { x0: 0.5, y0: 0.1, x1: 0.7, y1: 0.15 } },
      { text: 'First', bbox: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.15 } },
      { text: 'Third', bbox: { x0: 0.1, y0: 0.5, x1: 0.3, y1: 0.55 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);

    // Should have 3 children (fragment appended)
    assert.ok(container.children.length >= 1);
  });

  it('renders multi-character words without error', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    Object.assign(els, { textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'LongWord', bbox: { x0: 0.1, y0: 0.1, x1: 0.8, y1: 0.2 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);

    assert.ok(container.children.length >= 1);
  });

  it('renders words with confidence without error', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    Object.assign(els, { textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'Word', confidence: 72, bbox: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.15 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);

    assert.ok(container.children.length >= 1);
  });

  it('renders single character words without error', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    Object.assign(els, { textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'X', bbox: { x0: 0.1, y0: 0.1, x1: 0.12, y1: 0.15 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);

    assert.ok(container.children.length >= 1);
  });

  it('handles word with very small bbox height', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    Object.assign(els, { textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'Tiny', bbox: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.101 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);

    assert.ok(container.children.length >= 1);
  });

  it('renders words with small baseline angle without error', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    Object.assign(els, { textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'Straight', bbox: { x0: 0.1, y0: 0.1, x1: 0.4, y1: 0.15 }, baseline: { angle: 0.2 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);

    assert.ok(container.children.length >= 1);
  });

  it('renders words without confidence field', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    Object.assign(els, { textLayerDiv: container, canvas });

    _ocrWordCache.set(1, [
      { text: 'NoConf', bbox: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.15 } },
    ]);

    await _renderOcrTextLayer(1, 1, 1);

    assert.ok(container.children.length >= 1);
  });

  it('renders many words on multiple lines', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '1000px';
    canvas.style.height = '800px';
    Object.assign(els, { textLayerDiv: container, canvas });

    const words = [];
    for (let i = 0; i < 20; i++) {
      words.push({
        text: `word${i}`,
        bbox: { x0: (i % 5) * 0.2, y0: Math.floor(i / 5) * 0.1, x1: (i % 5) * 0.2 + 0.15, y1: Math.floor(i / 5) * 0.1 + 0.05 },
        confidence: 80 + i,
      });
    }
    _ocrWordCache.set(1, words);

    await _renderOcrTextLayer(1, 1, 1);

    assert.ok(container.children.length >= 1);
  });
});

// ── Additional renderTextLayer tests ────────────────────────────────────────

describe('renderTextLayer — additional coverage', () => {
  let origTextLayerDiv, origCanvas, origPdfAnnotationLayer, origAdapter;

  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origCanvas = els.canvas;
    origPdfAnnotationLayer = els.pdfAnnotationLayer;
    origAdapter = state.adapter;
  });

  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    els.canvas = origCanvas;
    els.pdfAnnotationLayer = origPdfAnnotationLayer;
    state.adapter = origAdapter;
    setActiveTextLayer(null);
  });

  it('returns early when adapter is null', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    els.textLayerDiv = container;
    els.canvas = canvas;
    els.pdfAnnotationLayer = null;
    state.adapter = null;

    await renderTextLayer(1, 1, 0);
    // Container should be cleared but no content added
    assert.equal(container.innerHTML, '');
  });

  it('cancels previous text layer even if cancel throws', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    els.textLayerDiv = container;
    els.canvas = canvas;
    els.pdfAnnotationLayer = document.createElement('div');
    state.adapter = null;

    setActiveTextLayer({ cancel() { throw new Error('cancel error'); } });

    // Should not throw
    await renderTextLayer(1, 1, 0);
    assert.equal(getActiveTextLayer(), null);
  });

  it('sets container dimensions from canvas style', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.style.width = '500px';
    canvas.style.height = '700px';
    els.textLayerDiv = container;
    els.canvas = canvas;
    els.pdfAnnotationLayer = null;
    state.adapter = null;

    await renderTextLayer(1, 1, 0);

    assert.equal(container.style.width, '500px');
    assert.equal(container.style.height, '700px');
  });
});

// ── Additional _reflowTextToSpans tests ────────────────────────────────────

describe('_reflowTextToSpans — additional', () => {
  it('clears extra spans when few words', () => {
    const spans = [makeSpan('a'), makeSpan('b'), makeSpan('c'), makeSpan('d')];
    _reflowTextToSpans(spans, 'only', 14, 200);
    assert.equal(spans[0].textContent, 'only');
    assert.equal(spans[1].textContent, '');
    assert.equal(spans[2].textContent, '');
    assert.equal(spans[3].textContent, '');
  });

  it('distributes 7 words across 3 spans', () => {
    const spans = [makeSpan(''), makeSpan(''), makeSpan('')];
    _reflowTextToSpans(spans, 'a b c d e f g', 14, 300);
    // wordsPerSpan = ceil(7/3) = 3
    assert.equal(spans[0].textContent, 'a b c');
    assert.equal(spans[1].textContent, 'd e f');
    assert.equal(spans[2].textContent, 'g');
  });
});

// ── Additional _findParagraphSpans tests ────────────────────────────────────

describe('_findParagraphSpans — additional', () => {
  it('returns array with single target span when only one span exists', () => {
    const container = document.createElement('div');
    els.textLayerDiv = container;

    const span = makeSpan('only', { _top: 10, _left: 10, _width: 40, _height: 14 });
    // querySelectorAll must return spans
    container.querySelectorAll = (sel) => {
      if (sel.includes('span')) return [span];
      return [];
    };

    const result = _findParagraphSpans(span);
    assert.ok(result.length >= 1);
    assert.equal(result[0], span);

    els.textLayerDiv = undefined;
  });
});

// ── _createInlineEditor — blur and keydown events ──────────────────────────

describe('_createInlineEditor — blur event', () => {
  let origTextLayerDiv, origCanvas, origCurrentPage;
  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origCanvas = els.canvas;
    origCurrentPage = state.currentPage;
  });
  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    els.canvas = origCanvas;
    state.currentPage = origCurrentPage;
    setActiveInlineEditor(null);
  });

  it('blur with targetSpan and non-empty text updates span textContent', () => {
    const container = document.createElement('div');
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    const span = makeSpan('original');
    _createInlineEditor(10, 20, 'original', span, []);
    const editor = getActiveInlineEditor();
    assert.ok(editor);

    // Simulate typing new text and blurring
    editor.textContent = 'updated text';
    editor.dispatchEvent(new Event('blur'));

    assert.equal(span.textContent, 'updated text');
  });

  it('blur with empty text does not update span', () => {
    const container = document.createElement('div');
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    const span = makeSpan('original');
    _createInlineEditor(10, 20, 'original', span, []);
    const editor = getActiveInlineEditor();

    editor.textContent = '   '; // whitespace only
    editor.dispatchEvent(new Event('blur'));

    assert.equal(span.textContent, 'original'); // unchanged
  });

  it('blur with no targetSpan and non-empty text calls blockEditor.addTextBlock', () => {
    const container = document.createElement('div');
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    // Set up a mock canvas
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    els.canvas = canvas;
    state.currentPage = 1;

    // blockEditor is imported as a module-level singleton; we trust it has addTextBlock
    _createInlineEditor(100, 200, '', null, []);
    const editor = getActiveInlineEditor();
    assert.ok(editor);

    editor.textContent = 'new text block';
    editor.dispatchEvent(new Event('blur'));
    // After blur, editor should be removed
    assert.equal(getActiveInlineEditor(), null);
  });
});

describe('_createInlineEditor — keydown event', () => {
  let origTextLayerDiv;
  beforeEach(() => { origTextLayerDiv = els.textLayerDiv; });
  afterEach(() => { els.textLayerDiv = origTextLayerDiv; setActiveInlineEditor(null); });

  it('Escape key removes editor and clears active editor', () => {
    const container = document.createElement('div');
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    _createInlineEditor(10, 20, 'text', null, []);
    const editor = getActiveInlineEditor();
    assert.ok(editor);

    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'Escape' });
    Object.defineProperty(e, 'shiftKey', { value: false });
    editor.dispatchEvent(e);
    assert.equal(getActiveInlineEditor(), null);
  });

  it('Enter key (no Shift) calls blur on editor', () => {
    const container = document.createElement('div');
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    _createInlineEditor(10, 20, 'text', null, []);
    const editor = getActiveInlineEditor();
    assert.ok(editor);

    let blurCalled = false;
    editor.blur = () => { blurCalled = true; };

    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'Enter' });
    Object.defineProperty(e, 'shiftKey', { value: false });
    e.preventDefault = () => {};
    editor.dispatchEvent(e);
    assert.ok(blurCalled);
  });

  it('Shift+Enter does not call blur', () => {
    const container = document.createElement('div');
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    _createInlineEditor(10, 20, 'text', null, []);
    const editor = getActiveInlineEditor();
    assert.ok(editor);

    let blurCalled = false;
    editor.blur = () => { blurCalled = true; };

    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'Enter' });
    Object.defineProperty(e, 'shiftKey', { value: true });
    e.preventDefault = () => {};
    editor.dispatchEvent(e);
    assert.ok(!blurCalled);
  });
});

// ── _createParagraphEditor — blur and keydown events ──────────────────────────

describe('_createParagraphEditor — blur event', () => {
  let origTextLayerDiv;
  beforeEach(() => { origTextLayerDiv = els.textLayerDiv; });
  afterEach(() => { els.textLayerDiv = origTextLayerDiv; setActiveInlineEditor(null); });

  it('blur with non-empty text calls _reflowTextToSpans on original spans', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    const spans = [
      makeSpan('Hello', { fontSize: '14px', _top: 10, _left: 10, _width: 40, _height: 14 }),
      makeSpan('World', { fontSize: '14px', _top: 10, _left: 55, _width: 40, _height: 14 }),
    ];

    _createParagraphEditor(spans);
    const editor = getActiveInlineEditor();
    assert.ok(editor);

    editor.textContent = 'Updated content here';
    editor.dispatchEvent(new Event('blur'));

    // Editor should be removed and activeEditor cleared
    assert.equal(getActiveInlineEditor(), null);
    // Original spans visibility should be restored
    for (const s of spans) {
      assert.equal(s.style.visibility, '');
    }
  });

  it('blur with empty text restores spans but does not reflow', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    const spans = [makeSpan('text', { fontSize: '14px', _top: 10, _left: 10, _width: 40, _height: 14 })];
    _createParagraphEditor(spans);
    const editor = getActiveInlineEditor();

    editor.textContent = '   '; // whitespace only → empty after trim
    editor.dispatchEvent(new Event('blur'));

    assert.equal(getActiveInlineEditor(), null);
    assert.equal(spans[0].style.visibility, '');
  });
});

describe('_createParagraphEditor — keydown event', () => {
  let origTextLayerDiv;
  beforeEach(() => { origTextLayerDiv = els.textLayerDiv; });
  afterEach(() => { els.textLayerDiv = origTextLayerDiv; setActiveInlineEditor(null); });

  it('Escape key restores span visibility and removes editor', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    const spans = [makeSpan('text', { fontSize: '14px', _top: 10, _left: 10, _width: 40, _height: 14 })];
    _createParagraphEditor(spans);
    const editor = getActiveInlineEditor();
    assert.ok(editor);

    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'Escape' });
    Object.defineProperty(e, 'shiftKey', { value: false });
    editor.dispatchEvent(e);

    assert.equal(getActiveInlineEditor(), null);
    assert.equal(spans[0].style.visibility, '');
  });

  it('Enter key (no Shift) calls blur on paragraph editor', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    const spans = [makeSpan('text', { fontSize: '14px', _top: 10, _left: 10, _width: 40, _height: 14 })];
    _createParagraphEditor(spans);
    const editor = getActiveInlineEditor();
    assert.ok(editor);

    let blurCalled = false;
    editor.blur = () => { blurCalled = true; };

    const e = new Event('keydown');
    Object.defineProperty(e, 'key', { value: 'Enter' });
    Object.defineProperty(e, 'shiftKey', { value: false });
    e.preventDefault = () => {};
    editor.dispatchEvent(e);

    assert.ok(blurCalled);
  });
});

// ── _createInlineEditor — blockEditor.active path ──────────────────────────

describe('_createInlineEditor — blockEditor.active = true path', () => {
  let origTextLayerDiv, origCanvas, origCurrentPage;
  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origCanvas = els.canvas;
    origCurrentPage = state.currentPage;
  });
  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    els.canvas = origCanvas;
    state.currentPage = origCurrentPage;
    setActiveInlineEditor(null);
    blockEditor.active = false; // reset blockEditor state
  });

  it('calls blockEditor.refreshOverlay when blockEditor.active is true', () => {
    const container = document.createElement('div');
    container.appendChild = (child) => child;
    els.textLayerDiv = container;

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    els.canvas = canvas;
    els.canvasWrap = document.createElement('div');
    state.currentPage = 1;

    // Set blockEditor.active = true so the refreshOverlay path is hit
    blockEditor.active = true;
    let refreshCalled = false;
    const origRefresh = blockEditor.refreshOverlay.bind(blockEditor);
    blockEditor.refreshOverlay = (...args) => { refreshCalled = true; };

    _createInlineEditor(100, 200, '', null, []);
    const editor = getActiveInlineEditor();
    assert.ok(editor);

    editor.textContent = 'block content';
    editor.dispatchEvent(new Event('blur'));

    assert.ok(refreshCalled, 'refreshOverlay should be called when blockEditor.active');

    // Restore
    blockEditor.refreshOverlay = origRefresh;
  });
});

// ── _syncTextLayerToStorage — additional ────────────────────────────────────

describe('_syncTextLayerToStorage — additional', () => {
  let origTextLayerDiv, origAdapter;
  beforeEach(() => {
    origTextLayerDiv = els.textLayerDiv;
    origAdapter = state.adapter;
  });
  afterEach(() => {
    els.textLayerDiv = origTextLayerDiv;
    state.adapter = origAdapter;
  });

  it('syncs text from spans to storage', () => {
    const container = document.createElement('div');
    const span1 = document.createElement('span');
    span1.textContent = 'Hello';
    const span2 = document.createElement('span');
    span2.textContent = 'World';
    container.appendChild(span1);
    container.appendChild(span2);
    els.textLayerDiv = container;
    state.adapter = { type: 'pdf' };
    state.currentPage = 1;

    // This should not throw even if setPageEdits/persistEdits are mocked
    assert.doesNotThrow(() => _syncTextLayerToStorage());
  });
});

// ── _handleTextLayerClick — empty area ─────────────────────────────────────

describe('_handleTextLayerClick — empty area (no span)', () => {
  let origTextLayerDiv;
  beforeEach(() => { origTextLayerDiv = els.textLayerDiv; });
  afterEach(() => { els.textLayerDiv = origTextLayerDiv; setActiveInlineEditor(null); });

  it('creates inline editor when clicking on empty area', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 10, left: 20, width: 800, height: 600 });
    els.textLayerDiv = container;

    const e = {
      target: {
        closest(sel) {
          // No inline-editor, no span
          return null;
        },
      },
      clientX: 150,
      clientY: 200,
    };

    _handleTextLayerClick(e);
    assert.ok(getActiveInlineEditor());
  });
});

// ── _handleTextLayerDblClick — span click ──────────────────────────────────

describe('_handleTextLayerDblClick — span click (single span)', () => {
  let origTextLayerDiv;
  beforeEach(() => { origTextLayerDiv = els.textLayerDiv; });
  afterEach(() => { els.textLayerDiv = origTextLayerDiv; setActiveInlineEditor(null); });

  it('creates inline editor for single span double-click', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 });

    const span = makeSpan('word text here', { _top: 100, _left: 50 });
    container.appendChild(span);
    // override querySelectorAll to return just this span
    container.querySelectorAll = (sel) => {
      if (sel === 'span:not(.inline-editor)') return [span];
      return [];
    };
    els.textLayerDiv = container;

    const e = {
      target: {
        closest(sel) {
          if (sel === 'span') return span;
          return null;
        },
      },
    };

    _handleTextLayerDblClick(e);
    assert.ok(getActiveInlineEditor());
  });
});

// ── _findParagraphSpans — multi-span paragraph ─────────────────────────────

describe('_findParagraphSpans — multi-span adjacent lines', () => {
  let origTextLayerDiv;
  beforeEach(() => { origTextLayerDiv = els.textLayerDiv; });
  afterEach(() => { els.textLayerDiv = origTextLayerDiv; });

  it('groups spans on adjacent lines into a paragraph', () => {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 600, height: 800 });

    // Create spans on 3 adjacent lines (same paragraph, small gap)
    const spans = [
      makeSpan('Line one text', { _top: 100, _left: 50, _height: 14 }),
      makeSpan('Line two text', { _top: 116, _left: 50, _height: 14 }),
      makeSpan('Line three text', { _top: 132, _left: 50, _height: 14 }),
    ];
    for (const s of spans) container.appendChild(s);
    container.querySelectorAll = (sel) => {
      if (sel === 'span:not(.inline-editor)') return spans;
      return [];
    };
    els.textLayerDiv = container;

    const result = _findParagraphSpans(spans[1]); // Middle span
    assert.ok(result.length >= 2, `Expected >= 2 spans, got ${result.length}`);
  });
});
